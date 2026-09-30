import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TargetCursor } from './components/TargetCursor';
import { LoadingScreen } from './components/LoadingScreen';
import { Navbar } from './components/Navbar';
import { SearchSection } from './components/SearchSection';
import { UserProfileTab } from './components/UserProfileTab';
import { DailySection } from './components/DailySection';
import { RankedSection } from './components/RankedSection';
import { ClansSection } from './components/ClansSection';
import { ChatSection } from './components/ChatSection';
import { TradesSection } from './components/TradesSection';
import { ItemInspectModal } from './components/ItemInspectModal';
import { PriceViewerSection } from './components/PriceViewerSection';
import { BotSection } from './components/BotSection';
import { PlayerCountSection } from './components/PlayerCountSection';
// three.js, GLTFLoader, OrbitControls and skinview3d together are most of the bundle, and
// only these three pages need them. Loading them on demand keeps them off every other page.
const RendersSection = lazy(() => import('./components/RendersSection').then(m => ({ default: m.RendersSection })));
const FitSection = lazy(() => import('./components/FitSection').then(m => ({ default: m.FitSection })));
const ReloadLab = lazy(() => import('./components/ReloadLab').then(m => ({ default: m.ReloadLab })));
import { ChangelogsSection } from './components/ChangelogsSection';
import { ChatLogsSection } from './components/ChatLogsSection';
import { OfflineWeaponRenderer } from './components/OfflineWeaponRenderer';
import { AdSlot, AD_SLOTS } from './components/AdSlot';
import { fetchUserProfile, fetchAllPublicItems } from './utils/api';
import type { UserProfile } from './utils/api';
import { fetchAndParsePrices } from './utils/csv';
import type { MarketItem } from './utils/csv';
import { getCachedCatalog, syncAndStoreCatalog, catalogCacheAgeMs } from './utils/catalogCache';
import { useCursorMode } from './hooks/useCursorMode';

