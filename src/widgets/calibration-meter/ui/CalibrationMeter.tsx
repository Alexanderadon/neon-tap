import { useEffect, useRef, useState } from 'react';
import { CALIBRATION_TAPS } from '@/shared/config/constants';
import { dict, fmt } from '@/shared/i18n';
import { audioEngine, sfxClick } from '@/shared/lib/audio';
import { Button } from '@/shared/ui';
import { updateSettings } from '@/entities/settings';
import { Calibration } from '@/features/calibrate-offset';
import './calibration.css';

interface Props {
  onDone: () => void;
}

type Phase = 'intro' | 'running' | 'done';

/**
 * Metronome at 120 BPM scheduled on the audio clock; taps are stamped with audio time,
 * the median deviation becomes `audioOffsetMs`.
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

  const stop = () => {
    clearInterval(timer.current);
    timer.current = 0;
  };

  const start = async () => {
    await audioEngine.ensureContext();
    calib.current.reset();
    setCount(0);
    setLastMs(null);
    const period = calib.current.period;
    firstBeat.current = audioEngine.now() + 0.5;
    nextBeat.current = firstBeat.current;
    beatIndex.current = 0;
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

  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (phase !== 'running') return;
    const tap = (e: Event) => {
      if (e instanceof KeyboardEvent && (e.repeat || e.code === 'Escape')) return;
      if (e instanceof PointerEvent && (e.target as HTMLElement).closest('button')) return;
      const age = Math.max(0, Math.min(0.1, (performance.now() - e.timeStamp) / 1000));
      const dev = calib.current.registerTap(audioEngine.now() - age, firstBeat.current);
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
    updateSettings({ audioOffsetMs: offsetMs, calibrated: true });
    onDone();
  };

  return (
    <div className="calib">
      {phase === 'intro' && (
        <>
          <p className="calib-intro">{dict.calibrationIntro}</p>
          <Button size="lg" onClick={start}>
            {dict.calibrationStart}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              updateSettings({ calibrated: true });
              onDone();
            }}
          >
            {dict.calibrationSkip}
          </Button>
        </>
      )}
      {phase === 'running' && (
        <>
          <div className="calib-beat" key={count} />
          <div className="calib-tap">{dict.calibrationTap}</div>
          <div className="calib-count">{fmt(dict.calibrationProgress, { n: count, total: CALIBRATION_TAPS })}</div>
          <div className="calib-last">{lastMs !== null ? `${lastMs > 0 ? '+' : ''}${lastMs} ${dict.ms}` : ' '}</div>
          <div className="calib-dots">
            {Array.from({ length: CALIBRATION_TAPS }, (_, i) => (
              <span key={i} className={i < count ? 'on' : ''} />
            ))}
          </div>
        </>
      )}
      {phase === 'done' && (
        <>
          <div className="calib-result">{fmt(dict.calibrationResult, { ms: `${offsetMs > 0 ? '+' : ''}${offsetMs}` })}</div>
          <Button size="lg" onClick={save}>
            {dict.calibrationSave}
          </Button>
          <Button variant="ghost" onClick={start}>
            {dict.calibrationRedo}
          </Button>
        </>
      )}
    </div>
  );
}
