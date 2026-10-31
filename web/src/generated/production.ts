/* Generated from Pydantic. Run: uv run aether schema && npm run contracts */

export type SchemaVersion = "0.1.0";
export type ConceptId = string;
export type Topic = string;
export type ScenarioFamily = string;
export type Seed = number;
export type Width = 1080;
export type Height = 1920;
export type Fps = 30;
export type AspectRatio = "9:16";
export type TotalFrames = number;
export type Id = string;
export type Title = string;
export type Url = string;
export type PublishedOn = string | null;
export type RetrievedOn = string;
/**
 * @maxItems 50
 */
export type Sources = Source[];
/**
 * @minItems 1
 * @maxItems 100
 */
export type Claims = [Claim, ...Claim[]];
export type Id1 = string;
export type Text = string;
export type Kind = "verified" | "assumption" | "hypothetical";
export type SourceIds = string[];
export type Scope = string;
export type Identity = "stanford";
export type LandmarkAsset = "stanford_tower_v1";
export type CharacterAsset = "student_v1";
export type Origin = "stanford_ca";
export type Destination = "boston_ma";
export type LayoutSeed = number;
export type TreeCount = number;
export type BuildingCount = number;
/**
 * @minItems 1
 * @maxItems 24
 */
export type Shots = [Shot, ...Shot[]];
export type Id2 = string;
export type StartFrame = number;
export type EndFrame = number;
export type Operation = string;
export type Title1 = string;
export type Camera = "portrait" | "orbit" | "map" | "wide" | "split";
export type Expression = "neutral" | "happy" | "surprised" | "worried" | "confused";
/**
 * @minItems 1
 * @maxItems 10
 */
export type ClaimIds =
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string]
  | [string, string, string, string, string]
  | [string, string, string, string, string, string]
  | [string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string];
/**
 * @minItems 1
 * @maxItems 60
 */
export type Captions = [Caption, ...Caption[]];
export type Id3 = string;
export type StartFrame1 = number;
export type EndFrame1 = number;
export type Text1 = string;
/**
 * @minItems 1
 * @maxItems 10
 */
export type ClaimIds1 =
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string]
  | [string, string, string, string, string]
  | [string, string, string, string, string, string]
  | [string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string];
export type Id4 = string;
export type AssetId =
  | "soft_chime_v1"
  | "air_sweep_v1"
  | "arrival_v1"
  | "amb_campus_day"
  | "amb_map_air"
  | "amb_winter_wind"
  | "crowd_murmur"
  | "mv_flight_swoosh"
  | "mv_rumble_lift"
  | "tr_whoosh_up"
  | "tr_whoosh_down"
  | "arr_shimmer"
  | "arr_impact_snow"
  | "dis_poof"
  | "imp_hit_low"
  | "ui_caption_pop"
  | "ui_counter_tick"
  | "stinger_surprise";
export type Frame = number;
export type GainDb = number;
export type EndFrame2 = number | null;
export type FadeInFrames = number;
export type FadeOutFrames = number;
export type Pan = number;
/**
 * @maxItems 40
 */
export type Sound = SoundCue[];
export type AudioLoudnessLufs = number;
export type EngineVersion = "0.1.0";
export type StylePack = "campus_clay_v1";
export type AssetVersion = "procedural_v1";

export interface ProductionSpec {
  schema_version: SchemaVersion;
  concept_id: ConceptId;
  topic: Topic;
  scenario_family: ScenarioFamily;
  seed: Seed;
  output: Output;
  evidence: FactPack;
  campus: Campus;
  shots: Shots;
  captions: Captions;
  sound: Sound;
  audio_loudness_lufs: AudioLoudnessLufs;
  dependencies: Dependencies;
}
/**
 * This interface was referenced by `ProductionSpec`'s JSON-Schema
 * via the `definition` "Output".
 */
export interface Output {
  width: Width;
  height: Height;
  fps: Fps;
  aspect_ratio: AspectRatio;
  total_frames: TotalFrames;
}
/**
 * This interface was referenced by `ProductionSpec`'s JSON-Schema
 * via the `definition` "FactPack".
 */
export interface FactPack {
  sources: Sources;
  claims: Claims;
}
/**
 * This interface was referenced by `ProductionSpec`'s JSON-Schema
 * via the `definition` "Source".
 */
export interface Source {
  id: Id;
  title: Title;
  url: Url;
  published_on: PublishedOn;
  retrieved_on: RetrievedOn;
}
/**
 * This interface was referenced by `ProductionSpec`'s JSON-Schema
 * via the `definition` "Claim".
 */
export interface Claim {
  id: Id1;
  text: Text;
  kind: Kind;
  source_ids: SourceIds;
  scope: Scope;
}
/**
 * This interface was referenced by `ProductionSpec`'s JSON-Schema
 * via the `definition` "Campus".
 */
export interface Campus {
  identity: Identity;
  landmark_asset: LandmarkAsset;
  character_asset: CharacterAsset;
  origin: Origin;
  destination: Destination;
  layout_seed: LayoutSeed;
  tree_count: TreeCount;
  building_count: BuildingCount;
}
/**
 * This interface was referenced by `ProductionSpec`'s JSON-Schema
 * via the `definition` "Shot".
 */
export interface Shot {
  id: Id2;
  start_frame: StartFrame;
  end_frame: EndFrame;
  operation: Operation;
  title: Title1;
  camera: Camera;
  expression: Expression;
  claim_ids: ClaimIds;
}
/**
 * This interface was referenced by `ProductionSpec`'s JSON-Schema
 * via the `definition` "Caption".
 */
export interface Caption {
  id: Id3;
  start_frame: StartFrame1;
  end_frame: EndFrame1;
  text: Text1;
  claim_ids: ClaimIds1;
}
/**
 * This interface was referenced by `ProductionSpec`'s JSON-Schema
 * via the `definition` "SoundCue".
 */
export interface SoundCue {
  id: Id4;
  asset_id: AssetId;
  frame: Frame;
  gain_db: GainDb;
  end_frame: EndFrame2;
  fade_in_frames: FadeInFrames;
  fade_out_frames: FadeOutFrames;
  pan: Pan;
}
/**
 * This interface was referenced by `ProductionSpec`'s JSON-Schema
 * via the `definition` "Dependencies".
 */
export interface Dependencies {
  engine_version: EngineVersion;
  style_pack: StylePack;
  asset_version: AssetVersion;
}
