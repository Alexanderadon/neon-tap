import { describe, expect, it } from 'vitest';
import { customSongsLine, dropSoonText, songsText } from './deckText';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 9, 4, 21);

describe('deck text', () => {
  it('says when a drop comes out in calendar days: «сегодня», «завтра», «через N дн.»', () => {
    const moscow = () => 3 * HOUR;
    expect(dropSoonText({ releaseAt: T0 }, T0 - 3 * HOUR, moscow)).toBe('Выйдет завтра');
    expect(dropSoonText({ releaseAt: T0 }, T0 - DAY, moscow)).toBe('Выйдет завтра');
    expect(dropSoonText({ releaseAt: T0 }, T0 - 2.5 * DAY, moscow)).toBe('Выйдет через 3 дн.');
    expect(dropSoonText({ releaseAt: T0 }, T0 - 7 * DAY, moscow)).toBe('Выйдет через 7 дн.');
    // Vladivostok (UTC+10): Monday 03:00 local, the drop opens at 07:00.
    expect(dropSoonText({ releaseAt: T0 }, T0 - 4 * HOUR, () => 10 * HOUR)).toBe('Выйдет сегодня');
  });

  it('counts the saved songs on the custom card: the free limit, or PASS', () => {
    expect(customSongsLine(0, false)).toBe('твой MP3 — игра сама сделает уровень');
    expect(customSongsLine(0, true)).toBe('твой MP3 — игра сама сделает уровень');
    expect(customSongsLine(1, false)).toBe('1 песня · осталось 2 из 3');
    expect(customSongsLine(3, false)).toBe('3 песни · осталось 0 из 3');
    expect(customSongsLine(5, false)).toBe('5 песен · осталось 0 из 3');
    expect(customSongsLine(37, true)).toBe('37 песен · PASS');
    expect(songsText(21)).toBe('21 песня');
  });
});
