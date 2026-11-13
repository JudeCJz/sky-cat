/* Sky Cat art: every sprite grid, palette, metadata and background drawing. */
(function () {
'use strict';
const SC = window.SC;
const art = (SC.art = SC.art || {});
SC.groundY = 236;

// ---------------------------------------------------------------- palette (32)
const P = (SC.PAL = {
  dark: '#1b1226', charcoal: '#2d2a3e', steel: '#52566e', grey: '#8b90a8',
  silver: '#c5cada', white: '#ffffff', cream: '#fff0d2', sand: '#f4cf94',
  peach: '#ffb27a', orange: '#ff8a1f', ginger: '#d9541a', rust: '#8f3418',
  brown: '#5a331f', tan: '#b9824e', yellow: '#ffd93b', gold: '#eda016',
  red: '#e8383d', darkred: '#8a1f3d', pink: '#ff86ad', magenta: '#c43c96',
  purple: '#6e3fa6', indigo: '#3a2c70', navy: '#1c2a5a', blue: '#2f70e0',
  sky: '#62c4f4', cyan: '#a6f0ff', teal: '#1da39a', lime: '#aee34c',
  green: '#48c04e', forest: '#1e7a40', deepgreen: '#123f33', plum: '#8e5a9c'
});
const def = (n, f, c, o) => SC.sprite.define(n, f, c, o);

// ---------------------------------------------------------------- grid helpers
const mkg = (w, h, c) => Array.from({ length: h }, () => new Array(w).fill(c || '.'));
const cp = (g) => g.map((r) => r.slice());
const get = (g, x, y) => (y >= 0 && y < g.length && x >= 0 && x < g[0].length ? g[y][x] : '.');
const put = (g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; };
const rect = (g, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, c); };
const ell = (g, cx, cy, rx, ry, c) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(g, x, y, c);
    }
};
const ln = (g, x0, y0, x1, y1, c) => {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    put(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
};
const blit = (g, rws, x, y, flip) => {
  rws.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const ch = r[flip ? r.length - 1 - i : i];
      if (ch !== '.' && ch !== ' ') put(g, x + i, y + j, ch);
    }
  });
};
const comp = (dst, src, dx, dy) => {
  for (let y = 0; y < src.length; y++) for (let x = 0; x < src[0].length; x++)
    if (src[y][x] !== '.') put(dst, x + dx, y + dy, src[y][x]);
};
const mirror = (rws) => rws.map((r) => r + r.split('').reverse().join(''));
const flipH = (rws) => rws.map((r) => r.split('').reverse().join(''));
const flipV = (rws) => rws.slice().reverse();
const outline = (g, c, diag) => {
  const s = cp(g);
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (s[y][x] !== '.') continue;
    if (get(s, x - 1, y) !== '.' || get(s, x + 1, y) !== '.' || get(s, x, y - 1) !== '.' || get(s, x, y + 1) !== '.' ||
      (diag && (get(s, x - 1, y - 1) !== '.' || get(s, x + 1, y - 1) !== '.' || get(s, x - 1, y + 1) !== '.' || get(s, x + 1, y + 1) !== '.')))
      g[y][x] = c || 'o';
  }
  return g;
};
const shade = (g, base, lt, sh) => {
  const s = cp(g);
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (s[y][x] !== base) continue;
    if (get(s, x, y - 1) === '.') g[y][x] = lt;
    else if (get(s, x, y + 1) === '.') g[y][x] = sh;
  }
  return g;
};
// replace base pixels (interior only) inside an ellipse with a patch char
const patch = (g, cx, cy, rx, ry, ch, from) => {
  const s = cp(g);
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy > 1) continue;
    if (s[y][x] !== (from || 'b')) continue;
    if (get(s, x - 1, y) === '.' || get(s, x + 1, y) === '.' || get(s, x, y - 1) === '.' || get(s, x, y + 1) === '.') continue;
    g[y][x] = ch;
  }
};
const rows = (g) => g.map((r) => r.join(''));
// nearest-neighbour horizontal squash, keeps canvas width, centred
const squishX = (g, nw) => {
  const w = g[0].length, h = g.length, o = mkg(w, h);
  const x0 = Math.floor((w - nw) / 2);
  for (let x = 0; x < nw; x++) {
    const sx = Math.min(w - 1, Math.floor((x + 0.5) * w / nw));
    for (let y = 0; y < h; y++) o[y][x0 + x] = g[y][sx];
  }
  return o;
};
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------------------------------------------------------------- cat
const CW = 28, CH = 26;
const HEAD_UP = [".b.....", ".bb....", "bbeb...", "beeeb..", "beeebbp", "bbbbbpb", "bbbbbbb", "bbbbbbb", "bbbbbbb", "bbbxxxn", "bbxxxxx", ".bbxxxx"];
const HEAD_BACK = [".......", ".b.....", "bbeb...", "beeeb..", "beeebbp", "bbbbbpb", "bbbbbbb", "bbbbbbb", "bbbbbbb", "bbbxxxn", "bbxxxxx", ".bbxxxx"];
const EYE = {
  open: ["kkk", "kwk", "kik", "kkk"], blink: ["...", "...", "kkk", "..."], happy: ["...", ".k.", "k.k", "..."],
  det: ["kkk", "kwk", "kkk", "kkk"], squint: ["kkk", "kwk", "kkk", "..."],
  hurtL: ["k.k", ".k.", "k.k", "..."], hurtR: ["k.k", ".k.", "k.k", "..."], ko: ["k.k", ".k.", "k.k", "..."],
  angL: ["kkk", "kwk", "kik", "..."], angR: ["kkk", "kwk", "kik", "..."]
};
const PACK = [".JJ.JJ", "JJKJJK", "JjKJjK", "yyyyyy", "jjKjjK", "jjKjjK", "jjKjjK", "KKKKKK", "ffffff", ".ff.ff"];
const PAW = ["qqqq", "qqqq", "q.qq"];

function headLayer(o) {
  const half = o.ears === 'back' ? HEAD_BACK : HEAD_UP;
  const h = mirror(half).map((r) => r.split(''));
  let eL = EYE[o.eyes], eR = EYE[o.eyes];
  if (o.eyes === 'hurt') { eL = EYE.hurtL; eR = EYE.hurtR; }
  if (o.eyes === 'ang') { eL = EYE.angL; eR = EYE.angR; }
  shade(h, 'b', 'l', 's');
  patch(h, 10.5, 6, 2.5, 1.6, 'v');
  [[eL, 2], [eR, 9]].forEach(([e, x0]) => {
    e.forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] !== '.') put(h, x0 + i, 5 + j, r[i]); });
  });
  if (o.mouth === 'open') { put(h, 6, 10, 'm'); put(h, 7, 10, 'm'); put(h, 6, 11, 't'); put(h, 7, 11, 't'); }
  if (o.mouth === 'tongue') { put(h, 7, 11, 't'); put(h, 7, 10, 'm'); put(h, 6, 10, 'm'); }
  if (o.mouth === 'flat') { put(h, 5, 10, 'm'); put(h, 6, 10, 'm'); put(h, 7, 10, 'm'); put(h, 8, 10, 'm'); }
  // whiskers hint
  put(h, 1, 9, 'x'); put(h, 12, 9, 'x');
  outline(h, 'o', true);
  return h;
}

function tailLayer(p0, p1, p2, n, thick) {
  const t = mkg(CW, CH), pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    pts.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
  }
  pts.forEach((q, i) => {
    const sz = i < n * 0.55 || thick ? 3 : 2, off = sz > 2 ? 1 : 0;
    rect(t, Math.round(q[0]) - off, Math.round(q[1]) - off, sz, sz, 'b');
  });
  shade(t, 'b', 'l', 's');
  pts.forEach((q, i) => {
    const x = Math.round(q[0]), y = Math.round(q[1]);
    const ch = i >= n - 2 ? 'q' : (i % 5 === 3 && i < n - 3 ? 'p' : null);
    if (!ch) return;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      if (get(t, x + dx, y + dy) !== '.' && get(t, x + dx, y + dy) !== 'o') put(t, x + dx, y + dy, ch);
  });
  outline(t, 'o', true);
  return t;
}

function bodyLayer(cx, cy, rx, ry) {
  const b = mkg(CW, CH);
  ell(b, cx, cy, rx, ry, 'b');
  ell(b, cx + 4.5, cy + 1.5, 3.4, ry - 0.8, 'q');
  shade(b, 'b', 'l', 's');
  [[cx - 4.5, cy - 1.5, 2], [cx - 4, cy + 0.5, 3], [cx - 3, cy + 2.5, 2]].forEach(([x, y, w]) => {
    for (let i = 0; i < w; i++) if (get(b, Math.round(x) + i, Math.round(y)) === 'b' && get(b, Math.round(x) + i, Math.round(y) - 1) !== '.') put(b, x + i, y, 'p');
  });
  patch(b, cx + 1, cy - 1, 3.2, 1.8, 'u');
  patch(b, cx - 4.5, cy + 2.2, 2, 1.6, 'v');
  outline(b, 'o', true);
  return b;
}

function packLayer() {
  const o = mkg(8, 12);
  blit(o, PACK, 1, 1);
  outline(o, 'o', false);
  return o;
}
const PACK_L = packLayer();

function pawLayer() {
  const k = mkg(6, 5);
  blit(k, PAW, 1, 1);
  outline(k, 'o', false);
  return k;
}
const PAW_L = pawLayer();

function armLayer(x0, y0, x1, y1) {
  const a = mkg(CW, CH);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u);
    rect(a, x - 1, y - 1, 3, 3, 'b');
  }
  shade(a, 'b', 'l', 's');
  rect(a, x1 - 1, y1 - 1, 3, 3, 'q');
  outline(a, 'o', false);
  return a;
}

// pose -> char grid
function catGrid(o) {
  const g = mkg(CW, CH);
  const ox = 1, oy = 3;
  const tl = tailLayer(o.tail[0], o.tail[1], o.tail[2], 16, o.tailThick);
  comp(g, tl, ox, oy);
  comp(g, bodyLayer(o.bx, o.by, o.brx, o.bry), ox, oy);
  (o.pawsBack || []).forEach((p) => comp(g, PAW_L, ox + p[0] - 1, oy + p[1] - 1));
  comp(g, PACK_L, ox + o.px - 1, oy + o.py - 1);
  ln(g, ox + o.px + 5, oy + o.py + 2, ox + o.px + 8, oy + o.py + 1, 'K');
  (o.paws || []).forEach((p) => comp(g, PAW_L, ox + p[0] - 1, oy + p[1] - 1));
  if (o.arm) comp(g, armLayer(o.arm[0], o.arm[1], o.arm[2], o.arm[3]), ox, oy);
  const hl = headLayer(o);
  for (let y = 0; y < hl.length - 1; y++) for (let x = 0; x < hl[0].length; x++) {
    if (hl[y][x] !== '.' && hl[y + 1][x] === '.') {
      const gx = ox + o.hx + x - 1, gy = oy + o.hy + y - 2;
      if (get(g, gx, gy + 1) === 'b' || get(g, gx, gy + 1) === 'l') put(g, gx, gy + 1, 's');
    }
  }
  comp(g, hl, ox + o.hx - 1, oy + o.hy - 3);
  return g;
}

const bobs = [0, -1, 0, 1];
const base = (extra) => Object.assign({
  hx: 12, hy: 1, ears: 'up', eyes: 'open', mouth: null,
  bx: 14, by: 14.5, brx: 8.5, bry: 5, px: 3, py: 10,
  tail: [[7, 11], [1, 8], [3, 2]], paws: [[14, 18], [19, 18]], pawsBack: [[9, 18]]
}, extra);
const shift = (o, dy) => { o.hy += dy; o.by += dy; o.py += dy; o.tail = o.tail.map((q) => [q[0], q[1] + dy]); o.paws = o.paws.map((p) => [p[0], p[1] + dy]); o.pawsBack = o.pawsBack.map((p) => [p[0], p[1] + dy]); return o; };

const catFrames = [];
// fly x4
const swayA = [-2, 0, 2, 0], swayB = [1, 3, 1, -1];
for (let k = 0; k < 4; k++) {
  const o = base({ eyes: 'open', mouth: null });
  o.tail = [[6, 12], [-1 + swayA[k], 6], [4 + swayB[k], 1]];
  o.paws = [[14 + (k === 1 ? 1 : k === 3 ? -1 : 0), 18 + (k === 1 ? -1 : k === 3 ? 1 : 0)],
            [19 + (k === 1 ? -1 : k === 3 ? 1 : 0), 18 + (k === 1 ? 1 : k === 3 ? -1 : 0)]];
  o.pawsBack = [[9, 18 + (k === 2 ? -1 : 0)]];
  catFrames.push(catGrid(shift(o, bobs[k])));
}
// dash x2
for (let k = 0; k < 2; k++) {
  const o = base({ eyes: 'squint', ears: 'back', hx: 12, hy: 3, bx: 12, by: 14, brx: 10, bry: 4, px: 2, py: 9, mouth: 'flat',
    tail: [[6, 13], [3, 13 + k], [0, 12 + k * 2]], tailThick: false,
    paws: [[15, 18], [19, 17]], pawsBack: [[7 + k, 17]] });
  catFrames.push(catGrid(o));
}
// parry x3
{
  let o = base({ eyes: 'det', hx: 12, hy: 2, arm: [17, 12, 9, 5], tail: [[6, 12], [-1, 7], [3, 2]], mouth: 'flat' });
  catFrames.push(catGrid(o));
  o = base({ eyes: 'ang', hx: 12, hy: 1, arm: [19, 13, 24, 12], tail: [[6, 12], [-1, 9], [3, 3]] });
  catFrames.push(catGrid(o));
  o = base({ eyes: 'det', hx: 12, hy: 2, arm: [19, 13, 24, 18], tail: [[6, 12], [-1, 10], [2, 5]] });
  catFrames.push(catGrid(o));
}
// hurt
{
  const o = base({ eyes: 'hurt', mouth: 'open', hx: 11, hy: 2, tail: [[7, 12], [8, 6], [5, 1]], tailThick: true,
    paws: [[12, 16], [20, 16]], pawsBack: [[9, 18]], bx: 13.5, by: 15 });
  catFrames.push(catGrid(o));
}
// shoot x2
{
  let o = base({ eyes: 'det', hx: 12, hy: 1, arm: [19, 14, 24, 14], mouth: 'flat', tail: [[6, 12], [-1, 8], [3, 3]] });
  catFrames.push(catGrid(o));
  o = base({ eyes: 'squint', hx: 11, hy: 2, bx: 13, arm: [18, 14, 22, 14], px: 2, mouth: 'open', tail: [[5, 12], [-1, 9], [1, 4]],
    paws: [[13, 18], [18, 18]], pawsBack: [[8, 18]] });
  catFrames.push(catGrid(o));
}
// ko
{
  const o = base({ eyes: 'ko', mouth: 'tongue', hx: 11, hy: 3, bx: 13.5, by: 15.5, bry: 4.6, py: 11,
    tail: [[7, 14], [3, 17], [0, 20]], paws: [[13, 20], [19, 19]], pawsBack: [[8, 20]] });
  catFrames.push(catGrid(o));
}
// idle x4
{
  const ib = [0, 0, -1, -1], ey = ['open', 'open', 'blink', 'happy'], sw = [0, 1, 0, -1];
  for (let k = 0; k < 4; k++) {
    const o = base({ eyes: ey[k] });
    o.tail = [[6, 12], [-1 + sw[k], 6], [4 + sw[k] * 2, 1]];
    o.paws = [[15, 18], [19, 18]]; o.pawsBack = [[10, 18]];
    catFrames.push(catGrid(shift(o, ib[k])));
  }
}

const fur = (b, l, s, p, q, e, i, extra) => Object.assign({
  o: P.brown, b, l, s, p, q, e, i, u: b, v: b, k: P.dark, h: P.white, w: P.white, x: P.white, n: P.pink, m: P.dark, t: P.red,
  j: P.blue, J: P.sky, K: P.navy, f: P.charcoal, y: P.yellow
}, extra || {});

art.skins = [
  { id: 'ginger', name: 'Ginger', price: 0, colors: fur(P.orange, P.peach, P.ginger, P.rust, P.cream, P.pink, P.lime, { o: P.brown }) },
  { id: 'pastel', name: 'Cotton', price: 100, colors: fur(P.pink, P.cream, P.plum, P.magenta, P.white, P.peach, P.cyan, { o: P.darkred, j: P.teal, J: P.cyan, K: P.forest }) },
  { id: 'tabby', name: 'Tabby', price: 200, colors: fur(P.grey, P.silver, P.steel, P.charcoal, P.cream, P.pink, P.yellow, { o: P.charcoal }) },
  { id: 'tuxedo', name: 'Tuxedo', price: 400, colors: fur(P.charcoal, P.steel, P.dark, P.charcoal, P.white, P.pink, P.lime, { o: P.dark, j: P.red, J: P.pink, K: P.darkred }) },
  { id: 'calico', name: 'Calico', price: 600, colors: fur(P.cream, P.white, P.sand, P.sand, P.white, P.pink, P.green, { o: P.brown, u: P.charcoal, v: P.orange }) },
  { id: 'robot', name: 'Robo', price: 900, colors: fur(P.silver, P.white, P.grey, P.steel, P.grey, P.red, P.cyan, { o: P.charcoal, n: P.red, j: P.gold, J: P.yellow, K: P.rust, v: P.grey, u: P.steel }) },
  { id: 'ghost', name: 'Ghost', price: 1200, colors: fur(P.cyan, P.white, P.sky, P.sky, P.white, P.pink, P.blue, { o: P.navy, j: P.purple, J: P.plum, K: P.indigo, y: P.cyan }) },
  { id: 'void', name: 'Void', price: 1600, colors: fur(P.indigo, P.purple, P.dark, P.navy, P.indigo, P.magenta, P.yellow, { o: P.dark, k: P.gold, x: P.purple, n: P.magenta, j: P.gold, J: P.yellow, K: P.rust, y: P.white }) },
  { id: 'golden', name: 'Golden', price: 2500, colors: fur(P.gold, P.yellow, P.orange, P.ginger, P.yellow, P.peach, P.red, { o: P.rust, j: P.red, J: P.pink, K: P.darkred }) },
  { id: 'spin', name: 'Spin Cat', price: 5000, spin: true, colors: fur(P.white, P.cream, P.sand, P.silver, P.white, P.pink, P.cyan, { o: P.charcoal, u: P.charcoal, v: P.orange }) }
];
art.skins.forEach((s) => def('cat_' + s.id, catFrames.map(rows), s.colors, { anchor: { x: 14, y: 14 }, spin: !!s.spin }));
art.CAT = {
  w: CW, h: CH,
  frames: { fly: [0, 1, 2, 3], dash: [4, 5], parry: [6, 7, 8], hurt: [9], shoot: [10, 11], ko: [12], idle: [13, 14, 15, 16] },
  centre: { x: 15, y: 16 }, hand: { x: 26, y: 16 }, jet: { x: 7, y: 24 },
  handFrames: { parry: [{ x: 13, y: 8 }, { x: 25, y: 15 }, { x: 25, y: 21 }], shoot: [{ x: 25, y: 17 }, { x: 23, y: 17 }] }
};

// ---------------------------------------------------------------- enemies
art.enemies = {};
const TDIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function trap(g, y0, y1, xl0, xr0, xl1, xr1, c) {
  for (let y = y0; y <= y1; y++) {
    const u = (y - y0) / Math.max(1, y1 - y0);
    const xl = Math.round(xl0 + (xl1 - xl0) * u), xr = Math.round(xr0 + (xr1 - xr0) * u);
    for (let x = xl; x <= xr; x++) put(g, x, y, c);
  }
}
// layer helper: fill via fn, shade top/bottom, 1px outline
function layer(W, H, fn, deep, noOutline) {
  const g = mkg(W, H);
  fn(g);
  shade(g, 'h', 'H', 'd');
  if (deep) {
    const s = cp(g);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (s[y][x] === 'h' && get(s, x, y + 1) === 'd' && get(s, x, y + 2) === '.') g[y][x] = 'd';
  }
  if (!noOutline) outline(g, 'o', false);
  return g;
}
function treads(W, H, x0, x1, y0, h, wheels, wr, ph) {
  const g = mkg(W, H);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x <= x1; x++) {
    const dx = Math.min(x - x0, x1 - x), dy = Math.min(y - y0, y0 + h - 1 - y);
    if (dx + dy < (h >= 8 ? 3 : 2)) continue;
    const edge = y === y0 || y === y0 + h - 1;
    g[y][x] = edge ? (((x + ph) & 3) < 2 ? 'T' : 't') : 't';
  }
  const cy = y0 + Math.floor((h - 1) / 2);
  wheels.forEach((cx) => {
    ell(g, cx, cy, wr, wr, 'w');
    put(g, cx - 1, cy - 1, 'W'); put(g, cx, cy - wr + 0.4, 'W');
    put(g, cx, cy, 'k');
    const d = TDIR[ph & 3];
    put(g, cx + d[0], cy + d[1], 'W');
    if (wr > 3) put(g, cx - d[0] * 2, cy - d[1] * 2, 'W');
  });
  outline(g, 'o', false);
  return g;
}
function hatchBox(g, x, y, w, h) {
  rect(g, x, y, w, h, 'k');
  rect(g, x + 1, y + 1, w - 2, h - 2, 'g');
  rect(g, x + 2, y + 1, Math.max(1, w - 4), Math.max(1, h - 3) || 1, 'G');
}
function cracks(g, pts) { pts.forEach(([x, y]) => put(g, x, y, 'k')); }

