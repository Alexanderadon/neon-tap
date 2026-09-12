import { detectPitch } from './pitch';
import type { Layer, StemLayers } from './layers';
import type { ChartLevel, NoteTuple } from '@/shared/types/chart';
import { PHRASE_BARS } from './bars';
import type { SongAnalysis } from './SongAnalyzer';

/** Listen at these offsets after the tile's moment — past the attack (a consonant, a pick), into the note itself; the first clear one wins. */
const LISTEN_OFFSETS_SEC = [0.03, 0.08, 0.14];
/** A tile whose note the detector cannot hear (a chord, a pad) repeats the layer's last clear note if it was within this long. */
const CARRY_SEC = 2;
/** A second tile of a chord takes the note of the other instrument hitting there, if any. */
const CHORD_PARTNERS: readonly Layer[] = ['bass', 'other', 'vocals'];

/**
 * The melody note behind every tile (MIDI, 0 = none), aligned with `chart.notes` — what the game
 * plays when the tile is hit. Each tile listens to the stem of the layer its phrase follows; the
 * second tile of a chord listens to the other instrument that hits there. Drum tiles, circles,
 * spells and spinners carry no note.
 */
export function tilePitches(
  chart: ChartLevel,
  analysis: SongAnalysis,
  layers: StemLayers,
  phraseLayers: readonly (Layer | null)[],
  pcm: Readonly<Record<Layer, Float32Array>>,
  sampleRate: number,
): number[] {
  const slotOf = (t: number): number => {
    let lo = 0;
    let hi = analysis.slots.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (analysis.slots[mid].time < t - 1e-6) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const last = new Map<Layer, { t: number; midi: number }>();
  const pitchOf = (layer: Layer, t: number): number => {
    if (layer === 'drums') return 0;
    for (const off of LISTEN_OFFSETS_SEC) {
      const midi = detectPitch(pcm[layer], sampleRate, t + off);
      if (midi !== null) {
        const m = Math.max(1, Math.min(127, Math.round(midi)));
        last.set(layer, { t, midi: m });
        return m;
      }
    }
    const prev = last.get(layer);
    return prev && t - prev.t <= CARRY_SEC ? prev.midi : 0;
  };
  const out: number[] = [];
  let prevTime = -1;
  let prevLayer: Layer | null = null;
  for (const n of chart.notes as readonly NoteTuple[]) {
    const kind = n[3];
    if (kind && kind !== 'slide') {
      out.push(0);
      continue;
    }
    const si = slotOf(n[0]);
    const layer = phraseLayers[Math.floor(analysis.slots[si].bar / PHRASE_BARS)] ?? null;
    if (!layer) {
      out.push(0);
      continue;
    }
    // Chord: the second tile at the same moment listens to another instrument hitting there.
    if (n[0] === prevTime && prevLayer) {
      const partner = CHORD_PARTNERS.filter((l) => l !== prevLayer).sort((a, b) => layers.onset[b][si] - layers.onset[a][si])[0];
      out.push(partner && layers.onset[partner][si] >= 0.4 ? pitchOf(partner, n[0]) : 0);
      continue;
    }
    prevTime = n[0];
    prevLayer = layer;
    out.push(pitchOf(layer, n[0]));
  }
  return out;
}
