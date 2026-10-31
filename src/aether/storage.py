"""Small, transactional local job and artifact store."""

import hashlib
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from aether.contracts import ProductionSpec

ACTIVE = {"validating", "checking_frames", "rendering", "packaging"}
RESUMABLE = {"failed", "cancelled", "waiting_for_auth", "waiting_for_usage"}


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    temporary.replace(path)


class Store:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.db = self.root / "aether.sqlite3"
        with self.connection() as conn:
            conn.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, status TEXT NOT NULL, spec_json TEXT NOT NULL,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    completed_frames INTEGER NOT NULL DEFAULT 0, error TEXT,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    revision_note TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS artifacts (
                    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id),
                    kind TEXT NOT NULL, relative_path TEXT NOT NULL, sha256 TEXT NOT NULL,
                    UNIQUE(job_id, kind)
                );
                CREATE TABLE IF NOT EXISTS attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES jobs(id),
                    started_at TEXT NOT NULL, finished_at TEXT, result TEXT,
                    fingerprint TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reviews (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES jobs(id),
                    decision TEXT NOT NULL, notes TEXT NOT NULL, rubric_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)

    @contextmanager
    def connection(self):
        with sqlite3.connect(self.db, timeout=20) as conn:
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys=ON")
            yield conn

    def create(self, spec: ProductionSpec) -> dict:
        job_id = uuid.uuid4().hex[:12]
        raw = spec.model_dump_json(indent=2)
        now = utc_now()
        with self.connection() as conn:
            if (
                conn.execute("SELECT COUNT(*) FROM jobs WHERE status='awaiting_review'").fetchone()[
                    0
                ]
                >= 2
            ):
                raise ValueError("Review the two waiting videos before creating another production")
            conn.execute(
                "INSERT INTO jobs(id,status,spec_json,created_at,updated_at) VALUES(?,?,?,?,?)",
                (job_id, "queued", raw, now, now),
            )
        job_dir = self.job_dir(job_id)
        job_dir.mkdir(parents=True)
        (job_dir / "spec.json").write_text(raw + "\n")
        self.register(job_id, "spec", job_dir / "spec.json")
        return self.get(job_id)

    def get(self, job_id: str) -> dict:
        with self.connection() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            if row is None:
                raise KeyError(job_id)
            job = dict(row)
            job["spec"] = json.loads(job.pop("spec_json"))
            job["artifacts"] = [
                dict(x)
                for x in conn.execute(
                    "SELECT id,kind,sha256 FROM artifacts WHERE job_id=?", (job_id,)
                )
            ]
            job["attempts"] = [
                dict(x)
                for x in conn.execute(
                    "SELECT * FROM attempts WHERE job_id=? ORDER BY id", (job_id,)
                )
            ]
            job["reviews"] = [
                {
                    "decision": row["decision"],
                    "notes": row["notes"],
                    "rubric": json.loads(row["rubric_json"]),
                    "at": row["created_at"],
                }
                for row in conn.execute(
                    "SELECT * FROM reviews WHERE job_id=? ORDER BY id", (job_id,)
                )
            ]
            return job

    def list(self) -> list[dict]:
        with self.connection() as conn:
            ids = [row[0] for row in conn.execute("SELECT id FROM jobs ORDER BY created_at DESC")]
        return [self.get(job_id) for job_id in ids]

    def update(self, job_id: str, **values) -> None:
        allowed = {"status", "completed_frames", "error", "cancel_requested", "revision_note"}
        if not values or set(values) - allowed:
            raise ValueError("invalid job update")
        values["updated_at"] = utc_now()
        with self.connection() as conn:
            conn.execute(
                f"UPDATE jobs SET {','.join(key + '=?' for key in values)} WHERE id=?",
                (*values.values(), job_id),
            )

    def job_dir(self, job_id: str) -> Path:
        if len(job_id) != 12 or any(c not in "0123456789abcdef" for c in job_id):
            raise KeyError(job_id)
        return self.root / "jobs" / job_id

    def record_review(
        self, job_id: str, decision: str, notes: str = "", rubric: dict | None = None
    ) -> None:
        if decision not in {"approve", "reject", "revise"}:
            raise ValueError("Unknown review decision")
        notes = notes.strip()
        if decision == "revise" and not notes:
            raise ValueError("Describe the requested revision")
        now = utc_now()
        with self.connection() as conn:
            changed = conn.execute(
                "UPDATE jobs SET status=?,revision_note=?,updated_at=? WHERE id=? AND status='awaiting_review'",
                ("approved" if decision == "approve" else "rejected", notes, now, job_id),
            ).rowcount
            if not changed:
                raise ValueError("Only completed productions can be reviewed")
            conn.execute(
                "INSERT INTO reviews(job_id,decision,notes,rubric_json,created_at) VALUES(?,?,?,?,?)",
                (job_id, decision, notes, json.dumps(rubric or {}), now),
            )

    def register(self, job_id: str, kind: str, path: Path) -> str:
        relative = path.resolve().relative_to(self.job_dir(job_id).resolve())
        artifact_id = uuid.uuid4().hex
        with self.connection() as conn:
            conn.execute(
                "INSERT INTO artifacts VALUES(?,?,?,?,?) ON CONFLICT(job_id,kind) DO UPDATE SET relative_path=excluded.relative_path,sha256=excluded.sha256",
                (artifact_id, job_id, kind, str(relative), digest(path)),
            )
            return conn.execute(
                "SELECT id FROM artifacts WHERE job_id=? AND kind=?", (job_id, kind)
            ).fetchone()[0]

    def artifact_path(self, job_id: str, artifact_id: str) -> Path:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT relative_path FROM artifacts WHERE job_id=? AND id=?", (job_id, artifact_id)
            ).fetchone()
        if row is None:
            raise KeyError(artifact_id)
        base = self.job_dir(job_id).resolve()
        path = (base / row[0]).resolve()
        if not path.is_relative_to(base) or not path.is_file():
            raise KeyError(artifact_id)
        return path

    def begin_attempt(self, job_id: str, fingerprint: str) -> int:
        with self.connection() as conn:
            # An interrupted worker left an unfinished attempt. Preserve its record.
            conn.execute(
                "UPDATE attempts SET finished_at=?,result='interrupted' WHERE job_id=? AND finished_at IS NULL",
                (utc_now(), job_id),
            )
            return conn.execute(
                "INSERT INTO attempts(job_id,started_at,fingerprint) VALUES(?,?,?)",
                (job_id, utc_now(), fingerprint),
            ).lastrowid

    def finish_attempt(self, attempt_id: int, result: str) -> None:
        with self.connection() as conn:
            conn.execute(
                "UPDATE attempts SET finished_at=?,result=? WHERE id=?",
                (utc_now(), result, attempt_id),
            )

    def recover_abandoned(self) -> None:
        # Call only while holding the global worker lock.
        with self.connection() as conn:
            conn.execute(
                "UPDATE jobs SET status='failed',error='Worker stopped; resume to reuse completed chunks.',updated_at=? WHERE status IN ('validating','checking_frames','rendering','packaging')",
                (utc_now(),),
            )
