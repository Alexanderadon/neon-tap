import { duels, duelLink, type Duel, type DuelsClient } from '@/shared/api/duels';
import { rememberDuel } from '@/entities/duel';
import type { PlayResult } from '@/entities/score';

/** Only finished runs can be a challenge (a failed run has nothing to beat). */
export function canChallenge(result: PlayResult | null | undefined): boolean {
  return !!result && !result.failed && result.totalNotes > 0 && result.score > 0;
}

const created = new WeakMap<PlayResult, Promise<Duel | null>>();

/** Host a duel from a run, once per run (re-renders share the request); remembered on this device. */
export function createChallenge(result: PlayResult, nickname: string, client: DuelsClient = duels): Promise<Duel | null> {
  let p = created.get(result);
  if (!p) {
    p = client.create(result.trackId, { name: nickname, score: result.score, accuracy: result.accuracy, rank: result.rank }).then((duel) => {
      if (duel) rememberDuel({ id: duel.id, track: duel.track, at: duel.host.at });
      return duel;
    });
    created.set(result, p);
  }
  return p;
}

/** The text a friend receives with the link. */
export function challengeText(duel: Duel, title: string): string {
  return `${duel.host.name}: ${duel.host.score.toLocaleString('ru-RU')} на «${title}». Побьёшь? ${duelLink(duel.id)}`;
}

/**
 * Hand the link to the share sheet, or copy it. Returns how it went so the button can say
 * "sent" / "copied". Never throws.
 */
export async function shareChallenge(duel: Duel, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const text = challengeText(duel, title);
  const link = duelLink(duel.id);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ text, url: link });
      return 'shared';
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

const replied = new WeakMap<PlayResult, Promise<{ duel: Duel; beaten: boolean } | null>>();

/** Answer the duel with this run, once per run. */
export function replyToDuel(duel: Duel, result: PlayResult, nickname: string, client: DuelsClient = duels): Promise<{ duel: Duel; beaten: boolean } | null> {
  let p = replied.get(result);
  if (!p) {
    p = client.reply(duel.id, { name: nickname, score: result.score, accuracy: result.accuracy, rank: result.rank });
    replied.set(result, p);
  }
  return p;
}
