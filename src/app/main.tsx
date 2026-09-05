import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadLocalCatalog } from '@/entities/track';
import { App } from './App';
import './styles/global.css';

// Dev-only local tracks (`npm run assets:local`): a missing `public/local/catalog.json` is silently ignored.
void loadLocalCatalog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
