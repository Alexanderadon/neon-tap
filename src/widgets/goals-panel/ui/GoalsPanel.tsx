import { dict, fmt } from '@/shared/i18n';
import { CrystalIcon } from '@/shared/ui';
import { GOALS, goalProgress, isGoalDone, useProgress, type Goal, type SaveData } from '@/entities/progress';
import './goals-panel.css';

/**
 * Achievements as a wall of badges: earned ones glow, the rest are grey with a progress ring.
 * Ordered so the wall reads as "what's next": the next tier of every family first, then the
 * earned badges (newest first), then the far-away tiers.
 */
export function GoalsPanel() {
  const save = useProgress((s) => s);
  const done = GOALS.filter((g) => save.goalsClaimed.includes(g.id)).length;
  const ordered = orderForWall(save);

  return (
    <section className="ach" aria-labelledby="ach-title">
      <header className="ach-head">
        <h2 className="ach-title" id="ach-title">
          {dict.goalsTitle}
        </h2>
        <span className="ach-count mono">{fmt(dict.goalsDone, { done, total: GOALS.length })}</span>
      </header>
      <ul className="ach-grid">
        {ordered.map((g) => (
          <Badge key={g.id} goal={g} save={save} />
        ))}
      </ul>
    </section>
  );
}

function orderForWall(save: SaveData): Goal[] {
  const next = new Set<string>();
  for (const g of GOALS) {
    if (!isGoalDone(g, save) && ![...next].some((id) => id.startsWith(g.family + '-'))) next.add(g.id);
  }
  const earned = GOALS.filter((g) => save.goalsClaimed.includes(g.id)).reverse();
  const upcoming = GOALS.filter((g) => next.has(g.id));
  const rest = GOALS.filter((g) => !next.has(g.id) && !save.goalsClaimed.includes(g.id));
  return [...upcoming, ...earned, ...rest];
}

function Badge({ goal, save }: { goal: Goal; save: SaveData }) {
  const earned = save.goalsClaimed.includes(goal.id);
  const value = goalProgress(goal, save);
  const ratio = goal.target > 0 ? value / goal.target : 0;
  const cls = ['ach-badge', earned && 'is-earned'].filter(Boolean).join(' ');
  return (
    <li className={cls} title={goal.description} aria-label={`${goal.title}: ${earned ? dict.achEarned : fmt(dict.goalsDone, { done: value, total: goal.target })}`}>
      <span className="ach-ring" style={{ ['--p' as string]: ratio }} aria-hidden="true">
        <span className="ach-tier mono">{goal.tier}</span>
      </span>
      <span className="ach-name">{goal.title}</span>
      <span className="ach-sub mono">
        {earned ? (
          dict.achEarned
        ) : (
          <>
            {value}/{goal.target} · <CrystalIcon size={9} /> {goal.reward}
          </>
        )}
      </span>
    </li>
  );
}
