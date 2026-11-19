// 云上小屋 — the island in the hero.
// Our own GLB only (models/home.web.glb). No game meshes.
//
// What it does, quietly:
//   drag            turn the island (horizontal), tilt a little (vertical)
//   hover + click   doors, six windows, the yard gate swing open; the cabin toggles its lights
//   E key           same as click while hovering, like in game
//   day / night     lighting follows <html data-mode>, set by site.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const MODES = {
  day: {
    hemiSky: 0xe2dde6, hemiGround: 0x5e4c3b, hemi: 3.2,
    sun: 0xffe2c4, sunI: 4.2, sunDir: [-0.62, 0.7, 0.36],
    glass: 0.55, lamp: 0.5, porch: 0, spill: 0,
    cloud: 0xffffff, cloudEmissive: 0x2a2a30, exposure: 1.0,
  },
  night: {
    hemiSky: 0x6f86b8, hemiGround: 0x0e111a, hemi: 1.25,
    sun: 0x9fb4e4, sunI: 1.0, sunDir: [0.45, 0.75, -0.48],
    glass: 3.6, lamp: 3.0, porch: 26, spill: 6,
    cloud: 0x52648c, cloudEmissive: 0x000000, exposure: 1.06,
  },
};

const LABELS = {
  zh: {
    door:   ['开门', '关门'],
    window: ['开窗', '关窗'],
    gate:   ['开院门', '关院门'],
    light:  ['关灯', '开灯'],
  },
  en: {
    door:   ['Open door', 'Close door'],
    window: ['Open window', 'Close window'],
    gate:   ['Open gate', 'Close gate'],
    light:  ['Lights off', 'Lights on'],
  },
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DRAG_VELOCITY_WINDOW = 80; // ms
const MAX_INERTIA_SPEED = 16;    // rad/s
const INERTIA_DECAY = 5;         // per second

export function mountIsland(container, opts = {}) {
  const o = Object.assign({
    glb: 'models/home.web.glb',
    draco: 'vendor/three/examples/jsm/libs/draco/gltf/',
    mode: 'day',
    anchorX: 0.5,       // where the island's centre sits, as a fraction of canvas width
    anchorY: 0.5,
    zoom: 1.0,          // >1 = bigger
    interactive: true,
    float: !reduceMotion,
    clouds: false,
    az: 12, el: 22,     // camera azimuth from the south (towards east) and elevation, degrees
    modes: null,        // optional overrides for MODES
    tone: 'agx',        // 'agx' | 'aces' | 'neutral'
    shadows: true,
    still: false,       // poster mode: fixed pose, no float
    maxDpr: 2,
    watchdog: true,     // keep the poster if the first frames before input are too slow
  }, opts);

  if (o.modes) for (const k of Object.keys(o.modes)) Object.assign(MODES[k], o.modes[k]);
  const renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: true, powerPreference: 'high-performance',
    preserveDrawingBuffer: !!o.still,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = { agx: THREE.AgXToneMapping, aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping }[o.tone] || THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !!o.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.maxDpr));
  const canvas = renderer.domElement;
  canvas.className = 'island-canvas';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 600);

  // spin = what the visitor drags; float = the slow bob of a floating island
  const spin = new THREE.Group();
  const float = new THREE.Group();
  spin.add(float);
  scene.add(spin);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = !!o.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3;
  const sc = sun.shadow.camera;
  sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 160;
  scene.add(sun);
  scene.add(sun.target);

  const porchLight = new THREE.PointLight(0xffb46a, 0, 14, 1.6);
  const spillLight = new THREE.PointLight(0xffa860, 0, 16, 1.4);
  float.add(porchLight, spillLight);

  const state = {
    mode: o.mode === 'night' ? 'night' : 'day',
    k: o.mode === 'night' ? 1 : 0,     // 0 = day, 1 = night (animated)
    kTarget: o.mode === 'night' ? 1 : 0,
    lightsOn: true,
    rotY: 0, vel: 0,
    tilt: 0, tiltTarget: 0,
    ready: false,
    hovered: null,
    visible: true,
    raf: 0,
    t0: performance.now(),
    radius: 30, center: new THREE.Vector3(),
  };

  const mats = { glass: [], lamp: [] };
  const toggles = [];         // {kind, node, open, angle, axis, target, cur}
  const lightTargets = [];    // meshes that toggle lights
  let clouds = null;

  // ---------- tooltip (a key, like the in-game prompt) ----------
  let tip = null;
  if (o.interactive) {
    tip = document.createElement('div');
    tip.className = 'island-tip';
    tip.setAttribute('aria-hidden', 'true');
    tip.innerHTML = '<kbd>E</kbd><span></span>';
    container.appendChild(tip);
  }

  // ---------- load ----------
  const draco = new DRACOLoader();
  draco.setDecoderPath(o.draco);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const ready = new Promise((resolve, reject) => {
    loader.load(o.glb, (gltf) => {
      const root = gltf.scene;
      float.add(root);

      root.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        const m = obj.material;
        if (!m) return;
        if (m.name === 'home_glass_glow') {
          m.userData.baseEmissive = m.emissiveIntensity || 1;
          m.userData.baseColor = m.color.clone();
          if (!mats.glass.includes(m)) mats.glass.push(m);
          obj.castShadow = false;
        }
        if (m.name === 'home_light_emit') {
          m.userData.baseEmissive = m.emissiveIntensity || 1;
          m.userData.baseColor = m.color.clone();
          if (!mats.lamp.includes(m)) mats.lamp.push(m);
          obj.castShadow = false;
        }
        if (m.name === 'home_glass_clear') obj.castShadow = false;
      });

      // centre + size
      const box = new THREE.Box3().setFromObject(root);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      state.radius = sphere.radius;
      root.position.sub(new THREE.Vector3(sphere.center.x, sphere.center.y, sphere.center.z));
      root.updateMatrixWorld(true);

      // porch + window spill lights
      const porch = root.getObjectByName('Light_Porch');
      if (porch) {
        const b = new THREE.Box3().setFromObject(porch);
        const c = b.getCenter(new THREE.Vector3());
        porchLight.position.copy(c).add(new THREE.Vector3(0, -0.25, 0.6));
      }
      const front = root.getObjectByName('Window_Front_R');
      if (front) {
        const c = new THREE.Box3().setFromObject(front).getCenter(new THREE.Vector3());
        spillLight.position.copy(c).add(new THREE.Vector3(-2.2, -0.4, 2.6));
      }

      // interactive pieces
      const cabinCenter = new THREE.Vector3();
      const cabinBox = new THREE.Box3();
      ['Cabin_WallsExterior', 'Cabin_Roof'].forEach((n) => {
        const x = root.getObjectByName(n);
        if (x) cabinBox.expandByObject(x);
      });
      cabinBox.getCenter(cabinCenter);
      const yard = new THREE.Box3().setFromObject(root.getObjectByName('Fence') || root).getCenter(new THREE.Vector3());

      const addToggle = (name, kind, outwardFrom, wantOutward, angle) => {
        const node = root.getObjectByName(name);
        if (!node) return;
        // which way the panel swings: try +/- and keep the one that moves its middle the way we want
        const nb = new THREE.Box3().setFromObject(node);
        const mid = nb.getCenter(new THREE.Vector3());
        const hinge = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld);
        const arm = mid.clone().sub(hinge); arm.y = 0;
        const test = (s) => {
          const a = arm.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), s * angle * 0.5);
          return hinge.clone().add(a).distanceTo(outwardFrom);
        };
        const dPlus = test(1), dMinus = test(-1);
        let sign = dPlus > dMinus ? 1 : -1;
        if (!wantOutward) sign = -sign;
        const t = { kind, node, open: false, base: node.rotation.y, target: node.rotation.y, angle: sign * angle };
        node.traverse((c) => { if (c.isMesh) c.userData.toggle = t; });
        toggles.push(t);
      };
      addToggle('Door_Front', 'door', cabinCenter, false, Math.PI * 0.5);
      ['Window_Front_L', 'Window_Front_R', 'Window_East_S', 'Window_East_N', 'Window_West', 'Window_North']
        .forEach((n) => addToggle(n, 'window', cabinCenter, true, Math.PI * 0.42));
      addToggle('Door_GateL', 'gate', yard, false, Math.PI * 0.5);
      addToggle('Door_GateR', 'gate', yard, false, Math.PI * 0.5);
      // the two gate leaves open together
      const gates = toggles.filter((t) => t.kind === 'gate');
      gates.forEach((g) => { g.group = gates; });

      ['Cabin_WallsExterior', 'Cabin_Roof', 'Cabin_PorchRoof', 'Cabin_Chimney', 'Cabin_Trim', 'Light_Porch', 'Cabin_Foundation'].forEach((n) => {
        const x = root.getObjectByName(n);
        if (x) x.traverse((c) => { if (c.isMesh) { c.userData.light = true; lightTargets.push(c); } });
      });

      if (o.clouds) {
        clouds = makeClouds(state.radius);
        spin.add(clouds);
      }

      applyMode(true);
      layout();
      state.ready = true;
      resolve();
    }, undefined, reject);
  });

  // ---------- clouds: a few low-poly puffs under the island ----------
  function makeClouds(R) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.94 });
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const spots = [
      [-0.95, -0.62, 0.55, 1.0], [0.9, -0.7, 0.35, 1.15], [0.15, -0.95, 0.95, 0.8],
      [-0.55, -0.85, -0.8, 0.9], [1.25, -0.5, -0.55, 0.7], [-1.35, -0.45, -0.1, 0.75],
    ];
    spots.forEach(([x, y, z, s]) => {
      const c = new THREE.Group();
      const n = 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const r = (0.11 + rnd() * 0.08) * R * s;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
        m.position.set((i - n / 2) * r * 0.95 + rnd() * r * 0.3, rnd() * r * 0.35, (rnd() - 0.5) * r * 0.9);
        m.scale.set(1, 0.62 + rnd() * 0.15, 1);
        m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        c.add(m);
      }
      c.position.set(x * R, y * R, z * R);
      c.userData.drift = 0.15 + rnd() * 0.25;
      c.userData.x0 = c.position.x;
      g.add(c);
    });
    g.userData.mat = mat;
    return g;
  }

  // ---------- day / night ----------
  const cA = new THREE.Color(), cB = new THREE.Color();
  function mix(a, b, k) { return a + (b - a) * k; }
  function mixColor(target, a, b, k) { cA.setHex(a); cB.setHex(b); target.copy(cA).lerp(cB, k); }

  function applyMode() {
    const k = state.k, D = MODES.day, N = MODES.night;
    mixColor(hemi.color, D.hemiSky, N.hemiSky, k);
    mixColor(hemi.groundColor, D.hemiGround, N.hemiGround, k);
    hemi.intensity = mix(D.hemi, N.hemi, k);
    mixColor(sun.color, D.sun, N.sun, k);
    sun.intensity = mix(D.sunI, N.sunI, k);
    const dir = new THREE.Vector3(
      mix(D.sunDir[0], N.sunDir[0], k), mix(D.sunDir[1], N.sunDir[1], k), mix(D.sunDir[2], N.sunDir[2], k)).normalize();
    sun.position.copy(dir.multiplyScalar(60));
    sun.target.position.set(0, 0, 0);
    renderer.toneMappingExposure = mix(D.exposure, N.exposure, k);

    const on = state.lightsOn ? 1 : 0;
    mats.glass.forEach((m) => {
      m.emissiveIntensity = m.userData.baseEmissive * mix(D.glass, N.glass, k) * on;
      if (on) m.color.copy(m.userData.baseColor); else m.color.setHex(0x2b2622);
    });
    mats.lamp.forEach((m) => {
      m.emissiveIntensity = m.userData.baseEmissive * mix(D.lamp, N.lamp, k) * on;
      if (on) m.color.copy(m.userData.baseColor); else m.color.setHex(0x3a3530);
    });
    porchLight.intensity = mix(D.porch, N.porch, k) * on;
    spillLight.intensity = mix(D.spill, N.spill, k) * on;
    if (clouds) {
      mixColor(clouds.userData.mat.color, D.cloud, N.cloud, k);
      clouds.userData.mat.opacity = mix(0.94, 0.8, k);
    }
  }

  function setMode(mode, instant) {
    state.mode = mode === 'night' ? 'night' : 'day';
    state.kTarget = state.mode === 'night' ? 1 : 0;
    if (instant || reduceMotion) { state.k = state.kTarget; applyMode(); }
    kick();
  }

  // ---------- layout ----------
  const viewDir = new THREE.Vector3();
  let width = 0, height = 0;
  function layout() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      renderer.setSize(width, height, false);
    }
    updateCamera();
    kick();
  }

  function updateCamera() {
    // distance so the island fits the canvas height (layout is height-driven)
    const R = state.radius;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = (R / Math.sin(fov / 2)) * 0.86 / o.zoom;
    const az = THREE.MathUtils.degToRad(o.az), el = THREE.MathUtils.degToRad(o.el + state.tilt);
    viewDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    camera.position.copy(viewDir).multiplyScalar(dist);
    camera.lookAt(0, -R * 0.06, 0);
    camera.near = Math.max(1, dist - R * 2.2);
    camera.far = dist + R * 3;
    camera.setViewOffset(width, height, (0.5 - o.anchorX) * width, (0.5 - o.anchorY) * height, width, height);
  }

  // ---------- pointer ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pointer = null;            // last pointer pos in container coords
  let drag = null;
  let releasedAt = 0;
  let watchdogTimes = o.watchdog ? [] : null;

  function trimSamples(samples, cutoff) {
    // Keep one sample on or before the cutoff to interpolate the start of the window.
    while (samples.length > 1 && samples[1].time <= cutoff) samples.shift();
  }

  function releaseVelocity(time) {
    const { samples } = drag;
    const cutoff = time - DRAG_VELOCITY_WINDOW;
    trimSamples(samples, cutoff);
    const [first, next] = samples;
    if (!next) return 0;
    const start = Math.max(cutoff, first.time);
    const angle = start === first.time ? first.angle :
      THREE.MathUtils.lerp(first.angle, next.angle, (start - first.time) / (next.time - first.time));
    const seconds = Math.max(1, time - start) / 1000;
    return THREE.MathUtils.clamp((state.rotY - angle) / seconds, -MAX_INERTIA_SPEED, MAX_INERTIA_SPEED);
  }

  function clearDrag() {
    drag = null;
    container.classList.remove('dragging');
  }

  function pick(clientX, clientY) {
    if (!state.ready) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(float, true);
    for (const h of hits) {
      if (h.object.userData.toggle) return { kind: h.object.userData.toggle.kind, toggle: h.object.userData.toggle };
      if (h.object.userData.light) return { kind: 'light' };
      if (h.object.parent && h.object.parent.parent === clouds) continue;
      return null; // something else is in front
    }
    return null;
  }

  function showTip(hit, x, y) {
    if (!tip) return;
    if (!hit) { tip.classList.remove('on'); return; }
    // the prompt follows the page language (<html data-lang>, set by the page)
    const words = LABELS[document.documentElement.dataset.lang === 'en' ? 'en' : 'zh'];
    let label;
    if (hit.kind === 'light') label = words.light[state.lightsOn ? 0 : 1];
    else label = words[hit.kind][hit.toggle.open ? 1 : 0];
    tip.querySelector('span').textContent = label;
    tip.style.transform = `translate(${Math.round(x + 16)}px, ${Math.round(y + 14)}px)`;
    tip.classList.add('on');
  }

  function activate(hit) {
    if (!hit) return;
    if (hit.kind === 'light') {
      state.lightsOn = !state.lightsOn;
      applyMode();
    } else {
      const group = hit.toggle.group || [hit.toggle];
      const open = !hit.toggle.open;
      group.forEach((t) => { t.open = open; t.target = t.base + (open ? t.angle : 0); });
    }
    container.dispatchEvent(new CustomEvent('island:toggle', { detail: { kind: hit.kind } }));
    kick();
  }

  if (o.interactive) {
    canvas.addEventListener('pointerdown', (e) => {
      if (drag || e.button !== 0) return;
      drag = {
        x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY,
        moved: false, id: e.pointerId, type: e.pointerType,
        samples: [{ time: e.timeStamp, angle: state.rotY }],
      };
      watchdogTimes = null;
      state.vel = 0;
    });
    window.addEventListener('pointermove', (e) => {
      const r = container.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY };
      if (drag) {
        if (e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        const mouse = drag.type === 'mouse';
        if (!drag.moved && (Math.abs(e.clientX - drag.sx) > 5 || (mouse && Math.abs(e.clientY - drag.sy) > 5))) {
          drag.moved = true;
          try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
          container.classList.add('dragging');
        }
        if (drag.moved) {
          state.rotY += dx * 0.0062;
          if (mouse) state.tiltTarget = THREE.MathUtils.clamp(state.tiltTarget + dy * 0.05, -9, 14);
        }
        if (dx || dy) {
          drag.samples.push({ time: e.timeStamp, angle: state.rotY });
          trimSamples(drag.samples, e.timeStamp - DRAG_VELOCITY_WINDOW);
        }
        drag.x = e.clientX; drag.y = e.clientY;
        showTip(null);
        kick();
        return;
      }
      if (e.target !== canvas) { showTip(null); state.hovered = null; canvas.style.cursor = ''; return; }
      const hit = pick(e.clientX, e.clientY);
      state.hovered = hit;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      showTip(hit, pointer.x, pointer.y);
    }, { passive: true });
    window.addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const wasDrag = drag.moved;
      releasedAt = e.timeStamp;
      if (wasDrag && !reduceMotion) state.vel = releaseVelocity(releasedAt);
      clearDrag();
      if (!wasDrag) {
        const hit = pick(e.clientX, e.clientY);
        activate(hit);
        if (pointer) showTip(hit, pointer.x, pointer.y);
      }
      kick();
    });
    window.addEventListener('pointercancel', (e) => {
      if (drag && e.pointerId === drag.id) clearDrag();
    });
    canvas.addEventListener('pointerleave', () => { if (!drag) { showTip(null); state.hovered = null; } });
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'e' || e.key === 'E') && state.hovered && !e.metaKey && !e.ctrlKey && !e.altKey) {
        activate(state.hovered);
        if (pointer) showTip(state.hovered, pointer.x, pointer.y);
      }
    });
  }

  // ---------- loop ----------
  let lastT = performance.now();
  let idleFrames = 0;
  function frame(now) {
    state.raf = 0;
    const raw = (now - lastT) / 1000;
    const dt = Math.max(0, Math.min(0.05, raw));
    let busy = false;

    // inertia
    if (state.vel) {
      const elapsed = Math.max(0, (now - Math.max(lastT, releasedAt)) / 1000);
      const decay = Math.exp(-INERTIA_DECAY * elapsed);
      state.rotY += state.vel * (1 - decay) / INERTIA_DECAY;
      state.vel *= decay;
      if (Math.abs(state.vel) < 0.003) state.vel = 0;
      busy = true;
    }
    lastT = now;
    spin.rotation.y = state.rotY;

    const dtl = state.tiltTarget - state.tilt;
    if (Math.abs(dtl) > 0.01) {
      state.tilt += dtl * (1 - Math.pow(0.0008, dt));
      updateCamera();
      busy = true;
    }

    // day/night
    const dk = state.kTarget - state.k;
    if (Math.abs(dk) > 0.001) { state.k += Math.sign(dk) * Math.min(Math.abs(dk), dt / 1.2); applyMode(); busy = true; }

    // doors and windows
    for (const t of toggles) {
      const d = t.target - t.node.rotation.y;
      if (Math.abs(d) > 0.0005) { t.node.rotation.y += d * (1 - Math.pow(0.002, dt)); busy = true; }
    }

    // float
    const t = (now - state.t0) / 1000;
    if (o.float && !o.still) {
      float.position.y = Math.sin(t * 0.55) * state.radius * 0.012;
      float.rotation.z = Math.sin(t * 0.37) * 0.006;
      float.rotation.x = Math.sin(t * 0.29 + 1) * 0.004;
      if (clouds) clouds.children.forEach((c, i) => {
        c.position.x = c.userData.x0 + Math.sin(t * 0.05 * c.userData.drift + i) * state.radius * 0.06;
      });
      busy = true;
    }

    renderer.render(scene, camera);
    if (watchdogTimes && state.ready) {
      watchdogTimes.push(raw);
      if (watchdogTimes.length >= 36) {
        const sorted = watchdogTimes.slice(6).sort((a, b) => a - b);
        watchdogTimes = null;
        const median = sorted[Math.floor(sorted.length / 2)];
        if (median > 0.055) container.dispatchEvent(new CustomEvent('island:slow', { detail: { median } }));
      }
    }
    if (!state.firstFrame && state.ready) {
      state.firstFrame = true;
      container.dispatchEvent(new CustomEvent('island:ready'));
    }
    if (busy) idleFrames = 0; else idleFrames++;
    if (state.visible && (busy || idleFrames < 2)) state.raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!state.raf && state.visible) { lastT = performance.now(); state.raf = requestAnimationFrame(frame); }
  }

  // only run while visible
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      state.visible = es[0].isIntersecting && !document.hidden;
      if (state.visible) kick();
    }, { threshold: 0 }).observe(container);
  }
  document.addEventListener('visibilitychange', () => { state.visible = !document.hidden; if (state.visible) kick(); });
  const ro = new ResizeObserver(() => layout());
  ro.observe(container);

  ready.then(() => kick());

  function dispose() {
    state.visible = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    ro.disconnect();
    renderer.dispose();
    canvas.remove();
    if (tip) tip.remove();
  }

  return {
    ready,
    setMode,
    dispose,
    setAnchor(ax, ay) { o.anchorX = ax; o.anchorY = ay; layout(); },
    renderer,
    get state() { return state; },
    renderOnce() { applyMode(); layout(); renderer.render(scene, camera); },
    debug: { scene, camera, toggles, root: float },
  };
}

export function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
