"""A stand-in for Max's local job API, for building and testing the review pages.

It implements the endpoints from TECHNICAL_PLAN.md "Local interface" with the
response shapes in review/API_CONTRACT.md, backed by in-memory sample jobs.
All facts and numbers below are placeholder fixture data, not a verified fact
pack.

Run it with:  python -m aether_review.mock_api   (listens on 127.0.0.1:8000)
"""

from __future__ import annotations

import copy
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from .review_logic import ACTIVE_STATES, RUBRIC_KEYS, WAITING_STATES


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _sheet(artifact_id: str, label: str, frames: list[int]) -> dict[str, Any]:
    return {"id": artifact_id, "kind": "contact_sheet", "label": label,
            "media_type": "image/svg+xml", "frames": frames}


V01_ARTIFACTS = [
    {"id": "final_mp4", "kind": "final_video", "label": "Final Short (H.264, 1080×1920, 30 fps)",
     "media_type": "video/mp4", "bytes": 48_211_904, "duration_seconds": 60.0},
    _sheet("sheet_open", "Opening frames 0–90", [0, 15, 30, 45, 60, 75]),
    _sheet("sheet_boundaries", "Shot boundaries", [89, 90, 179, 180, 269, 270]),
    _sheet("sheet_reveal", "Boston arrival reveal", [1500, 1560, 1620, 1680, 1740, 1799]),
    {"id": "eval_report", "kind": "evaluation_report", "label": "Evaluation report",
     "media_type": "application/json", "bytes": 18_402},
    {"id": "caption_track", "kind": "caption_track", "label": "Caption track",
     "media_type": "application/json", "bytes": 6_120},
]

