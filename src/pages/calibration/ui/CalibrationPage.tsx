import { dict } from '@/shared/i18n';
import { navigate, useRouteParams } from '@/shared/lib/router';
import { Frame, SubHeader, Tag } from '@/shared/ui';
import { CoverScene, TRACK_IDS, findTrack } from '@/entities/track';
import { dailyTrackId, localDateString } from '@/entities/progress';
import { TopBar } from '@/widgets/top-bar';
import { CalibrationMeter } from '@/widgets/calibration-meter';
import { calibrationExit } from '../model/exit';

/**
 * Calibration (screens-onboard C3–C5), opened from the settings: the top bar, the «ПОДСТРОЙКА» tag
 * and the meter widget filling the rest of the frame. Saved or skipped, it returns where it was opened from.
 */
export function CalibrationPage() {
  const params = useRouteParams();
  const daily = dailyTrackId(localDateString(), TRACK_IDS) ?? undefined;
  return (
    <Frame className="calibration">
      <CoverScene id={daily} genre={daily ? findTrack(daily)?.genre : undefined} />
      <TopBar />
      <SubHeader tag={<Tag>{dict.calibShort}</Tag>} />
      <CalibrationMeter onDone={() => navigate(calibrationExit(params.from))} />
    </Frame>
  );
}