const TCOL = (h, H, d, a, A) => ({
  o: P.dark, h, H, d, t: P.charcoal, T: P.steel, w: P.grey, W: P.silver, k: P.dark, a, A,
  g: P.orange, G: P.yellow, m: P.charcoal, M: P.steel, r: P.silver, c: P.sky, C: P.white
});

// ---- light tank 38x24
function lightTank(ph, hurt) {
  const W = 38, H = 24, g = mkg(W, H);
  comp(g, treads(W, H, 3, 34, 14, 9, [7, 13, 19, 25, 31], 2.4, ph), 0, 0);
  comp(g, layer(W, H, (l) => { trap(l, 9, 15, 9, 31, 4, 34, 'h'); rect(l, 8, 12, 24, 1, 'a'); }), 0, 0);
  const rivets = mkg(W, H); [[10, 11], [29, 11], [6, 14], [33, 14]].forEach(([x, y]) => put(rivets, x, y, 'r')); comp(g, rivets, 0, 0);
  comp(g, layer(W, H, (l) => { ell(l, 19, 9, 8.5, 6.2, 'h'); for (let y = 10; y < H; y++) for (let x = 0; x < W; x++) l[y][x] = '.'; }), 0, 0);
  const m = mkg(W, H); rect(m, 7, 6, 6, 4, 'm'); rect(m, 7, 6, 6, 1, 'M'); outline(m, 'o'); comp(g, m, 0, 0);
  hatchBox(g, 15, 2, 8, 4);
  if (hurt) { cracks(g, [[12, 5], [13, 6], [12, 7], [24, 6], [25, 7], [24, 8], [20, 11], [21, 12], [15, 12], [14, 13]]); put(g, 18, 3, 'g'); }
  return g;
}
const LT = [0, 1, 2, 3].map((p) => lightTank(p, false)).concat([lightTank(0, true)]);
def('tank_light', LT.map(rows), TCOL(P.green, P.lime, P.forest, P.yellow, P.cream));
art.enemies.tank_light = { w: 38, h: 24, frames: { move: [0, 1, 2, 3], hurt: [4] }, hatch: { x: 15, y: 2, w: 8, h: 4 }, turret: { x: 8, y: 8 }, barrelLen: 16, hp: 1 };

// ---- heavy tank 50x32
function heavyTank(ph, hurt) {
  const W = 50, H = 32, g = mkg(W, H);
  comp(g, treads(W, H, 3, 46, 20, 11, [8, 15, 22, 29, 36, 43], 3.3, ph), 0, 0);
  comp(g, layer(W, H, (l) => {
    trap(l, 12, 21, 8, 41, 3, 46, 'h');
    rect(l, 10, 15, 32, 2, 'a');
  }, true), 0, 0);
  // side skirt plates
  const sk = layer(W, H, (l) => { rect(l, 6, 22, 38, 3, 'h'); }, false);
  comp(g, sk, 0, 0);
  const rv = mkg(W, H); for (let x = 9; x < 44; x += 5) put(rv, x, 23, 'r'); [[12, 14], [20, 14], [34, 14], [41, 14]].forEach(([x, y]) => put(rv, x, y, 'r')); comp(g, rv, 0, 0);
  // exhaust
  const ex = mkg(W, H); rect(ex, 43, 7, 3, 6, 'm'); rect(ex, 43, 7, 3, 1, 'M'); outline(ex, 'o'); comp(g, ex, 0, 0);
  comp(g, layer(W, H, (l) => {
    trap(l, 4, 12, 17, 36, 14, 39, 'h');
    rect(l, 16, 8, 22, 1, 'a');
  }, true), 0, 0);
  const m = mkg(W, H); rect(m, 5, 6, 10, 5, 'm'); rect(m, 5, 6, 10, 1, 'M'); rect(m, 5, 8, 2, 1, 'k'); outline(m, 'o'); comp(g, m, 0, 0);
  hatchBox(g, 22, 2, 9, 5);
  const cup = mkg(W, H); rect(cup, 33, 2, 4, 3, 'h'); rect(cup, 33, 2, 4, 1, 'H'); outline(cup, 'o'); comp(g, cup, 0, 0);
  if (hurt) { cracks(g, [[18, 6], [19, 7], [18, 9], [32, 7], [33, 9], [32, 10], [24, 15], [25, 16], [26, 17], [14, 17], [13, 18], [38, 16], [39, 17]]); put(g, 26, 3, 'g'); put(g, 27, 3, 'G'); }
  return g;
}
const HT = [0, 1, 2, 3].map((p) => heavyTank(p, false)).concat([heavyTank(0, true)]);
def('tank_heavy', HT.map(rows), TCOL(P.grey, P.silver, P.steel, P.red, P.pink));
art.enemies.tank_heavy = { w: 50, h: 32, frames: { move: [0, 1, 2, 3], hurt: [4] }, hatch: { x: 22, y: 2, w: 9, h: 5 }, turret: { x: 5, y: 8 }, barrelLen: 24, hp: 4 };

// ---- artillery 46x32
function artillery(ph, hurt) {
  const W = 46, H = 32, g = mkg(W, H);
  comp(g, treads(W, H, 4, 43, 22, 9, [9, 16, 23, 30, 37], 2.4, ph), 0, 0);
  comp(g, layer(W, H, (l) => { trap(l, 16, 23, 8, 42, 5, 43, 'h'); rect(l, 8, 19, 33, 1, 'a'); }), 0, 0);
  // mortar tube: thick diagonal up-left from cradle
  const tube = mkg(W, H);
  const x0 = 24, y0 = 18, x1 = 8, y1 = 3, len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  for (let t = 0; t <= len; t += 0.5) {
    for (let s = -2; s <= 2; s += 0.5) {
      const px = x0 + ux * t - uy * s, py = y0 + uy * t + ux * s;
      put(tube, px, py, s < -0.9 ? 'M' : (s > 1 ? 'd' : 'm'));
    }
  }
  for (let t = len - 3; t <= len; t += 0.5) for (let s = -2.5; s <= 2.5; s += 0.5) put(tube, x0 + ux * t - uy * s, y0 + uy * t + ux * s, t > len - 1.6 ? 'k' : 'r');
  outline(tube, 'o', false); comp(g, tube, 0, 0);
  // cradle block
  const cr = mkg(W, H); rect(cr, 20, 14, 10, 6, 'm'); rect(cr, 20, 14, 10, 1, 'M'); rect(cr, 22, 17, 2, 2, 'r'); outline(cr, 'o'); comp(g, cr, 0, 0);
  // rear cab
  comp(g, layer(W, H, (l) => { trap(l, 9, 16, 31, 40, 30, 41, 'h'); rect(l, 31, 13, 10, 1, 'a'); }), 0, 0);
  hatchBox(g, 33, 8, 6, 4);
  const ant = mkg(W, H); ln(ant, 42, 9, 44, 3, 'm'); put(ant, 44, 2, 'g'); comp(g, ant, 0, 0);
  if (hurt) { cracks(g, [[34, 13], [35, 14], [34, 15], [14, 19], [15, 20], [14, 21], [28, 20], [29, 21]]); put(g, 20, 12, 'g'); }
  return g;
}
const AR = [0, 1, 2, 3].map((p) => artillery(p, false)).concat([artillery(0, true)]);
def('artillery', AR.map(rows), TCOL(P.tan, P.sand, P.brown, P.red, P.yellow));
art.enemies.artillery = { w: 46, h: 32, frames: { move: [0, 1, 2, 3], hurt: [4] }, hatch: { x: 33, y: 8, w: 6, h: 4 }, turret: { x: 8, y: 3 }, barrelLen: 14, hp: 2 };

// ---- heli 42x24 (faces left)
function heli(ph, hurt) {
  const W = 42, H = 24, g = mkg(W, H);
  // tail boom + fin
  const tb = mkg(W, H); trap(tb, 11, 14, 22, 36, 22, 38, 'h'); trap(tb, 5, 12, 35, 38, 36, 40, 'h');
  shade(tb, 'h', 'H', 'd'); outline(tb, 'o'); comp(g, tb, 0, 0);
  // tail rotor
  const tr = mkg(W, H); const tp = [[0, -1], [1, 0], [0, 1], [1, 0]][ph & 3];
  ln(tr, 38, 6 - (ph & 1) * 0, 38, 10, 'W'); if (ph & 1) { put(tr, 37, 8, 'W'); put(tr, 39, 8, 'W'); } else { put(tr, 38, 5, 'W'); put(tr, 38, 11, 'W'); }
  comp(g, tr, 0, 0);
  // skids + struts
  const sk = mkg(W, H); rect(sk, 6, 21, 18, 1, 'm'); put(sk, 5, 20, 'm'); put(sk, 24, 20, 'm'); rect(sk, 10, 18, 1, 3, 'm'); rect(sk, 20, 18, 1, 3, 'm'); outline(sk, 'o'); comp(g, sk, 0, 0);
  // body pod
  comp(g, layer(W, H, (l) => { ell(l, 15, 12, 12, 6.4, 'h'); rect(l, 12, 13, 18, 1, 'a'); }, false), 0, 0);
  // cockpit glass
  const ck = mkg(W, H); ell(ck, 9, 11, 5, 4, 'c'); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ck[y][x] === 'c' && (x > 11 || y > 13)) ck[y][x] = '.';
  put(ck, 6, 9, 'C'); put(ck, 7, 9, 'C'); put(ck, 6, 10, 'C'); outline(ck, 'o'); comp(g, ck, 0, 0);
  // mast + rotor
  const mt = mkg(W, H); rect(mt, 14, 4, 3, 3, 'm'); comp(g, mt, 0, 0);
  const R = mkg(W, H); const len = [17, 12, 6, 12][ph];
  const ry = 3;
  for (let x = 15 - len; x <= 15 + len; x++) { put(R, x, ry, 'W'); put(R, x, ry + 1, 'T'); }
  for (let x = 15 - len - 1; x <= 15 + len + 1; x++) if ((x + ph) & 1) put(R, x, ry - 1, 'z');
  put(R, 15 - len - 1, ry, 'T'); put(R, 15 + len + 1, ry, 'T');
  comp(g, R, 0, 0);
  if (hurt) { cracks(g, [[16, 9], [17, 10], [16, 12], [25, 12], [26, 13]]); put(g, 12, 16, 'g'); put(g, 13, 17, 'G'); }
  return g;
}
const HE = [0, 1, 2, 3].map((p) => heli(p, false)).concat([heli(0, true)]);
def('heli', HE.map(rows), Object.assign(TCOL(P.teal, P.cyan, P.navy, P.yellow, P.white), { z: P.grey, T: P.silver }));
art.enemies.heli = { w: 42, h: 24, frames: { move: [0, 1, 2, 3], hurt: [4] }, hatch: { x: 5, y: 7, w: 8, h: 7 }, turret: { x: 3, y: 15 }, barrelLen: 8, hp: 2 };

// ---- drone 18x16
function drone(ph, hurt) {
  const W = 18, H = 16, g = mkg(W, H);
  const arms = mkg(W, H); rect(arms, 2, 8, 14, 1, 'm'); rect(arms, 2, 5, 1, 4, 'm'); rect(arms, 15, 5, 1, 4, 'm'); outline(arms, 'o'); comp(g, arms, 0, 0);
  const pr = mkg(W, H);
  if (ph === 0) { rect(pr, 0, 3, 5, 1, 'W'); rect(pr, 13, 3, 5, 1, 'W'); }
  else { rect(pr, 1, 3, 1, 1, 'W'); rect(pr, 3, 3, 1, 1, 'W'); rect(pr, 14, 3, 1, 1, 'W'); rect(pr, 16, 3, 1, 1, 'W'); rect(pr, 0, 2, 1, 1, 'z'); rect(pr, 17, 2, 1, 1, 'z'); rect(pr, 4, 4, 1, 1, 'z'); rect(pr, 13, 4, 1, 1, 'z'); }
  rect(pr, 2, 4, 1, 1, 'm'); rect(pr, 15, 4, 1, 1, 'm');
  comp(g, pr, 0, 0);
  comp(g, layer(W, H, (l) => { ell(l, 9, 9, 6, 5, 'h'); put(l, 9, 14, 'h'); }), 0, 0);
  // eye
  const e = mkg(W, H); ell(e, 9, 9, 3.2, 2.6, 'k'); ell(e, 9, 9, 2.2, 1.7, 'e'); put(e, 9, 9, ph ? 'E' : 'e'); put(e, 8, 9, 'E'); comp(g, e, 0, 0);
  const sp = mkg(W, H); put(sp, 9, 14, 'a'); put(sp, 9, 15, 'a'); comp(g, sp, 0, 0);
  if (hurt) { cracks(g, [[5, 7], [6, 8], [12, 11], [13, 12]]); }
  return g;
}
const DR = [0, 1].map((p) => drone(p, false)).concat([drone(0, true)]);
def('drone', DR.map(rows), { o: P.dark, h: P.purple, H: P.plum, d: P.indigo, m: P.steel, W: P.silver, z: P.grey, k: P.dark, e: P.red, E: P.yellow, a: P.orange });
art.enemies.drone = { w: 18, h: 16, frames: { move: [0, 1], hurt: [2] }, hatch: { x: 6, y: 6, w: 6, h: 6 }, turret: { x: 9, y: 9 }, barrelLen: 0, hp: 1 };

// ---- boss 150x66
function boss(ph, hurt) {
  const W = 150, H = 66, g = mkg(W, H);
  const wheels = []; for (let i = 0; i < 13; i++) wheels.push(11 + i * 11);
  comp(g, treads(W, H, 3, 146, 49, 16, wheels, 5.4, ph), 0, 0);
  // lower hull
  comp(g, layer(W, H, (l) => { trap(l, 33, 50, 14, 134, 5, 144, 'h'); rect(l, 15, 41, 120, 2, 'a'); }, true), 0, 0);
  // armour skirt plates, rivets, hazard stripes
  const pl = mkg(W, H);
  for (let i = 0; i < 8; i++) { rect(pl, 14 + i * 16, 45, 13, 4, 'H'); rect(pl, 14 + i * 16, 48, 13, 1, 'd'); put(pl, 15 + i * 16, 46, 'r'); put(pl, 25 + i * 16, 46, 'r'); }
  for (let x = 10; x < 138; x += 6) { rect(pl, x, 38, 3, 2, 'E'); rect(pl, x + 3, 38, 3, 2, 'k'); }
  comp(g, pl, 0, 0);
  // jaw teeth under the front
  const tt = mkg(W, H); for (let i = 0; i < 6; i++) { rect(tt, 5 + i * 3, 51, 2, 1, 'r'); } comp(g, tt, 0, 0);
  // exhaust stacks (right) with vents
  [[130, 14], [137, 19]].forEach(([x, y]) => { const ex = mkg(W, H); rect(ex, x, y, 5, 36 - y, 'm'); rect(ex, x, y, 5, 1, 'M'); rect(ex, x + 1, y + 4, 3, 1, 'k'); rect(ex, x + 1, y + 8, 3, 1, 'k'); outline(ex, 'o'); comp(g, ex, 0, 0); });
  // upper hull
  comp(g, layer(W, H, (l) => { trap(l, 24, 33, 28, 122, 18, 130, 'h'); rect(l, 26, 28, 96, 1, 'a'); }, true), 0, 0);
  // rear vent grille
  const gr = mkg(W, H); for (let i = 0; i < 5; i++) rect(gr, 108 + i * 3, 27, 1, 4, 'k'); comp(g, gr, 0, 0);
  // side turrets
  [[28, 25], [122, 25]].forEach(([cx, cy]) => {
    comp(g, layer(W, H, (l) => { ell(l, cx, cy, 13, 10, 'h'); for (let y = cy + 1; y < H; y++) for (let x = 0; x < W; x++) l[y][x] = '.'; rect(l, cx - 9, cy - 5, 18, 1, 'a'); }, true), 0, 0);
    const rv = mkg(W, H); [[cx - 9, cy - 3], [cx + 9, cy - 3], [cx - 7, cy + 2], [cx + 7, cy + 2]].forEach(([x, y]) => put(rv, x, y, 'r')); comp(g, rv, 0, 0);
    hatchBox(g, cx - 4, cy - 10, 9, 4);
  });
  // side cannons
  [[14, 19], [124, 19]].forEach(([x, y]) => { const m = mkg(W, H); rect(m, x, y, 12, 5, 'm'); rect(m, x, y, 12, 1, 'M'); rect(m, x, y + 2, 2, 2, 'k'); rect(m, x + 5, y + 1, 1, 3, 'M'); outline(m, 'o'); comp(g, m, 0, 0); });
  // central big turret
  comp(g, layer(W, H, (l) => { ell(l, 75, 23, 23, 19, 'h'); for (let y = 24; y < H; y++) for (let x = 0; x < W; x++) l[y][x] = '.'; rect(l, 55, 15, 40, 1, 'a'); rect(l, 52, 20, 46, 1, 'a'); }, true), 0, 0);
  const mm = mkg(W, H); rect(mm, 34, 5, 26, 9, 'm'); rect(mm, 34, 5, 26, 2, 'M'); rect(mm, 34, 9, 4, 3, 'k'); rect(mm, 42, 9, 2, 3, 'r'); rect(mm, 50, 9, 2, 3, 'r'); outline(mm, 'o'); comp(g, mm, 0, 0);
  hatchBox(g, 69, 4, 12, 5);
  // armour studs on central turret
  const st = mkg(W, H); [[58, 12], [92, 12], [54, 25], [96, 25], [75, 14]].forEach(([x, y]) => { put(st, x, y, 'r'); put(st, x + 1, y, 'M'); }); comp(g, st, 0, 0);
  // angry eye slits on the hull
  const ey = mkg(W, H); [[58, 25], [78, 25]].forEach(([x, y]) => { rect(ey, x, y, 10, 4, 'k'); rect(ey, x + 1, y + 1, 8, 2, 'e'); rect(ey, x + 2, y + 2, 6, 1, 'E'); put(ey, x + 1, y, 'k'); put(ey, x + 8, y, 'k'); }); comp(g, ey, 0, 0);
  // spikes on the central turret and an antenna
  const sp = mkg(W, H); [[56, 8], [94, 8], [50, 13], [100, 13]].forEach(([x, y]) => { put(sp, x, y, 'r'); put(sp, x, y - 1, 'r'); put(sp, x, y - 2, 'M'); put(sp, x, y - 3, 'M'); });
  ln(sp, 88, 6, 92, 0, 'M'); put(sp, 92, 0, 'e'); outline(sp, 'o'); comp(g, sp, 0, 0);
  if (hurt) {
    cracks(g, [[62, 9], [63, 10], [62, 12], [63, 13], [64, 14], [24, 20], [25, 21], [26, 22], [120, 20], [121, 21], [40, 36], [41, 37], [75, 35], [76, 36], [77, 37], [118, 36], [119, 37]]);
    put(g, 74, 5, 'g'); put(g, 75, 5, 'G');
  }
  return g;
}
const BS = [0, 1, 2, 3].map((p) => boss(p, false)).concat([boss(0, true)]);
def('boss', BS.map(rows), Object.assign(TCOL(P.indigo, P.purple, P.navy, P.magenta, P.pink), { e: P.red, E: P.yellow }));
art.enemies.boss = {
  w: 150, h: 66, frames: { move: [0, 1, 2, 3], hurt: [4] },
  hatch: { x: 69, y: 4, w: 12, h: 5 },
  hatches: [{ x: 24, y: 15, w: 9, h: 4 }, { x: 69, y: 4, w: 12, h: 5 }, { x: 118, y: 15, w: 9, h: 4 }],
  turret: { x: 34, y: 9 }, barrelLen: 58, hp: 40
};

