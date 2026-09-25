import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { bootAssets } from './boot';
import { installGestureUnlock } from '@/shared/lib/audio';
import { initInstallPrompt, installStandaloneGuards, registerServiceWorker } from '@/shared/lib/pwa';
import { installAppViewport } from '@/shared/lib/viewport';
import './styles/global.css';

// The app is as tall as the visible viewport (an in-app browser's toolbar must not cover the action zone) — measured before the first render.
installAppViewport();
// `beforeinstallprompt` fires once, early — capture it before React mounts.
initInstallPrompt();
// Installed app: no pinch / ctrl-wheel zoom, no long-press menus (browser tabs keep them).
installStandaloneGuards();
// No "tap to enable sound" screen: the first tap anywhere unlocks audio (and resumes it after an interruption).
installGestureUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The splash from index.html is the loading screen: its bar follows the boot assets (font, sounds,
// the first pictures, the first chart), then it fades out. A timer guarantees it never outlives a
// stuck load.
function hideSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash || splash.classList.contains('splash-out')) return;
  splash.classList.add('splash-out');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  window.setTimeout(() => splash.remove(), 600);
}
const bar = document.getElementById('splash-bar');
void bootAssets((f) => bar?.style.setProperty('--p', f.toFixed(3))).then(hideSplash);
window.setTimeout(hideSplash, 12_000);

// Offline shell + media cache: production only (dev has no precache list, HMR would fight it).
if (import.meta.env.PROD) {
  window.addEventListener('load', () => void registerServiceWorker());
}
