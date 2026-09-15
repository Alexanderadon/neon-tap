export type SegmentState = 'done' | 'current' | 'rest';

/** `total` segments where the first `done` are gold and `current` (an index) is cyan. */
export function segmentStates(total: number, current: number, done: number = current): SegmentState[] {
  return Array.from({ length: total }, (_, i) => (i < done ? 'done' : i === current ? 'current' : 'rest'));
}