// ---------------------------------------------------------------- projectiles
function orb(S, cols, fr) {
  const g = mkg(S, S), c = (S - 1) / 2;
  ell(g, c, c, 3.6 + (fr ? 0.4 : 0), 3.6 + (fr ? 0.4 : 0), 'R');
  ell(g, c, c, 2.5, 2.5, 'O');
  ell(g, c + (fr ? 0.5 : -0.5), c, 1.4, 1.4, 'Y');
  put(g, c - 1, c - 1, 'W');
  if (fr) { put(g, c, 0, 'Y'); put(g, c, S - 1, 'Y'); put(g, 0, c, 'Y'); put(g, S - 1, c, 'Y'); }
  outline(g, 'o', false);
  return g;
}
def('shell', [orb(11, 0, 0), orb(11, 0, 1)].map(rows), { o: P.dark, R: P.red, O: P.orange, Y: P.yellow, W: P.white });
def('shell_p', [orb(11, 0, 0), orb(11, 0, 1)].map(rows), { o: P.dark, R: P.sky, O: P.cyan, Y: P.white, W: P.white });
function mortar(fr) {
  const g = mkg(11, 11);
  ell(g, 5, 6, 3.6, 3.6, 'a'); ell(g, 5, 6, 3.6, 3.6, 'a'); put(g, 4, 5, 'b'); put(g, 3, 6, 'b'); put(g, 4, 4, 'b');
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) if (g[y][x] === 'a' && (y > 7 || (x > 6 && y > 5))) g[y][x] = 'c';
  rect(g, 4, 1, 3, 1, 'c');
  outline(g, 'o', false);
  put(g, 5, 0, fr ? 'Y' : 'O'); put(g, fr ? 4 : 6, 0, fr ? 'O' : 'R');
  return g;
}
def('mortar', [mortar(0), mortar(1)].map(rows), { o: P.dark, a: P.steel, b: P.silver, c: P.charcoal, Y: P.yellow, O: P.orange, R: P.red });

function rocketDir(k, kind) {
  const S = 19, c = 9, g = mkg(S, S), a = k * Math.PI / 4, dx = Math.cos(a), dy = -Math.sin(a), nx = -dy, ny = dx;
  const thin = kind === 'missile';
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const rx = x - c, ry = y - c, u = rx * dx + ry * dy, v = rx * nx + ry * ny;
    const w = thin ? 0.95 : 1.4;
    let ch = null;
    if (u >= -5 && u <= 6) {
      const hw = u > 3 ? w * (6.6 - u) / 3.4 + 0.1 : w;
      if (Math.abs(v) <= hw) ch = u > 3 ? 'n' : (v < -0.3 ? 'W' : (v > 0.4 ? 'S' : 'B'));
      if (u > -5 && u < -2 && Math.abs(v) <= w + 1.7 && Math.abs(v) > w) ch = 'f';
    }
    if (u < -5 && u >= -8.5 && Math.abs(v) <= (thin ? 0.7 : 1.1) * (1 - (-5 - u) / 5)) ch = u > -6.5 ? 'Y' : 'O';
    if (ch) g[y][x] = ch;
  }
  outline(g, 'o', true);
  return g;
}
const rk = [], ms = [];
for (let k = 0; k < 8; k++) { rk.push(rocketDir(k, 'rocket')); ms.push(rocketDir(k, 'missile')); }
def('rocket', rk.map(rows), { o: P.dark, W: P.white, B: P.silver, S: P.grey, n: P.red, f: P.orange, Y: P.yellow, O: P.orange }, { anchor: { x: 9, y: 9 } });
def('missile', ms.map(rows), { o: P.dark, W: P.cream, B: P.red, S: P.darkred, n: P.yellow, f: P.charcoal, Y: P.yellow, O: P.orange }, { anchor: { x: 9, y: 9 } });

// ---------------------------------------------------------------- pickups
function pickup(name, builder, cols) {
  const fr = []; for (let k = 0; k < 6; k++) { const g = mkg(13, 13); builder(g, k); fr.push(g); }
  def(name, fr.map(rows), cols, { anchor: { x: 6, y: 6 } });
}
const sparkle = (g, x, y, c, big) => { put(g, x, y, c); if (big) { put(g, x - 1, y, c); put(g, x + 1, y, c); put(g, x, y - 1, c); put(g, x, y + 1, c); } };
const PU = { o: P.dark, w: P.white };

// shield
{
  const shape = ["aaaaaaaaaaa", "aaaaaaaaaaa", "aaaaaaaaaaa", "aaaaaaaaaaa", "aaaaaaaaaaa", "aaaaaaaaaaa", ".aaaaaaaaa.", ".aaaaaaaaa.", "..aaaaaaa..", "...aaaaa...", "....aaa....", ".....a....."];
  pickup('pu_shield', (g, k) => {
    const s = mkg(13, 13); blit(s, shape, 1, 0); shade(s, 'a', 'b', 'c');
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (s[y][x] === 'a' && (x === 2 || x === 12 || (y === 1 && x > 1))) s[y][x] = 'b';
    rect(s, 5, 3, 3, 7, 'w'); rect(s, 4, 5, 5, 3, 'w'); rect(s, 5, 4, 3, 5, 'd'); rect(s, 6, 3, 1, 7, 'w'); rect(s, 4, 6, 5, 1, 'w');
    const t = (k * 4) - 2;
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) { const d = x + y - t; if ((d === 0 || d === 1) && (s[y][x] === 'a' || s[y][x] === 'b' || s[y][x] === 'c')) s[y][x] = 'w'; }
    outline(s, 'o', false);
    comp(g, s, 0, 0);
    if (k === 1) sparkle(g, 11, 1, 'w', true); if (k === 4) sparkle(g, 1, 3, 'w', true);
  }, Object.assign({ a: P.blue, b: P.sky, c: P.navy, d: P.blue }, PU));
}
// slow (clock)
{
  pickup('pu_slow', (g, k) => {
    const s = mkg(13, 13);
    ell(s, 6, 6, 5.4, 5.4, 'c'); ell(s, 6, 6, 4.2, 4.2, 'a');
    [[6, 2], [10, 6], [6, 10], [2, 6]].forEach(([x, y]) => put(s, x, y, 'c'));
    put(s, 4, 3, 'w'); put(s, 3, 4, 'w');
    const ang = (k * 60 - 90) * Math.PI / 180;
    ln(s, 6, 6, 6 + Math.cos(ang) * 3, 6 + Math.sin(ang) * 3, 'd');
    ln(s, 6, 6, 6 + Math.cos(ang * 0.2 + 1.2) * 2, 6 + Math.sin(ang * 0.2 + 1.2) * 2, 'd');
    put(s, 6, 6, 'c');
    if (k === 2 || k === 5) for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (s[y][x] === 'c' && Math.hypot(x - 6, y - 6) > 4.6) s[y][x] = 'b';
    outline(s, 'o', false); comp(g, s, 0, 0);
    if (k === 0) sparkle(g, 11, 1, 'b', true); if (k === 3) sparkle(g, 1, 11, 'b', true);
  }, Object.assign({ a: P.cyan, b: P.white, c: P.blue, d: P.navy }, PU));
}
// magnet
{
  pickup('pu_magnet', (g, k) => {
    const s = mkg(13, 13);
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
      const d = Math.hypot(x - 6, y - 6.5);
      if (y >= 6 && d <= 5.6 && d >= 2.6) s[y][x] = 'a';
      if (((x >= 1 && x <= 3) || (x >= 9 && x <= 11)) && y >= 1 && y <= 6) s[y][x] = 'a';
    }
    shade(s, 'a', 'b', 'c');
    rect(s, 1, 1, 3, 3, 'w'); rect(s, 9, 1, 3, 3, 'w'); rect(s, 1, 3, 3, 1, 'g'); rect(s, 9, 3, 3, 1, 'g');
    outline(s, 'o', false); comp(g, s, 0, 0);
    const f = k % 3;
    if (f === 0) { put(g, 6, 2, 'y'); put(g, 5, 3, 'y'); put(g, 7, 3, 'y'); }
    if (f === 1) { put(g, 5, 1, 'y'); put(g, 6, 2, 'y'); put(g, 7, 1, 'y'); put(g, 6, 4, 'y'); }
    if (f === 2) { put(g, 6, 0, 'y'); put(g, 5, 2, 'y'); put(g, 7, 2, 'y'); put(g, 6, 3, 'w'); }
    if (k >= 3) { put(g, 4, 5, 'y'); put(g, 8, 5, 'y'); }
  }, Object.assign({ a: P.red, b: P.pink, c: P.darkred, g: P.steel, y: P.yellow }, PU));
}
// rockets
{
  pickup('pu_rockets', (g, k) => {
    const S = 13, s = mkg(S, S), a = Math.PI / 4, dx = Math.cos(a), dy = -Math.sin(a), nx = -dy, ny = dx;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const rx = x - 6.5 + 1, ry = y - 6 + 1, u = rx * dx + ry * dy, v = rx * nx + ry * ny;
      let ch = null;
      if (u >= -4.5 && u <= 5.5) {
        const hw = u > 2.5 ? 2.0 * (6.2 - u) / 3.7 + 0.1 : 2.0;
        if (Math.abs(v) <= hw) ch = u > 2.5 ? 'n' : (v < -0.6 ? 'W' : (v > 0.7 ? 'S' : 'B'));
        if (u < -1.5 && Math.abs(v) > 1.9 && Math.abs(v) <= 3.4) ch = 'f';
      }
      if (ch) s[y][x] = ch;
    }
    outline(s, 'o', true); comp(g, s, 0, 0);
    const fl = [0, 1, 2, 1, 0, 2][k];
    [[1, 12], [2, 11], [1, 11], [2, 12]].forEach(([x, y], i) => { if (i <= fl + 1) put(g, x, y, i < 2 ? 'Y' : 'O'); });
    if (k === 2) sparkle(g, 11, 11, 'Y', true); if (k === 5) sparkle(g, 2, 2, 'Y', true);
    put(g, 5, 7, 'W');
  }, { o: P.dark, W: P.white, B: P.silver, S: P.grey, n: P.red, f: P.orange, Y: P.yellow, O: P.orange });
}
// heart
{
  const big = ["aaa...aaa", "aaaaaaaaaaa".slice(0, 9), "aaaaaaaaa", "aaaaaaaaa", ".aaaaaaa.", "..aaaaa..", "...aaa...", "....a...."];
  const bigger = [".aaa...aaa.", "aaaaa.aaaaa", "aaaaaaaaaaa", "aaaaaaaaaaa", "aaaaaaaaaaa", ".aaaaaaaaa.", "..aaaaaaa..", "...aaaaa...", "....aaa....", ".....a....."];
  const small = [".aa...aa.", "aaaa.aaaa", "aaaaaaaaa", "aaaaaaaaa", ".aaaaaaa.", "..aaaaa..", "...aaa...", "....a...."];
  pickup('pu_heart', (g, k) => {
    const sh = [small, bigger, bigger, small, bigger, bigger][k];
    const s = mkg(13, 13); const w = sh[0].length, h = sh.length;
    blit(s, sh, Math.floor((13 - w) / 2), Math.floor((13 - h) / 2) + 1);
    shade(s, 'a', 'b', 'c');
    const ox = Math.floor((13 - w) / 2), oy = Math.floor((13 - h) / 2) + 1;
    put(s, ox + 1, oy + 1, 'w'); put(s, ox + 2, oy + 1, 'b'); put(s, ox + 1, oy + 2, 'b');
    outline(s, 'o', false); comp(g, s, 0, 0);
    if (k === 2) sparkle(g, 11, 1, 'w', true); if (k === 5) sparkle(g, 1, 2, 'w', true);
  }, Object.assign({ a: P.red, b: P.pink, c: P.darkred }, PU));
}
// star
{
  const starPts = (cx, cy, ro, ri) => { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / 5; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
  const inPoly = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; return c; };
  const pts = starPts(6, 6.6, 6.2, 2.7);
  const widths = [11, 9, 5, 2, 5, 9];
  pickup('pu_star', (g, k) => {
    let s = mkg(13, 13);
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (inPoly(pts, x + 0.5, y + 0.5)) s[y][x] = 'a';
    shade(s, 'a', 'b', 'c');
    put(s, 5, 5, 'w'); put(s, 6, 4, 'w'); put(s, 5, 6, 'b');
    s = squishX(s, widths[k]);
    outline(s, 'o', false); comp(g, s, 0, 0);
    if (k === 0) sparkle(g, 12, 1, 'w', false); if (k === 3) { sparkle(g, 2, 2, 'w', true); sparkle(g, 11, 10, 'y', true); }
  }, Object.assign({ a: P.yellow, b: P.cream, c: P.gold, y: P.yellow }, PU));
}
// coin 7x7
{
  const face = [".aaa.", "abaac", "abcac", "aaaac", ".ccc."];
  const fr = [];
  const widths = [5, 4, 3, 1, 3, 4];
  for (let k = 0; k < 6; k++) {
    const f = mkg(5, 5); blit(f, face, 0, 0);
    const sq = squishX(f, widths[k]);
    if (widths[k] === 1) for (let y = 0; y < 5; y++) sq[y][2] = (y === 0 || y === 4) ? 'c' : 'a';
    if (widths[k] === 1) { sq[0][2] = '.'; sq[4][2] = '.'; sq[1][2] = 'c'; sq[3][2] = 'c'; }
    const g = mkg(7, 7); comp(g, sq, 1, 1); outline(g, 'o', false);
    if (k === 5) put(g, 5, 1, 'w');
    fr.push(g);
  }
  def('coin', fr.map(rows), { o: P.brown, a: P.yellow, b: P.white, c: P.gold, w: P.white }, { anchor: { x: 3, y: 3 } });
}

// ---------------------------------------------------------------- effects
function bayer(x, y) { return [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y & 3][x & 3]; }
function blast(S, t, seed, extra) {
  const g = mkg(S, S), c = (S - 1) / 2, rnd = mulberry(seed);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
  const R = c * (0.28 + 0.72 * Math.min(1, Math.pow(t * 1.7, 0.55)));
  const hole = Math.max(0, (t - 0.45) * 1.25), fire = Math.max(0, 1 - t * 1.45);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const n = Math.sin(th * 3 + ph[0]) * 0.5 + Math.sin(th * 5 + ph[1]) * 0.3 + Math.sin(th * 8 + ph[2]) * 0.2;
    const rr = R * (1 + 0.2 * n);
    const d = r / rr;
    if (d > 1 || d < hole) continue;
    const e = (d - hole) / Math.max(0.01, 1 - hole);
    let ch;
    if (t < 0.13) ch = d < 0.55 ? 'W' : 'Y';
    else if (e < 0.22 * fire) ch = 'W';
    else if (e < 0.5 * fire) ch = 'Y';
    else if (e < 0.78 * fire) ch = 'O';
    else if (e < fire) ch = 'R';
    else ch = e < 0.8 ? 'S' : (((x + y) & 1) ? 's' : 'S');
    if (t > 0.6 && bayer(x, y) / 16 < ((t - 0.6) / 0.4) * 1.05) continue;
    if (e > 0.9 && t > 0.3 && ((x + y) & 1)) ch = ch === 'R' ? 'D' : 's';
    g[y][x] = ch;
  }
  // sparks
  if (t < 0.55) for (let i = 0; i < Math.round(S / 5); i++) {
    const a = rnd() * 6.283, rr = R * (1.05 + rnd() * 0.35 + t * 0.5);
    put(g, c + Math.cos(a) * rr, c + Math.sin(a) * rr, rnd() < 0.5 ? 'Y' : 'O');
  }
  return g;
}
const EXC = { W: P.white, Y: P.yellow, O: P.orange, R: P.red, D: P.darkred, S: P.steel, s: P.grey };
{
  const f = []; for (let k = 0; k < 8; k++) f.push(blast(32, k / 7, 11, 0));
  def('explosion', f.map(rows), EXC, { anchor: { x: 16, y: 16 } });
  const g = []; for (let k = 0; k < 10; k++) g.push(blast(64, k / 9, 23, 0));
  def('explosion_big', g.map(rows), EXC, { anchor: { x: 32, y: 32 } });
}
// smoke 5 frames 16x16
{
  const f = [];
  for (let k = 0; k < 5; k++) {
    const g = mkg(16, 16), r = 2.5 + k * 1.0;
    [[8, 9 - k * 0.6, r], [8 - r * 0.6, 10 - k * 0.3, r * 0.7], [8 + r * 0.6, 10 - k * 0.3, r * 0.7]].forEach(([cx, cy, rr]) => ell(g, cx, cy, rr, rr * 0.9, 'a'));
    shade(g, 'a', 'b', 'c');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (g[y][x] !== '.' && k > 1 && bayer(x, y) / 16 < (k - 1) / 4.2) g[y][x] = '.';
    f.push(g);
  }
  def('smoke', f.map(rows), { a: P.grey, b: P.silver, c: P.steel }, { anchor: { x: 8, y: 8 } });
}
// slash 48x48 (crescent, bulges right)
{
  const f = [], conf = [{ a: 28, off: 6 }, { a: 52, off: 7 }, { a: 76, off: 8 }, { a: 80, off: 11 }, { a: 80, off: 15 }];
  const R = 30, cy = 24;
  conf.forEach((cf, k) => {
    const g = mkg(48, 48), ax = 12, bx = ax - cf.off;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const da = Math.hypot(x - ax, y - cy), db = Math.hypot(x - bx, y - cy);
      if (da > R || db < R) continue;
      const ang = Math.abs(Math.atan2(y - cy, x - ax)) * 180 / Math.PI;
      if (ang > cf.a) continue;
      let ch = da > R - 1.6 ? 'C' : (db < R + 1.5 ? 'B' : 'W');
      if (k === 4 && ((x + y) & 1)) continue;
      if (k === 3 && ch === 'W' && ((x + y) % 3 === 0)) ch = 'C';
      g[y][x] = ch;
    }
    f.push(g);
  });
  def('slash', f.map(rows), { W: P.white, C: P.cyan, B: P.sky }, { anchor: { x: 12, y: 24 } });
}
// slash_big 96x96 (bold crescent, bulges right, centre anchor)
{
  const f = [], conf = [{ a: 34, off: 14 }, { a: 60, off: 18 }, { a: 82, off: 22 }, { a: 84, off: 27 }, { a: 84, off: 33 }];
  const R = 46, cy = 48, ax = 20, S = 96;
  conf.forEach((cf, k) => {
    const g = mkg(S, S), bx = ax - cf.off;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const da = Math.hypot(x - ax, y - cy), db = Math.hypot(x - bx, y - cy);
      if (da > R || db < R) continue;
      const ang = Math.abs(Math.atan2(y - cy, x - ax)) * 180 / Math.PI;
      if (ang > cf.a) continue;
      const thick = (da - (R - 0.0)) , inner = db - R; // inner: distance past the inner circle
      let ch = da > R - 2.4 ? 'b' : (da > R - 5 ? 'C' : (inner < 3 ? 'B' : 'W'));
      if (da > R - 2.4 && da > R - 1) ch = 'B';
      if (k === 3 && ch === 'W' && ((x + y) % 3 === 0)) ch = 'C';
      if (k === 4) { if (((x + y) & 1) || (ang > cf.a - 8 && (x & 1))) continue; if (ch === 'W') ch = 'C'; }
      g[y][x] = ch;
    }
    outline(g, 'o', false);
    // spark specks at the tips
    if (k >= 1 && k <= 3) {
      const ta = cf.a * Math.PI / 180;
      [1, -1].forEach((sg) => { const tx = Math.round(ax + (R + 3) * Math.cos(ta)), ty = Math.round(cy + sg * (R + 3) * Math.sin(ta)); put(g, tx, ty, 'W'); put(g, tx + 1, ty + sg * 2, 'C'); put(g, tx - 2, ty + sg * 3, 'W'); });
    }
    f.push(g);
  });
  def('slash_big', f.map(rows), { o: P.dark, W: P.white, C: P.cyan, B: P.sky, b: P.blue }, { anchor: { x: 48, y: 48 } });
}
// stick swing 50x62, anchor at hand (14,31)
{
  const angs = [-115, -78, -42, -6, 28, 58], f = [];
  const WW = 50, HH = 62, hx = 14, hy = 31, L = 28;
  angs.forEach((deg, k) => {
    const g = mkg(WW, HH);
    // solid motion-smear crescent behind the stick, tapering and fading
    if (k > 0) for (let y = 0; y < HH; y++) for (let x = 0; x < WW; x++) {
      const dx = x - hx, dy = y - hy, r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) * 180 / Math.PI, back = deg - a;
      const span = k === 5 ? 30 : 78;
      if (back < 2 || back > span) continue;
      const u = back / span;
      const rin = 13 + u * 8, rout = 34 - u * 8;
      if (r < rin || r > rout) continue;
      const m = (r - rin) / (rout - rin);
      let ch = m > 0.78 ? 'C' : (m < 0.22 ? 'b' : 'W');
      if (u > 0.55 && bayer(x, y) / 16 < (u - 0.55) * 2.2) continue;
      if (k === 5 && ((x + y) & 1)) continue;
      g[y][x] = ch;
    }
    if (k > 0) outline(g, 'q', false);
    const a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const sh = mkg(WW, HH);
    for (let y = 0; y < HH; y++) for (let x = 0; x < WW; x++) {
      const rx = x - hx, ry = y - hy, u = rx * dx + ry * dy, v = rx * nx + ry * ny;
      if (u < -3 || u > L || Math.abs(v) > 1.6) continue;
      let ch = v < -0.55 ? 'S' : (v > 0.55 ? 'B' : 'T');
      if (u < 7) ch = ((Math.floor(u) & 1) ? 'R' : 'r');
      if (u > L - 3) ch = v < -0.2 ? 'W' : 'C';
      sh[y][x] = ch;
    }
    outline(sh, 'o', false);
    comp(g, sh, 0, 0);
    f.push(g);
  });
  def('stick', f.map(rows), { o: P.dark, q: P.blue, b: P.sky, S: P.sand, T: P.tan, B: P.brown, R: P.red, r: P.darkred, W: P.white, C: P.cyan }, { anchor: { x: hx, y: hy } });
}
// hatch glow (centre anchor, ring grows outward)
{
  const f = [], S = [[22, 12], [22, 12], [22, 12], [22, 12]];
  const cols = ['W', 'Y', 'O', 'Y'];
  for (let k = 0; k < 4; k++) {
    const g = mkg(24, 14), hw = 5 + k * 1.5, hh = 2 + k * 1.2;
    const x0 = Math.round(12 - hw), x1 = Math.round(11 + hw), y0 = Math.round(7 - hh - 1), y1 = Math.round(6 + hh + 1);
    for (let x = x0; x <= x1; x++) { put(g, x, y0, cols[k]); put(g, x, y1, cols[k]); }
    for (let y = y0; y <= y1; y++) { put(g, x0, y, cols[k]); put(g, x1, y, cols[k]); }
    put(g, x0, y0, '.'); put(g, x1, y0, '.'); put(g, x0, y1, '.'); put(g, x1, y1, '.');
    if (k === 3) for (let y = 0; y < 14; y++) for (let x = 0; x < 24; x++) if (g[y][x] !== '.' && ((x + y) & 1)) g[y][x] = '.';
    f.push(g);
  }
  def('hatch_glow', f.map(rows), { W: P.white, Y: P.yellow, O: P.orange }, { anchor: { x: 12, y: 7 } });
}
// shield bubble 34x30
{
  const f = [];
  for (let k = 0; k < 4; k++) {
    const g = mkg(34, 30), rx = 16.2 + (k & 1) * 0.5, ry = 14.2 + (k & 1) * 0.4;
    for (let y = 0; y < 30; y++) for (let x = 0; x < 34; x++) {
      const dx = (x - 16.5) / rx, dy = (y - 14.5) / ry, d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (d > 0.82) g[y][x] = 'C';
      else if (d > 0.5 && ((x + y * 2 + k * 2) % 6 === 0)) g[y][x] = 'B';
      else if (((x + y) % 9 === k * 2) && d > 0.2) g[y][x] = 'B';
    }
    // rotating highlight arc
    for (let i = 0; i < 9; i++) {
      const a = (-2.3 + i * 0.12) + k * 0.5;
      put(g, 16.5 + Math.cos(a) * 14.4, 14.5 + Math.sin(a) * 12.5, 'W');
    }
    f.push(g);
  }
  def('shieldbubble', f.map(rows), { C: P.cyan, B: P.sky, W: P.white }, { anchor: { x: 17, y: 15 } });
}
// warn (exclamation sign)
{
  const f = [];
  for (let k = 0; k < 2; k++) {
    const g = mkg(16, 16);
    for (let y = 0; y < 13; y++) { const hw = Math.floor(y * 0.55); for (let x = 7 - hw; x <= 8 + hw; x++) put(g, x, y + 1, 'a'); }
    shade(g, 'a', 'b', 'c');
    outline(g, 'o', false);
    rect(g, 7, 5, 2, 5, 'k'); rect(g, 7, 11, 2, 2, 'k');
    f.push(g);
  }
  const m = { a: 'R', b: 'P', c: 'D', k: 'w' };
  const ff = f[1].map((r) => r.map((ch) => m[ch] || ch));
  def('warn', [f[0], ff].map(rows), { o: P.dark, a: P.yellow, b: P.cream, c: P.gold, k: P.dark, R: P.red, P: P.pink, D: P.darkred, w: P.white }, { anchor: { x: 8, y: 8 } });
}

