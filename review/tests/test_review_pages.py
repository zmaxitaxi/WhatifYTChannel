import re

import httpx
import pytest
from fastapi.testclient import TestClient

from aether_review import create_app
from aether_review.mock_api import create_mock_api
from aether_review.review_logic import RUBRIC_KEYS, allowed_actions, parse_review_form

V01 = "job_v01_stanford_boston_001"


@pytest.fixture()
def client():
    transport = httpx.ASGITransport(app=create_mock_api())
    with TestClient(create_app("http://mock-api", transport=transport)) as c:
        yield c


def scores(value):
    return {f"score_{k}": str(value) for k in RUBRIC_KEYS}


def test_job_list_groups_jobs_and_shows_queue(client):
    page = client.get("/")
    assert page.status_code == 200
    assert "1 of 2</strong> review slots" in page.text
    assert "What if Stanford was in Boston?" in page.text
    assert "1140 / 1800 frames" in page.text


def test_job_page_shows_evidence_findings_and_review_form(client):
    page = client.get(f"/jobs/{V01}")
    assert page.status_code == 200
    text = page.text
    assert "Hypothetical claims" in text and "Imagined location" in text
    assert 'href="https://www.stanford.edu/about/"' in text
    assert "caption_reading_load" in text
    assert f'<video src="/jobs/{V01}/artifacts/final_mp4"' in text
    assert 'name="decision" value="approve"' in text
    assert "Attempt 2" in text and "repair" in text


def test_unknown_job_is_404(client):
    assert client.get("/jobs/job_nope").status_code == 404


def test_path_tricks_are_rejected(client):
    assert client.get("/jobs/..%2F..%2Fetc/artifacts/x").status_code == 404
    assert client.get(f"/jobs/{V01}/artifacts/..%2Fsecret").status_code == 404


def test_approve_requires_full_rubric_and_muted_check(client):
    page = client.post(f"/jobs/{V01}/review", data={"decision": "approve"})
    assert page.status_code == 422
    assert "Missing:" in page.text
    assert "muted" in page.text


def test_approve_blocks_low_average(client):
    form = {**scores(3), "decision": "approve", "muted_check": "on"}
    page = client.post(f"/jobs/{V01}/review", data=form)
    assert page.status_code == 422
    assert "average of at least 4.0" in page.text
    # The reviewer's scores are kept in the re-rendered form.
    assert len(re.findall(r'value="3"\s+checked', page.text)) == len(RUBRIC_KEYS)


def test_approve_records_review_and_redirects(client):
    form = {**scores(4), "decision": "approve", "muted_check": "on", "notes": "Clear."}
    response = client.post(f"/jobs/{V01}/review", data=form, follow_redirects=False)
    assert response.status_code == 303
    page = client.get(response.headers["location"])
    assert "Approved." in page.text
    assert "Review history" in page.text
    assert 'name="decision"' not in page.text  # no longer awaiting review


def test_revise_requires_notes(client):
    page = client.post(f"/jobs/{V01}/review", data={"decision": "revise"})
    assert page.status_code == 422
    assert "Add a note" in page.text


def test_api_conflict_is_shown_as_error(client):
    form = {"decision": "reject", "notes": "Wrong state"}
    response = client.post("/jobs/job_v05_mit_stanford_swap_001/review", data=form,
                           follow_redirects=False)
    assert response.status_code == 303
    assert "Review+not+recorded" in response.headers["location"]


def test_cancel_and_resume(client):
    r = client.post("/jobs/job_v02_berkeley_stanford_swap_001/cancel", follow_redirects=True)
    assert "Cancellation requested." in r.text and "Cancelled" in r.text
    r = client.post("/jobs/job_v04_harvard_california_001/resume", follow_redirects=True)
    assert "Resume requested." in r.text


def test_contact_sheet_is_proxied(client):
    r = client.get(f"/jobs/{V01}/artifacts/sheet_open")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/svg+xml")


def test_unregistered_artifact_is_404(client):
    assert client.get(f"/jobs/{V01}/artifacts/not_registered").status_code == 404


def test_api_down_shows_friendly_503():
    def refuse(request):
        raise httpx.ConnectError("connection refused", request=request)

    with TestClient(create_app("http://127.0.0.1:9", transport=httpx.MockTransport(refuse))) as c:
        page = c.get("/")
    assert page.status_code == 503
    assert "Job API is not running" in page.text


def test_untrusted_source_url_is_not_linked():
    from aether_review.app import _safe_url
    assert _safe_url("javascript:alert(1)") is None
    assert _safe_url("https://example.edu") == "https://example.edu"


def test_allowed_actions_prefers_api_list():
    assert allowed_actions({"state": "rendering"}) == {"cancel"}
    assert allowed_actions({"state": "awaiting_review"}) == {"review"}
    assert allowed_actions({"state": "rendering", "allowed_actions": []}) == set()


def test_rubric_gate_rejects_any_score_below_three():
    form = {**scores(5), "score_sound": "2", "decision": "approve", "muted_check": "on"}
    sub = parse_review_form(form)
    assert any("Below 3: Sound timing" in e for e in sub.errors)
