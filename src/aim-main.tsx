import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './themes.css';
import { AimTrainerSection } from './components/AimTrainerSection';

// The desktop app's page: the aim trainer on its own, without the rest of the site.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AimTrainerSection />
  </StrictMode>
);
