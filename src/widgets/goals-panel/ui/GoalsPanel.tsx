import { useState } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { ProgressBar } from '@/shared/ui';
import { TRACK_IDS } from '@/entities/track';
import { GOALS, goalProgress, grandTotalStars, useProgress, type Goal, type SaveData } from '@/entities/progress';
import './goals-panel.css';

const OPEN_KEY = 'neon-tap:goals-open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Collapsible quest list under the menu header; the header shows every star incl. bonuses. */
export function GoalsPanel() {
  const save = useProgress((s) => s);
  const [open, setOpen] = useState(readOpen);
  const stars = grandTotalStars(save, TRACK_IDS);
  const done = GOALS.filter((g) => save.goalsClaimed.includes(g.id)).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <section className={`goals ${open ? 'goals-open' : ''}`}>
      <button type="button" className="goals-head" onClick={toggle} aria-expanded={open}>
        <span className="goals-title">{dict.goalsTitle}</span>
        <span className="goals-count">{fmt(dict.goalsDone, { done, total: GOALS.length })}</span>
        <span className="goals-stars">★ {stars}</span>
        <span className="goals-toggle">{open ? dict.goalsHide : dict.goalsShow}</span>
      </button>
      {open && (
        <ul className="goals-list">
          {GOALS.map((g) => (
            <GoalRow key={g.id} goal={g} save={save} />
          ))}
        </ul>
      )}
    </section>
  );
}

function GoalRow({ goal, save }: { goal: Goal; save: SaveData }) {
  const claimed = save.goalsClaimed.includes(goal.id);
  const progress = claimed ? goal.target : goalProgress(goal, save);
  return (
    <li className={`goal ${claimed ? 'goal-done' : ''}`}>
      <div className="goal-mark" aria-hidden="true">
        {claimed ? '✓' : ''}
      </div>
      <div className="goal-body">
        <div className="goal-title">{goal.title}</div>
        <div className="goal-desc">{goal.description}</div>
        <ProgressBar value={progress / goal.target} color={claimed ? '#ffd700' : '#00f0ff'} />
      </div>
      <div className="goal-side">
        <span className="goal-progress">
          {progress} / {goal.target}
        </span>
        <span className="goal-reward">{fmt(dict.goalReward, { n: goal.reward })}</span>
      </div>
    </li>
  );
}
