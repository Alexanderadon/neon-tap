/**
 * The game's clock for calendar logic (the weekly drop, the daily crystal allowance, the login
 * calendar). One seam: today it is the device clock; the Yandex build can switch it to the
 * platform's server time without touching the callers.
 */
export function now(): number {
  return Date.now();
}
