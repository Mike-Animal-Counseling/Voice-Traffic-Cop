import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CENTER_X, CENTER_Y, WORLD_HEIGHT, WORLD_WIDTH } from '../game/constants';
import type { Axis, GamePhase, Pedestrian, Vehicle } from '../game/types';

interface ThreeGameWorldProps {
  vehicles: Vehicle[];
  pedestrians: Pedestrian[];
  activeAxis: Axis;
  congestion: number;
  emergencyStop: boolean;
  boostTimer: number;
  dangerFlash: number;
  delightFlash: number;
  phase: GamePhase;
}

interface LiveWorldState extends ThreeGameWorldProps {}

interface SignalRig {
  axis: Axis;
  red: THREE.MeshStandardMaterial;
  amber: THREE.MeshStandardMaterial;
  green: THREE.MeshStandardMaterial;
  group: THREE.Group;
}

interface VehicleRig extends THREE.Group {
  userData: {
    body: THREE.Group;
    wheels: THREE.Mesh[];
    exhaust: THREE.Mesh[];
    headlights: THREE.MeshStandardMaterial[];
    tailLights: THREE.MeshStandardMaterial[];
    lastPosition: number;
  };
}

interface PipRig extends THREE.Group {
  userData: {
    body: THREE.Group;
    head: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    baton: THREE.Group;
    ears: THREE.Mesh[];
  };
}

const WORLD_SCALE = 48;

const standardMaterial = (
  color: THREE.ColorRepresentation,
  roughness = 0.72,
  metalness = 0.04,
) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

const setShadows = <T extends THREE.Object3D>(object: T): T => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
};

const roundedMesh = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
) => new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 4, radius), material);

const createTree = (x: number, z: number, scale: number, phase: number) => {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13 * scale, 0.18 * scale, 1.35 * scale, 8),
    standardMaterial('#8a5534', 0.96),
  );
  trunk.position.y = 0.68 * scale;
  tree.add(trunk);

  const greens = ['#6d963f', '#7fa94b', '#5f873b'];
  for (let index = 0; index < 5; index += 1) {
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry((0.58 + (index % 2) * 0.08) * scale, 1),
      standardMaterial(greens[index % greens.length], 0.94),
    );
    const angle = (index / 5) * Math.PI * 2;
    crown.position.set(
      Math.cos(angle) * 0.34 * scale,
      (1.45 + (index % 3) * 0.18) * scale,
      Math.sin(angle) * 0.34 * scale,
    );
    crown.scale.y = 1.15;
    tree.add(crown);
  }
  tree.position.set(x, 0, z);
  tree.userData.phase = phase;
  return setShadows(tree);
};

const addWindowGrid = (building: THREE.Group, width: number, depth: number, height: number) => {
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#8ec7c0',
    emissive: '#e3a74d',
    emissiveIntensity: 0.18,
    roughness: 0.28,
    metalness: 0.08,
  });
  const rows = Math.max(1, Math.floor(height / 1.25));
  const columns = Math.max(2, Math.floor(width / 1.25));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const windowMesh = roundedMesh(0.38, 0.48, 0.07, 0.08, windowMaterial);
      windowMesh.position.set(
        -width / 2 + 0.62 + column * ((width - 1.24) / Math.max(1, columns - 1)),
        0.72 + row * 0.92,
        depth / 2 + 0.04,
      );
      building.add(windowMesh);
    }
  }
};

const createBuilding = (
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  color: string,
  roofColor: string,
) => {
  const building = new THREE.Group();
  const body = roundedMesh(width, height, depth, 0.26, standardMaterial(color, 0.9));
  body.position.y = height / 2;
  building.add(body);

  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(Math.max(width, depth) * 0.55, Math.max(width, depth) * 0.7, 0.72, 8),
    standardMaterial(roofColor, 0.86),
  );
  roof.position.y = height + 0.22;
  roof.scale.z = depth / width;
  building.add(roof);

  const awning = roundedMesh(width * 0.66, 0.16, 0.64, 0.08, standardMaterial('#e5c76f', 0.82));
  awning.position.set(0, 0.86, depth / 2 + 0.34);
  awning.rotation.x = -0.16;
  building.add(awning);
  addWindowGrid(building, width, depth, height);
  building.position.set(x, 0, z);
  return setShadows(building);
};

