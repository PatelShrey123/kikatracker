/**
 * Kirka's own settings, read from the JSON its settings menu exports, and the numbers Kirka's client
 * uses to turn them into aim. Everything here was read out of Kirka's game script (November 2026):
 *
 * - Mouse look: each mousemove turns the camera by movementX/Y x SENS x 0.0000235 x (camera FOV / MAIN_FOV)
 *   radians. While fully aimed in, AIM_SENSITIVITY replaces SENSITIVITY. Yaw wraps at 6.283, pitch stops
 *   at +-1.57, rotation order YXZ. Pointer lock asks for unadjustedMovement when RAW_INPUT is on.
 * - Flick protection: a mousemove bigger than FLICK_PROTECTION_X/Y counts is swapped for the last one.
 * - Aiming down sights: camera FOV = MAIN_FOV - (MAIN_FOV - gun ADS FOV) x progress x ADS_POWER_<gun>.
 *   Every gun aims to 70 except the VITA (35, with a scope). Getting fully in takes 0.08 s (VITA 0.1 s).
 * - The custom crosshair is an SVG Kirka builds from the CUSTOM_* values; crosshairSvg() is a port of it.
 * - On phones Kirka looks around with an invisible 130 px joystick that appears under the thumb (the
 *   nipplejs library). Each move it reads vector x force, multiplies by SENS x 0.0187 x (camera FOV /
 *   MAIN_FOV), and turns by the change since the last move. Dragging on the fire or aim button looks too,
 *   at a seventh of that, through their own (tiny) joysticks. While firing or aiming, AIM_SENSITIVITY is
 *   used, and with AIM_WHEN_FIRE on, firing also aims in. The VITA scopes while fire is held and shoots
 *   when it's let go.
 */

export const SENS_PER_COUNT = 0.0000235;
export const TOUCH_SENS_PER_UNIT = 0.0187;
/** Radius in px of Kirka's touch joysticks: the look area is 130 across; fire and aim scale with their settings. */
export const TOUCH_RADIUS = { look: 65, fire: 5, aim: 2.25 };

export type Gun = 'AR-9' | 'SCAR' | 'LAR' | 'M60' | 'MAC-10' | 'Weatie' | 'Revolver' | 'Shark' | 'VITA';
export const GUNS: Gun[] = ['AR-9', 'SCAR', 'LAR', 'M60', 'MAC-10', 'Weatie', 'Revolver', 'Shark', 'VITA'];
const ADS_KEY: Record<Gun, string> = {
  'AR-9': 'ADS_POWER_AR_9___SETTING',
  SCAR: 'ADS_POWER_SCAR___SETTING',
  LAR: 'ADS_POWER_LAR___SETTING',
  M60: 'ADS_POWER_M60___SETTING',
  'MAC-10': 'ADS_POWER_MAC10___SETTING',
  Weatie: 'ADS_POWER_WEATIE___SETTING',
  Revolver: 'ADS_POWER_REVOLVER___SETTING',
  Shark: 'ADS_POWER_SHARK___SETTING',
  VITA: 'ADS_POWER_VITA___SETTING',
};
/** Field of view each gun aims down to, and how long getting fully in takes. */
export const GUN_ADS: Record<Gun, { fov: number; time: number; scope: boolean }> = Object.fromEntries(
  GUNS.map((g) => [g, g === 'VITA' ? { fov: 35, time: 0.1, scope: true } : { fov: 70, time: 0.08, scope: false }])
) as Record<Gun, { fov: number; time: number; scope: boolean }>;

