import * as THREE from "three";
import {
  AetherRuntime,
  AssetManifest,
  CompiledScenePlan,
  FrameDiagnostics,
  ProjectedBounds2D,
  SHORTS_FPS,
  SHORTS_HEIGHT,
  SHORTS_WIDTH,
  ShotSpec,
} from "../contracts/types";
import { sampleNormalizedFrame } from "./prng";
import {
  STYLE_PACK_V1,
  configureRendererColorManagement,
} from "../style/stylePack";
import { StylizedCharacter } from "../components/character/StylizedCharacter";
import { StanfordCampusKit } from "../components/campus/StanfordCampusKit";
import { USMapStage } from "../components/geography/USMapStage";
import { OverlayRenderer, ScreenPoint } from "../overlays/OverlayRenderer";

export class AetherEngine implements AetherRuntime {
  private readonly canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;

  private plan!: CompiledScenePlan;
  private mapStage!: USMapStage;
  private localSurroundings!: THREE.Group;
  private localGroundMat!: THREE.MeshStandardMaterial;
  private bostonCityRing!: THREE.Group;
  private californiaHillsRing!: THREE.Group;

  private characters = new Map<string, StylizedCharacter>();
  private campuses = new Map<string, StanfordCampusKit>();
  private subjectRoots = new Map<string, THREE.Object3D>();
  private overlays: OverlayRenderer | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public async initialize(
    plan: CompiledScenePlan,
    _assets: AssetManifest
  ): Promise<void> {
    if (
      plan.output.width !== SHORTS_WIDTH ||
      plan.output.height !== SHORTS_HEIGHT ||
      plan.output.fps !== SHORTS_FPS
    ) {
      throw new Error(
        `Invalid output specification: AETHER strictly enforces 1080x1920 @ 30fps.`
      );
    }

    this.plan = plan;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(SHORTS_WIDTH, SHORTS_HEIGHT, false);
    configureRendererColorManagement(this.renderer);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(STYLE_PACK_V1.colors.skyCalifornia);
    this.scene.fog = new THREE.FogExp2(STYLE_PACK_V1.colors.skyCalifornia, 0.006);

    this.camera = new THREE.PerspectiveCamera(
      40,
      SHORTS_WIDTH / SHORTS_HEIGHT,
      0.1,
      500
    );

    // Richer Stylized Lighting (Ambient + Sky/Ground Hemisphere + Sun Key Light)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.6);
    this.keyLight = new THREE.DirectionalLight(0xfffbeb, 1.75);
    this.keyLight.position.set(22, 38, 28);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.ambientLight, this.hemiLight, this.keyLight);

    // 1. Macro US Map Stage (for cross-country shots)
    this.mapStage = new USMapStage();
    this.scene.add(this.mapStage.root);

    // 2. Local Campus Surroundings Stage (replaces black void during close-up shots!)
    this.localSurroundings = this.buildLocalSurroundings();
    this.scene.add(this.localSurroundings);

    // 3. Instantiate Campuses
    for (const cTrack of plan.campusTracks) {
      if (!this.campuses.has(cTrack.campusId)) {
        const kit = new StanfordCampusKit(cTrack.campusId, plan.seed);
        this.campuses.set(cTrack.campusId, kit);
        this.subjectRoots.set(cTrack.campusId, kit.root);
        this.scene.add(kit.root);
      }
      this.mapStage.updateRouteArc(
        cTrack.origin,
        cTrack.destination,
        cTrack.cruiseAltitudeMeters
      );
    }

    // 4. Instantiate Characters
    for (const charTrack of plan.characterTracks) {
      if (!this.characters.has(charTrack.characterId)) {
        const char = new StylizedCharacter(charTrack.characterId);
        this.characters.set(charTrack.characterId, char);
        this.subjectRoots.set(charTrack.characterId, char.root);
        this.scene.add(char.root);
      }
    }

