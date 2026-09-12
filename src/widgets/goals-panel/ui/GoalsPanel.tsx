import { useState } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { CrystalIcon } from '@/shared/ui';
import { GOALS, goalProgress, isGoalDone, useProgress, type Goal, type SaveData } from '@/entities/progress';
import './goals-panel.css';

/**
 * Achievements as a wall of badges: a ring (progress) with the target number inside and the name
 * under it — nothing else. Earned ones glow; tapping a badge shows its description, progress and
 * reward. Ordered "what's next": the next tier of every family first, then earned (newest first),
 * then the far-away tiers.
 */
export function GoalsPanel() {
  const save = useProgress((s) => s);
  const [openId, setOpenId] = useState<string | null>(null);
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
          <Badge key={g.id} goal={g} save={save} open={openId === g.id} onToggle={() => setOpenId((id) => (id === g.id ? null : g.id))} />
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

function Badge({ goal, save, open, onToggle }: { goal: Goal; save: SaveData; open: boolean; onToggle: () => void }) {
  const earned = save.goalsClaimed.includes(goal.id);
  const value = goalProgress(goal, save);
  const ratio = goal.target > 0 ? value / goal.target : 0;
  const cls = ['ach-badge', earned && 'is-earned', open && 'is-open'].filter(Boolean).join(' ');
  return (
    <li className={cls}>
      <button type="button" className="ach-hit" onClick={onToggle} aria-expanded={open} aria-label={`${goal.title}: ${earned ? dict.achEarned : fmt(dict.goalsDone, { done: value, total: goal.target })}`}>
        <span className="ach-ring" style={{ ['--p' as string]: ratio }} aria-hidden="true">
          <span className="ach-target mono">{goal.target}</span>
        </span>
        <span className="ach-name">{goal.title}</span>
      </button>
      {open && (
        <div className="ach-detail" role="note">
          <div>{goal.description}</div>
          <div className="mono">
            {earned ? (
              dict.achEarned
            ) : (
              <>
                {value}/{goal.target} · <CrystalIcon size={10} /> {goal.reward}
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
