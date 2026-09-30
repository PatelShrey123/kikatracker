// Reads the Kirka chat archive. The table is public-read by policy and the anon key is designed to
// be published, so the browser queries Supabase directly - there is nothing here a visitor could not
// already see in game. Writes are impossible with this key; only the collector can insert.

// Queries go through our own /api/chat, which holds the Supabase credentials server-side.
// They used to be VITE_-prefixed and therefore compiled into this bundle, where anyone could
// read them in DevTools. That was safe — the key is read-only by RLS — but every other
// credential on this site is already kept off the client, and there was no reason for this one
// to be the exception.
//
// The endpoint is always present in a deployed build; if the server is missing its environment
// it says so in the response, which the UI surfaces.
export const chatArchiveConfigured = true;

export interface ChatRow {
  msg_id: string;
  /** 2 = a player talking, 13 = a server notice, which is where trade offers appear. */
  kind: number;
  name: string | null;
  short_id: string | null;
  level: number | null;
  role: string | null;
  message: string;
  seen_at: string;
}

export interface ChatGap {
  id: number;
  noticed_at: string;
  reason: string;
  detail: string | null;
}

export interface ChatQuery {
  /** Free text, matched inside the message body. */
  text?: string;
  /** Player name or short id. */
  who?: string;
  /** 'all' | 'chat' | 'server' */
  kind?: 'all' | 'chat' | 'server';
  before?: string;
  limit?: number;
}

async function get<T>(path: string, wantCount = false): Promise<{ rows: T[]; total: number | null }> {
  // `path` is PostgREST-shaped, e.g. "chat_messages?select=...&order=...". The table is sent
  // as its own parameter so the proxy can check it against its allow-list rather than
  // forwarding whatever it is handed.
  const [table, query = ''] = path.split('?');
  const qs = new URLSearchParams(query);
  qs.set('table', table);
  if (wantCount) qs.set('count', '1');

  const res = await fetch(`/api/chat?${qs.toString()}`);
  if (!res.ok) {
    let detail = `Archive returned ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch { /* not json; keep the status */ }
    throw new Error(detail);
  }

  const rows = (await res.json()) as T[];
  const range = res.headers.get('content-range');
  const total = range ? Number(range.split('/')[1]) : null;
  return { rows, total: Number.isFinite(total) ? total : null };
}

/** PostgREST puts filters in the query string, and commas and parens are structural there. */
const esc = (s: string) => encodeURIComponent(s.replace(/[(),*]/g, ' ').trim());

export async function searchChat(q: ChatQuery): Promise<{ rows: ChatRow[]; total: number | null }> {
  const parts = ['select=msg_id,kind,name,short_id,level,role,message,seen_at', 'order=seen_at.desc'];
  parts.push(`limit=${Math.min(q.limit ?? 100, 500)}`);

  if (q.kind === 'chat') parts.push('kind=eq.2');
  else if (q.kind === 'server') parts.push('kind=eq.13');

  if (q.text?.trim()) parts.push(`message=ilike.*${esc(q.text.trim())}*`);

  // a player is identified by either their name or the short id after the #
  if (q.who?.trim()) {
    const w = esc(q.who.trim().replace(/^#/, ''));
    parts.push(`or=(name.ilike.*${w}*,short_id.ilike.*${w}*)`);
  }

  if (q.before) parts.push(`seen_at=lt.${encodeURIComponent(q.before)}`);

  return get<ChatRow>(`chat_messages?${parts.join('&')}`, true);
}

/** Total rows held, for the header. Estimated, because an exact count over millions is slow. */
export async function chatStats(): Promise<{ total: number | null; oldest: string | null; newest: string | null }> {
  const [{ total }, oldest, newest] = await Promise.all([
    get<ChatRow>('chat_messages?select=msg_id&limit=1', true),
    get<ChatRow>('chat_messages?select=seen_at&order=seen_at.asc&limit=1'),
    get<ChatRow>('chat_messages?select=seen_at&order=seen_at.desc&limit=1'),
  ]);
  return {
    total,
    oldest: oldest.rows[0]?.seen_at ?? null,
    newest: newest.rows[0]?.seen_at ?? null,
  };
}

/**
 * Any window the collector believes it missed, so coverage can be stated rather than implied.
 *
 * Returns the total alongside the sample: the page was reporting `rows.length`, which is capped
 * by the limit, so a banner reading "5 recorded gaps" was really saying "the 5 I asked for" -
 * it said 5 whether there were 5 or 500. On a page whose entire purpose is to be honest about
 * what it does and does not have, that is the one number that must not be wrong.
 */
export async function recentGaps(limit = 20): Promise<{ rows: ChatGap[]; total: number | null }> {
  return get<ChatGap>(`chat_gaps?select=*&order=noticed_at.desc&limit=${limit}`, true);
}

/**
 * Kirka wraps item names in tags: [Name||TYPE|RARITY] or [Name|Weapon|TYPE|RARITY].
 * Splits a message so the page can colour the items without losing the surrounding text.
 */
export function splitItems(message: string): { text: string; item?: { name: string; rarity: string } }[] {
  const out: { text: string; item?: { name: string; rarity: string } }[] = [];
  const re = /\[([^\]|]+)\|([^\]]*)\]/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(message))) {
    if (m.index > last) out.push({ text: message.slice(last, m.index) });
    const rarity = String(m[2]).split('|').filter(Boolean).pop() ?? '';
    out.push({ text: m[1], item: { name: m[1], rarity } });
    last = m.index + m[0].length;
  }
  if (last < message.length) out.push({ text: message.slice(last) });
  return out;
}

/**
 * Everything said within `seconds` either side of one message, so a search hit can be read with
 * the conversation around it rather than alone.
 *
 * This is a time window, not "the N messages either side". Kirka stamps nothing itself, so seen_at
 * is when the collector wrote the batch, and a whole batch shares one timestamp - there is no true
 * per-message ordering to page through. msg_id breaks ties only so the order is stable between
 * loads, not because it reflects who spoke first.
 */
export async function chatContext(anchor: ChatRow, seconds = 60): Promise<ChatRow[]> {
  const t = new Date(anchor.seen_at).getTime();
  const from = new Date(t - seconds * 1000).toISOString();
  const to = new Date(t + seconds * 1000).toISOString();
  const { rows } = await get<ChatRow>(
    'chat_messages?select=msg_id,kind,name,short_id,level,role,message,seen_at' +
      `&seen_at=gte.${encodeURIComponent(from)}&seen_at=lte.${encodeURIComponent(to)}` +
      '&order=seen_at.asc,msg_id.asc&limit=800'
  );
  return rows;
}
