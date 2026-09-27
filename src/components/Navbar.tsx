import React, { useState } from 'react';
import { MessageSquare, Tag, GitCompare, Bot, TrendingUp, Menu, X, Box, Shirt, MousePointer2, Crosshair, Repeat, Search, Trophy, Swords, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supportsCustomCursor } from '../hooks/useCursorMode';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCustomCursor: boolean;
  toggleCursorMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, isCustomCursor, toggleCursorMode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // touch-only devices never see the fancy cursor, so hide the switch there
  const showCursorToggle = supportsCustomCursor();

  const CursorToggle: React.FC<{ className?: string }> = ({ className = '' }) => (
    <button
      onClick={toggleCursorMode}
      aria-pressed={!isCustomCursor}
      title={isCustomCursor ? 'Switch to your normal system cursor' : 'Switch back to the XPERT target cursor'}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-[11px] font-semibold tracking-wide transition-colors cursor-pointer ${
        isCustomCursor
          ? 'bg-gold-primary/10 border-gold-primary/30 text-gold-bright hover:bg-gold-primary/15'
          : 'bg-obsidian-card/50 border-white/10 text-slate-300 hover:text-white hover:border-white/20'
      } ${className}`}
    >
      <span className="flex items-center space-x-2.5">
        {isCustomCursor ? <Crosshair className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
        <span>{isCustomCursor ? 'Target Cursor' : 'Normal Cursor'}</span>
      </span>
      {/* little switch so the state reads at a glance */}
      <span
        className={`relative w-9 h-5 rounded-full transition-colors ${
          isCustomCursor ? 'bg-gold-primary/40' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
            isCustomCursor ? 'left-[18px] bg-gold-bright' : 'left-0.5 bg-slate-400'
          }`}
        />
      </span>
    </button>
  );

  const navItems = [
    { id: 'search', label: 'Search Portal', icon: Search },
    { id: 'fit', label: '3D Fit', icon: Shirt, badge: 'NEW' },
    { id: 'renders', label: '3D Renders', icon: Box, badge: '3D' },
    { id: 'reloadlab', label: 'Reload Lab', icon: Crosshair, badge: 'NEW' },
    { id: 'daily', label: 'Daily Leaderboard', icon: Trophy },
    { id: 'ranked', label: 'Ranked Arena', icon: Swords },
    { id: 'clans', label: 'Clans Registry', icon: Users },
    { id: 'clantracker', label: 'Clan Tracker', icon: TrendingUp },
    { id: 'trades', label: 'Trades Portal', icon: Repeat },
    { id: 'chat', label: 'Kirka Chat', icon: MessageSquare },
    { id: 'prices', label: 'Price Viewer', icon: Tag },
    { id: 'compare', label: 'Compare Arena', icon: GitCompare },
    { id: 'bot', label: 'Discord Bot', icon: Bot },
  ];

  return (
    <>
      {/* 1. DESKTOP LEFT SIDEBAR (Hidden on mobile) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 border-r border-slate-800 bg-obsidian-deep z-40 px-4 py-6 flex-col justify-between">
        <div className="space-y-6 overflow-y-auto no-scrollbar">
          {/* Logo Section */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group" 
            onClick={() => setActiveTab('search')}
          >
            <div className="w-8 h-8 rounded-md overflow-hidden shrink-0">
              <img
                src={`${import.meta.env.BASE_URL}kikatracker_mascot.png`}
                alt="Logo"
                className="w-full h-full rounded-md object-cover"
              />
            </div>
            <div>
              <span className="display text-[17px] text-[#EDEDED] leading-none block">
                XPERT
              </span>
              <span className="text-[11px] text-slate-600 leading-none block mt-1">
                Kirka tracker
              </span>
            </div>
          </div>

          {/* Navigation Items (Vertical List) */}
          <nav className="flex flex-col gap-px">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              
              return (
                <motion.button
                  key={item.id}
                  id={`nav-tab-desktop-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between w-full pl-3 pr-2 py-[7px] rounded-md text-[13px] transition-colors duration-150 relative group cursor-pointer ${
                    isActive
                      ? 'bg-obsidian-hover text-[#EDEDED] font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.025]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Left Gold Active Indicator line */}
                    {isActive && (
                      <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-spray-lime" />
                    )}

                    {Icon ? (
                      <Icon className={`w-4 h-4 shrink-0 transition-colors duration-150 ${
                        isActive ? 'text-spray-lime' : 'text-slate-500 group-hover:text-slate-300'
                      }`} />
                    ) : null}

                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] font-bold shrink-0 ${isActive ? 'text-spray-lime' : 'text-slate-600'}`}>
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          {showCursorToggle && <CursorToggle />}
          <span className="text-[11px] text-slate-700 block leading-relaxed">
            © 2026 Xpert Tracker
          </span>
        </div>
      </aside>

      {/* 2. MOBILE TOP HEADER WITH 3-LINE HAMBURGER MENU (Hidden on desktop) */}
      <div className="md:hidden">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-50 w-full h-14 bg-obsidian-deep/95 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-4">
          <div 
            className="flex items-center space-x-2.5 cursor-pointer" 
            onClick={() => {
              setActiveTab('search');
              setMobileMenuOpen(false);
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}kikatracker_mascot.png`}
              alt="Logo"
              className="w-7 h-7 rounded-md"
            />
            <span className="display text-[15px] text-[#EDEDED]">XPERT</span>
            <span className="text-[11px] text-slate-600">Hub</span>
          </div>

          {/* 3-line Hamburger Menu Toggle on Top */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center p-2 -mr-2 text-slate-400 hover:text-[#EDEDED] transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </header>

        {/* Full-Featured Animated Mobile Drawer / Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-x-0 top-14 bottom-0 z-40 bg-[#05060b]/98 backdrop-blur-2xl border-b border-obsidian-border flex flex-col justify-between overflow-y-auto px-4 py-5 shadow-2xl"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b border-slate-800">
                  <span>Navigation Hub</span>
                  <span>{navItems.length} Pages</span>
                </div>

                <div className="flex flex-col space-y-1.5 pt-2">
                  {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        id={`nav-tab-mobile-${item.id}`}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-sm font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-gold-primary/20 via-gold-primary/10 to-transparent text-gold-bright border border-gold-primary/30'
                            : 'text-slate-300 hover:text-white hover:bg-obsidian-card border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {Icon ? (
                            <Icon className={`w-5 h-5 ${isActive ? 'text-spray-lime' : 'text-slate-400'}`} />
                          ) : null}
                          <span className="tracking-wide">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-gold-primary/15 text-gold-bright border border-gold-primary/30 font-bold uppercase">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 px-2 space-y-3">
                {showCursorToggle && <CursorToggle />}
                <span className="text-[10px] text-slate-500 font-mono block text-center">
                  © 2026 XPERT TRACKER • Powered by Kirka Hub Valuation
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