// ---------------------------------------------------------------- icons (11x11, char X)
const ring = (g, cx, cy, r, c) => {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d >= r - 0.5 && d < r + 0.5) put(g, x, y, c);
  }
};
const poly = (g, pts, c) => { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; ln(g, a[0], a[1], b[0], b[1], c); } };
const fillPoly = (g, pts, c) => {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if (((a[1] > y + 0.5) !== (b[1] > y + 0.5)) && (x + 0.5 < (b[0] - a[0]) * (y + 0.5 - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;
    }
    if (inside) put(g, x, y, c);
  }
};
const ICONS = {};
const ico = (name, fn) => { const g = mkg(11, 11); fn(g, (x0, y0, x1, y1) => ln(g, x0, y0, x1, y1, 'X'), (x, y) => put(g, x, y, 'X')); ICONS[name] = rows(g); };
const SPK = ["....X......", "...XX......", "XXXXX......", "X...X......", "X...X......", "X...X......", "X...X......", "XXXXX......", "...XX......", "....X......"];
ico('ic_sound', (g, L, p) => { blit(g, SPK, 0, 0); L(6, 4, 6, 6); p(7, 2); p(8, 3); L(9, 4, 9, 6); p(8, 7); p(7, 8); });
ico('ic_mute', (g, L, p) => { blit(g, SPK, 0, 0); L(7, 3, 10, 6); L(10, 3, 7, 6); });
ico('ic_music', (g, L, p) => { L(4, 1, 4, 8); L(9, 1, 9, 8); L(4, 1, 9, 1); L(4, 2, 9, 2); ell(g, 3, 8, 1.7, 1.4, 'X'); ell(g, 8, 8, 1.7, 1.4, 'X'); });
ico('ic_pause', (g, L, p) => { [2, 6].forEach((x) => { L(x, 1, x + 2, 1); L(x, 9, x + 2, 9); L(x, 1, x, 9); L(x + 2, 1, x + 2, 9); }); });
ico('ic_play', (g, L, p) => { L(3, 1, 3, 9); L(3, 1, 9, 5); L(3, 9, 9, 5); });
ico('ic_back', (g, L, p) => { L(1, 5, 9, 5); L(1, 5, 5, 1); L(1, 5, 5, 9); });
ico('ic_lock', (g, L, p) => { L(1, 5, 9, 5); L(1, 5, 1, 10); L(9, 5, 9, 10); L(1, 10, 9, 10); L(3, 5, 3, 3); L(7, 5, 7, 3); L(4, 1, 6, 1); p(3, 2); p(7, 2); p(5, 7); p(5, 8); });
ico('ic_star', (g, L, p) => { const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.4 : 5.2, a = -Math.PI / 2 + i * Math.PI / 5; pts.push([5 + Math.cos(a) * r, 5.4 + Math.sin(a) * r]); } poly(g, pts, 'X'); });
ico('ic_trophy', (g, L, p) => { L(3, 1, 7, 1); L(3, 1, 3, 4); L(7, 1, 7, 4); L(3, 4, 4, 5); L(7, 4, 6, 5); L(4, 5, 6, 5); L(5, 6, 5, 7); L(4, 8, 6, 8); L(3, 9, 7, 9); p(2, 2); p(1, 2); p(1, 3); p(2, 4); p(8, 2); p(9, 2); p(9, 3); p(8, 4); });
const HEART = [".XXX...XXX.", "X...X.X...X", "X....X....X", "X.........X", ".X.......X.", "..X.....X..", "...X...X...", "....X.X....", ".....X....."];
ico('ic_heart_empty', (g) => { blit(g, HEART, 0, 1); });
ico('ic_heart', (g) => { blit(g, HEART, 0, 1); fillPoly(g, [[1, 2], [4, 2], [5, 3], [6, 2], [9, 2], [10, 4], [5, 9], [0, 4]], 'X'); });
ico('ic_coin', (g, L, p) => { ring(g, 5, 5, 4.6, 'X'); L(5, 3, 5, 7); p(4, 4); p(6, 6); });
ico('ic_skull', (g) => { blit(g, ["..XXXXXXX..", ".X.......X.", "X.........X", "X.XXX.XXX.X", "X.XXX.XXX.X", ".X...X...X.", "..X.....X..", "..XXXXXXX..", "..X.X.X.X..", "..XXXXXXX.."], 0, 0); });
ico('ic_clock', (g, L, p) => { ring(g, 5, 5, 4.6, 'X'); L(5, 5, 5, 2); L(5, 5, 7, 6); });
ico('ic_calendar', (g, L, p) => { L(1, 2, 9, 2); L(1, 2, 1, 10); L(9, 2, 9, 10); L(1, 10, 9, 10); L(1, 4, 9, 4); L(3, 0, 3, 1); L(7, 0, 7, 1); p(3, 6); p(5, 6); p(7, 6); p(3, 8); p(5, 8); });
ico('ic_share', (g, L, p) => { [[8, 1], [1, 4], [8, 7]].forEach(([x, y]) => { L(x, y, x + 2, y); L(x, y + 2, x + 2, y + 2); L(x, y, x, y + 2); L(x + 2, y, x + 2, y + 2); }); L(3, 4, 8, 2); L(3, 6, 8, 8); });
ico('ic_gear', (g, L, p) => { ring(g, 5, 5, 3, 'X'); ring(g, 5, 5, 1, 'X'); L(5, 0, 5, 1); L(5, 9, 5, 10); L(0, 5, 1, 5); L(9, 5, 10, 5); p(1, 1); p(9, 1); p(1, 9); p(9, 9); p(2, 2); p(8, 2); p(2, 8); p(8, 8); });
ico('ic_check', (g, L) => { L(1, 5, 4, 8); L(4, 8, 9, 2); });
ico('ic_rocket', (g) => { blit(g, [".....X.....", "....X.X....", "...X...X...", "...X...X...", "...X.X.X...", "...X...X...", "..XX...XX..", ".XXX...XXX.", "...XXXXX...", "....X.X...."], 0, 0); });
ico('ic_shield', (g) => { blit(g, [".XXXXXXXXX.", ".X...X...X.", ".X...X...X.", ".X...X...X.", ".X.......X.", "..X.....X..", "...X...X...", "....X.X....", ".....X....."], 0, 1); });
ico('ic_bolt', (g) => { poly(g, [[6, 0], [2, 6], [5, 6], [4, 10], [9, 4], [6, 4]], 'X'); });
ico('ic_target', (g, L, p) => { ring(g, 5, 5, 4.6, 'X'); ring(g, 5, 5, 2.2, 'X'); p(5, 5); });
ico('ic_hangar', (g, L, p) => { L(0, 4, 5, 0); L(5, 0, 10, 4); L(1, 4, 1, 10); L(9, 4, 9, 10); L(1, 10, 9, 10); L(3, 10, 3, 6); L(7, 10, 7, 6); L(3, 6, 7, 6); });
ico('ic_retry', (g, L, p) => { ring(g, 5, 6, 4, 'X'); for (let y = 0; y < 11; y++) for (let x = 6; x < 11; x++) if (y < 5) g[y][x] = '.'; L(5, 2, 8, 2); L(6, 0, 8, 2); L(6, 4, 8, 2); });
ico('ic_home', (g, L, p) => { L(0, 5, 5, 0); L(5, 0, 10, 5); L(2, 5, 2, 10); L(8, 5, 8, 10); L(2, 10, 8, 10); L(4, 10, 4, 7); L(6, 10, 6, 7); L(4, 7, 6, 7); });
ico('ic_info', (g, L, p) => { ring(g, 5, 5, 4.6, 'X'); p(5, 3); L(5, 5, 5, 7); });
ico('ic_flame', (g) => { blit(g, ["....X......", "...XX......", "..X.X..X...", ".X..XX.XX..", ".X...XX..X.", "X........X.", "X...XX...X.", "X..X..X..X.", ".X.X..X.X..", "..X.....X..", "...XXXXX..."], 0, 0); });
ico('ic_gift', (g) => { blit(g, ["...XX.XX...", "..X..X..X..", "...XXXXX...", "XXXXXXXXXXX", "X....X....X", "XXXXXXXXXXX", ".X...X...X.", ".X...X...X.", ".X...X...X.", ".X...X...X.", ".XXXXXXXXX."], 0, 0); });
Object.keys(ICONS).forEach((n) => def(n, [ICONS[n]], { X: '#ffffff' }));
art.iconNames = Object.keys(ICONS);

// ---------------------------------------------------------------- upgrade icons (15x15)
const UC = { o: P.dark, r: P.red, R: P.pink, d: P.darkred, y: P.yellow, Y: P.cream, g: P.gold, O: P.orange, b: P.blue, B: P.sky, c: P.cyan, w: P.white, s: P.steel, S: P.silver, n: P.navy, e: P.green, E: P.lime, p: P.purple, t: P.tan, k: P.brown, G: P.grey };
const up = (name, fn) => { const g = mkg(15, 15); fn(g); def('up_' + name, [rows(g)], UC); };
const finish = (g) => { outline(g, 'o', false); return g; };
const miniRocket = (g, cx, cy, deg, len, hw) => {
  const a = deg * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a), nx = -dy, ny = dx;
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const rx = x - cx, ry = y - cy, u = rx * dx + ry * dy, v = rx * nx + ry * ny;
    if (u < -len / 2 || u > len / 2) continue;
    const nose = len / 2 - 2.6;
    const w = u > nose ? hw * (len / 2 + 0.6 - u) / 3.2 : hw;
    if (Math.abs(v) <= w) g[y][x] = u > nose ? 'r' : (v < -0.4 ? 'w' : (v > 0.5 ? 'G' : 'S'));
    else if (u < -len / 2 + 3 && Math.abs(v) <= hw + 1.5) g[y][x] = 'O';
  }
};
up('maxhp', (g) => {
  const h = [".aaa...aaa.", "aaaaa.aaaaa", "aaaaaaaaaaa", "aaaaaaaaaaa", "aaaaaaaaaaa", ".aaaaaaaaa.", "..aaaaaaa..", "...aaaaa...", "....aaa....", ".....a....."].map((r) => r.replace(/a/g, 'r'));
  const s = mkg(15, 15); blit(s, h, 1, 3); shade(s, 'r', 'R', 'd'); put(s, 2, 5, 'w'); put(s, 3, 5, 'R'); put(s, 2, 6, 'R');
  outline(s, 'o', false); comp(g, s, 0, 0);
  rect(g, 11, 0, 1, 5, 'o'); rect(g, 9, 2, 5, 1, 'o'); rect(g, 11, 1, 1, 3, 'y'); rect(g, 10, 2, 3, 1, 'y');
});
up('dashcd', (g) => {
  const s = mkg(15, 15);
  [[1, 'g'], [5, 'O'], [9, 'y']].forEach(([x, c]) => { for (let i = 0; i < 5; i++) { put(s, x + 2 - Math.abs(i - 2) + 0, 3 + i, c); put(s, x + 3 - Math.abs(i - 2), 3 + i, c); put(s, x + 2 - Math.abs(i - 2) + 0, 8 + (4 - i) - 4 + 0, c); } });
  const t = mkg(15, 15);
  [[1, 'g'], [5, 'O'], [9, 'y']].forEach(([x, c]) => { for (let i = 0; i < 7; i++) { const d = 3 - Math.abs(i - 3); put(t, x + d, 4 + i, c); put(t, x + d + 1, 4 + i, c); } });
  outline(t, 'o', false); comp(g, t, 0, 0);
  rect(g, 0, 2, 4, 1, 'w'); rect(g, 0, 12, 3, 1, 'w');
});
up('parrywide', (g) => {
  const s = mkg(15, 15);
  ring(s, 7, 7, 6.4, 'c'); ring(s, 7, 7, 5.4, 'c'); ring(s, 7, 7, 3.4, 'B');
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (s[y][x] === 'B' && ((x + y) & 1)) s[y][x] = '.';
  outline(s, 'o', false); comp(g, s, 0, 0);
  ln(g, 5, 9, 9, 5, 'k'); ln(g, 6, 9, 10, 5, 't'); put(g, 10, 4, 'w'); put(g, 4, 10, 'r'); put(g, 5, 10, 'r');
});
up('ammo', (g) => {
  const s = mkg(15, 15); miniRocket(s, 6, 8, 45, 13, 2.0); outline(s, 'o', true); comp(g, s, 0, 0);
  rect(g, 11, 0, 1, 5, 'o'); rect(g, 9, 2, 5, 1, 'o'); rect(g, 11, 1, 1, 3, 'y'); rect(g, 10, 2, 3, 1, 'y');
});
up('splash', (g) => {
  const s = mkg(15, 15), pts = [];
  for (let i = 0; i < 16; i++) { const r = i % 2 ? 4 : 7.3, a = i * Math.PI / 8 - Math.PI / 2; pts.push([7 + Math.cos(a) * r, 7 + Math.sin(a) * r]); }
  fillPoly(s, pts, 'O'); ell(s, 7, 7, 3.6, 3.6, 'y'); ell(s, 7, 7, 1.8, 1.8, 'w');
  outline(s, 'o', false); comp(g, s, 0, 0);
});
up('magnet', (g) => {
  const s = mkg(15, 15);
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    const d = Math.hypot(x - 7, y - 7.5);
    if (y >= 7 && d <= 6.6 && d >= 3.2) s[y][x] = 'r';
    if (((x >= 1 && x <= 4) || (x >= 10 && x <= 13)) && y >= 1 && y <= 7) s[y][x] = 'r';
  }
  shade(s, 'r', 'R', 'd'); rect(s, 1, 1, 4, 4, 'S'); rect(s, 10, 1, 4, 4, 'S'); rect(s, 1, 4, 4, 1, 'G'); rect(s, 10, 4, 4, 1, 'G');
  outline(s, 'o', false); comp(g, s, 0, 0);
  put(g, 7, 2, 'y'); put(g, 6, 3, 'y'); put(g, 8, 3, 'y'); put(g, 7, 5, 'c');
});
up('combo', (g) => {
  const s = mkg(15, 15);
  for (let y = 0; y < 15; y++) { const t = y / 14, hw = 6.2 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.8), sh = 1.6 * Math.sin(t * 5) * (1 - t);
    for (let x = 0; x < 15; x++) if (Math.abs(x - 7 - sh) <= hw) s[y][x] = 'r'; }
  for (let y = 4; y < 15; y++) { const t = (y - 4) / 10, hw = 4 * Math.sin(Math.PI * Math.pow(t, 0.8)); for (let x = 0; x < 15; x++) if (Math.abs(x - 7 - 0.6 * Math.sin(t * 5)) <= hw && s[y][x] !== '.') s[y][x] = 'O'; }
  for (let y = 8; y < 14; y++) { const t = (y - 8) / 6, hw = 2.2 * Math.sin(Math.PI * Math.pow(t, 0.8)); for (let x = 0; x < 15; x++) if (Math.abs(x - 7) <= hw && s[y][x] !== '.') s[y][x] = 'y'; }
  put(s, 7, 11, 'w'); put(s, 7, 12, 'Y');
  outline(s, 'o', false); comp(g, s, 0, 0);
});
up('shield', (g) => {
  const shape = ["aaaaaaaaaaaaa", "aaaaaaaaaaaaa", "aaaaaaaaaaaaa", "aaaaaaaaaaaaa", "aaaaaaaaaaaaa", "aaaaaaaaaaaaa", "aaaaaaaaaaaaa", ".aaaaaaaaaaa.", ".aaaaaaaaaaa.", "..aaaaaaaaa..", "...aaaaaaa...", "....aaaaa....", ".....aaa....."];
  const s = mkg(15, 15); blit(s, shape, 1, 1); shade(s, 'a', 'B', 'n');
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (s[y][x] === 'a') s[y][x] = x < 7 ? 'b' : 'b';
  rect(s, 7, 3, 1, 9, 'c'); rect(s, 4, 6, 7, 1, 'c'); rect(s, 3, 2, 2, 1, 'w'); rect(s, 2, 3, 1, 3, 'w');
  outline(s, 'o', false); comp(g, s, 0, 0);
});
up('twin', (g) => {
  const s = mkg(15, 15); miniRocket(s, 4, 6, 90, 11, 1.7); miniRocket(s, 10, 8, 90, 11, 1.7);
  outline(s, 'o', true); comp(g, s, 0, 0);
});
up('chain', (g) => {
  const s = mkg(15, 15);
  poly(s, [[4, 11], [6, 8], [5, 7], [9, 4], [8, 6], [10, 3]].slice(0, 0), 'y');
  const z = [[3, 11], [6, 9], [5, 7], [9, 6], [8, 4], [11, 3]];
  for (let i = 0; i < z.length - 1; i++) ln(s, z[i][0], z[i][1], z[i + 1][0], z[i + 1][1], 'y');
  outline(s, 'o', false); comp(g, s, 0, 0);
  [[3, 11], [11, 3]].forEach(([x, y]) => { const e = mkg(15, 15); ell(e, x, y, 2.6, 2.6, 'r'); put(e, x - 1, y - 1, 'R'); outline(e, 'o', false); comp(g, e, 0, 0); });
});
up('thorns', (g) => {
  const s = mkg(15, 15);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, tx = 7 + Math.cos(a) * 6.8, ty = 7 + Math.sin(a) * 6.8; ln(s, 7 + Math.cos(a) * 3, 7 + Math.sin(a) * 3, tx, ty, 'S'); if (i % 2 === 0) ln(s, 7 + Math.cos(a) * 3, 7 + Math.sin(a) * 3, 7 + Math.cos(a + 0.2) * 5, 7 + Math.sin(a + 0.2) * 5, 'S'); }
  ell(s, 7, 7, 3.8, 3.8, 'e'); put(s, 5, 5, 'E'); put(s, 6, 5, 'E'); put(s, 5, 6, 'E');
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (s[y][x] === 'e' && Math.hypot(x - 7, y - 7) > 2.8 && x + y > 14) s[y][x] = 'e';
  outline(s, 'o', false); comp(g, s, 0, 0);
});
up('regen', (g) => {
  const s = mkg(15, 15), h = [".rr...rr.", "rrrr.rrrr", "rrrrrrrrr", "rrrrrrrrr", ".rrrrrrr.", "..rrrrr..", "...rrr...", "....r...."];
  blit(s, h, 3, 4); shade(s, 'r', 'R', 'd'); put(s, 4, 5, 'w'); put(s, 5, 5, 'R');
  outline(s, 'o', false); comp(g, s, 0, 0);
  const a = mkg(15, 15);
  for (let t = 0; t < 360; t += 6) { if ((t > 55 && t < 100) || (t > 235 && t < 280)) continue; const r = t * Math.PI / 180; put(a, 7 + Math.cos(r) * 6.6, 7 + Math.sin(r) * 6.6, 'e'); }
  put(a, 11, 2, 'E'); put(a, 12, 3, 'E'); put(a, 12, 1, 'E'); put(a, 3, 12, 'E'); put(a, 2, 11, 'E'); put(a, 2, 13, 'E');
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (a[y][x] !== '.' && g[y][x] === '.') g[y][x] = a[y][x];
});
art.upgradeIds = ['maxhp', 'dashcd', 'parrywide', 'ammo', 'splash', 'magnet', 'combo', 'shield', 'twin', 'chain', 'thorns', 'regen'];