export interface CrosshairLook {
  color: string;
  size: number;
  thickness: number;
  gap: number;
  outline: boolean;
  outlineColor: string;
  outlineThickness: number;
  dot: boolean;
  dotSize: number;
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface KirkaSettings {
  sensitivity: number;
  aimSensitivity: number;
  rawInput: boolean;
  flickProtection: boolean;
  flickX: number;
  flickY: number;
  mainFov: number;
  ironSights: boolean;
  crosshair: CrosshairLook & { display: 'static' | 'dynamic' | 'hidden'; mode: 'custom' | 'url'; url: string };
  sniper: CrosshairLook & { display: 'default' | 'image' | 'crosshair'; url: string; smoothFov: boolean };
  hitmarker: { enabled: boolean; color: string; size: number; thickness: number; gap: number; opacity: number; fade: number };
  adsPower: Record<Gun, number>;
  keys: { aim: string; shoot: string; reload: string };
  /** Kirka's phone controls. X and Y move a button in rem, the way Kirka's do. */
  mobile: {
    aimWhenFire: boolean;
    allOpacity: number;
    fireX: number;
    fireY: number;
    fireScale: number;
    fireOpacity: number;
    fireLeftX: number;
    fireLeftY: number;
    fireLeftScale: number;
    fireLeftOpacity: number;
    aimX: number;
    aimY: number;
    aimScale: number;
    aimOpacity: number;
  };
  /** Images on other sites (a crosshair or scope URL) only load once the player says so. */
  allowImages: boolean;
}

const look = (o: Partial<CrosshairLook> = {}): CrosshairLook => ({
  color: '#ffffff',
  size: 5,
  thickness: 2,
  gap: -1,
  outline: false,
  outlineColor: '#000000',
  outlineThickness: 1,
  dot: false,
  dotSize: 1,
  top: true,
  bottom: true,
  left: true,
  right: true,
  ...o,
});

export const DEFAULT_SETTINGS: KirkaSettings = {
  sensitivity: 50,
  aimSensitivity: 30,
  rawInput: false,
  flickProtection: false,
  flickX: 130,
  flickY: 110,
  mainFov: 90,
  ironSights: false,
  crosshair: { ...look(), display: 'static', mode: 'custom', url: '' },
  sniper: { ...look({ color: '#00ff00', size: 8, gap: 4, outline: true, dot: true, dotSize: 2 }), display: 'default', url: '', smoothFov: false },
  hitmarker: { enabled: false, color: '#d05353', size: 7, thickness: 2, gap: 3, opacity: 100, fade: 400 },
  adsPower: Object.fromEntries(GUNS.map((g) => [g, 1])) as Record<Gun, number>,
  keys: { aim: 'MOUSE_RIGHT___KEY', shoot: 'MOUSE_LEFT___KEY', reload: 'KEY_R___KEY' },
  mobile: { aimWhenFire: true, allOpacity: 1, fireX: 0, fireY: 0, fireScale: 1, fireOpacity: 0.4, fireLeftX: 0, fireLeftY: 0, fireLeftScale: 1, fireLeftOpacity: 0.75, aimX: 0, aimY: 0, aimScale: 1, aimOpacity: 0.35 },
  allowImages: false,
};

// ------------------------------------------------------------------ reading an export

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const bool = (v: unknown, fallback: boolean) => (v === undefined || v === null ? fallback : v === true || v === 1 || v === '1' || v === 'true');
const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : fallback);
const httpsUrl = (v: unknown) => {
  if (typeof v !== 'string') return '';
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
};
const binding = (v: unknown, fallback: string) => (typeof v === 'string' && /^[A-Z0-9_]+___KEY$/.test(v) ? v : fallback);

function readLook(o: Record<string, unknown>, d: CrosshairLook): CrosshairLook {
  return {
    color: color(o.CUSTOM_COLOR___SETTING, d.color),
    size: num(o.CUSTOM_SIZE___SETTING, d.size, 0, 60),
    thickness: num(o.CUSTOM_THICKNESS___SETTING, d.thickness, 1, 20),
    gap: num(o.CUSTOM_GAP___SETTING, d.gap, -10, 60),
    outline: bool(o.CUSTOM_OUTLINE___SETTING, d.outline),
    outlineColor: color(o.CUSTOM_OUTLINE_COLOR___SETTING, d.outlineColor),
    outlineThickness: num(o.CUSTOM_OUTLINE_THICKNESS___SETTING, d.outlineThickness, 0, 10),
    dot: bool(o.CUSTOM_DOT___SETTING, d.dot),
    dotSize: num(o.CUSTOM_DOT_SIZE___SETTING, d.dotSize, 1, 20),
    top: bool(o.CUSTOM_TOP___SETTING, d.top),
    bottom: bool(o.CUSTOM_BOTTOM___SETTING, d.bottom),
    left: bool(o.CUSTOM_LEFT___SETTING, d.left),
    right: bool(o.CUSTOM_RIGHT___SETTING, d.right),
  };
}

/**
 * Reads what Kirka's settings export button gives you. Only ever parsed as JSON, never run. Anything
 * missing or out of range falls back to Kirka's own default. Throws a readable message when it isn't
 * Kirka settings at all.
 */
