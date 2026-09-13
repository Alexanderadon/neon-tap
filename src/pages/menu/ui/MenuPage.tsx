import { useCallback, useState } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { Button, CrystalIcon, Modal, Screen } from '@/shared/ui';
import { useProgress } from '@/entities/progress';
import { TrackDeck, type TrackRef } from '@/widgets/track-list';
import { GoalsPanel } from '@/widgets/goals-panel';
import { DuelList } from '@/widgets/duel-list';
import { HistoryModal } from '@/widgets/history-panel';
import { ProfileIcon, SettingsIcon } from './MenuIcons';
import './menu.css';

/**
 * Menu = the deck. One card per track with PLAY under the thumb; two small round buttons flank it:
 * the shop (with the crystal balance) and the profile (goals, tutorial, custom song, settings).
 * Everything that is not "pick a track and play" lives behind the profile button.
 */
export function MenuPage() {
  const [records, setRecords] = useState<TrackRef | null>(null);
  const [profile, setProfile] = useState(false);
  const closeRecords = useCallback(() => setRecords(null), []);
  const crystals = useProgress((s) => s.crystals);

  const open = (screen: 'settings' | 'tutorial' | 'custom') => {
    sfxUi();
    setProfile(false);
    navigate(screen);
  };

  return (
    <Screen className="menu">
      <div className="menu-bg" aria-hidden="true" />
      <TrackDeck onRecords={setRecords} />

      <button
        type="button"
        className="menu-round menu-round-shop"
        onClick={() => {
          sfxUi();
          navigate('shop');
        }}
        aria-label={`${dict.shop} · ${dict.crystalsTitle}: ${crystals}`}
      >
        <CrystalIcon size={20} />
        <span className="menu-round-n mono">{crystals}</span>
      </button>
      <button
        type="button"
        className="menu-round menu-round-profile"
        onClick={() => {
          sfxUi();
          setProfile(true);
        }}
        aria-label={dict.profile}
      >
        <ProfileIcon size={24} />
      </button>

      <Modal open={profile} title={dict.profile} onClose={() => setProfile(false)}>
        <div className="profile-actions">
          <Button variant="ghost" onClick={() => open('tutorial')}>
            {dict.tutorial}
          </Button>
          <Button variant="ghost" onClick={() => open('custom')}>
            {dict.customSong}
          </Button>
          <Button variant="ghost" onClick={() => open('settings')}>
            <SettingsIcon size={16} /> {dict.settings}
          </Button>
        </div>
        <DuelList />
        <GoalsPanel />
        <footer className="menu-foot">
          <span className="micro">{dict.madeWith}</span>
          <a className="micro" href={`${import.meta.env.BASE_URL}music/LICENSES.md`} target="_blank" rel="noreferrer">
            {dict.licenses}
          </a>
        </footer>
      </Modal>

      <HistoryModal track={records} onClose={closeRecords} />
    </Screen>
  );
}
