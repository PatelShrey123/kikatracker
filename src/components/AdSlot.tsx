import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// Google AdSense publisher ID ("ca-pub-...") and the ad unit IDs created under Ads > By ad unit
// Empty: AdSense turned the site down (Nov 2026), so nothing from Google loads. Monetag is in utils/monetag.ts.
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

// Off: Adsterra's banners for this audience were almost all betting ads. Kept so it can be switched
// back on; the ad frame, the subdomain and the keys are all still in place.
const USE_ADSTERRA = false;

// Only the live site: a view from localhost or a preview would count as invalid traffic on the account
const ADSTERRA_HOSTS = ['kirkahub.online', 'www.kirkahub.online'];
const WIDE_SCREEN = '(min-width: 768px)';
// The frame comes from its own subdomain: a different origin, so the ad code can have cookies and storage
// (it doesn't run without them) while still having no way into kirkahub.online itself
const AD_FRAME_ORIGIN = 'https://ads.kirkahub.online';

/**
 * An Adsterra banner, used until AdSense slots exist. It runs in a sandboxed frame on
 * ads.kirkahub.online: being another origin, the ad code can't read the site, and without
 * allow-top-navigation it can't redirect the page. Clicks still open the advertiser in a new tab.
 */
function AdsterraBanner({ className }: { className: string }) {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_SCREEN).matches);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // the frame reports the ad code's errors here, so a missing ad can be explained from the console
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source && e.source === frameRef.current?.contentWindow && typeof e.data?.khAdError === 'string') console.warn('[ad]', e.data.khAdError);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const query = window.matchMedia(WIDE_SCREEN);
    const onChange = () => setWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const live = ADSTERRA_HOSTS.includes(window.location.hostname);
  if (!live && !import.meta.env.DEV) return null;
  const [width, height] = wide ? [728, 90] : [320, 50];

  if (!live) {
    // while developing: an empty box where the ad goes, so the layout can be checked without real ads
    return (
      <div className={`w-full overflow-hidden flex justify-center ${className}`}>
        <div style={{ width, height, maxWidth: '100%' }} className="grid place-items-center border-2 border-dashed border-slate-600 text-[12px] font-bold text-slate-500">
          Ad {width}x{height} (real ads show on kirkahub.online)
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden flex justify-center ${className}`}>
      <iframe
        ref={frameRef}
        key={width}
        title="Advertisement"
        src={`${AD_FRAME_ORIGIN}/ad-frame.html?unit=${width}x${height}`}
        width={width}
        height={height}
        loading="lazy"
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{ border: 0, display: 'block', maxWidth: '100%' }}
      />
    </div>
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
