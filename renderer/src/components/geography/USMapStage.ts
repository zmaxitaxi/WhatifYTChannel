import * as THREE from "three";
import { GeoCoord } from "../../contracts/types";
import { STYLE_PACK_V1 } from "../../style/stylePack";

/**
 * Deliverable 5: 3D Continental US Map & Coordinate Utilities
 * - Bundled Natural Earth-derived simplified lat/lon polygon for the Continental US
 * - Extruded 3D landmass with coastline bevel, regional borders, and city beacons
 * - Keeps geographic coordinates (lat/lon) separate from presentation coordinates (meters)
 */
export class USMapStage {
  public readonly root: THREE.Group;
  private readonly routeLine: THREE.Mesh;
  private readonly originBeacon: THREE.Group;
  private readonly destBeacon: THREE.Group;

  // Reference center of the Continental US
  private static readonly REF_LAT = 39.5;
  private static readonly REF_LON = -98.35;
  private static readonly METERS_PER_DEG_LAT = 1.35;
  private static readonly METERS_PER_DEG_LON = 1.12;

  // Simplified Continental US perimeter in [lat, lon] (clockwise from WA State)
  private static readonly CONUS_PERIMETER_LAT_LON: [number, number][] = [
    [48.4, -124.7], // Neah Bay, WA
    [49.0, -122.8], // WA North border
    [49.0, -116.0], // ID/MT border
    [49.0, -104.0], // MT/ND border
    [49.0, -95.2],  // MN Northwest Angle
    [48.0, -89.5],  // Lake Superior North
    [46.5, -84.5],  // Sault Ste Marie, MI
    [45.0, -82.4],  // Lake Huron
    [43.0, -79.0],  // Niagara, NY
    [45.0, -74.7],  // Upstate NY / VT
    [45.0, -71.5],  // NH/ME North
    [47.4, -69.2],  // Northern Maine
    [44.8, -66.9],  // Eastport, ME
    [43.6, -70.2],  // Portland, ME
    [42.36, -71.06],// Boston, MA
    [41.7, -70.0],  // Cape Cod, MA
    [40.7, -74.0],  // New York, NY
    [38.9, -74.9],  // Cape May, NJ
    [36.9, -76.0],  // Virginia Beach, VA
    [35.2, -75.5],  // Cape Hatteras, NC
    [32.8, -79.9],  // Charleston, SC
    [30.3, -81.4],  // Jacksonville, FL
    [25.2, -80.4],  // Miami / Key Largo, FL
    [25.1, -81.1],  // Cape Sable, FL
    [27.9, -82.8],  // Tampa Bay, FL
    [29.9, -84.4],  // Apalachee Bay, FL
    [30.2, -88.0],  // Mobile Bay, AL
    [29.1, -89.2],  // Mississippi Delta, LA
    [29.7, -93.8],  // Sabine Pass, TX
    [27.8, -97.1],  // Corpus Christi, TX
    [25.9, -97.1],  // Brownsville, TX
    [29.5, -101.0], // Del Rio, TX
    [29.0, -103.2], // Big Bend, TX
    [31.8, -106.5], // El Paso, TX
    [31.3, -111.0], // Nogales, AZ
    [32.5, -114.8], // Yuma, AZ
    [32.5, -117.1], // San Diego, CA
    [34.0, -118.5], // Los Angeles, CA
    [35.4, -120.9], // Morro Bay, CA
    [37.8, -122.5], // San Francisco / Bay Area, CA
    [40.4, -124.4], // Cape Mendocino, CA
    [46.2, -124.0], // Astoria, OR
  ];

  // Key regional state boundary lines [lat, lon][] for visual map context
  private static readonly STATE_DIVIDERS_LAT_LON: [number, number][][] = [
    // California border (OR -> NV -> AZ)
    [
      [42.0, -124.2],
      [42.0, -120.0],
      [39.0, -120.0],
      [35.0, -114.6],
      [32.5, -114.8],
    ],
    // West Coast (OR / WA divider + ID border)
    [
      [46.2, -124.0],
      [46.0, -116.9],
      [49.0, -116.0],
    ],
    // Rocky Mountain spine
    [
      [49.0, -104.0],
      [41.0, -104.0],
      [41.0, -109.0],
      [31.3, -109.0],
    ],
    // Central Plains spine
    [
      [49.0, -95.2],
      [36.5, -94.6],
      [29.7, -93.8],
    ],
    // Mississippi / Great Lakes corridor
    [
      [46.5, -84.5],
      [41.7, -87.6],
      [37.0, -89.2],
      [29.1, -89.2],
    ],
    // New England / NY border
    [
      [45.0, -73.3],
      [41.0, -73.7],
    ],
  ];

