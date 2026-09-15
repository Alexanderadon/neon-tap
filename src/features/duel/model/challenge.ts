import { duels, duelLink, type Duel, type DuelsClient } from '@/shared/api/duels';
import { rememberDuel } from '@/entities/duel';
import type { PlayResult } from '@/entities/score';

/** Who plays: the nickname and the chosen avatar id ('' = the letter avatar, not sent). */
export interface Runner {
  name: string;
  avatar?: string;
}

/** Only finished runs can be a challenge (a failed run has nothing to beat). */
export function canChallenge(result: PlayResult | null | undefined): boolean {
  return !!result && !result.failed && result.totalNotes > 0 && result.score > 0;
}

function runOf(result: PlayResult, who: Runner) {
  return { name: who.name, ...(who.avatar ? { avatar: who.avatar } : {}), score: result.score, accuracy: result.accuracy, rank: result.rank };
}

const created = new WeakMap<PlayResult, Promise<Duel | null>>();

/** Host a duel from a run, once per run (re-renders share the request); remembered on this device. */
export function createChallenge(result: PlayResult, who: Runner, client: DuelsClient = duels): Promise<Duel | null> {
  let p = created.get(result);
  if (!p) {
    p = client.create(result.trackId, runOf(result, who)).then((duel) => {
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

const replied = new WeakMap<PlayResult, Promise<{ duel: Duel; beaten: boolean } | null>>();

/** Answer the duel with this run, once per run. */
export function replyToDuel(duel: Duel, result: PlayResult, who: Runner, client: DuelsClient = duels): Promise<{ duel: Duel; beaten: boolean } | null> {
  let p = replied.get(result);
  if (!p) {
    p = client.reply(duel.id, runOf(result, who));
    replied.set(result, p);
  }
  return p;
}
