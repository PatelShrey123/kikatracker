// api/auth.js: "Sign in with Discord" for the website (used by the skin gallery).
//
//   GET  /api/auth?action=login&next=/gallery   -> sends the person to Discord
//   GET  /auth/callback?code=...&state=...      -> (rewritten here) signs them in, back to `next`
//   GET  /api/auth?action=me                    -> { user } or { user: null }
//   POST /api/auth?action=logout                -> signs them out
//
// Only the "identify" scope: the user's id, name and avatar. No email, no servers.
// Env: DISCORD_CLIENT_SECRET. In the Discord Developer Portal, OAuth2 → Redirects must list
// https://kirkahub.online/auth/callback
import crypto from 'node:crypto';
import { DISCORD_CLIENT_ID, clean, readCookies, sessionCookie, clearCookie, currentUser, personFrom } from './_session.js';

const STATE_COOKIE = 'kh_oauth';

/** Only paths on this site, so the sign-in can't be used to bounce people somewhere else. */
const safeNext = (v) => (typeof v === 'string' && /^\/[^/\\]/.test(v) ? v.slice(0, 200) : '/gallery');

const originOf = (req) => {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'kirkahub.online');
  const proto = String(req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https'));
  return `${proto}://${host}`;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action') || (url.pathname.endsWith('/callback') ? 'callback' : 'me');

  if (action === 'me') {
    return res.status(200).json({ user: await currentUser(req) });
  }

  if (action === 'logout') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    res.setHeader('Set-Cookie', clearCookie());
    return res.status(200).json({ ok: true });
  }

  const secret = clean(process.env.DISCORD_CLIENT_SECRET);
  if (!secret) return res.status(503).json({ error: 'Discord sign-in is not set up on the server (DISCORD_CLIENT_SECRET).' });
  const redirectUri = `${originOf(req)}/auth/callback`;

  if (action === 'login') {
    const state = crypto.randomBytes(16).toString('base64url');
    const next = safeNext(url.searchParams.get('next'));
    res.setHeader('Set-Cookie', `${STATE_COOKIE}=${state}|${encodeURIComponent(next)}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
    const to = new URL('https://discord.com/oauth2/authorize');
    to.search = new URLSearchParams({ client_id: DISCORD_CLIENT_ID, response_type: 'code', scope: 'identify', redirect_uri: redirectUri, state, prompt: 'none' }).toString();
    res.setHeader('Location', to.toString());
    return res.status(302).end();
  }

  if (action === 'callback') {
    const [state, nextRaw] = String(readCookies(req)[STATE_COOKIE] || '').split('|');
    const next = safeNext(decodeURIComponent(nextRaw || ''));
    const back = (q) => {
      res.setHeader('Set-Cookie', clearCookie(STATE_COOKIE));
      res.setHeader('Location', q ? `${next}${next.includes('?') ? '&' : '?'}${q}` : next);
      return res.status(302).end();
    };
    const code = url.searchParams.get('code');
    // cancelled on Discord's page, or the link was opened twice
    if (!code || !state || url.searchParams.get('state') !== state) return back('signin=failed');
    try {
      const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: secret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      });
      const token = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !token.access_token) {
        console.warn('discord sign-in: token exchange failed', tokenRes.status, token.error || '');
        return back('signin=failed');
      }
      const meRes = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } });
      if (!meRes.ok) return back('signin=failed');
      const user = personFrom(await meRes.json());
      res.setHeader('Set-Cookie', [sessionCookie(user), clearCookie(STATE_COOKIE)]);
      res.setHeader('Location', next);
      return res.status(302).end();
    } catch (err) {
      console.warn('discord sign-in failed:', err?.message);
      return back('signin=failed');
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
}