function App() {
  const { isCustomCursor, toggleCursorMode } = useCursorMode();
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<string>('search');
  const [activeUserProfile, setActiveUserProfile] = useState<UserProfile | null>(null);
  const [marketPrices, setMarketPrices] = useState<Map<string, MarketItem>>(new Map());
  const [publicItems, setPublicItems] = useState<any[]>(() => getCachedCatalog() || []);
  const [fallbackRenders] = useState<Record<string, any>>({});
  const [allItemData, setAllItemData] = useState<any[]>(() => getCachedCatalog() || []);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeClanName, setActiveClanName] = useState<string | null>(null);
  const [fitPlayerId, setFitPlayerId] = useState<string | null>(() => {
    const match = window.location.pathname.match(/\/(?:3d)?fit\/([^/]+)/);
    return match ? decodeURIComponent(match[1]).replace('#', '') : null;
  });

  // Inspect item modal state
  const [inspectItem, setInspectItem] = useState<{
    name: string;
    type?: string;
    amount?: number;
    textureUrl?: string | null;
  } | null>(null);

  // Sync pricing data and handle loader lifecycle on mount
  useEffect(() => {
    // 1. Fetch JSON Google Sheet prices from OpenSheet API
    fetchAndParsePrices().then((priceMap) => {
      setMarketPrices(priceMap);
    });

    // 2. Keep the skin catalog current — but only when it actually needs it.
    //
    //    This used to fetch all ~2,000 items on every single page load. That request takes
    //    seconds (25s was measured on a cold load), and because a browser allows only six
    //    connections to a host at once, it sat in front of the profile the visitor had just
    //    clicked. The page looked frozen while it waited on a catalog nobody had asked for.
    //
    //    The catalog is already in state from cache on the line above. It only changes when
    //    Kirka ships a skin, so re-reading it more than a few times a day buys nothing.
    const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
    const age = catalogCacheAgeMs();
    const needsRefresh = age === null || age > REFRESH_AFTER_MS;

    let catalogTimer: number | undefined;
    if (needsRefresh) {
      // Deferred so it starts after the first paint and whatever the visitor came for, rather
      // than racing it for a connection.
      catalogTimer = window.setTimeout(() => {
        fetchAllPublicItems().then((items) => {
          if (Array.isArray(items) && items.length > 0) {
            const { merged, newCount } = syncAndStoreCatalog(items);
            setPublicItems(merged);
            setAllItemData(merged);
            console.log(
              newCount > 0
                ? `[AutoSync] ${newCount} new skin(s) found. Catalog now ${merged.length}.`
                : `[AutoSync] Catalog up to date, ${merged.length} skins.`
            );
          }
        });
      }, 2500);
    } else {
      console.log(`[AutoSync] Catalog cache is ${Math.round(age / 60000)} min old — skipping fetch.`);
    }

    // 3. A short hold so the first paint is not a flash of half-built page. Nothing is being
    //    waited on here - the catalog above resolves on its own and the app renders without it -
    //    so this is kept deliberately brief rather than timed to an animation.
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);

    return () => {
      clearTimeout(timer);
      if (catalogTimer) clearTimeout(catalogTimer);
    };
  }, []);

  // Helper to parse path and return resolved routing state
  const parsePath = () => {
    const path = window.location.pathname;
    const cleanPath = path.replace(/^\/kikatracker/, '');
    
    if (cleanPath.startsWith('/player/')) {
      const id = cleanPath.split('/player/')[1];
      const decodedId = decodeURIComponent(id).toUpperCase().replace('#', '');
      const targetId = decodedId === 'WEATIE' ? 'FUYR7K' : id;
      return { tab: 'search', player: targetId, clan: null, skin: null };
    }
    if (cleanPath.startsWith('/inventory/')) {
      const id = cleanPath.split('/inventory/')[1];
      const decodedId = decodeURIComponent(id).toUpperCase().replace('#', '');
      const targetId = decodedId === 'WEATIE' ? 'FUYR7K' : id;
      return { tab: 'search', player: targetId, clan: null, skin: null };
    }
    if (cleanPath.startsWith('/clan/')) {
      const name = cleanPath.split('/clan/')[1];
      return { tab: 'clans', player: null, clan: name, skin: null };
    }
    if (cleanPath.startsWith('/skin/')) {
      const skinName = cleanPath.split('/skin/')[1];
      return { tab: 'prices', player: null, clan: null, skin: decodeURIComponent(skinName) };
    }
    if (/^\/(3d)?fit(\/|$)/.test(cleanPath)) {
      return { tab: 'fit', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/reloadlab') {
      return { tab: 'reloadlab', player: null, clan: null, skin: null };
    }
    // unlisted: reachable by URL, deliberately absent from the navbar and the sitemap
    if (cleanPath === '/players' || cleanPath === '/playercount') {
      return { tab: 'players', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/changelogs') {
      return { tab: 'changelogs', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/chatlogs') {
      return { tab: 'chatlogs', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/renders' || cleanPath === '/3drenders') {
      return { tab: 'renders', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/trades') {
      return { tab: 'trades', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/daily') {
      return { tab: 'daily', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/ranked') {
      return { tab: 'ranked', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/chat') {
      return { tab: 'chat', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/prices') {
      return { tab: 'prices', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/bot') {
      return { tab: 'bot', player: null, clan: null, skin: null };
    }
    return { tab: 'search', player: null, clan: null, skin: null };
  };

  // Handle URL history state navigation
  const navigate = (tab: string, player: string | null = null, clan: string | null = null) => {
    let path = '/';
    if (player) {
      path = `/player/${player}`;
    } else if (clan) {
      path = `/clan/${clan}`;
    } else if (tab !== 'search') {
      path = `/${tab}`;
    }

    const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
    const finalPath = prefix + path;

    window.history.pushState(null, '', finalPath);

    setActiveTab(tab);
    if (player) {
      handlePlayerSearchDirect(player);
    } else {
      setActiveUserProfile(null);
    }
    if (clan) {
      setActiveClanName(clan);
    } else {
      setActiveClanName(null);
    }
  };

  const handleInspectItem = useCallback((name: string, type?: string, amount?: number, textureUrl?: string | null) => {
    setInspectItem({ name, type, amount: amount || 1, textureUrl });
  }, []);

  const handleSelectClanFromProfile = useCallback((clanName: string) => {
    navigate('clans', null, clanName);
  }, []);

  const handleProfileBack = useCallback(() => {
    navigate('search');
    setSearchError(null);
  }, []);

  const handleOpenFitFromProfile = useCallback((shortId: string) => {
    const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
    window.history.pushState(null, '', `${prefix}/fit/${shortId}`);
    setFitPlayerId(shortId);
    setActiveUserProfile(null);
    setActiveTab('fit');
  }, []);

  // Sync back/forward browser actions
  useEffect(() => {
    const handlePopState = () => {
      const state = parsePath();
      setActiveTab(state.tab);
      if (state.player) {
        setSearchLoading(true);
        fetchUserProfile(state.player, state.player.length === 6)
          .then((profile) => {
            setActiveUserProfile(profile);
            setSearchError(null);
          })
          .catch(() => {
            setSearchError('Player profile not found.');
          })
          .finally(() => {
            setSearchLoading(false);
          });
      } else {
        setActiveUserProfile(null);
      }
      if (state.clan) {
        setActiveClanName(state.clan);
      } else {
        setActiveClanName(null);
      }
      if (state.skin) {
        setInspectItem({ name: state.skin });
        setActiveTab('prices');
      } else {
        setInspectItem(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load initial route on startup after base configs complete
  useEffect(() => {
    const initRouting = async () => {
      const state = parsePath();
      if (state.tab) {
        setActiveTab(state.tab);
      }
      if (state.player) {
        setSearchLoading(true);
        try {
          const profile = await fetchUserProfile(state.player, state.player.length === 6);
          setActiveUserProfile(profile);
          setActiveTab('search');
        } catch (err: any) {
          const msg = err?.message || '';
          if (msg.includes('status 500') || msg.includes('status 502') || msg.includes('status 503')) {
            setSearchError('⚠️ Kirka.io API Outage: The profile database is currently offline (returned status 500). Please try again later!');
          } else {
            setSearchError('Player profile not found.');
          }
        } finally {
          setSearchLoading(false);
        }
      }
      if (state.clan) {
        setActiveClanName(state.clan);
        setActiveTab('clans');
      }
      if (state.skin) {
        setInspectItem({ name: state.skin });
        setActiveTab('prices');
      }
    };

    initRouting();
  }, []);

  // Dynamic SEO Document Title Manager
  useEffect(() => {
    if (activeUserProfile) {
      document.title = `${activeUserProfile.name} (#${activeUserProfile.shortId}) — Kirka Profile, Stats & Inventory | Kirka Hub`;
      return;
    }
    if (activeClanName) {
      document.title = `[${activeClanName}] Clan Roster & Stats — Kirka Hub`;
      return;
    }

    switch (activeTab) {
      case 'search':
        document.title = 'Kirka Hub — Kirka.io Tracker, Player Profile & Inventory Value';
        break;
      case 'prices':
        document.title = 'Kirka Market Prices & Weapon Skin Value List | Kirka Hub';
        break;
      case 'trades':
        document.title = 'Kirka Live Trades & Market Exchange | Kirka Hub';
        break;
      case 'clans':
        document.title = 'Kirka Clan Registry & Leaderboard Rankings | Kirka Hub';
        break;
      case 'players':
        document.title = 'Kirka Player Count by Region | Kirka Hub';
        break;
      case 'ranked':
        document.title = 'Kirka Ranked S&D Leaderboards & ELO Ladder | Kirka Hub';
        break;
      case 'daily':
        document.title = 'Kirka Daily Competitors & Top Scores | Kirka Hub';
        break;
      case 'fit':
        document.title = 'Kirka 3D Fit Viewer — Flex Your Loadout | Kirka Hub';
        break;
      case 'renders':
        document.title = 'Kirka 3D Weapon Skins & Character Renders | Kirka Hub';
        break;
      case 'chat':
        document.title = 'Kirka Live Global Chat & Player Lobby | Kirka Hub';
        break;
      case 'bot':
        document.title = 'Kirka Discord Bot & Slash Commands | Kirka Hub';
        break;
      default:
        document.title = 'Kirka Hub — Kirka.io Tracker, Player Profile & Inventory Value';
    }
  }, [activeTab, activeUserProfile, activeClanName]);

  const handlePlayerSearch = async (id: string, isShortId: boolean) => {
    let searchId = id.trim();
    let searchIsShortId = isShortId;
    if (searchId.toUpperCase().replace('#', '') === 'WEATIE') {
      searchId = 'FUYR7K';
      searchIsShortId = true;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const profile = await fetchUserProfile(searchId, searchIsShortId);
      if (!profile || !profile.name) {
        throw new Error('Player not found.');
      }
      setActiveUserProfile(profile);
      
      const queryId = searchIsShortId ? profile.shortId : profile.id;
      const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
      window.history.pushState(null, '', prefix + '/player/' + queryId);
      
      setActiveTab('search'); 
    } catch (err: any) {
      console.error('Search failed:', err);
      const msg = err?.message || '';
      if (msg.includes('status 500') || msg.includes('status 502') || msg.includes('status 503')) {
        setSearchError('⚠️ Kirka.io API Outage: The profile database is currently offline (returned status 500). Please try again later!');
      } else {
        setSearchError('Player profile not found. Make sure the ID is correct.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePlayerSearchDirect = async (id: string) => {
    let searchId = id.trim();
    if (searchId.toUpperCase().replace('#', '') === 'WEATIE') {
      searchId = 'FUYR7K';
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const profile = await fetchUserProfile(searchId, searchId.length === 6);
      if (!profile || !profile.name) {
        throw new Error('Player not found.');
      }
      setActiveUserProfile(profile);
    } catch (err: any) {
      console.error('Search failed:', err);
      const msg = err?.message || '';
      if (msg.includes('status 500') || msg.includes('status 502') || msg.includes('status 503')) {
        setSearchError('⚠️ Kirka.io API Outage: The profile database is currently offline (returned status 500). Please try again later!');
      } else {
        setSearchError('Player profile not found. Make sure the ID is correct.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  // Select tab and clear sub-states
  const handleTabChange = (tab: string) => {
    navigate(tab);
  };

  if (typeof window !== 'undefined' && window.location.search.includes('render_weapons=1')) {
    return <OfflineWeaponRenderer />;
  }

  return (
    <div className="relative min-h-screen bg-obsidian-deep text-slate-100 flex flex-col md:flex-row selection:bg-gold-primary/30 selection:text-gold-bright">
      {/* React Bits TargetCursor — visitors can swap back to their system pointer from the sidebar */}
      {isCustomCursor && (
        <TargetCursor
          targetSelector="button, a, input, select, textarea, [role='button'], .cursor-pointer, .card-interactive, .btn-interactive"
          spinDuration={2}
          hideDefaultCursor={true}
          parallaxOn={true}
          cursorColor="#BFA46F"
          cursorColorOnTarget="#D8C29A"
        />
      )}

      {/* 2. Full-screen custom loader */}
      <LoadingScreen isLoading={isLoading} />

      {!isLoading && (() => {
        // No ads in full-screen editing tools
        const showAds = !['reloadlab'].includes(activeTab);
        const adRouteKey = activeTab + (activeTab === 'search' ? (activeUserProfile ? '-profile' : '-input') : '') + (activeTab === 'fit' ? fitPlayerId ?? '' : '');
        return (
        <>
          {/* 3. Left Sidebar (Desktop) & Floating Navbar (Mobile) */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            isCustomCursor={isCustomCursor}
            toggleCursorMode={toggleCursorMode}
          />

          {/* 4. Core Content Area with Left Padding on Desktop */}
          <div className="flex-grow flex flex-col min-h-screen md:pl-60 pb-24 md:pb-0">
            
            {/* The desktop header used to repeat the sidebar's logo and wordmark, alongside a
                pulsing "Node Sync Online" dot that was not wired to anything. Both are gone: the
                sidebar already says whose site this is, and a status light should only exist if
                it can actually go red. */}

            {/* Ad: top banner, above page content (never inside profiles, skins or tools) */}
            {showAds && <AdSlot key={`top-${adRouteKey}`} slot={AD_SLOTS.topBanner} className="pt-4 px-4" />}

            <main className="flex-grow">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab + (activeTab === 'search' ? (activeUserProfile ? '-profile' : '-input') : '')}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="w-full"
                  data-tab={activeTab}
                >
                  {/* The 3D pages load on demand; this covers the moment their chunk arrives. */}
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-32 text-[13px] text-slate-500">
                        Loading…
                      </div>
                    }
                  >
                  {activeTab === 'search' && (
                    <>
                      {activeUserProfile ? (
                        <UserProfileTab
                          profile={activeUserProfile}
                          marketPrices={marketPrices}
                          fallbackRenders={fallbackRenders}
                          allItemData={allItemData}
                          onInspectItem={handleInspectItem}
                          onSelectClan={handleSelectClanFromProfile}
                          onBack={handleProfileBack}
                          onOpenFit={handleOpenFitFromProfile}
                        />
                      ) : (
                        <SearchSection
                          onSearch={handlePlayerSearch}
                          isLoading={searchLoading}
                          searchError={searchError}
                          onClearError={() => setSearchError(null)}
                          onNavigateToPrices={() => handleTabChange('prices')}
                          onNavigate={handleTabChange}
                        />
                      )}
                    </>
                  )}

                  {activeTab === 'daily' && (
                    <DailySection onSelectPlayer={handlePlayerSearch} />
                  )}

                  {activeTab === 'ranked' && (
                    <RankedSection onSelectPlayer={handlePlayerSearch} />
                  )}

                  {activeTab === 'clans' && (
                    <ClansSection
                      onSelectPlayer={handlePlayerSearch}
                      activeClanName={activeClanName}
                      onClearActiveClanName={() => navigate('clans')}
                      onSelectClan={(name) => navigate('clans', null, name)}
                      fallbackRenders={fallbackRenders}
                      allItemData={allItemData}
                    />
                  )}

                  {activeTab === 'trades' && (
                    <TradesSection
                      onSelectPlayer={handlePlayerSearch}
                      marketPrices={marketPrices}
                      allItemData={allItemData}
                      fallbackRenders={fallbackRenders}
                      onInspectItem={handleInspectItem}
                    />
                  )}

                  {activeTab === 'chat' && (
                    <ChatSection
                      onSelectPlayer={handlePlayerSearch}
                      marketPrices={marketPrices}
                      publicItems={publicItems}
                      fallbackRenders={fallbackRenders}
                      onInspectItem={handleInspectItem}
                    />
                  )}

                  {activeTab === 'prices' && (
                    <PriceViewerSection
                      marketPrices={marketPrices}
                      publicItems={publicItems}
                      fallbackRenders={fallbackRenders}
                      allItemData={allItemData}
                      onInspectItem={handleInspectItem}
                    />
                  )}
                  {activeTab === 'bot' && (
                    <BotSection />
                  )}
                  {activeTab === 'players' && (
                    <PlayerCountSection />
                  )}
                  {activeTab === 'fit' && (
                    <FitSection
                      key={fitPlayerId ?? 'empty'}
                      initialPlayerId={fitPlayerId}
                      catalog={allItemData}
                      onPlayerLoaded={(shortId) => {
                        const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
                        window.history.replaceState(null, '', `${prefix}/fit/${shortId}${window.location.search}`);
                      }}
                      onInspectItem={handleInspectItem}
                    />
                  )}

                  {activeTab === 'reloadlab' && (
                    <ReloadLab catalog={allItemData} />
                  )}

                  {activeTab === 'changelogs' && <ChangelogsSection />}

                  {activeTab === 'chatlogs' && <ChatLogsSection />}

                  {activeTab === 'renders' && (
                    <RendersSection
                      publicItems={publicItems}
                      marketPrices={marketPrices}
                      fallbackRenders={fallbackRenders}
                      allItemData={allItemData}
                    />
                  )}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Ad: bottom banner, after all page content */}
            {showAds && <AdSlot key={`bottom-${adRouteKey}`} slot={AD_SLOTS.bottomBanner} className="py-4 px-4" />}

            {/* 5. Sleek footer */}
            <footer className="py-6 border-t border-obsidian-border/50 text-center text-xs text-slate-600 font-mono flex-shrink-0">
              <div className="max-w-7xl mx-auto px-4">
                <span>© 2026 XPERT TRACKER • Kirka.io Community Tool • Valuation Index: Hub Valuation • <a href="/privacy.html" className="hover:text-slate-400 underline">Privacy Policy</a></span>
              </div>
            </footer>
          </div>

          {/* 6. Item Details Inspection Modal overlay */}
          <ItemInspectModal
            isOpen={inspectItem !== null}
            onClose={() => setInspectItem(null)}
            itemName={inspectItem?.name || ''}
            itemType={inspectItem?.type || ''}
            initialTextureUrl={inspectItem?.textureUrl || null}
            inventoryAmount={inspectItem?.amount || 1}
            marketPrices={marketPrices}
            allItemData={allItemData}
            fallbackRenders={fallbackRenders}
          />
        </>
        );
      })()}
    </div>
  );
}

export default App;
