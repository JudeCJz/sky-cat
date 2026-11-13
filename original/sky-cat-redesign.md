# Sky Cat: Tank Trouble — redesign plan

## Goal and constraints

Redesign the existing standalone `index.html` pixel-art game so it is no longer a Flappy Bird-style flap-through-gaps clone. Preserve the flying cat and military-tank chase premise, deliver all requested feature ideas, keep the project self-contained in one HTML file, and make collision hitboxes closely follow the visible pixel-art shapes. This is a plan only; no game code has been changed.

## Proposed new core game: Sky Cat's Tank Topple

Replace the one-button flap-and-pass loop with a small horizontal action arena. The cat is freely steered in two dimensions; tanks pursue from below, while the player dodges aimed projectiles, collects energy, and chooses moments to dive through weak points and stun/topple tanks. Give the player a short dash with cooldown and a visible charge meter. Success is based on surviving and disabling pursuing tanks, not threading through repeated vertical gates. Distinct movement, enemy behavior, and an offensive objective should make the game recognizably different from Flappy Bird. Keep keyboard and touch input usable: arrow/WASD movement, Space/dedicated on-screen dash, and pointer/touch directional control.

## Features and implementation plan

All expected code is in `index.html`; there are no routes, packages, or other project files. Keep artwork pixelated and the game launchable by opening the single HTML file.

1. **New combat-and-evasion gameplay (core redesign)**
   - Behavior: replace flap physics, periodic pipe-like obstacles, and gap scoring with two-axis movement, pursuing tanks, telegraphed shots, a dash, and a tank-disabling objective. Add health/energy and a clear win/loss loop.
   - Anchors: replace game state and cat object at lines 32–33; replace `flap`, `reset`, `update`, `spawn`, `hit`, input listeners, overlays, and rendering at lines 63–89; extend pixel-art functions around lines 35–53.
   - Approach: structure state around player, enemy tanks/projectiles, pickups, active effects, score, timer, and run status. Keep canvas pixel art. Derive speed/steering from input rather than gravity/flap. Use explicit telegraph-before-shot behavior so attacks are readable.
   - Verification: play with keyboard and touch; confirm movement in all directions, dash cooldown, attacks and collisions; confirm a run can end and restart and no old gap/flap loop remains.

2. **Accurate pixel-art hitboxes**
   - Behavior: collisions should match opaque drawn pixels for the cat, tank, projectiles, and pickups rather than using oversized rectangular approximations; visibly non-touching pixels must not cause a hit.
   - Anchors: replace `hit` at line 66; review `pixelCat`, `tank`, and all relevant drawing dimensions at lines 35–53; wire collision checks in the replacement update loop.
   - Approach: author compact per-sprite binary collision masks alongside the pixel-art sprite definitions and test overlap in world coordinates using those masks. Account for sprite animation/frame and scaling; use a simpler circle/rect only for genuinely round/simple projectiles. Keep drawing and masks sourced from the same sprite-grid data to avoid drift.
   - Verification: test edge/corner near misses and clear overlaps for each relevant sprite; verify animated cat frames use their corresponding masks and collision does not change with CSS canvas scaling.

3. **Temporary power-ups**
   - Behavior: collect visible pickups for brief shield, dash recharge, or slow-time / score multiplier effects; show an icon/timer and clear expiration feedback.
   - Anchors: state and rendering near lines 32, 67–83; replace obstacle spawning/update with enemy and pickup logic.
   - Approach: define effect type, duration, collection collision mask, HUD indicator, and clear balance rules. Inspired by the five pickup effects described for Chromium Dino's Early Access listing ([Steam listing](https://store.steampowered.com/app/4475440/Chromium_Dino/), release date shown as 2026-06-09).
   - Verification: collect every effect, confirm each changes play, duration expires, and effects cannot remain stuck after restart.

