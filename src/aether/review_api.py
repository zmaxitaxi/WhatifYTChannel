"""Expose the existing jobs in Francis's draft review API shape without a second store."""

import mimetypes

from aether.storage import ACTIVE, RESUMABLE, Store


def review_view(store: Store, job: dict) -> dict:
    result = dict(job)
    spec = job["spec"]
    result.update(
        state=job["status"],
        concept=spec["concept_id"],
        topic=spec["topic"],
        scenario_family=spec["scenario_family"],
        attempt_count=len(job["attempts"]),
        progress={
            "stage": job["status"],
            "completed_frames": job["completed_frames"],
            "total_frames": spec["output"]["total_frames"],
        },
    )
    actions = []
    if job["status"] == "awaiting_review":
        actions.append("review")
    if job["status"] in ACTIVE | {"queued"}:
        actions.append("cancel")
    if job["status"] in RESUMABLE:
        actions.append("resume")
    result["allowed_actions"] = actions
    result["artifacts"] = []
    for artifact in job["artifacts"]:
        item = dict(artifact)
        path = store.artifact_path(job["id"], item["id"])
        item.update(
            bytes=path.stat().st_size,
            media_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream",
            label=item["kind"].replace("_", " ").title(),
        )
        result["artifacts"].append(item)
        if item["kind"] == "video":
            result["final_video"] = {"id": item["id"], "bytes": item["bytes"]}
    sources = {source["id"]: source for source in spec["evidence"]["sources"]}
    result["facts"], result["hypothetical_claims"] = [], []
    for claim in spec["evidence"]["claims"]:
        if claim["kind"] == "verified":
            source = sources[claim["source_ids"][0]]
            result["facts"].append(
                {
                    "id": claim["id"],
                    "claim": claim["text"],
                    "source_title": source["title"],
                    "source_url": source["url"],
                    "accessed": source["retrieved_on"],
                }
            )
        else:
            result["hypothetical_claims"].append(
                {
                    "id": claim["id"],
                    "claim": claim["text"],
                    "treatment": "The opening What if question introduces this fictional timeline; historical sources are separate from invented outcomes.",
                    "basis": claim["scope"],
                }
            )
    result["attempts"] = [
        {**attempt, "number": i + 1, "outcome": attempt["result"] or "running", "stages": []}
        for i, attempt in enumerate(job["attempts"])
    ]
    result["failures"] = (
        [{"stage": job["status"], "at": job["updated_at"], "message": job["error"]}]
        if job["error"]
        else []
    )
    result["evaluation_findings"] = []
    result["reviews"] = job["reviews"]
    return result