    this.camera.position.set(0, 12, 26);
    this.camera.lookAt(0, 0, 0);
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);

    // 5. Caption + overlay layer (Francis, Workstream C). Optional so the
    //    engine still runs headless in unit tests without the HTML shell.
    const overlayRoot =
      typeof document !== "undefined"
        ? document.getElementById("overlay-layer")
        : null;
    if (overlayRoot) {
      this.overlays = new OverlayRenderer(overlayRoot);
      await this.overlays.mount(plan);
    }
    this.renderer.compile(this.scene, this.camera);
  }

  private buildLocalSurroundings(): THREE.Group {
    const group = new THREE.Group();
    group.name = "local_campus_surroundings";

    // Wide horizon ground plane so you never see black empty space behind the campus
    this.localGroundMat = new THREE.MeshStandardMaterial({
      color: 0x4d7c0f,
      roughness: 0.92,
    });
    const groundDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(160, 160, 1.0, 48),
      this.localGroundMat
    );
    groundDisk.position.y = -1.15;
    groundDisk.receiveShadow = true;
    group.add(groundDisk);

    // California Foothills Silhouette Ring
    this.californiaHillsRing = new THREE.Group();
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x65a30d,
      roughness: 0.9,
    });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(14, 7 + (i % 3) * 2.5, 16),
        hillMat
      );
      hill.position.set(Math.cos(angle) * 38, 2.2, Math.sin(angle) * 38);
      this.californiaHillsRing.add(hill);
    }
    group.add(this.californiaHillsRing);

    // Boston Snowy Brick Cityscape & Charles River Ring
    this.bostonCityRing = new THREE.Group();
    const brickMat = new THREE.MeshStandardMaterial({
      color: STYLE_PACK_V1.colors.bostonBrick,
      roughness: 0.8,
    });
    const snowRoofMat = new THREE.MeshStandardMaterial({
      color: STYLE_PACK_V1.colors.snowWhite,
      roughness: 0.6,
    });
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const radius = 16 + (i % 3) * 4.5;
      const h = 3.0 + (i % 4) * 1.8;
      const bldg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, h, 2.8), brickMat);
      body.position.y = h / 2;
      body.castShadow = true;
      const snowCap = new THREE.Mesh(
        new THREE.BoxGeometry(2.9, 0.35, 2.9),
        snowRoofMat
      );
      snowCap.position.y = h + 0.15;
      bldg.add(body, snowCap);
      bldg.position.set(
        Math.cos(angle) * radius,
        -0.6,
        Math.sin(angle) * radius
      );
      bldg.lookAt(0, 0, 0);
      this.bostonCityRing.add(bldg);
    }
    group.add(this.bostonCityRing);

    return group;
  }

  public async renderFrame(frameIndex: number): Promise<FrameDiagnostics> {
    if (frameIndex < 0 || frameIndex >= this.plan.output.totalFrames) {
      throw new Error(
        `Frame index ${frameIndex} out of bounds [0, ${this.plan.output.totalFrames}).`
      );
    }

    const timeSeconds = frameIndex / SHORTS_FPS;
    const warnings: string[] = [];

    const activeShot =
      this.plan.shots.find(
        (s) => frameIndex >= s.startFrame && frameIndex < s.endFrame
      ) ?? this.plan.shots[this.plan.shots.length - 1];

    // 1. Evaluate Campus Relocation Tracks
    for (const cTrack of this.plan.campusTracks) {
      const campus = this.campuses.get(cTrack.campusId);
      if (!campus) continue;

      const progress = sampleNormalizedFrame(
        frameIndex,
        cTrack.startFrame,
        cTrack.endFrame,
        "smoothstep"
      );

      // During map_route_tracking, fly along the arc; during local campus shots, keep grounded
      if (activeShot.environmentPreset === "neutral_map") {
        const pos = USMapStage.sampleRelocationArc(
          cTrack.origin,
          cTrack.destination,
          progress,
          cTrack.cruiseAltitudeMeters
        );
        campus.root.position.copy(pos);
      } else {
        const coord =
          activeShot.environmentPreset === "boston_snowy"
            ? cTrack.destination
            : cTrack.origin;
        const groundPos = USMapStage.geoToPresentationMeters(coord);
        // Subtle lift-off only in the last 30 frames of shot_2
        const liftY =
          activeShot.id === "shot_2_stanford_lift"
            ? sampleNormalizedFrame(frameIndex, 135, 180, "easeInOutCubic") * 3.5
            : 0;
        campus.root.position.set(groundPos.x, liftY, groundPos.z);
        this.localSurroundings.position.set(groundPos.x, 0, groundPos.z);
      }

      const snow =
        activeShot.environmentPreset === "boston_snowy"
          ? cTrack.weatherSnowIntensity ?? 0.85
          : 0;
      campus.applyEnvironment(snow, timeSeconds);
    }

    // 2. Apply Scene Scale Transition (Macro US Map vs Local Campus Horizon)
    this.applyEnvironmentPreset(activeShot.environmentPreset);

    // 3. Evaluate Character Tracks
    for (const char of this.characters.values()) {
      char.root.visible = false;
    }
    for (const chTrack of this.plan.characterTracks) {
      if (frameIndex >= chTrack.startFrame && frameIndex < chTrack.endFrame) {
        const char = this.characters.get(chTrack.characterId);
        if (char) {
          char.root.visible = true;
          char.root.position.set(...chTrack.positionMeters);
          char.root.rotation.y = chTrack.rotationYRad ?? 0;
          char.applyState(chTrack.expression, chTrack.action, timeSeconds);
        }
      }
    }

    // 4. Evaluate Camera Primitive
    this.applyCameraPrimitive(activeShot, frameIndex);

    // 5. Render WebGL Scene
    this.renderer.render(this.scene, this.camera);

    // 6. Compute Diagnostics
    const projectedBounds: ProjectedBounds2D[] = [];
    const visibleSubjects: string[] = [];

    for (const [subjectId, obj] of this.subjectRoots.entries()) {
      if (!obj.visible) continue;
      const bounds = this.projectObjectScreenBounds(subjectId, obj);
      if (bounds) {
        projectedBounds.push(bounds);
        visibleSubjects.push(subjectId);
        if (
          subjectId === activeShot.primarySubjectId &&
          !bounds.visibleInSafeZone
        ) {
          warnings.push(
            `Primary subject '${subjectId}' extends outside phone safe zone at frame ${frameIndex}.`
          );
        }
      }
    }

    // 7. Caption + overlay layer (Workstream C), placed against this frame's
    //    projected anchors so labels follow the scene.
    let textBounds: FrameDiagnostics["textBounds"] = [];
    if (this.overlays) {
      const ov = this.overlays.update(frameIndex, {
        projectedBounds,
        visibleSubjects,
        characterIds: [...this.characters.keys()],
        projectGeo: (coord) =>
          this.projectToScreen(USMapStage.geoToPresentationMeters(coord)),
      });
      textBounds = ov.textBounds;
      warnings.push(...ov.warnings);
    }

    return {
      frameIndex,
      timeSeconds,
      activeShotId: activeShot.id,
      visibleSubjects,
      projectedBounds,
      textBounds,
      missingResources: [],
      renderStats: {
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      },
      warnings,
    };
  }

  private applyEnvironmentPreset(preset: ShotSpec["environmentPreset"]): void {
    switch (preset) {
      case "california_sunny": {
        const sky = new THREE.Color(0xbae6fd);
        this.scene.background = sky;
        this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.008);
        this.keyLight.intensity = 1.85;
        this.mapStage.root.visible = false; // Hide US map & yellow tube during local shot!
        this.localSurroundings.visible = true;
        this.localGroundMat.color.setHex(0x4d7c0f); // Warm California grass
        this.californiaHillsRing.visible = true;
        this.bostonCityRing.visible = false;
        break;
      }
      case "boston_snowy": {
        const sky = new THREE.Color(0xcbd5e1);
        this.scene.background = sky;
        this.scene.fog = new THREE.FogExp2(0xcbd5e1, 0.012);
        this.keyLight.intensity = 1.35;
        this.mapStage.root.visible = false; // Hide US map & yellow tube during Boston shot!
        this.localSurroundings.visible = true;
        this.localGroundMat.color.setHex(0xe2e8f0); // Snow-covered Boston ground
        this.californiaHillsRing.visible = false;
        this.bostonCityRing.visible = true;
        break;
      }
      case "neutral_map": {
        const sky = new THREE.Color(STYLE_PACK_V1.colors.skyNeutralMap);
        this.scene.background = sky;
        this.scene.fog = new THREE.FogExp2(
          STYLE_PACK_V1.colors.skyNeutralMap,
          0.003
        );
        this.keyLight.intensity = 1.55;
        this.mapStage.root.visible = true; // Show 3D US map & flight arc!
        this.localSurroundings.visible = false;
        break;
      }
    }
  }

  private applyCameraPrimitive(shot: ShotSpec, frameIndex: number): void {
    const t = sampleNormalizedFrame(
      frameIndex,
      shot.startFrame,
      shot.endFrame,
      "smoothstep"
    );
    const primaryObj = this.subjectRoots.get(shot.primarySubjectId);
    const targetPos = new THREE.Vector3();
    if (primaryObj) {
      primaryObj.getWorldPosition(targetPos);
    }

    switch (shot.cameraPrimitive) {
      case "character_closeup": {
        const headTarget = targetPos.clone().add(new THREE.Vector3(0, 1.62, 0));
        this.camera.position.set(
          headTarget.x + Math.sin(t * 0.4 - 0.2) * 0.25,
          headTarget.y + 0.08,
          headTarget.z + 2.35
        );
        this.camera.lookAt(headTarget);
        break;
      }
      case "cinematic_orbit": {
        const dist = shot.cameraParams?.distance ?? 24;
        const elev = THREE.MathUtils.degToRad(
          shot.cameraParams?.elevationDeg ?? 22
        );
        const azStart = THREE.MathUtils.degToRad(
          shot.cameraParams?.azimuthStartDeg ?? -35
        );
        const azEnd = THREE.MathUtils.degToRad(
          shot.cameraParams?.azimuthEndDeg ?? 45
        );
        const az = THREE.MathUtils.lerp(azStart, azEnd, t);

        this.camera.position.set(
          targetPos.x + dist * Math.sin(az) * Math.cos(elev),
          targetPos.y + dist * Math.sin(elev),
          targetPos.z + dist * Math.cos(az) * Math.cos(elev)
        );
        this.camera.lookAt(targetPos.clone().add(new THREE.Vector3(0, 3.2, 0)));
        break;
      }
      case "map_route_tracking": {
        this.camera.position.set(
          targetPos.x * 0.55,
          targetPos.y + 34,
          targetPos.z + 44
        );
        this.camera.lookAt(targetPos);
        break;
      }
      case "static_establish":
      case "split_comparison":
      default: {
        this.camera.position.set(
          targetPos.x,
          targetPos.y + 12,
          targetPos.z + 26
        );
        this.camera.lookAt(targetPos);
        break;
      }
    }

    this.camera.updateMatrixWorld(true);
  }

  private projectToScreen(world: THREE.Vector3): ScreenPoint {
    const v = world.clone().project(this.camera);
    return {
      x: ((v.x + 1) * 0.5) * SHORTS_WIDTH,
      y: ((-v.y + 1) * 0.5) * SHORTS_HEIGHT,
      inFront: v.z > -1 && v.z < 1,
    };
  }

  private projectObjectScreenBounds(
    subjectId: string,
    obj: THREE.Object3D
  ): ProjectedBounds2D | null {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return null;

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const c of corners) {
      c.project(this.camera);
      const sx = ((c.x + 1) * 0.5) * SHORTS_WIDTH;
      const sy = ((-c.y + 1) * 0.5) * SHORTS_HEIGHT;
      minX = Math.min(minX, sx);
      minY = Math.min(minY, sy);
      maxX = Math.max(maxX, sx);
      maxY = Math.max(maxY, sy);
    }

    const m = STYLE_PACK_V1.safeMarginsPx;
    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;
    const visibleInSafeZone =
      centerX >= m.left &&
      centerX <= SHORTS_WIDTH - m.right &&
      centerY >= m.top &&
      centerY <= SHORTS_HEIGHT - m.bottom;

    return {
      subjectId,
      minX: Math.round(minX),
      minY: Math.round(minY),
      maxX: Math.round(maxX),
      maxY: Math.round(maxY),
      visibleInSafeZone,
    };
  }

  public async dispose(): Promise<void> {
    this.renderer.dispose();
  }
}