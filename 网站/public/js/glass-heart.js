import * as THREE from '../vendor/three.module.min.js';

const VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vEye;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * worldPosition;
    vNormal = normalize(normalMatrix * normal);
    vEye = normalize(mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const GLASS_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uIorR;
  uniform float uIorY;
  uniform float uIorG;
  uniform float uIorC;
  uniform float uIorB;
  uniform float uIorP;
  uniform float uRefractPower;
  uniform float uChromatic;
  uniform float uSaturation;
  uniform float uShininess;
  uniform float uDiffuseness;
  uniform float uFresnelPower;
  uniform float uBackside;
  uniform vec3 uLight;

  varying vec3 vNormal;
  varying vec3 vEye;

  const int LOOP = 16;

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 n = normalize(vNormal);
    if (uBackside > 0.5) n = -n;
    vec3 eye = normalize(vEye);
    vec3 color = vec3(0.0);

    for (int i = 0; i < LOOP; i++) {
      float slide = (float(i) / float(LOOP)) * 0.045;
      vec2 rUv = uv + refract(eye, n, 1.0 / uIorR).xy * (uRefractPower + slide) * uChromatic;
      vec2 yUv = uv + refract(eye, n, 1.0 / uIorY).xy * (uRefractPower + slide) * uChromatic;
      vec2 gUv = uv + refract(eye, n, 1.0 / uIorG).xy * (uRefractPower + slide * 2.0) * uChromatic;
      vec2 cUv = uv + refract(eye, n, 1.0 / uIorC).xy * (uRefractPower + slide * 2.5) * uChromatic;
      vec2 bUv = uv + refract(eye, n, 1.0 / uIorB).xy * (uRefractPower + slide * 3.0) * uChromatic;
      vec2 pUv = uv + refract(eye, n, 1.0 / uIorP).xy * (uRefractPower + slide) * uChromatic;

      vec3 rTex = texture2D(uTexture, clamp(rUv, 0.001, 0.999)).rgb;
      vec3 yTex = texture2D(uTexture, clamp(yUv, 0.001, 0.999)).rgb;
      vec3 gTex = texture2D(uTexture, clamp(gUv, 0.001, 0.999)).rgb;
      vec3 cTex = texture2D(uTexture, clamp(cUv, 0.001, 0.999)).rgb;
      vec3 bTex = texture2D(uTexture, clamp(bUv, 0.001, 0.999)).rgb;
      vec3 pTex = texture2D(uTexture, clamp(pUv, 0.001, 0.999)).rgb;

      float r = rTex.r * 0.5;
      float y = (yTex.r * 2.0 + yTex.g * 2.0 - yTex.b) / 6.0;
      float g = gTex.g * 0.5;
      float c = (cTex.g * 2.0 + cTex.b * 2.0 - cTex.r) / 6.0;
      float b = bTex.b * 0.5;
      float p = (pTex.b * 2.0 + pTex.r * 2.0 - pTex.g) / 6.0;

      float red = r + (2.0 * p + 2.0 * y - c) / 3.0;
      float green = g + (2.0 * y + 2.0 * c - p) / 3.0;
      float blue = b + (2.0 * c + 2.0 * p - y) / 3.0;
      color += vec3(red, green, blue);
    }

    color /= float(LOOP);
    float luma = dot(color, vec3(0.2125, 0.7154, 0.0721));
    color = mix(vec3(luma), color, uSaturation);

    vec3 light = normalize(uLight);
    vec3 halfVec = normalize(light - eye);
    float specular =
      pow(max(dot(n, halfVec), 0.0), uShininess) +
      max(0.0, dot(n, light)) * uDiffuseness;
    vec3 secondLight = normalize(vec3(1.0, 1.0, -1.0));
    vec3 secondHalf = normalize(secondLight - eye);
    specular +=
      0.6 * (
        pow(max(dot(n, secondHalf), 0.0), uShininess * 0.6) +
        max(0.0, dot(n, secondLight)) * uDiffuseness * 0.5
      );
    color += vec3(specular) * (uBackside > 0.5 ? 0.35 : 1.0);

    float fresnel = pow(clamp(1.0 + dot(eye, n), 0.0, 1.0), uFresnelPower);
    color = mix(color, vec3(1.0), fresnel * (uBackside > 0.5 ? 0.25 : 0.55));
    color += vec3(0.004, 0.005, 0.007);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const BACKGROUND_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BACKGROUND_FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  varying vec2 vUv;

  void main() {
    gl_FragColor = texture2D(uTexture, vUv);
    #include <colorspace_fragment>
  }
`;

function createHeartGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1.06);
  shape.bezierCurveTo(0.24, -0.78, 1.08, -0.2, 1.08, 0.47);
  shape.bezierCurveTo(1.08, 1.08, 0.36, 1.35, 0, 0.82);
  shape.bezierCurveTo(-0.36, 1.35, -1.08, 1.08, -1.08, 0.47);
  shape.bezierCurveTo(-1.08, -0.2, -0.24, -0.78, 0, -1.06);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42,
    curveSegments: 48,
    bevelEnabled: true,
    bevelThickness: 0.13,
    bevelSize: 0.1,
    bevelSegments: 8,
  });
  geometry.center();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  geometry.scale(1 / maxDimension, 1 / maxDimension, 1 / maxDimension);
  return geometry;
}

function createGlassMaterial(texture, backside) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uIorR: { value: 1.15 },
      uIorY: { value: 1.16 },
      uIorG: { value: 1.18 },
      uIorC: { value: 1.22 },
      uIorB: { value: 1.22 },
      uIorP: { value: 1.22 },
      uRefractPower: { value: backside ? 0.22 : 0.3 },
      uChromatic: { value: 0.42 },
      uSaturation: { value: 1.08 },
      uShininess: { value: 90 },
      uDiffuseness: { value: 0.02 },
      uFresnelPower: { value: 5 },
      uBackside: { value: backside ? 1 : 0 },
      uLight: { value: new THREE.Vector3(-1, 1, 1) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: GLASS_FRAGMENT_SHADER,
    side: backside ? THREE.BackSide : THREE.FrontSide,
    transparent: false,
    depthWrite: true,
  });
}

function fallback(stage, canvas) {
  stage.dataset.heartReady = 'false';
  stage.classList.add('is-fallback');
  delete canvas.dataset.heartReady;
}

export function initGlassHeart(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const stage = canvas.closest('.glass-heart-stage');
  if (!stage) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
  } catch {
    fallback(stage, canvas);
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = true;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  const pivot = new THREE.Group();
  const spinner = new THREE.Group();
  scene.add(pivot);
  pivot.add(spinner);

  const geometry = createHeartGeometry();
  const backMaterial = createGlassMaterial(null, true);
  const frontMaterial = createGlassMaterial(null, false);
  const backMesh = new THREE.Mesh(geometry, backMaterial);
  const frontMesh = new THREE.Mesh(geometry, frontMaterial);
  backMesh.frustumCulled = false;
  frontMesh.frustumCulled = false;
  spinner.add(backMesh, frontMesh);
  spinner.quaternion.setFromEuler(new THREE.Euler(-0.26, 0.52, 0.08));

  const backgroundCanvas = document.createElement('canvas');
  const backgroundContext = backgroundCanvas.getContext('2d');
  const backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
  backgroundTexture.colorSpace = THREE.SRGBColorSpace;
  backgroundTexture.minFilter = THREE.LinearFilter;
  backgroundTexture.magFilter = THREE.LinearFilter;
  backgroundTexture.generateMipmaps = false;

  const backgroundMaterial = new THREE.ShaderMaterial({
    uniforms: { uTexture: { value: backgroundTexture } },
    vertexShader: BACKGROUND_VERTEX_SHADER,
    fragmentShader: BACKGROUND_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
  });
  const backgroundMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backgroundMaterial);
  backgroundMesh.frustumCulled = false;
  const backgroundScene = new THREE.Scene();
  backgroundScene.add(backgroundMesh);
  const backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let rtBack = null;
  let rtFront = null;
  let pixelWidth = 1;
  let pixelHeight = 1;
  let rendering = false;
  let dragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastInteraction = performance.now();
  let previousTime = performance.now();
  let velocityY = 0;
  let velocityX = 0;
  let idleBlend = 0;
  let lastPublished = 0;
  const yAxis = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);
  const rotation = new THREE.Quaternion();

  function drawBackground(width, height) {
    const context = backgroundContext;
    if (!context) return;
    backgroundCanvas.width = Math.max(2, Math.round(width));
    backgroundCanvas.height = Math.max(2, Math.round(height));
    const w = backgroundCanvas.width;
    const h = backgroundCanvas.height;

    const gradient = context.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#fbf6f1');
    gradient.addColorStop(0.38, '#f7e7e7');
    gradient.addColorStop(0.7, '#e6f0eb');
    gradient.addColorStop(1, '#fbf5ef');
    context.fillStyle = gradient;
    context.fillRect(0, 0, w, h);

    const blush = context.createRadialGradient(w * 0.24, h * 0.6, 0, w * 0.24, h * 0.6, w * 0.5);
    blush.addColorStop(0, 'rgba(228, 156, 170, .36)');
    blush.addColorStop(1, 'rgba(228, 156, 170, 0)');
    context.fillStyle = blush;
    context.fillRect(0, 0, w, h);

    const sage = context.createRadialGradient(w * 0.78, h * 0.3, 0, w * 0.78, h * 0.3, w * 0.48);
    sage.addColorStop(0, 'rgba(134, 177, 157, .3)');
    sage.addColorStop(1, 'rgba(134, 177, 157, 0)');
    context.fillStyle = sage;
    context.fillRect(0, 0, w, h);

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(74, 57, 53, .16)';
    context.font = `500 ${Math.round(h * 0.19)}px Georgia, "Noto Serif SC", serif`;
    context.fillText('小时光', w * 0.5, h * 0.44);
    context.fillStyle = 'rgba(255, 255, 255, .62)';
    context.font = `600 ${Math.round(h * 0.032)}px Arial, sans-serif`;
    context.letterSpacing = `${Math.round(h * 0.009)}px`;
    context.fillText('HOUR & LIGHT', w * 0.5, h * 0.59);
    context.restore();

    context.strokeStyle = 'rgba(255, 255, 255, .54)';
    context.lineWidth = Math.max(1, h * 0.0015);
    context.beginPath();
    context.ellipse(w * 0.5, h * 0.47, w * 0.37, h * 0.23, -0.2, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.ellipse(w * 0.5, h * 0.47, w * 0.28, h * 0.31, 0.68, 0, Math.PI * 2);
    context.stroke();

    backgroundTexture.needsUpdate = true;
  }

  function disposeTargets() {
    if (rtBack) rtBack.dispose();
    if (rtFront) rtFront.dispose();
    rtBack = null;
    rtFront = null;
  }

  function createTarget() {
    return new THREE.WebGLRenderTarget(pixelWidth, pixelHeight, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
  }

  function layout() {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const target = renderer.getDrawingBufferSize(new THREE.Vector2());
    pixelWidth = Math.max(2, Math.floor(target.x));
    pixelHeight = Math.max(2, Math.floor(target.y));
    disposeTargets();
    rtBack = createTarget();
    rtFront = createTarget();
    backMaterial.uniforms.uTexture.value = rtBack.texture;
    frontMaterial.uniforms.uTexture.value = rtFront.texture;
    backMaterial.uniforms.uResolution.value.set(pixelWidth, pixelHeight);
    frontMaterial.uniforms.uResolution.value.set(pixelWidth, pixelHeight);

    drawBackground(pixelWidth, pixelHeight);

    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10;
    const heartPixels = Math.min(height * 0.7, width * 0.7);
    pivot.scale.setScalar((heartPixels / height) * visibleHeight);
    pivot.position.set(0, 0, 0);
    renderFrame(performance.now(), true);
  }

  function rotateBy(deltaX, deltaY) {
    rotation.setFromAxisAngle(yAxis, deltaX);
    spinner.quaternion.premultiply(rotation);
    rotation.setFromAxisAngle(xAxis, deltaY);
    spinner.quaternion.premultiply(rotation);
  }

  function publishAngles(now) {
    if (now - lastPublished < 70) return;
    lastPublished = now;
    const euler = new THREE.Euler().setFromQuaternion(spinner.quaternion, 'XYZ');
    canvas.dataset.heartAngleX = euler.x.toFixed(4);
    canvas.dataset.heartAngleY = euler.y.toFixed(4);
  }

  function renderFrame(now, force = false) {
    if (!rtBack || !rtFront) return;
    const delta = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;

    if (!reduceMotion && !dragging) {
      velocityX *= Math.pow(0.94, delta * 60);
      velocityY *= Math.pow(0.94, delta * 60);
      if (Math.abs(velocityX) > 0.00002 || Math.abs(velocityY) > 0.00002) {
        rotateBy(velocityY, velocityX);
      }

      idleBlend =
        now - lastInteraction > 600
          ? Math.min(1, idleBlend + delta)
          : Math.max(0, idleBlend - delta * 2.4);
      if (idleBlend > 0) {
        rotateBy(0.0035 * delta * 60 * idleBlend, 0.0012 * delta * 60 * idleBlend);
      }
    }

    publishAngles(now);

    backMesh.visible = true;
    frontMesh.visible = false;
    renderer.autoClear = true;
    renderer.setRenderTarget(rtBack);
    renderer.clear();
    renderer.render(backgroundScene, backgroundCamera);

    renderer.setRenderTarget(rtFront);
    renderer.clear();
    renderer.render(backgroundScene, backgroundCamera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;

    backMesh.visible = false;
    frontMesh.visible = true;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;

    if (!force && !runtimePaused && !reduceMotion) requestAnimationFrame(renderFrame);
  }

  let runtimePaused = false;
  function start() {
    if (rendering || runtimePaused) return;
    rendering = true;
    stage.dataset.heartReady = 'true';
    canvas.dataset.heartReady = 'true';
    requestAnimationFrame((now) => {
      previousTime = now;
      renderFrame(now, true);
      if (!reduceMotion) requestAnimationFrame(renderFrame);
      rendering = false;
    });
  }

  function stop() {
    runtimePaused = true;
  }

  function resume() {
    if (!runtimePaused) return;
    runtimePaused = false;
    previousTime = performance.now();
    requestAnimationFrame(renderFrame);
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (reduceMotion) return;
    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    lastInteraction = performance.now();
    velocityX = 0;
    velocityY = 0;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    velocityY = dx * 0.008;
    velocityX = dy * 0.008;
    rotateBy(velocityY, velocityX);
    lastInteraction = performance.now();
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    lastInteraction = performance.now();
    canvas.classList.remove('is-dragging');
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else resume();
  });

  const resizeObserver = new ResizeObserver(layout);
  resizeObserver.observe(stage);
  window.addEventListener('pagehide', () => {
    resizeObserver.disconnect();
    disposeTargets();
    geometry.dispose();
    backMaterial.dispose();
    frontMaterial.dispose();
    backgroundMaterial.dispose();
    backgroundTexture.dispose();
    renderer.dispose();
  }, { once: true });

  document.fonts?.ready.then(() => drawBackground(pixelWidth, pixelHeight)).catch(() => {});
  layout();
  start();
}
