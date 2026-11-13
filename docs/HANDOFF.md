# Sky Cat: Tank Topple - handoff (2026-11-13)

Read `.agents/skills/sky-cat/SKILL.md` first (design, file ownership, API contract, runbook).

## Where things are
- Game source: `sky-cat/src/` (engine, art, audio, ui, game, main). Dev page: `sky-cat/index.html`.
- Single-file build: `python sky-cat/tools/build.py` -> `sky-cat/dist/sky-cat.html` (double-click to play, works offline).
- Old prototype (moved from the earlier superkids-test goal folder): `sky-cat/original/` - reference only.
- Critique round 1 findings and who fixed what: `sky-cat/docs/CRITIQUE-1.md` (all items done).

## Icon and Start Menu
- Icon: `sky-cat/assets/sky-cat.ico` (16-256 px), `icon512.png`, `icon32.png` (pixel source). Built from the real
  ginger cat sprite by `tools/extract.js` + `tools/make.py` (run node extract.js art.js cat.json, then python make.py).
- Favicon is inlined as a data URI in `index.html` (so dist stays one file).
- Start Menu shortcut: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Sky Cat.lnk` -> Edge `--app=` window on
  `dist/sky-cat.html`. Rebuild dist after changes; the shortcut always opens the latest build.

## State
- Full game: boot, title (live mini-battle), hangar (9 skins), how to play (demo loops), settings, controls
  (key remapping, 2 keys per action, saved in store key `keys`), results with share card.
- Modes: Endless (waves, boss every 5, upgrade draft), Blitz (90 s), Daily (seeded by UTC date + modifier).
- Meta: coins, skins, 3 missions, daily streak bonus, run goal, SWIFT/REVENGE/COUNTER/SNIPE bonuses.
- Ghost replay feature REMOVED at user request (only the "Ghost" cat skin uses that word).

## Verified (2026-11-13, browser pane, muted, driven by SC.stepFrame because the pane was hidden)
- All scenes load with zero console errors; god-mode random-input bot ran 11000 frames to wave 16 with bosses,
  plus Blitz and Daily; death -> results works; controls screen renders; parry spectacle and stamp lanes checked.
- Subagents verified: key rebinding + persistence, touch virtual-button edges (node harness), fixed 60 Hz at 144 Hz.

## Not verified
- Real-time play by a human (feel, difficulty), actual audio/music (always tested muted), touch on a real phone,
  share card on a real device.

## Gotchas
- Browser cache: python http.server lets the browser cache src/*.js. After edits, in the pane run
  `for (const f of ['engine','art','audio','ui','game','main']) await fetch('src/'+f+'.js',{cache:'reload'}); location.reload()`.
- Hidden browser pane = no requestAnimationFrame. Drive with `SC.stepFrame()`; SCTEST exists only after a play scene
  starts and only with `?test` on localhost/file.
- Always test with `?mute`. Clear `skycat2-` localStorage keys after tests.
- Dev server: launch config `sky-cat` in `FREE WORK/.claude/launch.json` (port 8850).
- art.js was generated from parts in a temp scratchpad (may be gone); edit art.js directly now.