// ---------------------------------------------------------------- logo
const FONT = {
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"]
};
function bigText(str, scale, adv, space) {
  const w = str.split('').reduce((a, ch) => a + (ch === ' ' ? space : adv), 0) - (adv - 5 * scale);
  const g = mkg(w, 7 * scale);
  let x = 0;
  for (const ch of str) {
    if (ch === ' ') { x += space; continue; }
    FONT[ch].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') rect(g, x + i * scale, j * scale, scale, scale, 'F'); });
    x += adv;
  }
  return g;
}
function chamfer(g) {
  const s = cp(g);
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (s[y][x] === '.') continue;
    const l = get(s, x - 1, y) === '.', r = get(s, x + 1, y) === '.', u = get(s, x, y - 1) === '.', d = get(s, x, y + 1) === '.';
    if ((l && u) || (r && u) || (l && d) || (r && d)) g[y][x] = '.';
  }
}
{
  const LW = 224, LH = 78, g = mkg(LW, LH);
  let t1 = bigText('SKY CAT', 5, 31, 16);
  { const pad = mkg(t1[0].length + 2, t1.length + 2); comp(pad, t1, 1, 1); const d = cp(pad); for (let y = 0; y < pad.length; y++) for (let x = 0; x < pad[0].length; x++) if (pad[y][x] === '.' && (get(pad, x - 1, y) !== '.' || get(pad, x + 1, y) !== '.' || get(pad, x, y - 1) !== '.' || get(pad, x, y + 1) !== '.')) d[y][x] = 'F'; t1 = d; }
  const tw = t1[0].length, th = t1.length;
  chamfer(t1);
  const ox = Math.floor((LW - tw - 3) / 2), oy = 9;
  // extrusion
  const ext = mkg(LW, LH);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (t1[y][x] !== '.') for (let k = 1; k <= 3; k++) put(ext, ox + x + k, oy + y + k, 'e');
  comp(g, ext, 0, 0);
  // fill with bands and edge lights
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (t1[y][x] === '.') continue;
    let c;
    const q = y / th;
    if (y < 2) c = 'W'; else if (q < 0.3) c = 'Y'; else if (q < 0.45) c = (x + y) & 1 ? 'Y' : 'G'; else if (q < 0.65) c = 'G';
    else if (q < 0.78) c = (x + y) & 1 ? 'G' : 'O'; else if (q < 0.92) c = 'O'; else c = 'g';
    if (get(t1, x - 1, y) === '.' && y > 1 && q < 0.9) c = 'C';
    if (get(t1, x + 1, y) === '.' && y > 3) c = q > 0.6 ? 'g' : 'O';
    put(g, ox + x, oy + y, c);
  }
  // cat ears on the A (proper triangles with pink inner ear)
  {
    const aX = ox + 140, e = mkg(LW, LH), top = oy - 9, base = oy + 2;
    fillPoly(e, [[aX + 1, base], [aX + 10, base], [aX + 2, top]], 'G');
    fillPoly(e, [[aX + 24, base], [aX + 15, base], [aX + 23, top]], 'G');
    fillPoly(e, [[aX + 3, base], [aX + 8, base], [aX + 3.6, top + 3]], 'P');
    fillPoly(e, [[aX + 22, base], [aX + 17, base], [aX + 21.4, top + 3]], 'P');
    ln(e, aX + 2, top, aX + 1, base - 1, 'Y'); ln(e, aX + 23, top, aX + 24, base - 1, 'Y');
    comp(g, e, 0, 0);
  }
  // outline 2px around everything
  const s1 = cp(g); outline(s1, 'o', true); outline(s1, 'o', true);
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) if (g[y][x] === '.') g[y][x] = s1[y][x];
  // ribbon with subtitle
  const sub = bigText('TANK TOPPLE', 2, 12, 10), sw = sub[0].length;
  const rx0 = Math.floor((LW - sw) / 2) - 12, rw = sw + 24, ry = 58;
  rect(g, rx0 - 1, ry - 1, rw + 2, 20, 'o'); rect(g, rx0, ry, rw, 18, 'G'); rect(g, rx0 + 1, ry + 1, rw - 2, 16, 'N'); rect(g, rx0 + 1, ry + 1, rw - 2, 1, 'u');
  rect(g, rx0 + 1, ry + 16, rw - 2, 1, 'I');
  for (let y = 0; y < 14; y++) for (let x = 0; x < sw; x++) if (sub[y][x] !== '.') { put(g, rx0 + 12 + x + 1, ry + 2 + y + 1, 'o'); }
  for (let y = 0; y < 14; y++) for (let x = 0; x < sw; x++) if (sub[y][x] !== '.') put(g, rx0 + 12 + x, ry + 2 + y, y < 2 ? 'W' : 'Y');
  // small sparkles
  [[10, 12], [212, 20], [20, 40], [204, 44]].forEach(([x, y]) => { put(g, x, y, 'W'); put(g, x - 1, y, 'C'); put(g, x + 1, y, 'C'); put(g, x, y - 1, 'C'); put(g, x, y + 1, 'C'); });
  def('logo', [rows(g)], { o: P.dark, e: P.darkred, W: P.white, Y: P.yellow, G: P.gold, O: P.orange, g: P.ginger, C: P.cream, P: P.pink, R: P.red, F: P.white, N: P.navy, u: P.blue, I: P.indigo });
}

// ---------------------------------------------------------------- backgrounds
const BW = 960, SW = 480, SH = 270, GY = 236;
// global char table for background grids
const CM = {
  W: P.white, Y: P.cream, S: P.silver, G: P.grey, T: P.steel, C: P.charcoal, D: P.dark,
  y: P.yellow, g: P.gold, o: P.orange, j: P.ginger, r: P.rust, B: P.brown, t: P.tan, a: P.sand, k: P.peach,
  R: P.red, d: P.darkred, K: P.pink, M: P.magenta, P: P.purple, I: P.indigo, N: P.navy, u: P.blue,
  e: P.sky, c: P.cyan, f: P.teal, L: P.lime, n: P.green, F: P.forest, E: P.deepgreen, x: P.plum
};
const RGB = {};
Object.keys(CM).forEach((k) => { const h = CM[k]; RGB[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; });
const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function gridCanvas(g) {
  const h = g.length, w = g[0].length, c = newCanvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h), d = id.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const rgb = RGB[g[j][i]]; if (!rgb) continue;
    const o = (j * w + i) * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return c;
}
const wrapX = (x) => ((x % BW) + BW) % BW;
const stamp = (g, o, x, y) => { for (let j = 0; j < o.length; j++) for (let i = 0; i < o[0].length; i++) if (o[j][i] !== '.') put(g, wrapX(x + i), y + j, o[j][i]); };
const mkWave = (seed, comps) => { const r = mulberry(seed), ph = comps.map(() => r() * 6.283); return (x) => comps.reduce((s, c, i) => s + c[1] * Math.sin(6.283185 * c[0] * x / BW + ph[i]), 0); };
const mkPeaks = (seed, comps) => { const r = mulberry(seed), ph = comps.map(() => r() * 6.283); return (x) => comps.reduce((s, c, i) => s + c[1] * (1 - Math.abs(Math.sin(3.14159 * c[0] * x / BW + ph[i]))), 0); };
function ridge(g, topFn, fill, edge, fog, fogH, edge2) {
  const H = g.length, w = g[0].length;
  for (let x = 0; x < w; x++) {
    const t = Math.round(topFn(x));
    for (let y = Math.max(0, t); y < H; y++) {
      let ch = y === t ? edge : (edge2 && y === t + 1 ? edge2 : fill);
      if (fog && y > H - fogH && bayer(x, y) / 16 < (y - (H - fogH)) / fogH) ch = fog;
      g[y][x] = ch;
    }
  }
}
const col = (x, y, ch, g) => put(g, x, y, ch);
// sky with dithered band transitions
function skyGrid(bands, zone) {
  const g = mkg(SW, SH);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    let i = 0; while (i < bands.length - 1 && y >= bands[i][1]) i++;
    let ch = bands[i][0];
    if (i > 0) { const b = bands[i - 1][1], p = (y - (b - zone / 2) + 0.5) / zone; if (p < 1 && bayer(x, y) / 16 >= p) ch = bands[i - 1][0]; }
    if (i < bands.length - 1) { const b = bands[i][1], p = (y - (b - zone / 2) + 0.5) / zone; if (p > 0 && p < 1 && bayer(x, y) / 16 < p) ch = bands[i + 1][0]; }
    g[y][x] = ch;
  }
  return g;
}
function discSun(g, cx, cy, r, body, rim, glow, glowR) {
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (glow && d > r && d < glowR && bayer(x, y) / 16 < 0.5 * (1 - (d - r) / (glowR - r))) g[y][x] = glow;
  }
  ell(g, cx, cy, r, r, body);
  if (rim) for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r && d > r - 2.2 && x + y > cx + cy) g[y][x] = rim; }
}
function stars(g, seed, n, maxY, cols) {
  const r = mulberry(seed), out = [];
  for (let i = 0; i < n; i++) { const x = Math.floor(r() * SW), y = Math.floor(r() * maxY), c = cols[Math.floor(r() * cols.length)]; if (g[y][x] !== '.') { put(g, x, y, c); if (r() < 0.25) out.push([x, y, 40 + Math.floor(r() * 60), Math.floor(r() * 100)]); } }
  return out;
}
// clouds layer (tile BW), body/shade chars
function cloudsGrid(seed, n, y0, y1, hi, mid, lo, scale) {
  const g = mkg(BW, 100), r = mulberry(seed);
  for (let i = 0; i < n; i++) {
    const cx = Math.floor((i + r() * 0.8) * BW / n), cy = 14 + Math.floor(r() * (y1 - y0)), w = Math.round((26 + r() * 40) * (scale || 1));
    const o = mkg(w + 16, 30);
    const k = 3 + Math.floor(r() * 3);
    for (let j = 0; j < k; j++) { const bx = 8 + (j + 0.5) * w / k, rr = (7 + r() * 6) * (scale || 1); ell(o, bx, 20 - rr * 0.5, rr * 1.2, rr, mid); }
    for (let y = 21; y < 30; y++) for (let x = 0; x < o[0].length; x++) o[y][x] = '.';
    const s = cp(o);
    for (let y = 0; y < 30; y++) for (let x = 0; x < o[0].length; x++) if (s[y][x] !== '.') {
      if (get(s, x, y - 1) === '.' || get(s, x, y - 2) === '.') o[y][x] = hi;
      else if (get(s, x, y + 1) === '.' || get(s, x, y + 2) === '.' || (y > 16 && (x + y) & 1)) o[y][x] = lo;
    }
    stamp(g, o, cx, cy + y0 - 20);
  }
  return g;
}
const mkLayer = (name, g, f, y) => ({ name, c: gridCanvas(g), f, y, w: g[0].length, h: g.length, blink: [] });

// small object builders --------------------------------------------------
function treeRound(r, crown, hi, trunk) {
  const o = mkg(r * 2 + 3, r * 2 + 8);
  rect(o, r + 0, r * 2 - 1, 3, 8, trunk);
  ell(o, r + 1, r, r, r * 0.95, crown);
  ell(o, r - 0.5, r - 1.5, r * 0.55, r * 0.45, hi);
  return o;
}
function pine(w, h, body, hi, snow) {
  const o = mkg(w, h), cx = (w - 1) / 2, tiers = Math.max(3, Math.round(h / 8));
  for (let t = 0; t < tiers; t++) {
    const y0 = Math.round(t * (h - 5) / tiers), y1 = Math.round((t + 1) * (h - 5) / tiers) + 3, tw = (w / 2) * (0.4 + 0.6 * (t + 1) / tiers);
    for (let y = y0; y <= Math.min(h - 4, y1); y++) { const u = (y - y0) / Math.max(1, y1 - y0), hw = tw * (0.15 + 0.85 * u); for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) put(o, x, y, x < cx - hw * 0.15 ? hi : body); }
    if (snow) for (let y = y0; y <= y0 + 2; y++) { const u = (y - y0) / Math.max(1, y1 - y0), hw = tw * (0.15 + 0.85 * u); for (let x = Math.round(cx - hw * 0.8); x <= Math.round(cx + hw * 0.8); x++) if (get(o, x, y) !== '.') put(o, x, y, snow); }
  }
  rect(o, Math.round(cx) - 1, h - 4, 2, 4, 'B');
  return o;
}
function building(w, h, body, edge, win, rnd, pWin, win2) {
  const o = mkg(w, h);
  rect(o, 0, 0, w, h, body); rect(o, 0, 0, w, 1, edge); rect(o, 0, 0, 1, h, edge);
  for (let y = 4; y < h - 3; y += 4) for (let x = 3; x < w - 3; x += 4) if (rnd() < pWin) { put(o, x, y, win2 && rnd() < 0.3 ? win2 : win); put(o, x + 1, y, win2 && rnd() < 0.3 ? win2 : win); }
  return o;
}


// richer ground strip: 1px light top edge, tufts, dithered dark band, stones and track marks (applied to every biome)
const GROUND_STYLE = [
  { base: ['B'], edge: 'L', edge2: 'n', dark: 'r', hi: 'S', lo: 'G', tuft: 'n', track: 'r', tuftHi: 'L' },
  { base: ['t'], edge: 'k', edge2: 'a', dark: 'B', hi: 'a', lo: 'r', tuft: 'j', track: 'B', tuftHi: 'k' },
  { base: ['C'], edge: 'c', edge2: 'f', dark: 'D', hi: 'T', lo: 'D', tuft: 'M', track: 'D', tuftHi: 'c' },
  { base: ['W', 'S'], edge: 'W', edge2: 'c', dark: 'e', hi: 'W', lo: 'G', tuft: 'c', track: 'e', tuftHi: 'W' },
  { base: ['T'], edge: 'S', edge2: 'G', dark: 'C', hi: 'G', lo: 'D', tuft: 'G', track: 'C', tuftHi: 'S' }
];
function groundDetail(g, st, seed) {
  const H = g.length, r = mulberry(seed), ok = (x, y) => y >= 0 && y < H && st.base.indexOf(g[y][wrapX(x)]) >= 0;
  // dithered darker band fading downward
  for (let y = 5; y < 12; y++) for (let x = 0; x < BW; x++) if (ok(x, y) && bayer(x, y) / 16 < (12 - y) / 8) g[y][x] = st.dark;
  // track marks: two dashed grooves with cross ticks
  [15, 25].forEach((ty, i) => {
    for (let x = i * 9; x < BW; x += 14) { for (let k = 0; k < 8; k++) if (ok(x + k, ty)) g[ty][wrapX(x + k)] = st.track; if (ok(x + 2, ty + 1)) g[ty + 1][wrapX(x + 2)] = st.track; if (ok(x + 5, ty - 1)) g[ty - 1][wrapX(x + 5)] = st.track; }
  });
  // stones: lit top, dark bottom
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(r() * BW), y = 6 + Math.floor(r() * (H - 9)), w = 2 + Math.floor(r() * 3);
    let fine = true; for (let k = 0; k < w; k++) if (!ok(x + k, y) || !ok(x + k, y + 1)) fine = false;
    if (!fine) continue;
    for (let k = 0; k < w; k++) { g[y][wrapX(x + k)] = st.hi; g[y + 1][wrapX(x + k)] = st.lo; }
  }
  // top edge: 1px light row, then a shadow row with tufts that rise into the edge
  for (let x = 0; x < BW; x++) { g[0][x] = st.edge; if (ok(x, 1) || g[1][x] === st.tuft) g[1][x] = (x & 1) && r() < 0.5 ? st.edge2 : g[1][x]; }
  for (let x = 0; x < BW; x += 3 + Math.floor(r() * 4)) { g[0][x] = st.tuftHi; if (g[1][wrapX(x)] !== st.edge) g[1][wrapX(x)] = st.tuft; if (r() < 0.5) { g[2][wrapX(x)] = st.tuft; g[2][wrapX(x + 1)] = st.tuft; } }
  for (let x = 0; x < BW; x++) if (g[2][x] === st.edge2 || bayer(x, 2) / 16 < 0.25) { if (st.base.indexOf(g[2][x]) >= 0) g[2][x] = st.edge2; }
}

const BIOME_DEF = [];

