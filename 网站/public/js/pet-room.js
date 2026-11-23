import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function setShadow(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = child.userData.castShadow !== false;
    child.receiveShadow = child.userData.receiveShadow !== false;
  });
}

function preparePetMaterials(model, species) {
  let texturedMaterialCount = 0;
  model.traverse((child) => {
    if (!child.isMesh) return;
    const position = child.geometry.getAttribute('position');
    const normal = child.geometry.getAttribute('normal');
    if (position && normal) {
      const amount = species === 'tom' ? 0.0013 : 0.0018;
      for (let i = 0; i < position.count; i += 1) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        const grain =
          Math.sin(x * 83.1 + y * 47.7 + z * 61.3) * 0.55 +
          Math.sin(x * 173.2 - y * 113.9 + z * 91.7) * 0.3;
        position.setXYZ(
          i,
          x + normal.getX(i) * grain * amount,
          y + normal.getY(i) * grain * amount,
          z + normal.getZ(i) * grain * amount
        );
      }
      position.needsUpdate = true;
      child.geometry.computeVertexNormals();
    }
    const previous = Array.isArray(child.material) ? child.material : [child.material];
    const next = previous.map((source) => {
      if (!source) return source;
      if (source.map) source.map.colorSpace = THREE.SRGBColorSpace;
      for (const texture of [
        source.map,
        source.normalMap,
        source.roughnessMap,
        source.metalnessMap,
        source.aoMap,
      ]) {
        if (texture) texture.anisotropy = 8;
      }
      if (source.map) texturedMaterialCount += 1;
      if (source.map && source.normalMap && source.roughnessMap) {
        return source;
      }
      const glossy = /Eye|Pupil|Nose/.test(source.name || '');
      const material = new THREE.MeshPhysicalMaterial({
        map: source.map || null,
        normalMap: source.normalMap || null,
        normalScale: source.normalScale ? source.normalScale.clone() : new THREE.Vector2(1, 1),
        roughnessMap: source.roughnessMap || null,
        metalnessMap: source.metalnessMap || null,
        aoMap: source.aoMap || null,
        color: source.color ? source.color.clone() : new THREE.Color(0xffffff),
        roughness: source.roughness ?? (glossy ? 0.18 : species === 'tom' ? 0.87 : 0.92),
        metalness: source.metalness ?? 0,
        clearcoat: glossy ? 0.9 : 0.06,
        clearcoatRoughness: glossy ? 0.12 : 0.8,
        sheen: glossy ? 0.08 : 0.34,
        sheenRoughness: 0.9,
        sheenColor: species === 'tom' ? 0xbac5cc : 0xe4c59b,
        transparent: source.transparent || false,
        opacity: source.opacity ?? 1,
        side: source.side ?? THREE.FrontSide,
      });
      material.name = source.name || '';
      return material;
    });
    child.material = Array.isArray(child.material) ? next : next[0];
    const facialDetail = /Muzzle|Brow|Ear|Beard|Nose|Eye|Pupil|Glint|Whisker|Mouth|Tongue/i.test(
      child.name
    );
    child.userData.castShadow = !facialDetail;
    child.userData.receiveShadow = false;
  });
  model.userData.texturedMaterialCount = texturedMaterialCount;
}

