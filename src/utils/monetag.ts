/**
 * Monetag ads: In-Page Push and Vignette only (no popunder, no multitag).
 * Loaded once, the first time a visitor is on a page that shows ads, so someone who opens the aim
 * trainer or another full-screen tool straight away never gets them there.
 */
const ZONES = [
  { zone: '12252591', src: 'https://nap5k.com/tag.min.js' }, // In-Page Push
  { zone: '12252595', src: 'https://n6wxm.com/vignette.min.js' }, // Vignette
];

let loaded = false;

export function loadMonetag() {
  if (loaded || import.meta.env.DEV) return;
  loaded = true;
  for (const { zone, src } of ZONES) {
    const s = document.createElement('script');
    s.dataset.zone = zone;
    s.src = src;
    s.async = true;
    document.body.appendChild(s);
  }
}
