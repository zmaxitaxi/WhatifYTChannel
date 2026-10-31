# Review pages ↔ job API contract (draft for Max)

Max owns API behavior; Francis owns the review pages that call it (TECHNICAL_PLAN.md §5). The API isn't built yet, so the pages were built against the endpoints in the plan's "Local interface" section and the JSON shapes below. **Max: please confirm or change these.** The pages only read the fields listed here and ignore anything extra, and every field except `id` and `state` may be missing.

`aether_review/mock_api.py` implements exactly this contract with sample jobs, so it doubles as an executable example.

## Endpoints the pages call

| Method | Path | Used for |
|---|---|---|
| GET | `/jobs` | Job list page |
| GET | `/jobs/{id}` | Job detail page |
| POST | `/jobs/{id}/review` | Approve / reject / request revision |
| POST | `/jobs/{id}/cancel` | Cancel button |
| POST | `/jobs/{id}/resume` | Resume button |
| GET | `/jobs/{id}/artifacts/{artifact_id}` | Video player, contact sheets, downloads (proxied through the review app) |

`POST /jobs` is not used by the review pages; jobs are created by the CLI/scheduler.

Errors: any status ≥ 400 with a FastAPI-style body `{"detail": "..."}`. The pages show `detail` to the reviewer. Use **404** for unknown jobs/artifacts and **409** for an action that isn't valid in the job's current state.

## `GET /jobs`

Either `{"jobs": [JobSummary, ...]}` or a bare list.

```jsonc
// JobSummary
{
  "id": "job_v01_stanford_boston_001",
  "concept": "V01",                    // optional
  "topic": "What if Stanford was in Boston?",
  "scenario_family": "relocation",
  "state": "awaiting_review",          // one of the states in TECHNICAL_PLAN.md "Job state"
  "created_at": "2026-10-31T15:02:11+00:00",
  "updated_at": "2026-10-31T16:41:52+00:00",
  "attempt_count": 2,
  "progress": {"stage": "rendering", "completed_frames": 1140, "total_frames": 1800}  // optional
}
```

## `GET /jobs/{id}`

JobSummary plus:

```jsonc
{
  "allowed_actions": ["review", "cancel", "resume"],  // optional; if absent the pages derive it from state
  "final_video": {"id": "final_mp4", "bytes": 48211904},  // optional; else the artifact with kind "final_video"
  "contact_sheets": [ /* optional; else artifacts with kind "contact_sheet" */ ],
  "facts": [
    {"id": "f1", "claim": "...", "source_title": "...", "source_url": "https://...",
     "calculation": "...", "accessed": "2026-10-30", "shown_on_screen": true}
  ],
  "hypothetical_claims": [
    {"id": "h1", "claim": "...", "treatment": "how it is labeled on screen", "basis": "..."}
  ],
  "evaluation_findings": [
    {"severity": "error|warning|info", "check": "caption_reading_load", "message": "...",
     "frame": 912, "resolved": false}
  ],
  "attempts": [
    {"number": 1, "kind": "initial|repair", "started_at": "...", "finished_at": "...",
     "outcome": "passed|repairable|failed|interrupted|running",
     "stages": [{"name": "planning", "seconds": 212}]}
  ],
  "failures": [{"stage": "planning", "at": "...", "message": "...", "artifact_id": "optional"}],
  "artifacts": [
    {"id": "final_mp4", "kind": "final_video|contact_sheet|evaluation_report|caption_track|...",
     "label": "...", "media_type": "video/mp4", "bytes": 48211904}
  ],
  "reviews": [{"decision": "approve", "notes": "...", "rubric": {"premise": 4}, "at": "..."}]
}
```

Only `http://` and `https://` source URLs are rendered as links.

## `POST /jobs/{id}/review`

```json
{"decision": "approve|reject|revise", "notes": "...", "rubric": {"premise": 4, "recognition": 5}}
```

Rubric keys (TECHNICAL_PLAN.md "Human quality rubric"): `premise`, `recognition`, `action`, `captions`, `camera`, `style`, `sound`, each 1–5.

The review pages already enforce the approval gate before calling the API: every score present, average ≥ 4, nothing below 3, and the reviewer ticks "watched full-length muted". Reject and revise require notes. The API should still validate on its own side.

## `GET /jobs/{id}/artifacts/{artifact_id}`

Raw bytes with the right `Content-Type`. Please support `Range` requests for video (Starlette's `FileResponse` does this) so the player can seek. Ids are registered artifact identifiers, never paths; the review app also rejects ids outside `[A-Za-z0-9_.-]`.

## Open questions for Max

1. Does `revise` send the job back to `queued` (as the mock does), or to a new state?
2. Should the API send `allowed_actions`? It avoids the pages guessing which states can resume.
3. Is the 2-video review cap enforced by the API/worker? The pages only display it.
