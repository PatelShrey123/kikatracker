import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Terminal,
  Shield,
  Sparkles,
  RefreshCw,
  BarChart2,
  Globe,
  Heart,
  Download,
  Swords,
  Layers,
  Copy,
  Check,
  Search,
  Gift,
  Link as LinkIcon,
  Flame,
  ArrowRightLeft,
  Users,
  Coffee,
  X,
  ExternalLink,
  Gamepad2
} from 'lucide-react';

interface BotCommand {
  name: string;
  prefix: string;
  desc: string;
  options: string;
  example: string;
  category: 'stats' | 'trading' | 'weapons' | 'utility';
  badge?: string;
  badgeColor?: string;
}

export const BotSection: React.FC = () => {
  const inviteUrl = 'https://discord.com/oauth2/authorize?client_id=1532695214634831872&permissions=8&integration_type=0&scope=bot+applications.commands';

  const [serverCount, setServerCount] = useState<number>(19);
  const [linkedCount, setLinkedCount] = useState<number>(54);
  const [userReach, setUserReach] = useState<number>(2686);
  const [catalogCount, setCatalogCount] = useState<number>(1913);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Valorant Points Modal State
  const [showVpModal, setShowVpModal] = useState<boolean>(false);
  const [copiedRiotId, setCopiedRiotId] = useState<boolean>(false);
  const RIOT_ID = 'IMSMARTY#2254';

  const handleCopyRiotId = () => {
    navigator.clipboard.writeText(RIOT_ID);
    setCopiedRiotId(true);
    setTimeout(() => setCopiedRiotId(false), 2500);
  };

  const handleOpenCodashop = () => {
    navigator.clipboard.writeText(RIOT_ID);
    setCopiedRiotId(true);
    setTimeout(() => {
      window.open('https://www.codashop.com/en-in/valorant', '_blank', 'noopener,noreferrer');
    }, 250);
  };

  useEffect(() => {
    // 1. Fetch linked accounts, user reach, and server count securely from backend api without exposing keys
    fetch('/api/bot-stats')
      .then(r => r.json())
      .then(data => {
        if (data) {
          if (typeof data.linkedCount === 'number') setLinkedCount(data.linkedCount);
          if (typeof data.serverCount === 'number') setServerCount(data.serverCount);
          if (typeof data.userReach === 'number') setUserReach(data.userReach);
        }
      })
      .catch(() => {
        setLinkedCount(54);
        setServerCount(19);
        setUserReach(2686);
      });

    // 2. Fetch public items count from Kirka API (via proxy or direct)
    fetch('/api/inventory/items')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCatalogCount(data.length);
        }
      })
      .catch(() => {
        fetch('https://api.kirka.io/api/inventory/items')
          .then(r => r.json())
          .then(data => {
            if (Array.isArray(data)) {
              setCatalogCount(data.length);
            }
          })
          .catch(err => console.error('Failed to fetch items count:', err));
      });
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const features = [
    {
      text: '2026 Event Quests & Requirements (.events)',
      desc: 'Browse 2026 Kirka Event Quest slot requirements (kills/headshots), weapon types, and live circulating owners.',
      icon: Swords,
      tag: '2026 Quests'
    },
    {
      text: 'Clan Wars Rewards Tracker (.cw)',
      desc: 'Complete Clan Wars prizes for Top 3, Top 8, and Top 39 clans with live community Bolt values and active owner counts.',
      icon: Shield,
      tag: 'Clan Wars'
    },
    {
      text: 'Live Store & Drop Notifier (.store, .storeupdate)',
      desc: 'Monitor active in-game store bundles, limited stock counters, and get instant drop pings in your server.',
      icon: Flame,
      tag: 'Store Pings'
    },
    {
      text: 'Exclusive Bolt Pricing Engine',
      desc: 'Accurate community-standard Bolt valuation indices for all 1,900+ skins instead of inflated generic prices.',
      icon: RefreshCw,
      tag: 'Bolt Standard'
    },
    {
      text: 'Creator & Artist Attribution',
      desc: 'Official creator and artist credits on every skin with .skin, recognizing the community artists behind each design.',
      icon: Sparkles,
      tag: 'Creator Credits'
    },
    {
      text: 'Custom Profile Backgrounds (.h)',
      desc: 'Set and flaunt custom uploaded artwork or wallpaper on your high-definition player profile cards.',
      icon: Heart,
      tag: 'Custom BGs'
    },
    {
      text: 'Live Game Server Browser (.servers)',
      desc: 'Monitor live match lobbies across all global regions (EU, US, ASIA, etc.) with player counts, ping, and maps.',
      icon: Globe,
      tag: 'Live Lobbies'
    },
    {
      text: 'Live Trades & Market Browser (.trade)',
      desc: 'Search active marketplace listings and historical transactions with seller info and real-time Bolt values.',
      icon: ArrowRightLeft,
      tag: 'NEW Feature'
    },
    {
      text: 'Weapon Stats & Comparisons (.weapon)',
      desc: 'Analyze full DPS, TTK, headshot damage, fire rate, and run side-by-side card comparisons between weapons.',
      icon: Swords,
      tag: 'Combat Engine'
    },
    {
      text: 'Visual Canvas Card Renderers',
      desc: 'Generates clean, aesthetic graphics for profiles, weapon stat cards, and trade listings directly in Discord.',
      icon: Layers,
      tag: 'HD Graphics'
    },
    {
      text: 'Chest Opening Simulator (.unbox)',
      desc: 'Experience authentic Kirka chest openings (Wooden, Ice, Gold) with true drop rates and rarity alerts.',
      icon: Gift,
      tag: 'Minigame'
    },
    {
      text: 'Global User App Installation',
      desc: 'Install directly to your Discord user profile to run commands in ANY server, DM, or group without bot invites.',
      icon: Globe,
      tag: 'Universal'
    },
    {
      text: '1-Click Account Linking (.link)',
      desc: 'Bind your Discord user to your Kirka account once to use .profile or .inventory with zero typing.',
      icon: LinkIcon,
      tag: 'Instant Sync'
    },
    {
      text: 'Dual Invocation Support',
      desc: 'Full native compatibility with modern Discord Slash Commands (/profile) and lightning-fast Prefix commands (.profile).',
      icon: Terminal,
      tag: 'Slash + Dot'
    },
    {
      text: 'Live Ranked & Leaderboard Sync',
      desc: 'Real-time competitive standings, division ranks, ELO ratings, and clan ladder leaderboards.',
      icon: Sparkles,
      tag: 'Ranked Ladder'
    }
  ];

  const commands: BotCommand[] = [
    {
      name: '/events',
      prefix: '.events [query]',
      desc: 'Browse 2026 Kirka Event Quests slots, weapon types, exact kill and headshot requirements, and live skin circulation.',
      options: 'optional: event number (e.g. 26, 27) | skin name',
      example: '.events 26',
      category: 'stats',
      badge: '2026 EVENTS',
      badgeColor: 'from-amber-500 to-yellow-500'
    },
    {
      name: '/events (clanwars)',
      prefix: '.cw [number | skin]',
      desc: 'View Clan Wars prize skins for Top 3, Top 8, and Top 39 clans with live community Bolt values and player circulation counts.',
      options: 'optional: war number (e.g. 48, 1) | skin name',
      example: '.cw 48',
      category: 'stats',
      badge: 'CLAN WARS',
      badgeColor: 'from-red-500 to-rose-600'
    },
    {
      name: '/events (seasons)',
      prefix: '.seasons [query]',
      desc: 'Inspect exclusive Ranked Seasons skin sets and limited event shop archives with rarity and Bolt valuation.',
      options: 'optional: season number | shop name',
      example: '.seasons',
      category: 'stats',
      badge: 'SEASONS',
      badgeColor: 'from-purple-500 to-violet-600'
    },
    {
      name: '/store',
      prefix: '.store [view]',
      desc: 'Inspect live in-game Kirka store items, limited bundles, and stock counters (e.g. 12/25 left) with official 3D renders.',
      options: 'optional: view (all, bundles, skins)',
      example: '.store',
      category: 'trading',
      badge: 'LIVE STORE',
      badgeColor: 'from-emerald-500 to-green-600'
    },
    {
      name: '/storeupdate',
      prefix: '.storeupdate [on/off]',
      desc: 'Subscribe your Discord channel or DM to instant notifications whenever a new limited store rotation or skin drop goes live.',
      options: 'on | off',
      example: '.storeupdate on',
      category: 'utility',
      badge: 'NOTIFIER',
      badgeColor: 'from-blue-500 to-cyan-500'
    },
    {
      name: '/profile',
      prefix: '.profile [user]',
      desc: 'Display high-definition graphical player profile card with equipped 3D skins, level, coins, gems, KD, win rate, and custom wallpaper background.',
      options: 'username | #ID | @discord',
      example: '.profile FUYR7K',
      category: 'stats',
      badge: 'CUSTOM BG',
      badgeColor: 'from-amber-500 to-orange-500'
    },
    {
      name: '/inventory',
      prefix: '.inv [user | @discord]',
      desc: 'Browse complete player inventory with full Bolt market valuation, 5x5 HD graphical cards, multi-tier 3D render fallbacks, and page controls. Mention any linked Discord user to inspect their items!',
      options: 'username | #ID | @discord',
      example: '.inv @tooexpert',
      category: 'stats',
      badge: 'BOLT VALUE',
      badgeColor: 'from-emerald-500 to-teal-500'
    },
    {
      name: '/trade',
      prefix: '.trade <skin or user>',
      desc: 'Interactive live Kirka trade browser! Toggle seamlessly between active live marketplace offers and past trade history with real-time Bolt pricing.',
      options: 'skin name | username',
      example: '.trade Hi-Score',
      category: 'trading',
      badge: 'HOT / NEW',
      badgeColor: 'from-rose-500 to-pink-500'
    },
    {
      name: '/weapon',
      prefix: '.weapon <gun> [vs <gun2>]',
      desc: 'Detailed combat weapon card showing Damage, Headshot, DPS, Fire Rate, TTK, Range, and Recoil. Add "vs" to compare two weapons side-by-side!',
      options: 'weapon1 [vs weapon2]',
      example: '.weapon SCAR vs VITA',
      category: 'weapons',
      badge: 'COMPARE',
      badgeColor: 'from-indigo-500 to-blue-500'
    },
    {
      name: '/skin',
      prefix: '.skin <name>',
      desc: 'Look up any skin or item in the 1,900+ database with official 3D renders, creator/artist attribution credits, rarity classification, and Bolt valuation.',
      options: 'skin name',
      example: '.skin Golden Rain',
      category: 'trading',
      badge: 'CREATOR CREDITS',
      badgeColor: 'from-purple-500 to-indigo-500'
    },
    {
      name: '/servers',
      prefix: '.servers [region]',
      desc: 'Browse live multiplayer Kirka match lobbies worldwide with player counts, regional switch buttons, active game modes, and maps.',
      options: 'optional: region (eu, us, asia)',
      example: '.servers eu',
      category: 'utility',
      badge: 'LIVE LOBBIES',
      badgeColor: 'from-cyan-500 to-blue-500'
    },
    {
      name: '/clan',
      prefix: '.clan <name>',
      desc: 'View Kirka clan statistics, global score, leaderboard rank, total members, leader, officers, and full member roster with activity metrics.',
      options: 'clan name',
      example: '.clan T9',
      category: 'stats'
    },
    {
      name: '/leaderboard',
      prefix: '.leaderboard [players|clans]',
      desc: 'View real-time global Kirka leaderboards for top players and top competitive clans with live scores and KD ratings.',
      options: 'type: players | clans',
      example: '.leaderboard players',
      category: 'stats'
    },
    {
      name: '/ranked',
      prefix: '.ranked [season]',
      desc: 'Track competitive ranked season standings, top 50 global contenders, division badges, and ELO point cutoffs.',
      options: 'optional: season',
      example: '.ranked',
      category: 'stats'
    },
    {
      name: '/quests',
      prefix: '.quests',
      desc: 'Check current daily and weekly Kirka missions, challenge requirements, and XP / Gem reward payouts.',
      options: 'none',
      example: '.quests',
      category: 'stats'
    },
    {
      name: '/unbox',
      prefix: '.unbox [chest]',
      desc: 'Simulate opening authentic Kirka chests (Wooden, Ice, Golden) with exact game drop rates and animated win embeds.',
      options: 'chest: wooden | ice | golden',
      example: '.unbox golden',
      category: 'utility',
      badge: 'MINIGAME',
      badgeColor: 'from-purple-500 to-indigo-500'
    },
    {
      name: '/h',
      prefix: '.h <image_url or upload>',
      desc: 'Set a custom banner background image for your player profile card. Upload an image or provide a direct image URL.',
      options: 'attachment | image_url',
      example: '.h https://i.imgur.com/bg.png',
      category: 'utility',
      badge: 'CUSTOM BG',
      badgeColor: 'from-gold-primary to-amber-500'
    },
    {
      name: '/link',
      prefix: '.link <kirka_username>',
      desc: 'Link your Discord ID to your Kirka account so you can view your own profile, inventory, and stats without typing your name every time.',
      options: 'username | #ID',
      example: '.link FUYR7K',
      category: 'utility'
    },
    {
      name: '/unlink',
      prefix: '.unlink',
      desc: 'Safely disconnect your linked Kirka account from your Discord identity.',
      options: 'none',
      example: '.unlink',
      category: 'utility'
    },
    {
      name: '/help',
      prefix: '.help [command]',
      desc: 'Comprehensive interactive help center with dropdown navigation menus, feature breakdowns, and parameter syntax.',
      options: 'optional: command',
      example: '.help trade',
      category: 'utility'
    },
    {
      name: '/donate',
      prefix: '.donate [submit <code>]',
      desc: 'Support 24/7 server hosting! Direct UPI via Buy Me A Chai (buymeachai.in/xpert) or tip with Steam codes, Valorant Points (VP), and Amazon Gift Cards.',
      options: 'optional: submit <code>',
      example: '.donate',
      category: 'utility',
      badge: 'SUPPORT',
      badgeColor: 'from-amber-500 to-yellow-500'
    },
    {
      name: '/support',
      prefix: '.support',
      desc: 'Join the official Tracker Bot Discord server for direct help, perks, suggestions, and dev chat.',
      options: 'none',
      example: '.support',
      category: 'utility',
      badge: 'COMMUNITY',
      badgeColor: 'from-blue-500 to-indigo-500'
    },
    {
      name: '/suggest',
      prefix: '.suggest <idea>',
      desc: 'Submit a feature idea or feedback directly to the developers in our #ideas channel.',
      options: 'your idea',
      example: '.suggest add online friends notifier',
      category: 'utility'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Commands', count: commands.length, icon: Terminal },
    { id: 'stats', label: 'Player & Clans', count: commands.filter(c => c.category === 'stats').length, icon: BarChart2 },
    { id: 'trading', label: 'Market & Trading', count: commands.filter(c => c.category === 'trading').length, icon: ArrowRightLeft },
    { id: 'weapons', label: 'Weapons & Combat', count: commands.filter(c => c.category === 'weapons').length, icon: Swords },
    { id: 'utility', label: 'Account & Setup', count: commands.filter(c => c.category === 'utility').length, icon: Shield },
  ];

  const filteredCommands = commands.filter(cmd => {
    const matchesCategory = activeCategory === 'all' || cmd.category === activeCategory;
    const matchesSearch = searchQuery === '' || 
      cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.prefix.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen px-4 md:px-8 py-8 space-y-10 max-w-[1600px] mx-auto">
      {/* 1. Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-gold-primary/20 bg-gradient-to-br from-obsidian-card via-[#0c0d15] to-[#040509] p-8 md:p-12 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-primary/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="space-y-4 text-center md:text-left max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-gold-primary/30 bg-gold-primary/10 text-gold-bright text-xs font-semibold tracking-wider uppercase font-mono">
              <Bot className="w-3.5 h-3.5 text-gold-bright" />
              <span>Official KirkaTracker Bot v2.5</span>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              Kirka Tracker <span className="text-gold-bright">Discord Bot</span>
            </h1>
            
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              The ultimate Kirka companion. Track inventories with live <strong className="text-white">Bolt valuations</strong>, browse active <strong className="text-white">live marketplace trades</strong>, run side-by-side <strong className="text-white">weapon stat comparisons</strong>, and customize your profile with <strong className="text-white">custom background cards</strong>.
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 font-bold flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>{userReach.toLocaleString()}+ Players Reached</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-300 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Supports Prefix <code className="text-gold-bright font-bold">.</code> & Slash <code className="text-indigo-400 font-bold">/</code></span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-gold-primary/10 border border-gold-primary/20 text-[11px] font-mono text-gold-bright font-bold flex items-center space-x-1">
                <Flame className="w-3 h-3" />
                <span>Bolt Valuation Index</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full sm:w-auto">
            <motion.a
              href="https://www.buymeachai.in/xpert"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center space-x-2 px-5 py-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 font-extrabold text-sm tracking-wide shadow-[0_4px_20px_rgba(245,158,11,0.2)] transition-all cursor-pointer select-none w-full sm:w-auto"
            >
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>Buy Me A Chai</span>
            </motion.a>

            <motion.button
              type="button"
              onClick={() => setShowVpModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center space-x-2 px-5 py-4 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-500/40 text-indigo-300 font-extrabold text-sm tracking-wide shadow-[0_4px_20px_rgba(99,102,241,0.2)] transition-all cursor-pointer select-none w-full sm:w-auto"
            >
              <Gamepad2 className="w-4 h-4 text-indigo-400" />
              <span>🎯 Gift Valorant Points</span>
            </motion.button>

            <motion.a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center space-x-3 px-7 py-4 rounded-2xl bg-gradient-to-r from-gold-primary to-yellow-600 hover:from-gold-bright hover:to-gold-primary text-black font-extrabold text-base tracking-wide shadow-[0_4px_25px_rgba(212,175,55,0.35)] transition-all cursor-pointer select-none w-full sm:w-auto"
            >
              <Download className="w-5 h-5" />
              <span>Add to Discord</span>
            </motion.a>
          </div>
        </div>
      </motion.div>

      {/* Stats Banner Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <div className="bg-gradient-to-br from-[#0c0d15] to-[#040509] border border-obsidian-border/50 rounded-2xl p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="text-3xl md:text-4xl font-black text-[#38bdf8] font-mono tracking-wider mb-2">
            {userReach.toLocaleString()}+
          </div>
          <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase font-mono">
            Total Players Reached
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0c0d15] to-[#040509] border border-obsidian-border/50 rounded-2xl p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="text-3xl md:text-4xl font-black text-gold-bright font-mono tracking-wider mb-2">
            {linkedCount}
          </div>
          <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase font-mono">
            Linked Kirka Profiles
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0c0d15] to-[#040509] border border-obsidian-border/50 rounded-2xl p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="text-3xl md:text-4xl font-black text-[#10b981] font-mono tracking-wider mb-2">
            {serverCount}
          </div>
          <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase font-mono">
            Discord Servers
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0c0d15] to-[#040509] border border-obsidian-border/50 rounded-2xl p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="text-3xl md:text-4xl font-black text-amber-400 font-mono tracking-wider mb-2">
            {catalogCount.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase font-mono">
            Skin Catalog & Bolt Prices
          </div>
        </div>
      </motion.div>

      {/* 2. Features and Commands Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Bot Features */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-5 rounded-2xl border border-obsidian-border bg-obsidian-card/50 p-6 space-y-5 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-obsidian-border/80 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gold-primary/10 flex items-center justify-center text-gold-bright">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-black text-white tracking-wide">Key Features</h2>
            </div>
            <span className="text-[10px] font-mono text-gold-bright bg-gold-primary/10 border border-gold-primary/20 px-2 py-0.5 rounded-full font-bold">
              {features.length} Features
            </span>
          </div>

          <div className="space-y-3">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div 
                  key={idx} 
                  className="flex items-start space-x-3.5 p-3 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 group-hover:bg-gold-primary/10 flex items-center justify-center text-indigo-400 group-hover:text-gold-bright mt-0.5 flex-shrink-0 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-200">{feat.text}</h3>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 flex-shrink-0">
                        {feat.tag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Right Column: Interactive Commands Directory */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-7 rounded-2xl border border-obsidian-border bg-obsidian-card/50 p-6 space-y-5 shadow-2xl"
        >
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-obsidian-border/80 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gold-primary/10 flex items-center justify-center text-gold-bright">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-wide">Command Directory</h2>
                <p className="text-xs text-slate-400">All commands work with both dot prefix (<code>.</code>) and slash (<code>/</code>)</p>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-white/[0.05] border border-white/[0.08] text-gold-bright px-2.5 py-1 rounded-lg font-bold self-start sm:self-auto">
              {filteredCommands.length} of {commands.length} Commands
            </span>
          </div>

          {/* Search & Category Filter Controls */}
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search commands by name, description, or keyword..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#06070d] border border-white/10 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-primary/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gold-primary text-black shadow-md shadow-gold-primary/20'
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1 rounded ${isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'}`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Commands List */}
          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1.5 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {filteredCommands.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                  <Terminal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-mono text-slate-400">No commands found matching "{searchQuery}"</p>
                  <button
                    onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                    className="mt-2 text-xs text-gold-bright hover:underline font-mono"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => (
                  <motion.div 
                    key={cmd.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: idx * 0.02 }}
                    className="p-4 rounded-xl bg-[#07080f]/80 border border-obsidian-border/70 hover:border-gold-primary/30 transition-all duration-200 group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono font-black text-gold-bright bg-gold-primary/10 border border-gold-primary/20 px-2.5 py-1 rounded-lg">
                          {cmd.name}
                        </span>
                        <span className="text-xs font-mono text-slate-400 font-semibold">
                          or <code className="text-slate-200">{cmd.prefix}</code>
                        </span>
                        {cmd.badge && (
                          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${cmd.badgeColor || 'from-gold-primary to-amber-500'} shadow-sm`}>
                            {cmd.badge}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded self-start sm:self-auto border border-white/5">
                        Args: {cmd.options}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed font-sans">
                      {cmd.desc}
                    </p>

                    {/* Example with 1-Click Copy */}
                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">Try:</span>
                        <code className="bg-black/50 border border-white/10 px-2 py-0.5 rounded text-amber-300">
                          {cmd.example}
                        </code>
                      </div>

                      <button
                        onClick={() => copyToClipboard(cmd.example)}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-white/5 hover:bg-gold-primary/20 hover:text-gold-bright border border-white/10 text-[10px] font-mono text-slate-400 transition-all cursor-pointer"
                        title="Copy example to clipboard"
                      >
                        {copiedCmd === cmd.example ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* 4. Support & Donation Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#140e04] via-[#0d0d15] to-[#040509] p-8 md:p-10 shadow-[0_12px_40px_rgba(245,158,11,0.1)] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 text-center lg:text-left max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold uppercase font-mono tracking-wider">
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                <span>Support KirkaHub 24/7 Hosting</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white">
                Love KirkaHub? <span className="text-amber-400">Support Development</span>
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                KirkaHub is 100% free with no paywalls. Your donations directly fund high-performance cloud hosting, instant in-game verification listeners, and 3D skin rendering.
              </p>

              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    🇮🇳 <strong>India:</strong> Direct UPI via BuyMeAChai (Zero phone leaks)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                    🎯 <strong>Valorant VP:</strong> Riot ID <code className="text-white font-bold bg-black/40 px-1 py-0.5 rounded">IMSMARTY#2254</code> (Codashop)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    🌍 <strong>International:</strong> Steam Wallet Cards ($/€ auto-convert) or SEAGM India VP Codes
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 w-full lg:w-auto justify-center lg:justify-end">
              <a
                href="https://www.buymeachai.in/xpert"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer select-none"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Buy Me A Chai (UPI)</span>
              </a>

              <button
                type="button"
                onClick={() => setShowVpModal(true)}
                className="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-indigo-500/20 transition-all cursor-pointer select-none"
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>🎯 Gift Valorant Points</span>
              </button>

              <a
                href="https://discord.gg/3zStCadBtP"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs tracking-wide transition-all cursor-pointer select-none"
              >
                <span>Tracker Bot Discord (Submit Gift Cards)</span>
              </a>
            </div>
          </div>
        </motion.div>

        {/* 5. Valorant Points / Codashop Instructions Modal */}
        <AnimatePresence>
          {showVpModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={() => setShowVpModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-lg rounded-3xl border border-indigo-500/30 bg-[#0c0d18] p-6 md:p-8 shadow-[0_0_50px_rgba(99,102,241,0.25)] text-left"
              >
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowVpModal(false)}
                  className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="space-y-2 pr-8">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase font-mono tracking-wider">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Direct In-Game Top-Up</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white">
                    Gift Valorant Points (VP)
                  </h3>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    Tops up the developer's Valorant account directly via Codashop. No gift card codes to submit or verify!
                  </p>
                </div>

                {/* Riot ID Box */}
                <div className="mt-5 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-indigo-300 uppercase tracking-wider">
                    <span>Developer Riot ID:</span>
                    <span className="text-slate-400">Riot Games • India</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-xl px-4 py-3">
                    <code className="text-lg md:text-xl font-mono font-black text-amber-300 tracking-wider">
                      {RIOT_ID}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyRiotId}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      {copiedRiotId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy ID</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 3 Steps Guide */}
                <div className="mt-5 space-y-2.5">
                  <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    How it works (3 Quick Steps):
                  </h4>
                  <div className="space-y-2 text-xs md:text-sm text-slate-200">
                    <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
                      <div>
                        <strong className="text-white">Auto-Copy & Open:</strong> Click the button below. We'll automatically copy <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">{RIOT_ID}</code> to your clipboard and open Codashop.
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
                      <div>
                        <strong className="text-white">Paste Riot ID:</strong> In Codashop Step 1, paste (Ctrl+V) into the <strong>Riot ID</strong> field.
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
                      <div>
                        <strong className="text-white">Select VP & Pay:</strong> Pick any recharge amount (from ₹99 / 115 VP) and pay with UPI (Paytm, GPay, PhonePe). The points land instantly in-game!
                      </div>
                    </div>
                  </div>
                </div>

                {/* International Donators Box */}
                <div className="mt-4 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-indigo-300">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Outside India? (International Donators)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Codashop India only accepts Indian UPI. If you are outside India, you can purchase an <strong>India Region Valorant Prepaid Code</strong> on <a href="https://www.seagm.com/valorant-points-india" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline font-semibold">SEAGM</a> with PayPal / Credit Card, or send a global <strong>Steam Wallet Card</strong> via Discord <code className="text-white bg-black/40 px-1 py-0.5 rounded">.donate submit &lt;code&gt;</code>!
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={handleOpenCodashop}
                    className="w-full flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-extrabold text-sm tracking-wide shadow-lg shadow-indigo-500/30 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{copiedRiotId ? '✅ Copied! Opening Codashop...' : '🚀 Copy ID & Open Codashop'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVpModal(false)}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm border border-white/10 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <p className="mt-3 text-[11px] text-slate-500 leading-tight text-center">
                  *Official top-up partners (Codashop, UniPin) prevent pre-filling player IDs via URL for account protection. Our button auto-copies {RIOT_ID} so donators never have to memorize or type it manually.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
