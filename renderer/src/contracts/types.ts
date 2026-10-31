/**
 * Authoritative TypeScript contracts matching TECHNICAL_PLAN.md Section 2.
 * In production, Max's Pydantic models export JSON Schema -> generated TS types.
 * This file bootstraps Patrick's Day 1-3 engine and capability registry.
 */

export const SHORTS_WIDTH = 1080 as const;
export const SHORTS_HEIGHT = 1920 as const;
export const SHORTS_FPS = 30 as const;
export const SHORTS_ASPECT = "9:16" as const;

export type ExpressionName =
  | "neutral"
  | "happy"
  | "surprised"
  | "worried"
  | "confused";

export type CharacterActionName =
  | "idle"
  | "walking"
  | "pointing"
  | "celebrating";

export type CameraPrimitiveName =
  | "static_establish"
  | "character_closeup"
  | "cinematic_orbit"
  | "map_route_tracking"
  | "split_comparison";

export type EnvironmentPreset =
  | "california_sunny"
  | "boston_snowy"
  | "neutral_map";

export interface GeoCoord {
  lat: number;
  lon: number;
  label?: string;
}

export interface KeyframeTrackSpec {
  startFrame: number; // Half-open [startFrame, endFrame)
  endFrame: number;
  easing?: "linear" | "smoothstep" | "easeInOutCubic";
}

export interface ShotSpec {
  id: string;
  startFrame: number;
  endFrame: number;
  cameraPrimitive: CameraPrimitiveName;
  primarySubjectId: string;
  secondarySubjectId?: string;
  environmentPreset: EnvironmentPreset;
  cameraParams?: {
    distance?: number;
    elevationDeg?: number;
    azimuthStartDeg?: number;
    azimuthEndDeg?: number;
  };
}

export interface CharacterTrackSpec {
  characterId: string;
  startFrame: number;
  endFrame: number;
  expression: ExpressionName;
  action: CharacterActionName;
  positionMeters: [number, number, number];
  rotationYRad?: number;
}

export interface CampusRelocationTrackSpec {
  campusId: string;
  universityKit: "stanford" | "berkeley" | "harvard" | "mit" | "ucla";
  startFrame: number;
  endFrame: number;
  origin: GeoCoord;
  destination: GeoCoord;
  cruiseAltitudeMeters: number;
  weatherSnowIntensity?: number; // 0.0 to 1.0
}

export interface CaptionCueSpec {
  id: string;
  startFrame: number;
  endFrame: number;
  text: string;
  sourceLabel?: string;
  isHypothetical: boolean;
  timeScaleLabel?: string;
  /**
   * Words or exact phrases inside `text` to draw in the accent color
   * (e.g. ["Boston"] or ["4,334 km"]). Matching is case-insensitive and
   * ignores punctuation. Optional; Francis's caption layer only.
   */
  emphasis?: string[];
}

export interface MetricBindingSpec {
  id: string;
  startFrame: number;
  endFrame: number;
  label: string;
  unit: string;
  startValue: number;
  endValue: number;
  isHypothetical: boolean;
  /** Where the number comes from, shown under the readout (e.g. "Great-circle calculation"). */
  sourceLabel?: string;
}

/**
 * A short on-screen label pinned to a point in the 3D scene, such as a city
 * name on the map or a landmark name above a campus. The overlay layer
 * projects the anchor every frame and keeps the label inside the safe zone.
 */
export type OverlayAnchorSpec =
  | { type: "geo"; coord: GeoCoord }
  | { type: "subject"; subjectId: string };

export interface OverlayLabelSpec {
  id: string;
  startFrame: number;
  endFrame: number;
  text: string;
  anchor: OverlayAnchorSpec;
  /** "place" = city / location pin, "landmark" = building or campus name. */
  kind: "place" | "landmark";
}

export interface CompiledScenePlan {
  specVersion: string;
  jobId: string;
  topic: string;
  scenarioFamily: "relocation" | "swap" | "disappearance" | "ranking";
  seed: number;
  output: {
    width: typeof SHORTS_WIDTH;
    height: typeof SHORTS_HEIGHT;
    fps: typeof SHORTS_FPS;
    aspectRatio: typeof SHORTS_ASPECT;
    totalFrames: number;
  };
  shots: ShotSpec[];
  characterTracks: CharacterTrackSpec[];
  campusTracks: CampusRelocationTrackSpec[];
  captions: CaptionCueSpec[];
  metrics: MetricBindingSpec[];
  /** Optional anchored labels (city pins, landmark names). */
  labels?: OverlayLabelSpec[];
}

export interface AssetManifest {
  engineVersion: string;
  stylePackVersion: string;
  assets: Record<
    string,
    {
      id: string;
      sha256: string;
      provenance: string;
    }
  >;
}

export interface ProjectedBounds2D {
  subjectId: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  visibleInSafeZone: boolean;
}

export interface FrameDiagnostics {
  frameIndex: number;
  timeSeconds: number;
  activeShotId: string;
  visibleSubjects: string[];
  projectedBounds: ProjectedBounds2D[];
  textBounds: {
    id: string;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    wordCount: number;
  }[];
  missingResources: string[];
  renderStats: {
    geometries: number;
    textures: number;
    drawCalls: number;
    triangles: number;
  };
  warnings: string[];
}

export interface AetherRuntime {
  initialize(plan: CompiledScenePlan, assets: AssetManifest): Promise<void>;
  renderFrame(frameIndex: number): Promise<FrameDiagnostics>;
  dispose(): Promise<void>;
}
