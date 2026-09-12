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
import { TutorialPage } from '@/pages/tutorial';
import { ShopPage } from '@/pages/shop';
import { AudioGate } from '@/widgets/audio-gate';
import { OrientationHint } from '@/widgets/orientation-hint';
import { InstallBanner } from '@/widgets/install-banner';
import { UpdateToast } from '@/widgets/update-toast';

/** Screen router: the game has no URLs on purpose — restart must never trigger navigation. */
export function App() {
  const screen = useScreen();
  const key = useRouteKey();

  // First launch → latency calibration (GDD §4, critical requirement 2), then the tutorial once.
  // Calibration returns to the menu, so the check runs every time the menu opens.
  useEffect(() => {
    if (screen !== 'menu') return;
    const s = getSettings();
    if (!s.calibrated || s.calibrationVersion < CALIBRATION_VERSION) navigate('calibration');
    else if (!s.tutorialDone) navigate('tutorial');
  }, [screen]);

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
    case 'tutorial':
      page = <TutorialPage key={key} />;
      break;
    case 'shop':
      page = <ShopPage key={key} />;
      break;
    default:
      page = <MenuPage key={key} />;
  }

  // The audio gate sits above every screen: the first tap unlocks sound (mobile autoplay policy)
  // and it comes back whenever the AudioContext gets suspended. PWA banners never cover the
  // play field: the install banner lives on the menu, the update toast hides during a run.
  const playing = screen === 'game' || screen === 'tutorial';
  return (
    <>
      {page}
      <OrientationHint />
      <InstallBanner active={screen === 'menu'} />
      <UpdateToast suppressed={playing} />
      <AudioGate />
    </>
  );
}
