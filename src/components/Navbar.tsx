import React from 'react';
import { MessageSquare, Tag, GitCompare } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'search', label: 'Search Portal', imgUrl: 'search_portal.png' },
    { id: 'daily', label: 'Daily Leaderboard', imgUrl: 'daily_leaderboard.png' },
    { id: 'ranked', label: 'Ranked Arena', imgUrl: 'ranked_arena.png' },
    { id: 'clans', label: 'Clans Registry', imgUrl: 'clan_registry.png' },
    { id: 'trades', label: 'Trades Portal', imgUrl: 'trade_portal.png' },
    { id: 'chat', label: 'Kirka Chat', icon: MessageSquare },
    { id: 'prices', label: 'Price Viewer', icon: Tag },
    { id: 'compare', label: 'Compare Arena', icon: GitCompare },
  ];

  return (
    <>
      {/* 1. DESKTOP LEFT SIDEBAR (Hidden on mobile) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r border-obsidian-border bg-[#05060b]/95 backdrop-blur-md z-40 p-5 flex-col justify-between shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        <div className="space-y-8">
          {/* Logo Section */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group" 
            onClick={() => setActiveTab('search')}
          >
            <div className="w-10 h-10 rounded-xl border border-indigo-500/30 bg-[#090a0f] flex items-center justify-center p-1 shadow-[0_0_15px_rgba(99,102,241,0.15)] group-hover:scale-105 transition-transform duration-300">
              <img
                src={`${import.meta.env.BASE_URL}kikatracker_mascot.png`}
                alt="Logo"
                className="w-full h-full rounded-lg object-cover"
              />
            </div>
            <div>
              <span className="text-lg font-black tracking-widest text-white leading-none block">
                XPERT
              </span>
              <span className="text-[9px] tracking-widest text-indigo-400 font-mono uppercase leading-none block mt-1.5 font-bold">
                KIRKA TRACKER
              </span>
            </div>
          </div>

          {/* Navigation Items (Vertical List) */}
          <nav className="flex flex-col space-y-2.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              
              return (
                <motion.button
                  key={item.id}
                  id={`nav-tab-desktop-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  whileHover={{ x: 6, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className={`flex items-center space-x-3.5 w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-colors duration-200 relative group cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-gold-primary/15 to-[#1b1911]/5 text-gold-bright border border-gold-primary/30 shadow-[0_0_15px_rgba(212,175,55,0.06)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-card/45 border border-transparent'
                  }`}
                >
                  {/* Left Gold Active Indicator line */}
                  {isActive && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-gold-primary rounded-r" />
                  )}

                  {/* Render custom thumbnail image or Lucide icon */}
                  {item.imgUrl ? (
                    <img
                      src={`${import.meta.env.BASE_URL}${item.imgUrl}`}
                      alt={item.label}
                      className={`w-5 h-5 rounded object-contain transition-all duration-300 ${
                        isActive ? 'scale-110 brightness-110 filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]' : 'opacity-60 group-hover:opacity-90'
                      }`}
                    />
                  ) : Icon ? (
                    <Icon className={`w-4.5 h-4.5 transition-all duration-300 ${
                      isActive ? 'scale-110 text-gold-bright glow-filter-gold' : 'text-slate-400 group-hover:text-slate-300'
                    }`} />
                  ) : null}

                  <span>{item.label}</span>
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div className="pt-4 border-t border-obsidian-border/50">
          <span className="text-[9px] text-slate-600 font-mono block leading-relaxed">
            © 2026 XPERT TRACKER.
            <br />
            Powered by Bolt Valuation.
          </span>
        </div>
      </aside>

      {/* 2. MOBILE HEADER & FLOATING NAV DOCK (Hidden on desktop) */}
      <div className="md:hidden">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-40 w-full h-14 bg-[#05060b]/90 backdrop-blur-md border-b border-obsidian-border/80 flex items-center justify-between px-4">
          <div className="flex items-center space-x-2" onClick={() => setActiveTab('search')}>
            <img
              src={`${import.meta.env.BASE_URL}kikatracker_mascot.png`}
              alt="Logo"
              className="w-7 h-7 rounded border border-indigo-500/20"
            />
            <span className="text-sm font-black tracking-widest text-white">XPERT</span>
          </div>
          <span className="text-[8px] font-mono bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">
            LIVE FEED
          </span>
        </header>

        {/* Floating Glassmorphic Nav Dock */}
        <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-sm glass-nav border border-gold-primary/20 rounded-full px-3 py-2 flex items-center justify-around shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-lg">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            
            return (
              <motion.button
                key={item.id}
                id={`nav-tab-mobile-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className={`p-2.5 rounded-full transition-all duration-200 relative ${
                  isActive
                    ? 'bg-gold-primary/15 text-gold-bright shadow-[0_0_12px_rgba(212,175,55,0.15)] scale-110'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={item.label}
              >
                {item.imgUrl ? (
                  <img
                    src={`${import.meta.env.BASE_URL}${item.imgUrl}`}
                    alt={item.label}
                    className={`w-5 h-5 rounded object-contain transition-all duration-300 ${
                      isActive ? 'brightness-110 filter drop-shadow-[0_0_6px_rgba(212,175,55,0.4)]' : 'opacity-65'
                    }`}
                  />
                ) : Icon ? (
                  <Icon className="w-5 h-5" />
                ) : null}

                {isActive && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-gold-primary rounded-full" />
                )}
              </motion.button>
            );
          })}
        </nav>
      </div>
    </>
  );
};
