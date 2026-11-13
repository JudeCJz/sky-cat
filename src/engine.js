/* Sky Cat engine: canvas, loop, input, sprites, masks, text, fx, storage, rng, scenes. */
(function () {
'use strict';

const SC = window.SC = window.SC || {};
const W = 480, H = 270;
SC.W = W; SC.H = H;
SC.frame = 0; SC.time = 0; SC.dt = 1; SC.current = null;

// ---------------------------------------------------------------- utils
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(x0, y0, x1, y1) { const dx = x1 - x0, dy = y1 - y0; return Math.sqrt(dx * dx + dy * dy); }
function angle(x0, y0, x1, y1) { return Math.atan2(y1 - y0, x1 - x0); }
function hash(str) {
  str = String(str);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rng(seed) {
  let a = (seed === undefined || seed === null ? (Math.random() * 4294967296) : seed) >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function choose(arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; }

SC.clamp = clamp; SC.lerp = lerp; SC.dist = dist; SC.angle = angle;
SC.hash = hash; SC.rng = rng; SC.rand = Math.random; SC.choose = choose;
SC.ease = {
  linear: function (t) { return t; },
  inQuad: function (t) { return t * t; },
  outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
  inCubic: function (t) { return t * t * t; },
  outCubic: function (t) { const u = 1 - t; return 1 - u * u * u; },
  outBack: function (t) { const c1 = 1.70158, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; },
  inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
  outElastic: function (t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  }
};

// ---------------------------------------------------------------- flags
(function () {
  let loc = '';
  try { loc = (location.search || '') + ' ' + (location.hash || ''); } catch (e) { loc = ''; }
  const lc = loc.toLowerCase();
  const f = { mute: lc.indexOf('mute') >= 0, test: lc.indexOf('test') >= 0, seed: null, scene: null };
  let m = /seed=([^&#\s]+)/i.exec(loc);
  if (m) { const n = parseInt(m[1], 10); f.seed = isNaN(n) ? hash(m[1]) : n; }
  m = /scene=([^&#\s]+)/i.exec(loc);
  if (m) { try { f.scene = decodeURIComponent(m[1]); } catch (e) { f.scene = m[1]; } }
  SC.flags = f;
})();

// ---------------------------------------------------------------- storage
(function () {
  const PREFIX = 'skycat2-';
  const mem = Object.create(null);
  const MISS = {};
  SC.store = {
    get: function (key, fallback) {
      let v = mem[key];
      if (v === undefined) {
        v = MISS;
        try {
          const s = localStorage.getItem(PREFIX + key);
          if (s !== null) v = JSON.parse(s);
        } catch (e) { v = MISS; }
        mem[key] = v;
      }
      return v === MISS ? fallback : v;
    },
    set: function (key, value) {
      if (value === undefined) { this.remove(key); return; }
      mem[key] = value;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    remove: function (key) {
      mem[key] = MISS;
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    },
    clear: function () {
      for (const k in mem) delete mem[k];
      try {
        const del = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) del.push(k);
        }
        for (let i = 0; i < del.length; i++) localStorage.removeItem(del[i]);
      } catch (e) { /* ignore */ }
    }
  };
})();

// ---------------------------------------------------------------- canvas + page
const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
SC.canvas = canvas; SC.ctx = ctx; SC.scale = 1;

function layout() {
  const iw = window.innerWidth || W, ih = window.innerHeight || H;
  const dpr = window.devicePixelRatio || 1;
  let s;
  if (SC.store.get('pixelPerfect', false) === true) {
    const sd = Math.floor(Math.min(iw * dpr / W, ih * dpr / H));
    if (sd >= 1) s = sd / dpr; else s = Math.min(iw / W, ih / H);
  } else {
    // fill the window at 16:9 (fractional scale, still nearest-neighbour)
    s = Math.min(iw / W, ih / H);
  }
  SC.scale = s;
  const cw = W * s, ch = H * s;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  canvas.style.left = (Math.round((iw - cw) / 2 * dpr) / dpr) + 'px';
  canvas.style.top = (Math.round((ih - ch) / 2 * dpr) / dpr) + 'px';
}
SC.relayout = layout;

function setupDom() {
  const de = document.documentElement, b = document.body;
  const css = 'margin:0;padding:0;background:#000;overflow:hidden;width:100%;height:100%;' +
    'touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;' +
    '-webkit-tap-highlight-color:transparent;overscroll-behavior:none;';
  de.style.cssText += css;
  b.style.cssText += css;
  const cs = canvas.style;
  cs.position = 'fixed';
  cs.display = 'block';
  cs.background = '#000';
  cs.imageRendering = 'pixelated';
  cs.touchAction = 'none';
  cs.outline = 'none';
  try { cs.setProperty('image-rendering', 'crisp-edges'); cs.setProperty('image-rendering', 'pixelated'); } catch (e) { /* ignore */ }
  if (!document.querySelector('meta[name=viewport]')) {
    const mv = document.createElement('meta');
    mv.name = 'viewport';
    mv.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    document.head.appendChild(mv);
  }
  b.appendChild(canvas);
  layout();
}
if (document.body) setupDom();
else document.addEventListener('DOMContentLoaded', setupDom);
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', layout);
if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

// ---------------------------------------------------------------- drawing primitives
function rect(x, y, w, h, color) {
  const x0 = Math.round(x), y0 = Math.round(y);
  const rw = Math.round(x + w) - x0, rh = Math.round(y + h) - y0;
  if (rw <= 0 || rh <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x0, y0, rw, rh);
}

function line(x0, y0, x1, y1, color, thick) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const t = thick > 1 ? Math.round(thick) : 1;
  const o = t >> 1;
  ctx.fillStyle = color;
  if (y0 === y1) { const a = Math.min(x0, x1); ctx.fillRect(a - o, y0 - o, Math.abs(x1 - x0) + t, t); return; }
  if (x0 === x1) { const a = Math.min(y0, y1); ctx.fillRect(x0 - o, a - o, t, Math.abs(y1 - y0) + t); return; }
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0 - o, y0 - o, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function dotLine(x0, y0, x1, y1, color, gap, offset) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const g = gap > 1 ? Math.round(gap) : 3;
  let i = Math.round(offset || 0);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  for (;;) {
    if ((((i % g) + g) % g) === 0) ctx.fillRect(x0, y0, 1, 1);
    i++;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// filled annulus via row spans (ri <= 0 gives a filled disc)
function annulus(cx, cy, ro, ri, color) {
  ctx.fillStyle = color;
  const ro2 = ro * ro, ri2 = ri > 0 ? ri * ri : -1;
  const r = Math.ceil(ro);
  const y0 = Math.max(-r, -cy - 2), y1 = Math.min(r, H - cy + 2);
  for (let dy = y0; dy <= y1; dy++) {
    const d = ro2 - dy * dy;
    if (d < 0) continue;
    const xo = Math.floor(Math.sqrt(d));
    const yy = cy + dy;
    if (ri2 > dy * dy) {
      const xi = Math.floor(Math.sqrt(ri2 - dy * dy)) + 1;
      if (xi > xo) continue;
      ctx.fillRect(cx - xo, yy, xo - xi + 1, 1);
      ctx.fillRect(cx + xi, yy, xo - xi + 1, 1);
    } else {
      ctx.fillRect(cx - xo, yy, xo * 2 + 1, 1);
    }
  }
}

function outline(cx, cy, r, color) {
  r = Math.round(r);
  ctx.fillStyle = color;
  if (r <= 0) { ctx.fillRect(cx, cy, 1, 1); return; }
  let x = r, y = 0, err = 1 - r;
  const lo = -2, hx = W + 2, hy = H + 2;
  while (x >= y) {
    const a = cx + x, b = cx - x, c = cx + y, d = cx - y;
    const e = cy + y, f = cy - y, g = cy + x, h = cy - x;
    if (e >= lo && e <= hy) { if (a >= lo && a <= hx) ctx.fillRect(a, e, 1, 1); if (b >= lo && b <= hx) ctx.fillRect(b, e, 1, 1); }
    if (f >= lo && f <= hy) { if (a >= lo && a <= hx) ctx.fillRect(a, f, 1, 1); if (b >= lo && b <= hx) ctx.fillRect(b, f, 1, 1); }
    if (g >= lo && g <= hy) { if (c >= lo && c <= hx) ctx.fillRect(c, g, 1, 1); if (d >= lo && d <= hx) ctx.fillRect(d, g, 1, 1); }
    if (h >= lo && h <= hy) { if (c >= lo && c <= hx) ctx.fillRect(c, h, 1, 1); if (d >= lo && d <= hx) ctx.fillRect(d, h, 1, 1); }
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}

function circle(cx, cy, r, color, fill) {
  cx = Math.round(cx); cy = Math.round(cy);
  if (fill) annulus(cx, cy, r + 0.5, 0, color); else outline(cx, cy, r, color);
}

function ring(cx, cy, r, color, thick) {
  cx = Math.round(cx); cy = Math.round(cy);
  const t = thick === undefined ? 1 : thick;
  if (t <= 1) { outline(cx, cy, r, color); return; }
  annulus(cx, cy, r + t / 2, r - t / 2, color);
}

function clear(color) {
  ctx.fillStyle = color || '#000';
  ctx.fillRect(-64, -64, W + 128, H + 128);
}

function frameRect(x, y, w, h, color, thick) {
  const t = thick || 1;
  rect(x, y, w, t, color);
  rect(x, y + h - t, w, t, color);
  rect(x, y + t, t, h - 2 * t, color);
  rect(x + w - t, y + t, t, h - 2 * t, color);
}

SC.rect = rect; SC.line = line; SC.dotLine = dotLine; SC.circle = circle;
SC.ring = ring; SC.clear = clear; SC.frameRect = frameRect;
SC.noShake = function (fn) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try { fn(); } finally { ctx.restore(); }
};

// ---------------------------------------------------------------- pixel font 5x7
const GLYPH_SRC = {
  'A': '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  'B': '####.|#...#|#...#|####.|#...#|#...#|####.',
  'C': '.###.|#...#|#....|#....|#....|#...#|.###.',
  'D': '####.|#...#|#...#|#...#|#...#|#...#|####.',
  'E': '#####|#....|#....|####.|#....|#....|#####',
  'F': '#####|#....|#....|####.|#....|#....|#....',
  'G': '.###.|#...#|#....|#.###|#...#|#...#|.###.',
  'H': '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  'I': '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  'J': '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  'K': '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  'L': '#....|#....|#....|#....|#....|#....|#####',
  'M': '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  'N': '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  'O': '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  'P': '####.|#...#|#...#|####.|#....|#....|#....',
  'Q': '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  'R': '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  'S': '.####|#....|#....|.###.|....#|....#|####.',
  'T': '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  'U': '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  'V': '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  'W': '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  'X': '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  'Y': '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  'Z': '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '.###.|#...#|....#|..##.|....#|#...#|.###.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '.###.|#....|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
  '.': '.....|.....|.....|.....|.....|.....|..#..',
  ',': '.....|.....|.....|.....|..#..|..#..|.#...',
  ':': '.....|.....|..#..|.....|.....|..#..|.....',
  ';': '.....|.....|..#..|.....|..#..|..#..|.#...',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.',
  ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  "'": '..#..|..#..|.#...|.....|.....|.....|.....',
  '"': '.#.#.|.#.#.|.....|.....|.....|.....|.....',
  '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
  '*': '.....|..#..|#.#.#|.###.|#.#.#|..#..|.....',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.',
  '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
  '=': '.....|.....|#####|.....|#####|.....|.....',
  '_': '.....|.....|.....|.....|.....|.....|#####',
  '[': '.###.|.#...|.#...|.#...|.#...|.#...|.###.',
  ']': '.###.|...#.|...#.|...#.|...#.|...#.|.###.',
  '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#'
};
const GLYPH_CHARS = Object.keys(GLYPH_SRC);
const GLYPH_IDX = Object.create(null);
for (let i = 0; i < GLYPH_CHARS.length; i++) GLYPH_IDX[GLYPH_CHARS[i]] = i;
for (let i = 0; i < 26; i++) {
  const u = String.fromCharCode(65 + i);
  GLYPH_IDX[u.toLowerCase()] = GLYPH_IDX[u];
}
const QMARK = GLYPH_IDX['?'];
const FONT_ATLAS_W = GLYPH_CHARS.length * 5;
let fontWhite = null;
const fontTinted = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function getFontAtlas(color) {
  if (!fontWhite) {
    fontWhite = makeCanvas(FONT_ATLAS_W, 7);
    const g = fontWhite.getContext('2d');
    g.fillStyle = '#fff';
    for (let i = 0; i < GLYPH_CHARS.length; i++) {
      const rows = GLYPH_SRC[GLYPH_CHARS[i]].split('|');
      for (let y = 0; y < 7; y++) {
        const row = rows[y];
        for (let x = 0; x < 5; x++) if (row.charAt(x) === '#') g.fillRect(i * 5 + x, y, 1, 1);
      }
    }
  }
  if (color === '#fff' || color === '#ffffff' || color === 'white') return fontWhite;
  let a = fontTinted.get(color);
  if (!a) {
    if (fontTinted.size > 96) fontTinted.clear();
    a = makeCanvas(FONT_ATLAS_W, 7);
    const g = a.getContext('2d');
    g.drawImage(fontWhite, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, FONT_ATLAS_W, 7);
    fontTinted.set(color, a);
  }
  return a;
}

function lineWidth(str, s) { return str.length > 0 ? str.length * 6 * s - s : 0; }

function textWidth(str, scale) {
  const s = scale || 1;
  str = String(str);
  let best = 0;
  if (str.indexOf('\n') < 0) return lineWidth(str, s);
  const lines = str.split('\n');
  for (let i = 0; i < lines.length; i++) { const w = lineWidth(lines[i], s); if (w > best) best = w; }
  return best;
}

function textPass(str, x, y, atlas, s, align, wave) {
  const lines = str.indexOf('\n') < 0 ? [str] : str.split('\n');
  const tm = SC.time * 8;
  for (let li = 0; li < lines.length; li++) {
    const ln = lines[li];
    const lw = lineWidth(ln, s);
    let px = x;
    if (align === 'center') px = x - (lw >> 1);
    else if (align === 'right') px = x - lw;
    const py = y + li * 9 * s;
    for (let i = 0; i < ln.length; i++) {
      const ch = ln.charAt(i);
      if (ch === ' ') continue;
      let gi = GLYPH_IDX[ch];
      if (gi === undefined) gi = QMARK;
      const yo = wave ? Math.round(Math.sin(tm + i * 0.7) * wave) : 0;
      ctx.drawImage(atlas, gi * 5, 0, 5, 7, px + i * 6 * s, py + yo, 5 * s, 7 * s);
    }
  }
}

function text(str, x, y, o) {
  str = String(str);
  if (str.length === 0) return;
  const s = (o && o.scale) || 1;
  const color = (o && o.color) || '#fff';
  const align = (o && o.align) || 'left';
  const shadow = (o && o.shadow !== undefined) ? o.shadow : '#000';
  const wave = (o && o.wave) || 0;
  const alpha = (o && o.alpha !== undefined) ? o.alpha : 1;
  if (alpha <= 0) return;
  x = Math.round(x); y = Math.round(y);
  const prev = ctx.globalAlpha;
  if (alpha < 1) ctx.globalAlpha = prev * alpha;
  // big text: drop the shadow straight down (1 scaled pixel) so it never fills the gaps between strokes and letters
  if (shadow) textPass(str, s >= 3 ? x : x + s, y + s, getFontAtlas(shadow), s, align, wave);
  textPass(str, x, y, getFontAtlas(color), s, align, wave);
  if (alpha < 1) ctx.globalAlpha = prev;
}

SC.text = text; SC.textWidth = textWidth;

// ---------------------------------------------------------------- sprites
const sprites = Object.create(null);
const warned = Object.create(null);
const tmpPix = document.createElement('canvas');

function parseColor(c) {
  if (typeof c === 'string' && c.charAt(0) === '#') {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = h.replace(/./g, '$&$&');
    if (h.length === 6) h += 'ff';
    if (h.length === 8) {
      const n = parseInt(h, 16);
      if (!isNaN(n)) return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    }
  }
  tmpPix.width = 1; tmpPix.height = 1;
  const g = tmpPix.getContext('2d');
  g.clearRect(0, 0, 1, 1);
  g.fillStyle = c;
  g.fillRect(0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

function spriteDefine(name, frames, colors, opts) {
  const w = frames[0][0].length, h = frames[0].length;
  const pal = Object.create(null);
  for (const k in colors) if (k !== '.') pal[k] = parseColor(colors[k]);
  const fr = [];
  for (let f = 0; f < frames.length; f++) {
    const rows = frames[f];
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const id = g.createImageData(w, h);
    const d = id.data;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = rows[y] || '';
      for (let x = 0; x < w; x++) {
        const col = pal[row.charAt(x)];
        if (col && col[3] > 0) {
          const i = y * w + x, o = i * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3];
          mask[i] = 1;
        }
      }
    }
    g.putImageData(id, 0, 0);
    const cf = makeCanvas(w, h);
    const gf = cf.getContext('2d');
    gf.translate(w, 0); gf.scale(-1, 1);
    gf.drawImage(c, 0, 0);
    fr.push({ c: c, cf: cf, mask: mask, sil: null });
  }
  const an = (opts && opts.anchor) || null;
  const anchor = { x: an ? Math.round(an.x) : 0, y: an ? Math.round(an.y) : 0 };
  const info = { w: w, h: h, count: frames.length, anchor: anchor };
  sprites[name] = { w: w, h: h, count: frames.length, ax: anchor.x, ay: anchor.y, fr: fr, info: info, spin: !!(opts && opts.spin) };
  return info;
}

function frameIndex(frame, count) {
  let f = Math.floor(frame);
  if (f !== f) f = 0;
  f %= count;
  if (f < 0) f += count;
  return f;
}

function silhouette(fr, key, color, flip, w, h) {
  if (!fr.sil) fr.sil = Object.create(null);
  let s = fr.sil[key];
  if (!s) {
    const mk = function (src) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color;
      g.fillRect(0, 0, w, h);
      return c;
    };
    s = { c: mk(fr.c), cf: mk(fr.cf) };
    fr.sil[key] = s;
  }
  return flip ? s.cf : s.c;
}

function spriteDraw(name, frame, x, y, o) {
  const s = sprites[name];
  if (s && s.spin) {
    // spinning meme cat: rotate the whole sprite about its centre
    const cx = Math.round(x) - s.ax + s.w / 2, cy = Math.round(y) - s.ay + s.h / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((SC.frame || 0) * 0.32); ctx.translate(-cx, -cy);
    spriteDraw2(name, frame, x, y, o);
    ctx.restore();
    return;
  }
  spriteDraw2(name, frame, x, y, o);
}
function spriteDraw2(name, frame, x, y, o) {
  const s = sprites[name];
  if (!s) {
    if (!warned[name]) { warned[name] = true; if (window.console) console.warn('missing sprite: ' + name); }
    return;
  }
  const fr = s.fr[frameIndex(frame, s.count)];
  const dx = Math.round(x) - s.ax, dy = Math.round(y) - s.ay;
  if (!o) { ctx.drawImage(fr.c, dx, dy); return; }
  let img;
  if (o.white) img = silhouette(fr, 'w', '#fff', !!o.flip, s.w, s.h);
  else if (o.tint) img = silhouette(fr, 't' + o.tint, o.tint, !!o.flip, s.w, s.h);
  else img = o.flip ? fr.cf : fr.c;
  const a = o.alpha;
  if (a !== undefined && a < 1) {
    if (a <= 0) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * a;
    ctx.drawImage(img, dx, dy);
    ctx.globalAlpha = prev;
  } else {
    ctx.drawImage(img, dx, dy);
  }
}

SC.sprite = {
  define: spriteDefine,
  get: function (name) { const s = sprites[name]; return s ? s.info : undefined; },
  has: function (name) { return !!sprites[name]; },
  draw: spriteDraw
};

// ---------------------------------------------------------------- collision
function refInfo(ref) {
  const s = sprites[ref.name];
  if (!s) return null;
  return s;
}

function collide(a, b) {
  const sa = refInfo(a), sb = refInfo(b);
  if (!sa || !sb) return false;
  const ax = Math.round(a.x) - sa.ax, ay = Math.round(a.y) - sa.ay;
  const bx = Math.round(b.x) - sb.ax, by = Math.round(b.y) - sb.ay;
  const x0 = Math.max(ax, bx), x1 = Math.min(ax + sa.w, bx + sb.w);
  if (x0 >= x1) return false;
  const y0 = Math.max(ay, by), y1 = Math.min(ay + sa.h, by + sb.h);
  if (y0 >= y1) return false;
  const ma = sa.fr[frameIndex(a.frame || 0, sa.count)].mask;
  const mb = sb.fr[frameIndex(b.frame || 0, sb.count)].mask;
  const fa = !!a.flip, fb = !!b.flip;
  for (let y = y0; y < y1; y++) {
    const ra = (y - ay) * sa.w, rb = (y - by) * sb.w;
    for (let x = x0; x < x1; x++) {
      const ca = fa ? sa.w - 1 - (x - ax) : x - ax;
      if (!ma[ra + ca]) continue;
      const cb = fb ? sb.w - 1 - (x - bx) : x - bx;
      if (mb[rb + cb]) return true;
    }
  }
  return false;
}

function collideRect(ref, r) {
  const s = refInfo(ref);
  if (!s) return false;
  const sx = Math.round(ref.x) - s.ax, sy = Math.round(ref.y) - s.ay;
  const x0 = Math.max(sx, Math.round(r.x)), x1 = Math.min(sx + s.w, Math.round(r.x + r.w));
  if (x0 >= x1) return false;
  const y0 = Math.max(sy, Math.round(r.y)), y1 = Math.min(sy + s.h, Math.round(r.y + r.h));
  if (y0 >= y1) return false;
  const m = s.fr[frameIndex(ref.frame || 0, s.count)].mask;
  const fl = !!ref.flip;
  for (let y = y0; y < y1; y++) {
    const row = (y - sy) * s.w;
    for (let x = x0; x < x1; x++) {
      if (m[row + (fl ? s.w - 1 - (x - sx) : x - sx)]) return true;
    }
  }
  return false;
}

function collidePoint(ref, px, py) {
  const s = refInfo(ref);
  if (!s) return false;
  const sx = Math.round(ref.x) - s.ax, sy = Math.round(ref.y) - s.ay;
  const x = Math.floor(px) - sx, y = Math.floor(py) - sy;
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  const m = s.fr[frameIndex(ref.frame || 0, s.count)].mask;
  return m[y * s.w + (ref.flip ? s.w - 1 - x : x)] === 1;
}

function collideCircle(ref, cx, cy, r) {
  const s = refInfo(ref);
  if (!s) return false;
  const sx = Math.round(ref.x) - s.ax, sy = Math.round(ref.y) - s.ay;
  const x0 = Math.max(sx, Math.floor(cx - r)), x1 = Math.min(sx + s.w, Math.ceil(cx + r));
  if (x0 >= x1) return false;
  const y0 = Math.max(sy, Math.floor(cy - r)), y1 = Math.min(sy + s.h, Math.ceil(cy + r));
  if (y0 >= y1) return false;
  const m = s.fr[frameIndex(ref.frame || 0, s.count)].mask;
  const fl = !!ref.flip, r2 = r * r;
  for (let y = y0; y < y1; y++) {
    const row = (y - sy) * s.w;
    const dy = y + 0.5 - cy;
    for (let x = x0; x < x1; x++) {
      if (!m[row + (fl ? s.w - 1 - (x - sx) : x - sx)]) continue;
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= r2) return true;
    }
  }
  return false;
}

SC.collide = collide; SC.collideRect = collideRect;
SC.collidePoint = collidePoint; SC.collideCircle = collideCircle;

// ---------------------------------------------------------------- input
const ACTIONS = ['left', 'right', 'up', 'down', 'dash', 'parry', 'fire', 'pause', 'confirm', 'back', 'retry'];
const DEFAULTS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  dash: ['Space'], parry: ['KeyE', 'KeyK'], fire: ['KeyF', 'KeyJ'],
  pause: ['Escape', 'KeyP'], confirm: ['Enter', 'Space'],
  back: ['Escape', 'Backspace'], retry: ['KeyR']
};
const GAMEPLAY = ['left', 'right', 'up', 'down', 'dash', 'parry', 'fire'];
function cloneDefaults() {
  const o = {};
  for (let i = 0; i < ACTIONS.length; i++) { const d = DEFAULTS[ACTIONS[i]]; o[ACTIONS[i]] = [d[0] || null, d[1] || null]; }
  return o;
}
// bindings: action -> [codeOrNull, codeOrNull]; stored as array of up to 2 codes (nulls dropped on read)
const KEYMAP = cloneDefaults();
let CODE_ACT = Object.create(null);
function rebuildCodeAct() {
  CODE_ACT = Object.create(null);
  for (let i = 0; i < ACTIONS.length; i++) {
    const a = ACTIONS[i], cs = KEYMAP[a];
    for (let j = 0; j < cs.length; j++) if (cs[j]) (CODE_ACT[cs[j]] = CODE_ACT[cs[j]] || []).push(a);
  }
}
function loadBindings() {
  let saved = null;
  try { saved = SC.store.get('keys', null); } catch (e) { saved = null; }
  if (!saved || typeof saved !== 'object') return;
  for (let i = 0; i < ACTIONS.length; i++) {
    const a = ACTIONS[i], v = saved[a];
    if (!Array.isArray(v)) continue;
    const out = [];
    for (let j = 0; j < 2; j++) {
      const c = v[j];
      out.push(typeof c === 'string' && c.length > 0 && c.length < 24 ? c : null);
    }
    KEYMAP[a] = out;
  }
}
function saveBindings() {
  const o = {};
  for (let i = 0; i < ACTIONS.length; i++) o[ACTIONS[i]] = KEYMAP[ACTIONS[i]].slice(0, 2);
  SC.store.set('keys', o);
}
const held = Object.create(null);
const aDown = {}, aPressed = {}, aReleased = {}, aVirt = {};
const vPend = {}, vPendR = {}, dSeenP = {}, dSeenR = {};
for (let i = 0; i < ACTIONS.length; i++) {
  const a = ACTIONS[i];
  aDown[a] = false; aPressed[a] = false; aReleased[a] = false; aVirt[a] = false;
  vPend[a] = false; vPendR[a] = false; dSeenP[a] = false; dSeenR[a] = false;
}
let anyKeyF = false, anySeenD = false;
let stickX = 0, stickY = 0;
// Edge visibility: a press is a latch set by events; it stays until a real update step has run.
// mode 0 = outside the loop (events / harness), 1 = inside update, 2 = inside draw.
// Only the first update step of a frame sees the edge; draw sees it once (even across frames with no update).
let mode = 0, updHide = false;
function vis(latch, seenD) {
  if (!latch) return false;
  if (mode === 2) return !seenD;
  if (mode === 1) return !updHide;
  return true;
}

function refresh(a) {
  let d = !!aVirt[a];
  if (!d) {
    const cs = KEYMAP[a];
    for (let i = 0; i < cs.length; i++) if (cs[i] && held[cs[i]]) { d = true; break; }
  }
  if (d !== aDown[a]) {
    aDown[a] = d;
    if (d) aPressed[a] = true; else aReleased[a] = true;
  }
}

function unlockAudio() {
  try { if (SC.audio && SC.audio.unlock) SC.audio.unlock(); } catch (e) { /* ignore */ }
}

const pointer = { x: 0, y: 0, down: false, pressed: false, released: false, active: false };
const ptr = { pr: false, rl: false, prSeen: false, rlSeen: false };
const touches = [];
const KEYNAMES = {
  Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER', NumpadEnter: 'ENTER', Backspace: 'BKSP', Delete: 'DEL', Tab: 'TAB',
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT', ControlLeft: 'LCTRL', ControlRight: 'RCTRL',
  AltLeft: 'LALT', AltRight: 'RALT', CapsLock: 'CAPS', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Backslash: 'BSLASH', Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
  Slash: '/', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN', Insert: 'INS',
  NumpadAdd: 'NUM+', NumpadSubtract: 'NUM-', NumpadMultiply: 'NUM*', NumpadDivide: 'NUM/', NumpadDecimal: 'NUM.'
};
let capCb = null;
const input = {
  pointer: pointer, touches: touches, isTouch: false, lastDevice: 'key',
  down: function (a) { return aDown[a] === true; },
  pressed: function (a) { return aPressed[a] === true && vis(true, dSeenP[a]); },
  released: function (a) { return aReleased[a] === true && vis(true, dSeenR[a]); },
  move: function () {
    let x = (aDown.right ? 1 : 0) - (aDown.left ? 1 : 0) + stickX;
    let y = (aDown.down ? 1 : 0) - (aDown.up ? 1 : 0) + stickY;
    const l = Math.sqrt(x * x + y * y);
    if (l > 1) { x /= l; y /= l; }
    return { x: x, y: y };
  },
  setVirtual: function (a, isDown) {
    if (aVirt[a] === undefined) return;
    isDown = !!isDown;
    // presses made outside update (draw / events) must survive the end-of-frame clear exactly once
    if (mode !== 1) {
      if (isDown && !aDown[a]) vPend[a] = true;
      else if (!isDown && aDown[a]) vPendR[a] = true;
    }
    aVirt[a] = isDown;
    refresh(a);
  },
  setStick: function (x, y) {
    stickX = clamp(+x || 0, -1, 1); stickY = clamp(+y || 0, -1, 1);
  },
  anyPressed: function () { return (anyKeyF && vis(true, anySeenD)) || pointer.pressed; },
  DEFAULTS: DEFAULTS,
  bindings: KEYMAP,
  capturing: false,
  setBinding: function (action, slot, code) {
    if (!KEYMAP[action]) return null;
    slot = slot ? 1 : 0;
    let moved = null;
    if (code) {
      if (GAMEPLAY.indexOf(action) >= 0) {
        for (let i = 0; i < GAMEPLAY.length; i++) {
          const o = GAMEPLAY[i], cs = KEYMAP[o];
          for (let j = 0; j < 2; j++) {
            if (cs[j] === code && !(o === action && j === slot)) { cs[j] = null; if (o !== action) moved = o; }
          }
        }
      } else {
        const cs = KEYMAP[action];
        if (cs[1 - slot] === code) cs[1 - slot] = null;
      }
    }
    KEYMAP[action][slot] = code || null;
    afterBindingChange();
    return moved;
  },
  resetBindings: function () {
    const d = cloneDefaults();
    for (let i = 0; i < ACTIONS.length; i++) KEYMAP[ACTIONS[i]] = d[ACTIONS[i]];
    afterBindingChange();
  },
  keyName: function (code) {
    if (!code) return '';
    if (KEYNAMES[code]) return KEYNAMES[code];
    let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
    m = /^Digit(\d)$/.exec(code); if (m) return m[1];
    m = /^Numpad(\d)$/.exec(code); if (m) return 'NUM' + m[1];
    m = /^F(\d{1,2})$/.exec(code); if (m) return code;
    return String(code).toUpperCase().slice(0, 6);
  },
  wheel: 0,
  takeWheel: function () { const w = input.wheel; input.wheel = 0; return w; },
  captureKey: function (cb) {
    capCb = typeof cb === 'function' ? cb : null;
    input.capturing = !!capCb;
  }
};
SC.input = input;
// KEYMAP arrays are replaced on reset, so keep input.bindings pointing at the live object
function afterBindingChange() {
  rebuildCodeAct();
  for (let i = 0; i < ACTIONS.length; i++) refresh(ACTIONS[i]);
  saveBindings();
}
loadBindings();
rebuildCodeAct();

function applyMode(m, hide) {
  mode = m; updHide = !!hide;
  pointer.pressed = vis(ptr.pr, ptr.prSeen);
  pointer.released = vis(ptr.rl, ptr.rlSeen);
  for (let i = 0; i < touches.length; i++) touches[i].pressed = vis(touches[i]._pr, touches[i]._ds);
}

// ---------------------------------------------------------------- fullscreen
(function () {
  const root = document.documentElement;
  let declined = false, ours = false, tries = 0, wasActive = false;
  const fsEl = function () { return document.fullscreenElement || document.webkitFullscreenElement || null; };
  function request() {
    try {
      const f = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!f) return false;
      const r = f.call(root);
      if (r && r.catch) r.catch(function () { /* ignore */ });
      return true;
    } catch (e) { return false; }
  }
  function exit() {
    try {
      const f = document.exitFullscreen || document.webkitExitFullscreen;
      if (f && fsEl()) { ours = true; const r = f.call(document); if (r && r.catch) r.catch(function () { ours = false; }); }
    } catch (e) { ours = false; }
  }
  const api = {
    get active() { return !!fsEl(); },
    set: function (on) {
      on = !!on;
      SC.store.set('fullscreen', on);
      declined = false; tries = 0;
      if (on) request(); else exit();
    },
    toggle: function () { api.set(!api.active); },
    // called on every user gesture
    gesture: function () {
      if (declined || tries >= 3 || fsEl()) return;
      if (SC.store.get('fullscreen', true) === false) return;
      tries++;
      request();
    }
  };
  function onChange() {
    const a = !!fsEl();
    if (wasActive && !a) { if (!ours) declined = true; ours = false; }
    wasActive = a;
    layout();
  }
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  SC.fullscreen = api;
})();

// ---------------------------------------------------------------- text entry (names)
const textIn = {
  active: false, value: '', max: 12, cb: null,
  start: function (maxLen, cb, initial) {
    textIn.active = true; textIn.max = maxLen || 12; textIn.cb = typeof cb === 'function' ? cb : null;
    textIn.value = String(initial || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, textIn.max);
  },
  stop: function () { textIn.active = false; textIn.cb = null; },
  type: function (ch) {
    if (!textIn.active) return;
    ch = String(ch).toUpperCase();
    if (!/^[A-Z0-9 _-]$/.test(ch) || textIn.value.length >= textIn.max) return;
    textIn.value += ch; fire(false);
  },
  backspace: function () {
    if (!textIn.active || !textIn.value) return;
    textIn.value = textIn.value.slice(0, -1); fire(false);
  },
  enter: function () { if (textIn.active) fire(true); },
  cancel: function () { const cb = textIn.cb; textIn.stop(); if (cb) cb(null, true); }
};
function fire(done) { const cb = textIn.cb; if (cb) cb(textIn.value, done); }
input.text = textIn;

const PREVENT = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Space: 1, Backspace: 1, Escape: 1, Enter: 1, Tab: 1 };

window.addEventListener('keydown', function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const code = e.code || e.key;
  if (textIn.active && !capCb) {
    e.preventDefault();
    unlockAudio();
    if (code === 'Escape') { if (!e.repeat) textIn.cancel(); return; }
    if (code === 'Enter' || code === 'NumpadEnter') { if (!e.repeat) textIn.enter(); return; }
    if (code === 'Backspace') { textIn.backspace(); return; }
    if (e.key && e.key.length === 1) textIn.type(e.key);
    return;
  }
  if (capCb) {
    e.preventDefault();
    if (e.repeat) return;
    const cb = capCb; capCb = null; input.capturing = false;
    held[code] = false;
    cb(code === 'Escape' ? null : code);
    return;
  }
  input.lastDevice = 'key';
  if (PREVENT[code] || CODE_ACT[code]) e.preventDefault();
  if (e.repeat) return;
  unlockAudio();
  SC.fullscreen.gesture();
  anyKeyF = true; anySeenD = false;
  if (!held[code]) {
    held[code] = true;
    const acts = CODE_ACT[code];
    if (acts) for (let i = 0; i < acts.length; i++) refresh(acts[i]);
  }
});
window.addEventListener('keyup', function (e) {
  const code = e.code || e.key;
  if (PREVENT[code] || CODE_ACT[code]) e.preventDefault();
  if (held[code]) {
    held[code] = false;
    const acts = CODE_ACT[code];
    if (acts) for (let i = 0; i < acts.length; i++) refresh(acts[i]);
  }
});

function releaseAll() {
  for (const k in held) held[k] = false;
  for (let i = 0; i < ACTIONS.length; i++) { aVirt[ACTIONS[i]] = false; refresh(ACTIONS[i]); }
  for (let i = 0; i < touches.length; i++) touches[i].released = true;
  if (pointer.down) { pointer.down = false; pointer.released = true; ptr.rl = true; ptr.rlSeen = false; }
  stickX = 0; stickY = 0;
}
window.addEventListener('wheel', function (ev) { input.wheel += ev.deltaY; }, { passive: true });
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });

