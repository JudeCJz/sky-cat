// Sky Cat global leaderboard - Cloudflare Worker (module) + D1.
'use strict';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const MODES = ['endless'];
const DAY = 'all';
const BLOCK = ['FUCK', 'SHIT', 'CUNT', 'BITCH', 'NIGGER', 'NIGGA', 'FAGGOT', 'RAPE', 'NAZI', 'HITLER', 'WHORE', 'SLUT', 'DICK', 'COCK', 'PUSSY', 'ASSHOLE'];
const RATE_MS = 8000;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS),
  });
}
function err(msg, status) { return json({ error: msg }, status || 400); }

function isInt(n) { return typeof n === 'number' && Number.isFinite(n); }

function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const n = raw.toUpperCase().trim();
  if (!/^[A-Z0-9 _-]{3,12}$/.test(n)) return null;
  const squashed = n.replace(/[^A-Z]/g, '');
  const alt = n.replace(/0/g, 'O').replace(/1/g, 'I').replace(/3/g, 'E').replace(/4/g, 'A').replace(/5/g, 'S').replace(/[^A-Z]/g, '');
  for (const b of BLOCK) if (squashed.includes(b) || alt.includes(b)) return null;
  return n;
}

async function rankOf(db, mode, day, score) {
  const r = await db.prepare('SELECT COUNT(*) AS c FROM scores WHERE mode = ?1 AND day = ?2 AND score > ?3').bind(mode, day, score).first();
  return (r ? r.c : 0) + 1;
}
async function totalOf(db, mode, day) {
  const r = await db.prepare('SELECT COUNT(*) AS c FROM scores WHERE mode = ?1 AND day = ?2').bind(mode, day).first();
  return r ? r.c : 0;
}

async function handleTop(url, env) {
  const q = url.searchParams;
  const mode = q.get('mode') || 'endless';
  if (!MODES.includes(mode)) return err('bad mode');
  const day = DAY;
  let limit = parseInt(q.get('limit') || '50', 10);
  if (!(limit >= 1)) limit = 50;
  if (limit > 100) limit = 100;
  const id = q.get('id');

  const rows = await env.DB.prepare(
    'SELECT name, score, wave, skin, ts FROM scores WHERE mode = ?1 AND day = ?2 ORDER BY score DESC, ts ASC LIMIT ?3'
  ).bind(mode, day, limit).all();
  const entries = (rows.results || []).map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, wave: r.wave, skin: r.skin, ts: r.ts }));
  // ties share the rank of the first equal score
  for (let i = 1; i < entries.length; i++) if (entries[i].score === entries[i - 1].score) entries[i].rank = entries[i - 1].rank;
  const total = await totalOf(env.DB, mode, day);
  let you = null;
  if (id && /^[a-z0-9-]{16,40}$/.test(id)) {
    const me = await env.DB.prepare('SELECT score FROM scores WHERE id = ?1 AND mode = ?2 AND day = ?3').bind(id, mode, day).first();
    if (me) you = { rank: await rankOf(env.DB, mode, day, me.score), score: me.score };
  }
  return json({ entries, total, you });
}

