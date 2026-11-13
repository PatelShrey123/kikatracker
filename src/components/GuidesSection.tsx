import { useEffect, useState } from 'react';
import { BookOpen, ArrowLeft, ChevronRight } from 'lucide-react';
import { GUIDES, PAGES } from '../content/site.js';
import { goTo, onContentClick } from '../utils/spaNav';

// Each guide's body is plain HTML (also used by scripts/prerender.mjs for the static pages)
const bodies = import.meta.glob('../content/guides/*.html', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

export function GuidesSection({ slug }: { slug: string | null }) {
  const guide = slug ? GUIDES.find((g) => g.slug === slug) : null;
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    document.title = guide ? `${guide.title} | Kirka Hub` : PAGES.guides.title;
    setHtml(null);
    if (!guide) return;
    const load = bodies[`../content/guides/${guide.slug}.html`];
    load?.().then(setHtml);
  }, [guide]);

  if (slug && !guide) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="display text-4xl text-slate-100">Guide not found</h1>
        <button type="button" onClick={() => goTo('/guides')} className="btn-interactive h-10 px-4 border-2 border-[var(--ink)] bg-[var(--fill-1)] text-[var(--on-fill-1)] font-bold cursor-pointer">
          All guides
        </button>
      </div>
    );
  }

  if (guide) {
    const others = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);
    return (
      <article className="max-w-3xl mx-auto px-4 md:px-6 py-8" onClick={onContentClick}>
        <a href="/guides" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-slate-400 hover:text-gold-bright">
          <ArrowLeft className="w-4 h-4" /> All guides
        </a>
        <h1 className="display text-[38px] md:text-[48px] leading-[1.05] text-slate-100 mt-3">{guide.title}</h1>
        <p className="mt-3 text-[17px] text-slate-400">{guide.description}</p>
        <div className="kh-prose mt-8">{html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-slate-500">Loading…</p>}</div>
        <aside className="mt-12 border-t-2 border-[var(--ink)] pt-6">
          <h2 className="display text-[24px] text-gold-bright">More guides</h2>
          <ul className="mt-3 space-y-2">
            {others.map((g) => (
              <li key={g.slug}>
                <a href={`/guides/${g.slug}`} className="group flex items-center justify-between gap-3 p-3 bg-obsidian-card border-2 border-[var(--ink)] hover:bg-obsidian-hover">
                  <span>
                    <span className="block font-bold text-slate-100">{g.title}</span>
                    <span className="block text-[13px] text-slate-400">{g.description}</span>
                  </span>
                  <ChevronRight className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-gold-bright" />
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </article>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8" onClick={onContentClick}>
      <h1 className="display text-[44px] md:text-[56px] leading-none text-slate-100 flex items-center gap-3">
        <BookOpen className="w-10 h-10 text-gold-bright" /> Kirka guides
      </h1>
      <p className="mt-3 text-[17px] text-slate-400 max-w-2xl">{PAGES.guides.intro[0]}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <a href={`/guides/${g.slug}`} className="group block h-full p-5 bg-obsidian-card border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] hover:bg-obsidian-hover">
              <span className="block display text-[24px] leading-tight text-slate-100 group-hover:text-gold-bright">{g.title}</span>
              <span className="mt-2 block text-[14px] text-slate-400">{g.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