SAMPLE_JOBS: list[dict[str, Any]] = [
    {
        "id": "job_v01_stanford_boston_001",
        "concept": "V01",
        "topic": "What if Stanford was in Boston?",
        "scenario_family": "relocation",
        "state": "awaiting_review",
        "created_at": "2026-10-31T15:02:11+00:00",
        "updated_at": "2026-10-31T16:41:52+00:00",
        "runtime_seconds": 60.0,
        "total_frames": 1800,
        "attempt_count": 2,
        "facts": [
            {"id": "f1", "claim": "Stanford's main campus sits beside Palo Alto, California.",
             "source_title": "Stanford University — About", "source_url": "https://www.stanford.edu/about/",
             "accessed": "2026-10-30", "shown_on_screen": True},
            {"id": "f2", "claim": "Palo Alto to Boston is roughly 2,700 miles in a straight line.",
             "source_title": "Great-circle calculation (fixture)", "source_url": None,
             "calculation": "Haversine between campus centroids", "accessed": "2026-10-30",
             "shown_on_screen": True},
            {"id": "f3", "claim": "Boston winters bring regular snowfall; Palo Alto rarely sees snow.",
             "source_title": "NOAA climate normals (fixture)", "source_url": "https://www.ncei.noaa.gov/",
             "accessed": "2026-10-30", "shown_on_screen": False},
        ],
        "hypothetical_claims": [
            {"id": "h1", "claim": "The whole campus lifts off and flies east intact.",
             "treatment": "\"WHAT IF\" header and stylized flight path", "basis": "Premise of the video"},
            {"id": "h2", "claim": "Stanford lands along the Charles River near Harvard and MIT.",
             "treatment": "Labeled \"Imagined location\" on the map", "basis": "Chosen for comparison"},
            {"id": "h3", "claim": "Students trade palm trees for snow boots.",
             "treatment": "Caption marked as joke beat", "basis": "Extrapolated from fact f3"},
        ],
        "evaluation_findings": [
            {"severity": "warning", "check": "caption_reading_load",
             "message": "Caption at frames 912–960 is 14 words in 1.6 s; above the 3 words/s target.",
             "frame": 912, "resolved": False},
            {"severity": "info", "check": "landmark_recognition",
             "message": "Hoover Tower visible and unoccluded in 94% of shot 2 samples.", "frame": 120},
            {"severity": "error", "check": "text_collision",
             "message": "Distance label overlapped the route line in attempt 1.", "frame": 214,
             "resolved": True},
        ],
        "attempts": [
            {"number": 1, "kind": "initial", "started_at": "2026-10-31T15:02:11+00:00",
             "finished_at": "2026-10-31T15:39:40+00:00", "outcome": "repairable",
             "stages": [{"name": "planning", "seconds": 212}, {"name": "validating", "seconds": 4},
                        {"name": "checking_frames", "seconds": 388}, {"name": "evaluating", "seconds": 1645}]},
            {"number": 2, "kind": "repair", "started_at": "2026-10-31T15:40:02+00:00",
             "finished_at": "2026-10-31T16:41:52+00:00", "outcome": "passed",
             "stages": [{"name": "planning", "seconds": 141}, {"name": "validating", "seconds": 3},
                        {"name": "checking_frames", "seconds": 351}, {"name": "evaluating", "seconds": 604},
                        {"name": "rendering", "seconds": 1490}, {"name": "packaging", "seconds": 96}]},
        ],
        "failures": [],
        "artifacts": V01_ARTIFACTS,
        "reviews": [],
    },
    {
        "id": "job_v02_berkeley_stanford_swap_001",
        "concept": "V02",
        "topic": "What if Berkeley and Stanford switched campuses?",
        "scenario_family": "swap",
        "state": "rendering",
        "created_at": "2026-10-31T17:10:00+00:00",
        "updated_at": "2026-10-31T17:52:31+00:00",
        "attempt_count": 1,
        "progress": {"stage": "rendering", "completed_frames": 1140, "total_frames": 1800},
        "facts": [], "hypothetical_claims": [], "evaluation_findings": [],
        "attempts": [{"number": 1, "kind": "initial", "started_at": "2026-10-31T17:10:00+00:00",
                      "finished_at": None, "outcome": "running",
                      "stages": [{"name": "planning", "seconds": 190}, {"name": "rendering", "seconds": 1302}]}],
        "failures": [], "artifacts": [], "reviews": [],
    },
    {
        "id": "job_v04_harvard_california_001",
        "concept": "V04",
        "topic": "What if Harvard moved to California?",
        "scenario_family": "relocation",
        "state": "waiting_for_usage",
        "created_at": "2026-10-31T09:00:00+00:00",
        "updated_at": "2026-10-31T09:31:12+00:00",
        "attempt_count": 1,
        "facts": [], "hypothetical_claims": [], "evaluation_findings": [],
        "attempts": [{"number": 1, "kind": "initial", "started_at": "2026-10-31T09:00:00+00:00",
                      "finished_at": "2026-10-31T09:31:12+00:00", "outcome": "interrupted",
                      "stages": [{"name": "planning", "seconds": 1872}]}],
        "failures": [{"stage": "planning", "at": "2026-10-31T09:31:12+00:00",
                      "message": "Codex usage limit reached. All artifacts preserved; resume when usage resets."}],
        "artifacts": [], "reviews": [],
    },
    {
        "id": "job_v03_public_disappear_001",
        "concept": "V03",
        "topic": "What if every public university disappeared?",
        "scenario_family": "disappearance",
        "state": "needs_development",
        "created_at": "2026-10-30T22:15:00+00:00",
        "updated_at": "2026-10-30T22:40:09+00:00",
        "attempt_count": 3,
        "facts": [], "hypothetical_claims": [], "evaluation_findings": [],
        "attempts": [],
        "failures": [{"stage": "validating", "at": "2026-10-30T22:40:09+00:00",
                      "message": "Unknown operation 'institution_filter.fade_by_cohort' is not in the capability registry."}],
        "artifacts": [], "reviews": [],
    },
    {
        "id": "job_v05_mit_stanford_swap_001",
        "concept": "V05",
        "topic": "What if MIT and Stanford swapped locations?",
        "scenario_family": "swap",
        "state": "approved",
        "created_at": "2026-10-29T18:00:00+00:00",
        "updated_at": "2026-10-30T02:12:44+00:00",
        "attempt_count": 1,
        "facts": [], "hypothetical_claims": [], "evaluation_findings": [],
        "attempts": [], "failures": [], "artifacts": [],
        "reviews": [{"decision": "approve", "notes": "Clear swap, captions readable muted.",
                     "rubric": {key: 4 for key in RUBRIC_KEYS}, "at": "2026-10-30T02:12:44+00:00"}],
    },
]


class ReviewBody(BaseModel):
    decision: str = Field(pattern="^(approve|reject|revise)$")
    notes: str = ""
    rubric: dict[str, int] = Field(default_factory=dict)


def _summary(job: dict[str, Any]) -> dict[str, Any]:
    keys = ("id", "concept", "topic", "scenario_family", "state", "created_at", "updated_at",
            "attempt_count", "progress")
    return {k: job[k] for k in keys if k in job}


