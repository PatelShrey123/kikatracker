// Shared by api/auth.js and api/gallery.js: who's signed in.
//
// The website signs people in with Discord (api/auth.js) and keeps who they are in a signed cookie:
// the user's id, name and avatar plus an HMAC, so it can't be edited by hand. Nothing is stored on the
// server. The Discord Activity can't use the site's cookies, so it sends the Discord access token it
// already has, and that is checked with Discord.
//
// Env: DISCORD_CLIENT_SECRET (the same secret the bot uses). The cookie key is derived from it.
import crypto from 'node:crypto';

export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1532695214634831872';
export const COOKIE = 'kh_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const clean = (v) => (v || '').trim().replace(/^["']|["']$/g, '');
const secret = () => clean(process.env.DISCORD_CLIENT_SECRET);
const key = () => crypto.createHash('sha256').update(`kirkahub-session:${secret()}`).digest();

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => b64url(crypto.createHmac('sha256', key()).update(data).digest());

export function readCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(user) {
  const body = b64url(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  return `${COOKIE}=${body}.${sign(body)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearCookie = (name = COOKIE) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

/** The person in a Discord user object, the way the gallery shows them. */
export function personFrom(u) {
  return {
    id: String(u.id),
    name: String(u.global_name || u.username || 'Someone').slice(0, 32),
    avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null,
  };
}

const tokenCache = new Map(); // access token -> { user, until }

/** The signed-in person, from the cookie or a Discord access token; null if there's none. */
export async function currentUser(req) {
  if (!secret()) return null;
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const hit = tokenCache.get(token);
    if (hit && hit.until > Date.now()) return hit.user;
    try {
      const r = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const user = personFrom(await r.json());
      if (tokenCache.size > 500) tokenCache.clear();
      tokenCache.set(token, { user, until: Date.now() + 10 * 60 * 1000 });
      return user;
    } catch {
      return null;
    }
  }
  const raw = readCookies(req)[COOKIE];
  if (!raw) return null;
  const [body, mac] = raw.split('.');
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    return { id: data.id, name: data.name, avatar: data.avatar };
  } catch {
    return null;
  }
}

/** The JSON body: Vercel parses it into req.body; the local dev server doesn't. */
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200_000) break;
  }
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
