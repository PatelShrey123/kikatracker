import React, { useState } from 'react';
import { MessageSquare, Tag, GitCompare, Bot, TrendingUp, Palette, Menu, X, Box, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'search', label: 'Search Portal', imgUrl: 'search_portal.png' },
    { id: 'fitviewer', label: '3D Fit Viewer', icon: Sparkles, badge: 'NEW' },
    { id: 'renders', label: '3D Renders', icon: Box, badge: '3D' },
    { id: 'skineditor', label: 'Skin Studio', icon: Palette, badge: '3D/2D' },
    { id: 'daily', label: 'Daily Leaderboard', imgUrl: 'daily_leaderboard.png' },
    { id: 'ranked', label: 'Ranked Arena', imgUrl: 'ranked_arena.png' },
    { id: 'clans', label: 'Clans Registry', imgUrl: 'clan_registry.png' },
    { id: 'clantracker', label: 'Clan Tracker', icon: TrendingUp },
    { id: 'trades', label: 'Trades Portal', imgUrl: 'trade_portal.png' },
    { id: 'chat', label: 'Kirka Chat', icon: MessageSquare },
    { id: 'prices', label: 'Price Viewer', icon: Tag },
    { id: 'compare', label: 'Compare Arena', icon: GitCompare },
    { id: 'bot', label: 'Discord Bot', icon: Bot },
  ];

  return (
    <>
      {/* 1. DESKTOP LEFT SIDEBAR (Hidden on mobile) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r border-obsidian-border bg-[#05060b]/95 backdrop-blur-md z-40 p-5 flex-col justify-between shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        <div className="space-y-6 overflow-y-auto no-scrollbar">
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
          <nav className="flex flex-col space-y-2">
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
                  className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-colors duration-200 relative group cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-gold-primary/15 to-[#1b1911]/5 text-gold-bright border border-gold-primary/30 shadow-[0_0_15px_rgba(212,175,55,0.06)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-card/45 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    {/* Left Gold Active Indicator line */}
                    {isActive && (
                      <div className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-gold-primary rounded-r" />
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
                  </div>

                  {item.badge && (
                    <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      isActive 
                        ? 'bg-gold-primary/20 text-gold-bright border border-gold-primary/40' 
                        : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                    }`}>
                      {item.badge}
                    </span>
                  )}
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

      {/* 2. MOBILE TOP HEADER WITH 3-LINE HAMBURGER MENU (Hidden on desktop) */}
      <div className="md:hidden">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-50 w-full h-14 bg-[#05060b]/95 backdrop-blur-md border-b border-obsidian-border/80 flex items-center justify-between px-4 shadow-lg">
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
              className="w-7 h-7 rounded border border-indigo-500/20"
            />
            <span className="text-sm font-black tracking-widest text-white">XPERT</span>
            <span className="text-[8px] font-mono bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
              HUB
            </span>
          </div>

          {/* 3-line Hamburger Menu Toggle on Top */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center p-2 rounded-xl bg-obsidian-card/80 border border-white/10 text-slate-300 hover:text-white hover:border-gold-primary/40 transition-all cursor-pointer active:scale-95"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-gold-bright" />
            ) : (
              <Menu className="w-5 h-5 text-slate-200" />
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
                <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b border-white/5">
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
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-gold-primary/20 via-gold-primary/10 to-transparent text-gold-bright border border-gold-primary/30 shadow-[0_0_15px_rgba(212,175,55,0.1)]'
                            : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5">
                          {item.imgUrl ? (
                            <img
                              src={`${import.meta.env.BASE_URL}${item.imgUrl}`}
                              alt={item.label}
                              className={`w-5 h-5 rounded object-contain ${
                                isActive ? 'brightness-110 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]' : 'opacity-70'
                              }`}
                            />
                          ) : Icon ? (
                            <Icon className={`w-5 h-5 ${isActive ? 'text-gold-bright' : 'text-slate-400'}`} />
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

              <div className="pt-6 border-t border-white/5 px-2">
                <span className="text-[10px] text-slate-500 font-mono block text-center">
                  © 2026 XPERT TRACKER • Powered by Bolt Valuation
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
