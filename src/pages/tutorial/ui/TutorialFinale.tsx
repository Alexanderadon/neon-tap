import { dict } from '@/shared/i18n';
import { ActionZone, Coin, CrystalIcon, Disc, Headline, Icon, ObjButton, PrimaryAction, SubHeader, Trio } from '@/shared/ui';
import { CoverScene, trackTint, type TrackMeta } from '@/entities/track';
import { TopBar } from '@/widgets/top-bar';

interface Props {
  /** The track «ИГРАТЬ» starts — the first one of the catalog (its scene and colour dress the frame). */
  track: TrackMeta;
  /** The button's second line: the track's title, or «Дуэль» when a friend's duel link waits. */
  sub: string;
  /** Crystals this finish credited (the first finish only); 0 hides the coin. */
  crystals: number;
  /** The track's chart is loading: the button waits. */
  busy: boolean;
  onPlay: () => void;
  onMenu: () => void;
}

/**
 * The tutorial's last step, a frame over the field once the run is over: «ГОТОВО!», what a real
 * track adds (three levels, each faster, a star for each), the «+20» crystal coin the first time,
 * and the primary «ИГРАТЬ · Battle Theme» straight into the run; «В меню» alone in the trio. The
 * song plays on under it (the page silences it when the app is hidden).
 */
export function TutorialFinale({ track, sub, crystals, busy, onPlay, onMenu }: Props) {
  return (
    <div className="tutp-finale" aria-live="polite">
      <CoverScene id={track.id} genre={track.genre} />
      <div className="tutp-col">
        <TopBar />
        <SubHeader center>
          <b>{dict.tutorial}</b>
        </SubHeader>
        <div className="tutp-body">
          <Headline as="h2" pop>
            {dict.tutorialDone}
          </Headline>
          <p className="tutp-text">{dict.tutorialFinaleLine}</p>
          {crystals > 0 && (
            <Coin
              tone="cy"
              icon={<CrystalIcon size={20} halo />}
              value={`+${crystals}`}
              caption={dict.coinCrystals}
              animate
              delay={0.3}
              className="tutp-coin"
            />
          )}
        </div>
        <ActionZone className="tutp-bottom">
          <Trio one className="tutp-rise">
            <ObjButton icon={<Icon name="home" />} label={dict.toMenu} onClick={onMenu} />
          </Trio>
          <PrimaryAction
            className="tutp-rise"
            lead={
              <Disc>
                <Icon name="play" size={24} />
              </Disc>
            }
            label={dict.play}
            sub={sub}
            tint={trackTint(track.id, track.genre)}
            beat={!busy}
            disabled={busy}
            autoFocus
            onClick={onPlay}
          />
        </ActionZone>
      </div>
    </div>
  );
}
