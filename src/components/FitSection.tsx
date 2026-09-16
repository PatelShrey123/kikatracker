import React, { useEffect, useMemo, useState } from 'react';
import { Search, Shirt, AlertCircle, Loader2, Download, Link2, Check, RotateCcw, Shuffle } from 'lucide-react';
import type { UserProfile, UserInventoryItem } from '../utils/api';
import { fetchUserProfile, fetchUserInventory } from '../utils/api';
import { InGameFitShowcase } from './InGameFitShowcase';
import type { FitOverrides, LoadoutItem } from './InGameFitShowcase';
import { SkinPicker } from './SkinPicker';
import type { PickerOption } from './SkinPicker';

const PLAYER = '__player__';
const DEFAULT = '__default__';
const PRIMARY_TYPES = ['SCAR', 'VITA', 'AR-9', 'LAR', 'M60', 'MAC-10', 'Weatie', 'Revolver'];
const MELEE_TYPES = ['Tomahawk', 'Bayonet'];

interface Combo {
  character: string;
  primaryType: string;
  primarySkin: string;
  secondarySkin: string;
  meleeType: string;
  meleeSkin: string;
}

const PLAYER_COMBO: Combo = {
  character: PLAYER,
  primaryType: PLAYER,
  primarySkin: PLAYER,
  secondarySkin: PLAYER,
  meleeType: PLAYER,
  meleeSkin: PLAYER,
};

const sameName = (a?: string | null, b?: string | null) => (a || '').toLowerCase() === (b || '').toLowerCase();

function skinOption(item: any): PickerOption {
  return {
    key: item.name,
    label: item.name,
    sublabel: item.rarity ? String(item.rarity).toLowerCase() : undefined,
    badge: item.published === false ? 'api2' : undefined,
  };
}

// Base weapon (no skin) as a loadout item, using the catalog's default texture when available
function baseWeaponItem(catalog: any[], type: string, slotType: string): LoadoutItem {
  const base = catalog.find((c) => c.type === slotType && sameName(c.name, type));
  return {
    name: type,
    type: 'WEAPON_SKIN',
    parent: { name: type, type: slotType },
    textureUrl: base?.textureUrl || null,
    renderUrl: base?.renderUrl || null,
  };
}

interface FitSectionProps {
  initialPlayerId: string | null;
  catalog: any[];
  onPlayerLoaded: (shortId: string) => void;
  onInspectItem: (name: string, type?: string, amount?: number, textureUrl?: string | null) => void;
}

function parsePlayerId(raw: string): { id: string; isShortId: boolean } | null {
  const trimmed = raw.trim().replace(/^#/, '');
  if (/^[a-zA-Z0-9]{6}$/.test(trimmed)) return { id: trimmed.toUpperCase(), isShortId: true };
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)) return { id: trimmed, isShortId: false };
  return null;
}

