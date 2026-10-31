"""Pure review-page rules: job states, available actions, and the rubric gate.

Kept free of FastAPI so it can be unit tested directly.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from .client import REVIEW_DECISIONS

# Production pipeline order from TECHNICAL_PLAN.md "Job state".
PIPELINE_STATES = (
    "queued", "researching", "planning", "validating", "checking_frames",
    "evaluating", "rendering", "packaging", "awaiting_review",
)
WAITING_STATES = ("waiting_for_usage", "waiting_for_auth")
TERMINAL_STATES = ("needs_development", "failed", "cancelled", "approved", "rejected")
ACTIVE_STATES = PIPELINE_STATES[:-1] + WAITING_STATES

# Maximum unfinished videos waiting on a human (TECHNICAL_PLAN.md defaults).
REVIEW_QUEUE_LIMIT = 2

STATE_TONE = {
    "awaiting_review": "attention",
    "approved": "good",
    "rejected": "bad",
    "failed": "bad",
    "needs_development": "bad",
    "cancelled": "muted",
    "waiting_for_usage": "warn",
    "waiting_for_auth": "warn",
}

# Human quality rubric, TECHNICAL_PLAN.md "Human quality rubric".
RUBRIC = (
    ("premise", "Immediate premise comprehension"),
    ("recognition", "Recognition of people, landmarks, and places"),
    ("action", "Clear action and cause/effect"),
    ("captions", "Caption readability and muted comprehension"),
    ("camera", "Camera clarity and motion"),
    ("style", "Consistent style"),
    ("sound", "Sound timing"),
)
RUBRIC_KEYS = tuple(key for key, _ in RUBRIC)
APPROVAL_MIN_AVERAGE = 4.0
APPROVAL_MIN_SCORE = 3


def state_label(state: str) -> str:
    return state.replace("_", " ").capitalize() if state else "Unknown"


def state_tone(state: str) -> str:
    if state in STATE_TONE:
        return STATE_TONE[state]
    return "active" if state in ACTIVE_STATES else "muted"


def pipeline_position(state: str) -> int:
    """Index of the state in the main pipeline, or -1 if it is off the main path."""
    return PIPELINE_STATES.index(state) if state in PIPELINE_STATES else -1


def allowed_actions(job: Mapping[str, Any]) -> set[str]:
    """Actions to offer. The API's own list wins when it sends one."""
    sent = job.get("allowed_actions")
    if isinstance(sent, list):
        return {str(action) for action in sent}
    state = str(job.get("state", ""))
    actions: set[str] = set()
    if state == "awaiting_review":
        actions.add("review")
    if state in ACTIVE_STATES:
        actions.add("cancel")
    if state in WAITING_STATES or state == "failed":
        actions.add("resume")
    return actions


def blocking_findings(job: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    findings = job.get("evaluation_findings") or []
    return [f for f in findings if isinstance(f, Mapping)
            and str(f.get("severity", "")).lower() == "error"
            and not f.get("resolved")]


@dataclass
class ReviewSubmission:
    decision: str = ""
    notes: str = ""
    rubric: dict[str, int] = field(default_factory=dict)
    muted_check: bool = False
    errors: list[str] = field(default_factory=list)

    @property
    def average(self) -> float | None:
        if not self.rubric:
            return None
        return sum(self.rubric.values()) / len(self.rubric)


def parse_review_form(form: Mapping[str, Any]) -> ReviewSubmission:
    sub = ReviewSubmission(
        decision=str(form.get("decision", "")).strip(),
        notes=str(form.get("notes", "")).strip(),
        muted_check=str(form.get("muted_check", "")) in ("on", "true", "1"),
    )
    if sub.decision not in REVIEW_DECISIONS:
        sub.errors.append("Choose approve, request revision, or reject.")

    for key, label in RUBRIC:
        raw = str(form.get(f"score_{key}", "")).strip()
        if not raw:
            continue
        try:
            score = int(raw)
        except ValueError:
            sub.errors.append(f"{label}: score must be a whole number from 1 to 5.")
            continue
        if not 1 <= score <= 5:
            sub.errors.append(f"{label}: score must be from 1 to 5.")
            continue
        sub.rubric[key] = score

    if sub.decision == "approve":
        missing = [label for key, label in RUBRIC if key not in sub.rubric]
        if missing:
            sub.errors.append("Approval needs every rubric score. Missing: " + ", ".join(missing) + ".")
        else:
            low = [label for key, label in RUBRIC if sub.rubric[key] < APPROVAL_MIN_SCORE]
            if low:
                sub.errors.append("Approval needs every dimension at 3 or above. Below 3: "
                                  + ", ".join(low) + ".")
            if sub.average is not None and sub.average < APPROVAL_MIN_AVERAGE:
                sub.errors.append(f"Approval needs an average of at least 4.0 "
                                  f"(this is {sub.average:.1f}).")
        if not sub.muted_check:
            sub.errors.append("Confirm you watched the full-length video muted before approving.")
    elif sub.decision in ("reject", "revise") and not sub.notes:
        sub.errors.append("Add a note saying what is wrong so the next attempt can fix it.")

    if len(sub.notes) > 4000:
        sub.errors.append("Keep notes under 4,000 characters.")
    return sub
