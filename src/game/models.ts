import * as THREE from 'three';
import { ObstacleKind, PowerUpKind } from './rules';
import { ProceduralTextures } from './textures';

export interface HeroRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  mouthMesh: THREE.Mesh;
  bandanaTailL: THREE.Mesh;
  bandanaTailR: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kickAuraRing: THREE.Mesh;
  contactShadow: THREE.Mesh;
}

export function createHeroModel(textures: ProceduralTextures): HeroRig {
  const root = new THREE.Group();

  // Contact shadow disc grounded at y = 0.02
  const shadowGeo = new THREE.CircleGeometry(0.95, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.shadowMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  // Materials with deliberate roughness/metalness variation (>= 0.25 delta)
  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x10b981, // Vibrant emerald python-striker suit
    roughness: 0.58,
    metalness: 0.08,
  });
  const trimGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.24,
    metalness: 0.65,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xfdba74,
    roughness: 0.7,
    metalness: 0.02,
  });
  const bandanaMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.8,
    metalness: 0.02,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.14,
    metalness: 0.78,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.4,
    metalness: 0.15,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0,
  });

  // Body pivot around hip height (0.95m)
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.95;
  root.add(bodyGroup);

  // 1. Sculpted beveled torso (ExtrudeGeometry)
  const torsoShape = new THREE.Shape();
  torsoShape.moveTo(-0.32, 0);
  torsoShape.lineTo(0.32, 0);
  torsoShape.lineTo(0.42, 0.76);
  torsoShape.lineTo(-0.42, 0.76);
  torsoShape.closePath();

  const torsoGeo = new THREE.ExtrudeGeometry(torsoShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 2,
  });
  torsoGeo.center();
  const torsoMesh = new THREE.Mesh(torsoGeo, suitMat);
  torsoMesh.position.y = 0.42;
  torsoMesh.castShadow = true;
  bodyGroup.add(torsoMesh);

  // 2. Gold striker chest V-emblem & belt
  const beltMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.14, 0.52),
    trimGoldMat,
  );
  beltMesh.position.y = 0.06;
  beltMesh.castShadow = true;
  bodyGroup.add(beltMesh);

  const emblemMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    trimGoldMat,
  );
  emblemMesh.scale.set(1.2, 1.3, 0.45);
  emblemMesh.position.set(0, 0.5, -0.25);
  bodyGroup.add(emblemMesh);

  // Back jersey python-crest stripe + shoulder pads for strong 3rd-person read
  const backCrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.52, 0.08),
    trimGoldMat,
  );
  backCrest.position.set(0, 0.46, 0.26);
  bodyGroup.add(backCrest);

  [-0.48, 0.48].forEach((sx) => {
    const pad = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      trimGoldMat,
    );
    pad.scale.set(1.1, 0.75, 1.0);
    pad.position.set(sx, 0.76, 0);
    bodyGroup.add(pad);
  });

  // 3. Expressive Cartoon Head + Headband + Open Scream Mouth
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.96, 0);
  bodyGroup.add(headGroup);

  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 18, 16),
    skinMat,
  );
  headMesh.position.y = 0.28;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Headband ring
  const bandMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.375, 0.375, 0.14, 18),
    bandanaMat,
  );
  bandMesh.position.y = 0.42;
  headGroup.add(bandMesh);

  // Bandana fluttering tail ribbons (facing camera / trailing behind +Z)
  const tailGeo = new THREE.BoxGeometry(0.11, 0.05, 0.45);
  const bandanaTailL = new THREE.Mesh(tailGeo, bandanaMat);
  bandanaTailL.position.set(-0.14, 0.42, 0.44);
  bandanaTailL.rotation.y = -0.25;
  headGroup.add(bandanaTailL);

  const bandanaTailR = new THREE.Mesh(tailGeo, bandanaMat);
  bandanaTailR.position.set(0.14, 0.4, 0.44);
  bandanaTailR.rotation.y = 0.25;
  headGroup.add(bandanaTailR);

  // Cool sporty visor facing forward (-Z)
  const visorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.16, 0.18),
    visorMat,
  );
  visorMesh.position.set(0, 0.32, -0.3);
  headGroup.add(visorMesh);

  // Expressive scream mouth (opens wide when screaming!)
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x7f1d1d });
  const mouthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 10),
    mouthMat,
  );
  mouthMesh.scale.set(1.2, 0.4, 0.6);
  mouthMesh.position.set(0, 0.14, -0.33);
  headGroup.add(mouthMesh);

  // 4 & 5. Articulated Left & Right Arms
  const makeArm = (side: -1 | 1): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.52, 0.72, 0);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.1, 0.34, 4, 8),
      suitMat,
    );
    upperArm.position.y = -0.2;
    upperArm.castShadow = true;
    armPivot.add(upperArm);

    const glove = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10),
      bandanaMat,
    );
    glove.position.y = -0.45;
    glove.castShadow = true;
    armPivot.add(glove);

    return armPivot;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);
  bodyGroup.add(armL, armR);

  // 6 & 7. Articulated Left & Right Legs with oversized cartoon kicks!
  const makeLeg = (side: -1 | 1): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.21, 0, 0);

    const legCol = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.125, 0.46, 4, 10),
      suitMat,
    );
    legCol.position.y = -0.34;
    legCol.castShadow = true;
    legPivot.add(legCol);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.48),
      shoeMat,
    );
    shoe.position.set(0, -0.78, -0.1);
    shoe.castShadow = true;
    legPivot.add(shoe);

    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.08, 0.52),
      soleMat,
    );
    sole.position.set(0, -0.9, -0.1);
    legPivot.add(sole);

    return legPivot;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  bodyGroup.add(legL, legR);

  // 8. Glowing Power Aura Ring beneath character (pulses during power-ups / super kick)
  const auraGeo = new THREE.RingGeometry(0.75, 1.15, 28);
  auraGeo.rotateX(-Math.PI / 2);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const kickAuraRing = new THREE.Mesh(auraGeo, auraMat);
  kickAuraRing.position.y = 0.04;
  root.add(kickAuraRing);

  return {
    root,
    bodyGroup,
    headGroup,
    mouthMesh,
    bandanaTailL,
    bandanaTailR,
    armL,
    armR,
    legL,
    legR,
    kickAuraRing,
    contactShadow,
  };
}

