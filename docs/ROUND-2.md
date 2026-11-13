# Round 2 - global leaderboard, fullscreen (SCOPE CUT)

> SCOPE CUT by the user (2026-11-13): "just make a simple endless runner with leaderboard, I don't want any other
> mode, just simple, and tone down the music". What is IN: one ENDLESS mode only (the round-1 game: waves, bosses,
> 12-upgrade draft, combo, coins, missions, cat skins), global ENDLESS leaderboard (web page + in-game scene + name
> entry + rank on results), fullscreen by default + pixelPerfect setting, hangar screenshot bug fixes, quieter audio
> (master 0.6, sfx 0.55, music 0.14). What is OUT (ignore those sections below): Blitz, Daily, modes screen,
> rarity/rerolls/curses, scrap/shop, relics, sectors, workshop perks, revive, new upgrades, hats/trails/sticks.

# Original round-2 plan (partly superseded, see above)

User request (2026-11-13): default full screen, more hangar items, make it a roguelite with more stuff, a global
leaderboard (web + in game), push everything to GitHub (public repo JudeCJz/sky-cat + GitHub Pages), define each mode.
All base rules from `.agents/skills/sky-cat/SKILL.md` still apply (pixel art only, no emojis, flat UI, test with ?mute).
Exception: `fetch` is now allowed ONLY inside `src/net.js` for the optional leaderboard. The game must work fully
offline / from file:// with the leaderboard simply showing OFFLINE.

## Load order
engine, art, audio, net (NEW), ui, game, main. `index.html` and `tools/build.py` must include `src/net.js` (ui owner).

## Game modes (final definitions - show these in game)
- ENDLESS - "ROGUELITE RUN". The main mode. Fight waves; after each wave draft 1 of 3 upgrades (with rarities and
  rerolls); a SCRAP SHOP after every 3rd wave; a BOSS every 5th wave that drops a RELIC (pick 1 of 2) and then you
  choose your next SECTOR route (pick 1 of 2). One life (plus a revive if bought). WORKSHOP perks apply.
  Leaderboard: all-time, by score.
- BLITZ - "90 SECOND SCORE ATTACK". Constant spawns, no drafts, no shop, no relics, no workshop perks (fair).
  Leaderboard: all-time, by score.
- DAILY - "SAME RUN FOR EVERYONE TODAY". Seeded by UTC date with a fixed daily modifier; roguelite like ENDLESS
  (drafts, shop, relics, routes, all seeded) but workshop perks are OFF so everyone is equal. Leaderboard: per day.

## Roguelite systems (game.js)
- Rarity on upgrades: common / rare / epic (card accent: common '#b8c0dc', rare '#4de8ff', epic '#c46bff').
  Odds by wave: epic 4% + 0.8%/wave (max 20%), rare 22% + 1%/wave (max 40%).
- New upgrade ids (keep the 12 existing): `ricochet` (reflected shots bounce to one more enemy), `overdrive` (KO
  refunds 50% of dash cooldown), `vampire` (heal 1 every 20 KOs), `barrage` (successful parry fires 3 shard shots),
  `magnum` (rockets +1 damage, bigger blast), `scavenger` (+50% scrap), `shockwave` (dive KO emits a ring that
  damages enemies within 50px), `frenzy` (at x3+ multiplier move speed +15% and dash cd -15%).
  Rarity: common = maxhp dashcd parrywide ammo splash magnet combo shield scavenger; rare = twin chain thorns
  ricochet overdrive shockwave magnum; epic = regen barrage vampire frenzy.
- REROLL: draft shows a REROLL button when rerolls > 0 (base 0 in endless + workshop perk; daily gets 1 seeded).
- CURSED CARDS: 15% chance (from wave 4) that one draft card is a cursed deal: a strong boon + a drawback, shown with
  a red accent and 'CURSED' label. Ids: `c_glass` (score x1.5 for the run, max hp -1), `c_berserk` (dash cd -40%,
  enemies shoot 20% faster), `c_greed` (scrap and coins x2, no more heart pickups).
- SCRAP: in-run currency (HUD icon `ic_scrap`). Drops: light 2, drone 1, heli 3, artillery 4, heavy 5, boss 30.
- SCRAP SHOP: after the draft of every 3rd wave (3, 6, 9...) a shop phase: 4 offers drawn from
  heal 1 (25), +2 max ammo for the run (40), random rare upgrade (70), random epic upgrade (120), reroll token (20),
  shield charge (30). Buy with SC.ui.card / buttons, LEAVE button. Scrap is lost at run end.
