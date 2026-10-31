"""Authoritative contracts. Generated schemas and TypeScript must never be edited by hand."""

from datetime import date
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

Identifier = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_.-]{0,79}$")]
Frame = Annotated[int, Field(ge=0)]
Vec3 = tuple[float, float, float]
Operation = Literal[
    "character_react",
    "campus_establish",
    "campus_relocate",
    "campus_arrive",
    "campus_compare",
    "campus_close",
    "history_scene",
]
OPERATIONS = (
    "character_react",
    "campus_establish",
    "campus_relocate",
    "campus_arrive",
    "campus_compare",
    "campus_close",
    "history_scene",
)
SCENARIO_FAMILIES = (
    "relocation",
    "alternate_history",
    "swap",
    "disappearance",
    "status_change",
    "ranking",
    "territory",
    "absence",
    "merger",
    "crowd_flow",
    "competition",
)


class Contract(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        allow_inf_nan=False,
        json_schema_serialization_defaults_required=True,
    )


class Output(Contract):
    width: Literal[1080] = 1080
    height: Literal[1920] = 1920
    fps: Literal[30] = 30
    aspect_ratio: Literal["9:16"] = "9:16"
    total_frames: Annotated[int, Field(ge=1350, le=2250)] = 1800


class Source(Contract):
    id: Identifier
    title: Annotated[str, Field(min_length=1, max_length=240)]
    url: HttpUrl
    published_on: date | None = None
    retrieved_on: date


class Claim(Contract):
    id: Identifier
    text: Annotated[str, Field(min_length=1, max_length=500)]
    kind: Literal["verified", "assumption", "hypothetical"]
    source_ids: list[Identifier] = Field(default_factory=list)
    scope: Annotated[str, Field(min_length=1, max_length=300)]


class FactPack(Contract):
    sources: list[Source] = Field(max_length=50)
    claims: list[Claim] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def check_evidence(self) -> Self:
        source_ids = {source.id for source in self.sources}
        if len(source_ids) != len(self.sources):
            raise ValueError("source IDs must be unique")
        if len({claim.id for claim in self.claims}) != len(self.claims):
            raise ValueError("claim IDs must be unique")
        for claim in self.claims:
            if claim.kind == "verified" and not claim.source_ids:
                raise ValueError(f"verified claim {claim.id} needs a source")
            if set(claim.source_ids) - source_ids:
                raise ValueError(f"claim {claim.id} references an unknown source")
        return self


class Campus(Contract):
    identity: Literal["stanford"] = "stanford"
    landmark_asset: Literal["stanford_tower_v1"] = "stanford_tower_v1"
    character_asset: Literal["student_v1"] = "student_v1"
    origin: Literal["stanford_ca"] = "stanford_ca"
    destination: Literal["boston_ma"] = "boston_ma"
    layout_seed: Annotated[int, Field(ge=0, le=4294967295)] = 42
    tree_count: Annotated[int, Field(ge=6, le=48)] = 18
    building_count: Annotated[int, Field(ge=4, le=16)] = 10


class HistoryBeat(Contract):
    scene: Literal[
        "founding",
        "campus_1891",
        "garage_west",
        "workshop_east",
        "research_park",
        "sand_hill",
        "silicon_harbor",
        "computer_lab",
        "ferry",
        "world_network",
        "housing",
        "future",
    ]
    year: Annotated[int, Field(ge=1800, le=2200)]
    location: Annotated[str, Field(min_length=1, max_length=40)] = "Boston"
    framing: Literal["wide", "detail"] = "wide"


class Shot(Contract):
    id: Identifier
    start_frame: Frame
    end_frame: Frame
    operation: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,59}$")]
    title: Annotated[str, Field(min_length=1, max_length=100)]
    camera: Literal["portrait", "orbit", "map", "wide", "split"]
    expression: Literal["neutral", "happy", "surprised", "worried", "confused"] = "neutral"
    claim_ids: list[Identifier] = Field(min_length=1, max_length=10)
    history: HistoryBeat | None = None

    @model_validator(mode="after")
    def check_range(self) -> Self:
        if self.end_frame <= self.start_frame:
            raise ValueError("shot intervals must be nonempty [start_frame, end_frame)")
        if self.operation == "history_scene" and self.history is None:
            raise ValueError("history_scene requires a dated history beat")
        if (
            self.history is not None
            and self.operation in OPERATIONS
            and self.operation != "history_scene"
        ):
            raise ValueError("history beats require the history_scene operation")
        return self


