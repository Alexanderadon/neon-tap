import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Frame, Segments, SubHeader, Tag, segmentStates } from '@/shared/ui';
import { useSettings } from '@/entities/settings';
import { CoverScene, TRACK_IDS, findTrack } from '@/entities/track';
import { dailyTrackId, localDateString } from '@/entities/progress';
import { TopBar } from '@/widgets/top-bar';
import { CalibrationMeter } from '@/widgets/calibration-meter';

/** First-launch steps: name · calibration · tutorial. */
const STEP = 2;
const STEPS = 3;

/**
 * Calibration (screens-onboard C3–C5): the top bar, then either «ШАГ 2 ИЗ 3» with the three
 * segments (first launch — the tutorial has not been passed yet) or the plain «ЗАДЕРЖКА» tag
 * (opened from the settings), and the meter widget filling the rest of the frame.
 */
export function CalibrationPage() {
  const firstRun = useSettings((s) => !s.tutorialDone);
  const daily = dailyTrackId(localDateString(), TRACK_IDS) ?? undefined;
  return (
    <Frame className="calibration">
      <CoverScene id={daily} genre={daily ? findTrack(daily)?.genre : undefined} />
      <TopBar />
      {firstRun ? (
        <SubHeader tag={<Tag>{fmt(dict.stepOf, { n: STEP, m: STEPS })}</Tag>}>
          <Segments states={segmentStates(STEPS, STEP - 1)} />
        </SubHeader>
      ) : (
        <SubHeader tag={<Tag>{dict.calibShort}</Tag>} />
      )}
      <CalibrationMeter firstRun={firstRun} onDone={() => navigate('menu')} />
    </Frame>
  );
}
