import { ru } from './ru';

/** Russian is the only locale for now; the dictionary keeps UI copy out of components. */
export const dict = ru;

type Params = Record<string, string | number>;

/** Interpolate `{name}` placeholders. */
export function fmt(template: string, params: Params): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}

/** Russian plural forms: [1, 2-4, 5+]. */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