4. **Unlockable and selectable pixel cat skins**
   - Behavior: earn cosmetic skins through score/tank milestones and select them in a simple menu; persist unlocked/selected choices locally.
   - Anchors: `pixelCat` lines 35–46; initialization/local storage line 32; page shell and overlays lines 19–24, 79–85.
   - Approach: define palette/sprite variants from the same pixel-art grid and mask geometry, add a compact title/pause selection panel, and persist owned IDs. Keep hitboxes consistent across cosmetic palettes.
   - Verification: unlock, select, reload, and play each skin; ensure cosmetic differences do not alter gameplay hitboxes. Chromium Dino lists six skins ([Steam listing](https://store.steampowered.com/app/4475440/Chromium_Dino/), 2026-06-09).

5. **Daily challenge**
   - Behavior: a date-based seeded mission (for example, disable a target number of tanks under a fixed modifier) gives all players that day the same challenge; local completion/best is saved.
   - Anchors: initialization at line 32; spawn/update/game status around lines 63–75; overlays lines 79–85.
   - Approach: derive a stable seed from UTC date, use a deterministic PRNG for challenge enemy/pickup sequence, display the goal and completion, and key saved records by date. No server is required; do not claim a global leaderboard.
   - Verification: same date yields the same sequence after reload; simulated next day creates a new challenge; completion and best persist locally. Chromium Dino listing describes daily challenges ([Steam listing](https://store.steampowered.com/app/4475440/Chromium_Dino/), 2026-06-09).

6. **Best-run ghost/replay**
   - Behavior: show a translucent replay of the player's best run for comparison while attempting a new run.
   - Anchors: local best initialization and save at line 32 and line 72–75; update/draw lines 67–85.
   - Approach: record compact time-stamped player positions/actions for the best run in local storage, replay with a distinct translucent palette, cap stored samples, and handle old numeric-only best data safely. Chromium Dino listing describes ghost race mode ([Steam listing](https://store.steampowered.com/app/4475440/Chromium_Dino/), 2026-06-09).
   - Verification: finish a record run, restart, confirm deterministic ghost playback; beat it and verify replacement; clear/corrupt saved replay and confirm graceful fallback.

7. **Biome progression and day/night cycle**
   - Behavior: scenery/palette changes as a run progresses across several pixel-art environments, with gradual day/night lighting variation.
   - Anchors: `drawBackground` lines 55–62; score/state and render loop lines 32, 80–85.
   - Approach: create hand-authored pixel palettes and parallax layers; change biome on clear gameplay milestones, interpolate a restrained day/night palette, and preserve contrast for hazards and sprites. Chromium Dino listing describes five biomes and a day/night cycle ([Steam listing](https://store.steampowered.com/app/4475440/Chromium_Dino/), 2026-06-09).
   - Verification: reach every biome transition; check tank/projectile readability in each palette and ensure transitions do not affect collision.

8. **Shareable score/challenge card**
   - Behavior: after a run or daily challenge, create a pixel-art result card with result, score, date/mode, and a share action; allow copy/download fallback.
   - Anchors: canvas and page markup lines 19–24; results overlay lines 79–85; finish-state update logic.
   - Approach: render card to an offscreen canvas, export via `HTMLCanvasElement.toBlob()`, use `navigator.share()` only after a user gesture when supported, and otherwise download/copy a concise result. References: [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API), [canvas `toBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob). Browser support and secure-context requirements must be feature-detected.
   - Verification: exercise supported native share path and unsupported fallback; confirm exported image includes correct result and remains legible.

9. **Optional sound and vibration feedback**
   - Behavior: toggleable pixel-arcade sounds for dash, pickup, hit, and victory; brief vibration on supported mobile devices.
   - Anchors: page controls lines 19–24; input and state transitions around lines 64–75; initialization at line 32.
   - Approach: synthesize short tones/noise with Web Audio only after user gesture; keep a visible mute toggle and respect saved preference. Feature-detect `navigator.vibrate()` and use short, limited pulses only; no external audio assets required. Reference: [Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API).
   - Verification: play with sound on/off, confirm no audio starts before user interaction, and check vibration is optional/no-op when unsupported.

10. **Alternate timed challenge mode**
   - Behavior: selectable short mode (for example, 60 seconds to disable as many tanks as possible) alongside the primary survival/chase mode.
   - Anchors: game state and score line 32; setup/reset and update lines 63–77; screens and controls lines 79–89.
   - Approach: share combat systems but keep independent mode rules, timers, score criteria, and best records; include clear mode selection and results. Chromium Dino listing reports multiple modes ([Steam listing](https://store.steampowered.com/app/4475440/Chromium_Dino/), 2026-06-09).
   - Verification: start both modes, confirm objectives/timers and records remain distinct, and confirm restart returns to selected mode.

## Order of work

1. Replace the Flappy-like core loop with the new arena controls, enemy behavior, dash, and objective.
2. Establish sprite-grid data and exact pixel collision masks; verify movement/combat edge cases.
3. Add mode selection and the timed mode, then power-ups and the new HUD.
4. Add daily seed/records and best-run ghost storage/playback.
5. Add cosmetics and unlock menu.
6. Add biome/day-night visuals, sound/vibration preferences, then share card.
7. Run focused checks, and manually exercise the game in-browser at keyboard and touch sizes.

## Workspace/tool limitations

The requested `enter_plan` / `exit_plan` and `steroids` tools were not available in this session. This file was written as the plan artifact without entering a tool-managed plan mode. No external peer source-code inspection was possible; comparisons above are based on the linked Steam product listing and browser API documentation. Research agents could not verify fresh demand signals; Steam's listing date is explicit, while the MDN references' page dates were not surfaced. Do not treat undated API docs or genre patterns as proof of recent demand.

## Approval gate

Do not implement until the user reviews and approves this plan.
