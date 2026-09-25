import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Frame, SubHeader, Tag } from '@/shared/ui';
import { CoverScene, TRACK_IDS, findTrack } from '@/entities/track';
import { dailyTrackId, localDateString } from '@/entities/progress';
import { TopBar } from '@/widgets/top-bar';
import { CalibrationMeter } from '@/widgets/calibration-meter';

/**
 * Calibration (screens-onboard C3–C5), opened from the settings: the top bar, the «ЗАДЕРЖКА» tag
 * and the meter widget filling the rest of the frame.
 */
export function CalibrationPage() {
  const daily = dailyTrackId(localDateString(), TRACK_IDS) ?? undefined;
  return (
    <Frame className="calibration">
      <CoverScene id={daily} genre={daily ? findTrack(daily)?.genre : undefined} />
      <TopBar />
      <SubHeader tag={<Tag>{dict.calibShort}</Tag>} />
      <CalibrationMeter onDone={() => navigate('menu')} />
    </Frame>
  );
}
