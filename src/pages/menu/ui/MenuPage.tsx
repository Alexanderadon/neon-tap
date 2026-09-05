import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { audioEngine } from '@/shared/lib/audio';
import { Button, Screen } from '@/shared/ui';
import { TrackList } from '@/widgets/track-list';
import './menu.css';

export function MenuPage() {
  return (
    <Screen className="menu">
      {/* Scrolling neon grid floor (CSS only; the wrapper masks + clips, the pseudo-element moves). */}
      <div className="menu-bg" aria-hidden="true" />
      <header className="menu-head" onClick={() => void audioEngine.ensureContext()}>
        <h1 className="menu-logo">
          <span className="l1">NEON</span>
          <span className="l2">TAP</span>
        </h1>
        <div className="menu-tagline">{dict.tagline}</div>
        <nav className="menu-nav">
          <Button size="lg" onClick={() => navigate('custom')}>
            ♫ {dict.customSong}
          </Button>
          <Button variant="ghost" onClick={() => navigate('settings')}>
            {dict.settings}
          </Button>
        </nav>
      </header>
      <TrackList />
      <footer className="menu-foot">
        <span>{dict.madeWith}</span>
        <span>
          <a href={`${import.meta.env.BASE_URL}music/LICENSES.md`} target="_blank" rel="noreferrer">
            {dict.licenses}
          </a>
        </span>
      </footer>
    </Screen>
  );
}
