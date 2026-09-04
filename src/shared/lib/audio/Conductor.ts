/** Maps song time to musical position (beat, bar, phase) for BPM-synced visuals. */
export class Conductor {
  constructor(
    public bpm: number,
    /** Seconds from song start to the first downbeat. */
    public offset = 0,
    public beatsPerBar = 4,
  ) {}

  get secondsPerBeat(): number {
    return 60 / this.bpm;
  }

  /** Fractional beat index (can be negative before the first beat). */
  beatAt(songTime: number): number {
    return (songTime - this.offset) / this.secondsPerBeat;
  }

  /** 0 → on the beat, → 1 just before the next beat. */
  beatPhase(songTime: number): number {
    const b = this.beatAt(songTime);
    return b - Math.floor(b);
  }

  barAt(songTime: number): number {
    return Math.floor(this.beatAt(songTime) / this.beatsPerBar);
  }

  /** Song time of the nearest beat to `songTime`. */
  nearestBeatTime(songTime: number): number {
    return Math.round(this.beatAt(songTime)) * this.secondsPerBeat + this.offset;
  }
}