def _contact_sheet_svg(job: dict[str, Any], sheet: dict[str, Any]) -> str:
    """Placeholder contact sheet: a 3×2 grid of 9:16 tiles labelled by frame."""
    tile_w, tile_h, gap = 180, 320, 12
    tiles = []
    for i, frame in enumerate(sheet.get("frames", [])):
        x = gap + (i % 3) * (tile_w + gap)
        y = gap + (i // 3) * (tile_h + gap)
        hue = (frame * 7) % 360
        tiles.append(
            f'<rect x="{x}" y="{y}" width="{tile_w}" height="{tile_h}" rx="6" '
            f'fill="hsl({hue} 45% 55%)"/>'
            f'<text x="{x + 10}" y="{y + tile_h - 12}" font-size="16" fill="#fff" '
            f'font-family="sans-serif">frame {frame} · {frame / 30:.1f}s</text>')
    width = gap + 3 * (tile_w + gap)
    height = gap + 2 * (tile_h + gap) + 30
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="#16181d"/>'
            + "".join(tiles)
            + f'<text x="{gap}" y="{height - 12}" font-size="14" fill="#aab" font-family="sans-serif">'
            f'{escape(job["topic"])} — {escape(sheet["label"])} (mock)</text></svg>')


def _sample_video(cache_dir: Path) -> Path | None:
    """Make a short exact-format test clip with FFmpeg, if FFmpeg is installed."""
    target = cache_dir / "mock_final.mp4"
    if target.exists():
        return target
    if not shutil.which("ffmpeg"):
        return None
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=4",
         "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=4",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "30", "-c:a", "aac", "-ac", "2",
         "-movflags", "+faststart", "-shortest", str(target)],
        check=True, timeout=120)
    return target


def create_mock_api() -> FastAPI:
    app = FastAPI(title="AETHER mock job API")
    jobs = {job["id"]: copy.deepcopy(job) for job in SAMPLE_JOBS}
    cache_dir = Path(tempfile.gettempdir()) / "aether_mock_api"
    cache_dir.mkdir(exist_ok=True)

    def get(job_id: str) -> dict[str, Any]:
        if job_id not in jobs:
            raise HTTPException(404, f"No job {job_id}")
        return jobs[job_id]

    @app.get("/jobs")
    def list_jobs():
        return {"jobs": [_summary(job) for job in jobs.values()]}

    @app.get("/jobs/{job_id}")
    def get_job(job_id: str):
        return get(job_id)

    @app.post("/jobs/{job_id}/review")
    def review(job_id: str, body: ReviewBody):
        job = get(job_id)
        if job["state"] != "awaiting_review":
            raise HTTPException(409, f"Job is {job['state']}, not awaiting review.")
        unknown = set(body.rubric) - set(RUBRIC_KEYS)
        if unknown:
            raise HTTPException(422, f"Unknown rubric keys: {sorted(unknown)}")
        job["reviews"].append({**body.model_dump(), "at": _now()})
        job["state"] = {"approve": "approved", "reject": "rejected", "revise": "queued"}[body.decision]
        job["updated_at"] = _now()
        return job

    @app.post("/jobs/{job_id}/cancel")
    def cancel(job_id: str):
        job = get(job_id)
        if job["state"] not in ACTIVE_STATES:
            raise HTTPException(409, f"Job is {job['state']} and cannot be cancelled.")
        job["state"], job["updated_at"] = "cancelled", _now()
        return job

    @app.post("/jobs/{job_id}/resume")
    def resume(job_id: str):
        job = get(job_id)
        if job["state"] not in (*WAITING_STATES, "failed"):
            raise HTTPException(409, f"Job is {job['state']}; nothing to resume.")
        job["state"], job["updated_at"] = "queued", _now()
        return job

    @app.get("/jobs/{job_id}/artifacts/{artifact_id}")
    def artifact(job_id: str, artifact_id: str):
        job = get(job_id)
        meta = next((a for a in job.get("artifacts", []) if a["id"] == artifact_id), None)
        if meta is None:
            raise HTTPException(404, "Artifact is not registered for this job.")
        if meta["kind"] == "contact_sheet":
            return Response(_contact_sheet_svg(job, meta), media_type="image/svg+xml")
        if meta["kind"] == "final_video":
            path = _sample_video(cache_dir)
            if path is None:
                raise HTTPException(404, "Install FFmpeg to get a mock video.")
            return FileResponse(path, media_type="video/mp4")
        return Response(f'{{"mock": true, "artifact": "{artifact_id}"}}',
                        media_type="application/json")

    return app


app = create_mock_api()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
