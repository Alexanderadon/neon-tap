import { KEY_LABELS } from '@/shared/config/constants';
import { dict, fmt } from '@/shared/i18n';
import type { CaptionStep, Meeting } from '@/features/play-chart';

/**
 * The caption card for a mechanic met for the first time: the kind's title and hints, the desktop hint
 * naming the note's own keys (a slide «Держи F и зажми J» on the lanes it really crosses).
 */
export function meetCard(m: Meeting): CaptionStep {
  const copy = dict.meetCards[m.kind];
  const keys = KEY_LABELS[m.lanes] ?? [];
  const key = (lane: number) => keys[lane] ?? '';
  return {
    id: `meet-${m.kind}`,
    kind: m.kind,
    lanes: m.lanes,
    title: copy.title,
    hintDesktop: fmt(copy.desktop, { from: key(m.lane), to: key(m.extra), key: key(m.lane) }),
    hintTouch: copy.touch,
  };
}

/** 0..1 through the card's time on screen. */
export function meetProgress(m: Meeting, songTime: number): number {
  const len = m.to - m.from;
  return len > 0 ? Math.max(0, Math.min(1, (songTime - m.from) / len)) : 1;
}
