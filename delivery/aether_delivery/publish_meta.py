"""Title, description, sources, and tags for one Short, validated before hand-off.

The JSON file a writer fills in per video is ``PublishMetadata``. Limits come from
YouTube's upload form (title 100 characters, description 5,000 characters, no
angle brackets, tags 500 characters total) plus this project's own content
rules in CONTEXT.md: sourced facts, labeled hypotheticals, and credited sounds.
"""

from __future__ import annotations

import datetime as dt
import re

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

TITLE_MAX = 100
TITLE_SOFT_MAX = 60  # longer titles get cut off on the Shorts player
DESCRIPTION_MAX = 5000
TAGS_TOTAL_MAX = 500
HASHTAGS_MAX = 15  # YouTube ignores every hashtag on a video that has more than 15

DEFAULT_HYPOTHETICAL_NOTE = (
    "This is a hypothetical scenario. Facts are listed with sources below; "
    "everything else in the video is imagined to explore the idea."
)


class Source(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_\-]+$")
    claim: str = Field(min_length=3, description="The on-screen fact this source supports")
    title: str = Field(min_length=3)
    publisher: str = Field(min_length=2)
    url: HttpUrl
    published: str | None = Field(default=None, description="Source or dataset date, as published")
    accessed: dt.date
    verified: bool = Field(default=False, description="A person re-checked the claim against the source")


class SoundCredit(BaseModel):
    asset_id: str
    credit_line: str = Field(min_length=3, description="Exact attribution text required by the license")


class PublishMetadata(BaseModel):
    video_id: str = Field(pattern=r"^V\d{2,}[A-Za-z0-9_\-]*$")
    job_id: str | None = None
    expected_frames: int | None = Field(default=None, gt=0, description="ProductionSpec output.totalFrames")
    title: str = Field(min_length=5, max_length=TITLE_MAX)
    hook: str = Field(min_length=10, max_length=300, description="First lines of the description")
    hypothetical_note: str = DEFAULT_HYPOTHETICAL_NOTE
    assumptions: list[str] = Field(default_factory=list)
    sources: list[Source] = Field(default_factory=list)
    sound_credits: list[SoundCredit] = Field(default_factory=list)
    hashtags: list[str] = Field(default_factory=lambda: ["#Shorts"])
    tags: list[str] = Field(default_factory=list)
    category: str = "Education"
    made_for_kids: bool = False
    altered_or_synthetic_disclosure: bool = Field(
        default=False,
        description="Set true if a viewer could mistake any scene for real footage of real events",
    )

    @field_validator("title", "hook")
    @classmethod
    def _no_angle_brackets(cls, v: str) -> str:
        if "<" in v or ">" in v:
            raise ValueError("YouTube rejects '<' and '>' in titles and descriptions")
        return v.strip()

    @field_validator("hashtags")
    @classmethod
    def _hashtag_shape(cls, v: list[str]) -> list[str]:
        for tag in v:
            if not re.fullmatch(r"#[A-Za-z0-9_]+", tag):
                raise ValueError(f"hashtag {tag!r} must look like #Word with no spaces")
        if len(v) > HASHTAGS_MAX:
            raise ValueError(f"more than {HASHTAGS_MAX} hashtags makes YouTube ignore all of them")
        return v

    @model_validator(mode="after")
    def _ids_unique(self) -> "PublishMetadata":
        ids = [s.id for s in self.sources]
        if len(ids) != len(set(ids)):
            raise ValueError("source ids must be unique")
        return self


def render_description(meta: PublishMetadata) -> str:
    parts = [meta.hook, "", meta.hypothetical_note]
    if meta.assumptions:
        parts += ["", "Assumptions:"] + [f"- {a}" for a in meta.assumptions]
    if meta.sources:
        parts += ["", "Sources:"]
        for i, s in enumerate(meta.sources, 1):
            dated = f", {s.published}" if s.published else ""
            parts.append(f"[{i}] {s.claim} | {s.title}, {s.publisher}{dated}. {s.url} (accessed {s.accessed.isoformat()})")
    if meta.sound_credits:
        parts += ["", "Sound:"] + [f"- {c.credit_line}" for c in meta.sound_credits]
    if meta.hashtags:
        parts += ["", " ".join(meta.hashtags)]
    return "\n".join(parts).strip() + "\n"


def content_checks(meta: PublishMetadata) -> list[tuple[str, bool, str, str, str]]:
    """Return (id, ok, expected, actual, severity) rows for the hand-off report."""
    desc = render_description(meta)
    tags_total = sum(len(t) for t in meta.tags) + max(len(meta.tags) - 1, 0)
    unverified = [s.id for s in meta.sources if not s.verified]
    lower_hashtags = [h.lower() for h in meta.hashtags]
    rows = [
        ("title_length", len(meta.title) <= TITLE_MAX, f"<= {TITLE_MAX}", len(meta.title), "error"),
        ("title_fits_shorts_player", len(meta.title) <= TITLE_SOFT_MAX, f"<= {TITLE_SOFT_MAX}", len(meta.title), "warning"),
        ("description_length", len(desc) <= DESCRIPTION_MAX, f"<= {DESCRIPTION_MAX}", len(desc), "error"),
        ("description_no_angle_brackets", "<" not in desc and ">" not in desc, "none", "found" if ("<" in desc or ">" in desc) else "none", "error"),
        ("tags_total_length", tags_total <= TAGS_TOTAL_MAX, f"<= {TAGS_TOTAL_MAX}", tags_total, "error"),
        ("has_sources", bool(meta.sources), ">= 1 source", len(meta.sources), "error"),
        ("sources_verified", not unverified, "all verified", ", ".join(unverified) or "all verified", "error"),
        ("hypothetical_labeled", bool(meta.hypothetical_note.strip()), "hypothetical note present", "present" if meta.hypothetical_note.strip() else "missing", "error"),
        ("shorts_hashtag", "#shorts" in lower_hashtags, "#Shorts", " ".join(meta.hashtags) or "none", "warning"),
    ]
    return rows
