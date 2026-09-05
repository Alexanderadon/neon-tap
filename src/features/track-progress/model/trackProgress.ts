import type { SpellKind } from '@/shared/types/chart';
import { recordSpell } from '@/entities/progress';

/**
 * Mid-run progression hooks (the finish event goes through `features/save-result`).
 * A caught spell counts toward the goals on any song, even if the run later fails.
 */
export function trackSpell(kind: SpellKind): void {
  recordSpell(kind);
}
