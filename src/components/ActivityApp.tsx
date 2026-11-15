// The Skin Editor as a Discord Activity: Discord opens kirkahub.online inside the chat, and everyone who
// joins the same Activity lands in the same live room, so they watch and paint one skin together.
import { useEffect, useState } from 'react';
import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';
import { Loader2 } from 'lucide-react';
import { SkinEditorSection } from './SkinEditorSection';
import { ActivityTrouble } from './SkinEditorHelp';
import { DISCORD_CLIENT_ID, LIVE_SKIN_HOST } from '../utils/liveSkin';
import { setGalleryToken } from '../utils/gallery';
import type { GalleryUser } from '../utils/gallery';

// Inside Discord, every request has to go through Discord's proxy. These prefixes match the
// URL Mappings set for the app in the Developer Portal.
if (LIVE_SKIN_HOST) patchUrlMappings([{ prefix: '/live', target: LIVE_SKIN_HOST }]);

/**
 * The person's Discord name. Discord asks them once to let KirkaHub see their username; the bot's server swaps
 * the code for a token (it holds the app secret). Anything going wrong just means a made-up name.
 */
async function discordSignIn(discord: DiscordSDK): Promise<GalleryUser | undefined> {
  try {
    const { code } = await discord.commands.authorize({ client_id: DISCORD_CLIENT_ID, response_type: 'code', state: '', prompt: 'none', scope: ['identify'] });
    const res = await fetch(`https://${LIVE_SKIN_HOST}/live-skin/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return undefined;
    const { access_token } = await res.json();
    const { user } = await discord.commands.authenticate({ access_token });
    // the gallery checks this token with Discord when someone posts from here
    setGalleryToken(access_token);
    return {
      id: user.id,
      name: (user.global_name || user.username || 'Painter').slice(0, 32),
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : null,
    };
  } catch {
    return undefined;
  }
}

/** Waits for a promise, but not forever. */
const within = <T,>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

/** A room name from Discord's ids: a short hash, since room names are short and plain. */
function roomFor(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return `dc${(h >>> 0).toString(36)}`;
}

export default function ActivityApp() {
  const [room, setRoom] = useState<string | null>(null);
  const [sdk, setSdk] = useState<DiscordSDK | null>(null);
  const [me, setMe] = useState<GalleryUser | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const discord = new DiscordSDK(DISCORD_CLIENT_ID);
        await discord.ready();
        if (cancelled) return;
        const signedIn = await within(discordSignIn(discord), 60000, undefined);
        if (cancelled) return;
        setMe(signedIn);
        // One room per channel: whoever opens the editor in this channel (the command, the Launch button or
        // the bot's Join button) paints the same skin, even if Discord gives them separate sessions.
        setRoom(roomFor(discord.channelId || discord.instanceId));
        setSdk(discord);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <ActivityTrouble error={error} />;
  }
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-slate-300">
        <Loader2 className="w-5 h-5 animate-spin" /> Opening the Skin Editor…
      </div>
    );
  }
  return (
    <SkinEditorSection
      liveRoom={room}
      liveName={me?.name}
      discordUser={me}
      onOpenLink={sdk ? (url) => { void sdk.commands.openExternalLink({ url }).catch(() => {}); } : undefined}
      inActivity
      onInvite={sdk ? () => { void sdk.commands.openInviteDialog().catch(() => {}); } : undefined}
    />
  );
}