let primaryId = -1;
function toWorld(e, out) {
  const r = canvas.getBoundingClientRect();
  const w = r.width || W, h = r.height || H;
  out.x = (e.clientX - r.left) * W / w;
  out.y = (e.clientY - r.top) * H / h;
}
const _p = { x: 0, y: 0 };

function findTouch(id) {
  for (let i = 0; i < touches.length; i++) if (touches[i].id === id && !touches[i].released) return touches[i];
  return null;
}
function liveTouches() {
  let n = 0;
  for (let i = 0; i < touches.length; i++) if (!touches[i].released) n++;
  return n;
}

window.addEventListener('pointerdown', function (e) {
  toWorld(e, _p);
  unlockAudio();
  if (e.pointerType === 'mouse') SC.fullscreen.gesture();
  try { window.focus(); } catch (err) { /* ignore */ }
  if (e.pointerType === 'touch') {
    input.isTouch = true; input.lastDevice = 'touch';
    if (findTouch(e.pointerId)) return;
    touches.push({ id: e.pointerId, x: _p.x, y: _p.y, startX: _p.x, startY: _p.y, pressed: true, released: false, _pr: true, _ds: false });
    primaryId = e.pointerId;
    pointer.x = _p.x; pointer.y = _p.y;
    pointer.down = true; pointer.pressed = true; pointer.active = true;
    ptr.pr = true; ptr.prSeen = false;
  } else {
    if (e.button !== 0) return;
    input.lastDevice = 'pointer';
    pointer.x = _p.x; pointer.y = _p.y;
    pointer.down = true; pointer.pressed = true; pointer.active = true;
    ptr.pr = true; ptr.prSeen = false;
  }
  if (e.cancelable && e.target === canvas) e.preventDefault();
});

