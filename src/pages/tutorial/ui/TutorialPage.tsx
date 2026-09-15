import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { ActionZone, Disc, Icon, Line, PrimaryAction, Screen, SegmentsPulse, SubHeader, Tag } from '@/shared/ui';
import type { ChartFile } from '@/shared/types/chart';
import { CoverScene, loadChart } from '@/entities/track';
import { updateSettings } from '@/entities/settings';
import type { SessionEvent } from '@/features/play-chart';
import { buildScript, captionAt, stepProgress } from '@/features/tutorial';
import { GameCanvas } from '@/widgets/game-canvas';
import { TutorialOverlay } from '@/widgets/tutorial-overlay';
import { TopBar } from '@/widgets/top-bar';
import './tutorial-page.css';

const TUTORIAL_ID = 'tutorial';
const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

/**
 * Interactive tutorial: the regular game canvas in `tutorial` mode (no hearts, no fail, nothing
 * saved) with a caption card driven by song time. Finishing, or «Пропустить» in the pause menu,
 * marks it done.
 */
export function TutorialPage() {
  const [chart, setChart] = useState<ChartFile | null>(null);
  const [error, setError] = useState(false);
  const [songTime, setSongTime] = useState(-Infinity);
  /** Bitmask of steps in which the player already landed a hit. */
  const [succeeded, setSucceeded] = useState(0);
  const timeRef = useRef(-Infinity);
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadChart(TUTORIAL_ID)
      .then((c) => {
        if (!cancelled) setChart(c);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const script = useMemo(() => (chart ? buildScript(chart.beats ?? []) : []), [chart]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    updateSettings({ tutorialDone: true });
    navigate('menu');
  }, []);

  const onTime = useCallback((t: number) => {
    timeRef.current = t;
    setSongTime(t);
  }, []);

  const onEvent = useCallback(
    (e: SessionEvent) => {
      if (e.type === 'finish') finish();
      else if (e.type === 'start') setSucceeded(0);
      else if (e.type === 'judge' && e.judgement !== 'miss') {
        const i = captionAt(script, timeRef.current);
        if (i >= 0) setSucceeded((mask) => mask | (1 << i));
      }
    },
    [script, finish],
  );

  if (!chart) {
    // The chart is still on its way (or failed): the loading / error skeleton of the game screen.
    return (
      <Screen frame className="tutp">
        <CoverScene position="fixed" />
        <TopBar />
        <SubHeader center>
          <b>{dict.tutorial}</b>
        </SubHeader>
        <div className="tutp-tab">
          {error ? (
            <Tag variant="mag">{dict.loadFailed}</Tag>
          ) : (
            <Tag variant="dark" shine className="tutp-loading">
              {dict.loading}
            </Tag>
          )}
        </div>
        {error ? (
          <>
            <Line className="tutp-line">{dict.checkConnection}</Line>
            <ActionZone className="tutp-bottom">
              <PrimaryAction
                lead={
                  <Disc>
                    <Icon name="home" />
                  </Disc>
                }
                label={dict.toMenu}
                onClick={finish}
              />
            </ActionZone>
          </>
        ) : (
          <SegmentsPulse count={10} className="tutp-segs" />
        )}
      </Screen>
    );
  }

  const index = captionAt(script, songTime);
  const step = index >= 0 ? script[index] : null;
  return (
    <>
      <GameCanvas chart={chart} source="catalog" audioBuffer={null} mode="tutorial" onEvent={onEvent} onTime={onTime} onExit={finish} header={<TopBar />} />
      <TutorialOverlay
        step={step}
        index={index}
        total={script.length}
        progress={step ? stepProgress(step, songTime) : 0}
        succeeded={index >= 0 && (succeeded & (1 << index)) !== 0}
        touch={isTouchDevice()}
      />
    </>
  );
}
