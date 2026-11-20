import * as THREE from 'three';
import { SceneTextures } from './textures';

export interface TigerBikeRig {
  root: THREE.Group;
  contactShadow: THREE.Mesh;
  headlightBeam: THREE.Mesh;
  headlightSpot: THREE.SpotLight;
  headlightLensMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
  update: (params: {
    dt: number;
    elapsed: number;
    distanceDelta: number;
    speed: number;
    steerAngle: number;
    leanAngle: number;
    bellActive: number; // 0..1 decaying timer after horn/bell
    isTwilight: boolean;
  }) => void;
}

// Reusable math objects (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _joint = new THREE.Vector3();
const _side = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _boneAxis = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _gripWorld = new THREE.Vector3();
const _gripLocal = new THREE.Vector3();

function solveAndPlaceTwoBoneIK(
  rootPos: THREE.Vector3,
  targetPos: THREE.Vector3,
  poleDir: THREE.Vector3,
  len1: number,
  len2: number,
  upperGroup: THREE.Object3D,
  lowerGroup: THREE.Object3D
) {
  _v1.copy(targetPos).sub(rootPos);
  const rawDist = _v1.length();
  const maxReach = len1 + len2 - 0.003;
  const minReach = Math.abs(len1 - len2) + 0.02;
  const d = THREE.MathUtils.clamp(rawDist, minReach, maxReach);

  if (rawDist < 1e-5) {
    _dir.set(0, -1, 0);
  } else {
    _dir.copy(_v1).divideScalar(rawDist);
  }

  // Law of cosines for angle at root
  const cosAlpha = THREE.MathUtils.clamp(
    (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d),
    -1,
    1
  );
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  // Orthogonal component of poleDir perpendicular to _dir
  const dotPole = poleDir.dot(_dir);
  _perp.copy(poleDir).addScaledVector(_dir, -dotPole);
  if (_perp.lengthSq() < 1e-6) {
    _perp.set(0, 0, 1);
  } else {
    _perp.normalize();
  }

  // Joint local position
  _joint
    .copy(rootPos)
    .addScaledVector(_dir, len1 * cosAlpha)
    .addScaledVector(_perp, len1 * sinAlpha);

  // Place upper bone: local -Y points from rootPos to _joint
  upperGroup.position.copy(rootPos);
  _boneAxis.copy(rootPos).sub(_joint).normalize();
  _side.crossVectors(_boneAxis, _perp);
  if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
  else _side.normalize();
  _fwd.crossVectors(_side, _boneAxis).normalize();
  _mat4.makeBasis(_side, _boneAxis, _fwd);
  upperGroup.quaternion.setFromRotationMatrix(_mat4);

  // Place lower bone: local -Y points from _joint to targetPos
  lowerGroup.position.copy(_joint);
  _v2.copy(rootPos).addScaledVector(_dir, d);
  _boneAxis.copy(_joint).sub(_v2).normalize();
  _side.crossVectors(_boneAxis, _perp);
  if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
  else _side.normalize();
  _fwd.crossVectors(_side, _boneAxis).normalize();
  _mat4.makeBasis(_side, _boneAxis, _fwd);
  lowerGroup.quaternion.setFromRotationMatrix(_mat4);
}

function createTubeBetween(
  points: THREE.Vector3[],
  radius: number,
  radialSegs = 12
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, radialSegs, false);
}