const createTrafficLight = (axis: Axis, x: number, z: number, rotation: number): SignalRig => {
  const group = new THREE.Group();
  const poleMaterial = standardMaterial('#283936', 0.42, 0.32);
  const housingMaterial = standardMaterial('#20312f', 0.52, 0.22);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 2.35, 12), poleMaterial);
  pole.position.y = 1.18;
  group.add(pole);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.18, 12), poleMaterial);
  base.position.y = 0.09;
  group.add(base);

  const housing = roundedMesh(0.54, 1.52, 0.48, 0.12, housingMaterial);
  housing.position.set(0, 2.42, 0);
  group.add(housing);

  const lensMaterials = ['#ff5348', '#ffc64b', '#5af0a1'].map(
    (color) => new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.08,
      roughness: 0.22,
      metalness: 0.05,
    }),
  );
  const [red, amber, green] = lensMaterials;
  lensMaterials.forEach((material, index) => {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), material);
    lens.scale.z = 0.32;
    lens.position.set(0, 2.88 - index * 0.47, -0.26);
    group.add(lens);

    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.3, 16, 1, true, 0, Math.PI),
      housingMaterial,
    );
    visor.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    visor.position.set(0, lens.position.y + 0.11, -0.34);
    group.add(visor);
  });

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.38, 10), standardMaterial('#d99a42', 0.65, 0.12));
  cap.position.set(0, 3.36, 0);
  group.add(cap);

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  setShadows(group);
  return { axis, red, amber, green, group };
};

const addHedgehogSpikes = (parent: THREE.Group) => {
  const spikeMaterial = standardMaterial('#5b3827', 0.94);
  for (let index = 0; index < 18; index += 1) {
    const band = index < 10 ? 0 : 1;
    const localIndex = band === 0 ? index : index - 10;
    const count = band === 0 ? 10 : 8;
    const angle = (localIndex / count) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.48, 7), spikeMaterial);
    spike.position.set(
      Math.cos(angle) * (band === 0 ? 0.54 : 0.43),
      band === 0 ? 0.04 : 0.34,
      Math.sin(angle) * (band === 0 ? 0.5 : 0.38) + 0.12,
    );
    spike.rotation.z = -Math.cos(angle) * 0.9;
    spike.rotation.x = Math.sin(angle) * 0.9;
    parent.add(spike);
  }
};

const createArm = (side: -1 | 1, uniformMaterial: THREE.Material, pawMaterial: THREE.Material) => {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.54, 1.04, 0);
  const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 6, 10), uniformMaterial);
  sleeve.position.y = -0.28;
  sleeve.rotation.z = side * -0.12;
  pivot.add(sleeve);
  const paw = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), pawMaterial);
  paw.position.set(side * 0.03, -0.62, 0);
  pivot.add(paw);
  return pivot;
};

const createPip = (): PipRig => {
  const pip = new THREE.Group() as PipRig;
  const fur = standardMaterial('#e9b06e', 0.92);
  const muzzle = standardMaterial('#f7d8a8', 0.94);
  const navy = standardMaterial('#1e474d', 0.74);
  const vest = standardMaterial('#e5a12f', 0.66);
  const dark = standardMaterial('#2e2722', 0.84);
  const body = new THREE.Group();
  pip.add(body);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 18), navy);
  torso.scale.set(0.92, 1.18, 0.82);
  torso.position.y = 0.84;
  body.add(torso);
  const vestPanel = roundedMesh(0.72, 0.68, 0.12, 0.14, vest);
  vestPanel.position.set(0, 0.92, -0.48);
  body.add(vestPanel);

  const head = new THREE.Group();
  head.position.y = 1.76;
  body.add(head);
  addHedgehogSpikes(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.58, 28, 20), fur);
  face.scale.z = 0.88;
  head.add(face);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), muzzle);
  snout.scale.set(1.14, 0.72, 0.8);
  snout.position.set(0, -0.12, -0.48);
  head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), dark);
  nose.position.set(0, -0.08, -0.7);
  head.add(nose);

  const ears: THREE.Mesh[] = [];
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), fur);
    ear.scale.set(0.8, 1.14, 0.48);
    ear.position.set(side * 0.43, 0.2, -0.12);
    head.add(ear);
    ears.push(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), dark);
    eye.position.set(side * 0.2, 0.05, -0.52);
    head.add(eye);
    const eyeSpark = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), standardMaterial('#ffffff', 0.2));
    eyeSpark.position.set(side * 0.18, 0.08, -0.585);
    head.add(eyeSpark);
  });

  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.27, 18), navy);
  hatCrown.position.y = 0.57;
  head.add(hatCrown);
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 20), navy);
  hatBrim.position.set(0, 0.44, -0.09);
  head.add(hatBrim);
  const badge = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), standardMaterial('#ffd15d', 0.42, 0.24));
  badge.scale.z = 0.28;
  badge.position.set(0, 0.58, -0.33);
  head.add(badge);

  const leftArm = createArm(-1, navy, fur);
  const rightArm = createArm(1, navy, fur);
  body.add(leftArm, rightArm);

  const baton = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.58, 12), dark);
  handle.position.y = -0.2;
  baton.add(handle);
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd85d',
    emissive: '#ffb92f',
    emissiveIntensity: 2.8,
    roughness: 0.28,
  });
  const glow = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 8, 14), glowMaterial);
  glow.position.y = -0.72;
  baton.add(glow);
  baton.position.set(0.06, -0.55, -0.02);
  rightArm.add(baton);

  const footMaterial = standardMaterial('#263432', 0.8);
  [-1, 1].forEach((side) => {
    const foot = roundedMesh(0.34, 0.22, 0.5, 0.14, footMaterial);
    foot.position.set(side * 0.27, 0.18, -0.12);
    body.add(foot);
  });

  pip.userData = { body, head, leftArm, rightArm, baton, ears };
  return setShadows(pip) as PipRig;
};

