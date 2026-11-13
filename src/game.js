/* Sky Cat: Tank Topple - game.js
   The 'play' scene (player, enemies, shots, pickups, waves, draft, HUD, pause) and SC.missions.
   Sections: constants, helpers, missions, state, combo/score, fx helpers, player, parry, bazooka, projectiles,
   enemies, boss, damage/KO, player vs enemies, pickups/coins, waves, draft, end of run, pause, update, draw,
   scene, test hooks. */
(function () {
'use strict';
const SC = window.SC;
const W = 480, H = 270;
const PI = Math.PI, TAU = Math.PI * 2;
const M = Math;

/* ------------------------------------------------------------------ constants */
const TUNE = {
  moveSpeed: 2.7, moveAccel: 0.26, dashSpeed: 7.6, dashFrames: 14, dashCd: 70,
  parryFrames: 12, perfectFrames: 4, parryCd: 40, parryWhiffCd: 50, parryRadius: 26, parryWide: 6, reflectMul: 2.2,
  inputBuf: 8, parryCancel: 3,
  ammoBase: 3, ammoRegen: 240, ammoPickup: 3, ammoHardCap: 6, rocketDmg: 2, rocketSplash: 28,
  hurtInv: 90, bounceInv: 24, comboWindow: 180, grazeDist: 6,
  stunFrames: 40, shieldPuFrames: 600, slowFrames: 300, magnetFrames: 480, starFrames: 480,
  coinMagnet: 58, bossHp: 60, bossHpPerBoss: 20, bossHatchOpen: 110, bossHatchClosed: 100,
  mortarG: 0.09, draftAnim: 22, draftGuard: 45, draftSpaceGuard: 60,
  shellCap: 3.8, teleFloor: 28, swiftPar: 1500, swiftPerWave: 60, goalCoins: 25
};
const ET = {
  tank_light:  { hp: 1, score: 100,  coins: 2,  speed: 0.95, dw: 30, dh: 18, kind: 'tank' },
  tank_heavy:  { hp: 4, score: 300,  coins: 5,  speed: 0.45, dw: 42, dh: 24, kind: 'tank' },
  artillery:   { hp: 2, score: 200,  coins: 4,  speed: 0.35, dw: 38, dh: 22, kind: 'tank' },
  heli:        { hp: 2, score: 250,  coins: 4,  speed: 0.8,  dw: 36, dh: 22, kind: 'air' },
  drone:       { hp: 1, score: 60,   coins: 1,  speed: 1.1,  dw: 14, dh: 12, kind: 'air' },
  boss:        { hp: 60, score: 5000, coins: 30, speed: 0.3, dw: 110, dh: 64, kind: 'boss' }
};
const ALIAS = { light: 'tank_light', heavy: 'tank_heavy', art: 'artillery' };
const FALLBACK_HATCH = {
  tank_light: { x: 9, y: 0, w: 12, h: 5 }, tank_heavy: { x: 12, y: 0, w: 16, h: 6 },
  artillery: { x: 12, y: 0, w: 14, h: 6 }
};
const FIRST_SEEN = {
  tank_heavy: 'HEAVY: DIVE THE HATCH', artillery: 'ARTILLERY: WATCH THE MARKER',
  heli: 'HELI: PARRY ITS MISSILES', drone: 'DRONE: DASH THROUGH IT'
};
const DARK = '#1a1226';
const COMBO_COLS = ['#ffffff', '#ffe14a', '#ff9a2e', '#ff5fb0', '#4de8ff'];
const PU_TYPES = ['shield', 'slow', 'magnet', 'rockets', 'heart', 'star'];
const UPS = {
  maxhp:     { title: 'EXTRA HEART',  desc: 'MAX HP +1 AND HEAL', max: 3 },
  dashcd:    { title: 'QUICK DASH',   desc: 'DASH COOLDOWN -20%', max: 3 },
  parrywide: { title: 'WIDE PARRY',   desc: 'PARRY RADIUS +6', max: 2 },
  ammo:      { title: 'BIG MAGAZINE', desc: 'MAX ROCKETS +1', max: 3 },
  splash:    { title: 'BIGGER BOOM',  desc: 'ROCKET SPLASH +50%', max: 2 },
  magnet:    { title: 'COIN MAGNET',  desc: 'COIN PULL RANGE X2', max: 2 },
  combo:     { title: 'LONG COMBO',   desc: 'COMBO WINDOW +1 SEC', max: 2 },
  shield:    { title: 'WAVE SHIELD',  desc: 'START EACH WAVE SHIELDED', max: 1 },
  twin:      { title: 'TWIN ROCKETS', desc: 'FIRE 2 ROCKETS AT ONCE', max: 1 },
  chain:     { title: 'CHAIN PARRY',  desc: 'PARRIES HIT A 2ND FOE', max: 1 },
  thorns:    { title: 'THORN TRAIL',  desc: 'DASH LEAVES A HARMFUL TRAIL', max: 1 },
  regen:     { title: 'REGEN',        desc: 'HEAL 1 EVERY 2 WAVES', max: 1 }
};
const UP_IDS = Object.keys(UPS);

/* ------------------------------------------------------------------ helpers */
const SI = {};
function si(name, dw, dh) {
  let r = SI[name];
  if (r) return r;
  if (SC.sprite.has(name)) {
    const g = SC.sprite.get(name);
    r = { w: g.w, h: g.h, count: g.count || 1, ax: g.anchor ? g.anchor.x : 0, ay: g.anchor ? g.anchor.y : 0, ok: true };
  } else r = { w: dw || 8, h: dh || 8, count: 1, ax: 0, ay: 0, ok: false };
  if (r.ok) SI[name] = r;
  return r;
}
// draw sprite with top-left at (tx,ty); fallback rect in colour col
function drawTL(name, frame, tx, ty, o, col) {
  const g = si(name, 8, 8);
  if (g.ok) SC.sprite.draw(name, frame, M.round(tx + g.ax), M.round(ty + g.ay), o);
  else if (col) SC.rect(tx, ty, g.w, g.h, col);
}
function drawC(name, frame, cx, cy, o, col) {
  const g = si(name, 8, 8);
  drawTL(name, frame, cx - g.w / 2, cy - g.h / 2, o, col);
}
// draw an anchored sprite with its anchor at (px,py); engine does not mirror anchors, so offset when flipped
function drawAnch(name, frame, px, py, flip) {
  const g = si(name, 8, 8);
  if (!g.ok) return;
  const x = flip ? px - g.w + 1 + 2 * g.ax : px;
  SC.sprite.draw(name, frame, M.round(x), M.round(py), { flip: !!flip });
}
function refTL(name, frame, tx, ty, flip) {
  const g = si(name, 8, 8);
  return { name, frame: g.count ? frame % g.count : 0, x: M.round(tx + g.ax), y: M.round(ty + g.ay), flip: !!flip };
}
function refC(name, frame, cx, cy, flip) {
  const g = si(name, 8, 8);
  return refTL(name, frame, cx - g.w / 2, cy - g.h / 2, flip);
}
function icon(name, x, y, tint, alpha) {
  if (SC.sprite.has(name)) SC.sprite.draw(name, 0, x, y, { tint: tint || null, alpha: alpha == null ? 1 : alpha });
}
function T(str, x, y, o) { SC.text(String(str), x, y, o); }
function pal(n, f) { return (SC.PAL && SC.PAL[n]) || f; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const hyp = M.hypot;
function pick(arr, rnd) { return arr[M.floor((rnd || M.random)() * arr.length) % arr.length]; }
function fr(arr, i) { return arr && arr.length ? arr[((M.floor(i) % arr.length) + arr.length) % arr.length] : 0; }
function hs(n) { SC.fx.hitstop = M.max(SC.fx.hitstop || 0, M.round(n)); }
function shake(px, f) { SC.fx.shake(px, f); }
function sfx(n, o) { if (SC.sfx) SC.sfx(n, o); }
function vibe(ms) { if (SC.vibe) SC.vibe(ms); }
function utcDate() { return new Date().toISOString().slice(0, 10); }
function utcYesterday(d) { return new Date(Date.parse(d + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10); }
function angDiff(a, b) { let d = b - a; while (d > PI) d -= TAU; while (d < -PI) d += TAU; return d; }
function dirIdx(ang) { return ((M.round(ang / (PI / 4)) % 8) + 8) % 8; } // 0 E, 1 NE, 2 N ... (y up)
function padRect(r) { return { x: r.x - 5, y: r.y - 6, w: r.w + 10, h: r.h + 10 }; }

/* ------------------------------------------------------------------ stats */
function getStats() {
  let st = SC.store.get('stats', null);
  if (!st || typeof st !== 'object') st = {};
  st.runs = st.runs || 0; st.kos = st.kos || 0; st.parries = st.parries || 0; st.dives = st.dives || 0; st.bestWave = st.bestWave || 0;
  return st;
}

/* ------------------------------------------------------------------ missions */
const MISSION_POOL = [
  { id: 'dive5',    text: 'DIVE-KO 5 TANKS',     ev: 'dive',      goal: 5,  reward: 30 },
  { id: 'dive12',   text: 'DIVE-KO 12 TANKS',    ev: 'dive',      goal: 12, reward: 70 },
  { id: 'heavy3',   text: 'DIVE-KO 3 HEAVIES',   ev: 'diveheavy', goal: 3,  reward: 45 },
  { id: 'parry20',  text: 'PARRY 20 SHOTS',      ev: 'parry',     goal: 20, reward: 40 },
  { id: 'parry50',  text: 'PARRY 50 SHOTS',      ev: 'parry',     goal: 50, reward: 90 },
  { id: 'wave',     text: 'REACH WAVE',          ev: 'wave',      goal: 8,  reward: 60, max: true, dyn: true },
  { id: 'combo',    text: 'GET A X3 COMBO',      ev: 'mult',      goal: 3,  reward: 55, max: true },
  { id: 'ko60',     text: 'KO 60 ENEMIES',       ev: 'ko',        goal: 60, reward: 50 },
  { id: 'rocket10', text: 'ROCKET 10 ENEMIES',   ev: 'rocketko',  goal: 10, reward: 35 },
  { id: 'graze30',  text: 'GRAZE 30 SHOTS',      ev: 'graze',     goal: 30, reward: 40 },
  { id: 'perfect8', text: 'PERFECT PARRY 8 TIMES', ev: 'perfect', goal: 8,  reward: 60 },
  { id: 'coins80',  text: 'COLLECT 80 COINS',    ev: 'coins',     goal: 80, reward: 40 },
  { id: 'drone15',  text: 'SMASH 15 DRONES',     ev: 'drone',     goal: 15, reward: 40 }
];
function mdef(id) { for (let i = 0; i < MISSION_POOL.length; i++) if (MISSION_POOL[i].id === id) return MISSION_POOL[i]; return null; }
// roll one new mission avoiding ids and events already in `a`; base = highest wave already reached
function rollMission(a, base) {
  const used = {}, usedEv = {};
  a.forEach(m => { used[m.id] = true; const d = mdef(m.id); if (d) usedEv[d.ev] = true; });
  let left = MISSION_POOL.filter(p => !used[p.id] && !usedEv[p.ev]);
  if (!left.length) left = MISSION_POOL.filter(p => !used[p.id]);
  const d = left[M.floor(M.random() * left.length) % left.length];
  const m = { id: d.id, progress: 0 };
  if (d.dyn) {
    const bw = base != null ? base : getStats().bestWave;
    m.goal = M.max(5, bw + 2 + M.floor(M.random() * 3));
    m.reward = 20 + m.goal * 8;
    m.text = 'REACH WAVE ' + m.goal;
  }
  return m;
}
const missions = {
  done: [],       // completed this run (consumed by the play scene)
  bonus: 0,       // coin rewards waiting to be banked
  // the store hands back the same in-memory array each call, so this is a cheap cached read; writes only on change
  _act(base) {
    let a = SC.store.get('missions', null);
    let dirty = false;
    if (!Array.isArray(a)) { a = []; dirty = true; }
    if (!dirty) {
      const seen = {}, seenEv = {};
      let ok = a.length === 3;
      for (let i = 0; ok && i < a.length; i++) {
        const m = a[i], d = m && mdef(m.id);
        if (!d || seen[m.id] || seenEv[d.ev] || (d.dyn && !m.goal)) ok = false;
        else { seen[m.id] = true; seenEv[d.ev] = true; }
      }
      if (!ok) {
        dirty = true;
        const keep = [], s2 = {}, e2 = {};
        a.forEach(m => {
          const d = m && mdef(m.id);
          if (!d || s2[m.id] || e2[d.ev] || (d.dyn && !m.goal)) return;
          s2[m.id] = true; e2[d.ev] = true; keep.push(m);
        });
        a = keep.slice(0, 3);
      }
    }
    while (a.length < 3) { a.push(rollMission(a, base)); dirty = true; }
    if (dirty) SC.store.set('missions', a);
    return a;
  },
  list() {
    return missions._act().map(m => {
      const d = mdef(m.id), goal = m.goal || d.goal;
      return { id: d.id, text: m.text || d.text, progress: M.min(m.progress, goal), goal, reward: m.reward || d.reward };
    });
  },
  event(name, amount) {
    const a = missions._act();
    let changed = false;
    for (let i = 0; i < a.length; i++) {
      const d = mdef(a[i].id);
      if (d.ev !== name) continue;
      const goal = a[i].goal || d.goal, reward = a[i].reward || d.reward, text = a[i].text || d.text;
      const amt = amount == null ? 1 : amount;
      const before = a[i].progress;
      a[i].progress = d.max ? M.max(before, amt) : before + amt;
      if (a[i].progress !== before) changed = true;
      if (a[i].progress >= goal) {
        missions.bonus += reward;
        missions.done.push({ id: d.id, text, reward });
        const rest = a.filter((x, j) => j !== i);
        const base = name === 'wave' ? M.max(getStats().bestWave, amt) : null;
        a[i] = rollMission(rest, base);
        changed = true;
        sfx('unlock');
      }
    }
    if (changed) SC.store.set('missions', a);
  }
};
SC.missions = missions;

/* ------------------------------------------------------------------ state */
let run = null, p = null, CAT = null;
let enemies, shots, rockets, pickups, coinsL, anims, flyers, lines, trail, thorns, afters, smokes, sils;
let rs = null;   // general stream (seed flag only); behaviour rolls
function R() { return rs ? rs() : M.random(); }
function Q() { return R(); }
function P() { return R(); }
let checkerPat = null;

function newPlayer() {
  return { x: 110, y: 120, vx: 0, vy: 0, face: 1, hp: 3, maxhp: 3, dashT: 0, dashCd: 0, dashDx: 1, dashDy: 0,
    parryT: -1, parryCd: 0, parryHit: false, ammo: TUNE.ammoBase, ammoT: 0, fireCd: 0, fireT: 0,
    inv: 0, hurtT: 0, shieldT: 0, waveShield: false, koT: 0, koVy: 0, dust: 0,
    buf: { dash: 0, parry: 0, fire: 0 } };
}

function up(id) { return run.up[id] || 0; }
function ammoMax() { return TUNE.ammoBase + up('ammo'); }
function dashCdMax() { return TUNE.dashCd * M.pow(0.8, up('dashcd')); }
function parryR() { return TUNE.parryRadius + TUNE.parryWide * up('parrywide'); }
function comboWin() { return TUNE.comboWindow + 60 * up('combo'); }
function splashR() { return TUNE.rocketSplash * (1 + 0.5 * up('splash')); }
function magnetR() { return run.t.magnet > 0 ? 600 : TUNE.coinMagnet * M.pow(2, up('magnet')); }
function mult() { return M.min(5, 1 + 0.5 * M.floor(run.combo / 4)); }
function multCol() { return COMBO_COLS[clamp(M.floor(mult() - 1), 0, 4)]; }
function waveEff() { return run.wave; }

function pickGoal(mode, st) {
  const best = SC.store.get('best_endless', 0) || 0;
  const opts = [];
  opts.push({ kind: 'wave', target: M.max(3, st.bestWave + 1), text: 'REACH WAVE ' + M.max(3, st.bestWave + 1) });
  opts.push({ kind: 'nodmg', target: 3, text: 'CLEAR WAVE 3 UNHURT' });
  const tgt = best > 0 ? best + 1 : 1500;
  opts.push({ kind: 'score', target: tgt, text: best > 0 ? 'BEAT YOUR BEST: ' + tgt : 'SCORE ' + tgt });
  const g = opts[M.floor(M.random() * opts.length) % opts.length];
  g.done = false;
  return g;
}

function initRun(params) {
  const mode = 'endless';
  const date = utcDate();
  rs = null;
  if (SC.flags && SC.flags.seed != null && SC.flags.seed !== '') rs = SC.rng(Number(SC.flags.seed) || 1);
  const key = 'best_endless';
  const st = getStats();
  const hints = Object.assign({ dive: false, parry: false, rocket: false, seen: {} }, SC.store.get('hints', null) || {});
  hints.seen = Object.assign({}, hints.seen || {});
  run = {
    mode, date, f: 0, wave: 0, phase: 'banner', phaseT: 0, waveT: 0, score: 0, kos: 0, coins: 0, combo: 0, maxCombo: 0,
    comboT: 0, up: {}, t: { slow: 0, magnet: 0, star: 0 }, queue: [], spawnT: 60, eid: 0, banner: null, stamp: null, sub: null,
    trick: null, paused: false, over: false, scroll: 0, biome: 0, prevBiome: 0, blend: 1, puT: 700, parries: 0, dives: 0,
    stats: { kos: 0, parries: 0, dives: 0 }, statsB: { kos: 0, parries: 0, dives: 0 }, counted: false,
    bossAlive: false,
    draft: null, draftT: 0, grazeSfx: 0, parryFx: 0, comboHigh: 0,
    skin: SC.store.get('skin', 'ginger'), banked: 0, timeT: 0, bestKey: key, bestBefore: SC.store.get(key, 0) || 0,
    hurtInWave: false, vac: false, lastParryF: -999, pdark: 0, pflash: null, warn: null, hints, hint: null, hintRocketT: 0,
    goal: pickGoal(mode, st), saved: false
  };
  if (!SC.sprite.has('cat_' + run.skin)) run.skin = 'ginger';
  run.seed = (SC.flags && SC.flags.seed != null && SC.flags.seed !== '') ? (Number(SC.flags.seed) || 1) : M.floor(M.random() * 2147483647);
  run.biomeRng = SC.rng(run.seed ^ 0x5bd1e995);
  run.biomeOrder = [];
  run.biome = run.prevBiome = biomeFor(1);
  run.hat = SC.store.get('hat', 'none'); run.trailId = SC.store.get('trail', 'classic'); run.stickId = SC.store.get('stick', 'branch');
  p = newPlayer();
  enemies = []; shots = []; rockets = []; pickups = []; coinsL = []; anims = []; flyers = [];
  lines = []; trail = []; thorns = []; afters = []; smokes = []; sils = [];
  missions.done = []; missions.bonus = 0;
  for (const k in SI) delete SI[k];
}

/* ------------------------------------------------------------------ combo / score */
function addCombo(n) {
  if (run.over) return;
  run.combo += n || 1;
  run.comboT = comboWin();
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;
  sfx('combo', { pitch: 1 + M.min(run.combo, 40) * 0.025, vol: 0.6 });
  missions.event('mult', mult());
}
function breakCombo() {
  if (run.combo >= 10) sfx('combo_break');
  run.combo = 0; run.comboT = 0;
}
function addScore(base, x, y, label, scale) {
  const m = mult() * (run.t.star > 0 ? 2 : 1);
  const pts = M.round(base * m);
  run.score += pts;
  if (x != null) SC.fx.popup((label ? label + ' ' : '') + '+' + pts, x, y, { color: multCol(), scale: scale || 1, life: 40 });
  return pts;
}
// flat bonus (not multiplied) with popup and a small stamp
function trick(text, pts, x, y) {
  run.score += pts;
  SC.fx.popup(text + ' +' + pts, x, y, { color: '#ffe14a', life: 50 });
  run.trick = { text, t: 0, life: 50 };
  sfx('pickup');
}
function checkGoal() {
  const g = run.goal;
  if (!g || g.done || run.over) return;
  let ok = false;
  if (g.kind === 'wave') ok = run.wave >= g.target;
  else if (g.kind === 'score') ok = run.score >= g.target;
  if (!ok) return;
  g.done = true;
  run.coins += TUNE.goalCoins;
  stampText('GOAL DONE!', '#4de8ff', { prio: 3, base: 4 });
  SC.fx.popup('+' + TUNE.goalCoins + ' COINS', p.x, p.y - 26, { color: '#ffe14a', life: 60 });
  sfx('unlock');
}

/* ------------------------------------------------------------------ fx helpers */
function boom(x, y, big, hostileR) {
  anims.push({ name: big ? 'explosion_big' : 'explosion', x, y, f: 0, sp: big ? 3 : 2.4 });
  SC.fx.burst(x, y, { n: big ? 16 : 8, colors: ['#ffffff', '#ffd23a', '#ff7a1a', '#c8321e'], speed: big ? 3.2 : 2.2, life: 26, size: 2 });
  if (hostileR && !run.over && p.inv <= 0 && p.dashT <= 0 && SC.collideCircle(catRef(), x, y, hostileR)) hurt(x);
}
function smokePuff(x, y) { smokes.push({ x, y, f: 0, vy: -0.3 - M.random() * 0.3 }); }
function addCoinBurst(x, y, n) {
  for (let i = 0; i < n && coinsL.length < 90; i++) {
    const a = -PI / 2 + (M.random() - 0.5) * 2.4, s = 1.4 + M.random() * 2.6;
    coinsL.push({ x, y, vx: M.cos(a) * s, vy: M.sin(a) * s - 1, age: 0, f: M.floor(M.random() * 6), grounded: false });
  }
}
// stamps are priority-ordered: a higher stamp is never replaced by a lower one until it is mostly faded
function stampText(text, color, o) {
  o = o || {};
  const prio = o.prio == null ? 1 : o.prio, cur = run.stamp;
  if (cur && prio < cur.prio && cur.t < cur.life * 0.6) return;
  run.stamp = { text, color, t: 0, life: o.life || 34, base: o.base || 4, prio, shadow: o.shadow || null, wave: o.wave || 0 };
}
function bannerSet(lines2, life) { run.banner = { lines: lines2, t: 0, life: life || 100 }; }
function subSet(text) { run.sub = { text, t: 0, life: 90 }; }
function hintDone(k) {
  if (run.hints[k]) return;
  run.hints[k] = true;
  SC.store.set('hints', run.hints);
}

/* ------------------------------------------------------------------ player */
function handPt() {
  const hf = CAT.handFrames;
  if (hf && run.phase !== 'dying' && p.hurtT <= 0 && p.dashT <= 0) {
    if (p.parryT >= 0 && hf.parry && hf.parry.length) return hf.parry[clamp(M.floor(p.parryT / 4), 0, hf.parry.length - 1)];
    if (p.fireT > 0 && hf.shoot && hf.shoot.length) return hf.shoot[p.fireT > 8 ? M.min(1, hf.shoot.length - 1) : 0];
  }
  return CAT.hand;
}
function catGeom() {
  const f = p.face < 0, hd = handPt();
  const tx = p.x - (f ? CAT.w - 1 - CAT.centre.x : CAT.centre.x);
  const ty = p.y - CAT.centre.y;
  return { tx, ty, flip: f,
    hx: tx + (f ? CAT.w - 1 - hd.x : hd.x), hy: ty + hd.y,
    jx: tx + (f ? CAT.w - 1 - CAT.jet.x : CAT.jet.x), jy: ty + CAT.jet.y };
}
function catFrame() {
  const F = CAT.frames;
  if (run.phase === 'dying') return fr(F.ko, 0);
  if (p.hurtT > 0) return fr(F.hurt, 0);
  if (p.dashT > 0) return fr(F.dash, run.f / 2);
  if (p.parryT >= 0) return fr(F.parry, M.floor(p.parryT / 4));
  if (p.fireT > 0) return fr(F.shoot, p.fireT > 8 ? 1 : 0);
  if (hyp(p.vx, p.vy) < 0.4) return fr(F.idle, run.f / 8);
  return fr(F.fly, run.f / 4);
}
function catRef() {
  const g = catGeom();
  return refTL('cat_' + run.skin, catFrame(), g.tx, g.ty, g.flip);
}
function hasShield() { return p.waveShield || p.shieldT > 0; }

function hurt(fromX) {
  if (run.over || p.inv > 0 || p.dashT > 0 || run.phase === 'dying') return false;
  if (window.SCTEST && window.SCTEST.god) return false;
  if (hasShield()) {
    if (p.waveShield) p.waveShield = false; else p.shieldT = 0;
    p.inv = 40;
    SC.fx.ring(p.x, p.y, { color: '#7fe6ff', r0: 6, r1: 50, life: 16, thick: 2 });
    sfx('hit'); shake(3, 8);
    return true;
  }
  p.hp -= 1; p.inv = TUNE.hurtInv; p.hurtT = 16; run.hurtInWave = true;
  if (fromX != null) p.vx += (p.x < fromX ? -2.5 : 2.5);
  p.vy -= 1.5;
  sfx('hurt'); shake(7, 14); hs(5); vibe(90);
  SC.fx.flash('#ff2a2a', 6, 0.35);
  SC.fx.burst(p.x, p.y, { n: 10, colors: ['#ffffff', '#ff5a5a'], speed: 2.6, life: 22 });
  breakCombo();
  if (p.hp <= 0) startDying();
  return true;
}

function startDying() {
  run.phase = 'dying'; run.phaseT = 0; p.koT = 0; p.koVy = -4.2; p.parryT = -1; p.dashT = 0;
  shots.length = 0;
  sfx('lose'); hs(10); shake(10, 20);
  SC.fx.flash('#ffffff', 8, 0.7);
  if (SC.music) SC.music.stop();
  boom(p.x, p.y, false);
}

function updatePlayer(dt) {
  if (run.phase === 'dying') {
    p.koT += SC.dt;
    p.y += p.koVy * dt; p.koVy += 0.22 * dt; p.x += p.vx * dt; p.vx *= 0.99;
    if (p.y > SC.groundY - 10) { p.y = SC.groundY - 10; if (p.koVy > 1.2) { p.koVy *= -0.45; boom(p.x, p.y + 6, false); shake(4, 8); } else p.koVy = 0; }
    p.face = (M.floor(p.koT / 6) % 2) ? 1 : -1;
    return;
  }
  const inp = SC.input, b = p.buf;
  p.dashCd -= dt; p.parryCd -= dt; p.fireCd -= dt; p.fireT -= dt; p.inv -= dt; p.hurtT -= dt;
  p.shieldT = M.max(0, p.shieldT - dt);
  if (p.ammo < ammoMax()) { p.ammoT += dt; if (p.ammoT >= TUNE.ammoRegen) { p.ammo++; p.ammoT = 0; sfx('tick', { pitch: 1.4, vol: 0.5 }); } } else p.ammoT = 0;

  // input buffer: a press is remembered for a few frames so near-misses still fire
  b.dash = inp.pressed('dash') ? TUNE.inputBuf : M.max(0, b.dash - dt);
  b.parry = inp.pressed('parry') ? TUNE.inputBuf : M.max(0, b.parry - dt);
  b.fire = inp.pressed('fire') ? TUNE.inputBuf : M.max(0, b.fire - dt);

  const mv = inp.move();
  if (M.abs(mv.x) > 0.2) p.face = mv.x > 0 ? 1 : -1;

  // parry (may cancel the last few frames of a dash)
  if (b.parry > 0 && p.parryCd <= 0 && p.parryT < 0 && (p.dashT <= 0 || p.dashT <= TUNE.parryCancel)) {
    if (p.dashT > 0) { p.dashT = 0; p.vx *= 0.35; p.vy *= 0.35; }
    b.parry = 0;
    p.parryT = 0; p.parryCd = TUNE.parryWhiffCd; p.parryHit = false;
    sfx('dash', { pitch: 1.7, vol: 0.5 });
  }
  // dash
  if (b.dash > 0 && p.dashCd <= 0 && p.dashT <= 0 && p.parryT < 0) {
    b.dash = 0;
    let dx = mv.x, dy = mv.y; const l = hyp(dx, dy);
    if (l < 0.2) { dx = p.face; dy = 0; } else { dx /= l; dy /= l; }
    p.dashDx = dx; p.dashDy = dy; p.dashT = TUNE.dashFrames; p.dashCd = dashCdMax();
    sfx('dash'); vibe(15);
    SC.fx.burst(p.x, p.y, { n: 6, colors: ['#ffffff', '#bfe9ff'], speed: 1.8, life: 14, angle: M.atan2(-dy, -dx), spread: 1.2 });
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDx * TUNE.dashSpeed; p.vy = p.dashDy * TUNE.dashSpeed;
    if (M.floor(run.f) % 2 === 0) afters.push({ x: p.x, y: p.y, face: p.face, life: 10, fr: catFrame() });
    if (up('thorns') && M.floor(run.f) % 2 === 0) thorns.push({ x: p.x, y: p.y, life: 42, hit: {} });
    if (p.dashT <= 0) { p.dashT = 0; p.vx *= 0.35; p.vy *= 0.35; }
  } else {
    const k = 1 - M.pow(1 - TUNE.moveAccel, dt);
    p.vx += (mv.x * TUNE.moveSpeed - p.vx) * k;
    p.vy += (mv.y * TUNE.moveSpeed - p.vy) * k;
  }

  if (p.parryT >= 0) {
    doParry();
    p.parryT += dt;
    if (p.parryT >= TUNE.parryFrames) p.parryT = -1;
  }

  // bazooka
  if (b.fire > 0 && p.ammo > 0 && p.fireCd <= 0) { if (fireRocket()) b.fire = 0; }

  // movement in two substeps so a fast dash cannot skip past a hatch
  const minX = CAT.w / 2, maxX = W - CAT.w / 2;
  const minY = 12 + CAT.centre.y, maxY = SC.groundY - (CAT.h - CAT.centre.y) + 2;
  for (let s = 0; s < 2; s++) {
    p.x += p.vx * dt * 0.5; p.y += p.vy * dt * 0.5;
    if (p.x < minX) { p.x = minX; if (p.vx < 0) p.vx = 0; }
    if (p.x > maxX) { p.x = maxX; if (p.vx > 0) p.vx = 0; }
    if (p.y < minY) { p.y = minY; if (p.vy < 0) p.vy = 0; }
    if (p.y > maxY) { p.y = maxY; if (p.vy > 0) p.vy = 0; }
    if (p.dashT > 0 && s === 0) playerVsEnemies();
  }

  // dust near ground
  if (p.y > maxY - 14 && hyp(p.vx, p.vy) > 1) {
    p.dust -= dt;
    if (p.dust <= 0) { p.dust = 4; SC.fx.burst(p.x - p.face * 4, SC.groundY + 1, { n: 2, colors: ['#d8c8a0', '#a89870'], speed: 1, life: 14, angle: -PI / 2, spread: 1.5 }); }
  }
}

/* ------------------------------------------------------------------ parry */
function doParry() {
  const cx = p.x, cy = p.y, r = parryR();
  const early = p.parryT < TUNE.perfectFrames;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (s.fr || s.dead) continue;
    const d = hyp(s.x - cx, s.y - cy);
    if (d > r + 4) continue;
    const perfect = early && d < 0.6 * r;
    reflect(s, perfect);
    parrySuccess(perfect, s.x, s.y);
  }
}
function nearestEnemy(x, y, dirx, diry, maxCos, excl, excl2) {
  let best = null, bd = 1e9;
  for (const e of enemies) {
    if (e.dead || e.dying || e === excl || (excl2 != null && e.id === excl2)) continue;
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2, d = hyp(ex - x, ey - y);
    if (dirx != null) {
      const c = ((ex - x) * dirx + (ey - y) * diry) / (d || 1);
      if (c < maxCos) continue;
    }
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function reflect(s, perfect) {
  const sp0 = hyp(s.vx, s.vy) || 1;
  const bx = -s.vx / sp0, by = -s.vy / sp0;
  const tgt = nearestEnemy(s.x, s.y, bx, by, 0.25) || nearestEnemy(s.x, s.y, null, null, -1);
  let dx = bx, dy = by;
  if (tgt) {
    const ex = tgt.x + tgt.w / 2 - s.x, ey = tgt.y + tgt.h / 2 - s.y, l = hyp(ex, ey) || 1;
    dx = 0.7 * ex / l + 0.3 * bx; dy = 0.7 * ey / l + 0.3 * by;
    const dl = hyp(dx, dy) || 1; dx /= dl; dy /= dl;
  }
  const sp = clamp(sp0 * TUNE.reflectMul, 3.6, 8.5);
  s.vx = dx * sp; s.vy = dy * sp; s.fr = true; s.k = 'shell'; s.g = 0; s.dmg = 2; s.home = 0;
  s.par = true; s.age = 0; s.perfect = perfect;
}
function parrySuccess(perfect, sx, sy) {
  const first = !p.parryHit;
  p.parryHit = true; p.parryCd = 0; run.lastParryF = run.f;
  run.stats.parries++;
  hintDone('parry');
  missions.event('parry'); if (perfect) missions.event('perfect');
  addCombo(perfect ? 2 : 1);
  addScore(perfect ? 100 : 50, sx, sy - 12, perfect ? 'PERFECT' : null);
  if (first || run.parryFx <= 0) parryFx(perfect);
}
function parryFx(perfect) {
  run.parryFx = 14;
  const cx = p.x, cy = p.y;
  hs(5);
  run.pdark = 2;
  run.pflash = { n: 2, color: perfect ? '#fff2a0' : '#ffffff', frames: perfect ? 9 : 6, alpha: perfect ? 0.6 : 0.5 };
  shake(perfect ? 8 : 5, 12);
  const rg = [['#ffffff', 520, 22, 6], ['#4de8ff', 400, 28, 5], [perfect ? '#ffe14a' : '#a8f0ff', 300, 34, 4], ['#ff9a2e', 200, 40, 3]];
  for (const r of rg) {
    SC.fx.ring(cx, cy, { color: DARK, r0: 6, r1: r[1], life: r[2], thick: r[3] + 2 });
    SC.fx.ring(cx, cy, { color: r[0], r0: 6, r1: r[1], life: r[2], thick: r[3] });
  }
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (M.random() - 0.5) * 0.18;
    lines.push({ x: cx, y: cy, a, life: 16, age: 0, off: M.random() * 30, len: 50 + M.random() * 80, col: i % 2 ? '#ffffff' : (perfect ? '#ffe14a' : '#4de8ff'), th: i % 3 === 0 ? 2 : 1 });
  }
  const sl = SC.sprite.has('slash_big') ? 'slash_big' : 'slash';
  anims.push({ name: sl, x: cx + p.face * 14, y: cy, f: 0, sp: 2, flip: p.face < 0, top: true });
  SC.fx.burst(cx, cy, { n: 12, colors: ['#ffffff'], speed: 5.5, life: 22, size: 4 });
  SC.fx.burst(cx, cy, { n: 18, colors: ['#ffffff', '#4de8ff', '#ffe14a'], speed: 4, life: 24 });
  stampText(perfect ? 'PERFECT!' : 'PARRY!', '#ffe14a', { base: perfect ? 6 : 5, prio: perfect ? 3 : 1, life: perfect ? 46 : 36, shadow: DARK, wave: perfect ? 2 : 0 });
  if (SC.music) SC.music.duck(30);
  sfx(perfect ? 'parry_perfect' : 'parry'); vibe(perfect ? 45 : 25);
}

/* ------------------------------------------------------------------ bazooka */
function fireRocket() {
  const g = catGeom();
  let tgt = null, bs = 1e9;
  for (const e of enemies) {
    if (e.dead || e.dying) continue;
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2, d = hyp(ex - p.x, ey - p.y);
    const sc = d + ((ex - p.x) * p.face < 0 ? 140 : 0);
    if (sc < bs) { bs = sc; tgt = e; }
  }
  if (!tgt) return false;   // nothing to shoot at: no ammo spent
  const ang = M.atan2(tgt.y + tgt.h / 2 - g.hy, tgt.x + tgt.w / 2 - g.hx);
  const n = up('twin') ? 2 : 1;
  p.rside = -(p.rside || 1);
  const side = p.rside;
  for (let i = 0; i < n; i++) {
    // wide launch (~75-85 deg off the aim line, alternating sides) so every rocket swings out in a big arc
    let off = n === 2 ? (i ? 1 : -1) * (1.3 + M.random() * 0.18) : side * (1.3 + M.random() * 0.18);
    let a = ang + off;
    a += angDiff(a, -PI / 2) * 0.06;   // slight upward kick
    rockets.push({ x: g.hx, y: g.hy, ang: a, sp: 1.8, age: 0, tgt, trailT: 0, ph: M.random() * TAU });
  }
  p.ammo--; p.fireT = 14; p.fireCd = 14;
  p.vx -= M.cos(ang) * 1.2; p.vy -= M.sin(ang) * 1.2;
  hintDone('rocket');
  sfx('shoot', { pitch: 0.7 }); shake(2, 5);
  SC.fx.burst(g.hx, g.hy, { n: 6, colors: ['#ffffff', '#ffd23a', '#aaaaaa'], speed: 2, life: 14, angle: ang, spread: 0.8 });
  return true;
}
function updateRockets(dt) {
  for (const r of rockets) {
    if (r.dead) continue;
    if (!r.tgt || r.tgt.dead || r.tgt.dying) r.tgt = nearestEnemy(r.x, r.y, M.cos(r.ang), M.sin(r.ang), -0.3);
    if (r.tgt) {
      const da = angDiff(r.ang, M.atan2(r.tgt.y + r.tgt.h / 2 - r.y, r.tgt.x + r.tgt.w / 2 - r.x));
      const td = hyp(r.tgt.x + r.tgt.w / 2 - r.x, r.tgt.y + r.tgt.h / 2 - r.y);
      // lazy turn early (wide bendy arc), tightening with age; homes hard only when close so it still hits
      const tr = (0.022 + 0.09 * M.min(1, r.age / 50)) * (td < 80 && r.age > 30 ? 1 + (80 - td) / 22 : 1) * dt;
      r.ang += clamp(da, -tr, tr);
    }
    r.ang += M.sin(r.age * TAU / 20 + r.ph) * 0.055 * dt;
    r.sp = M.min(6, r.sp + 0.065 * dt);
    r.x += M.cos(r.ang) * r.sp * dt; r.y += M.sin(r.ang) * r.sp * dt; r.age += dt;
    r.trailT -= dt;
    if (r.trailT <= 0) {
      r.trailT = 2;
      smokePuff(r.x - M.cos(r.ang) * 6, r.y - M.sin(r.ang) * 6);
      SC.fx.burst(r.x - M.cos(r.ang) * 5, r.y - M.sin(r.ang) * 5, { n: 1, colors: ['#ffd23a', '#ff7a1a'], speed: 0.3, life: 8, size: 2 });
    }
    const ref = refC('rocket', dirIdx(-r.ang), r.x, r.y, false);
    let hit = false;
    for (const e of enemies) {
      if (e.dead || e.dying || (e.type === 'boss' && !e.bossReady)) continue;
      if (SC.collide(ref, enemyRef(e))) { hit = true; break; }
    }
    if (!hit) for (const s of shots) { if (!s.fr && !s.dead && hyp(s.x - r.x, s.y - r.y) < 8) { hit = true; break; } }
    if (hit || r.y > SC.groundY - 2 || r.age > 200 || r.x < -20 || r.x > W + 20 || r.y < -20) { r.dead = true; explodeRocket(r.x, r.y); }
  }
  rockets = rockets.filter(r => !r.dead);
}
function explodeRocket(x, y) {
  const R2 = splashR();
  boom(x, y, false);
  SC.fx.ring(x, y, { color: '#ffd23a', r0: 4, r1: R2 + 6, life: 14, thick: 2 });
  sfx('explode'); shake(3, 7); hs(2);
  for (const e of enemies.slice()) {
    if (e.dead || e.dying || (e.type === 'boss' && !e.bossReady)) continue;
    if (SC.collideCircle(enemyRef(e), x, y, R2)) damageEnemy(e, TUNE.rocketDmg, 'rocket');
  }
  for (const s of shots) if (!s.fr && !s.dead && hyp(s.x - x, s.y - y) < R2) { s.dead = true; SC.fx.burst(s.x, s.y, { n: 4, colors: ['#ffffff', '#ffd23a'], life: 12 }); }
}

/* ------------------------------------------------------------------ projectiles */
function shellSpeed() {
  const n = waveEff();
  return M.min(TUNE.shellCap, (1.3 + M.min(n, 22) * 0.1));
}
function fireShell(x, y, ang, sp, extra) {
  const s = { k: 'shell', x, y, vx: M.cos(ang) * sp, vy: M.sin(ang) * sp, fr: false, dmg: 1, age: 0, life: 600, grazed: false, g: 0, home: 0, dead: false, src: 0 };
  if (extra) for (const k in extra) s[k] = extra[k];
  shots.push(s);
  return s;
}
function shotSprite(s) {
  if (s.fr) return { name: 'shell_p', frame: M.floor(s.age / 4) % 2 };
  if (s.k === 'missile') return { name: 'missile', frame: dirIdx(M.atan2(-s.vy, s.vx)) };
  if (s.k === 'mortar') return { name: 'mortar', frame: M.floor(s.age / 4) % 2 };
  return { name: 'shell', frame: M.floor(s.age / 4) % 2 };
}
function shotRef(s) { const d = shotSprite(s); return refC(d.name, d.frame, s.x, s.y, false); }

function updateShots(dtE, dt) {
  const cref = run.phase === 'dying' ? null : catRef();
  const vulnerable = cref && p.inv <= 0 && p.dashT <= 0;
  for (const s of shots) {
    if (s.dead) continue;
    const ts = s.fr ? dt : dtE;
    if (s.k === 'missile' && !s.fr) {
      const da = angDiff(M.atan2(s.vy, s.vx), M.atan2(p.y - s.y, p.x - s.x));
      const a = M.atan2(s.vy, s.vx) + clamp(da, -0.02 * ts, 0.02 * ts);
      const sp = hyp(s.vx, s.vy);
      s.vx = M.cos(a) * sp; s.vy = M.sin(a) * sp;
      if (M.floor(s.age) % 3 === 0) SC.fx.burst(s.x, s.y, { n: 1, colors: ['#bbbbbb', '#ff9a2e'], speed: 0.2, life: 10 });
    }
    s.vy += s.g * ts;
    s.x += s.vx * ts; s.y += s.vy * ts; s.age += ts;
    if (s.fr) {
      if (trail.length < 400) trail.push({ x: s.x, y: s.y, life: 14, col: s.perfect ? '#ffe14a' : '#7fe6ff' });
      for (const e of enemies) {
        if (e.dead || e.dying) continue;
        if (SC.collide(shotRef(s), enemyRef(e))) {
          s.dead = true;
          SC.fx.burst(s.x, s.y, { n: 6, colors: ['#ffffff', '#7fe6ff'], speed: 2.4, life: 16 });
          s.revengeAt = { x: e.x + e.w / 2, y: e.y + e.h / 2 - 34 };
          const killed = damageEnemy(e, s.dmg, s.par && !s.chained ? 'parry' : 'chain2');
          if (killed && s.par) trick('REVENGE', 250, s.revengeAt.x, s.revengeAt.y);
          if (up('chain') && s.par && !s.chained) {
            const o = nearestEnemy(s.x, s.y, null, null, -1, e, s.src);
            if (o && hyp(o.x - e.x, o.y - e.y) < 240) {
              const a = M.atan2(o.y + o.h / 2 - s.y, o.x + o.w / 2 - s.x);
              fireShell(s.x, s.y, a, 7, { fr: true, dmg: 2, par: true, chained: true, src: s.src });
              SC.fx.ring(s.x, s.y, { color: '#4de8ff', r0: 3, r1: 22, life: 10, thick: 2 });
            }
          }
          break;
        }
      }
    } else {
      if (s.k === 'mortar') {
        if (s.age >= s.T || (cref && SC.collideCircle(cref, s.x, s.y, 5) && vulnerable)) {
          s.dead = true; boom(s.x, s.y, false, 20); sfx('explode', { vol: 0.7 });
          SC.fx.ring(s.x, s.y, { color: '#ff7a1a', r0: 3, r1: 24, life: 12, thick: 2 });
        }
      } else if (cref) {
        const ref = shotRef(s);
        const hitMask = SC.collide(ref, cref);
        if (hitMask) {
          if (vulnerable) { s.dead = true; boom(s.x, s.y, false); hurt(s.x); }
        } else if (!s.grazed && SC.collideCircle(cref, s.x, s.y, TUNE.grazeDist)) {
          s.grazed = true;
          run.score += 10; missions.event('graze'); addCombo(1);
          SC.fx.burst(s.x, s.y, { n: 4, colors: ['#ffffff', '#ffe14a'], speed: 1.8, life: 12 });
          SC.fx.popup('+10', p.x, p.y - 16, { color: '#ffe14a', life: 28 });
          if (run.grazeSfx <= 0) { sfx('graze'); run.grazeSfx = 6; }
        }
      }
    }
    if (s.x < -30 || s.x > W + 30 || s.y > H + 10 || (s.y < -30 && s.k !== 'mortar') || s.y < -140 || s.age > s.life) s.dead = true;
    if (!s.fr && s.y > SC.groundY + 2 && s.k !== 'mortar') { s.dead = true; SC.fx.burst(s.x, SC.groundY, { n: 4, colors: ['#d8c8a0', '#ff9a2e'], speed: 1.5, life: 12, angle: -PI / 2, spread: 2 }); }
  }
  shots = shots.filter(s => !s.dead);
}

/* ------------------------------------------------------------------ enemies */
function einfo(type) {
  const d = ET[type], a = (SC.art && SC.art.enemies && SC.art.enemies[type]) || {};
  const g = si(type, d.dw, d.dh);
  const w = g.ok ? g.w : (a.w || d.dw), h = g.ok ? g.h : (a.h || d.dh);
  return { w, h, frames: a.frames || {}, hatch: a.hatch || FALLBACK_HATCH[type] || null, hatches: a.hatches || null,
    turret: a.turret || { x: w / 2, y: 4 }, barrelLen: a.barrelLen || (type === 'boss' ? 34 : type === 'tank_heavy' ? 18 : 15) };
}
function hpFor(type) {
  if (type === 'boss') return TUNE.bossHp + TUNE.bossHpPerBoss * (M.floor(run.wave / 5) - 1);
  let hp = ET[type].hp;
  if (type === 'tank_heavy' && waveEff() > 12) hp += M.floor((waveEff() - 12) / 4);
  return hp;
}
function spawnEnemy(type, x) {
  type = ALIAS[type] || type;
  if (!ET[type]) return null;
  const d = ET[type], info = einfo(type);
  const left = x != null ? x < W / 2 : Q() < 0.5;
  const e = { id: ++run.eid, type, kind: d.kind, info, w: info.w, h: info.h, hp: hpFor(type), maxhp: 0, x: 0, y: 0,
    vx: 0, vy: 0, flip: false, flash: 0, stun: 0, bcd: 0, cd: 50 + Q() * 60, tele: 0, teleMax: 0, aim: -PI / 2, anim: Q() * 8,
    dir: left ? 1 : -1, age: 0, inside: false, dead: false, dying: false, turnT: 100 + Q() * 160, tx: 0, ty: 0, phase: Q() * TAU,
    hOpen: -1, hNext: 0, hTimer: 0, pat: 0, dyingT: 0, bossReady: false, locked: false, burstT: 0, phase2: false };
  e.maxhp = e.hp;
  if (d.kind === 'tank') {
    e.x = x != null ? x : (left ? -e.w - 4 : W + 4); e.y = SC.groundY - e.h + 1;
    if (x != null) e.inside = true;
    e.flip = e.dir > 0;
  } else if (type === 'heli') {
    e.x = x != null ? x : (left ? -e.w - 4 : W + 4); e.y = 30 + Q() * 40; e.tx = 90 + Q() * (W - 180); e.ty = e.y;
    if (x != null) e.inside = true;
    e.flip = e.dir > 0;
  } else if (type === 'drone') {
    e.x = x != null ? x : (left ? -20 : W + 20); e.y = 20 + Q() * 80; e.flip = e.dir > 0;
  } else if (type === 'boss') {
    e.x = W + 10; e.y = SC.groundY - e.h + 1; e.dir = -1; e.cd = 120; e.flip = false;
    run.bossAlive = true;
    sfx('boss_warn');
    run.warn = { t: 0, life: 120 };
    shake(4, 20);
  }
  if (FIRST_SEEN[type] && !run.hints.seen[type]) {
    run.hints.seen[type] = true; SC.store.set('hints', run.hints);
    subSet(FIRST_SEEN[type]);
  }
  enemies.push(e);
  return e;
}
function enemyRef(e) {
  const fa = e.info.frames, f = e.stun > 0 && fa.hurt && fa.hurt.length ? fa.hurt[0] : fr(fa.move, e.anim);
  return refTL(e.type, f, e.x, e.y, e.flip);
}
function hatchRect(e, h) {
  return { x: e.x + (e.flip ? e.w - h.x - h.w : h.x), y: e.y + h.y, w: h.w, h: h.h };
}
function pivot(e) {
  const t = e.info.turret;
  return { x: e.x + (e.flip ? e.w - 1 - t.x : t.x), y: e.y + t.y };
}
function tip(e) {
  const pv = pivot(e);
  return { x: pv.x + M.cos(e.aim) * e.info.barrelLen, y: pv.y + M.sin(e.aim) * e.info.barrelLen };
}
function clampAim(a) {
  if (a > 0) a = (a < PI / 2) ? -0.12 : -PI + 0.12;
  return clamp(a, -PI + 0.12, -0.12);
}
function aimAtCat(e, lead) {
  const pv = pivot(e), sp = shellSpeed();
  const dist = hyp(p.x - pv.x, p.y - pv.y), t = dist / M.max(1, sp);
  const tx = p.x + p.vx * t * lead, ty = p.y + p.vy * t * lead;
  return clampAim(M.atan2(ty - pv.y, tx - pv.x));
}
function leadFor() { return clamp((waveEff() - 3) / 9, 0, 0.6); }
function teleFrames(e) {
  const n = waveEff();
  let t = clamp(62 - n * 2.6, TUNE.teleFloor, 62);
  if (e.type === 'tank_heavy') t += 8;
  if (e.type === 'artillery') t += 14;
  return t;
}
function cdFor(e) {
  const n = waveEff();
  const base = { tank_light: 160 - n * 9, tank_heavy: 210 - n * 10, artillery: 230 - n * 10, heli: 230 - n * 10, boss: 150 }[e.type];
  const lo = { tank_light: 78, tank_heavy: 120, artillery: 140, heli: 140, boss: 110 }[e.type];
  return M.max(lo, base) * (0.8 + R() * 0.5);
}
function beginTele(e) {
  e.teleMax = e.tele = teleFrames(e);
  e.locked = false;
  if (e.type === 'artillery') {
    e.tx = clamp(p.x, 20, W - 20); e.ty = clamp(p.y, 50, SC.groundY - 14);
  }
  sfx('warn', { vol: 0.5 });
}

function updateEnemies(dtE, dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    e.flash = M.max(0, e.flash - dt);
    e.bcd = M.max(0, e.bcd - dt);
    if (e.type === 'boss') { updateBoss(e, dtE, dt); continue; }
    if (e.stun > 0) { e.stun -= dtE; continue; }
    e.age += dtE;
    if (e.kind === 'tank') updateTank(e, dtE);
    else if (e.type === 'heli') updateHeli(e, dtE);
    else if (e.type === 'drone') updateDrone(e, dtE);
  }
  enemies = enemies.filter(e => !e.dead);
}

function updateTank(e, dt) {
  const d = ET[e.type];
  const n = waveEff();
  let sp = d.speed * (e.type === 'tank_light' ? M.min(1.7, 1 + n * 0.04) : 1) * (e.tele > 0 ? 0.2 : 1);
  if (!e.inside) {
    e.x += e.dir * M.max(sp, 0.9) * dt;
    if (e.x >= 18 && e.x + e.w <= W - 18) e.inside = true;
  } else {
    e.turnT -= dt;
    if (e.turnT <= 0) { e.dir = -e.dir; e.turnT = 120 + R() * 220; }
    e.x += e.dir * sp * dt;
    if (e.x < 8) { e.x = 8; e.dir = 1; }
    if (e.x + e.w > W - 8) { e.x = W - 8 - e.w; e.dir = -1; }
  }
  e.flip = e.dir > 0;
  e.anim += M.abs(sp) * dt * 0.35;
  if (run.phase === 'dying') return;
  if (e.burstT > 0) {
    e.burstT -= dt;
    if (e.burstT <= 0) { const t2 = tip(e); fireShell(t2.x, t2.y, e.aim, shellSpeed(), { src: e.id }); sfx('shoot', { vol: 0.7 }); }
  }
  const lead = leadFor();
  if (e.tele > 0) {
    e.tele -= dt;
    if (e.tele > 14 && e.type !== 'artillery') e.aim += clamp(angDiff(e.aim, aimAtCat(e, lead)), -0.12, 0.12);
    if (e.tele <= 0) { tankFire(e); e.cd = cdFor(e); }
  } else {
    if (e.type === 'artillery') e.aim += clamp(angDiff(e.aim, -PI / 2 + (p.x > e.x ? 0.35 : -0.35)), -0.05, 0.05);
    else e.aim += clamp(angDiff(e.aim, aimAtCat(e, 0)), -0.05, 0.05);
    e.aim = clampAim(e.aim);
    e.cd -= dt;
    if (e.cd <= 0 && e.inside) beginTele(e);
  }
}
function tankFire(e) {
  const t = tip(e), sp = shellSpeed(), ex = { src: e.id };
  sfx('shoot', { pitch: e.type === 'tank_heavy' ? 0.7 : 1 });
  SC.fx.burst(t.x, t.y, { n: 5, colors: ['#ffffff', '#ffd23a', '#888888'], speed: 1.8, life: 12, angle: e.aim, spread: 0.7 });
  if (e.type === 'tank_light') {
    fireShell(t.x, t.y, e.aim, sp, ex);
    if (waveEff() >= 15 && R() < 0.25) e.burstT = 11;   // late game: quick second shell
  } else if (e.type === 'tank_heavy') { for (const o of [-0.3, 0, 0.3]) fireShell(t.x, t.y, e.aim + o, sp * 0.92, ex); }
  else if (e.type === 'artillery') launchMortar(t.x, t.y, e.tx, e.ty, e.id);
}
function launchMortar(bx, by, tx, ty, src) {
  const dist = hyp(tx - bx, ty - by);
  const Tt = clamp(dist / 2.0, 52, 96);
  const g = TUNE.mortarG;
  const s = fireShell(bx, by, 0, 0, { k: 'mortar', g, T: Tt, tx, ty, life: 400, src: src || 0 });
  s.vx = (tx - bx) / Tt; s.vy = (ty - by - 0.5 * g * Tt * Tt) / Tt;
  return s;
}

function updateHeli(e, dt) {
  e.anim += dt * 0.6;
  if (!e.inside) {
    e.x += e.dir * 1.2 * dt;
    if (e.x >= 40 && e.x + e.w <= W - 40) e.inside = true;
  } else {
    e.turnT -= dt;
    if (e.turnT <= 0) { e.tx = 70 + R() * (W - 140 - e.w); e.turnT = 160 + R() * 160; e.ty = 28 + R() * 50; }
    const sp = ET.heli.speed * (e.tele > 0 ? 0.3 : 1);
    const dx = e.tx - e.x, dy = e.ty - e.y;
    if (M.abs(dx) > 2) { e.x += M.sign(dx) * sp * dt; e.dir = dx > 0 ? 1 : -1; }
    if (M.abs(dy) > 2) e.y += M.sign(dy) * sp * 0.6 * dt;
    e.y += M.sin(e.age * 0.07) * 0.2 * dt;
  }
  e.flip = e.dir > 0;
  if (run.phase === 'dying') return;
  if (e.tele > 0) {
    e.tele -= dt;
    if (e.tele <= 0) {
      const cx = e.x + e.w / 2, cy = e.y + e.h - 2;
      const a = M.atan2(p.y - cy, p.x - cx);
      const offs = waveEff() >= 20 ? [-0.14, 0.14] : [0];
      for (const o of offs) fireShell(cx, cy, a + o, 1.5 + M.min(waveEff(), 12) * 0.04, { k: 'missile', life: 360, src: e.id });
      sfx('shoot', { pitch: 0.8 });
      SC.fx.burst(cx, cy, { n: 4, colors: ['#ffffff', '#aaaaaa'], speed: 1.4, life: 12 });
      e.cd = cdFor(e);
    }
  } else { e.cd -= dt; if (e.cd <= 0 && e.inside) beginTele(e); }
  e.aim = M.atan2(p.y - e.y, p.x - e.x);
}

function updateDrone(e, dt) {
  e.anim += dt * 0.5;
  const sp = M.min(2.1, ET.drone.speed + waveEff() * 0.04);
  const dx = p.x - e.x - e.w / 2, dy = p.y - e.y - e.h / 2, l = hyp(dx, dy) || 1;
  const wob = M.sin(e.age * 0.12 + e.phase) * 0.35;
  const tx = dx / l * sp - dy / l * wob, ty = dy / l * sp + dx / l * wob;
  e.vx += (tx - e.vx) * 0.05 * dt; e.vy += (ty - e.vy) * 0.05 * dt;
  if (run.phase === 'dying') { e.vx *= 0.9; e.vy *= 0.9; }
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.y = M.min(e.y, SC.groundY - e.h);
  e.flip = e.vx > 0;
}

/* ------------------------------------------------------------------ boss */
function updateBoss(e, dtE, dt) {
  e.anim += dtE * 0.2;
  if (e.dying) { bossDying(e, dt); return; }
  e.age += dtE;
  if (!e.bossReady) {
    e.x -= 0.8 * dtE;
    if (e.x <= W - e.w - 24) { e.bossReady = true; e.cd = 100; }
    return;
  }
  const frac = e.hp / e.maxhp;
  if (!e.phase2 && frac < 0.5) {
    e.phase2 = true; e.cd = M.min(e.cd, 50);
    stampText('PHASE 2!', '#ff5a5a', { prio: 3, base: 5, life: 44, shadow: DARK });
    sfx('boss_warn', { pitch: 1.25 }); shake(8, 18); SC.fx.flash('#ff5a5a', 8, 0.4);
  }
  const spd = e.phase2 ? 1.5 : 1;
  e.turnT -= dtE;
  if (e.turnT <= 0) { e.dir = -e.dir; e.turnT = 160 + R() * 160; }
  e.x += e.dir * ET.boss.speed * spd * (e.tele > 0 ? 0.2 : 1) * dtE;
  if (e.x < W * 0.25) { e.x = W * 0.25; e.dir = 1; }
  if (e.x + e.w > W - 10) { e.x = W - 10 - e.w; e.dir = -1; }
  // hatches take turns
  e.hTimer += dtE;
  if (e.hOpen >= 0) {
    if (e.hTimer > TUNE.bossHatchOpen) { e.hOpen = -1; e.hTimer = 0; e.hNext = (e.hNext + 1) % hatchCount(e); }
  } else if (e.hTimer > TUNE.bossHatchClosed) { e.hOpen = e.hNext; e.hTimer = 0; sfx('warn', { pitch: 1.5, vol: 0.5 }); }
  if (run.phase === 'dying') return;
  if (e.tele > 0) {
    e.tele -= dtE;
    if (e.pat === 0 && e.tele > 14) e.aim += clamp(angDiff(e.aim, aimAtCat(e, 0.2)), -0.1, 0.1);
    if (e.tele <= 0) { bossFire(e); e.cd = (70 + frac * 90) * (e.phase2 ? 0.85 : 1); }
  } else {
    e.cd -= dtE;
    e.aim = clampAim(e.aim + clamp(angDiff(e.aim, aimAtCat(e, 0)), -0.04, 0.04));
    if (e.cd <= 0) {
      e.pat = e.phase2 ? M.floor(R() * 3) : M.floor(R() * 2);
      e.teleMax = e.tele = 46; sfx('warn', { vol: 0.6 });
      if (e.pat === 1) { e.tx = p.x; e.ty = p.y; }
    }
  }
}
function hatchCount(e) { return e.info.hatches && e.info.hatches.length ? e.info.hatches.length : 3; }
function bossHatches(e) {
  if (e.info.hatches && e.info.hatches.length) return e.info.hatches;
  const w = e.w; // fallback: three hatches along the top
  return [{ x: w * 0.12, y: 0, w: 16, h: 6 }, { x: w * 0.45, y: 0, w: 16, h: 6 }, { x: w * 0.76, y: 0, w: 16, h: 6 }];
}
function bossFire(e) {
  const t = tip(e), sp = shellSpeed() * 0.95, ex = { src: e.id };
  sfx('shoot', { pitch: 0.6 }); shake(3, 8);
  SC.fx.burst(t.x, t.y, { n: 8, colors: ['#ffffff', '#ffd23a'], speed: 2.4, life: 14, angle: e.aim, spread: 0.9 });
  if (e.pat === 0) { for (const o of [-0.4, -0.2, 0, 0.2, 0.4]) fireShell(t.x, t.y, e.aim + o, sp, ex); }
  else if (e.pat === 1) {
    const n = e.phase2 ? 6 : 4, gap = e.phase2 ? 38 : 46;
    for (let i = 0; i < n; i++) {
      const tx = clamp(e.tx + (i - (n - 1) / 2) * gap + (R() - 0.5) * 20, 20, W - 20), ty = clamp(e.ty + (R() - 0.5) * 50, 50, SC.groundY - 14);
      launchMortar(t.x, t.y, tx, ty, e.id);
    }
  } else {
    const pv = pivot(e);
    for (let i = 0; i < 12; i++) { const a = -PI + 0.15 + (i / 11) * (PI - 0.3); fireShell(pv.x, pv.y, a, sp * 0.8, ex); }
  }
}
function bossDying(e, dt) {
  e.dyingT += dt;
  if (M.floor(e.dyingT) % 4 === 0 && M.floor(e.dyingT) !== e.lastBoom) {
    e.lastBoom = M.floor(e.dyingT);
    const bigOne = R() < 0.3;
    boom(e.x + R() * e.w, e.y + R() * e.h, bigOne);
    sfx(bigOne ? 'explode_big' : 'explode', { vol: 0.6, pitch: 0.8 + M.random() * 0.4 }); shake(5, 6);
    smokePuff(e.x + R() * e.w, e.y + R() * e.h * 0.5);
  }
  if (e.dyingT > 110) {
    e.dead = true;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    for (let i = 0; i < 4; i++) anims.push({ name: 'explosion_big', x: cx + (i - 1.5) * 24, y: cy + (i % 2 ? -10 : 8), f: -i * 2, sp: 3 });
    SC.fx.debris(cx, cy, { n: 30, colors: ['#555555', '#888888', '#c8321e', '#ffd23a'] });
    SC.fx.flash('#ffffff', 14, 0.9); shake(12, 30); hs(20);
    SC.fx.ring(cx, cy, { color: '#ffffff', r0: 6, r1: 560, life: 30, thick: 5 });
    sfx('explode_big'); sfx('boss_die'); vibe(200);
    addCoinBurst(cx, cy, 30);
    addScore(ET.boss.score, cx, cy - 34, null, 3);
    run.kos++; run.stats.kos++; missions.event('ko');
    run.bossAlive = false;
    shots.length = 0;
    for (const o of enemies) if (o !== e && !o.dead) { o.hp = 0; koEnemy(o, 'chain'); }
    spawnPickup(cx, cy - 20, 'heart');
  }
}

/* ------------------------------------------------------------------ damage and KO */
function damageEnemy(e, dmg, src) {
  if (e.dead || e.dying) return false;
  if (e.type === 'boss' && !e.bossReady) return false;
  e.hp -= dmg; e.flash = 3;
  sfx('hit', { pitch: 0.9 + M.random() * 0.3 });
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  SC.fx.burst(cx, cy, { n: 5, colors: ['#ffffff', '#ffd23a'], speed: 2, life: 14 });
  if (e.hp <= 0) {
    if (e.type === 'boss') { startBossDeath(e); return true; }
    const sniped = src === 'rocket' && e.tele > 0 && e.kind === 'tank';
    koEnemy(e, src);
    if (sniped) trick('SNIPE', 150, cx, cy - 50);
    return true;
  }
  if (e.type === 'boss') shake(2, 4);
  return false;
}
function startBossDeath(e) {
  e.dying = true; e.dyingT = 0; e.tele = 0; e.hOpen = -1;
  shots.length = 0;
  sfx('boss_warn', { pitch: 0.6 }); hs(8);
  SC.fx.flash('#ffffff', 8, 0.7);
}
function koEnemy(e, how) {
  if (e.dead) return;
  e.dead = true;
  const d = ET[e.type], cx = e.x + e.w / 2, cy = e.y + e.h / 2, dive = how === 'dive';
  const big = e.type === 'tank_heavy' || e.type === 'artillery' || e.type === 'boss';
  boom(cx, cy, big);
  SC.fx.debris(cx, cy, { n: big ? 14 : 10, colors: ['#555555', '#888888', '#c8321e', '#ffd23a'] });
  const ns = big ? 8 : 6;
  for (let i = 0; i < ns; i++) smokePuff(cx + (M.random() - 0.5) * e.w * 0.8, cy + (M.random() - 0.5) * e.h * 0.6);
  // two-frame white silhouette of the dying enemy
  const fa = e.info.frames;
  sils.push({ type: e.type, frame: fr(fa.move, e.anim), x: e.x, y: e.y, flip: e.flip, life: 2 });
  if (how !== 'chain') {
    if (dive) {
      hs(6); shake(8, 14); sfx('dive_ko');
      SC.fx.ring(cx, cy, { color: '#ffe14a', r0: 4, r1: 90, life: 16, thick: 3 });
      SC.fx.flash('#fff2a0', 4, 0.3);
      if (d.kind === 'tank') {
        const pv = pivot(e);
        flyers.push({ x: pv.x, y: pv.y, vx: (R() < 0.5 ? -1 : 1) * (1.2 + M.random() * 1.6), vy: -5.5, a: 0, spin: (M.random() - 0.5) * 0.5, len: e.info.barrelLen, life: 120 });
      }
      stampText('DIVE KO!', '#ffe14a', { prio: 2, base: 4, shadow: DARK });
      if (run.f - run.lastParryF <= 20) { trick('COUNTER', 300, cx, cy - 56); }
    } else { hs(3); shake(3, 6); sfx('ko'); }
    if (big) sfx('explode_big', { vol: 0.8 });
  } else sfx('explode', { vol: 0.5 });
  vibe(dive ? 60 : 30);
  const n = d.coins + (dive ? 2 : 0);
  addCoinBurst(cx, cy, n);
  addScore(d.score * (dive ? 2 : 1), cx, cy - 34, null, dive ? 2 : 1);
  run.kos++; run.stats.kos++;
  missions.event('ko');
  if (dive && d.kind === 'tank') { run.stats.dives++; hintDone('dive'); missions.event('dive'); if (e.type === 'tank_heavy') missions.event('diveheavy'); }
  if (how === 'rocket') missions.event('rocketko');
  if (e.type === 'drone') missions.event('drone');
  if (how !== 'chain') {
    addCombo(1);
    if (P() < (dive ? 0.3 : 0.12) && !run.over) spawnPickup(cx, cy - 8);
  }
}

/* ------------------------------------------------------------------ player vs enemies */
function playerVsEnemies() {
  if (run.phase === 'dying') return;
  const cref = catRef();
  const dash = p.dashT > 0;
  for (const e of enemies) {
    if (e.dead || e.dying) continue;
    const touch = SC.collide(cref, enemyRef(e));
    let hatchHit = false;
    if (dash) {
      if (e.type === 'boss') {
        if (e.hOpen >= 0 && e.bossReady) {
          const hl = bossHatches(e);
          hatchHit = SC.collideRect(cref, padRect(hatchRect(e, hl[e.hOpen % hl.length])));
        }
      } else if (e.kind === 'tank' && e.info.hatch) hatchHit = SC.collideRect(cref, padRect(hatchRect(e, e.info.hatch)));
    }
    if (!touch && !hatchHit) continue;
    const cx = e.x + e.w / 2;
    if (dash) {
      if (e.type === 'drone') { koEnemy(e, 'dash'); continue; }
      if (e.type === 'heli') { koEnemy(e, 'dive'); continue; }
      if (e.type === 'boss') { if (hatchHit) bossDive(e); else bounce(e); continue; }
      if (hatchHit) { koEnemy(e, 'dive'); continue; }
      bounce(e);
    } else if (p.inv <= 0 && touch) {
      if (e.type === 'drone') { koEnemy(e, 'dash'); hurt(cx); }
      else hurt(cx);
    }
  }
}
function bounce(e) {
  if (e.bcd > 0) return;
  e.bcd = 24;
  if (e.type !== 'boss') { e.stun = TUNE.stunFrames; e.tele = 0; e.cd = M.max(e.cd, 60); e.burstT = 0; }
  e.flash = 3;
  p.inv = M.max(p.inv, TUNE.bounceInv);
  p.vx = -p.dashDx * 3.8; p.vy = -p.dashDy * 3.8 - 1.6; p.dashT = 0;
  sfx('bounce'); shake(4, 8); hs(2);
  SC.fx.burst(p.x, p.y, { n: 8, colors: ['#ffffff', '#ffd23a'], speed: 2.6, life: 16 });
  SC.fx.popup('CLANG', p.x, p.y - 14, { color: '#ffffff', life: 24 });
}
function bossDive(e) {
  const cx = p.x, cy = p.y;
  e.hp -= 10; e.flash = 6; e.hOpen = -1; e.hTimer = 0; e.hNext = (e.hNext + 1) % hatchCount(e);
  p.vx = -p.dashDx * 3; p.vy = -4; p.dashT = 0; p.inv = M.max(p.inv, 40);
  boom(cx, cy, true); hs(8); shake(10, 16); sfx('dive_ko'); sfx('explode_big', { vol: 0.8 }); vibe(80);
  SC.fx.ring(cx, cy, { color: '#ffe14a', r0: 4, r1: 140, life: 20, thick: 3 });
  SC.fx.flash('#fff2a0', 6, 0.5);
  stampText('CRITICAL!', '#ffe14a', { prio: 3, base: 5, shadow: DARK });
  addScore(500, cx, cy - 34, null, 2); addCombo(2);
  run.stats.dives++; hintDone('dive'); missions.event('dive');
  if (e.hp <= 0) startBossDeath(e);
}

/* thorns */
function updateThorns(dt) {
  for (const t of thorns) {
    t.life -= dt;
    for (const e of enemies) {
      if (e.dead || e.dying || t.hit[e.id]) continue;
      if (SC.collideCircle(enemyRef(e), t.x, t.y, 7)) { t.hit[e.id] = true; damageEnemy(e, 1, 'thorn'); }
    }
  }
  thorns = thorns.filter(t => t.life > 0);
}

/* ------------------------------------------------------------------ pickups and coins */
function spawnPickup(x, y, type) {
  if (pickups.length >= 4) return;
  if (!type) {
    type = pick(PU_TYPES, P);
    if (type === 'heart' && p.hp >= p.maxhp) type = 'rockets';
  }
  pickups.push({ type, x: clamp(x, 20, W - 20), by: clamp(y, 44, SC.groundY - 40), rise: 2, age: 0, life: 720 });
}
function updatePickups(dt) {
  const cref = catRef();
  for (const u of pickups) {
    u.age += dt; u.rise = M.max(0, u.rise - 0.04 * dt); u.by -= u.rise * dt;
    u.by = M.max(u.by, 40);
    u.y = u.by + M.sin(u.age * 0.08) * 4;
    if (u.age > u.life) u.dead = true;
    if (hyp(u.x - p.x, u.y - p.y) < 16 || SC.collide(cref, refC('pu_' + u.type, 0, u.x, u.y, false))) { u.dead = true; collectPickup(u); }
  }
  pickups = pickups.filter(u => !u.dead);
}
function collectPickup(u) {
  sfx('powerup');
  SC.fx.ring(u.x, u.y, { color: '#ffffff', r0: 4, r1: 36, life: 14, thick: 2 });
  SC.fx.burst(u.x, u.y, { n: 10, colors: ['#ffffff', '#ffe14a', '#4de8ff'], speed: 2.4, life: 22 });
  const label = { shield: 'SHIELD', slow: 'SLOW', magnet: 'MAGNET', rockets: '+ROCKETS', heart: '+HEART', star: 'X2 SCORE' }[u.type];
  SC.fx.popup(label, u.x, u.y - 12, { color: '#ffffff', life: 44 });
  switch (u.type) {
    case 'shield': p.shieldT = TUNE.shieldPuFrames; break;
    case 'slow': run.t.slow = TUNE.slowFrames; break;
    case 'magnet': run.t.magnet = TUNE.magnetFrames; break;
    case 'rockets': p.ammo = M.min(M.max(ammoMax(), TUNE.ammoHardCap), p.ammo + TUNE.ammoPickup); break;
    case 'heart': if (p.hp < p.maxhp) p.hp++; else addScore(200, u.x, u.y - 22); break;
    case 'star': run.t.star = TUNE.starFrames; break;
  }
}
function updateCoins(dt) {
  const mr = magnetR();
  for (const c of coinsL) {
    c.age += dt;
    const d = hyp(p.x - c.x, p.y - c.y);
    const pulled = run.phase !== 'dying' && ((run.vac && c.age > 6) || (c.age > 20 && d < mr));
    if (pulled) {
      const l = d || 1, pull = run.vac ? 9 : M.min(7, 1.4 + (mr - d) / mr * 4);
      c.vx += (p.x - c.x) / l * 0.5 * dt; c.vy += (p.y - c.y) / l * 0.5 * dt;
      const sp = hyp(c.vx, c.vy); if (sp > pull + 3) { c.vx *= (pull + 3) / sp; c.vy *= (pull + 3) / sp; }
      c.grounded = false; c.mag = true;
    } else {
      c.mag = false;   // left the magnet range: falls again
      c.vy += 0.12 * dt;
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (!c.mag) {
      c.vx *= 0.985;
      if (c.y > SC.groundY - 4) { c.y = SC.groundY - 4; c.vy *= -0.4; if (M.abs(c.vy) < 0.4) c.vy = 0; c.vx *= 0.8; }
    }
    c.x = clamp(c.x, 4, W - 4);
    if (d < 13 && run.phase !== 'dying') {
      c.dead = true; run.coins++; missions.event('coins');
      const ch = run.coinChain || 0;
      sfx('coin', { pitch: 1 + M.min(ch, run.vac ? 18 : 8) * (run.vac ? 0.04 : 0.05), vol: 0.6 });
      run.coinChain = ch + 1; run.coinChainT = run.vac ? 30 : 20;
      SC.fx.burst(c.x, c.y, { n: 2, colors: ['#ffe14a', '#ffffff'], speed: 1, life: 8 });
    }
    if (c.age > 900) c.dead = true;
  }
  run.coinChainT = (run.coinChainT || 0) - dt; if (run.coinChainT <= 0) run.coinChain = 0;
  coinsL = coinsL.filter(c => !c.dead);
}

/* ------------------------------------------------------------------ waves */
const COST = { tank_light: 1, drone: 1, tank_heavy: 3, artillery: 2.5, heli: 3.5, boss: 0 };
function genQueue(n, budgetOverride) {
  const q = [];
  if (n % 5 === 0 && budgetOverride == null) {
    q.push('boss');
    const k = 2 + M.floor(n / 5);
    for (let i = 0; i < k; i++) q.push(Q() < 0.6 ? 'tank_light' : 'drone');
    return q;
  }
  if (budgetOverride == null) {
    if (n === 1) return ['tank_light', 'tank_light'];
    if (n === 2) return ['tank_light', 'tank_light', 'tank_light', 'tank_light'];
    if (n === 3) return ['tank_light', 'tank_light', 'tank_heavy'];
    if (n === 4) return ['tank_light', 'drone', 'drone', 'tank_light', 'artillery'];
  }
  let budget = budgetOverride != null ? budgetOverride : 4 + n * 2.3;
  const opts = [['tank_light', 3]];
  if (n >= 3) { opts.push(['drone', 1.5], ['tank_heavy', 1.5 + (n - 3) * 0.2]); }
  if (n >= 4) opts.push(['artillery', 1]);
  if (n >= 5) opts.push(['heli', 1.2]);
  let guard = 40;
  while (budget >= 1 && guard-- > 0) {
    const av = opts.filter(o => COST[o[0]] <= budget + 0.01);
    if (!av.length) break;
    let tot = 0; av.forEach(o => (tot += o[1]));
    let r = Q() * tot, ch = av[0][0];
    for (const o of av) { r -= o[1]; if (r <= 0) { ch = o[0]; break; } }
    q.push(ch); budget -= COST[ch];
  }
  return q;
}
function biomeFor(n) {
  const idx = M.floor((n - 1) / 5), o = run.biomeOrder;
  while (o.length <= idx) {
    const perm = [0, 1, 2, 3, 4];
    for (let i = 4; i > 0; i--) { const j = M.floor(run.biomeRng() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    if (o.length && perm[0] === o[o.length - 1]) { const t = perm[0]; perm[0] = perm[1]; perm[1] = t; }
    for (let i = 0; i < 5; i++) o.push(perm[i]);
  }
  return o[idx];
}

function startWave(n) {
  run.waveCoins0 = run.coins; run.wave = n; run.phase = 'fight'; run.phaseT = 0; run.waveT = 0; run.hurtInWave = false; run.vac = false;
  run.queue = genQueue(n);
  run.spawnT = n === 1 ? 70 : 50;
  const nb = biomeFor(n);
  if (nb !== run.biome) { run.prevBiome = run.biome; run.biome = nb; run.blend = 0; }
  if (up('shield')) p.waveShield = true;
  const rg = up('regen');
  if (rg && n > 1 && (n - 1) % M.max(1, 3 - rg) === 0 && p.hp < p.maxhp) { p.hp++; SC.fx.popup('+1 HP', p.x, p.y - 20, { color: '#ff5a7a' }); }
  missions.event('wave', n);
  const st = getStats();
  if (n > st.bestWave) { st.bestWave = n; SC.store.set('stats', st); }
  checkGoal();
  const boss = n % 5 === 0;
  const ls = [{ t: 'WAVE ' + n, s: boss ? 3 : 4, c: boss ? '#ff7a7a' : '#ffffff' }];
  if (boss) ls.push({ t: 'MEGA TANK', s: 2, c: '#ffe14a' });
  if (n === 1 && run.goal) ls.push({ t: 'GOAL: ' + run.goal.text, s: 1, c: '#4de8ff' });
  bannerSet(ls, boss ? 56 : 95);
  sfx(boss ? 'boss_warn' : 'wave_start');
  if (SC.music) SC.music.play(boss ? 'boss' : 'battle');
}
function aliveNonDying() { return enemies.filter(e => !e.dead).length; }

function updateWave(dt) {
  run.waveT += dt;
  if (run.phase === 'fight') {
    if (run.waveT > 55) {
      run.spawnT -= dt;
      const boss = run.wave % 5 === 0;
      const cap = boss ? 4 : M.min(11, 3 + M.floor(run.wave / 2));
      const alive = aliveNonDying();
      if (alive === 0 && run.queue.length && run.spawnT > 20) run.spawnT = 20;
      if (run.spawnT <= 0 && run.queue.length && alive < cap) {
        const t = run.queue[0];
        if (t !== 'boss' && boss && run.bossAlive && alive >= 3) { run.spawnT = 20; }
        else {
          run.queue.shift(); spawnEnemy(t);
          run.spawnT = (t === 'boss' ? 140 : M.max(30, 110 - run.wave * 6)) * (boss ? 1.6 : 1);
        }
      }
    }
    checkGoal();
    if (!run.queue.length && enemies.length === 0 && run.waveT > 60) waveClear();
  } else if (run.phase === 'clear') {
    run.phaseT += dt;
    if (run.phaseT > 85) {
      openDraft();
    }
  }
}
function waveClear() {
  run.phase = 'clear'; run.phaseT = 0; run.vac = true; run.coinChain = 0;
  bannerSet([{ t: 'WAVE CLEAR', s: 4, c: '#ffe14a' }], 85);
  sfx('wave_clear'); SC.fx.flash('#ffffff', 4, 0.25); shake(3, 8);
  addScore(100 * run.wave, p.x, p.y - 22, 'CLEAR');
  SC.fx.popup('+' + (run.coins - (run.waveCoins0 || 0)) + ' COINS', p.x, p.y - 56, { color: '#ffe14a', life: 70 });
  if (run.wave % 5 === 0) { spawnPickup(W / 2, 120, 'heart'); }
  // SWIFT: beat the par time for a flat bonus
  const par = TUNE.swiftPar + run.wave * TUNE.swiftPerWave;
  if (run.waveT < par) {
    const bonus = M.round((par - run.waveT) * 2);
    run.score += bonus; run.coins += 10;
    addCoinBurst(p.x, p.y - 20, 5);
    SC.fx.popup('SWIFT +' + bonus, p.x, p.y - 44, { color: '#4de8ff', life: 60 });
    stampText('SWIFT!', '#4de8ff', { prio: 2, base: 4, life: 50, shadow: DARK });
  }
  if (run.goal && !run.goal.done && run.goal.kind === 'nodmg' && run.wave === run.goal.target && !run.hurtInWave) {
    run.goal.done = true; run.coins += TUNE.goalCoins;
    stampText('GOAL DONE!', '#4de8ff', { prio: 3, base: 4 });
    SC.fx.popup('+' + TUNE.goalCoins + ' COINS', p.x, p.y - 30, { color: '#ffe14a', life: 60 });
  }
  checkGoal();
  bankCoins();
}

/* ------------------------------------------------------------------ draft */
function openDraft() {
  const pool = UP_IDS.filter(id => up(id) < UPS[id].max);
  const rnd = M.random;
  const offers = [];
  while (offers.length < 3 && pool.length) offers.push(pool.splice(M.floor(rnd() * pool.length) % pool.length, 1)[0]);
  if (!offers.length) { startWave(run.wave + 1); return; }
  run.draft = offers; run.draftT = 0; run.phase = 'draft';
  if (SC.ui.resetFocus) SC.ui.resetFocus();
  sfx('select');
}
function applyUpgrade(id) {
  run.up[id] = up(id) + 1;
  switch (id) {
    case 'maxhp': p.maxhp++; p.hp = M.min(p.maxhp, p.hp + 2); break;
    case 'ammo': p.ammo = M.min(ammoMax() + 3, p.ammo + 1); break;
    case 'shield': p.waveShield = true; break;
  }
  sfx('confirm'); SC.fx.ring(p.x, p.y, { color: '#ffe14a', r0: 4, r1: 60, life: 18, thick: 2 });
  SC.fx.popup(UPS[id].title, p.x, p.y - 24, { color: '#ffe14a', life: 60 });
  run.draft = null;
  startWave(run.wave + 1);
}
function drawDraft() {
  SC.rect(0, 0, W, H, 'rgba(8,10,24,0.72)');
  T('CHOOSE AN UPGRADE', W / 2, 26, { scale: 2, align: 'center', color: '#ffe14a', wave: 1 });
  T('WAVE ' + run.wave + ' CLEARED', W / 2, 48, { align: 'center', color: '#ffffff' });
  const cw = 130, ch = 150, gap = 14, total = cw * 3 + gap * 2, x0 = (W - total) / 2, y0 = 70;
  const ready = run.draftT > TUNE.draftGuard;
  for (let i = 0; i < run.draft.length; i++) {
    const id = run.draft[i];
    const k = clamp((run.draftT - i * 5) / TUNE.draftAnim, 0, 1);
    const ww = M.max(4, M.round(cw * M.abs(M.cos((1 - SC.ease.outCubic(k)) * PI / 2))));
    const cx = x0 + i * (cw + gap) + cw / 2;
    const lv = up(id);
    const picked = SC.ui.card('card' + i, M.round(cx - ww / 2), y0, ww, ch,
      { title: UPS[id].title, desc: UPS[id].desc, icon: 'up_' + id, accent: ['#ff9a2e', '#4de8ff', '#ff5fb0'][i],
        level: lv > 0 ? 'LV ' + lv + ' > ' + (lv + 1) : 'NEW' });
    // guard against a stray press (a held Space from dashing counts as confirm for the first second)
    const spaceHeld = run.draftT < TUNE.draftSpaceGuard && SC.input.down('dash');
    if (picked && ready && !spaceHeld) { applyUpgrade(id); return; }
  }
  if (ready) { T('PICK WITH MOUSE OR TOUCH, OR', W / 2 - 40, 240, { align: 'center', color: '#aab' }); SC.ui.prompt(W / 2 + 76, 238, 'confirm', 'PICK'); }
}

/* ------------------------------------------------------------------ end of run */
function bankCoins() {
  const tot = run.coins + missions.bonus;
  const d = tot - run.banked;
  if (d !== 0) { SC.store.set('coins', (SC.store.get('coins', 0) || 0) + d); run.banked = tot; }
  return tot;
}
// idempotent: coins, stats, best score is saved whenever a run ends or is left
function saveRun() {
  if (!run) return 0;
  const total = bankCoins();
  const st = getStats(), sb = run.statsB;
  st.kos += run.stats.kos - sb.kos; st.parries += run.stats.parries - sb.parries; st.dives += run.stats.dives - sb.dives;
  sb.kos = run.stats.kos; sb.parries = run.stats.parries; sb.dives = run.stats.dives;
  if (!run.counted) { run.counted = true; st.runs += 1; }
  if (run.wave > st.bestWave) st.bestWave = run.wave;
  SC.store.set('stats', st);
  const prev = SC.store.get(run.bestKey, 0) || 0;
  if (run.score > prev) SC.store.set(run.bestKey, run.score);
  return total;
}
function dayStreak() {
  const s = SC.store.get('streak', null) || { n: 0, last: '' };
  let bonus = 0;
  if (s.last !== run.date) {
    s.n = s.last === utcYesterday(run.date) ? (s.n || 0) + 1 : 1;
    s.last = run.date;
    bonus = 20 + 10 * M.min(s.n, 10);
    SC.store.set('streak', { n: s.n, last: s.last });
    SC.store.set('coins', (SC.store.get('coins', 0) || 0) + bonus);
  }
  return { bonus, day: s.n };
}
function finishRun() {
  if (run.over) return;
  run.over = true;
  const newBest = run.score > run.bestBefore;
  const total = saveRun();
  const sk = dayStreak();
  if (newBest) sfx('newbest');
  const res = { mode: run.mode, score: run.score, wave: run.wave, kos: run.kos,
    maxCombo: run.maxCombo, coins: total, best: M.max(run.bestBefore, run.score), newBest, missionsDone: missions.done.slice(), time: M.round(run.f / 60),
    streakBonus: sk.bonus, streakDay: sk.day, goal: run.goal ? { text: run.goal.text, done: !!run.goal.done } : null,
    bestBefore: run.bestBefore };
  try {
    const h = SC.store.get('history', []) || [];
    h.unshift({ t: Date.now(), score: run.score, wave: run.wave, kos: run.kos, coins: total, time: res.time, skin: run.skin });
    SC.store.set('history', h.slice(0, 50));
  } catch (err) {}
  let rank = null;
  try {
    if (SC.net && SC.net.submit) rank = SC.net.submit({ mode: 'endless', score: run.score, wave: run.wave, kos: run.kos, time: M.round(run.f / 60) });
  } catch (err) { rank = null; }
  res.rank = rank;
  SC.go('results', res);
}
/* ------------------------------------------------------------------ pause */
function setPaused(v) {
  run.paused = v;
  if (SC.ui.resetFocus) SC.ui.resetFocus();
  if (SC.music) SC.music.duck(v ? 60 * 3600 : 1);   // lower the music while paused, restore on resume
}
function doPause() {
  if (run.paused || run.over || run.phase === 'dying') return;
  setPaused(true);
  sfx('select');
}
function onBlur() { if (run && !(SC.flags && SC.flags.test)) doPause(); }
function onVis() { if (document.hidden) onBlur(); }
function leaveRun(next) { saveRun(); if (SC.music) SC.music.duck(1); if (next === 'restart') SC.go('play', { mode: 'endless' }); else SC.go('title'); }
function drawPause() {
  SC.rect(0, 0, W, H, 'rgba(8,10,24,0.75)');
  T('PAUSED', W / 2, 62, { scale: 4, align: 'center', color: '#ffffff' });
  const bx = W / 2 - 60;
  if (SC.ui.button('p_resume', bx, 110, 120, 24, 'RESUME', { icon: 'ic_play' })) { setPaused(false); sfx('confirm'); }
  if (SC.ui.button('p_restart', bx, 140, 120, 24, 'RESTART', { icon: 'ic_retry' })) leaveRun('restart');
  if (SC.ui.button('p_quit', bx, 170, 120, 24, 'QUIT', { icon: 'ic_home' })) leaveRun('title');
  let hx = W / 2 - 100;
  hx += SC.ui.prompt(hx, 210, 'pause', 'RESUME') + 14;
  SC.ui.prompt(hx, 210, 'retry', 'RESTART');
}

/* ------------------------------------------------------------------ hints (onboarding) */
function updateHints(dt) {
  const h = run.hints;
  run.hint = null;
  if (run.phase !== 'fight' || run.over) return;
  if (!h.parry) {
    for (const s of shots) if (!s.fr && !s.dead && s.k !== 'mortar' && hyp(s.x - p.x, s.y - p.y) < 70) { run.hint = 'parry'; break; }
  }
  if (!run.hint && !h.dive && enemies.some(e => e.kind === 'tank' && !e.dying && !e.dead)) run.hint = 'dive';
  if (!run.hint && h.dive && h.parry && !h.rocket && run.hintRocketT < 420 && enemies.length) { run.hint = 'rocket'; run.hintRocketT += dt; }
}

/* ------------------------------------------------------------------ update */
function updateFxLists(dt, rawDt) {
  for (const l of lines) l.age += rawDt;
  lines = lines.filter(l => l.age < l.life);
  for (const t of trail) t.life -= dt;
  trail = trail.filter(t => t.life > 0);
  for (const a of afters) a.life -= dt;
  afters = afters.filter(a => a.life > 0);
  for (const a of anims) a.f += dt / a.sp;
  anims = anims.filter(a => a.f < (si(a.name, 8, 8).count || 1));
  for (const s of smokes) { s.f += dt * 0.12; s.y += s.vy * dt; }
  smokes = smokes.filter(s => s.f < (si('smoke', 8, 8).count || 1));
  for (const f of flyers) { f.vy += 0.25 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.spin * dt; f.life -= dt; if (f.y > SC.groundY) { f.y = SC.groundY; f.vy *= -0.4; f.vx *= 0.7; f.spin *= 0.6; } }
  flyers = flyers.filter(f => f.life > 0);
  for (const s of sils) s.life -= dt;
  sils = sils.filter(s => s.life > 0);
  if (run.stamp) { run.stamp.t += rawDt; if (run.stamp.t > run.stamp.life) run.stamp = null; }
  if (run.banner) { run.banner.t += rawDt; if (run.banner.t > run.banner.life) run.banner = null; }
  if (run.sub) { run.sub.t += rawDt; if (run.sub.t > run.sub.life) run.sub = null; }
  if (run.trick) { run.trick.t += rawDt; if (run.trick.t > run.trick.life) run.trick = null; }
  if (run.warn) { run.warn.t += rawDt; if (run.warn.t > run.warn.life) run.warn = null; }
}

function update() {
  const inp = SC.input, raw = SC.dt;
  if (run.over) return;
  if (run.paused) {
    if (inp.pressed('pause') || inp.pressed('back')) { setPaused(false); sfx('back'); }
    else if (inp.pressed('retry')) leaveRun('restart');
    return;
  }
  if (inp.pressed('pause')) { doPause(); return; }

  if (run.phase === 'draft') { run.draftT += raw; return; }

  const dying = run.phase === 'dying';
  const dtW = raw * (dying ? 0.3 : 1);
  const dtE = dtW * (run.t.slow > 0 ? 0.5 : 1);
  run.f += raw; run.parryFx -= raw; run.grazeSfx -= raw;
  run.scroll += (1.1 + (p.dashT > 0 ? 1.5 : 0)) * dtW;
  if (run.blend < 1) run.blend = M.min(1, run.blend + dtW / 150);
  if (run.t.slow > 0) run.t.slow -= dtW;
  if (run.t.magnet > 0) run.t.magnet -= dtW;
  if (run.t.star > 0) run.t.star -= dtW;

  // combo decay: holds during clear / banner / draft and while the field is empty waiting for spawns
  if (run.combo > 0 && !dying) {
    const hold = run.phase !== 'fight' || (enemies.length === 0 && run.queue.length > 0);
    if (!hold) {
      run.comboT -= dtW;
      if (run.comboT <= 0) breakCombo();
    }
  }

  if (!dying) {
    updateWave(dtW);
    // periodic pickup spawns
    run.puT -= dtW;
    if (run.puT <= 0) { run.puT = 900 + P() * 700; if (pickups.length < 2) spawnPickup(60 + P() * (W - 120), 70 + P() * 110); }
  }
  if (run.phase === 'banner') startWave(1);

  updatePlayer(dtW);
  updateEnemies(dtE, dtW);
  updateRockets(dtW);
  updateShots(dtE, dtW);
  if (!dying) playerVsEnemies();
  updateThorns(dtW);
  updatePickups(dtW);
  updateCoins(dtW);
  updateFxLists(dtW, raw);
  if (!dying) updateHints(raw);

  if (dying && p.koT > 75) finishRun();
}

/* ------------------------------------------------------------------ draw */
function drawBackground() {
  const t = run.f / 60, A = SC.art;
  if (A && A.drawBackground) {
    if (run.blend < 1 && A.drawBackgroundBlend) A.drawBackgroundBlend(run.prevBiome, run.biome, run.blend, run.scroll, t);
    else A.drawBackground(run.biome, run.scroll, t);
  } else { SC.clear('#6cc0f0'); SC.rect(0, SC.groundY, W, H - SC.groundY, '#4a7a3a'); }
  if (run.wave > 25) { const c = SC.ctx; c.save(); c.globalAlpha = 0.3; c.fillStyle = '#101840'; c.fillRect(0, 0, W, SC.groundY); c.restore(); }
}
// screen-wide checkerboard (every other pixel) in the given css colour
function drawChecker(col) {
  const c = SC.ctx;
  if (!checkerPat || checkerPat.col !== col) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 2;
    const g = cv.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
    checkerPat = { col, pat: c.createPattern(cv, 'repeat') };
  }
  c.save(); c.fillStyle = checkerPat.pat; c.fillRect(-16, -16, W + 32, H + 32); c.restore();
}
function drawBarrel(e) {
  if (e.kind !== 'tank' && e.type !== 'boss') return;
  const pv = pivot(e), t = tip(e);
  let col = pal('dark', '#2a2438');
  if (e.tele > 0) { const k = 1 - e.tele / e.teleMax; col = k > 0.7 ? (M.floor(run.f / 2) % 2 ? '#ffffff' : '#ff7a1a') : k > 0.3 ? '#ff9a2e' : '#8a5a3a'; }
  SC.line(M.round(pv.x), M.round(pv.y), M.round(t.x), M.round(t.y), col, 2);
}
function drawTele(e) {
  if (e.tele <= 0) return;
  const cx = e.x + e.w / 2;
  if (SC.sprite.has('warn')) drawC('warn', M.floor(run.f / 6) % 2, cx, e.y - 12, {});
  else T('!', cx - 2, e.y - 14, { color: '#ffe14a' });
  if (e.type === 'artillery' || (e.type === 'boss' && e.pat === 1)) {
    const tx = e.tx, ty = e.ty, r = 20;
    SC.ring(M.round(tx), M.round(ty), r, M.floor(run.f / 4) % 2 ? '#ff5a5a' : '#ffe14a', 1);
    SC.line(tx - 5, ty, tx + 5, ty, '#ff5a5a', 1); SC.line(tx, ty - 5, tx, ty + 5, '#ff5a5a', 1);
  } else if (e.type === 'heli') {
    SC.dotLine(cx, e.y + e.h, p.x, p.y, 'rgba(255,90,90,0.8)', 4, run.f / 2);
  } else if (e.type !== 'boss' || e.pat === 0) {
    const t = tip(e);
    const L = e.type === 'tank_heavy' ? 120 : 170;
    SC.dotLine(M.round(t.x), M.round(t.y), M.round(t.x + M.cos(e.aim) * L), M.round(t.y + M.sin(e.aim) * L), '#ff7b5c', 4, run.f / 2);
    if (e.type === 'tank_heavy' || e.type === 'boss') {
      for (const o of [-0.3, 0.3]) SC.dotLine(M.round(t.x), M.round(t.y), M.round(t.x + M.cos(e.aim + o) * L * 0.7), M.round(t.y + M.sin(e.aim + o) * L * 0.7), 'rgba(255,123,92,0.6)', 4, run.f / 2);
    }
  }
}
function drawEnemy(e) {
  drawBarrel(e);
  const fa = e.info.frames;
  const f = e.stun > 0 && fa.hurt && fa.hurt.length ? fa.hurt[0] : fr(fa.move, e.anim);
  const colBox = { tank_light: '#5a7a3a', tank_heavy: '#4a5a4a', artillery: '#7a5a3a', heli: '#6a6a8a', drone: '#8a3a3a', boss: '#4a3a5a' }[e.type];
  const dying = e.dying && M.floor(e.dyingT / 3) % 2;
  drawTL(e.type, f, e.x + (dying ? M.round((M.random() - 0.5) * 3) : 0), e.y, { flip: e.flip, white: e.flash > 0 }, colBox);
  // glowing weak spot(s)
  if (e.type === 'boss') {
    const hl = bossHatches(e);
    for (let i = 0; i < hl.length; i++) {
      const r = hatchRect(e, hl[i]), open = e.hOpen === i;
      if (open) {
        glow(r, true);
        const pulse = M.floor(run.f / 5) % 2;
        SC.rect(r.x - 1, r.y - 3, r.w + 2, 1, pulse ? '#ffe14a' : '#ff7a1a');
        SC.rect(r.x - 1, r.y + r.h, r.w + 2, 1, pulse ? '#ff7a1a' : '#ffe14a');
      } else SC.rect(r.x, r.y, r.w, 1, '#3a2a2a');
    }
  } else if (e.kind === 'tank' && e.info.hatch) glow(hatchRect(e, e.info.hatch), e.stun > 0);
  drawTele(e);
  if (e.stun > 0) for (let i = 0; i < 3; i++) { const a = run.f * 0.2 + i * TAU / 3; SC.rect(M.round(e.x + e.w / 2 + M.cos(a) * 8), M.round(e.y - 6 + M.sin(a) * 2), 2, 2, '#ffe14a'); }
}
function glow(r, strong) {
  if (SC.sprite.has('hatch_glow')) {
    const g = si('hatch_glow');
    drawTL('hatch_glow', M.floor(run.f / 6) % 4, r.x + r.w / 2 - g.w / 2, r.y + r.h / 2 - g.h / 2, { alpha: strong ? 1 : 0.8 });
  } else SC.rect(r.x, r.y, r.w, r.h, M.floor(run.f / 6) % 2 ? '#ffe14a' : '#ff7a1a');
}
function drawHat(g, f) {
  const nm = 'hat_' + run.hat;
  if (run.hat === 'none' || !SC.sprite.has(nm) || !CAT.head || !CAT.head[f]) return;
  const hd = CAT.head[f], hg = si(nm, 8, 8);
  const hx = g.tx + (g.flip ? CAT.w - 1 - hd.x : hd.x), hy = g.ty + hd.y;
  SC.sprite.draw(nm, 0, M.round(hx - M.floor(hg.w / 2) + hg.ax), M.round(hy - hg.h + hg.ay), { flip: g.flip });
}
function drawCat() {
  const g = catGeom(), name = 'cat_' + run.skin, f = catFrame();
  const dying = run.phase === 'dying';
  for (const a of afters) {
    const gg = { tx: a.x - (a.face < 0 ? CAT.w - 1 - CAT.centre.x : CAT.centre.x), ty: a.y - CAT.centre.y };
    drawTL(name, a.fr, gg.tx, gg.ty, { flip: a.face < 0, alpha: a.life / 10 * 0.45, tint: '#9fe8ff' });
  }
  const blinkOff = p.inv > 0 && p.dashT <= 0 && !dying && M.floor(run.f / 3) % 2;
  if (!blinkOff) {
    const fl = SC.sprite.has('jetflame_' + run.trailId) ? 'jetflame_' + run.trailId : 'jetflame';
    if (SC.sprite.has(fl) && !dying) {
      drawAnch(fl, M.floor(run.f / 2) % 4, g.jx, g.jy, g.flip);
      const tdef = SC.art && SC.art.trails && SC.art.trails.find(t => t.id === run.trailId);
      if (tdef && tdef.particles && tdef.particles.length && M.floor(run.f) % 3 === 0) {
        SC.fx.burst(g.jx, g.jy + 6, { n: 1, colors: tdef.particles, speed: 0.7, life: 16, angle: PI / 2, spread: 0.8, size: 2 });
      }
    }
    drawTL(name, f, g.tx, g.ty, { flip: g.flip }, '#ff9a2e');
    drawHat(g, f);
    if (p.fireT > 0 && SC.sprite.has('bazooka')) drawAnch('bazooka', p.fireT > 8 ? 1 : 0, g.hx, g.hy, g.flip);
  }
  // the stick is always drawn at full opacity above the cat for its whole swing
  const stk = SC.sprite.has('stick_' + run.stickId) ? 'stick_' + run.stickId : 'stick';
  if (p.parryT >= 0 && SC.sprite.has(stk)) {
    drawAnch(stk, clamp(M.floor(p.parryT / 2), 0, 5), g.hx, g.hy, g.flip);
    const blink = M.floor(run.f / 2) % 2;
    SC.ring(M.round(p.x), M.round(p.y), parryR(), p.parryT < TUNE.perfectFrames ? '#ffe14a' : (blink ? '#ffffff' : '#4de8ff'), 1);
  } else if (p.parryT >= 0) {
    SC.line(g.hx, g.hy, g.hx + p.face * 14, g.hy - 8, '#c8883a', 2);
  }
  if (hasShield() && !dying) {
    const al = p.shieldT > 0 && p.shieldT < 90 && M.floor(run.f / 4) % 2 ? 0.4 : 1;
    if (SC.sprite.has('shieldbubble')) drawC('shieldbubble', M.floor(run.f / 5) % 4, p.x, p.y, { alpha: al });
    else SC.ring(M.round(p.x), M.round(p.y), 17, '#7fe6ff', 1);
  }
}
function drawShot(s) {
  const d = shotSprite(s);
  if (SC.sprite.has(d.name)) drawC(d.name, d.frame, s.x, s.y, {});
  else SC.rect(M.round(s.x) - 2, M.round(s.y) - 2, 4, 4, s.fr ? '#7fe6ff' : '#ff5a2a');
  if (s.k === 'mortar' && !s.fr) {
    SC.ring(M.round(s.tx), M.round(s.ty), 20, M.floor(run.f / 3) % 2 ? '#ff5a5a' : '#ffe14a', 1);
    const k = clamp(s.age / s.T, 0, 1);
    SC.ring(M.round(s.tx), M.round(s.ty), M.max(2, M.round(20 * (1 - k))), '#ff5a5a', 1);
  }
}
function lineEdge(x, y, a) { // distance from (x,y) along angle a to the screen edge
  const c = M.cos(a), s = M.sin(a); let t = 1e9;
  if (c > 1e-4) t = M.min(t, (W - x) / c); else if (c < -1e-4) t = M.min(t, -x / c);
  if (s > 1e-4) t = M.min(t, (H - y) / s); else if (s < -1e-4) t = M.min(t, -y / s);
  return t;
}
function drawWorld() {
  // parry spectacle: pending flash starts after the 2-frame dither darken
  if (run.pflash) {
    if (run.pflash.n <= 0) { SC.fx.flash(run.pflash.color, run.pflash.frames, run.pflash.alpha); run.pflash = null; }
    else run.pflash.n--;
  }
  drawBackground();
  for (const s of smokes) drawC('smoke', M.floor(s.f), s.x, s.y, { alpha: 0.8 }, null);
  for (const e of enemies) drawEnemy(e);
  for (const s of sils) drawTL(s.type, s.frame, s.x, s.y, { flip: s.flip, white: true });
  for (const f of flyers) {
    SC.rect(M.round(f.x) - 3, M.round(f.y) - 2, 6, 4, pal('dark', '#2a2438'));
    SC.line(M.round(f.x), M.round(f.y), M.round(f.x + M.cos(f.a) * f.len), M.round(f.y + M.sin(f.a) * f.len), pal('dark', '#2a2438'), 2);
  }
  for (const t of thorns) { const r = t.life > 30 ? 4 : 2; SC.rect(M.round(t.x) - r, M.round(t.y) - r, r * 2, r * 2, M.floor(t.life / 3) % 2 ? '#ff7a1a' : '#ffd23a'); }
  for (const u of pickups) {
    const blink = u.age > u.life - 120 && M.floor(run.f / 4) % 2;
    if (!blink) drawC('pu_' + u.type, M.floor(u.age / 6) % 6, u.x, u.y, {}, '#ffe14a');
  }
  for (const c of coinsL) { if (c.age > 780 && M.floor(run.f / 3) % 2) continue; drawC('coin', M.floor(c.age / 5 + c.f) % 6, c.x, c.y, {}, '#ffe14a'); }
  for (const t of trail) SC.rect(M.round(t.x) - 1, M.round(t.y) - 1, t.life > 7 ? 2 : 1, t.life > 7 ? 2 : 1, t.col);
  for (const s of shots) drawShot(s);
  for (const r of rockets) drawC('rocket', dirIdx(-r.ang), r.x, r.y, {}, '#ffffff');
  for (const a of anims) {
    if (a.f < 0 || a.top) continue;
    drawC(a.name, M.floor(a.f), a.x, a.y, { flip: a.flip }, null);
  }
  if (run.t.slow > 0) SC.rect(-16, -16, W + 32, H + 32, 'rgba(70,120,255,0.16)');
  if (run.pdark > 0) { drawChecker('rgba(8,6,24,0.85)'); run.pdark--; }
  // radial speed lines (parry)
  for (const l of lines) {
    const k = l.age / l.life, edge = lineEdge(l.x, l.y, l.a);
    const d0 = M.min(edge, 14 + k * edge * 0.9 + l.off), d1 = M.min(edge, d0 + l.len * (1 - k * 0.6));
    if (d1 - d0 < 2) continue;
    SC.line(l.x + M.cos(l.a) * d0, l.y + M.sin(l.a) * d0, l.x + M.cos(l.a) * d1, l.y + M.sin(l.a) * d1, l.col, l.th);
  }
  SC.fx.draw();          // particles, debris and rings sit under the cat
  drawCat();
  for (const a of anims) {
    if (a.f < 0 || !a.top) continue;
    drawC(a.name, M.floor(a.f), a.x, a.y, { flip: a.flip }, null);
  }
  SC.fx.drawFlash();
}
function stampScale(t, base) { return t < 2 ? base + 3 : t < 4 ? base + 2 : t < 6 ? base + 1 : base; }
// cooldown icon: 13px box, fill rises from the bottom while charging
function cdIcon(x, y, name, k, col) {
  const ready = k >= 1;
  SC.rect(x, y, 13, 13, ready ? col : DARK);
  SC.rect(x + 1, y + 1, 11, 11, DARK);
  const fh = M.round(11 * clamp(k, 0, 1));
  if (fh > 0) SC.rect(x + 1, y + 12 - fh, 11, fh, ready ? '#24405e' : '#2c3550');
  icon(name, x + 1, y + 1, ready ? col : '#8a9aaa');
}
function drawHud() {
  const f = run.f;
  // left column: hearts, coins, rockets, dash / parry, power-ups
  for (let i = 0; i < p.maxhp; i++) icon(i < p.hp ? 'ic_heart' : 'ic_heart_empty', 4 + i * 12, 4, i < p.hp ? '#ff4a6a' : '#6a6a7a');
  icon('ic_coin', 4, 17, '#ffe14a');
  T(String(run.coins), 17, 20, { color: '#ffe14a' });
  const am = ammoMax();
  for (let i = 0; i < M.max(am, p.ammo); i++) {
    const on = i < p.ammo;
    SC.rect(5 + i * 8, 31, 5, 9, on ? '#ffd23a' : '#33344a');
    if (on) SC.rect(5 + i * 8, 31, 5, 3, '#ff7a1a'); else SC.rect(5 + i * 8, 31 + 9 - M.round(9 * p.ammoT / TUNE.ammoRegen), 5, M.round(9 * p.ammoT / TUNE.ammoRegen), '#6a5a2a');
  }
  const dk = 1 - clamp(p.dashCd / dashCdMax(), 0, 1), pk = 1 - clamp(p.parryCd / TUNE.parryCd, 0, 1);
  cdIcon(4, 44, 'ic_bolt', dk, '#4de8ff');
  cdIcon(30, 44, 'ic_target', pk, '#ffe14a');
  if (!SC.input.isTouch) {
    // stacked under the icons so long key names (SPACE, LSHIFT) never collide
    SC.ui.prompt(4, 59, 'dash', null);
    SC.ui.prompt(4, 72, 'parry', null);
  }
  // power-up timers
  let ux = 4;
  const pu = [['shield', p.shieldT, TUNE.shieldPuFrames], ['slow', run.t.slow, TUNE.slowFrames], ['magnet', run.t.magnet, TUNE.magnetFrames], ['star', run.t.star, TUNE.starFrames]];
  for (const [id, v, mx] of pu) {
    if (v <= 0) continue;
    if (SC.sprite.has('pu_' + id)) SC.sprite.draw('pu_' + id, M.floor(f / 6) % 6, ux, 76, {});
    SC.rect(ux, 90, M.round(13 * v / mx), 2, v < 90 && M.floor(f / 4) % 2 ? '#ff5a5a' : '#ffffff');
    ux += 18;
  }
  // score + combo
  T(String(run.score), W / 2, 3, { scale: 2, align: 'center', color: '#ffffff' });
  const cw = 90, cx0 = W / 2 - cw / 2;
  if (run.combo > 0) {
    SC.ui.bar(cx0, 22, cw, 4, clamp(run.comboT / comboWin(), 0, 1), multCol(), '#33344a');
    const ms = mult();
    T('X' + (ms % 1 ? ms.toFixed(1) : ms) + '  ' + run.combo + ' COMBO', W / 2, 29, { align: 'center', color: multCol() });
  }
  // wave
  T('WAVE ' + M.max(1, run.wave), W - 34, 4, { scale: 2, align: 'right', color: run.wave % 5 === 0 ? '#ff7a7a' : '#ffffff' });
  // boss hp: dark frame, name at scale 2
  for (const e of enemies) if (e.type === 'boss' && !e.dead) {
    const bw = 220, bx = W / 2 - bw / 2;
    T('MEGA TANK', W / 2, 40, { scale: 2, align: 'center', color: e.phase2 ? '#ff7a7a' : '#ffd0d0', shadow: DARK });
    SC.rect(bx - 2, 56, bw + 4, 8, DARK);
    SC.ui.bar(bx, 58, bw, 4, clamp(e.hp / e.maxhp, 0, 1), e.phase2 ? '#ff7a2a' : '#ff4a4a', '#33344a');
    SC.rect(bx + bw / 2, 58, 1, 4, DARK);
  }
  const quiet = run.paused || run.phase === 'draft';
  // onboarding hint: one at a time
  if (run.hint && !quiet) {
    SC.rect(0, 246, W, 24, 'rgba(8,10,24,0.6)');
    if (run.hint === 'dive') hintLine('dash', 'DASH ONTO GLOWING HATCH');
    else if (run.hint === 'parry') {
      hintLine('parry', 'PARRY THE SHELL');
      SC.ring(M.round(p.x), M.round(p.y), parryR() + 4, M.floor(f / 5) % 2 ? '#ffe14a' : '#ffffff', 1);
    } else if (run.hint === 'rocket') hintLine('fire', 'ROCKET');
  }
  // banner, sub line, tricks, stamp: separate lanes, hidden while paused or drafting
  if (!quiet) {
    if (run.banner) {
      const b = run.banner; let y = 64;
      const a = b.t > b.life - 14 ? (b.life - b.t) / 14 : 1;
      for (const l of b.lines) {
        const sc = l.s >= 3 ? stampScale(b.t, l.s) : l.s;
        T(l.t, W / 2, y, { scale: sc, align: 'center', color: l.c, alpha: a });
        y += 9 * l.s + 6;
      }
    }
    if (run.sub) {
      const s = run.sub, a = s.t > s.life - 12 ? (s.life - s.t) / 12 : 1;
      T(s.text, W / 2, 122, { align: 'center', color: '#ffffff', alpha: a });
    }
    if (run.trick) {
      const s = run.trick, a = s.t > s.life - 10 ? (s.life - s.t) / 10 : 1;
      T(s.text + '!', W / 2, 196, { scale: 2, align: 'center', color: '#ffe14a', alpha: a, shadow: DARK });
    }
    if (run.stamp) {
      const s = run.stamp, a = s.t > s.life - 10 ? (s.life - s.t) / 10 : 1;
      // lane picked at stamp start so it never sits on top of the cat
      if (s.y == null) s.y = (p && p.y > 120) ? 74 : 150;
      T(s.text, W / 2, s.y, { scale: stampScale(s.t, s.base), align: 'center', color: s.color, alpha: a, wave: s.wave, shadow: s.shadow });
    }
    if (run.warn) drawWarn();
  }
  if (SC.input.isTouch && !run.paused && run.phase !== 'draft') SC.ui.touchControls();
  if (run.phase === 'draft' && run.draft && !run.paused) drawDraft();
  if (run.paused) drawPause();
}
function hintLine(action, label) {
  const x = M.round(W / 2 - (SC.textWidth(label, 1) + 40) / 2);
  SC.ui.prompt(x, 252, action, label);
}
function drawWarn() {
  const w = run.warn, k = w.t / w.life;
  const a = k > 0.8 ? (1 - k) / 0.2 : 1;
  if (M.floor(w.t / 6) % 2 === 0) drawChecker('rgba(200,20,40,' + (0.35 * a).toFixed(2) + ')');
  SC.rect(0, 86, W, 4, '#c8283a'); SC.rect(0, 150, W, 4, '#c8283a');
  SC.rect(0, 90, W, 60, 'rgba(26,18,38,' + (0.65 * a).toFixed(2) + ')');
  for (let x = -((w.t * 3) % 24); x < W; x += 24) SC.rect(M.round(x), 86, 12, 4, '#ffe14a');
  for (let x = -24 + ((w.t * 3) % 24); x < W; x += 24) SC.rect(M.round(x), 150, 12, 4, '#ffe14a');
  const col = M.floor(w.t / 5) % 2 ? '#ff5a5a' : '#ffffff';
  T('WARNING', W / 2, 98, { scale: 6, align: 'center', color: col, alpha: a, shadow: DARK });
  T('MEGA TANK APPROACHING', W / 2, 140, { align: 'center', color: '#ffe14a', alpha: a });
}
function draw() {
  drawWorld();
  SC.noShake(drawHud);
}

/* ------------------------------------------------------------------ scene */
SC.scene('play', {
  enter(params) {
    CAT = SC.art.CAT;
    initRun(params || {});
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    SC.fx.clear();
    if (SC.ui.resetFocus) SC.ui.resetFocus();
    if (SC.music) SC.music.play('battle');
    installTest();
  },
  exit() {
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVis);
    if (run) saveRun();
    if (SC.music) SC.music.duck(1);
    SC.fx.clear();
  },
  update,
  draw
});

/* ------------------------------------------------------------------ test hooks */
function installTest() {
  const local = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!(SC.flags && SC.flags.test && local)) return;
  const god = window.SCTEST ? window.SCTEST.god : false;
  window.SCTEST = {
    god: !!god,
    run: () => run,
    state() {
      return {
        mode: run.mode, phase: run.phase, wave: run.wave, score: run.score, combo: run.combo, maxCombo: run.maxCombo,
        coins: run.coins, kos: run.kos, paused: run.paused, hp: p.hp, maxhp: p.maxhp, ammo: p.ammo,
        upgrades: Object.assign({}, run.up), draft: run.draft ? run.draft.slice() : null, queue: run.queue.length,
        queueList: run.queue.slice(), hint: run.hint, goal: run.goal ? Object.assign({}, run.goal) : null,
        stamp: run.stamp ? run.stamp.text : null, banner: run.banner ? run.banner.lines.map(l => l.t) : null,
        player: { x: p.x, y: p.y, vx: p.vx, vy: p.vy, face: p.face, dash: p.dashT > 0, parry: p.parryT >= 0, inv: p.inv, shield: hasShield() },
        enemies: enemies.map(e => ({ type: e.type, x: e.x, y: e.y, w: e.w, h: e.h, hp: e.hp, stun: e.stun, tele: e.tele, hOpen: e.hOpen, ready: e.bossReady })),
        rocketList: rockets.map(r => ({ x: r.x, y: r.y, ang: r.ang, sp: r.sp })),
        shots: shots.map(s => ({ k: s.k, x: s.x, y: s.y, fr: s.fr })), rockets: rockets.length, pickups: pickups.length
      };
    },
    spawn(type, x) { return spawnEnemy(type, x); },
    skipWave() {
      run.queue.length = 0;
      for (const e of enemies.slice()) { e.hp = 0; if (e.type === 'boss') { e.dying = true; e.dyingT = 109; e.bossReady = true; } else koEnemy(e, 'chain'); }
      if (run.phase === 'fight') { run.waveT = M.max(run.waveT, 61); }
    },
    pick(i) { if (run.phase === 'draft' && run.draft) applyUpgrade(run.draft[i || 0]); },
    setPlayer(x, y) { p.x = x; p.y = y; p.vx = 0; p.vy = 0; },
    give(id) { applyUpgrade2(id); },
    pickup(type, x, y) { spawnPickup(x || p.x + 40, y || p.y, type); }
  };
}
function applyUpgrade2(id) { if (!UPS[id]) return; const d = run.draft; run.draft = null; const ph = run.phase; run.up[id] = up(id) + 1; if (id === 'maxhp') { p.maxhp++; p.hp = M.min(p.maxhp, p.hp + 2); } if (id === 'shield') p.waveShield = true; run.draft = d; run.phase = ph; }

})();
