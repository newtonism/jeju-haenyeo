import * as THREE from 'three';

export interface SceneTextures {
  tigerFur: THREE.CanvasTexture;
  tigerHead: THREE.CanvasTexture;
  tigerTail: THREE.CanvasTexture;
  asphaltRoad: THREE.CanvasTexture;
  asphaltNormal: THREE.CanvasTexture;
  basaltStone: THREE.CanvasTexture;
  woodPlank: THREE.CanvasTexture;
  signBoard: THREE.CanvasTexture;
  milestoneSign: THREE.CanvasTexture;
  licensePlate: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  petal: THREE.CanvasTexture;
  dispose: () => void;
}

function configureColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function createTigerFurTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm Korean folk-art amber-tangerine coat gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#f39229');
  grad.addColorStop(0.55, '#e87d1a');
  grad.addColorStop(1, '#d66912');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle fur hair strokes
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 4 + Math.random() * 7;
    ctx.strokeStyle =
      Math.random() > 0.5 ? 'rgba(255, 200, 120, 0.14)' : 'rgba(155, 65, 5, 0.12)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y + len);
    ctx.stroke();
  }

  // Tapered organic tiger stripes wrapping horizontally
  ctx.fillStyle = '#1f1814';
  const stripeBands = [48, 118, 192, 266, 340, 414, 474];
  for (const yBase of stripeBands) {
    // Left & right flank stripes with organic taper
    for (const side of [0, 1]) {
      const startX = side === 0 ? 18 : 494;
      const dir = side === 0 ? 1 : -1;
      const len = 145 + Math.sin(yBase * 0.17) * 32;
      const thickness = 11 + Math.cos(yBase * 0.11) * 3;
      const wave = Math.sin(yBase * 0.23) * 10;

      ctx.beginPath();
      ctx.moveTo(startX, yBase - thickness);
      ctx.quadraticCurveTo(
        startX + dir * len * 0.55,
        yBase - thickness * 0.55 + wave,
        startX + dir * len,
        yBase + wave * 1.15
      );
      ctx.quadraticCurveTo(
        startX + dir * len * 0.55,
        yBase + thickness * 0.55 + wave,
        startX,
        yBase + thickness
      );
      ctx.closePath();
      ctx.fill();
    }
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

function createTigerHeadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base warm tangerine fur
  const grad = ctx.createRadialGradient(256, 230, 40, 256, 256, 290);
  grad.addColorStop(0, '#f89b35');
  grad.addColorStop(0.6, '#ea7f1b');
  grad.addColorStop(1, '#cf6310');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Fur texture grain
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.strokeStyle =
      Math.random() > 0.5 ? 'rgba(255, 210, 140, 0.13)' : 'rgba(140, 55, 5, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y + 5);
    ctx.stroke();
  }

  // In Three.js SphereGeometry, UV u=0.5 is +X (or depending on rotation: let's align face at u=0.5, v=0.5)
  // Draw forehead 王 (King) tiger mark centered at u=0.5 (x=256), above eye line (y=170)
  ctx.strokeStyle = '#1d1612';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 11;

  // Top horizontal bar
  ctx.beginPath();
  ctx.moveTo(222, 132);
  ctx.quadraticCurveTo(256, 138, 290, 132);
  ctx.stroke();

  // Middle horizontal bar
  ctx.beginPath();
  ctx.moveTo(228, 156);
  ctx.quadraticCurveTo(256, 160, 284, 156);
  ctx.stroke();

  // Bottom horizontal bar
  ctx.beginPath();
  ctx.moveTo(216, 180);
  ctx.quadraticCurveTo(256, 185, 296, 180);
  ctx.stroke();

  // Vertical stroke connecting the three
  ctx.beginPath();
  ctx.moveTo(256, 128);
  ctx.lineTo(256, 184);
  ctx.stroke();

  // Cheek and temple stripes (left and right of face)
  ctx.fillStyle = '#1d1612';
  const drawStripe = (x1: number, y1: number, x2: number, y2: number, w: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1 - w);
    ctx.quadraticCurveTo((x1 + x2) * 0.5, (y1 + y2) * 0.5 - w * 0.5, x2, y2);
    ctx.quadraticCurveTo((x1 + x2) * 0.5, (y1 + y2) * 0.5 + w * 0.5, x1, y1 + w);
    ctx.closePath();
    ctx.fill();
  };

  // Left cheek stripes
  drawStripe(115, 225, 190, 238, 8);
  drawStripe(105, 258, 185, 266, 9);
  drawStripe(120, 292, 192, 295, 7);

  // Right cheek stripes
  drawStripe(397, 225, 322, 238, 8);
  drawStripe(407, 258, 327, 266, 9);
  drawStripe(392, 292, 320, 295, 7);

  // Back of head stripes (near u=0 and u=1)
  for (const yPos of [140, 195, 250, 305, 355]) {
    drawStripe(0, yPos, 85, yPos + 12, 10);
    drawStripe(512, yPos, 427, yPos + 12, 10);
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

function createTigerTailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ee8520';
  ctx.fillRect(0, 0, 256, 256);

  // Ring bands along V (length of tail)
  ctx.fillStyle = '#1f1814';
  const bands = [26, 72, 118, 164, 210];
  for (const y of bands) {
    ctx.fillRect(0, y, 256, 18);
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

function createAsphaltRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base weathered Korean coastal asphalt
  ctx.fillStyle = '#383d45';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tire wear tracks along both driving lanes
  const leftLaneGrad = ctx.createLinearGradient(80, 0, 210, 0);
  leftLaneGrad.addColorStop(0, 'rgba(20, 23, 28, 0)');
  leftLaneGrad.addColorStop(0.5, 'rgba(20, 23, 28, 0.14)');
  leftLaneGrad.addColorStop(1, 'rgba(20, 23, 28, 0)');
  ctx.fillStyle = leftLaneGrad;
  ctx.fillRect(80, 0, 130, 512);

  const rightLaneGrad = ctx.createLinearGradient(302, 0, 432, 0);
  rightLaneGrad.addColorStop(0, 'rgba(20, 23, 28, 0)');
  rightLaneGrad.addColorStop(0.5, 'rgba(20, 23, 28, 0.14)');
  rightLaneGrad.addColorStop(1, 'rgba(20, 23, 28, 0)');
  ctx.fillStyle = rightLaneGrad;
  ctx.fillRect(302, 0, 130, 512);

  // Fine asphalt mineral grain
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)';
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, 2, 2);
  }

  // Crisp white outer shoulder edge lines
  ctx.fillStyle = '#edf2f7';
  ctx.fillRect(20, 0, 10, 512);
  ctx.fillRect(482, 0, 10, 512);

  // Classic Korean coastal road dashed yellow center line
  ctx.fillStyle = '#f5b82e';
  for (let y = 16; y < 512; y += 128) {
    ctx.fillRect(251, y, 10, 74);
  }

  const tex = configureColorTexture(canvas, maxAnisotropy, 1, 1);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createAsphaltNormalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const nx = 128 + (Math.random() - 0.5) * 28;
    const ny = 128 + (Math.random() - 0.5) * 28;
    data[i] = nx;
    data[i + 1] = ny;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 36);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createBasaltStoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3c4047';
  ctx.fillRect(0, 0, 256, 256);

  // Rounded volcanic basalt stones stacked in Jeju Dol-dam style
  for (let row = 0; row < 6; row++) {
    const y = row * 43 + 21;
    const offset = (row % 2) * 22;
    for (let col = -1; col < 6; col++) {
      const x = col * 48 + offset + 24;
      const rx = 18 + Math.random() * 5;
      const ry = 15 + Math.random() * 4;
      const v = 64 + Math.floor(Math.random() * 34);
      ctx.fillStyle = `rgb(${v}, ${v + 3}, ${v + 7})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, (Math.random() - 0.5) * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#26292e';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // Volcanic pores
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = 'rgba(20, 22, 26, 0.35)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }

  return configureColorTexture(canvas, maxAnisotropy, 3, 1);
}

function createWoodPlankTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9c663b';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = y % 64 === 0 ? '#a46d41' : '#945f36';
    ctx.fillRect(0, y, 256, 30);
    ctx.fillStyle = '#5c381c';
    ctx.fillRect(0, y + 30, 256, 2);
  }

  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.strokeStyle = 'rgba(70, 38, 15, 0.18)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20 + Math.random() * 40, y);
    ctx.stroke();
  }

  return configureColorTexture(canvas, maxAnisotropy, 2, 2);
}

function createKoreanSignTexture(
  koTitle: string,
  enTitle: string,
  badge: string,
  bgColor: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Sign board background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 256);

  // Crisp inner white border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 484, 228);

  // Top badge strip
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(24, 24, 464, 52);

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(badge, 256, 59);

  // Korean Main Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(koTitle, 256, 138);

  // English Subtitle
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(enTitle, 256, 194);

  return configureColorTexture(canvas, maxAnisotropy);
}

function createLicensePlateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext('2d')!;

  // Reflective Korean motorcycle license plate aluminum-white surface
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 288);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.55, '#f6f9fc');
  bgGrad.addColorStop(1, '#e6edf5');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 288);

  // Outer Korean motorcycle plate deep navy-blue rounded border
  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  ctx.strokeStyle = '#1b3a8a';
  ctx.lineWidth = 14;
  drawRoundedRect(12, 12, 488, 264, 22);
  ctx.stroke();

  // Subtle inner hairline frame
  ctx.strokeStyle = 'rgba(27, 58, 138, 0.24)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(24, 24, 464, 240, 14);
  ctx.stroke();

  // Official Korean left seal cap (봉인) & right silver bolt tucked cleanly in top corners
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.arc(54, 48, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(54, 48, 7.5, 0, Math.PI * 2);
  ctx.stroke();

  const boltGrad = ctx.createRadialGradient(455, 45, 2, 458, 48, 13);
  boltGrad.addColorStop(0, '#f8fafc');
  boltGrad.addColorStop(0.7, '#94a3b8');
  boltGrad.addColorStop(1, '#475569');
  ctx.fillStyle = boltGrad;
  ctx.beginPath();
  ctx.arc(458, 48, 11, 0, Math.PI * 2);
  ctx.fill();

  // Extra-large, ultra-bold "제주" lettering filling the entire license plate
  ctx.font =
    '900 206px "Plus Jakarta Sans", "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Subtle stamped emboss drop shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.fillText('제주', 259, 159);

  // Thick stamped cobalt-navy main glyphs
  ctx.strokeStyle = '#102a78';
  ctx.lineWidth = 5;
  ctx.strokeText('제주', 256, 154);
  ctx.fillStyle = '#102a78';
  ctx.fillText('제주', 256, 154);

  return configureColorTexture(canvas, maxAnisotropy);
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(128, 128, 14, 128, 128, 124);
  grad.addColorStop(0, 'rgba(10, 16, 24, 0.58)');
  grad.addColorStop(0.55, 'rgba(10, 16, 24, 0.25)');
  grad.addColorStop(1, 'rgba(10, 16, 24, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createPetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.ellipse(32, 32, 16, 24, 0.35, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSceneTextures(maxAnisotropy: number): SceneTextures {
  const tigerFur = createTigerFurTexture(maxAnisotropy);
  const tigerHead = createTigerHeadTexture(maxAnisotropy);
  const tigerTail = createTigerTailTexture(maxAnisotropy);
  const asphaltRoad = createAsphaltRoadTexture(maxAnisotropy);
  const asphaltNormal = createAsphaltNormalTexture(maxAnisotropy);
  const basaltStone = createBasaltStoneTexture(maxAnisotropy);
  const woodPlank = createWoodPlankTexture(maxAnisotropy);
  const signBoard = createKoreanSignTexture(
    '제주 해안도로',
    'JEJU COASTAL ROAD · 4.2 km',
    'KOREA COASTAL ROUTE 07',
    '#0e5a6f',
    maxAnisotropy
  );
  const milestoneSign = createKoreanSignTexture(
    '호랑이 주의 · 서행',
    'SCENIC OVERLOOK AHEAD',
    'JEJU DOL-DAM WAY',
    '#14532d',
    maxAnisotropy
  );
  const licensePlate = createLicensePlateTexture(maxAnisotropy);
  const contactShadow = createContactShadowTexture();
  const petal = createPetalTexture();

  const all = [
    tigerFur,
    tigerHead,
    tigerTail,
    asphaltRoad,
    asphaltNormal,
    basaltStone,
    woodPlank,
    signBoard,
    milestoneSign,
    licensePlate,
    contactShadow,
    petal,
  ];

  return {
    tigerFur,
    tigerHead,
    tigerTail,
    asphaltRoad,
    asphaltNormal,
    basaltStone,
    woodPlank,
    signBoard,
    milestoneSign,
    licensePlate,
    contactShadow,
    petal,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
