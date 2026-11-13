/**
 * Monetag ads: In-Page Push and Vignette only (no popunder, no multitag).
 * In-Page Push (the small box in the top right) runs on every page. The Vignette is only started from
 * pages that aren't full-screen tools, so someone who goes straight to one never gets it there.
 */
const IN_PAGE_PUSH = { zone: '12252591', src: 'https://nap5k.com/tag.min.js' };
const VIGNETTE = { zone: '12252595', src: 'https://n6wxm.com/vignette.min.js' };

const loaded = new Set<string>();

function load({ zone, src }: { zone: string; src: string }) {
  // index.html usually started it already (Monetag's install check needs the tag in the page's <head>)
  if (loaded.has(zone) || import.meta.env.DEV || document.querySelector(`script[data-zone="${zone}"]`)) return;
  loaded.add(zone);
  const s = document.createElement('script');
  s.dataset.zone = zone;
  s.src = src;
  s.async = true;
  document.body.appendChild(s);
}

export function loadMonetag({ vignette }: { vignette: boolean }) {
  load(IN_PAGE_PUSH);
  if (vignette) load(VIGNETTE);
}
