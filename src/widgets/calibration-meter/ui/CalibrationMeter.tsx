import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CALIBRATION_TAPS, CALIBRATION_VERSION } from '@/shared/config/constants';
import { dict, fmt, plural } from '@/shared/i18n';
import { audioEngine, preloadSfx, sfxClick, sfxUi } from '@/shared/lib/audio';
import { ActionZone, BigDisc, Disc, FrameBody, Headline, Icon, Line, ObjButton, Panel, PrimaryAction, Trio } from '@/shared/ui';
import { updateSettings } from '@/entities/settings';
import { Calibration } from '@/features/calibrate-offset';
import { meterPercent, shiftKind, signedMs } from '../model/meter';
import { TapMeter } from './TapMeter';
import './calibration.css';

interface Props {
  /** Saved or skipped: back to the menu. */
  onDone: () => void;
}

type Phase = 'intro' | 'running' | 'done';

/** Sparks around the check disc when the measurement lands: twelve sticks, gold and white in turn. */
const SPARKS = Array.from({ length: 12 }, (_, i) => ({
  angle: Math.round(i * 30 + ((i * 7) % 5) - 2),
  length: 66 + ((i * 5) % 9),
  gold: i % 2 === 0,
}));

/**
 * Metronome at 120 BPM scheduled on the audio clock; taps are stamped with audio time minus the
 * device's output latency (the game subtracts that on its own), so the median deviation that
 * becomes `audioOffsetMs` is only the player's residual — their reaction and touch latency.
 * Three screens (screens-onboard C3–C5): the intro with the headphones disc, the measurement with
 * the ticking metronome disc, the «7 / 16» panel and the TapMeter, and the result with the check.
 */
