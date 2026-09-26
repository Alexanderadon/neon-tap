/**
 * Where the deck was left: per-viewer conveniences in localStorage (never authoritative). Two
 * things are kept apart: the card the deck stood on — by what it shows, since the last cards move
 * when a new week opens — and the last TRACK the player chose, which the cards without a track
 * («Моя музыка», the empty-week card) stand for in the records and the primary button.
 */
const CARD_KEY = 'neon-tap:deck';
const TRACK_KEY = 'neon-tap:deck-track';
const CUSTOM = '#custom';
const SLOT = '#slot';

/** A deck card by what it shows: a catalog track, «Моя музыка» or the empty-week card. */
export type DeckCardRef = { kind: 'track'; id: string } | { kind: 'custom' } | { kind: 'slot' };

type Read = Pick<Storage, 'getItem'> | null;
type Write = Pick<Storage, 'setItem'> | null;

function read(storage: Read, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * The card the deck was left on, or null. Track cards are kept by id and read back only while the
 * track is in `trackIds`; a plain number is the older format (a catalog index) and still honoured.
 */
export function readDeckCard(storage: Read, trackIds: readonly string[]): DeckCardRef | null {
  const raw = read(storage, CARD_KEY);
  if (raw === null) return null;
  if (raw === CUSTOM) return { kind: 'custom' };
  if (raw === SLOT) return { kind: 'slot' };
  if (trackIds.includes(raw)) return { kind: 'track', id: raw };
  const n = Number(raw);
  return raw !== '' && Number.isInteger(n) && n >= 0 && n < trackIds.length ? { kind: 'track', id: trackIds[n] } : null;
}

/** The last track card the player stood on (still in `trackIds`), or null. */
export function readLastTrack(storage: Read, trackIds: readonly string[]): string | null {
  const id = read(storage, TRACK_KEY);
  if (id !== null && trackIds.includes(id)) return id;
  const card = readDeckCard(storage, trackIds);
  return card?.kind === 'track' ? card.id : null;
}

/** Remember the card; a track card is also the last chosen track. */
export function writeDeckCard(storage: Write, card: DeckCardRef): void {
  try {
    storage?.setItem(CARD_KEY, card.kind === 'track' ? card.id : card.kind === 'custom' ? CUSTOM : SLOT);
    if (card.kind === 'track') storage?.setItem(TRACK_KEY, card.id);
  } catch {
    /* private mode / quota — the deck simply opens on the default card next time */
  }
}
