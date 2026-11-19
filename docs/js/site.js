// 云上小屋 — small behaviours shared by all pages.
//   0. 中 / EN        中 by default; the switch in the nav swaps every line and remembers it (cc-lang)
//   1. 昼 / 夜        whole site follows the visitor's clock; one quiet switch in the hero
//   2. the island      3D on capable devices, the poster everywhere else
//   3. the strip       five renders; the one under the cursor opens up
//   4. parallax        the island lags the scroll a little, nothing else moves
//   5. bed             click to change the bedding colour (eight, as in game)
//   6. cabinet         hover to open the doors and drawers

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (root.dataset.mode === 'night' ? 'night' : 'day');
const lang = () => (root.dataset.lang === 'en' ? 'en' : 'zh');

// ---------- 0. 中 / EN ----------
// Text: both languages sit in the page as [data-l="zh"] / [data-l="en"]; CSS shows one, from <html data-lang>,
// which the <head> script sets before first paint. Here: <title>, and attributes with a data-en-* twin.
const LANG_ATTRS = ['alt', 'title', 'aria-label'];
const titleEl = document.querySelector('title');
const titles = { zh: document.title, en: (titleEl && titleEl.dataset.en) || document.title };
function applyLang(l) {
  root.dataset.lang = l;
  root.lang = l === 'en' ? 'en' : 'zh-CN';
  document.title = titles[l];
  LANG_ATTRS.forEach((a) => document.querySelectorAll(`[data-en-${a}]`).forEach((el) => {
    if (!el.hasAttribute(`data-zh-${a}`)) el.setAttribute(`data-zh-${a}`, el.getAttribute(a) || '');
    el.setAttribute(a, el.getAttribute(`data-${l}-${a}`));
  }));
}
function storedLang() {
  try { return localStorage.getItem('cc-lang') === 'en' ? 'en' : 'zh'; } catch (e) { return 'zh'; }
}
applyLang(lang());
document.querySelectorAll('.lang').forEach((b) => b.addEventListener('click', () => {
  const l = lang() === 'en' ? 'zh' : 'en';
  try { localStorage.setItem('cc-lang', l); } catch (e) { /* private mode */ }
  applyLang(l);
}));
// coming back with the browser's back button: pick up a choice made on another page
addEventListener('pageshow', (e) => { if (e.persisted && storedLang() !== lang()) applyLang(storedLang()); });
// write a line in both languages into its [data-l] pair
const say = (el, zh, en) => {
  el.querySelector('[data-l="zh"]').textContent = zh;
  el.querySelector('[data-l="en"]').textContent = en;
};
// links not up yet (aria-disabled, href="#") stay put instead of jumping to the top
document.querySelectorAll('a[aria-disabled="true"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

// ---------- 1. day / night ----------
function setMode(m) {
  root.dataset.mode = m;
  try { sessionStorage.setItem('cc-mode', m); } catch (e) { /* private mode */ }
  dispatchEvent(new CustomEvent('cc:mode', { detail: m }));
}
document.querySelectorAll('.daynight').forEach((b) => {
  const sync = () => b.setAttribute('aria-pressed', String(mode() === 'night'));
  sync();
  b.addEventListener('click', () => { setMode(mode() === 'night' ? 'day' : 'night'); sync(); });
});

// ---------- 2. the island ----------
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
function weakDevice() {
  if (params.has('static')) return true;
  if (params.has('force3d')) return false;
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return true;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return true;
  return !webglOK();
}

const host = document.getElementById('island');
if (host) {
  const poster = host.querySelector('.island-poster');
  const syncPoster = () => {
    const src = poster && poster.dataset[mode()];
    if (src && poster.getAttribute('src') !== src) poster.src = src;
  };
  syncPoster();
  addEventListener('cc:mode', syncPoster);

  const anchors = () => {
    const cs = getComputedStyle(host);
    return [parseFloat(cs.getPropertyValue('--ax')) || 0.5, parseFloat(cs.getPropertyValue('--ay')) || 0.5];
  };

  if (!weakDevice()) {
    import('./island.js').then(({ mountIsland }) => {
      const [ax, ay] = anchors();
      const isl = mountIsland(host, {
        mode: mode(), anchorX: ax, anchorY: ay,
        zoom: parseFloat(host.dataset.zoom) || 1.3,
        watchdog: !params.has('force3d'),
      });
      host.addEventListener('island:ready', () => host.classList.add('live'), { once: true });
      host.addEventListener('island:slow', () => { host.classList.remove('live'); setTimeout(() => isl.dispose(), 900); }, { once: true });
      addEventListener('cc:mode', (e) => isl.setMode(e.detail));
      addEventListener('resize', () => { const [x, y] = anchors(); isl.setAnchor(x, y); });
      isl.ready.catch(() => host.classList.remove('live'));
      window.__island = isl;
    }).catch(() => { /* keep the poster */ });
  }

  // ---------- 4. parallax: the island lags the page a little ----------
  if (!reduceMotion) {
    let queued = false;
    addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const y = scrollY;
        if (y < innerHeight * 1.3 && innerWidth > 860) host.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0)`;
      });
    }, { passive: true });
  }
}

// ---------- 3. the strip ----------
document.querySelectorAll('.strip').forEach((strip) => {
  const slats = [...strip.querySelectorAll('.slat')];
  let timer = 0;
  const open = (s) => slats.forEach((x) => x.classList.toggle('is-open', x === s));
  slats.forEach((s) => {
    s.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timer);
      timer = setTimeout(() => open(s), 90);
    });
    s.addEventListener('pointerleave', () => clearTimeout(timer));
    s.addEventListener('focus', () => open(s));
    s.addEventListener('click', () => open(s));
  });
});

// ---------- 5. bed: eight colours ----------
document.querySelectorAll('.thing.bed').forEach((bed) => {
  const names = ['奶白', '雾蓝', '鼠尾草绿', '砖红', '芥末黄', '深灰', '薰衣草紫', '烟粉'];
  const namesEn = ['Ivory', 'Mist blue', 'Sage', 'Brick', 'Mustard', 'Charcoal', 'Lavender', 'Dusty rose'];
  const base = bed.querySelector('img.base');
  const layer = bed.querySelector('img.layer');
  const label = bed.querySelector('figcaption b');
  const count = bed.querySelector('figcaption .count');
  let i = 0, busy = false;
  names.forEach((_, k) => { const im = new Image(); im.src = `img/bed-${k + 1}.jpg`; });
  const next = () => {
    if (busy) return;
    busy = true;
    i = (i + 1) % names.length;
    layer.src = `img/bed-${i + 1}.jpg`;
    layer.style.opacity = '1';
    say(label, names[i], namesEn[i]);
    count.textContent = `${i + 1} / 8`;
    setTimeout(() => {
      base.src = layer.src;
      layer.style.opacity = '0';
      busy = false;
    }, reduceMotion ? 0 : 450);
  };
  bed.addEventListener('click', next);
  bed.addEventListener('keydown', (e) => {
    if (['Enter', ' ', 'e', 'E'].includes(e.key)) { e.preventDefault(); next(); }
  });
});

// ---------- 6. cabinet: hover to open ----------
document.querySelectorAll('.thing.cabinet').forEach((cab) => {
  const set = (v) => {
    cab.classList.toggle('open', v);
    const b = cab.querySelector('figcaption b');
    if (b) say(b, v ? '开着' : '关着', v ? 'Open' : 'Closed');
  };
  let lastType = 'mouse';
  cab.addEventListener('pointerdown', (e) => { lastType = e.pointerType; });
  cab.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') set(true); });
  cab.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') set(false); });
  cab.addEventListener('click', () => { if (lastType !== 'mouse') set(!cab.classList.contains('open')); });
  cab.addEventListener('keydown', (e) => {
    if (['Enter', ' ', 'e', 'E'].includes(e.key)) { e.preventDefault(); set(!cab.classList.contains('open')); }
  });
});
