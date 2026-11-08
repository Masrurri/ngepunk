'use strict';
// ngepunk UI: panels, collection, brand, creator card, render loop. Drawing engine lives in app.js.
const $ = s => document.querySelector(s);
const cv = $('#cv'), mctx = cv.getContext('2d');
const STORE = 'ngepunk';
let cfg = load();
const view = { yaw: 0.45, pitch: 0.06, tilt: 0 };
let spin = false, tab = 'base', dirty = true, thumbs = [];
function load() { try { const s = JSON.parse(localStorage.getItem(STORE)); if (s) return { ...DEFAULT, ...s }; } catch (e) { } return { ...DEFAULT }; }
function save() { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { } }
function set(p) { Object.assign(cfg, p); save(); dirty = true; refresh(); }

const LABELS = { peci1: 'peci low', peci2: 'peci mid', peci3: 'peci tall', lensmask: 'lens mask' };
const TABS = [
  { id: 'base', label: 'Base', groups: [['type', 'Character'], ['head', 'Head shape'], ['ears', 'Ears']] },
  { id: 'body', label: 'Body', groups: [['body', 'Half body']] },
  { id: 'eyes', label: 'Eyes', groups: [['eyes', 'Eyes'], ['brows', 'Brows']], sliders: [['eyeGap', 'Eye spacing', 0.2, 0.55, 0.01]] },
  { id: 'face', label: 'Nose + mouth', groups: [['nose', 'Nose'], ['mouth', 'Mouth']], sliders: [['featY', 'Feature height', -0.2, 0.25, 0.01], ['featScale', 'Feature size', 0.7, 1.4, 0.01]] },
  { id: 'hair', label: 'Hair + fur', groups: [['hair', 'Hair / fur pattern']] },
  { id: 'beard', label: 'Facial hair', groups: [['beard', 'Beard'], ['stache', 'Mustache']] },
  { id: 'hat', label: 'Headwear', groups: [['hat', 'Hats, masks + culture']] },
  { id: 'eyewear', label: 'Eyewear', groups: [['eyewear', 'Eyewear + masks']] },
  { id: 'bits', label: 'Punk bits', groups: [['extras', 'Extras — pick many']] },
  { id: 'color', label: 'Color', colors: [['skin', 'Skin / fur'], ['hairColor', 'Hair'], ['topColor', 'Clothes'], ['hatColor', 'Headwear, masks + tie']], seg: [['fill', 'Fill style']] },
  { id: 'scene', label: 'Scene', seg: [['bg', 'Background']], toggles: [['shade', 'Halftone shading'], ['boil', 'Line boil (on twos)'], ['dieCut', 'Die-cut sticker'], ['cutGrid', 'Die-cut grid']], sliders: [['weight', 'Ink weight', 0.8, 4, 0.1], ['wobble', 'Wobble', 0, 3, 0.1], ['mis', 'Misregister', 0, 14, 0.5], ['cutSize', 'Die-cut size', 4, 36, 1]], colorsAfter: [['cutColor', 'Die-cut color', ['#ffffff', ...COLORS.slice(1)]]] },
];
function variant(key, val) {
  if (key === 'type') return { ...cfg, ...PRESET[val], extras: val === 'cat' ? [...new Set([...cfg.extras, 'whiskers'])] : cfg.extras.filter(e => e !== 'whiskers') };
  if (key === 'extras') return { ...cfg, extras: cfg.extras.includes(val) ? cfg.extras : [...cfg.extras, val] };
  return { ...cfg, [key]: val };
}
function el(tag, attrs = {}, kids = []) { const e = document.createElement(tag); for (const k in attrs) { if (k === 'on') e.addEventListener('click', attrs.on); else if (k === 'text') e.textContent = attrs.text; else e.setAttribute(k, attrs[k]); } for (const k of kids) e.append(k); return e; }
function buildTabs() {
  const t = $('#tabs'); t.innerHTML = '';
  for (const T of TABS) t.append(el('button', { class: T.id === tab ? 'on' : '', text: T.label, on: () => { tab = T.id; buildTabs(); buildPanel(); } }));
}
function sliderRow(key, label, min, max, step, obj = cfg, onset) {
  const out = el('output', { text: (+obj[key]).toFixed(2) }), inp = el('input', { type: 'range', min, max, step, value: obj[key], 'aria-label': label });
  inp.addEventListener('input', () => { out.textContent = (+inp.value).toFixed(2); if (onset) onset(+inp.value); else set({ [key]: +inp.value }); });
  const row = el('label', { class: 'sl' }, [el('span', { text: label }), inp, out]); row.inp = inp; row.out = out; return row;
}
function buildPanel() {
  const p = $('#panel'), T = TABS.find(t => t.id === tab); p.innerHTML = ''; thumbs = [];
  for (const [key, label] of T.groups || []) {
    p.append(el('h3', {}, [el('span', { text: label })]));
    const g = el('div', { class: 'grid' });
    for (const v of OPTS[key]) {
      const c = el('canvas', { width: 168, height: 140 }), b = el('button', { class: 'tile', 'aria-label': `${label}: ${LABELS[v] || v}`, on: () => {
        if (key === 'extras') set({ extras: cfg.extras.includes(v) ? cfg.extras.filter(e => e !== v) : [...cfg.extras, v] });
        else if (key === 'type') set(variant('type', v));
        else set({ [key]: v });
      } }, [c, el('small', { text: LABELS[v] || v })]);
      thumbs.push({ c, b, key, v }); g.append(b);
    }
    p.append(g);
  }
  const swatches = ([key, label, pal = COLORS]) => {
    p.append(el('h3', { text: label }));
    const w = el('div', { class: 'swatches' });
    for (const col of pal) { const b = el('button', { class: 'sw' + (col ? '' : ' none'), 'aria-label': `${label}: ${col || 'none'}`, on: () => set({ [key]: col }) }); if (col) b.style.background = col; b.dataset.key = key; b.dataset.val = col || ''; w.append(b); }
    p.append(w);
  };
  (T.colors || []).forEach(swatches);
  for (const [key, label] of T.seg || []) {
    p.append(el('h3', { text: label }));
    const s = el('div', { class: 'seg' });
    for (const v of OPTS[key]) { const b = el('button', { text: v, on: () => set({ [key]: v }) }); b.dataset.key = key; b.dataset.val = v; s.append(b); }
    p.append(s);
  }
  if (T.toggles) { p.append(el('h3', { text: 'Effects' })); const w = el('div', { class: 'toggles' }); for (const [key, label] of T.toggles) { const b = el('button', { class: 'toggle', text: label, on: () => set({ [key]: !cfg[key] }) }); b.dataset.key = key; b.dataset.toggle = 1; w.append(b); } p.append(w); }
  if (T.sliders) { p.append(el('h3', { text: 'Adjust' })); for (const s of T.sliders) p.append(sliderRow(...s)); }
  (T.colorsAfter || []).forEach(swatches);
  if (tab === 'scene') {
    p.append(el('h3', { text: 'Collage' }), el('button', { class: 'toggle', text: 'Shuffle collage', on: () => set({ bgSeed: Math.floor(Math.random() * 1e6) }) }));
  }
  refresh();
}
let thumbQueued = false;
function refresh() {
  for (const t of thumbs) t.b.classList.toggle('on', t.key === 'extras' ? cfg.extras.includes(t.v) : cfg[t.key] === t.v);
  document.querySelectorAll('#panel [data-key]').forEach(b => b.classList.toggle('on', b.dataset.toggle ? !!cfg[b.dataset.key] : (cfg[b.dataset.key] || '') === b.dataset.val));
  if (!thumbQueued) { thumbQueued = true; requestAnimationFrame(() => { thumbQueued = false; drawThumbs(); }); }
}
// Render a character into a small canvas (tiles, collection, logo, avatar).
function paint(canvas, c, o = {}) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, body = !['none', 'stick'].includes(c.body);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H); }
  try { renderChar(ctx, { ...c, boil: false }, { W, H, cx: W / 2, cy: o.cy ?? (body ? H * 0.32 : H * 0.54), S: o.S ?? (body ? H * 0.18 : H * 0.3), yaw: o.yaw ?? 0.5, pitch: 0.05, tilt: o.tilt || 0, tick: 0, paper: o.paper || '#fff', thumb: true }); }
  catch (e) { console.error(e); }
}
function drawThumbs() {
  for (const t of thumbs) {
    const H = t.c.height, bodyish = t.key === 'body', tall = ['hair', 'hat', 'type', 'ears'].includes(t.key);
    paint(t.c, variant(t.key, t.v), { bg: '#fff', cy: bodyish ? H * 0.3 : tall ? H * 0.56 : H * 0.5, S: bodyish ? H * 0.17 : tall ? H * 0.27 : H * 0.34 });
  }
}
function buildDock() {
  const d = $('#dock'); d.innerHTML = '';
  const setView = (k, v) => { view[k] = v; dirty = true; };
  const yaw = sliderRow('yaw', 'Turn', -PI, PI, 0.01, view, v => setView('yaw', v));
  const pitch = sliderRow('pitch', 'Nod', -0.6, 0.6, 0.01, view, v => setView('pitch', v));
  const tilt = sliderRow('tilt', 'Tilt', -0.5, 0.5, 0.01, view, v => setView('tilt', v));
  d.syncs = () => { for (const [row, k] of [[yaw, 'yaw'], [pitch, 'pitch'], [tilt, 'tilt']]) { const v = ((view[k] + PI) % TAU + TAU) % TAU - PI; row.inp.value = k === 'yaw' ? v : view[k]; row.out.textContent = (+row.inp.value).toFixed(2); } };
  const seg = el('div', { class: 'seg' });
  for (const [n, y] of [['Front', 0], ['¾', 0.6], ['Side', PI / 2], ['Back', PI]]) seg.append(el('button', { text: n, on: () => { view.yaw = y; view.pitch = 0.04; view.tilt = 0; dirty = true; d.syncs(); } }));
  const sp = el('button', { class: 'toggle', text: 'Spin', on: () => { spin = !spin; sp.classList.toggle('on', spin); } });
  d.append(yaw, pitch, tilt, seg, sp);
}
const layer = document.createElement('canvas'), silCv = document.createElement('canvas'), cutCv = document.createElement('canvas');
function drawMain(tick) {
  const W = cv.width, H = cv.height, clear = cfg.bg === 'transparent';
  cv.parentElement.classList.toggle('checker', clear);
  for (const c of [layer, silCv, cutCv]) if (c.width !== W) { c.width = W; c.height = H; }
  // character on its own layer, so it can be stickered and sit on any (or no) background
  const l = layer.getContext('2d'); l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, W, H);
  const hasBody = !['none', 'stick'].includes(cfg.body);
  renderChar(l, cfg, { W, H, cx: W / 2, cy: hasBody ? 390 : 470, S: hasBody ? 150 : 185, ...view, tick, paper: paperFor(cfg.bg) });
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, W, H);
  if (!clear) mctx.drawImage(background(cfg.bg, W, H, cfg.bgSeed || 3), 0, 0);
  if (cfg.dieCut) dieCut(mctx, layer, cfg.cutSize, cfg.cutColor || '#ffffff', cfg.cutGrid);
  mctx.drawImage(layer, 0, 0);
  if (!clear && cfg.bg !== 'white') grain(mctx, W, H);
}
// Sticker border: stamp the character's silhouette in a ring around itself, optionally ruled like grid paper.
function dieCut(ctx, src, rad, color, gridOn) {
  const W = cutCv.width, H = cutCv.height, s = silCv.getContext('2d'), t = cutCv.getContext('2d');
  t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H);
  const stamp = (col, r) => {
    s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, W, H); s.drawImage(src, 0, 0);
    s.globalCompositeOperation = 'source-in'; s.fillStyle = col; s.fillRect(0, 0, W, H);
    for (let k = 0; k < 32; k++) { const a = k / 32 * TAU; t.drawImage(silCv, Math.cos(a) * r, Math.sin(a) * r); }
  };
  stamp('rgba(0,0,0,0.22)', rad + 2); stamp(color, rad);
  if (gridOn) { // thin grid-paper rules, only on the sticker
    t.globalCompositeOperation = 'source-atop'; t.strokeStyle = 'rgba(0,0,0,0.14)'; t.lineWidth = 1; t.beginPath();
    for (let x = 0.5; x < W; x += 20) { t.moveTo(x, 0); t.lineTo(x, H); }
    for (let y = 0.5; y < H; y += 20) { t.moveTo(0, y); t.lineTo(W, y); }
    t.stroke(); t.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(cutCv, 0, 0);
}