- RELICS (boss reward, pick 1 of 2, 3 with perk `relic`): `iron_hide` (+2 max hp), `twin_jets` (2 dash charges),
  `mirror` (parry radius x1.5), `warhead` (rocket damage x2), `lucky_paw` (pickups twice as often), `time_bell`
  (successful parry slows enemies for 60 frames), `war_drum` (combo never decays below 4), `golden_whisker`
  (+50% coins this run). Relics show as a row of 15x15 icons on the HUD under the ability icons.
- SECTOR ROUTE (after the relic pick): choose 1 of 2 sector cards for the next 5 waves:
  `armored` (more heavies and artillery, +30% scrap), `airspace` (more helis and drones, +rare odds),
  `scrapyard` (normal mix, shop offers 5 items), `blitzkrieg` (+25% enemy count, score x1.25),
  `calm` (-20% enemies, heal 1 now). The next biome follows the existing biome order.
- Results params gain `relics` (array of ids), `upgrades` ({id: lv}), `sector` names list, `scrap` total earned.
- Persist `stats.runs`, `stats.bestWave`, plus `stats.bossKills`.

## Workshop perks (permanent, bought with coins, apply to ENDLESS only)
Defined in game.js as `SC.perks = [{id, name, desc, icon, max, cost:[...]}]`, levels in store `perks` ({id: lv}).
ui.js reads `SC.perks` at runtime for the WORKSHOP tab and buys by deducting `coins` and writing `perks`.
- `hp` START HP +1 (max 2: 300, 800) / `ammo` START ROCKETS +1 (max 2: 250, 600) / `reroll` +1 REROLL PER RUN
  (max 3: 200, 500, 1000) / `coins` +10% COINS (max 3: 300, 700, 1500) / `relic` RELIC CHOICE +1 (max 1: 1200) /
  `start` START WITH A COMMON UPGRADE (max 1: 600) / `revive` ONE REVIVE PER RUN (max 1: 2000) /
  `scrap` +20% SCRAP (max 2: 300, 800). Icons `pk_<id>` (art).

## Hangar items (art.js defines, ui.js shows/buys, game.js draws)
- Cats: existing `SC.art.skins`, store `skins_owned`, `skin` (unchanged).
- HATS: `SC.art.hats = [{id, name, price}]` ids: `none`(0) `cap`(80) `beanie`(120) `bow`(150) `headphones`(250)
  `propeller`(400) `tophat`(600) `viking`(900) `crown`(1500). Sprite `'hat_' + id` 1 frame (max 16x12) with anchor at
  its bottom-centre. `SC.art.CAT.head` = array of `{x, y}` per cat frame (17 entries): the point on the top of the
  head where a hat sits (relative to sprite top-left). When the cat is flipped mirror x as `w - 1 - x`.
  Store `hats_owned` (default ['none']), `hat` (default 'none').
- TRAILS (jet flame): `SC.art.trails = [{id, name, price, particles:[colors]}]` ids: `classic`(0) `plasma`(150)
  `toxic`(250) `ember`(350) `rainbow`(800) `void`(1200). Sprite `'jetflame_' + id` 4 frames, same size and anchor as
  `'jetflame'` (keep `'jetflame'` = classic). Store `trails_owned` (default ['classic']), `trail`.
- STICKS (parry weapon): `SC.art.sticks = [{id, name, price}]` ids: `branch`(0) `bat`(150) `umbrella`(300)
  `baguette`(450) `fish`(700) `laser`(1500). Sprite `'stick_' + id` 6 frames, same size and anchor as `'stick'`
  (keep `'stick'` = branch). Store `sticks_owned` (default ['branch']), `stick`.
- Cosmetics are visual only. game.js and ui.js draw the equipped hat/trail/stick everywhere the cat appears.

## New art (art.js)
Hats, trails, sticks above; `CAT.head`; icons 11x11 stroke 'X': `ic_globe ic_crown ic_list ic_scrap ic_relic ic_shop
ic_dice ic_route ic_fullscreen ic_user ic_wrench ic_hat ic_stick ic_trail ic_cat`; 15x15 coloured: `up_<id>` for the 8
new upgrades and 3 curses, `rl_<id>` for the 8 relics, `pk_<id>` for the 8 perks, `sc_<id>` for the 5 sectors.