window.addEventListener('pointermove', function (e) {
  toWorld(e, _p);
  if (e.pointerType === 'touch') {
    const t = findTouch(e.pointerId);
    if (!t) return;
    t.x = _p.x; t.y = _p.y;
    if (e.pointerId === primaryId) { pointer.x = _p.x; pointer.y = _p.y; }
  } else {
    input.lastDevice = 'pointer';
    pointer.x = _p.x; pointer.y = _p.y; pointer.active = true;
  }
});

function pointerEnd(e) {
  toWorld(e, _p);
  if (e.pointerType === 'touch') {
    const t = findTouch(e.pointerId);
    if (!t) return;
    t.x = _p.x; t.y = _p.y; t.released = true;
    if (e.pointerId === primaryId) {
      pointer.x = _p.x; pointer.y = _p.y; pointer.released = true; ptr.rl = true; ptr.rlSeen = false;
      primaryId = -1;
      for (let i = touches.length - 1; i >= 0; i--) if (!touches[i].released) { primaryId = touches[i].id; break; }
    }
    pointer.down = liveTouches() > 0;
  } else {
    if (e.button !== 0 && e.type !== 'pointercancel') return;
    pointer.x = _p.x; pointer.y = _p.y;
    if (pointer.down) { pointer.down = false; pointer.released = true; ptr.rl = true; ptr.rlSeen = false; }
  }
}
window.addEventListener('pointerup', function (e) { pointerEnd(e); unlockAudio(); SC.fullscreen.gesture(); });
window.addEventListener('pointercancel', pointerEnd);
document.documentElement.addEventListener('pointerleave', function (e) {
  if (e.pointerType !== 'touch') pointer.active = false;
});