const vehiclePalette: Record<Vehicle['kind'], { body: string; roof: string; driver: string; accent: string }> = {
  bubble: { body: '#ec6a4f', roof: '#ff9d6a', driver: '#d87d2c', accent: '#f5d38b' },
  beetle: { body: '#f2b72c', roof: '#ffe49d', driver: '#f2dfbf', accent: '#7d4b2f' },
  snail: { body: '#4aa9c4', roof: '#eee1bf', driver: '#7aa05d', accent: '#bd7b3a' },
  hopper: { body: '#d66d2e', roof: '#ef9854', driver: '#c99a68', accent: '#6e4933' },
};

const createDriver = (kind: Vehicle['kind'], color: string) => {
  const driver = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), standardMaterial(color, 0.9));
  driver.add(head);
  const eyeMaterial = standardMaterial('#241f1b', 0.8);
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), eyeMaterial);
    eye.position.set(side * 0.075, 0.035, -0.205);
    driver.add(eye);
  });
  if (kind === 'beetle') {
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 4, 8), standardMaterial(color, 0.9));
      ear.position.set(side * 0.1, 0.25, 0);
      driver.add(ear);
    });
  } else if (kind === 'snail') {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 9), standardMaterial('#ad733e', 0.9));
    shell.position.set(0, 0, 0.16);
    driver.add(shell);
  } else {
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.19, 8), standardMaterial(color, 0.9));
      ear.position.set(side * 0.12, 0.2, 0);
      driver.add(ear);
    });
  }
  return driver;
};

const pedestrianPalette: Record<Pedestrian['species'], string> = {
  duck: '#f5d34f',
  ferret: '#b9784c',
  tortoise: '#79a262',
  otter: '#9b6847',
  gazelle: '#d6aa70',
  pigeon: '#7688a6',
};

const createPedestrian = (species: Pedestrian['species']) => {
  const group = new THREE.Group();
  const fur = standardMaterial(pedestrianPalette[species], 0.92);
  const accent = standardMaterial('#f4d4a2', 0.94);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), fur);
  body.scale.set(0.8, 1.2, 0.76);
  body.position.y = 0.35;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), fur);
  head.position.set(0, 0.67, -0.015);
  group.add(head);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), accent);
  muzzle.scale.z = 0.65;
  muzzle.position.set(0, 0.63, -0.15);
  group.add(muzzle);
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), standardMaterial('#27231f', 0.82));
    eye.position.set(side * 0.055, 0.7, -0.15);
    group.add(eye);
    const foot = roundedMesh(0.11, 0.07, 0.18, 0.045, standardMaterial('#4b4036', 0.9));
    foot.position.set(side * 0.09, 0.07, -0.035);
    group.add(foot);
  });
  if (species === 'duck') {
    const bill = roundedMesh(0.14, 0.05, 0.1, 0.035, standardMaterial('#ee8e36', 0.86));
    bill.position.set(0, 0.64, -0.2);
    group.add(bill);
  } else {
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 7), fur);
      ear.position.set(side * 0.09, 0.85, 0);
      group.add(ear);
    });
  }
  group.userData.body = body;
  group.userData.head = head;
  return setShadows(group);
};

