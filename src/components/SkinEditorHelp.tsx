// Step-by-step fixes for when the Skin Editor can't do something on this device: no 3D (no WebGL), the
// live room not connecting, or the Discord Activity failing to start. The steps match where it's running:
// the Discord app, Discord in a browser, or the website in Chrome, Edge, Firefox or Safari.
import React from 'react';
import { AlertTriangle } from 'lucide-react';

type Place = 'discord-app' | 'discord-mobile' | 'firefox' | 'safari' | 'chromium';

/** Where the editor is running, as far as the browser lets on. */
function place(): Place {
  const ua = navigator.userAgent;
  const params = new URLSearchParams(window.location.search);
  if (params.get('platform') === 'mobile' || (/discord\//i.test(ua) && /Android|iPhone|iPad/i.test(ua))) return 'discord-mobile';
  if (/discord\//i.test(ua) || /Electron\//i.test(ua)) return 'discord-app';
  if (/Firefox\//i.test(ua)) return 'firefox';
  if (/Safari\//i.test(ua) && !/Chrome\/|Chromium\/|Edg\//i.test(ua)) return 'safari';
  return 'chromium';
}

const BROWSER_STEPS: Record<'firefox' | 'safari' | 'chromium', React.ReactNode[]> = {
  chromium: [
    <>Open your browser's <b>Settings</b> (Chrome, Edge, Brave or Opera).</>,
    <>Go to <b>System</b> (in Edge: <b>System and performance</b>).</>,
    <>Turn on <b>Use graphics acceleration when available</b> (Edge: <b>Use hardware acceleration when available</b>).</>,
    <>Press <b>Relaunch</b>, then open this page again.</>,
  ],
  firefox: [
    <>Open Firefox <b>Settings</b> → <b>General</b> → <b>Performance</b>.</>,
    <>Untick <b>Use recommended performance settings</b>.</>,
    <>Tick <b>Use hardware acceleration when available</b>.</>,
    <>Close Firefox completely and open it again.</>,
  ],
  safari: [
    <>Update macOS or iOS: Safari's 3D support comes with system updates.</>,
    <>On a Mac, check <b>Safari</b> → <b>Settings</b> → <b>Advanced</b> and turn off any experimental feature that disables WebGL.</>,
    <>Close Safari and open this page again.</>,
  ],
};

const STEPS_3D: Record<Place, React.ReactNode[]> = {
  'discord-app': [
    <>Close the Skin Editor.</>,
    <>Open Discord <b>User Settings</b> (the gear next to your name, bottom left).</>,
    <>Under <b>App Settings</b>, open <b>Advanced</b>.</>,
    <>Turn on <b>Hardware Acceleration</b> and press <b>Okay</b>. Discord restarts.</>,
    <>Open the Skin Editor again (<b>/skineditor</b>, or the Join button).</>,
  ],
  'discord-mobile': [
    <>Update the Discord app from your app store.</>,
    <>Close other apps that are open, then fully close Discord and open it again.</>,
    <>Open the Skin Editor again. If 3D still doesn't start, your phone can't run it, but the flat sheet works.</>,
  ],
  ...BROWSER_STEPS,
};

const IF_STILL = 'Still no 3D? Update your graphics driver (from NVIDIA, AMD or Intel, or through Windows Update), then restart your computer.';

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="list-decimal pl-5 space-y-1">
      {steps.map((s, i) => <li key={i}>{s}</li>)}
    </ol>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-2 border-[var(--ink)] bg-[#3D1A20] px-3.5 py-3 text-[14px] text-red-100 shadow-[3px_3px_0_var(--ink)] space-y-2 select-text">
      <h3 className="flex items-center gap-2 font-bold text-red-200">
        <AlertTriangle className="w-4 h-4 shrink-0" /> {title}
      </h3>
      {children}
    </section>
  );
}

/** Shown when the 3D model can't start: how to turn on what it needs, wherever this is running. */
export function No3DHelp() {
  const where = place();
  const label =
    where === 'discord-app' ? 'in the Discord app' : where === 'discord-mobile' ? 'in Discord on your phone' : 'in your browser';
  return (
    <Box title={`How to turn on the 3D view ${label}`}>
      <p className="text-red-100/80">The 3D model needs your graphics card (WebGL), and it's switched off or blocked here. Until then you can paint on the flat sheet.</p>
      <Steps steps={STEPS_3D[where]} />
      {where !== 'discord-mobile' && <p className="text-red-100/80">{IF_STILL}</p>}
      {where === 'discord-app' && (
        <p className="text-red-100/80">Using Discord in a browser instead? Turn on graphics acceleration in the browser's settings (Settings → System), then relaunch it.</p>
      )}
    </Box>
  );
}

/** Shown when the live room hasn't connected for a while. */
export function OfflineHelp({ inActivity }: { inActivity: boolean }) {
  return (
    <Box title="The live room isn't connecting">
      <p className="text-red-100/80">It keeps trying on its own. The live server can take up to a minute to wake up.</p>
      <Steps
        steps={[
          <>Wait a minute: it connects by itself as soon as it can.</>,
          <>Check your internet connection.</>,
          inActivity
            ? <>Still nothing? Close the Skin Editor and open it again with <b>/skineditor</b>.</>
            : <>Still nothing? Reload this page (your skin is kept in the room for 10 minutes).</>,
        ]}
      />
    </Box>
  );
}

/** Shown in Discord when the Activity can't start or stops. */
export function ActivityTrouble({ error, crashed }: { error: string; crashed?: boolean }) {
  const where = place();
  return (
    <div className="p-4 max-w-2xl">
      <Box title={crashed ? 'The Skin Editor stopped' : "The Skin Editor couldn't connect to Discord"}>
        <p className="font-mono text-[13px] text-red-200/80 break-words">{error}</p>
        <Steps
          steps={[
            <>Press <b>Reload</b> below.</>,
            <>Still broken? Close the Skin Editor and open it again with <b>/skineditor</b>.</>,
            where === 'discord-app'
              ? <>Update Discord: press <b>Ctrl+R</b> (Cmd+R on a Mac) to reload Discord, or quit it fully from the system tray and open it again.</>
              : where === 'discord-mobile'
                ? <>Update the Discord app from your app store, then open it again.</>
                : <>Reload the Discord tab in your browser, or try the Discord desktop app.</>,
            <>If it keeps happening, send a screenshot of this box in the KirkaHub support server.</>,
          ]}
        />
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 border-2 border-[var(--ink)] bg-red-500 text-white font-bold cursor-pointer shadow-[2px_2px_0_var(--ink)]"
        >
          Reload
        </button>
      </Box>
    </div>
  );
}
