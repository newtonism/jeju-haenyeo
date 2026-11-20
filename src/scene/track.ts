import * as THREE from 'three';

export interface RoadSample {
  t: number;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  left: THREE.Vector3; // Points outward toward ocean
  right: THREE.Vector3; // Points inward toward coastal hills
  curvature: number; // Signed yaw turn rate
}

export interface CoastalTrack {
  curve: THREE.CatmullRomCurve3;
  length: number;
  roadWidth: number;
  bikeLaneOffset: number; // Offset from centerline toward ocean (along `left`)
  samples: RoadSample[];
  sampleAtDistance: (distance: number, lateralOffset?: number) => {
    position: THREE.Vector3;
    tangent: THREE.Vector3;
    left: THREE.Vector3;
    curvature: number;
  };
  groundHeightAt: (x: number, z: number) => number;
  signedDistanceToRoad: (x: number, z: number) => {
    dist: number; // < 0 inside (inland), > 0 outside (ocean)
    nearestPoint: THREE.Vector3;
  };
  buildRoadMesh: (
    roadTex: THREE.Texture,
    normalTex: THREE.Texture,
    basaltTex: THREE.Texture
  ) => THREE.Group;
}

const _up = new THREE.Vector3(0, 1, 0);

export function createCoastalTrack(): CoastalTrack {
  // Organic Jeju coastal peninsula loop (clockwise from above so `left` faces the ocean)
  const controlPoints: THREE.Vector3[] = [];
  const numPts = 16;
  for (let i = 0; i < numPts; i++) {
    const theta = (i / numPts) * Math.PI * 2;
    // Organic coastal headland shape
    const r =
      32 +
      5.5 * Math.cos(theta * 2 - 0.4) +
      3.2 * Math.sin(theta * 3 + 0.7) +
      1.8 * Math.cos(theta);
    // Gentle coastal road undulation (never below 0.25m, ocean is at -1.55m)
    const y = 0.45 + 0.35 * Math.sin(theta * 2 + 0.5) + 0.18 * Math.cos(theta * 3);
    controlPoints.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }

  const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5);
  const length = curve.getLength();
  const roadWidth = 6.8;
  // Center of the ocean-side driving lane on the 2-lane coastal road
  const bikeLaneOffset = 1.65;

  const sampleCount = 360;
  const samples: RoadSample[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleCount;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, _up).normalize();
    const left = right.clone().negate();

    // Estimate signed curvature in XZ plane
    const dt = 0.006;
    const tPrev = (t - dt + 1) % 1;
    const tNext = (t + dt) % 1;
    const tanPrev = curve.getTangentAt(tPrev);
    const tanNext = curve.getTangentAt(tNext);
    const yawPrev = Math.atan2(tanPrev.x, tanPrev.z);
    const yawNext = Math.atan2(tanNext.x, tanNext.z);
    let dYaw = yawNext - yawPrev;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const curvature = dYaw / (2 * dt * length);

    samples.push({ t, point, tangent, left, right, curvature });
  }

  function sampleAtDistance(distance: number, lateralOffset = bikeLaneOffset) {
    const wrapped = ((distance % length) + length) % length;
    const fIdx = (wrapped / length) * sampleCount;
    const i0 = Math.floor(fIdx) % sampleCount;
    const i1 = (i0 + 1) % sampleCount;
    const alpha = fIdx - Math.floor(fIdx);

    const s0 = samples[i0];
    const s1 = samples[i1];

    const position = new THREE.Vector3().lerpVectors(s0.point, s1.point, alpha);
    const tangent = new THREE.Vector3().lerpVectors(s0.tangent, s1.tangent, alpha).normalize();
    const left = new THREE.Vector3().lerpVectors(s0.left, s1.left, alpha).normalize();
    const curvature = THREE.MathUtils.lerp(s0.curvature, s1.curvature, alpha);

    position.addScaledVector(left, lateralOffset);

    return { position, tangent, left, curvature };
  }

  function signedDistanceToRoad(x: number, z: number) {
    let bestDistSq = Infinity;
    let bestSample = samples[0];
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i].point;
      const dx = x - p.x;
      const dz = z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestSample = samples[i];
      }
    }
    const dx = x - bestSample.point.x;
    const dz = z - bestSample.point.z;
    const dotLeft = dx * bestSample.left.x + dz * bestSample.left.z;
    const dist = Math.sqrt(bestDistSq) * (dotLeft >= 0 ? 1 : -1);
    return { dist, nearestPoint: bestSample.point };
  }

  function groundHeightAt(x: number, z: number): number {
    const { dist, nearestPoint } = signedDistanceToRoad(x, z);
    const roadY = nearestPoint.y;
    const halfW = roadWidth * 0.5;

    // On the road deck
    if (Math.abs(dist) <= halfW + 0.35) {
      return roadY;
    }

    // Ocean side (dist > halfW): coastal seawall drop onto rocky shore & sandy beach
    if (dist > halfW + 0.35) {
      const dOut = dist - (halfW + 0.35);
      // Smooth coastal slope down to sea floor (-2.8m)
      const shelf = roadY - 0.55;
      const tDrop = THREE.MathUtils.smoothstep(dOut, 0, 2.2);
      const tSlope = THREE.MathUtils.smoothstep(dOut, 2.0, 12.5);
      const rockyNoise =
        0.22 * Math.sin(x * 0.35) * Math.cos(z * 0.35) +
        0.12 * Math.sin(x * 0.8 + z * 0.6);
      const h = THREE.MathUtils.lerp(roadY, shelf, tDrop);
      return THREE.MathUtils.lerp(h, -2.9, tSlope) + rockyNoise * tDrop;
    }

    // Inland side (dist < -halfW): lush Jeju coastal grass slope rising to central hill
    const dIn = -dist - (halfW + 0.35);
    const rise = THREE.MathUtils.smoothstep(dIn, 0, 18) * 5.4;
    const hillWaves =
      0.55 * Math.sin(x * 0.14 + 0.6) * Math.cos(z * 0.14 - 0.3) +
      0.25 * Math.sin(x * 0.32 - z * 0.27);
    const hillBlend = THREE.MathUtils.smoothstep(dIn, 0.5, 6.0);
    return roadY + 0.04 + rise + hillWaves * hillBlend;
  }

  function buildRoadMesh(
    roadTex: THREE.Texture,
    normalTex: THREE.Texture,
    basaltTex: THREE.Texture
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'CoastalRoad';

    const segs = 280;
    const halfW = roadWidth * 0.5;

    // 1. Road Surface Ribbon
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const repeatAlong = Math.round(length / 10);

    for (let i = 0; i <= segs; i++) {
      const t = (i % segs) / segs;
      const pt = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tan, _up).normalize();
      const left = right.clone().negate();

      const pLeft = pt.clone().addScaledVector(left, halfW);
      const pRight = pt.clone().addScaledVector(right, halfW);

      positions.push(pLeft.x, pLeft.y + 0.02, pLeft.z);
      positions.push(pRight.x, pRight.y + 0.02, pRight.z);

      normals.push(0, 1, 0, 0, 1, 0);

      const v = (i / segs) * repeatAlong;
      uvs.push(0, v, 1, v);

      if (i < segs) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    roadTex.repeat.set(1, repeatAlong);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.82,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // 2. Basalt Stone Curb & Seawall Shoulder along the ocean side
    const curbPositions: number[] = [];
    const curbUvs: number[] = [];
    const curbIndices: number[] = [];
    const curbW = 0.48;
    const curbH = 0.55;

    for (let i = 0; i <= segs; i++) {
      const t = (i % segs) / segs;
      const pt = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const left = new THREE.Vector3().crossVectors(tan, _up).normalize().negate();

      // 4 profile points: inner top, outer top, outer bottom
      const p0 = pt.clone().addScaledVector(left, halfW - 0.05);
      p0.y += 0.09;
      const p1 = pt.clone().addScaledVector(left, halfW + curbW);
      p1.y += 0.09;
      const p2 = pt.clone().addScaledVector(left, halfW + curbW + 0.15);
      p2.y -= curbH;

      curbPositions.push(p0.x, p0.y, p0.z);
      curbPositions.push(p1.x, p1.y, p1.z);
      curbPositions.push(p2.x, p2.y, p2.z);

      const v = (i / segs) * 24;
      curbUvs.push(0, v, 0.4, v, 1, v);

      if (i < segs) {
        const b = i * 3;
        curbIndices.push(b, b + 1, b + 3);
        curbIndices.push(b + 1, b + 4, b + 3);
        curbIndices.push(b + 1, b + 2, b + 4);
        curbIndices.push(b + 2, b + 5, b + 4);
      }
    }

    const curbGeo = new THREE.BufferGeometry();
    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
    curbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbUvs, 2));
    curbGeo.setIndex(curbIndices);
    curbGeo.computeVertexNormals();

    const curbMat = new THREE.MeshStandardMaterial({
      map: basaltTex,
      roughness: 0.92,
      metalness: 0.05,
    });
    const curbMesh = new THREE.Mesh(curbGeo, curbMat);
    curbMesh.castShadow = true;
    curbMesh.receiveShadow = true;
    group.add(curbMesh);

    // 3. Coastal Safety Bollards & Wooden Top Rail (Instanced for crisp detail & low draw calls)
    const bollardCount = 64;
    const bollardGeo = new THREE.CylinderGeometry(0.085, 0.095, 0.68, 12);
    bollardGeo.translate(0, 0.34, 0);
    const bollardMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.45,
      metalness: 0.1,
    });
    const bollardInst = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCount);
    bollardInst.castShadow = true;
    bollardInst.receiveShadow = true;

    const bandGeo = new THREE.CylinderGeometry(0.092, 0.092, 0.12, 12);
    bandGeo.translate(0, 0.52, 0);
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.25,
      emissive: 0x78350f,
      emissiveIntensity: 0.2,
    });
    const bandInst = new THREE.InstancedMesh(bandGeo, bandMat, bollardCount);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < bollardCount; i++) {
      const dist = (i / bollardCount) * length;
      const { position, tangent } = sampleAtDistance(dist, halfW + 0.22);
      dummy.position.copy(position);
      dummy.position.y += 0.04;
      dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
      dummy.updateMatrix();
      bollardInst.setMatrixAt(i, dummy.matrix);
      bandInst.setMatrixAt(i, dummy.matrix);
    }
    bollardInst.instanceMatrix.needsUpdate = true;
    bandInst.instanceMatrix.needsUpdate = true;
    bollardInst.computeBoundingSphere();
    bandInst.computeBoundingSphere();
    group.add(bollardInst, bandInst);

    // 4. Jeju Dol-dam (Traditional Low Volcanic Basalt Wall) on the inland verge
    const wallPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 140; i++) {
      const t = (i % 140) / 140;
      const pt = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tan, _up).normalize();
      const wallPos = pt.clone().addScaledVector(right, halfW + 1.05);
      wallPos.y = groundHeightAt(wallPos.x, wallPos.z) + 0.22;
      wallPts.push(wallPos);
    }
    const wallCurve = new THREE.CatmullRomCurve3(wallPts, true);
    const wallGeo = new THREE.TubeGeometry(wallCurve, 200, 0.28, 7, true);
    // Flatten slightly into a dry-stone wall profile
    wallGeo.scale(1, 0.85, 1);
    const wallMesh = new THREE.Mesh(wallGeo, curbMat);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    group.add(wallMesh);

    return group;
  }

  return {
    curve,
    length,
    roadWidth,
    bikeLaneOffset,
    samples,
    sampleAtDistance,
    groundHeightAt,
    signedDistanceToRoad,
    buildRoadMesh,
  };
}
