import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Box, Users, CalendarDays, Gem, Coins, Brush, Gift } from 'lucide-react';
import { skinsFrom, skinStats, describeSkin, similarSkins, slugify, rarityLabel, type SiteSkin, type SkinPrice } from '../content/site.js';
import type { MarketItem } from '../utils/csv';
import { onContentClick } from '../utils/spaNav';

let itemsPromise: Promise<SiteSkin[]> | null = null;
function loadSkins() {
  // from the site root: this page lives at /skin/<name>, so a relative base would point inside /skin/
  const base = import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : '/';
  itemsPromise ||= fetch(`${base}data/items.json`)
    .then((r) => r.json())
    .then((items) => skinsFrom(items))
    .catch(() => {
      itemsPromise = null;
      return [];
    });
  return itemsPromise;
}

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#9ca3af',
  RARE: '#3b82f6',
  EPIC: '#a855f7',
  LEGENDARY: '#f59e0b',
  MYTHICAL: '#ef4444',
  PARANORMAL: '#22d3ee',
};

function priceOf(name: string, prices: Map<string, MarketItem>): SkinPrice | null {
  const p = prices.get(name.toLowerCase());
  if (!p) return null;
  return {
    value: !p.pending && !p.estimated && p.baseValue > 0 ? p.baseValue : null,
    valueText: p.pending ? 'TBD' : null,
    obtainableBy: p.obtainableBy || null,
  };
}

interface Props {
  /** slug or the old-style skin name from the address */
  skinKey: string;
  marketPrices: Map<string, MarketItem>;
  onInspect: (name: string, type?: string) => void;
}

export function SkinPage({ skinKey, marketPrices, onInspect }: Props) {
  const [skins, setSkins] = useState<SiteSkin[] | null>(null);
  useEffect(() => {
    loadSkins().then(setSkins);
  }, []);

  const stats = useMemo(() => (skins ? skinStats(skins) : null), [skins]);
  const slug = slugify(skinKey);
  const skin = skins?.find((s) => s.slug === slug) || null;
  const price = skin ? priceOf(skin.name, marketPrices) : null;

  useEffect(() => {
    if (skin) document.title = `${skin.name} — Kirka ${skin.kind === 'weapon' ? `${skin.weapon} Skin` : 'Character Skin'} Value & Owners | Kirka Hub`;
    else if (skins) document.title = 'Skin not found | Kirka Hub';
  }, [skin, skins]);

  if (!skins || !stats) return <div className="py-32 text-center text-[13px] text-slate-500">Loading…</div>;
  if (!skin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4" onClick={onContentClick}>
        <h1 className="display text-4xl text-slate-100">Skin not found</h1>
        <p className="text-slate-400">No skin called &ldquo;{skinKey}&rdquo; is owned by anyone yet.</p>
        <a href="/prices" className="inline-block h-10 leading-10 px-4 border-2 border-[var(--ink)] bg-[var(--fill-1)] text-[var(--on-fill-1)] font-bold">All skin prices</a>
      </div>
    );
  }

  const paragraphs = describeSkin(skin, price, stats);
  const similar = similarSkins(skin, stats, 8);
  const color = RARITY_COLOR[skin.rarity] || '#9ca3af';
  const facts: { icon: typeof Box; label: string; value: string }[] = [
    { icon: Box, label: skin.kind === 'weapon' ? 'Weapon' : 'Type', value: skin.kind === 'weapon' ? `${skin.weapon} (${skin.slot})` : 'Character skin' },
    { icon: Gem, label: 'Rarity', value: rarityLabel(skin.rarity) },
    { icon: Coins, label: 'Hub Value', value: price?.value ? `${price.value.toLocaleString('en-US')} coins` : price?.valueText || 'Not priced yet' },
    { icon: Users, label: 'Owners', value: skin.owners.toLocaleString('en-US') },
  ];
  if (skin.createdAt) facts.push({ icon: CalendarDays, label: 'Added', value: new Date(skin.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) });
  if (skin.creator) facts.push({ icon: Brush, label: 'Made by', value: skin.creator === 'Kirka' ? 'The Kirka team' : skin.creator });
  if (price?.obtainableBy) facts.push({ icon: Gift, label: 'How to get it', value: price.obtainableBy });

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8" onClick={onContentClick}>
      <nav className="flex flex-wrap items-center gap-1.5 text-[14px] font-bold text-slate-400" aria-label="Breadcrumb">
        <a href="/prices" className="inline-flex items-center gap-1.5 hover:text-gold-bright"><ArrowLeft className="w-4 h-4" /> Skins &amp; prices</a>
        <span>/</span>
        <span>{skin.kind === 'weapon' ? `${skin.weapon} skins` : 'Character skins'}</span>
      </nav>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] items-start">
        <div className="relative aspect-square bg-obsidian-card border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] grid place-items-center p-4" style={{ boxShadow: `4px 4px 0 var(--ink), inset 0 -60px 80px -40px ${color}55` }}>
          {skin.renderUrl ? <img src={skin.renderUrl} alt={`${skin.name} ${skin.kind === 'weapon' ? skin.weapon : 'character'} skin`} className="max-w-full max-h-full object-contain" /> : <Box className="w-16 h-16 text-slate-600" />}
        </div>
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em]" style={{ color }}>{rarityLabel(skin.rarity)} {skin.kind === 'weapon' ? `${skin.weapon} skin` : 'character skin'}</p>
          <h1 className="display text-[44px] md:text-[60px] leading-none text-slate-100 mt-1 break-words">{skin.name}</h1>
          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5 p-2.5 bg-obsidian-card border-2 border-[var(--ink)]">
                <Icon className="w-4 h-4 mt-0.5 shrink-0 text-gold-bright" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
                  <dd className="text-[15px] font-bold text-slate-100 break-words">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={() => onInspect(skin.name, skin.kind === 'weapon' ? skin.weapon : 'Character')}
            className="btn-interactive mt-4 inline-flex items-center gap-2 h-11 px-4 border-2 border-[var(--ink)] bg-[var(--fill-1)] text-[var(--on-fill-1)] font-bold cursor-pointer shadow-[3px_3px_0_var(--ink)]"
          >
            <Box className="w-4 h-4" /> Inspect in 3D
          </button>
        </div>
      </div>

      <section className="kh-prose mt-10 max-w-3xl">
        <h2>About {skin.name}</h2>
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        <p>
          Want to know what decides a price? Read <a href="/guides/how-kirka-skin-values-work">how Kirka skin values work</a>, and check recent deals in the <a href="/trades">trade portal</a> before you trade.
        </p>
      </section>

      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-[28px] text-gold-bright">{skin.kind === 'weapon' ? `More ${skin.weapon} skins` : 'More character skins'}</h2>
          <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {similar.map((s) => (
              <li key={s.slug}>
                <a href={`/skin/${s.slug}`} className="group block p-2 bg-obsidian-card border-2 border-[var(--ink)] hover:bg-obsidian-hover">
                  <span className="block aspect-square grid place-items-center">
                    {s.renderUrl ? <img src={s.renderUrl} alt="" loading="lazy" className="max-w-full max-h-full object-contain" /> : <Box className="w-8 h-8 text-slate-600" />}
                  </span>
                  <span className="mt-1 block text-[14px] font-bold text-slate-100 truncate group-hover:text-gold-bright">{s.name}</span>
                  <span className="block text-[12px]" style={{ color: RARITY_COLOR[s.rarity] }}>{rarityLabel(s.rarity)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
