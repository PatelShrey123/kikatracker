import React, { useState, useEffect, useRef } from 'react';
import { Send, Wifi, WifiOff, Coins, ShieldAlert, Users, ExternalLink, ArrowDown } from 'lucide-react';
import type { MarketItem } from '../utils/csv';
import { formatValue } from '../utils/csv';

interface ChatUser {
  id: string;
  shortId: string;
  name: string;
  role: string;
  level: number;
}

interface ChatMessage {
  id: string;
  user: ChatUser | null;
  type: number;
  message: string;
  timestamp: string;
  isSystem?: boolean;
}

interface ChatSectionProps {
  onSelectPlayer: (id: string, isShortId: boolean) => void;
  marketPrices: Map<string, MarketItem>;
  publicItems: any[];
  fallbackRenders: Record<string, any>;
  onInspectItem: (name: string, type?: string) => void;
}

export const ChatSection: React.FC<ChatSectionProps> = ({ 
  onSelectPlayer, 
  marketPrices, 
  publicItems,
  fallbackRenders,
  onInspectItem
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const autoScrollRef = useRef(true);

  // Sync ref with state to prevent closures in listener
  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  // Connect to live Kirka chat WebSocket
  useEffect(() => {
    const connect = () => {
      setStatus('connecting');
      const ws = new WebSocket('wss://chat.kirka.io');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Kirka.io WebSocket Chat');
        setStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          if (Array.isArray(data)) {
            const history = data.map((msg: any, idx: number) => ({
              id: `hist-${idx}-${Date.now()}`,
              user: msg.user,
              type: msg.type,
              message: msg.message,
              timestamp: timeStr,
              isSystem: !msg.user
            }));
            setMessages(history);
          } else {
            const newMsg: ChatMessage = {
              id: `msg-${Date.now()}-${Math.random()}`,
              user: data.user,
              type: data.type,
              message: data.message,
              timestamp: timeStr,
              isSystem: !data.user
            };
            setMessages((prev) => [...prev, newMsg].slice(-100));
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket closed, reconnecting in 4s...');
        setStatus('disconnected');
        setTimeout(connect, 4000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Scroll to bottom on new message if auto scroll is enabled
  useEffect(() => {
    if (autoScrollRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Helper to determine border color matching rarity for skin badges
  const getRarityBorderColor = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'MYTHICAL':
      case 'MYTHIC':
        return 'border-rarity-mythic bg-rarity-mythic/10 text-rarity-mythic';
      case 'LEGENDARY':
        return 'border-rarity-legendary bg-rarity-legendary/10 text-rarity-legendary';
      case 'EPIC':
        return 'border-rarity-epic bg-rarity-epic/10 text-rarity-epic';
      case 'RARE':
        return 'border-rarity-rare bg-rarity-rare/10 text-rarity-rare';
      default:
        return 'border-rarity-common/30 bg-rarity-common/5 text-slate-400';
    }
  };

  // Renders the hover tooltip with pricing and images
  const SkinBadge: React.FC<{ name: string; parentName: string; itemType: string; rarity: string }> = ({
    name,
    parentName,
    itemType,
    rarity,
  }) => {
    const isCharacter = itemType.toUpperCase() === 'BODY_SKIN';
    const typeKey = isCharacter ? 'character' : parentName;
    const compositeKey = `${name.toLowerCase()}_${typeKey.toLowerCase()}`;
    const nameKey = name.toLowerCase();

    // Lookup Bolt Price
    const priceData = marketPrices.get(compositeKey) || marketPrices.get(nameKey);
    const price = priceData ? priceData.baseValue : 0;

    // Lookup Skin Render URL (using fallback renders JSON first)
    let renderUrl = null;
    const fallback = fallbackRenders[nameKey];
    if (fallback && fallback.renderurl) {
      renderUrl = fallback.renderurl;
    } else {
      // Try combo name e.g. "Delicate M60"
      const comboKey = parentName ? `${nameKey} ${parentName.toLowerCase()}` : nameKey;
      const comboFallback = fallbackRenders[comboKey];
      if (comboFallback && comboFallback.renderurl) {
        renderUrl = comboFallback.renderurl;
      } else {
        const itemData = publicItems.find(
          (p) =>
            p.name.toLowerCase() === name.toLowerCase() &&
            (isCharacter ? p.type === 'BODY_SKIN' : p.parent?.name.toLowerCase() === parentName.toLowerCase())
        );
        renderUrl = itemData ? itemData.renderUrl : null;
      }
    }

    const displayName = parentName ? `${name} ${parentName}` : name;

    return (
      <span 
        onClick={(e) => {
          e.stopPropagation();
          onInspectItem(name, isCharacter ? 'character' : parentName);
        }}
        className="relative group/badge inline-block cursor-pointer mx-1 align-middle"
      >
        <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${getRarityBorderColor(rarity)}`}>
          {displayName}
        </span>

        {/* Hover Tooltip Overlay */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover/badge:flex flex-col bg-[#12141D] border border-obsidian-border rounded-xl p-3 shadow-[0_10px_35px_rgba(0,0,0,0.5)] z-50 text-left pointer-events-none">
          {/* Item Render Image */}
          {renderUrl ? (
            <div className="w-full h-20 flex items-center justify-center mb-2">
              <img
                src={renderUrl}
                alt={displayName}
                className="max-h-20 max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
              />
            </div>
          ) : (
            <div className="w-full h-12 flex items-center justify-center mb-2 border border-white/5 bg-[#090A0F]/50 rounded-lg text-[9px] text-slate-500 font-mono">
              NO RENDER IMAGE
            </div>
          )}

          {/* Skin Title */}
          <span className="text-xs font-extrabold text-white block truncate">{displayName}</span>
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mt-0.5">
            {isCharacter ? 'Character Skin' : `${parentName} Weapon Skin`}
          </span>

          <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-white/5 font-mono text-[10px]">
            <span className="text-slate-500">Bolt Price:</span>
            <div className="flex items-center space-x-1 text-gold-bright font-black">
              <Coins className="w-3 h-3 text-gold-primary" />
              <span>{price > 0 ? formatValue(price) : '—'}</span>
            </div>
          </div>
        </div>
      </span>
    );
  };

  // Parses websocket text blocks, matching [SkinName|ParentName|ItemType|Rarity] strings
  const parseMessageText = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /\[([^\]|]+)\|([^\]|]*)\|([^\]|]*)\|([^\]|]*)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      const skinName = match[1];
      const parentName = match[2];
      const itemType = match[3];
      const rarity = match[4];

      parts.push(
        <SkinBadge
          key={matchIndex}
          name={skinName}
          parentName={parentName}
          itemType={itemType}
          rarity={rarity}
        />
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-obsidian-border pb-5 mb-5 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gold-primary/10 rounded-lg border border-gold-primary/25">
            <Users className="w-5 h-5 text-gold-bright" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white uppercase tracking-wider">Lounge Feed</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Live in-game lobby stream from the public WebSocket network.
            </p>
          </div>
        </div>

        {/* Connection status tag */}
        <div className="flex items-center font-mono text-xs">
          {status === 'connected' ? (
            <span className="flex items-center space-x-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-bold">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span>CONNECTED</span>
            </span>
          ) : status === 'connecting' ? (
            <span className="flex items-center space-x-1.5 text-gold-bright bg-gold-primary/10 border border-gold-primary/30 px-3 py-1.5 rounded-lg font-bold">
              <div className="w-3.5 h-3.5 border-2 border-gold-primary border-t-transparent rounded-full animate-spin" />
              <span>CONNECTING</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg font-bold">
              <WifiOff className="w-4 h-4 text-red-500" />
              <span>OFFLINE</span>
            </span>
          )}
        </div>
      </div>

      {/* Messages Scroll Area with Floating Auto Scroll Control */}
      <div className="flex-1 relative flex flex-col min-h-0 mb-4 select-text">
        {/* Scroll viewport */}
        <div className="flex-grow bg-[#090A0F]/80 border border-obsidian-border rounded-2xl p-5 overflow-y-auto space-y-3.5 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2">
              <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Listening for in-game packets...</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.user?.id === 'me';
              const isSystem = msg.isSystem;

              // Render Trade Offers/System Alerts (type: 13)
              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    className="flex items-center space-x-2 bg-gradient-to-r from-gold-primary/10 to-[#1b1911]/20 border border-gold-primary/25 p-3 rounded-xl justify-center text-center text-xs font-mono text-gold-bright shadow-sm"
                  >
                    <ShieldAlert className="w-4 h-4 text-gold-primary" />
                    <span>{msg.message}</span>
                    <span className="text-[9px] text-slate-600 font-mono ml-3">{msg.timestamp}</span>
                  </div>
                );
              }

              const role = msg.user?.role.toUpperCase() || 'USER';
              const isBot = role === 'BOT' || msg.message.includes('[BOT]');

              return (
                <div
                  key={msg.id}
                  className="flex items-start space-x-2 text-xs select-text hover:bg-obsidian-card/20 p-1.5 rounded-lg transition-colors group/row"
                >
                  {/* Timestamp */}
                  <span className="text-slate-600 font-mono whitespace-nowrap mt-0.5">{msg.timestamp}</span>

                  {/* Player details */}
                  <div className="flex flex-wrap items-baseline gap-1.5 flex-1 leading-relaxed">
                    {/* Clickable Username */}
                    <span
                      onClick={() => {
                        if (msg.user) onSelectPlayer(msg.user.id, false);
                      }}
                      className={`font-black font-mono cursor-pointer hover:text-gold-bright hover:underline transition-colors flex items-center space-x-0.5 ${
                        isMe ? 'text-gold-bright' : isBot ? 'text-amber-400' : 'text-[#818cf8]'
                      }`}
                    >
                      <span>{msg.user?.name}</span>
                      <span className="opacity-60">#{msg.user?.shortId}</span>
                    </span>

                    {/* Level Tag */}
                    <span className="text-[10px] font-mono text-slate-500">
                      [Lvl {msg.user?.level}]
                    </span>

                    {/* Bot badge */}
                    {isBot && (
                      <span className="bg-amber-400/10 border border-amber-400/35 text-amber-400 text-[8px] font-black px-1 rounded font-mono uppercase tracking-wider scale-[0.85] origin-left">
                        BOT
                      </span>
                    )}

                    {/* Message content (withParsed Skin badges) */}
                    <span className="text-slate-300 pl-1 select-text">
                      {parseMessageText(msg.message)}
                    </span>
                  </div>

                  {/* Quick inspect icon on row hover */}
                  {msg.user && !isMe && !isBot && (
                    <button
                      onClick={() => onSelectPlayer(msg.user!.id, false)}
                      className="opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 text-slate-500 hover:text-gold-bright ml-2"
                      title="Inspect Player Inventory"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Floating Auto Scroll Toggle Button */}
        <div className="absolute bottom-4 right-4 z-20">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-2 rounded-xl border font-mono text-[9px] font-black tracking-widest uppercase transition-all duration-300 flex items-center space-x-2 shadow-[0_4px_15px_rgba(0,0,0,0.4)] ${
              autoScroll
                ? 'bg-gold-primary/20 border-gold-primary/40 text-gold-bright hover:bg-gold-primary/30'
                : 'bg-obsidian-card border-obsidian-border text-slate-500 hover:text-slate-400'
            }`}
          >
            {autoScroll ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-gold-bright animate-ping" />
                <span>AUTO SCROLL: ON</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-3 h-3 text-slate-500" />
                <span>AUTO SCROLL: OFF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Input Message Form (Disabled) */}
      <form onSubmit={(e) => e.preventDefault()} className="flex gap-3 flex-shrink-0 opacity-55 cursor-not-allowed">
        <input
          type="text"
          placeholder="Lounge chat stream is read-only. Sending messages is disabled."
          disabled
          className="flex-1 bg-obsidian-card border border-obsidian-border rounded-xl px-4 py-3.5 text-slate-400 placeholder-slate-600 outline-none text-sm cursor-not-allowed"
        />
        <button
          type="button"
          disabled
          className="flex items-center justify-center bg-slate-800 border border-obsidian-border text-slate-500 px-5 py-3.5 rounded-xl font-bold cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
