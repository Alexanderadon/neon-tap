import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Stars } from './Stars';
import { Tag } from './Tag';
import { Chip } from './Chip';
import { CounterSwap } from './CounterSwap';
import { ObjButton } from './ObjButton';
import { PrimaryAction, Disc } from './PrimaryAction';
import { Panel } from './Panel';
import { Coin } from './Coin';
import { ProgressBar } from './ProgressBar';
import { RingCountdown } from './RingCountdown';
import { Icon } from './icons';
import { difficultyColor } from './difficultyColor';
import { Difficulty } from './Difficulty';
import { Segments, SegmentsPulse } from './Segments';
import { segmentStates } from './segmentStates';
import { ListRow, PlaceChip, StatePanel } from './ListRow';
import { Avatar } from './Avatar';
import { Trio } from './ActionZone';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe('Stars', () => {
  it('draws max stars, the earned ones with a gold gradient and a rim, the rest in grey', () => {
    const out = html(createElement(Stars, { value: 2, max: 3 }));
    expect(out.match(/<svg/g)?.length).toBe(3);
    expect(out.match(/stopColor|stop-color="#fff3a0"/g)?.length).toBe(2);
    expect(out.match(/stop-color="#3a3d4c"/g)?.length).toBe(1);
    expect(out).toContain('stroke="#8a4500"');
    expect(out).not.toContain('filter');
  });

  it('gives every gradient a unique id so several Stars on one page do not share defs', () => {
    const out = html(createElement('div', null, createElement(Stars, { value: 3 }), createElement(Stars, { value: 3 })));
    const ids = out.match(/id="[^"]+"/g) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(6);
  });

  it('hero size adds the SVG halo, raises the middle star and bursts sparks when animated', () => {
    const out = html(createElement(Stars, { value: 2, size: 'hero', animate: true }));
    expect(out).toContain('stars-hero');
    expect(out.match(/star-halo/g)?.length).toBe(2);
    expect(out.match(/star-wrap-big/g)?.length).toBe(1);
    expect(out.match(/<i class="star-spark/g)?.length).toBe(24);
    expect(out).toContain('animation-delay:0.30s');
    expect(out).toContain('animation-delay:0.70s');
    expect(out).toContain('animation-delay:1.10s');
  });

  it('keeps the old contract: xl is the hero, sm has no halo', () => {
    expect(html(createElement(Stars, { value: 1, size: 'xl' }))).toContain('stars-hero');
    expect(html(createElement(Stars, { value: 1, size: 'sm' }))).not.toContain('star-halo');
  });
});

describe('Tag / Chip / CounterSwap', () => {
  it('Tag variants and shapes map to classes', () => {
    expect(html(createElement(Tag, { children: 'Глава 1' }))).toBe('<span class="tag"><span class="tag-text">Глава 1</span></span>');
    expect(html(createElement(Tag, { variant: 'dark', shape: 'right', shine: true, children: 'x' }))).toContain('class="tag tag-dark tag-right"');
    expect(html(createElement(Tag, { variant: 'dark', shape: 'right', shine: true, children: 'x' }))).toContain('tag-shine');
    expect(html(createElement(Tag, { shape: 'flush', icon: createElement(Icon, { name: 'sun' }), children: 'Трек дня' }))).toContain('tag-icon');
  });

  it('Chip is a span by default and a button with onClick, keeps a fixed width', () => {
    const plain = html(createElement(Chip, { variant: 'cy', width: 88, children: '758' }));
    expect(plain.startsWith('<span class="chip chip-cy"')).toBe(true);
    expect(plain).toContain('width:88px');
    const btn = html(createElement(Chip, { variant: 'gd', onClick: () => {}, children: '22' }));
    expect(btn.startsWith('<button type="button" class="chip chip-gd chip-btn"')).toBe(true);
  });

  it('CounterSwap shows only the new value unless it ticks', () => {
    expect(html(createElement(CounterSwap, { from: '673', to: '758' }))).toBe('<span class="swap">758</span>');
    expect(html(createElement(CounterSwap, { from: '20', to: '20', active: true }))).toBe('<span class="swap">20</span>');
    const tick = html(createElement(CounterSwap, { from: '673', to: '758', active: true, delay: 4.1 }));
    expect(tick).toContain('swap-active');
    expect(tick).toContain('animation-delay:4.1s');
  });
});

describe('buttons, panel, coin', () => {
  it('ObjButton renders icon, caption and an optional badge', () => {
    const out = html(createElement(ObjButton, { icon: createElement(Icon, { name: 'bag' }), label: 'Магазин', badge: 2 }));
    expect(out).toContain('class="obj"');
    expect(out).toContain('obj-badge">2<');
    expect(html(createElement(ObjButton, { icon: 'i', label: 'x', badge: 0 }))).not.toContain('obj-badge');
    expect(html(createElement(ObjButton, { icon: 'i', label: 'x', wide: true, end: 'e', active: true }))).toContain('class="obj obj-wide obj-on"');
  });

  it('PrimaryAction has the three-slot grid with a default arrow and beat only on the cyan tone', () => {
    const out = html(
      createElement(PrimaryAction, { lead: createElement(Disc, null, createElement(Icon, { name: 'play' })), label: 'Играть', sub: 'Metal Song', beat: true }),
    );
    expect(out).toContain('class="primary primary-beat"');
    expect(out).toContain('primary-disc');
    expect(out).toContain('icon-arrow');
    expect(out).toContain('primary-sub">Metal Song<');
    expect(html(createElement(PrimaryAction, { label: 'x', beat: true, tone: 'locked', icon: null }))).toContain('class="primary primary-locked"');
  });

  it('Panel becomes a button with onPress', () => {
    expect(html(createElement(Panel, { layout: 'score', children: 'x' }))).toBe('<div class="panel panel-score">x</div>');
    expect(html(createElement(Panel, { onPress: () => {}, label: 'Звук', children: 'x' }))).toContain('<button type="button" class="panel panel-press"');
  });

  it('Coin shows the value in the currency colour and the grey caption', () => {
    const out = html(createElement(Coin, { value: '+35', caption: 'кристаллы', tone: 'cy', animate: true, delay: 3 }));
    expect(out).toContain('coin-value coin-cy');
    expect(out).toContain('coin-caption">кристаллы<');
    expect(out).toContain('animation-delay:3s');
  });
});

describe('ProgressBar', () => {
  it('draws base and add layers: add clipped from base to value', () => {
    const out = html(createElement(ProgressBar, { value: 22 / 25, base: 20 / 25, label: 'до открытия', right: '22 / 25', animate: true }));
    expect(out).toContain('aria-valuenow="88"');
    expect(out).toContain('progress-base" style="width:80.00%"');
    expect(out).toContain('clip-path:inset(0 12.00% 0 80.00%)');
    expect(out).toContain('--pb-from:20.00%');
    expect(out).toContain('progress-animate');
  });

  it('keeps the legacy contract (value + label + colour) and clamps', () => {
    const out = html(createElement(ProgressBar, { value: 1.4, label: 'Анализ', color: '#00f0ff' }));
    expect(out).toContain('aria-valuenow="100"');
    expect(out).toContain('background:#00f0ff');
    expect(out).not.toContain('progress-add');
  });
});

describe('RingCountdown', () => {
  it('sizes the circle to the box and drains by CSS when uncontrolled', () => {
    const out = html(createElement(RingCountdown, { size: 40, seconds: 5 }));
    expect(out).toContain('ring ring-run');
    expect(out).toContain('r="19"');
    expect(out).toContain('stroke-dasharray="119.38"');
    expect(out).toContain('--ring-seconds:5s');
  });

  it('sets the offset directly when progress is controlled', () => {
    const out = html(createElement(RingCountdown, { size: 40, seconds: 30, progress: 0.5 }));
    expect(out).not.toContain('ring-run');
    expect(out).toContain('stroke-dashoffset="59.69"');
  });
});

describe('Difficulty', () => {
  it('maps tiers to the v3 palette: lime, cyan, gold, orange, magenta', () => {
    expect(difficultyColor(1)).toBe('#b6ff00');
    expect(difficultyColor(2)).toBe('#b6ff00');
    expect(difficultyColor(3)).toBe('#00f0ff');
    expect(difficultyColor(5)).toBe('#ffd700');
    expect(difficultyColor(6)).toBe('#ffd700');
    expect(difficultyColor(7)).toBe('#ff8a00');
    expect(difficultyColor(9)).toBe('#ff2bd6');
    expect(difficultyColor(42)).toBe('#ff2bd6');
  });

  it('is the dark chip with a coloured flame and the number, without CSS filters', () => {
    const out = html(createElement(Difficulty, { stars: 7 }));
    expect(out).toContain('class="chip chip-dark chip-flame"');
    expect(out).toContain('color:#ff8a00');
    expect(out).toContain('<span class="chip-text">7</span>');
    expect(out).not.toContain('filter');
  });
});

describe('Segments', () => {
  it('derives states from the current index and marks done / current segments', () => {
    expect(segmentStates(4, 1)).toEqual(['done', 'current', 'rest', 'rest']);
    expect(segmentStates(3, 3)).toEqual(['done', 'done', 'done']);
    const out = html(createElement(Segments, { states: segmentStates(3, 1) }));
    expect(out.match(/<i class="seg/g)?.length).toBe(3);
    expect(out).toContain('seg seg-done');
    expect(out).toContain('seg seg-cur');
  });

  it('becomes a list of 24 px tap targets with onSelect and pulses while loading', () => {
    const out = html(createElement(Segments, { states: segmentStates(2, 0), onSelect: () => {}, labels: ['a', 'b'] }));
    expect(out.startsWith('<ol class="segs"')).toBe(true);
    expect(out.match(/class="seg-hit"/g)?.length).toBe(2);
    expect(out).toContain('aria-current="true"');
    const pulse = html(createElement(SegmentsPulse, { count: 10 }));
    expect(pulse.match(/animation-delay/g)?.length).toBe(10);
    expect(pulse).toContain('segs-pulse');
  });
});

describe('ListRow / StatePanel / Avatar / Trio', () => {
  it('ListRow marks my row and gilds the first three places', () => {
    const me = html(createElement(ListRow, { lead: createElement(PlaceChip, { place: 2 }), name: 'Neo', score: '102 400', me: true }));
    expect(me).toContain('class="lrow lrow-me"');
    expect(me).toContain('lrow-pos lrow-pos-top');
    expect(me).toContain('aria-current="true"');
    expect(html(createElement(PlaceChip, { place: 4 }))).toBe('<span class="lrow-pos">4</span>');
    expect(html(createElement(ListRow, { as: 'div', name: 'x' })).startsWith('<div class="lrow"')).toBe(true);
  });

  it('StatePanel is a status by default and an alert on errors', () => {
    expect(html(createElement(StatePanel, { icon: 'i', children: 'x' }))).toContain('role="status"');
    expect(html(createElement(StatePanel, { icon: 'i', role: 'alert', children: 'x' }))).toContain('role="alert"');
  });

  it('Avatar shows the first letter, a «?» on the dark face while empty, and the other tone for other people', () => {
    expect(html(createElement(Avatar, { name: 'neo' }))).toBe('<span class="ava" aria-hidden="true">N</span>');
    expect(html(createElement(Avatar, { name: '', size: 48 }))).toContain('class="ava ava-48 ava-empty"');
    expect(html(createElement(Avatar, { name: 'Zed', size: 96, tone: 'other' }))).toContain('class="ava ava-96 ava-other"');
  });

  it('Avatar frames a chosen picture instead of the letter, whatever the tone, and rings the chosen cell', () => {
    const art = createElement('img', { src: '/avatars/fox.webp', alt: '' });
    const framed = html(createElement(Avatar, { name: 'neo', art }));
    expect(framed).toBe('<span class="ava ava-art" aria-hidden="true"><img src="/avatars/fox.webp" alt=""/></span>');
    expect(html(createElement(Avatar, { name: '', size: 48, tone: 'other', art }))).toContain('class="ava ava-48 ava-art"');
    expect(html(createElement(Avatar, { name: 'neo', size: 56, art, selected: true }))).toContain('class="ava ava-56 ava-art ava-selected"');
  });

  it('Trio is the row of three, or one full-width cell', () => {
    expect(html(createElement(Trio, { children: 'x' }))).toBe('<div class="trio">x</div>');
    expect(html(createElement(Trio, { one: true, children: 'x' }))).toBe('<div class="trio trio-one">x</div>');
  });
});
