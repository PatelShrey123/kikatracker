import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes.css'
import App from './App.tsx'

// Theme preview: ?theme=fieldops, lanparty, almanac or pixel. Stays set while moving around the app.
const previewTheme = new URLSearchParams(window.location.search).get('theme');
if (previewTheme) document.documentElement.dataset.theme = previewTheme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