function alignModel(model, desiredHeight, yaw, proportions = { x: 1, y: 1, z: 1 }) {
  model.updateWorldMatrix(true, true);
  let box = new THREE.Box3().setFromObject(model);
  const initialSize = box.getSize(new THREE.Vector3());
  const scale = desiredHeight / Math.max(initialSize.y, 0.001);
  model.scale.set(
    scale * proportions.x,
    scale * proportions.y,
    scale * proportions.z
  );
  model.rotation.y = yaw;
  model.updateWorldMatrix(true, true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

function makeHeartSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.translate(32, 31);
  ctx.fillStyle = 'rgba(213, 139, 154, .82)';
  ctx.beginPath();
  ctx.moveTo(0, 19);
  ctx.bezierCurveTo(-28, -1, -21, -24, 0, -12);
  ctx.bezierCurveTo(21, -24, 28, -1, 0, 19);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRoom(scene) {
  const room = new THREE.Group();
  scene.add(room);

  const wall = new THREE.Mesh(
    new THREE.CircleGeometry(4.8, 80),
    new THREE.MeshStandardMaterial({
      color: 0xf4ede4,
      roughness: 0.96,
      metalness: 0,
    })
  );
  wall.position.set(0, 1.75, -3.15);
  wall.scale.set(1.45, 0.9, 1);
  wall.receiveShadow = true;
  room.add(wall);

  const arch = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 0.93, 72, 1, 0, Math.PI),
    new THREE.MeshStandardMaterial({
      color: 0xd7c8b8,
      roughness: 0.8,
      metalness: 0,
    })
  );
  arch.position.set(0, 1.95, -3.08);
  arch.scale.set(1.15, 1.1, 1);
  room.add(arch);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0xd8c3ad,
      roughness: 0.72,
      metalness: 0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.75,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.015;
  floor.receiveShadow = true;
  room.add(floor);

  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(2.15, 80),
    new THREE.MeshStandardMaterial({
      color: 0xeadfd4,
      roughness: 1,
      metalness: 0,
    })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(1.35, 1, 0.78);
  rug.position.set(0.15, 0.012, 0.5);
  rug.receiveShadow = true;
  room.add(rug);

  const rugRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.52, 0.018, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xc9aeb0, transparent: true, opacity: 0.35 })
  );
  rugRing.rotation.x = -Math.PI / 2;
  rugRing.scale.set(1.35, 0.78, 1);
  rugRing.position.set(0.15, 0.025, 0.5);
  room.add(rugRing);

  const wood = new THREE.MeshStandardMaterial({ color: 0xb58e6c, roughness: 0.8 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xeee4d8, roughness: 0.88 });
  const sage = new THREE.MeshStandardMaterial({ color: 0x98aa9d, roughness: 0.9 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xd5a4ac, roughness: 0.86 });

  const tree = new THREE.Group();
  tree.position.set(-2.25, 0, -1.25);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.82, 0.16, 32),
    cream
  );
  base.position.y = 0.08;
  tree.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.1, 20), wood);
  post.position.y = 1.1;
  tree.add(post);
  for (const [y, radius, height] of [
    [0.58, 0.52, 0.13],
    [1.18, 0.44, 0.12],
    [1.7, 0.37, 0.11],
  ]) {
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), cream);
    shelf.position.set(0.22, y, 0.05);
    tree.add(shelf);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.92, 0.03, 8, 40), rose);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0.22, y + height / 2, 0.05);
    tree.add(rim);
  }
  const house = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.62, 0.62), sage);
  house.position.set(-0.08, 0.54, -0.12);
  tree.add(house);
  const door = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 28),
    new THREE.MeshStandardMaterial({ color: 0x806b60, roughness: 1 })
  );
  door.position.set(-0.08, 0.54, 0.2);
  tree.add(door);
  setShadow(tree);
  room.add(tree);

  const sofa = new THREE.Group();
  sofa.position.set(0.08, 0, -2.16);
  const sofaBase = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 1.78, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xb9c4b9, roughness: 0.95 })
  );
  sofaBase.rotation.z = Math.PI / 2;
  sofaBase.scale.set(1, 0.84, 0.92);
  sofaBase.position.y = 0.38;
  sofa.add(sofaBase);
  const sofaBack = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.8, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xc8d0c6, roughness: 0.96 })
  );
  sofaBack.position.set(0, 0.78, -0.29);
  sofaBack.rotation.x = -0.08;
  sofa.add(sofaBack);
  for (const x of [-0.58, 0.58]) {
    const cushion = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.78, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xd7ddd3, roughness: 0.96 })
    );
    cushion.rotation.z = Math.PI / 2;
    cushion.scale.set(1, 0.84, 0.8);
    cushion.position.set(x, 0.56, 0.02);
    sofa.add(cushion);
  }
  for (const x of [-1.23, 1.23]) {
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.55, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0xaebbb0, roughness: 0.95 })
    );
    arm.position.set(x, 0.5, 0.02);
    arm.scale.z = 1.3;
    sofa.add(arm);
  }
  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.48, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xd7a4ad, roughness: 0.92 })
  );
  pillow.position.set(-0.75, 0.78, -0.04);
  pillow.rotation.z = 0.18;
  sofa.add(pillow);
  for (const x of [-1.02, 1.02]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.22, 12), wood);
    leg.position.set(x, 0.1, 0.18);
    sofa.add(leg);
  }
  setShadow(sofa);
  room.add(sofa);

  const bed = new THREE.Group();
  bed.position.set(2.3, 0, 0.2);
  const bedBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.53, 1.15, 8, 24), rose);
  bedBase.rotation.z = Math.PI / 2;
  bedBase.scale.y = 0.28;
  bedBase.position.y = 0.22;
  bed.add(bedBase);
  const cushion = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.92, 8, 24), cream);
  cushion.rotation.z = Math.PI / 2;
  cushion.scale.y = 0.2;
  cushion.position.y = 0.33;
  bed.add(cushion);
  setShadow(bed);
  room.add(bed);

  const bathtub = new THREE.Group();
  bathtub.position.set(2.8, 0, -1.2);
  const tubOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.54, 0.52, 40, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xe8e3dc,
      roughness: 0.42,
      clearcoat: 0.42,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    })
  );
  tubOuter.position.y = 0.3;
  bathtub.add(tubOuter);
  const tubRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.66, 0.055, 12, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0xf1ece5,
      roughness: 0.3,
      clearcoat: 0.5,
    })
  );
  tubRim.rotation.x = Math.PI / 2;
  tubRim.position.y = 0.56;
  bathtub.add(tubRim);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.56, 40),
    new THREE.MeshPhysicalMaterial({
      color: 0xaecdd5,
      roughness: 0.08,
      transmission: 0.18,
      transparent: true,
      opacity: 0.78,
      clearcoat: 0.8,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.38;
  bathtub.add(water);
  const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 24, Math.PI), rose);
  faucet.position.set(0.52, 0.72, -0.2);
  faucet.rotation.y = Math.PI / 2;
  bathtub.add(faucet);
  setShadow(bathtub);
  room.add(bathtub);

  const bowls = new THREE.Group();
  bowls.position.set(-1.15, 0, 1.4);
  for (const [x, color] of [
    [-0.3, 0xc98b96],
    [0.3, 0x8ca9b8],
  ]) {
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.15, 0.11, 28),
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.35,
        clearcoat: 0.6,
        clearcoatRoughness: 0.24,
      })
    );
    bowl.position.set(x, 0.06, 0);
    bowl.castShadow = true;
    bowls.add(bowl);
  }
  room.add(bowls);

  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.29, 0.28, 28, 1, true), wood);
  basket.position.set(-2.05, 0.14, 1.18);
  basket.material.side = THREE.DoubleSide;
  basket.castShadow = true;
  room.add(basket);

  return { room, floor, bowls, bed, tree, sofa, bathtub, water };
}