export function createObstacleModel(
  kind: ObstacleKind,
  textures: ProceduralTextures,
): THREE.Group {
  const group = new THREE.Group();

  // Ground contact shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: textures.shadowMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
  );
  shadow.position.y = 0.02;
  group.add(shadow);

  if (kind === 'hurdle') {
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.3,
      metalness: 0.72,
    });
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.45,
      metalness: 0.08,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.05,
    });

    // Feet & uprights
    [-1.1, 1.1].forEach((x) => {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.9), steelMat);
      foot.position.set(x, 0.06, 0);
      foot.castShadow = true;
      group.add(foot);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.15, 10), steelMat);
      post.position.set(x, 0.6, 0);
      post.castShadow = true;
      group.add(post);
    });

    // Crossbar + white stripes
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 0.18), barMat);
    bar.position.y = 1.1;
    bar.castShadow = true;
    group.add(bar);

    [-0.75, 0, 0.75].forEach((sx) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.2), stripeMat);
      stripe.position.set(sx, 1.1, 0);
      group.add(stripe);
    });
  } else if (kind === 'wood_barrier') {
    const woodMat = new THREE.MeshStandardMaterial({
      map: textures.woodMap,
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.04,
    });
    const hazardMat = new THREE.MeshStandardMaterial({
      map: textures.hazardMap,
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.12,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.8,
    });

    // Twin A-frame posts
    [-1.25, 1.25].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.45, 0.34), woodMat);
      post.position.set(x, 0.725, 0);
      post.castShadow = true;
      group.add(post);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.4), ironMat);
      cap.position.set(x, 1.46, 0);
      group.add(cap);
    });

    // Lower timber planks + upper hazard warning plank
    const lowerPlank = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.42, 0.22), woodMat);
    lowerPlank.position.y = 0.52;
    lowerPlank.castShadow = true;
    group.add(lowerPlank);

    const upperPlank = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.44, 0.24), hazardMat);
    upperPlank.position.y = 1.18;
    upperPlank.castShadow = true;
    group.add(upperPlank);
  } else if (kind === 'moving_gate') {
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.35,
      metalness: 0.82,
    });
    const gateMat = new THREE.MeshStandardMaterial({
      map: textures.hazardMap,
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.32,
    });
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.1,
    });

    // Ground rail spanning track width
    const rail = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.14, 0.36), railMat);
    rail.position.y = 0.07;
    group.add(rail);

    // Moving slider sub-group named 'slider' so engine oscillates it horizontally
    const slider = new THREE.Group();
    slider.name = 'slider';

    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.45, 0.34), gateMat);
    panel.position.y = 0.86;
    panel.castShadow = true;
    slider.add(panel);

    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.18, 0.42), railMat);
    topFrame.position.y = 1.62;
    slider.add(topFrame);

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.24, 12), beaconMat);
    beacon.position.y = 1.82;
    slider.add(beacon);

    group.add(slider);
  } else if (kind === 'boulder') {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.9,
      metalness: 0.04,
      flatShading: true,
    });
    const accentRockMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.88,
      metalness: 0.06,
      flatShading: true,
    });
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x65a30d,
      roughness: 0.82,
      metalness: 0.0,
    });

    const boulderBody = new THREE.Group();
    boulderBody.name = 'boulderBody';
    boulderBody.position.y = 0.95;

    const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), rockMat);
    mainRock.scale.set(1.18, 0.98, 1.05);
    mainRock.castShadow = true;
    boulderBody.add(mainRock);

    // Embedded rock spurs for chunky silhouette
    const spur1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), accentRockMat);
    spur1.position.set(0.68, 0.22, 0.2);
    spur1.castShadow = true;
    boulderBody.add(spur1);

    const spur2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), accentRockMat);
    spur2.position.set(-0.62, -0.15, -0.35);
    spur2.castShadow = true;
    boulderBody.add(spur2);

    const mossCap = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 8), mossMat);
    mossCap.scale.set(1.3, 0.45, 1.1);
    mossCap.position.set(-0.1, 0.76, 0.1);
    boulderBody.add(mossCap);

    group.add(boulderBody);
  } else {
    // Reinforced Brick Wall (brick_wall)
    const brickMat = new THREE.MeshStandardMaterial({
      map: textures.brickMap,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
    });
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.75,
      metalness: 0.12,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.85,
    });

    const wallBlock = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.95, 0.68), brickMat);
    wallBlock.position.y = 0.975;
    wallBlock.castShadow = true;
    group.add(wallBlock);

    const coping = new THREE.Mesh(new THREE.BoxGeometry(3.12, 0.22, 0.82), concreteMat);
    coping.position.y = 2.02;
    coping.castShadow = true;
    group.add(coping);

    [-1.48, 1.48].forEach((x) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.05, 0.8), steelMat);
      pillar.position.set(x, 1.025, 0);
      pillar.castShadow = true;
      group.add(pillar);
    });

    // Center "SMASH!" warning diamond plate
    const badge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.25,
        metalness: 0.65,
      }),
    );
    badge.scale.set(1.1, 1.1, 0.3);
    badge.position.set(0, 1.08, 0.36);
    group.add(badge);
  }

  return group;
}

