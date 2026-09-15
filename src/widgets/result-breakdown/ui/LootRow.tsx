import type { RefObject } from 'react';
import { dict } from '@/shared/i18n';
import { Coin, CrystalIcon, Stars } from '@/shared/ui';
import { formatLoot, type Loot } from '../lib/loot';
import { T } from '../lib/timeline';

interface Props {
  loot: Loot;
  /** One anchor per coin — the flights start from their centres. */
  coinRefs: readonly RefObject<HTMLSpanElement>[];
}

/** Three coins on the 3-column grid (spec §2.9): +35 кристаллы · +2 звёзды · +50 за достижение (or +1 трек дня, or +0). */
export function LootRow({ loot, coinRefs }: Props) {
  return (
    <div className="result-loot" role="list" aria-label={dict.resultRewardsAria}>
      {loot.coins.map((c, i) => (
        <span key={c.key} ref={coinRefs[i]} className="result-loot-cell" role="listitem">
          <Coin
            tone={c.tone}
            icon={c.tone === 'cy' ? <CrystalIcon size={20} halo /> : c.tone === 'gd' ? <Stars value={1} max={1} /> : undefined}
            value={formatLoot(c.amount)}
            caption={c.caption}
            animate
            delay={T.COIN + i * T.COIN_STEP}
          />
        </span>
      ))}
    </div>
  );
}
