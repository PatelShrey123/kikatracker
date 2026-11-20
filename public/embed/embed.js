// Shared code for the KirkaHub embeds (public/embed/*.html), the pages other sites show in an iframe.
//   ?id=<Kirka short ID>   the player (profile, inventory)
//   ?lang=es|en            language, English by default
//   ?embed=rite            RITE's colours
// Rules agreed with RITE (rite.lat): only our own code and API, nothing third-party, no ads,
// analytics, login, forms, popups or redirects; framing allowed only by rite.lat (vercel.json).
// Talks to the host page with postMessage: "rite-embed:ready" once, "rite-embed:height" on changes.
(() => {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang') === 'es' ? 'es' : 'en';
  const theme = params.get('embed') === 'rite' ? 'rite' : 'kirkahub';
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = theme;

  // ?id=LL0ZBM, or the last part of the path (/embed/profile/LL0ZBM)
  const fromPath = decodeURIComponent(location.pathname.split('/').filter(Boolean)[2] || '');
  const id = String(params.get('id') || fromPath).replace(/^#+/, '').trim().toUpperCase();
  const validId = /^[A-Z0-9]{3,12}$/.test(id);

  const SITE = location.origin; // kirkahub.online
  const CACHE_MS = 10 * 60 * 1000;

  const STRINGS = {
    en: {
      level: 'Level', clan: 'Clan', skin: 'Skin', worth: 'Inventory Hub value', items: '{n} items',
      kd: 'K/D', kills: 'Kills', games: 'Games', winrate: 'Win rate', headshots: 'Headshots',
      fullProfile: 'Full profile, trades and history on KirkaHub',
      seeAll: 'See all {n} items and their value on KirkaHub',
      topSkins: 'Most valuable', character: 'Character',
      by: 'Kirka stats by', loading: 'Loading',
      noId: 'No player', noIdText: 'Add a Kirka short ID, like ?id=LL0ZBM.',
      notFound: 'Player not found', notFoundText: 'No Kirka account has the ID #{id}.',
      down: 'Kirka stats are unavailable', downText: 'Kirka didn’t answer just now. Try again in a minute.',
      empty: 'Nothing to show', emptyText: 'This inventory is empty or private.',
      MYTHICAL: 'Mythical', LEGENDARY: 'Legendary', EPIC: 'Epic', RARE: 'Rare', COMMON: 'Common',
    },
    es: {
      level: 'Nivel', clan: 'Clan', skin: 'Skin', worth: 'Valor Hub del inventario', items: '{n} objetos',
      kd: 'K/D', kills: 'Bajas', games: 'Partidas', winrate: 'Victorias', headshots: 'Headshots',
      fullProfile: 'Perfil completo, trades e historial en KirkaHub',
      seeAll: 'Ver los {n} objetos y su valor en KirkaHub',
      topSkins: 'Los más valiosos', character: 'Personaje',
      by: 'Estadísticas de Kirka por', loading: 'Cargando',
      noId: 'Sin jugador', noIdText: 'Agrega un ID corto de Kirka, como ?id=LL0ZBM.',
      notFound: 'Jugador no encontrado', notFoundText: 'Ninguna cuenta de Kirka tiene el ID #{id}.',
      down: 'Las estadísticas de Kirka no están disponibles', downText: 'Kirka no respondió. Intenta de nuevo en un minuto.',
      empty: 'Nada que mostrar', emptyText: 'Este inventario está vacío o es privado.',
      MYTHICAL: 'Mítico', LEGENDARY: 'Legendario', EPIC: 'Épico', RARE: 'Raro', COMMON: 'Común',
    },
  };
  const t = (key, vars = {}) => String(STRINGS[lang][key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

  const num = new Intl.NumberFormat(lang === 'es' ? 'es' : 'en', { notation: 'compact', maximumFractionDigits: 1 });
  const fmt = (n) => num.format(Math.round(n || 0));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '–');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---------------------------------------------------------------- talking to the host page
  // Only to rite.lat (or www.rite.lat, whichever is showing us), plus localhost while testing.
  const ALLOWED = ['https://rite.lat', 'https://www.rite.lat'];
  const parentOrigin = (() => {
    if (parent === window) return null;
    let o = location.ancestorOrigins?.[0] || '';
    if (!o) try { o = new URL(document.referrer).origin; } catch { o = ''; }
    return ALLOWED.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) ? o : null;
  })();
  const post = (msg) => parentOrigin && parent.postMessage(msg, parentOrigin);
  // the height of what's shown (the frame's own height would never let it shrink)
  const height = () => Math.ceil(document.body.getBoundingClientRect().height);
  let lastHeight = 0;
  const sendHeight = () => { const h = height(); if (h && h !== lastHeight) { lastHeight = h; post({ type: 'rite-embed:height', height: h }); } };
  addEventListener('DOMContentLoaded', () => {
    post({ type: 'rite-embed:ready' });
    new ResizeObserver(sendHeight).observe(document.body);
  });

  // ---------------------------------------------------------------- data (our own API only)
  const cacheGet = (k) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && Date.now() - v.t < CACHE_MS ? v.d : null; } catch { return null; } };
  const cacheSet = (k, d) => { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d })); } catch {} };

  async function kirka(path, body) {
    const res = await fetch('/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw Object.assign(new Error(path + ' ' + res.status), { status: res.status });
    return res.json();
  }
  const profile = () => kirka('/user/getProfile', { id, isShortId: true });
  const inventory = () => kirka('/inventory/user', { id, isShortId: true });

  // Hub prices, keyed exactly like the profile page (name + weapon, then the name alone, later rows winning)
  async function prices() {
    const cached = cacheGet('kh-embed-prices');
    if (cached) return new Map(cached);
    const rows = await fetch('/api/prices').then((r) => (r.ok ? r.json() : [])).catch(() => []);
    const map = new Map();
    for (const row of rows) {
      const name = String(row['Skin Name'] || '').toLowerCase();
      if (!name) continue;
      const value = parseInt(String(row['Hub Value'] || row['Base Value'] || '').replace(/,/g, ''), 10) || 0;
      map.set(`${name}_${String(row['Type'] || '').toLowerCase()}`, value);
      map.set(name, value);
    }
    cacheSet('kh-embed-prices', [...map]);
    return map;
  }
  const cleanName = (item) => String(item?.name || '').replace(/^_+/, '').trim();
  const kindOf = (item) => (item?.type === 'BODY_SKIN' ? 'character' : String(item?.parent?.name || '').toLowerCase());
  const itemValue = (item, map) => { const n = cleanName(item).toLowerCase(); return map.get(`${n}_${kindOf(item)}`) ?? map.get(n) ?? item?.salePrice ?? 0; };

  // skin pictures: Kirka's renders, through our own /kirka-assets/ path (scripts/build-embed-data.mjs)
  let renders = null;
  async function renderOf(itemId) {
    if (!renders) renders = await fetch('/embed/renders.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const file = renders[itemId];
    return file ? `/kirka-assets/assets/img/${file}` : null;
  }

  // ---------------------------------------------------------------- pieces every embed uses
  const linkTo = (path, text, cls = 'go') => {
    const a = el('a', cls, text);
    a.href = SITE + path; a.target = '_blank'; a.rel = 'noopener';
    return a;
  };
  function brand() {
    const a = el('a', 'brand');
    a.href = SITE + '/'; a.target = '_blank'; a.rel = 'noopener';
    const logo = el('img'); logo.src = '/icon-48.png'; logo.alt = ''; logo.width = logo.height = 16;
    a.append(logo, `${t('by')} `, el('b', '', 'KirkaHub'));
    return a;
  }
  function message(out, title, text) {
    const box = el('div', 'card msg');
    box.append(el('b', '', title), el('span', '', text));
    out.replaceChildren(box);
  }
  function failed(out, err) {
    if (err?.status === 404 || err?.status === 400) message(out, t('notFound'), t('notFoundText', { id }));
    else message(out, t('down'), t('downText'));
  }

  // one line in the site's own Discord visit log, so we can see what RITE sends us
  function track(kind) {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return; // not while testing
    try {
      const body = JSON.stringify({ path: `/embed/${kind}${validId ? '/' + id : ''}`, title: `Embed: ${kind}`, visit: Math.random().toString(36).slice(2, 6).padEnd(4, 'x'), n: 1, ref: document.referrer });
      navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'text/plain' }));
    } catch {}
  }

  window.KH = { lang, theme, id, validId, t, fmt, pct, el, cacheGet, cacheSet, profile, inventory, prices, itemValue, cleanName, renderOf, linkTo, brand, message, failed, track, sendHeight };
})();