function createParticles(scene) {
  const texture = makeHeartSprite();
  const count = 64;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 7;
    positions[i * 3 + 1] = Math.random() * 3.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: texture,
    color: 0xf6dedf,
    size: 0.13,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return { points, phases, positions };
}

function addFurnitureLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff5e9, 0x7d8e83, 1.45));
  const key = new THREE.DirectionalLight(0xfff5e8, 3.25);
  key.position.set(-3.5, 5.5, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe4e6, 1.05);
  fill.position.set(3.5, 2.6, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xcbded7, 1.35);
  rim.position.set(1.5, 3.4, -4);
  scene.add(rim);
}

async function loadPet(loader, slug) {
  const gltf = await loader.loadAsync(`/pets/models/${slug}.glb`);
  const model = gltf.scene;
  const isTom = slug === 'tom';
  preparePetMaterials(model, slug);
  alignModel(
    model,
    isTom ? 1.18 : 1,
    0,
    isTom ? { x: 0.9, y: 1, z: 0.78 } : { x: 0.92, y: 1.04, z: 0.76 }
  );
  model.userData.baseScale = model.scale.clone();
  const root = new THREE.Group();
  root.add(model);
  root.position.set(isTom ? -1.05 : 1.12, 0, isTom ? 0.15 : 0.06);
  root.userData = {
    slug,
    baseX: root.position.x,
    layoutX: root.position.x,
    baseZ: root.position.z,
    baseScale: 1,
    model,
  };
  setShadow(root);
  return { root, model, mixer: null };
}

