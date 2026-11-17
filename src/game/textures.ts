import * as THREE from 'three';

export interface ProceduralTextures {
  trackMap: THREE.CanvasTexture;
  terrainMap: THREE.CanvasTexture;
  woodMap: THREE.CanvasTexture;
  brickMap: THREE.CanvasTexture;
  hazardMap: THREE.CanvasTexture;
  shadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(
  maxAnisotropy: number,
): ProceduralTextures {
  // 1. Vibrant Tartan Arcade Running Track Texture
  const trackCanvas = document.createElement('canvas');
  trackCanvas.width = 512;
  trackCanvas.height = 512;
  const tctx = trackCanvas.getContext('2d')!;
  tctx.fillStyle = '#c84b31';
  tctx.fillRect(0, 0, 512, 512);

  // Subtle tartan rubber grain
  for (let i = 0; i < 1800; i++) {
    tctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    tctx.fillRect(
      Math.random() * 512,
      Math.random() * 512,
      2 + Math.random() * 3,
      2 + Math.random() * 3,
    );
  }
  // Outer white borders + red/white arcade curbs
  tctx.fillStyle = '#fef3c7';
  tctx.fillRect(14, 0, 12, 512);
  tctx.fillRect(486, 0, 12, 512);
  // Lane divider dashed lines
  tctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  for (let y = 0; y < 512; y += 64) {
    tctx.fillRect(170, y + 8, 8, 36);
    tctx.fillRect(334, y + 8, 8, 36);
  }
  const trackMap = finalizeColorTexture(trackCanvas, 1, 16, maxAnisotropy);

  // 2. Sunny Canyon Sandstone Ground Texture
  const terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = 256;
  terrainCanvas.height = 256;
  const gctx = terrainCanvas.getContext('2d')!;
  gctx.fillStyle = '#e7b97c';
  gctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 18; i++) {
    gctx.fillStyle = i % 2 === 0 ? 'rgba(217, 145, 78, 0.25)' : 'rgba(246, 212, 161, 0.25)';
    gctx.fillRect(0, i * 16, 256, 8);
  }
  for (let i = 0; i < 600; i++) {
    gctx.fillStyle = 'rgba(135, 76, 35, 0.14)';
    gctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2);
  }
  const terrainMap = finalizeColorTexture(terrainCanvas, 18, 24, maxAnisotropy);

  // 3. Warm Wood Plank Texture
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const wctx = woodCanvas.getContext('2d')!;
  wctx.fillStyle = '#b4692c';
  wctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    wctx.fillStyle = '#8b4c1b';
    wctx.fillRect(0, y, 256, 4);
    for (let s = 0; s < 14; s++) {
      wctx.fillStyle = 'rgba(70, 34, 10, 0.22)';
      wctx.fillRect(0, y + 8 + s * 3.8, 256, 1.5);
    }
  }
  const woodMap = finalizeColorTexture(woodCanvas, 1, 1, maxAnisotropy);

  // 4. Stylized Brick Masonry Texture
  const brickCanvas = document.createElement('canvas');
  brickCanvas.width = 256;
  brickCanvas.height = 256;
  const bctx = brickCanvas.getContext('2d')!;
  bctx.fillStyle = '#d6cfc7'; // mortar
  bctx.fillRect(0, 0, 256, 256);
  const rows = 6;
  const cols = 4;
  const bh = 256 / rows;
  const bw = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const shade = (r + c) % 3 === 0 ? '#b93829' : (r + c) % 2 === 0 ? '#cc4635' : '#a82f22';
      bctx.fillStyle = shade;
      bctx.fillRect(c * bw + offset + 3, r * bh + 3, bw - 6, bh - 6);
    }
  }
  const brickMap = finalizeColorTexture(brickCanvas, 1, 1, maxAnisotropy);

  // 5. Yellow/Black Arcade Hazard Stripes
  const hazardCanvas = document.createElement('canvas');
  hazardCanvas.width = 256;
  hazardCanvas.height = 256;
  const hctx = hazardCanvas.getContext('2d')!;
  hctx.fillStyle = '#facc15';
  hctx.fillRect(0, 0, 256, 256);
  hctx.fillStyle = '#18181b';
  for (let x = -256; x < 512; x += 48) {
    hctx.beginPath();
    hctx.moveTo(x, 0);
    hctx.lineTo(x + 24, 0);
    hctx.lineTo(x + 152, 256);
    hctx.lineTo(x + 128, 256);
    hctx.closePath();
    hctx.fill();
  }
  const hazardMap = finalizeColorTexture(hazardCanvas, 2, 1, maxAnisotropy);

  // 6. Soft Radial Contact Shadow Texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
  grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.2)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const shadowMap = new THREE.CanvasTexture(shadowCanvas);
  shadowMap.needsUpdate = true;

  return {
    trackMap,
    terrainMap,
    woodMap,
    brickMap,
    hazardMap,
    shadowMap,
    dispose: () => {
      trackMap.dispose();
      terrainMap.dispose();
      woodMap.dispose();
      brickMap.dispose();
      hazardMap.dispose();
      shadowMap.dispose();
    },
  };
}