function markDrawSeen() {
  for (let i = 0; i < ACTIONS.length; i++) {
    const a = ACTIONS[i];
    if (aPressed[a]) dSeenP[a] = true;
    if (aReleased[a]) dSeenR[a] = true;
  }
  if (anyKeyF) anySeenD = true;
  if (ptr.pr) ptr.prSeen = true;
  if (ptr.rl) ptr.rlSeen = true;
  for (let i = 0; i < touches.length; i++) if (touches[i]._pr) touches[i]._ds = true;
}

// Called after a frame in which at least one real update ran: every edge has now been seen by an update.
// Edges raised during draw (vPend) are re-applied so the next first update sees them exactly once.
function endInputFrame() {
  for (let i = 0; i < ACTIONS.length; i++) {
    const a = ACTIONS[i];
    aPressed[a] = vPend[a]; aReleased[a] = vPendR[a];
    dSeenP[a] = false; dSeenR[a] = false;
  }
  anyKeyF = false; anySeenD = false;
  ptr.pr = false; ptr.rl = false; ptr.prSeen = false; ptr.rlSeen = false;
  for (let i = touches.length - 1; i >= 0; i--) {
    if (touches[i].released) touches.splice(i, 1);
    else { touches[i]._pr = false; touches[i]._ds = false; }
  }
  if (touches.length === 0 && input.lastDevice === 'touch') { pointer.active = false; pointer.down = false; }
  applyMode(0, false);
}

