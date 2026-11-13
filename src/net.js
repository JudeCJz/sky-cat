// Optional global leaderboard client. The only file allowed to use fetch.
// The game works fully offline: every call resolves to null on any failure.
(function () {
  'use strict';
  const SC = window.SC;

  const DEFAULT_URL = 'https://sky-cat-leaderboard.stickshot-signaling.workers.dev';
  const TIMEOUT = 5000;

  function qs() {
    try { return (location.search || '') + (location.hash || ''); } catch (e) { return ''; }
  }
  const q = qs();
  let url = DEFAULT_URL;
  const m = /[?&]lb=([^&#]+)/.exec(q);
  if (m) { try { url = decodeURIComponent(m[1]).replace(/\/+$/, ''); } catch (e) {} }

  const flags = SC.flags || {};
  const enabled = !flags.test || /net/.test(q);
  if (flags.test && enabled) flags.net = true;

  function uuid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    let s = '';
    for (let i = 0; i < 32; i++) {
      if (i === 8 || i === 12 || i === 16 || i === 20) s += '-';
      s += Math.floor(Math.random() * 16).toString(16);
    }
    return s;
  }

  let id = SC.store.get('lb_id', null);
  if (typeof id !== 'string' || !/^[a-z0-9-]{16,40}$/.test(id)) {
    id = uuid();
    SC.store.set('lb_id', id);
  }

  const cache = {};
  const net = {
    url: url,
    id: id,
    status: 'idle',
    getName() { const n = SC.store.get('lb_name', ''); return typeof n === 'string' ? n : ''; },
    setName(n) {
      n = String(n || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 12);
      SC.store.set('lb_name', n);
      return n;
    },
    hasName() { return /^[A-Z0-9 _-]{3,12}$/.test(net.getName()); },
    myRank(mode) { const c = cache[mode || 'endless']; return c && c.you ? c.you.rank : null; },
    cache: cache,
  };

  function request(path, opts) {
    if (!enabled || typeof fetch !== 'function') { net.status = 'offline'; return Promise.resolve(null); }
    let ctl = null, timer = null;
    try {
      ctl = new AbortController();
      timer = setTimeout(function () { ctl.abort(); }, TIMEOUT);
    } catch (e) {}
    net.status = 'loading';
    const o = Object.assign({}, opts || {});
    if (ctl) o.signal = ctl.signal;
    return fetch(url + path, o).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, data: d }; });
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) { net.status = 'ok'; return null; }
      net.status = 'ok';
      return res.data;
    }).catch(function () {
      if (timer) clearTimeout(timer);
      net.status = 'offline';
      return null;
    });
  }

  net.submit = function (p) {
    try {
      p = p || {};
      const mode = p.mode || 'endless';
      const body = {
        // no name chosen yet: fall back to a stable CAT#### so the score still counts
        id: id, name: net.hasName() ? net.getName() : 'CAT' + (parseInt(String(id).replace(/[^0-9]/g, '').slice(-4) || '0', 10) % 10000), mode: mode,
        score: Math.floor(p.score || 0), wave: Math.floor(p.wave || 0),
        kos: Math.floor(p.kos || 0), time: Math.floor(p.time || 0),
        skin: String(SC.store.get('skin', 'ginger') || 'ginger'), v: 1,
      };
      return request('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (r) {
        if (r && typeof r.rank === 'number') {
          const c = cache[mode] || (cache[mode] = {});
          c.you = { rank: r.rank, score: r.best };
          c.total = r.total;
        }
        return r;
      }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  };

  net.top = function (mode) {
    try {
      mode = mode || 'endless';
      return request('/api/top?mode=' + encodeURIComponent(mode) + '&limit=50&id=' + encodeURIComponent(id))
        .then(function (r) {
          if (r && Array.isArray(r.entries)) { cache[mode] = r; return r; }
          return null;
        }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  };

  SC.net = net;
})();
