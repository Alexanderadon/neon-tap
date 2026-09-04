import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Screen } from '@/shared/ui';
import { CalibrationMeter } from '@/widgets/calibration-meter';
import '../../page.css';

export function CalibrationPage() {
  return (
    <Screen center>
      <h1 className="page-title">{dict.calibrationTitle}</h1>
      <CalibrationMeter onDone={() => navigate('menu')} />
    </Screen>
  );
}
