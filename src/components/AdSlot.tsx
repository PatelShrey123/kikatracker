import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// Google AdSense publisher ID ("ca-pub-...") and the ad unit IDs created under Ads > By ad unit
// Empty: AdSense turned the site down (Nov 2026), so nothing from Google loads; Adsterra fills the slots.
export const ADSENSE_CLIENT = '';
export const AD_SLOTS = {
  topBanner: '',
  bottomBanner: '',
} as const;

let scriptRequested = false;
function loadAdSense() {
  if (scriptRequested || !ADSENSE_CLIENT || document.querySelector('script[src*="adsbygoogle.js"]')) return;
  scriptRequested = true;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(script);
}

interface AdSlotProps {
  slot: string;
  className?: string;
}

// Every ad on the site (banners, side strips, boxes, native, Social Bar, Smartlink) is behind this switch.
// Off since 13 Nov 2026. Turning it back on also needs the Social Bar tag restored in index.html.
export const ADS_ENABLED = false;
const USE_ADSTERRA = ADS_ENABLED;

// Only the live site: a view from localhost or a preview would count as invalid traffic on the account
const ADSTERRA_HOSTS = ['kirkahub.online', 'www.kirkahub.online'];
// The frame comes from its own subdomain: a different origin, so the ad code can have cookies and storage
// (it doesn't run without them) while still having no way into kirkahub.online itself
const AD_FRAME_ORIGIN = 'https://ads.kirkahub.online';

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const q = window.matchMedia(query);
    const onChange = () => setMatches(q.matches);
    onChange();
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * One Adsterra banner of a given size. It runs in a sandboxed frame on ads.kirkahub.online: being
 * another origin, the ad code can't read the site, and without allow-top-navigation it can't redirect
 * the page. Clicks still open the advertiser in a new tab. Off the live site it's a dashed box.
 */
function AdFrame({ width, height }: { width: number; height: number }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  // the frame reports the ad code's errors here, so a missing ad can be explained from the console
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source && e.source === frameRef.current?.contentWindow && typeof e.data?.khAdError === 'string') console.warn('[ad]', e.data.khAdError);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const live = ADSTERRA_HOSTS.includes(window.location.hostname);
  if (!live) {
    if (!import.meta.env.DEV) return null;
    // while developing: an empty box where the ad goes, so the layout can be checked without real ads
    return (
      <div style={{ width, height, maxWidth: '100%' }} className="grid place-items-center p-1 text-center border-2 border-dashed border-slate-600 bg-obsidian-dark/60 text-[12px] font-bold text-slate-500">
        Ad {width}x{height}
      </div>
    );
  }
  return (
    <iframe
      ref={frameRef}
      key={`${width}x${height}`}
      title="Advertisement"
      src={`${AD_FRAME_ORIGIN}/ad-frame.html?unit=${width}x${height}`}
      width={width}
      height={height}
      loading="lazy"
      scrolling="no"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ border: 0, display: 'block', maxWidth: '100%' }}
    />
  );
}

/** Top and bottom strip: 728x90 on computers, 468x60 on tablets, 320x50 on phones. */
function AdsterraBanner({ className }: { className: string }) {
  const wide = useMedia('(min-width: 768px)');
  const medium = useMedia('(min-width: 500px)');
  const [width, height] = wide ? [728, 90] : medium ? [468, 60] : [320, 50];
  return (
    <div className={`w-full overflow-hidden flex justify-center ${className}`}>
      <AdFrame width={width} height={height} />
    </div>
  );
}

/** A 300x250 box for space inside a page. */
export function BoxAd({ className = '' }: { className?: string }) {
  if (!USE_ADSTERRA) return null;
  if (!ADSTERRA_HOSTS.includes(window.location.hostname) && !import.meta.env.DEV) return null;
  return (
    <div className={`flex justify-center ${className}`}>
      <AdFrame width={300} height={250} />
    </div>
  );
}

/** Screens wide enough for a 160px strip down each side; App narrows the page by the same amount. */
export const SIDE_RAILS_QUERY = '(min-width: 1536px)';

/** 160x600 down both sides of big screens (160x300 when the window is short), below the menu bar. */
export function SideRails() {
  const on = useMedia(SIDE_RAILS_QUERY);
  const tall = useMedia('(min-height: 780px)');
  if (!USE_ADSTERRA || !on) return null;
  if (!ADSTERRA_HOSTS.includes(window.location.hostname) && !import.meta.env.DEV) return null;
  const [width, height] = tall ? [160, 600] : [160, 300];
  return (
    <>
      <div className="fixed left-2 top-[92px] z-30"><AdFrame width={width} height={height} /></div>
      <div className="fixed right-2 top-[92px] z-30"><AdFrame width={width} height={height} /></div>
    </>
  );
}

// Remount (via a changing `key`) on route change so AdSense requests a fresh ad for the new page
export function AdSlot({ slot, className = '' }: AdSlotProps) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot || !ref.current) return;
    loadAdSense();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense throws if the slot was already filled; safe to ignore
    }
  }, [slot]);

  if (!ADSENSE_CLIENT || !slot) return USE_ADSTERRA ? <AdsterraBanner className={className} /> : null;

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}

/**
 * Adsterra native banner (a row of picture + headline ads) for empty space inside a page. Same
 * sandboxed frame as the banners; the frame reports its height, and nothing shows until an ad has.
 */
export function NativeAd({ className = '' }: { className?: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!e.source || e.source !== frameRef.current?.contentWindow) return;
      const h = Number(e.data?.khAdHeight);
      if (Number.isFinite(h)) setHeight(Math.min(Math.max(0, Math.round(h)), 1200));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!USE_ADSTERRA) return null;
  const live = ADSTERRA_HOSTS.includes(window.location.hostname);
  if (!live) {
    if (!import.meta.env.DEV) return null;
    return (
      <div className={`grid place-items-center h-[180px] border-2 border-dashed border-slate-600 text-[12px] font-bold text-slate-500 ${className}`}>
        Native ad (real ads show on kirkahub.online)
      </div>
    );
  }

  // a 1px frame while it loads, so the ad code still runs, then the ad's own height
  const shown = height > 8;
  return (
    <div className={shown ? className : ''}>
      {shown && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Sponsored</p>}
      <iframe
        ref={frameRef}
        title="Advertisement"
        src={`${AD_FRAME_ORIGIN}/ad-frame.html?unit=native`}
        width="100%"
        height={shown ? height : 1}
        loading="lazy"
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{ border: 0, display: 'block', width: '100%', opacity: shown ? 1 : 0 }}
      />
    </div>
  );
}

const SOCIAL_BAR_SRC = 'https://bauval.org/14/5822c776b2a34c6b7007b85a61196089';

/** Adsterra Social Bar. index.html starts it on page load; this covers a visitor who began on an ad-free page. */
export function loadSocialBar() {
  if (!USE_ADSTERRA || !ADSTERRA_HOSTS.includes(window.location.hostname)) return;
  if (document.querySelector(`script[src="${SOCIAL_BAR_SRC}"]`)) return;
  const s = document.createElement('script');
  s.dataset.cfasync = 'false';
  s.src = SOCIAL_BAR_SRC;
  document.body.appendChild(s);
}
