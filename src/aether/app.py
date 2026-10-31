import json
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, ValidationError

from aether.capture import WorkerBusy, render_job, worker_lock
from aether.contracts import ProductionSpec
from aether.paths import DEFAULT_DATA, DIST, FIXTURE, ROOT
from aether.review_api import review_view
from aether.storage import ACTIVE, RESUMABLE, Store
from aether.validation import CapabilityError, validate_capabilities


class CreateJob(BaseModel):
    model_config = ConfigDict(extra="forbid")
    spec: dict | None = None


class Review(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["approve", "reject", "revise"] = Field(
        validation_alias=AliasChoices("action", "decision")
    )
    note: str = Field(default="", max_length=4000, validation_alias=AliasChoices("note", "notes"))
    rubric: dict[str, int] = Field(default_factory=dict)


def create_app(data_dir: Path = DEFAULT_DATA, *, start_worker: bool = True) -> FastAPI:
    store = Store(data_dir)
    stop = threading.Event()
    owned_job = [None]

    def work():
        while not stop.wait(0.5):
            queued = [job for job in reversed(store.list()) if job["status"] == "queued"]
            waiting = sum(job["status"] == "awaiting_review" for job in store.list())
            if queued and waiting < 2:
                try:
                    owned_job[0] = queued[0]["id"]
                    render_job(store, queued[0]["id"])
                except WorkerBusy:
                    pass
                finally:
                    owned_job[0] = None

    @asynccontextmanager
    async def lifespan(app):
        worker = None
        if start_worker:
            try:
                with worker_lock(store):
                    store.recover_abandoned()
            except WorkerBusy:
                pass
            worker = threading.Thread(target=work, daemon=True, name="aether-worker")
            worker.start()
        yield
        stop.set()
        if worker:
            if owned_job[0] is not None:
                store.update(owned_job[0], cancel_requested=1)
            worker.join(timeout=15)

    app = FastAPI(title="AETHER", version="0.1.0", lifespan=lifespan)
    app.state.store = store
    app.mount("/static", StaticFiles(directory=DIST, check_dir=False), name="static")
    templates = Jinja2Templates(directory=ROOT / "web" / "templates")

    @app.middleware("http")
    async def local_origin(request: Request, call_next):
        origin = request.headers.get("origin")
        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and origin
            and origin != str(request.base_url).rstrip("/")
        ):
            from fastapi.responses import JSONResponse

            return JSONResponse(
                {"detail": "Only requests from this local workspace are accepted"}, status_code=403
            )
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    def get_job(job_id):
        try:
            return review_view(store, store.get(job_id))
        except KeyError:
            raise HTTPException(404, "Production not found") from None

    @app.get("/", response_class=HTMLResponse)
    def studio(request: Request, job: str | None = None):
        jobs = store.list()
        current = [
            item
            for item in jobs
            if item["status"] in ACTIVE | {"queued", "awaiting_review", "approved"}
        ]
        playable = [
            item
            for item in jobs
            if any(artifact["kind"] == "video" for artifact in item["artifacts"])
        ]
        selected = get_job(job) if job else next(iter(current or playable or jobs), None)
        manifest_path = DIST / ".vite" / "manifest.json"
        if not manifest_path.is_file():
            return HTMLResponse(
                "<h1>Build the review workspace</h1><p>Run npm ci &amp;&amp; npm run build, then reload.</p>",
                status_code=503,
            )
        manifest = json.loads(manifest_path.read_text())
        stylesheet = manifest["src/studio.css"]["file"]
        artifacts = {item["kind"]: item["id"] for item in selected["artifacts"]} if selected else {}
        versions = (
            {item["kind"]: item["sha256"] for item in selected["artifacts"]} if selected else {}
        )
        return templates.TemplateResponse(
            request=request,
            name="studio.html",
            context={
                "jobs": jobs,
                "selected": selected,
                "artifacts": artifacts,
                "artifact_versions": versions,
                "stylesheet": stylesheet,
                "active": ACTIVE,
            },
        )

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "version": "0.1.0",
            "renderer_built": (DIST / "renderer.html").is_file(),
        }

    @app.get("/jobs")
    def jobs():
        return [review_view(store, job) for job in store.list()]

    @app.post("/jobs", status_code=201)
    def create(body: CreateJob):
        raw = json.dumps(body.spec) if body.spec is not None else FIXTURE.read_text()
        try:
            spec = ProductionSpec.model_validate_json(raw)
        except ValidationError as error:
            raise HTTPException(
                422, json.loads(error.json(include_input=False, include_url=False))
            ) from None
        try:
            job = store.create(spec)
        except ValueError as error:
            raise HTTPException(409, str(error)) from None
        try:
            validate_capabilities(spec)
        except CapabilityError as error:
            store.update(job["id"], status="needs_development", error=str(error))
        return store.get(job["id"])

    @app.get("/jobs/{job_id}")
    def job(job_id: str):
        return get_job(job_id)

    @app.get("/jobs/{job_id}/spec")
    def specification(job_id: str):
        return get_job(job_id)["spec"]

    @app.get("/jobs/{job_id}/artifacts/{artifact_id}")
    def artifact(job_id: str, artifact_id: str, download: bool = False):
        try:
            path = store.artifact_path(job_id, artifact_id)
        except KeyError:
            raise HTTPException(404, "Artifact not found") from None
        return FileResponse(
            path,
            filename=f"aether-{job_id}.mp4" if download and path.suffix == ".mp4" else path.name,
            content_disposition_type="attachment" if download else "inline",
        )

    @app.post("/jobs/{job_id}/cancel")
    def cancel(job_id: str):
        job = get_job(job_id)
        if job["status"] not in ACTIVE | {"queued"}:
            raise HTTPException(409, "This production is not running")
        store.update(
            job_id,
            cancel_requested=1,
            **({"status": "cancelled"} if job["status"] == "queued" else {}),
        )
        return store.get(job_id)

    @app.post("/jobs/{job_id}/resume")
    def resume(job_id: str):
        job = get_job(job_id)
        if job["status"] not in RESUMABLE:
            raise HTTPException(409, "This production cannot be resumed")
        store.update(job_id, status="queued", cancel_requested=0, error=None)
        return store.get(job_id)

    @app.post("/jobs/{job_id}/review")
    def review(job_id: str, body: Review):
        job = get_job(job_id)
        if job["status"] != "awaiting_review":
            raise HTTPException(409, "Only completed productions can be reviewed")
        if body.action == "revise" and not body.note.strip():
            raise HTTPException(422, "Describe the revision so it can be addressed")
        try:
            store.record_review(job_id, body.action, body.note, body.rubric)
        except ValueError as error:
            raise HTTPException(409, str(error)) from error
        return get_job(job_id)

    return app
