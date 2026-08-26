import React from 'react';
import { Download, Shield, Zap, Cpu, Settings, CheckCircle, Monitor } from 'lucide-react';
import { motion } from 'framer-motion';

export const ClientDownloadSection: React.FC = () => {
  const clientFeatures = [
    {
      icon: Zap,
      title: 'Uncapped FPS',
      desc: 'Bypasses browser Chromium locks to run Kirka.io at 240+ FPS, offering buttery smooth slide-hopping and tracking.',
      color: 'from-amber-500/20 to-gold-primary/5',
      glow: 'group-hover:border-gold-primary/45'
    },
    {
      icon: Cpu,
      title: 'Resource Swapper',
      desc: 'Inject custom weapon models, player textures, hit sounds, and custom CSS stylesheets directly from your local folders.',
      color: 'from-blue-500/10 to-indigo-500/5',
      glow: 'group-hover:border-blue-500/35'
    },
    {
      icon: Monitor,
      title: 'Discord RPC',
      desc: 'Integrates natively with Discord to display your active game mode, K/D ratio, and current lobby to your friends.',
      color: 'from-indigo-600/10 to-purple-600/5',
      glow: 'group-hover:border-indigo-500/35'
    },
    {
      icon: Settings,
      title: 'Permanent Crosshairs',
      desc: 'Draw custom visual crosshairs on-screen, hide lobby ads, skip loading scenes, and customize in-game kill indicators.',
      color: 'from-emerald-500/10 to-teal-500/5',
      glow: 'group-hover:border-emerald-500/35'
    }
  ];

  const downloadPlatforms = [
    {
      name: 'Windows Client',
      details: 'Desktop wrapper • v1.0.8 installer',
      filename: 'kirkaxpert-client-setup-win-1.0.8.exe',
      path: './downloads/kirkaxpert-client-setup-win-1.0.8.exe',
      icon: Download,
      primary: true
    },
    {
      name: 'Chrome Extension',
      details: 'Browser extension • Bypasses Smart App Control',
      filename: 'kirka-xpert-extension.zip',
      path: './downloads/kirka-xpert-extension.zip',
      icon: Download,
      primary: false
    }
  ];

  return (
    <div className="min-h-screen py-8 px-6 lg:px-12 bg-gradient-to-b from-[#05060b] via-[#090b14] to-[#040508] relative overflow-hidden select-none">
      
      {/* Background visual elements */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-indigo-500/5 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-12 relative z-10">
        
        {/* Page Header */}
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-gold-primary/30 bg-gold-primary/5 text-gold-bright text-xs font-mono uppercase tracking-widest"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Official Desktop Client & Extension</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl lg:text-5xl font-black tracking-tighter bg-gradient-to-r from-white via-slate-100 to-gold-primary bg-clip-text text-transparent"
          >
            KIRKAXPERT TRADE ENGINE
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm lg:text-base text-slate-400 max-w-xl mx-auto font-medium"
          >
            Play Kirka.io with custom trade scanners, auto-accept wood features, inline shortcuts, and live hud overlays on desktop or right in your browser.
          </motion.p>
        </div>

        {/* Hero Banner Image Showcase */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="relative rounded-2xl border border-obsidian-border/80 bg-[#08090f]/60 backdrop-blur-md overflow-hidden aspect-[21/9] shadow-[0_24px_50px_rgba(0,0,0,0.6)] flex items-center justify-center group"
        >
          <img 
            src="./kirka_xpert_client.png" 
            alt="KirkaXpert Client Launcher Mockup" 
            className="w-full h-full object-cover opacity-80 group-hover:scale-101 transition-transform duration-700"
            onError={(e) => {
              // Fail-safe if image isn't generated or loaded
              e.currentTarget.style.display = 'none';
            }}
          />
          
          {/* Overlay text in case image fails */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-t from-[#05060b] via-transparent to-transparent">
            <h2 className="text-xl lg:text-2xl font-black text-white tracking-widest uppercase">
              Ultra-Low Latency Engine
            </h2>
            <p className="text-[10px] lg:text-xs text-indigo-400 font-mono mt-1">
              BUILT-IN RAM OPTIMIZER & GPU SWITCHES
            </p>
          </div>
        </motion.div>

        {/* Download Section Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {downloadPlatforms.map((platform, idx) => {
            const isWin = platform.primary;
            return (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * idx + 0.3 }}
                className={`rounded-2xl p-6 border flex flex-col justify-between shadow-xl relative overflow-hidden group ${
                  isWin 
                    ? 'border-gold-primary/30 bg-[#0f0e0a]/40 shadow-gold-primary/2' 
                    : 'border-indigo-500/20 bg-[#08090e]/40'
                }`}
              >
                {isWin && (
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-gold-primary/10 rounded-full blur-xl pointer-events-none" />
                )}
                
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="text-lg font-black text-white">{platform.name}</span>
                    {isWin ? (
                      <span className="text-[10px] font-bold text-gold-bright bg-gold-primary/15 border border-gold-primary/30 px-2 py-0.5 rounded uppercase font-mono">
                        Desktop app
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded uppercase font-mono">
                        Bypasses SAC
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{platform.details}</p>
                </div>

                <div className="mt-8 space-y-3">
                  <span className="text-[10px] text-slate-600 font-mono block overflow-hidden text-ellipsis whitespace-nowrap">
                    {platform.filename}
                  </span>
                  
                  <a
                    href={platform.path}
                    download
                    className={`flex items-center justify-center space-x-2.5 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      isWin
                        ? 'bg-gradient-to-r from-gold-primary to-amber-500 text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.35)] active:scale-98 cursor-pointer'
                        : 'bg-[#0f172a] hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-98 cursor-pointer'
                    }`}
                  >
                    <Download className={`w-4 h-4 ${isWin ? 'text-black' : 'text-slate-400'}`} />
                    <span>{isWin ? 'Download Installer' : 'Download Extension ZIP'}</span>
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Highlights Grid */}
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-black tracking-widest text-slate-400 font-mono uppercase">
              Client Capabilities
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {clientFeatures.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, x: idx % 2 === 0 ? -15 : 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx + 0.4 }}
                  className={`p-6 rounded-2xl bg-[#07080d]/65 border border-obsidian-border flex items-start space-x-4 group hover:bg-[#090b12] hover:border-slate-800 transition-all duration-300`}
                >
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${feat.color} border border-white/5`}>
                    <Icon className="w-5 h-5 text-gold-bright" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-base font-bold text-slate-200 group-hover:text-white transition-colors duration-200">
                      {feat.title}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      {feat.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Installation Instructions */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Desktop Setup */}
          <div className="rounded-2xl border border-obsidian-border/60 bg-[#06080d]/50 p-6 space-y-4">
            <h4 className="text-sm font-black tracking-widest text-gold-bright uppercase font-mono border-b border-obsidian-border/50 pb-3 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-gold-primary" />
              <span>Desktop Client Guide</span>
            </h4>
            <div className="space-y-3 text-xs text-slate-400">
              <p><strong className="text-slate-200">1. Run Installer:</strong> Download the setup executable, run it, and complete the installation.</p>
              <p><strong className="text-slate-200">2. Open Launcher:</strong> Launch KirkaXpert Client from your desktop shortcut.</p>
              <p><strong className="text-slate-200">3. Right Shift Toggle:</strong> Once inside the game lobby, press the <strong className="text-gold-bright">Right Shift</strong> key to open the client settings overlay menu.</p>
            </div>
          </div>

          {/* Extension Setup */}
          <div className="rounded-2xl border border-obsidian-border/60 bg-[#06080d]/50 p-6 space-y-4">
            <h4 className="text-sm font-black tracking-widest text-indigo-400 uppercase font-mono border-b border-obsidian-border/50 pb-3 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-indigo-400" />
              <span>Chrome Extension Guide</span>
            </h4>
            <div className="space-y-3 text-xs text-slate-400">
              <p><strong className="text-slate-200">1. Extract ZIP:</strong> Download the extension package and extract the ZIP folder to your PC.</p>
              <p><strong className="text-slate-200">2. Enable Dev Mode:</strong> Go to <strong className="text-slate-200">chrome://extensions</strong> in Chrome and toggle <strong className="text-indigo-400">Developer mode</strong> in the top-right.</p>
              <p><strong className="text-slate-200">3. Load Unpacked:</strong> Click the <strong className="text-slate-200">Load unpacked</strong> button in the top-left and select the extracted folder.</p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};