// ---------------------------------------------------------------- collection
const SCENE_KEYS = ['bg', 'bgSeed', 'boil', 'shade', 'weight', 'wobble', 'mis', 'fill', 'body', 'dieCut', 'cutSize', 'cutColor', 'cutGrid'];
function buildCollection() {
  const g = $('#collGrid'); g.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const c = { ...randomCfg(), body: 'none' }, yaw = (Math.random() - 0.5) * 1.6, tilt = (Math.random() - 0.5) * 0.35;
    const can = el('canvas', { width: 200, height: 200 });
    g.append(el('button', { class: 'ctile', 'aria-label': `Edit collection character ${i + 1}`, on: () => {
      const keep = {}; for (const k of SCENE_KEYS) keep[k] = cfg[k];
      cfg = { ...c, ...keep }; Object.assign(view, { yaw, pitch: 0.05, tilt }); save(); dirty = true; buildPanel(); $('#dock').syncs();
    } }, [can]));
    paint(can, c, { yaw, tilt, S: 58 });
  }
}

// ---------------------------------------------------------------- brand + creator
// The logo + creator art are real drawings on grid paper: flood-fill the paper away from the
// edges (interior whites like teeth survive), then draw a crop into the target canvas.
function cutout(src, target, [sx, sy, sw, sh]) {
  const img = new Image();
  img.onload = () => {
    const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H), px = d.data, seen = new Uint8Array(W * H), stack = [];
    const paper = i => { const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2]; return Math.min(r, gg, b) > 196 && Math.max(r, gg, b) - Math.min(r, gg, b) < 22; };
    for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    while (stack.length) {
      const i = stack.pop(); if (seen[i] || !paper(i)) continue;
      seen[i] = 1; px[i * 4 + 3] = 0;
      const x = i % W; if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (i >= W) stack.push(i - W); if (i < W * (H - 1)) stack.push(i + W);
    }
    g.putImageData(d, 0, 0);
    const t = target.getContext('2d'); t.clearRect(0, 0, target.width, target.height);
    t.drawImage(c, sx, sy, sw, sh, 0, 0, target.width, target.height);
  };
  img.src = src;
}
cutout('assets/logo.webp', $('#logo'), [245, 175, 510, 510]);
cutout('assets/creator-head.webp', $('#creatorIcon'), [280, 220, 440, 440]);
cutout('assets/creator.webp', $('#avatar'), [110, 190, 780, 780]);
$('#creatorBtn').addEventListener('click', () => $('#creator').showModal());
$('#creatorClose').addEventListener('click', () => $('#creator').close());
$('#creator').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// ---------------------------------------------------------------- events + loop
let drag = null;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  view.yaw += dx * 0.012; view.pitch = clamp(view.pitch + dy * 0.006, -0.6, 0.6); drag.x = e.clientX; drag.y = e.clientY; dirty = true; $('#dock').syncs();
});
cv.addEventListener('pointerup', () => { drag = null; });
function randomize() { cfg = randomCfg(); save(); dirty = true; buildPanel(); }
$('#rand').addEventListener('click', randomize);
$('#shuffle').addEventListener('click', buildCollection);
$('#collToggle').addEventListener('click', () => { const open = $('#coll').classList.toggle('open'); $('#collBar').classList.toggle('open', open); $('#collToggle').setAttribute('aria-expanded', open); });
$('#export').addEventListener('click', () => cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ngepunk-' + Date.now() + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }));
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || $('#creator').open) return;
  if (e.key === 'r' || e.key === 'R') randomize();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { view.yaw += e.key === 'ArrowLeft' ? -0.15 : 0.15; dirty = true; $('#dock').syncs(); }
});
let lastTick = -1;
function frame(t) {
  requestAnimationFrame(frame);
  const tick = Math.floor(t / 83); // 12 fps, "on twos"
  if (cfg.boil && tick !== lastTick) { lastTick = tick; dirty = true; if (spin) { view.yaw += 0.09; $('#dock').syncs(); } }
  else if (spin && !cfg.boil) { view.yaw += 0.02; dirty = true; $('#dock').syncs(); }
  if (dirty) { dirty = false; try { drawMain(cfg.boil ? tick : 0); } catch (e) { console.error(e); } }
}
buildTabs(); buildPanel(); buildDock(); $('#dock').syncs(); buildCollection();
requestAnimationFrame(frame);
