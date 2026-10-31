"""Exact-format browser capture, bounded FFmpeg pipes, and five-second recovery chunks."""

import base64
import fcntl
import hashlib
import json
import os
import shutil
import subprocess
import threading
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

from aether.contracts import ProductionSpec
from aether.media import package, synthesize_audio, verify_video
from aether.paths import DIST, ROOT
from aether.storage import Store, atomic_json, digest
from aether.validation import CapabilityError, load_spec


class WorkerBusy(RuntimeError):
    pass


class Cancelled(RuntimeError):
    pass


@contextmanager
def worker_lock(store: Store):
    with (store.root / "worker.lock").open("a") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise WorkerBusy("Another production is running") from exc
        try:
            yield
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


@contextmanager
def scene_server(spec: ProductionSpec):
    raw = spec.model_dump_json().encode()

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(DIST), **kwargs)

        def do_GET(self):
            path = urlsplit(self.path).path
            if path == "/spec.json":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            elif path.startswith("/static/"):
                self.path = self.path.removeprefix("/static")
                super().do_GET()
            else:
                self.send_error(404)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def engine_fingerprint(spec: ProductionSpec, browser_version: str) -> str:
    result = hashlib.sha256(spec.model_dump_json().encode())
    result.update(browser_version.encode())
    for base in (DIST, ROOT / "src" / "aether"):
        for path in sorted(base.rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts:
                result.update(str(path.relative_to(ROOT)).encode())
                result.update(path.read_bytes())
    for filename in ("uv.lock", "package-lock.json"):
        if (ROOT / filename).exists():
            result.update((ROOT / filename).read_bytes())
    return result.hexdigest()


def check_cancel(store: Store, job_id: str) -> None:
    if store.get(job_id)["cancel_requested"]:
        raise Cancelled("Production cancelled; completed chunks are preserved")


def contact_sheet(paths: list[Path], target: Path) -> None:
    width, height = 216, 384
    rows = (len(paths) + 3) // 4
    sheet = Image.new("RGB", (width * 4, (height + 30) * rows), "#f5f4f0")
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(paths):
        with Image.open(path) as frame:
            frame.thumbnail((width, height))
            x, y = (i % 4) * width, (i // 4) * (height + 30)
            sheet.paste(frame, (x, y))
            draw.text(
                (x + 8, y + height + 6), f"Frame {int(path.stem.split('-')[-1])}", fill="#22252a"
            )
    sheet.save(target)


def preflight_samples(page, spec: ProductionSpec, directory: Path, cancel) -> tuple[list, Path]:
    sample_frames = sorted(
        {
            frame
            for shot in spec.shots
            for frame in (
                shot.start_frame,
                (shot.start_frame + shot.end_frame) // 2,
                shot.start_frame + (shot.end_frame - shot.start_frame) * 3 // 4,
            )
        }
        | {caption.start_frame for caption in spec.captions}
    )
    diagnostics, paths = [], []
    for frame in sample_frames:
        cancel()
        report = page.evaluate("frame => window.aether.renderFrame(frame)", frame)
        if report["warnings"] or report["missing_resources"]:
            raise ValueError(f"Frame {frame}: {report['warnings'] + report['missing_resources']}")
        diagnostics.append(report)
        path = directory / f"frame-{frame:06d}.png"
        page.screenshot(path=str(path), type="png")
        paths.append(path)
    # Request a frame after a different shot, then repeat it. Compare both state and pixels.
    check = sample_frames[1]
    first_state = page.evaluate("frame => window.aether.renderFrame(frame)", check)
    first_pixels = page.screenshot(type="png")
    page.evaluate("frame => window.aether.renderFrame(frame)", sample_frames[-1])
    second_state = page.evaluate("frame => window.aether.renderFrame(frame)", check)
    second_pixels = page.screenshot(type="png")
    if first_state != second_state or first_pixels != second_pixels:
        raise ValueError("Out-of-order frame sampling is not deterministic in this environment")
    sheet = directory / "contact-sheet.jpg"
    contact_sheet(paths, sheet)
    return diagnostics, sheet


def capture_chunk(page, session, start: int, end: int, output: Path, cancel) -> None:
    temporary = output.with_suffix(".partial.mkv")
    command = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-f",
        "image2pipe",
        "-framerate",
        "30",
        "-vcodec",
        "png",
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "ffv1",
        "-level",
        "3",
        "-pix_fmt",
        "bgr0",
        str(temporary),
    ]
    with output.with_suffix(".log").open("wb") as errors:
        process = subprocess.Popen(
            command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=errors
        )
        try:
            for frame in range(start, end):
                if frame % 10 == 0:
                    cancel()
                page.evaluate("frame => window.aether.renderFrame(frame)", frame)
                # Playwright's CDP session captures the same complete canvas + DOM composition.
                # PNG's faster compression changes only bytes, not pixels (benchmark_capture.py).
                screenshot = session.send(
                    "Page.captureScreenshot",
                    {"format": "png", "captureBeyondViewport": False, "optimizeForSpeed": True},
                )
                process.stdin.write(base64.b64decode(screenshot["data"]))
            process.stdin.close()
            if process.wait(timeout=120) != 0:
                raise RuntimeError(
                    f"FFmpeg chunk capture failed; see {output.with_suffix('.log').name}"
                )
            verify_video(temporary, end - start)
            temporary.replace(output)
        except BaseException:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            if process.stdin and not process.stdin.closed:
                process.stdin.close()
            raise


def launch_options() -> dict:
    """Optional overrides for hosts without Playwright's bundled browser (e.g. CI containers)."""
    options: dict = {}
    if executable := os.environ.get("AETHER_CHROMIUM"):
        options["executable_path"] = executable
    if extra := os.environ.get("AETHER_CHROMIUM_ARGS"):
        options["args"] = extra.split()
    return options


def render_job(store: Store, job_id: str, *, samples_only: bool = False) -> dict:
    with worker_lock(store):
        job = store.get(job_id)
        if job["status"] in {"approved", "rejected", "awaiting_review"}:
            raise ValueError("Finished jobs are immutable; create a new production for changes")
        directory = store.job_dir(job_id)
        attempt_id = None
        try:
            store.update(job_id, status="validating", error=None)
            check_cancel(store, job_id)
            spec = load_spec(json.dumps(job["spec"]))
            if not DIST.is_dir():
                raise RuntimeError("Renderer is not built. Run npm ci && npm run build")
            if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
                raise RuntimeError("FFmpeg and FFprobe are required on PATH")
            if shutil.disk_usage(directory).free < 2 * 1024**3:
                raise RuntimeError("At least 2 GiB of scratch disk space is required")
            with scene_server(spec) as origin, sync_playwright() as playwright:
                with playwright.chromium.launch(headless=True, **launch_options()) as browser:
                    fingerprint = engine_fingerprint(spec, browser.version)
                    attempt_id = store.begin_attempt(job_id, fingerprint)
                    context = browser.new_context(
                        viewport={"width": 1080, "height": 1920},
                        device_scale_factor=1,
                        reduced_motion="reduce",
                        color_scheme="light",
                    )
                    context.route(
                        "**/*",
                        lambda route: (
                            route.continue_()
                            if route.request.url.startswith(origin + "/")
                            else route.abort()
                        ),
                    )
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(
                        f"{origin}/static/renderer.html?spec=/spec.json", wait_until="networkidle"
                    )
                    page.wait_for_function(
                        "window.aether?.ready === true || window.aetherError", timeout=60000
                    )
                    renderer_error = page.evaluate("window.aetherError || null")
                    if renderer_error:
                        raise RuntimeError(renderer_error)
                    store.update(job_id, status="checking_frames")
                    diagnostics, sheet = preflight_samples(
                        page, spec, directory, lambda: check_cancel(store, job_id)
                    )
                    if errors:
                        raise RuntimeError("; ".join(errors))
                    atomic_json(directory / "frame-diagnostics.json", diagnostics)
                    store.register(job_id, "contact_sheet", sheet)
                    store.register(job_id, "poster", directory / "frame-000000.png")
                    store.register(
                        job_id, "frame_diagnostics", directory / "frame-diagnostics.json"
                    )
                    if samples_only:
                        store.update(job_id, status="queued")
                        store.finish_attempt(attempt_id, "sampled")
                        return store.get(job_id)
                    manifest_path = directory / "checkpoint.json"
                    manifest = (
                        json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
                    )
                    if manifest.get("fingerprint") != fingerprint:
                        manifest = {
                            "fingerprint": fingerprint,
                            "browser": browser.version,
                            "chunks": {},
                        }
                    chunks = []
                    capture_session = context.new_cdp_session(page)
                    for start in range(0, spec.output.total_frames, 150):
                        check_cancel(store, job_id)
                        end = min(start + 150, spec.output.total_frames)
                        path = directory / f"chunk-{start:06d}.mkv"
                        checkpoint = manifest["chunks"].get(str(start))
                        valid = (
                            checkpoint and path.is_file() and digest(path) == checkpoint["sha256"]
                        )
                        store.update(job_id, status="rendering", completed_frames=start)
                        if valid:
                            verify_video(path, end - start)
                        else:
                            capture_chunk(
                                page,
                                capture_session,
                                start,
                                end,
                                path,
                                lambda: check_cancel(store, job_id),
                            )
                            manifest["chunks"][str(start)] = {
                                "end_frame": end,
                                "sha256": digest(path),
                            }
                            atomic_json(manifest_path, manifest)
                        chunks.append(path)
                        store.update(job_id, completed_frames=end)
                    context.close()
            check_cancel(store, job_id)
            store.update(job_id, status="packaging")
            audio = directory / "effects.wav"
            synthesize_audio(spec, audio, lambda: check_cancel(store, job_id))
            output = directory / "short.mp4"
            package(
                chunks, audio, output, directory / "encode.log", lambda: check_cancel(store, job_id)
            )
            check_cancel(store, job_id)
            info = verify_video(
                output,
                spec.output.total_frames,
                delivery=True,
                target_lufs=spec.audio_loudness_lufs,
            )
            atomic_json(directory / "media-report.json", info)
            store.register(job_id, "video", output)
            store.register(job_id, "media_report", directory / "media-report.json")
            for kind, filename in (
                ("audio_report", "audio-report.json"),
                ("sound_cues", "sound-cues.json"),
                ("delivery_report", "delivery-report.json"),
            ):
                if (directory / filename).is_file():
                    store.register(job_id, kind, directory / filename)
            store.register(job_id, "checkpoint", manifest_path)
            store.update(job_id, status="awaiting_review")
            store.finish_attempt(attempt_id, "awaiting_review")
        except CapabilityError as error:
            store.update(job_id, status="needs_development", error=str(error))
        except Cancelled as error:
            store.update(job_id, status="cancelled", error=str(error))
            if attempt_id:
                store.finish_attempt(attempt_id, "cancelled")
        except Exception as error:
            store.update(job_id, status="failed", error=f"{type(error).__name__}: {error}")
            if attempt_id:
                store.finish_attempt(attempt_id, "failed")
        return store.get(job_id)