// ---- 1. Meadow Skies
BIOME_DEF.push({
  meta: { id: 'meadow', name: 'Meadow Skies', night: false, top: P.blue, mid: P.sky, low: P.cyan, ground: P.green, accent: P.yellow },
  build() {
    const sky = skyGrid([['u', 50], ['e', 112], ['c', 176], ['W', SH]], 14);
    discSun(sky, 392, 54, 13, 'y', 'g', 'Y', 26);
    const clouds = cloudsGrid(11, 9, 0, 90, 'W', 'W', 'c', 1);
    const far = mkg(BW, 130), pk = mkPeaks(3, [[3, 56], [7, 24], [13, 9]]);
    ridge(far, (x) => 100 - pk(x), 'u', 'e', 'c', 44);
    for (let x = 0; x < BW; x++) { const t = Math.round(100 - pk(x)); if (t < 34) for (let y = t; y < t + 9 - (34 - t) * 0.15; y++) if (far[y] && far[y][x] !== '.') far[y][x] = (x + y) & 1 ? 'W' : 'e'; }
    const mid = mkg(BW, 100), hw = mkWave(5, [[2, 8], [5, 5], [9, 3]]);
    const top = (x) => 100 - 44 + hw(x);
    ridge(mid, top, 'n', 'L', 'F', 14, 'L');
    for (let x = 0; x < BW; x++) for (let y = Math.round(top(x)) + 3; y < 100; y++) if (((x >> 2) + y) % 7 === 0 && mid[y][x] === 'n') mid[y][x] = 'F';
    const r = mulberry(8);
    for (let x = 6; x < BW; x += 30 + Math.floor(r() * 26)) { const rad = 4 + Math.floor(r() * 3); stamp(mid, treeRound(rad, 'F', 'n', 'B'), x, Math.round(top(x)) - rad * 2 + 1); }
    [[170], [610]].forEach(([wx]) => {
      const t = Math.round(top(wx)), mill = mkg(22, 40);
      trap(mill, 12, 38, 7, 14, 3, 18, 'Y'); rect(mill, 7, 12, 1, 26, 'S'); trap(mill, 6, 12, 8, 13, 6, 15, 'r');
      ln(mill, 10, 10, 2, 2, 'B'); ln(mill, 10, 10, 18, 18, 'B'); ln(mill, 10, 10, 18, 2, 'B'); ln(mill, 10, 10, 2, 18, 'B'); put(mill, 10, 10, 'D');
      rect(mill, 9, 30, 3, 8, 'B');
      stamp(mid, mill, wx, t - 38);
    });
    const near = mkg(BW, 56), rn = mulberry(21);
    for (let x = 0; x < BW; x += 22 + Math.floor(rn() * 30)) {
      const rr = 8 + Math.floor(rn() * 8), b = mkg(rr * 3, rr + 4);
      ell(b, rr * 1.5, rr + 2, rr * 1.4, rr, 'E'); ell(b, rr * 1.5 - 2, rr, rr * 0.7, rr * 0.5, 'F');
      for (let k = 0; k < 6; k++) { const px = Math.floor(rn() * rr * 2.6) + 2, py = Math.floor(rn() * rr) + 3; if (get(b, px, py) === 'F' || get(b, px, py) === 'E') put(b, px, py, 'L'); }
      stamp(near, b, x - rr, 56 - rr - 4 + 4);
    }
    for (let x = 4; x < BW; x += 16) { rect(near, x, 36, 2, 20, 'B'); rect(near, x, 36, 1, 20, 't'); }
    rect(near, 0, 40, BW, 2, 'B'); rect(near, 0, 40, BW, 1, 't'); rect(near, 0, 47, BW, 2, 'B'); rect(near, 0, 47, BW, 1, 't');
    for (let i = 0; i < 40; i++) { const x = Math.floor(rn() * BW), y = 49 + Math.floor(rn() * 6); put(near, x, y, ['R', 'y', 'W', 'K'][i & 3]); put(near, x, y - 1, 'n'); }
    const gr = mkg(BW, 34), rg = mulberry(33);
    for (let y = 0; y < 34; y++) for (let x = 0; x < BW; x++) gr[y][x] = y === 0 ? 'L' : (y < 3 ? 'n' : (y < 6 ? (bayer(x, y) / 16 < (6 - y) / 3.5 ? 'n' : 'B') : 'B'));
    for (let i = 0; i < 420; i++) { const x = Math.floor(rg() * BW), y = 6 + Math.floor(rg() * 28); put(gr, x, y, rg() < 0.5 ? 'r' : 't'); }
    for (let x = 0; x < BW; x += 3 + Math.floor(rg() * 5)) { put(gr, x, 0, 'L'); put(gr, x + 1, 0, 'n'); }
    for (let i = 0; i < 30; i++) { const x = Math.floor(rg() * BW); put(gr, x, 1, ['R', 'y', 'W'][i % 3]); }
    return { sky, clouds, far, mid, near, gr, twinkles: [] };
  },
  anim(ctx, sx, T) {
    for (let i = 0; i < 3; i++) {
      const x = ((i * 190 + 40 - sx * 0.7 + Math.sin(T * 0.03 + i) * 14) % 520 + 520) % 520 - 20, y = 150 + i * 22 + Math.sin(T * 0.05 + i * 2) * 8, f = ((T >> 3) + i) & 1;
      ctx.fillStyle = i === 1 ? P.pink : P.yellow;
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - (f ? 2 : 0), 2, 2); ctx.fillRect(Math.round(x) + 1, Math.round(y) - (f ? 2 : 0), 2, 2);
      ctx.fillStyle = P.dark; ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
    }
  }
});

// ---- 2. Dusk Canyon
BIOME_DEF.push({
  meta: { id: 'dusk', name: 'Dusk Canyon', night: false, top: P.indigo, mid: P.magenta, low: P.orange, ground: P.tan, accent: P.orange },
  build() {
    const sky = skyGrid([['I', 38], ['P', 86], ['M', 132], ['o', 184], ['y', SH]], 16);
    const tw = stars(sky, 5, 40, 70, ['W', 'S']);
    discSun(sky, 300, 150, 32, 'y', 'o', 'k', 52);
    ell(sky, 300, 150, 22, 22, 'Y');
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (Math.hypot(x - 300, y - 150) < 28 && Math.hypot(x - 300, y - 150) > 20 && (x + y) & 1) sky[y][x] = 'y';
    const clouds = cloudsGrid(17, 8, 0, 80, 'K', 'M', 'P', 1.1);
    const far = mkg(BW, 130), r = mulberry(4);
    { const tops = new Array(BW).fill(125);
      let x = 0;
      while (x < BW) { const w = 40 + Math.floor(r() * 60), h = 34 + Math.floor(r() * 50); for (let i = 0; i < w && x + i < BW; i++) { const edge = Math.min(i, w - i); tops[x + i] = Math.min(tops[x + i], 125 - h + (edge < 4 ? (4 - edge) * 2 : 0)); } x += w - 6 + Math.floor(r() * 24); }
      for (let i = 0; i < 6; i++) for (let xx = 0; xx < BW; xx++) tops[xx] = (tops[wrapX(xx - 1)] + tops[xx] + tops[wrapX(xx + 1)]) / 3 > tops[xx] ? tops[xx] : (tops[xx] * 2 + tops[wrapX(xx + 1)]) / 3;
      ridge(far, (xx) => tops[xx], 'P', 'M', 'o', 50, 'M'); }
    const mid = mkg(BW, 100), wv = mkWave(9, [[4, 6], [9, 4], [17, 2.5]]);
    const top = (x) => 100 - 56 + wv(x) + (Math.sin(x * 0.19) > 0.6 ? -4 : 0);
    ridge(mid, top, 'r', 'k', 'B', 0, 'o');
    const strata = ['r', 'j', 'r', 'B', 'j', 'r'];
    for (let x = 0; x < BW; x++) for (let y = Math.round(top(x)) + 2; y < 100; y++) { const bnd = Math.floor((y + Math.floor(x / 48)) / 7) % strata.length; mid[y][x] = ((y + 3) % 7 === 0 && (x + y) & 1) ? 'B' : strata[bnd]; if (y > 80 && bayer(x, y) / 16 < (y - 80) / 20) mid[y][x] = 'B'; }
    const near = mkg(BW, 56), rn = mulberry(31);
    for (let x = 8; x < BW; x += 40 + Math.floor(rn() * 60)) {
      if (rn() < 0.6) { const h = 22 + Math.floor(rn() * 16), c = mkg(14, h); rect(c, 5, 0, 4, h, 'F'); rect(c, 5, 0, 1, h, 'n'); rect(c, 1, 8, 2, 8, 'F'); rect(c, 1, 14, 6, 2, 'F'); rect(c, 11, 5, 2, 8, 'F'); rect(c, 8, 11, 5, 2, 'F'); rect(c, 1, 8, 1, 7, 'n'); rect(c, 11, 5, 1, 7, 'n'); outline(c, 'E', false); stamp(near, c, x, 56 - h); }
      else { const h = 20 + Math.floor(rn() * 24), s = mkg(12, h); trap(s, 0, h - 1, 5, 6, 0, 11, 'B'); for (let y = 0; y < h; y++) for (let xx = 0; xx < 12; xx++) if (s[y][xx] === 'B' && xx < 3 + y * 0.12) s[y][xx] = 'r'; stamp(near, s, x, 56 - h); }
    }
    for (let i = 0; i < 12; i++) { const x = Math.floor(rn() * BW), b = mkg(8, 6); ell(b, 4, 4, 3.6, 2.2, 'B'); put(b, 3, 3, 'r'); stamp(near, b, x, 50); }
    const gr = mkg(BW, 34), rg = mulberry(7);
    for (let y = 0; y < 34; y++) for (let x = 0; x < BW; x++) gr[y][x] = y === 0 ? 'k' : (y < 3 ? 'a' : 't');
    for (let i = 0; i < 520; i++) { const x = Math.floor(rg() * BW), y = 3 + Math.floor(rg() * 31); put(gr, x, y, rg() < 0.5 ? 'a' : 'B'); }
    for (let i = 0; i < 26; i++) { let x = Math.floor(rg() * BW), y = 4 + Math.floor(rg() * 8); for (let k = 0; k < 12; k++) { put(gr, wrapX(x), y, 'B'); x += rg() < 0.5 ? 1 : 2; y += rg() < 0.6 ? 1 : 0; } }
    for (let i = 0; i < 40; i++) { const x = Math.floor(rg() * BW), y = 8 + Math.floor(rg() * 24); rect(gr, x, y, 2, 1, 'r'); put(gr, x, y - 1, 'k'); }
    return { sky, clouds, far, mid, near, gr, twinkles: tw };
  },
  anim(ctx, sx, T) {
    for (let i = 0; i < 2; i++) {
      const x = ((i * 260 + 30 + T * 0.35 - sx * 0.2) % 560 + 560) % 560 - 40, y = 60 + i * 34 + Math.sin(T * 0.04 + i) * 5, f = (T >> 4) & 1;
      ctx.fillStyle = P.dark;
      ctx.fillRect(Math.round(x), Math.round(y) + (f ? 0 : 1), 2, 1); ctx.fillRect(Math.round(x) - 2, Math.round(y) + (f ? 1 : 0), 2, 1); ctx.fillRect(Math.round(x) + 2, Math.round(y) + (f ? 1 : 0), 2, 1);
    }
  }
});

// ---- 3. Neon City (night)
BIOME_DEF.push({
  meta: { id: 'neon', name: 'Neon City', night: true, top: P.dark, mid: P.indigo, low: P.magenta, ground: P.charcoal, accent: P.cyan },
  build() {
    const sky = skyGrid([['D', 44], ['N', 96], ['I', 150], ['P', 200], ['M', SH]], 16);
    const tw = stars(sky, 15, 90, 130, ['W', 'S', 'c', 'S']);
    discSun(sky, 86, 54, 16, 'Y', 'a', 'x', 30);
    [[80, 48, 3], [92, 58, 2], [84, 62, 2], [94, 47, 1]].forEach(([x, y, r]) => ell(sky, x, y, r, r, 'a'));
    const clouds = cloudsGrid(41, 7, 20, 80, 'M', 'P', 'I', 1.1);
    const far = mkg(BW, 130), r = mulberry(55), blinkF = [];
    for (let x = 0; x < BW;) { const w = 14 + Math.floor(r() * 14), h = 30 + Math.floor(r() * 60), b = building(w, h, 'I', 'P', 'y', r, 0.32, 'c'); stamp(far, b, x, 130 - h); if (r() < 0.3) { rect(far, wrapX(x + Math.floor(w / 2)), 130 - h - 6, 1, 6, 'I'); put(far, wrapX(x + Math.floor(w / 2)), 130 - h - 7, 'R'); blinkF.push({ x: wrapX(x + Math.floor(w / 2)), y: 130 - h - 7, w: 1, h: 1, ch: P.red, per: 60, on: 30, ph: Math.floor(r() * 60) }); } x += w + 1 + Math.floor(r() * 4); }
    for (let y = 100; y < 130; y++) for (let x = 0; x < BW; x++) if (bayer(x, y) / 16 < (y - 100) / 40 && far[y][x] !== '.') far[y][x] = 'M';
    const mid = mkg(BW, 100), rm = mulberry(66), blinkM = [];
    for (let x = 0; x < BW;) {
      const w = 18 + Math.floor(rm() * 20), h = 40 + Math.floor(rm() * 56), b = building(w, h, 'N', 'I', 'y', rm, 0.25, 'K');
      for (let y = 4; y < h - 3; y += 4) for (let xx = 3; xx < w - 3; xx += 4) if (get(b, xx, y) === '.') { }
      stamp(mid, b, x, 100 - h);
      const k = rm();
      if (k < 0.35) { const sw = Math.min(w - 4, 10), sc = ['M', 'c', 'y'][Math.floor(rm() * 3)], sy = 100 - h + 8 + Math.floor(rm() * 14); rect(mid, wrapX(x + 2), sy, sw, 5, 'D'); rect(mid, wrapX(x + 3), sy + 1, sw - 2, 3, sc); blinkM.push({ x: wrapX(x + 3), y: sy + 1, w: sw - 2, h: 3, ch: CM[sc], per: 90, on: 70, ph: Math.floor(rm() * 90) }); }
      else if (k < 0.55) { rect(mid, wrapX(x + 3), 100 - h - 7, 8, 7, 'N'); rect(mid, wrapX(x + 3), 100 - h - 7, 8, 1, 'I'); rect(mid, wrapX(x + 6), 100 - h - 10, 1, 4, 'N'); }
      if (rm() < 0.4) blinkM.push({ x: wrapX(x + 4 + Math.floor(rm() * (w - 8))), y: 100 - h + 6 + Math.floor(rm() * (h - 14)), w: 2, h: 2, ch: P.yellow, per: 120, on: 50, ph: Math.floor(rm() * 120) });
      x += w + Math.floor(rm() * 3);
    }
    for (let y = 80; y < 100; y++) for (let x = 0; x < BW; x++) if (bayer(x, y) / 16 < (y - 80) / 36 && mid[y][x] === 'N') mid[y][x] = 'I';
    const near = mkg(BW, 56), rn = mulberry(77), blinkN = [];
    for (let x = 12; x < BW; x += 60 + Math.floor(rn() * 40)) {
      rect(near, x, 10, 2, 46, 'C'); rect(near, x - 5, 8, 12, 2, 'C'); rect(near, x - 6, 10, 4, 2, 'y'); rect(near, x + 4, 10, 4, 2, 'y');
      for (let yy = 12; yy < 40; yy++) for (let xx = x - 9; xx < x + 11; xx++) if (get(near, xx, yy) === '.' && Math.hypot(xx - x - 1, yy - 12) < 18 && bayer(xx, yy) / 16 < 0.35 * (1 - Math.hypot(xx - x - 1, yy - 12) / 18)) put(near, wrapX(xx), yy, 'y');
      blinkN.push({ x: x - 6, y: 10, w: 4, h: 2, ch: P.white, per: 150, on: 130, ph: Math.floor(rn() * 150) });
    }
    for (let x = 0; x < BW; x += 4) { const y = 14 + Math.round(Math.sin(x * 0.04) * 3); put(near, x, y + 8, 'C'); put(near, x + 1, y + 8, 'C'); put(near, x + 2, y + 9, 'C'); put(near, x + 3, y + 9, 'C'); }
    const gr = mkg(BW, 34), rg = mulberry(8);
    for (let y = 0; y < 34; y++) for (let x = 0; x < BW; x++) gr[y][x] = y === 0 ? 'c' : (y === 1 ? 'f' : (y < 4 ? 'T' : 'C'));
    for (let i = 0; i < 360; i++) put(gr, Math.floor(rg() * BW), 5 + Math.floor(rg() * 29), rg() < 0.5 ? 'T' : 'D');
    for (let x = 0; x < BW; x += 32) rect(gr, x, 17, 16, 2, 'y');
    for (let x = 0; x < BW; x += 8) put(gr, x, 31, 'M');
    rect(gr, 0, 8, BW, 1, 'M'); rect(gr, 0, 30, BW, 1, 'c');
    return { sky, clouds, far, mid, near, gr, twinkles: tw, blink: { far: blinkF, mid: blinkM, near: blinkN, gr: [] } };
  },
  anim() {}
});

// ---- 4. Frost Peaks
BIOME_DEF.push({
  meta: { id: 'frost', name: 'Frost Peaks', night: false, top: P.sky, mid: P.cyan, low: P.white, ground: P.white, accent: P.cyan },
  build() {
    const sky = skyGrid([['e', 56], ['c', 118], ['W', 190], ['Y', SH]], 14);
    discSun(sky, 112, 48, 10, 'Y', 'a', 'W', 24);
    const clouds = cloudsGrid(71, 8, 10, 90, 'W', 'W', 'S', 1.2);
    const far = mkg(BW, 130), pk = mkPeaks(12, [[2, 60], [3, 34], [7, 12]]);
    ridge(far, (x) => 104 - pk(x), 'G', 'W', 'S', 40);
    for (let x = 0; x < BW; x++) { const t = Math.round(104 - pk(x)); const depth = 10 + Math.max(0, (60 - t)) * 0.35; for (let y = t; y < t + depth; y++) if (far[y]) far[y][x] = (y - t > depth - 3 && (x + y) & 1) ? 'S' : 'W'; for (let y = t + depth; y < 124; y++) if (far[y] && ((x + y * 2) % 9 === 0) && far[y][x] === 'G') far[y][x] = 'T'; }
    const mid = mkg(BW, 100), hw = mkWave(19, [[3, 7], [6, 4], [11, 3]]);
    const top = (x) => 100 - 40 + hw(x);
    ridge(mid, top, 'S', 'W', 'c', 12, 'W');
    for (let x = 0; x < BW; x++) for (let y = Math.round(top(x)) + 4; y < 100; y++) if (((x >> 1) + y) % 6 === 0 && mid[y][x] === 'S') mid[y][x] = 'c';
    const r = mulberry(13);
    for (let x = 4; x < BW; x += 14 + Math.floor(r() * 18)) { const h = 14 + Math.floor(r() * 14), w = 8 + Math.floor(h / 3); stamp(mid, pine(w, h, 'E', 'F', 'W'), x, Math.round(top(x)) - h + 3); }
    const near = mkg(BW, 56), rn = mulberry(23);
    for (let x = 0; x < BW; x += 26 + Math.floor(rn() * 34)) { const h = 30 + Math.floor(rn() * 22), w = 16 + Math.floor(h / 3); stamp(near, pine(w, h, 'E', 'F', 'W'), x, 56 - h); }
    for (let i = 0; i < 14; i++) { const x = Math.floor(rn() * BW), h = 6 + Math.floor(rn() * 6), c = mkg(7, h); trap(c, 0, h - 1, 3, 3, 0, 6, 'c'); for (let y = 0; y < h; y++) if (c[y][3] === 'c') c[y][3] = 'W'; outline(c, 'e', false); stamp(near, c, x, 56 - h); }
    const gr = mkg(BW, 34), rg = mulberry(3);
    for (let y = 0; y < 34; y++) for (let x = 0; x < BW; x++) gr[y][x] = y < 2 ? 'W' : (y < 5 ? (bayer(x, y) / 16 < (5 - y) / 3.2 ? 'W' : 'c') : (((x >> 3) + (y >> 2)) % 5 === 0 ? 'S' : 'W'));
    for (let i = 0; i < 460; i++) { const x = Math.floor(rg() * BW), y = 4 + Math.floor(rg() * 30); put(gr, x, y, rg() < 0.6 ? 'c' : 'S'); put(gr, x + 1, y, 'c'); }
    for (let i = 0; i < 18; i++) { const x = Math.floor(rg() * BW), b = mkg(14, 5); ell(b, 7, 4, 6.5, 3.4, 'W'); for (let k = 0; k < 14; k++) if (b[4][k] === 'W') b[4][k] = 'c'; stamp(gr, b, x, 2 + Math.floor(rg() * 10)); }
    const spark = []; for (let i = 0; i < 28; i++) spark.push({ x: Math.floor(rg() * BW), y: 3 + Math.floor(rg() * 28), w: 1, h: 1, ch: P.sky, per: 50 + Math.floor(rg() * 40), on: 8, ph: Math.floor(rg() * 90) });
    return { sky, clouds, far, mid, near, gr, twinkles: [], blink: { far: [], mid: [], near: [], gr: spark } };
  },
  anim(ctx, sx, T) {
    for (let i = 0; i < 46; i++) {
      const sp = 0.5 + (i % 4) * 0.3, x = ((i * 53 + T * 0.4 * (1 + (i % 3) * 0.3) - sx * (0.3 + (i % 3) * 0.1) + Math.sin(T * 0.02 + i) * 6) % 500 + 500) % 500 - 10;
      const y = ((i * 37 + T * sp) % 250);
      ctx.fillStyle = i % 5 === 0 ? P.cyan : P.white;
      ctx.fillRect(Math.round(480 - x), Math.round(y), i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }
  }
});

// ---- 5. Moon Base
BIOME_DEF.push({
  meta: { id: 'moon', name: 'Moon Base', night: true, top: P.dark, mid: P.charcoal, low: P.navy, ground: P.grey, accent: P.cyan },
  build() {
    const sky = skyGrid([['D', 110], ['C', 190], ['N', SH]], 20);
    const tw = stars(sky, 91, 150, 200, ['W', 'S', 'G', 'W', 'c']);
    // earth
    ell(sky, 384, 62, 24, 24, 'u');
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const d = Math.hypot(x - 384, y - 62); if (d < 24) { if (x > 384 + 6 && bayer(x, y) / 16 < (x - 390) / 18) sky[y][x] = 'N'; } }
    [[375, 56, 7, 5], [392, 70, 6, 4], [380, 72, 4, 3], [396, 52, 3, 2]].forEach(([x, y, rx, ry]) => { for (let yy = y - ry; yy <= y + ry; yy++) for (let xx = x - rx; xx <= x + rx; xx++) if (Math.hypot(xx - 384, yy - 62) < 23 && ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2 <= 1) sky[yy][xx] = (xx > 394 && bayer(xx, yy) / 16 < 0.5) ? 'F' : 'n'; });
    [[372, 50, 8], [388, 66, 9], [380, 78, 6], [398, 58, 5]].forEach(([x, y, w]) => { for (let i = 0; i < w; i++) { put(sky, x + i, y, 'W'); if (i > 1 && i < w - 1) put(sky, x + i, y + 1, 'c'); } });
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const d = Math.hypot(x - 384, y - 62); if (d >= 24 && d < 25.5 && x < 396) sky[y][x] = 'e'; }
    const clouds = mkg(BW, 100);
    const far = mkg(BW, 130), pk = mkPeaks(88, [[4, 30], [9, 14], [17, 6]]);
    ridge(far, (x) => 125 - pk(x) - 6, 'T', 'G', 'C', 30, 'G');
    for (let x = 0; x < BW; x++) for (let y = Math.round(125 - pk(x) - 6) + 2; y < 125; y++) if (far[y][x] === 'T' && ((x * 2 + y) % 11 < 2)) far[y][x] = 'C';
    const mid = mkg(BW, 100), rm = mulberry(5), blinkM = [];
    const wv = mkWave(2, [[5, 4], [11, 2]]);
    ridge(mid, (x) => 100 - 22 + wv(x), 'G', 'S', 'T', 0, 'S');
    for (let x = 30; x < BW; x += 70 + Math.floor(rm() * 80)) {
      const k = rm(), t = Math.round(100 - 22 + wv(x));
      if (k < 0.4) { const d = mkg(34, 22); ell(d, 17, 21, 16, 20, 'c'); for (let y = 0; y < 22; y++) for (let xx = 0; xx < 34; xx++) if (d[y][xx] === 'c' && (xx + y * 2) % 8 === 0) d[y][xx] = 'W'; for (let y = 0; y < 22; y++) for (let xx = 0; xx < 34; xx++) if (d[y][xx] === 'c' && Math.hypot(xx - 17, y - 21) > 15) d[y][xx] = 'S'; rect(d, 0, 21, 34, 3, 'T'); outline(d, 'C', false); stamp(mid, d, x, t - 20); }
      else if (k < 0.75) { const h = 40 + Math.floor(rm() * 30), tw2 = mkg(10, h); rect(tw2, 1, 6, 8, h - 6, 'S'); rect(tw2, 1, 6, 2, h - 6, 'W'); rect(tw2, 7, 6, 2, h - 6, 'T'); rect(tw2, 0, 3, 10, 4, 'G'); rect(tw2, 4, 0, 2, 4, 'T'); for (let y = 10; y < h - 2; y += 5) rect(tw2, 3, y, 4, 2, 'c'); outline(tw2, 'C', false); stamp(mid, tw2, x, t - h + 4); blinkM.push({ x: wrapX(x + 4), y: t - h + 4, w: 2, h: 2, ch: P.red, per: 80, on: 40, ph: Math.floor(rm() * 80) }); }
      else { const s = mkg(40, 12); trap(s, 0, 11, 6, 33, 0, 39, 'u'); for (let y = 0; y < 12; y += 3) rect(s, 0, y, 40, 1, 'N'); for (let xx = 0; xx < 40; xx += 6) for (let y = 0; y < 12; y++) if (s[y][xx] === 'u') s[y][xx] = 'N'; outline(s, 'C', false); stamp(mid, s, x, t - 10); }
    }
    const near = mkg(BW, 56), rn = mulberry(61), blinkN = [];
    for (let x = 6; x < BW; x += 30 + Math.floor(rn() * 40)) { const rr = 5 + Math.floor(rn() * 9), b = mkg(rr * 2 + 4, rr + 3); ell(b, rr + 2, rr + 2, rr + 1, rr, 'T'); ell(b, rr, rr, rr * 0.5, rr * 0.5, 'G'); put(b, rr - 2, rr - 2, 'S'); outline(b, 'C', false); stamp(near, b, x, 56 - rr - 3 + 2); }
    for (let x = 40; x < BW; x += 150) { rect(near, x, 24, 2, 32, 'S'); rect(near, x - 3, 22, 8, 3, 'T'); rect(near, x - 3, 22, 8, 1, 'c'); blinkN.push({ x, y: 20, w: 2, h: 2, ch: P.red, per: 70, on: 35, ph: (x * 3) % 70 }); }
    const gr = mkg(BW, 34), rg = mulberry(9), blinkG = [];
    for (let y = 0; y < 34; y++) for (let x = 0; x < BW; x++) gr[y][x] = y === 0 ? 'S' : (y < 3 ? 'G' : 'T');
    for (let i = 0; i < 380; i++) put(gr, Math.floor(rg() * BW), 3 + Math.floor(rg() * 31), rg() < 0.5 ? 'C' : 'G');
    for (let i = 0; i < 22; i++) { const x = Math.floor(rg() * BW), rx = 4 + Math.floor(rg() * 8), y = 6 + Math.floor(rg() * 22), c = mkg(rx * 2 + 3, 8); ell(c, rx + 1, 4, rx + 1, 3, 'G'); ell(c, rx + 1, 4.5, rx, 2.4, 'C'); stamp(gr, c, x, y); }
    for (let x = 0; x < BW; x += 16) { for (let k = 0; k < 8; k++) { put(gr, x + k, 26, 'y'); put(gr, x + k, 27, 'y'); put(gr, x + k, 28, 'y'); } for (let k = 0; k < 8; k++) { put(gr, x + 8 + k, 26, 'D'); put(gr, x + 8 + k, 27, 'D'); put(gr, x + 8 + k, 28, 'D'); } }
    for (let y = 26; y <= 28; y++) for (let x = 0; x < BW; x++) if ((((x + y * 3) >> 2) & 1) === 0) gr[y][x] = gr[y][x] === 'y' ? 'D' : 'y';
    for (let x = 4; x < BW; x += 48) blinkG.push({ x, y: 31, w: 2, h: 2, ch: x % 96 === 4 ? P.cyan : P.red, per: 60, on: 30, ph: (x >> 3) % 60 });
    return { sky, clouds, far, mid, near, gr, twinkles: tw, blink: { far: [], mid: blinkM, near: blinkN, gr: blinkG } };
  },
  anim() {}
});