export function parseKirkaExport(text: string): KirkaSettings {
  if (text.length > 400_000) throw new Error('That is far too long to be Kirka settings.');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error("That isn't Kirka settings. Paste everything the export button copied, starting with {.");
  let raw: any;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("That couldn't be read. Make sure you pasted the whole export, from the first { to the last }.");
  }
  if (!raw || typeof raw !== 'object' || (!raw.MOUSE___SETTING && !raw.CAMERA___SETTING)) {
    throw new Error("That's JSON, but not Kirka settings: it has no mouse or camera section.");
  }
  const d = DEFAULT_SETTINGS;
  const mouse = raw.MOUSE___SETTING || {};
  const camera = raw.CAMERA___SETTING || {};
  const cross = raw.CROSSHAIR___SETTING || {};
  const sniper = raw.SNIPER___SETTING || {};
  const hit = raw.HITMARKER___SETTING || {};
  const weapons = raw.WEAPONS___SETTING || {};
  const keys = raw.KEYBINDINGS___SETTING || {};
  const mobile = raw.MOBILE___SETTING || {};
  const dm = d.mobile;
  const display = ['static', 'dynamic', 'hidden'].includes(cross.DISPLAY_TYPE___SETTING) ? cross.DISPLAY_TYPE___SETTING : d.crosshair.display;
  const sniperDisplay = ['default', 'image', 'crosshair'].includes(sniper.DISPLAY_TYPE___SETTING) ? sniper.DISPLAY_TYPE___SETTING : d.sniper.display;
  return {
    sensitivity: num(mouse.SENSITIVITY___SETTING, d.sensitivity, 1, 300),
    aimSensitivity: num(mouse.AIM_SENSITIVITY___SETTING, d.aimSensitivity, 1, 300),
    rawInput: bool(mouse.RAW_INPUT___SETTING, d.rawInput),
    flickProtection: bool(mouse.FLICK_PROTECTION___SETTING, d.flickProtection),
    flickX: num(mouse.FLICK_PROTECTION_X___SETTING, d.flickX, 1, 10000),
    flickY: num(mouse.FLICK_PROTECTION_Y___SETTING, d.flickY, 1, 10000),
    mainFov: num(camera.MAIN_FOV___SETTING, d.mainFov, 60, 150),
    ironSights: bool(camera.IRON_SIGHTS___SETTING, d.ironSights),
    crosshair: {
      ...readLook(cross, d.crosshair),
      display,
      mode: cross.STATIC_MODE___SETTING === 'url' ? 'url' : 'custom',
      url: httpsUrl(cross.STATIC_URL___SETTING),
    },
    sniper: {
      ...readLook(sniper, d.sniper),
      display: sniperDisplay,
      url: httpsUrl(sniper.SCOPE_URL___SETTING),
      smoothFov: bool(sniper.SMOOTH_FOV___SETTING, d.sniper.smoothFov),
    },
    hitmarker: {
      enabled: bool(hit.HITMARKER_ENABLED___SETTING, d.hitmarker.enabled),
      color: color(hit.HITMARKER_COLOR___SETTING, d.hitmarker.color),
      size: num(hit.HITMARKER_SIZE___SETTING, d.hitmarker.size, 1, 60),
      thickness: num(hit.HITMARKER_THICKNESS___SETTING, d.hitmarker.thickness, 1, 20),
      gap: num(hit.HITMARKER_GAP___SETTING, d.hitmarker.gap, 0, 60),
      opacity: num(hit.HITMARKER_OPACITY___SETTING, d.hitmarker.opacity, 0, 100),
      fade: num(hit.HITMARKER_ANIM_FADE_DURATION___SETTING, d.hitmarker.fade, 0, 3000),
    },
    adsPower: Object.fromEntries(GUNS.map((g) => [g, num(weapons[ADS_KEY[g]], 1, 0, 3)])) as Record<Gun, number>,
    keys: {
      aim: binding(keys.AIM_WEAPON___SETTING, d.keys.aim),
      shoot: binding(keys.SHOOT_WEAPON___SETTING, d.keys.shoot),
      reload: binding(keys.RELOAD_WEAPON___SETTING, d.keys.reload),
    },
    mobile: {
      aimWhenFire: bool(mobile.AIM_WHEN_FIRE___SETTING, dm.aimWhenFire),
      allOpacity: num(mobile.ALL_OPACITY___SETTING, dm.allOpacity, 0, 1),
      fireX: num(mobile.FIRE_RIGHT_X___SETTING, dm.fireX, -40, 40),
      fireY: num(mobile.FIRE_RIGHT_Y___SETTING, dm.fireY, -40, 40),
      fireScale: num(mobile.FIRE_RIGHT_SCALE___SETTING, dm.fireScale, 0.3, 3),
      fireOpacity: num(mobile.FIRE_RIGHT_OPACITY___SETTING, dm.fireOpacity, 0, 1),
      fireLeftX: num(mobile.FIRE_LEFT_X___SETTING, dm.fireLeftX, -40, 40),
      fireLeftY: num(mobile.FIRE_LEFT_Y___SETTING, dm.fireLeftY, -40, 40),
      fireLeftScale: num(mobile.FIRE_LEFT_SCALE___SETTING, dm.fireLeftScale, 0.3, 3),
      fireLeftOpacity: num(mobile.FIRE_LEFT_OPACITY___SETTING, dm.fireLeftOpacity, 0, 1),
      aimX: num(mobile.AIM_X___SETTING, dm.aimX, -40, 40),
      aimY: num(mobile.AIM_Y___SETTING, dm.aimY, -40, 40),
      aimScale: num(mobile.AIM_SCALE___SETTING, dm.aimScale, 0.3, 3),
      aimOpacity: num(mobile.AIM_OPACITY___SETTING, dm.aimOpacity, 0, 1),
    },
    allowImages: false,
  };
}

