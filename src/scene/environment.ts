import * as THREE from 'three';
import { CoastalTrack } from './track';
import { SceneTextures } from './textures';

export type TimeOfDay = 'morning' | 'golden' | 'twilight';

export interface LightingPreset {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  sunPos: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  waterColor: THREE.Color;
  exposure: number;
  lanternEmissive: number;
}

export const LIGHTING_PRESETS: Record<TimeOfDay, LightingPreset> = {
  morning: {
    skyTop: new THREE.Color(0x3a8ee6),
    skyHorizon: new THREE.Color(0xc7e8f9),
    fogColor: new THREE.Color(0xc3e4f5),
    fogDensity: 0.0046,
    sunColor: new THREE.Color(0xfff4dc),
    sunIntensity: 2.6,
    sunPos: new THREE.Vector3(48, 44, -32),
    hemiSky: new THREE.Color(0x9bd3ff),
    hemiGround: new THREE.Color(0x4a6b48),
    hemiIntensity: 1.05,
    rimColor: new THREE.Color(0xbae6fd),
    rimIntensity: 0.8,
    waterColor: new THREE.Color(0x0c6b8a),
    exposure: 1.08,
    lanternEmissive: 0.0,
  },
  golden: {
    skyTop: new THREE.Color(0x3b4d82),
    skyHorizon: new THREE.Color(0xf9b27a),
    fogColor: new THREE.Color(0xf3b484),
    fogDensity: 0.0052,
    sunColor: new THREE.Color(0xffb454),
    sunIntensity: 3.1,
    sunPos: new THREE.Vector3(62, 16, 26),
    hemiSky: new THREE.Color(0xfca572),
    hemiGround: new THREE.Color(0x47384d),
    hemiIntensity: 0.9,
    rimColor: new THREE.Color(0xfde68a),
    rimIntensity: 1.1,
    waterColor: new THREE.Color(0x16536b),
    exposure: 1.05,
    lanternEmissive: 0.65,
  },
  twilight: {
    skyTop: new THREE.Color(0x0d152e),
    skyHorizon: new THREE.Color(0x33416e),
    fogColor: new THREE.Color(0x212c4d),
    fogDensity: 0.0058,
    sunColor: new THREE.Color(0x9cb8ff),
    sunIntensity: 1.15,
    sunPos: new THREE.Vector3(-42, 34, -38),
    hemiSky: new THREE.Color(0x526ba3),
    hemiGround: new THREE.Color(0x1b2636),
    hemiIntensity: 0.72,
    rimColor: new THREE.Color(0x93c5fd),
    rimIntensity: 0.85,
    waterColor: new THREE.Color(0x0b2c44),
    exposure: 1.05,
    lanternEmissive: 2.2,
  },
};

export interface CoastalEnvironment {
  group: THREE.Group;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
  applyTimeOfDay: (mode: TimeOfDay, dt: number, renderer: THREE.WebGLRenderer) => void;
  update: (dt: number, elapsed: number, focusPos: THREE.Vector3) => void;
}

interface Seagull {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  centerX: number;
  centerZ: number;
  radius: number;
  baseY: number;
  speed: number;
  phase: number;
}

interface DolphinSplash {
  group: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  crown: THREE.Mesh;
  crownMat: THREE.MeshBasicMaterial;
}

interface JumpingDolphin {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  tailPivot: THREE.Group;
  baseX: number;
  baseZ: number;
  dirX: number;
  dirZ: number;
  yaw: number;
  jumpSpan: number;
  jumpHeight: number;
  period: number;
  breachDuty: number;
  phase: number;
  rollAmp: number;
  exitSplash: DolphinSplash;
  entrySplash: DolphinSplash;
  pExit: number;
  pEntry: number;
}

