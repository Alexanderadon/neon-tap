import { dict, fmt, plural } from '@/shared/i18n';
import { AD_SECONDS, AD_SECONDS_FAST, adsFastFlag } from '@/shared/lib/ads';

/** Seconds the stub ad runs, as text: «бесплатно · 30 секунд» / «реклама · 3 секунды» with `?ads=fast`. */
export function adSecondsText(template: string): string {
  const n = adsFastFlag() ? AD_SECONDS_FAST : AD_SECONDS;
  return fmt(template, { n, noun: plural(n, dict.secondsNoun) });
}
