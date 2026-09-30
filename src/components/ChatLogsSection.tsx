import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader2, AlertTriangle, ShieldAlert, ArrowLeft, Clock } from 'lucide-react';
import { searchChat, chatStats, recentGaps, splitItems, chatContext, chatArchiveConfigured } from '../utils/chatLog';
import type { ChatRow, ChatGap } from '../utils/chatLog';

/** How far either side of a message to show when reading it in context. */
const SPANS = [
  { label: '±30s', seconds: 30 },
  { label: '±2m', seconds: 120 },
  { label: '±10m', seconds: 600 },
];

// Searchable archive of Kirka global chat. Everything here was public in game; the point is that it
// scrolls away after 50 messages, so a trade or coinflip dispute has nothing to point at.

const RARITY: Record<string, string> = {
  MYTHICAL: 'text-rarity-mythic',
  LEGENDARY: 'text-rarity-legendary',
  EPIC: 'text-rarity-epic',
  RARE: 'text-rarity-rare',
  UNCOMMON: 'text-emerald-400',
  COMMON: 'text-slate-400',
};

const ROLE: Record<string, string> = {
  BOT: 'text-rarity-mythic',
  MODERATOR: 'text-rarity-rare',
  ADMIN: 'text-emerald-400',
  OWNER: 'text-[#EDEDED]',
};

const stamp = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