// draw-time edges were consumed by the first update step of the next frame
function clearPending() {
  for (let i = 0; i < ACTIONS.length; i++) { vPend[ACTIONS[i]] = false; vPendR[ACTIONS[i]] = false; }
}

// ---------------------------------------------------------------- fx
const WHITE_COLS = ['#fff'];
const PN = 1500, DN = 300, RN = 48, TN = 32;
const parts = [], deb = [], rings = [], pops = [];
for (let i = 0; i < PN; i++) parts.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, g: 0, drag: 0.92, color: '#fff' });
for (let i = 0; i < DN; i++) deb.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, s: 2, rest: false, color: '#fff' });
for (let i = 0; i < RN; i++) rings.push({ x: 0, y: 0, t: 0, life: 0, r0: 4, r1: 40, thick: 2, color: '#fff' });
for (let i = 0; i < TN; i++) pops.push({ str: '', x: 0, y: 0, vy: 0, t: 0, life: 0, color: '#fff', scale: 1 });
let pHead = 0, dHead = 0, rHead = 0, tHead = 0;
let flashColor = '#fff', flashT = 0, flashMax = 1, flashAlpha = 0.6;
let shakeAmp = 0, shakeT = 0, shakeMax = 1;

function calcShake() {
  if (shakeT > 0) {
    const a = shakeAmp * (shakeT / shakeMax);
    fx.shakeX = Math.round((Math.random() * 2 - 1) * a);
    fx.shakeY = Math.round((Math.random() * 2 - 1) * a);
  } else { fx.shakeX = 0; fx.shakeY = 0; }
}