export function CalibrationMeter({ onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [count, setCount] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const calib = useRef(new Calibration());
  const firstBeat = useRef(0);
  const timer = useRef(0);
  const nextBeat = useRef(0);
  const beatIndex = useRef(0);
  /** Seconds from the phase change to the first click — the disc's tick animation starts on that beat. */
  const tickDelay = useRef(0.5);

  const stop = () => {
    clearInterval(timer.current);
    timer.current = 0;
  };

  const start = async () => {
    await audioEngine.ensureContext();
    await preloadSfx();
    calib.current.reset();
    setCount(0);
    setLastMs(null);
    const period = calib.current.period;
    firstBeat.current = audioEngine.now() + 0.5;
    nextBeat.current = firstBeat.current;
    beatIndex.current = 0;
    tickDelay.current = 0.5;
    // Look-ahead scheduler: schedule clicks 200 ms ahead so timing never depends on JS timers.
    const schedule = () => {
      const now = audioEngine.now();
      while (nextBeat.current < now + 0.2) {
        sfxClick(nextBeat.current, beatIndex.current % 4 === 0);
        nextBeat.current += period;
        beatIndex.current++;
      }
    };
    schedule();
    timer.current = window.setInterval(schedule, 50);
    setPhase('running');
  };

  const cancel = () => {
    stop();
    sfxUi();
    setPhase('intro');
  };

  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (phase !== 'running') return;
    const tap = (e: Event) => {
      if (e instanceof KeyboardEvent && (e.repeat || e.code === 'Escape')) return;
      if (e instanceof PointerEvent && (e.target as HTMLElement).closest('button')) return;
      const age = Math.max(0, Math.min(0.1, (performance.now() - e.timeStamp) / 1000));
      const dev = calib.current.registerTap(audioEngine.now() - age - audioEngine.outputLatency(), firstBeat.current);
      setLastMs(Math.round(dev * 1000));
      setCount(calib.current.deviations.length);
      if (calib.current.done) {
        stop();
        setOffsetMs(calib.current.offsetMs);
        setPhase('done');
      }
    };
    window.addEventListener('keydown', tap);
    window.addEventListener('pointerdown', tap);
    return () => {
      window.removeEventListener('keydown', tap);
      window.removeEventListener('pointerdown', tap);
    };
  }, [phase]);

  const save = () => {
    sfxUi();
    updateSettings({ audioOffsetMs: offsetMs, calibrated: true, calibrationVersion: CALIBRATION_VERSION });
    onDone();
  };
  const skip = () => {
    sfxUi();
    updateSettings({ calibrated: true, calibrationVersion: CALIBRATION_VERSION });
    onDone();
  };

  if (phase === 'intro') {
    return (
      <div className="calib">
        <FrameBody className="calib-body">
          <BigDisc tone="dark">
            <Icon name="phones" />
          </BigDisc>
          <Headline className="calib-head">{dict.calibrationTap}</Headline>
          <p className="calib-lines">
            <span>{dict.calibLine1}</span>
            <span>{fmt(dict.calibLine2, { n: CALIBRATION_TAPS })}</span>
            <span>{dict.calibLine3}</span>
          </p>
        </FrameBody>
        <ActionZone className="calib-actions">
          <Trio one>
            <ObjButton icon={<Icon name="skip" />} label={dict.calibrationSkip} onClick={skip} />
          </Trio>
          <PrimaryAction
            lead={
              <Disc>
                <Icon name="play" />
              </Disc>
            }
            label={dict.calibrationStart}
            sub={`${CALIBRATION_TAPS} ${plural(CALIBRATION_TAPS, dict.calibTapsNoun)}`}
            beat
            onClick={() => void start()}
          />
        </ActionZone>
      </div>
    );
  }

  if (phase === 'running') {
    const tickStyle: CSSProperties = { animationDelay: `${tickDelay.current}s` };
    return (
      <div className="calib">
        <FrameBody className="calib-body">
          <BigDisc className="calib-disc-tick" style={tickStyle}>
            <Icon name="metro" />
          </BigDisc>
          <Headline className="calib-head">{dict.calibrationTap}</Headline>
          <Panel layout="score" className="calib-panel">
            <div className="calib-num">{fmt(dict.calibrationProgress, { n: count, total: CALIBRATION_TAPS })}</div>
            <div className="calib-stats">
              <span>
                {dict.calibLastTap} <b>{lastMs === null ? '—' : `${signedMs(lastMs)} ${dict.ms}`}</b>
              </span>
            </div>
          </Panel>
          <TapMeter className="calib-meter" percent={lastMs === null ? null : meterPercent(lastMs)} />
        </FrameBody>
        <ActionZone className="calib-actions">
          <Line>{dict.calibTapScreen}</Line>
          <Trio one>
            <ObjButton icon={<Icon name="cross" />} label={dict.shopConfirmNo} onClick={cancel} />
          </Trio>
        </ActionZone>
      </div>
    );
  }

  const kind = shiftKind(offsetMs);
  const abs = Math.abs(offsetMs);
  return (
    <div className="calib">
      <FrameBody className="calib-body">
        <BigDisc className="calib-disc-pop">
          <Icon name="check" />
          <span className="calib-sparks">
            {SPARKS.map((s, k) => (
              <i
                key={k}
                className={s.gold ? 'calib-spark calib-spark-gold' : 'calib-spark'}
                style={{ '--a': `${s.angle}deg`, '--l': `${s.length}px` } as CSSProperties}
              />
            ))}
          </span>
        </BigDisc>
        <Headline className="calib-head" pop style={{ animationDelay: '0.4s' }}>
          {dict.done}
        </Headline>
        <Panel layout="score" className="calib-panel calib-rise" style={{ animationDelay: '0.6s' }}>
          <div className="calib-num">
            {signedMs(offsetMs)} {dict.ms}
          </div>
          <div className="calib-stats">
            {kind === 'none' ? (
              <span>{dict.calibShiftNone}</span>
            ) : (
              <span>
                {(kind === 'late' ? dict.calibShiftLate : dict.calibShiftEarly)[0]}{' '}
                <b>
                  {abs} {dict.ms}
                </b>{' '}
                {(kind === 'late' ? dict.calibShiftLate : dict.calibShiftEarly)[1]}
              </span>
            )}
          </div>
        </Panel>
        <TapMeter className="calib-meter calib-rise" style={{ animationDelay: '0.7s' }} percent={meterPercent(offsetMs)} />
      </FrameBody>
      <ActionZone className="calib-actions">
        <Trio one>
          <ObjButton icon={<Icon name="retry" />} label={dict.calibrationRedo} onClick={() => void start()} />
        </Trio>
        <PrimaryAction
          lead={
            <Disc>
              <Icon name="check" />
            </Disc>
          }
          label={dict.calibrationSave}
          sub={dict.toMenuShort}
          beat
          onClick={save}
        />
      </ActionZone>
    </div>
  );
}
