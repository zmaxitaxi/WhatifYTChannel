# AETHER review pages (Workstream C, task 6)

Server-rendered review pages for production jobs, built with FastAPI and Jinja templates. Pages call Max's local job API and never read the job database or the filesystem directly. No JavaScript is needed: forms post back to this app, which forwards the action to the API and redirects.

## What a reviewer can do

- **Job list**: jobs grouped into awaiting review, in progress, and finished, plus how many of the 2 review slots are in use.
- **Job page**: the final Short in a muted, 360 px-wide player (the rubric's phone-size check), MP4 download, facts with sources, hypothetical claims with their on-screen treatment, evaluation findings, contact sheets, attempts with per-stage timings, failures, all artifacts, and review history.
- **Review**: score the 7-dimension rubric, confirm the full-length muted watch, then approve, request a revision, or reject. Approval is blocked unless every score is filled, the average is at least 4, and nothing is below 3. Reject and revise need a note.
- **Cancel / resume** buttons when the job's state allows them.

## Run it

```bash
cd review
python -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'

# Until Max's API exists, start the mock API (127.0.0.1:8000):
python -m aether_review.mock_api

# In another terminal, start the review pages (127.0.0.1:8001):
python -m aether_review
```

Open http://127.0.0.1:8001. Point at the real API with `AETHER_API_URL=http://127.0.0.1:<port>`. Change the review port with `AETHER_REVIEW_PORT`. Both servers bind to loopback only.

The mock makes a 4-second exact-format test clip with FFmpeg the first time the video is requested; without FFmpeg the player shows no video. All facts in the mock are placeholder fixture data, not a verified fact pack.

## Tests

```bash
pytest
```

The tests run the review app against the mock API in-process.

## Files

| Path | Purpose |
|---|---|
| `aether_review/app.py` | Routes, artifact proxy (forwards `Range` for video seeking) |
| `aether_review/client.py` | Async client for the job API |
| `aether_review/review_logic.py` | Job states, available actions, rubric approval gate |
| `aether_review/templates/` | Server-rendered pages |
| `aether_review/mock_api.py` | Stand-in for Max's API with sample jobs |
| `API_CONTRACT.md` | The JSON shapes the pages expect; for Max to confirm |
