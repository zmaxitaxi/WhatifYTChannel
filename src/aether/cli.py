import argparse
import json
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

from aether.contracts import FactPack
from aether.paths import DEFAULT_DATA, FIXTURE, ROOT
from aether.schema import export_schema
from aether.storage import RESUMABLE, Store
from aether.validation import load_spec


def main():
    parser = argparse.ArgumentParser(description="AETHER — local university Shorts production")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="Check local tools and ChatGPT CLI authentication")
    schema = commands.add_parser("schema", help="Export the authoritative JSON Schema")
    schema.add_argument(
        "--output", type=Path, default=ROOT / "contracts" / "production.schema.json"
    )
    validate = commands.add_parser("validate", help="Validate a production specification")
    validate.add_argument("spec", type=Path)
    demo = commands.add_parser("demo", help="Render the included 60-second V01 production")
    demo.add_argument("--samples-only", action="store_true")
    render = commands.add_parser("render", help="Render a supplied specification")
    render.add_argument("spec", type=Path)
    render.add_argument("--samples-only", action="store_true")
    remix = commands.add_parser(
        "remix", help="Revise audio using a completed video's unchanged visual stream"
    )
    remix.add_argument("job_id")
    remix.add_argument("spec", type=Path)
    resume = commands.add_parser("resume", help="Resume an interrupted job from saved chunks")
    resume.add_argument("job_id")
    resume.add_argument("--samples-only", action="store_true")
    commands.add_parser("jobs", help="List saved productions")
    cancel = commands.add_parser("cancel", help="Request cancellation")
    cancel.add_argument("job_id")
    review = commands.add_parser("review", help="Approve, reject, or record a revision request")
    review.add_argument("job_id")
    review.add_argument("action", choices=["approve", "reject", "revise"])
    review.add_argument("--note", default="")
    serve = commands.add_parser("serve", help="Run the local review workspace and one worker")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument(
        "--no-worker",
        action="store_true",
        help="Inspect saved productions without starting queued work",
    )
    plan = commands.add_parser("plan", help="Plan V01 with ChatGPT-authenticated Codex CLI")
    plan.add_argument("--topic", default="What if Stanford was in Boston?")
    plan.add_argument("--facts", type=Path)
    plan.add_argument("--render", action="store_true")
    plan.add_argument(
        "--model", help="ChatGPT-supported Codex model (defaults to your configured choice)"
    )
    args = parser.parse_args()
    try:
        if args.command == "schema":
            export_schema(args.output)
            print(args.output)
            return
        if args.command == "validate":
            spec = load_spec(args.spec.read_text())
            print(
                json.dumps(
                    {"status": "valid", "topic": spec.topic, "frames": spec.output.total_frames}
                )
            )
            return
        if args.command == "doctor":
            checks = {}
            for name in ("node", "npm", "ffmpeg", "ffprobe", "codex"):
                checks[name] = bool(shutil.which(name))
            from playwright.sync_api import sync_playwright

            with sync_playwright() as playwright:
                checks["chromium"] = Path(playwright.chromium.executable_path).is_file()
            from aether.codex_adapter import CodexAdapter

            try:
                checks["codex_chatgpt"] = CodexAdapter().version_and_auth()
            except Exception as error:
                checks["codex_chatgpt"] = str(error)
            checks["renderer_built"] = (ROOT / "web" / "dist" / "renderer.html").is_file()
            print(json.dumps(checks, indent=2))
            return
        if args.command == "serve":
            import uvicorn

            from aether.app import create_app

            uvicorn.run(
                create_app(args.data_dir, start_worker=not args.no_worker),
                host="127.0.0.1",
                port=args.port,
            )
            return
        store = Store(args.data_dir)
        if args.command == "remix":
            from aether.audio_revision import remix_job

            result = remix_job(store, args.job_id, load_spec(args.spec.read_text()))
            print(
                json.dumps(
                    {key: result[key] for key in ("id", "status", "completed_frames", "error")},
                    indent=2,
                )
            )
            return
        if args.command == "plan":
            from aether.codex_adapter import CodexAdapter

            template = json.loads(FIXTURE.read_text())
            facts = FactPack.model_validate_json(
                args.facts.read_text() if args.facts else json.dumps(template["evidence"])
            )
            directory = store.root / "planning" / uuid.uuid4().hex[:12]
            print(f"Planning with Codex; candidates and events: {directory}", flush=True)
            spec = CodexAdapter(model=args.model).plan(args.topic, facts, template, directory)
            print(directory / "spec.json", flush=True)
            if not args.render:
                return
            args.command = "render_planned"
        if args.command in {"demo", "render", "render_planned"}:
            if args.command != "render_planned":
                spec = load_spec((FIXTURE if args.command == "demo" else args.spec).read_text())
            job = store.create(spec)
            print(f"Production {job['id']} created; output: {store.job_dir(job['id'])}", flush=True)
        elif args.command == "resume":
            job = store.get(args.job_id)
            if job["status"] not in RESUMABLE | {"queued"}:
                raise ValueError("This production cannot be resumed")
            store.update(args.job_id, status="queued", cancel_requested=0, error=None)
        elif args.command == "jobs":
            print(
                json.dumps(
                    [
                        {key: job[key] for key in ("id", "status", "completed_frames", "error")}
                        for job in store.list()
                    ],
                    indent=2,
                )
            )
            return
        elif args.command == "cancel":
            from aether.storage import ACTIVE

            job = store.get(args.job_id)
            if job["status"] not in ACTIVE | {"queued"}:
                raise ValueError("This production is not running")
            store.update(
                args.job_id,
                cancel_requested=1,
                **({"status": "cancelled"} if job["status"] == "queued" else {}),
            )
            print("Cancellation requested")
            return
        elif args.command == "review":
            job = store.get(args.job_id)
            if job["status"] != "awaiting_review":
                raise ValueError("Only completed productions can be reviewed")
            if args.action == "revise" and not args.note.strip():
                raise ValueError("Describe the requested revision with --note")
            store.record_review(args.job_id, args.action, args.note)
            print(json.dumps(store.get(args.job_id), indent=2))
            return
        from aether.capture import render_job

        result = render_job(store, job["id"], samples_only=getattr(args, "samples_only", False))
        print(
            json.dumps(
                {key: result[key] for key in ("id", "status", "completed_frames", "error")},
                indent=2,
            )
        )
        if result["status"] not in {"awaiting_review", "queued"}:
            sys.exit(1)
    except (ValueError, KeyError, OSError, subprocess.SubprocessError, RuntimeError) as error:
        print(
            json.dumps({"status": getattr(error, "status", "failed"), "error": str(error)}),
            file=sys.stderr,
        )
        sys.exit(1)
