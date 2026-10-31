"""Build the manual-publishing hand-off folder for one finished Short.

The folder holds everything a person needs to upload the video by hand:
the MP4, ready-to-paste title/description/tags, the inspection report, a
publishing checklist, and a manifest with hashes. Publishing itself stays
manual (TECHNICAL_PLAN.md: automatic publishing is out of scope).
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import shutil
from pathlib import Path

from .inspect_media import InspectionReport, inspect_video
from .publish_meta import PublishMetadata, content_checks, render_description

HUMAN_CHECKLIST = """\
## Before uploading (reviewer)

- [ ] Watch the whole Short once with sound and once muted. The premise and the ending are clear without sound.
- [ ] Faces show eyes, hair, nose, and mouth at phone size; the landmark and places are recognizable.
- [ ] Every number on screen matches a source below or a listed assumption.
- [ ] Imagined rankings, outcomes, crowd sizes, and time jumps carry the hypothetical treatment on screen.
- [ ] Captions stay inside the safe zone and do not collide with each other or the Shorts UI.
- [ ] Sound lines up with on-screen events; no clipping or abrupt cuts.
- [ ] Score the quality rubric (average at least 4/5, no dimension below 3).

## Uploading (YouTube Studio)

- [ ] Upload `{video_file}` from this folder.
- [ ] Paste `title.txt` into Title and `description.txt` into Description.
- [ ] Paste `tags.txt` into Tags (Show more).
- [ ] Audience: {audience}.
- [ ] Category: {category}.
- [ ] Altered or synthetic content: {altered}.
- [ ] Visibility: start as Private or Unlisted, check the processed upload on a phone, then Public or Schedule.
- [ ] After it is live, run `python -m aether_delivery record {folder_name} --url <video URL>` so analytics can find it.
"""


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build_handoff(
    video: str | Path,
    metadata_path: str | Path,
    out_root: str | Path,
    copy_video: bool = True,
    today: dt.date | None = None,
) -> tuple[Path, bool]:
    """Write the hand-off folder. Returns (folder, ready). Not ready means blocked."""
    video = Path(video)
    metadata_path = Path(metadata_path)
    meta = PublishMetadata.model_validate_json(metadata_path.read_text())
    today = today or dt.date.today()

    report: InspectionReport = inspect_video(video, expected_frames=meta.expected_frames)
    for row in content_checks(meta):
        report.add(*row)
    ready = report.passed

    folder = Path(out_root) / f"{meta.video_id}_{today.isoformat()}"
    folder.mkdir(parents=True, exist_ok=True)

    video_name = f"{meta.video_id}.mp4"
    if copy_video and video.is_file():
        shutil.copy2(video, folder / video_name)

    description = render_description(meta)
    (folder / "title.txt").write_text(meta.title + "\n")
    (folder / "description.txt").write_text(description)
    (folder / "tags.txt").write_text(", ".join(meta.tags) + "\n")
    (folder / "inspection.json").write_text(json.dumps(report.to_dict(), indent=2) + "\n")
    shutil.copy2(metadata_path, folder / "publish_metadata.json")

    status = "READY FOR MANUAL PUBLISHING" if ready else "BLOCKED"
    lines = [
        f"# {meta.video_id} hand-off: {status}",
        "",
        f"Prepared {today.isoformat()}. Job: `{meta.job_id or 'n/a'}`.",
        "",
    ]
    if not ready:
        lines += ["## Fix before publishing", ""]
        lines += [f"- **{c.id}**: expected {c.expected}, got {c.actual}" for c in report.errors]
        lines.append("")
    if report.warnings:
        lines += ["## Look at these", ""]
        lines += [f"- {c.id}: expected {c.expected}, got {c.actual}" for c in report.warnings]
        lines.append("")
    lines += ["## Title", "", "```", meta.title, "```", "", "## Description", "", "```", description.rstrip(), "```", ""]
    lines.append(
        HUMAN_CHECKLIST.format(
            video_file=video_name,
            audience="No, it's not made for kids" if not meta.made_for_kids else "Yes, it's made for kids",
            category=meta.category,
            altered="Yes" if meta.altered_or_synthetic_disclosure else "No (stylized, clearly animated; reviewer confirms)",
            folder_name=folder.as_posix(),
        )
    )
    lines += ["", report.to_markdown().replace("# Final-media inspection", "## Inspection", 1)]
    (folder / "HANDOFF.md").write_text("\n".join(lines))

    manifest = {
        "videoId": meta.video_id,
        "jobId": meta.job_id,
        "status": "ready" if ready else "blocked",
        "preparedOn": today.isoformat(),
        "video": {
            "file": video_name if copy_video else str(video),
            "sha256": _sha256(video) if video.is_file() else None,
        },
        "files": sorted(p.name for p in folder.iterdir() if p.name != "manifest.json"),
        "errors": [c.id for c in report.errors],
        "warnings": [c.id for c in report.warnings],
        "published": None,
    }
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return folder, ready


def record_publish(folder: str | Path, url: str, when: dt.datetime | None = None) -> dict:
    """Record the live URL after a person publishes, for the analytics import."""
    folder = Path(folder)
    manifest_path = folder / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("status") != "ready":
        raise ValueError("this hand-off is blocked; fix and rebuild it before recording a publish")
    when = when or dt.datetime.now(dt.timezone.utc)
    manifest["published"] = {"url": url, "recordedAt": when.isoformat(timespec="seconds")}
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest
