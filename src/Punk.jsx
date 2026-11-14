import { useState, useEffect, useRef } from 'preact/hooks';
import { renderChar, renderPart, randomCfg, background, grain, paperFor, dieCut, OPTS, COLORS, DEFAULT, PRESET, PI, clamp } from './engine.js';

// ngepunk: the head maker, in alviy.dev's wireframe style (always dark).
// Layout after ngepunk's own: collection on top; canvas + Previous / Shuffle / Export + a Pose section on the left;
// every part group is a collapsible section on the right, its tiles showing that one part on its own.
const MONO = "font-family:'JetBrains Mono',monospace;";
const INK = 'var(--fg)', PAPER = 'var(--bg)', BLUE = 'var(--play)', MUTE = 'var(--mute)', RULE = 'var(--rule)'; // theme tokens
const STORE = 'ngepunk';
const LABELS = { peci1: 'peci low', peci2: 'peci mid', peci3: 'peci tall', lensmask: 'lens mask', bogo: 'helm bogo' };
const SECTIONS = [
  { id: 'base', label: 'Base', groups: [['type', 'Character'], ['head', 'Head shape'], ['ears', 'Ears']] },
  { id: 'body', label: 'Body', groups: [['body', 'Half body']] },
  { id: 'eyes', label: 'Eyes', groups: [['eyes', 'Eyes'], ['brows', 'Brows']], sliders: [['eyeGap', 'Eye spacing', 0.2, 0.55, 0.01]] },
  { id: 'face', label: 'Nose + mouth', groups: [['nose', 'Nose'], ['mouth', 'Mouth']], sliders: [['featY', 'Feature height', -0.2, 0.25, 0.01], ['featScale', 'Feature size', 0.7, 1.4, 0.01]] },
  { id: 'hair', label: 'Hair + fur', groups: [['hair', 'Hair / fur pattern']] },
  { id: 'beard', label: 'Facial hair', groups: [['beard', 'Beard'], ['stache', 'Mustache']] },
  { id: 'hat', label: 'Headwear', groups: [['veil', 'Hijab (layers under any headwear)'], ['hat', 'Hats, masks + culture']] },
  { id: 'eyewear', label: 'Eyewear', groups: [['eyewear', 'Eyewear + masks']] },
  { id: 'bits', label: 'Punk bits', groups: [['extras', 'Extras (pick many)']] },
  { id: 'color', label: 'Colour', colors: [['skin', 'Skin / fur'], ['hairColor', 'Hair'], ['topColor', 'Clothes'], ['hatColor', 'Headwear, masks + tie'], ['veilColor', 'Hijab']], seg: [['fill', 'Fill style']] },
  { id: 'scene', label: 'Scene', seg: [['bg', 'Background']], toggles: [['shade', 'Halftone shading'], ['boil', 'Line boil'], ['dieCut', 'Die-cut sticker'], ['cutGrid', 'Die-cut grid']], sliders: [['weight', 'Ink weight', 0.8, 4, 0.1], ['wobble', 'Wobble', 0, 3, 0.1], ['mis', 'Misregister', 0, 14, 0.5], ['cutSize', 'Die-cut size', 4, 36, 1]] }
];
const load = () => { try { const s = JSON.parse(localStorage.getItem(STORE)); if (s) return { ...DEFAULT, ...s }; } catch (e) {} return { ...DEFAULT }; };
const label = MONO + 'font-size:10px;letter-spacing:.08em;color:' + MUTE;
const chip = (on) => 'min-height:34px;padding:0 10px;border:1px solid ' + (on ? INK : RULE) + ';border-radius:0;background:' + (on ? INK : 'transparent') + ';color:' + (on ? PAPER : INK) + ';' + MONO + 'font-size:12px;cursor:pointer';
const btn = (bg, fg) => 'flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 14px;background:' + bg + ';color:' + fg + ';border:1px solid ' + INK + ';border-radius:0;font:500 13px "JetBrains Mono",monospace;cursor:pointer;white-space:nowrap';
const summary = 'display:flex;align-items:center;gap:10px;min-height:46px;cursor:pointer;list-style:none;' + MONO + 'font-size:11px;letter-spacing:.08em';

// thumbnails: each tile shows only its part, on a bare head outline (not applied to your current head)
const NEUTRAL = { ...DEFAULT, extras: [], hair: 'bald', hat: 'none', beard: 'none', stache: 'none', eyewear: 'none', veil: 'none', body: 'none', brows: 'none', boil: false, shade: false };
const FACE = ['eyes', 'brows', 'nose', 'mouth', 'eyewear', 'beard', 'stache', 'extras'];
function paintTiles(root) {
  if (!root) return;
  root.querySelectorAll('canvas[data-k]').forEach((cv) => {
    if (cv.dataset.done) return;
    const key = cv.dataset.k, v = cv.dataset.v, W = cv.width, H = cv.height, ctx = cv.getContext('2d');
    const c = key === 'type' ? { ...NEUTRAL, ...PRESET[v] } : key === 'extras' ? { ...NEUTRAL, extras: [v] } : key === 'brows' ? { ...NEUTRAL, brows: v, eyes: 'dot' } : { ...NEUTRAL, [key]: v };
    const face = FACE.includes(key), body = key === 'body';
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    try { renderPart(ctx, c, { W, H, cx: W / 2, cy: body ? H * 0.3 : face ? H * 0.42 : H * 0.56, S: body ? H * 0.17 : face ? H * 0.46 : H * 0.3, yaw: 0.35, pitch: 0.05, tilt: 0, tick: 0, paper: '#fff', thumb: true }, key); } catch (e) { console.error(e); }
    cv.dataset.done = '1';
  });
}

// Collection: a grid of random heads on top; click one to edit it. Your scene settings (background, ink...) stay.
const SCENE_KEYS = ['bg', 'bgSeed', 'boil', 'shade', 'weight', 'wobble', 'mis', 'fill', 'body', 'dieCut', 'cutSize', 'cutColor', 'cutGrid'];
const N_COLL = 12;
const rollHeads = () => Array.from({ length: N_COLL }, () => ({ ...randomCfg(), body: 'none', yaw: (Math.random() - 0.5) * 1.6, tilt: (Math.random() - 0.5) * 0.35 }));
function Collection({ onPick }) {
  const [heads, setHeads] = useState(rollHeads);
  const refs = useRef([]);
  useEffect(() => {
    heads.forEach((c, i) => {
      const cvs = refs.current[i]; if (!cvs) return;
      const ctx = cvs.getContext('2d'), W = cvs.width, H = cvs.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
      try { renderChar(ctx, { ...c, boil: false }, { W, H, cx: W / 2, cy: H * 0.54, S: H * 0.29, yaw: c.yaw, pitch: 0.05, tilt: c.tilt, tick: 0, paper: '#fff', thumb: true }); } catch (e) { console.error(e); }
    });
  }, [heads]);
  const [open] = useState(() => !(typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches));
  return (
    <details open={open} style={'border-top:1px solid ' + INK + ';border-bottom:1px solid ' + RULE}>
      <summary style={summary}><span aria-hidden="true" style={'color:' + BLUE}>+</span><b style="font-weight:500">COLLECTION</b><span style={'color:' + MUTE}>{'· ' + N_COLL + ' HEADS · CLICK ONE TO EDIT'}</span></summary>
      <div style="display:flex;flex-direction:column;gap:10px;padding-bottom:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px">
          {heads.map((c, i) => (
            <button type="button" aria-label={'Edit collection head ' + (i + 1)} onClick={() => onPick(c)} style={'padding:0;border:1px solid ' + RULE + ';border-radius:0;background:#FFFFFF;cursor:pointer;aspect-ratio:1/1'} onPointerEnter={(e) => { e.currentTarget.style.borderColor = BLUE; }} onPointerLeave={(e) => { e.currentTarget.style.borderColor = RULE; }}>
              <canvas ref={(el) => { refs.current[i] = el; }} width="200" height="200" style="display:block;width:100%;height:100%"></canvas>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setHeads(rollHeads())} style={chip(false) + ';align-self:flex-start'}>Shuffle collection</button>
      </div>
    </details>
  );
}

// the creator card, as on ngepunk (Ruri's own words and drawings)
function Creator() {
  const dlg = useRef(null);
  return (<>
    <button type="button" aria-haspopup="dialog" onClick={() => dlg.current.showModal()} style={'padding:0;border:0;background:transparent;color:inherit;font:inherit;letter-spacing:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer'}>creator</button>
    <dialog ref={dlg} aria-label="Creator" onClick={(e) => { if (e.target === e.currentTarget) dlg.current.close(); }} style={'max-width:min(560px,92vw);padding:0;border:1px solid ' + INK + ';background:' + PAPER + ';color:' + INK}>
      <div style="display:flex;flex-direction:column;gap:14px;padding:clamp(20px,4vw,32px)">
        <button type="button" aria-label="Close" onClick={() => dlg.current.close()} style={'align-self:flex-end;width:36px;height:36px;border:1px solid ' + INK + ';border-radius:0;background:transparent;color:' + INK + ';cursor:pointer;' + MONO}>×</button>
        <img src="assets/creator-card.webp" alt="The creator, drawn: green face, blue cap, grey suit with a blue tie" width="390" height="390" style="width:100%;max-width:320px;height:auto;align-self:center;display:block" />
        <span style={MONO + 'font-size:11px;letter-spacing:.08em;color:' + BLUE}>VIBE CODED, NO GROUP DISCUSSION</span>
        <p style="margin:0;font-size:14px;line-height:1.6">No rulers, no clean vectors, no permission asked. Every head here is wobbly ink, crooked on purpose, printed slightly off-register like a zine somebody photocopied at 3am. Turn it, break it, make it ugly, call it art.</p>
        <p style="margin:0;font-size:14px;line-height:1.6">Stay loud. Stay crooked. Draw your own face.</p>
        <p style={'margin:0;' + MONO + 'font-size:12px;line-height:1.8'}><a href="mailto:alviy.dev@gmail.com" style={'color:' + INK}>alviy.dev@gmail.com</a><br /><a href="https://instagram.com/rurrii" style={'color:' + INK}>Instagram @rurrii</a> · <a href="https://www.threads.net/@rurrii" style={'color:' + INK}>Threads @rurrii</a></p>
        <p style={'margin:0;' + MONO + 'font-size:10px;line-height:1.6;color:' + MUTE}>© 2026 alviy · No commercial use. Make faces for fun, art, study and your own stuff; selling it or using it for business needs permission. PolyForm Noncommercial 1.0.0</p>
      </div>
    </dialog>
  </>);
}

export default function Punk() {
  const [cfg, setCfg] = useState(load);
  const [open, setOpen] = useState({ base: true });
  const [wide] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches);
  const [spin, setSpin] = useState(false);
  const [hist, setHist] = useState([]);
  const cv = useRef(null), right = useRef(null), st = useRef({ cfg, view: { yaw: 0.45, pitch: 0.06, tilt: 0 }, dirty: true, spin: false, drag: null });
  st.current.cfg = cfg; st.current.spin = spin;
  const set = (p) => setCfg((c) => { const n = { ...c, ...p }; try { localStorage.setItem(STORE, JSON.stringify(n)); } catch (e) {} st.current.dirty = true; return n; });

  // render loop: redraw only when something changed, or on the 12 fps "boil" tick
  useEffect(() => {
    const layer = document.createElement('canvas');
    let raf, lastTick = -1;
    const draw = (tick) => {
      const c = cv.current, s = st.current, W = c.width, H = c.height, cf = s.cfg, clear = cf.bg === 'transparent';
      if (layer.width !== W) { layer.width = W; layer.height = H; }
      const l = layer.getContext('2d'); l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, W, H);
      const body = !['none', 'stick'].includes(cf.body);
      renderChar(l, cf, { W, H, cx: W / 2, cy: body ? 390 : 470, S: body ? 150 : 185, ...s.view, tick, paper: paperFor(cf.bg) });
      const m = c.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, W, H);
      if (!clear) m.drawImage(background(cf.bg, W, H, cf.bgSeed || 3), 0, 0);
      if (cf.dieCut) dieCut(m, layer, cf.cutSize, cf.cutColor || '#ffffff', cf.cutGrid);
      m.drawImage(layer, 0, 0);
      if (!clear && cf.bg !== 'white') grain(m, W, H);
    };
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      const s = st.current, tick = Math.floor(t / 83);
      if (s.cfg.boil && tick !== lastTick) { lastTick = tick; s.dirty = true; if (s.spin) s.view.yaw += 0.09; }
      else if (s.spin && !s.cfg.boil) { s.view.yaw += 0.02; s.dirty = true; }
      if (s.dirty) { s.dirty = false; try { draw(s.cfg.boil ? tick : 0); } catch (e) { console.error(e); } }
    };
    raf = requestAnimationFrame(frame);
    const key = (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 'r' || e.key === 'R') shuffle(); };
    addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); removeEventListener('keydown', key); };
  }, []);
  // paint the tiles of every open section (each tile is drawn once)
  useEffect(() => { const id = requestAnimationFrame(() => paintTiles(right.current)); return () => cancelAnimationFrame(id); }, [open]);

  const shuffle = () => { const c = st.current.cfg; setHist((h) => h.concat([c]).slice(-50)); set(randomCfg(undefined, c)); };
  const previous = () => setHist((h) => { if (!h.length) return h; set(h[h.length - 1]); return h.slice(0, -1); });
  const view = (v) => { Object.assign(st.current.view, v); st.current.dirty = true; };
  const exportPng = () => cv.current.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ngepunk-' + Date.now() + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  const pick = (key, v) => {
    if (key === 'extras') set({ extras: cfg.extras.includes(v) ? cfg.extras.filter((e) => e !== v) : [...cfg.extras, v] });
    else if (key === 'type') set({ ...PRESET[v], extras: v === 'cat' ? [...new Set([...cfg.extras, 'whiskers'])] : cfg.extras.filter((e) => e !== 'whiskers') });
    else set({ [key]: v });
  };
  const drag = {
    onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); st.current.drag = [e.clientX, e.clientY]; },
    onPointerMove: (e) => { const d = st.current.drag; if (!d) return; const v = st.current.view; v.yaw += (e.clientX - d[0]) * 0.012; v.pitch = clamp(v.pitch - (e.clientY - d[1]) * 0.006, -0.6, 0.6); st.current.drag = [e.clientX, e.clientY]; st.current.dirty = true; },
    onPointerUp: () => { st.current.drag = null; }, onPointerCancel: () => { st.current.drag = null; }
  };
  const toggle = (id) => (e) => { const o = e.currentTarget.open; setOpen((s) => (!!s[id] === o ? s : { ...s, [id]: o })); };
  const valueOf = (key) => (key === 'extras' ? (cfg.extras.length ? cfg.extras.length + ' bits' : 'none') : LABELS[cfg[key]] || String(cfg[key]));

  return (
    <div style={'max-width:1200px;margin:0 auto;padding:clamp(24px,4vw,48px) clamp(16px,3vw,32px) 80px;color:' + INK}>
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:16px">
        <div style="display:flex;flex-direction:column;gap:12px;max-width:640px">
          <span style={MONO + 'font-size:11px;letter-spacing:.08em;color:' + BLUE}><a href="https://alviy.dev" style="color:inherit;text-decoration:underline;text-underline-offset:3px">alviy.dev</a> · ngepunk · <Creator /></span>
          <h1 style="margin:0;font-size:clamp(22px,2.6vw,32px);font-weight:300;letter-spacing:-0.03em;line-height:1.3">Wobbly heads, drawn <span style={'border-bottom:1px solid ' + BLUE}>crooked</span> on purpose. No rulers, no clean vectors, no permission asked.</h1>
          <span style={MONO + 'font-size:12px;color:' + MUTE}>Drag the head to turn it. Open a part to change it. Shuffle when bored.</span>
        </div>
      </div>
      <div style="margin-top:clamp(20px,3vw,32px)">
        <Collection onPick={(c) => { const cur = st.current.cfg, keep = {}; for (const k of SCENE_KEYS) keep[k] = cur[k]; setHist((h) => h.concat([cur]).slice(-50)); set({ ...c, ...keep }); }} />
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:clamp(20px,3vw,40px);margin-top:clamp(20px,3vw,32px);align-items:flex-start">
        <div style={'flex:1.25 1 360px;max-width:600px;min-width:0;display:flex;flex-direction:column;gap:10px;' + (wide ? 'position:sticky;top:12px' : '')}>
          <div style="position:relative">
            <canvas ref={cv} width="1000" height="1000" {...drag} aria-label="Character canvas. Drag to turn it, press R to shuffle." style={'display:block;width:100%;height:auto;outline:1px solid ' + RULE + ';cursor:grab;touch-action:none;background:' + (cfg.bg === 'transparent' ? 'repeating-conic-gradient(#2A2A29 0% 25%, #1A1A19 0% 50%) 0 0 / 24px 24px' : 'none')}></canvas>
            <span aria-hidden="true" style={'position:absolute;left:10px;bottom:8px;' + MONO + 'font-size:10px;color:' + MUTE}>drag to turn</span>
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" onClick={previous} disabled={!hist.length} style={btn(PAPER, INK) + (hist.length ? '' : ';opacity:.4;cursor:default')}>Previous</button>
            <button type="button" onClick={shuffle} style={btn(PAPER, INK)}>Shuffle</button>
            <button type="button" onClick={exportPng} style={btn(INK, PAPER)}>Export PNG</button>
          </div>
          <details style={'border-bottom:1px solid ' + RULE}>
            <summary style={summary}><span aria-hidden="true" style={'color:' + BLUE}>+</span><b style="font-weight:500">POSE</b><span style={'color:' + MUTE}>· TURN, NOD, TILT, SPIN</span></summary>
            <div style="display:flex;flex-direction:column;gap:12px;padding-bottom:14px">
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                {[['Front', 0], ['¾', 0.6], ['Side', PI / 2], ['Back', PI]].map(([n, y]) => <button type="button" onClick={() => view({ yaw: y, pitch: 0.04, tilt: 0 })} style={chip(false)}>{n}</button>)}
                <button type="button" aria-pressed={spin} onClick={() => setSpin(!spin)} style={chip(spin)}>Spin</button>
              </div>
              {[['yaw', 'Turn', -PI, PI], ['pitch', 'Nod', -0.6, 0.6], ['tilt', 'Tilt', -0.5, 0.5]].map(([k, name, min, max]) => (
                <label style={'display:grid;grid-template-columns:60px 1fr;align-items:center;gap:10px;' + MONO + 'font-size:12px'}>
                  <span>{name}</span>
                  <input type="range" min={min} max={max} step="0.01" defaultValue={st.current.view[k]} onInput={(e) => view({ [k]: +e.currentTarget.value })} style={'width:100%;accent-color:' + BLUE} />
                </label>
              ))}
            </div>
          </details>
        </div>
        <div ref={right} style="flex:1.4 1 360px;min-width:0">
          {SECTIONS.map((S) => (
            <details open={!!open[S.id]} onToggle={toggle(S.id)} style={'border-top:1px solid ' + RULE}>
              <summary style={summary}>
                <span aria-hidden="true" style={'width:10px;color:' + BLUE}>{open[S.id] ? '−' : '+'}</span>
                <b style="font-weight:500">{S.label.toUpperCase()}</b>
                <span style={'color:' + MUTE + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap'}>{'· ' + (S.groups || []).map(([k]) => valueOf(k)).concat((S.seg || []).map(([k]) => cfg[k])).join(' · ').toUpperCase()}</span>
              </summary>
              <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0 22px">
                {(S.groups || []).map(([key, name]) => (
                  <div style="display:flex;flex-direction:column;gap:8px">
                    <span style={label}>{name.toUpperCase()}</span>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:6px">{OPTS[key].map((v) => { const on = key === 'extras' ? cfg.extras.includes(v) : cfg[key] === v; return (
                      <button type="button" aria-pressed={on} onClick={() => pick(key, v)} style={'display:flex;flex-direction:column;padding:0;border:1px solid ' + (on ? INK : RULE) + ';border-radius:0;background:#FFFFFF;cursor:pointer;color:#141414'}>
                        <canvas data-k={key} data-v={v} width="120" height="100" aria-hidden="true" style="display:block;width:100%;height:auto;pointer-events:none"></canvas>
                        <span style={'padding:4px 6px;border-top:1px solid ' + (on ? '#141414' : '#E2E2DF') + ';' + MONO + 'font-size:10px;font-weight:' + (on ? 600 : 400) + ';text-align:center;background:' + (on ? '#141414' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#6B6A64')}>{LABELS[v] || v}</span>
                      </button>); })}</div>
                  </div>
                ))}
                {(S.colors || []).map(([key, name]) => (
                  <div style="display:flex;flex-direction:column;gap:8px">
                    <span style={label}>{name.toUpperCase()}</span>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">{COLORS.map((c) => <button type="button" aria-label={name + ': ' + (c || 'none')} aria-pressed={cfg[key] === c} onClick={() => set({ [key]: c })} style={'width:28px;height:28px;padding:0;border-radius:0;cursor:pointer;border:1px solid ' + (cfg[key] === c ? INK : RULE) + ';outline:' + (cfg[key] === c ? '2px solid ' + BLUE : 'none') + ';outline-offset:1px;background:' + (c || 'repeating-linear-gradient(-45deg,#ccc 0 2px,transparent 2px 6px)')}></button>)}</div>
                  </div>
                ))}
                {(S.seg || []).map(([key, name]) => (
                  <div style="display:flex;flex-direction:column;gap:8px">
                    <span style={label}>{name.toUpperCase()}</span>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">{OPTS[key].map((v) => <button type="button" aria-pressed={cfg[key] === v} onClick={() => set({ [key]: v })} style={chip(cfg[key] === v)}>{v}</button>)}</div>
                  </div>
                ))}
                {S.toggles && (
                  <div style="display:flex;flex-direction:column;gap:8px">
                    <span style={label}>EFFECTS</span>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">{S.toggles.map(([key, name]) => <button type="button" aria-pressed={!!cfg[key]} onClick={() => set({ [key]: !cfg[key] })} style={chip(!!cfg[key])}>{name}</button>)}</div>
                  </div>
                )}
                {(S.sliders || []).map(([key, name, min, max, step]) => (
                  <label style={'display:grid;grid-template-columns:120px 1fr 48px;align-items:center;gap:10px;' + MONO + 'font-size:12px'}>
                    <span>{name}</span>
                    <input type="range" min={min} max={max} step={step} value={cfg[key]} onInput={(e) => set({ [key]: +e.currentTarget.value })} style={'width:100%;accent-color:' + BLUE} />
                    <output style={'text-align:right;color:' + MUTE}>{(+cfg[key]).toFixed(2)}</output>
                  </label>
                ))}
                {S.id === 'scene' && <button type="button" onClick={() => set({ bgSeed: Math.floor(Math.random() * 1e6) })} style={chip(false) + ';align-self:flex-start'}>Shuffle collage</button>}
              </div>
            </details>
          ))}
          <p style={'margin:0;padding-top:14px;border-top:1px solid ' + RULE + ';' + MONO + 'font-size:11px;line-height:1.6;color:' + MUTE}>Your head is saved in this browser. Made by <a href="https://alviy.dev" style={'color:' + INK}>alviy.dev</a>.</p>
        </div>
      </div>
    </div>
  );
}
