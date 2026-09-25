import type { ReactNode, Ref } from 'react';
import { dict } from '@/shared/i18n';
import { Avatar, Chip, CounterSwap, CrystalIcon, Stars } from '@/shared/ui';
import { useSettings } from '@/entities/settings';
import { avatarArtOf } from '@/entities/avatar';
import { grandTotalStars, useProgress } from '@/entities/progress';
import { TRACK_IDS } from '@/entities/track';
import { formatCount } from '@/shared/lib/format';
import './top-bar.css';

/** A counter that ticks from one value to another (the result screen after the loot has flown in). */
export interface CounterTick {
  from: number;
  to: number;
  /** Seconds before the tick (spec §3: crystals 4.1, stars 4.3). */
  delay?: number;
}

interface Props {
  /** Override the crystal counter: a number, or a tick from → to. Defaults to the wallet. */
  crystals?: number | CounterTick;
  /** Override the star counter likewise. Defaults to the player's grand total. */
  stars?: number | CounterTick;
  /** Tap on the crystal chip (the menu and profile open the shop). */
  onCrystalsTap?: () => void;
  /** The «+» after the crystal chip — opens the crystal packs (absent when purchases are unavailable). */
  onTopUp?: () => void;
  /** Anchors for reward flights — the chips' DOM nodes (`getBoundingClientRect`). */
  crystalsRef?: Ref<HTMLElement>;
  starsRef?: Ref<HTMLElement>;
  /** `title` = before the player exists (audio gate, welcome): only the game's name, centred. */
  variant?: 'player' | 'title';
  /** Replaces the identity slot (a back arrow, a screen title) while the wallet stays. */
  left?: ReactNode;
  className?: string;
}

/** Widths of the wallet chips (spec §2.1): fixed, so the bar is pixel-identical whatever the digits. */
const CRYSTAL_CHIP_W = 88;
const STAR_CHIP_W = 80;

/**
 * The top bar, identical on every non-game screen: the avatar (the chosen picture or the letter) + name on the left, the crystal
 * and star chips on the right. Reads the nickname and the wallet itself; the result screen passes
 * `from → to` ticks so the counters visibly grow after the loot flies in.
 */
export function TopBar({ crystals, stars, onCrystalsTap, onTopUp, crystalsRef, starsRef, variant = 'player', left, className }: Props) {
  const nickname = useSettings((s) => s.nickname);
  const avatar = useSettings((s) => s.avatar);
  const walletCrystals = useProgress((s) => s.crystals);
  const walletStars = useProgress((s) => grandTotalStars(s, TRACK_IDS));
  const cls = ['topbar', className].filter(Boolean).join(' ');
  if (variant === 'title') {
    return (
      <header className={`${cls} topbar-title`}>
        <span className="topbar-brand">{dict.appTitle}</span>
      </header>
    );
  }
  const name = nickname || dict.appTitle;
  return (
    <header className={cls}>
      <span className="topbar-who">
        {left ?? (
          <>
            <Avatar name={nickname} art={avatarArtOf(avatar)} />
            <span className="topbar-name">{name}</span>
          </>
        )}
      </span>
      <span className="topbar-wallet">
        <WalletChip
          variant="cy"
          width={CRYSTAL_CHIP_W}
          value={crystals ?? walletCrystals}
          icon={<CrystalIcon size={16} halo />}
          label={dict.crystalsTitle}
          onClick={onCrystalsTap}
          chipRef={crystalsRef}
          extra={
            onTopUp ? (
              <button type="button" className="topbar-plus" aria-label={dict.offerTopUpAria} title={dict.offerTopUp} onClick={onTopUp}>
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
                  <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            ) : (
              // No top-up on this screen: the slot stays, so the header is the same on every screen.
              <span className="topbar-plus-slot" aria-hidden="true" />
            )
          }
        />
        <WalletChip
          variant="gd"
          width={STAR_CHIP_W}
          value={stars ?? walletStars}
          icon={<Stars value={1} max={1} />}
          label={dict.totalStars}
          chipRef={starsRef}
        />
      </span>
    </header>
  );
}

interface WalletChipProps {
  variant: 'cy' | 'gd';
  width: number;
  value: number | CounterTick;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  chipRef?: Ref<HTMLElement>;
  /** A control glued after the chip (the «+»). */
  extra?: ReactNode;
}

function WalletChip({ variant, width, value, icon, label, onClick, chipRef, extra }: WalletChipProps) {
  const tick = typeof value === 'number' ? null : value;
  const shown = tick ? tick.to : value;
  const ticking = tick !== null && tick.from !== tick.to;
  return (
    <span className="topbar-slot">
      <Chip
        variant={variant}
        width={width}
        icon={icon}
        onClick={onClick}
        bump={ticking}
        bumpDelay={tick?.delay}
        chipRef={chipRef}
        aria-label={`${label}: ${shown}`}
        title={label}
      >
        {tick ? <CounterSwap from={formatCount(tick.from)} to={formatCount(tick.to)} active={ticking} delay={tick.delay} /> : formatCount(shown as number)}
      </Chip>
      {extra}
    </span>
  );
}
