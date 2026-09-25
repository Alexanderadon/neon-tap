import { dict, fmt, plural } from '@/shared/i18n';
import type { ResultMeta } from '@/entities/play-session';
import { CALENDAR_REWARDS } from '@/entities/progress';

/** One calm grey line under the loot. */
export interface ResultNote {
  key: 'calendar' | 'cap';
  text: string;
}

/**
 * The economy notes of a run, from its meta: the login calendar's mark («Календарь: отметка 3 из 7
 * · +10 кристаллов») and why the run paid less than it collected (the day's allowance is full, the
 * own-song cap, a song under a minute). Plain information — no buy button, no pressure. None after a fail.
 */
export function economyNotes(meta: ResultMeta | null | undefined): ResultNote[] {
  if (!meta) return [];
  const out: ResultNote[] = [];
  if (meta.calendar) {
    const { day, reward } = meta.calendar;
    out.push({ key: 'calendar', text: fmt(dict.calendarMarked, { day, total: CALENDAR_REWARDS.length, n: reward, noun: plural(reward, dict.crystalsNoun) }) });
  }
  if (meta.capped === 'day') out.push({ key: 'cap', text: dict.capDay });
  else if (meta.capped === 'custom') out.push({ key: 'cap', text: dict.capCustom });
  else if (meta.capped === 'short') out.push({ key: 'cap', text: dict.capShort });
  return out;
}
