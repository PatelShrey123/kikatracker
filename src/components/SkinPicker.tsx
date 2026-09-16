import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface PickerOption {
  key: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface SkinPickerProps {
  label: string;
  options: PickerOption[];
  value: string | null;
  onChange: (key: string) => void;
  disabled?: boolean;
}

const MAX_VISIBLE = 200;

// Searchable dropdown for catalogs with hundreds of skins
export const SkinPicker: React.FC<SkinPickerProps> = ({ label, options, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.key === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return list.slice(0, MAX_VISIBLE);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <span className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setQuery('');
          setOpen((o) => !o);
        }}
        className="w-full flex items-center justify-between gap-2 bg-[#090A0F]/80 border border-obsidian-border hover:border-gold-primary/40 rounded-xl px-3 py-2.5 text-sm text-left text-white disabled:opacity-50 cursor-pointer"
      >
        <span className="truncate">{selected ? selected.label : 'Select…'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full min-w-[220px] bg-[#0b0d14] border border-obsidian-border rounded-xl shadow-2xl overflow-hidden">
          <div className="relative border-b border-white/5">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${options.length} options`}
              className="w-full bg-transparent outline-none pl-8 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.map((o) => (
              <li key={o.key}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-white/5 cursor-pointer ${
                    o.key === value ? 'text-gold-bright' : 'text-slate-200'
                  }`}
                >
                  <span className="truncate">
                    {o.label}
                    {o.sublabel && <span className="ml-1.5 text-[10px] text-slate-500 uppercase">{o.sublabel}</span>}
                  </span>
                  {o.badge && (
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-400 flex-shrink-0">
                      {o.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-3 text-xs text-slate-500">No matches</li>}
            {filtered.length === MAX_VISIBLE && (
              <li className="px-3 py-2 text-[10px] text-slate-600">Type to narrow down the list…</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
