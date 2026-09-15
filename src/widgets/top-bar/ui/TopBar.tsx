import type { ReactNode, Ref } from 'react';
import { dict } from '@/shared/i18n';
import { Chip, CounterSwap, CrystalIcon, Stars } from '@/shared/ui';
import { useSettings } from '@/entities/settings';
import { grandTotalStars, useProgress } from '@/entities/progress';
import { TRACK_IDS } from '@/entities/track';
import { formatCount, formatDelta } from '../lib/formatCount';
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
  /** Small "+35" / "+2" badges next to the chips (a reward just earned). */
  crystalsDelta?: number;
  starsDelta?: number;
  /** Tap on the crystal chip (the menu and profile open the shop). */
  onCrystalsTap?: () => void;
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
 * The top bar, identical on every non-game screen: avatar letter + name on the left, the crystal
 * and star chips on the right. Reads the nickname and the wallet itself; the result screen passes
 * `from → to` ticks and delta badges so the counters visibly grow after the loot flies in.
 */
export function TopBar({ crystals, stars, crystalsDelta, starsDelta, onCrystalsTap, crystalsRef, starsRef, variant = 'player', left, className }: Props) {
  const nickname = useSettings((s) => s.nickname);
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
  const letter = nickname ? nickname.trim().charAt(0).toUpperCase() : '?';
  return (
    <header className={cls}>
      <span className="topbar-who">
        {left ?? (
          <>
            <span className={nickname ? 'ava' : 'ava ava-q'} aria-hidden="true">
              {letter}
            </span>
            <span className="topbar-name">{name}</span>
          </>
        )}
      </span>
      <span className="topbar-wallet">
        <WalletChip
          variant="cy"
          width={CRYSTAL_CHIP_W}
          value={crystals ?? walletCrystals}
          delta={crystalsDelta}
          icon={<CrystalIcon size={16} halo />}
          label={dict.crystalsTitle}
          onClick={onCrystalsTap}
          chipRef={crystalsRef}
        />
        <WalletChip
          variant="gd"
          width={STAR_CHIP_W}
          value={stars ?? walletStars}
          delta={starsDelta}
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
  delta?: number;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  chipRef?: Ref<HTMLElement>;
}

function WalletChip({ variant, width, value, delta, icon, label, onClick, chipRef }: WalletChipProps) {
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
      {delta !== undefined && delta !== 0 && (
        <i className="topbar-delta" aria-hidden="true">
          {formatDelta(delta)}
        </i>
      )}
    </span>
  );
}
