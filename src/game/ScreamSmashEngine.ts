import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from '../audio/soundEngine';
import {
  createCanyonArch,
  createDesertCactus,
  createHeroModel,
  createObstacleModel,
  createPowerUpModel,
  HeroRig,
} from './models';
import {
  classifyVoicePower,
  computeRunSpeed,
  computeSpawnSpacing,
  evaluateKickHit,
  GameState,
  INITIAL_LIVES,
  INVULN_DURATION_SEC,
  KICK_ACTIVE_WINDOW_SEC,
  KICK_COOLDOWN_SEC,
  KickPowerTier,
  OBSTACLE_SPECS,
  ObstacleKind,
  POWERUP_DURATION_SEC,
  PowerUpKind,
  selectObstacleKind,
} from './rules';
import { createProceduralTextures, ProceduralTextures } from './textures';

export interface HudSnapshot {
  gameState: GameState;
  score: number;
  bestScore: number;
  distance: number;
  lives: number;
  maxLives: number;
  combo: number;
  smashedCount: number;
  superScreamTimer: number;
  doubleKickTimer: number;
  lastKickTier: KickPowerTier;
  lastEventText: string;
  lastEventId: number;
  hurtFlash: number;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onVolumeFrame: (volume: number, tier: KickPowerTier) => void;
  onStateChange: (state: GameState) => void;
}

interface ActiveObstacle {
  active: boolean;
  kind: ObstacleKind;
  hp: number;
  maxHp: number;
  z: number;
  baseX: number;
  phase: number;
  hitFlash: number;
  mesh: THREE.Group;
}

interface ActivePowerUp {
  active: boolean;
  kind: PowerUpKind;
  z: number;
  mesh: THREE.Group;
}

interface DebrisParticle {
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  mesh: THREE.Mesh;
}

interface ShockwaveRing {
  active: boolean;
  life: number;
  maxLife: number;
  speed: number;
  mesh: THREE.Mesh;
}

const BEST_SCORE_KEY = 'scream_smash_best_score_v1';

// Pre-allocated scratch math helpers (Zero-GC render loop)
const _tmpColor = new THREE.Color();

export class ScreamSmashEngine {
  private container: HTMLElement;
  private sound: SoundEngine;
  private callbacks: EngineCallbacks;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextures;
  private envMap: THREE.Texture;

  private hero: HeroRig;
  private trackMesh: THREE.Mesh;
  private terrainMesh: THREE.Mesh;
  private arches: THREE.Group[] = [];
  private cacti: THREE.Group[] = [];

  private obstacles: ActiveObstacle[] = [];
  private obstacleTemplates: Record<ObstacleKind, THREE.Group>;
  private powerUps: ActivePowerUp[] = [];
  private powerUpTemplates: Record<PowerUpKind, THREE.Group>;
  private debrisPool: DebrisParticle[] = [];
  private shockwavePool: ShockwaveRing[] = [];
  private debrisCursor = 0;

  private frameId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private resizeObserver: ResizeObserver;

  // Game state
  private gameState: GameState = 'title';
  private score = 0;
  private bestScore = 0;
  private distance = 0;
  private elapsedRunSec = 0;
  private lives = INITIAL_LIVES;
  private combo = 0;
  private smashedCount = 0;
  private nextSpawnInMeters = 18;
  private obstaclesSpawnedSincePowerup = 0;

  // Combat / Kick / Voice state
  private threshold = 0.24;
  private micGain = 1.9;
  private kickActiveTimer = 0;
  private kickCooldownTimer = 0;
  private currentKickTier: KickPowerTier = 'none';
  private kickHitApplied = false;
  private invulnTimer = 0;
  private hitstopTimer = 0;
  private deathDelayTimer = 0;
  private superScreamTimer = 0;
  private doubleKickTimer = 0;

  // Juice / Camera state
  private trauma = 0;
  private runCycle = 0;
  private lastStepHalf = 0;
  private hurtFlash = 0;
  private lastEventText = '';
  private lastEventId = 0;
  private hudSyncAccumulator = 0;
  private camPosCurrent = new THREE.Vector3(0, 4.4, 8.2);
  private camLookCurrent = new THREE.Vector3(0, 1.4, -6);

