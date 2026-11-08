'use strict';
// ngepunk — hand-drawn 2.5D character maker.
// Every feature is defined on a head ellipsoid (lon/lat), rotated, then projected and inked
// with wobbly strokes, so a flat 2D drawing turns like a 3D object.

const PI = Math.PI, TAU = PI * 2, INK = '#141414';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- options
const OPTS = {
  type: ['human', 'cat'],
  head: ['round', 'egg', 'square', 'pear', 'long', 'potato', 'bean', 'chin', 'wide'],
  ears: ['normal', 'big', 'small', 'pointy', 'gauged', 'cat', 'none'],
  eyes: ['ring', 'dot', 'almond', 'sleepy', 'wide', 'uneven', 'closed', 'wink', 'x', 'spiral', 'slit', 'angry'],
  brows: ['none', 'line', 'thick', 'angry', 'worried', 'unibrow', 'raised'],
  nose: ['line', 'hook', 'button', 'triangle', 'beak', 'snub', 'long', 'cat', 'none'],
  mouth: ['line', 'smile', 'frown', 'open', 'grin', 'o', 'smirk', 'tongue', 'teeth', 'cat', 'fangs', 'rose'],
  hair: ['bald', 'buzz', 'crop', 'flattop', 'slick', 'hatched', 'curly', 'afro', 'bowl', 'mohawk', 'liberty', 'spiky', 'long', 'bun', 'tabby', 'patches', 'tux'],
  beard: ['none', 'stubble', 'goatee', 'full', 'chinstrap', 'chops', 'soul'],
  stache: ['none', 'chevron', 'pencil', 'handlebar', 'walrus', 'curly'],
  hat: ['none', 'beanie', 'pompom', 'cap', 'flatcap', 'headband', 'bandana', 'cowl', 'lensmask', 'luchador', 'turban', 'peci1', 'peci2', 'peci3', 'blangkon', 'bogo'],
  eyewear: ['none', 'round', 'square', 'shades', 'monocle', 'patch', 'visor', 'domino', 'cateye'],
  veil: ['none', 'hijab'],
  extras: ['nosering', 'browbar', 'hoops', 'safetypin', 'lipring', 'teardrop', 'tribal', 'barbwire', 'star', 'spikeband', 'choker', 'scar', 'bandaid', 'freckles', 'eyeblack', 'whiskers'],
  body: ['none', 'stick', 'tee', 'stripes', 'hoodie', 'jacket', 'turtleneck', 'suit'],
  fill: ['offset', 'scribble', 'flat'],
  bg: ['zine', 'paper', 'white', 'halftone', 'grid', 'transparent'],
};
const COLORS = [null, '#f3c9a8', '#dcae84', '#a87152', '#6e4632', '#bdbab3', '#9db3d1', '#a9b88c', '#f2a7b8', '#d9443a', '#f0cf45', '#4e6d9c', '#6f8a4a', '#c8743c', '#1b1b1b'];
const PRESET = {
  human: { type: 'human', head: 'round', ears: 'normal', nose: 'line', mouth: 'line', eyes: 'ring' },
  cat: { type: 'cat', head: 'wide', ears: 'cat', nose: 'cat', mouth: 'cat', eyes: 'slit', beard: 'none', stache: 'none', hair: 'tabby' },
};
const DEFAULT = {
  type: 'human', head: 'round', ears: 'normal', eyes: 'ring', brows: 'line', nose: 'line', mouth: 'smirk',
  hair: 'mohawk', beard: 'stubble', stache: 'none', hat: 'none', eyewear: 'none', extras: ['safetypin', 'nosering'],
  body: 'none', skin: '#f3c9a8', hairColor: '#d9443a', topColor: null, hatColor: '#d9443a',
  fill: 'offset', bg: 'grid', shade: true, boil: true, weight: 2.2, wobble: 1.2, mis: 6,
  eyeGap: 0.36, featY: 0, featScale: 1, seed: 7, veil: 'none', veilColor: '#9db3d1', dieCut: false, cutSize: 14, cutColor: '#ffffff', cutGrid: true,
};

const SHAPES = {
  round: () => [1, 1, 1],
  egg: (x, y) => { const t = 1 + 0.16 * y; return [0.9 * t, 1.12, 0.92 * t]; },
  square: (x, y, z) => { const s = Math.pow(x ** 4 + y ** 4 + z ** 4, -0.25); return [0.84 * s, 0.9 * s, 0.84 * s]; },
  pear: (x, y) => { const t = 1 - 0.2 * y; return [0.95 * t, 1.05, 0.95 * t]; },
  long: () => [0.8, 1.28, 0.85],
  potato: (x, y, z) => { const t = 1 + 0.07 * Math.sin(3 * Math.atan2(x, z) + 1) * (1 - y * y); return [1.14 * t, 0.88, t]; },
  bean: (x, y) => { const t = 1 + 0.14 * x * y; return [t, 1.06 * t, 0.95]; },
  chin: (x, y) => { const d = Math.max(0, -y); return [1 - 0.35 * d * d, 1 + 0.18 * d, 1 - 0.2 * d * d]; },
  wide: (x, y) => [1.18 * (1 - 0.06 * y), 0.9, 1],
};

// ---------------------------------------------------------------- projection
function makeR(ctx, c, o) {
  const S = o.S, cx = o.cx, cy = o.cy;
  const cY = Math.cos(o.yaw), sY = Math.sin(o.yaw), cP = Math.cos(o.pitch), sP = Math.sin(o.pitch), cT = Math.cos(o.tilt), sT = Math.sin(o.tilt);
  const rot = (x, y, z) => { const x1 = x * cY + z * sY, z1 = -x * sY + z * cY, y2 = y * cP - z1 * sP, z2 = y * sP + z1 * cP; return [x1 * cT - y2 * sT, x1 * sT + y2 * cT, z2]; };
  const shape = SHAPES[c.head] || SHAPES.round, ph = c.seed * 1.37;
  const k = S / 160;
  const ky = shape(0, 1, 0)[1];
  const r = {
    ctx, c, o, S, cx, cy, yaw: o.yaw, rot, ky, paper: o.paper,
    rand: mulberry(c.seed * 9973 + (o.tick | 0) * 7919),
    w: Math.max(0.8, c.weight * k), wob: c.wobble * k * (o.thumb ? 0.5 : 1), mis: o.thumb ? c.mis * k * 0.5 : c.mis * k,
  };
  r.dir = (nx, ny, nz, h = 0) => {
    const s = shape(nx, ny, nz), lump = 1 + 0.035 * Math.sin(nx * 4.1 + ph) * Math.cos(ny * 3.3 + ph * 0.7);
    const p = rot(nx * (s[0] * lump + h), -ny * (s[1] * lump + h), nz * (s[2] * lump + h));
    const n = rot(nx, -ny, nz);
    return { x: cx + p[0] * S, y: cy + p[1] * S, z: n[2] };
  };
  r.surf = (lon, lat, h = 0) => { const cl = Math.cos(lat); return r.dir(Math.sin(lon) * cl, Math.sin(lat), Math.cos(lon) * cl, h); };
  const fs = c.featScale, fy = c.featY;
  r.F = (x, y, h = 0) => r.surf(x * fs, -(fy + y * fs), h * fs);
  return r;
}

// ---------------------------------------------------------------- ink primitives
function smoothPath(p, q, close) {
  const n = q.length;
  if (n < 3) { p.moveTo(q[0][0], q[0][1]); for (let i = 1; i < n; i++) p.lineTo(q[i][0], q[i][1]); if (close) p.closePath(); return; }
  if (close) {
    p.moveTo((q[n - 1][0] + q[0][0]) / 2, (q[n - 1][1] + q[0][1]) / 2);
    for (let i = 0; i < n; i++) { const a = q[i], b = q[(i + 1) % n]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    p.closePath();
  } else {
    p.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < n - 1; i++) { const a = q[i], b = q[i + 1]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    p.lineTo(q[n - 1][0], q[n - 1][1]);
  }
}
function polyPath(p, q, close) { p.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) p.lineTo(q[i][0], q[i][1]); if (close) p.closePath(); }
function pathOf(pts, smooth = true) { const p = new Path2D(); (smooth ? smoothPath : polyPath)(p, pts.map(a => [a.x, a.y]), true); return p; }

// Wobbly double-pass ink line (the "hand drawn" look).
function stroke(r, pts, opt = {}) {
  if (pts.length < 2) return;
  const ctx = r.ctx, w = (opt.w || 1) * r.w, wob = r.wob * (opt.wob ?? 1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = opt.color || INK;
  const passes = opt.single ? 1 : 2;
  for (let pass = 0; pass < passes; pass++) {
    const p1 = r.rand() * TAU, p2 = r.rand() * TAU, f = 0.45 + r.rand() * 0.6;
    const q = pts.map((p, i) => [p.x + Math.sin(i * f + p1) * wob + (r.rand() - 0.5) * wob * 0.5, p.y + Math.cos(i * f * 1.3 + p2) * wob + (r.rand() - 0.5) * wob * 0.5]);
    ctx.beginPath(); (opt.sharp ? polyPath : smoothPath)(ctx, q, opt.close);
    ctx.lineWidth = pass ? w * 0.45 : w; ctx.globalAlpha = pass ? 0.55 : 1; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// Stroke only the parts of a projected polyline that face the viewer.
function fline(r, pts, opt = {}, thr = 0.02) {
  const runs = []; let run = [];
  for (const p of pts) { if (p.z > thr) run.push(p); else { if (run.length > 1) runs.push(run); run = []; } }
  if (run.length > 1) runs.push(run);
  if (opt.close && runs.length === 1 && runs[0].length === pts.length) return stroke(r, pts, opt);
  for (const rr of runs) stroke(r, rr, { ...opt, close: false });
}
const P = (r, arr) => arr.map(a => r.F(a[0], a[1], a[2] || 0));
const line = (r, arr, opt = {}, thr) => fline(r, P(r, arr), opt, thr);
function blob(r, arr, color = INK, thr = 0.02) {
  const p = P(r, arr); if (p.filter(q => q.z > thr).length < p.length * 0.7) return false;
  r.ctx.fillStyle = color; r.ctx.fill(pathOf(p)); return true;
}
function circ(cx, cy, rx, ry, h = 0.01, n = 16) { const o = []; for (let i = 0; i < n; i++) { const t = i / n * TAU; o.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, h]); } return o; }
function curve(x0, x1, f, h = 0.01, n = 10) { const o = []; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; o.push([x, f(x), h]); } return o; }
function dot(r, p, rad) { r.ctx.beginPath(); r.ctx.arc(p.x, p.y, rad, 0, TAU); r.ctx.fill(); }

// Surface patch from a (u,v) grid → one Path2D (quads slightly grown so seams vanish).
function grid(r, nu, nv, fn) {
  const G = [];
  for (let i = 0; i <= nu; i++) { const col = []; for (let j = 0; j <= nv; j++) col.push(fn(i / nu, j / nv)); G.push(col); }
  const path = new Path2D(); let any = false;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const q = [G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]];
    if ((q[0].z + q[1].z + q[2].z + q[3].z) / 4 < -0.06) continue;
    const mx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4, my = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
    let pts = q.map(p => [mx + (p.x - mx) * 1.15 + Math.sign(p.x - mx) * 0.5, my + (p.y - my) * 1.15 + Math.sign(p.y - my) * 0.5]);
    let area = 0; for (let k = 0; k < 4; k++) { const a = pts[k], b = pts[(k + 1) % 4]; area += a[0] * b[1] - b[0] * a[1]; }
    if (Math.abs(area) < 0.01) continue;
    if (area < 0) pts = pts.reverse(); // one winding for all quads → nonzero fill = union
    polyPath(path, pts, true); any = true;
  }
  return any ? { path, G } : null;
}
// Band on the head between latitude curves lo(lon)..hi(lon).
function band(r, lon0, lon1, lo, hi, h = 0, nu = 64, nv = 10) {
  return grid(r, nu, nv, (u, v) => {
    const lon = lon0 + (lon1 - lon0) * u, a = lo(lon), b = hi(lon), lat = a + (b - a) * v;
    return r.surf(lon, lat, typeof h === 'function' ? h(lon, lat) : h);
  });
}
const edge = (g, j) => g.G.map(col => col[j === -1 ? col.length - 1 : j]);

// ---------------------------------------------------------------- fills & textures
const patCache = new Map();
function dots(ctx, size, rad, color) {
  const key = size + '|' + rad + '|' + color;
  if (!patCache.has(key)) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d'); g.fillStyle = color; g.beginPath(); g.arc(size / 2, size / 2, rad, 0, TAU); g.fill();
    patCache.set(key, cv);
  }
  return ctx.createPattern(patCache.get(key), 'repeat');
}
function colorFill(r, path, color) {
  if (!color) return;
  const ctx = r.ctx; ctx.save();
  const off = r.c.fill === 'flat' ? 0 : r.mis;
  ctx.translate(off, off * 0.6); ctx.globalCompositeOperation = 'multiply';
  if (r.c.fill === 'scribble') {
    ctx.clip(path); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, r.S * 0.035); ctx.globalAlpha = 0.9; ctx.lineJoin = 'round';
    const W = r.o.W, H = r.o.H, gap = Math.max(2, r.S * 0.04), R = mulberry(r.c.seed + 3);
    ctx.beginPath(); ctx.moveTo(-10, -10);
    for (let y = -10, k = 0; y < H + W * 0.3; y += gap, k++) ctx.lineTo(k % 2 ? W + 10 : -10, y + (R() - 0.5) * gap);
    ctx.stroke();
  } else { ctx.globalAlpha = r.c.fill === 'flat' ? 1 : 0.9; ctx.fillStyle = color; ctx.fill(path); }
  ctx.restore();
}
function hatch(r, ang, gap, w = 0.6, color = INK) {
  const ctx = r.ctx, L = r.S * 2.2; gap = Math.max(2, gap * r.S / 160);
  ctx.save(); ctx.translate(r.cx, r.cy); ctx.rotate(ang); ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.6, w * r.w); ctx.beginPath();
  for (let y = -L; y < L; y += gap) { const j = (r.rand() - 0.5) * gap * 0.6; ctx.moveTo(-L, y + j); ctx.quadraticCurveTo(0, y + (r.rand() - 0.5) * gap, L, y - j); }
  ctx.stroke(); ctx.restore();
}
function stipple(r, n, color = INK) {
  const ctx = r.ctx, L = r.S * 1.9, s = Math.max(1, r.S * 0.011); ctx.fillStyle = color;
  n = Math.round(n * (r.S / 160) ** 2) + 30;
  for (let i = 0; i < n; i++) ctx.fillRect(r.cx + (r.rand() * 2 - 1) * L, r.cy + (r.rand() * 2 - 1) * L, s, s);
}
function inClip(r, path, f) { r.ctx.save(); r.ctx.clip(path); f(); r.ctx.restore(); }

// Radial silhouette of the head (also used to find where hair pokes past the head).
const SIL_N = 120;
function silhouette(r) {
  const R = new Float32Array(SIL_N);
  const add = p => { const dx = p.x - r.cx, dy = p.y - r.cy, b = Math.floor((Math.atan2(dy, dx) / TAU + 1) * SIL_N) % SIL_N, d = Math.hypot(dx, dy); if (d > R[b]) R[b] = d; };
  for (let j = 0; j <= 28; j++) { const lat = -PI / 2 + j * PI / 28; for (let i = 0; i < 56; i++) add(r.surf(-PI + i * TAU / 56, lat)); }
  for (let pass = 0; pass < 2; pass++) { const c = R.slice(); for (let i = 0; i < SIL_N; i++) R[i] = Math.max(c[i], (c[(i + SIL_N - 1) % SIL_N] + c[(i + 1) % SIL_N]) / 2); }
  const c2 = R.slice(); for (let i = 0; i < SIL_N; i++) R[i] = (c2[(i + SIL_N - 1) % SIL_N] + 2 * c2[i] + c2[(i + 1) % SIL_N]) / 4;
  r.silR = R;
  r.sil = Array.from(R, (d, i) => { const a = (i + 0.5) / SIL_N * TAU; return { x: r.cx + Math.cos(a) * d, y: r.cy + Math.sin(a) * d, z: 1 }; });
  r.silPath = pathOf(r.sil);
}
// Ink the outer contour of anything (hair volume, hats) that sticks out past the head.
function hullStroke(r, pts, opt = {}) {
  const M = new Float32Array(SIL_N);
  for (const p of pts) { if (p.z < -0.12) continue; const dx = p.x - r.cx, dy = p.y - r.cy, b = Math.floor((Math.atan2(dy, dx) / TAU + 1) * SIL_N) % SIL_N, d = Math.hypot(dx, dy); if (d > M[b]) M[b] = d; }
  for (let i = 0; i < SIL_N; i++) if (!M[i]) { const a = M[(i + SIL_N - 1) % SIL_N], b = M[(i + 1) % SIL_N]; if (a && b) M[i] = (a + b) / 2; }
  const out = i => M[i] > r.silR[i] + 1.2 * r.w;
  let start = 0; while (start < SIL_N && out(start)) start++;
  if (start === SIL_N) return stroke(r, Array.from(M, (d, i) => { const a = (i + 0.5) / SIL_N * TAU; return { x: r.cx + Math.cos(a) * d, y: r.cy + Math.sin(a) * d }; }), { ...opt, close: true });
  let run = [];
  for (let k = 1; k <= SIL_N; k++) {
    const i = (start + k) % SIL_N;
    if (out(i)) { const a = (i + 0.5) / SIL_N * TAU; run.push({ x: r.cx + Math.cos(a) * M[i], y: r.cy + Math.sin(a) * M[i] }); }
    else { if (run.length > 2) stroke(r, run, opt); run = []; }
  }
}
// Screen-space spike from a surface direction (always shows its width).
function spike(r, d, h, w, fill) {
  const B = r.dir(d[0], d[1], d[2], 0), T = r.dir(d[0], d[1], d[2], h);
  let dx = T.x - B.x, dy = T.y - B.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const W = w * r.S, pts = [{ x: B.x - dy * W, y: B.y + dx * W }, T, { x: B.x + dy * W, y: B.y - dx * W }];
  r.ctx.fillStyle = fill; r.ctx.fill(pathOf(pts, false));
  stroke(r, pts, { sharp: true, single: true });
}

// ---------------------------------------------------------------- head base, ears, shading
function headBase(r) {
  const ctx = r.ctx, c = r.c;
  ctx.fillStyle = r.paper; ctx.fill(r.silPath);
  colorFill(r, r.silPath, c.skin);
  if (c.shade) shadeHead(r);
  stroke(r, r.sil, { close: true, w: 1.25 });
}
function shadeHead(r) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of r.sil) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const ox = (x0 + x1) / 2, oy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  const L = norm([-0.55, -0.5, 0.65]), u = norm(cross(L, [0, 0, 1])), v = cross(L, u);
  // region where normal·L < cc, seen from the front, as a screen polygon
  const region = cc => {
    const s = Math.sqrt(1 - cc * cc), pts = [];
    for (let i = 0; i < 72; i++) { const t = i / 72 * TAU, d = [cc * L[0] + s * (u[0] * Math.cos(t) + v[0] * Math.sin(t)), cc * L[1] + s * (u[1] * Math.cos(t) + v[1] * Math.sin(t)), cc * L[2] + s * (u[2] * Math.cos(t) + v[2] * Math.sin(t))]; pts.push({ x: ox + d[0] * rx, y: oy + d[1] * ry, vis: d[2] >= 0 }); }
    if (pts.every(p => p.vis)) return pathOf(pts, false);
    let st = pts.findIndex((p, i) => p.vis && !pts[(i + 71) % 72].vis); if (st < 0) return null;
    const arc = []; for (let k = 0; k < 72 && pts[(st + k) % 72].vis; k++) arc.push(pts[(st + k) % 72]);
    const far = Math.max(rx, ry) * 4, a = arc[0], b = arc[arc.length - 1];
    arc.push({ x: b.x - L[0] * far, y: b.y - L[1] * far }, { x: a.x - L[0] * far, y: a.y - L[1] * far });
    return pathOf(arc, false);
  };
  const ctx = r.ctx, sz = Math.max(3, Math.round(r.S * 0.04));
  ctx.save(); ctx.clip(r.silPath);
  ctx.globalAlpha = 0.85;
  const a = region(0.12); if (a) { ctx.fillStyle = dots(ctx, sz, sz * 0.18, INK); ctx.fill(a); }
  const b = region(-0.25); if (b) { ctx.fillStyle = dots(ctx, sz, sz * 0.3, INK); ctx.fill(b); }
  ctx.restore();
}
function ears(r, phase) {
  const c = r.c; if (c.ears === 'none') return;
  if (c.ears === 'cat') return catEars(r, phase);
  const sz = { normal: 1, big: 1.45, small: 0.7, pointy: 1.1, gauged: 1 }[c.ears] || 1;
  for (const s of [-1, 1]) {
    const lon0 = s * (PI / 2 - 0.12), lat0 = -0.08 - c.featY * 0.6;
    const front = r.surf(lon0, lat0).z > -0.05;
    if ((phase === 'front') !== front) continue;
    const ear = (k, n = 14) => { const o = []; for (let i = 0; i <= n; i++) { const a = -PI / 2 + PI * i / n, ca = Math.cos(a); let up = 0; if (c.ears === 'pointy') up = 0.2 * Math.max(0, -Math.sin(a)) ** 4; o.push(r.surf(lon0 + s * k * sz * (0.13 * ca + up * 0.6), lat0 - k * sz * 0.22 * Math.sin(a) + up, k * sz * (0.17 * ca + up * 0.5))); } return o; };
    const rim = ear(1);
    r.ctx.fillStyle = r.paper; const pth = pathOf(rim); r.ctx.fill(pth); colorFill(r, pth, c.skin);
    stroke(r, rim, { w: 1.1 });
    stroke(r, ear(0.6, 8).slice(3, 7), { w: 0.7, single: true });
    if (c.ears === 'gauged') { const p = rim[12]; r.ctx.fillStyle = INK; dot(r, p, r.S * 0.035); r.ctx.fillStyle = r.paper; dot(r, p, r.S * 0.018); }
  }
}
function catEars(r, phase) {
  const c = r.c;
  for (const s of [-1, 1]) {
    const lon = s * 0.62, lat = 0.92 + c.featY * -0.3, cl = Math.cos(lat);
    const d = [Math.sin(lon) * cl, Math.sin(lat), Math.cos(lon) * cl];
    if ((r.dir(...d).z > -0.25) !== (phase === 'front')) continue;
    const t1 = norm(cross([0, 1, 0], d)), t2 = cross(d, t1);
    const at = (a, b, h) => { const q = norm([d[0] + t1[0] * a + t2[0] * b, d[1] + t1[1] * a + t2[1] * b, d[2] + t1[2] * a + t2[2] * b]); return r.dir(q[0], q[1], q[2], h); };
    const out = [at(0.34, -0.05, 0), at(0.05 * s, 0.25, 0.55), at(-0.34, -0.05, 0)];
    const inn = [at(0.2, 0, 0.04), at(0.04 * s, 0.2, 0.42), at(-0.2, 0, 0.04)];
    r.ctx.fillStyle = r.paper; r.ctx.fill(pathOf(out, false)); colorFill(r, pathOf(out, false), c.skin);
    colorFill(r, pathOf(inn, false), '#f2a7b8');
    stroke(r, out, { sharp: true, w: 1.1 }); stroke(r, inn, { sharp: true, w: 0.6, single: true });
  }
}

// ---------------------------------------------------------------- hair
const HAIR = {
  buzz: { f: 0.55, b: -0.25, sd: 0.25, tex: 'stipple', h: 0.01 },
  crop: { f: 0.48, b: -0.3, sd: 0.3, tex: 'solid', h: 0.03 },
  flattop: { f: 0.62, b: 0, sd: 0.2, tex: 'solid', h: 0.05 },
  slick: { f: 0.42, b: -0.35, sd: 0.25, tex: 'strands', h: 0.04 },
  hatched: { f: 0.45, b: -0.3, sd: 0.3, tex: 'hatch', h: 0.04 },
  curly: { f: 0.45, b: -0.3, sd: 0.25, tex: 'curls', h: 0.09 },
  afro: { f: 0.38, b: -0.45, sd: 0.15, tex: 'curls', h: 0.4, puff: true },
  bowl: { f: 0.14, b: -0.1, sd: 0, tex: 'cross', h: 0.07 },
  liberty: { f: 0.62, b: 0, sd: 0.2, tex: 'stipple', h: 0.01, spikes: 'liberty' },
  spiky: { f: 0.5, b: -0.2, sd: 0.25, tex: 'hatch', h: 0.04, spikes: 'short' },
  long: { f: 0.35, b: -0.4, sd: 0, tex: 'strands', h: 0.06 },
  bun: { f: 0.45, b: -0.3, sd: 0.25, tex: 'strands', h: 0.04, bun: true },
};
const HATS_COVER = new Set(['beanie', 'pompom', 'cap', 'flatcap', 'bandana', 'turban', 'peci1', 'peci2', 'peci3', 'blangkon']);
const HIDE_HAIR = new Set(['cowl', 'lensmask', 'luchador', 'bogo']);
const hidesHair = c => HIDE_HAIR.has(c.hat) || c.veil === 'hijab';
function spikeDirs(kind, seed) {
  const R = mulberry(seed + 11), o = [];
  if (kind === 'liberty') { for (let i = 0; i < 9; i++) { const lon = -1.1 + i * 0.55 + (R() - 0.5) * 0.15, lat = 1.15 - Math.abs(i - 4) * 0.08 + (i % 2) * 0.12; o.push([Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat), 0.6 + R() * 0.25, 0.09]); } }
  else for (let i = 0; i < 34; i++) { const y = 0.3 + 0.7 * (i + 0.5) / 34, rr = Math.sqrt(1 - y * y), a = i * 2.39996; o.push([Math.sin(a) * rr, y, Math.cos(a) * rr, 0.16 + R() * 0.1, 0.045]); }
  return o;
}
function hair(r, phase) {
  const c = r.c, ctx = r.ctx, col = c.hairColor, covered = HATS_COVER.has(c.hat);
  if (c.hair === 'mohawk') return mohawk(r, phase, covered);
  if (c.hair === 'tabby' || c.hair === 'patches' || c.hair === 'tux') { if (phase === 'front') furMarks(r); return; }
  const st = HAIR[c.hair]; if (!st) return;
  if (st.spikes && !covered) for (const d of spikeDirs(st.spikes, c.seed)) {
    const z = r.dir(d[0], d[1], d[2]).z; if ((z > 0) === (phase === 'front')) spike(r, d, d[3], d[4], col || INK);
  }
  if (st.bun && phase === 'back') bun(r, col, false);
  if (phase !== 'front') return;
  const hl = lon => st.f + (st.b - st.f) * (1 - Math.cos(lon)) / 2 - st.sd * Math.sin(lon) ** 2 - c.featY * 0.5;
  const hf = st.puff ? (lon, lat) => 0.02 + st.h * sstep(hl(lon) - 0.1, hl(lon) + 0.55, lat) : st.h;
  const g = band(r, -PI, PI, hl, () => PI / 2, hf, 72, 10); if (!g) return;
  if (st.h >= 0.04) { ctx.fillStyle = r.paper; ctx.fill(g.path); }
  if (st.tex === 'solid') { ctx.fillStyle = col || INK; ctx.fill(g.path); }
  else {
    colorFill(r, g.path, col);
    inClip(r, g.path, () => {
      if (st.tex === 'stipple') stipple(r, 2600);
      if (st.tex === 'hatch') hatch(r, 0.9, 6);
      if (st.tex === 'cross') { hatch(r, 0.25, 7); hatch(r, -0.6, 9, 0.5); }
      if (st.tex === 'strands') for (let lon = -PI; lon < PI; lon += 0.11) { const a = hl(lon) + r.rand() * 0.08, pts = []; for (let k = 0; k <= 10; k++) pts.push(r.surf(lon + Math.sin(k * 0.3) * 0.06, a + (PI / 2 - 0.05 - a) * k / 10, (typeof hf === 'function' ? 0.04 : st.h))); fline(r, pts, { w: 0.55, single: true }); }
      if (st.tex === 'curls') { const n = st.puff ? 420 : 240; for (let i = 0; i < n; i++) { const lon = (r.rand() * 2 - 1) * PI, a = hl(lon), lat = a + (PI / 2 - a) * Math.sqrt(r.rand()), h = typeof hf === 'function' ? hf(lon, lat) : st.h; if (r.surf(lon, lat, h).z < 0.05) continue; const k = 0.055 / Math.max(0.35, Math.cos(lat)), pts = []; for (let t = 0; t < 7; t++) pts.push(r.surf(lon + Math.cos(t) * k, lat + Math.sin(t) * 0.055, h)); stroke(r, pts, { w: 0.6, single: true, close: true }); } }
    });
  }
  fline(r, edge(g, 0), { w: 1 }, -0.02);
  if (st.h >= 0.04) hullStroke(r, g.G.flat(), { w: 1.2 });
  if (st.bun) bun(r, col, true);
}
function bun(r, col, front) {
  const B = r.dir(0, 0.75, -0.66, 0.18);
  if ((B.z > 0) !== front && !(front && B.z > -0.4)) return;
  const rad = r.S * 0.24, pts = [];
  for (let i = 0; i < 16; i++) { const t = i / 16 * TAU; pts.push({ x: B.x + Math.cos(t) * rad, y: B.y + Math.sin(t) * rad * 0.85 - rad * 0.4 }); }
  const p = pathOf(pts); r.ctx.fillStyle = r.paper; r.ctx.fill(p); colorFill(r, p, col);
  inClip(r, p, () => hatch(r, 0.4, 5)); stroke(r, pts, { close: true, w: 1.1 });
}
function mohawk(r, phase, covered) {
  const c = r.c, col = c.hairColor || INK, ctx = r.ctx;
  if (!covered) for (let a = 0.7; a < PI + 0.3; a += 0.24) {
    const d = norm([0, Math.sin(a), Math.cos(a)]);
    if ((r.dir(...d).z > 0) === (phase === 'front')) spike(r, d, 0.42 + 0.12 * Math.sin(a * 3 + c.seed), 0.085, col);
  }
  if (phase !== 'front') return;
  const side = band(r, -PI, PI, lon => 0.45 + (-0.3 - 0.45) * (1 - Math.cos(lon)) / 2 - 0.25 * Math.sin(lon) ** 2, () => PI / 2, 0.005, 56, 8);
  if (side) inClip(r, side.path, () => stipple(r, 900));
  const g = grid(r, 36, 4, (u, v) => { const a = 0.55 + u * (PI + 0.3 - 0.55), d = norm([(v - 0.5) * 0.34, Math.sin(a), Math.cos(a)]); return r.dir(...d, 0.06); });
  if (!g) return;
  ctx.fillStyle = col; ctx.fill(g.path);
  fline(r, edge(g, 0), { w: 1 }); fline(r, edge(g, -1), { w: 1 });
}
function furMarks(r) {
  const c = r.c, ink = c.hairColor || INK;
  if (c.hair === 'tabby') {
    for (const x of [-0.13, 0, 0.13]) line(r, [[x, -0.55 + Math.abs(x) * 0.4, 0], [x * 1.1, -0.3, 0]], { w: 2.2, color: ink });
    for (const s of [-1, 1]) for (const lon of [0.85, 1.15, 1.45]) { const pts = []; for (let k = 0; k <= 6; k++) pts.push(r.surf(s * (lon + k * 0.03), 0.35 - k * 0.09)); fline(r, pts, { w: 2.4, color: ink }); }
    for (const lon of [PI - 0.35, PI, PI + 0.35]) { const pts = []; for (let k = 0; k <= 8; k++) pts.push(r.surf(lon, 0.9 - k * 0.16)); fline(r, pts, { w: 2.6, color: ink }); }
  } else if (c.hair === 'patches') {
    for (const [l0, l1, base] of [[0.15, 1.4, -0.1], [-PI, -1.7, 0.2]]) {
      const g = band(r, l0, l1, lon => base + 0.18 * Math.sin(lon * 5 + c.seed), () => 1.2, 0.005, 24, 8);
      if (g) { r.ctx.fillStyle = c.hairColor || '#c8743c'; r.ctx.globalCompositeOperation = 'multiply'; r.ctx.fill(g.path); r.ctx.globalCompositeOperation = 'source-over'; fline(r, edge(g, 0), { w: 0.8 }); }
    }
  } else {
    const g = band(r, -0.8, 0.8, () => -1.3, lon => -0.12 - 0.25 * Math.cos(lon * 2), 0.003, 28, 8);
    if (g) { r.ctx.fillStyle = r.paper; r.ctx.fill(g.path); fline(r, edge(g, -1), { w: 0.9 }); }
    const top = band(r, -PI, PI, lon => 0.2 + 0.1 * Math.cos(lon), () => PI / 2, 0.003, 48, 8);
    if (top) { r.ctx.fillStyle = c.hairColor || INK; r.ctx.fill(top.path); }
  }
}
function curtain(r) {
  const c = r.c, S = r.S, sY = Math.sin(r.yaw), x = r.cx - sY * 0.25 * S, top = r.cy - 0.6 * S, bot = r.cy + 1.75 * S, w = 1.12 * S;
  const pts = [{ x: x - w * 0.9, y: top }, { x: x - w, y: r.cy + 0.4 * S }];
  for (let i = 0; i <= 8; i++) pts.push({ x: x - w + 2 * w * i / 8, y: bot + (i % 2 ? -0.12 : 0.05) * S });
  pts.push({ x: x + w, y: r.cy + 0.4 * S }, { x: x + w * 0.9, y: top }, { x, y: top - 0.55 * S });
  const p = pathOf(pts); r.ctx.fillStyle = r.paper; r.ctx.fill(p); colorFill(r, p, c.hairColor);
  inClip(r, p, () => { r.ctx.strokeStyle = INK; for (let i = -8; i <= 8; i++) { const xx = x + i * w / 8; stroke(r, [{ x: xx, y: top }, { x: xx + (r.rand() - 0.5) * 10, y: r.cy + 0.6 * S }, { x: xx + (r.rand() - 0.5) * 14, y: bot }], { w: 0.5, single: true }); } });
  stroke(r, pts, { close: true, w: 1.2 });
}

// ---------------------------------------------------------------- face
function facialHair(r) {
  const c = r.c, ctx = r.ctx, fy = c.featY, col = c.hairColor;
  if (c.beard === 'none') return;
  const go = (g, tex) => { if (!g) return; if (tex === 'solid') { ctx.fillStyle = col || INK; ctx.fill(g.path); return; } if (tex !== 'stipple') colorFill(r, g.path, col); inClip(r, g.path, () => tex === 'stipple' ? stipple(r, 2200) : (hatch(r, 1.2, 4.5), hatch(r, -0.4, 7, 0.5))); };
  const L = PI / 2 + 0.05;
  if (c.beard === 'stubble') go(band(r, -L, L, () => -1.35, lon => -0.3 - fy + 0.45 * sstep(0.8, 1.5, Math.abs(lon)), 0.004, 48, 8), 'stipple');
  if (c.beard === 'full') { const g = band(r, -L, L, () => -1.45, lon => -0.32 - fy + 0.5 * sstep(0.7, 1.5, Math.abs(lon)), lon => 0.03 + 0.12 * sstep(0.8, 0, Math.abs(lon)), 48, 8); go(g, 'hatch'); if (g) { fline(r, edge(g, -1), { w: 0.9 }); hullStroke(r, g.G.flat(), { w: 1.1 }); } }
  if (c.beard === 'goatee') { const g = band(r, -0.22, 0.22, () => -1.05 - fy, () => -0.63 - fy, 0.03, 10, 4); go(g, 'solid'); }
  if (c.beard === 'soul') go(band(r, -0.06, 0.06, () => -0.8 - fy, () => -0.67 - fy, 0.01, 4, 2), 'solid');
  if (c.beard === 'chinstrap') { const jaw = lon => -0.88 - fy + 0.85 * sstep(0.3, 1.5, Math.abs(lon)); go(band(r, -L, L, lon => jaw(lon) - 0.09, lon => jaw(lon) + 0.07, 0.02, 48, 3), 'solid'); }
  if (c.beard === 'chops') for (const s of [-1, 1]) { const g = band(r, s > 0 ? 0.95 : -1.55, s > 0 ? 1.55 : -0.95, () => -0.65 - fy, () => 0.12 - fy, 0.02, 10, 6); go(g, 'hatch'); if (g) fline(r, edge(g, 0), { w: 0.8 }); }
}
function eyes(r) {
  const c = r.c, g = c.eyeGap, lx = 0.02 * Math.sin(c.seed), ly = 0.015 * Math.cos(c.seed * 1.7);
  for (const s of [-1, 1]) {
    const ex = s * g, t = c.eyes;
    const ring = (rx, ry, dx = 0, dy = 0) => circ(ex + dx, dy, rx, ry);
    const pupil = (rr = 0.033, dy = 0) => blob(r, ring(rr, rr, lx, ly + dy));
    const lens = (k) => curve(ex - k, ex + k, x => -0.06 * k / 0.1 * (1 - ((x - ex) / k) ** 2)).concat(curve(ex + k, ex - k, x => 0.045 * k / 0.1 * (1 - ((x - ex) / k) ** 2)).slice(1, -1));
    if (t === 'dot') blob(r, ring(0.035, 0.042));
    else if (t === 'ring') { line(r, ring(0.085, 0.08), { close: true }); pupil(); }
    else if (t === 'almond') { line(r, lens(0.1), { close: true }); pupil(0.03); }
    else if (t === 'sleepy') { line(r, [[ex - 0.095, -0.005], [ex + 0.095, -0.005]], { w: 1.2 }); line(r, curve(ex - 0.09, ex + 0.09, x => 0.07 * Math.sqrt(Math.max(0, 1 - ((x - ex) / 0.09) ** 2)))); blob(r, ring(0.028, 0.022, lx * 0.5, 0.03)); }
    else if (t === 'wide') { line(r, ring(0.12, 0.12), { close: true }); pupil(0.022); }
    else if (t === 'uneven') { const k = s < 0 ? 0.058 : 0.115; line(r, ring(k, k * 0.95), { close: true }); pupil(s < 0 ? 0.026 : 0.034); }
    else if (t === 'closed') line(r, curve(ex - 0.09, ex + 0.09, x => 0.035 * (1 - ((x - ex) / 0.09) ** 2)), { w: 1.2 });
    else if (t === 'wink') { if (s < 0) line(r, [[ex - 0.08, 0.03], [ex, -0.035], [ex + 0.08, 0.03]], { sharp: true, w: 1.2 }); else { line(r, ring(0.085, 0.08), { close: true }); pupil(); } }
    else if (t === 'x') { line(r, [[ex - 0.07, -0.07], [ex + 0.07, 0.07]], { w: 1.3 }); line(r, [[ex + 0.07, -0.07], [ex - 0.07, 0.07]], { w: 1.3 }); }
    else if (t === 'spiral') { const pts = []; for (let i = 0; i < 30; i++) { const a = i * 0.55 * s, rr = 0.004 * i; pts.push([ex + Math.cos(a) * rr, Math.sin(a) * rr]); } line(r, pts); }
    else if (t === 'slit') { line(r, lens(0.115).map(p => [p[0], p[1] * 1.5]), { close: true }); colorFill(r, pathOf(P(r, lens(0.11).map(p => [p[0], p[1] * 1.45]))), '#f0cf45'); blob(r, ring(0.018, 0.068, lx * 0.5, 0)); }
    else if (t === 'angry') { line(r, ring(0.08, 0.075), { close: true }); blob(r, ring(0.03, 0.03, lx * 0.5, 0.025)); line(r, [[ex - s * 0.11, -0.12], [ex + s * 0.1, -0.025]], { w: 1.5 }); }
    // brows
    const b = c.brows, by = -0.19;
    if (b === 'line') line(r, [[ex - 0.09, by], [ex, by - 0.015], [ex + 0.09, by]]);
    else if (b === 'thick') blob(r, [[ex - 0.1, by + 0.01], [ex + 0.1, by + 0.01], [ex + 0.09, by - 0.04], [ex - 0.09, by - 0.045]]);
    else if (b === 'angry') line(r, [[ex - s * 0.1, by + 0.05], [ex + s * 0.1, by - 0.04]], { w: 1.6 });
    else if (b === 'worried') line(r, [[ex - s * 0.1, by - 0.05], [ex + s * 0.1, by + 0.02]], { w: 1.2 });
    else if (b === 'raised') line(r, curve(ex - 0.1, ex + 0.1, x => by - 0.07 - 0.04 * (1 - ((x - ex) / 0.1) ** 2)), { w: 1.1 });
  }
  if (c.brows === 'unibrow') line(r, curve(-g - 0.11, g + 0.11, x => -0.19 + 0.02 * Math.cos(x * 9), 0.01, 16), { w: 1.8 });
}
function nose(r) {
  const t = r.c.nose, thr = -0.3;
  const N = {
    line: [[0.03, -0.02, 0], [0.02, 0.12, 0.1], [0, 0.28, 0.22], [-0.09, 0.31, 0.06]],
    hook: [[0.02, -0.03, 0], [0.03, 0.12, 0.14], [0.02, 0.26, 0.28], [-0.03, 0.32, 0.2], [-0.1, 0.31, 0.04]],
    triangle: [[0, 0, 0.02], [0.08, 0.3, 0.1], [-0.08, 0.3, 0.06], [0, 0, 0.02]],
    beak: [[-0.02, -0.05, 0], [0, 0.15, 0.2], [0, 0.29, 0.34], [-0.06, 0.36, 0.12], [-0.12, 0.33, 0]],
    long: [[0, 0, 0], [0, 0.2, 0.3], [0.01, 0.27, 0.52], [-0.03, 0.31, 0.46], [-0.08, 0.32, 0.05]],
  };
  if (N[t]) line(r, N[t], { sharp: t === 'triangle' || t === 'beak', w: 1.05 }, thr);
  if (t === 'button') { line(r, circ(0, 0.26, 0.075, 0.065, 0.09), { close: true }, thr); }
  if (t === 'snub') { line(r, curve(-0.08, 0.08, x => 0.27 + 0.03 * (1 - (x / 0.08) ** 2), 0.07)); blob(r, circ(-0.035, 0.27, 0.014, 0.012, 0.07)); blob(r, circ(0.035, 0.27, 0.014, 0.012, 0.07)); }
  if (t === 'cat') { blob(r, [[-0.075, 0.22, 0.09], [0.075, 0.22, 0.09], [0, 0.3, 0.08]], '#e98bb0'); line(r, [[-0.075, 0.22, 0.09], [0.075, 0.22, 0.09], [0, 0.3, 0.08], [-0.075, 0.22, 0.09]], { sharp: true }); line(r, [[0, 0.3, 0.08], [0, 0.4, 0.04]]); }
}
function mouth(r) {
  const t = r.c.mouth, m = 0.52, q = (k, a) => x => m + a * (1 - (x / k) ** 2);
  if (t === 'line') line(r, curve(-0.15, 0.15, x => m + 0.012 * Math.sin(x * 20)), { w: 1.1 });
  if (t === 'smile') line(r, curve(-0.18, 0.18, q(0.18, 0.06)), { w: 1.1 });
  if (t === 'frown') line(r, curve(-0.15, 0.15, x => m + 0.04 - 0.05 * (1 - (x / 0.15) ** 2)), { w: 1.1 });
  if (t === 'smirk') line(r, curve(-0.12, 0.17, x => m + 0.015 - (x > 0 ? 0.06 * (x / 0.17) ** 2 : 0)), { w: 1.1 });
  if (t === 'open' || t === 'tongue') {
    const pts = curve(-0.16, 0.16, () => m - 0.01).concat(curve(0.16, -0.16, q(0.16, 0.13)).slice(1, -1));
    if (blob(r, pts)) {
      blob(r, [[-0.12, m - 0.005], [0.12, m - 0.005], [0.1, m + 0.03], [-0.1, m + 0.03]], '#fff');
      if (t === 'tongue') blob(r, circ(0.03, m + 0.12, 0.08, 0.07, 0.02), '#e98bb0');
      line(r, pts, { close: true });
    }
  }
  if (t === 'o') { blob(r, circ(0, m + 0.02, 0.05, 0.065)); }
  if (t === 'grin' || t === 'teeth') {
    const w = t === 'grin' ? 0.2 : 0.13, h = t === 'grin' ? 0.1 : 0.07;
    const box = [[-w, m - h / 2], [w, m - h / 2], [w * 0.9, m + h / 2], [-w * 0.9, m + h / 2]];
    if (t === 'teeth') { line(r, curve(-0.16, 0.16, q(0.16, 0.03)), { w: 1.1 }); blob(r, [[-0.06, m + 0.02], [0.06, m + 0.02], [0.06, m + 0.1], [-0.06, m + 0.1]], '#fff'); line(r, [[-0.06, m + 0.02], [-0.06, m + 0.1], [0.06, m + 0.1], [0.06, m + 0.02]], { sharp: true }); line(r, [[0, m + 0.02], [0, m + 0.1]], { w: 0.7 }); }
    else { blob(r, box, '#fff'); line(r, box, { close: true, sharp: true }); line(r, [[-w, m], [w, m]], { w: 0.6 }); for (let x = -w + 0.06; x < w; x += 0.06) line(r, [[x, m - h / 2], [x, m + h / 2]], { w: 0.6, single: true }); }
  }
  if (t === 'rose') { // rose clenched in the teeth, sticking out to the side and toward the viewer
    line(r, curve(-0.13, 0.13, x => m + 0.01 * Math.sin(x * 25)), { w: 1.1 });
    blob(r, [[-0.08, m - 0.012, 0.03], [0.08, m - 0.012, 0.03], [0.07, m + 0.03, 0.03], [-0.07, m + 0.03, 0.03]], '#fff');
    line(r, [[-0.08, m + 0.03, 0.03], [0.07, m + 0.03, 0.03]], { w: 0.6, single: true });
    const stem = [[-0.36, m + 0.04, 0.05], [-0.12, m + 0.015, 0.08], [0.12, m - 0.01, 0.11], [0.34, m - 0.05, 0.17], [0.48, m - 0.1, 0.24]];
    line(r, stem, { w: 4.2, color: '#4f6b34', single: true }, -0.4); line(r, stem, { w: 0.8 }, -0.4);
    for (const [x, y, h, sg] of [[-0.25, m + 0.03, 0.06, 1], [0.24, m - 0.03, 0.15, -1]]) { // leaves with a vein
      const leaf = [[x, y, h], [x + 0.07, y + sg * 0.1, h], [x + 0.17, y + sg * 0.06, h], [x + 0.09, y, h]];
      if (blob(r, leaf, '#6f8a4a', -0.4)) { line(r, leaf, { close: true, w: 0.8 }, -0.4); line(r, [[x + 0.02, y + sg * 0.02, h], [x + 0.13, y + sg * 0.06, h]], { w: 0.5, single: true }, -0.4); }
    }
    for (const x of [-0.3, -0.02, 0.2]) line(r, [[x, m + 0.03 - x * 0.08, 0.07 + x * 0.12], [x + 0.035, m + 0.08 - x * 0.08, 0.07 + x * 0.12]], { w: 0.8, single: true }, -0.4); // thorns
    const bx = 0.6, by = m - 0.18, bh = 0.3, petals = [];
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, k = 0.17 * (1 + 0.13 * Math.cos(a * 5)); petals.push([bx + Math.cos(a) * k, by + Math.sin(a) * k * 0.92, bh]); }
    blob(r, [[bx - 0.08, by + 0.12, bh - 0.03], [bx - 0.2, by + 0.2, bh - 0.05], [bx - 0.02, by + 0.17, bh - 0.02], [bx + 0.08, by + 0.13, bh - 0.03]], '#6f8a4a', -0.4); // sepals
    if (blob(r, petals, '#d9443a', -0.4)) {
      line(r, petals, { close: true, w: 1.2 }, -0.4);
      const sp = []; for (let i = 0; i < 34; i++) { const a = i * 0.5, k = 0.13 * (1 - i / 38); sp.push([bx + Math.cos(a) * k, by + Math.sin(a) * k * 0.9, bh + 0.02]); }
      line(r, sp, { w: 0.9 }, -0.4);
    }
  }
  if (t === 'cat' || t === 'fangs') {
    line(r, [[-0.13, m - 0.06], [-0.065, m + 0.01], [0, m - 0.05], [0.065, m + 0.01], [0.13, m - 0.06]], { w: 1.05 });
    if (t === 'fangs') for (const s of [-1, 1]) { const f = [[s * 0.05, m - 0.002], [s * 0.085, m - 0.012], [s * 0.07, m + 0.07]]; blob(r, f, '#fff'); line(r, f, { sharp: true, close: true, w: 0.8 }); }
  }
  const st = r.c.stache, sy = 0.4;
  if (st === 'chevron') blob(r, [[-0.17, sy - 0.03, 0.04], [0.17, sy - 0.03, 0.04], [0.2, sy + 0.07, 0.03], [0, sy + 0.03, 0.04], [-0.2, sy + 0.07, 0.03]], r.c.hairColor || INK);
  if (st === 'pencil') line(r, curve(-0.15, 0.15, () => sy + 0.04, 0.03), { w: 1.6, color: r.c.hairColor || INK });
  if (st === 'handlebar') { line(r, [[-0.3, sy - 0.04, 0.02], [-0.26, sy + 0.04, 0.03], [-0.13, sy + 0.04, 0.05], [0, sy - 0.01, 0.06], [0.13, sy + 0.04, 0.05], [0.26, sy + 0.04, 0.03], [0.3, sy - 0.04, 0.02]], { w: 2.6, color: r.c.hairColor || INK }); }
  if (st === 'walrus') { const pts = [[-0.22, sy - 0.05, 0.04], [0.22, sy - 0.05, 0.04], [0.26, sy + 0.16, 0.03], [0.1, sy + 0.1, 0.05], [0, sy + 0.14, 0.06], [-0.1, sy + 0.1, 0.05], [-0.26, sy + 0.16, 0.03]]; if (blob(r, pts, r.paper)) { colorFill(r, pathOf(P(r, pts)), r.c.hairColor); inClip(r, pathOf(P(r, pts)), () => hatch(r, PI / 2, 4)); line(r, pts, { close: true }); } }
  if (st === 'curly') for (const s of [-1, 1]) { const pts = []; for (let i = 0; i < 22; i++) { const a = i * 0.45, rr = 0.075 - i * 0.003; pts.push([s * (0.12 + Math.cos(a) * rr * 0.8 + i * 0.006), sy + 0.03 - Math.sin(a) * rr * 0.6, 0.04]); } line(r, pts, { w: 1.3 }); }
}
function eyewear(r) {
  const c = r.c, t = c.eyewear, g = c.eyeGap, h = 0.06;
  if (t === 'none') return;
  const temple = s => { const pts = []; for (let k = 0; k <= 10; k++) { const lon = s * (g + 0.14 + (1.45 - g - 0.14) * k / 10); pts.push(r.surf(lon * c.featScale, -c.featY, 0.05 * (1 - k / 12))); } fline(r, pts, { w: 0.9 }); };
  if (t === 'round' || t === 'square' || t === 'shades') {
    for (const s of [-1, 1]) {
      const pts = t === 'round' ? circ(s * g, 0, 0.14, 0.13, h, 20) : [[s * g - 0.15, -0.09, h], [s * g + 0.15, -0.09, h], [s * g + 0.14, 0.1, h], [s * g - 0.14, 0.1, h]];
      if (t === 'shades') { blob(r, pts.length === 4 ? pts : circ(s * g, 0, 0.14, 0.13, h), INK, -0.1); line(r, [[s * g - 0.08, -0.04, h], [s * g - 0.02, -0.06, h]], { w: 0.8, color: '#fff', single: true }); }
      line(r, pts, { close: true, sharp: t !== 'round', w: t === 'square' ? 1.5 : 1.1 }, -0.1);
      temple(s);
    }
    line(r, curve(-g + 0.14, g - 0.14, x => -0.02 - 0.03 * (1 - (x / (g - 0.14 || 1)) ** 2), h + 0.01, 6), { w: 1.1 }, -0.1);
  }
  if (t === 'cateye') { // oval lenses whose outer top corner tapers up into a soft point
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i < 28; i++) {
        const a = i / 28 * TAU, ox = Math.cos(a), oy = Math.sin(a);
        const tip = Math.max(0, s * ox * 0.75 - oy * 0.66) ** 3; // strongest toward the outer-upper corner
        pts.push([s * g + ox * (0.15 + tip * 0.07), oy * (0.1 + tip * 0.02) - tip * 0.045, h]);
      }
      line(r, pts, { close: true, w: 1.8 }, -0.1);
      line(r, [[s * g - 0.07, -0.05, h], [s * g - 0.01, -0.07, h]], { w: 0.6, single: true }, -0.1);
      temple(s);
    }
    line(r, curve(-g + 0.15, g - 0.15, x => -0.03 - 0.025 * (1 - (x / (g - 0.15 || 1)) ** 2), h + 0.01, 6), { w: 1.4 }, -0.1);
  }
  if (t === 'monocle') { line(r, circ(g, 0, 0.13, 0.13, h, 20), { close: true, w: 1.8 }, -0.1); line(r, [[g + 0.02, 0.13, h], [g + 0.12, 0.45, 0.04], [g + 0.25, 0.85, 0.02]], { w: 0.6 }, -0.1); }
  if (t === 'patch') {
    blob(r, circ(-g, 0, 0.15, 0.12, 0.03), INK, -0.1);
    const u = norm([Math.sin(-g), 0.05, Math.cos(-g)]), v = norm(cross(u, norm([0.6, 0.8, 0]))), pts = [];
    for (let i = 0; i <= 64; i++) { const t2 = i / 64 * TAU, d = norm([u[0] * Math.cos(t2) + v[0] * Math.sin(t2), u[1] * Math.cos(t2) + v[1] * Math.sin(t2), u[2] * Math.cos(t2) + v[2] * Math.sin(t2)]); pts.push(r.dir(...d, 0.03)); }
    fline(r, pts, { w: 1.1 });
  }
  if (t === 'domino') {
    const out = P(r, [[-g - 0.23, -0.03, 0.04], [-g - 0.07, -0.15, 0.04], [0, -0.09, 0.05], [g + 0.07, -0.15, 0.04], [g + 0.23, -0.03, 0.04], [g + 0.1, 0.13, 0.04], [0, 0.08, 0.06], [-g - 0.1, 0.13, 0.04]]);
    if (out.filter(p => p.z > -0.1).length >= 6) {
      const p = pathOf(out); for (const s of [-1, 1]) p.addPath(pathOf(P(r, circ(s * g, 0, 0.085, 0.06, 0.045))));
      r.ctx.fillStyle = c.hatColor && c.hatColor !== '#d9443a' ? c.hatColor : INK; r.ctx.fill(p, 'evenodd'); stroke(r, out.filter(q => q.z > -0.1), { close: true, w: 1 });
    }
  }
  if (t === 'visor') {
    const gr = band(r, -1.25, 1.25, () => -0.1 - c.featY, () => 0.13 - c.featY, 0.08, 36, 3);
    if (gr) { r.ctx.fillStyle = INK; r.ctx.fill(gr.path); fline(r, edge(gr, 0)); fline(r, edge(gr, -1)); line(r, [[-0.3, -0.06, 0.09], [0.1, -0.06, 0.09]], { w: 0.9, color: '#fff', single: true }); }
  }
}
function hat(r, phase) {
  const c = r.c, t = c.hat, col = c.hatColor, ctx = r.ctx;
  if (t === 'none') return;
  const backVis = r.surf(PI, 0.3).z > 0;
  if (t === 'bandana' && (phase === 'back') !== backVis) {
    const k = r.surf(PI, 0.3, 0.05);
    for (const s of [-1, 1]) { const pts = [{ x: k.x - 6, y: k.y }, { x: k.x + s * r.S * 0.35, y: k.y + r.S * 0.55 }, { x: k.x + s * r.S * 0.12, y: k.y + r.S * 0.5 }, { x: k.x + 6, y: k.y }]; const p = pathOf(pts, false); ctx.fillStyle = r.paper; ctx.fill(p); colorFill(r, p, col); stroke(r, pts, { sharp: true, close: true }); }
  }
  const front = r.surf(0, 0.3).z > 0;
  const brim = (len, lat) => {
    const pts = []; for (let k = 0; k <= 16; k++) pts.push(r.surf(-1 + 2 * k / 16, lat, 0.08));
    for (let k = 16; k >= 0; k--) { const lon = -1 + 2 * k / 16; pts.push(r.surf(lon * 0.85, lat - 0.28, 0.08 + len * Math.cos(lon * 1.4))); }
    const p = pathOf(pts); ctx.fillStyle = r.paper; ctx.fill(p); colorFill(r, p, col); ctx.globalAlpha = 0.25; ctx.fillStyle = INK; ctx.fill(p); ctx.globalAlpha = 1;
    stroke(r, pts, { close: true, w: 1.15 });
  };
  const brimLen = { cap: 0.5, flatcap: 0.28, bogo: 0.2 }[t];
  if (brimLen && phase === 'back' && !front) brim(brimLen, 0.32); // facing away → brim goes behind the head
  if (t === 'blangkon') { const K = r.dir(0, 0.05, -1, 0.1); if ((K.z > 0) === (phase === 'front')) knob(r, K, col); }
  if (phase === 'back') return;
  const crown =(lo, h, tex) => {
    const g = band(r, -PI, PI, typeof lo === 'function' ? lo : () => lo, () => PI / 2, h, 72, 10); if (!g) return null;
    ctx.fillStyle = r.paper; ctx.fill(g.path); colorFill(r, g.path, col);
    if (tex) inClip(r, g.path, tex);
    fline(r, edge(g, 0), { w: 1.1 }, -0.04); hullStroke(r, g.G.flat(), { w: 1.25 });
    return g;
  };
  if (t === 'beanie' || t === 'pompom') {
    crown(0.3, 0.09, () => { for (let lon = -PI; lon < PI; lon += 0.2) { const pts = []; for (let k = 0; k <= 8; k++) pts.push(r.surf(lon, 0.45 + k * 0.12, 0.09)); fline(r, pts, { w: 0.5, single: true }); } });
    const cuff = band(r, -PI, PI, () => 0.2, () => 0.46, 0.12, 72, 3);
    if (cuff) { ctx.fillStyle = r.paper; ctx.fill(cuff.path); colorFill(r, cuff.path, col); inClip(r, cuff.path, () => hatch(r, PI / 2, 5, 0.6)); fline(r, edge(cuff, 0), { w: 1.1 }, -0.04); fline(r, edge(cuff, -1), { w: 1 }, -0.04); hullStroke(r, cuff.G.flat(), { w: 1.2 }); }
    if (t === 'pompom') {
      const B = r.dir(0, 1, 0, 0.4), rad = r.S * 0.2, pts = [];
      for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, k = rad * (i % 2 ? 0.85 : 1.05); pts.push({ x: B.x + Math.cos(a) * k, y: B.y + Math.sin(a) * k }); }
      const p = pathOf(pts); ctx.fillStyle = r.paper; ctx.fill(p); colorFill(r, p, col); inClip(r, p, () => stipple(r, 900)); stroke(r, pts, { close: true });
    }
  }
  if (t === 'cap') { crown(0.28, 0.07, () => { for (const lon of [-0.9, 0, 0.9, PI]) { const pts = []; for (let k = 0; k <= 8; k++) pts.push(r.surf(lon, 0.3 + k * 0.16, 0.07)); fline(r, pts, { w: 0.6, single: true }); } }); if (front) brim(0.5, 0.32); }
  if (t === 'flatcap') { crown(0.3, (lon, lat) => 0.08 + 0.12 * Math.max(0, Math.cos(lon)) * (1 - sstep(0.3, 1.4, lat)), () => { hatch(r, 0.7, 5); hatch(r, -0.5, 8, 0.4); }); if (front) brim(0.28, 0.32); }
  if (t === 'headband') { const g = band(r, -PI, PI, () => 0.32 - c.featY * 0.5, () => 0.46 - c.featY * 0.5, 0.025, 72, 2); if (g) { ctx.fillStyle = col || INK; ctx.fill(g.path); fline(r, edge(g, 0), { w: 0.9 }); fline(r, edge(g, -1), { w: 0.9 }); } }
  if (t === 'bandana') crown(0.28, 0.05, () => { const k = Math.max(4, r.S * 0.07); r.ctx.fillStyle = dots(r.ctx, Math.round(k), k * 0.16, '#fff'); r.ctx.fillRect(0, 0, r.o.W, r.o.H); });
  const g = c.eyeGap, solid = (gr, fill) => { if (!gr) return; ctx.fillStyle = fill; ctx.fill(gr.path); fline(r, edge(gr, 0), { w: 1.1 }, -0.04); hullStroke(r, gr.G.flat(), { w: 1.25 }); };
  const hole = (pts, trim) => { if (trim && !blob(r, trim, r.paper)) return; if (!blob(r, pts, r.paper)) return; colorFill(r, pathOf(P(r, pts)), c.skin); line(r, pts, { close: true, w: 0.9 }); };
  if (t === 'cowl') { // generic pointy-eared hero cowl
    const mc = col || INK;
    for (const s of [-1, 1]) spike(r, norm([s * 0.42, 0.88, 0.05]), 0.5, 0.1, mc);
    solid(band(r, -PI, PI, lon => -0.12 - c.featY - 1.1 * sstep(0.5, 1.3, Math.abs(lon)), () => PI / 2, 0.04, 72, 12), mc);
    for (const s of [-1, 1]) { const l = curve(s * g - 0.12, s * g + 0.12, x => -0.03 - 0.05 * (1 - ((x - s * g) / 0.12) ** 2) + s * (x - s * g) * 0.25, 0.05, 8).concat(curve(s * g + 0.12, s * g - 0.12, x => 0.05 * (1 - ((x - s * g) / 0.12) ** 2) + s * (x - s * g) * 0.15, 0.05, 8).slice(1, -1)); if (blob(r, l, '#fff')) line(r, l, { close: true, w: 1.3 }); }
  }
  if (t === 'lensmask') { // full-face hero mask with big lenses
    const mc = col || '#d9443a';
    solid(band(r, -PI, PI, () => -PI / 2 + 0.05, () => PI / 2, 0.05, 72, 14), mc);
    line(r, [[0, -1.3, 0.05], [0, -0.6, 0.05], [0, 0.2, 0.06], [0, 0.9, 0.05]], { w: 0.6, single: true }, 0);
    for (const s of [-1, 1]) { const l = [[s * 0.07, -0.03, 0.07], [s * (g + 0.2), -0.18, 0.06], [s * (g + 0.25), 0.04, 0.06], [s * (g + 0.06), 0.15, 0.07]]; if (blob(r, l, '#fff')) line(r, l, { close: true, w: 2.4 }); }
  }
  if (t === 'luchador') {
    const mc = col || '#4e6d9c';
    solid(band(r, -PI, PI, () => -PI / 2 + 0.05, () => PI / 2, 0.06, 72, 14), mc);
    blob(r, [[-0.1, -0.2, 0.07], [0, -0.55, 0.07], [0.1, -0.2, 0.07], [0, -0.1, 0.07]], '#fff');
    for (const s of [-1, 1]) hole(circ(s * g, 0, 0.11, 0.085, 0.07), circ(s * g + s * 0.03, -0.02, 0.19, 0.15, 0.07));
    hole(circ(0, 0.53, 0.19, 0.11, 0.07), circ(0, 0.53, 0.25, 0.16, 0.07));
    eyes(r); nose(r); mouth(r);
  }
  if (t === 'turban') {
    const hf = (lon, lat) => 0.12 + 0.14 * sstep(0.1, 0.9, lat);
    const gr = crown(lon => 0.12 - c.featY * 0.5, hf, null);
    if (gr) for (let k = 0; k < 6; k++) { const pts = []; for (let i = 0; i <= 48; i++) { const lon = -PI + TAU * i / 48, lat = clamp(0.28 + k * 0.17 + 0.2 * Math.sin(lon + k * 1.3), 0.15, 1.45); pts.push(r.surf(lon, lat, hf(lon, lat))); } fline(r, pts, { w: 0.7 }); }
    line(r, [[-0.45, -0.3, 0.14], [0, -0.75, 0.24], [0.45, -0.3, 0.14]], { w: 0.8 }, 0);
  }
  const pecH = { peci1: 0.0001, peci2: 0.28, peci3: 0.62 }[t];
  if (pecH) { // Indonesian peci: velvet cylinder sitting on the crown
    const L = 0.26, up = r.rot(0, -1, 0), H = (r.ky * (1 - Math.sin(L)) + pecH) * r.S;
    const gr = grid(r, 48, 2, (u, v) => { const lon = -PI + TAU * u, b = r.surf(lon, L, 0.04), n = r.rot(Math.sin(lon), 0, Math.cos(lon)); return { x: b.x + up[0] * H * v, y: b.y + up[1] * H * v, z: n[2] }; });
    if (gr) {
      const top = edge(gr, -1);
      if (up[2] > 0) { ctx.fillStyle = '#2e2e2e'; ctx.fill(pathOf(top)); stroke(r, top, { close: true, w: 1 }); }
      ctx.fillStyle = col && col !== '#d9443a' ? col : '#1d1d1d'; ctx.fill(gr.path);
      inClip(r, gr.path, () => hatch(r, PI / 2, 7, 0.4, '#3a3a3a'));
      fline(r, edge(gr, 0), { w: 1.2 }, -0.02); fline(r, top.map(p => ({ ...p, y: p.y + 2 })), { w: 0.8, color: '#777', single: true }, -0.02);
      const cols = gr.G.filter(col => Math.abs(col[0].z) < 0.2); // silhouette sides of the cylinder
      for (const sgn of [-1, 1]) { const col = cols.reduce((a, b) => (b[0].x - a[0].x) * sgn > 0 ? b : a, cols[0] || gr.G[0]); stroke(r, [col[0], col[2]], { w: 1.2 }); }
      stroke(r, top.filter(p => p.z > -0.05), { w: 1.2 });
    }
  }
  if (t === 'bogo') { // Indonesian helm bogo: retro open-face shell, rubber trim, snap peak, racing stripe, chin strap
    const lo = lon => 0.3 - c.featY * 0.5 - 0.72 * sstep(0.45, 1.35, Math.abs(lon)), H = 0.15;
    const shell = crown(lo, H, () => {
      for (const base of [0, PI]) for (const d of [-0.09, 0.09]) { const pts = []; for (let k = 0; k <= 12; k++) pts.push(r.surf(base + d, lo(base) + 0.08 + (PI / 2 - 0.1 - lo(base)) * k / 12, H)); fline(r, pts, { w: 3.2, color: '#f4f1ea', single: true }); }
    });
    if (shell) {
      const trim = band(r, -PI, PI, lo, lon => lo(lon) + 0.07, H + 0.01, 72, 2);
      if (trim) { ctx.fillStyle = INK; ctx.fill(trim.path); }
      const glint = []; for (let k = 0; k <= 8; k++) glint.push(r.surf(-0.75 + k * 0.06, 0.95 + k * 0.025, H + 0.01)); fline(r, glint, { w: 2.2, color: '#ffffff', single: true });
      ctx.fillStyle = r.paper; for (const lon of [-0.38, 0, 0.38]) { const p = r.surf(lon, lo(lon) + 0.13, H + 0.01); if (p.z > 0.05) { dot(r, p, r.S * 0.022); stroke(r, [p, { x: p.x + 0.5, y: p.y }], { w: 0.6, single: true }); } }
      if (front) brim(0.2, lo(0) + 0.02);
      for (const s of [-1, 1]) line(r, [[s * 1.22, 0.28, 0.03], [s * 1.0, 0.6, 0.025], [s * 0.6, 0.8, 0.02], [s * 0.2, 0.88, 0.02], [0, 0.9, 0.02]], { w: 1.8 }, -0.05);
    }
  }
  if (t === 'blangkon') crown(lon => 0.3 - 0.45 * (1 - Math.cos(lon)) / 2 - c.featY * 0.5, 0.05, () => { stipple(r, 1500); hatch(r, 0.8, 10, 0.4); });
}
// Hijab is its own layer (not a hat), so caps, peci, helmets etc. can sit on top of it.
function veil(r, phase) {
  const c = r.c, ctx = r.ctx, col = c.veilColor;
  if (c.veil !== 'hijab') return;
  if (phase === 'back') { // drape over neck/shoulders, behind the head
    const S = r.S, x = r.cx - Math.sin(r.yaw) * 0.15 * S, y = r.cy;
    const pts = [{ x: x - 0.98 * S, y: y - 0.2 * S }, { x: x - 1.1 * S, y: y + 0.9 * S }, { x: x - 1.45 * S, y: y + 1.85 * S }, { x: x - 0.5 * S, y: y + 2.05 * S }, { x: x + 0.5 * S, y: y + 2.05 * S }, { x: x + 1.45 * S, y: y + 1.85 * S }, { x: x + 1.1 * S, y: y + 0.9 * S }, { x: x + 0.98 * S, y: y - 0.2 * S }];
    const p = pathOf(pts); ctx.fillStyle = r.paper; ctx.fill(p); colorFill(r, p, col);
    for (const s of [-1, 1]) stroke(r, [{ x: x + s * 0.55 * S, y: y + 1.0 * S }, { x: x + s * 0.8 * S, y: y + 1.5 * S }, { x: x + s * 0.9 * S, y: y + 1.95 * S }], { w: 0.6, single: true });
    stroke(r, pts, { close: true, w: 1.2 });
  }
  else {
    const gr = band(r, -PI, PI, () => -PI / 2 + 0.05, () => PI / 2, 0.09, 72, 14);
    if (gr) { ctx.fillStyle = r.paper; ctx.fill(gr.path); colorFill(r, gr.path, col); hullStroke(r, gr.G.flat(), { w: 1.25 }); }
    const sq = lon => Math.sqrt(Math.max(0, 1 - (lon / 0.66) ** 2));
    const face = band(r, -0.66, 0.66, lon => -0.1 - c.featY - 0.66 * sq(lon), lon => -0.1 - c.featY + 0.56 * sq(lon), 0.01, 28, 10);
    if (face) {
      ctx.fillStyle = r.paper; ctx.fill(face.path); colorFill(r, face.path, c.skin);
      fline(r, edge(face, 0), { w: 1.1 }); fline(r, edge(face, -1), { w: 1.1 });
      eyes(r); nose(r); mouth(r); eyewear(r);
    }
  }
}
function knob(r, K, col) {
  const rad = r.S * 0.2, pts = [];
  for (let i = 0; i < 16; i++) { const t = i / 16 * TAU; pts.push({ x: K.x + Math.cos(t) * rad * 0.8, y: K.y + Math.sin(t) * rad }); }
  const p = pathOf(pts); r.ctx.fillStyle = r.paper; r.ctx.fill(p); colorFill(r, p, col); inClip(r, p, () => stipple(r, 600)); stroke(r, pts, { close: true, w: 1.1 });
}
function extras(r, nb) {
  const c = r.c, ex = new Set(c.extras), g = c.eyeGap, ctx = r.ctx, S = r.S;
  const lobe = s => { const sz = { big: 1.45, small: 0.7 }[c.ears] || 1; return r.surf(s * (PI / 2 - 0.08), -0.08 - c.featY * 0.6 - 0.21 * sz, 0.05 * sz); };
  if (ex.has('freckles')) { const R = mulberry(c.seed + 5); ctx.fillStyle = INK; for (const s of [-1, 1]) for (let i = 0; i < 8; i++) { const p = r.F(s * (g + (R() - 0.5) * 0.28), 0.17 + R() * 0.12, 0.01); if (p.z > 0.05) dot(r, p, Math.max(0.8, S * 0.008)); } }
  if (ex.has('eyeblack')) for (const s of [-1, 1]) blob(r, [[s * g - 0.11, 0.13], [s * g + 0.11, 0.13], [s * g + 0.09, 0.2], [s * g - 0.09, 0.2]]);
  if (ex.has('star')) { const pts = []; for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, k = i % 2 ? 0.025 : 0.06; pts.push([g + 0.05 + Math.cos(a) * k, 0.22 + Math.sin(a) * k]); } line(r, pts, { close: true, sharp: true, w: 0.9 }); }
  if (ex.has('scar')) { const a = [-g - 0.17, 0.08], b = [-g + 0.04, 0.4]; line(r, [a, b], { w: 1.2 }); for (let k = 1; k < 5; k++) { const t = k / 5, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; line(r, [[x - 0.04, y + 0.025], [x + 0.04, y - 0.025]], { w: 0.8, single: true }); } }
  if (ex.has('bandaid')) { const cx = g + 0.08, cy = 0.28, ca = Math.cos(0.5), sa = Math.sin(0.5), pt = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca, 0.01]; const box = [pt(-0.14, -0.045), pt(0.14, -0.045), pt(0.14, 0.045), pt(-0.14, 0.045)]; if (blob(r, box, '#f1dcc0')) { line(r, box, { close: true, w: 0.9 }); line(r, [pt(-0.05, -0.045), pt(-0.05, 0.045)], { w: 0.6, single: true }); line(r, [pt(0.05, -0.045), pt(0.05, 0.045)], { w: 0.6, single: true }); } }
  if (ex.has('nosering')) line(r, circ(0.04, 0.33, 0.035, 0.035, 0.09, 12), { close: true, w: 1 }, -0.2);
  if (ex.has('lipring')) line(r, circ(0.1, 0.57, 0.032, 0.032, 0.02, 12), { close: true, w: 1 });
  if (ex.has('browbar')) { ctx.fillStyle = INK; const a = r.F(g + 0.06, -0.27, 0.02), b = r.F(g + 0.12, -0.13, 0.02); if (a.z > 0 && b.z > 0) { stroke(r, [a, b], { w: 0.8, single: true }); dot(r, a, S * 0.016); dot(r, b, S * 0.016); } }
  for (const s of [-1, 1]) {
    const p = lobe(s); if (p.z < -0.1 || hidesHair(c)) continue;
    if (ex.has('hoops')) { const pts = []; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; pts.push({ x: p.x + Math.cos(a) * S * 0.07, y: p.y + S * 0.07 + Math.sin(a) * S * 0.075 }); } stroke(r, pts, { close: true, w: 1.1 }); }
    if (ex.has('safetypin') && s < 0) {
      const a = 0.25, ca = Math.cos(a), sa = Math.sin(a), T = (x, y) => ({ x: p.x + (x * ca - y * sa) * S, y: p.y + (x * sa + y * ca) * S });
      stroke(r, [T(0, 0), T(-0.03, 0.05), T(-0.03, 0.27), T(0, 0.3), T(0.03, 0.27), T(0.03, 0.04)], { w: 0.9 });
      ctx.fillStyle = INK; ctx.fill(pathOf([T(-0.04, 0.02), T(0.045, 0.02), T(0.045, 0.08), T(-0.04, 0.08)], false));
      const coil = T(0, 0.3); stroke(r, [{ x: coil.x - 3, y: coil.y }, { x: coil.x, y: coil.y + 4 }, { x: coil.x + 3, y: coil.y }], { w: 0.8, single: true });
    }
  }
  if (ex.has('teardrop')) { const x = g + 0.02, pts = [[x, 0.15, 0.01], [x + 0.03, 0.21, 0.01], [x, 0.24, 0.01], [x - 0.03, 0.21, 0.01]]; blob(r, pts); }
  if (ex.has('tribal')) { // thorny cheek tattoo
    const x0 = -g - 0.12, arc = t => [x0 + 0.08 * Math.sin(t * 2.4), 0.1 + t * 0.36, 0.01];
    const pts = []; for (let i = 0; i <= 10; i++) pts.push(arc(i / 10)); line(r, pts, { w: 1.6 });
    for (const t of [0.2, 0.45, 0.7, 0.92]) { const [x, y] = arc(t); blob(r, [[x - 0.02, y - 0.02, 0.01], [x - 0.11, y - 0.04, 0.01], [x - 0.02, y + 0.02, 0.01]]); }
  }
  if (ex.has('barbwire')) { // barbed wire across the forehead, wraps around the head
    const lat = 0.235 - c.featY * 0.5, pts = []; for (let i = 0; i <= 72; i++) pts.push(r.surf(-PI + TAU * i / 72, lat + 0.025 * Math.sin(i * 1.7), 0.015)); fline(r, pts, { w: 1 });
    for (let lon = -PI; lon < PI; lon += 0.28) { const a = r.surf(lon - 0.04, lat - 0.05, 0.015), b = r.surf(lon + 0.04, lat + 0.05, 0.015), cc = r.surf(lon - 0.04, lat + 0.05, 0.015), d = r.surf(lon + 0.04, lat - 0.05, 0.015); if (a.z > 0.05 && b.z > 0.05) { stroke(r, [a, b], { w: 0.8, single: true }); stroke(r, [cc, d], { w: 0.8, single: true }); } }
  }
  if (ex.has('spikeband')) { // studded spikes ring around the temples (sits over any headwear)
    const lat = 0.5 - c.featY * 0.5, h = HATS_COVER.has(c.hat) || hidesHair(c) ? 0.12 : 0.04;
    const pts = []; for (let i = 0; i <= 72; i++) pts.push(r.surf(-PI + TAU * i / 72, lat, h)); fline(r, pts, { w: 3.4 }); fline(r, pts, { w: 1.3, color: '#f4f1ea', single: true });
    for (let lon = -PI; lon < PI; lon += 0.4) { const cl = Math.cos(lat), d = norm([Math.sin(lon) * cl, Math.sin(lat) + 0.55, Math.cos(lon) * cl]); if (r.surf(lon, lat).z > 0.05) spike(r, d, 0.32 + h, 0.05, '#f4f1ea'); }
  }
  if (ex.has('whiskers')) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) line(r, [[s * 0.15, 0.37 + k * 0.05, 0.06], [s * 0.45, 0.33 + k * 0.08, 0.18], [s * 0.78, 0.27 + k * 0.12, 0.28]], { w: 0.7, single: true }, -0.35);
}

// ---------------------------------------------------------------- body
function torsoA(y) { const Y = [0, 0.1, 0.25, 0.45, 0.8, 5], A = [0.34, 0.6, 1.02, 1.28, 1.36, 1.44]; for (let i = 1; i < Y.length; i++) if (y <= Y[i]) return A[i - 1] + (A[i] - A[i - 1]) * (y - Y[i - 1]) / (Y[i] - Y[i - 1]); return 1.44; }
function neck(r, nb, ex) {
  const S = r.S, x = r.cx, top = r.cy + 0.5 * S, bot = nb + 0.06 * S, w = 0.27 * S;
  const pts = [{ x: x - w, y: top }, { x: x - w * 1.05, y: bot }, { x: x + w * 1.05, y: bot }, { x: x + w, y: top }];
  const p = pathOf(pts, false); r.ctx.fillStyle = r.paper; r.ctx.fill(p); colorFill(r, p, r.c.skin);
  stroke(r, [pts[0], pts[1]]); stroke(r, [pts[3], pts[2]]);
  if (ex.has('choker')) {
    const y0 = r.cy + 0.78 * S, y1 = y0 + 0.11 * S, band = [{ x: x - w * 1.04, y: y0 }, { x: x + w * 1.04, y: y0 }, { x: x + w * 1.05, y: y1 }, { x: x - w * 1.05, y: y1 }];
    r.ctx.fillStyle = INK; r.ctx.fill(pathOf(band, false));
    for (let i = -2; i <= 2; i++) { const sx = x + i * w * 0.38, st = [{ x: sx - S * 0.035, y: y1 - 2 }, { x: sx, y: y1 + S * 0.07 }, { x: sx + S * 0.035, y: y1 - 2 }]; r.ctx.fillStyle = '#fff'; r.ctx.fill(pathOf(st, false)); stroke(r, st, { sharp: true, single: true, w: 0.7 }); }
  }
}
function drawBody(r, nb, back) {
  const c = r.c, S = r.S, ctx = r.ctx, cY = Math.cos(r.yaw), sY = Math.sin(r.yaw), ex = new Set(c.extras);
  if (c.body === 'none') return;
  if (c.body === 'stick') {
    stroke(r, [{ x: r.cx, y: r.cy + 0.7 * S }, { x: r.cx + 1, y: r.cy + 1.6 * S }], { w: 1.2 });
    const y = r.cy + 0.98 * S, bw = [{ x: r.cx, y }, { x: r.cx - 0.17 * S, y: y - 0.08 * S }, { x: r.cx - 0.17 * S, y: y + 0.08 * S }, { x: r.cx, y }, { x: r.cx + 0.17 * S, y: y - 0.08 * S }, { x: r.cx + 0.17 * S, y: y + 0.08 * S }];
    const p = pathOf(bw, false); ctx.fillStyle = r.paper; ctx.fill(p); colorFill(r, p, c.topColor); stroke(r, bw, { sharp: true, close: true });
    return;
  }
  const T = (ang, y, h = 0) => { const a = torsoA(y), b = a * 0.58, x = Math.sin(ang) * (a + h), z = Math.cos(ang) * (b + h), nx = Math.sin(ang) * b, nz = Math.cos(ang) * a, l = Math.hypot(nx, nz) || 1; return { x: r.cx + (x * cY + z * sY) * S, y: nb + y * S, z: (-nx * sY + nz * cY) / l }; };
  const ymax = (r.o.H - nb) / S + 0.3, L = [], R = [];
  for (let y = 0; y <= ymax; y += 0.06) { const a = torsoA(y), w = Math.hypot(a * cY, a * 0.58 * sY); L.push({ x: r.cx - w * S, y: nb + y * S }); R.push({ x: r.cx + w * S, y: nb + y * S }); }
  const path = pathOf([...L, ...R.slice().reverse()], false);
  const dark = c.body === 'jacket' && !c.topColor, lineCol = dark ? '#f4f1ea' : INK;
  if (c.body === 'hoodie' && !back) hood(r);
  ctx.fillStyle = dark ? '#1c1c1c' : r.paper; ctx.fill(path);
  if (!dark) colorFill(r, path, c.topColor);
  if (c.shade && !dark) inClip(r, path, () => { const sh = [...R.map(p => ({ x: r.cx + (p.x - r.cx) * 0.45, y: p.y })), ...R.slice().reverse().map(p => ({ x: p.x + S, y: p.y }))]; const sz = Math.max(3, Math.round(S * 0.04)); ctx.fillStyle = dots(ctx, sz, sz * 0.22, INK); ctx.fill(pathOf(sh, false)); });
  stroke(r, L, { w: 1.25 }); stroke(r, R, { w: 1.25 });
  neck(r, nb, ex);
  const ln = (pts, opt = {}) => fline(r, pts, { color: lineCol, ...opt }, 0.02);
  const ring = (fy, n = 48, h = 0.01) => { const o = []; for (let i = 0; i <= n; i++) { const a = -PI + TAU * i / n; o.push(T(a, fy(a), h)); } return o; };
  const crew = a => 0.04 + 0.13 * Math.max(0, Math.cos(a)) ** 2;
  if (['tee', 'stripes', 'hoodie'].includes(c.body)) { ln(ring(crew), { w: 1.1 }); ln(ring(a => crew(a) + 0.05), { w: 0.6, single: true }); }
  if (c.body === 'stripes') for (let k = 0; k < 9; k++) ln(ring(() => 0.5 + k * 0.3), { w: 3.6, single: true });
  if (c.body === 'hoodie') {
    for (const s of [-1, 1]) { ln([T(s * 0.22, 0.14), T(s * 0.24, 0.45), T(s * 0.2, 0.8)], { w: 0.8 }); ctx.fillStyle = INK; const e = T(s * 0.2, 0.82); if (e.z > 0) dot(r, e, S * 0.025); }
    ln([T(-0.9, 2.2), T(-0.7, 1.55), T(0.7, 1.55), T(0.9, 2.2)], { w: 1 });
  }
  if (c.body === 'turtleneck') {
    const x = r.cx, w = 0.34 * S, y0 = r.cy + 0.68 * S, y1 = nb + 0.15 * S, pts = [{ x: x - w, y: y0 }, { x: x + w, y: y0 }, { x: x + w * 1.05, y: y1 }, { x: x - w * 1.05, y: y1 }];
    const p = pathOf(pts, false); ctx.fillStyle = r.paper; ctx.fill(p); colorFill(r, p, c.topColor); inClip(r, p, () => hatch(r, PI / 2, 6, 0.5)); stroke(r, pts, { close: true, sharp: true });
    ln(ring(() => 0.4), { w: 0.6, single: true });
  }
  if (c.body === 'jacket' || c.body === 'suit') {
    const shirt = [T(-0.32, 0.02), T(0.32, 0.02), T(0.06, 1.45), T(-0.06, 1.45)];
    if (shirt.every(p => p.z > 0)) { const p = pathOf(shirt, false); ctx.fillStyle = r.paper; ctx.fill(p); if (c.body === 'suit') stroke(r, shirt.slice(0, 2), { w: 0.8 }); }
    if (c.body === 'suit') { const tie = [T(-0.07, 0.1, 0.02), T(0.07, 0.1, 0.02), T(0.05, 0.22, 0.02), T(0.1, 1.0, 0.02), T(0, 1.15, 0.02), T(-0.1, 1.0, 0.02), T(-0.05, 0.22, 0.02)]; if (tie.every(p => p.z > 0)) { ctx.fillStyle = c.hatColor || INK; ctx.fill(pathOf(tie, false)); stroke(r, tie, { close: true, sharp: true, w: 0.8 }); } }
    for (const s of [-1, 1]) {
      const lap = [T(s * 0.32, 0.0, 0.02), T(s * 0.9, 0.12, 0.05), T(s * 0.62, 0.75, 0.05), T(s * 0.08, 1.45, 0.02)];
      if (lap.filter(p => p.z > 0).length >= 3) { const p = pathOf(lap, false); ctx.fillStyle = dark ? '#262626' : r.paper; ctx.fill(p); if (!dark) colorFill(r, p, c.topColor); stroke(r, lap, { sharp: true, close: true, color: lineCol, w: 1 }); }
      ln([T(s * 0.08, 1.45), T(s * 0.12, ymax)], { w: 1 });
      if (c.body === 'jacket') {
        ctx.fillStyle = dark ? '#f4f1ea' : INK;
        for (let k = 1; k < 5; k++) { const p = T(s * (0.9 - k * 0.07), 0.12 + k * 0.13, 0.06); if (p.z > 0) dot(r, p, S * 0.018); }
        for (const a of [1.0, 1.25, 1.5]) { const B1 = T(s * (a - 0.08), 0.3), B2 = T(s * (a + 0.08), 0.3), Tp = T(s * a, -0.05, 0.05); if (Tp.z > -0.3) { const sp = [B1, Tp, B2]; ctx.fillStyle = '#f4f1ea'; ctx.fill(pathOf(sp, false)); stroke(r, sp, { sharp: true, single: true }); } }
      }
    }
    if (c.body === 'jacket') {
      const patch = (a0, a1, y0, y1) => { const q = [T(a0, y0, 0.02), T(a1, y0, 0.02), T(a1, y1, 0.02), T(a0, y1, 0.02)]; if (!q.every(p => p.z > 0.05)) return; ctx.fillStyle = '#f4f1ea'; ctx.fill(pathOf(q, false)); stroke(r, q, { sharp: true, close: true }); const m = T((a0 + a1) / 2, (y0 + y1) / 2, 0.02), rad = Math.abs(q[1].x - q[0].x) * 0.32; const ring = []; for (let i = 0; i < 14; i++) ring.push({ x: m.x + Math.cos(i / 14 * TAU) * rad, y: m.y + Math.sin(i / 14 * TAU) * rad }); stroke(r, ring, { close: true, w: 1.1 }); stroke(r, [{ x: m.x - rad * 0.9, y: m.y + rad * 1.1 }, { x: m.x, y: m.y - rad * 1.1 }, { x: m.x + rad * 0.9, y: m.y + rad * 1.1 }], { sharp: true, w: 1.1 }); stroke(r, [{ x: m.x - rad * 0.7, y: m.y + rad * 0.2 }, { x: m.x + rad * 0.7, y: m.y + rad * 0.2 }], { w: 1.1 }); };
      patch(0.55, 0.95, 0.85, 1.25); patch(PI - 0.45, PI + 0.45, 0.6, 1.5);
      if (ex.has('safetypin')) { const p = T(-0.7, 0.55, 0.06); if (p.z > 0) stroke(r, [p, { x: p.x + S * 0.04, y: p.y + S * 0.03 }, { x: p.x + S * 0.2, y: p.y + S * 0.03 }, { x: p.x + S * 0.22, y: p.y }, { x: p.x + S * 0.03, y: p.y - S * 0.005 }], { color: '#f4f1ea', w: 0.9 }); }
    }
  }
}
function hood(r) {
  const S = r.S, x = r.cx - Math.sin(r.yaw) * 0.2 * S, y = r.cy + 0.18 * S, pts = [];
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; pts.push({ x: x + Math.cos(a) * 1.25 * S, y: y + Math.sin(a) * 1.22 * S * (Math.sin(a) > 0 ? 0.75 : 1) }); }
  const p = pathOf(pts); r.ctx.fillStyle = r.paper; r.ctx.fill(p); colorFill(r, p, r.c.topColor); stroke(r, pts, { close: true, w: 1.2 });
}