const createVehicle = (kind: Vehicle['kind']): VehicleRig => {
  const palette = vehiclePalette[kind];
  const group = new THREE.Group() as VehicleRig;
  const bodyRig = new THREE.Group();
  group.add(bodyRig);

  const length = kind === 'snail' || kind === 'hopper' ? 1.48 : 1.18;
  const width = kind === 'hopper' ? 0.8 : 0.74;
  const body = roundedMesh(width, 0.4, length, 0.18, standardMaterial(palette.body, 0.45, 0.16));
  body.position.y = 0.45;
  bodyRig.add(body);

  const cabinLength = kind === 'hopper' ? 0.56 : length * 0.54;
  const cabin = roundedMesh(width * 0.84, 0.36, cabinLength, 0.16, standardMaterial(palette.roof, 0.38, 0.1));
  cabin.position.set(0, 0.78, kind === 'hopper' ? -0.25 : 0.03);
  bodyRig.add(cabin);

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: '#8bc4cf',
    emissive: '#3b6e78',
    emissiveIntensity: 0.08,
    roughness: 0.18,
    metalness: 0.15,
    transparent: true,
    opacity: 0.78,
  });
  const windshield = roundedMesh(width * 0.66, 0.22, 0.055, 0.06, glassMaterial);
  windshield.position.set(0, 0.79, -cabinLength / 2 - 0.03 + (kind === 'hopper' ? -0.25 : 0.03));
  windshield.rotation.x = -0.18;
  bodyRig.add(windshield);

  const driver = createDriver(kind, palette.driver);
  driver.position.set(0, 0.92, -0.14);
  bodyRig.add(driver);

  const wheels: THREE.Mesh[] = [];
  const wheelMaterial = standardMaterial('#27302f', 0.8, 0.1);
  const hubMaterial = standardMaterial(palette.accent, 0.48, 0.35);
  [-1, 1].forEach((side) => {
    [-1, 1].forEach((front) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.17, 16), wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * (width / 2 + 0.04), 0.29, front * length * 0.32);
      group.add(wheel);
      wheels.push(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.185, 14), hubMaterial);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      group.add(hub);
    });
  });

  const headlights: THREE.MeshStandardMaterial[] = [];
  const tailLights: THREE.MeshStandardMaterial[] = [];
  [-1, 1].forEach((side) => {
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: '#fff3b0',
      emissive: '#ffd35a',
      emissiveIntensity: 0.8,
      roughness: 0.24,
    });
    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), headlightMaterial);
    headlight.scale.z = 0.35;
    headlight.position.set(side * width * 0.3, 0.48, -length / 2 - 0.02);
    bodyRig.add(headlight);
    headlights.push(headlightMaterial);

    const tailMaterial = new THREE.MeshStandardMaterial({
      color: '#d9473d',
      emissive: '#ff3e32',
      emissiveIntensity: 0.22,
      roughness: 0.3,
    });
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), tailMaterial);
    tail.scale.z = 0.35;
    tail.position.set(side * width * 0.3, 0.47, length / 2 + 0.02);
    bodyRig.add(tail);
    tailLights.push(tailMaterial);
  });

  if (kind === 'hopper') {
    const cargo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 14), standardMaterial('#8d5b35', 0.96));
    cargo.rotation.z = Math.PI / 2;
    cargo.position.set(0, 1.05, 0.34);
    bodyRig.add(cargo);
  }

  const exhaustMaterial = new THREE.MeshStandardMaterial({
    color: '#d9e4df',
    transparent: true,
    opacity: 0,
    roughness: 1,
  });
  const exhaust = [0, 1, 2].map((index) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.08 + index * 0.025, 10, 8), exhaustMaterial.clone());
    puff.position.set((index - 1) * 0.05, 0.26, length / 2 + 0.12 + index * 0.13);
    group.add(puff);
    return puff;
  });

  group.userData = { body: bodyRig, wheels, exhaust, headlights, tailLights, lastPosition: 0 };
  return setShadows(group) as VehicleRig;
};