export function initPetRoom(root, options = {}) {
  const canvas = root.querySelector('#petCanvas');
  const fallback = root.querySelector('[data-pet-fallback]');
  const fallbackImage = root.querySelector('[data-fallback-image]');
  const loading = root.querySelector('[data-pet-loading]');
  const viewToggle = root.querySelector('[data-pet-view-toggle]');
  const viewLabel = root.querySelector('[data-pet-view-label]');
  const onFallback = options.onFallback || (() => {});
  const onSelect = options.onSelect || (() => {});
  const onAffection = options.onAffection || (() => {});
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!canvas) throw new Error('pet canvas is missing');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    if (fallback) fallback.hidden = false;
    if (loading) loading.hidden = true;
    onFallback(error);
    return { playAction() {}, selectPet() {}, setSleeping() {}, dispose() {} };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xe9dfd5, 0.031);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
  camera.position.set(0, 2.02, 5.1);
  camera.lookAt(0, 0.76, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.24));
  addFurnitureLights(scene);
  const room = createRoom(scene);
  const hearts = createParticles(scene);
  root.dataset.roomFeatures = 'sofa,bathtub,tree,bed,bowls,basket';

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 24, 18),
    new THREE.MeshPhysicalMaterial({
      color: 0xc77887,
      roughness: 0.34,
      clearcoat: 0.68,
      clearcoatRoughness: 0.22,
    })
  );
  ball.position.set(2.85, 0.15, 1.45);
  ball.castShadow = true;
  scene.add(ball);

  const teaser = new THREE.Group();
  const wand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 1.7, 10),
    new THREE.MeshStandardMaterial({ color: 0x91705a, roughness: 0.72 })
  );
  wand.rotation.z = Math.PI * 0.34;
  wand.position.set(0, 0.82, 0);
  teaser.add(wand);
  const feather = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, 0.4, 6, 12),
    new THREE.MeshPhysicalMaterial({
      color: 0xd88599,
      roughness: 0.45,
      sheen: 0.55,
      sheenColor: 0xffd9de,
    })
  );
  feather.position.set(-0.58, 1.55, 0);
  feather.rotation.z = -0.45;
  teaser.add(feather);
  teaser.position.set(-1.75, 0, 1.1);
  teaser.visible = false;
  teaser.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(teaser);

  const petals = new THREE.Group();
  for (let i = 0; i < 22; i += 1) {
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + Math.random() * 0.035, 8, 6),
      new THREE.MeshPhysicalMaterial({
        color: 0xddecf1,
        roughness: 0.05,
        transmission: 0.35,
        transparent: true,
        opacity: 0.74,
      })
    );
    bubble.userData.phase = Math.random() * Math.PI * 2;
    petals.add(bubble);
  }
  petals.visible = false;
  scene.add(petals);

  const pets = new Map();
  const selectable = [];
  const loader = new GLTFLoader();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const clock = new THREE.Clock();
  let activeAction = null;
  let activeSlug = root.dataset.activePet || 'tom';
  let pointerDown = null;
  let dragging = false;
  let orbitYaw = 0;
  let orbitPitch = 0;
  let cameraDistance = 5.1;
  let cameraHeight = 2.02;
  let cameraFocusY = 0.76;
  let cameraMode = 'room';
  let disposed = false;
  const lookAtTarget = new THREE.Vector3(0, 0.76, 0);

  root.dataset.cameraMode = cameraMode;

  function layoutPets() {
    const compact = camera.aspect < 0.95;
    for (const [slug, pet] of pets) {
      pet.root.userData.baseX = compact
        ? slug === activeSlug
          ? 0
          : 4.4
        : pet.root.userData.layoutX;
    }
  }

  function showFallback(error) {
    if (fallback) fallback.hidden = false;
    if (loading) loading.hidden = true;
    if (fallbackImage) {
      fallbackImage.src = `/pets/fallback/${activeSlug}.webp`;
      fallbackImage.alt = `${activeSlug === 'tom' ? 'TOM' : '皮皮'} 的 3D 转台预览`;
    }
    onFallback(error);
  }

  function selectPet(slug, notify = true) {
    if (!slug) return;
    activeSlug = slug;
    root.dataset.activePet = slug;
    if (fallbackImage) {
      fallbackImage.src = `/pets/fallback/${slug}.webp`;
    }
    for (const [key, pet] of pets) {
      const active = key === slug;
      pet.root.userData.selected = active;
    }
    layoutPets();
    if (notify) onSelect(slug);
  }

  function setCameraMode(mode, notify = true) {
    cameraMode = mode === 'focus' ? 'focus' : 'room';
    root.dataset.cameraMode = cameraMode;
    orbitYaw = 0;
    orbitPitch = 0;
    if (viewToggle) {
      viewToggle.setAttribute('aria-pressed', cameraMode === 'focus' ? 'true' : 'false');
    }
    if (viewLabel) {
      viewLabel.textContent = cameraMode === 'focus' ? '看全房间' : '近看它';
    }
    if (notify) options.onCameraMode?.(cameraMode, activeSlug);
  }

  function toggleCameraMode() {
    setCameraMode(cameraMode === 'focus' ? 'room' : 'focus');
  }

  function playAction(slug, action, durationOverride) {
    const pet = pets.get(slug);
    if (!pet) return;
    root.dataset.lastAction = action;
    activeAction = {
      slug,
      action,
      startedAt: performance.now(),
      duration:
        (durationOverride && (reduceMotion ? 0.08 : durationOverride)) ||
        (reduceMotion ? 0.08 : action === 'sleep' ? 1.1 : action === 'bath' ? 4.2 : 3.8),
    };
    teaser.visible = action === 'teaser';
    petals.visible = action === 'bath';
    ball.visible = action === 'ball' || action === 'idle';
    if (action === 'feed') {
      room.bowls.position.x = pet.root.position.x + (slug === 'tom' ? 0.58 : 0.52);
      room.bowls.position.z = pet.root.position.z + 0.42;
    }
  }

  function setSleeping(slug, sleeping) {
    const pet = pets.get(slug);
    if (!pet) return;
    pet.root.userData.sleeping = sleeping;
    pet.root.userData.currentAction = sleeping ? 'sleep' : 'idle';
    if (sleeping) playAction(slug, 'sleep', 0.8);
  }

  function updateAction(dt, time) {
    for (const [slug, pet] of pets) {
      const data = pet.root.userData;
      const isActive = slug === activeSlug;
      const baseY = 0;
      if (data.sleeping && !(activeAction && activeAction.slug === slug)) {
        pet.root.rotation.z = damp(pet.root.rotation.z, -0.11, 5, dt);
        pet.root.position.y = damp(pet.root.position.y, 0.015, 5, dt);
        pet.model.scale.y = damp(
          pet.model.scale.y,
          pet.model.userData.baseScale.y * 0.96,
          4,
          dt
        );
        continue;
      }

      pet.root.rotation.x = damp(pet.root.rotation.x, 0, 7, dt);
      pet.root.rotation.y = damp(pet.root.rotation.y, 0, 7, dt);
      pet.root.rotation.z = damp(pet.root.rotation.z, isActive ? 0.015 : 0, 7, dt);
      pet.root.position.x = damp(pet.root.position.x, data.baseX, 2.8, dt);
      pet.root.position.z = damp(pet.root.position.z, data.baseZ, 2.8, dt);
      pet.root.position.y = damp(pet.root.position.y, baseY + Math.sin(time * 1.4 + (slug === 'pipi' ? 1.2 : 0)) * 0.008, 6, dt);
      pet.model.scale.y = damp(
        pet.model.scale.y,
        pet.model.userData.baseScale.y,
        3,
        dt
      );
    }

    ball.rotation.x += dt * 1.7;
    for (const bubble of petals.children) {
      const phase = bubble.userData.phase || 0;
      bubble.position.y = 0.45 + ((time * 0.34 + phase * 0.17) % 1.9);
    }

    if (!activeAction) return;
    const pet = pets.get(activeAction.slug);
    if (!pet) {
      activeAction = null;
      return;
    }
    const elapsed = (performance.now() - activeAction.startedAt) / 1000;
    const progress = clamp(elapsed / activeAction.duration, 0, 1);
    const wave = Math.sin(progress * Math.PI);
    const fast = Math.sin(elapsed * 11);
    const { action, slug } = activeAction;

    if (action === 'feed') {
      pet.root.rotation.x = damp(pet.root.rotation.x, 0.14 * wave, 9, dt);
      pet.root.position.y += Math.abs(Math.sin(elapsed * 8)) * 0.012;
      room.bowls.scale.setScalar(1 + Math.sin(elapsed * 7) * 0.02);
    } else if (action === 'bath') {
      pet.root.rotation.z = fast * 0.06 * (1 - progress);
      pet.root.scale.setScalar(1 + Math.sin(elapsed * 13) * 0.018 * (1 - progress));
      for (let i = 0; i < petals.children.length; i += 1) {
        const bubble = petals.children[i];
        const angle = time * 1.8 + i * 0.82;
        bubble.position.x = pet.root.position.x + Math.cos(angle) * (0.35 + (i % 5) * 0.09);
        bubble.position.z = pet.root.position.z + Math.sin(angle) * (0.3 + (i % 4) * 0.08);
      }
    } else if (action === 'sleep') {
      pet.root.rotation.z = -0.11 * easeOutCubic(progress);
      pet.root.position.y = -0.01 * easeOutCubic(progress);
      pet.model.scale.y = pet.model.userData.baseScale.y * 0.96;
      pet.root.userData.sleeping = true;
    } else if (action === 'ball') {
      const direction = slug === 'tom' ? 1 : -1;
      ball.position.x = pet.root.position.x + direction * (0.55 + easeOutCubic(progress) * 1.35);
      ball.position.z = pet.root.position.z + Math.sin(progress * Math.PI * 2) * 0.45;
      ball.position.y = 0.14 + Math.abs(Math.sin(progress * Math.PI * 3)) * 0.42;
      pet.root.position.x += Math.sin(progress * Math.PI * 2) * 0.17;
      pet.root.rotation.y = Math.sin(progress * Math.PI * 2) * 0.22;
      pet.root.position.y += Math.abs(Math.sin(elapsed * 7)) * 0.035 * wave;
    } else if (action === 'teaser') {
      teaser.rotation.z = Math.sin(elapsed * 4.2) * 0.38;
      teaser.position.x = pet.root.position.x + Math.sin(elapsed * 3.2) * 0.48;
      teaser.position.z = pet.root.position.z + 0.85;
      pet.root.rotation.x = 0.18 * wave;
      pet.root.position.y += Math.abs(Math.sin(elapsed * 6.3)) * 0.05 * wave;
      pet.root.rotation.z = Math.sin(elapsed * 4.2) * 0.04;
    } else if (action === 'affection') {
      pet.root.rotation.z = Math.sin(elapsed * 3.4) * 0.08;
      pet.root.position.y += Math.abs(Math.sin(elapsed * 4.5)) * 0.025;
    }

    if (progress >= 1) {
      const finished = activeAction;
      activeAction = null;
      teaser.visible = false;
      petals.visible = false;
      room.bowls.scale.setScalar(1);
      pet.root.scale.setScalar(1);
      pet.root.rotation.x = 0;
      pet.root.rotation.y = 0;
      pet.root.rotation.z = pet.root.userData.sleeping ? -0.1 : 0;
      options.onActionEnd?.(finished.slug, finished.action);
    }
  }

  function handlePointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    const nx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const ny = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    pointerTarget.set(nx * 2 - 1, -(ny * 2 - 1));
    root.style.setProperty('--pet-light-x', `${nx * 100}%`);
    root.style.setProperty('--pet-light-y', `${ny * 100}%`);
    if (pointerDown) {
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) dragging = true;
      orbitYaw = clamp(pointerDown.yaw + dx * 0.005, -0.72, 0.72);
      orbitPitch = clamp(pointerDown.pitch + dy * 0.0018, -0.08, 0.16);
    }
  }

  function handlePointerDown(event) {
    canvas.setPointerCapture?.(event.pointerId);
    pointerDown = {
      x: event.clientX,
      y: event.clientY,
      yaw: orbitYaw,
      pitch: orbitPitch,
    };
    dragging = false;
  }

  function handlePointerUp(event) {
    if (!dragging) {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(selectable, true);
      const slug = hits[0]?.object?.userData?.petSlug;
      if (slug && slug !== activeSlug) {
        selectPet(slug);
      } else if (slug && !pets.get(slug)?.root.userData.sleeping) {
        playAction(slug, 'affection', 2.1);
        onAffection(slug);
      }
    }
    pointerDown = null;
    dragging = false;
  }

  canvas.addEventListener('pointermove', handlePointerMove, { passive: true });
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  viewToggle?.addEventListener('click', toggleCameraMode);

  const resize = () => {
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const compact = camera.aspect < 0.95;
    cameraDistance = compact ? 4.15 : 5.1;
    cameraHeight = compact ? 2.3 : 2.02;
    cameraFocusY = compact ? 0.5 : 0.76;
    layoutPets();
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  function frame() {
    if (disposed) return;
    if (!root.isConnected) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    pointer.x = damp(pointer.x, pointerTarget.x, 6, dt);
    pointer.y = damp(pointer.y, pointerTarget.y, 6, dt);
    const focusedPet = cameraMode === 'focus' ? pets.get(activeSlug) : null;
    const focusedX = focusedPet?.root.position.x || 0;
    const focusY = focusedPet?.root.userData.slug === 'tom' ? 0.4 : 0.28;
    const targetX =
      cameraMode === 'focus'
        ? focusedX + pointer.x * 0.07 + orbitYaw * 0.52
        : pointer.x * 0.22 + orbitYaw * 1.25;
    const targetY =
      cameraMode === 'focus'
        ? focusY + 0.28 + pointer.y * 0.04 + orbitPitch * 0.5
        : cameraHeight + pointer.y * 0.1 + orbitPitch * 1.4;
    const targetZ =
      cameraMode === 'focus'
        ? camera.aspect < 0.95
          ? 4
          : 3.5
        : cameraDistance;
    camera.position.x = damp(camera.position.x, targetX, 5, dt);
    camera.position.y = damp(
      camera.position.y,
      targetY,
      5,
      dt
    );
    camera.position.z = damp(camera.position.z, targetZ, 5, dt);
    lookAtTarget.x = damp(lookAtTarget.x, cameraMode === 'focus' ? focusedX : 0, 5, dt);
    lookAtTarget.y = damp(
      lookAtTarget.y,
      cameraMode === 'focus' ? focusY : cameraFocusY,
      5,
      dt
    );
    camera.lookAt(lookAtTarget);
    room.room.rotation.y = damp(room.room.rotation.y, pointer.x * 0.025, 4, dt);
    if (!reduceMotion) {
      const positions = hearts.positions;
      for (let i = 0; i < hearts.phases.length; i += 1) {
        const phase = hearts.phases[i];
        positions[i * 3 + 1] += dt * (0.035 + (i % 5) * 0.008);
        positions[i * 3] += Math.sin(time * 0.3 + phase) * dt * 0.025;
        if (positions[i * 3 + 1] > 3.6) positions[i * 3 + 1] = -0.15;
      }
      hearts.points.geometry.attributes.position.needsUpdate = true;
    }
    updateAction(dt, time);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  Promise.all([loadPet(loader, 'tom'), loadPet(loader, 'pipi')])
    .then(([tom, pipi]) => {
      if (disposed) return;
      for (const pet of [tom, pipi]) {
        scene.add(pet.root);
        pets.set(pet.root.userData.slug, pet);
        pet.root.traverse((child) => {
          if (child.isMesh) child.userData.petSlug = pet.root.userData.slug;
        });
        selectable.push(pet.root);
      }
      selectPet(activeSlug, false);
      const textured = [tom, pipi].every(
        (pet) => (pet.model.userData.texturedMaterialCount || 0) >= 1
      );
      root.dataset.furMaterial = textured ? 'textured' : 'flat';
      root.dataset.facialShadow = 'disabled';
      resize();
      if (loading) loading.hidden = true;
      root.dataset.petReady = 'true';
      options.onReady?.({ tom: pets.get('tom'), pipi: pets.get('pipi') });
    })
    .catch(showFallback);

  return {
    playAction,
    selectPet,
    setSleeping,
    get activePet() {
      return activeSlug;
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      viewToggle?.removeEventListener('click', toggleCameraMode);
      renderer.dispose();
    },
  };
}