// ---------------------------------------------------------------- whole character
function renderChar(ctx, c, o) {
  const r = makeR(ctx, c, o); silhouette(r);
  const back = Math.cos(o.yaw) * Math.cos(o.pitch) < -0.15, nb = o.cy + 1.12 * o.S, ex = new Set(c.extras);
  const hh = hidesHair(c);
  if (c.hair === 'long' && !back && !hh) curtain(r);
  drawBody(r, nb, back);
  veil(r, 'back'); hat(r, 'back'); if (!hh) ears(r, 'back'); if (!hh) hair(r, 'back');
  headBase(r);
  if (!hh) ears(r, 'front');
  facialHair(r);
  if (!hh) hair(r, 'front');
  eyes(r); nose(r); mouth(r);
  eyewear(r); veil(r, 'front'); hat(r, 'front'); extras(r, nb);
  if (back && c.hair === 'long' && !hh) curtain(r);
  if (back && c.body === 'hoodie') hood(r);
  return r;
}

// ---------------------------------------------------------------- backgrounds
const bgCache = new Map();
function torn(x, y, w, h, R) {
  const p = new Path2D(), pts = [], n = 14;
  for (let i = 0; i < n; i++) pts.push([x + w * i / n, y + (R() - 0.5) * 8]);
  for (let i = 0; i < n; i++) pts.push([x + w + (R() - 0.5) * 8, y + h * i / n]);
  for (let i = n; i > 0; i--) pts.push([x + w * i / n, y + h + (R() - 0.5) * 8]);
  for (let i = n; i > 0; i--) pts.push([x + (R() - 0.5) * 8, y + h * i / n]);
  polyPath(p, pts, true); return p;
}
function background(kind, W, H, seed) {
  const key = kind + W + 'x' + H + ':' + seed; if (bgCache.has(key)) return bgCache.get(key);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), R = mulberry(seed);
  if (kind === 'paper' || kind === 'zine') {
    g.fillStyle = kind === 'paper' ? '#ebe7de' : '#efece6'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) { const x = R() * W, y = R() * H, rad = W * (0.15 + R() * 0.3), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(200,194,182,0.35)'); gr.addColorStop(1, 'rgba(200,194,182,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  } else { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
  if (kind === 'zine') {
    for (let i = 0; i < 8; i++) {
      g.save(); g.translate(R() * W, R() * H); g.rotate((R() - 0.5) * 0.7);
      const w = W * (0.2 + R() * 0.35), h = H * (0.1 + R() * 0.22), p = torn(-w / 2, -h / 2, w, h, R), dark = i % 3 === 0;
      g.fillStyle = dark ? '#1a1a1a' : (R() < 0.5 ? '#dcd8d0' : '#f9f7f2'); g.fill(p);
      g.save(); g.clip(p);
      if (dark) { g.fillStyle = dots(g, 9, 2.2, '#efece6'); g.fillRect(-w, -h, w * 2, h * 2); }
      else if (R() < 0.6) { g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = -h / 2 + 12; y < h / 2 - 8; y += 11) { let x = -w / 2 + 10; while (x < w / 2 - 20) { const ww = 8 + R() * 40; g.fillRect(x, y, Math.min(ww, w / 2 - 10 - x), 4); x += ww + 6; } } }
      g.restore(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke(p); g.restore();
    }
    const fonts = ['Georgia', 'Courier New', 'Impact', 'Arial Black', 'Times New Roman', 'Trebuchet MS'];
    const word = (txt, x, y, size) => { for (const ch of txt) { if (ch === ' ') { x += size * 0.5; continue; } g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.35); g.font = `${R() < 0.5 ? 'bold ' : ''}${size * (0.85 + R() * 0.3)}px ${fonts[Math.floor(R() * fonts.length)]}`; const m = g.measureText(ch).width, inv = R() < 0.45; g.fillStyle = inv ? '#111' : '#fff'; g.fillRect(-6, -size * 0.85, m + 12, size * 1.1); g.strokeStyle = '#111'; g.lineWidth = 1.5; g.strokeRect(-6, -size * 0.85, m + 12, size * 1.1); g.fillStyle = inv ? '#fff' : '#111'; g.fillText(ch, 0, 0); g.restore(); x += m + 16; } };
    g.strokeStyle = '#111'; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const x = R() * W, y = R() * H, s = 14 + R() * 12; g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); g.stroke(); }
  }
  if (kind === 'halftone') { g.fillStyle = '#111'; for (let y = 0; y < H; y += 14) for (let x = (y / 14 % 2) * 7; x < W; x += 14) { const t = clamp(((x + y) / (W + H)) * 1.6 - 0.45, 0, 1); if (t > 0) { g.beginPath(); g.arc(x, y, t * 5.5, 0, TAU); g.fill(); } } }
  if (kind === 'grid') { g.strokeStyle = '#e4e4e4'; g.lineWidth = 1; for (let x = 0; x <= W; x += 40) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); } for (let y = 0; y <= H; y += 40) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); } }
  bgCache.set(key, cv); return cv;
}
let grainCv = null;
function grain(ctx, W, H) {
  if (!grainCv) { grainCv = document.createElement('canvas'); grainCv.width = grainCv.height = 256; const g = grainCv.getContext('2d'), d = g.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = 200 + Math.random() * 55; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.fillStyle = ctx.createPattern(grainCv, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
}
const paperFor = bg => bg === 'paper' ? '#ebe7de' : '#fdfcf8';

// ---------------------------------------------------------------- random
// Every random character gets punk bits: 1-2 piercings, usually a tattoo, often spikes.
function punkBits(R, pick) {
  const out = new Set([pick(['nosering', 'browbar', 'hoops', 'safetypin', 'lipring'])]);
  if (R() < 0.5) out.add(pick(['nosering', 'browbar', 'hoops', 'safetypin', 'lipring']));
  if (R() < 0.75) out.add(pick(['teardrop', 'tribal', 'barbwire', 'star']));
  if (R() < 0.45) out.add(pick(['spikeband', 'choker']));
  for (const e of ['scar', 'bandaid', 'freckles', 'eyeblack']) if (R() < 0.1) out.add(e);
  return [...out];
}
function randomCfg(type) {
  const R = Math.random, pick = a => a[Math.floor(R() * a.length)], maybe = (p, a) => R() < p ? pick(a) : 'none';
  type = type || (R() < 0.25 ? 'cat' : 'human');
  const cat = type === 'cat';
  const c = {
    ...cfg, ...PRESET[type],
    head: cat ? pick(['wide', 'round', 'potato', 'square']) : pick(OPTS.head),
    eyes: cat ? pick(['slit', 'ring', 'wide', 'sleepy', 'almond', 'closed']) : pick(OPTS.eyes.filter(e => e !== 'slit')),
    brows: maybe(0.6, OPTS.brows.slice(1)),
    nose: cat ? 'cat' : pick(OPTS.nose.filter(n => n !== 'cat')),
    mouth: cat ? pick(['cat', 'fangs', 'o', 'open', 'rose']) : pick(OPTS.mouth.filter(m => m !== 'cat' && m !== 'fangs')),
    ears: cat ? 'cat' : pick(['normal', 'normal', 'big', 'small', 'pointy', 'gauged']),
    hair: cat ? pick(['tabby', 'patches', 'tux', 'mohawk', 'mohawk', 'spiky', 'liberty']) : pick(['mohawk', 'mohawk', 'liberty', 'liberty', 'spiky', 'spiky', 'buzz', 'crop', 'flattop', 'hatched', 'curly', 'afro', 'bowl', 'slick', 'long', 'bun']),
    beard: cat ? 'none' : maybe(0.4, OPTS.beard.slice(1)),
    stache: cat ? 'none' : maybe(0.25, OPTS.stache.slice(1)),
    hat: R() < 0.5 ? 'none' : R() < 0.5 ? pick(['turban', 'peci1', 'peci2', 'peci3', 'blangkon', 'bogo']) : pick(['beanie', 'pompom', 'cap', 'flatcap', 'headband', 'bandana', 'cowl', 'lensmask', 'luchador']),
    eyewear: maybe(0.35, OPTS.eyewear.slice(1)),
    extras: punkBits(R, pick).concat(cat ? ['whiskers'] : []),
    body: cfg.body,
    skin: R() < 0.35 ? null : pick(COLORS.slice(1, 9)),
    hairColor: R() < 0.5 ? null : pick(COLORS.slice(3)),
    topColor: R() < 0.4 ? null : pick(COLORS.slice(5)),
    hatColor: pick(COLORS.slice(5)),
    veil: !cat && R() < 0.18 ? 'hijab' : 'none', veilColor: pick(COLORS.slice(1)),
    eyeGap: 0.28 + R() * 0.16, featY: (R() - 0.5) * 0.18, featScale: 0.85 + R() * 0.3,
    seed: Math.floor(R() * 1e6),
  };
  return c;
}

