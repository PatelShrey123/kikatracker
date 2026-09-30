// api/chat.js — server-side proxy for the Kirka chat archive.
//
// The page used to query Supabase directly with a VITE_-prefixed anon key, which meant the key
// was compiled into the browser bundle and visible in DevTools. That is safe — the key is
// read-only by RLS and the chat it reads was public in game — but it does not need to be
// visible, and every other credential on this site is already kept server-side. This brings the
// chat archive in line: the browser calls /api/chat, and the key lives in the environment.
//
// To be clear about what this does and does not do: it hides the key, not the data. Anyone can
// still call this endpoint and read the archive, which is the point of a public page.
//
// Env: CHAT_SUPABASE_URL, CHAT_SUPABASE_ANON_KEY  (no VITE_ prefix — never sent to the client)

/** Only these two are readable. Without this the endpoint would be an open proxy to the whole
 *  database, including any table added later that was never meant to be public. */
const ALLOWED_TABLES = new Set(['chat_messages', 'chat_gaps']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Values pasted into a dashboard pick up stray whitespace, newlines and sometimes the quotes
  // around them. An untrimmed URL makes new URL() throw, which used to surface as the useless
  // "unreachable" message below rather than anything that pointed at the cause.
  const clean = (v) => (v || '').trim().replace(/^["']|["']$/g, '');
  const base = clean(process.env.CHAT_SUPABASE_URL);
  const key = clean(process.env.CHAT_SUPABASE_ANON_KEY);

  if (!base || !key) {
    return res.status(503).json({
      error: 'Chat archive is not configured on the server.',
      missing: [!base && 'CHAT_SUPABASE_URL', !key && 'CHAT_SUPABASE_ANON_KEY'].filter(Boolean),
    });
  }

  // req.url is "/api/chat?table=chat_messages&select=...&order=..."
  const url = new URL(req.url, 'http://localhost');
  const table = url.searchParams.get('table');
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Unknown table' });
  }
  url.searchParams.delete('table');

  // Whether the caller wants a total; forwarded as a PostgREST Prefer header, not a query param.
  const wantCount = url.searchParams.get('count') === '1';
  url.searchParams.delete('count');

  const target = `${base.replace(/\/$/, '')}/rest/v1/${table}?${url.searchParams.toString()}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(wantCount ? { Prefer: 'count=estimated' } : {}),
      },
    });

    const body = await upstream.text();

    // The row total rides in Content-Range; the page needs it for "200 shown of ~128,255".
    const range = upstream.headers.get('content-range');
    if (range) res.setHeader('Content-Range', range);
    res.setHeader('Content-Type', 'application/json');
    // Chat moves constantly, so this is deliberately short — enough to absorb a burst of
    // identical requests without the archive appearing frozen.
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

    return res.status(upstream.status).send(body);
  } catch (err) {
    // Say enough to diagnose without ever echoing the key or the full upstream URL back to a
    // visitor. The host alone is sufficient to spot a malformed or wrong value.
    let host = 'unparseable';
    try { host = new URL(base).host; } catch { /* that is itself the answer */ }
    console.error('[chat] upstream failed:', err?.name, err?.message);
    return res.status(502).json({
      error: 'Chat archive is unreachable right now.',
      reason: `${err?.name || 'Error'}: ${err?.message || 'unknown'}`,
      upstreamHost: host,
    });
  }
}
