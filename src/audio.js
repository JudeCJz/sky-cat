// Sky Cat audio: Web Audio synthesis only (sfx + chiptune music). No files, no samples.
(function () {
  'use strict';
  const SC = window.SC;
  const muted = !!(SC.flags && SC.flags.mute);
  const store = SC.store;

  const A = SC.audio = { sfxOn: true, musicOn: true };
  try { A.sfxOn = !!store.get('sfx', true); A.musicOn = !!store.get('music', true); } catch (e) {}

  let ctx = null, master = null, sfxBus = null, musBus = null, duckNode = null, noiseBuf = null;
  let wanted = null;            // track the game asked for (started once audio is unlocked)
  const pulses = {};

  // ---------- setup ----------
  function create() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 6;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    // toned down at user request (2026-11-13): quieter overall, music well under the sfx
    master = ctx.createGain(); master.gain.value = 0.6;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    duckNode = ctx.createGain(); duckNode.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = 0.14; musBus.connect(duckNode);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  A.unlock = function () {
    if (muted) return;
    try {
      if (!ctx) create();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (ctx && wanted && A.musicOn) startMusic(wanted);
    } catch (e) {}
  };
  A.setSfx = function (b) { A.sfxOn = !!b; store.set('sfx', A.sfxOn); };
  A.setMusic = function (b) {
    A.musicOn = !!b; store.set('music', A.musicOn);
    if (muted) return;
    if (!A.musicOn) stopMusicNodes();
    else if (wanted && ctx) startMusic(wanted);
  };

  // pulse wave with a given duty cycle
  function pulse(duty) {
    const key = duty.toFixed(3);
    if (pulses[key]) return pulses[key];
    const n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    pulses[key] = ctx.createPeriodicWave(re, im);
    return pulses[key];
  }
  const WAVE_ALIAS = { sq12: 0.125, sq25: 0.25, sq50: 0.5, sq75: 0.75 };

  // ---------- voice helpers ----------
  // sweeping tone with exponential decay
  function tone(type, f0, f1, dur, vol, t, dest, o) {
    o = o || {};
    const osc = ctx.createOscillator();
    if (WAVE_ALIAS[type]) osc.setPeriodicWave(pulse(WAVE_ALIAS[type])); else osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * (o.sweep || 1));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    if (o.hold) g.gain.setValueAtTime(vol, t + dur * o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  // filtered noise burst
  function noiseHit(t, dur, vol, ftype, f0, f1, q, dest) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = ftype || 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  // sustained music voice with a short decay to sustain level
  function voice(wave, f, t, dur, vol, dest, sus) {
    const osc = ctx.createOscillator();
    if (typeof wave === 'string') osc.type = wave; else osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(f, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setTargetAtTime(vol * (sus || 0.7), t + 0.02, Math.max(0.03, dur * 0.4));
    g.gain.setTargetAtTime(0, t + dur, 0.02);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.15);
  }

  // ---------- sfx ----------
  function S(p, v) {
    const t0 = ctx.currentTime + 0.005;
    return {
      t: (type, f0, f1, dur, vol, d, o) => tone(type, f0 * p, f1 * p, dur, vol * v, t0 + (d || 0), sfxBus, o),
      n: (dur, vol, d, ft, f0, f1, q) => noiseHit(t0 + (d || 0), dur, vol * v, ft, f0 * p, f1 * p, q, sfxBus)
    };
  }
  function arp(s, type, notes, step, dur, vol, d0, o) {
    notes.forEach((f, i) => s.t(type, f, f, dur, vol, (d0 || 0) + i * step, o));
  }
  const SFX = {
    dash(s) { s.n(0.2, 0.4, 0, 'bandpass', 500, 3200, 1.2); s.t('sawtooth', 180, 720, 0.14, 0.14); },
    parry(s) {
      // metallic clang: inharmonic partials + noise tick + beating shimmer
      [1180, 1770, 2480, 3300, 4150].forEach((f, i) => s.t(i % 2 ? 'sine' : 'square', f, f * 0.99, 0.32 - i * 0.03, 0.15 - i * 0.015));
      s.n(0.05, 0.45, 0, 'highpass', 4500, 4500, 0.7);
      s.t('sine', 3100, 3100, 0.55, 0.07, 0.02); s.t('sine', 3150, 3150, 0.55, 0.07, 0.02);
    },
    parry_perfect(s) {
      SFX.parry(s);
      s.t('sine', 140, 45, 0.25, 0.4);
      arp(s, 'triangle', [1568, 1976, 2349, 2637, 3136, 3951], 0.045, 0.22, 0.14, 0.05);
      s.t('sine', 5200, 5200, 0.6, 0.05, 0.1);
    },
    ko(s) {
      s.n(0.32, 0.5, 0, 'lowpass', 3200, 260, 0.8);
      s.t('square', 320, 60, 0.26, 0.22); s.t('sine', 130, 40, 0.22, 0.45);
    },
    dive_ko(s) {
      s.t('sawtooth', 200, 1300, 0.09, 0.16);
      s.n(0.5, 0.65, 0.04, 'lowpass', 4200, 120, 0.7);
      s.t('sine', 95, 28, 0.45, 0.65, 0.03); s.t('square', 400, 70, 0.3, 0.2, 0.03);
      s.t('square', 1319, 1319, 0.12, 0.12, 0.16); s.t('square', 1760, 1760, 0.16, 0.12, 0.22);
    },
    hit(s) { s.n(0.08, 0.4, 0, 'bandpass', 1400, 600, 1.4); s.t('square', 420, 140, 0.08, 0.2); },
    hurt(s) {
      s.t('sawtooth', 460, 100, 0.32, 0.28); s.t('square', 230, 70, 0.26, 0.2);
      s.n(0.22, 0.4, 0, 'lowpass', 2000, 200, 1);
    },
    shoot(s) { s.n(0.12, 0.35, 0, 'highpass', 3400, 800, 0.8); s.t('square', 620, 140, 0.1, 0.2); },
    explode(s) { s.n(0.5, 0.6, 0, 'lowpass', 2600, 150, 0.8); s.t('sine', 105, 30, 0.4, 0.55); s.t('sawtooth', 160, 40, 0.3, 0.12); },
    explode_big(s) {
      s.n(1.0, 0.8, 0, 'lowpass', 3600, 80, 0.7); s.t('sine', 72, 24, 0.9, 0.85);
      s.t('sawtooth', 130, 30, 0.6, 0.2);
      s.n(0.5, 0.5, 0.14, 'lowpass', 2400, 120, 0.8); s.n(0.5, 0.4, 0.3, 'lowpass', 1800, 100, 0.8);
      s.t('sine', 60, 22, 0.5, 0.5, 0.2);
    },
    coin(s) { s.t('square', 988, 988, 0.06, 0.16); s.t('square', 1319, 1319, 0.22, 0.16, 0.06, { hold: 0.3 }); },
    pickup(s) { s.t('square', 523, 1046, 0.1, 0.18); s.t('square', 784, 784, 0.16, 0.16, 0.08); },
    powerup(s) { arp(s, 'square', [392, 523, 659, 784, 1046], 0.06, 0.14, 0.15, 0); s.t('triangle', 1568, 1568, 0.3, 0.14, 0.3); },
    combo(s) { s.t('square', 660, 660, 0.07, 0.15); s.t('square', 990, 990, 0.1, 0.15, 0.05); s.t('triangle', 1320, 1320, 0.12, 0.1, 0.05); },
    combo_break(s) { s.t('sawtooth', 330, 100, 0.4, 0.2); s.t('sawtooth', 311, 94, 0.4, 0.18); s.t('square', 165, 55, 0.35, 0.12); },
    graze(s) { s.n(0.06, 0.25, 0, 'highpass', 5200, 5200, 0.8); s.t('sine', 2200, 3200, 0.07, 0.12); },
    wave_start(s) { arp(s, 'square', [262, 330, 392, 523], 0.07, 0.13, 0.15, 0); s.n(0.25, 0.2, 0, 'bandpass', 400, 2000, 1); },
    wave_clear(s) {
      arp(s, 'square', [523, 659, 784, 1046], 0.08, 0.14, 0.16, 0);
      [1046, 1318, 1568].forEach(f => s.t('square', f, f, 0.55, 0.1, 0.34, { hold: 0.4 }));
      s.t('triangle', 523, 523, 0.55, 0.2, 0.34);
    },
    boss_warn(s) {
      for (let i = 0; i < 6; i++) { s.t('square', i % 2 ? 220 : 294, i % 2 ? 220 : 294, 0.18, 0.2, i * 0.2); s.t('sawtooth', i % 2 ? 110 : 147, i % 2 ? 110 : 147, 0.18, 0.18, i * 0.2); }
      s.n(1.2, 0.15, 0, 'bandpass', 200, 900, 1);
    },
    boss_die(s) {
      for (let i = 0; i < 6; i++) { s.n(0.6, 0.6, i * 0.18, 'lowpass', 3200, 100, 0.8); s.t('sine', 90 - i * 6, 25, 0.5, 0.5, i * 0.18); }
      s.t('sawtooth', 900, 40, 1.5, 0.2);
      s.n(1.4, 0.8, 1.1, 'lowpass', 4000, 60, 0.7); s.t('sine', 55, 20, 1.2, 0.9, 1.1);
    },
    select(s) { s.t('square', 660, 700, 0.045, 0.1); },
    confirm(s) { s.t('square', 523, 523, 0.06, 0.14); s.t('square', 784, 784, 0.14, 0.14, 0.06); },
    back(s) { s.t('square', 440, 440, 0.06, 0.12); s.t('square', 330, 330, 0.1, 0.12, 0.05); },
    lose(s) {
      arp(s, 'triangle', [392, 370, 330, 262], 0.22, 0.4, 0.28, 0);
      s.t('sawtooth', 200, 60, 1.0, 0.1, 0.1);
    },
    newbest(s) {
      arp(s, 'square', [523, 659, 784, 1046, 784, 1046, 1318, 1568], 0.075, 0.16, 0.14, 0);
      arp(s, 'triangle', [2093, 2637, 3136, 3951], 0.06, 0.2, 0.08, 0.4);
      [1046, 1318, 1568].forEach(f => s.t('square', f, f, 0.6, 0.1, 0.65, { hold: 0.5 }));
    },
    unlock(s) { arp(s, 'square', [659, 880, 1175], 0.07, 0.14, 0.15, 0); s.t('sine', 4000, 4600, 0.5, 0.06, 0.15); },
    warn(s) { s.t('square', 880, 880, 0.08, 0.16); s.t('square', 880, 880, 0.08, 0.16, 0.13); },
    tick(s) { s.t('square', 1200, 1200, 0.025, 0.1); },
    bounce(s) { s.t('sine', 200, 520, 0.1, 0.3); s.t('square', 300, 150, 0.08, 0.1); }
  };
  const lastPlayed = {};
  SC.sfx = function (name, opts) {
    if (muted || !ctx || !A.sfxOn || ctx.state !== 'running') return;
    const f = SFX[name];
    if (!f) return;
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < 22) return;
    lastPlayed[name] = now;
    opts = opts || {};
    try { f(S(opts.pitch || 1, opts.vol == null ? 1 : opts.vol)); } catch (e) {}
  };

  // ---------- music ----------
  const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function nf(s) {
    const m = /^([a-g])([#b]?)(\d)$/.exec(s);
    if (!m) return 440;
    const midi = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  // lead tokens: note name, '-' hold, '.' rest; 16 sixteenth steps per bar
  function mk(o) {
    o.total = o.lead.length * 16;
    o.leadEv = new Array(o.total).fill(null);
    let idx = 0, last = null;
    o.lead.forEach(bar => {
      bar.trim().split(/\s+/).forEach(tok => {
        if (tok === '.') last = null;
        else if (tok === '-') { if (last) last.len++; }
        else { last = { f: nf(tok), len: 1 }; o.leadEv[idx] = last; }
        idx++;
      });
    });
    o.chordF = o.chords.map(c => c.split(' ').map(nf));
    o.rootF = o.roots.split(' ').map(nf);
    return o;
  }
  const TRACKS = {
    title: {
      bpm: 140, duty: [0.5, 0.25], leadVol: 0.17, bassPat: 'r.or.or.r.or.orf', bassLen: 0.85,
      arp: 1, arpVol: 0.05,
      roots: 'c3 g2 a2 f2 c3 g2 f2 g2',
      chords: ['c4 e4 g4', 'g3 b3 d4', 'a3 c4 e4', 'f3 a3 c4', 'c4 e4 g4', 'g3 b3 d4', 'f3 a3 c4', 'g3 b3 d4'],
      kick: ['k...k...k...k...'], snare: ['....s.......s...', '....s.......s...', '....s.......s...', '....s.......s...', '....s.......s...', '....s.......s...', '....s.......s...', '....s...s.s.ssss'],
      hat: ['h.h.h.h.h.h.h.hh'],
      lead: [
        'e5 - . e5 g5 - e5 - c5 - . c5 e5 - g5 -',
        'd5 - . d5 g5 - d5 - b4 - . b4 d5 - g5 -',
        'e5 - . e5 a5 - e5 - c5 - . c5 e5 - a5 -',
        'f5 - a5 - c6 - a5 - f5 - . . g5 a5 b5 -',
        'c6 - - g5 e5 - . g5 c6 - - g5 e5 - g5 -',
        'b5 - - g5 d5 - . g5 b5 - - g5 d5 - g5 -',
        'a5 - - f5 c5 - . f5 a5 - c6 - a5 - f5 -',
        'g5 - a5 - b5 - d6 - c6 - - - . . . .'
      ]
    },
    battle: {
      bpm: 138, duty: [0.25, 0.125, 0.25, 0.5], leadVol: 0.16, bassPat: 'rrorrorrrorrorrf', bassLen: 0.8,
      arp: 1, arpVol: 0.045,
      roots: 'a2 f2 c3 g2 a2 f2 g2 e2',
      chords: ['a3 c4 e4', 'f3 a3 c4', 'c4 e4 g4', 'g3 b3 d4', 'a3 c4 e4', 'f3 a3 c4', 'g3 b3 d4', 'e3 g#3 b3'],
      kick: ['k...k...k..k.k..', 'k...k...k...k..k'], snare: ['....s.......s...'], hat: ['hhhhhhhhhhhhhhhh'],
      lead: [
        'a4 . c5 . e5 - c5 . a4 . c5 . e5 a5 - e5',
        'f4 . a4 . c5 - a4 . f4 . a4 . c5 f5 - c5',
        'g4 . c5 . e5 - c5 . g4 . c5 . e5 g5 - e5',
        'g4 . b4 . d5 - b4 . g4 . b4 . d5 g5 - d5',
        'e5 - - e5 d5 - c5 - a4 - . a4 c5 - e5 -',
        'c5 - - c5 a4 - f4 - a4 - . c5 f5 - a5 -',
        'd5 - - d5 b4 - g4 - b4 - . d5 g5 - b5 -',
        'e5 - g#5 - b5 - g#5 - e5 - . . b4 - e5 -'
      ]
    },
    boss: {
      bpm: 146, duty: [0.125, 0.125, 0.25, 0.125], leadVol: 0.17, bassPat: 'r.rrr.rrr.rrr.ro', bassLen: 0.75,
      arp: 1, arpVol: 0.05,
      roots: 'd2 d2 bb1 a1 d2 g2 bb1 a1',
      chords: ['d4 f4 a4', 'd4 f4 a4', 'bb3 d4 f4', 'a3 c#4 e4', 'd4 f4 a4', 'g3 bb3 d4', 'bb3 d4 f4', 'a3 c#4 e4'],
      kick: ['k..k..k.k..k..k.', 'k..k..k.k..k.kk.'], snare: ['....s.......s..s', '....s.......s.ss'], hat: ['hhhhhhhhhhhhhhhh'],
      lead: [
        'd5 . d5 . f5 . d5 . a4 . d5 . f5 . e5 f5',
        'd5 . d5 . f5 . a5 . g5 - f5 - e5 - d5 -',
        'bb4 . bb4 . d5 . f5 . d5 . bb4 . d5 . c5 d5',
        'c#5 . c#5 . e5 . a5 . g5 . e5 . c#5 . e5 g5',
        'a5 - - f5 d5 - . f5 a5 - - f5 d5 - e5 f5',
        'g5 - - d5 bb4 - . d5 g5 - - d5 bb4 - c5 d5',
        'f5 - - d5 bb4 - . d5 f5 - a5 - bb5 - a5 -',
        'e5 . e5 . a5 - g5 - e5 - c#5 - e5 - a5 -'
      ]
    },
    results: {
      bpm: 96, duty: [0.5], leadVol: 0.13, bassPat: 'r.......f.......', bassLen: 7,
      arp: 2, arpVol: 0.07,
      roots: 'c3 a2 f2 g2',
      chords: ['c4 e4 g4', 'a3 c4 e4', 'f3 a3 c4', 'g3 b3 d4'],
      kick: ['k.......k.......'], snare: ['................'], hat: ['..h...h...h...h.'],
      lead: [
        'e5 - - - g5 - - - c6 - - - g5 - - -',
        'e5 - - - a5 - - - c6 - - - a5 - - -',
        'f5 - - - a5 - - - c6 - - - a5 - - -',
        'd5 - - - g5 - - - b5 - - - . . . .'
      ]
    }
  };
  const parsed = {};
  function trk(name) { return parsed[name] || (parsed[name] = mk(TRACKS[name])); }

  const M = { name: null, timer: 0, next: 0, step: 0, out: null };

  function stopMusicNodes() {
    if (M.timer) { clearInterval(M.timer); M.timer = 0; }
    if (M.out && ctx) {
      const o = M.out;
      try { o.gain.cancelScheduledValues(ctx.currentTime); o.gain.setTargetAtTime(0, ctx.currentTime, 0.04); } catch (e) {}
      setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 500);
    }
    M.out = null; M.name = null;
  }

  function startMusic(name) {
    if (muted || !ctx || !TRACKS[name]) return;
    if (M.name === name && M.timer) return;
    stopMusicNodes();
    M.name = name; M.step = 0; M.next = ctx.currentTime + 0.08;
    M.out = ctx.createGain(); M.out.gain.value = 1; M.out.connect(musBus);
    M.timer = setInterval(tick, 25);
  }

  function tick() {
    if (!ctx || !M.name) return;
    const tr = trk(M.name), sd = 60 / tr.bpm / 4;
    if (M.next < ctx.currentTime - 0.5) M.next = ctx.currentTime + 0.05; // tab was throttled: resync
    while (M.next < ctx.currentTime + 0.15) {
      sched(tr, M.step, M.next, sd);
      M.next += sd; M.step++;
    }
  }

  function sched(tr, step, t, sd) {
    const n = step % tr.total, bar = (n / 16) | 0, i = n % 16, out = M.out;
    // lead (square, duty varies per bar)
    const ev = tr.leadEv[n];
    if (ev) voice(pulse(tr.duty[bar % tr.duty.length]), ev.f, t, ev.len * sd * 0.92, tr.leadVol, out, 0.65);
    // triangle bass
    const b = tr.bassPat[i];
    if (b !== '.') {
      const r = tr.rootF[bar % tr.rootF.length];
      voice('triangle', b === 'o' ? r * 2 : b === 'f' ? r * 1.5 : r, t, sd * tr.bassLen, 0.4, out, 0.85);
    }
    // arpeggio / chord colour
    const ch = tr.chordF[bar % tr.chordF.length];
    if (tr.arp === 1 && i % 2 === 1) voice(pulse(0.125), ch[(i >> 1) % ch.length] * 2, t, sd * 0.8, tr.arpVol, out, 0.5);
    if (tr.arp === 2 && i % 2 === 0) voice('triangle', ch[(i >> 1) % ch.length], t, sd * 1.8, tr.arpVol, out, 0.6);
    // drums
    const k = tr.kick[bar % tr.kick.length][i], s = tr.snare[bar % tr.snare.length][i], h = tr.hat[bar % tr.hat.length][i];
    if (k === 'k') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
      g.gain.setValueAtTime(0.75, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.22);
    }
    if (s === 's') {
      noiseHit(t, 0.13, 0.4, 'bandpass', 1900, 1500, 0.8, out);
      tone('triangle', 230, 140, 0.09, 0.25, t, out);
    }
    if (h === 'h') noiseHit(t, (i % 4 === 2 && tr.bpm > 100) ? 0.06 : 0.035, (i % 4 === 0 ? 0.2 : 0.12), 'highpass', 7500, 7500, 0.7, out);
  }

  SC.music = {
    play(name) {
      wanted = name;
      if (muted || !ctx || !A.musicOn) return;
      startMusic(name);
    },
    stop() {
      wanted = null;
      if (!muted) stopMusicNodes();
    },
    duck(frames) {
      if (muted || !ctx || !duckNode) return;
      const now = ctx.currentTime, g = duckNode.gain;
      try {
        g.cancelScheduledValues(now);
        g.setTargetAtTime(0.3, now, 0.01);
        g.setTargetAtTime(1, now + Math.max(0.05, (frames || 10) / 60), 0.12);
      } catch (e) {}
    }
  };

  SC.vibe = function (ms) {
    if (muted) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  };
})();