  constructor(
    container: HTMLElement,
    sound: SoundEngine,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.sound = sound;
    this.callbacks = callbacks;

    try {
      const saved = window.localStorage.getItem(BEST_SCORE_KEY);
      if (saved) this.bestScore = Math.max(0, parseInt(saved, 10) || 0);
    } catch {
      this.bestScore = 0;
    }

    // 1. Detect software WebGL
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Initialize Renderer
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    container.appendChild(this.renderer.domElement);

    // 3. Scene, Sky, Fog & RoomEnvironment
    this.scene = new THREE.Scene();
    const skyColor = 0xbae6fd;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.Fog(skyColor, 42, 118);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(54, width / height, 0.2, 160);
    this.camera.position.copy(this.camPosCurrent);
    this.camera.lookAt(this.camLookCurrent);

    // 4. 3-Point Warm/Cool Studio + Outdoor Sunlight Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0xd97736, 0.95);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d0, 2.25);
    sunLight.position.set(14, 24, 16);
    sunLight.castShadow = !this.isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 75;
    const d = 22;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.72);
    rimLight.position.set(-12, 10, -18);
    this.scene.add(rimLight);

    // 5. Procedural Textures & World Surfaces
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    // Wide surrounding sandstone desert ground (y = 0)
    this.terrainMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: this.textures.terrainMap,
        color: 0xffffff,
        roughness: 0.92,
        metalness: 0.0,
      }),
    );
    this.terrainMesh.position.set(0, 0, -45);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);

    // Elevated Tartan Running Track (y = 0.04 so zero Z-fighting)
    this.trackMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 160).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: this.textures.trackMap,
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0.04,
      }),
    );
    this.trackMesh.position.set(0, 0.04, -55);
    this.trackMesh.receiveShadow = true;
    this.scene.add(this.trackMesh);

    // Track side curbs
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.65,
      metalness: 0.05,
    });
    [-3.55, 3.55].forEach((x) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 160), curbMat);
      curb.position.set(x, 0.08, -55);
      curb.receiveShadow = true;
      this.scene.add(curb);
    });

    // Distant Canyon Mesas for natural outdoor horizon silhouette
    const mesaMat = new THREE.MeshStandardMaterial({
      color: 0xc26d3a,
      roughness: 0.9,
      metalness: 0.02,
      flatShading: true,
    });
    const mesaPositions = [
      [-34, -48, 14, 18],
      [38, -62, 18, 22],
      [-46, -90, 24, 26],
      [44, -95, 22, 24],
      [-22, -108, 16, 16],
      [26, -112, 18, 15],
    ];
    mesaPositions.forEach(([x, z, r, h]) => {
      const mesa = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.65, r, h, 7),
        mesaMat,
      );
      mesa.position.set(x, h * 0.5 - 0.5, z);
      this.scene.add(mesa);
    });

    // Scrolling Arcade Archways & Cacti
    const archColors = [0xef4444, 0x0ea5e9, 0x10b981, 0xf59e0b];
    for (let i = 0; i < 4; i++) {
      const arch = createCanyonArch(archColors[i % archColors.length]);
      arch.position.set(0, 0, -18 - i * 28);
      this.scene.add(arch);
      this.arches.push(arch);
    }

    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const cactus = createDesertCactus(0.85 + (i % 3) * 0.25);
      cactus.position.set(
        side * (6.2 + (i % 4) * 3.1),
        0,
        6 - i * 7.5,
      );
      cactus.rotation.y = i * 0.8;
      this.scene.add(cactus);
      this.cacti.push(cactus);
    }

    // 6. Hero Character
    this.hero = createHeroModel(this.textures);
    this.hero.root.position.set(0, 0.04, 0);
    this.scene.add(this.hero.root);

    // 7. Obstacle & Power-Up Templates + Pools
    this.obstacleTemplates = {
      hurdle: createObstacleModel('hurdle', this.textures),
      wood_barrier: createObstacleModel('wood_barrier', this.textures),
      moving_gate: createObstacleModel('moving_gate', this.textures),
      boulder: createObstacleModel('boulder', this.textures),
      brick_wall: createObstacleModel('brick_wall', this.textures),
    };

    for (let i = 0; i < 10; i++) {
      const holder = new THREE.Group();
      holder.visible = false;
      this.scene.add(holder);
      this.obstacles.push({
        active: false,
        kind: 'hurdle',
        hp: 1,
        maxHp: 1,
        z: -120,
        baseX: 0,
        phase: 0,
        hitFlash: 0,
        mesh: holder,
      });
    }

    this.powerUpTemplates = {
      super_scream: createPowerUpModel('super_scream', this.textures),
      double_kick: createPowerUpModel('double_kick', this.textures),
    };

    for (let i = 0; i < 3; i++) {
      const holder = new THREE.Group();
      holder.visible = false;
      this.scene.add(holder);
      this.powerUps.push({
        active: false,
        kind: 'super_scream',
        z: -120,
        mesh: holder,
      });
    }

    // 8. Zero-GC Pooled Debris & Shockwave Rings
    const debrisGeo = new THREE.DodecahedronGeometry(0.24, 0);
    for (let i = 0; i < 90; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.65,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(debrisGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.debrisPool.push({
        active: false,
        life: 0,
        maxLife: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        mesh,
      });
    }

    const ringGeo = new THREE.TorusGeometry(0.95, 0.11, 10, 28);
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwavePool.push({
        active: false,
        life: 0,
        maxLife: 0.45,
        speed: 22,
        mesh,
      });
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.seedTitleObstacles();
    this.stepTitleShowcase(0.016);
    this.renderer.render(this.scene, this.camera);

    this.pushHudSnapshot(true);
    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.render(this.scene, this.camera);
  }

  public setThreshold(value: number): void {
    this.threshold = Math.max(0.08, Math.min(0.75, value));
  }

  public setMicGain(value: number): void {
    this.micGain = Math.max(0.6, Math.min(4.0, value));
  }

  public startRun(): void {
    this.sound.unlock();
    this.sound.startMusic();
    this.resetWorldForRun();
    this.spawnObstacleAt('hurdle', -22);
    this.spawnObstacleAt('wood_barrier', -44);
    this.nextSpawnInMeters = 22;
    this.gameState = 'playing';
    document.body.dataset.state = 'playing';
    this.callbacks.onStateChange('playing');
    this.pushHudSnapshot(true);
  }

  public pauseRun(): void {
    if (this.gameState !== 'playing') return;
    this.gameState = 'paused';
    this.sound.stopMusic();
    document.body.dataset.state = 'paused';
    this.callbacks.onStateChange('paused');
    this.pushHudSnapshot(true);
  }

  public resumeRun(): void {
    if (this.gameState !== 'paused') return;
    this.sound.unlock();
    this.sound.startMusic();
    this.gameState = 'playing';
    document.body.dataset.state = 'playing';
    this.callbacks.onStateChange('playing');
    this.pushHudSnapshot(true);
  }

  public returnToTitle(): void {
    this.sound.stopMusic();
    this.resetWorldForRun();
    this.seedTitleObstacles();
    this.gameState = 'title';
    document.body.dataset.state = 'title';
    this.callbacks.onStateChange('title');
    this.pushHudSnapshot(true);
  }

  private resetWorldForRun(): void {
    this.score = 0;
    this.distance = 0;
    this.elapsedRunSec = 0;
    this.lives = INITIAL_LIVES;
    this.combo = 0;
    this.smashedCount = 0;
    this.nextSpawnInMeters = 20;
    this.obstaclesSpawnedSincePowerup = 0;

    this.kickActiveTimer = 0;
    this.kickCooldownTimer = 0;
    this.currentKickTier = 'none';
    this.kickHitApplied = false;
    this.invulnTimer = 0;
    this.hitstopTimer = 0;
    this.deathDelayTimer = 0;
    this.superScreamTimer = 0;
    this.doubleKickTimer = 0;
    this.trauma = 0;
    this.hurtFlash = 0;
    this.lastEventText = '';

    this.hero.root.visible = true;
    this.hero.root.position.set(0, 0.04, 0);
    this.hero.root.scale.set(1, 1, 1);

    for (const obs of this.obstacles) {
      obs.active = false;
      obs.mesh.visible = false;
      obs.mesh.clear();
    }
    for (const pu of this.powerUps) {
      pu.active = false;
      pu.mesh.visible = false;
      pu.mesh.clear();
    }
    for (const p of this.debrisPool) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const r of this.shockwavePool) {
      r.active = false;
      r.mesh.visible = false;
    }
  }

  public triggerManualKick(tier: KickPowerTier = 'normal'): void {
    if (this.gameState !== 'playing' || this.deathDelayTimer > 0) return;
    this.sound.unlock();
    const effectiveTier = this.superScreamTimer > 0 ? 'super' : tier;
    this.executeKick(effectiveTier);
  }

  private executeKick(tier: KickPowerTier): void {
    if (tier === 'none') return;
    if (this.kickCooldownTimer > 0 && tier !== 'super') return;
    if (this.kickActiveTimer > 0.24 && this.currentKickTier === tier) return;

    this.currentKickTier = tier;
    this.kickActiveTimer = KICK_ACTIVE_WINDOW_SEC;
    this.kickCooldownTimer = KICK_COOLDOWN_SEC;
    this.kickHitApplied = false;

    // Squash & stretch launch + sound
    this.hero.root.scale.set(0.86, 1.18, 1.08);
    this.sound.playKick(tier);

    // Spawn 1 (or 2 with Double Kick!) forward shockwave rings
    this.spawnShockwave(tier, 0);
    if (this.doubleKickTimer > 0) {
      this.spawnShockwave(tier, -1.2);
    }

    // Immediate hit check against nearest obstacle in front
    this.resolveKickHits();
  }

  private spawnShockwave(tier: KickPowerTier, zOffset: number): void {
    const ring = this.shockwavePool.find((r) => !r.active) ?? this.shockwavePool[0];
    ring.active = true;
    ring.life = 0;
    ring.maxLife = tier === 'super' ? 0.52 : 0.38;
    ring.speed = tier === 'super' ? 28 : 21;
    ring.mesh.visible = true;
    ring.mesh.position.set(0, 1.05, -0.8 + zOffset);
    ring.mesh.scale.setScalar(tier === 'super' ? 1.15 : 0.8);
    const mat = ring.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(
      this.doubleKickTimer > 0
        ? 0x22d3ee
        : tier === 'super'
          ? 0xfacc15
          : tier === 'normal'
            ? 0xf97316
            : 0xffffff,
    );
    mat.opacity = 0.95;
  }

  private spawnDebrisBurst(
    x: number,
    y: number,
    z: number,
    kind: ObstacleKind,
    count: number,
    powerScale: number,
  ): void {
    const palette: Record<ObstacleKind, number[]> = {
      hurdle: [0xf43f5e, 0xffffff, 0xcbd5e1],
      wood_barrier: [0xb4692c, 0xfacc15, 0x78350f],
      moving_gate: [0xfacc15, 0x334155, 0xef4444],
      boulder: [0x78716c, 0x57534e, 0x65a30d],
      brick_wall: [0xb93829, 0xd6cfc7, 0xfacc15],
    };
    const colors = palette[kind];

    for (let i = 0; i < count; i++) {
      const p = this.debrisPool[this.debrisCursor];
      this.debrisCursor = (this.debrisCursor + 1) % this.debrisPool.length;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.65 + Math.random() * 0.45;

      p.mesh.visible = true;
      p.mesh.position.set(
        x + (Math.random() - 0.5) * 1.8,
        y + Math.random() * 1.1,
        z + (Math.random() - 0.5) * 0.6,
      );
      const s = 0.6 + Math.random() * (0.75 * powerScale);
      p.mesh.scale.set(s, s * (0.7 + Math.random() * 0.6), s);
      (p.mesh.material as THREE.MeshStandardMaterial).color.setHex(
        colors[i % colors.length],
      );

      p.vx = (Math.random() - 0.5) * 14 * powerScale;
      p.vy = (4.5 + Math.random() * 8.5) * powerScale;
      p.vz = -(6 + Math.random() * 16) * powerScale;
      p.rx = (Math.random() - 0.5) * 16;
      p.ry = (Math.random() - 0.5) * 16;
    }
  }

  private seedTitleObstacles(): void {
    this.spawnObstacleAt('hurdle', -24);
    this.spawnObstacleAt('brick_wall', -48);
  }

  private spawnObstacleAt(kind: ObstacleKind, zPos: number): void {
    const slot = this.obstacles.find((o) => !o.active);
    if (!slot) return;

    const spec = OBSTACLE_SPECS[kind];

    slot.active = true;
    slot.kind = kind;
    slot.hp = spec.maxHp;
    slot.maxHp = spec.maxHp;
    slot.z = zPos;
    slot.baseX = 0;
    slot.phase = Math.random() * Math.PI * 2;
    slot.hitFlash = 0;

    slot.mesh.clear();
    slot.mesh.add(this.obstacleTemplates[kind].clone(true));
    slot.mesh.position.set(0, 0.04, slot.z);
    slot.mesh.scale.set(1, 1, 1);
    slot.mesh.rotation.set(0, 0, 0);
    slot.mesh.visible = true;
  }

  private spawnNextObstacle(): void {
    const kind = selectObstacleKind(this.distance, Math.random());
    this.spawnObstacleAt(kind, -68);

    // Periodically spawn a Power-Up between obstacles
    this.obstaclesSpawnedSincePowerup++;
    if (this.obstaclesSpawnedSincePowerup >= 5) {
      this.obstaclesSpawnedSincePowerup = 0;
      const puSlot = this.powerUps.find((p) => !p.active);
      if (puSlot) {
        const puKind: PowerUpKind =
          Math.random() < 0.5 ? 'super_scream' : 'double_kick';
        puSlot.active = true;
        puSlot.kind = puKind;
        puSlot.z = -102;
        puSlot.mesh.clear();
        puSlot.mesh.add(this.powerUpTemplates[puKind].clone(true));
        puSlot.mesh.position.set(0, 0.04, puSlot.z);
        puSlot.mesh.visible = true;
      }
    }
  }

  private resolveKickHits(): void {
    if (this.kickHitApplied || this.kickActiveTimer <= 0) return;

    const reachMinZ =
      this.doubleKickTimer > 0 || this.currentKickTier === 'super'
        ? -5.6
        : -4.2;
    const reachMaxZ = 0.85;

    // Find closest obstacle inside kick strike arc
    let best: ActiveObstacle | null = null;
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      if (obs.z >= reachMinZ && obs.z <= reachMaxZ) {
        if (!best || obs.z > best.z) {
          best = obs;
        }
      }
    }

    if (!best) return;

    const res = evaluateKickHit({
      kind: best.kind,
      currentHp: best.hp,
      tier: this.currentKickTier,
      combo: this.combo,
      doubleKickActive: this.doubleKickTimer > 0,
      superScreamActive: this.superScreamTimer > 0,
    });

    this.kickHitApplied = true;
    best.hp = res.newHp;
    best.hitFlash = 0.08;
    this.score += res.pointsAwarded;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        window.localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
      } catch {
        // ignore
      }
    }

    this.trauma = Math.min(1, this.trauma + res.shakeTrauma);
    this.hitstopTimer = Math.max(this.hitstopTimer, res.hitstopSec);

    const powerScale =
      this.currentKickTier === 'super'
        ? 1.45
        : this.currentKickTier === 'normal'
          ? 1.1
          : 0.85;

    this.spawnDebrisBurst(
      best.mesh.position.x,
      0.9,
      best.z,
      best.kind,
      res.debrisCount,
      powerScale,
    );
    this.sound.playSmash(best.kind, this.currentKickTier);

    if (res.destroyed) {
      best.active = false;
      best.mesh.visible = false;
      best.mesh.clear();
      this.combo += 1;
      this.smashedCount += 1;
      const label =
        this.currentKickTier === 'super'
          ? `SUPER SMASH! +${res.pointsAwarded}`
          : this.currentKickTier === 'normal'
            ? `SMASHED! +${res.pointsAwarded}`
            : `KICKED! +${res.pointsAwarded}`;
      this.lastEventText = label;
      this.lastEventId += 1;
    } else {
      // Knock obstacle forward slightly to give player room for follow-up scream!
      best.z -= 2.4;
      best.mesh.position.z = best.z;
      this.lastEventText = `CRACKED! SCREAM LOUDER! +${res.pointsAwarded}`;
      this.lastEventId += 1;
    }

    this.pushHudSnapshot(true);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = window.requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    // Always sample microphone volume cleanly so UI meter stays live
    const micVol = this.sound.sampleMicVolume(this.micGain);
    const voiceEval = classifyVoicePower(
      micVol,
      this.threshold,
      this.superScreamTimer > 0,
    );
    this.callbacks.onVolumeFrame(micVol, voiceEval.tier);

    // Update hero mouth openness from voice loudness!
    const mouthOpen = Math.max(0.25, Math.min(2.1, 0.35 + micVol * 2.2));
    this.hero.mouthMesh.scale.set(1.1 + micVol * 0.4, mouthOpen, 0.6);

    if (this.gameState === 'title') {
      this.stepTitleShowcase(dt);
    } else if (this.gameState === 'playing') {
      this.stepGameplay(dt, voiceEval.tier);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  private stepTitleShowcase(dt: number): void {
    // Gentle scenic runner idle-jog on the title screen
    const idleSpeed = 7.5;
    this.textures.trackMap.offset.y -= idleSpeed * dt * 0.062;
    this.textures.terrainMap.offset.y -= idleSpeed * dt * 0.05;

    for (const arch of this.arches) {
      arch.position.z += idleSpeed * dt;
      if (arch.position.z > 14) arch.position.z -= 112;
    }
    for (const cactus of this.cacti) {
      cactus.position.z += idleSpeed * dt;
      if (cactus.position.z > 16) cactus.position.z -= 120;
    }

    this.animateHeroRun(dt, idleSpeed);

    // Frame the runner & track to the right half so the title lockup sits over clear left canyon space
    const t = performance.now() * 0.0006;
    this.camPosCurrent.set(
      Math.sin(t) * 0.65 - 2.1,
      3.6 + Math.cos(t * 0.8) * 0.2,
      6.8,
    );
    this.camLookCurrent.set(-2.2, 1.35, -7.2);
    this.camera.position.copy(this.camPosCurrent);
    this.camera.lookAt(this.camLookCurrent);
  }

  private stepGameplay(dt: number, voiceTier: KickPowerTier): void {
    // Hurt vignette & camera trauma always decay in real dt (even during hitstop)
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    this.trauma = Math.max(0, this.trauma - dt * 1.9);

    // Trigger kick from live microphone volume
    if (voiceTier !== 'none' && this.deathDelayTimer <= 0) {
      this.executeKick(voiceTier);
    }

    if (this.deathDelayTimer > 0) {
      this.deathDelayTimer -= dt;
      this.stepDebrisAndRings(dt);
      this.applyGameplayCamera(dt, 10);
      if (this.deathDelayTimer <= 0) {
        this.gameState = 'gameover';
        this.sound.stopMusic();
        document.body.dataset.state = 'gameover';
        this.callbacks.onStateChange('gameover');
        this.pushHudSnapshot(true);
      }
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.applyGameplayCamera(dt, 14);
      return;
    }

    // Advance run metrics & difficulty ramp
    this.elapsedRunSec += dt;
    const speed = computeRunSpeed(this.distance, this.elapsedRunSec);
    const stepMeters = speed * dt;
    this.distance += stepMeters;
    this.score += stepMeters * 2.2;

    if (this.score > this.bestScore) {
      this.bestScore = Math.round(this.score);
    }

    // Timers
    if (this.kickActiveTimer > 0) {
      this.kickActiveTimer = Math.max(0, this.kickActiveTimer - dt);
      this.resolveKickHits();
    }
    if (this.kickCooldownTimer > 0) {
      this.kickCooldownTimer = Math.max(0, this.kickCooldownTimer - dt);
    }
    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
      this.hero.root.visible = Math.floor(this.invulnTimer * 16) % 2 === 0;
    } else {
      this.hero.root.visible = true;
    }

    if (this.superScreamTimer > 0) {
      this.superScreamTimer = Math.max(0, this.superScreamTimer - dt);
    }
    if (this.doubleKickTimer > 0) {
      this.doubleKickTimer = Math.max(0, this.doubleKickTimer - dt);
    }

    // Scroll world textures & props
    this.textures.trackMap.offset.y -= stepMeters * 0.062;
    this.textures.terrainMap.offset.y -= stepMeters * 0.05;

    for (const arch of this.arches) {
      arch.position.z += stepMeters;
      if (arch.position.z > 14) arch.position.z -= 112;
    }
    for (const cactus of this.cacti) {
      cactus.position.z += stepMeters;
      if (cactus.position.z > 16) cactus.position.z -= 120;
    }

    // Spawn obstacles
    this.nextSpawnInMeters -= stepMeters;
    if (this.nextSpawnInMeters <= 0) {
      this.spawnNextObstacle();
      this.nextSpawnInMeters = computeSpawnSpacing(this.distance);
    }

    // Update obstacles & check player collision
    const nowSec = performance.now() * 0.001;
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      obs.z += stepMeters;
      obs.mesh.position.z = obs.z;

      if (obs.kind === 'moving_gate') {
        const slider = obs.mesh.getObjectByName('slider');
        if (slider) {
          slider.position.x = Math.sin(nowSec * 3.2 + obs.phase) * 1.45;
        }
      } else if (obs.kind === 'boulder') {
        const boulderBody = obs.mesh.getObjectByName('boulderBody');
        if (boulderBody) {
          boulderBody.rotation.x += dt * 4.5;
          boulderBody.position.y =
            0.95 + Math.abs(Math.sin(nowSec * 5 + obs.phase)) * 0.28;
        }
      }

      if (obs.hitFlash > 0) {
        obs.hitFlash = Math.max(0, obs.hitFlash - dt);
        obs.mesh.scale.setScalar(1 + obs.hitFlash * 1.5);
      } else {
        obs.mesh.scale.setScalar(1);
      }

      // Check body collision if obstacle reaches hero
      if (obs.z >= -0.65 && obs.z <= 0.72) {
        if (this.kickActiveTimer > 0) {
          this.resolveKickHits();
        }
        if (obs.active) {
          if (this.invulnTimer <= 0) {
            this.handlePlayerHurt(obs);
          } else {
            // Knock aside cleanly during invuln
            obs.active = false;
            obs.mesh.visible = false;
            obs.mesh.clear();
          }
        }
      }

      if (obs.z > 10) {
        obs.active = false;
        obs.mesh.visible = false;
        obs.mesh.clear();
      }
    }

    // Update Power-Ups
    for (const pu of this.powerUps) {
      if (!pu.active) continue;
      pu.z += stepMeters;
      pu.mesh.position.z = pu.z;
      const spinner = pu.mesh.getObjectByName('spinner');
      if (spinner) {
        spinner.rotation.y += dt * 3.4;
        spinner.position.y = 1.25 + Math.sin(nowSec * 4.2) * 0.16;
      }

      if (pu.z >= -1.1 && pu.z <= 1.0) {
        pu.active = false;
        pu.mesh.visible = false;
        pu.mesh.clear();
        this.sound.playPowerup();
        if (pu.kind === 'super_scream') {
          this.superScreamTimer = POWERUP_DURATION_SEC;
          this.lastEventText = 'SUPER SCREAM ACTIVATED!';
        } else {
          this.doubleKickTimer = POWERUP_DURATION_SEC;
          this.lastEventText = 'DOUBLE KICK ACTIVATED!';
        }
        this.lastEventId += 1;
        this.score += 150;
        this.pushHudSnapshot(true);
      } else if (pu.z > 10) {
        pu.active = false;
        pu.mesh.visible = false;
        pu.mesh.clear();
      }
    }

    // Animate Hero, Debris & Camera
    this.animateHeroRun(dt, speed);
    this.stepDebrisAndRings(dt);
    this.applyGameplayCamera(dt, speed);

    // Throttle periodic HUD updates to ~10Hz
    this.hudSyncAccumulator += dt;
    if (this.hudSyncAccumulator >= 0.1) {
      this.hudSyncAccumulator = 0;
      this.pushHudSnapshot(false);
    }
  }

  private handlePlayerHurt(obs: ActiveObstacle): void {
    this.lives = Math.max(0, this.lives - 1);
    this.combo = 0;
    this.hurtFlash = 1;
    this.trauma = 0.85;
    this.invulnTimer = INVULN_DURATION_SEC;
    this.hero.root.scale.set(1.25, 0.72, 1.15);

    this.spawnDebrisBurst(0, 0.8, obs.z, obs.kind, 10, 0.75);
    obs.active = false;
    obs.mesh.visible = false;
    obs.mesh.clear();

    if (this.lives <= 0) {
      this.sound.playGameOver();
      this.deathDelayTimer = 0.55;
      this.lastEventText = 'KNOCKED OUT!';
      this.lastEventId += 1;
    } else {
      this.sound.playHurt();
      this.lastEventText = `OUCH! ${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`;
      this.lastEventId += 1;
    }

    try {
      window.localStorage.setItem(
        BEST_SCORE_KEY,
        String(Math.round(this.bestScore)),
      );
    } catch {
      // ignore
    }
    this.pushHudSnapshot(true);
  }

  private animateHeroRun(dt: number, speed: number): void {
    // Exponentially damp squash-and-stretch back to (1,1,1)
    const dampFactor = 1 - Math.exp(-14 * dt);
    this.hero.root.scale.x += (1 - this.hero.root.scale.x) * dampFactor;
    this.hero.root.scale.y += (1 - this.hero.root.scale.y) * dampFactor;
    this.hero.root.scale.z += (1 - this.hero.root.scale.z) * dampFactor;

    // Power-up ground aura ring
    const auraMat = this.hero.kickAuraRing.material as THREE.MeshBasicMaterial;
    if (this.superScreamTimer > 0 || this.doubleKickTimer > 0) {
      auraMat.opacity = 0.65 + Math.sin(performance.now() * 0.012) * 0.2;
      _tmpColor.setHex(this.superScreamTimer > 0 ? 0xfacc15 : 0x22d3ee);
      auraMat.color.copy(_tmpColor);
      this.hero.kickAuraRing.rotation.z += dt * 4;
    } else {
      auraMat.opacity = 0;
    }

    this.runCycle += speed * dt * 0.78;
    const stepHalf = Math.floor(this.runCycle / Math.PI);
    if (this.gameState === 'playing' && stepHalf !== this.lastStepHalf) {
      this.lastStepHalf = stepHalf;
      if (this.kickActiveTimer <= 0) {
        this.sound.playFootstep();
      }
    }

    const s = Math.sin(this.runCycle);

    // Bandana flutter
    this.hero.bandanaTailL.rotation.x = 0.15 + Math.sin(this.runCycle * 1.4) * 0.22;
    this.hero.bandanaTailR.rotation.x = 0.15 - Math.sin(this.runCycle * 1.4) * 0.22;

    if (this.kickActiveTimer > 0) {
      // Exaggerated windup -> high-kick smash -> recovery curve!
      const p = 1 - this.kickActiveTimer / KICK_ACTIVE_WINDOW_SEC;
      const kickSwing = Math.sin(Math.min(1, p * 1.25) * Math.PI);
      const powerMult = this.currentKickTier === 'super' ? 1.32 : 1.08;

      this.hero.legR.rotation.x = -1.65 * kickSwing * powerMult;
      this.hero.legL.rotation.x = 0.45 * kickSwing;
      this.hero.bodyGroup.rotation.x = 0.28 * kickSwing;
      this.hero.bodyGroup.rotation.y = -0.35 * kickSwing;
      this.hero.bodyGroup.position.y = 0.95 + kickSwing * 0.48;
      this.hero.armL.rotation.x = -0.9 * kickSwing;
      this.hero.armR.rotation.x = 0.9 * kickSwing;
    } else {
      // Crisp athletic running gait
      this.hero.legL.rotation.x = s * 0.95;
      this.hero.legR.rotation.x = -s * 0.95;
      this.hero.armL.rotation.x = -s * 0.85;
      this.hero.armR.rotation.x = s * 0.85;
      this.hero.bodyGroup.rotation.x = -0.14;
      this.hero.bodyGroup.rotation.y = s * 0.08;
      this.hero.bodyGroup.position.y = 0.95 + Math.abs(Math.cos(this.runCycle)) * 0.14;
    }
  }

  private stepDebrisAndRings(dt: number): void {
    for (const p of this.debrisPool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 26 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.15) {
        p.mesh.position.y = 0.15;
        p.vy = Math.abs(p.vy) * 0.42;
      }
      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.y += p.ry * dt;
      const fade = 1 - p.life / p.maxLife;
      p.mesh.scale.multiplyScalar(0.98 + fade * 0.02);
    }

    for (const ring of this.shockwavePool) {
      if (!ring.active) continue;
      ring.life += dt;
      if (ring.life >= ring.maxLife) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const t = ring.life / ring.maxLife;
      ring.mesh.position.z -= ring.speed * dt;
      ring.mesh.scale.setScalar(0.9 + t * 2.2);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    }
  }

  private applyGameplayCamera(dt: number, speed: number): void {
    const damp = 1 - Math.exp(-8 * dt);
    const targetFov = 54 + Math.min(11, (speed - 11.5) * 0.65) + (this.superScreamTimer > 0 ? 4 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * damp;
    this.camera.updateProjectionMatrix();

    const shake = this.trauma * this.trauma;
    const shakeX = (Math.random() * 2 - 1) * 0.38 * shake;
    const shakeY = (Math.random() * 2 - 1) * 0.32 * shake;

    this.camPosCurrent.x += (0 - this.camPosCurrent.x) * damp;
    this.camPosCurrent.y += (4.35 - this.camPosCurrent.y) * damp;
    this.camPosCurrent.z += (7.6 - this.camPosCurrent.z) * damp;

    this.camLookCurrent.x += (0 - this.camLookCurrent.x) * damp;
    this.camLookCurrent.y += (1.35 - this.camLookCurrent.y) * damp;
    this.camLookCurrent.z += (-8.5 - this.camLookCurrent.z) * damp;

    this.camera.position.set(
      this.camPosCurrent.x + shakeX,
      this.camPosCurrent.y + shakeY,
      this.camPosCurrent.z,
    );
    this.camera.lookAt(this.camLookCurrent);
  }

  private pushHudSnapshot(force: boolean): void {
    if (!force && this.disposed) return;
    this.callbacks.onHudUpdate({
      gameState: this.gameState,
      score: Math.round(this.score),
      bestScore: Math.round(this.bestScore),
      distance: Math.round(this.distance),
      lives: this.lives,
      maxLives: INITIAL_LIVES,
      combo: this.combo,
      smashedCount: this.smashedCount,
      superScreamTimer: this.superScreamTimer,
      doubleKickTimer: this.doubleKickTimer,
      lastKickTier: this.currentKickTier,
      lastEventText: this.lastEventText,
      lastEventId: this.lastEventId,
      hurtFlash: this.hurtFlash,
    });
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.textures.dispose();
    this.envMap.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