export function createPowerUpModel(
  kind: PowerUpKind,
  textures: ProceduralTextures,
): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: textures.shadowMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    }),
  );
  shadow.position.y = 0.02;
  group.add(shadow);

  const spinner = new THREE.Group();
  spinner.name = 'spinner';
  spinner.position.y = 1.25;
  group.add(spinner);

  if (kind === 'super_scream') {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.22,
      metalness: 0.78,
    });
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.45,
      metalness: 0.15,
    });

    // Megaphone horn cone + handle + sonic ring
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.82, 16, 1, true), goldMat);
    cone.rotation.z = -Math.PI / 2;
    spinner.add(cone);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), redMat);
    cap.position.x = -0.38;
    spinner.add(cap);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.07, 10, 24),
      goldMat,
    );
    spinner.add(ring);
  } else {
    // Double Kick: Electric cyan twin lightning/boot crest
    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.75,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.2,
    });

    [-0.2, 0.2].forEach((x, idx) => {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.44, 0.36), cyanMat);
      boot.position.set(x, idx === 0 ? 0.08 : -0.08, 0);
      boot.rotation.z = idx === 0 ? 0.22 : -0.22;
      spinner.add(boot);

      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.4), whiteMat);
      sole.position.set(x, (idx === 0 ? 0.08 : -0.08) - 0.22, 0);
      spinner.add(sole);
    });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.06, 10, 24),
      cyanMat,
    );
    spinner.add(ring);
  }

  return group;
}

export function createCanyonArch(accentColor: number): THREE.Group {
  const arch = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.55,
  });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.55,
    metalness: 0.08,
  });

  [-4.6, 4.6].forEach((x) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 6.2, 10), postMat);
    pillar.position.set(x, 3.1, 0);
    arch.add(pillar);
  });

  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.9, 0.45), bannerMat);
  crossbar.position.y = 5.8;
  arch.add(crossbar);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 0.16, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.6 }),
  );
  trim.position.y = 6.32;
  arch.add(trim);

  return arch;
}

export function createDesertCactus(scale = 1): THREE.Group {
  const cactus = new THREE.Group();
  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.78,
    metalness: 0.02,
  });
  const flowerMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    roughness: 0.5,
    metalness: 0.05,
  });

  const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 2.1, 4, 10), greenMat);
  trunk.position.y = 1.35;
  cactus.add(trunk);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.85, 4, 8), greenMat);
  armL.position.set(-0.48, 1.55, 0);
  armL.rotation.z = 0.55;
  cactus.add(armL);

  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.75, 4, 8), greenMat);
  armR.position.set(0.45, 1.8, 0);
  armR.rotation.z = -0.5;
  cactus.add(armR);

  const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), flowerMat);
  bloom.position.y = 2.75;
  cactus.add(bloom);

  cactus.scale.setScalar(scale);
  return cactus;
}