## Engine + UI (engine.js, ui.js, index.html, build.py)
- FULLSCREEN by default: store `fullscreen` (default true). Engine requests fullscreen on the first user gesture
  when the setting is on (and after leaving it, on the next gesture only if the user did not exit on purpose: if the
  user exits fullscreen with Esc/F11, set a session flag and do not re-request until they toggle it in settings).
  `SC.fullscreen = {active, toggle(), set(bool)}`. Scaling: store `pixelPerfect` (default false): false = scale to
  fill the window keeping 16:9 aspect (fractional scale allowed, still nearest-neighbour), true = integer scale.
- Text input for names: `SC.input.text = {start(maxLen, cb), stop(), active}`; while active printable keys
  (A-Z 0-9 space - _) and Backspace/Enter go to the text handler, not to actions.
- Scenes:
  - Title: PLAY button opens `'modes'`; add LEADERBOARD button; keep HANGAR, HOW TO PLAY, SETTINGS.
  - `'modes'`: three big flat columns ENDLESS / BLITZ / DAILY with the definitions above (2-3 short lines each),
    your best, your global rank if known (SC.net), and today's modifier for DAILY. Pick starts the run.
  - `'leaderboard'`: tabs ENDLESS / BLITZ / DAILY(today), top 50 (scroll with up/down or wheel/drag), rows: rank,
    name, score, wave, skin icon; your row highlighted; status line (LOADING / OFFLINE / YOUR RANK #n); CHANGE NAME.
  - `'name'`: pixel name entry (physical keyboard via SC.input.text + an on-screen pixel keyboard for mouse/touch),
    3-12 chars A-Z 0-9 - _ ; saved through `SC.net.setName`. Shown automatically before the first submit if no name.
  - Hangar: tabs CATS / HATS / TRAILS / STICKS / WORKSHOP. Preview cat shows everything equipped. WORKSHOP lists
    `SC.perks` with level pips, cost, BUY. Fix from screenshot: the lock icon is drawn ON TOP of the preview cat (move it
    beside the price), the 'LEFT/RIGHT BROWSE' keycap text overflows its cap (keycap must size to its label), and
    the skin name renders with a broken glyph at scale 3 (check the font/shadow for 'R').
  - Results: show GLOBAL RANK (after submit resolves: 'GLOBAL #12 OF 340', or OFFLINE), relics row, LEADERBOARD button.
  - Settings: FULLSCREEN toggle, PIXEL PERFECT toggle, PLAYER NAME (opens 'name').

## Network (src/net.js + server/)
- Cloudflare Worker `sky-cat-leaderboard` with D1 database `sky_cat_lb`, deployed with `npx wrangler deploy` from
  `sky-cat/server` (user is logged in to wrangler on this PC). CORS `*`.
- API: `GET /api/top?mode=endless|blitz|daily&day=YYYY-MM-DD&limit=50&id=<playerId>` ->
  `{entries:[{rank,name,score,wave,skin,ts}], total, you:{rank,score}|null}` (best score per player per mode/day).
  `POST /api/submit` JSON `{id, name, mode, day, score, wave, kos, time, skin, v}` -> `{rank, total, best}`.
  Validation: id = 16-40 chars [a-z0-9-]; name 3-12 [A-Z0-9 _-] uppercased, simple blocklist; mode enum; day must be
  today or yesterday UTC for daily; score 0..5,000,000 and score <= wave*60000+50000; time >= 5 s; rate limit
  1 submit per 8 s per id (D1 check). Keep best per (id, mode, day).
- `GET /` serves a self-contained leaderboard web page (pixel style, dark, mode tabs, auto refresh) - no external
  scripts; fonts may come from Google Fonts.
- `src/net.js`: `SC.net = { url, id, status ('idle'|'loading'|'ok'|'offline'), getName(), setName(n), hasName(),
  submit({mode, score, wave, kos, time, day}) -> Promise<{rank,total,best}|null>, top(mode, day) ->
  Promise<{entries,total,you}|null>, myRank(mode) cached }`. 5 s timeouts, never throws, caches last results in memory,
  player id = random uuid in store `lb_id`, name in store `lb_name`. URL constant in net.js (worker URL after deploy).
  No network at all when `SC.flags.test` unless `SC.flags.net` (`?net`).
- game.js calls `SC.net && SC.net.submit(...)` once at run end (not for quits), and passes the promise result into
  results via params `rank` (a Promise or null); ui results awaits it.