const fx = {
  hitstop: 0, shakeX: 0, shakeY: 0,
  burst: function (x, y, o) {
    o = o || {};
    const n = o.n === undefined ? 10 : o.n;
    const cols = o.colors || WHITE_COLS;
    const speed = o.speed === undefined ? 2 : o.speed;
    const life = o.life === undefined ? 24 : o.life;
    const grav = o.gravity || 0;
    const size = o.size === undefined ? 2 : o.size;
    const drag = o.drag === undefined ? 0.92 : o.drag;
    const spread = o.spread === undefined ? Math.PI * 2 : o.spread;
    const ang = o.angle || 0;
    for (let i = 0; i < n; i++) {
      const p = parts[pHead]; pHead = (pHead + 1) % PN;
      const a = ang + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + 0.65 * Math.random());
      p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      p.life = p.max = life * (0.7 + 0.3 * Math.random());
      p.size = size; p.g = grav; p.drag = drag;
      p.color = cols[(Math.random() * cols.length) | 0];
    }
  },
  debris: function (x, y, o) {
    o = o || {};
    const n = o.n === undefined ? 8 : o.n;
    const cols = o.colors || WHITE_COLS;
    const speed = o.speed === undefined ? 3 : o.speed;
    const life = o.life === undefined ? 80 : o.life;
    for (let i = 0; i < n; i++) {
      const d = deb[dHead]; dHead = (dHead + 1) % DN;
      const a = -Math.random() * Math.PI;
      const v = speed * (0.4 + 0.6 * Math.random());
      d.x = x; d.y = y; d.vx = Math.cos(a) * v; d.vy = Math.sin(a) * v - 1;
      d.life = life * (0.75 + 0.25 * Math.random());
      d.s = o.size || (2 + ((Math.random() * 3) | 0));
      d.rest = false;
      d.color = cols[(Math.random() * cols.length) | 0];
    }
  },
  ring: function (x, y, o) {
    o = o || {};
    const r = rings[rHead]; rHead = (rHead + 1) % RN;
    r.x = x; r.y = y; r.t = 0;
    r.life = o.life || 18; r.r0 = o.r0 === undefined ? 4 : o.r0; r.r1 = o.r1 === undefined ? 40 : o.r1;
    r.thick = o.thick || 2; r.color = o.color || '#fff';
  },
  popup: function (str, x, y, o) {
    o = o || {};
    const p = pops[tHead]; tHead = (tHead + 1) % TN;
    p.str = String(str); p.x = x; p.y = y; p.vy = -0.9; p.t = 0;
    p.life = o.life || 40; p.color = o.color || '#fff'; p.scale = o.scale || 1;
  },
  shake: function (px, frames) {
    if (SC.store.get('shake', true) === false) return;
    const remaining = shakeT > 0 ? shakeAmp * (shakeT / shakeMax) : 0;
    if (px >= remaining) { shakeAmp = px; shakeT = shakeMax = Math.max(1, frames || 10); }
    calcShake();
  },
  freeze: function (frames) { if (frames > this.hitstop) this.hitstop = frames; },
  flash: function (color, frames, alpha) {
    flashColor = color || '#fff'; flashT = flashMax = Math.max(1, frames || 6);
    flashAlpha = alpha === undefined ? 0.6 : alpha;
  },
  update: function () {
    const dt = SC.dt;
    const gy = SC.groundY || 236;
    for (let i = 0; i < PN; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      const f = 1 - (1 - p.drag) * dt;
      p.vx *= f; p.vy = p.vy * f + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = 0; i < DN; i++) {
      const d = deb[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) continue;
      if (d.rest) continue;
      d.vy += 0.28 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      const g = gy - d.s;
      if (d.y >= g) {
        d.y = g;
        if (Math.abs(d.vy) > 1.2) { d.vy = -d.vy * 0.45; d.vx *= 0.7; }
        else { d.vy = 0; d.vx *= 0.8; if (Math.abs(d.vx) < 0.05) d.rest = true; }
      }
    }
    for (let i = 0; i < RN; i++) {
      const r = rings[i];
      if (r.life > 0) { r.t += dt; if (r.t >= r.life) r.life = 0; }
    }
    for (let i = 0; i < TN; i++) {
      const p = pops[i];
      if (p.life > 0) {
        p.t += dt; p.y += p.vy * dt; p.vy *= 1 - 0.06 * dt;
        if (p.t >= p.life) p.life = 0;
      }
    }
    if (flashT > 0) flashT -= dt;
    if (shakeT > 0) shakeT -= dt;
    calcShake();
  },
  draw: function () {
    for (let i = 0; i < RN; i++) {
      const r = rings[i];
      if (r.life <= 0) continue;
      const k = r.t / r.life;
      const rad = r.r0 + (r.r1 - r.r0) * SC.ease.outCubic(k);
      const th = Math.max(1, Math.round(r.thick * (1 - k * 0.75)));
      ring(r.x, r.y, rad, r.color, th);
    }
    for (let i = 0; i < DN; i++) {
      const d = deb[i];
      if (d.life <= 0) continue;
      if (d.life < 20 && (Math.floor(d.life) & 2)) continue;
      rect(d.x, d.y, d.s, d.s, d.color);
    }
    for (let i = 0; i < PN; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      const s = (p.life < p.max * 0.25 && p.size > 1) ? Math.max(1, p.size >> 1) : p.size;
      rect(p.x, p.y, s, s, p.color);
    }
    for (let i = 0; i < TN; i++) {
      const p = pops[i];
      if (p.life <= 0) continue;
      const k = p.t / p.life;
      text(p.str, p.x, p.y, { color: p.color, scale: p.scale, align: 'center', alpha: k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1 });
    }
  },
  drawFlash: function () {
    if (flashT <= 0) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = flashAlpha * Math.min(1, flashT / flashMax);
    ctx.fillStyle = flashColor;
    ctx.fillRect(-64, -64, W + 128, H + 128);
    ctx.globalAlpha = prev;
  },
  clear: function () {
    for (let i = 0; i < PN; i++) parts[i].life = 0;
    for (let i = 0; i < DN; i++) deb[i].life = 0;
    for (let i = 0; i < RN; i++) rings[i].life = 0;
    for (let i = 0; i < TN; i++) pops[i].life = 0;
    flashT = 0; shakeT = 0; shakeAmp = 0;
    this.hitstop = 0; this.shakeX = 0; this.shakeY = 0;
  }
};
SC.fx = fx;