// ------------------------------------------------------------------ saved in this browser

const STORE = 'kirkahub_aim_settings_v1';
export interface SavedSettings {
  settings: KirkaSettings;
  /** 'import' when they came from a Kirka export, 'manual' when typed in, 'default' otherwise. */
  source: 'import' | 'manual' | 'default';
  dpi: number;
}

export function loadSettings(): SavedSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved?.settings) {
      const s = saved.settings;
      return {
        settings: {
          ...DEFAULT_SETTINGS,
          ...s,
          crosshair: { ...DEFAULT_SETTINGS.crosshair, ...s.crosshair },
          sniper: { ...DEFAULT_SETTINGS.sniper, ...s.sniper },
          hitmarker: { ...DEFAULT_SETTINGS.hitmarker, ...s.hitmarker },
          adsPower: { ...DEFAULT_SETTINGS.adsPower, ...s.adsPower },
          keys: { ...DEFAULT_SETTINGS.keys, ...s.keys },
          mobile: { ...DEFAULT_SETTINGS.mobile, ...s.mobile },
        },
        source: saved.source === 'import' || saved.source === 'manual' ? saved.source : 'default',
        dpi: num(saved.dpi, 800, 50, 64000),
      };
    }
  } catch {}
  return { settings: DEFAULT_SETTINGS, source: 'default', dpi: 800 };
}

export function saveSettings(saved: SavedSettings) {
  try {
    localStorage.setItem(STORE, JSON.stringify(saved));
  } catch {}
}

// ------------------------------------------------------------------ the maths

/** Radians the camera turns per mouse count, the way Kirka works it out. */
export function radiansPerCount(sens: number, cameraFov: number, mainFov: number) {
  return (cameraFov / mainFov) * sens * SENS_PER_COUNT;
}

/** The camera FOV with a gun aimed in by `progress` (0 to 1). */
export function adsFov(s: KirkaSettings, gun: Gun, progress: number) {
  const zoom = GUN_ADS[gun].fov;
  return s.mainFov - (s.mainFov - zoom) * progress * s.adsPower[gun];
}

/**
 * What Kirka's joystick library reports, as vector x force, for a thumb dx, dy px from where it landed.
 * Inside the radius the reading grows with the square of the distance; past it, it's linear.
 */
export function joystickReading(dx: number, dy: number, radius: number) {
  const reach = Math.min(Math.hypot(dx, dy), radius);
  return { x: (dx * reach) / (radius * radius), y: (-dy * reach) / (radius * radius) };
}

/** Degrees a straight swipe of `px` turns on a phone, past the joystick's radius. */
export function touchDegrees(sens: number, px: number) {
  return ((px / TOUCH_RADIUS.look) * sens * TOUCH_SENS_PER_UNIT * 180) / Math.PI;
}

/** Centimetres of mouse travel for a full turn. */
export function cmPer360(sens: number, dpi: number, fovRatio = 1) {
  const counts = (Math.PI * 2) / (fovRatio * sens * SENS_PER_COUNT);
  return (counts / dpi) * 2.54;
}

// ------------------------------------------------------------------ crosshair and hitmarker

