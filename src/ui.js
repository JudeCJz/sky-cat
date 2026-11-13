// Sky Cat UI: immediate-mode pixel widgets, menu scenes, touch controls. Everything drawn with SC primitives.
(function () {
  'use strict';
  const SC = window.SC;
  const W = 480, H = 270;
  const ui = SC.ui = {};
  const store = SC.store;

  const C = {
    ink: '#0b0f1e', panel: '#1f2a4d', panelHi: '#34508f', edge: '#080b16', dim: '#b8c0dc',
    gold: '#ffd23f', good: '#6df08a', bad: '#ff5d6c', cyan: '#5ee7ff', pink: '#ff7ad9', orange: '#ff9b3d',
    band: 'rgba(8,10,24,0.72)'
  };

  // ---------- small helpers ----------
  const inp = () => SC.input;
  const hasSpr = n => SC.sprite.has(n);
  const spr = (n, f, x, y, o) => { if (SC.sprite.has(n)) SC.sprite.draw(n, f, Math.round(x), Math.round(y), o); };
  const icon = (n, x, y, color, alpha) => spr(n, 0, x, y, { tint: color || '#ffffff', alpha: alpha == null ? 1 : alpha });
  const sfx = (n, o) => { if (SC.sfx) SC.sfx(n, o); };
  const inside = (px, py, x, y, w, h) => px >= x && py >= y && px < x + w && py < y + h;
  const dist = (a, b, c, d) => Math.sqrt((a - c) * (a - c) + (b - d) * (b - d));
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const pad2 = n => (n < 10 ? '0' : '') + n;
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + pad2(s % 60); };
  const missions = () => { try { return (SC.missions && SC.missions.list && SC.missions.list()) || []; } catch (e) { return []; } };
  const enemy = n => SC.art && SC.art.enemies && SC.art.enemies[n];

  function wrap(str, maxW, scale) {
    const words = String(str).split(' '), lines = [];
    let cur = '';
    words.forEach(w => {
      const t = cur ? cur + ' ' + w : w;
      if (cur && SC.textWidth(t, scale) > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function fitText(str, maxW, scale) {
    str = String(str);
    while (str.length > 1 && SC.textWidth(str, scale) > maxW) str = str.slice(0, -1);
    return str;
  }

  function drawBG(biome, scroll) {
    if (SC.art && SC.art.drawBackground) SC.art.drawBackground(biome, Math.floor(scroll), SC.time);
    else SC.clear('#2a3b6b');
  }
  // slow cycling biomes with a dithered blend near the end of each cycle
  function drawCycleBG(scroll) {
    const cyc = SC.time / 18, a = Math.floor(cyc) % 5, b = (a + 1) % 5, fr = cyc % 1;
    const k = fr > 0.85 ? (fr - 0.85) / 0.15 : 0;
    if (k > 0 && SC.art && SC.art.drawBackgroundBlend) SC.art.drawBackgroundBlend(a, b, k, Math.floor(scroll), SC.time);
    else drawBG(a, scroll);
  }

  // draw a sprite so that its visual CENTRE sits at (cx,cy), whatever its anchor is
  function sprC(n, f, cx, cy, o) {
    const g = SC.sprite.has(n) && SC.sprite.get(n);
    if (!g) return;
    SC.sprite.draw(n, f, Math.round(cx - g.w / 2 + g.anchor.x), Math.round(cy - g.h / 2 + g.anchor.y), o);
  }
  const catAnchor = nm => { const g = SC.sprite.has(nm) && SC.sprite.get(nm); return g ? g.anchor : { x: 0, y: 0 }; };

  // equipped cosmetics (visual only); every lookup is guarded so missing art just falls back
  const eqHat = () => store.get('hat', 'none');
  const eqTrail = () => store.get('trail', 'classic');
  const eqStick = () => store.get('stick', 'branch');
  const stickSpr = id => (hasSpr('stick_' + (id || eqStick())) ? 'stick_' + (id || eqStick()) : 'stick');
  const trailSpr = id => (hasSpr('jetflame_' + (id || eqTrail())) ? 'jetflame_' + (id || eqTrail()) : 'jetflame');
  // draw an anchored sprite at a point, mirroring the anchor when flipped
  function sprAnch(n, f, px, py, flip, o) {
    const g = SC.sprite.has(n) && SC.sprite.get(n);
    if (!g) return;
    const x = flip ? px - g.w + 1 + 2 * g.anchor.x : px;
    o = o || {}; o.flip = !!flip;
    SC.sprite.draw(n, f, Math.round(x), Math.round(py), o);
  }

  // cat with jet flame, hat and optional swinging stick; (x,y) = sprite TOP-LEFT of the cat grid (the anchor is added here).
  // o.scale = integer upscale; o.hat / o.trail / o.skin override the equipped ones; o.stickFrame >= 0 draws the stick swing
  function drawCat(x, y, o) {
    o = o || {};
    const art = SC.art;
    if (!art || !art.CAT) return;
    const CAT = art.CAT, sc = o.scale || 1, ctx = SC.ctx;
    let nm = 'cat_' + (o.skin || store.get('skin', 'ginger'));
    if (!hasSpr(nm)) nm = 'cat_ginger';
    if (!hasSpr(nm)) return;
    const fr = CAT.frames[o.kind || 'fly'] || CAT.frames.fly;
    const f = fr[(o.idx | 0) % fr.length];
    const an = catAnchor(nm);
    const so = { alpha: o.alpha, tint: o.tint };
    if (sc > 1) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.scale(sc, sc); x = x / sc; y = y / sc; }
    if (o.flame !== false && CAT.jet) {
      const jx = o.flip ? CAT.w - 1 - CAT.jet.x : CAT.jet.x;
      const tn = trailSpr(o.trail);
      if (hasSpr(tn)) spr(tn, SC.frame >> 1, x + jx, y + CAT.jet.y, { flip: !!o.flip, alpha: o.alpha, tint: o.tint });
    }
    spr(nm, f, x + an.x, y + an.y, { flip: !!o.flip, tint: o.tint, alpha: o.alpha });
    const hat = o.hat !== undefined ? o.hat : eqHat();
    if (hat && hat !== 'none' && hasSpr('hat_' + hat) && CAT.head && CAT.head[f]) {
      const hd = CAT.head[f];
      sprAnch('hat_' + hat, 0, x + (o.flip ? CAT.w - 1 - hd.x : hd.x), y + hd.y, !!o.flip, { alpha: o.alpha, tint: o.tint });
    }
    if (o.stickFrame != null && o.stickFrame >= 0) {
      const hf = CAT.handFrames && CAT.handFrames[o.kind || 'fly'];
      const hp = (hf && hf[(o.idx | 0) % hf.length]) || CAT.hand;
      const hx = x + (o.flip ? CAT.w - 1 - hp.x : hp.x), hy = y + hp.y;
      if (o.slashFrame != null && o.slashFrame >= 0) sprAnch('slash', o.slashFrame, hx, hy, !!o.flip);
      sprAnch(stickSpr(o.stick), o.stickFrame, hx, hy, !!o.flip);
    }
    if (sc > 1) ctx.restore();
  }

  function drawTank(type, x, y, fi) {
    const e = enemy(type);
    if (!e) return;
    const fr = e.frames.move;
    spr(type, fr[fi % fr.length], x, y);
  }

  // ---------- focus / widget core ----------
  let focusId = null, pressId = null, list = [], prev = [], listFrame = -1, listScene = '', lastPX = -1, lastPY = -1;
  const pressAnim = {};
  ui.lockH = false; ui.lockV = false;

  ui.resetFocus = function () { focusId = null; pressId = null; prev = []; };
  ui.focused = function () { return focusId; };

  // new widget list per DRAW call: rolls when the frame/scene changed or when an id repeats (second draw in one frame)
  function beginFrame() {
    if (listFrame === SC.frame && listScene === SC.current) return;
    roll();
  }
  function roll() {
    if (listScene !== SC.current) { prev = []; focusId = null; pressId = null; }
    else prev = (SC.frame - listFrame <= 3) ? list : [];
    list = []; listFrame = SC.frame; listScene = SC.current;
    const I = inp(), ptr = I.pointer || {};
    if (!ptr.down && !ptr.released) pressId = null;
    // keep focus valid
    if (!prev.some(b => b.id === focusId && !b.disabled)) {
      const f = prev.find(b => !b.disabled);
      focusId = f ? f.id : null;
    }
    // keyboard navigation
    let dir = null;
    if (!ui.lockH && I.pressed('left')) dir = 'left';
    else if (!ui.lockH && I.pressed('right')) dir = 'right';
    else if (!ui.lockV && I.pressed('up')) dir = 'up';
    else if (!ui.lockV && I.pressed('down')) dir = 'down';
    if (dir && prev.length > 1) {
      const cur = prev.find(b => b.id === focusId);
      if (cur) {
        const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
        let best = null, bs = 1e9, wrapBest = null, ws = -1e9;
        prev.forEach(b => {
          if (b === cur || b.disabled) return;
          const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy;
          let prim, sec;
          if (dir === 'left') { prim = -dx; sec = Math.abs(dy); }
          else if (dir === 'right') { prim = dx; sec = Math.abs(dy); }
          else if (dir === 'up') { prim = -dy; sec = Math.abs(dx); }
          else { prim = dy; sec = Math.abs(dx); }
          if (prim > 1) { const s = prim + sec * 2.5; if (s < bs) { bs = s; best = b; } }
          else { const s = -prim - sec * 2.5; if (s > ws) { ws = s; wrapBest = b; } }
        });
        const pick = best || wrapBest;
        if (pick && pick.id !== focusId) { focusId = pick.id; sfx('select'); }
      }
    }
    // mouse hover moves focus
    if (ptr.x !== lastPX || ptr.y !== lastPY) {
      lastPX = ptr.x; lastPY = ptr.y;
      if (I.lastDevice !== 'key' && ptr.active !== false) {
        for (let i = prev.length - 1; i >= 0; i--) {
          const b = prev[i];
          if (!b.disabled && inside(ptr.x, ptr.y, b.x, b.y, b.w, b.h)) {
            if (focusId !== b.id) { focusId = b.id; sfx('select'); }
            break;
          }
        }
      }
    }
    ui.lockH = false; ui.lockV = false;
  }

  // registers a clickable region; returns {fired, focus, down}
  function widget(id, x, y, w, h, o) {
    beginFrame();
    for (let i = 0; i < list.length; i++) if (list[i].id === id) { roll(); break; }
    list.push({ id, x, y, w, h, disabled: !!o.disabled });
    const I = inp(), ptr = I.pointer || {};
    const over = inside(ptr.x, ptr.y, x, y, w, h);
    const focus = focusId === id;
    let fired = false;
    if (!o.disabled) {
      if (over && ptr.pressed) { pressId = id; focusId = id; }
      if (ptr.released && pressId === id) { if (over) fired = true; pressId = null; }
      if (focus && I.pressed('confirm') && I.lastDevice !== 'pointer') fired = true;
      if (o.hotkey && I.pressed(o.hotkey)) fired = true;
    }
    if (fired) pressAnim[id] = 6;
    const down = !o.disabled && ((pressId === id && ptr.down && over) || (focus && I.down('confirm') && I.lastDevice === 'key') || pressAnim[id] > 0);
    if (pressAnim[id] > 0) pressAnim[id]--;
    if (fired && !o.silent) sfx('confirm');
    return { fired, focus, down, over };
  }

  function focusBox(x, y, w, h) {
    const c = (SC.frame >> 3) & 1 ? '#ffffff' : '#ffd23f';
    SC.rect(x - 2, y - 2, w + 4, 1, c); SC.rect(x - 2, y + h + 1, w + 4, 1, c);
    SC.rect(x - 2, y - 1, 1, h + 2, c); SC.rect(x + w + 1, y - 1, 1, h + 2, c);
  }

  // button body; returns text colour
  function body(x, y, w, h, st, o) {
    const dis = !!o.disabled, acc = o.color;
    let bg = dis ? '#1a1d2b' : acc ? acc : (st.focus ? C.panelHi : '#1d2750');
    const oy = st.down ? 1 : 0;
    SC.rect(x, y + 2, w, h, C.edge);
    SC.rect(x, y + oy, w, h, bg);
    if (!dis && !st.down) SC.rect(x, y, w, 1, 'rgba(255,255,255,0.18)');
    if (st.down) SC.rect(x, y + oy, w, h, 'rgba(0,0,0,0.18)');
    if (st.focus && !dis) focusBox(x, y + oy, w, h);
    return dis ? '#5a6180' : acc ? '#1a1226' : (st.focus ? '#ffffff' : '#dfe6f5');
  }

  ui.button = function (id, x, y, w, h, label, o) {
    o = o || {};
    const st = widget(id, x, y, w, h, o);
    const col = body(x, y, w, h, st, o);
    const oy = st.down ? 1 : 0;
    let sc = o.small ? 1 : 2;
    const ic = o.icon && hasSpr(o.icon);
    const iw = ic ? 17 : 0;
    const vw = o.value != null ? SC.textWidth(String(o.value), sc) + 8 : 0;
    if (SC.textWidth(label, sc) + iw + vw > w - 8) sc = 1;
    const ty = y + oy + Math.floor((h - 7 * sc) / 2);
    if (o.align === 'left') {
      let tx = x + 8;
      if (ic) { icon(o.icon, tx, y + oy + Math.floor((h - 11) / 2), col); tx += iw; }
      SC.text(label, tx, ty, { color: col, scale: sc, shadow: (o.color || o.disabled) ? null : '#000' });
      if (o.value != null) SC.text(String(o.value), x + w - 8, ty, { color: o.valueColor || col, scale: sc, align: 'right', shadow: '#000' });
      return st.fired;
    }
    const tw = SC.textWidth(label, sc), total = tw + iw;
    let tx = x + Math.floor((w - total) / 2);
    if (ic) { icon(o.icon, tx, y + oy + Math.floor((h - 11) / 2), col); tx += iw; }
    SC.text(label, tx, ty, { color: col, scale: sc, shadow: (o.color || o.disabled) ? null : '#000' });
    return st.fired;
  };

  ui.iconButton = function (id, x, y, ic, o) {
    o = o || {};
    const s = o.size || 17;
    const st = widget(id, x, y, s, s, o);
    const col = body(x, y, s, s, st, o);
    icon(ic, x + Math.floor((s - 11) / 2), y + (st.down ? 1 : 0) + Math.floor((s - 11) / 2), col);
    if (o.flip && hasSpr(ic)) {
      // redraw flipped (cheap: draw over the unflipped icon)
      SC.rect(x + 1, y + (st.down ? 1 : 0) + 1, s - 2, s - 2, o.disabled ? '#1a1d2b' : o.color || (st.focus ? C.panelHi : C.panel));
      spr(ic, 0, x + Math.floor((s - 11) / 2), y + (st.down ? 1 : 0) + Math.floor((s - 11) / 2), { tint: col, flip: true });
    }
    return st.fired;
  };

  ui.card = function (id, x, y, w, h, o) {
    o = o || {};
    const st = widget(id, x, y, w, h, o);
    const acc = o.accent || C.gold;
    const oy = st.down ? 1 : 0;
    SC.rect(x, y + 2, w, h, C.edge);
    SC.rect(x, y + oy, w, h, st.focus ? C.panelHi : C.panel);
    SC.rect(x, y + oy, w, 14, acc);
    const title = String(o.title || '');
    const ts = SC.textWidth(title, 2) <= w - 8 ? 2 : 1;
    SC.text(title, x + w / 2, y + oy + (ts === 2 ? 0 : 4), { align: 'center', color: '#1a1226', scale: ts, shadow: null });
    const lv = o.level ? fitText(String(o.level), w - 8, 1) : '';
    const lines = wrap(o.desc || '', w - 12, 1).slice(0, 3);
    const hasIc = !!(o.icon && hasSpr(o.icon));
    const blockH = (hasIc ? 15 + 7 : 0) + lines.length * 9;
    const top = y + oy + 16, bot = y + oy + h - (lv ? 14 : 4);
    let cy = top + Math.max(0, Math.floor((bot - top - blockH) / 2));
    if (hasIc) { icon(o.icon, x + Math.floor(w / 2) - 7, cy, acc); cy += 22; }
    lines.forEach((ln, i) => SC.text(ln, x + w / 2, cy + i * 9, { align: 'center', color: '#ffffff' }));
    if (lv) SC.text(lv, x + w / 2, y + oy + h - 11, { align: 'center', color: acc });
    if (st.focus) focusBox(x, y + oy, w, h);
    return st.fired;
  };

  ui.keycap = function (label, x, y, o) {
    o = o || {};
    const s = o.scale || 1;
    label = String(label);
    const w = Math.max(9 * s + 2, SC.textWidth(label, s) + 4 * s + 1), h = 11 * s;
    const py = y + (o.pressed ? s : 0);
    SC.rect(x + s, py + s, w - 2 * s, h - 2 * s, '#8f9bc0');
    SC.rect(x, py + s, w, h - 3 * s, o.color || '#e9eefc');
    SC.rect(x + s, py, w - 2 * s, h - 2 * s, o.color || '#e9eefc');
    SC.text(label, x + w / 2, py + 2 * s, { align: 'center', color: '#1a2038', scale: s, shadow: null });
    return w;
  };

  // current bound key labels for an action (non-empty slots only)
  ui.keyLabels = function (action) {
    const b = (inp().bindings || {})[action] || [], out = [];
    for (let i = 0; i < b.length; i++) if (b[i]) out.push(inp().keyName(b[i]));
    return out;
  };
  ui.keyLabel = function (action) { return ui.keyLabels(action)[0] || '--'; };
  const ACTION_ICON = { confirm: 'ic_check', dash: 'ic_bolt', parry: 'ic_shield', fire: 'ic_rocket', pause: 'ic_pause', back: 'ic_back', retry: 'ic_retry' };
  ui.prompt = function (x, y, action, label) {
    let w;
    if (inp().lastDevice === 'touch') {
      SC.rect(x, y + 1, 11, 11, '#8f9bc0');
      SC.rect(x, y, 11, 11, '#e9eefc');
      icon(ACTION_ICON[action] || 'ic_info', x, y, '#1a2038');
      w = 11;
    } else w = ui.keycap(ui.keyLabel(action), x, y);
    if (label) SC.text(label, x + w + 4, y + 2, { color: '#ffffff' });
    return w + (label ? 4 + SC.textWidth(label, 1) : 0);
  };

  ui.bar = function (x, y, w, h, k, color, bg) {
    SC.rect(x, y, w, h, bg || '#10142a');
    const f = Math.round(w * clamp01(k));
    if (f > 0) SC.rect(x, y, f, h, color || C.gold);
  };
  ui.band = function (y, h, color) { SC.rect(0, y, W, h, color || C.band); };

  // ---------- shared scene bits ----------
  let scroll = 0;
  function title3(str, x, y, ic) {
    let tx = x;
    if (ic) { icon(ic, x, y + 5, '#ffffff'); tx += 16; }
    SC.text(str, tx, y, { scale: 3, color: '#ffffff' });
  }
  function coinsLine(x, y, amount, align) {
    const s = String(amount), tw = SC.textWidth(s, 2);
    const w = tw + 15;
    const x0 = align === 'right' ? x - w : x;
    icon('ic_coin', x0, y + 2, C.gold);
    SC.text(s, x0 + 15, y, { scale: 2, color: C.gold });
  }
  function bottomBand() { ui.band(240, 30, 'rgba(8,10,24,0.85)'); }
  function fxLayer() { SC.fx.draw(); SC.fx.drawFlash(); }

  // ---------- BOOT ----------
  let bootT = 0;
  SC.scene('boot', {
    enter() { bootT = 0; scroll = 0; SC.music.play('title'); },
    update() {
      bootT++; scroll += 0.7 * SC.dt;
      if (bootT > 20 && (SC.input.anyPressed() || (SC.flags.test && bootT > 40))) {
        if (SC.audio) SC.audio.unlock();
        SC.music.play('title');
        sfx('confirm');
        SC.go('title', {});
      }
    },
    draw() {
      drawBG(0, scroll);
      const bob = Math.round(Math.sin(SC.frame * 0.06) * 3);
      if (hasSpr('logo')) { const g = SC.sprite.get('logo'); spr('logo', 0, Math.floor((W - g.w) / 2), 52 + bob); }
      else SC.text('SKY CAT', W / 2, 60, { scale: 6, align: 'center' });
      const cx = ((SC.frame * 1.4) % (W + 80)) - 40;
      drawCat(cx, 170 + Math.sin(SC.frame * 0.08) * 8, { idx: SC.frame >> 3 });
      if (((SC.frame >> 5) & 1) === 0 || bootT < 20) {
        const msg = inp().isTouch ? 'TAP TO START' : 'PRESS ANY KEY';
        if (bootT >= 20) SC.text(msg, W / 2, 208, { scale: 2, align: 'center', color: '#ffffff' });
      }
      SC.text('V1.0', W - 6, H - 11, { align: 'right', color: C.dim });
    }
  });

  // ---------- TITLE ----------
  const skinsList = () => (SC.art && SC.art.skins) || [{ id: 'ginger', name: 'Ginger', price: 0 }];
  const owned = () => store.get('skins_owned', ['ginger']);
  function nextSkin() {
    const own = owned();
    let best = null;
    skinsList().forEach(k => { if (own.indexOf(k.id) < 0 && k.price > 0 && (!best || k.price < best.price)) best = k; });
    return best;
  }
  function nextSkinLine(x, y, w) {
    const k = nextSkin();
    if (!k) return 0;
    const coins = store.get('coins', 0);
    SC.text(fitText('NEXT: ' + String(k.name).toUpperCase() + ' ' + Math.min(coins, k.price) + '/' + k.price, w, 1), x, y, { color: C.dim });
    ui.bar(x, y + 10, w, 3, coins / k.price, coins >= k.price ? C.good : C.gold);
    return 16;
  }

  // scripted mini-battle (300 frames loop): heavy fires, cat parries, shell kills the light tank, cat dives the hatch
  const BAT = 300, HX = 262, LX = 168, HOME = { x: 232, y: 156 };
  let bat = 0;
  const hvy = () => enemy('tank_heavy'), lgt = () => enemy('tank_light');
  function heavyX(T) { return T < 122 ? HX : (T < 200 ? null : (T < 260 ? HX + Math.round((1 - SC.ease.outCubic((T - 200) / 60)) * 80) : HX)); }
  function lightX(T) { return T < 80 ? LX : (T < 190 ? null : (T < 240 ? LX - Math.round((1 - SC.ease.outCubic((T - 190) / 50)) * 58) : LX)); }
  function shellPts() {
    const H0 = hvy();
    return { sx: HX + 2, sy: 236 - H0.h + 2 + 8, px: HOME.x + 22, py: HOME.y + 8 };
  }
  // cat centre for time T
  function batCatPos(T) {
    const b = Math.sin(T * 0.07) * 4;
    if (T < 100) return { x: HOME.x, y: HOME.y + b, kind: 'fly' };
    if (T < 108) { const u = (T - 100) / 8; return { x: HOME.x - 8 * u, y: HOME.y + b, kind: 'idle' }; }
    const H0 = hvy();
    const tx = HX + H0.hatch.x + H0.hatch.w / 2, ty = 236 - H0.h + 2 + H0.hatch.y + 2;
    if (T < 122) { const u = (T - 108) / 14; return { x: HOME.x - 8 + (tx - HOME.x + 8) * u, y: HOME.y + (ty - HOME.y) * u, kind: 'dash' }; }
    if (T < 170) { const u = SC.ease.outCubic((T - 122) / 48); return { x: tx + (HOME.x - tx) * u, y: ty - 26 * Math.sin(Math.min(1, (T - 122) / 24) * Math.PI / 1.4) + (HOME.y - ty) * u, kind: 'fly' }; }
    return { x: HOME.x, y: HOME.y + b, kind: 'fly' };
  }
  function batEvents(T) {
    if (!hvy() || !lgt()) return;
    const L = lgt(), H0 = hvy();
    if (T === 58) {
      const p = shellPts();
      SC.fx.ring(p.px, p.py, { color: '#ffffff', r0: 4, r1: 46, life: 18, thick: 2 });
      SC.fx.burst(p.px, p.py, { n: 14, colors: ['#ffffff', C.cyan, C.gold], speed: 3, life: 22 });
      SC.fx.shake(2, 6);
    }
    if (T === 80) {
      const ex = LX + L.w / 2, ey = 236 - L.h / 2 + 2;
      SC.fx.debris(ex, ey, { n: 8, colors: ['#555a6e', '#8a8fa6', C.orange] });
      SC.fx.burst(ex, ey, { n: 12, colors: [C.orange, C.gold, '#ffffff'], speed: 3, life: 20 });
      SC.fx.shake(2, 8);
    }
    if (T === 122) {
      const ex = HX + H0.w / 2, ey = 236 - H0.h / 2 + 2;
      SC.fx.debris(ex, ey, { n: 12, colors: ['#555a6e', '#8a8fa6', C.orange, C.gold] });
      SC.fx.burst(ex, ey, { n: 20, colors: [C.orange, C.gold, '#ffffff'], speed: 4, life: 28 });
      SC.fx.ring(ex, ey, { color: C.gold, r0: 6, r1: 56, life: 20, thick: 2 });
      SC.fx.shake(4, 12);
    }
  }
  function drawBattle() {
    const CAT = SC.art && SC.art.CAT, H0 = hvy(), L = lgt();
    if (!CAT || !H0 || !L) return;
    const T = bat % BAT;
    const hx = heavyX(T), lx = lightX(T);
    const htop = 236 - H0.h + 2, ltop = 236 - L.h + 2;
    const hMoving = T >= 200 && T < 260, lMoving = T >= 190 && T < 240;
    const flash = T >= 40 && T < 44;
    if (hx !== null) spr('tank_heavy', H0.frames.move[hMoving ? (T >> 2) % H0.frames.move.length : 0], hx, htop, { white: flash });
    if (lx !== null) spr('tank_light', L.frames.move[lMoving ? (T >> 2) % L.frames.move.length : 0], lx, ltop);
    const p = shellPts();
    if (T >= 16 && T < 40) {
      sprC('warn', T >> 3, HX + H0.w / 2, htop - 10);
      SC.dotLine(p.sx, p.sy, p.px, p.py, 'rgba(255,93,108,0.85)', 3, T);
    }
    if (T >= 40 && T < 58) {
      const u = (T - 40) / 18;
      sprC('shell', T >> 1, p.sx + (p.px - p.sx) * u, p.sy + (p.py - p.sy) * u);
    }
    if (T >= 58 && T < 80) {
      const u = (T - 58) / 22, tx = LX + L.hatch.x + L.hatch.w / 2, ty = ltop + L.hatch.y + 2;
      sprC('shell_p', T >> 1, p.px + (tx - p.px) * u, p.py + (ty - p.py) * u);
    }
    if (T >= 80 && T < 96) sprC('explosion', (T - 80) >> 1, LX + L.w / 2, ltop + L.h / 2);
    if (T >= 122 && T < 142) sprC('explosion_big', (T - 122) >> 1, HX + H0.w / 2, htop + H0.h / 2);
    if (T >= 122 && T < 150) for (let i = 0; i < 4; i++) sprC('smoke', Math.min(4, (T - 122) >> 3), HX + 8 + i * 12, htop + 6 - ((T - 122) >> 1) - i * 3, { alpha: 0.8 });
    if (T >= 90 && T < 122) sprC('hatch_glow', T >> 2, HX + H0.hatch.x + H0.hatch.w / 2, htop + H0.hatch.y + 2);
    // cat (drawn after debris so it stays on top)
    const cp = batCatPos(T);
    const ox = cp.x - CAT.centre.x, oy = cp.y - CAT.centre.y;
    const pt = T - 54;
    if (cp.kind === 'dash') {
      for (let k = 3; k >= 1; k--) {
        const q = batCatPos(Math.max(108, T - k * 2));
        drawCat(q.x - CAT.centre.x, q.y - CAT.centre.y, { kind: 'dash', idx: 0, alpha: 0.5 / k, flame: false });
      }
      drawCat(ox, oy, { kind: 'dash', idx: T >> 1 });
    } else if (pt >= 0 && pt < 13) {
      const fi = Math.min(2, pt >> 2);
      drawCat(ox, oy, { kind: 'parry', idx: fi });
      const hp = (CAT.handFrames && CAT.handFrames.parry && CAT.handFrames.parry[fi]) || CAT.hand;
      if (pt >= 2 && pt < 9) {
        if (hasSpr('slash_big')) sprC('slash_big', (pt - 2) >> 1, cp.x + 20, cp.y);
        else spr('slash', (pt - 2) >> 1, ox + hp.x, oy + hp.y);
      }
      sprAnch(stickSpr(), Math.min(5, pt >> 1), ox + hp.x, oy + hp.y, false);
    } else {
      drawCat(ox, oy, { kind: cp.kind === 'idle' ? 'idle' : 'fly', idx: T >> 3 });
    }
    if (T >= 58 && T < 84) SC.text('PARRY!', cp.x + 4, cp.y - 38, { scale: 2, align: 'center', color: C.cyan, wave: 1 });
    if (T >= 122 && T < 168) SC.text('DIVE KO!', HX + H0.w / 2 - 26, 150 - (T < 132 ? 0 : ((T - 132) >> 3)), { scale: 2, align: 'center', color: C.gold, wave: 1 });
  }

  SC.scene('title', {
    enter() { ui.resetFocus(); SC.music.play('title'); bat = 0; },
    update() { scroll += 0.9 * SC.dt; bat++; batEvents(bat % BAT); },
    draw() {
      drawCycleBG(scroll);
      drawBattle();
      // logo
      const t = SC.frame;
      const bob = Math.round(Math.sin(t * 0.06) * 3);
      if (hasSpr('logo')) { const g = SC.sprite.get('logo'); spr('logo', 0, Math.floor((W - g.w) / 2), 8 + bob); }
      else SC.text('SKY CAT', W / 2, 14, { scale: 5, align: 'center' });
      // menu
      const bx = 18, bw = 128, bh = 17, gap = 4;
      let y = 94, go = null;
      if (ui.button('play', bx, y, bw, bh, 'PLAY', { icon: 'ic_play', color: C.gold, small: true })) go = 'play'; y += bh + gap;
      if (ui.button('board', bx, y, bw, bh, 'LEADERBOARD', { icon: 'ic_trophy', small: true })) go = 'leaderboard'; y += bh + gap;
      if (ui.button('hangar', bx, y, bw, bh, 'HANGAR', { icon: 'ic_hangar', small: true })) go = 'hangar'; y += bh + gap;
      if (ui.button('howto', bx, y, bw, bh, 'HOW TO PLAY', { icon: 'ic_info', small: true })) go = 'howto'; y += bh + gap;
      if (ui.button('settings', bx, y, bw, bh, 'SETTINGS', { icon: 'ic_gear', small: true })) go = 'settings';
      // quick audio toggles
      if (ui.iconButton('t_sfx', W - 46, 6, SC.audio.sfxOn ? 'ic_sound' : 'ic_mute', { size: 17 })) SC.audio.setSfx(!SC.audio.sfxOn);
      if (ui.iconButton('t_mus', W - 25, 6, 'ic_music', { size: 17, color: SC.audio.musicOn ? null : '#3a3040' })) SC.audio.setMusic(!SC.audio.musicOn);
      // info column: ONE flat translucent band behind stats and missions
      const px = 322, pw = W - px;
      SC.rect(px - 6, 92, W - px + 6, 144, 'rgba(8,10,24,0.78)');
      let iy = 97;
      icon('ic_coin', px + 8, iy + 1, C.gold);
      SC.text(String(store.get('coins', 0)), px + 24, iy, { scale: 2, color: C.gold });
      const sk = store.get('streak', null);
      if (sk && sk.n > 0) {
        const s = 'DAY ' + sk.n, sw = SC.textWidth(s, 1);
        icon('ic_flame', W - 8 - sw - 13, iy + 2, C.orange);
        SC.text(s, W - 8, iy + 3, { align: 'right', color: C.orange });
      }
      iy += 17;
      iy += nextSkinLine(px + 8, iy, pw - 16);
      const bests = [['ic_trophy', 'BEST', store.get('best_endless', 0)]];
      bests.forEach(b => {
        icon(b[0], px + 8, iy - 1, C.dim);
        SC.text(b[1], px + 24, iy, { color: C.dim });
        SC.text(String(b[2] || 0), px + 82, iy, { color: '#ffffff' });
        iy += 10;
      });
      iy += 3;
      SC.text('MISSIONS', px + 8, iy, { color: C.cyan }); iy += 10;
      missions().slice(0, 3).forEach(m => {
        const done = m.progress >= m.goal;
        SC.text(fitText(m.text || '', pw - 16, 1), px + 8, iy, { color: done ? C.good : '#ffffff' });
        iy += 9;
        ui.bar(px + 8, iy, pw - 54, 4, m.goal ? m.progress / m.goal : 0, done ? C.good : C.cyan);
        SC.text(Math.min(m.progress, m.goal) + '/' + m.goal, W - 8, iy - 2, { align: 'right', color: C.dim });
        iy += 8;
      });
      bottomBand();
      let hx = 12;
      hx += ui.prompt(hx, 250, 'confirm', 'SELECT') + 14;
      ui.prompt(hx, 250, 'dash', 'DASH');
      fxLayer();
      if (go) {
        // first run: ask for a leaderboard name once, then start the run
        if (go === 'play' && SC.net && SC.net.hasName && !SC.net.hasName() && SC.hasScene && SC.hasScene('name')) {
          SC.go('name', { next: 'play', nextParams: { mode: 'endless' }, back: 'title' });
        } else if (go === 'play') SC.go('play', { mode: 'endless' }); else SC.go(go, {});
      }
    }
  });

  // ---------- HANGAR ----------
  // tabs: CATS / HATS / TRAILS / STICKS. Items come from SC.art.<list>; a missing list shows COMING SOON.
  const HTABS = [
    { id: 'cats', label: 'CATS', icon: 'ic_cat', list: () => skinsList(), own: 'skins_owned', ownDef: ['ginger'], eq: 'skin', eqDef: 'ginger' },
    { id: 'hats', label: 'HATS', icon: 'ic_hat', list: () => (SC.art && SC.art.hats) || [], own: 'hats_owned', ownDef: ['none'], eq: 'hat', eqDef: 'none' },
    { id: 'trails', label: 'TRAILS', icon: 'ic_trail', list: () => (SC.art && SC.art.trails) || [], own: 'trails_owned', ownDef: ['classic'], eq: 'trail', eqDef: 'classic' },
    { id: 'sticks', label: 'STICKS', icon: 'ic_stick', list: () => (SC.art && SC.art.sticks) || [], own: 'sticks_owned', ownDef: ['branch'], eq: 'stick', eqDef: 'branch' }
  ];
  let hTab = 0, hSel = [0, 0, 0, 0], hMsg = '', hMsgT = 0;
  const hOwned = t => store.get(t.own, t.ownDef);
  const hEquipped = t => store.get(t.eq, t.eqDef);
  function hSyncSel() {
    HTABS.forEach((t, i) => { const l = t.list(), k = l.findIndex(it => it.id === hEquipped(t)); hSel[i] = k < 0 ? 0 : k; });
  }
  SC.scene('hangar', {
    enter(p) {
      ui.resetFocus(); SC.music.play('title'); hMsg = ''; hMsgT = 0;
      hTab = Math.max(0, HTABS.findIndex(t => t.id === (p && p.tab))); hSyncSel();
    },
    update() { scroll += 0.5 * SC.dt; if (hMsgT > 0) hMsgT--; },
    draw() {
      const I = inp(), CAT = SC.art && SC.art.CAT;
      const tab = HTABS[hTab], list = tab.list(), n = list.length;
      const onTab = String(ui.focused() || '').indexOf('tab_') === 0;
      ui.lockH = !onTab;
      drawBG(3, scroll);
      ui.band(0, 28, 'rgba(8,10,24,0.8)');
      title3('HANGAR', 12, 4, 'ic_hangar');
      // coins, big and clear in the header
      SC.text('COINS', W - 12, 3, { align: 'right', color: C.dim });
      coinsLine(W - 12, 12, store.get('coins', 0), 'right');
      const sel = n ? hSel[hTab] : 0;
      if (n && !onTab) {
        if (I.pressed('left')) { hSel[hTab] = (sel + n - 1) % n; sfx('select'); }
        if (I.pressed('right')) { hSel[hTab] = (sel + 1) % n; sfx('select'); }
      }
      const it = n ? list[hSel[hTab]] : null, coins = store.get('coins', 0);
      const own = !!it && hOwned(tab).indexOf(it.id) >= 0, eq = !!it && hEquipped(tab) === it.id;
      // action button first so it takes default focus
      if (it) {
        let label, dis = false, accent = C.gold;
        if (own && eq) { label = 'EQUIPPED'; dis = true; accent = null; }
        else if (own) label = 'EQUIP';
        else { label = 'BUY ' + it.price; if (coins < it.price) accent = '#8a6a30'; }
        if (!own) icon('ic_lock', 168, 186, '#ffffff');
        if (ui.button('act', 190, 183, 100, 19, label, { color: accent, disabled: dis, icon: own ? (eq ? 'ic_check' : null) : 'ic_coin' })) {
          if (own) { store.set(tab.eq, it.id); sfx('confirm'); }
          else if (coins >= it.price) {
            store.set('coins', coins - it.price);
            const o = hOwned(tab).slice(); o.push(it.id); store.set(tab.own, o); store.set(tab.eq, it.id);
            sfx('unlock'); SC.fx.burst(240, 90, { n: 36, colors: [C.gold, '#ffffff', C.cyan], speed: 4, life: 36 });
            SC.fx.ring(240, 90, { color: C.gold, r1: 70, life: 22 });
            hMsg = 'UNLOCKED!'; hMsgT = 70;
          } else { sfx('hurt', { vol: 0.5 }); hMsg = 'NOT ENOUGH COINS'; hMsgT = 70; }
        }
      }
      if (!it) {
        SC.text('COMING SOON', W / 2, 110, { scale: 3, align: 'center', color: C.dim });
      } else {
        // preview: the real sprite at integer scale 3 wearing the equipped set, with the selected item tried on
        SC.noShake(() => {
          if (!CAT) return;
          const bob = Math.round(Math.sin(SC.frame * 0.08) * 1.2);
          const px = 240 - Math.floor(CAT.w * 3 / 2), py = 44 + bob * 3;
          const o = { skin: store.get('skin', 'ginger'), hat: eqHat(), trail: eqTrail(), kind: 'fly', idx: SC.frame >> 3, scale: 3 };
          if (tab.id === 'cats') { o.skin = it.id; o.alpha = own ? 1 : 0.6; }
          else if (tab.id === 'hats') o.hat = it.id;
          else if (tab.id === 'trails') o.trail = it.id;
          else if (tab.id === 'sticks') {
            const T = SC.frame % 110;
            o.stick = it.id;
            if (T >= 50 && T < 74) {
              const pt = T - 50;
              o.kind = 'parry'; o.idx = Math.min(2, pt >> 3); o.stickFrame = Math.min(5, pt >> 2);
              o.slashFrame = pt >= 6 && pt < 18 ? (pt - 6) >> 2 : -1;
            }
          }
          drawCat(px, py, o);
        });
        if (ui.iconButton('prev', 150, 70, 'ic_back', { size: 24 })) { hSel[hTab] = (sel + n - 1) % n; }
        if (ui.iconButton('next', 306, 70, 'ic_back', { size: 24, flip: true })) { hSel[hTab] = (sel + 1) % n; }
        const nm = String(it.name).toUpperCase(), ns = SC.textWidth(nm, 3) <= 280 ? 3 : 2;
        // flat dark band so the name stays readable on bright skies (snow, clouds)
        ui.band(152, 27, 'rgba(8,10,24,0.72)');
        SC.text(nm, 240, ns === 3 ? 155 : 159, { scale: ns, align: 'center', color: '#ffffff' });
        SC.text((hSel[hTab] + 1) + ' / ' + n, W - 12, 162, { align: 'right', color: C.dim });
        if (hMsgT > 0) { SC.rect(140, 202, 200, 11, 'rgba(8,10,24,0.72)'); SC.text(hMsg, 240, 204, { align: 'center', color: hMsg === 'UNLOCKED!' ? C.good : C.bad, wave: 1 }); }
        // item strip on a flat dark band (click a cell to preview)
        ui.band(214, 26, 'rgba(8,10,24,0.82)');
        const cw = Math.min(34, Math.floor(440 / n)), sx0 = Math.floor((W - cw * n) / 2);
        const ownL = hOwned(tab), eqId = hEquipped(tab);
        list.forEach((k, i) => {
          const cx = sx0 + i * cw, cy = 214, isOwn = ownL.indexOf(k.id) >= 0, al = isOwn ? 1 : 0.5;
          if (i === hSel[hTab]) SC.rect(cx, cy + 1, cw - 1, 24, 'rgba(255,210,63,0.35)');
          const mx = cx + (cw - 1) / 2, my = cy + 13;
          if (tab.id === 'cats') { if (CAT && hasSpr('cat_' + k.id)) drawCat(cx + Math.floor((cw - 1 - CAT.w) / 2), cy + 1, { skin: k.id, flame: false, hat: 'none', alpha: al }); }
          else if (tab.id === 'hats') { if (k.id === 'none') SC.text('NONE', mx, my - 3, { align: 'center', color: C.dim }); else sprC('hat_' + k.id, 0, mx, my, { alpha: al }); }
          else if (tab.id === 'trails') sprC('jetflame_' + k.id, SC.frame >> 2, mx, my, { alpha: al });
          else sprC('stick_' + k.id, 2, mx, my, { alpha: al });
          if (eqId === k.id) icon('ic_check', cx + cw - 12, cy + 13, C.good);
          else if (!isOwn) icon('ic_lock', cx + cw - 12, cy + 13, C.dim);
          const ptr = I.pointer;
          if (ptr && ptr.pressed && inside(ptr.x, ptr.y, cx, cy, cw, 26)) { hSel[hTab] = i; sfx('select'); }
        });
      }
      // tabs (flat row)
      const tw = 100, tx0 = Math.floor((W - (tw * 4 + 12)) / 2);
      HTABS.forEach((t, i) => {
        if (ui.button('tab_' + t.id, tx0 + i * (tw + 4), 31, tw, 16, t.label, { small: true, icon: t.icon, silent: true, color: i === hTab ? C.gold : null })) { hTab = i; ui.resetFocus(); sfx('select'); }
      });
      bottomBand();
      if (ui.button('back', 8, 246, 70, 17, 'BACK', { icon: 'ic_back', small: true, hotkey: 'back', silent: true })) { sfx('back'); SC.go('title', {}); }
      let kx = 100;
      kx += ui.prompt(kx, 249, 'left', null) + 4;
      SC.text('/', kx, 251, {}); kx += 10;
      ui.prompt(kx, 249, 'right', 'BROWSE');
      fxLayer();
    }
  });

  // ---------- HOW TO PLAY ----------
  const AW = 148, AH = 84;
  function demoFrame(ax, ay) {
    SC.rect(ax, ay, AW, AH, '#172044');
    for (let i = 0; i < 6; i++) { // scrolling stars
      const sx = ((i * 53 - SC.frame * (0.2 + i * 0.05)) % AW + AW) % AW;
      SC.rect(ax + sx, ay + 6 + (i * 17) % 40, 1, 1, '#4b5c96');
    }
    SC.rect(ax, ay + AH - 10, AW, 10, '#2b3a66');
    SC.rect(ax, ay + AH - 10, AW, 1, '#4b5c96');
  }
  const catTL = (cx, cy) => { const C0 = SC.art.CAT.centre; return { x: cx - C0.x, y: cy - C0.y }; };

  function demoDash(ax, ay, T) {
    const CAT = SC.art && SC.art.CAT, e = enemy('tank_light');
    if (!CAT || !e) return;
    const gy = ay + AH - 10, tx = Math.round(ax + AW - e.w - 22 - T * 0.3), ty = gy - e.h + 2;
    const hx = tx + e.hatch.x + e.hatch.w / 2, hy = ty + e.hatch.y + 1;
    const st = { x: ax + 16, y: ay + 12 };
    const tgt = catTL(hx, hy);
    const pos = p => ({ x: st.x + (tgt.x - st.x) * p, y: st.y + (tgt.y - st.y) * p });
    if (T < 54) {
      drawTank('tank_light', tx, ty, T >> 2);
      sprC('hatch_glow', T >> 2, hx, ty + e.hatch.y + 2);
    } else if (T - 54 < 16) sprC('explosion', (T - 54) >> 1, tx + e.w / 2, ty + e.h / 2);
    if (T < 40) drawCat(st.x, st.y + Math.sin(T * 0.2) * 3, { idx: T >> 2 });
    else if (T < 54) {
      const p = (T - 40) / 13;
      for (let k = 3; k >= 1; k--) { const q = pos(Math.max(0, p - k * 0.12)); drawCat(q.x, q.y, { kind: 'dash', idx: 0, alpha: 0.35 / k * 1.5, flame: false }); }
      const q = pos(Math.min(1, p));
      drawCat(q.x, q.y, { kind: 'dash', idx: T >> 1 });
    } else {
      const u = Math.min(1, (T - 54) / 30), q = pos(1);
      drawCat(q.x + u * 18, q.y - u * 16, { idx: T >> 2 });
    }
    if (T >= 54 && T < 100 && ((T >> 2) & 1) === 0) SC.text('DIVE KO!', ax + AW / 2, ay + 8, { align: 'center', color: C.gold, scale: 2 });
  }

  // shell flies in, cat swings, shell turns cyan and flies back, tank blows up, tank rolls back in
  function demoParry(ax, ay, T) {
    const CAT = SC.art && SC.art.CAT, e = enemy('tank_light');
    if (!CAT || !e) return;
    const gy = ay + AH - 10, tx0 = ax + AW - e.w - 8, ty = gy - e.h + 2;
    const cat = { x: ax + 14, y: ay + 36 + Math.round(Math.sin(T * 0.15) * 2) };
    const cX = cat.x + CAT.centre.x, cY = cat.y + CAT.centre.y;
    const sx = tx0 + 2, sy = ty + e.turret.y;             // muzzle
    const px = cX + 22, py = cY;                            // parry point
    const T0 = 24, T1 = T0 + Math.ceil((sx - px) / 2.2);   // launch, parry
    const T2 = T1 + Math.ceil((sx - px) / 4);              // reflected shell lands
    const alive = T < T2;
    let tx = tx0;
    if (T >= T2 + 14 && T < T2 + 50) tx = tx0 + Math.round((1 - SC.ease.outCubic((T - T2 - 14) / 36)) * AW);
    if (alive || T >= T2 + 14) drawTank('tank_light', tx, ty, (T >= T2 + 14 && T < T2 + 50) ? T >> 2 : 0);
    if (T < T0) {
      sprC('warn', T >> 3, tx0 + e.w / 2, ty - 10);
      SC.dotLine(sx, sy, px, py, 'rgba(255,93,108,0.85)', 3, T);
    }
    if (T >= T0 && T < T1) {
      const u = (T - T0) / (T1 - T0);
      sprC('shell', T >> 1, sx + (px - sx) * u, sy + (py - sy) * u);
    } else if (T >= T1 && T < T2) {
      const u = (T - T1) / (T2 - T1);
      sprC('shell_p', T >> 1, px + (sx - px) * u, py + (sy - py) * u);
    }
    if (T >= T2 && T < T2 + 16) sprC('explosion', (T - T2) >> 1, tx0 + e.w / 2, ty + e.h / 2);
    const pt = T - (T1 - 4);
    if (pt >= 0 && pt < 13) {
      const fi = Math.min(2, pt >> 2);
      drawCat(cat.x, cat.y, { kind: 'parry', idx: fi });
      const hp = (CAT.handFrames && CAT.handFrames.parry && CAT.handFrames.parry[fi]) || CAT.hand;
      if (pt >= 2 && pt < 9) spr('slash', (pt - 2) >> 1, cat.x + hp.x, cat.y + hp.y);
      sprAnch(stickSpr(), Math.min(5, pt >> 1), cat.x + hp.x, cat.y + hp.y, false);
    } else drawCat(cat.x, cat.y, { idx: T >> 2 });
    if (T >= T1 && T < T1 + 12) SC.ring(px, py, 6 + (T - T1) * 5, 'rgba(255,255,255,0.85)', 1);
    if (T >= T1 && T < T1 + 30) SC.text('PARRY!', ax + AW / 2, ay + 8, { align: 'center', color: C.cyan, scale: 2 });
  }

  function demoRocket(ax, ay, T) {
    const CAT = SC.art && SC.art.CAT, e = enemy('tank_heavy');
    if (!CAT || !e) return;
    const gy = ay + AH - 10, tx = ax + AW - e.w - 6, ty = gy - e.h + 2;
    const cat = { x: ax + 10, y: Math.round(ty + e.h / 2 - CAT.hand.y) };
    const hand0 = CAT.hand;
    const x0 = cat.x + hand0.x + 6, y0 = cat.y + hand0.y;
    const ts = [14, 42, 70], hs = ts.map(t => t + (tx + 4 - x0) / 3.4);
    const dead = T >= hs[2];
    if (!dead) {
      const flash = hs.some(h => T >= h && T < h + 3);
      spr('tank_heavy', e.frames.move[(T >> 2) % e.frames.move.length], tx, ty, { white: flash });
    }
    ts.forEach((t, i) => {
      if (T >= t && T < hs[i]) {
        const rx = x0 + 3.4 * (T - t);
        sprC('rocket', 0, rx, y0);
        for (let k = 1; k < 5; k++) if (rx - k * 7 > x0) sprC('smoke', Math.min(4, k), rx - k * 7 - 6, y0 + (k & 1));
      }
      if (T >= hs[i] && T < hs[i] + 16) {
        if (i === 2) sprC('explosion_big', Math.floor(T - hs[i]) >> 1, tx + e.w / 2, ty + e.h / 2);
        else sprC('explosion', Math.floor(T - hs[i]) >> 1, tx + 6, y0);
      }
    });
    const rec = ts.some(t => T >= t && T < t + 6);
    drawCat(cat.x, cat.y, { kind: 'shoot', idx: rec ? 1 : 0 });
    const hp = (CAT.handFrames && CAT.handFrames.shoot && CAT.handFrames.shoot[rec ? 1 : 0]) || hand0;
    spr('bazooka', rec ? 1 : 0, cat.x + hp.x, cat.y + hp.y);
    for (let i = 0; i < 3; i++) SC.rect(ax + 4 + i * 6, ay + 4, 4, 4, T < ts[i] ? C.orange : '#3a3a55');
    if (dead && T < hs[2] + 30) SC.text('BOOM!', ax + AW / 2, ay + 8, { align: 'center', color: C.orange, scale: 2 });
  }

  let hwT = 0;
  SC.scene('howto', {
    enter() { ui.resetFocus(); hwT = 0; SC.music.play('title'); },
    update() { hwT++; scroll += 0.4 * SC.dt; },
    draw() {
      drawBG(1, scroll);
      ui.band(0, 240, 'rgba(8,10,24,0.78)');
      title3('HOW TO PLAY', 12, 6, 'ic_info');
      const cols = [
        { x: 10, name: 'DASH', ic: 'ic_bolt', keys: 'dash', d: 'Dash into the glowing hatch on top of a tank for an instant dive KO. Dashing makes you invulnerable.', demo: demoDash },
        { x: 166, name: 'PARRY', ic: 'ic_shield', keys: 'parry', d: 'Swing at enemy shots to reflect them back. Perfect timing hits harder. Chain parries for combos.', demo: demoParry },
        { x: 322, name: 'BAZOOKA', ic: 'ic_rocket', keys: 'fire', d: 'Fire homing rockets with splash damage. Limited ammo, so grab rocket pickups.', demo: demoRocket }
      ];
      cols.forEach(c => {
        icon(c.ic, c.x, 38, C.gold);
        SC.text(c.name, c.x + 16, 36, { scale: 2, color: C.gold });
        let kx = c.x + 4 + SC.textWidth(c.name, 2) + 18;
        ui.keyLabels(c.keys).forEach((k, i) => { if (i) { SC.text('/', kx, 38, {}); kx += 8; } kx += ui.keycap(k, kx, 36) + 2; });
        const ax = c.x, ay = 56;
        demoFrame(ax, ay);
        const ctx = SC.ctx;
        ctx.save();
        try {
          ctx.beginPath(); ctx.rect(ax, ay, AW, AH); ctx.clip();
          c.demo(ax, ay, hwT % 130);
        } finally { ctx.restore(); }
        wrap(c.d, AW, 1).slice(0, 6).forEach((ln, i) => SC.text(ln, ax, ay + AH + 6 + i * 9, { color: '#dfe6f5' }));
      });
      // movement + misc
      let y = 206, x = 10;
      SC.text('MOVE', x, y + 2, { color: C.cyan }); x += 32;
      const mv = ['up', 'left', 'down', 'right'], bd = inp().bindings;
      [0, 1].forEach(slot => {
        const labs = mv.map(a => bd[a][slot] ? inp().keyName(bd[a][slot]) : null);
        if (labs.some(l => !l)) { if (slot === 0) labs.forEach((l, i) => { if (!l) labs[i] = '--'; }); else return; }
        const tw = labs.reduce((t, l) => t + SC.textWidth(l, 1) + 7, 0) + (slot ? 20 : 0);
        if (x + tw > 300) return;
        if (slot) { SC.text('OR', x + 2, y + 2, { color: C.dim }); x += 20; }
        labs.forEach(l => { x += ui.keycap(l, x, y) + 2; });
      });
      x += 14;
      SC.text('PAUSE', x, y + 2, { color: C.cyan }); x += 36;
      x += ui.keycap(ui.keyLabel('pause'), x, y) + 16;
      SC.text('GRAZE SHOTS, CHAIN KOS, KEEP YOUR COMBO ALIVE', 10, 223, { color: C.dim });
      if (inp().isTouch) SC.text('TOUCH: DRAG LEFT SIDE TO FLY, BUTTONS ON THE RIGHT', 10, 231, { color: C.dim });
      bottomBand();
      if (ui.button('back', 8, 246, 70, 17, 'BACK', { icon: 'ic_back', small: true, hotkey: 'back', silent: true })) { sfx('back'); SC.go('title', {}); }
      fxLayer();
    }
  });

  // ---------- SETTINGS ----------
  let sConfirm = false, sMsg = 0;
  function eraseSave() {
    try {
      const del = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('skycat2-') === 0) del.push(k); }
      del.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    try { if (store.clear) store.clear(); } catch (e) {}
  }
  SC.scene('settings', {
    enter() { ui.resetFocus(); sConfirm = false; sMsg = 0; SC.music.play('title'); },
    update() {
      scroll += 0.5 * SC.dt;
      if (sMsg > 0 && --sMsg === 0) { try { location.reload(); } catch (e) {} }
    },
    draw() {
      drawBG(4, scroll);
      ui.band(0, 240, 'rgba(8,10,24,0.78)');
      title3('SETTINGS', 12, 6, 'ic_gear');
      drawCat(404, 66 + Math.round(Math.sin(SC.frame * 0.06) * 5), { idx: SC.frame >> 3 });
      const x = 80, w = 300, h = 19;
      let y = 36;
      const tog = (id, label, on, ic) => ui.button(id, x, y, w, h, label, { icon: ic, align: 'left', value: on ? 'ON' : 'OFF', valueColor: on ? C.good : C.dim });
      if (sMsg > 0) {
        SC.text('SAVE ERASED', W / 2, 110, { scale: 3, align: 'center', color: C.good });
      } else if (!sConfirm) {
        const A = SC.audio, P = 23;
        if (tog('sfx', 'SOUND FX', A.sfxOn, A.sfxOn ? 'ic_sound' : 'ic_mute')) A.setSfx(!A.sfxOn); y += P;
        if (tog('music', 'MUSIC', A.musicOn, 'ic_music')) A.setMusic(!A.musicOn); y += P;
        const shake = store.get('shake', true);
        if (tog('shake', 'SCREEN SHAKE', shake, 'ic_bolt')) store.set('shake', !shake); y += P;
        if (tog('fs', 'FULLSCREEN', SC.fullscreen.active, 'ic_fullscreen')) SC.fullscreen.toggle(); y += P;
        const pp = store.get('pixelPerfect', false) === true;
        if (tog('pp', 'PIXEL PERFECT', pp, 'ic_target')) { store.set('pixelPerfect', !pp); SC.relayout(); } y += P;
        const nm = SC.net && SC.net.getName ? SC.net.getName() : '';
        if (ui.button('name', x, y, w, h, 'PLAYER NAME', { icon: 'ic_user', align: 'left', value: nm || 'NOT SET', valueColor: nm ? C.cyan : C.dim })) SC.go('name', { next: 'settings', back: 'settings' });
        y += P;
        if (ui.button('controls', x, y, w, h, 'CONTROLS', { icon: 'ic_gear', align: 'left', value: 'KEYBOARD', valueColor: C.cyan })) { SC.go('controls', {}); }
        y += P + 4;
        if (ui.button('reset', x + w - 110, y, 110, 16, 'RESET SAVE', { icon: 'ic_skull', color: '#a83a4a', small: true })) { sConfirm = true; ui.resetFocus(); }
      } else {
        SC.text('ERASE ALL PROGRESS?', W / 2, 62, { scale: 2, align: 'center', color: C.bad });
        SC.text('COINS, SKINS AND SCORES ARE LOST FOREVER', W / 2, 84, { align: 'center', color: '#dfe6f5' });
        if (ui.button('no', 110, 112, 120, 22, 'NO', { icon: 'ic_back', hotkey: 'back', silent: true })) { sConfirm = false; ui.resetFocus(); sfx('back'); }
        if (ui.button('yes', 250, 112, 120, 22, 'YES, ERASE', { icon: 'ic_check', color: '#a83a4a' })) { eraseSave(); sMsg = 50; sfx('explode'); }
      }
      bottomBand();
      if (ui.button('back', 8, 246, 70, 17, 'BACK', { icon: 'ic_back', small: true, hotkey: sConfirm ? null : 'back', silent: true })) { sfx('back'); SC.go('title', {}); }
      SC.text('V1.0', W - 6, H - 11, { align: 'right', color: C.dim });
      fxLayer();
    }
  });

  // ---------- CONTROLS (keyboard remap) ----------
  const CTL_ROWS = [
    ['up', 'MOVE UP'], ['down', 'MOVE DOWN'], ['left', 'MOVE LEFT'], ['right', 'MOVE RIGHT'],
    ['dash', 'DASH'], ['parry', 'PARRY'], ['fire', 'BAZOOKA'], ['pause', 'PAUSE'], ['retry', 'RETRY']
  ];
  const CTL_NAME = {};
  CTL_ROWS.forEach(r => { CTL_NAME[r[0]] = r[1]; });
  let cSel = null, cNote = '', cNoteT = 0;
  function cStop() { if (cSel) { cSel = null; } if (inp().capturing) inp().captureKey(null); }
  function cStart(action, slot) {
    cSel = { action: action, slot: slot };
    cNote = ''; cNoteT = 0;
    inp().captureKey(function (code) {
      const sel = cSel; cSel = null;
      if (!sel || code === null) { sfx('back'); return; }
      if (code === 'Backspace' || code === 'Delete') {
        inp().setBinding(sel.action, sel.slot, null);
        cNote = CTL_NAME[sel.action] + ' SLOT CLEARED'; cNoteT = 150; sfx('back');
        return;
      }
      const moved = inp().setBinding(sel.action, sel.slot, code);
      cNote = moved ? inp().keyName(code) + ' MOVED FROM ' + CTL_NAME[moved] : inp().keyName(code) + ' BOUND TO ' + CTL_NAME[sel.action];
      cNoteT = 220; sfx('confirm');
    });
  }
  SC.scene('controls', {
    enter() { ui.resetFocus(); cSel = null; cNote = ''; cNoteT = 0; SC.music.play('title'); },
    exit() { cStop(); },
    update() { scroll += 0.5 * SC.dt; if (cNoteT > 0) cNoteT--; },
    draw() {
      drawBG(4, scroll);
      ui.band(0, 240, 'rgba(8,10,24,0.78)');
      title3('CONTROLS', 12, 6, 'ic_gear');
      const ptr = inp().pointer;
      if (cSel && ptr.pressed) cStop();
      const lx = 70, sx = 196, sw = 84, gap = 8, rh = 19;
      SC.text('KEY 1', sx + sw / 2, 24, { align: 'center', color: C.dim });
      SC.text('KEY 2', sx + sw + gap + sw / 2, 24, { align: 'center', color: C.dim });
      CTL_ROWS.forEach((r, i) => {
        const y = 34 + i * rh, act = r[0];
        SC.text(r[1], lx, y + 4, { color: '#ffffff' });
        for (let s = 0; s < 2; s++) {
          const x = sx + s * (sw + gap);
          const on = cSel && cSel.action === act && cSel.slot === s;
          const code = inp().bindings[act][s];
          const blink = (SC.frame >> 4) & 1;
          const label = on ? 'PRESS A KEY' : (code ? inp().keyName(code) : '---');
          const o = { small: true, silent: true };
          if (on) o.color = blink ? C.gold : '#ffffff';
          if (ui.button('k_' + act + '_' + s, x, y, sw, 16, label, o) && !on) { sfx('select'); cStart(act, s); }
        }
      });
      const ny = 34 + CTL_ROWS.length * rh + 3;
      if (cSel) SC.text('PRESS A KEY.  ESC CANCELS.  BKSP OR DEL CLEARS.', W / 2, ny, { align: 'center', color: C.gold });
      else if (cNoteT > 0) SC.text(fitText(cNote, 440, 1), W / 2, ny, { align: 'center', color: C.good });
      else SC.text('SELECT A SLOT, THEN PRESS THE NEW KEY.', W / 2, ny, { align: 'center', color: C.dim });
      bottomBand();
      if (ui.button('back', 8, 246, 70, 17, 'BACK', { icon: 'ic_back', small: true, hotkey: cSel ? null : 'back', silent: true })) { cStop(); sfx('back'); SC.go('settings', {}); }
      if (ui.button('defaults', W - 168, 246, 160, 17, 'RESET TO DEFAULTS', { icon: 'ic_retry', small: true, color: '#a83a4a' })) {
        cStop(); inp().resetBindings(); cNote = 'CONTROLS RESET TO DEFAULTS'; cNoteT = 220;
      }
      fxLayer();
    }
  });

  // ---------- LEADERBOARD (single ENDLESS board) ----------
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  let lb = { state: 'loading', data: null }, lbScroll = 0, lbDrag = null, lbTok = 0;
  const RK_COL = ['#ffd23f', '#d5dbea', '#e09a5a'];
  function lbLoad() {
    const tok = ++lbTok;
    lb = { state: 'loading', data: null };
    if (!SC.net || !SC.net.top) { lb.state = 'offline'; return; }
    let pr = null;
    try { pr = SC.net.top('endless'); } catch (e) { pr = null; }
    if (!pr || !pr.then) { lb.state = 'offline'; return; }
    pr.then(d => { if (tok !== lbTok) return; if (d && d.entries) { lb.data = d; lb.state = 'ok'; } else lb.state = 'offline'; },
      () => { if (tok === lbTok) lb.state = 'offline'; });
  }
  // small cat head crop for a skin id
  function skinHead(id, x, y) {
    const CAT = SC.art && SC.art.CAT, nm = 'cat_' + id;
    if (!CAT || !hasSpr(nm)) return;
    const hx = 20, hy = 6;
    const an = catAnchor(nm), ctx = SC.ctx;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, 12, 11); ctx.clip();
    spr(nm, 0, x - (hx - 6) + an.x, y - (hy - 1) + an.y);
    ctx.restore();
  }
  SC.scene('leaderboard', {
    enter() { ui.resetFocus(); lbScroll = 0; lbDrag = null; SC.music.play('title'); lbLoad(); },
    update() { scroll += 0.5 * SC.dt; },
    draw() {
      ui.lockV = true;
      const I = inp(), ptr = I.pointer;
      drawBG(2, scroll);
      ui.band(0, 240, 'rgba(8,10,24,0.78)');
      title3('LEADERBOARD', 12, 6, 'ic_trophy');
      const entries = (lb.data && lb.data.entries) || [];
      const you = lb.data && lb.data.you;
      const myId = SC.net && SC.net.id;
      const ROWS = 14, RH = 12, ly = 58, maxS = Math.max(0, entries.length - ROWS);
      let st = 'LOADING...', sc = C.cyan;
      if (lb.state === 'offline') { st = 'OFFLINE'; sc = C.bad; }
      else if (lb.state === 'ok') {
        if (you && you.rank) { st = 'YOUR RANK #' + you.rank + (lb.data.total ? ' OF ' + lb.data.total : ''); sc = C.good; }
        else { st = entries.length ? 'NOT RANKED YET' : 'NO SCORES YET'; sc = C.dim; }
      }
      SC.text('ALL TIME BEST SCORES', 12, 34, { color: C.gold });
      SC.text(st, W - 12, 34, { align: 'right', color: sc });
      SC.rect(10, 46, W - 20, 1, 'rgba(255,255,255,0.15)');
      SC.text('#', 14, 49, { color: C.dim }); SC.text('NAME', 56, 49, { color: C.dim });
      SC.text('WAVE', 330, 49, { align: 'right', color: C.dim }); SC.text('SCORE', 420, 49, { align: 'right', color: C.dim });
      let d = 0;
      if (I.pressed('up')) d -= 1;
      if (I.pressed('down')) d += 1;
      if (I.takeWheel) d += Math.round(I.takeWheel() / 60);
      if (ptr.pressed && inside(ptr.x, ptr.y, 10, ly, W - 20, ROWS * RH)) lbDrag = { y: ptr.y, s: lbScroll };
      if (lbDrag) { if (ptr.down) { const nd = Math.round((lbDrag.y - ptr.y) / RH); if (nd) lbScroll = clampN(lbDrag.s + nd, 0, maxS); } else lbDrag = null; }
      lbScroll = clampN(lbScroll + d, 0, maxS);
      for (let i = 0; i < ROWS; i++) {
        const e = entries[lbScroll + i];
        if (!e) break;
        const y = ly + i * RH, mine = (you && you.rank === e.rank) || (myId && e.id === myId);
        if (mine) SC.rect(10, y - 1, W - 20, RH, 'rgba(255,210,63,0.22)');
        else if ((i & 1) === 0) SC.rect(10, y - 1, W - 20, RH, 'rgba(255,255,255,0.04)');
        SC.text(String(e.rank), 14, y + 1, { color: RK_COL[e.rank - 1] || C.dim });
        skinHead(e.skin || 'ginger', 38, y - 1);
        SC.text(fitText(String(e.name || '???'), 190, 1), 56, y + 1, { color: mine ? C.gold : (RK_COL[e.rank - 1] || '#ffffff') });
        SC.text(String(e.wave != null ? e.wave : '-'), 330, y + 1, { align: 'right', color: C.dim });
        SC.text(String(e.score), 420, y + 1, { align: 'right', color: '#ffffff' });
      }
      if (lb.state === 'ok' && !entries.length) SC.text('BE THE FIRST ON THE BOARD', W / 2, 120, { align: 'center', color: C.dim, scale: 2 });
      if (lb.state === 'offline') SC.text('CANNOT REACH THE SERVER', W / 2, 120, { align: 'center', color: C.dim, scale: 2 });
      if (lb.state === 'loading') SC.text('LOADING' + '...'.slice(0, (SC.frame >> 4) % 4), W / 2, 120, { align: 'center', color: C.cyan, scale: 2 });
      if (maxS > 0) {
        const bh = ROWS * RH, th = Math.max(10, Math.round(bh * ROWS / entries.length));
        SC.rect(W - 8, ly - 1, 2, bh, 'rgba(255,255,255,0.12)');
        SC.rect(W - 8, ly - 1 + Math.round((bh - th) * lbScroll / maxS), 2, th, C.gold);
      }
      if (you && you.rank && you.rank > entries.length) {
        SC.rect(10, 226, W - 20, 12, 'rgba(255,210,63,0.22)');
        SC.text('#' + you.rank, 14, 228, { color: C.gold }); SC.text('YOU', 56, 228, { color: C.gold });
        SC.text(String(you.score), 420, 228, { align: 'right', color: '#ffffff' });
      }
      bottomBand();
      if (ui.button('back', 8, 246, 70, 17, 'BACK', { icon: 'ic_back', small: true, hotkey: 'back', silent: true })) { sfx('back'); SC.go('title', {}); }
      if (ui.button('refresh', W - 218, 246, 66, 17, 'RELOAD', { icon: 'ic_retry', small: true })) lbLoad();
      if (ui.button('chg', W - 148, 246, 140, 17, 'CHANGE NAME', { icon: 'ic_user', small: true })) SC.go('name', { next: 'leaderboard', back: 'leaderboard' });
      fxLayer();
    }
  });

  // ---------- NAME ENTRY ----------
  let nmP = null, nmGo = false;
  const KB_ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL-', 'ZXCVBNM_'];
  function nameSave() {
    const T = inp().text, v = T.value;
    if (v.length < 3 || nmGo) return;
    nmGo = true;
    if (SC.net && SC.net.setName) SC.net.setName(v); else store.set('lb_name', v);
    T.stop(); sfx('confirm');
    SC.go(nmP.next || 'title', nmP.nextParams || {});
  }
  function nameBack() {
    if (nmGo) return;
    nmGo = true; inp().text.stop(); sfx('back');
    SC.go(nmP.back || nmP.next || 'title', (nmP.back ? {} : nmP.nextParams) || {});
  }
  SC.scene('name', {
    enter(p) {
      nmP = p || {}; nmGo = false; ui.resetFocus(); SC.music.play('title');
      const cur = SC.net && SC.net.getName ? SC.net.getName() : store.get('lb_name', '');
      inp().text.start(12, (v, done) => { if (done) { if (v === null) nameBack(); else nameSave(); } }, cur || '');
    },
    exit() { inp().text.stop(); },
    update() { scroll += 0.4 * SC.dt; },
    draw() {
      const T = inp().text;
      drawBG(0, scroll);
      ui.band(0, 240, 'rgba(8,10,24,0.78)');
      title3('YOUR NAME', 12, 6, 'ic_user');
      const v = T.value, shown = v + (((SC.frame >> 5) & 1) && v.length < 12 ? '_' : ' ');
      SC.text(shown, W / 2, 44, { scale: 3, align: 'center', color: v.length >= 3 ? '#ffffff' : C.dim });
      SC.rect(W / 2 - 110, 70, 220, 2, v.length >= 3 ? C.gold : C.dim);
      SC.text('3-12 CHARACTERS: A-Z 0-9 - _', W / 2, 78, { align: 'center', color: C.dim });
      const kw = 26, kh = 17, g = 3, x0 = Math.floor((W - (10 * (kw + g) - g)) / 2);
      KB_ROWS.forEach((row, r) => {
        const rx = x0 + Math.floor((10 - row.length) * (kw + g) / 2);
        for (let i = 0; i < row.length; i++) {
          const ch = row.charAt(i);
          if (ui.button('k' + ch, rx + i * (kw + g), 96 + r * (kh + g), kw, kh, ch, { small: true, silent: true })) { T.type(ch); sfx('select'); }
        }
      });
      const y = 96 + 4 * (kh + g) + 4;
      if (ui.button('kdel', x0, y, 80, 18, 'DELETE', { small: true, silent: true, icon: 'ic_back' })) { T.backspace(); sfx('select'); }
      if (ui.button('ksp', x0 + 84, y, 80, 18, 'SPACE', { small: true, silent: true })) { T.type(' '); sfx('select'); }
      if (ui.button('ksave', x0 + 168, y, W - 2 * x0 - 168, 18, 'SAVE', { small: true, icon: 'ic_check', color: C.gold, disabled: v.length < 3 })) nameSave();
      bottomBand();
      if (ui.button('back', 8, 246, 70, 17, nmP && nmP.back ? 'BACK' : 'SKIP', { icon: 'ic_back', small: true, silent: true })) nameBack();
      SC.text('TYPE ON YOUR KEYBOARD OR TAP THE KEYS. ENTER SAVES.', W - 8, 251, { align: 'right', color: C.dim });
      fxLayer();
    }
  });

  // ---------- RESULTS ----------
  let R = null, rT = 0, shown = 0, rDone = false, skipFrame = -1, rScroll = 0, capture = false, going = false;
  const CD = 70;
  const MODE_NAME = { endless: 'ENDLESS' };
  function doneList() {
    return (R.missionsDone || []).map(m => typeof m === 'string' ? { text: m } : m);
  }
  function drawCard(p) {
    const biome = Math.floor(((p.wave || 1) - 1) / 5) % 5;
    drawBG(biome, 30);
    SC.rect(0, 0, W, H, 'rgba(8,10,24,0.55)');
    if (hasSpr('logo')) spr('logo', 0, 12, 10);
    SC.text(MODE_NAME[p.mode] || 'RUN', W - 16, 20, { scale: 3, align: 'right', color: C.gold });
    SC.text('SCORE', W / 2, 92, { scale: 2, align: 'center', color: C.dim });
    SC.text(String(p.score), W / 2, 112, { scale: 7, align: 'center', color: '#ffffff' });
    if (p.newBest) SC.text('NEW BEST!', W / 2, 168, { scale: 3, align: 'center', color: C.gold });
    const stats = [['WAVE', p.wave], ['KOS', p.kos], ['COMBO', 'x' + p.maxCombo]];
    stats.forEach((s, i) => {
      const x = 80 + i * 160;
      SC.text(s[0], x, 200, { scale: 1, align: 'center', color: C.dim });
      SC.text(String(s[1]), x, 212, { scale: 3, align: 'center', color: '#ffffff' });
    });
    drawCat(40, 150, { idx: 0 });
    SC.text('SKY CAT: TANK TOPPLE', W / 2, 252, { align: 'center', color: C.dim });
    SC.text(new Date().toISOString().slice(0, 10), W - 8, 258, { align: 'right', color: C.dim });
  }
  function shareCard() {
    capture = true; // next draw renders the card first, then snapshots it
  }
  function snapshot() {
    const off = document.createElement('canvas');
    off.width = W * 2; off.height = H * 2;
    const o = off.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.drawImage(SC.canvas, 0, 0, W, H, 0, 0, W * 2, H * 2);
    off.toBlob(blob => {
      if (!blob) return;
      const name = 'sky-cat-score.png';
      try {
        const file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'Sky Cat: Tank Topple', text: 'I scored ' + R.score + ' in Sky Cat!' }).catch(() => {});
          return;
        }
      } catch (e) {}
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  }

  let rank = { state: 'off', val: null };
  function rankWire(r) {
    const rk = r.rank, mine = rank;
    if (rk && typeof rk.then === 'function') {
      mine.state = 'wait';
      rk.then(v => { mine.val = v; mine.state = v && v.rank ? 'ok' : 'off'; }, () => { mine.state = 'off'; });
    } else if (rk && rk.rank) { mine.val = rk; mine.state = 'ok'; }
  }

  SC.scene('results', {
    enter(p) {
      R = Object.assign({ mode: 'endless', score: 0, wave: 1, kos: 0, maxCombo: 0, coins: 0, best: 0, newBest: false, missionsDone: [], time: 0 }, p || {});
      rank = { state: 'off', val: null }; rankWire(R);
      rT = 0; shown = 0; rDone = false; skipFrame = -1; capture = false; rScroll = 0; going = false;
      ui.resetFocus(); SC.music.play('results');
    },
    update() {
      rT++; rScroll += 0.3 * SC.dt;
      const I = inp();
      // skip the count-up only after a short grace so a mashed key from the run cannot skip or retry
      if (rT >= 20 && rT < CD && (I.pressed('confirm') || (I.pointer && I.pointer.pressed))) { rT = CD; skipFrame = SC.frame; }
      shown = rT < CD ? Math.round(R.score * SC.ease.outCubic(rT / CD)) : R.score;
      if (rT < CD && rT % 3 === 0) sfx('tick', { pitch: 0.8 + rT / CD, vol: 0.5 });
      if (rT >= CD && !rDone) {
        rDone = true; rT = CD;
        if (R.newBest) {
          sfx('newbest'); if (SC.vibe) SC.vibe(60);
          SC.fx.burst(150, 70, { n: 40, colors: [C.gold, '#ffffff', C.pink, C.cyan], speed: 4, life: 40, gravity: 0.08 });
          SC.fx.ring(150, 70, { color: C.gold, r1: 90, life: 24 });
          SC.fx.flash('#ffffff', 6, 0.35);
        } else sfx('select');
      }
      // one more run: Enter / Space retries once the count-up has finished
      if (rDone && !going && rT >= CD + 8 && skipFrame !== SC.frame && I.pressed('confirm')) { going = true; SC.go('play', { mode: R.mode }); }
    },
    draw() {
      if (capture) { capture = false; SC.noShake(() => { drawCard(R); snapshot(); }); }
      drawBG(Math.floor((R.wave - 1) / 5) % 5, rScroll * 40);
      SC.rect(0, 0, W, H, 'rgba(8,10,24,0.5)');
      const t = rT;
      // flat bands behind the two columns
      SC.rect(10, 6, 232, 212, 'rgba(8,10,24,0.62)');
      SC.rect(252, 6, 218, 212, 'rgba(8,10,24,0.62)');
      // left column: score + stats
      SC.text(MODE_NAME[R.mode] || 'RUN', 20, 12, { scale: 2, color: C.gold });
      SC.text('SCORE', 20, 34, { color: C.dim });
      SC.text(String(shown), 20, 46, { scale: 5, color: '#ffffff' });
      const before = R.bestBefore != null ? R.bestBefore : R.best;
      if (rDone && R.newBest) {
        const a = t - CD, sc = a < 4 ? 5 : a < 8 ? 4 : 3;
        const ox = a < 12 ? Math.round(Math.sin(a * 3) * 2) : 0;
        icon('ic_trophy', 20 + ox, 91, C.gold);
        SC.text('NEW BEST!', 36 + ox, 88, { scale: sc === 5 ? 4 : sc, color: ((SC.frame >> 3) & 1) ? C.gold : '#ffffff' });
      } else if (rDone && before > R.score) {
        icon('ic_target', 20, 90, C.orange);
        SC.text((before - R.score) + ' TO BEAT BEST', 36, 92, { scale: 1, color: C.orange });
      }
      const rows = [['WAVE', String(R.wave)], ['KOS', String(R.kos)], ['MAX COMBO', 'x' + R.maxCombo], ['TIME', fmtTime(R.time)], ['BEST', String(R.newBest ? R.score : R.best)]];
      {
        let gt = 'OFFLINE', gc = C.dim;
        if (rank.state === 'wait') { gt = 'SENDING SCORE' + '...'.slice(0, (SC.frame >> 4) % 4); gc = C.cyan; }
        else if (rank.state === 'ok') { gt = 'GLOBAL #' + rank.val.rank + (rank.val.total ? ' OF ' + rank.val.total : ''); gc = C.good; }
        icon('ic_globe', 20, 100, gc);
        SC.text(gt, 36, 102, { color: gc });
      }
      rows.forEach((r, i) => {
        const at = 14 + i * 7;
        if (t < at) return;
        const slide = Math.max(0, 14 - (t - at) * 3);
        const y = 112 + i * 13;
        SC.text(r[0], 20 - slide, y, { color: C.dim });
        SC.text(r[1], 230 + slide, y, { align: 'right', color: '#ffffff' });
        SC.rect(20 - slide, y + 10, 210, 1, 'rgba(255,255,255,0.12)');
      });
      if (t > 50) {
        icon('ic_coin', 20, 183, C.gold);
        SC.text('+' + Math.round(R.coins * clamp01((t - 50) / 20)), 38, 181, { scale: 2, color: C.gold });
        SC.text('COINS', 38 + SC.textWidth('+' + R.coins, 2) + 8, 185, { color: C.dim });
      }
      if (t > CD && R.streakBonus > 0) {
        icon('ic_flame', 20, 201, C.orange);
        SC.text('DAY ' + (R.streakDay || 1) + ' BONUS +' + R.streakBonus, 36, 203, { color: C.orange });
      }
      // right column: missions
      const mx = 262;
      SC.text('MISSIONS', mx, 12, { scale: 2, color: C.cyan });
      let my = 34;
      doneList().slice(0, 2).forEach((m, i) => {
        if (t < CD + i * 6) return;
        icon('ic_check', mx, my - 1, C.good);
        const rw = m.reward ? SC.textWidth('+' + m.reward, 1) + 6 : 0;
        SC.text(fitText(m.text || 'MISSION COMPLETE', 190 - rw, 1), mx + 15, my, { color: C.good });
        if (m.reward) SC.text('+' + m.reward, W - 18, my, { align: 'right', color: C.gold });
        my += 14;
      });
      missions().slice(0, 3).forEach(m => {
        const done = m.progress >= m.goal;
        SC.text(fitText(m.text || '', 190, 1), mx, my, { color: done ? C.good : '#ffffff' });
        my += 10;
        ui.bar(mx, my, 150, 5, m.goal ? m.progress / m.goal : 0, done ? C.good : C.cyan);
        SC.text(Math.min(m.progress, m.goal) + '/' + m.goal, W - 18, my - 2, { align: 'right', color: C.dim });
        my += 14;
      });
      let gy = Math.max(my + 4, 150);
      if (R.goal && R.goal.text) {
        SC.text('RUN GOAL', mx, gy, { color: C.cyan });
        icon(R.goal.done ? 'ic_check' : 'ic_target', mx, gy + 10, R.goal.done ? C.good : C.dim);
        SC.text(fitText(R.goal.text, 190, 1), mx + 15, gy + 13, { color: R.goal.done ? C.good : '#ffffff' });
        gy += 30;
      }
      const nk = nextSkin();
      if (nk) {
        const coins = store.get('coins', 0);
        SC.text('ONE MORE RUN', mx, gy, { color: C.cyan });
        SC.text(fitText('NEXT: ' + String(nk.name).toUpperCase() + ' ' + Math.min(coins, nk.price) + '/' + nk.price, 200, 1), mx, gy + 11, { color: '#ffffff' });
        ui.bar(mx, gy + 22, 200, 4, coins / nk.price, coins >= nk.price ? C.good : C.gold);
      }
      // buttons
      ui.band(222, 48, 'rgba(8,10,24,0.88)');
      const ok = skipFrame !== SC.frame && !going && rT >= 20;
      if (ui.button('retry', 14, 228, 106, 20, 'RETRY', { icon: 'ic_retry', color: C.gold, hotkey: 'retry' }) && ok) { going = true; SC.go('play', { mode: R.mode }); }
      if (ui.button('menu', 124, 228, 106, 20, 'MENU', { icon: 'ic_home', hotkey: 'back', silent: true }) && ok) { going = true; sfx('back'); SC.go('title', {}); }
      if (ui.button('share', 234, 228, 106, 20, 'SHARE', { icon: 'ic_share' }) && ok) shareCard();
      if (ui.button('board', 344, 228, 118, 20, 'RANKS', { icon: 'ic_trophy' }) && ok) { going = true; SC.go('leaderboard', {}); }
      let hx = 20;
      hx += ui.prompt(hx, 252, 'confirm', 'RETRY') + 14;
      ui.prompt(hx, 252, 'back', 'MENU');
      fxLayer();
    }
  });

  // ---------- TOUCH CONTROLS ----------
  const TC = {
    stickId: null, ox: 0, oy: 0, kx: 0, ky: 0, held: {}, pauseHeld: false,
    btns: [
      { a: 'dash', x: 436, y: 216, r: 22, ic: 'ic_bolt' },
      { a: 'parry', x: 384, y: 226, r: 18, ic: 'ic_shield' },
      { a: 'fire', x: 436, y: 162, r: 18, ic: 'ic_rocket' }
    ],
    pause: { x: 454, y: 6, s: 20 }
  };
  ui.touchControls = function () {
    const I = inp(), ts = I.touches || [], R_ = 28;
    const live = ts.filter(t => !t.released);
    // stick acquire / release
    if (TC.stickId != null && !live.some(t => t.id === TC.stickId)) { TC.stickId = null; TC.kx = TC.ky = 0; I.setStick(0, 0); }
    if (TC.stickId == null) {
      for (let i = 0; i < live.length; i++) {
        const t = live[i];
        if (t.pressed && t.startX < W / 2 && !inside(t.startX, t.startY, TC.pause.x, TC.pause.y, TC.pause.s, TC.pause.s)) {
          TC.stickId = t.id; TC.ox = t.startX; TC.oy = t.startY; break;
        }
      }
    }
    TC.kx = TC.ky = 0;
    if (TC.stickId != null) {
      const t = live.find(q => q.id === TC.stickId);
      if (t) {
        const dx = t.x - TC.ox, dy = t.y - TC.oy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 5) { const m = Math.min(1, (d - 5) / (R_ - 5)); TC.kx = dx / d * m; TC.ky = dy / d * m; }
      }
      I.setStick(TC.kx, TC.ky);
    }
    // action buttons
    TC.btns.forEach(b => {
      const down = live.some(t => t.id !== TC.stickId && dist(t.x, t.y, b.x, b.y) <= b.r + 8);
      if (down !== !!TC.held[b.a]) { TC.held[b.a] = down; I.setVirtual(b.a, down); }
      SC.circle(b.x, b.y, b.r, down ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.16)', true);
      SC.circle(b.x, b.y, b.r, 'rgba(255,255,255,0.55)', false);
      icon(b.ic, b.x - 5, b.y - 5, '#ffffff', 0.85);
    });
    // pause
    const pz = TC.pause;
    const pd = live.some(t => t.pressed && inside(t.x, t.y, pz.x, pz.y, pz.s, pz.s));
    if (pd !== TC.pauseHeld) { TC.pauseHeld = pd; I.setVirtual('pause', pd); }
    SC.rect(pz.x, pz.y, pz.s, pz.s, 'rgba(0,0,0,0.35)');
    icon('ic_pause', pz.x + 4, pz.y + 4, '#ffffff', 0.85);
    // stick visual
    const bx = TC.stickId != null ? TC.ox : 64, by = TC.stickId != null ? TC.oy : 206;
    SC.circle(bx, by, R_, TC.stickId != null ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)', false);
    SC.circle(bx + TC.kx * R_, by + TC.ky * R_, 10, TC.stickId != null ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.14)', true);
  };
})();
