import { dict, fmt } from '@/shared/i18n';
import { FamilyIcon, findGoal } from '@/entities/progress';

/**
 * Achievements this run completed, as one row of gold coins: the family glyph in a ring and the
 * tier number — the same badge as on the wall, no sentences. The name is the tooltip / label.
 */
export function EarnedBadges({ ids }: { ids: readonly string[] }) {
  const goals = ids.map((id) => findGoal(id)).filter((g): g is NonNullable<typeof g> => !!g);
  if (goals.length === 0) return null;
  return (
    <ul className="result-badges" aria-label={dict.resultBadges}>
      {goals.map((g, i) => (
        <li
          key={g.id}
          className="result-badge"
          style={{ animationDelay: `${1.5 + i * 0.12}s` }}
          title={fmt(dict.goalCompleted, { title: g.title })}
          aria-label={g.title}
        >
          <span className="result-badge-ring" aria-hidden="true">
            <FamilyIcon family={g.family} size={18} />
          </span>
          <span className="result-badge-n mono">{g.target}</span>
        </li>
      ))}
    </ul>
  );
}
