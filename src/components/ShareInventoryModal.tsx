import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Download, RefreshCw, Square, CheckSquare, AlertTriangle } from 'lucide-react';
import html2canvas from 'html2canvas';
import type { UserInventoryItem } from '../utils/api';

interface ShareInventoryModalProps {
  inventory: UserInventoryItem[];
  isOpen: boolean;
  onClose: () => void;
  getItemPrice: (item: any) => number;
  getItemRenderUrl: (item: any) => string | null;
  username: string;
}

export const ShareInventoryModal: React.FC<ShareInventoryModalProps> = ({
  inventory,
  isOpen,
  onClose,
  getItemPrice,
  getItemRenderUrl,
  username
}) => {
  const [itemsState, setItemsState] = useState<
    { id: string; name: string; amount: number; price: number; enabled: boolean; item: any }[]
  >([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Initialize and automatically sort inventory descending by value.
  // Enable ONLY the top 15 items by default to prevent large clipboards and memory errors.
  useEffect(() => {
    if (isOpen && inventory.length > 0) {
      const sorted = [...inventory].sort(
        (a, b) => getItemPrice(b.item) - getItemPrice(a.item)
      );
      
      const initial = sorted.map((invItem, idx) => ({
        id: invItem.item.id,
        name: invItem.item.name,
        amount: invItem.amount,
        price: getItemPrice(invItem.item),
        enabled: idx < 15, // Default enable top 15 items
        item: invItem.item
      }));
      setItemsState(initial);
    }
  }, [isOpen, inventory]);

  if (!isOpen) return null;

  const toggleItem = (id: string) => {
    setItemsState(prev =>
      prev.map(item => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const updatePrice = (id: string, priceStr: string) => {
    const val = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
    setItemsState(prev =>
      prev.map(item => (item.id === id ? { ...item, price: val } : item))
    );
  };

  const selectAll = () => {
    // Enable only up to 15 items for safety
    setItemsState(prev => prev.map((item, idx) => ({ ...item, enabled: idx < 15 })));
  };

  const deselectAll = () => {
    setItemsState(prev => prev.map(item => ({ ...item, enabled: false })));
  };

  const resetPrices = () => {
    const sorted = [...inventory].sort(
      (a, b) => getItemPrice(b.item) - getItemPrice(a.item)
    );
    const reset = sorted.map((invItem, idx) => ({
      id: invItem.item.id,
      name: invItem.item.name,
      amount: invItem.amount,
      price: getItemPrice(invItem.item),
      enabled: idx < 15,
      item: invItem.item
    }));
    setItemsState(reset);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'MYTHICAL':
      case 'MYTHIC':
        return '#ef4444';
      case 'LEGENDARY':
        return '#f97316';
      case 'EPIC':
        return '#a855f7';
      case 'RARE':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  const formatWithSpaces = (num: number | string) => {
    if (num === undefined || num === null) return '';
    const str = num.toString().replace(/[^0-9.]/g, '');
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
  };

  const formatShorthand = (val: number) => {
    if (val >= 1000000000) {
      return (val / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (val >= 1000) {
      return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return val.toString();
  };

  const getProxiedImageUrl = (url: string | null) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('http://localhost') || url.includes(window.location.host)) {
      return url;
    }
    // Encodes URL to bypass CORS policies via images.weserv.nl
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
  };

  const enabledItems = itemsState.filter(i => i.enabled);
  const filteredList = itemsState.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const maxAllowed = 15;
  const isOverLimit = enabledItems.length > maxAllowed;

  // High-performance direct Clipboard Copy using ClipboardItem Promise.
  // This executes synchronously inside the click handler to satisfy browser security rules,
  // preventing lag because the rendering runs inside the promise without blocking the UI loops!
  const handleCopyClipboard = async () => {
    if (isOverLimit || !previewRef.current) return;
    setCopyStatus('Copying...');

    try {
      const copyPromise = new Promise<Blob>((resolve, reject) => {
        html2canvas(previewRef.current!, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#121214',
          scale: 1.5
        })
          .then((canvas) => {
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to generate image blob'));
              }
            }, 'image/png');
          })
          .catch(reject);
      });

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': copyPromise })
      ]);

      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
      // Fallback: download
      handleDownload();
      setCopyStatus('Saved to PC!');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const handleDownload = async () => {
    if (!previewRef.current || isOverLimit) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#121214',
        scale: 1.5
      });
      triggerDownload(canvas);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const triggerDownload = (canvas: HTMLCanvasElement) => {
    const link = document.createElement('a');
    link.download = `${username}_inventory_valuation.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto font-sans select-text">
      <div className="relative max-w-6xl w-full bg-[#0b0c12] border border-obsidian-border rounded-2xl p-6 flex flex-col lg:flex-row gap-6 max-h-[90vh] overflow-hidden shadow-2xl">
        
        {/* Left Side: Settings */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-obsidian-border/50">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider">Customize Valuation</h3>
              <p className="text-xs text-slate-400 font-medium">Select items to display and override pricing before exporting</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions Search */}
          <div className="py-4 space-y-3">
            <input
              type="text"
              placeholder="Search items by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#12141f] border border-obsidian-border rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-gold-primary/45 focus:shadow-gold-glow transition-all"
            />
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={selectAll}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#171926] border border-white/5 hover:bg-[#202336] rounded-lg text-[10px] font-bold text-slate-300 transition-colors uppercase font-mono cursor-pointer"
              >
                <CheckSquare className="w-3 h-3 text-gold-primary" />
                <span>Select Top 15</span>
              </button>
              <button
                onClick={deselectAll}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#171926] border border-white/5 hover:bg-[#202336] rounded-lg text-[10px] font-bold text-slate-300 transition-colors uppercase font-mono cursor-pointer"
              >
                <Square className="w-3 h-3 text-slate-500" />
                <span>Deselect All</span>
              </button>
              <button
                onClick={resetPrices}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#171926] border border-white/5 hover:bg-[#202336] rounded-lg text-[10px] font-bold text-slate-300 transition-colors uppercase font-mono cursor-pointer ml-auto"
              >
                <RefreshCw className="w-3 h-3 text-gold-primary" />
                <span>Reset Settings</span>
              </button>
            </div>
          </div>

          {/* Item configuration list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredList.map((itemObj) => {
              const renderUrl = getItemRenderUrl(itemObj.item);
              return (
                <div
                  key={itemObj.id}
                  className={`flex items-center gap-4 bg-[#12141f]/40 border rounded-xl p-3 hover:bg-[#12141f]/75 transition-all ${
                    itemObj.enabled ? 'border-obsidian-border/80' : 'border-obsidian-border/20 opacity-50'
                  }`}
                >
                  <button
                    onClick={() => toggleItem(itemObj.id)}
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {itemObj.enabled ? (
                      <CheckSquare className="w-4 h-4 text-gold-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </button>

                  <div className="w-10 h-10 bg-obsidian-deep/50 border border-white/5 rounded-lg flex items-center justify-center p-1 overflow-hidden">
                    {renderUrl ? (
                      <img src={renderUrl} alt={itemObj.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-[8px] text-slate-600 font-bold uppercase font-mono">No Img</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <h5 className="text-xs font-bold text-white line-clamp-1">{itemObj.name}</h5>
                    <span className="text-[9px] font-mono text-slate-500 uppercase">
                      x{itemObj.amount} units
                    </span>
                  </div>

                  <div className="w-32 flex items-center bg-[#0d0e15] border border-obsidian-border rounded-lg px-2 py-1">
                    <img src={`${import.meta.env.BASE_URL}kirka_coin.png`} alt="Coin" className="w-3.5 h-3.5 object-contain mr-1 filter drop-shadow-[0_0_2px_rgba(212,175,55,0.3)]" />
                    <input
                      type="text"
                      value={formatWithSpaces(itemObj.price)}
                      onChange={(e) => updatePrice(itemObj.id, e.target.value)}
                      placeholder="Price"
                      className="w-full bg-transparent text-xs font-mono font-bold text-white outline-none border-0 ring-0 text-right p-0.5"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Export Preview */}
        <div className="w-full lg:w-[480px] flex flex-col border-t lg:border-t-0 lg:border-l border-obsidian-border/50 pt-6 lg:pt-0 lg:pl-6 overflow-hidden">
          <div className="pb-4">
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Export Preview</h3>
            <p className="text-xs text-slate-400 font-medium">Preview matches the generated copy layout</p>
          </div>

          {/* Screenshot capture target container */}
          <div className="flex-1 overflow-y-auto pr-1 py-1">
            <div
              ref={previewRef}
              id="share-grid-capture"
              className="w-full bg-[#121214] p-5 rounded-xl border border-white/5 select-none"
              style={{ contentVisibility: 'auto' }}
            >
              {/* Header Title in Screenshot */}
              <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-white/5 font-mono">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Kirka.io Inventory</span>
                  <span className="text-sm font-black text-white uppercase tracking-wider">{username}'s Valuation</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Total Value</span>
                  <span className="text-xs font-bold text-gold-bright flex items-center justify-end space-x-1">
                    <img src={`${import.meta.env.BASE_URL}kirka_coin.png`} alt="Coin" className="w-3.5 h-3.5 object-contain filter drop-shadow-[0_0_2px_rgba(212,175,55,0.3)]" />
                    <span>{formatWithSpaces(enabledItems.reduce((sum, item) => sum + item.price * item.amount, 0))}</span>
                  </span>
                </div>
              </div>

              {/* Grid Layout (exactly 5 columns, now showing CORS-proxied images) */}
              {enabledItems.length === 0 ? (
                <div className="text-center py-20 text-slate-600 text-xs font-mono">
                  Select items from the list to show them here
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 bg-[#121214]">
                  {enabledItems.map((itemObj) => {
                    const renderUrl = getItemRenderUrl(itemObj.item);
                    const color = getRarityColor(itemObj.item.rarity);
                    
                    return (
                      <div
                        key={itemObj.id}
                        className="relative flex flex-col justify-between bg-[#1c1c1f] rounded-lg p-2 min-h-[96px] border-2 shadow-md transition-all duration-300"
                        style={{ borderColor: color }}
                      >
                        {/* Name at Top Center */}
                        <div className="text-center w-full">
                          <span className="text-[8px] font-black text-white font-mono uppercase line-clamp-1 block select-none mb-1">
                            {itemObj.name}
                          </span>
                        </div>

                        {/* Proxied Skin Image in Center (Renders correctly via CORS proxy) */}
                        <div className="w-full h-11 flex items-center justify-center my-1.5">
                          {renderUrl ? (
                            <img
                              src={getProxiedImageUrl(renderUrl)}
                              alt={itemObj.name}
                              crossOrigin="anonymous"
                              className="max-h-11 max-w-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                            />
                          ) : (
                            <div className="text-[7px] text-slate-600 font-bold uppercase font-mono">No skin</div>
                          )}
                        </div>

                        {/* Bottom Row: Valuation left, Count right */}
                        <div className="flex justify-between items-center font-mono text-[8px] text-slate-300 pt-1.5 border-t border-white/5">
                          <span className="text-gold-bright font-black">{formatShorthand(itemObj.price)}</span>
                          <span className="text-slate-400 font-bold">{itemObj.amount}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Limit Warnings */}
          {isOverLimit && (
            <div className="mt-4 flex items-center space-x-2 bg-red-950/40 border border-red-500/20 p-3 rounded-xl text-[10px] font-mono text-red-400">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>Max {maxAllowed} items allowed to prevent clipboard memory limits. Current: {enabledItems.length}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-5 mt-auto flex items-center gap-3">
            <button
              onClick={handleCopyClipboard}
              disabled={enabledItems.length === 0 || isOverLimit}
              className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-gold-primary to-gold-bright text-obsidian-deep py-3 rounded-xl font-bold hover:shadow-gold-glow disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer text-xs"
            >
              <Camera className="w-4 h-4" />
              <span>{copyStatus || 'Copy to Clipboard'}</span>
            </button>
            
            <button
              onClick={handleDownload}
              disabled={enabledItems.length === 0 || downloading || isOverLimit}
              className="flex items-center justify-center space-x-1.5 bg-[#171926] border border-white/5 hover:bg-[#202336] text-white p-3 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              title="Download PNG Image"
            >
              {downloading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