art.biomes = BIOME_DEF.map((b) => b.meta);
const bgCache = [];
function getBg(i) {
  i = ((Math.round(i) % BIOME_DEF.length) + BIOME_DEF.length) % BIOME_DEF.length;
  if (bgCache[i]) return bgCache[i];
  const d = BIOME_DEF[i].build(), b = d.blink || {};
  groundDetail(d.gr, GROUND_STYLE[i], 400 + i);
  const bg = {
    i, sky: gridCanvas(d.sky), twinkles: d.twinkles || [], anim: BIOME_DEF[i].anim,
    layers: [
      { k: 'clouds', c: gridCanvas(d.clouds), f: 0.08, y: 14, w: BW, drift: 0.12, blink: [] },
      Object.assign(mkLayer('far', d.far, 0.12, GY - 130), { blink: b.far || [] }),
      Object.assign(mkLayer('mid', d.mid, 0.3, GY - 100), { blink: b.mid || [] }),
      Object.assign(mkLayer('near', d.near, 0.62, GY - 56 + 2), { blink: b.near || [] }),
      Object.assign(mkLayer('ground', d.gr, 1, GY), { blink: b.gr || [] })
    ]
  };
  bgCache[i] = bg;
  return bg;
}
function paintBiome(ctx, i, sx, t) {
  const bg = getBg(i), T = (typeof SC.frame === 'number') ? SC.frame : Math.floor((t || 0) * 60);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bg.sky, 0, 0);
  bg.twinkles.forEach((s) => { if (((T + s[3]) % s[2]) < 8) { ctx.fillStyle = P.white; ctx.fillRect(s[0], s[1], 1, 1); ctx.fillRect(s[0] - 1, s[1], 3, 1); ctx.fillRect(s[0], s[1] - 1, 1, 3); } });
  bg.layers.forEach((L, li) => {
    let off = Math.floor(sx * L.f + (L.drift ? T * L.drift : 0)) % BW; if (off < 0) off += BW;
    ctx.drawImage(L.c, -off, L.y); ctx.drawImage(L.c, BW - off, L.y);
    L.blink.forEach((q) => { if (((T + q.ph) % q.per) < q.on) { ctx.fillStyle = q.ch; ctx.fillRect(q.x - off, L.y + q.y, q.w, q.h); ctx.fillRect(q.x - off + BW, L.y + q.y, q.w, q.h); } });
    if (li === 3 && bg.anim && bg.i !== 3) bg.anim(ctx, sx, T);
  });
  if (bg.i === 3 && bg.anim) bg.anim(ctx, sx, T);
}
art.drawBackground = (biomeIndex, scrollX, t) => paintBiome(SC.ctx, biomeIndex, scrollX || 0, t);

// ordered-dither dissolve between two biomes
let blendCanvas = null; const bayerPat = [];
art.drawBackgroundBlend = (a, b, k, scrollX, t) => {
  const ctx = SC.ctx;
  k = Math.max(0, Math.min(1, k));
  if (k <= 0) { paintBiome(ctx, a, scrollX || 0, t); return; }
  if (k >= 1) { paintBiome(ctx, b, scrollX || 0, t); return; }
  paintBiome(ctx, a, scrollX || 0, t);
  if (!blendCanvas) blendCanvas = newCanvas(SW, SH);
  const bc = blendCanvas.getContext('2d'); bc.imageSmoothingEnabled = false;
  bc.globalCompositeOperation = 'source-over'; bc.clearRect(0, 0, SW, SH);
  paintBiome(bc, b, scrollX || 0, t);
  const lv = Math.max(1, Math.min(15, Math.round(k * 16)));
  if (!bayerPat[lv]) { const pc = newCanvas(4, 4), px = pc.getContext('2d'); px.fillStyle = '#000'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (bayer(x, y) < lv) px.fillRect(x, y, 1, 1); bayerPat[lv] = bc.createPattern(pc, 'repeat'); }
  bc.globalCompositeOperation = 'destination-in'; bc.fillStyle = bayerPat[lv]; bc.fillRect(0, 0, SW, SH);
  bc.globalCompositeOperation = 'source-over';
  ctx.drawImage(blendCanvas, 0, 0);
};

// ---------------------------------------------------------------- jet flame + bazooka
{
  const f = [], L = [11, 15, 12, 16];
  for (let k = 0; k < 4; k++) {
    const g = mkg(11, 20), len = L[k];
    for (let y = 0; y < len; y++) {
      const u = y / len, hw = 4.3 * Math.pow(1 - u, 0.85) + (y < 2 ? 0.4 : 0) + (k & 1 ? 0.3 : 0) * (1 - u);
      const sway = Math.sin(y * 0.9 + k * 1.6) * 0.5 * u;
      for (let x = 0; x < 11; x++) {
        const dx = Math.abs(x - 5 - sway);
        if (dx <= hw) g[y][x] = dx > hw * 0.66 ? 'R' : (dx > hw * 0.38 ? 'O' : (dx > hw * 0.18 || u > 0.55 ? 'Y' : 'W'));
      }
    }
    put(g, 5, len + 1 + (k & 1), 'Y'); put(g, 3 + (k % 3) * 2, len - 3, 'O');
    f.push(g);
  }
  def('jetflame', f.map(rows), { R: P.red, O: P.orange, Y: P.yellow, W: P.white }, { anchor: { x: 5, y: 0 } });
}
{
  const mk = (rec) => {
    const g = mkg(32, 14), x0 = rec ? 3 : 5;
    // tube
    rect(g, x0 + 2, 3, 22, 5, 'a'); rect(g, x0 + 2, 3, 22, 1, 'b'); rect(g, x0 + 2, 7, 22, 1, 'c');
    rect(g, x0 + 20, 2, 6, 7, 'a'); rect(g, x0 + 20, 2, 6, 1, 'b'); rect(g, x0 + 20, 8, 6, 1, 'c'); rect(g, x0 + 24, 2, 2, 7, 'k');
    rect(g, x0 + 7, 3, 1, 5, 'y'); rect(g, x0 + 12, 3, 1, 5, 'y');
    // rear funnel
    rect(g, x0, 2, 3, 7, 'c'); rect(g, x0, 2, 3, 1, 'a'); rect(g, x0 - 1, 3, 1, 5, 'k');
    // sight and grip
    rect(g, x0 + 14, 1, 3, 2, 'k'); put(g, x0 + 15, 0, 'k');
    rect(g, x0 + 8, 8, 3, 5, 'g'); rect(g, x0 + 8, 8, 1, 5, 'h'); rect(g, x0 + 15, 8, 2, 3, 'g');
    outline(g, 'o', false);
    if (rec) {
      for (let i = 0; i < 6; i++) { put(g, 0 + (i & 1), 4 + (i >> 1), 'Y'); }
      put(g, 1, 3, 'O'); put(g, 0, 6, 'O'); put(g, 2, 2, 'R'); put(g, 1, 8, 'R');
      rect(g, 29, 2, 2, 7, 'W'); put(g, 31, 3, 'Y'); put(g, 31, 7, 'Y'); put(g, 30, 5, 'O');
    }
    return g;
  };
  def('bazooka', [mk(false), mk(true)].map(rows), { o: P.dark, a: P.forest, b: P.green, c: P.deepgreen, k: P.charcoal, y: P.yellow, g: P.brown, h: P.tan, W: P.white, Y: P.yellow, O: P.orange, R: P.red }, { anchor: { x: 14, y: 10 } });
}
// ---- ROUND2 ART BEGIN
{
  const eS = (g, cx, cy, rx, ry) => {
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (Math.abs(d - 1) <= 0.5 / Math.min(rx, ry)) put(g, x, y, 'X');
    }
  };
  const NEW = [];
  const ico2 = (name, fn) => { ico(name, fn); NEW.push(name); };
  ico2('ic_globe', (g, L, p) => { ring(g, 5, 5, 4.6, 'X'); L(1, 5, 9, 5); eS(g, 5, 5, 2, 4.6); });
  ico2('ic_crown', (g, L, p) => { L(1, 3, 3, 6); L(3, 6, 5, 2); L(5, 2, 7, 6); L(7, 6, 9, 3); L(1, 3, 1, 8); L(9, 3, 9, 8); L(1, 8, 9, 8); L(1, 10, 9, 10); p(1, 2); p(5, 1); p(9, 2); });
  ico2('ic_list', (g, L, p) => { [2, 5, 8].forEach((y) => { p(1, y); p(2, y); L(4, y, 10, y); }); });
  ico2('ic_user', (g, L, p) => { blit(g, ['.XXX.', 'X...X', 'X...X', '.XXX.'], 3, 0); L(1, 10, 1, 8); L(1, 8, 3, 6); L(3, 6, 7, 6); L(7, 6, 9, 8); L(9, 8, 9, 10); L(1, 10, 9, 10); });
  ico2('ic_fullscreen', (g, L, p) => { L(0, 0, 3, 0); L(0, 0, 0, 3); L(7, 0, 10, 0); L(10, 0, 10, 3); L(0, 7, 0, 10); L(0, 10, 3, 10); L(10, 7, 10, 10); L(7, 10, 10, 10); });
  NEW.forEach((n) => { def(n, [ICONS[n]], { X: '#ffffff' }); art.iconNames.push(n); });
}

// ---------------------------------------------------------------- cosmetics (hats, trails, sticks)
art.CAT.head = [
  { x: 19, y: 4 }, { x: 19, y: 3 }, { x: 19, y: 4 }, { x: 19, y: 5 },
  { x: 19, y: 6 }, { x: 19, y: 6 },
  { x: 19, y: 5 }, { x: 19, y: 4 }, { x: 19, y: 5 },
  { x: 18, y: 5 },
  { x: 19, y: 4 }, { x: 18, y: 5 },
  { x: 18, y: 6 },
  { x: 19, y: 4 }, { x: 19, y: 4 }, { x: 19, y: 3 }, { x: 19, y: 3 }
];

art.hats = [
  { id: 'none', name: 'None', price: 0 }, { id: 'cap', name: 'Cap', price: 80 }, { id: 'beanie', name: 'Beanie', price: 120 },
  { id: 'bow', name: 'Bow', price: 150 }, { id: 'flower', name: 'Flower', price: 180 }, { id: 'headphones', name: 'Headphones', price: 250 },
  { id: 'party', name: 'Party Hat', price: 300 }, { id: 'propeller', name: 'Propeller', price: 400 }, { id: 'pirate', name: 'Pirate', price: 500 },
  { id: 'tophat', name: 'Top Hat', price: 600 }, { id: 'wizard', name: 'Wizard', price: 750 }, { id: 'viking', name: 'Viking', price: 900 },
  { id: 'halo', name: 'Halo', price: 1100 }, { id: 'crown', name: 'Crown', price: 1500 }
];
const hatDef = (id, inner, colors, gap) => {
  const w = inner[0].length + 2, h = inner.length + 2;
  const g = mkg(w, h);
  blit(g, inner, 1, 1);
  outline(g, 'o', false);
  const rws2 = rows(g);
  for (let i = 0; i < (gap || 0); i++) rws2.push('.'.repeat(w));
  def('hat_' + id, [rws2], Object.assign({ o: P.dark }, colors), { anchor: { x: Math.floor(w / 2), y: rws2.length - 1 } });
};
def('hat_none', [['.']], {}, { anchor: { x: 0, y: 0 } });
hatDef('cap', [
  "......yy......",
  "....rrrrrr....",
  "...RRrrrrrr...",
  "..RRrrrrrrrr..",
  "..rrrrrrrrrrr.",
  "..ddddddddBBBB",
  "..........bbbb"
], { r: P.red, R: P.pink, d: P.darkred, y: P.yellow, B: P.red, b: P.darkred });
hatDef('beanie', [
  "....wwww....",
  "....wWww....",
  "...bbbbbb...",
  "..bBbbbbbb..",
  ".bBbbbbbbbb.",
  ".bbbbbbbbbb.",
  "nNnNnNnNnNnN",
  "nnnnnnnnnnnn"
], { b: P.blue, B: P.sky, n: P.navy, N: P.blue, w: P.white, W: P.silver });
hatDef('bow', [
  ".pppp..pppp.",
  "pPPpmmmmpPPp",
  "ppppmMMmpppp",
  "ppppmmmmpppp",
  ".ppp.mm.ppp.",
  "..pp.mm.pp.."
], { p: P.pink, P: P.cream, m: P.magenta, M: P.pink });
hatDef('flower', [
  "..PPP..",
  ".PPyPP.",
  "..PPP..",
  "gg.g.gg",
  ".ggggg."
], { P: P.pink, y: P.yellow, g: P.green });
hatDef('headphones', [
  "....bbbbbbbbbb....",
  "...bB........Bb...",
  "..bB..........Bb..",
  "cccc..........cccc",
  "cRRc..........cRRc",
  "cRRc..........cRRc",
  "cRRc..........cRRc",
  "cccc..........cccc"
], { b: P.steel, B: P.grey, c: P.charcoal, R: P.red });
hatDef('party', [
  "....y....",
  "....r....",
  "...rrr...",
  "..yyyyy..",
  "..bbbbb..",
  ".rrrrrrr.",
  "yyyyyyyyy"
], { r: P.red, y: P.yellow, b: P.sky });
hatDef('propeller', [
  ".rrrrrkkuuuuu.",
  "......kk......",
  "....rrggbb....",
  "...rrrggbbb...",
  "..rrrrggbbbb..",
  "..rrrrggbbbb..",
  "..nnnnnnnnnn.."
], { r: P.red, g: P.green, b: P.sky, u: P.sky, k: P.charcoal, n: P.navy });
hatDef('pirate', [
  "....kkkkkk....",
  "..kkkkkkkkkk..",
  ".kkkkwwwwkkkk.",
  "kkkkkwkkwkkkkk",
  "kkkkkkwwkkkkkk",
  "gkkkkkkkkkkkkg"
], { k: P.charcoal, w: P.white, g: P.gold });
hatDef('tophat', [
  "...kskkkkk....",
  "...kskkkkk....",
  "...kskkkkk....",
  "...kkkkkkk....",
  "...rrrrrrr....",
  "...rykkkkk....",
  "sskkkkkkkkkkss"
], { k: P.charcoal, s: P.steel, r: P.red, y: P.yellow });
hatDef('wizard', [
  "........pp....",
  ".......ppp....",
  "......pppp....",
  "....pppppp....",
  "....pyppPp....",
  "...pppppPpp...",
  "...ppppppPp...",
  "..pppppppppp..",
  "..yyyyyyyyyy..",
  "iiiiiiiiiiiiii"
], { p: P.purple, P: P.plum, y: P.yellow, i: P.indigo });
hatDef('viking', [
  "w............w",
  "w............w",
  "cw..SSSSSS..wc",
  "cc.SSSSSSSS.cc",
  ".c.sSSSSSSs.c.",
  ".c.sSSSSSSs.c.",
  "..ssssssssss.."
], { w: P.cream, c: P.sand, S: P.silver, s: P.grey });
hatDef('halo', [
  "..yyyyyy..",
  ".yw....wy.",
  "..yyyyyy.."
], { y: P.yellow, w: P.white }, 2);
hatDef('crown', [
  "y....yy....y",
  "yy..yyyy..yy",
  "yyyyyyyyyyyy",
  "ygyrygygyryg",
  "gggggggggggg"
], { y: P.yellow, g: P.gold, r: P.red });

