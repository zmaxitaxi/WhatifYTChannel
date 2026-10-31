from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from aether.app import create_app
from aether.storage import Store


def test_artifacts_are_registered_by_opaque_id_and_cannot_escape(tmp_path, spec):
    store = Store(tmp_path / "data")
    job = store.create(spec)
    artifact_id = job["artifacts"][0]["id"]
    assert store.artifact_path(job["id"], artifact_id).name == "spec.json"
    with pytest.raises(KeyError):
        store.artifact_path(job["id"], "../../private")
    with pytest.raises(ValueError):
        store.register(job["id"], "outside", Path(__file__))
    external = tmp_path / "outside.txt"
    external.write_text("outside")
    link = store.job_dir(job["id"]) / "symlink.txt"
    link.symlink_to(external)
    with pytest.raises(ValueError):
        store.register(job["id"], "symlink", link)


def test_interrupted_jobs_keep_progress_and_attempts(tmp_path, spec):
    store = Store(tmp_path)
    job = store.create(spec)
    first = store.begin_attempt(job["id"], "engine-a")
    store.update(job["id"], status="rendering", completed_frames=150)
    store.recover_abandoned()
    assert store.get(job["id"])["status"] == "failed"
    assert store.get(job["id"])["completed_frames"] == 150
    second = store.begin_attempt(job["id"], "engine-a")
    attempts = store.get(job["id"])["attempts"]
    assert attempts[0]["id"] == first and attempts[0]["result"] == "interrupted"
    assert attempts[1]["id"] == second


def test_review_capacity_is_enforced(tmp_path, spec):
    store = Store(tmp_path)
    for _ in range(2):
        store.update(store.create(spec)["id"], status="awaiting_review")
    with pytest.raises(ValueError, match="two waiting"):
        store.create(spec)


def test_api_lifecycle_and_artifact_access(tmp_path, raw_spec):
    app = create_app(tmp_path, start_worker=False)
    with TestClient(app) as client:
        response = client.post("/jobs", json={"spec": raw_spec})
        assert response.status_code == 201
        job = response.json()
        job_id = job["id"]
        detail = client.get(f"/jobs/{job_id}").json()
        assert detail["state"] == detail["status"] == "queued"
        assert detail["topic"] == raw_spec["topic"]
        assert "cancel" in detail["allowed_actions"]
        assert detail["facts"][0]["source_url"].startswith("https://www.stanford.edu/")
        assert client.get(f"/jobs/{job_id}/spec").json()["topic"] == raw_spec["topic"]
        assert (
            client.get(f"/jobs/{job_id}/artifacts/{job['artifacts'][0]['id']}").status_code == 200
        )
        assert client.get(f"/jobs/{job_id}/artifacts/missing").status_code == 404
        assert client.post(f"/jobs/{job_id}/review", json={"action": "approve"}).status_code == 409
        assert client.post(f"/jobs/{job_id}/cancel").json()["status"] == "cancelled"
        assert client.post(f"/jobs/{job_id}/resume").json()["status"] == "queued"
        assert client.post(f"/jobs/{job_id}/resume").status_code == 409
        app.state.store.update(job_id, status="awaiting_review")
        assert client.post(f"/jobs/{job_id}/review", json={"action": "revise"}).status_code == 422
        revised = client.post(
            f"/jobs/{job_id}/review",
            json={
                "decision": "revise",
                "notes": "Slow down the map reveal",
                "rubric": {"clarity": 3},
            },
        ).json()
        assert revised["status"] == "rejected"
        assert revised["revision_note"] == "Slow down the map reveal"
        saved = client.get(f"/jobs/{job_id}").json()["reviews"]
        assert saved[0]["decision"] == "revise"
        assert saved[0]["rubric"] == {"clarity": 3}
        assert saved[0]["notes"] == "Slow down the map reveal"
        assert (
            client.post(f"/jobs/{job_id}/review", json={"decision": "approve"}).status_code == 409
        )
        assert len(app.state.store.get(job_id)["reviews"]) == 1


def test_api_rejects_bad_contracts_and_cross_origin_writes(tmp_path, raw_spec):
    with TestClient(create_app(tmp_path, start_worker=False)) as client:
        raw_spec["output"]["fps"] = 15
        assert client.post("/jobs", json={"spec": raw_spec}).status_code == 422
        assert (
            client.post(
                "/jobs", json={}, headers={"origin": "https://unrelated.example"}
            ).status_code
            == 403
        )
        assert client.get("/jobs/does-not-exist").status_code == 404


def test_unsupported_operations_are_saved_for_development(tmp_path, raw_spec):
    raw_spec["shots"][0]["operation"] = "new_capability"
    with TestClient(create_app(tmp_path, start_worker=False)) as client:
        response = client.post("/jobs", json={"spec": raw_spec})
        assert response.status_code == 201
        assert response.json()["status"] == "needs_development"
