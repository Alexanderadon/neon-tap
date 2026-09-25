import { useEffect } from 'react';
import { navigate, useRouteKey, useScreen } from '@/shared/lib/router';
import { firstLaunchStep, getSettings } from '@/entities/settings';
import { MenuPage } from '@/pages/menu';
import { GamePage } from '@/pages/game';
import { ResultPage } from '@/pages/result';
import { CalibrationPage } from '@/pages/calibration';
import { SettingsPage } from '@/pages/settings';
import { CustomSongPage } from '@/pages/custom';
import { TutorialPage } from '@/pages/tutorial';
import { DuelPage } from '@/pages/duel';
import { duelIdFromUrl } from '@/shared/api/duels';
import { ShopPage } from '@/pages/shop';
import { OrientationHint } from '@/widgets/orientation-hint';
import { InstallBanner } from '@/widgets/install-banner';
import { UpdateToast } from '@/widgets/update-toast';

/** Screen router: the game has no URLs on purpose — restart must never trigger navigation. */
export function App() {
  const screen = useScreen();
  const key = useRouteKey();

  // First launch goes straight to the tutorial (a first song with hints), once: the name is asked
  // where it is needed, latency calibration waits in the settings. The tutorial returns to the
  // menu, so the check runs every time the menu opens.
  useEffect(() => {
    if (screen !== 'menu') return;
    const step = firstLaunchStep(getSettings());
    if (step) navigate(step);
    // A duel link (?duel=<id>): the challenge screen comes right after the tutorial.
    else if (duelIdFromUrl()) navigate('duel');
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
    case 'duel':
      page = <DuelPage key={key} />;
      break;
    default:
      page = <MenuPage key={key} />;
  }

  // Sound needs no screen of its own: the first tap anywhere unlocks it (src/app/main.tsx). PWA
  // banners never cover the play field: the install banner lives on the menu, the update toast
  // hides during a run.
  const playing = screen === 'game' || screen === 'tutorial';
  return (
    <>
      {page}
      <OrientationHint />
      <InstallBanner active={screen === 'menu'} />
      <UpdateToast suppressed={playing} />
    </>
  );
}
