import * as THREE from "three";

/**
 * Versioned Style Pack per TECHNICAL_PLAN.md Section 3 & 4:
 * - Muted environments, clear university accents, simple materials
 * - Explicit SRGBColorSpace & ACESFilmicToneMapping for predictable BT.709 encoding
 */
export const STYLE_PACK_V1 = {
  version: "1.0.0",
  colors: {
    skyCalifornia: 0xdbeafe,
    skyBostonWinter: 0xcbd5e1,
    skyNeutralMap: 0x0f172a,
    groundMapLand: 0x1e293b,
    groundMapBorder: 0x475569,
    stanfordSandstone: 0xd6c3a5,
    stanfordTileRed: 0x8c1515,
    stanfordTreeGreen: 0x2d5a27,
    bostonBrick: 0x7c2d12,
    snowWhite: 0xf8fafc,
    routeArcGold: 0xf59e0b,
  },
  safeMarginsPx: {
    left: 90,
    right: 180,
    top: 180,
    bottom: 300,
  },
} as const;

export function configureRendererColorManagement(
  renderer: THREE.WebGLRenderer
): void {
  THREE.ColorManagement.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
