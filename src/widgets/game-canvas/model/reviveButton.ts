import { dict } from '@/shared/i18n';
import type { IconName } from '@/shared/ui';

/** The second-chance frame's primary button in one state. */
export interface ReviveButton {
  label: string;
  sub: string;
  /** The icon in the left disc. */
  icon: IconName;
  /** Waiting while the ad plays: dark face, no beat, no tap. */
  locked: boolean;
}

/**
 * The primary button of the second chance. Without NEON PASS it says it is an ad and what it gives
 * before anything plays (Yandex Games 4.5.1: a rewarded ad is never a surprise) — «СМОТРЕТЬ / рекламу
 * · +5 сердец»; with PASS it is free and plays nothing — «ПРОДОЛЖИТЬ / бесплатно с PASS». While
 * the ad plays it waits: «РЕКЛАМА / сердца после ролика».
 */
export function reviveButton(phase: 'offer' | 'ad', pass: boolean): ReviveButton {
  if (phase === 'ad') return { label: dict.reviveAdPlaying, sub: dict.reviveAdPlayingSub, icon: 'hourglass', locked: true };
  return pass
    ? { label: dict.continue, sub: dict.reviveFreePass, icon: 'tray', locked: false }
    : { label: dict.reviveWatchAd, sub: dict.reviveWatchAdSub, icon: 'ad', locked: false };
}