export function createCoastalEnvironment(
  scene: THREE.Scene,
  track: CoastalTrack,
  textures: SceneTextures,
  isSoftwareGl: boolean
): CoastalEnvironment {
  const group = new THREE.Group();
  group.name = 'KoreanCoastalEnvironment';
  scene.add(group);

  // =========================================================================
  // 1. LIGHTING RIG & HORIZON FOG
  // =========================================================================
  const initialPreset = LIGHTING_PRESETS.morning;
  scene.fog = new THREE.FogExp2(initialPreset.fogColor.getHex(), initialPreset.fogDensity);

  const hemiLight = new THREE.HemisphereLight(
    initialPreset.hemiSky,
    initialPreset.hemiGround,
    initialPreset.hemiIntensity
  );
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(initialPreset.sunColor, initialPreset.sunIntensity);
  sunLight.position.copy(initialPreset.sunPos);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 140;
  const d = 22;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.025;
  group.add(sunLight);
  group.add(sunLight.target);

  const rimLight = new THREE.DirectionalLight(initialPreset.rimColor, initialPreset.rimIntensity);
  rimLight.position.set(-30, 18, 28);
  group.add(rimLight);

  // =========================================================================
  // 2. ATMOSPHERIC SKY DOME WITH SUN DISC
  // =========================================================================
  const skyUniforms = {
    uTopColor: { value: initialPreset.skyTop.clone() },
    uHorizonColor: { value: initialPreset.skyHorizon.clone() },
    uSunDir: { value: initialPreset.sunPos.clone().normalize() },
    uSunColor: { value: new THREE.Color(0xfff3d1) },
  };

  const skyGeo = new THREE.SphereGeometry(280, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vWorldPos;
      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.52));
        float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(sunAmt, 16.0) * 0.35;
        col += vec3(1.0, 0.97, 0.88) * smoothstep(0.996, 0.9992, sunAmt) * 0.95;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  // Soft stylized coastal clouds floating in sky
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
    transparent: true,
    opacity: 0.88,
  });
  for (let c = 0; c < 9; c++) {
    const cUnit = new THREE.Group();
    const angle = (c / 9) * Math.PI * 2 + 0.3;
    const dist = 105 + (c % 3) * 28;
    cUnit.position.set(Math.cos(angle) * dist, 28 + (c % 4) * 7, Math.sin(angle) * dist);
    cUnit.lookAt(0, cUnit.position.y, 0);
    for (let p = 0; p < 4; p++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(3.8 + (p % 2) * 1.6, 12, 10),
        cloudMat
      );
      puff.position.set((p - 1.5) * 3.4, (p % 2) * 1.1, (p % 3) * 0.9);
      puff.scale.set(1.4, 0.65, 0.9);
      cUnit.add(puff);
    }
    cloudGroup.add(cUnit);
  }
  group.add(cloudGroup);

  // =========================================================================
  // 3. CONTINUOUS COASTAL TERRAIN HEIGHTFIELD
  // =========================================================================
  const terrainSize = 180;
  const terrainSegs = 128;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cSand = new THREE.Color(0xd9c39a);
  const cRock = new THREE.Color(0x50555e);
  const cGrassA = new THREE.Color(0x529146);
  const cGrassB = new THREE.Color(0x3c763a);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const h = track.groundHeightAt(x, z);
    posAttr.setY(i, h);

    const { dist } = track.signedDistanceToRoad(x, z);
    if (dist > track.roadWidth * 0.5) {
      // Ocean side: rock seawall -> sandy cove
      const tSand = THREE.MathUtils.smoothstep(h, -0.2, -1.8);
      tmpColor.lerpColors(cRock, cSand, tSand);
    } else {
      // Inland grass hill with natural organic variation
      const mix = 0.5 + 0.5 * Math.sin(x * 0.19 + z * 0.17);
      tmpColor.lerpColors(cGrassA, cGrassB, mix);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // =========================================================================
  // 4. ANIMATED PBR OCEAN WITH onBeforeCompile WAVES
  // =========================================================================
  const seaLevel = -1.45;
  const oceanUniforms = {
    uTime: { value: 0 },
  };
  const oceanGeo = new THREE.PlaneGeometry(420, 420, 140, 140);
  oceanGeo.rotateX(-Math.PI / 2);

  const oceanMat = new THREE.MeshPhysicalMaterial({
    color: initialPreset.waterColor,
    roughness: 0.14,
    metalness: 0.08,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.35,
    transparent: true,
    opacity: 0.93,
  });

  oceanMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = oceanUniforms.uTime;
    shader.vertexShader =
      `
      uniform float uTime;
      varying float vWaveHeight;
      ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float w1 = sin(transformed.x * 0.18 + uTime * 1.55) * 0.14;
      float w2 = cos(transformed.z * 0.22 - uTime * 1.25) * 0.12;
      float w3 = sin((transformed.x + transformed.z) * 0.38 + uTime * 2.1) * 0.06;
      transformed.y += w1 + w2 + w3;
      vWaveHeight = w1 + w2 + w3;
      `
    );

    shader.fragmentShader =
      `
      varying float vWaveHeight;
      ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      float crest = smoothstep(0.14, 0.30, vWaveHeight);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.95, 1.0), crest * 0.42);
      `
    );
  };

  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.y = seaLevel;
  oceanMesh.receiveShadow = true;
  group.add(oceanMesh);

  // Subtle Shoreline Foam Ring hugging the rocky coast
  const foamPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 140; i++) {
    const t = (i % 140) / 140;
    const sample = track.sampleAtDistance(t * track.length, track.roadWidth * 0.5 + 7.2);
    foamPts.push(new THREE.Vector3(sample.position.x, seaLevel + 0.06, sample.position.z));
  }
  const foamCurve = new THREE.CatmullRomCurve3(foamPts, true);
  const foamGeo = new THREE.TubeGeometry(foamCurve, 180, 0.55, 6, true);
  foamGeo.scale(1, 0.15, 1);
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xe6f7ff,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const foamRing = new THREE.Mesh(foamGeo, foamMat);
  group.add(foamRing);

  // =========================================================================
  // 5. DISTANT KOREAN VOLCANIC ISLANDS & HEADLANDS (Seongsan / Udo vibe)
  // =========================================================================
  const islandMat = new THREE.MeshStandardMaterial({
    color: 0x3b605c,
    roughness: 0.92,
  });
  const islandSpecs = [
    { x: 112, z: -64, r: 22, h: 16, flatTop: true }, // Seongsan Ilchulbong-inspired tuff cone!
    { x: 128, z: 42, r: 28, h: 11, flatTop: false },
    { x: -95, z: 108, r: 30, h: 14, flatTop: false },
    { x: -115, z: -85, r: 26, h: 12, flatTop: false },
  ];
  for (const isl of islandSpecs) {
    const islGeo = isl.flatTop
      ? new THREE.CylinderGeometry(isl.r * 0.55, isl.r, isl.h, 16)
      : new THREE.ConeGeometry(isl.r, isl.h, 14);
    const islMesh = new THREE.Mesh(islGeo, islandMat);
    islMesh.position.set(isl.x, seaLevel + isl.h * 0.42, isl.z);
    group.add(islMesh);
  }

  // =========================================================================
  // 6. KOREAN COASTAL LANDMARKS (Lighthouse, Jeongja Pavilion, Dol Hareubang, Signs)
  // =========================================================================
  const lanternMats: THREE.MeshStandardMaterial[] = [];

  // A. Red & White Korean Coastal Lighthouse (Deungdae) on rocky east point
  const lighthouseSite = track.sampleAtDistance(track.length * 0.05, track.roadWidth * 0.5 + 8.5);
  const lhGroup = new THREE.Group();
  lhGroup.position.set(lighthouseSite.position.x, seaLevel - 0.1, lighthouseSite.position.z);
  group.add(lhGroup);

  const basaltMat = new THREE.MeshStandardMaterial({
    map: textures.basaltStone,
    roughness: 0.92,
  });
  const lhBaseRock = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 5.2, 2.2, 12), basaltMat);
  lhBaseRock.position.y = 1.1;
  lhBaseRock.castShadow = true;
  lhBaseRock.receiveShadow = true;
  lhGroup.add(lhBaseRock);

  const lhWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  const lhRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });

  const lhTowerLower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.65, 5.4, 16), lhWhiteMat);
  lhTowerLower.position.y = 4.8;
  lhTowerLower.castShadow = true;
  lhGroup.add(lhTowerLower);

  const lhTowerUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 2.6, 16), lhRedMat);
  lhTowerUpper.position.y = 8.8;
  lhTowerUpper.castShadow = true;
  lhGroup.add(lhTowerUpper);

  const lhGallery = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.25, 0.35, 16), lhRedMat);
  lhGallery.position.y = 10.2;
  lhGroup.add(lhGallery);

  const lhLanternMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.8,
    roughness: 0.15,
  });
  lanternMats.push(lhLanternMat);
  const lhGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.1, 14), lhLanternMat);
  lhGlass.position.y = 10.9;
  lhGroup.add(lhGlass);

  const lhRoof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.0, 16), lhRedMat);
  lhRoof.position.y = 11.95;
  lhGroup.add(lhRoof);

  // Rotating Lighthouse Beam (subtle atmospheric cone)
  const lhBeamPivot = new THREE.Group();
  lhBeamPivot.position.y = 10.9;
  lhGroup.add(lhBeamPivot);
  const lhBeamGeo = new THREE.ConeGeometry(3.2, 22, 16, 1, true);
  lhBeamGeo.translate(0, -11, 0);
  lhBeamGeo.rotateX(Math.PI / 2);
  const lhBeamMat = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const lhBeam = new THREE.Mesh(lhBeamGeo, lhBeamMat);
  lhBeamPivot.add(lhBeam);

  // B. Traditional Korean Coastal Pavilion (Jeongja) on scenic inland rise
  const jeongjaX = -5.5;
  const jeongjaZ = 6.5;
  const jeongjaY = track.groundHeightAt(jeongjaX, jeongjaZ);
  const jeongja = new THREE.Group();
  jeongja.position.set(jeongjaX, jeongjaY - 0.15, jeongjaZ);
  jeongja.rotation.y = 0.55;
  group.add(jeongja);

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodPlank,
    roughness: 0.75,
  });
  const roofTileMat = new THREE.MeshStandardMaterial({
    color: 0x2a323d, // Charcoal Korean Giwa roof tiles
    roughness: 0.68,
    metalness: 0.12,
  });
  const redPillarMat = new THREE.MeshStandardMaterial({
    color: 0x9e3529, // Traditional Dancheong red pillar
    roughness: 0.6,
  });

  // Stone podium
  const jStone = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.8, 0.75, 6), basaltMat);
  jStone.position.y = 0.375;
  jStone.receiveShadow = true;
  jStone.castShadow = true;
  jeongja.add(jStone);

  // Wooden deck
  const jDeck = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.35, 0.18, 6), woodMat);
  jDeck.position.y = 0.84;
  jDeck.receiveShadow = true;
  jeongja.add(jDeck);

  // 6 Hexagonal Red Pillars
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.5, 10), redPillarMat);
    pillar.position.set(Math.cos(ang) * 2.65, 2.15, Math.sin(ang) * 2.65);
    pillar.castShadow = true;
    jeongja.add(pillar);
  }

  // Two-tier Korean Giwa hexagonal roof
  const jRoofLower = new THREE.Mesh(new THREE.ConeGeometry(4.35, 1.35, 6), roofTileMat);
  jRoofLower.position.y = 3.95;
  jRoofLower.castShadow = true;
  jeongja.add(jRoofLower);

  const jRoofUpper = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.05, 6), roofTileMat);
  jRoofUpper.position.y = 4.65;
  jRoofUpper.castShadow = true;
  jeongja.add(jRoofUpper);

  // Hanging warm lantern inside Jeongja
  const jLanternMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.35,
  });
  lanternMats.push(jLanternMat);
  const jLantern = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), jLanternMat);
  jLantern.position.y = 3.1;
  jeongja.add(jLantern);

  // C. Stylized Jeju Dol Hareubang Stone Grandfather Statues along the road
  function buildDolHareubang(x: number, z: number, yaw: number) {
    const y = track.groundHeightAt(x, z);
    const dh = new THREE.Group();
    dh.position.set(x, y, z);
    dh.rotation.y = yaw;
    group.add(dh);

    const dhPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.25, 12), basaltMat);
    dhPedestal.position.y = 0.125;
    dhPedestal.receiveShadow = true;
    dh.add(dhPedestal);

    const dhBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.05, 14), basaltMat);
    dhBody.position.y = 0.77;
    dhBody.castShadow = true;
    dh.add(dhBody);

    const dhHead = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 12), basaltMat);
    dhHead.scale.set(0.95, 1.15, 0.95);
    dhHead.position.y = 1.48;
    dhHead.castShadow = true;
    dh.add(dhHead);

    // Iconic wide mushroom hat brim
    const dhHat = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.43, 0.14, 14), basaltMat);
    dhHat.position.y = 1.84;
    dhHat.castShadow = true;
    dh.add(dhHat);

    // Round nose & eyes
    const dhNose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), basaltMat);
    dhNose.scale.set(1, 1.35, 1.1);
    dhNose.position.set(0, 1.45, 0.31);
    dh.add(dhNose);

    for (const s of [-1, 1]) {
      const dhEye = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 6, 12), basaltMat);
      dhEye.position.set(s * 0.12, 1.56, 0.28);
      dh.add(dhEye);
    }
  }

  const dhSpot1 = track.sampleAtDistance(track.length * 0.22, -track.roadWidth * 0.5 - 1.6);
  buildDolHareubang(
    dhSpot1.position.x,
    dhSpot1.position.z,
    Math.atan2(dhSpot1.left.x, dhSpot1.left.z)
  );

  const dhSpot2 = track.sampleAtDistance(track.length * 0.68, -track.roadWidth * 0.5 - 1.6);
  buildDolHareubang(
    dhSpot2.position.x,
    dhSpot2.position.z,
    Math.atan2(dhSpot2.left.x, dhSpot2.left.z)
  );

  // D. Korean Coastal Bike Route Signposts
  function buildSignpost(distFrac: number, tex: THREE.Texture) {
    const sample = track.sampleAtDistance(
      track.length * distFrac,
      -track.roadWidth * 0.5 - 1.45
    );
    const sx = sample.position.x;
    const sz = sample.position.z;
    const sy = track.groundHeightAt(sx, sz);

    const sign = new THREE.Group();
    sign.position.set(sx, sy, sz);
    // Face oncoming ATV traveling along -sample.tangent (right-hand lane)
    sign.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    group.add(sign);

    const postMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.35,
      metalness: 0.7,
    });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.2, 10), postMat);
    post.position.y = 1.1;
    post.castShadow = true;
    sign.add(post);

    const boardGeo = new THREE.BoxGeometry(1.75, 0.88, 0.06);
    const boardFaceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 });
    const boardSideMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const board = new THREE.Mesh(boardGeo, [
      boardSideMat,
      boardSideMat,
      boardSideMat,
      boardSideMat,
      boardFaceMat,
      boardFaceMat,
    ]);
    board.position.y = 2.05;
    board.castShadow = true;
    sign.add(board);
  }

  buildSignpost(0.11, textures.signBoard);
  buildSignpost(0.56, textures.milestoneSign);

  // E. Coastal Wooden Path Lanterns (glow at Golden Hour / Twilight)
  const pathLanternCount = 16;
  const lampPostGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.35, 8);
  lampPostGeo.translate(0, 0.675, 0);
  const lampHeadGeo = new THREE.BoxGeometry(0.24, 0.28, 0.24);
  lampHeadGeo.translate(0, 1.42, 0);
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  lanternMats.push(lampGlowMat);

  const lampPosts = new THREE.InstancedMesh(lampPostGeo, woodMat, pathLanternCount);
  const lampHeads = new THREE.InstancedMesh(lampHeadGeo, lampGlowMat, pathLanternCount);
  lampPosts.castShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < pathLanternCount; i++) {
    const s = track.sampleAtDistance(
      (i / pathLanternCount) * track.length,
      -track.roadWidth * 0.5 - 0.85
    );
    const py = track.groundHeightAt(s.position.x, s.position.z);
    dummy.position.set(s.position.x, py, s.position.z);
    dummy.rotation.set(0, Math.atan2(s.tangent.x, s.tangent.z), 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    lampPosts.setMatrixAt(i, dummy.matrix);
    lampHeads.setMatrixAt(i, dummy.matrix);
  }
  lampPosts.instanceMatrix.needsUpdate = true;
  lampHeads.instanceMatrix.needsUpdate = true;
  lampPosts.computeBoundingSphere();
  lampHeads.computeBoundingSphere();
  group.add(lampPosts, lampHeads);

  // =========================================================================
  // 7. INSTANCED NATURE: KOREAN COASTAL PINES, CANOLA FLOWERS, BASALT ROCKS
  // =========================================================================
  // A. Korean Coastal Pines (Haesong)
  const treePositions: { x: number; z: number; scale: number; rot: number }[] = [];
  for (let i = 0; i < 65 && treePositions.length < 28; i++) {
    const ang = i * 2.39996; // Golden angle distribution inside coastal hill
    const rad = 5 + Math.sqrt(i / 65) * 24;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const { dist } = track.signedDistanceToRoad(x, z);
    // Stay strictly inland and clear of road & Jeongja pavilion
    const distJeongja = Math.hypot(x - jeongjaX, z - jeongjaZ);
    if (dist < -track.roadWidth * 0.5 - 2.6 && distJeongja > 5.2) {
      treePositions.push({
        x,
        z,
        scale: 0.85 + Math.random() * 0.42,
        rot: Math.random() * Math.PI * 2,
      });
    }
  }

  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.25, 2.7, 8);
  trunkGeo.translate(0, 1.35, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b442a, roughness: 0.9 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;

  const foliageGeo = new THREE.DodecahedronGeometry(1.35, 1);
  foliageGeo.scale(1.25, 0.62, 1.25);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 });
  const foliageA = new THREE.InstancedMesh(foliageGeo, foliageMat, treePositions.length);
  const foliageB = new THREE.InstancedMesh(foliageGeo, foliageMat, treePositions.length);
  foliageA.castShadow = true;
  foliageB.castShadow = true;

  const pineToneA = new THREE.Color(0x2a663d);
  const pineToneB = new THREE.Color(0x367a48);
  const cTmp = new THREE.Color();

  treePositions.forEach((tp, idx) => {
    const y = track.groundHeightAt(tp.x, tp.z);
    dummy.position.set(tp.x, y - 0.1, tp.z);
    dummy.rotation.set(0.05, tp.rot, 0.04);
    dummy.scale.setScalar(tp.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    // Lower broad pine canopy pad
    dummy.position.set(tp.x, y + 2.55 * tp.scale, tp.z);
    dummy.scale.set(tp.scale * 1.15, tp.scale * 0.9, tp.scale * 1.15);
    dummy.updateMatrix();
    foliageA.setMatrixAt(idx, dummy.matrix);
    cTmp.lerpColors(pineToneA, pineToneB, Math.random());
    foliageA.setColorAt(idx, cTmp);

    // Upper offset coastal pine crown
    dummy.position.set(
      tp.x + Math.cos(tp.rot) * 0.45 * tp.scale,
      y + 3.45 * tp.scale,
      tp.z + Math.sin(tp.rot) * 0.45 * tp.scale
    );
    dummy.scale.set(tp.scale * 0.85, tp.scale * 0.75, tp.scale * 0.85);
    dummy.updateMatrix();
    foliageB.setMatrixAt(idx, dummy.matrix);
    cTmp.lerpColors(pineToneA, pineToneB, Math.random());
    foliageB.setColorAt(idx, cTmp);
  });

  trunkInst.instanceMatrix.needsUpdate = true;
  foliageA.instanceMatrix.needsUpdate = true;
  foliageB.instanceMatrix.needsUpdate = true;
  if (foliageA.instanceColor) foliageA.instanceColor.needsUpdate = true;
  if (foliageB.instanceColor) foliageB.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  foliageA.computeBoundingSphere();
  foliageB.computeBoundingSphere();
  group.add(trunkInst, foliageA, foliageB);

  // B. Blooming Jeju Canola Flowers (Yuchae-kkot) across sunny inland slopes
  const canolaCount = 240;
  const stemGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.42, 5);
  stemGeo.translate(0, 0.21, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4d7c2f, roughness: 0.88 });
  const blossomGeo = new THREE.DodecahedronGeometry(0.24, 0);
  blossomGeo.scale(1.25, 0.65, 1.25);
  blossomGeo.translate(0, 0.44, 0);
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });

  const canolaStems = new THREE.InstancedMesh(stemGeo, stemMat, canolaCount);
  const canolaBlooms = new THREE.InstancedMesh(blossomGeo, blossomMat, canolaCount);

  const goldA = new THREE.Color(0xfacc15);
  const goldB = new THREE.Color(0xfde047);
  let placedCanola = 0;

  for (let i = 0; i < 650 && placedCanola < canolaCount; i++) {
    const ang = i * 2.39996 + 1.1;
    const rad = 4 + Math.sqrt((i % 250) / 250) * 28;
    const x = Math.cos(ang) * rad + (Math.random() - 0.5) * 2.4;
    const z = Math.sin(ang) * rad + (Math.random() - 0.5) * 2.4;
    const { dist } = track.signedDistanceToRoad(x, z);
    const distJeongja = Math.hypot(x - jeongjaX, z - jeongjaZ);
    if (dist < -track.roadWidth * 0.5 - 1.5 && distJeongja > 4.2) {
      const y = track.groundHeightAt(x, z);
      dummy.position.set(x, y - 0.03, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + Math.random() * 0.45);
      dummy.updateMatrix();
      canolaStems.setMatrixAt(placedCanola, dummy.matrix);
      canolaBlooms.setMatrixAt(placedCanola, dummy.matrix);
      cTmp.lerpColors(goldA, goldB, Math.random());
      canolaBlooms.setColorAt(placedCanola, cTmp);
      placedCanola++;
    }
  }
  canolaStems.count = placedCanola;
  canolaBlooms.count = placedCanola;
  canolaStems.instanceMatrix.needsUpdate = true;
  canolaBlooms.instanceMatrix.needsUpdate = true;
  if (canolaBlooms.instanceColor) canolaBlooms.instanceColor.needsUpdate = true;
  canolaStems.computeBoundingSphere();
  canolaBlooms.computeBoundingSphere();
  group.add(canolaStems, canolaBlooms);

  // C. Volcanic Basalt Shoreline Rocks
  const rockCount = 96;
  const rockGeo = new THREE.DodecahedronGeometry(0.85, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    map: textures.basaltStone,
    roughness: 0.95,
    metalness: 0.04,
  });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  for (let i = 0; i < rockCount; i++) {
    const t = (i / rockCount + (Math.random() - 0.5) * 0.01) * track.length;
    const offset = track.roadWidth * 0.5 + 2.4 + Math.random() * 5.8;
    const s = track.sampleAtDistance(t, offset);
    const rx = s.position.x;
    const rz = s.position.z;
    const ry = track.groundHeightAt(rx, rz);
    dummy.position.set(rx, ry + 0.15, rz);
    dummy.rotation.set(Math.random() * 2, Math.random() * 3, Math.random() * 2);
    dummy.scale.set(
      0.7 + Math.random() * 1.2,
      0.45 + Math.random() * 0.65,
      0.7 + Math.random() * 1.1
    );
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  // =========================================================================
  // 8. DYNAMIC LIFE: SOARING SEAGULLS & WINDBLOWN CANOLA PETALS
  // =========================================================================
  const seagulls: Seagull[] = [];
  const gullBodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const gullTipMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

  for (let i = 0; i < 7; i++) {
    const gull = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.52, 6), gullBodyMat);
    body.rotation.x = Math.PI / 2;
    gull.add(body);

    const wingGeoL = new THREE.BoxGeometry(0.65, 0.025, 0.19);
    wingGeoL.translate(0.32, 0, 0);
    const leftWing = new THREE.Mesh(wingGeoL, gullBodyMat);
    leftWing.position.set(0.05, 0.02, 0.04);
    gull.add(leftWing);

    const wingGeoR = new THREE.BoxGeometry(0.65, 0.025, 0.19);
    wingGeoR.translate(-0.32, 0, 0);
    const rightWing = new THREE.Mesh(wingGeoR, gullTipMat);
    rightWing.position.set(-0.05, 0.02, 0.04);
    gull.add(rightWing);

    group.add(gull);
    const angle = (i / 7) * Math.PI * 2;
    seagulls.push({
      group: gull,
      leftWing,
      rightWing,
      centerX: Math.cos(angle) * 44,
      centerZ: Math.sin(angle) * 44,
      radius: 9 + (i % 3) * 4,
      baseY: 6.5 + (i % 4) * 2.2,
      speed: 0.36 + (i % 3) * 0.1,
      phase: i * 1.3,
    });
  }

  // Windblown Canola Petals / Sea Mist Particles
  const petalCount = 160;
  const petalPositions = new Float32Array(petalCount * 3);
  const petalPhases = new Float32Array(petalCount);
  for (let i = 0; i < petalCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 16 + Math.random() * 28;
    petalPositions[i * 3] = Math.cos(ang) * rad;
    petalPositions[i * 3 + 1] = 0.8 + Math.random() * 4.5;
    petalPositions[i * 3 + 2] = Math.sin(ang) * rad;
    petalPhases[i] = Math.random() * Math.PI * 2;
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
  const petalMat = new THREE.PointsMaterial({
    map: textures.petal,
    size: 0.24,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    alphaTest: 0.1,
  });
  const petalPoints = new THREE.Points(petalGeo, petalMat);
  group.add(petalPoints);

  // =========================================================================
  // 8B. JUMPING JEJU COASTAL DOLPHINS (남방큰돌고래) & OCEAN SPLASHES
  // =========================================================================
  const dolphins: JumpingDolphin[] = [];

  // Shared sculpted dolphin geometries (nose faces +Z, dorsal fin +Y, tail at -Z)
  // Smooth hydrodynamic bottlenose dolphin Lathe profile along Y, then rotated onto +Z
  const dolphinBodyProfile = [
    new THREE.Vector2(0.0, -1.18), // Tail peduncle end (-Z)
    new THREE.Vector2(0.048, -0.96),
    new THREE.Vector2(0.095, -0.68),
    new THREE.Vector2(0.165, -0.35),
    new THREE.Vector2(0.245, 0.02), // Deep chest/torso
    new THREE.Vector2(0.268, 0.34),
    new THREE.Vector2(0.242, 0.62),
    new THREE.Vector2(0.192, 0.84), // Rounded melon forehead
    new THREE.Vector2(0.105, 0.99), // Snout base
    new THREE.Vector2(0.056, 1.16), // Iconic bottlenose rostrum
    new THREE.Vector2(0.026, 1.25),
    new THREE.Vector2(0.0, 1.27),
  ];
  const dolphinBodyGeo = new THREE.LatheGeometry(dolphinBodyProfile, 20);
  dolphinBodyGeo.rotateX(Math.PI / 2); // Align Lathe +Y along +Z (forward)
  dolphinBodyGeo.scale(0.84, 1.04, 1.0); // Sleek laterally compressed hydrodynamic profile

  // Pale cream-silver ventral belly patch
  const dolphinBellyGeo = new THREE.SphereGeometry(0.20, 14, 12);
  dolphinBellyGeo.scale(0.82, 0.52, 3.35);

  // Falcate curved dorsal fin (extruded & beveled)
  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(0, 0);
  dorsalShape.quadraticCurveTo(0.10, 0.24, -0.18, 0.34);
  dorsalShape.quadraticCurveTo(-0.08, 0.16, -0.26, 0);
  dorsalShape.closePath();
  const dorsalFinGeo = new THREE.ExtrudeGeometry(dorsalShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  dorsalFinGeo.translate(0, 0, -0.016);
  dorsalFinGeo.rotateY(-Math.PI / 2); // Align fin along YZ plane sweeping backward toward -Z

  // Swept pectoral flipper
  const pecShape = new THREE.Shape();
  pecShape.moveTo(0, 0);
  pecShape.quadraticCurveTo(0.14, -0.05, 0.36, -0.22);
  pecShape.quadraticCurveTo(0.18, -0.24, -0.04, -0.08);
  pecShape.closePath();
  const pecFinGeo = new THREE.ExtrudeGeometry(pecShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  pecFinGeo.translate(0, 0, -0.011);

  // Wide horizontal V-notched crescent tail flukes
  const flukeShape = new THREE.Shape();
  flukeShape.moveTo(0, 0.10);
  flukeShape.quadraticCurveTo(0.24, 0.04, 0.42, -0.16);
  flukeShape.quadraticCurveTo(0.18, -0.12, 0.03, -0.03);
  flukeShape.lineTo(0, -0.08); // Center tail notch
  flukeShape.lineTo(-0.03, -0.03);
  flukeShape.quadraticCurveTo(-0.18, -0.12, -0.42, -0.16);
  flukeShape.quadraticCurveTo(-0.24, 0.04, 0, 0.10);
  const flukeGeo = new THREE.ExtrudeGeometry(flukeShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  flukeGeo.translate(0, 0, -0.011);
  flukeGeo.rotateX(Math.PI / 2); // Horizontal flukes extending in XZ plane

  const dolphinEyeGeo = new THREE.SphereGeometry(0.024, 8, 8);

  // Glossy wet Jeju Indo-Pacific bottlenose dolphin materials
  const dolphinSkinMat = new THREE.MeshPhysicalMaterial({
    color: 0x4a6b88, // Wet coastal slate-blue grey
    roughness: 0.15,
    metalness: 0.1,
    clearcoat: 0.96,
    clearcoatRoughness: 0.08,
  });
  const dolphinBellyMat = new THREE.MeshPhysicalMaterial({
    color: 0xdce8f2, // Soft silver-cream belly
    roughness: 0.22,
    metalness: 0.04,
    clearcoat: 0.75,
    clearcoatRoughness: 0.14,
  });
  const dolphinEyeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.08,
    metalness: 0.1,
  });

  // Shared splash ring & water spray plume geometries
  const splashRingGeo = new THREE.RingGeometry(0.32, 0.85, 24);
  splashRingGeo.rotateX(-Math.PI / 2);
  const splashCrownGeo = new THREE.ConeGeometry(0.68, 1.05, 14, 1, true);
  splashCrownGeo.translate(0, 0.52, 0);

  function createSplashEffect(x: number, z: number): DolphinSplash {
    const sGroup = new THREE.Group();
    sGroup.position.set(x, seaLevel + 0.07, z);
    sGroup.visible = false;
    group.add(sGroup);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf0f9ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(splashRingGeo, ringMat);
    sGroup.add(ring);

    const crownMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const crown = new THREE.Mesh(splashCrownGeo, crownMat);
    sGroup.add(crown);

    return { group: sGroup, ring, ringMat, crown, crownMat };
  }

  function buildDolphinRig(scale: number): {
    dolphinGroup: THREE.Group;
    bodyPivot: THREE.Group;
    tailPivot: THREE.Group;
  } {
    const dolphinGroup = new THREE.Group();
    const bodyPivot = new THREE.Group();
    bodyPivot.scale.setScalar(scale);
    dolphinGroup.add(bodyPivot);

    const body = new THREE.Mesh(dolphinBodyGeo, dolphinSkinMat);
    body.castShadow = !isSoftwareGl;
    bodyPivot.add(body);

    const belly = new THREE.Mesh(dolphinBellyGeo, dolphinBellyMat);
    belly.position.set(0, -0.115, 0.16);
    bodyPivot.add(belly);

    const dorsal = new THREE.Mesh(dorsalFinGeo, dolphinSkinMat);
    dorsal.position.set(0, 0.21, 0.04);
    bodyPivot.add(dorsal);

    // Left & Right Pectoral Flippers (swept smoothly outward, downward & backward toward -Z)
    const leftPec = new THREE.Mesh(pecFinGeo, dolphinSkinMat);
    leftPec.position.set(0.15, -0.06, 0.36);
    leftPec.rotation.set(0.16, 0.55, -0.22);
    bodyPivot.add(leftPec);

    const rightPec = new THREE.Mesh(pecFinGeo, dolphinSkinMat);
    rightPec.scale.x = -1;
    rightPec.position.set(-0.15, -0.06, 0.36);
    rightPec.rotation.set(0.16, -0.55, 0.22);
    bodyPivot.add(rightPec);

    // Glossy eyes on both sides of the melon
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(dolphinEyeGeo, dolphinEyeMat);
      eye.position.set(s * 0.145, 0.03, 0.84);
      bodyPivot.add(eye);
    }

    // Articulated rear tail fluke pivot (beats energetically during breach!)
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.0, -0.96);
    bodyPivot.add(tailPivot);

    const flukes = new THREE.Mesh(flukeGeo, dolphinSkinMat);
    flukes.position.set(0, 0, -0.22);
    tailPivot.add(flukes);

    group.add(dolphinGroup);
    return { dolphinGroup, bodyPivot, tailPivot };
  }

  // 10 Jumping Jeju Dolphins in 3 coastal pods (Pod 1 right in the starting coastal ocean view!)
  const dolphinSpecs: {
    distFrac: number;
    oceanDist: number;
    scale: number;
    jumpSpan: number;
    jumpHeight: number;
    period: number;
    phase: number;
    rollAmp: number;
  }[] = [
    // Pod 1: Hero East Coastal Pod (immediately visible leaping beside the tiger on load!)
    { distFrac: 0.136, oceanDist: 12.5, scale: 1.18, jumpSpan: 7.4, jumpHeight: 3.1, period: 3.8, phase: 0.45, rollAmp: 0.22 },
    { distFrac: 0.122, oceanDist: 16.5, scale: 1.05, jumpSpan: 6.8, jumpHeight: 2.75, period: 4.1, phase: 1.55, rollAmp: -0.24 },
    { distFrac: 0.106, oceanDist: 13.8, scale: 1.24, jumpSpan: 8.0, jumpHeight: 3.35, period: 3.6, phase: 2.45, rollAmp: 0.18 },
    { distFrac: 0.086, oceanDist: 18.8, scale: 0.96, jumpSpan: 6.4, jumpHeight: 2.55, period: 4.3, phase: 0.95, rollAmp: -0.20 },

    // Pod 2: South-West Scenic Headland Pod
    { distFrac: 0.39, oceanDist: 14.0, scale: 1.15, jumpSpan: 7.5, jumpHeight: 3.0, period: 3.9, phase: 0.2, rollAmp: 0.2 },
    { distFrac: 0.42, oceanDist: 18.5, scale: 1.22, jumpSpan: 8.2, jumpHeight: 3.4, period: 4.2, phase: 1.8, rollAmp: -0.22 },
    { distFrac: 0.45, oceanDist: 13.0, scale: 1.0, jumpSpan: 6.6, jumpHeight: 2.6, period: 3.7, phase: 2.9, rollAmp: 0.25 },

    // Pod 3: North-West Deep Turquoise Bay Pod
    { distFrac: 0.72, oceanDist: 13.5, scale: 1.2, jumpSpan: 7.8, jumpHeight: 3.25, period: 4.0, phase: 0.6, rollAmp: -0.18 },
    { distFrac: 0.755, oceanDist: 17.5, scale: 1.08, jumpSpan: 7.0, jumpHeight: 2.85, period: 3.65, phase: 2.0, rollAmp: 0.24 },
    { distFrac: 0.785, oceanDist: 14.5, scale: 0.94, jumpSpan: 6.3, jumpHeight: 2.5, period: 4.35, phase: 3.1, rollAmp: -0.21 },
  ];

  const DOLPHIN_SUBMERGE = 1.25;
  const DOLPHIN_BREACH_DUTY = 0.64;

  for (const spec of dolphinSpecs) {
    const sample = track.sampleAtDistance(
      track.length * spec.distFrac,
      track.roadWidth * 0.5 + spec.oceanDist
    );
    // Swim parallel to the tiger's travel direction (-sample.tangent)
    const dirX = -sample.tangent.x;
    const dirZ = -sample.tangent.z;
    const lenXZ = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / lenXZ;
    const nz = dirZ / lenXZ;
    const yaw = Math.atan2(nx, nz);

    const arcAmp = spec.jumpHeight + DOLPHIN_SUBMERGE;
    const pExit = Math.asin(DOLPHIN_SUBMERGE / arcAmp) / Math.PI;
    const pEntry = 1 - pExit;

    const exitS = (pExit - 0.5) * spec.jumpSpan;
    const entryS = (pEntry - 0.5) * spec.jumpSpan;

    const exitSplash = createSplashEffect(
      sample.position.x + nx * exitS,
      sample.position.z + nz * exitS
    );
    const entrySplash = createSplashEffect(
      sample.position.x + nx * entryS,
      sample.position.z + nz * entryS
    );

    const { dolphinGroup, bodyPivot, tailPivot } = buildDolphinRig(spec.scale);
    dolphinGroup.rotation.y = yaw;

    dolphins.push({
      group: dolphinGroup,
      bodyPivot,
      tailPivot,
      baseX: sample.position.x,
      baseZ: sample.position.z,
      dirX: nx,
      dirZ: nz,
      yaw,
      jumpSpan: spec.jumpSpan,
      jumpHeight: spec.jumpHeight,
      period: spec.period,
      breachDuty: DOLPHIN_BREACH_DUTY,
      phase: spec.phase,
      rollAmp: spec.rollAmp,
      exitSplash,
      entrySplash,
      pExit,
      pEntry,
    });
  }

  // =========================================================================
  // 9. SMOOTH TIME-OF-DAY BLENDING & PER-FRAME ANIMATION
  // =========================================================================
  const curSkyTop = initialPreset.skyTop.clone();
  const curSkyHor = initialPreset.skyHorizon.clone();
  const curFogCol = initialPreset.fogColor.clone();
  const curWaterCol = initialPreset.waterColor.clone();

  function applyTimeOfDay(mode: TimeOfDay, dt: number, renderer: THREE.WebGLRenderer) {
    const target = LIGHTING_PRESETS[mode];
    const alpha = Math.min(1, dt * 3.5);

    curSkyTop.lerp(target.skyTop, alpha);
    curSkyHor.lerp(target.skyHorizon, alpha);
    curFogCol.lerp(target.fogColor, alpha);
    curWaterCol.lerp(target.waterColor, alpha);

    skyUniforms.uTopColor.value.copy(curSkyTop);
    skyUniforms.uHorizonColor.value.copy(curSkyHor);
    skyUniforms.uSunDir.value.lerp(target.sunPos.clone().normalize(), alpha).normalize();

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(curFogCol);
      scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, target.fogDensity, alpha);
    }

    sunLight.color.lerp(target.sunColor, alpha);
    sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, target.sunIntensity, alpha);
    hemiLight.color.lerp(target.hemiSky, alpha);
    hemiLight.groundColor.lerp(target.hemiGround, alpha);
    hemiLight.intensity = THREE.MathUtils.lerp(hemiLight.intensity, target.hemiIntensity, alpha);
    rimLight.color.lerp(target.rimColor, alpha);
    rimLight.intensity = THREE.MathUtils.lerp(rimLight.intensity, target.rimIntensity, alpha);

    oceanMat.color.copy(curWaterCol);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      renderer.toneMappingExposure,
      target.exposure,
      alpha
    );

    for (const m of lanternMats) {
      m.emissiveIntensity = THREE.MathUtils.lerp(
        m.emissiveIntensity,
        target.lanternEmissive,
        alpha
      );
    }
    lhBeamMat.opacity = THREE.MathUtils.lerp(
      lhBeamMat.opacity,
      mode === 'twilight' ? 0.18 : 0.04,
      alpha
    );
    petalMat.opacity = THREE.MathUtils.lerp(
      petalMat.opacity,
      mode === 'twilight' ? 0.35 : 0.82,
      alpha
    );
  }

  function update(dt: number, elapsed: number, focusPos: THREE.Vector3) {
    oceanUniforms.uTime.value = elapsed;

    // Keep directional shadow frustum tightly centered on the tiger & bicycle!
    const activeSunOffset = skyUniforms.uSunDir.value;
    sunLight.position.copy(focusPos).addScaledVector(activeSunOffset, 48);
    sunLight.target.position.copy(focusPos);
    sunLight.target.updateMatrixWorld();

    // Rotate lighthouse beacon
    lhBeamPivot.rotation.y = elapsed * 0.85;

    // Gentle foam pulse
    foamMat.opacity = 0.36 + 0.14 * Math.sin(elapsed * 1.8);

    // Slow drifting clouds
    cloudGroup.rotation.y = elapsed * 0.006;

    // Soaring seagulls
    for (const g of seagulls) {
      const a = elapsed * g.speed + g.phase;
      const nx = g.centerX + Math.cos(a) * g.radius;
      const nz = g.centerZ + Math.sin(a) * g.radius;
      const ny = g.baseY + Math.sin(elapsed * 1.4 + g.phase) * 0.55;
      g.group.position.set(nx, ny, nz);
      // Tangent along circle
      g.group.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
      const flap = Math.sin(elapsed * 7.5 + g.phase * 2) * 0.42;
      g.leftWing.rotation.z = flap;
      g.rightWing.rotation.z = -flap;
    }

    // Jumping Jeju Coastal Dolphins (parabolic breaching arcs + dynamic water splashes)
    for (const d of dolphins) {
      const cycleTime = (((elapsed + d.phase) % d.period) + d.period) % d.period;
      const u = cycleTime / d.period;

      if (u <= d.breachDuty) {
        const p = u / d.breachDuty; // 0..1 across full breach arc
        const s = (p - 0.5) * d.jumpSpan;
        const arcAmp = d.jumpHeight + DOLPHIN_SUBMERGE;
        const y = seaLevel - DOLPHIN_SUBMERGE + Math.sin(p * Math.PI) * arcAmp;

        d.group.visible = y > seaLevel - 1.3;
        d.group.position.set(d.baseX + d.dirX * s, y, d.baseZ + d.dirZ * s);

        // Exact tangent pitch along parabolic jump arc (nose rises on exit, dives head-first on entry)
        const dyDp = Math.cos(p * Math.PI) * Math.PI * arcAmp;
        const dsDp = d.jumpSpan;
        const pitch = Math.atan2(dyDp, dsDp);
        d.bodyPivot.rotation.x = -pitch;
        d.bodyPivot.rotation.z = Math.sin(p * Math.PI) * d.rollAmp;

        // Energetic dolphin tail fluke kick
        d.tailPivot.rotation.x = Math.sin(elapsed * 12.5 + d.phase * 3.1) * 0.34;
      } else {
        d.group.visible = false;
      }

      // Update Exit Splash (bursts right as dolphin leaps out of the ocean)
      const exitTriggerTime = d.pExit * d.breachDuty * d.period;
      const exitAge = (cycleTime - exitTriggerTime + d.period) % d.period;
      const exitDur = 1.05;
      if (exitAge >= 0 && exitAge < exitDur) {
        const k = exitAge / exitDur;
        d.exitSplash.group.visible = true;
        const ringScale = 0.5 + k * 2.5;
        d.exitSplash.ring.scale.set(ringScale, 1, ringScale);
        d.exitSplash.ringMat.opacity = (1 - k) * 0.65;

        const crownH = Math.sin(Math.min(1, k * 1.45) * Math.PI) * 1.15;
        const crownW = 0.45 + k * 1.15;
        d.exitSplash.crown.scale.set(crownW, Math.max(0.01, crownH), crownW);
        d.exitSplash.crownMat.opacity = (1 - k) * 0.52;
      } else {
        d.exitSplash.group.visible = false;
      }

      // Update Entry Splash (dramatic white spray & expanding ripple as dolphin dives back in)
      const entryTriggerTime = d.pEntry * d.breachDuty * d.period;
      const entryAge = (cycleTime - entryTriggerTime + d.period) % d.period;
      const entryDur = 1.3;
      if (entryAge >= 0 && entryAge < entryDur) {
        const k = entryAge / entryDur;
        d.entrySplash.group.visible = true;
        const ringScale = 0.6 + k * 3.4;
        d.entrySplash.ring.scale.set(ringScale, 1, ringScale);
        d.entrySplash.ringMat.opacity = (1 - k) * 0.78;

        const crownH = Math.sin(Math.min(1, k * 1.35) * Math.PI) * 1.65;
        const crownW = 0.55 + k * 1.5;
        d.entrySplash.crown.scale.set(crownW, Math.max(0.01, crownH), crownW);
        d.entrySplash.crownMat.opacity = (1 - k) * 0.62;
      } else {
        d.entrySplash.group.visible = false;
      }
    }

    // Windblown petals drifting softly
    const pos = petalGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < petalCount; i++) {
      const ph = petalPhases[i];
      let x = pos.getX(i) + Math.sin(elapsed * 0.7 + ph) * dt * 0.95;
      let y = pos.getY(i) - dt * 0.28 + Math.sin(elapsed * 2.1 + ph) * dt * 0.18;
      let z = pos.getZ(i) + Math.cos(elapsed * 0.6 + ph) * dt * 0.85;
      if (y < 0.25) {
        y = 4.6 + Math.random() * 1.5;
        const ang = Math.random() * Math.PI * 2;
        const rad = 16 + Math.random() * 26;
        x = Math.cos(ang) * rad;
        z = Math.sin(ang) * rad;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  return {
    group,
    sunLight,
    hemiLight,
    rimLight,
    applyTimeOfDay,
    update,
  };
}
