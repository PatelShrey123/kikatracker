// api/gallery.js: the player skin gallery.
//
//   GET  /api/gallery?sort=new|top&page=0     -> { skins: [...], more, user }
//   GET  /api/gallery?id=abc123               -> { skin, user }
//   GET  /api/gallery?author=<discord id>     -> that person's skins
//   POST /api/gallery { action: 'post', name, model, size, png, painters? }   (signed in)
//   POST /api/gallery { action: 'like' | 'report' | 'delete', id }            (signed in)
//
// Posting needs a Discord sign-in (the website's cookie, or the Activity's Discord token). Skins go
// live at once; three reports from different people hide one until someone looks at it.
//
// The database key never reaches the browser: only this function talks to Supabase.
// Env: GALLERY_SUPABASE_URL, GALLERY_SUPABASE_KEY (the project's secret / service_role key),
//      DISCORD_CLIENT_SECRET, optional GALLERY_ADMIN_IDS (Discord ids who may delete any skin).
import crypto from 'node:crypto';
import { clean, currentUser, readBody } from './_session.js';

const PAGE = 24;
const MAX_PNG_BYTES = 60_000;
const POSTS_PER_DAY = 10;
const HIDE_AFTER_REPORTS = 3;
const LIST_FIELDS = 'id,name,model,size,png,author_id,author_name,author_avatar,painters,likes,created_at';

function db() {
  const base = clean(process.env.GALLERY_SUPABASE_URL || process.env.SUPABASE_URL).replace(/\/$/, '');
  const key = clean(process.env.GALLERY_SUPABASE_KEY);
  if (!base || !key) return null;
  // new-style keys (sb_secret_...) go in apikey only; a legacy service_role JWT goes in both
  const headers = key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
  return async (path, { method = 'GET', body, prefer } = {}) => {
    const r = await fetch(`${base}/rest/v1/${path}`, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const err = new Error(`supabase ${r.status}: ${typeof data === 'object' ? data?.message : data}`);
      err.status = r.status;
      throw err;
    }
    return { data, range: r.headers.get('content-range') };
  };
}

/** A real skin PNG: the PNG signature, then a header saying 64x64 or 128x128. */
function checkPng(dataUrl) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return 'The skin has to be a PNG.';
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_PNG_BYTES) return 'That skin file is too big.';
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b) || buf.toString('ascii', 12, 16) !== 'IHDR') return 'That is not a PNG.';
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== h || (w !== 64 && w !== 128)) return 'A skin has to be 64x64 or 128x128.';
  return { size: w };
}

const cleanText = (v, max) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const newId = () => crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8);
const admins = () => new Set(clean(process.env.GALLERY_ADMIN_IDS).split(/[\s,]+/).filter(Boolean));
const countFrom = (range) => Number(String(range || '').split('/')[1]) || 0;

