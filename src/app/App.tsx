import { useEffect } from 'react';
import { navigate, useRouteKey, useScreen } from '@/shared/lib/router';
import { getSettings } from '@/entities/settings';
import { CALIBRATION_VERSION } from '@/shared/config/constants';
import { MenuPage } from '@/pages/menu';
import { GamePage } from '@/pages/game';
import { ResultPage } from '@/pages/result';
import { CalibrationPage } from '@/pages/calibration';
import { SettingsPage } from '@/pages/settings';
import { CustomSongPage } from '@/pages/custom';
import { AudioGate } from '@/widgets/audio-gate';

/** Screen router: the game has no URLs on purpose — restart must never trigger navigation. */
export function App() {
  const screen = useScreen();
  const key = useRouteKey();

  // First launch → latency calibration (GDD §4, critical requirement 2).
  useEffect(() => {
    const s = getSettings();
    if (!s.calibrated || s.calibrationVersion < CALIBRATION_VERSION) navigate('calibration');
  }, []);

  let page;
  switch (screen) {
    case 'game':
      page = <GamePage key={key} />;
      break;
    case 'result':
      page = <ResultPage key={key} />;
      break;
    case 'calibration':
      page = <CalibrationPage key={key} />;
      break;
    case 'settings':
      page = <SettingsPage key={key} />;
      break;
    case 'custom':
      page = <CustomSongPage key={key} />;
      break;
    default:
      page = <MenuPage key={key} />;
  }

  // The audio gate sits above every screen: the first tap unlocks sound (mobile autoplay policy)
  // and it comes back whenever the AudioContext gets suspended.
  return (
    <>
      {page}
      <AudioGate />
    </>
  );
}
