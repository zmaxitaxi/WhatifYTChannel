"""Server-rendered review pages for AETHER jobs.

Every page is plain HTML rendered here; forms post back to this app, which
forwards the action to Max's local API and redirects (POST → redirect → GET).
No client-side JavaScript is required.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import review_logic as rules
from .client import ApiError, ApiUnavailable, JobApiClient, iter_and_close, valid_id

HERE = Path(__file__).parent
DEFAULT_API_URL = "http://127.0.0.1:8000"

# Headers passed through when proxying artifacts so video seeking works.
PASSTHROUGH_HEADERS = ("content-type", "content-length", "content-range", "accept-ranges",
                       "content-disposition", "etag", "last-modified")
EXTENSIONS = {"video/mp4": ".mp4", "image/svg+xml": ".svg", "image/png": ".png",
              "image/jpeg": ".jpg", "application/json": ".json", "text/plain": ".txt"}


def _safe_url(value: Any) -> str | None:
    """Only render http(s) source links; never javascript: or data: URLs."""
    text = str(value or "")
    return text if text.startswith(("https://", "http://")) else None


def _seconds(value: Any) -> str:
    try:
        total = float(value)
    except (TypeError, ValueError):
        return "—"
    if total < 60:
        return f"{total:.1f} s"
    minutes, secs = divmod(int(round(total)), 60)
    return f"{minutes} min {secs:02d} s"


def _bytes(value: Any) -> str:
    try:
        size = float(value)
    except (TypeError, ValueError):
        return ""
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return ""


def create_app(api_url: str | None = None,
               transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    api_url = api_url or os.environ.get("AETHER_API_URL", DEFAULT_API_URL)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await app.state.api.aclose()

    app = FastAPI(title="AETHER review", lifespan=lifespan, docs_url=None, redoc_url=None,
                  openapi_url=None)
    app.state.api = JobApiClient(api_url, transport=transport)
    app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")

    templates = Jinja2Templates(directory=HERE / "templates")
    env = templates.env
    env.globals.update(
        rubric=rules.RUBRIC,
        pipeline=rules.PIPELINE_STATES,
        queue_limit=rules.REVIEW_QUEUE_LIMIT,
        state_label=rules.state_label,
        state_tone=rules.state_tone,
        api_url=api_url,
    )
    env.filters.update(safe_url=_safe_url, seconds=_seconds, filesize=_bytes)

    def api(request: Request) -> JobApiClient:
        return request.app.state.api

    def page(request: Request, name: str, status: int = 200, **context: Any) -> HTMLResponse:
        context.setdefault("notice", request.query_params.get("notice"))
        context.setdefault("error", request.query_params.get("error"))
        return templates.TemplateResponse(request, name, context, status_code=status)

    def failure(request: Request, exc: Exception) -> HTMLResponse:
        if isinstance(exc, ApiUnavailable):
            return page(request, "error.html", status=503, title="Job API is not running",
                        message=str(exc), hint="Start Max's API, or run the mock API "
                        "(python -m aether_review.mock_api) for page development.")
        assert isinstance(exc, ApiError)
        status = 404 if exc.status_code == 404 else 502
        title = "Job not found" if status == 404 else "The job API returned an error"
        return page(request, "error.html", status=status, title=title, message=exc.detail)

    def back_to_job(job_id: str, **params: str) -> RedirectResponse:
        query = urlencode({k: v for k, v in params.items() if v})
        url = f"/jobs/{quote(job_id)}" + (f"?{query}" if query else "")
        return RedirectResponse(url, status_code=303)

    @app.get("/", response_class=HTMLResponse)
    async def job_list(request: Request):
        try:
            jobs = await api(request).list_jobs()
        except (ApiError, ApiUnavailable) as exc:
            return failure(request, exc)
        jobs.sort(key=lambda j: str(j.get("updated_at") or j.get("created_at") or ""),
                  reverse=True)
        awaiting = [j for j in jobs if j.get("state") == "awaiting_review"]
        in_progress = [j for j in jobs if j.get("state") in rules.ACTIVE_STATES]
        finished = [j for j in jobs if j not in awaiting and j not in in_progress]
        return page(request, "jobs.html", awaiting=awaiting, in_progress=in_progress,
                    finished=finished, total=len(jobs))

    @app.get("/jobs/{job_id}", response_class=HTMLResponse)
    async def job_detail(request: Request, job_id: str):
        try:
            job = await api(request).get_job(job_id)
        except (ApiError, ApiUnavailable) as exc:
            return failure(request, exc)
        return render_job(request, job)

    def render_job(request: Request, job: dict[str, Any], status: int = 200,
                   submission: rules.ReviewSubmission | None = None) -> HTMLResponse:
        artifacts = [a for a in job.get("artifacts") or [] if isinstance(a, dict)]
        final_video = job.get("final_video") or next(
            (a for a in artifacts if a.get("kind") == "final_video"), None)
        contact_sheets = job.get("contact_sheets") or [
            a for a in artifacts if a.get("kind") == "contact_sheet"]
        return page(
            request, "job.html", status=status, job=job,
            actions=rules.allowed_actions(job),
            position=rules.pipeline_position(str(job.get("state", ""))),
            final_video=final_video, contact_sheets=contact_sheets, artifacts=artifacts,
            blocking=rules.blocking_findings(job),
            submission=submission or rules.ReviewSubmission(),
        )

    @app.post("/jobs/{job_id}/review", response_class=HTMLResponse)
    async def submit_review(request: Request, job_id: str):
        form = await request.form()
        submission = rules.parse_review_form(form)
        if submission.errors:
            try:
                job = await api(request).get_job(job_id)
            except (ApiError, ApiUnavailable) as exc:
                return failure(request, exc)
            return render_job(request, job, status=422, submission=submission)
        try:
            await api(request).review(job_id, submission.decision, submission.notes,
                                      submission.rubric)
        except ApiUnavailable as exc:
            return failure(request, exc)
        except ApiError as exc:
            if exc.status_code == 404:
                return failure(request, exc)
            return back_to_job(job_id, error=f"Review not recorded: {exc.detail}")
        verb = {"approve": "Approved", "reject": "Rejected",
                "revise": "Revision requested"}[submission.decision]
        return back_to_job(job_id, notice=f"{verb}.")

    async def simple_action(request: Request, job_id: str, action: str, done: str):
        client = api(request)
        try:
            await (client.cancel(job_id) if action == "cancel" else client.resume(job_id))
        except ApiUnavailable as exc:
            return failure(request, exc)
        except ApiError as exc:
            if exc.status_code == 404:
                return failure(request, exc)
            return back_to_job(job_id, error=f"Could not {action}: {exc.detail}")
        return back_to_job(job_id, notice=done)

    @app.post("/jobs/{job_id}/cancel")
    async def cancel_job(request: Request, job_id: str):
        return await simple_action(request, job_id, "cancel", "Cancellation requested.")

    @app.post("/jobs/{job_id}/resume")
    async def resume_job(request: Request, job_id: str):
        return await simple_action(request, job_id, "resume", "Resume requested.")

    @app.get("/jobs/{job_id}/artifacts/{artifact_id}")
    async def artifact(request: Request, job_id: str, artifact_id: str):
        """Stream a registered artifact through this app so the video player and
        downloads stay same-origin. Range requests are forwarded for seeking."""
        if not (valid_id(job_id) and valid_id(artifact_id)):
            return Response("Unknown artifact.", status_code=404, media_type="text/plain")
        try:
            upstream = await api(request).open_artifact(
                job_id, artifact_id, request.headers.get("range"))
        except ApiUnavailable as exc:
            return Response(str(exc), status_code=503, media_type="text/plain")
        except ApiError as exc:
            status = exc.status_code if exc.status_code in (404, 416) else 502
            return Response(exc.detail, status_code=status, media_type="text/plain")
        headers = {k: v for k, v in upstream.headers.items() if k.lower() in PASSTHROUGH_HEADERS}
        if request.query_params.get("download") == "1":
            extension = EXTENSIONS.get(upstream.headers.get("content-type", "").split(";")[0], "")
            headers["content-disposition"] = (
                f'attachment; filename="{job_id}-{artifact_id}{extension}"')
        headers.pop("content-type", None)
        return StreamingResponse(iter_and_close(upstream), status_code=upstream.status_code,
                                 headers=headers,
                                 media_type=upstream.headers.get("content-type",
                                                                 "application/octet-stream"))

    return app
