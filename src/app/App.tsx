import { useEffect } from 'react';
import { navigate, useRouteKey, useScreen } from '@/shared/lib/router';
import { getSettings } from '@/entities/settings';
import { MenuPage } from '@/pages/menu';
import { GamePage } from '@/pages/game';
import { ResultPage } from '@/pages/result';
import { CalibrationPage } from '@/pages/calibration';
import { SettingsPage } from '@/pages/settings';
import { CustomSongPage } from '@/pages/custom';

/** Screen router: the game has no URLs on purpose — restart must never trigger navigation. */
export function App() {
  const screen = useScreen();
  const key = useRouteKey();

  // First launch → latency calibration (GDD §4, critical requirement 2).
  useEffect(() => {
    if (!getSettings().calibrated) navigate('calibration');
  }, []);

  switch (screen) {
    case 'game':
      return <GamePage key={key} />;
    case 'result':
      return <ResultPage key={key} />;
    case 'calibration':
      return <CalibrationPage key={key} />;
    case 'settings':
      return <SettingsPage key={key} />;
    case 'custom':
      return <CustomSongPage key={key} />;
    default:
      return <MenuPage key={key} />;
  }
}