class Caption(Contract):
    id: Identifier
    start_frame: Frame
    end_frame: Frame
    text: Annotated[str, Field(min_length=1, max_length=110)]
    claim_ids: list[Identifier] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def check_reading_load(self) -> Self:
        if self.end_frame <= self.start_frame:
            raise ValueError("caption end must follow start")
        if len(self.text.splitlines()) > 2:
            raise ValueError("captions permit at most two lines")
        if len(self.text.split()) / ((self.end_frame - self.start_frame) / 30) > 2.5:
            raise ValueError("caption exceeds 2.5 words/second")
        return self


class SoundCue(Contract):
    id: Identifier
    asset_id: Literal[
        "soft_chime_v1",
        "air_sweep_v1",
        "arrival_v1",
        "amb_campus_day",
        "amb_map_air",
        "amb_winter_wind",
        "crowd_murmur",
        "mv_flight_swoosh",
        "mv_rumble_lift",
        "tr_whoosh_up",
        "tr_whoosh_down",
        "arr_shimmer",
        "arr_impact_snow",
        "dis_poof",
        "imp_hit_low",
        "ui_caption_pop",
        "ui_counter_tick",
        "stinger_surprise",
        "fx_paper_stamp",
        "fx_campus_bell",
        "fx_garage_latch",
        "fx_workshop_dial",
        "fx_construction_taps",
        "fx_suitcase_roll",
        "fx_keyboard",
        "fx_harbor_buoy",
        "fx_ferry_depart",
        "fx_port_crate",
        "fx_housing_keys",
        "fx_future_resolve",
    ]
    frame: Frame
    gain_db: Annotated[float, Field(ge=-60, le=6)] = -12.0
    end_frame: Frame | None = None
    fade_in_frames: Frame = 0
    fade_out_frames: Frame = 0
    pan: Annotated[float, Field(ge=-1, le=1)] = 0.0


class Dependencies(Contract):
    engine_version: Literal["0.1.0"] = "0.1.0"
    style_pack: Literal["campus_clay_v1"] = "campus_clay_v1"
    asset_version: Literal["procedural_v1"] = "procedural_v1"


class ProductionSpec(Contract):
    schema_version: Literal["0.1.0"] = "0.1.0"
    concept_id: Annotated[str, Field(pattern=r"^V\d{2}$")]
    topic: Annotated[str, Field(min_length=1, max_length=160)]
    scenario_family: Annotated[str, Field(pattern=r"^[a-z_]{1,40}$")]
    seed: Annotated[int, Field(ge=0, le=4294967295)] = 42
    output: Output = Field(default_factory=Output)
    evidence: FactPack
    campus: Campus = Field(default_factory=Campus)
    shots: list[Shot] = Field(min_length=1, max_length=24)
    captions: list[Caption] = Field(min_length=1, max_length=60)
    sound: list[SoundCue] = Field(default_factory=list, max_length=40)
    audio_loudness_lufs: Annotated[float, Field(ge=-36, le=-14)] = -16.0
    dependencies: Dependencies = Field(default_factory=Dependencies)

    @model_validator(mode="after")
    def check_timeline(self) -> Self:
        claim_ids = {claim.id for claim in self.evidence.claims}
        for collection in (self.shots, self.captions, self.sound):
            if len({item.id for item in collection}) != len(collection):
                raise ValueError("track IDs must be unique within each track")
        cursor = 0
        for shot in self.shots:
            if shot.start_frame != cursor:
                raise ValueError("shots must be ordered, contiguous, and cover the whole video")
            cursor = shot.end_frame
            if set(shot.claim_ids) - claim_ids:
                raise ValueError(f"shot {shot.id} references an unknown claim")
        if cursor != self.output.total_frames:
            raise ValueError("shots must end at total_frames")
        years = [shot.history.year for shot in self.shots if shot.history is not None]
        if years != sorted(years):
            raise ValueError("historical years must move forward through the timeline")
        caption_end = 0
        for caption in self.captions:
            if caption.start_frame < caption_end or caption.end_frame > cursor:
                raise ValueError("captions must be ordered, non-overlapping, and within the video")
            caption_end = caption.end_frame
            if set(caption.claim_ids) - claim_ids:
                raise ValueError(f"caption {caption.id} references an unknown claim")
        if any(cue.frame >= cursor for cue in self.sound):
            raise ValueError("sound cue lies outside the video")
        for cue in self.sound:
            if cue.end_frame is not None and not cue.frame < cue.end_frame <= cursor:
                raise ValueError("sound cue end must follow its start and remain within the video")
        return self


class FrameDiagnostics(Contract):
    frame_index: Frame
    active_shot: Identifier
    visible_subjects: list[str]
    text_bounds: list[dict[str, float | str]]
    missing_resources: list[str]
    warnings: list[str]
    render_calls: Annotated[int, Field(ge=0)]
    triangles: Annotated[int, Field(ge=0)]
