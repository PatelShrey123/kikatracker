import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Terminal, Shield, Zap, Sparkles, Database, RefreshCw, BarChart2, Globe, Heart, Download } from 'lucide-react';

export const BotSection: React.FC = () => {
  const inviteUrl = 'https://discord.com/oauth2/authorize?client_id=1532695214634831872&permissions=8&integration_type=0&scope=bot+applications.commands';

  const features = [
    { text: 'DM Support', desc: 'Works directly in your Direct Messages', icon: MessageSquareIcon },
    { text: 'Global Slash Commands', desc: 'Install directly to your Discord account', icon: Globe },
    { text: 'Server & Group DM Support', desc: 'Query Kirka stats in any chat context', icon: Shield },
    { text: 'User App Integration', desc: 'Use / commands anywhere without adding the bot to the server', icon: Zap },
    { text: '1300+ Skin Database', desc: 'Detailed weapon and character skin metadata', icon: Database },
    { text: 'Automatic Price Updates', desc: 'Synced dynamically with Bolt valuation indices', icon: RefreshCw },
    { text: 'Real-time Profile Data', desc: 'Fetches active body skins, coins, gems, and stats', icon: BarChart2 },
    { text: 'Ranked Leaderboards', desc: 'Look up top global player and clan rankings', icon: Sparkles },
    { text: 'Trading System Integrations', desc: 'Quickly query active trades and item valuation', icon: Terminal },
    { text: 'Custom Backgrounds', desc: 'Personalize profile cards with custom uploaded images', icon: Heart }
  ];

  const commands = [
    { name: '/clan', desc: 'View Kirka clan statistics and roster', options: '1 option' },
    { name: '/inventory', desc: 'View a Kirka player inventory with Bolt market valuations', options: '2 options' },
    { name: '/leaderboard', desc: 'View the top players or clans leaderboard', options: '2 options' },
    { name: '/profile', desc: 'Display Kirka player profile card and stats', options: '1 option' },
    { name: '/skin', desc: 'View pricing and render details for a Kirka skin or item', options: '1 option' },
    { name: '/h', desc: 'Set custom background for a user profile', options: '2 options' }
  ];

  return (
    <div className="min-h-screen px-4 md:px-8 py-8 space-y-10">
      {/* 1. Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-gold-primary/20 bg-gradient-to-br from-obsidian-card via-[#0c0d15] to-[#040509] p-8 md:p-12 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      >
        {/* Decorative subtle background gradient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-primary/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="space-y-4 text-center md:text-left max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-gold-primary/30 bg-gold-primary/10 text-gold-bright text-xs font-semibold tracking-wider uppercase font-mono">
              <Bot className="w-3.5 h-3.5" />
              <span>Official Discord Integration</span>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              Kirka Tracker <span className="text-gold-bright">Discord Bot</span>
            </h1>
            
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Track inventories, values, clans, and skins directly inside Discord servers, group DMs, or anywhere you chat. Fully optimized with account-level installs, real-time sync, and crisp high-definition image cards.
            </p>
          </div>

          <motion.a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center space-x-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-gold-primary to-yellow-600 hover:from-gold-bright hover:to-gold-primary text-black font-extrabold text-base tracking-wide shadow-[0_4px_20px_rgba(212,175,55,0.3)] transition-all cursor-pointer select-none"
          >
            <Download className="w-5 h-5" />
            <span>Add to Discord</span>
          </motion.a>
        </div>
      </motion.div>

      {/* 2. Features and Commands Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Bot Features */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-5 rounded-2xl border border-obsidian-border bg-obsidian-card/50 p-6 space-y-6 shadow-2xl"
        >
          <div className="flex items-center space-x-3 border-b border-obsidian-border/80 pb-4">
            <div className="w-8 h-8 rounded-lg bg-gold-primary/10 flex items-center justify-center text-gold-bright">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-black text-white tracking-wide">Bot Features</h2>
          </div>

          <div className="space-y-4">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div 
                  key={idx} 
                  className="flex items-start space-x-3.5 p-3 rounded-xl hover:bg-white/[0.02] border border-transparent hover:border-white/[0.04] transition-all duration-200"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mt-0.5 flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">{feat.text}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Right Column: Commands */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-7 rounded-2xl border border-obsidian-border bg-obsidian-card/50 p-6 space-y-6 shadow-2xl"
        >
          <div className="flex items-center space-x-3 border-b border-obsidian-border/80 pb-4 justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gold-primary/10 flex items-center justify-center text-gold-bright">
                <Terminal className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-black text-white tracking-wide">Slash Commands</h2>
            </div>
            <span className="text-[10px] font-mono bg-white/[0.05] border border-white/[0.08] text-slate-400 px-2 py-0.5 rounded">
              v1.0.0 Active
            </span>
          </div>

          {/* Commands Scroll List */}
          <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {commands.map((cmd, idx) => (
              <div 
                key={idx} 
                className="p-4 rounded-xl bg-[#07080f]/60 border border-obsidian-border/60 hover:border-gold-primary/20 transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-mono font-bold text-gold-bright bg-gold-primary/5 border border-gold-primary/10 px-2.5 py-1 rounded-lg">
                    {cmd.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 font-bold uppercase tracking-wider">
                    {cmd.options}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  {cmd.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
};

// Quick missing Lucide icon fallback
const MessageSquareIcon = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