export function createTigerBikeRig(textures: SceneTextures): TigerBikeRig {
  const root = new THREE.Group();
  root.name = 'TigerATVRoot';

  // Wide radial contact shadow grounding the 4-wheel ATV onto the coastal road
  const shadowGeo = new THREE.PlaneGeometry(1.95, 2.55);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.62,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.set(0, 0.015, 0.02);
  root.add(contactShadow);

  // Unsprung base group (all 4 ATV tires stay planted firmly on Y = 0)
  const atvBaseGroup = new THREE.Group();
  root.add(atvBaseGroup);

  // Sprung chassis group pivots at suspension center (Y = 0.32) for natural roll & bounce
  const sprungPivot = new THREE.Group();
  sprungPivot.position.set(0, 0.32, 0);
  atvBaseGroup.add(sprungPivot);

  const bikeGroup = new THREE.Group();
  bikeGroup.position.set(0, -0.32, 0);
  sprungPivot.add(bikeGroup);

  // =========================================================================
  // 1. 4-WHEEL COASTAL ATV / QUAD BIKE (사륜 오토바이)
  // =========================================================================
  const WHEEL_RADIUS = 0.305;
  const WHEEL_WIDTH = 0.22;
  const HALF_TRACK = 0.45;
  const FRONT_Z = 0.62;
  const REAR_Z = -0.58;
  const SEAT_Y = 0.73;
  const SEAT_Z = -0.18;
  const HEAD_TOP = new THREE.Vector3(0, 0.74, 0.34);

  // Materials with calibrated roughness / metalness contrast
  const bodyTealMat = new THREE.MeshPhysicalMaterial({
    color: 0x2f8f8d, // Coastal Jeju teal-turquoise ATV bodywork
    roughness: 0.22,
    metalness: 0.28,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });
  const ruggedTrimMat = new THREE.MeshStandardMaterial({
    color: 0x20242b, // Matte rugged black polymer fenders & bumpers
    roughness: 0.76,
    metalness: 0.14,
  });
  const steelFrameMat = new THREE.MeshStandardMaterial({
    color: 0x2c323b,
    roughness: 0.45,
    metalness: 0.72,
  });
  const creamAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf7f1e3,
    roughness: 0.35,
    metalness: 0.1,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.14,
    metalness: 0.94,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.28,
    metalness: 0.85,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a441,
    roughness: 0.2,
    metalness: 0.92,
  });
  const shockGoldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.28,
    metalness: 0.65,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d21,
    roughness: 0.9,
    metalness: 0.03,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x4b2e1b,
    roughness: 0.62,
    metalness: 0.05,
  });
  const wickerMat = new THREE.MeshStandardMaterial({
    map: textures.woodPlank,
    color: 0xd9a45b,
    roughness: 0.84,
    metalness: 0.02,
  });

  // Helper to add tubular steel bars to bikeGroup
  const addFrameTube = (pts: THREE.Vector3[], r: number, mat: THREE.Material = steelFrameMat) => {
    const mesh = new THREE.Mesh(createTubeBetween(pts, r, 10), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bikeGroup.add(mesh);
    return mesh;
  };

  // Build chunky off-road ATV wheel with knobby tread blocks & 5-spoke alloy rim
  const treadLugGeo = new THREE.BoxGeometry(WHEEL_WIDTH * 0.82, 0.032, 0.052);
  function buildAtvWheel(isLeftSide: boolean): THREE.Group {
    const wheel = new THREE.Group();

    // Main wide rubber carcass
    const carcassGeo = new THREE.CylinderGeometry(
      WHEEL_RADIUS - 0.015,
      WHEEL_RADIUS - 0.015,
      WHEEL_WIDTH,
      24
    );
    carcassGeo.rotateZ(Math.PI / 2);
    const carcass = new THREE.Mesh(carcassGeo, tireMat);
    carcass.castShadow = true;
    carcass.receiveShadow = true;
    wheel.add(carcass);

    // Rounded tire shoulders on both sides
    for (const side of [-1, 1]) {
      const shoulderGeo = new THREE.TorusGeometry(WHEEL_RADIUS - 0.052, 0.042, 10, 24);
      shoulderGeo.rotateY(Math.PI / 2);
      const shoulder = new THREE.Mesh(shoulderGeo, tireMat);
      shoulder.position.x = side * (WHEEL_WIDTH * 0.34);
      wheel.add(shoulder);
    }

    // 14 Knobby off-road tread lugs around circumference (makes wheel spin super visible!)
    const lugCount = 14;
    for (let i = 0; i < lugCount; i++) {
      const ang = (i / lugCount) * Math.PI * 2;
      const lug = new THREE.Mesh(treadLugGeo, tireMat);
      lug.position.set(
        (i % 2 === 0 ? 0.012 : -0.012),
        Math.cos(ang) * (WHEEL_RADIUS - 0.01),
        Math.sin(ang) * (WHEEL_RADIUS - 0.01)
      );
      lug.rotation.x = ang;
      wheel.add(lug);
    }

    // Deep-dish alloy wheel rim & outer lip
    const rimGeo = new THREE.CylinderGeometry(0.165, 0.165, WHEEL_WIDTH + 0.014, 18);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, alloyMat);
    wheel.add(rim);

    const outSign = isLeftSide ? 1 : -1;
    const lipGeo = new THREE.TorusGeometry(0.162, 0.014, 8, 22);
    lipGeo.rotateY(Math.PI / 2);
    const lip = new THREE.Mesh(lipGeo, chromeMat);
    lip.position.x = outSign * (WHEEL_WIDTH * 0.5 + 0.005);
    wheel.add(lip);

    // 5-spoke star hub + center brass cap
    const spokeGeo = new THREE.BoxGeometry(0.022, 0.145, 0.028);
    for (let s = 0; s < 5; s++) {
      const sp = new THREE.Mesh(spokeGeo, ruggedTrimMat);
      const a = (s / 5) * Math.PI * 2;
      sp.position.set(
        outSign * (WHEEL_WIDTH * 0.48),
        Math.cos(a) * 0.072,
        Math.sin(a) * 0.072
      );
      sp.rotation.x = a;
      wheel.add(sp);
    }

    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.048, 0.04, 14), brassMat);
    hubCap.rotation.z = Math.PI / 2;
    hubCap.position.x = outSign * (WHEEL_WIDTH * 0.5 + 0.01);
    wheel.add(hubCap);

    return wheel;
  }

  // Front Left & Right Steerable Wheel Knuckles
  const frontLeftSteer = new THREE.Group();
  frontLeftSteer.position.set(HALF_TRACK, WHEEL_RADIUS, FRONT_Z);
  atvBaseGroup.add(frontLeftSteer);
  const frontLeftWheel = buildAtvWheel(true);
  frontLeftSteer.add(frontLeftWheel);

  const frontRightSteer = new THREE.Group();
  frontRightSteer.position.set(-HALF_TRACK, WHEEL_RADIUS, FRONT_Z);
  atvBaseGroup.add(frontRightSteer);
  const frontRightWheel = buildAtvWheel(false);
  frontRightSteer.add(frontRightWheel);

  // Rear Left & Right Drive Wheels + Solid Rear Axle
  const rearLeftWheel = buildAtvWheel(true);
  rearLeftWheel.position.set(HALF_TRACK, WHEEL_RADIUS, REAR_Z);
  atvBaseGroup.add(rearLeftWheel);

  const rearRightWheel = buildAtvWheel(false);
  rearRightWheel.position.set(-HALF_TRACK, WHEEL_RADIUS, REAR_Z);
  atvBaseGroup.add(rearRightWheel);

  const rearAxleTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, HALF_TRACK * 1.9, 12),
    steelFrameMat
  );
  rearAxleTube.rotation.z = Math.PI / 2;
  rearAxleTube.position.set(0, WHEEL_RADIUS, REAR_Z);
  atvBaseGroup.add(rearAxleTube);

  const rearDiff = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), steelFrameMat);
  rearDiff.position.set(0, WHEEL_RADIUS, REAR_Z);
  atvBaseGroup.add(rearDiff);

  // Front lower A-arms connecting chassis to steering knuckles
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(
      createTubeBetween(
        [
          new THREE.Vector3(s * 0.16, WHEEL_RADIUS, FRONT_Z - 0.12),
          new THREE.Vector3(s * (HALF_TRACK - 0.08), WHEEL_RADIUS, FRONT_Z),
          new THREE.Vector3(s * 0.16, WHEEL_RADIUS, FRONT_Z + 0.10),
        ],
        0.016,
        8
      ),
      steelFrameMat
    );
    atvBaseGroup.add(arm);
  }

  // --- Sprung ATV Chassis, Suspension Shocks, Engine & Exhaust ---
  // Main twin lower steel frame rails
  for (const s of [-1, 1]) {
    addFrameTube(
      [
        new THREE.Vector3(s * 0.18, 0.34, FRONT_Z + 0.12),
        new THREE.Vector3(s * 0.18, 0.34, REAR_Z - 0.14),
      ],
      0.022
    );
  }

  // 4 Coil-over Suspension Shocks (golden springs!)
  const shockCoords: [number, number][] = [
    [1, FRONT_Z],
    [-1, FRONT_Z],
    [1, REAR_Z],
    [-1, REAR_Z],
  ];
  for (const [s, zPos] of shockCoords) {
    const topPt = new THREE.Vector3(s * 0.21, 0.56, zPos);
    const botPt = new THREE.Vector3(s * 0.38, 0.32, zPos);
    addFrameTube([topPt, botPt], 0.014, chromeMat);
    const midPt = topPt.clone().lerp(botPt, 0.5);
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.17, 12), shockGoldMat);
    spring.position.copy(midPt);
    spring.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      topPt.clone().sub(botPt).normalize()
    );
    bikeGroup.add(spring);
  }

  // Air-cooled ATV Engine Block + Cooling Fins + Side Exhaust Muffler
  const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.32), alloyMat);
  engineBlock.position.set(0, 0.44, 0.04);
  engineBlock.castShadow = true;
  bikeGroup.add(engineBlock);

  for (let f = 0; f < 4; f++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.014, 0.24), ruggedTrimMat);
    fin.position.set(0, 0.38 + f * 0.042, 0.04);
    bikeGroup.add(fin);
  }

  // Chrome exhaust pipe curving back to rear right muffler
  addFrameTube(
    [
      new THREE.Vector3(-0.14, 0.46, 0.14),
      new THREE.Vector3(-0.24, 0.42, -0.10),
      new THREE.Vector3(-0.25, 0.48, -0.48),
      new THREE.Vector3(-0.24, 0.49, -0.70),
    ],
    0.022,
    chromeMat
  );
  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.30, 14), steelFrameMat);
  muffler.rotation.x = Math.PI / 2;
  muffler.position.set(-0.24, 0.49, -0.74);
  muffler.castShadow = true;
  bikeGroup.add(muffler);
  const exhaustTip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 12), chromeMat);
  exhaustTip.rotation.x = Math.PI / 2;
  exhaustTip.position.set(-0.24, 0.49, -0.90);
  bikeGroup.add(exhaustTip);

  // Rugged Side Footboards / Floorboards (where the tiger's hind feet rest!)
  for (const s of [-1, 1]) {
    const footboard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.54), ruggedTrimMat);
    footboard.position.set(s * 0.29, 0.28, 0.02);
    footboard.castShadow = true;
    footboard.receiveShadow = true;
    bikeGroup.add(footboard);

    // Outer nerf-bar foot rail
    addFrameTube(
      [
        new THREE.Vector3(s * 0.41, 0.30, 0.28),
        new THREE.Vector3(s * 0.41, 0.30, -0.24),
      ],
      0.014,
      steelFrameMat
    );
  }

  // --- Sculpted Coastal Teal ATV Bodywork & Fenders ---
  // Main upper body chassis cowling
  const centerBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 1.38), bodyTealMat);
  centerBody.position.set(0, 0.59, 0.02);
  centerBody.castShadow = true;
  centerBody.receiveShadow = true;
  bikeGroup.add(centerBody);

  // Contoured front nose hood sloping forward
  const frontNose = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.44), bodyTealMat);
  frontNose.position.set(0, 0.62, 0.64);
  frontNose.rotation.x = 0.18;
  frontNose.castShadow = true;
  bikeGroup.add(frontNose);

  // Cream racing nose stripe accent
  const noseAccent = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.42), creamAccentMat);
  noseAccent.position.set(0, 0.70, 0.63);
  noseAccent.rotation.x = 0.18;
  bikeGroup.add(noseAccent);

  // Sculpted Front & Rear Wheel Fenders + Black Fender Flares
  for (const s of [-1, 1]) {
    // Front fender deck over front tire
    const fFender = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.52), bodyTealMat);
    fFender.position.set(s * 0.38, 0.64, FRONT_Z);
    fFender.rotation.z = -s * 0.12;
    fFender.castShadow = true;
    bikeGroup.add(fFender);

    // Front fender flare lip
    const fFlare = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.54), ruggedTrimMat);
    fFlare.position.set(s * 0.55, 0.61, FRONT_Z);
    fFlare.rotation.z = -s * 0.45;
    bikeGroup.add(fFlare);

    // Rear fender deck over rear tire
    const rFender = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.048, 0.58), bodyTealMat);
    rFender.position.set(s * 0.38, 0.64, REAR_Z - 0.04);
    rFender.rotation.z = -s * 0.10;
    rFender.castShadow = true;
    bikeGroup.add(rFender);

    // Rear fender flare lip
    const rFlare = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.60), ruggedTrimMat);
    rFlare.position.set(s * 0.56, 0.61, REAR_Z - 0.04);
    rFlare.rotation.z = -s * 0.45;
    bikeGroup.add(rFlare);

    // Front & rear mudguard vertical shields connecting fenders down to footboard
    const fMudguard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.04), ruggedTrimMat);
    fMudguard.position.set(s * 0.34, 0.45, 0.31);
    fMudguard.rotation.x = -0.22;
    bikeGroup.add(fMudguard);

    const rMudguard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.04), ruggedTrimMat);
    rMudguard.position.set(s * 0.34, 0.45, -0.27);
    rMudguard.rotation.x = 0.2;
    bikeGroup.add(rMudguard);
  }

  // Sculpted Fuel Tank Hump & Chrome Fuel Cap
  const fuelTank = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), bodyTealMat);
  fuelTank.scale.set(1.05, 0.65, 1.35);
  fuelTank.position.set(0, 0.70, 0.17);
  fuelTank.castShadow = true;
  bikeGroup.add(fuelTank);

  const fuelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.025, 14), chromeMat);
  fuelCap.position.set(0, 0.81, 0.17);
  bikeGroup.add(fuelCap);

  // Rugged Front Steel Bull-Bar / Bumper
  addFrameTube(
    [
      new THREE.Vector3(-0.36, 0.46, 0.86),
      new THREE.Vector3(-0.34, 0.62, 0.90),
      new THREE.Vector3(0.34, 0.62, 0.90),
      new THREE.Vector3(0.36, 0.46, 0.86),
    ],
    0.018,
    ruggedTrimMat
  );
  addFrameTube(
    [
      new THREE.Vector3(-0.34, 0.48, 0.88),
      new THREE.Vector3(0.34, 0.48, 0.88),
    ],
    0.016,
    ruggedTrimMat
  );
  for (const s of [-1, 1]) {
    addFrameTube(
      [
        new THREE.Vector3(s * 0.18, 0.36, 0.74),
        new THREE.Vector3(s * 0.24, 0.48, 0.88),
      ],
      0.015,
      ruggedTrimMat
    );
  }

  // Twin Glowing ATV Headlights + Twilight Beam
  const headlightLensMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfde68a,
    emissiveIntensity: 0.4,
    roughness: 0.1,
  });
  for (const s of [-1, 1]) {
    const lampPod = new THREE.Group();
    lampPod.position.set(s * 0.19, 0.60, 0.84);
    bikeGroup.add(lampPod);

    const lampHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.048, 0.07, 16),
      brassMat
    );
    lampHousing.rotation.x = Math.PI / 2;
    lampPod.add(lampHousing);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.048, 16), headlightLensMat);
    lens.position.z = 0.036;
    lampPod.add(lens);
  }

  // Volumetric headlight cone & SpotLight (illuminates road at Twilight)
  const beamGeo = new THREE.ConeGeometry(1.45, 6.2, 24, 1, true);
  beamGeo.translate(0, -3.1, 0);
  beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const headlightBeam = new THREE.Mesh(beamGeo, beamMat);
  headlightBeam.position.set(0, 0.60, 0.88);
  bikeGroup.add(headlightBeam);

  const headlightSpot = new THREE.SpotLight(0xffe8a3, 0, 26, Math.PI / 4.5, 0.55, 1.35);
  headlightSpot.position.set(0, 0.62, 0.88);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -0.45, 7.5);
  bikeGroup.add(spotTarget);
  headlightSpot.target = spotTarget;
  bikeGroup.add(headlightSpot);

  // Twin Rear Taillights
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.48,
    roughness: 0.2,
  });
  for (const s of [-1, 1]) {
    const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.048, 0.03), taillightMat);
    tailLamp.position.set(s * 0.26, 0.58, -0.84);
    bikeGroup.add(tailLamp);
  }

  // Korean ATV License Plates ("제주" instead of numbers) — Rear primary + Front bumper plate
  const plateFaceMat = new THREE.MeshStandardMaterial({
    map: textures.licensePlate,
    roughness: 0.28,
    metalness: 0.18,
  });
  const plateEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4ee,
    roughness: 0.35,
    metalness: 0.45,
  });

  function buildLicensePlate(width: number, height: number, withLampHood = false): THREE.Group {
    const plateGroup = new THREE.Group();

    // Rugged matte-black backing frame / holder
    const holder = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.022, height + 0.02, 0.012),
      ruggedTrimMat
    );
    holder.castShadow = true;
    holder.receiveShadow = true;
    plateGroup.add(holder);

    // Embossed aluminum plate facing +Z (material index 4 = +Z face)
    const plateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.006),
      [
        plateEdgeMat,
        plateEdgeMat,
        plateEdgeMat,
        plateEdgeMat,
        plateFaceMat,
        plateEdgeMat,
      ]
    );
    plateMesh.position.z = 0.007;
    plateMesh.castShadow = true;
    plateGroup.add(plateMesh);

    // Optional small license plate illumination hood on top (rear plate)
    if (withLampHood) {
      const lampHood = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.018, 0.028),
        ruggedTrimMat
      );
      lampHood.position.set(0, height * 0.5 + 0.015, 0.012);
      plateGroup.add(lampHood);
    }

    return plateGroup;
  }

  // Rear Primary License Plate mounted centrally between twin taillights (facing -Z)
  const rearPlate = buildLicensePlate(0.33, 0.186, true);
  rearPlate.position.set(0, 0.515, -0.89);
  rearPlate.rotation.y = Math.PI; // +Z face points backward (-Z), readable left-to-right from behind
  rearPlate.rotation.x = -0.14; // Slight natural upward tilt toward rear/chase viewer
  bikeGroup.add(rearPlate);

  // Rear mounting bracket connecting plate holder up to the rear frame/rack
  const rearPlateBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.14, 0.014),
    steelFrameMat
  );
  rearPlateBracket.position.set(0, 0.585, -0.868);
  bikeGroup.add(rearPlateBracket);

  // Front Bumper License Plate mounted cleanly on the front steel bull-bar (facing +Z)
  const frontPlate = buildLicensePlate(0.27, 0.152, false);
  frontPlate.position.set(0, 0.545, 0.918);
  frontPlate.rotation.x = -0.06;
  bikeGroup.add(frontPlate);

  // Plush Contoured Leather ATV Bench Saddle
  const saddleGroup = new THREE.Group();
  saddleGroup.position.set(0, SEAT_Y, SEAT_Z);
  bikeGroup.add(saddleGroup);

  const saddleMain = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.28, 8, 16), leatherMat);
  saddleMain.rotation.x = Math.PI / 2;
  saddleMain.scale.set(1.38, 0.82, 1.0);
  saddleMain.castShadow = true;
  saddleGroup.add(saddleMain);

  // =========================================================================
  // 2. LARGE FRONT ATV RACK + BIG BASKET OVERFLOWING WITH HALLABONG (한라봉)
  // =========================================================================
  const FRONT_RACK_Y = 0.74;
  // Tubular black steel front ATV cargo rack
  addFrameTube(
    [
      new THREE.Vector3(-0.38, FRONT_RACK_Y, 0.45),
      new THREE.Vector3(0.38, FRONT_RACK_Y, 0.45),
      new THREE.Vector3(0.38, FRONT_RACK_Y, 0.88),
      new THREE.Vector3(-0.38, FRONT_RACK_Y, 0.88),
      new THREE.Vector3(-0.38, FRONT_RACK_Y, 0.45),
    ],
    0.013,
    ruggedTrimMat
  );
  // Front rack crossbars & support pillars down to front fenders
  for (const xBar of [-0.18, 0, 0.18]) {
    addFrameTube(
      [
        new THREE.Vector3(xBar, FRONT_RACK_Y, 0.45),
        new THREE.Vector3(xBar, FRONT_RACK_Y, 0.88),
      ],
      0.009,
      ruggedTrimMat
    );
  }
  for (const s of [-1, 1]) {
    addFrameTube(
      [
        new THREE.Vector3(s * 0.34, 0.63, 0.54),
        new THREE.Vector3(s * 0.34, FRONT_RACK_Y, 0.54),
      ],
      0.011,
      ruggedTrimMat
    );
    addFrameTube(
      [
        new THREE.Vector3(s * 0.34, 0.62, 0.82),
        new THREE.Vector3(s * 0.34, FRONT_RACK_Y, 0.82),
      ],
      0.011,
      ruggedTrimMat
    );
  }

  // BIG Woven Front Basket mounted on the front ATV rack
  const basketGroup = new THREE.Group();
  basketGroup.position.set(0, FRONT_RACK_Y + 0.135, 0.67);
  bikeGroup.add(basketGroup);

  const basketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.235, 0.25, 24, 1, false),
    wickerMat
  );
  basketBody.scale.set(1.22, 1.0, 0.78); // Wide generous Jeju harvest basket (~73cm x 47cm!)
  basketBody.castShadow = true;
  basketBody.receiveShadow = true;
  basketGroup.add(basketBody);

  // Dark woven interior shadow base so gaps between Hallabongs look deep and lush
  const basketInterior = new THREE.Mesh(
    new THREE.CylinderGeometry(0.285, 0.225, 0.23, 20),
    new THREE.MeshStandardMaterial({ color: 0x4a2f17, roughness: 0.95 })
  );
  basketInterior.scale.set(1.20, 1.0, 0.76);
  basketInterior.position.y = 0.004;
  basketGroup.add(basketInterior);

  // Thick braided basket top rim & mid structural band
  const basketRim = new THREE.Mesh(new THREE.TorusGeometry(0.302, 0.022, 10, 32), wickerMat);
  basketRim.rotation.x = Math.PI / 2;
  basketRim.scale.set(1.22, 0.78, 1.0);
  basketRim.position.y = 0.125;
  basketRim.castShadow = true;
  basketGroup.add(basketRim);

  const basketMidBand = new THREE.Mesh(new THREE.TorusGeometry(0.268, 0.012, 8, 28), leatherMat);
  basketMidBand.rotation.x = Math.PI / 2;
  basketMidBand.scale.set(1.22, 0.78, 1.0);
  basketMidBand.position.y = 0.0;
  basketGroup.add(basketMidBand);

  // Leather tie-down straps securing the big basket to the ATV front rack
  for (const sx of [-0.22, 0.22]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.06, 0.44), leatherMat);
    strap.position.set(sx, -0.115, 0);
    basketGroup.add(strap);
  }

  // Sculpted Plump Jeju Hallabong (한라봉) Lathe Profile with Iconic Protruding Top Knob
  const hallabongProfile = [
    new THREE.Vector2(0.0, -0.048),
    new THREE.Vector2(0.032, -0.046),
    new THREE.Vector2(0.055, -0.024),
    new THREE.Vector2(0.059, 0.006),
    new THREE.Vector2(0.046, 0.034),
    new THREE.Vector2(0.025, 0.048), // Iconic pinched neck
    new THREE.Vector2(0.029, 0.063), // Plump protruding Hallabong top knob!
    new THREE.Vector2(0.017, 0.075),
    new THREE.Vector2(0.0, 0.078),
  ];
  const hallabongGeo = new THREE.LatheGeometry(hallabongProfile, 16);
  const hallabongMats = [
    new THREE.MeshStandardMaterial({ color: 0xff7b14, roughness: 0.43, metalness: 0.02 }),
    new THREE.MeshStandardMaterial({ color: 0xf98c1f, roughness: 0.45, metalness: 0.02 }),
    new THREE.MeshStandardMaterial({ color: 0xff6e0c, roughness: 0.42, metalness: 0.02 }),
  ];
  const calyxMat = new THREE.MeshStandardMaterial({ color: 0x22543d, roughness: 0.65 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f855a, roughness: 0.46 });
  const stemGeo = new THREE.CylinderGeometry(0.005, 0.008, 0.016, 6);
  const leafGeo = new THREE.SphereGeometry(0.021, 8, 6);

  // Abundant 30-Hallabong overflowing pyramid packed into the big oval basket!
  const hallabongSpecs: {
    pos: [number, number, number];
    tilt: [number, number];
    scale: number;
    doubleLeaf?: boolean;
  }[] = [
    // Layer 1: Dense rim ring (14 Hallabongs packed right along the wide rim!)
    { pos: [0.275, 0.115, 0.0], tilt: [0.06, -0.26], scale: 1.0 },
    { pos: [-0.275, 0.115, 0.0], tilt: [-0.05, 0.26], scale: 1.02 },
    { pos: [0.235, 0.115, 0.098], tilt: [0.18, -0.22], scale: 0.96 },
    { pos: [-0.235, 0.115, 0.098], tilt: [0.16, 0.22], scale: 0.98 },
    { pos: [0.235, 0.115, -0.098], tilt: [-0.18, -0.22], scale: 0.97 },
    { pos: [-0.235, 0.115, -0.098], tilt: [-0.16, 0.22], scale: 0.95 },
    { pos: [0.145, 0.118, 0.148], tilt: [0.24, -0.14], scale: 0.98 },
    { pos: [-0.145, 0.118, 0.148], tilt: [0.22, 0.14], scale: 0.96 },
    { pos: [0.145, 0.118, -0.148], tilt: [-0.22, -0.14], scale: 0.97 },
    { pos: [-0.145, 0.118, -0.148], tilt: [-0.24, 0.14], scale: 0.99 },
    { pos: [0.048, 0.120, 0.165], tilt: [0.26, -0.04], scale: 1.0 },
    { pos: [-0.048, 0.120, 0.165], tilt: [0.25, 0.05], scale: 0.97 },
    { pos: [0.048, 0.120, -0.165], tilt: [-0.25, -0.05], scale: 0.98 },
    { pos: [-0.048, 0.120, -0.165], tilt: [-0.26, 0.04], scale: 0.96 },

    // Layer 2: Abundant upper mound layer (10 Hallabongs!)
    { pos: [0.185, 0.176, 0.0], tilt: [0.05, -0.22], scale: 1.0, doubleLeaf: true },
    { pos: [-0.185, 0.176, 0.0], tilt: [-0.04, 0.22], scale: 0.98, doubleLeaf: true },
    { pos: [0.125, 0.182, 0.082], tilt: [0.20, -0.16], scale: 0.97 },
    { pos: [-0.125, 0.182, 0.082], tilt: [0.18, 0.16], scale: 0.99 },
    { pos: [0.125, 0.182, -0.082], tilt: [-0.18, -0.16], scale: 0.96 },
    { pos: [-0.125, 0.182, -0.082], tilt: [-0.20, 0.16], scale: 0.98 },
    { pos: [0.0, 0.186, 0.105], tilt: [0.22, 0.02], scale: 1.02, doubleLeaf: true },
    { pos: [0.0, 0.186, -0.105], tilt: [-0.22, -0.02], scale: 1.0 },
    { pos: [0.075, 0.184, 0.012], tilt: [0.08, -0.1], scale: 0.98 },
    { pos: [-0.075, 0.184, -0.012], tilt: [-0.08, 0.1], scale: 0.99 },

    // Layer 3: Lush overflowing crown pyramid (6 Hallabongs piled high!)
    { pos: [0.092, 0.238, 0.032], tilt: [0.14, -0.16], scale: 0.97, doubleLeaf: true },
    { pos: [-0.092, 0.238, 0.032], tilt: [0.12, 0.16], scale: 0.98, doubleLeaf: true },
    { pos: [0.088, 0.236, -0.038], tilt: [-0.14, -0.14], scale: 0.96 },
    { pos: [-0.088, 0.236, -0.038], tilt: [-0.12, 0.14], scale: 0.97 },
    { pos: [0.0, 0.248, 0.044], tilt: [0.16, 0.0], scale: 1.03, doubleLeaf: true },
    { pos: [0.0, 0.268, -0.012], tilt: [-0.04, 0.04], scale: 1.08, doubleLeaf: true },
  ];

  hallabongSpecs.forEach((spec, idx) => {
    const hGroup = new THREE.Group();
    hGroup.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    hGroup.rotation.set(spec.tilt[0], idx * 1.15, spec.tilt[1]);
    hGroup.scale.setScalar(spec.scale);
    basketGroup.add(hGroup);

    const fruit = new THREE.Mesh(hallabongGeo, hallabongMats[idx % hallabongMats.length]);
    fruit.castShadow = true;
    fruit.receiveShadow = true;
    hGroup.add(fruit);

    // Calyx stem nub on top of the Hallabong knob
    const stem = new THREE.Mesh(stemGeo, calyxMat);
    stem.position.y = 0.080;
    hGroup.add(stem);

    // Lush Hallabong green leaf
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.scale.set(1.7, 0.24, 0.72);
    leaf.position.set(0.022, 0.077, 0.004);
    leaf.rotation.z = 0.34;
    hGroup.add(leaf);

    if (spec.doubleLeaf) {
      const leaf2 = new THREE.Mesh(leafGeo, leafMat);
      leaf2.scale.set(1.45, 0.24, 0.65);
      leaf2.position.set(-0.018, 0.076, -0.008);
      leaf2.rotation.z = -0.42;
      leaf2.rotation.y = 0.5;
      hGroup.add(leaf2);
    }
  });

  // =========================================================================
  // 3. REAR ATV RACK + LARGE JEJU TAEWAK (큰 태왁) & MANG-SARI NET
  // =========================================================================
  const REAR_RACK_Y = 0.72;
  addFrameTube(
    [
      new THREE.Vector3(-0.44, REAR_RACK_Y, -0.46),
      new THREE.Vector3(0.44, REAR_RACK_Y, -0.46),
      new THREE.Vector3(0.44, REAR_RACK_Y, -0.96),
      new THREE.Vector3(-0.44, REAR_RACK_Y, -0.96),
      new THREE.Vector3(-0.44, REAR_RACK_Y, -0.46),
    ],
    0.014,
    ruggedTrimMat
  );
  // Crossbars & vertical supports down to rear fenders
  for (const xBar of [-0.22, 0, 0.22]) {
    addFrameTube(
      [
        new THREE.Vector3(xBar, REAR_RACK_Y, -0.46),
        new THREE.Vector3(xBar, REAR_RACK_Y, -0.96),
      ],
      0.010,
      ruggedTrimMat
    );
  }
  for (const s of [-1, 1]) {
    addFrameTube(
      [
        new THREE.Vector3(s * 0.38, 0.63, -0.52),
        new THREE.Vector3(s * 0.38, REAR_RACK_Y, -0.52),
      ],
      0.012,
      ruggedTrimMat
    );
    addFrameTube(
      [
        new THREE.Vector3(s * 0.38, 0.62, -0.84),
        new THREE.Vector3(s * 0.38, REAR_RACK_Y, -0.84),
      ],
      0.012,
      ruggedTrimMat
    );
  }

  // MUCH LARGER Jeju Haenyeo Taewak (태왁) buoy prominently strapped on the rear ATV rack!
  const taewakGroup = new THREE.Group();
  taewakGroup.position.set(0, REAR_RACK_Y + 0.23, -0.74);
  bikeGroup.add(taewakGroup);

  const taewakOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xf05123, // Classic Jeju safety-orange Taewak float
    roughness: 0.34,
    metalness: 0.04,
  });
  const taewakCreamMat = new THREE.MeshStandardMaterial({
    color: 0xf7f1e3,
    roughness: 0.40,
    metalness: 0.02,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xd4b483,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Big oblate Taewak float (~59cm wide x 45cm tall!)
  const taewakBody = new THREE.Mesh(new THREE.SphereGeometry(0.265, 28, 22), taewakOrangeMat);
  taewakBody.scale.set(1.12, 0.84, 1.12);
  taewakBody.castShadow = true;
  taewakBody.receiveShadow = true;
  taewakGroup.add(taewakBody);

  // Cream equatorial stripe & top cap plug
  const taewakBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.284, 0.024, 10, 32),
    taewakCreamMat
  );
  taewakBand.rotation.x = Math.PI / 2;
  taewakGroup.add(taewakBand);

  const taewakPlug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.048, 0.055, 14),
    taewakCreamMat
  );
  taewakPlug.position.y = 0.22;
  taewakGroup.add(taewakPlug);

  // Rich woven hemp-rope netting cradle wrapping the large Taewak
  for (let r = 0; r < 6; r++) {
    const netRing = new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.009, 6, 30), ropeMat);
    netRing.scale.set(1.11, 0.86, 1.11);
    netRing.rotation.y = (r / 6) * Math.PI;
    taewakGroup.add(netRing);
  }
  const netCollarTop = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.011, 8, 24), ropeMat);
  netCollarTop.rotation.x = Math.PI / 2;
  netCollarTop.position.y = 0.175;
  taewakGroup.add(netCollarTop);

  const netCollarMid = new THREE.Mesh(new THREE.TorusGeometry(0.268, 0.009, 6, 28), ropeMat);
  netCollarMid.rotation.x = Math.PI / 2;
  netCollarMid.position.y = 0.085;
  taewakGroup.add(netCollarMid);

  // Sturdy tie-down straps anchoring the big Taewak firmly to the rear ATV rack
  for (const zOff of [-0.11, 0.11]) {
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.285, 0.011, 8, 28, Math.PI * 1.12),
      tireMat
    );
    strap.scale.set(1.06, 0.85, 1.0);
    strap.position.set(0, -0.02, zOff);
    strap.rotation.z = -Math.PI * 0.06;
    taewakGroup.add(strap);
  }

  // Larger Hanging Mang-sari (망사리) woven net bag with shells/conch on rear-left rack
  const mangsariGroup = new THREE.Group();
  mangsariGroup.position.set(0.32, -0.18, -0.04);
  mangsariGroup.rotation.z = 0.14;
  taewakGroup.add(mangsariGroup);

  const netBagMat = new THREE.MeshStandardMaterial({
    color: 0x3b6e5c,
    roughness: 0.85,
    wireframe: true,
  });
  const netBagInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0x264b3e,
      roughness: 0.9,
      transparent: true,
      opacity: 0.55,
    })
  );
  netBagInner.scale.set(0.88, 1.28, 0.95);
  mangsariGroup.add(netBagInner);

  const netBagMesh = new THREE.Mesh(new THREE.SphereGeometry(0.118, 12, 10), netBagMat);
  netBagMesh.scale.set(0.9, 1.3, 0.98);
  netBagMesh.castShadow = true;
  mangsariGroup.add(netBagMesh);

  // Sea shells / conch & abalone glimpsed inside the Mang-sari net
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 });
  for (const [sx, sy, sz] of [
    [0.022, -0.03, 0.028],
    [-0.024, 0.025, -0.015],
    [0.01, -0.06, -0.02],
  ]) {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), shellMat);
    shell.scale.set(1.25, 0.68, 1.0);
    shell.position.set(sx, sy, sz);
    mangsariGroup.add(shell);
  }

  // Thick rope tether connecting Mang-sari to the Taewak
  const tetherMesh = new THREE.Mesh(
    createTubeBetween(
      [
        new THREE.Vector3(0.20, -0.08, -0.04),
        new THREE.Vector3(0.30, -0.06, -0.04),
        new THREE.Vector3(0.32, -0.09, -0.04),
      ],
      0.011,
      8
    ),
    ropeMat
  );
  taewakGroup.add(tetherMesh);

  // =========================================================================
  // 4. STEERING COLUMN & WIDE ATV HANDLEBARS
  // =========================================================================
  const steerAxisTilt = new THREE.Group();
  steerAxisTilt.position.copy(HEAD_TOP);
  steerAxisTilt.rotation.x = -0.26;
  bikeGroup.add(steerAxisTilt);

  const steerGroup = new THREE.Group();
  steerAxisTilt.add(steerGroup);

  // Chrome steering shaft & handlebar clamp
  const stemPost = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.22, 12), chromeMat);
  stemPost.position.set(0, 0.06, 0);
  steerGroup.add(stemPost);

  // Round speedometer instrument dial on steering column
  const dashPod = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.036, 16), ruggedTrimMat);
  dashPod.rotation.x = 0.65;
  dashPod.position.set(0, 0.145, 0.055);
  steerGroup.add(dashPod);
  const dashFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.044, 16),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 })
  );
  dashFace.rotation.x = -Math.PI / 2 + 0.65;
  dashFace.position.set(0, 0.16, 0.067);
  steerGroup.add(dashFace);

  // Wide ATV Handlebars + protective crossbar pad
  const handlebarPts = [
    new THREE.Vector3(-0.32, 0.17, -0.08),
    new THREE.Vector3(-0.22, 0.18, 0.01),
    new THREE.Vector3(0, 0.165, 0.025),
    new THREE.Vector3(0.22, 0.18, 0.01),
    new THREE.Vector3(0.32, 0.17, -0.08),
  ];
  const handlebarMesh = new THREE.Mesh(
    createTubeBetween(handlebarPts, 0.014, 12),
    chromeMat
  );
  handlebarMesh.castShadow = true;
  steerGroup.add(handlebarMesh);

  const crossbarPad = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 12), ruggedTrimMat);
  crossbarPad.rotation.z = Math.PI / 2;
  crossbarPad.position.set(0, 0.18, 0.015);
  steerGroup.add(crossbarPad);

  // Left & Right Leather Grips + Brake Levers + IK Grip Anchors
  const leftGripAnchor = new THREE.Object3D();
  leftGripAnchor.position.set(0.295, 0.172, -0.065);
  steerGroup.add(leftGripAnchor);

  const rightGripAnchor = new THREE.Object3D();
  rightGripAnchor.position.set(-0.295, 0.172, -0.065);
  steerGroup.add(rightGripAnchor);

  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.115, 12), leatherMat);
    grip.position.set(s * 0.29, 0.174, -0.055);
    grip.rotation.x = Math.PI / 2;
    grip.rotation.z = s * 0.55;
    steerGroup.add(grip);

    // Chrome brake lever
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.01, 0.014), chromeMat);
    lever.position.set(s * 0.26, 0.168, 0.012);
    lever.rotation.y = -s * 0.35;
    steerGroup.add(lever);
  }

  // Cheerful Brass Horn/Bell on right handlebar
  const bellGroup = new THREE.Group();
  bellGroup.position.set(-0.18, 0.20, 0.015);
  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.027, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    brassMat
  );
  bellGroup.add(bellDome);
  const bellThumb = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.022), chromeMat);
  bellThumb.position.set(0.026, 0.006, 0);
  bellGroup.add(bellThumb);
  steerGroup.add(bellGroup);

  // =========================================================================
  // 5. CUTE KOREAN TIGER (Horangi) IN JEJU HAENYEO WETSUIT — BIG EYES!
  // =========================================================================
  const furMat = new THREE.MeshStandardMaterial({
    map: textures.tigerFur,
    roughness: 0.78,
    metalness: 0.02,
  });
  const headFurMat = new THREE.MeshStandardMaterial({
    map: textures.tigerHead,
    roughness: 0.74,
    metalness: 0.02,
  });
  const tailFurMat = new THREE.MeshStandardMaterial({
    map: textures.tigerTail,
    roughness: 0.76,
    metalness: 0.02,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xfff5e4,
    roughness: 0.82,
    metalness: 0.0,
  });
  const darkStripeMat = new THREE.MeshStandardMaterial({
    color: 0x1c1512,
    roughness: 0.7,
  });
  const pinkNoseMat = new THREE.MeshStandardMaterial({
    color: 0xf47286,
    roughness: 0.42,
  });
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    roughness: 0.75,
    transparent: true,
    opacity: 0.55,
  });
  const scarfMainMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, // Crisp white Jeju Haenyeo Mul-sugeon neckerchief
    roughness: 0.85,
  });
  const scarfStripeMat = new THREE.MeshStandardMaterial({
    color: 0x1e40af, // Deep cobalt-indigo coastal trim
    roughness: 0.85,
  });
  const wetsuitMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e24, // Classic black Haenyeo neoprene rubber wetsuit
    roughness: 0.48,
    metalness: 0.08,
  });
  const wetsuitTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // High-visibility golden-amber Haenyeo safety trim
    roughness: 0.38,
    metalness: 0.06,
  });
  const leadWeightMat = new THREE.MeshStandardMaterial({
    color: 0x64748b, // Brushed lead weight belt blocks
    roughness: 0.42,
    metalness: 0.78,
  });
  const goggleLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x67e8f9,
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.72,
  });

  const tigerGroup = new THREE.Group();
  bikeGroup.add(tigerGroup);

  // Pelvis anchor on the contoured ATV saddle
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, SEAT_Y + 0.11, SEAT_Z);
  tigerGroup.add(pelvisGroup);

  const pelvisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.168, 20, 16), wetsuitMat);
  pelvisMesh.scale.set(1.06, 0.92, 1.05);
  pelvisMesh.castShadow = true;
  pelvisGroup.add(pelvisMesh);

  // Torso leaning naturally toward the wide ATV handlebars
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.06, 0.02);
  torsoGroup.rotation.x = 0.25;
  pelvisGroup.add(torsoGroup);

  const torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.158, 0.21, 12, 20), wetsuitMat);
  torsoMesh.position.set(0, 0.17, 0);
  torsoMesh.scale.set(1.05, 1.0, 0.94);
  torsoMesh.castShadow = true;
  torsoGroup.add(torsoMesh);

  // Front wetsuit zipper seam + silver zipper pull
  const zipperTrack = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.26, 0.014), wetsuitTrimMat);
  zipperTrack.position.set(0, 0.17, 0.145);
  torsoGroup.add(zipperTrack);

  const zipperPull = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.018), chromeMat);
  zipperPull.position.set(0, 0.28, 0.153);
  torsoGroup.add(zipperPull);

  // Golden-amber Haenyeo safety side stripes on torso
  for (const s of [-1, 1]) {
    const sideStripe = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, 0.21, 6, 8),
      wetsuitTrimMat
    );
    sideStripe.position.set(s * 0.156, 0.17, 0.01);
    torsoGroup.add(sideStripe);
  }

  // Haenyeo Lead Weight Belt (납벨트) around waist
  const weightBelt = new THREE.Mesh(
    new THREE.TorusGeometry(0.154, 0.017, 8, 24),
    wetsuitTrimMat
  );
  weightBelt.rotation.x = Math.PI / 2;
  weightBelt.position.set(0, 0.055, 0);
  torsoGroup.add(weightBelt);

  for (const ang of [-0.55, 0.55, 2.45, -2.45]) {
    const weightBlock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.042, 0.032), leadWeightMat);
    weightBlock.position.set(Math.sin(ang) * 0.16, 0.055, Math.cos(ang) * 0.152);
    weightBlock.rotation.y = ang;
    weightBlock.castShadow = true;
    torsoGroup.add(weightBlock);
  }

  // Wetsuit neck seal + fluttering Jeju Haenyeo Mul-sugeon neckerchief
  const neckSeal = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.026, 10, 24), wetsuitMat);
  neckSeal.rotation.x = Math.PI / 2 - 0.18;
  neckSeal.position.set(0, 0.325, 0.01);
  torsoGroup.add(neckSeal);

  const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.02, 10, 24), scarfMainMat);
  scarfCollar.rotation.x = Math.PI / 2 - 0.18;
  scarfCollar.position.set(0, 0.34, 0.01);
  scarfCollar.castShadow = true;
  torsoGroup.add(scarfCollar);

  const scarfTails: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const tailGeo = new THREE.BoxGeometry(0.052, 0.012, 0.21);
    tailGeo.translate(0, 0, -0.105);
    const mat = i === 0 ? scarfMainMat : scarfStripeMat;
    const sTail = new THREE.Mesh(tailGeo, mat);
    sTail.position.set(i === 0 ? -0.045 : 0.005, 0.34, -0.10);
    sTail.rotation.y = i === 0 ? 0.18 : -0.12;
    sTail.castShadow = true;
    torsoGroup.add(sTail);
    scarfTails.push(sTail);
  }

  // Cute Tiger Head
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.43, 0.04);
  headPivot.rotation.x = -0.2;
  torsoGroup.add(headPivot);

  const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.225, 28, 24), headFurMat);
  headSphere.scale.set(1.12, 0.96, 1.02);
  headSphere.rotation.y = -Math.PI / 2;
  headSphere.castShadow = true;
  headPivot.add(headSphere);

  // Fluffy cheek tufts on left & right
  for (const s of [-1, 1]) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.11, 8), furMat);
    tuft.position.set(s * 0.23, -0.04, 0.01);
    tuft.rotation.z = -s * 1.35;
    headPivot.add(tuft);
  }

  // Cream Muzzle Pads + Rosy Cheeks + Chin
  for (const s of [-1, 1]) {
    const muzzlePad = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 14), creamMat);
    muzzlePad.scale.set(1.08, 0.9, 0.95);
    muzzlePad.position.set(s * 0.046, -0.055, 0.195);
    headPivot.add(muzzlePad);

    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), blushMat);
    blush.scale.set(1.2, 0.75, 0.45);
    blush.position.set(s * 0.138, -0.05, 0.165);
    blush.rotation.y = s * 0.55;
    headPivot.add(blush);
  }
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 12), creamMat);
  chin.scale.set(1.15, 0.72, 0.9);
  chin.position.set(0, -0.105, 0.175);
  headPivot.add(chin);

  // Pink Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 12), pinkNoseMat);
  nose.scale.set(1.25, 0.85, 0.85);
  nose.position.set(0, -0.02, 0.238);
  headPivot.add(nose);

  // Cute Whiskers (3 per side)
  for (const s of [-1, 1]) {
    for (let w = -1; w <= 1; w++) {
      const whisker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0025, 0.0015, 0.12, 5),
        darkStripeMat
      );
      whisker.rotation.z = Math.PI / 2 + w * 0.14 * s;
      whisker.rotation.y = -s * 0.2;
      whisker.position.set(s * 0.11, -0.055 + w * 0.015, 0.205);
      headPivot.add(whisker);
    }
  }

  // Big Expressive Eyes + Dual Catchlights + Blinking Eyelids + Happy Crescent Eyes
  const openEyes: THREE.Group[] = [];
  const happyEyes: THREE.Mesh[] = [];
  const eyelids: THREE.Mesh[] = [];

  for (const s of [-1, 1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(s * 0.094, 0.036, 0.192);
    eyeGroup.rotation.y = s * 0.26;
    headPivot.add(eyeGroup);
    openEyes.push(eyeGroup);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.054, 18, 14), creamMat);
    sclera.scale.set(1.02, 1.12, 0.56);
    eyeGroup.add(sclera);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.038, 18, 14), darkStripeMat);
    pupil.scale.set(1, 1.14, 0.65);
    pupil.position.set(0, 0, 0.017);
    eyeGroup.add(pupil);

    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), catchlightMat);
    catchlight.position.set(0.014, 0.016, 0.034);
    eyeGroup.add(catchlight);

    const catchlightSmall = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 8), catchlightMat);
    catchlightSmall.position.set(-0.012, -0.012, 0.034);
    eyeGroup.add(catchlightSmall);

    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      furMat
    );
    lid.scale.set(1.05, 1.12, 0.72);
    lid.rotation.x = -Math.PI * 0.55;
    eyeGroup.add(lid);
    eyelids.push(lid);

    const arcGeo = new THREE.TorusGeometry(0.041, 0.009, 8, 16, Math.PI);
    const arc = new THREE.Mesh(arcGeo, darkStripeMat);
    arc.position.set(s * 0.094, 0.028, 0.212);
    arc.rotation.y = s * 0.26;
    arc.visible = false;
    headPivot.add(arc);
    happyEyes.push(arc);
  }

  // Round Tiger Ears
  const ears: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.165, 0.165, -0.01);
    ear.rotation.z = -s * 0.42;
    ear.rotation.x = 0.15;
    headPivot.add(ear);
    ears.push(ear);

    const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 12), darkStripeMat);
    earOuter.scale.set(1.05, 1.05, 0.55);
    earOuter.castShadow = true;
    ear.add(earOuter);

    const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), creamMat);
    earInner.scale.set(1, 1, 0.5);
    earInner.position.set(0, -0.005, 0.022);
    ear.add(earInner);
  }

  // Vintage Jeju Haenyeo Round Diving Goggles (물안경) pushed onto brow
  const gogglesGroup = new THREE.Group();
  gogglesGroup.position.set(0, 0.145, 0.158);
  gogglesGroup.rotation.x = -0.62;
  headPivot.add(gogglesGroup);

  const goggleStrap = new THREE.Mesh(
    new THREE.TorusGeometry(0.224, 0.013, 8, 28),
    wetsuitMat
  );
  goggleStrap.rotation.x = Math.PI / 2;
  goggleStrap.position.set(0, -0.02, -0.155);
  goggleStrap.scale.set(1.11, 1.0, 0.94);
  gogglesGroup.add(goggleStrap);

  const goggleBridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.016), brassMat);
  goggleBridge.position.set(0, 0, 0.025);
  gogglesGroup.add(goggleBridge);

  for (const s of [-1, 1]) {
    const lensCup = new THREE.Group();
    lensCup.position.set(s * 0.068, 0, 0.02);
    lensCup.rotation.y = s * 0.2;
    gogglesGroup.add(lensCup);

    const rubberRim = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.011, 10, 20), wetsuitMat);
    lensCup.add(rubberRim);

    const brassRim = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.005, 8, 20), brassMat);
    brassRim.position.z = 0.008;
    lensCup.add(brassRim);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.039, 18), goggleLensMat);
    lens.position.z = 0.006;
    lensCup.add(lens);
  }

  // Articulated 6-Segment Swaying Tail (arched high & clear over the large rear Taewak!)
  const tailSegments: THREE.Group[] = [];
  let tailParent: THREE.Object3D = pelvisGroup;
  for (let i = 0; i < 6; i++) {
    const segGroup = new THREE.Group();
    if (i === 0) {
      segGroup.position.set(0, 0.07, -0.15);
      segGroup.rotation.x = -0.88; // Arch cleanly above the bigger Taewak
    } else {
      segGroup.position.set(0, 0, -0.095);
    }
    tailParent.add(segGroup);

    const r = 0.044 - i * 0.004;
    const segGeo = new THREE.CapsuleGeometry(r, 0.085, 6, 12);
    segGeo.rotateX(Math.PI / 2);
    segGeo.translate(0, 0, -0.048);
    const mat = i % 2 === 1 ? darkStripeMat : tailFurMat;
    const segMesh = new THREE.Mesh(segGeo, mat);
    segMesh.castShadow = true;
    segGroup.add(segMesh);

    tailSegments.push(segGroup);
    tailParent = segGroup;
  }

  // =========================================================================
  // 6. IK LIMB BUILDERS (Hind Legs Planted on ATV Footboards + Front Arms Steering)
  // =========================================================================
  const THIGH_LEN = 0.34;
  const SHIN_LEN = 0.33;
  const UPPER_ARM_LEN = 0.24;
  const FOREARM_LEN = 0.24;

  function buildLegLimb() {
    const upper = new THREE.Group();
    const lower = new THREE.Group();
    tigerGroup.add(upper, lower);

    const thighMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.07, THIGH_LEN - 0.08, 8, 14),
      wetsuitMat
    );
    thighMesh.position.y = -THIGH_LEN * 0.5;
    thighMesh.castShadow = true;
    upper.add(thighMesh);

    const shinMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, SHIN_LEN - 0.08, 8, 14),
      wetsuitMat
    );
    shinMesh.position.y = -SHIN_LEN * 0.48;
    shinMesh.castShadow = true;
    lower.add(shinMesh);

    const ankleCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.054, 0.054, 0.025, 14),
      wetsuitTrimMat
    );
    ankleCuff.position.y = -SHIN_LEN + 0.045;
    lower.add(ankleCuff);

    const footGroup = new THREE.Group();
    tigerGroup.add(footGroup);
    const footMesh = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), creamMat);
    footMesh.scale.set(0.98, 0.62, 1.45);
    footMesh.position.set(0, 0.028, 0.025);
    footMesh.castShadow = true;
    footGroup.add(footMesh);

    return { upper, lower, footGroup };
  }

  function buildArmLimb() {
    const upper = new THREE.Group();
    const lower = new THREE.Group();
    tigerGroup.add(upper, lower);

    const uArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.052, UPPER_ARM_LEN - 0.06, 8, 12),
      wetsuitMat
    );
    uArm.position.y = -UPPER_ARM_LEN * 0.5;
    uArm.castShadow = true;
    upper.add(uArm);

    const fArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.046, FOREARM_LEN - 0.06, 8, 12),
      wetsuitMat
    );
    fArm.position.y = -FOREARM_LEN * 0.48;
    fArm.castShadow = true;
    lower.add(fArm);

    const wristCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.022, 12),
      wetsuitTrimMat
    );
    wristCuff.position.y = -FOREARM_LEN + 0.035;
    lower.add(wristCuff);

    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), creamMat);
    paw.scale.set(1.0, 0.85, 1.12);
    paw.position.y = -FOREARM_LEN;
    paw.castShadow = true;
    lower.add(paw);

    return { upper, lower };
  }

  const leftLeg = buildLegLimb();
  const rightLeg = buildLegLimb();
  const leftArm = buildArmLimb();
  const rightArm = buildArmLimb();

  // Hip & shoulder local anchors
  const leftHipAnchor = new THREE.Object3D();
  leftHipAnchor.position.set(0.14, -0.02, 0.01);
  pelvisGroup.add(leftHipAnchor);

  const rightHipAnchor = new THREE.Object3D();
  rightHipAnchor.position.set(-0.14, -0.02, 0.01);
  pelvisGroup.add(rightHipAnchor);

  const leftShoulderAnchor = new THREE.Object3D();
  leftShoulderAnchor.position.set(0.155, 0.27, 0.03);
  torsoGroup.add(leftShoulderAnchor);

  const rightShoulderAnchor = new THREE.Object3D();
  rightShoulderAnchor.position.set(-0.155, 0.27, 0.03);
  torsoGroup.add(rightShoulderAnchor);

  // =========================================================================
  // 7. ANIMATION STATE & PER-FRAME UPDATE
  // =========================================================================
  let wheelAngle = 0;
  let blinkTimer = 2.6;
  let blinkAmount = 0;

  const hipL = new THREE.Vector3();
  const hipR = new THREE.Vector3();
  const shL = new THREE.Vector3();
  const shR = new THREE.Vector3();
  const footTargetL = new THREE.Vector3(0.28, 0.305, 0.05);
  const footTargetR = new THREE.Vector3(-0.28, 0.305, 0.05);
  const poleKneeL = new THREE.Vector3(0.45, 0.22, 0.95);
  const poleKneeR = new THREE.Vector3(-0.45, 0.22, 0.95);
  const poleElbowL = new THREE.Vector3(0.55, -0.35, -0.85);
  const poleElbowR = new THREE.Vector3(-0.55, -0.35, -0.85);

  function update({
    dt,
    elapsed,
    distanceDelta,
    speed,
    steerAngle,
    leanAngle,
    bellActive,
    isTwilight,
  }: {
    dt: number;
    elapsed: number;
    distanceDelta: number;
    speed: number;
    steerAngle: number;
    leanAngle: number;
    bellActive: number;
    isTwilight: boolean;
  }) {
    // 1. Synchronize all 4 ATV wheels with road travel distance
    const dWheel = distanceDelta / WHEEL_RADIUS;
    wheelAngle += dWheel;

    frontLeftWheel.rotation.x = wheelAngle;
    frontRightWheel.rotation.x = wheelAngle;
    rearLeftWheel.rotation.x = wheelAngle;
    rearRightWheel.rotation.x = wheelAngle;

    // 2. Steer both front wheel knuckles & handlebars together
    frontLeftSteer.rotation.y = steerAngle;
    frontRightSteer.rotation.y = steerAngle;
    steerGroup.rotation.y = steerAngle;

    // 3. Natural 4-wheel ATV suspension bounce, engine thrum & subtle corner roll
    const speedFactor = Math.min(1, speed / 4.0);
    const roadBounce =
      Math.sin(elapsed * (6.5 + speed * 1.1)) * 0.011 * speedFactor +
      Math.sin(elapsed * 26.0) * 0.0022; // subtle idling engine thrum!
    sprungPivot.position.y = 0.32 + roadBounce;
    // Outward body roll on a 4-wheeler is subtle & opposite to bicycle inward lean
    sprungPivot.rotation.z = -leanAngle * 0.28;
    sprungPivot.rotation.x = Math.sin(elapsed * 4.2) * 0.008 * speedFactor;

    // 4. Tiger joyful cruising posture, leaning slightly into curves!
    pelvisGroup.position.y = SEAT_Y + 0.11 + Math.sin(elapsed * 6.5) * 0.006 * speedFactor;
    pelvisGroup.rotation.z = leanAngle * 0.35;
    torsoGroup.rotation.z = leanAngle * 0.25;
    torsoGroup.rotation.x = 0.25 + Math.sin(elapsed * 5.2) * 0.018 * speedFactor;

    // Head looks into steering direction + cute horn/bell bounce
    const bellBounce = bellActive > 0 ? Math.sin(bellActive * Math.PI * 4) * 0.08 * bellActive : 0;
    headPivot.rotation.y = steerAngle * 0.62;
    headPivot.rotation.x = -0.2 + Math.sin(elapsed * 2.4) * 0.032 - bellBounce;
    headPivot.rotation.z = -leanAngle * 0.35;

    // Cute ear twitch & bell perk
    ears[0].rotation.z = 0.42 + Math.sin(elapsed * 3.1) * 0.06 + bellActive * 0.2;
    ears[1].rotation.z = -0.42 - Math.cos(elapsed * 2.7) * 0.06 - bellActive * 0.2;

    // Blinking & happy crescent expression when bell/horn rings
    if (bellActive > 0.15) {
      openEyes.forEach((e) => (e.visible = false));
      happyEyes.forEach((h) => (h.visible = true));
    } else {
      openEyes.forEach((e) => (e.visible = true));
      happyEyes.forEach((h) => (h.visible = false));
      blinkTimer -= dt;
      if (blinkTimer <= 0) {
        blinkTimer = 2.4 + Math.random() * 2.6;
      }
      blinkAmount = blinkTimer < 0.14 ? Math.sin((blinkTimer / 0.14) * Math.PI) : 0;
      eyelids.forEach((lid) => {
        lid.rotation.x = -Math.PI * 0.55 + blinkAmount * 1.15;
      });
    }

    // 5. Tail natural traveling wave sway (raised proudly above the big Taewak!)
    const tailWaveSpeed = 3.2 + speed * 0.32;
    for (let i = 0; i < tailSegments.length; i++) {
      const seg = tailSegments[i];
      const phase = elapsed * tailWaveSpeed - i * 0.56;
      seg.rotation.y = Math.sin(phase) * (0.15 + i * 0.028);
      seg.rotation.x = (i === 0 ? -0.84 : 0.14) + Math.cos(phase * 0.85) * 0.05;
    }

    // 6. Haenyeo neckerchief fluttering in coastal breeze
    const windAmp = 0.13 + speed * 0.042;
    scarfTails[0].rotation.x = -0.15 + Math.sin(elapsed * (7.5 + speed * 1.3)) * windAmp;
    scarfTails[0].rotation.y = 0.22 + Math.cos(elapsed * (5.8 + speed)) * windAmp * 0.7;
    scarfTails[1].rotation.x = -0.18 + Math.sin(elapsed * (8.5 + speed * 1.3) + 1.1) * windAmp;
    scarfTails[1].rotation.y = -0.14 + Math.sin(elapsed * (6.3 + speed) + 0.7) * windAmp * 0.7;

    // 7. Update World Matrices on bikeGroup before querying IK anchor positions
    bikeGroup.updateMatrixWorld(true);

    const toBikeLocal = (obj: THREE.Object3D, out: THREE.Vector3) => {
      obj.getWorldPosition(_gripWorld);
      bikeGroup.worldToLocal(_gripWorld);
      out.copy(_gripWorld);
    };

    // Hind legs planted firmly on ATV footboards
    toBikeLocal(leftHipAnchor, hipL);
    toBikeLocal(rightHipAnchor, hipR);

    solveAndPlaceTwoBoneIK(
      hipL,
      footTargetL,
      poleKneeL,
      THIGH_LEN,
      SHIN_LEN,
      leftLeg.upper,
      leftLeg.lower
    );
    solveAndPlaceTwoBoneIK(
      hipR,
      footTargetR,
      poleKneeR,
      THIGH_LEN,
      SHIN_LEN,
      rightLeg.upper,
      rightLeg.lower
    );
    leftLeg.footGroup.position.copy(footTargetL);
    rightLeg.footGroup.position.copy(footTargetR);

    // Front paws gripping & steering the wide ATV handlebars
    toBikeLocal(leftGripAnchor, _gripLocal);
    toBikeLocal(rightGripAnchor, _v3);
    toBikeLocal(leftShoulderAnchor, shL);
    toBikeLocal(rightShoulderAnchor, shR);

    solveAndPlaceTwoBoneIK(
      shL,
      _gripLocal,
      poleElbowL,
      UPPER_ARM_LEN,
      FOREARM_LEN,
      leftArm.upper,
      leftArm.lower
    );
    solveAndPlaceTwoBoneIK(
      shR,
      _v3,
      poleElbowR,
      UPPER_ARM_LEN,
      FOREARM_LEN,
      rightArm.upper,
      rightArm.lower
    );

    // 8. Twilight Twin Headlights & Taillights Glow
    const beamMatRef = headlightBeam.material as THREE.MeshBasicMaterial;
    const targetGlow = isTwilight ? 1 : 0;
    beamMatRef.opacity = THREE.MathUtils.lerp(beamMatRef.opacity, targetGlow * 0.17, 0.08);
    headlightSpot.intensity = THREE.MathUtils.lerp(headlightSpot.intensity, targetGlow * 22, 0.08);
    headlightLensMat.emissiveIntensity = isTwilight ? 2.6 : 0.45;
    taillightMat.emissiveIntensity = isTwilight ? 2.4 : 0.48;
  }

  return {
    root,
    contactShadow,
    headlightBeam,
    headlightSpot,
    headlightLensMat,
    taillightMat,
    update,
  };
}
