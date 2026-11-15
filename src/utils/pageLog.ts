// Reports each page a visitor opens to /api/track, which posts it to the site owner's Discord log
// channel. The site changes pages with history.pushState, so those calls (and Back/Forward) are what
// count as a new page. Sends nothing personal: the path, the page title, the referrer of the first
// page, and a random four-letter tag that ties one visit's pages together.

const VISIT_KEY = 'kh_visit';
let last = '';
let count = 0;
let timer: number | undefined;

function visitTag() {
  try {
    let tag = sessionStorage.getItem(VISIT_KEY);
    if (!tag) {
      tag = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
      sessionStorage.setItem(VISIT_KEY, tag);
    }
    return tag;
  } catch {
    return '????';
  }
}

const DEFAULT_TITLE = 'Kirka Hub —';

function nextCount() {
  try {
    const n = Number(sessionStorage.getItem(`${VISIT_KEY}_n`) || 0) + 1;
    sessionStorage.setItem(`${VISIT_KEY}_n`, String(n));
    return n;
  } catch {
    return count + 1;
  }
}

function report(tries = 0) {
  const path = window.location.pathname.replace(/^\/kikatracker(?=\/|$)/, '') || '/';
  if (path === last) return;
  // a page opened straight from a link still has the site's default title while its data loads
  if (path !== '/' && document.title.startsWith(DEFAULT_TITLE) && tries < 4) {
    timer = window.setTimeout(() => report(tries + 1), 1500);
    return;
  }
  last = path;
  count = nextCount();
  const body = JSON.stringify({
    path,
    title: document.title,
    visit: visitTag(),
    n: count,
    ref: count === 1 ? document.referrer : '',
  });
  try {
    if (navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'text/plain' }))) return;
  } catch {
    /* fall back to fetch */
  }
  fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {});
}

// waits a moment so the new page has set its title (a player's profile puts their name in it)
function reportSoon() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => report(), 1500);
}

export function startPageLog() {
  if (/bot|crawl|spider|headless|lighthouse/i.test(navigator.userAgent)) return;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args);
      reportSoon();
    };
  }
  window.addEventListener('popstate', reportSoon);
  reportSoon();
}
