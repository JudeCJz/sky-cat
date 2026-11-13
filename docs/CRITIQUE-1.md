# Critique round 1 - consolidated fix list

Sources: art/UI critic (V#), game-design critic (D#), code critic (C#). Each fixer owns ONE file set.
Cross-file contract additions for this round are at the bottom; follow them exactly.

## engine.js + main.js (fixer A)
- C1 CRITICAL: touch virtual buttons never fire. `setVirtual` is called in draw; `endInputFrame` clears `aPressed`
  before the next update. Add a pending set: in setVirtual, `if (down && !aDown[a]) vPend[a] = true`; at end of
  endInputFrame re-apply `aPressed[a] = true` for pending, then clear pending. Also make taps that start+end within
  one tick still register as a press for the pointer/touches (keep a pressed flag until consumed by one update).
- C11 / V20: no fixed timestep. Implement a fixed 60 Hz accumulator in the loop: run `scene.update()` once per 1/60 s
  of real time (max 4 steps per rAF, drop the rest), `SC.dt = 1` for each step, `SC.frame++` per step. draw once per
  rAF. Hitstop counts whole steps (integer). Input edges: pressed flags must be visible to exactly the first update
  step after the event (if zero steps run in a rAF, keep them). Keep `SC.stepFrame(dt)` working for harnesses
  (one update + draw).
- C10: remove the 7-gesture cap on audio unlock; call `SC.audio && SC.audio.unlock()` on every gesture (cheap).
- C17: add `SC.hasScene(name)`; main.js falls back to 'boot' for unknown `?scene=`.
- C14 helper: make sure `SC.store.clear()` also clears any in-memory cache.

## art.js (fixer B)
- V10 cat readability at 1x: stronger 1px dark outline (darker shade per skin, e.g. ginger '#8a3a1a'-like from PAL),
  eyes 2px tall with a clear dark pupil + 1px white highlight, ears 1-2px taller with pink inner ear, white
  muzzle/chest patch. Keep IDENTICAL masks across skins (outline shape unchanged across skins; it may change vs
  current as long as all skins match and CAT metadata is updated).
- V15 stick: wood-brown 3px shaft with highlight, cyan/white motion-smear crescent on frames 1-4, clearly visible.
- New sprite `'slash_big'` 5 frames ~96x96, anchor centre, bold crescent with dark outline (for the parry spectacle).
- V17 logo: TANK TOPPLE plate in deep blue with a 1px gold border; ear accent on the A as a proper triangle cat ear.
- V18 enemy projectiles ('shell', 'mortar', 'missile'): add 1px near-black outline and bright core so they pop on
  sky and grass. 'shell_p' the same with cyan.
- V19 ground strip: richer 3-row detail (stones, tufts, track marks, dithered darker band) per biome, 1px light top edge.
- V13 boss: enlarge to about 150x66 with more detail and armour plates; keep 3 hatches in `SC.art.enemies.boss.hatches`
  and update metadata (w, h, turret, barrelLen) accordingly.
- D23 economy: skin prices -> pastel 100, tabby 200 (others unchanged).
- New 11x11 icon `'ic_flame'` (streak) and `'ic_gift'` (daily bonus), stroke 'X' style.

## ui.js (fixer C)
- C3 HIGH: `drawCat` and hangar treat the cat sprite as top-left but its anchor is (14,12). Add `catSpr()` that adds the
  anchor; fix every cat draw (title, hangar, howto, settings). Flame at top-left + CAT.jet (mirrored when flipped).
- C5: howto demos draw anchored sprites (hatch_glow, explosion, explosion_big, smoke, rocket, warn) as top-left; pass
  anchor points.
- V1 CRITICAL hangar: remove the drawImage self-capture 3x upscale and the nested dark boxes. Draw the preview cat at
  1x crisply via an offscreen canvas re-drawn at integer scale 3 from the SPRITE (draw sprite onto a small offscreen at
  1x then drawImage that offscreen scaled x3 with smoothing off - this is allowed, it is crisp integer pixel scaling of a
  sprite, NOT a capture of the screen). No box behind it: a flat shadow under it. Flame attached properly.
- V2: hangar clutter. Remove the duplicate status line when the button says it; drop or fix the side silhouettes;
  button at y>=188; skin strip on a flat dark band.
- V3/V4 howto: no text overflow (wrap, keep inside 8..472 and above the BACK button); TOUCH line only when
  isTouch; the parry demo must actually show a shell flying in, stick swing, shell turning to shell_p and flying back
  with a slash + ring.
- V8 `ui.card`: remove the inner box rect; title scale 1 when it does not fit at 2; description white, wrapped 2-3
  lines; support `opts.level` text drawn at the bottom (e.g. 'LV 1 > 2'); card content vertically balanced.
- V9 title: non-focused buttons opaque fill, labels '#dfe6f5'; one flat translucent band behind the right stats and
  missions column; best numbers next to labels.
- V14 results: flat band behind the stat column and the missions column; brighter labels; coins at scale 2.
- V16 settings: icon/label spacing, wider buttons, RESET SAVE smaller and separated, remove the odd disc behind the cat.
- V23: raise C.dim to about '#b8c0dc'.
- V24 title: replace the sparse idle cat with a looping ~5 s scripted mini-battle (heavy fires, cat parries with stick,
  reflected shell blows up a light tank, cat dives on a hatch) using real sprites and SC.fx; ignore input.
- D24 results "one more run": show next cheapest unowned skin with progress bar ('NEXT: TABBY 120/200'), delta to best
  ('340 TO BEAT BEST' or 'NEW BEST'), Enter/Space on results = RETRY once count-up done; C12 only allow skip after 20 frames.
- Streak display: title shows `ic_flame` + 'DAY n' from store `streak` (see contract) and next-skin bar under coins.
- C14 eraseSave: also call SC.store.clear().
- C15/C16: mission text fitted to 150px when a reward is shown.
- C18: reset widget list per draw call, not per SC.frame.
- C21: wrap howto clip in try/finally.

## game.js (fixer D)
Bugs:
- C2 HIGH: bounce() must set `p.inv = max(p.inv, 24)` (bouncing never hurts).
- C4 HIGH: missions._act must persist its random fill; D2 dedupe missions by `ev`, wave-goal missions roll above the
  best wave stat (store in stats.bestWave); D20 cache missions in memory, write only on change; D15 combo mission goal
  x3, reward 55.
- C6: draft cards not clickable while paused; V5 do not draw banner/stamp while paused or in draft; stamps and banner
  in separate lanes (banner y~60, stamp y~150) and a higher-priority stamp (PERFECT) is not replaced by a lower one.
- C7 / D4: daily determinism. genQueue, spawn type/position and pickup rolls use streams seeded from
  SC.hash(date + '#w#' + wave) (and '#p#' for pickups) in daily mode.
- C8: use CAT.handFrames (parry/shoot per frame) when present, mirrored when flipped.
- C9 / D3: save best/daily/ghost/missions on pause QUIT/RESTART and on scene exit; bank coins incrementally at every
  wave clear (track run.bankedCoins, never double-bank).
- C13: magnetised coins that leave range fall again.
- C20: use sfx('explode_big') for big booms and boss death.
- D10 chain parry skips the enemy it came from; D11 regen max 1 stack; D12 parrywide max 2, +6; whiff parry cd 50,
  PERFECT also needs dist < 0.6 * radius; D13 fastshells 1.5 and cap 3.8; D14 stun shows hatch glow and cancels the
  telegraph (tele 0, cd >= 60); D17 rockets do not hit a not-ready boss and firing with no enemies costs no ammo;
  D18 blue tint while slow, remove dead slowMul; D21 draft pick guard 45 frames and ignore Space for 60 frames;
  D22 duck/pause music while paused (SC.music.duck with a long value, then restore by duck(0) or similar - check
  audio.js API and only use what exists).
- V25/D25: SCTEST only when SC.flags.test AND (location.protocol === 'file:' or hostname is localhost/127.0.0.1).
Feel and balance:
- D1 combo holds during clear/banner/draft and while no enemies are on screen at wave start; mult = 1 + 0.5*floor(combo/4) max 5.
- D5 input buffer 8 frames for dash/parry/fire; parry may cancel the last 3 dash frames.
- D6 hatch hit test uses padded rect {x-5,y-6,w+10,h+10}; dash collision substeps (2 per frame).
- D7 late-game scaling: shellSpeed term min(wave,22)*0.1, tele floor 28, alive cap min(11, 3+floor(wave/2)), heavy elite
  hp + floor((wave-12)/4), wave 15+ light tanks 25% 2-shot burst, wave 20+ elite heli 2 missiles.
- D8 onboarding: one hint at a time with stored flag `hints` ({dive, parry, rocket} done): DASH ONTO GLOWING HATCH until
  first dive; PARRY prompt with flashing ring when the first shell is within 70px, until first parry; ROCKET once after.
  Works on touch too (use SC.ui.prompt). Scripted wave 3 [light, light, heavy] and wave 4 [light, drone, drone, light,
  artillery]. First appearance of each enemy type shows a 90-frame banner subline (e.g. 'HEAVY: DIVE THE HATCH').
- D9 boss: hatch open 110 / closed 100, hp 60 +20 per later boss, phase 2 at 50% (speed x1.5, mortar count 6),
  V13 big 'WARNING' banner with red dither flash on spawn, HP bar with dark frame and name at scale 2, hatch glow always
  pulsing on the open hatch.
- D16 ghost every 6 frames, cap 4500 samples, store score per sample; HUD shows 'GHOST +N / -N'.
- D19 coin magnet 58 base; vacuum all coins at wave clear (D-feature 4) with rising coin pitch.
Spectacle (V6, V7):
- Parry: 2-frame screen-wide checker-dither darken first, rings thickness 6/5/4/3 with dark inner outline, stamp scale 5
  colour '#ffe14a' with dark shadow '#1a1226', 8-12 big white sparks, use 'slash_big' (fallback 'slash'), integer
  hitstop, stick drawn above the cat at full opacity for its whole swing.
- KO: explosion_big for heavy/artillery/boss, 6-8 smoke sprites, 10 debris, 2-frame white silhouette; score popup
  offset 34px above; cat drawn above debris. V21 popup shows just '+600' (stamp already says DIVE KO).
- V11 HUD: coins under the hearts row; dash/parry icons 13px with bottom-up cooldown fill and keycap letter; V12 hint
  band handled by D8; V22 pause darker (rgba(8,10,24,0.75)), keycap prompts.
New addictive features:
- F1 SWIFT bonus: beat par 1500 + n*60 frames -> score bonus (par - waveT)*2, +10 coins, SWIFT stamp.
- F2 trick bonuses: REVENGE (+250, parried shot kills), COUNTER (+300, dive KO within 20 frames after a parry),
  SNIPE (+150, rocket kills a telegraphing tank). Popup + small stamp.
- F3 daily streak: store `streak` = {n, last:'YYYY-MM-DD'}. On the first finished run of a UTC day: if last was
  yesterday n+1 else n=1; pay 20 + 10*min(n,10) coins, show 'DAY n BONUS' on results via params.streakBonus.
- F6 run goal: at run start roll one personal goal from stats (REACH WAVE bestWave+1 / BEAT score / NO DAMAGE WAVE 3),
  shown under the wave-1 banner; on success +25 coins and a stamp; pass params.goal {text, done} to results.

## Contract additions (round 1)
- `SC.hasScene(name)` (engine).
- art: `'slash_big'`, `'ic_flame'`, `'ic_gift'`; `SC.art.CAT.handFrames` already exists.
- store `streak` = `{n, last}` written by game.js, read by ui.js title/results.
- store `stats.bestWave` (number) maintained by game.js.
- results params gain optional `streakBonus` (coins, number), `streakDay` (n), `goal` ({text, done}),
  `bestBefore` (previous best score, for the delta line).
- `SC.ui.card(id, x, y, w, h, {title, desc, icon, accent, level})`.