const Line: React.FC<{
  r: ChatRow;
  highlight: string;
  /** Given when clicking the row should open it in context. */
  onPick?: (r: ChatRow) => void;
  /** The message the context window is built around. */
  anchor?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}> = ({ r, highlight, onPick, anchor, innerRef }) => {
  const parts = useMemo(() => splitItems(r.message), [r.message]);
  const hl = highlight.trim().toLowerCase();

  const render = (text: string) => {
    if (!hl) return text;
    const i = text.toLowerCase().indexOf(hl);
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-gold-primary/25 text-gold-bright rounded-md px-0.5">{text.slice(i, i + hl.length)}</mark>
        {text.slice(i + hl.length)}
      </>
    );
  };

  return (
    <div
      ref={innerRef}
      onClick={onPick ? () => onPick(r) : undefined}
      title={onPick ? 'Show what was said around this' : undefined}
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 border-b border-slate-800 ${
        onPick ? 'cursor-pointer' : ''
      } ${anchor ? 'bg-spray-cyan/[0.08] border-l-[3px] border-l-spray-cyan' : 'hover:bg-white/[0.04]'}`}
    >
      <span className="text-[10px] font-mono text-slate-600 tabular-nums shrink-0">{stamp(r.seen_at)}</span>

      {r.kind === 13 ? (
        <span className="text-[10px] font-mono text-amber-400 shrink-0">server</span>
      ) : (
        <span className="shrink-0 font-mono text-xs">
          {r.level !== null && <span className="text-slate-600">[{r.level}] </span>}
          <span className={`font-medium ${ROLE[r.role ?? ''] ?? 'text-slate-300'}`}>{r.name ?? '?'}</span>
          {r.short_id && <span className="text-slate-600">#{r.short_id}</span>}
        </span>
      )}

      <span className="text-sm text-slate-300 break-words min-w-0">
        {parts.map((p, i) =>
          p.item ? (
            <span key={i} className={`font-semibold ${RARITY[p.item.rarity.toUpperCase()] ?? 'text-slate-200'}`}>
              {render(p.text)}
            </span>
          ) : (
            <React.Fragment key={i}>{render(p.text)}</React.Fragment>
          )
        )}
      </span>
    </div>
  );
};

export const ChatLogsSection: React.FC = () => {
  const [text, setText] = useState('');
  const [who, setWho] = useState('');
  const [kind, setKind] = useState<'all' | 'chat' | 'server'>('all');
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [stats, setStats] = useState<{ total: number | null; oldest: string | null; newest: string | null } | null>(null);
  const [gaps, setGaps] = useState<ChatGap[]>([]);
  const [gapTotal, setGapTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  // Reading one hit in context. The search results stay untouched underneath, so going back is free.
  const [ctx, setCtx] = useState<{ anchor: ChatRow; rows: ChatRow[]; seconds: number } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const ctxId = useRef(0);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const openContext = useCallback(async (anchor: ChatRow, seconds = 120) => {
    const id = ++ctxId.current;
    setCtxLoading(true);
    setError(null);
    try {
      const rows = await chatContext(anchor, seconds);
      if (id !== ctxId.current) return;
      setCtx({ anchor, rows, seconds });
    } catch (e) {
      if (id === ctxId.current) setError(e instanceof Error ? e.message : 'Could not load surrounding messages');
    } finally {
      if (id === ctxId.current) setCtxLoading(false);
    }
  }, []);

  // Put the message you clicked in the middle of the view, not at the top where it reads as a start.
  useEffect(() => {
    if (ctx) anchorRef.current?.scrollIntoView({ block: 'center' });
  }, [ctx]);

  const run = useCallback(async (q: { text: string; who: string; kind: 'all' | 'chat' | 'server' }) => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await searchChat({ ...q, limit: 200 });
      if (id !== runId.current) return;       // a newer search has already been fired
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      if (id === runId.current) setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      if (id === runId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!chatArchiveConfigured) return;
    run({ text: '', who: '', kind: 'all' });
    chatStats().then(setStats).catch(() => {});
    recentGaps(5).then(({ rows, total }) => { setGaps(rows); setGapTotal(total); }).catch(() => {});
  }, [run]);

  // typing re-runs the search, but only once the typing stops
  useEffect(() => {
    if (!chatArchiveConfigured) return;
    const t = setTimeout(() => {
      ctxId.current++;          // abandon any context load still in flight
      setCtx(null);             // changing the filters means you are back to searching
      run({ text, who, kind });
    }, 350);
    return () => clearTimeout(t);
  }, [text, who, kind, run]);

  if (!chatArchiveConfigured) {
    return (
      <section className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            The chat archive is not configured. Set <code className="font-mono">VITE_CHAT_SUPABASE_URL</code> and{' '}
            <code className="font-mono">VITE_CHAT_SUPABASE_ANON_KEY</code>.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 py-8 space-y-4">
      <header>
        <h1 className="display text-4xl sm:text-5xl text-[#EDEDED]">Chat <span className="mark text-obsidian-deep" style={{ ["--mark-color" as string]: "var(--color-spray-cyan)" }}>archive</span></h1>
        <p className="mt-3 text-[15px] text-slate-400 leading-relaxed max-w-[52ch]">
          Kirka only shows the last 50 messages of global chat, so a trade or coinflip dispute has nothing to
          point at. This keeps them.
        </p>
      </header>

      {stats && (
        <div className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-slate-500 border-t border-slate-800 pt-4">
          <span className="stencil text-xl text-spray-lime tabular-nums">{stats.total?.toLocaleString() ?? '—'}</span>
          <span>messages</span>
          {stats.oldest && stats.newest && (
            <span className="text-slate-600">· {stamp(stats.oldest)} to {stamp(stats.newest)}</span>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search what was said..."
            className="w-full h-10 bg-obsidian-card border border-slate-800 rounded-md pl-9 pr-3 text-sm text-[#EDEDED] placeholder:text-slate-600 focus:outline-none focus:border-gold-primary/70 transition-colors"
          />
        </label>
        <label className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm pointer-events-none">#</span>
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Player name or ID..."
            className="w-full h-10 bg-obsidian-card border border-slate-800 rounded-md pl-8 pr-3 text-sm text-[#EDEDED] placeholder:text-slate-600 focus:outline-none focus:border-gold-primary/70 transition-colors"
          />
        </label>
        <div className="flex h-10 rounded-md border border-slate-800 bg-obsidian-card overflow-hidden">
          {(['all', 'chat', 'server'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3.5 text-[13px] capitalize transition-colors cursor-pointer ${
                kind === k
                  ? 'bg-spray-lime text-obsidian-deep font-bold'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
              }`}
            >
              {k === 'server' ? 'Trades' : k}
            </button>
          ))}
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2 text-xs text-amber-200/90">
          <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {(gapTotal ?? gaps.length).toLocaleString()} recorded{' '}
            {(gapTotal ?? gaps.length) === 1 ? 'gap' : 'gaps'} in coverage — most recent {stamp(gaps[0].noticed_at)}.
            Messages during a gap were never captured.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="border-t border-slate-800">
        {ctx ? (
          <>
            <div className="flex flex-wrap items-center gap-3 px-2 py-2.5 border-b border-slate-800">
              <button
                type="button"
                onClick={() => { ctxId.current++; setCtx(null); }}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 -ml-1 rounded-md border border-slate-800 bg-obsidian-card hover:bg-obsidian-hover hover:border-slate-700 text-[13px] text-slate-300 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to results
              </button>

              <span className="text-[13px] text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Around {stamp(ctx.anchor.seen_at)} · {ctx.rows.length} messages
              </span>

              <span className="ml-auto flex h-8 rounded-md overflow-hidden border border-slate-800 bg-obsidian-card">
                {SPANS.map((s) => (
                  <button
                    key={s.seconds}
                    type="button"
                    onClick={() => openContext(ctx.anchor, s.seconds)}
                    className={`px-2.5 text-[12px] font-mono transition-colors cursor-pointer ${
                      ctx.seconds === s.seconds
                        ? 'bg-spray-cyan text-obsidian-deep font-bold'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </span>
              {ctxLoading && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
            </div>

            <div className="max-h-[65vh] overflow-y-auto">
              {ctx.rows.map((r) => (
                <Line
                  key={r.msg_id}
                  r={r}
                  highlight={text}
                  anchor={r.msg_id === ctx.anchor.msg_id}
                  innerRef={r.msg_id === ctx.anchor.msg_id ? anchorRef : undefined}
                />
              ))}
            </div>

            <p className="px-3 py-2 border-t border-white/10 text-[10px] text-slate-600 leading-relaxed">
              Everything the archive holds from a {ctx.seconds >= 60 ? `${ctx.seconds / 60}-minute` : `${ctx.seconds}-second`} window
              either side, filters ignored. Messages arriving together share a timestamp, so order within
              the same second is not meaningful.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 px-2 py-2.5 text-[11px] text-slate-600">
              {loading ? 'Searching…' : `${rows.length} shown${total && total > rows.length ? ` of ~${total.toLocaleString()} matching` : ''}`}
              {!loading && rows.length > 0 && <span className="text-slate-700 normal-case tracking-normal">· click a message to see what was said around it</span>}
              {(loading || ctxLoading) && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
            </div>

            {rows.length === 0 && !loading ? (
              <p className="px-3 py-10 text-center text-sm text-slate-600">
                {text || who ? 'Nothing matched that.' : 'No messages archived yet.'}
              </p>
            ) : (
              <div className="max-h-[65vh] overflow-y-auto">
                {rows.map((r) => <Line key={r.msg_id} r={r} highlight={text} onPick={openContext} />)}
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-slate-600 leading-relaxed">
        Every message here was sent in Kirka's public global chat. Timestamps are when the archive received the
        message, not when Kirka sent it. This is a record of what was said — it is not proof of what happened.
      </p>
    </section>
  );
};