async function handleSubmit(request, env) {
  let b;
  try { b = await request.json(); } catch (e) { return err('bad json'); }
  if (!b || typeof b !== 'object') return err('bad body');
  const id = b.id;
  if (typeof id !== 'string' || !/^[a-z0-9-]{16,40}$/.test(id)) return err('bad id');
  const name = cleanName(b.name);
  if (!name) return err('bad name');
  const mode = b.mode;
  if (!MODES.includes(mode)) return err('bad mode');
  const day = DAY;
  const score = b.score, wave = b.wave;
  if (!isInt(score) || score < 0 || score > 5000000) return err('bad score');
  if (!isInt(wave) || wave < 0 || wave > 1000) return err('bad wave');
  if (score > Math.floor(wave) * 60000 + 50000) return err('score too high for wave');
  const time = isInt(b.time) ? b.time : -1;
  if (time < 5 || time > 86400) return err('bad time');
  const kos = isInt(b.kos) && b.kos >= 0 && b.kos <= 100000 ? Math.floor(b.kos) : 0;
  const skin = typeof b.skin === 'string' && /^[a-z0-9_]{1,16}$/.test(b.skin) ? b.skin : 'ginger';

  const now = Date.now();
  // rate limit via D1
  const last = await env.DB.prepare('SELECT ts FROM rate WHERE id = ?1').bind(id).first();
  if (last && now - last.ts < RATE_MS) return err('too fast', 429);
  await env.DB.prepare('INSERT INTO rate (id, ts) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET ts = ?2').bind(id, now).run();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rate WHERE ts < ?1').bind(now - 3600000).run();

  // best per (id, mode, day); name and skin are always refreshed
  await env.DB.prepare(
    'INSERT INTO scores (id, mode, day, name, score, wave, kos, time, skin, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ' +
    'ON CONFLICT(id, mode, day) DO UPDATE SET ' +
    'name = ?4, skin = ?9, ' +
    'wave = CASE WHEN ?5 > score THEN ?6 ELSE wave END, ' +
    'kos = CASE WHEN ?5 > score THEN ?7 ELSE kos END, ' +
    'time = CASE WHEN ?5 > score THEN ?8 ELSE time END, ' +
    'ts = CASE WHEN ?5 > score THEN ?10 ELSE ts END, ' +
    'score = MAX(score, ?5)'
  ).bind(id, mode, day, name, Math.floor(score), Math.floor(wave), kos, Math.floor(time), skin, now).run();

  const me = await env.DB.prepare('SELECT score FROM scores WHERE id = ?1 AND mode = ?2 AND day = ?3').bind(id, mode, day).first();
  const best = me ? me.score : Math.floor(score);
  return json({ rank: await rankOf(env.DB, mode, day, best), total: await totalOf(env.DB, mode, day), best });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname === '/' && request.method === 'GET') {
        return new Response(PAGE, { headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }, CORS) });
      }
      if (url.pathname === '/api/top' && request.method === 'GET') return await handleTop(url, env);
      if (url.pathname === '/api/submit' && request.method === 'POST') return await handleSubmit(request, env);
      return err('not found', 404);
    } catch (e) {
      return err('server error', 500);
    }
  },
};

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SKY CAT GLOBAL LEADERBOARD</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
<style>
:root{--bg:#10121f;--ink:#e8ecff;--dim:#7a82a8;--acc:#4de8ff;--gold:#ffd23f;--line:#262a45}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Press Start 2P','Courier New',monospace;font-size:11px;line-height:1.6;image-rendering:pixelated}
main{max-width:760px;margin:0 auto;padding:24px 14px 40px}
h1{font-size:18px;color:var(--gold);text-align:center;margin:8px 0 6px;text-shadow:2px 2px 0 #000;letter-spacing:1px}
.sub{text-align:center;color:var(--dim);margin-bottom:18px;font-size:9px}
nav{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}
nav button,.play{font:inherit;font-size:11px;color:var(--ink);background:#1a1d33;border:0;border-bottom:3px solid #000;padding:10px 14px;cursor:pointer;text-decoration:none;display:inline-block}
nav button.on{background:var(--acc);color:#001018}
.play{background:var(--gold);color:#201400}
.bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;color:var(--dim);font-size:9px}
table{width:100%;border-collapse:collapse}
th{color:var(--dim);font-weight:normal;text-align:left;font-size:9px;padding:6px 6px;border-bottom:2px solid var(--line)}
td{padding:7px 6px;border-bottom:1px solid var(--line);font-size:10px}
td.n,th.n{text-align:right}
tr.top1 td{color:var(--gold)} tr.top2 td{color:#d8dcef} tr.top3 td{color:#e0925a}
tr.me td{background:#16304a}
.msg{text-align:center;color:var(--dim);padding:28px 0}
@media(max-width:520px){h1{font-size:13px}td,th{padding:6px 3px;font-size:8px}.hide{display:none}}
</style></head><body><main>
<h1>SKY CAT GLOBAL LEADERBOARD</h1>
<div class="sub">TANK TOPPLE - ENDLESS</div>
<nav>
<a class="play" href="https://judecjz.github.io/sky-cat/">PLAY</a>
</nav>
<div class="bar"><span id="info"></span><span id="status"></span></div>
<table><thead><tr><th class="n">#</th><th>NAME</th><th class="n">SCORE</th><th class="n hide">WAVE</th><th class="n hide">DATE</th></tr></thead><tbody id="rows"></tbody></table>
<div class="msg" id="msg">LOADING</div>
</main>
<script>
(function(){
var mode='endless';
var rows=document.getElementById('rows'),msg=document.getElementById('msg'),info=document.getElementById('info'),status=document.getElementById('status');
var MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return MAP[c]})}
function load(){
  info.textContent='ALL TIME';
  var u='/api/top?mode='+mode+'&limit=50';
  fetch(u).then(function(r){return r.json()}).then(function(d){
    var h='';
    (d.entries||[]).forEach(function(e){
      var cls=e.rank<=3?'top'+e.rank:'';
      h+='<tr class="'+cls+'"><td class="n">'+e.rank+'</td><td>'+esc(e.name)+'</td><td class="n">'+e.score+'</td><td class="n hide">'+e.wave+'</td><td class="n hide">'+new Date(e.ts).toISOString().slice(5,10)+'</td></tr>';
    });
    rows.innerHTML=h;
    msg.textContent=(d.entries&&d.entries.length)?'':'NO SCORES YET';
    status.textContent=d.total+' PLAYERS';
  }).catch(function(){status.textContent='OFFLINE';msg.textContent='';});
}
load();setInterval(load,30000);
})();
</script></body></html>`;
