import { useCallback, useRef, useState, type ReactNode } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { Screen } from '@/shared/ui';
import { CATALOG } from '@/entities/track';
import { TrackHero, TrackList, useCatalogState, type TrackRef } from '@/widgets/track-list';
import { GoalsPanel } from '@/widgets/goals-panel';
import { HistoryModal } from '@/widgets/history-panel';
import { DockGoalsIcon, DockPlayIcon, DockRecordsIcon, DockSettingsIcon, DockShopIcon } from './DockIcons';
import './menu.css';

/** Smooth scroll unless the user asked for less motion. */
function scrollTo(el: HTMLElement | null) {
  if (!el) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/**
 * Menu as a portrait "neon console": full-bleed hero with the selected track (the daily one by
 * default) and the big PLAY, a snap-scrolling reel of covers under it, the goals panel, and a
 * five-slot dock — fixed at the bottom on phones, a top bar from 900 px where the hero and the
 * reel sit side by side.
 */
export function MenuPage() {
  const { dailyId } = useCatalogState();
  const [selected, setSelected] = useState<string>(() => dailyId ?? CATALOG[0]?.id ?? '');
  const [records, setRecords] = useState<TrackRef | null>(null);
  const reelRef = useRef<HTMLElement>(null);
  const goalsRef = useRef<HTMLDivElement>(null);

  const closeRecords = useCallback(() => setRecords(null), []);
  const onSelect = useCallback((t: TrackRef) => setSelected(t.id), []);
  const selectedTrack = CATALOG.find((t) => t.id === selected);

  const openRecords = () => {
    if (!selectedTrack) return;
    setRecords({ id: selectedTrack.id, title: selectedTrack.title });
  };

  return (
    <Screen className="menu">
      {/* Neon grid floor behind the reel (CSS only, see menu.css). */}
      <div className="menu-bg" aria-hidden="true" />

      <nav className="dock" aria-label={dict.menuNav}>
        <Wordmark className="dock-wordmark" />
        <div className="dock-items">
          <DockItem primary label={dict.menuDockPlay} onClick={() => scrollTo(reelRef.current)}>
            <DockPlayIcon />
          </DockItem>
          <DockItem label={dict.menuDockShop} onClick={() => navigate('shop')}>
            <DockShopIcon />
          </DockItem>
          <DockItem label={dict.menuDockGoals} onClick={() => scrollTo(goalsRef.current)}>
            <DockGoalsIcon />
          </DockItem>
          <DockItem label={dict.menuDockRecords} onClick={openRecords} disabled={!selectedTrack}>
            <DockRecordsIcon />
          </DockItem>
          <DockItem label={dict.menuDockSettings} onClick={() => navigate('settings')}>
            <DockSettingsIcon />
          </DockItem>
        </div>
      </nav>

      <div className="menu-cols">
        {selectedTrack && <TrackHero trackId={selectedTrack.id} top={<Wordmark className="hero-wordmark" heading />} onRecords={setRecords} />}
        <div className="menu-side">
          <TrackList ref={reelRef} selectedId={selected} onSelect={onSelect} onRecords={setRecords} />
          <div className="menu-goals" ref={goalsRef}>
            <GoalsPanel />
          </div>
          <footer className="menu-foot">
            <span className="micro">{dict.madeWith}</span>
            <a className="micro" href={`${import.meta.env.BASE_URL}music/LICENSES.md`} target="_blank" rel="noreferrer">
              {dict.licenses}
            </a>
          </footer>
        </div>
      </div>

      <HistoryModal track={records} onClose={closeRecords} />
    </Screen>
  );
}

/** The two-tone logo; `heading` makes it the page's h1 (the hero copy — the dock copy is decorative). */
function Wordmark({ className, heading = false }: { className: string; heading?: boolean }) {
  const Tag = heading ? 'h1' : 'div';
  return (
    <Tag className={`menu-wordmark ${className}`} aria-hidden={heading ? undefined : true}>
      <span className="l1">NEON</span>
      <span className="l2">TAP</span>
    </Tag>
  );
}

interface DockItemProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** Accent slot (the reel shortcut). */
  primary?: boolean;
  disabled?: boolean;
  /** Small counter in the corner of the icon — reserved for the shop's wallet badge. */
  badge?: ReactNode;
}

function DockItem({ label, onClick, children, primary, disabled, badge }: DockItemProps) {
  return (
    <button
      type="button"
      className={primary ? 'dock-btn is-primary' : 'dock-btn'}
      disabled={disabled}
      onClick={() => {
        sfxUi();
        onClick();
      }}
    >
      <span className="dock-icon">
        {children}
        {badge !== undefined && badge !== null && <span className="dock-badge mono">{badge}</span>}
      </span>
      <span className="dock-label micro">{label}</span>
    </button>
  );
}
