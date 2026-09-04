import { lowerBound } from '@/shared/lib/math';

/**
 * Maps song time to musical position (beat, bar, phase) for BPM-synced visuals.
 * With a tracked beat list it follows the real beats; otherwise a fixed bpm/offset grid.
 */
export class Conductor {
  constructor(
    public bpm: number,
    /** Seconds from song start to the first downbeat. */
    public offset = 0,
    public beatsPerBar = 4,
    /** Optional tracked beat times (ascending, starting on a downbeat). */
    public beats?: readonly number[],
  ) {}

  get secondsPerBeat(): number {
    return 60 / this.bpm;
  }

  /** Fractional beat index (can be negative before the first beat). */
  beatAt(songTime: number): number {
    const b = this.beats;
    if (b && b.length >= 2) {
      const i = Math.min(b.length - 2, Math.max(0, lowerBound(b, songTime) - 1));
      return i + (songTime - b[i]) / (b[i + 1] - b[i]);
    }
    return (songTime - this.offset) / this.secondsPerBeat;
  }

  /** 0 → on the beat, → 1 just before the next beat. */
  beatPhase(songTime: number): number {
    const v = this.beatAt(songTime);
    return v - Math.floor(v);
  }

  barAt(songTime: number): number {
    return Math.floor(this.beatAt(songTime) / this.beatsPerBar);
  }

  /** Song time of the nearest beat to `songTime` (grid mode). */
  nearestBeatTime(songTime: number): number {
    return Math.round(this.beatAt(songTime)) * this.secondsPerBeat + this.offset;
  }
}