/** Marks which of these skins the person has liked. */
async function withLikes(q, skins, user) {
  if (!user || !skins.length) return skins.map((s) => ({ ...s, liked: false }));
  const ids = skins.map((s) => s.id).join(',');
  const { data } = await q(`gallery_likes?select=skin_id&user_id=eq.${encodeURIComponent(user.id)}&skin_id=in.(${ids})`);
  const liked = new Set((data || []).map((r) => r.skin_id));
  return skins.map((s) => ({ ...s, liked: liked.has(s.id) }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = db();
  if (!q) return res.status(503).json({ error: 'The gallery is not set up on the server yet (GALLERY_SUPABASE_KEY).' });
  const user = await currentUser(req);
  const url = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (id) {
        if (!/^[a-z0-9]{4,12}$/i.test(id)) return res.status(404).json({ error: 'No such skin.' });
        const { data } = await q(`gallery_skins?select=${LIST_FIELDS},hidden&id=eq.${id}`);
        const skin = data?.[0];
        if (!skin || (skin.hidden && skin.author_id !== user?.id && !admins().has(user?.id))) return res.status(404).json({ error: 'No such skin.' });
        const [withLike] = await withLikes(q, [skin], user);
        return res.status(200).json({ skin: withLike, user, admin: !!user && admins().has(user.id) });
      }
      const page = Math.max(0, Math.min(200, parseInt(url.searchParams.get('page') || '0', 10) || 0));
      const order = url.searchParams.get('sort') === 'top' ? 'likes.desc,created_at.desc' : 'created_at.desc';
      const author = url.searchParams.get('author');
      const who = author && /^\d{5,25}$/.test(author) ? `&author_id=eq.${author}` : '';
      const { data } = await q(`gallery_skins?select=${LIST_FIELDS}&hidden=is.false${who}&order=${order}&limit=${PAGE + 1}&offset=${page * PAGE}`);
      const rows = data || [];
      const skins = await withLikes(q, rows.slice(0, PAGE), user);
      return res.status(200).json({ skins, more: rows.length > PAGE, user, admin: !!user && admins().has(user.id) });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (!user) return res.status(401).json({ error: 'Sign in with Discord first.' });
    const body = await readBody(req);

    if (body.action === 'post') {
      const name = cleanText(body.name, 40);
      if (name.length < 2) return res.status(400).json({ error: 'Give your skin a name.' });
      const png = checkPng(body.png);
      if (typeof png === 'string') return res.status(400).json({ error: png });
      const model = body.model === 'default' ? 'default' : 'slim';
      const painters = Array.isArray(body.painters)
        ? [...new Set(body.painters.map((p) => cleanText(p, 32)).filter((p) => p && p !== user.name))].slice(0, 12)
        : [];
      // a few a day each, so the gallery can't be flooded
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { range } = await q(`gallery_skins?select=id&author_id=eq.${user.id}&created_at=gte.${since}`, { method: 'HEAD', prefer: 'count=exact' });
      if (countFrom(range) >= POSTS_PER_DAY) return res.status(429).json({ error: `You can post ${POSTS_PER_DAY} skins a day. Come back tomorrow.` });
      const row = {
        id: newId(), name, model, size: png.size, png: body.png,
        author_id: user.id, author_name: user.name, author_avatar: user.avatar, painters,
      };
      await q('gallery_skins', { method: 'POST', body: row, prefer: 'return=minimal' });
      return res.status(200).json({ id: row.id });
    }

    const id = String(body.id || '');
    if (!/^[a-z0-9]{4,12}$/i.test(id)) return res.status(400).json({ error: 'No such skin.' });

    if (body.action === 'like') {
      // a like is a row; liking again takes it back. The count on the skin follows the rows.
      const { data: added } = await q('gallery_likes', { method: 'POST', body: { skin_id: id, user_id: user.id }, prefer: 'resolution=ignore-duplicates,return=representation' });
      const liked = Array.isArray(added) && added.length > 0;
      if (!liked) await q(`gallery_likes?skin_id=eq.${id}&user_id=eq.${user.id}`, { method: 'DELETE' });
      const { range } = await q(`gallery_likes?select=skin_id&skin_id=eq.${id}`, { method: 'HEAD', prefer: 'count=exact' });
      const likes = countFrom(range);
      await q(`gallery_skins?id=eq.${id}`, { method: 'PATCH', body: { likes }, prefer: 'return=minimal' });
      return res.status(200).json({ liked, likes });
    }

    if (body.action === 'report') {
      await q('gallery_reports', { method: 'POST', body: { skin_id: id, user_id: user.id }, prefer: 'resolution=ignore-duplicates,return=minimal' });
      const { range } = await q(`gallery_reports?select=skin_id&skin_id=eq.${id}`, { method: 'HEAD', prefer: 'count=exact' });
      const reports = countFrom(range);
      await q(`gallery_skins?id=eq.${id}`, { method: 'PATCH', body: { reports, ...(reports >= HIDE_AFTER_REPORTS ? { hidden: true } : {}) }, prefer: 'return=minimal' });
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'delete') {
      const { data } = await q(`gallery_skins?select=author_id&id=eq.${id}`);
      if (!data?.[0]) return res.status(404).json({ error: 'No such skin.' });
      if (data[0].author_id !== user.id && !admins().has(user.id)) return res.status(403).json({ error: 'Only the person who posted it can delete it.' });
      await q(`gallery_skins?id=eq.${id}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.warn('gallery:', err?.message);
    // a foreign-key miss on like/report means the skin is gone
    if (err?.status === 409) return res.status(404).json({ error: 'No such skin.' });
    return res.status(502).json({ error: 'The gallery is unavailable right now.' });
  }
}