export const FitSection: React.FC<FitSectionProps> = ({ initialPlayerId, catalog, onPlayerLoaded, onInspectItem }) => {
  const [query, setQuery] = useState(initialPlayerId ? `#${initialPlayerId}` : '');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inventory, setInventory] = useState<UserInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [combo, setCombo] = useState<Combo>(PLAYER_COMBO);

  const skinsByParent = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of catalog) {
      if (item?.type !== 'WEAPON_SKIN' || !item.parent?.name) continue;
      const key = item.parent.name.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [catalog]);

  const characters = useMemo(
    () => catalog.filter((c) => c?.type === 'BODY_SKIN').sort((a, b) => a.name.localeCompare(b.name)),
    [catalog]
  );

  // The player's own equipped weapon types, so skin lists follow them until a type is picked
  const playerPrimaryType = profile?.activeWeapon1Skin?.parent?.name
    || inventory.find((i) => i.isSelected && i.item.parent?.type === 'WEAPON_1')?.item.parent?.name
    || 'SCAR';
  const playerMeleeType = inventory.find((i) => i.isSelected && i.item.parent?.type === 'WEAPON_3')?.item.parent?.name || 'Bayonet';

  const primaryType = combo.primaryType === PLAYER ? playerPrimaryType : combo.primaryType;
  const meleeType = combo.meleeType === PLAYER ? playerMeleeType : combo.meleeType;

  const withPlayerAndDefault = (items: any[], typeLabel: string): PickerOption[] => [
    { key: PLAYER, label: "Player's equipped" },
    { key: DEFAULT, label: `Default ${typeLabel}` },
    ...items.map(skinOption),
  ];

  const pickerOptions = useMemo(
    () => ({
      character: [{ key: PLAYER, label: "Player's equipped" }, ...characters.map(skinOption)],
      primaryType: [{ key: PLAYER, label: "Player's equipped" }, ...PRIMARY_TYPES.map((t) => ({ key: t, label: t }))],
      primarySkin: withPlayerAndDefault(skinsByParent.get(primaryType.toLowerCase()) || [], primaryType),
      secondarySkin: withPlayerAndDefault(skinsByParent.get('shark') || [], 'Shark'),
      meleeType: [{ key: PLAYER, label: "Player's equipped" }, ...MELEE_TYPES.map((t) => ({ key: t, label: t }))],
      meleeSkin: withPlayerAndDefault(skinsByParent.get(meleeType.toLowerCase()) || [], meleeType),
    }),
    [characters, skinsByParent, primaryType, meleeType]
  );

  const overrides = useMemo<FitOverrides>(() => {
    const pickSkin = (skin: string, type: string, slotType: string): LoadoutItem | null => {
      if (skin === DEFAULT) return baseWeaponItem(catalog, type, slotType);
      if (skin === PLAYER) return null;
      return (skinsByParent.get(type.toLowerCase()) || []).find((s) => s.name === skin) || null;
    };
    const result: FitOverrides = {};
    if (combo.character !== PLAYER) result.character = characters.find((c) => c.name === combo.character) || null;

    // Picking a new weapon type without a skin shows the default weapon of that type
    const primarySkin = combo.primaryType !== PLAYER && combo.primarySkin === PLAYER ? DEFAULT : combo.primarySkin;
    result.primary = pickSkin(primarySkin, primaryType, 'WEAPON_1');
    result.secondary = pickSkin(combo.secondarySkin, 'Shark', 'WEAPON_2');
    const meleeSkin = combo.meleeType !== PLAYER && combo.meleeSkin === PLAYER ? DEFAULT : combo.meleeSkin;
    result.melee = pickSkin(meleeSkin, meleeType, 'WEAPON_3');
    return result;
  }, [combo, catalog, characters, skinsByParent, primaryType, meleeType]);

  const updateCombo = (patch: Partial<Combo>) => setCombo((prev) => ({ ...prev, ...patch }));

  const randomize = () => {
    const pick = <T,>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];
    const nextPrimaryType = pick(PRIMARY_TYPES)!;
    const nextMeleeType = pick(MELEE_TYPES)!;
    setCombo({
      character: pick(characters)?.name ?? PLAYER,
      primaryType: nextPrimaryType,
      primarySkin: pick(skinsByParent.get(nextPrimaryType.toLowerCase()) || [])?.name ?? DEFAULT,
      secondarySkin: pick(skinsByParent.get('shark') || [])?.name ?? DEFAULT,
      meleeType: nextMeleeType,
      meleeSkin: pick(skinsByParent.get(nextMeleeType.toLowerCase()) || [])?.name ?? DEFAULT,
    });
  };

  const loadPlayer = async (raw: string) => {
    const parsed = parsePlayerId(raw);
    if (!parsed) {
      setError('Enter a 6-character short ID (e.g. #FUYR7K) or a player UUID.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextProfile = await fetchUserProfile(parsed.id, parsed.isShortId);
      if (!nextProfile?.name) throw new Error('Player not found.');
      let nextInventory = await fetchUserInventory(nextProfile.id);
      if (nextInventory.length === 0) {
        // The inventory endpoint intermittently rejects requests; one retry fills the loadout slots
        await new Promise((r) => setTimeout(r, 800));
        nextInventory = await fetchUserInventory(nextProfile.id);
      }
      setProfile(nextProfile);
      setInventory(nextInventory);
      setCombo(PLAYER_COMBO);
      onPlayerLoaded(nextProfile.shortId);
    } catch (err: any) {
      const msg = err?.message || '';
      setError(/status 50[023]/.test(msg)
        ? 'Kirka.io API is currently offline. Please try again later.'
        : 'Player not found. Make sure the ID is correct.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPlayerId) loadPlayer(initialPlayerId);
    // Only auto-load the player from the URL on first mount
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPlayer(query);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const saveRender = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#fit-showcase canvas');
    if (!canvas || !profile) return;
    const link = document.createElement('a');
    link.download = `${profile.name}-fit.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-obsidian-border pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <Shirt className="w-8 h-8 text-gold-primary" />
            <span>3D Fit</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1.5">
            Flex any player's equipped character, primary, secondary and melee — exactly like the in-game menu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError(null);
              }}
              placeholder="#SHORTID or UUID"
              className="w-full bg-[#090A0F]/80 border border-obsidian-border focus:border-gold-primary/50 outline-none rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-interactive px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-gold-primary to-gold-bright text-obsidian-deep disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Show Fit'}
          </button>
        </form>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {profile ? (
        <div className="space-y-4">
          <div className="flex flex-col xl:flex-row gap-6 items-start justify-center">
            <div id="fit-showcase" className="w-full xl:w-[690px] flex-shrink-0">
              <InGameFitShowcase profile={profile} inventory={inventory} catalog={catalog} overrides={overrides} onInspectItem={onInspectItem} />
            </div>

            {/* Combo builder */}
            <div className="w-full xl:max-w-sm bg-[#0b0c13]/80 border border-obsidian-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Build a combo</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Try any skin in Kirka on this fit.</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={randomize}
                    title="Random combo"
                    className="p-2 rounded-lg border border-white/10 bg-black/30 text-slate-400 hover:text-gold-bright cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCombo(PLAYER_COMBO)}
                    title="Reset to player's fit"
                    className="p-2 rounded-lg border border-white/10 bg-black/30 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <SkinPicker label="Character" options={pickerOptions.character} value={combo.character} onChange={(v) => updateCombo({ character: v })} />
              <div className="grid grid-cols-2 gap-3">
                <SkinPicker
                  label="Primary type"
                  options={pickerOptions.primaryType}
                  value={combo.primaryType}
                  onChange={(v) => updateCombo({ primaryType: v, primarySkin: PLAYER })}
                />
                <SkinPicker
                  label="Primary skin"
                  options={pickerOptions.primarySkin}
                  value={combo.primaryType !== PLAYER && combo.primarySkin === PLAYER ? DEFAULT : combo.primarySkin}
                  onChange={(v) => updateCombo({ primarySkin: v })}
                />
              </div>
              <SkinPicker label="Shark skin" options={pickerOptions.secondarySkin} value={combo.secondarySkin} onChange={(v) => updateCombo({ secondarySkin: v })} />
              <div className="grid grid-cols-2 gap-3">
                <SkinPicker
                  label="Melee type"
                  options={pickerOptions.meleeType}
                  value={combo.meleeType}
                  onChange={(v) => updateCombo({ meleeType: v, meleeSkin: PLAYER })}
                />
                <SkinPicker
                  label="Melee skin"
                  options={pickerOptions.meleeSkin}
                  value={combo.meleeType !== PLAYER && combo.meleeSkin === PLAYER ? DEFAULT : combo.meleeSkin}
                  onChange={(v) => updateCombo({ meleeSkin: v })}
                />
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Skins tagged <span className="font-mono text-slate-400">API2</span> aren't officially released yet and load from api2.kirka.io.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={saveRender}
              className="btn-interactive flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-[#1b1c26]/60 border border-white/10"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save render</span>
            </button>
            <button
              onClick={copyLink}
              className="btn-interactive flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-[#1b1c26]/60 border border-white/10"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="text-center text-slate-500 text-sm py-24 border border-dashed border-obsidian-border rounded-2xl">
            Search a player to see their fit in 3D.
          </div>
        )
      )}

      {loading && !profile && (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-24">
          <Loader2 className="w-5 h-5 animate-spin text-gold-primary" />
          <span>Loading fit…</span>
        </div>
      )}
    </div>
  );
};
