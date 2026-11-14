// Live skin rooms: several people on one skin, every change sent to the others as it happens.
// This is the demo of the Discord Activity: the same room, opened from Discord, will carry Discord names.

/** The bot's web server on Render, which hosts the rooms at /live-skin. */
export const LIVE_SKIN_HOST = 'discordbot-pmrp.onrender.com';

/** Where the room server runs: the local demo server while developing, the bot's server on the built site. */
export const LIVE_SKIN_URL: string | null =
  (import.meta.env.VITE_LIVE_SKIN_URL as string | undefined) ||
  (import.meta.env.DEV ? 'ws://localhost:8787/live-skin' : LIVE_SKIN_HOST ? `wss://${LIVE_SKIN_HOST}/live-skin` : null);

/** The Discord app that runs the Skin Editor as an Activity. */
export const DISCORD_CLIENT_ID = '1532695214634831872';

/** Opened by Discord as an Activity (it adds frame_id and instance_id, and serves us from <app>.discordsays.com). */
export const inDiscordActivity = (): boolean => {
  try {
    return window.location.hostname.endsWith('.discordsays.com') || new URLSearchParams(window.location.search).has('frame_id');
  } catch {
    return false;
  }
};

export const roomFromUrl = (): string | null => {
  try {
    const room = new URLSearchParams(window.location.search).get('room');
    return room && /^[a-z0-9]{3,20}$/i.test(room) ? room : null;
  } catch {
    return null;
  }
};

export const newRoomId = () => Math.random().toString(36).slice(2, 8);

export function pixelsToB64(a: Uint8ClampedArray): string {
  let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s);
}

export function b64ToPixels(s: string): Uint8ClampedArray {
  const bin = atob(s);
  const out = new Uint8ClampedArray(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