const createWorld = () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b9d9cb');
  scene.fog = new THREE.FogExp2('#d9c99e', 0.025);

  const roadMaterial = standardMaterial('#4d504d', 0.94);
  const sidewalkMaterial = standardMaterial('#d8be8d', 0.98);
  const grassMaterial = standardMaterial('#739c54', 0.98);
  const markingMaterial = new THREE.MeshStandardMaterial({ color: '#f6e5bd', roughness: 0.88 });
  const environment = new THREE.Group();
  scene.add(environment);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), grassMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  environment.add(ground);

  const verticalRoad = roundedMesh(4.5, 0.12, 22, 0.12, roadMaterial);
  verticalRoad.position.y = 0;
  environment.add(verticalRoad);
  const horizontalRoad = roundedMesh(34, 0.12, 4.5, 0.12, roadMaterial);
  horizontalRoad.position.y = 0.01;
  environment.add(horizontalRoad);

  const nsGlowMaterial = new THREE.MeshStandardMaterial({
    color: '#78e4b1', emissive: '#3fdc95', emissiveIntensity: 0.25, transparent: true, opacity: 0.06,
  });
  const ewGlowMaterial = nsGlowMaterial.clone();
  const nsGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 21), nsGlowMaterial);
  nsGlow.rotation.x = -Math.PI / 2;
  nsGlow.position.y = 0.075;
  environment.add(nsGlow);
  const ewGlow = new THREE.Mesh(new THREE.PlaneGeometry(33, 1.9), ewGlowMaterial);
  ewGlow.rotation.x = -Math.PI / 2;
  ewGlow.position.y = 0.078;
  environment.add(ewGlow);

  const cornerBlocks = [
    [-9.7, -6.8], [9.7, -6.8], [-9.7, 6.8], [9.7, 6.8],
  ];
  cornerBlocks.forEach(([x, z]) => {
    const block = roundedMesh(12.2, 0.22, 6.1, 0.35, sidewalkMaterial);
    block.position.set(x, 0.04, z);
    environment.add(block);
  });

  for (let index = -5; index <= 5; index += 1) {
    if (Math.abs(index) > 1) {
      const verticalDash = roundedMesh(0.09, 0.025, 0.62, 0.03, markingMaterial);
      verticalDash.position.set(0, 0.09, index * 1.6);
      environment.add(verticalDash);
      const horizontalDash = roundedMesh(0.62, 0.025, 0.09, 0.03, markingMaterial);
      horizontalDash.position.set(index * 2.2, 0.095, 0);
      environment.add(horizontalDash);
    }
  }

  [-3.0, 3.0].forEach((offset) => {
    for (let index = -4; index <= 4; index += 1) {
      const stripeHorizontal = roundedMesh(0.12, 0.035, 0.64, 0.025, markingMaterial);
      stripeHorizontal.position.set(index * 0.43, 0.105, offset);
      environment.add(stripeHorizontal);
      const stripeVertical = roundedMesh(0.64, 0.035, 0.12, 0.025, markingMaterial);
      stripeVertical.position.set(offset, 0.108, index * 0.43);
      environment.add(stripeVertical);
    }
  });

  const island = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.28, 12), standardMaterial('#e4c37e', 0.98));
  island.position.y = 0.16;
  environment.add(island);
  for (let index = 0; index < 12; index += 1) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), standardMaterial(index % 2 ? '#fff0bd' : '#f5d886', 0.92));
    const angle = (index / 12) * Math.PI * 2;
    petal.scale.set(1.45, 0.34, 0.78);
    petal.position.set(Math.cos(angle) * 0.92, 0.38, Math.sin(angle) * 0.92);
    petal.rotation.y = -angle;
    environment.add(petal);
  }

  const buildings = [
    createBuilding(-9.2, -6.8, 4.4, 3.8, 3.8, '#e9c780', '#526d62'),
    createBuilding(9.4, -6.9, 4.8, 3.8, 4.6, '#d9aa6b', '#a65335'),
    createBuilding(-10.3, 6.7, 5.2, 3.9, 4.25, '#e1b96f', '#4f6861'),
    createBuilding(9.7, 6.9, 4.8, 3.8, 3.7, '#efc57d', '#b65e37'),
    createBuilding(-15, -6.6, 3.8, 4.2, 3.2, '#dba967', '#4e6b64'),
    createBuilding(15.1, 6.8, 3.8, 4.1, 3.4, '#deb574', '#a75837'),
  ];
  buildings.forEach((building) => environment.add(building));

  const trees: THREE.Group[] = [];
  [
    [-6.2, -7.6], [-12.1, -7.5], [6.1, -7.6], [12.6, -7.2],
    [-6.2, 7.5], [-13.1, 7.2], [6.5, 7.5], [13.2, 7.1],
  ].forEach(([x, z], index) => {
    const tree = createTree(x, z, 0.9 + (index % 3) * 0.1, index * 0.73);
    trees.push(tree);
    environment.add(tree);
  });

  const signals = [
    createTrafficLight('northSouth', -2.72, -2.62, 0),
    createTrafficLight('northSouth', 2.72, 2.62, Math.PI),
    createTrafficLight('eastWest', 2.62, -2.72, -Math.PI / 2),
    createTrafficLight('eastWest', -2.62, 2.72, Math.PI / 2),
  ];
  signals.forEach((signal) => environment.add(signal.group));

  const pip = createPip();
  pip.position.set(0, 0.34, 0);
  pip.scale.setScalar(0.86);
  pip.rotation.y = Math.PI;
  environment.add(pip);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: '#8df2c7', emissive: '#54dca5', emissiveIntensity: 1.1, transparent: true, opacity: 0.36,
  });
  const voiceRings = [0, 1, 2].map((index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5 + index * 0.62, 0.035, 8, 64), ringMaterial.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.16;
    environment.add(ring);
    return ring;
  });

  const clouds = [0, 1, 2].map((index) => {
    const cloud = new THREE.Group();
    for (let puff = 0; puff < 5; puff += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.8 + (puff % 2) * 0.24, 16, 10),
        new THREE.MeshStandardMaterial({ color: '#fff6dc', transparent: true, opacity: 0.72, roughness: 1 }),
      );
      mesh.scale.y = 0.48;
      mesh.position.x = (puff - 2) * 0.82;
      cloud.add(mesh);
    }
    cloud.position.set(-16 + index * 12, 9.2 + index * 0.7, -9 - index * 2.8);
    scene.add(cloud);
    return cloud;
  });

  const moteGeometry = new THREE.BufferGeometry();
  const motePositions = new Float32Array(210 * 3);
  for (let index = 0; index < 210; index += 1) {
    motePositions[index * 3] = (Math.random() - 0.5) * 31;
    motePositions[index * 3 + 1] = 0.5 + Math.random() * 7;
    motePositions[index * 3 + 2] = (Math.random() - 0.5) * 18;
  }
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(
    moteGeometry,
    new THREE.PointsMaterial({ color: '#ffd88b', size: 0.045, transparent: true, opacity: 0.56 }),
  );
  scene.add(motes);

  return { scene, environment, signals, pip, trees, voiceRings, clouds, motes, nsGlowMaterial, ewGlowMaterial };
};