// ---------------------------------------------------------------- scenes + transition
const scenes = Object.create(null);
let cur = null;
let trans = null;
let ditherPat = null;

SC.scene = function (name, def) { scenes[name] = def; };
SC.hasScene = function (name) { return !!scenes[name]; };

function swapScene(name, params) {
  if (cur && cur.exit) { try { cur.exit(); } catch (e) { logErr(e); } }
  cur = scenes[name];
  SC.current = name;
  if (cur && cur.enter) { try { cur.enter(params || {}); } catch (e) { logErr(e); } }
}

SC.go = function (name, params, opts) {
  if (!scenes[name]) { if (window.console) console.warn('unknown scene: ' + name); return; }
  if (!cur || (opts && opts.instant)) { swapScene(name, params); trans = null; return; }
  if (trans && trans.phase === 0) { trans.name = name; trans.params = params; return; }
  trans = { t: 0, phase: 0, name: name, params: params };
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function buildDither() {
  ditherPat = [];
  for (let lv = 0; lv <= 16; lv++) {
    if (lv === 0 || lv === 16) { ditherPat.push(null); continue; }
    const c = makeCanvas(8, 8);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (BAYER[((y >> 1) & 3) * 4 + ((x >> 1) & 3)] < lv) g.fillRect(x, y, 1, 1);
    }
    ditherPat.push(ctx.createPattern(c, 'repeat'));
  }
}