// ---- trails (jet flames, 11x20, anchor 5,0)
art.trails = [
  { id: 'classic', name: 'Classic', price: 0, particles: [P.red, P.orange, P.yellow] },
  { id: 'plasma', name: 'Plasma', price: 150, particles: [P.blue, P.sky, P.cyan, P.white] },
  { id: 'toxic', name: 'Toxic', price: 250, particles: [P.forest, P.green, P.lime] },
  { id: 'ember', name: 'Ember', price: 350, particles: [P.darkred, P.red, P.orange, P.yellow] },
  { id: 'bubble', name: 'Bubbles', price: 450, particles: [P.sky, P.cyan, P.white] },
  { id: 'heart', name: 'Hearts', price: 600, particles: [P.magenta, P.pink, P.red, P.white] },
  { id: 'rainbow', name: 'Rainbow', price: 800, particles: [P.red, P.orange, P.yellow, P.green, P.sky, P.purple] },
  { id: 'starlight', name: 'Starlight', price: 1000, particles: [P.navy, P.indigo, P.yellow, P.white] },
  { id: 'void', name: 'Void', price: 1200, particles: [P.dark, P.purple, P.plum, P.white] }
];
{
  const FL = [11, 15, 12, 16];
  const baseFlame = (k, pick) => {
    const g = mkg(11, 20), len = FL[k];
    for (let y = 0; y < len; y++) {
      const u = y / len, hw = 4.3 * Math.pow(1 - u, 0.85) + (y < 2 ? 0.4 : 0) + (k & 1 ? 0.3 : 0) * (1 - u);
      const sway = Math.sin(y * 0.9 + k * 1.6) * 0.5 * u;
      for (let x = 0; x < 11; x++) {
        const dx = Math.abs(x - 5 - sway);
        if (dx <= hw) g[y][x] = pick(dx, hw, u, y);
      }
    }
    return g;
  };
  const std = (dx, hw, u) => (dx > hw * 0.66 ? 'R' : (dx > hw * 0.38 ? 'O' : (dx > hw * 0.18 || u > 0.55 ? 'Y' : 'W')));
  const tail = (g, k, len) => { put(g, 5, len + 1 + (k & 1), 'Y'); put(g, 3 + (k % 3) * 2, len - 3, 'O'); };
  const inBody = (g, x, y) => get(g, x, y) !== '.';
  const mk = (id, cols, build) => {
    const f = [];
    for (let k = 0; k < 4; k++) f.push(build(k));
    def('jetflame_' + id, f.map(rows), cols, { anchor: { x: 5, y: 0 } });
  };
  const plus = (g, x, y, c, cc) => { put(g, x, y, cc); put(g, x - 1, y, c); put(g, x + 1, y, c); put(g, x, y - 1, c); put(g, x, y + 1, c); };
  mk('classic', { R: P.red, O: P.orange, Y: P.yellow, W: P.white }, (k) => { const g = baseFlame(k, std); tail(g, k, FL[k]); return g; });
  mk('plasma', { R: P.blue, O: P.sky, Y: P.cyan, W: P.white }, (k) => {
    const g = baseFlame(k, std); tail(g, k, FL[k]);
    const r = mulberry(k * 31 + 7);
    for (let i = 0; i < 3; i++) { const y = 3 + Math.floor(r() * (FL[k] - 5)), x = r() < 0.5 ? Math.floor(r() * 2) : 9 + Math.floor(r() * 2); put(g, x, y, 'W'); if (r() < 0.6) put(g, x + (x < 5 ? 1 : -1), y + 1, 'Y'); }
    return g;
  });
  mk('toxic', { R: P.forest, O: P.green, Y: P.lime, W: P.cream, E: P.lime, B: P.green }, (k) => {
    const g = baseFlame(k, std); tail(g, k, FL[k]);
    const r = mulberry(k * 13 + 3);
    for (let i = 0; i < 3; i++) { const y = 2 + Math.floor(r() * (FL[k] - 3)), x = 3 + Math.floor(r() * 5); if (inBody(g, x, y) && g[y][x] !== 'R') g[y][x] = 'W'; }
    put(g, 3 + (k % 2) * 4, FL[k] + 2, 'E'); put(g, 7 - (k % 2) * 4, FL[k] + 3, 'B');
    return g;
  });
  mk('ember', { R: P.darkred, O: P.red, Y: P.orange, W: P.yellow, S: P.yellow, s: P.orange }, (k) => {
    const g = baseFlame(k, std); tail(g, k, FL[k]);
    const r = mulberry(k * 57 + 11);
    for (let i = 0; i < 5; i++) { const y = 2 + Math.floor(r() * 17), x = Math.floor(r() * 11); if (!inBody(g, x, y) && !inBody(g, x - 1, y) && !inBody(g, x + 1, y)) put(g, x, y, i & 1 ? 'S' : 's'); }
    return g;
  });
  mk('bubble', { c: P.cyan, w: P.white, B: P.sky }, (k) => {
    const g = mkg(11, 20);
    for (let y = 0; y < 4; y++) { const hw = 2.2 - y * 0.5; for (let x = 0; x < 11; x++) if (Math.abs(x - 5) <= hw) g[y][x] = y < 2 ? 'B' : 'c'; }
    const BP = [
      [".ccc.", "c...c", "c.w.c", "c...c", ".ccc."],
      [".cc.", "cw.c", "c..c", ".cc."],
      [".c.", "c.c", ".c."],
      ["c"]
    ];
    [[3, 4, 0], [0, 8, 1], [6, 11, 1], [3, 14, 2], [6, 17, 3], [1, 19, 3]].forEach(([bx, by, t], i) => {
      const y = by + ((k + i) % 4) * 2 - 2;
      if (y < 4 || y > 19) return;
      const x = bx + (((k + i) & 1) ? 1 : 0);
      BP[t].forEach((r, j) => { for (let q = 0; q < r.length; q++) if (r[q] !== '.') put(g, x + q, y + j, r[q]); });
    });
    return g;
  });
  mk('heart', { R: P.magenta, O: P.pink, Y: P.peach, W: P.white, h: P.red, H: P.pink }, (k) => {
    const g = baseFlame(k, std); tail(g, k, FL[k]);
    [[0, 4 + k * 4], [8, 12 + k * 4]].forEach(([x, y]) => {
      y %= 17;
      ['h.h', 'hhh', '.h.'].forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === 'h') put(g, x + i, y + j, 'h'); });
      put(g, x, y, 'H');
    });
    return g;
  });
  mk('rainbow', { 1: P.red, 2: P.orange, 3: P.yellow, 4: P.green, 5: P.sky, 6: P.purple }, (k) => {
    const g = baseFlame(k, (dx, hw, u, y) => String(1 + (Math.floor((y + k * 2) / 2.2) % 6)));
    put(g, 5, FL[k] + 1, '6'); put(g, 3 + (k % 3) * 2, FL[k] - 3, '3');
    return g;
  });
  mk('starlight', { R: P.navy, O: P.indigo, Y: P.blue, W: P.sky, y: P.yellow, w: P.white }, (k) => {
    const g = baseFlame(k, std);
    [[3, 5 + 4 * k], [8, 12 + 4 * k], [5, 1 + 3 * k]].forEach(([x, y], i) => { y = Math.max(1, y % 19); if (((k + i) & 1) === 0) plus(g, x, y, 'y', 'w'); else put(g, x, y, 'w'); });
    return g;
  });
  mk('void', { R: P.dark, O: P.indigo, Y: P.purple, W: P.plum, S: P.white }, (k) => {
    const g = baseFlame(k, std); tail(g, k, FL[k]);
    const r = mulberry(k * 91 + 17);
    for (let i = 0; i < 5; i++) { const y = 1 + Math.floor(r() * (FL[k] + 2)), x = 2 + Math.floor(r() * 7); put(g, x, y, 'S'); }
    return g;
  });
}

// ---- sticks (6 frames, 50x62, anchor 14,31, same swing as 'stick')
art.sticks = [
  { id: 'branch', name: 'Branch', price: 0 }, { id: 'bat', name: 'Bat', price: 150 }, { id: 'umbrella', name: 'Umbrella', price: 300 },
  { id: 'baguette', name: 'Baguette', price: 450 }, { id: 'guitar', name: 'Guitar', price: 600 }, { id: 'fish', name: 'Fish', price: 700 },
  { id: 'wrench', name: 'Wrench', price: 850 }, { id: 'sword', name: 'Sword', price: 1000 }, { id: 'laser', name: 'Laser', price: 1500 }
];
{
  const angs = [-115, -78, -42, -6, 28, 58], WW = 50, HH = 62, hx = 14, hy = 31, L = 28;
  const stickDef = (id, smear, colors, body, opts) => {
    opts = opts || {};
    const f = [];
    angs.forEach((deg, k) => {
      const g = mkg(WW, HH);
      if (k > 0) for (let y = 0; y < HH; y++) for (let x = 0; x < WW; x++) {
        const dx = x - hx, dy = y - hy, r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx) * 180 / Math.PI, back = deg - a;
        const span = k === 5 ? 30 : 78;
        if (back < 2 || back > span) continue;
        const u = back / span;
        const rin = 13 + u * 8, rout = 34 - u * 8;
        if (r < rin || r > rout) continue;
        const m = (r - rin) / (rout - rin);
        const ch = m > 0.78 ? 'C' : (m < 0.22 ? 'b' : 'W');
        if (u > 0.55 && bayer(x, y) / 16 < (u - 0.55) * 2.2) continue;
        if (k === 5 && ((x + y) & 1)) continue;
        g[y][x] = ch;
      }
      if (k > 0) outline(g, 'q', false);
      const a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      const sh = mkg(WW, HH), bl = mkg(WW, HH);
      for (let y = 0; y < HH; y++) for (let x = 0; x < WW; x++) {
        const rx = x - hx, ry = y - hy, u = rx * dx + ry * dy, v = rx * nx + ry * ny;
        const ch = body(u, v, k);
        if (!ch) continue;
        if (opts.blade && opts.blade.indexOf(ch) >= 0) bl[y][x] = ch; else sh[y][x] = ch;
      }
      outline(sh, 'o', false);
      comp(g, sh, 0, 0);
      comp(g, bl, 0, 0);
      f.push(g);
    });
    def('stick_' + id, f.map(rows), Object.assign({ o: P.dark, C: smear[0], W: smear[1], b: smear[2], q: smear[3] }, colors), { anchor: { x: hx, y: hy } });
  };
  // branch: exact copy of 'stick'
  stickDef('branch', [P.cyan, P.white, P.sky, P.blue], { S: P.sand, T: P.tan, B: P.brown, R: P.red, r: P.darkred }, (u, v) => {
    if (u < -3 || u > L || Math.abs(v) > 1.6) return null;
    let ch = v < -0.55 ? 'S' : (v > 0.55 ? 'B' : 'T');
    if (u < 7) ch = ((Math.floor(u) & 1) ? 'R' : 'r');
    if (u > L - 3) ch = v < -0.2 ? 'W' : 'C';
    return ch;
  });
  // bat
  stickDef('bat', [P.cream, P.sand, P.tan, P.brown], { a: P.sand, d: P.tan, e: P.brown, h: P.charcoal, i: P.steel, x: P.red }, (u, v) => {
    if (u < -3 || u > L) return null;
    let w;
    if (u < -1) w = 1.9; else if (u < 9) w = 1.1; else if (u < 22) w = 1.1 + (u - 9) / 13 * 1.9; else w = 3.0 - Math.pow((u - 22) / 6, 3) * 1.6;
    if (Math.abs(v) > w) return null;
    if (u < 9 && u >= -1) return (Math.floor(u) & 1) ? 'h' : 'i';
    if (u >= 23.5 && u <= 24.6) return 'x';
    return v < -w * 0.35 ? 'a' : (v > w * 0.45 ? 'e' : 'd');
  });
  // umbrella (opens during the swing)
  stickDef('umbrella', [P.white, P.pink, P.red, P.darkred], { r: P.red, w: P.white, d: P.darkred, x: P.silver, k: P.brown, y: P.yellow }, (u, v, k) => {
    const f = [0.12, 0.2, 0.5, 0.85, 1, 1][k];
    if (u < -3 || u > L) return null;
    const av = Math.abs(v);
    if (u >= 27.2 && av <= 0.7) return 'y';
    if (u >= 10) {
      const t = Math.max(0, (u - 12) / 16);
      const hw = Math.max(8 * f * Math.sqrt(Math.max(0, 1 - t * t)), 1.3 * (1 - (u - 10) / 18));
      const minU = f > 0.5 ? 11.5 + ((Math.floor(v / 1.7 + 20) & 1) ? 1.2 : 0) : 10;
      if (u >= minU && av <= hw) {
        if (f < 0.3 && u >= 17 && u <= 18.5) return 'w';
        if (f > 0.5 && av > hw - 0.9) return 'd';
        const pan = Math.max(0, Math.min(4, Math.floor((v / hw * 0.5 + 0.5) * 5)));
        return pan & 1 ? 'w' : 'r';
      }
    }
    if (av <= (u < 2 ? 1.1 : 0.6)) return u < 2 ? 'k' : 'x';
    return null;
  });
  // baguette
  stickDef('baguette', [P.cream, P.sand, P.gold, P.tan], { a: P.sand, d: P.tan, e: P.brown, c: P.cream, w: P.white, i: P.silver }, (u, v) => {
    if (u < -1 || u > 27.5) return null;
    const w = 2.3 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 13) / 14.5, 2)));
    if (Math.abs(v) > Math.max(w, u < 6 ? 1.2 : 0)) return null;
    if (u < 7) return v < 0 ? 'w' : 'i';
    if (u > 9 && u < 25 && Math.abs(v) < 1.4 && ((u + v * 1.6) % 5 + 5) % 5 < 1.1) return 'c';
    return v < -0.7 ? 'a' : (v > 1.1 ? 'e' : 'd');
  });
  // guitar
  stickDef('guitar', [P.cream, P.peach, P.orange, P.ginger], { a: P.orange, d: P.ginger, e: P.brown, y: P.yellow, k: P.dark, h: P.silver, g: P.gold }, (u, v) => {
    if (u < -3 || u > L) return null;
    const av = Math.abs(v);
    const c1 = Math.hypot(u - 17.5, v) <= 3.8, c2 = Math.hypot(u - 23.2, v) <= 4.9;
    if (c1 || c2) {
      if (Math.hypot(u - 21, v) < 1.5) return 'k';
      if (u >= 22.6 && u <= 25 && av < 3.2 && av >= 2.3) return 'h';
      const edge = !(Math.hypot(u - 17.5, v) <= 2.9 || Math.hypot(u - 23.2, v) <= 3.9);
      if (edge) return 'g';
      return v > 2.2 ? 'd' : (v < -2.4 ? 'y' : 'a');
    }
    if (u < 0 && av <= 1.5) return (Math.floor(u) & 1) ? 'e' : 'g';
    if (av <= 0.9) return (u > 3 && (Math.floor(u) % 3 === 0)) ? 'h' : 'e';
    return null;
  });
  // floppy fish
  stickDef('fish', [P.cyan, P.cream, P.teal, P.forest], { a: P.blue, d: P.sky, e: P.navy, h: P.white, k: P.dark, s: P.cyan }, (u, v, k) => {
    if (u < -3 || u > L) return null;
    const amt = [0, 2, 4, 5, 5, 2.5][k];
    const vv = v + amt * Math.pow(Math.max(0, (u + 2) / 30), 2);
    const av = Math.abs(vv);
    if (Math.abs(u - 23.2) < 0.9 && Math.abs(vv + 1.1) < 0.7) return 'h';
    if (Math.abs(u - 24.2) < 0.7 && Math.abs(vv + 1.0) < 0.6) return 'k';
    if (Math.pow((u - 17) / 10, 2) + Math.pow(vv / 4.2, 2) <= 1) {
      if (Math.abs(u - 20) < 0.7 && av < 3) return 'e';
      if (vv > 1.5) return 'd';
      return ((Math.floor(u) + Math.floor(vv)) % 3 === 0 && vv < 0.5 && u > 8) ? 's' : 'a';
    }
    if (u >= 11 && u <= 19) { const dors = -(4.2 + Math.max(0, 2.2 - Math.abs(u - 15) * 0.55)); if (vv <= -3.2 && vv >= dors) return 'e'; }
    if (u >= 5 && u < 9 && av <= 1.3) return 'e';
    if (u < 5 && u >= -2.5) { const hw = 1.2 + (5 - u) * 0.5; if (av <= hw && !(u < 0.5 && av < 0.9)) return 'e'; }
    return null;
  });
  // wrench
  stickDef('wrench', [P.white, P.silver, P.grey, P.steel], { a: P.silver, d: P.grey, e: P.steel, r: P.red, R: P.pink, k: P.dark }, (u, v) => {
    if (u < -3 || u > L) return null;
    const av = Math.abs(v), hd = Math.hypot(u - 23.5, v);
    if (hd <= 4.4) {
      if (u > 24.5 && av < 1.7) return null;
      if (Math.hypot(u - 21, v) < 1.2) return 'k';
      return v < -1.5 ? 'a' : (v > 1.8 ? 'e' : 'd');
    }
    if (u >= 17 && u <= 20.5 && av <= 2.0) return 'd';
    if (u <= 18 && av <= 1.2) {
      if (u < 8) return (Math.floor(u) & 1) ? 'R' : 'r';
      return v < -0.3 ? 'a' : 'e';
    }
    return null;
  });
  // sword
  stickDef('sword', [P.white, P.cyan, P.sky, P.blue], { a: P.silver, w: P.white, d: P.grey, e: P.steel, y: P.yellow, g: P.gold, k: P.brown }, (u, v) => {
    if (u < -3 || u > L) return null;
    const av = Math.abs(v);
    if (u < -1.5) return av <= 1.5 ? 'y' : null;
    if (u < 3) return av <= 1.0 ? ((Math.floor(u) & 1) ? 'k' : 'g') : null;
    if (u < 4.6) return av <= 4.2 ? (av > 3 ? 'g' : 'y') : null;
    const hw = u > 24 ? Math.max(0, 1.6 - (u - 24) * 0.42) : 1.6;
    if (av > hw) return null;
    if (av < 0.45 && u < 25) return 'e';
    return v < -0.6 ? 'w' : 'a';
  });
  // laser blade (glowing, no dark outline on the blade)
  stickDef('laser', [P.white, P.pink, P.magenta, P.purple], { h: P.charcoal, i: P.steel, S: P.silver, r: P.red, w: P.white, p: P.pink, m: P.magenta }, (u, v, k) => {
    if (u < -3 || u > L) return null;
    const av = Math.abs(v);
    if (u < 6) { if (av > 1.4) return null; return (Math.floor(u + 3) % 3 === 0) ? 'i' : 'h'; }
    if (u < 8.3) { if (av > 2.0) return null; return u > 6.5 && av < 0.7 ? 'r' : 'S'; }
    const end = u > 25.5 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - 25.5) / 2.5, 2))) : 1;
    const wob = (k & 1) ? 0.25 : 0;
    if (av <= 0.6 * end + 0.01) return 'w';
    if (av <= (1.6 + wob) * end) return 'p';
    if (av <= (2.5 + wob) * end) return 'm';
    return null;
  }, { blade: 'wpm' });
}

// ---- hangar tab icons (11x11 stroke)
{
  const NEW2 = [];
  const ic3 = (name, fn) => { ico(name, fn); NEW2.push(name); };
  ic3('ic_hat', (g, L, p) => { L(3, 1, 7, 1); L(3, 1, 3, 6); L(7, 1, 7, 6); L(3, 4, 7, 4); L(0, 7, 10, 7); L(0, 7, 0, 8); L(10, 7, 10, 8); L(0, 9, 10, 9); });
  ic3('ic_stick', (g, L, p) => { L(0, 8, 7, 1); L(2, 10, 9, 3); L(0, 8, 2, 10); L(7, 1, 9, 3); p(1, 9); });
  ic3('ic_trail', (g, L, p) => { ring(g, 7, 3, 2.6, 'X'); L(5, 5, 0, 10); L(6, 6, 3, 10); L(4, 3, 0, 3); });
  ic3('ic_cat', (g, L, p) => { L(1, 0, 1, 3); L(1, 0, 3, 2); L(9, 0, 9, 3); L(9, 0, 7, 2); L(3, 2, 7, 2); L(0, 4, 0, 8); L(10, 4, 10, 8); L(1, 3, 0, 4); L(9, 3, 10, 4); L(1, 9, 9, 9); L(0, 8, 1, 9); L(10, 8, 9, 9); p(3, 5); p(7, 5); p(5, 6); p(4, 7); p(6, 7); });
  NEW2.forEach((n) => { def(n, [ICONS[n]], { X: '#ffffff' }); art.iconNames.push(n); });
}
// ---- ROUND2 ART END
})();
