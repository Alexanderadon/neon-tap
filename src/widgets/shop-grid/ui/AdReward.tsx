import type { CSSProperties } from 'react';
import { dict } from '@/shared/i18n';
import { Headline, Tag } from '@/shared/ui';
import { TrackCover, type TrackMeta } from '@/entities/track';

/** Twelve sparks around the cover, jittered deterministically (mockup screen 12). */
const SPARKS = Array.from({ length: 12 }, (_, i) => ({
  angle: Math.round(i * 30 + ((i * 7) % 5) - 5),
  length: 76 + (i % 9) * 2,
  gold: i % 2 === 0,
}));

/** Sixteen confetti pieces over the hero — gold and white only, every third a gem (spec §2.14). */
const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  x: 54 + ((i * 53) % 250),
  y: 2 + ((i * 37) % 100),
  gold: i % 3 !== 1,
  gem: i % 3 === 0,
  duration: 1.5 + ((i * 13) % 7) / 10,
  delay: 0.9 + ((i * 17) % 10) / 10,
  rotate: (i * 47) % 360,
}));

/**
 * «Реклама — трек открыт» (mockup screen 12), on the result screen's skeleton: the cover 120 pops
 * with sparks, «ТРЕК ОТКРЫТ!» in the verdict material, the «БЕСПЛАТНО | ЗА РЕКЛАМУ» tag pair, and
 * confetti. The wallet above did not change — that is what «free» looks like.
 */
export function AdReward({ track }: { track: TrackMeta }) {
  return (
    <div className="reward" aria-live="polite">
      <div className="reward-hero">
        <div className="reward-cover">
          <TrackCover id={track.id} genre={track.genre} title={track.title} />
        </div>
        <span className="reward-sparks" aria-hidden="true">
          {SPARKS.map((s, i) => (
            <i
              key={i}
              className={s.gold ? 'reward-spark reward-spark-gold' : 'reward-spark'}
              style={{ '--a': `${s.angle}deg`, '--l': `${s.length}px` } as CSSProperties}
            />
          ))}
        </span>
      </div>
      <Headline as="div" pop className="reward-verdict">
        {dict.shopTrackOpenedBang}
      </Headline>
      <div className="reward-tags">
        <Tag shape="left" shine>
          {dict.shopAdFreeShort}
        </Tag>
        <Tag variant="dark" shape="right">
          {dict.shopForAd}
        </Tag>
      </div>
      <span className="reward-confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <i
            key={i}
            className={['reward-cf', c.gold && 'reward-cf-gold', c.gem && 'reward-cf-gem'].filter(Boolean).join(' ')}
            style={{ left: c.x, top: c.y, '--d': `${c.duration}s`, '--dl': `${c.delay}s`, '--r': `${c.rotate}deg` } as CSSProperties}
          />
        ))}
      </span>
    </div>
  );
}
