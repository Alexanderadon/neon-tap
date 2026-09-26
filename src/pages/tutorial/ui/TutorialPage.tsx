import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { duelIdFromUrl } from '@/shared/api/duels';
import { audioEngine, sfxUi } from '@/shared/lib/audio';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { ActionZone, Disc, Icon, Line, PrimaryAction, Screen, SegmentsPulse, SubHeader, Tag } from '@/shared/ui';
import type { ChartFile } from '@/shared/types/chart';
import { CATALOG, CoverScene, loadChart } from '@/entities/track';
import { getSettings, updateSettings } from '@/entities/settings';
import { recordCrystals } from '@/entities/progress';
import type { SessionEvent } from '@/features/play-chart';
import { buildScript, captionAt, completeTutorial, replayDue, stepProgress } from '@/features/tutorial';
import { GameCanvas } from '@/widgets/game-canvas';
import { TutorialOverlay } from '@/widgets/tutorial-overlay';
import { TopBar } from '@/widgets/top-bar';
import { usePlayTrack } from '@/widgets/track-list';
import { TutorialFinale } from './TutorialFinale';
import './tutorial-page.css';

const TUTORIAL_ID = 'tutorial';
const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

/**
 * Interactive tutorial: the regular game canvas in `tutorial` mode (no hearts, no fail, nothing
 * saved) with a caption card driven by song time. A tap, hold or two-lane step with no hit at all
 * plays once more (`replayDue`). The end of the run opens the «Готово!» frame — the tutorial is done,
 * the first time with +20 crystals — whose primary button goes straight into the first catalog
 * track. «Пропустить» in the pause menu marks it done too, without the crystals, and leaves for the menu.
 */
export function TutorialPage() {
  const [chart, setChart] = useState<ChartFile | null>(null);
  const [error, setError] = useState(false);
  const [songTime, setSongTime] = useState(-Infinity);
  /** Bitmask of steps in which the player already landed a hit (the card's «Отлично!»); the ref is the same for the replay rule. */
  const [succeeded, setSucceeded] = useState(0);
  const hitsRef = useRef(0);
  /** Bitmask of steps already replayed (once each). */
  const replayedRef = useRef(0);
  /** The step playing its second time (its tag says «Ещё разок» instead of «n / 9»), or -1. */
  const [replaying, setReplaying] = useState(-1);
  /** Jumps the song back to a song time with the notes from there on armed again: GameCanvas fills it while the run plays (GameSession.rewind). */
  const rewindRef = useRef<((songTime: number) => void) | null>(null);
  /** The «Готово!» frame: what this finish credited. */
  const [finale, setFinale] = useState<{ crystals: number } | null>(null);
  const leftRef = useRef(false);
  const first = CATALOG[0];
  /** A friend's duel link opened the game: its challenge comes right after the tutorial (App), so the finale leads there instead. */
  const duelLink = useMemo(() => duelIdFromUrl() !== null, []);
  const { busy, play } = usePlayTrack();

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

  /** Leave without the finale (the pause menu's «Пропустить», the load error): done, no crystals. */
  const skip = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    updateSettings({ tutorialDone: true });
    navigate('menu');
  }, []);

  const onTime = useCallback(
    (t: number) => {
      setSongTime(t);
      const due = replayDue(script, t, hitsRef.current, replayedRef.current);
      if (due) {
        replayedRef.current |= 1 << due.index;
        if (rewindRef.current) {
          rewindRef.current(due.at);
          setReplaying(due.index);
        }
      }
    },
    [script],
  );

  const onEvent = useCallback(
    (e: SessionEvent) => {
      if (e.type === 'start') {
        // A fresh run (R restarts it): every step may be hit and replayed again.
        hitsRef.current = 0;
        replayedRef.current = 0;
        setReplaying(-1);
        setSucceeded(0);
        setFinale(null);
      } else if (e.type === 'judge' && e.judgement !== 'miss' && !e.tail) {
        // By the note's own time, not the clock: a verdict arrives up to a window (and the player's offset) after its note —
        // a hold's tail ends right on the next step's start. Tails are the head's hit once more and count for nothing.
        const i = captionAt(script, e.time);
        if (i >= 0) {
          hitsRef.current |= 1 << i;
          setSucceeded(hitsRef.current);
        }
      } else if (e.type === 'finish') {
        // The latency the run learned is saved before the first track (the tutorial's host saves it, GameCanvas does not).
        if (e.autoOffsetMs !== null) updateSettings({ audioOffsetMs: e.autoOffsetMs });
        const crystals = completeTutorial({
          isDone: () => getSettings().tutorialDone,
          markDone: () => updateSettings({ tutorialDone: true }),
          credit: recordCrystals,
        });
        setFinale({ crystals });
      }
    },
    [script],
  );

  // The song plays on under the frame, but never in a hidden app: the run is over, so nothing pauses it but this.
  useEffect(() => {
    if (!finale) return;
    const onVisibility = () => {
      if (document.hidden) audioEngine.stop();
    };
    const onHide = () => audioEngine.stop();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
    };
  }, [finale]);

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
                onClick={skip}
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
  // The finale is the frame, not a card: after the last note the field stays clear until the run ends.
  const step = index >= 0 && script[index].id !== 'finale' ? script[index] : null;
  return (
    <GameCanvas
      chart={chart}
      source="catalog"
      audioBuffer={null}
      mode="tutorial"
      onEvent={onEvent}
      onTime={onTime}
      onExit={skip}
      rewindRef={rewindRef}
      header={<TopBar />}
      overlay={
        finale ? (
          <TutorialFinale
            track={first}
            sub={duelLink ? dict.duelKicker : first.title}
            crystals={finale.crystals}
            busy={busy !== null}
            onPlay={() => {
              sfxUi();
              if (duelLink) navigate('duel');
              else void play(first.id);
            }}
            onMenu={() => {
              sfxUi();
              navigate('menu');
            }}
          />
        ) : (
          <TutorialOverlay
            step={step}
            index={index}
            total={script.length}
            progress={step ? stepProgress(step, songTime) : 0}
            succeeded={step !== null && (succeeded & (1 << index)) !== 0}
            again={step !== null && index === replaying}
            touch={isTouchDevice()}
          />
        )
      }
    />
  );
}