  constructor() {
    this.root = new THREE.Group();
    this.root.name = "us_map_stage";

    // 1. Ocean / Deep Background Table
    const oceanBase = new THREE.Mesh(
      new THREE.CylinderGeometry(72, 72, 0.6, 64),
      new THREE.MeshStandardMaterial({
        color: 0x09101d,
        roughness: 0.95,
      })
    );
    oceanBase.position.y = -2.2;
    oceanBase.receiveShadow = true;
    this.root.add(oceanBase);

    // 2. Extruded 3D Continental US Landmass
    // Note: Shape is built in 2D (x, -z) then rotated flat onto the XZ plane
    const usShape = new THREE.Shape();
    USMapStage.CONUS_PERIMETER_LAT_LON.forEach(([lat, lon], idx) => {
      const pt = USMapStage.geoToPresentationMeters({ lat, lon });
      if (idx === 0) {
        usShape.moveTo(pt.x, -pt.z);
      } else {
        usShape.lineTo(pt.x, -pt.z);
      }
    });
    usShape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 1.6,
      bevelEnabled: true,
      bevelThickness: 0.25,
      bevelSize: 0.25,
      bevelSegments: 2,
    };

    const usGeom = new THREE.ExtrudeGeometry(usShape, extrudeSettings);
    usGeom.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    const usMesh = new THREE.Mesh(
      usGeom,
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.8,
        metalness: 0.05,
      })
    );
    usMesh.position.y = -1.85; // Top surface sits right at y = 0
    usMesh.receiveShadow = true;
    usMesh.castShadow = true;
    this.root.add(usMesh);

    // 3. Highlighted Coastline Rim
    const rimPoints = USMapStage.CONUS_PERIMETER_LAT_LON.map(([lat, lon]) => {
      const p = USMapStage.geoToPresentationMeters({ lat, lon });
      p.y = 0.04;
      return p;
    });
    rimPoints.push(rimPoints[0].clone());

    const rimLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(rimPoints),
      new THREE.LineBasicMaterial({ color: 0x64748b })
    );
    this.root.add(rimLine);

    // 4. Regional State Border Lines
    const borderMat = new THREE.LineBasicMaterial({
      color: 0x334155,
    });
    for (const polyline of USMapStage.STATE_DIVIDERS_LAT_LON) {
      const pts = polyline.map(([lat, lon]) => {
        const p = USMapStage.geoToPresentationMeters({ lat, lon });
        p.y = 0.03;
        return p;
      });
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        borderMat
      );
      this.root.add(line);
    }

    // 5. Glowing 3D Tube for the Cross-Country Route Arc
    const dummyCurve = new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 1)
    );
    this.routeLine = new THREE.Mesh(
      new THREE.TubeGeometry(dummyCurve, 48, 0.22, 8, false),
      new THREE.MeshStandardMaterial({
        color: STYLE_PACK_V1.colors.routeArcGold,
        emissive: STYLE_PACK_V1.colors.routeArcGold,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      })
    );
    this.root.add(this.routeLine);

    // 6. Origin & Destination City Beacons (Palo Alto & Boston)
    this.originBeacon = this.createCityBeacon(0x8c1515); // Stanford Cardinal Red
    this.destBeacon = this.createCityBeacon(0x38bdf8);   // Boston Ice Blue
    this.root.add(this.originBeacon, this.destBeacon);
  }

  private createCityBeacon(colorHex: number): THREE.Group {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.8, 24),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16),
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.5,
      })
    );
    pillar.position.y = 0.4;
    group.add(ring, pillar);
    return group;
  }

  public static geoToPresentationMeters(coord: GeoCoord): THREE.Vector3 {
    const x = (coord.lon - this.REF_LON) * this.METERS_PER_DEG_LON;
    const z = -(coord.lat - this.REF_LAT) * this.METERS_PER_DEG_LAT;
    return new THREE.Vector3(x, 0, z);
  }

  /**
   * True Haversine distance in kilometers for factual metric readouts.
   */
  public static calculateGreatCircleKm(a: GeoCoord, b: GeoCoord): number {
    const R = 6371;
    const dLat = THREE.MathUtils.degToRad(b.lat - a.lat);
    const dLon = THREE.MathUtils.degToRad(b.lon - a.lon);
    const lat1 = THREE.MathUtils.degToRad(a.lat);
    const lat2 = THREE.MathUtils.degToRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h =
      sinDLat * sinDLat +
      Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  public static sampleRelocationArc(
    origin: GeoCoord,
    destination: GeoCoord,
    progress01: number,
    cruiseAltitudeMeters: number
  ): THREE.Vector3 {
    const start = this.geoToPresentationMeters(origin);
    const end = this.geoToPresentationMeters(destination);
    const pos = new THREE.Vector3().lerpVectors(start, end, progress01);
    const arcLift =
      4 * progress01 * (1 - progress01) * cruiseAltitudeMeters;
    pos.y = arcLift;
    return pos;
  }

  public updateRouteArc(
    origin: GeoCoord,
    destination: GeoCoord,
    cruiseAltitudeMeters: number
  ): void {
    const samples: THREE.Vector3[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      samples.push(
        USMapStage.sampleRelocationArc(
          origin,
          destination,
          i / steps,
          cruiseAltitudeMeters
        )
      );
    }

    const curve = new THREE.CatmullRomCurve3(samples);
    this.routeLine.geometry.dispose();
    this.routeLine.geometry = new THREE.TubeGeometry(
      curve,
      64,
      0.22,
      8,
      false
    );

    this.originBeacon.position.copy(USMapStage.geoToPresentationMeters(origin));
    this.destBeacon.position.copy(
      USMapStage.geoToPresentationMeters(destination)
    );
  }
}