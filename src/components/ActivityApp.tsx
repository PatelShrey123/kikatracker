// The Skin Editor as a Discord Activity: Discord opens kirkahub.online inside the chat, and everyone who
// joins the same Activity lands in the same live room, so they watch and paint one skin together.
import { useEffect, useState } from 'react';
import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';
import { Loader2 } from 'lucide-react';
import { SkinEditorSection } from './SkinEditorSection';
import { DISCORD_CLIENT_ID, LIVE_SKIN_HOST } from '../utils/liveSkin';

// Inside Discord, every request has to go through Discord's proxy. These prefixes match the
// URL Mappings set for the app in the Developer Portal.
if (LIVE_SKIN_HOST) patchUrlMappings([{ prefix: '/live', target: LIVE_SKIN_HOST }]);

/** Discord's instance id is long and has characters a room name can't; a short hash of it is enough. */
function roomFor(instanceId: string): string {
  let h = 2166136261;
  for (let i = 0; i < instanceId.length; i++) h = Math.imul(h ^ instanceId.charCodeAt(i), 16777619);
  return `dc${(h >>> 0).toString(36)}`;
}

export default function ActivityApp() {
  const [room, setRoom] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sdk = new DiscordSDK(DISCORD_CLIENT_ID);
        await sdk.ready();
        if (!cancelled) setRoom(roomFor(sdk.instanceId));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="p-6 text-red-300 font-bold">The Skin Editor couldn't connect to Discord: {error}</p>;
  }
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-slate-300">
        <Loader2 className="w-5 h-5 animate-spin" /> Opening the Skin Editor…
      </div>
    );
  }
  return <SkinEditorSection liveRoom={room} inActivity />;
}