function drawTransition() {
  if (!trans) return;
  const k = trans.phase === 0 ? trans.t / 6 : 1 - trans.t / 6;
  const lv = clamp(Math.round(k * 16), 0, 16);
  if (lv <= 0) return;
  if (lv >= 16) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
  if (!ditherPat) buildDither();
  ctx.fillStyle = ditherPat[lv];
  ctx.fillRect(0, 0, W, H);
}

function updateTransition() {
  if (!trans) return;
  trans.t += SC.dt;
  if (trans.phase === 0 && trans.t >= 6) {
    swapScene(trans.name, trans.params);
    trans.phase = 1; trans.t = 0;
  } else if (trans.phase === 1 && trans.t >= 6) {
    trans = null;
  }
}

// ---------------------------------------------------------------- loop
let errCount = 0;
function logErr(e) {
  if (errCount++ < 8 && window.console) console.error(e);
}

let running = false, lastTs = null, acc = 0;
const STEP = 1 / 60, MAX_STEPS = 4;

// Runs `steps` fixed 60 Hz steps (hitstop steps are counted but skip update), then exactly one draw.
function frameTick(steps) {
  SC.dt = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let updates = 0;
  for (let s = 0; s < steps; s++) {
    SC.time += STEP;
    if (fx.hitstop > 0) {
      fx.hitstop = Math.max(0, Math.ceil(fx.hitstop) - 1);
      continue;
    }
    applyMode(1, updates > 0);
    SC.frame++;
    if (cur && cur.update) { try { cur.update(); } catch (e) { logErr(e); } }
    try { fx.update(); updateTransition(); } catch (e) { logErr(e); }
    if (updates === 0) clearPending();
    updates++;
  }
  applyMode(2, false);
  try {
    ctx.save();
    ctx.translate(fx.shakeX, fx.shakeY);
    if (cur && cur.draw) { try { cur.draw(); } catch (e) { logErr(e); } }
    else clear('#000');
    ctx.restore();
    ctx.globalAlpha = 1;
    drawTransition();
  } finally {
    markDrawSeen();
    applyMode(0, false);
  }
  // edges survive frames with no real update (zero steps or hitstop) so presses are never lost
  if (updates > 0) endInputFrame();
}

function rafLoop(ts) {
  if (!running) return;
  window.requestAnimationFrame(rafLoop);
  if (lastTs === null) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!(dt > 0)) dt = 0;
  acc += Math.min(dt, 0.1);
  let steps = Math.floor((acc + 0.0008) / STEP);
  acc = Math.max(0, acc - steps * STEP);
  if (steps > MAX_STEPS) { steps = MAX_STEPS; acc = 0; }
  frameTick(steps);
}

SC.run = function () {
  if (running) return;
  running = true; lastTs = null; acc = 0;
  window.requestAnimationFrame(rafLoop);
};
SC.stop = function () { running = false; };
// harness: exactly one step (update unless hitstop) and one draw
SC.stepFrame = function () { frameTick(1); };

})();