/** Kirka's custom crosshair, built exactly the way Kirka builds it. */
export function crosshairSvg(c: CrosshairLook, gapExtra = 0): string {
  const size = Math.round(c.size);
  const thick = Math.round(c.thickness);
  const gap = Math.round(c.gap + gapExtra);
  const ol = c.outline ? Math.round(c.outlineThickness) : 0;
  const dot = Math.round(c.dotSize);
  const reach = Math.abs(gap) + size + ol;
  let box = 2 * reach + Math.max(thick, dot) + 2 * ol;
  if (box % 2 === 0) box += 1;
  const mid = Math.floor(box / 2);
  const rect = (x: number, y: number, w: number, h: number) =>
    (c.outline ? `<rect x="${x - ol}" y="${y - ol}" width="${w + 2 * ol}" height="${h + 2 * ol}" fill="${c.outlineColor}"/>` : '') +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.color}"/>`;
  const at = mid - Math.floor((thick - 1) / 2);
  const parts: string[] = [];
  if (c.top) parts.push(rect(at, at - gap - size, thick, size));
  if (c.bottom) parts.push(rect(at, at + thick + gap, thick, size));
  if (c.left) parts.push(rect(at - gap - size, at, size, thick));
  if (c.right) parts.push(rect(at + thick + gap, at, size, thick));
  if (c.dot) {
    const d = mid - Math.floor((dot - 1) / 2);
    parts.push(rect(d, d, dot, dot));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" shape-rendering="crispEdges">${parts.join('')}</svg>`;
}

/** Kirka's hitmarker: four diagonal strokes. */
export function hitmarkerSvg(h: KirkaSettings['hitmarker']): string {
  const size = Math.round(h.size);
  const thick = Math.round(h.thickness);
  const gap = Math.abs(Math.round(h.gap));
  const reach = gap + size;
  const pad = Math.ceil(thick / 2);
  let box = 2 * reach + thick + 2 * pad;
  if (box % 2 === 0) box += 1;
  const c = Math.floor(box / 2) - Math.floor((thick - 1) / 2) + thick / 2;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${c + x1}" y1="${c + y1}" x2="${c + x2}" y2="${c + y2}" stroke="${h.color}" stroke-width="${thick}" stroke-linecap="butt"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" opacity="${h.opacity / 100}">${[
    line(-gap, -gap, -reach, -reach),
    line(gap, -gap, reach, -reach),
    line(-gap, gap, -reach, reach),
    line(gap, gap, reach, reach),
  ].join('')}</svg>`;
}

export const svgUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

// ------------------------------------------------------------------ key bindings

const SPECIAL: Record<string, string[]> = {
  SHIFT: ['ShiftLeft', 'ShiftRight'],
  CTRL: ['ControlLeft', 'ControlRight'],
  ALT: ['AltLeft', 'AltRight'],
  SPACE: ['Space'],
  ENTER: ['Enter', 'NumpadEnter'],
  TAB: ['Tab'],
  CAPS_LOCK: ['CapsLock'],
  BACKSPACE: ['Backspace'],
  UP_ARROW: ['ArrowUp'],
  DOWN_ARROW: ['ArrowDown'],
  LEFT_ARROW: ['ArrowLeft'],
  RIGHT_ARROW: ['ArrowRight'],
};

const bare = (b: string) => b.replace(/^KEY_/, '').replace(/___KEY$/, '');

export function keyMatches(b: string, e: KeyboardEvent): boolean {
  if (b.startsWith('MOUSE_')) return false;
  const name = bare(b);
  if (/^[A-Z]$/.test(name)) return e.code === `Key${name}`;
  if (/^\d$/.test(name)) return e.code === `Digit${name}` || e.code === `Numpad${name}`;
  if (/^F\d{1,2}$/.test(name)) return e.code === name;
  return (SPECIAL[name] || []).includes(e.code);
}

export function mouseButtonOf(b: string): number | null {
  if (b === 'MOUSE_LEFT___KEY') return 0;
  if (b === 'MOUSE_MIDDLE___KEY') return 1;
  if (b === 'MOUSE_RIGHT___KEY') return 2;
  const m = /^MOUSE_BUTTON_?(\d)___KEY$/.exec(b);
  return m ? Number(m[1]) - 1 : null;
}

export function keyLabel(b: string): string {
  const mouse = mouseButtonOf(b);
  if (mouse !== null) return ['Left mouse', 'Middle mouse', 'Right mouse', 'Mouse 4', 'Mouse 5'][mouse] || 'Mouse';
  const name = bare(b).replace(/_ARROW$/, ' arrow').replace(/_/g, ' ');
  return name.length === 1 ? name : name.charAt(0) + name.slice(1).toLowerCase();
}
