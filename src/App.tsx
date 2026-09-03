import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TargetCursor } from './components/TargetCursor';
import { ClickSpark } from './components/ClickSpark';
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
import { CompareSection } from './components/CompareSection';
import { BotSection } from './components/BotSection';
import { ClientDownloadSection } from './components/ClientDownloadSection';
import { ClanTrackerSection } from './components/ClanTrackerSection';
import { fetchUserProfile, fetchAllPublicItems } from './utils/api';
import type { UserProfile } from './utils/api';
import { fetchAndParsePrices } from './utils/csv';
import type { MarketItem } from './utils/csv';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('search');
  const [activeUserProfile, setActiveUserProfile] = useState<UserProfile | null>(null);
  const [marketPrices, setMarketPrices] = useState<Map<string, MarketItem>>(new Map());
  const [publicItems, setPublicItems] = useState<any[]>([]);
  const [fallbackRenders, setFallbackRenders] = useState<Record<string, any>>({});
  const [allItemData, setAllItemData] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeClanName, setActiveClanName] = useState<string | null>(null);
  
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

    // 2. Fetch public items list from official Kirka API (1873 skins with live textureUrl & renderUrl)
    fetchAllPublicItems().then((items) => {
      if (Array.isArray(items) && items.length > 0) {
        setPublicItems(items);
        setAllItemData((prev) => {
          const map = new Map();
          if (Array.isArray(prev)) {
            prev.forEach((i) => i?.id && map.set(i.id, i));
          }
          items.forEach((i) => {
            if (i?.id) {
              map.set(i.id, { ...(map.get(i.id) || {}), ...i });
            }
          });
          return Array.from(map.values());
        });
        console.log(`Loaded ${items.length} live skins directly from official Kirka API.`);
      }
    });

    // 3. Fetch fallback skin renders from Github repo JSON
    fetch('https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/main/AllrendersAndTextures.json')
      .then((r) => r.json())
      .then((data) => {
        const normalized: Record<string, any> = {};
        Object.entries(data).forEach(([key, val]) => {
          normalized[key.toLowerCase()] = val;
        });
        setFallbackRenders(normalized);
        console.log('Successfully loaded fallback renders repository.');
      })
      .catch((err) => console.error('Failed to load fallback renders:', err));

    // 4. Fetch complete skins metadata database from GitHub for extra metadata
    fetch('https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/AllItemData.json')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAllItemData((prev) => {
            const map = new Map();
            data.forEach((i) => i?.id && map.set(i.id, i));
            if (Array.isArray(prev)) {
              // Preserve official live API items over static GitHub file
              prev.forEach((i) => i?.id && map.set(i.id, { ...(map.get(i.id) || {}), ...i }));
            }
            return Array.from(map.values());
          });
          console.log('Successfully loaded complete skins metadata database.');
        }
      })
      .catch((err) => console.error('Failed to load item metadata:', err));

    // 5. Minimum loading duration to showcase esports brand loader animations
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4800);

    return () => clearTimeout(timer);
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
    if (cleanPath === '/clantracker') {
      return { tab: 'clantracker', player: null, clan: null, skin: null };
    }
    if (cleanPath.startsWith('/skin/')) {
      const skinName = cleanPath.split('/skin/')[1];
      return { tab: 'prices', player: null, clan: null, skin: decodeURIComponent(skinName) };
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
    if (cleanPath.startsWith('/compare')) {
      return { tab: 'compare', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/bot') {
      return { tab: 'bot', player: null, clan: null, skin: null };
    }
    if (cleanPath === '/client') {
      return { tab: 'client', player: null, clan: null, skin: null };
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

  return (
    <div className="relative min-h-screen bg-obsidian-deep text-slate-100 flex flex-col md:flex-row selection:bg-gold-primary/30 selection:text-gold-bright">
      {/* React Bits TargetCursor */}
      <TargetCursor 
        targetSelector="button, a, input, select, textarea, [role='button'], .cursor-pointer, .card-interactive, .btn-interactive"
        spinDuration={2}
        hideDefaultCursor={true}
        parallaxOn={true}
        cursorColor="#d4af37"
        cursorColorOnTarget="#ffd700"
      />

      {/* React Bits ClickSpark click effect */}
      <ClickSpark
        sparkColor="#ffd700"
        sparkSize={10}
        sparkRadius={20}
        sparkCount={8}
        duration={500}
      />

      {/* 2. Full-screen custom loader */}
      <LoadingScreen isLoading={isLoading} />

      {!isLoading && (
        <>
          {/* 3. Left Sidebar (Desktop) & Floating Navbar (Mobile) */}
          <Navbar activeTab={activeTab} setActiveTab={handleTabChange} />

          {/* 4. Core Content Area with Left Padding on Desktop */}
          <div className="flex-grow flex flex-col min-h-screen md:pl-64 pb-24 md:pb-0">
            
            {/* Logo bar at the top of content page */}
            <header className="hidden md:flex items-center justify-between h-14 px-8 border-b border-obsidian-border/50 bg-[#05060b]/40 backdrop-blur-sm sticky top-0 z-30 flex-shrink-0 select-none">
              <div className="flex items-center space-x-2.5">
                <img
                  src="kikatracker_mascot.png"
                  alt="Mascot Logo"
                  className="w-7 h-7 rounded-lg border border-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                />
                <span className="text-xs font-black tracking-widest text-slate-300">XPERT TRACKER</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Node Sync Online</span>
              </div>
            </header>

            <main className="flex-grow">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab + (activeTab === 'search' ? (activeUserProfile ? '-profile' : '-input') : '')}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="w-full"
                >
                  {activeTab === 'search' && (
                    <>
                      {activeUserProfile ? (
                        <UserProfileTab
                          profile={activeUserProfile}
                          marketPrices={marketPrices}
                          fallbackRenders={fallbackRenders}
                          allItemData={allItemData}
                          onInspectItem={(name, type, amount, textureUrl) => {
                            setInspectItem({ name, type, amount, textureUrl });
                          }}
                          onSelectClan={(clanName) => {
                            navigate('clans', null, clanName);
                          }}
                          onBack={() => {
                            navigate('search');
                            setSearchError(null);
                          }}
                          onCompare={(id, type) => {
                            const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
                            window.history.pushState(null, '', `${prefix}/compare?p1=${id}&type=${type}`);
                            setActiveTab('compare');
                          }}
                        />
                      ) : (
                        <SearchSection
                          onSearch={handlePlayerSearch}
                          isLoading={searchLoading}
                          searchError={searchError}
                          onClearError={() => setSearchError(null)}
                          onNavigateToPrices={() => handleTabChange('prices')}
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

                  {activeTab === 'clantracker' && (
                    <ClanTrackerSection />
                  )}

                  {activeTab === 'trades' && (
                    <TradesSection
                      onSelectPlayer={handlePlayerSearch}
                      marketPrices={marketPrices}
                      allItemData={allItemData}
                      fallbackRenders={fallbackRenders}
                      onInspectItem={(name, type) => {
                        setInspectItem({ name, type, amount: 1 });
                      }}
                    />
                  )}

                  {activeTab === 'chat' && (
                    <ChatSection
                      onSelectPlayer={handlePlayerSearch}
                      marketPrices={marketPrices}
                      publicItems={publicItems}
                      fallbackRenders={fallbackRenders}
                      onInspectItem={(name, type) => {
                        setInspectItem({ name, type, amount: 1 });
                      }}
                    />
                  )}

                  {activeTab === 'prices' && (
                    <PriceViewerSection
                      marketPrices={marketPrices}
                      publicItems={publicItems}
                      fallbackRenders={fallbackRenders}
                      onInspectItem={(name, type) => {
                        setInspectItem({ name, type, amount: 1 });
                      }}
                    />
                  )}
                  {activeTab === 'compare' && (
                    <CompareSection
                      marketPrices={marketPrices}
                      fallbackRenders={fallbackRenders}
                      publicItems={publicItems}
                      allItemData={allItemData}
                    />
                  )}
                  {activeTab === 'bot' && (
                    <BotSection />
                  )}
                  {activeTab === 'client' && (
                    <ClientDownloadSection />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* 5. Sleek footer */}
            <footer className="py-6 border-t border-obsidian-border/50 text-center text-xs text-slate-600 font-mono flex-shrink-0">
              <div className="max-w-7xl mx-auto px-4">
                <span>© 2026 XPERT TRACKER • Kirka.io Community Tool • Valuation Index: Bolt Pricing</span>
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
      )}
    </div>
  );
}

export default App;
