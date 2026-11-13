import type React from 'react';

/** Move to another address of the app without reloading the page (App listens for popstate). */
export function goTo(href: string) {
  window.history.pushState(null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

/**
 * Click handler for a block of content with plain <a href="/..."> links in it (guides, skin pages):
 * same-site links switch page in place; ctrl/middle clicks and outside links behave normally.
 */
export function onContentClick(e: React.MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest?.('a');
  const href = a?.getAttribute('href');
  if (!a || !href || !href.startsWith('/') || href.startsWith('//') || a.target === '_blank') return;
  if (/\.(html|png|jpe?g|webp|json|txt|xml)$/i.test(href)) return;
  e.preventDefault();
  goTo(href);
}
