import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CursorTrail } from './components/CursorTrail';
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
  } | null>(null);

  // Sync pricing data and handle loader lifecycle on mount
  useEffect(() => {
    // 1. Fetch JSON Google Sheet prices from OpenSheet API
    fetchAndParsePrices().then((priceMap) => {
      setMarketPrices(priceMap);
    });

    // 2. Fetch public items list for global skin lookup
    fetchAllPublicItems().then((items) => {
      if (Array.isArray(items)) setPublicItems(items);
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

    // 4. Fetch complete skins metadata database from GitHub for Item Inspect view
    fetch('https://raw.githubusercontent.com/OBS-Akuma/KirkaSkins/refs/heads/main/AllItemData.json')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAllItemData(data);
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

  // Handle player search action across pages
  const handlePlayerSearch = async (id: string, isShortId: boolean) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const profile = await fetchUserProfile(id, isShortId);
      if (!profile || !profile.name) {
        throw new Error('Player not found.');
      }
      setActiveUserProfile(profile);
      setActiveTab('search'); // Redirect to search tab to display profile
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError('Player profile not found. Make sure the ID is correct.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Select tab and clear sub-states
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="relative min-h-screen bg-obsidian-deep text-slate-100 flex flex-col md:flex-row selection:bg-gold-primary/30 selection:text-gold-bright">
      {/* Dynamic Fluid Teardrop Gold Cursor Trail */}
      <CursorTrail />

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
                <span className="text-xs font-black tracking-widest text-slate-300">XPERT INTEL PLATFORM</span>
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
                          onInspectItem={(name, type, amount) => {
                            setInspectItem({ name, type, amount });
                          }}
                          onSelectClan={(clanName) => {
                            setActiveClanName(clanName);
                            setActiveTab('clans');
                          }}
                          onBack={() => {
                            setActiveUserProfile(null);
                            setSearchError(null);
                          }}
                        />
                      ) : (
                        <SearchSection
                          onSearch={handlePlayerSearch}
                          isLoading={searchLoading}
                          searchError={searchError}
                          onClearError={() => setSearchError(null)}
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
                      onClearActiveClanName={() => setActiveClanName(null)}
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
