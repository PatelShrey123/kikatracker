import { ExternalLink } from 'lucide-react';
import { ADS_ENABLED } from './AdSlot';

/** Adsterra Smartlink: it sends the visitor to an advertiser's offer, picked by Adsterra. */
export const SMARTLINK = 'https://araplhn.org/4/2e9790cdd38733d803af1b6cc9984740';

/**
 * A plainly labelled ad card. It never pretends to be part of the site:
 * it says "Sponsored", says it leaves the site, and opens in a new tab.
 */
export function SponsoredCard({ className = '' }: { className?: string }) {
  if (!ADS_ENABLED) return null;
  return (
    <a
      href={SMARTLINK}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={`group block bg-obsidian-card border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] p-3 hover:bg-obsidian-hover transition-colors ${className}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Sponsored</span>
      <span className="mt-1 flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-slate-100 leading-tight">Today&rsquo;s offer from our sponsor</span>
          <span className="block text-[13px] text-slate-400 leading-snug">Opens an advertiser&rsquo;s site in a new tab. It helps keep Kirka Hub free.</span>
        </span>
        <span className="shrink-0 flex items-center gap-1.5 h-9 px-3 bg-[var(--fill-1)] text-[var(--on-fill-1)] border-2 border-[var(--ink)] text-[13px] font-bold group-hover:brightness-110">
          Open <ExternalLink className="w-3.5 h-3.5" />
        </span>
      </span>
    </a>
  );
}
