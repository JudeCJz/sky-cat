# Sky Cat: Tank Topple - handoff (2026-11-13)

Read `.agents/skills/sky-cat/SKILL.md` (in the FREE WORK workspace) first, then this file.

## Live
- Repo (public): https://github.com/JudeCJz/sky-cat (branch main)
- Web play (GitHub Pages from main /): https://judecjz.github.io/sky-cat/
- Leaderboard Worker + web page: https://sky-cat-leaderboard.stickshot-signaling.workers.dev/
  (Cloudflare Worker `sky-cat-leaderboard`, D1 `sky_cat_lb`, deploy: `cd server && npx wrangler deploy`)
- Start Menu shortcut `Sky Cat` -> Edge `--app=... --start-fullscreen` on the local `dist/sky-cat.html`.

## Scope (user decisions, 2026-11-13)
- ONE mode: ENDLESS. Blitz, Daily, modes screen and all roguelite extras (shop, relics, sectors, perks) were cut
  at the user's request: "just make a simple endless runner with leaderboard". Do not re-add them.
- Ghost replay removed (user request). Only the "Ghost" cat skin uses that word.
- Kept/added: waves, boss every 5, 12-upgrade draft, combo, coins, missions, hangar cosmetics (9 cats, 13 hats,
  9 jet trails, 9 parry sticks), random start map + shuffled map order per run, curvy homing bazooka rockets,
  key remapping (Settings > Controls), fullscreen by default (+ Pixel Perfect setting), global leaderboard
  (in-game scene, name entry on first Play, rank on results; fallback name CAT#### if skipped).
- Audio toned down: master 0.6, sfx 0.55, music 0.14 (src/audio.js bus gains).

## Files
- `src/` engine, art, audio, net, ui, game, main. `index.html` loads them in that order.
- `tools/build.py` -> `dist/sky-cat.html` single file (rebuild after every change; the shortcut opens it).
- `tools/extract.js` + `tools/make.py` regenerate `assets/sky-cat.ico` from the cat sprite.
- `server/` Worker source, schema, README. `docs/CRITIQUE-1.md`, `docs/ROUND-2.md` (round 2 partly superseded).
- `original/` first prototype (reference only).

## Verified (browser pane, muted, driven by SC.stepFrame because the pane was hidden)
- All scenes load with zero console errors; god-mode bot to wave 14 with bosses, cosmetics equipped.
- Rockets: 6/6 hit, path bows 44-55 px off the straight line over ~200-265 px.
- Random start biome across runs; death -> results; hangar name readable.
- Live web build fetches the live leaderboard (status ok, empty board).
- Worker endpoints tested locally (validation, rate limit, rank) and the live /api/top + / respond.

## Not verified
- Real-time human play, audio levels by ear, a real score submit to the live board (avoided posting fake scores),
  fullscreen behaviour in a real window, touch on a phone, the Start Menu shortcut launch.

## Gotchas
- Browser caches src/*.js from python http.server: bust with
  `for (const f of ['engine','art','audio','net','ui','game','main']) await fetch('src/'+f+'.js',{cache:'reload'}); location.reload()`.
- Hidden browser pane = no requestAnimationFrame: drive with `SC.stepFrame()`. SCTEST exists only after a play scene
  starts and only with `?test` on localhost/file. `?test` disables networking unless `net` is also in the URL.
- Always test with `?mute`; clear `skycat2-` localStorage keys afterwards. Never submit test scores to the live board.
- Dev server: launch config `sky-cat` in `FREE WORK/.claude/launch.json` (port 8850).
- Pushing: commit in `sky-cat/`, `git push`; Pages redeploys automatically.
