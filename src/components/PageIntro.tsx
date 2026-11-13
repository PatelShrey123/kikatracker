import { PAGES } from '../content/site.js';
import { onContentClick } from '../utils/spaNav';

/** A short written introduction under a page's tool: what it is and how to use it (same text as the static page). */
export function PageIntro({ tab }: { tab: string }) {
  const info = PAGES[tab];
  if (!info) return null;
  return (
    <section className="max-w-[1600px] mx-auto px-4 md:px-8 pt-10 pb-2" onClick={onContentClick} aria-labelledby={`about-${tab}`}>
      <div className="kh-prose max-w-3xl border-t-2 border-[var(--ink)] pt-6">
        <h2 id={`about-${tab}`}>About {info.heading}</h2>
        {info.intro.map((p, i) => <p key={i}>{p}</p>)}
        <p className="text-[14px]">
          More help in the <a href="/guides">Kirka guides</a>.
        </p>
      </div>
    </section>
  );
}
