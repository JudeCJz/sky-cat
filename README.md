# Sky Cat: Tank Topple

A pixel-art arcade game: a jetpack cat versus tanks. Dive onto glowing hatches, parry shells back with a stick,
fire curving bazooka rockets, and see how far you get in one endless run. Global leaderboard included.

- Play in your browser: https://judecjz.github.io/sky-cat/
- Global leaderboard: https://sky-cat-leaderboard.stickshot-signaling.workers.dev/
- Offline single file: `dist/sky-cat.html` (download and open it; the leaderboard needs internet)

Everything is drawn in code as pixel grids and every sound is synthesized - no image or audio files.

## How to play

| Action | Default keys |
|---|---|
| Move | Arrows / WASD |
| Dash (dive onto a glowing hatch for an instant KO) | Space |
| Parry (swing the stick to send shells back) | E / K |
| Bazooka (curving homing rocket, limited ammo) | F / J |
| Pause | Esc / P |
| Retry | R |

All keys can be remapped in Settings > Controls. Touch controls appear automatically on phones.

**Endless** is the only mode: waves of tanks, helicopters and drones, a boss every 5th wave, pick 1 of 3 upgrades
after each wave, combo multiplier up to x5. Every run starts on a random map and shuffles the map order.
Coins from KOs buy cats, hats, jet trails and parry sticks in the Hangar. Your best score goes to the global
leaderboard when you die (set your name the first time you press Play).

## Project layout

```
index.html        dev page (loads src/*.js in order)
src/engine.js     canvas, loop, input, sprites + pixel masks, text, effects, storage
src/art.js        all pixel art (sprites, cosmetics, backgrounds)
src/audio.js      synthesized sound effects and chiptune music
src/net.js        global leaderboard client
src/ui.js         menus, hangar, leaderboard, settings, results
src/game.js       gameplay
src/main.js       boot
tools/build.py    builds dist/sky-cat.html (single file)
server/           Cloudflare Worker + D1 leaderboard (see server/README.md)
assets/           app icon
original/         the first prototype, kept for reference
```

## Build

```bash
python tools/build.py
```

Run locally with any static server from this folder, for example `python -m http.server 8850`, then open
http://localhost:8850/ . Add `?mute` to the URL to silence audio.
