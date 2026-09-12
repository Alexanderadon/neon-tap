import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initInstallPrompt, installStandaloneGuards, registerServiceWorker } from '@/shared/lib/pwa';
import './styles/global.css';

// `beforeinstallprompt` fires once, early — capture it before React mounts.
initInstallPrompt();
// Installed app: no pinch / ctrl-wheel zoom, no long-press menus (browser tabs keep them).
installStandaloneGuards();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The inline splash from index.html stays until React has painted, then fades out. A background
// tab gets no animation frames, so a plain timer guarantees the splash never outlives the load.
function hideSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('splash-out');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  window.setTimeout(() => splash.remove(), 600);
}
requestAnimationFrame(() => requestAnimationFrame(hideSplash));
window.setTimeout(hideSplash, 1500);

// Offline shell + media cache: production only (dev has no precache list, HMR would fight it).
if (import.meta.env.PROD) {
  window.addEventListener('load', () => void registerServiceWorker());
}
