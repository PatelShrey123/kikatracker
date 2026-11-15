import { Component, StrictMode, Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes.css'
import App from './App.tsx'
import { inDiscordActivity } from './utils/liveSkin'

// Opened inside Discord as an Activity: only the live Skin Editor, nothing else of the site
const ActivityApp = lazy(() => import('./components/ActivityApp'))

/** Inside Discord there's no other page to fall back to: a crash shows what went wrong and a way to retry. */
class ActivityCrash extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="p-6 space-y-3 text-slate-200">
        <p className="font-bold text-red-300">The Skin Editor stopped: {this.state.error}</p>
        <button type="button" onClick={() => window.location.reload()} className="px-3 py-1.5 border-2 border-[var(--ink)] bg-red-500 text-white font-bold cursor-pointer">
          Reload
        </button>
      </div>
    )
  }
}

// Theme preview: ?theme=fieldops, lanparty, almanac or pixel. Stays set while moving around the app.
const previewTheme = new URLSearchParams(window.location.search).get('theme');
if (previewTheme) document.documentElement.dataset.theme = previewTheme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {inDiscordActivity() ? (
      <ActivityCrash>
        <Suspense fallback={<p className="p-6 text-slate-300 font-bold">Opening the Skin Editor…</p>}>
          <ActivityApp />
        </Suspense>
      </ActivityCrash>
    ) : (
      <App />
    )}
  </StrictMode>,
)