const directionRotation = (direction: Vehicle['direction']) => {
  if (direction === 'northbound') return 0;
  if (direction === 'southbound') return Math.PI;
  if (direction === 'eastbound') return -Math.PI / 2;
  return Math.PI / 2;
};

const reactionLabel = (state: LiveWorldState) => {
  if (state.emergencyStop) return 'Pip is holding every lane';
  if (state.congestion >= 82) return 'Pip is scrambling to clear the jam';
  if (state.congestion >= 62) return 'Pip is watching the queues closely';
  if (state.delightFlash > 0.35) return 'Pip celebrates a smooth crossing';
  if (state.boostTimer > 0.5) return 'Pip waves traffic through';
  return 'Pip is keeping watch';
};

export const ThreeGameWorld = (props: ThreeGameWorldProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const liveStateRef = useRef<LiveWorldState>(props);
  liveStateRef.current = props;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const { scene, signals, pip, trees, voiceRings, clouds, motes, nsGlowMaterial, ewGlowMaterial } = createWorld();
    const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 90);
    camera.position.set(11.6, 16.8, 16.8);
    camera.lookAt(0, 0.55, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setWebglUnavailable(true);
      return undefined;
    }
    const compactRender = window.matchMedia('(max-width: 760px)').matches || navigator.hardwareConcurrency <= 4;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactRender ? 1.25 : 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    const hemisphere = new THREE.HemisphereLight('#d8f1ea', '#8a6a45', 2.15);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#ffd39a', 4.25);
    sun.position.set(-9, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(compactRender ? 1024 : 2048, compactRender ? 1024 : 2048);
    sun.shadow.camera.left = -19;
    sun.shadow.camera.right = 19;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 45;
    sun.shadow.bias = -0.00025;
    scene.add(sun);

    const warmFill = new THREE.PointLight('#ffb55e', 22, 34, 2);
    warmFill.position.set(8, 7, 7);
    scene.add(warmFill);

    const vehicleRigs = new Map<number, VehicleRig>();
    const pedestrianRigs = new Map<number, THREE.Group>();
    const pointer = new THREE.Vector2();
    let nextPipActionAt = 2.4;
    let pipAction: 'watch' | 'wave' | 'inspect' | 'bounce' = 'watch';
    let raf = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const handlePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    };
    renderer.domElement.addEventListener('pointermove', handlePointer, { passive: true });

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const updateSignals = (state: LiveWorldState) => {
      signals.forEach((signal) => {
        const isGreen = !state.emergencyStop && state.activeAxis === signal.axis;
        const isAmber = !state.emergencyStop && isGreen && state.congestion > 72;
        signal.red.emissiveIntensity = state.emergencyStop || (!isGreen && !isAmber) ? 5.2 : 0.1;
        signal.amber.emissiveIntensity = isAmber ? 4.5 : 0.08;
        signal.green.emissiveIntensity = isGreen && !isAmber ? 5 : 0.08;
        signal.group.scale.y = 1 + Math.sin(elapsed * 1.6 + signal.group.position.x) * 0.004;
      });
    };

    const updateVehicles = (state: LiveWorldState, delta: number) => {
      const visible = new Set<number>();
      state.vehicles.forEach((vehicle) => {
        visible.add(vehicle.id);
        let rig = vehicleRigs.get(vehicle.id);
        if (!rig) {
          rig = createVehicle(vehicle.kind);
          rig.userData.lastPosition = vehicle.position;
          vehicleRigs.set(vehicle.id, rig);
          scene.add(rig);
        }

        const centerX = vehicle.axis === 'northSouth' ? CENTER_X + vehicle.laneOffset : vehicle.position;
        const centerY = vehicle.axis === 'eastWest' ? CENTER_Y + vehicle.laneOffset : vehicle.position;
        rig.position.set((centerX - WORLD_WIDTH / 2) / WORLD_SCALE, 0.12, (centerY - WORLD_HEIGHT / 2) / WORLD_SCALE);
        rig.rotation.y = directionRotation(vehicle.direction);

        const speedRatio = THREE.MathUtils.clamp(vehicle.speed / 86, 0, 1);
        const braking = vehicle.acceleration < -16;
        const waiting = vehicle.speed < 7 && vehicle.waitingTime > 0.6;
        rig.userData.body.position.y = 0.035 + Math.sin(elapsed * (5 + speedRatio * 8) + vehicle.wobbleSeed) * (waiting ? 0.035 : 0.018 + speedRatio * 0.025);
        rig.userData.body.rotation.x = THREE.MathUtils.lerp(
          rig.userData.body.rotation.x,
          THREE.MathUtils.clamp(-vehicle.acceleration * 0.0024, -0.11, 0.11),
          Math.min(1, delta * 8),
        );
        rig.userData.body.rotation.z = Math.sin(elapsed * 4.3 + vehicle.wobbleSeed) * (waiting ? 0.025 : 0.008);
        rig.userData.wheels.forEach((wheel) => {
          wheel.rotation.x -= vehicle.speed * delta * 0.055;
        });
        rig.userData.headlights.forEach((material) => {
          material.emissiveIntensity = state.boostTimer > 0.5 && vehicle.axis === state.activeAxis ? 4.8 : 0.8;
        });
        rig.userData.tailLights.forEach((material) => {
          material.emissiveIntensity = braking || waiting ? 5.5 : 0.22;
        });
        rig.userData.exhaust.forEach((puff, index) => {
          const material = puff.material as THREE.MeshStandardMaterial;
          const cycle = (elapsed * (waiting ? 0.72 : 1.25) + index * 0.34) % 1;
          material.opacity = (waiting || speedRatio > 0.16) ? Math.sin(cycle * Math.PI) * 0.24 : 0;
          puff.position.z = 0.78 + cycle * 0.65;
          puff.position.y = 0.24 + cycle * 0.22;
          puff.scale.setScalar(0.5 + cycle * 1.2);
        });
        rig.userData.lastPosition = vehicle.position;
      });

      vehicleRigs.forEach((rig, id) => {
        if (!visible.has(id)) {
          scene.remove(rig);
          rig.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((material) => material.dispose());
            }
          });
          vehicleRigs.delete(id);
        }
      });
    };

    const updatePedestrians = (state: LiveWorldState) => {
      const visible = new Set<number>();
      state.pedestrians.forEach((pedestrian) => {
        visible.add(pedestrian.id);
        let rig = pedestrianRigs.get(pedestrian.id);
        if (!rig) {
          rig = createPedestrian(pedestrian.species);
          pedestrianRigs.set(pedestrian.id, rig);
          scene.add(rig);
        }
        rig.position.x = (pedestrian.x - WORLD_WIDTH / 2) / WORLD_SCALE;
        rig.position.z = pedestrian.side === 'top' ? -4.35 : 4.35;
        rig.position.y = 0.18 + Math.sin(pedestrian.bob) * 0.045;
        rig.rotation.y = pedestrian.side === 'top' ? -Math.PI / 2 : Math.PI / 2;
        const body = rig.userData.body as THREE.Mesh;
        const head = rig.userData.head as THREE.Mesh;
        body.rotation.z = Math.sin(pedestrian.bob * 1.8) * 0.08;
        head.rotation.y = Math.sin(elapsed * 1.2 + pedestrian.id) * 0.22;
      });
      pedestrianRigs.forEach((rig, id) => {
        if (!visible.has(id)) {
          scene.remove(rig);
          pedestrianRigs.delete(id);
        }
      });
    };

    const updatePip = (state: LiveWorldState, delta: number) => {
      if (elapsed > nextPipActionAt) {
        const actions: Array<typeof pipAction> = ['watch', 'wave', 'inspect', 'bounce'];
        pipAction = actions[Math.floor(Math.random() * actions.length)];
        nextPipActionAt = elapsed + 2.4 + Math.random() * 3.4;
      }

      const emergency = state.emergencyStop;
      const jammed = state.congestion >= 72;
      const celebrating = state.delightFlash > 0.35;
      const boosted = state.boostTimer > 0.5;
      const wave = pipAction === 'wave' || boosted;
      const inspect = pipAction === 'inspect';
      const bounce = pipAction === 'bounce' || celebrating;
      const activeDirection = state.activeAxis === 'northSouth' ? Math.PI : Math.PI - 0.82;
      pip.rotation.y = THREE.MathUtils.lerp(pip.rotation.y, activeDirection, Math.min(1, delta * 3.5));
      pip.userData.body.position.y = 0.06 + Math.sin(elapsed * (bounce ? 6.5 : jammed ? 5 : 2.2)) * (bounce ? 0.12 : jammed ? 0.07 : 0.035);
      pip.userData.body.rotation.z = jammed ? Math.sin(elapsed * 9) * 0.055 : Math.sin(elapsed * 1.7) * 0.018;
      pip.userData.head.rotation.y = emergency ? Math.sin(elapsed * 7) * 0.18 : inspect ? Math.sin(elapsed * 1.6) * 0.42 : Math.sin(elapsed * 0.8) * 0.07;
      pip.userData.head.rotation.x = jammed ? -0.12 : celebrating ? 0.12 : Math.sin(elapsed * 1.1) * 0.035;
      pip.userData.leftArm.rotation.z = THREE.MathUtils.lerp(
        pip.userData.leftArm.rotation.z,
        emergency ? -1.55 : celebrating ? -2.2 : jammed ? -0.95 : wave ? -0.45 : -0.12,
        Math.min(1, delta * 7),
      );
      pip.userData.rightArm.rotation.z = THREE.MathUtils.lerp(
        pip.userData.rightArm.rotation.z,
        emergency ? 1.55 : celebrating ? 2.2 : wave ? 1.45 + Math.sin(elapsed * 8) * 0.35 : jammed ? 0.9 : 0.12,
        Math.min(1, delta * 7),
      );
      pip.userData.baton.rotation.z = boosted ? elapsed * 4 : Math.sin(elapsed * 1.8) * 0.12;
      pip.userData.ears.forEach((ear, index) => {
        ear.rotation.z = (index ? -1 : 1) * (jammed ? 0.38 + Math.sin(elapsed * 7) * 0.08 : Math.sin(elapsed * 1.7) * 0.05);
      });
    };

    const render = (now: number) => {
      const state = liveStateRef.current;
      const rawDelta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      const delta = state.phase === 'paused' ? rawDelta * 0.18 : rawDelta;
      lastTime = now;
      elapsed += delta;

      updateSignals(state);
      updateVehicles(state, delta);
      updatePedestrians(state);
      updatePip(state, delta);
      const activeBoost = state.boostTimer > 0.5;
      voiceRings.forEach((ring, index) => {
        const cycle = (elapsed * (activeBoost ? 1.35 : 0.72) + index * 0.31) % 1;
        const scale = 0.74 + cycle * (activeBoost ? 1.18 : 0.72);
        ring.scale.setScalar(scale);
        const material = ring.material as THREE.MeshStandardMaterial;
        material.opacity = state.emergencyStop ? (1 - cycle) * 0.58 : (1 - cycle) * (activeBoost ? 0.48 : 0.24);
        material.color.set(state.emergencyStop ? '#ff6c5f' : '#8df2c7');
        material.emissive.set(state.emergencyStop ? '#ff4036' : '#54dca5');
      });

      nsGlowMaterial.opacity = state.activeAxis === 'northSouth' && !state.emergencyStop ? 0.2 : 0.035;
      ewGlowMaterial.opacity = state.activeAxis === 'eastWest' && !state.emergencyStop ? 0.2 : 0.035;
      nsGlowMaterial.emissiveIntensity = activeBoost && state.activeAxis === 'northSouth' ? 1.5 : 0.25;
      ewGlowMaterial.emissiveIntensity = activeBoost && state.activeAxis === 'eastWest' ? 1.5 : 0.25;

      trees.forEach((tree) => {
        tree.rotation.z = Math.sin(elapsed * 0.72 + Number(tree.userData.phase)) * 0.018;
        tree.rotation.x = Math.cos(elapsed * 0.57 + Number(tree.userData.phase)) * 0.012;
      });
      clouds.forEach((cloud, index) => {
        cloud.position.x += delta * (0.22 + index * 0.035);
        if (cloud.position.x > 19) cloud.position.x = -19;
        cloud.position.y += Math.sin(elapsed * 0.3 + index) * delta * 0.03;
      });
      motes.rotation.y += delta * 0.018;
      motes.position.y = Math.sin(elapsed * 0.28) * 0.18;

      const dangerShake = state.dangerFlash * 0.16;
      const desiredX = 11.6 + pointer.x * 0.7 + Math.sin(elapsed * 0.09) * 0.22;
      const desiredY = 16.8 + pointer.y * 0.36;
      const desiredZ = 16.8 + Math.cos(elapsed * 0.08) * 0.24;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredX + (Math.random() - 0.5) * dangerShake, 0.035);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredY, 0.035);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredZ + (Math.random() - 0.5) * dangerShake, 0.035);
      camera.lookAt(pointer.x * 0.24, 0.58, -pointer.y * 0.16);
      sun.position.x = -9 + Math.sin(elapsed * 0.045) * 1.2;
      warmFill.intensity = 21 + Math.sin(elapsed * 0.4) * 1.4;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', handlePointer);
      vehicleRigs.clear();
      pedestrianRigs.clear();
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="three-world-shell">
      {webglUnavailable ? (
        <div className="three-world-fallback" role="img" aria-label="Juniper Junction intersection">
          <img src="/images/juniper-junction-world.png" alt="" />
          <strong>3D mode needs WebGL</strong>
          <span>The traffic game is still running with a lightweight scene.</span>
        </div>
      ) : (
        <div
          className="three-game-world"
          ref={mountRef}
          role="img"
          aria-label="A living 3D animal city intersection with animated traffic, Pip Bristle, and working traffic lights"
        />
      )}
      <div className="three-world-atmosphere" aria-hidden="true" />
      <div className={`pip-reaction pip-reaction--${props.congestion >= 72 || props.emergencyStop ? 'urgent' : 'calm'}`}>
        <span className="pip-reaction__dot" />
        <span>{reactionLabel(props)}</span>
      </div>
    </div>
  );
};
