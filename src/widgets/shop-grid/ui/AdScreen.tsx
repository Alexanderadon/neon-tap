import { useEffect, useState } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { stubAds } from '@/shared/lib/ads';
import { Disc, Icon, Line, Panel, PrimaryAction, RingCountdown } from '@/shared/ui';
import { TrackCover, type TrackMeta } from '@/entities/track';

/** How often the ring and the seconds refresh while the stub plays. */
const TICK_MS = 100;
/** RingCountdown 144 around the 120 cover: r 66, stroke 4 → the SVG box is 136 (spec «RingCountdown»). */
const RING_BOX = 136;
const RING_STROKE = 4;

interface Props {
  track: TrackMeta;
  /** «ЗАКРЫТЬ» before the end: no reward. */
  onClose: () => void;
}

/**
 * The rewarded-ad frame (mockup screen 11): a dark full screen without the top bar — the «РЕКЛАМА»
 * tag on the chips' line, the track's cover 120 inside the 30-second ring, the name, «трек
 * откроется после ролика», the provider's placeholder panel, and the waiting «ЗАКРЫТЬ / ещё N
 * секунд» button that turns cyan when the ring is done. The stub provider drives the ring.
 */
export function AdScreen({ track, onClose }: Props) {
  const [state, setState] = useState(() => ({ progress: stubAds.progress(), left: Math.ceil(stubAds.remainingSeconds()) }));
  useEffect(() => {
    const read = () => setState({ progress: stubAds.progress(), left: Math.ceil(stubAds.remainingSeconds()) });
    read();
    const id = window.setInterval(read, TICK_MS);
    const off = stubAds.subscribe(read);
    return () => {
      window.clearInterval(id);
      off();
    };
  }, []);
  const done = !stubAds.playing || state.progress >= 1;
  return (
    <div className="ad-root" role="dialog" aria-modal="true" aria-label={dict.shopAdTag}>
      <div className="ad-col">
        <div className="ad-tagrow">
          <span className="ad-tag">
            <Icon name="ad" size={20} />
            {dict.shopAdTag}
          </span>
        </div>
        <div className="ad-hero">
          <RingCountdown size={RING_BOX} stroke={RING_STROKE} seconds={0} progress={done ? 1 : state.progress} className="ad-ring" />
          <div className="ad-cover">
            <TrackCover id={track.id} genre={track.genre} title={track.title} />
          </div>
        </div>
        <h2 className="ad-title">{track.title}</h2>
        <Line className="ad-line">{dict.shopAdOpensAfter}</Line>
        <Panel layout="score" className="shop-empty ad-placeholder">
          <Icon name="ad" size={32} />
          <span>{dict.shopAdPlaceholder}</span>
        </Panel>
        <div className="ad-spacer" />
        <PrimaryAction
          tone={done ? 'cyan' : 'locked'}
          lead={
            <Disc>
              <Icon name="hourglass" size={24} />
            </Disc>
          }
          label={dict.shopAdClose}
          sub={done ? undefined : fmt(dict.shopAdLeft, { n: state.left, noun: plural(state.left, dict.secondsNoun) })}
          onClick={onClose}
        />
      </div>
    </div>
  );
}
