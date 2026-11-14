import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes.css'
import App from './App.tsx'
import { inDiscordActivity } from './utils/liveSkin'

// Opened inside Discord as an Activity: only the live Skin Editor, nothing else of the site
const ActivityApp = lazy(() => import('./components/ActivityApp'))

// Theme preview: ?theme=fieldops, lanparty, almanac or pixel. Stays set while moving around the app.
const previewTheme = new URLSearchParams(window.location.search).get('theme');
if (previewTheme) document.documentElement.dataset.theme = previewTheme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {inDiscordActivity() ? (
      <Suspense fallback={null}>
        <ActivityApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
