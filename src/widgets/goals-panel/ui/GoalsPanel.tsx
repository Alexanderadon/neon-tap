import { dict, fmt } from '@/shared/i18n';
import { Segments, Stars, segmentStates } from '@/shared/ui';
import { FamilyIcon, useProgress } from '@/entities/progress';
import { familyLadders, orderLadders, type FamilyLadder } from '../model/families';
import { CalendarStrip } from './CalendarStrip';
import './goals-panel.css';

/**
 * The login calendar strip on top, then the achievements as 15 ladders, one row per family,
 * closest next tier first: a ring with the family glyph, the name of the next tier, «64 / 100»,
 * and one segment per tier (earned gold, current cyan, the rest grey). A complete family turns its
 * ring gold and says «получено».
 */
export function GoalsPanel() {
  const save = useProgress((s) => s);
  const ladders = orderLadders(familyLadders(save));
  return (
    <>
      <CalendarStrip />
      <ul className="goals" aria-label={dict.goalsTitle}>
        {ladders.map((l) => (
          <GoalRow key={l.family} ladder={l} />
        ))}
      </ul>
    </>
  );
}

function GoalRow({ ladder }: { ladder: FamilyLadder }) {
  const complete = ladder.next === undefined;
  const title = (ladder.next ?? ladder.tiers[ladder.tiers.length - 1]).title;
  const label = complete ? `${title}: ${dict.achEarned}` : `${title}: ${ladder.value} / ${ladder.target}`;
  return (
    <li className={complete ? 'goal goal-done' : 'goal'} aria-label={label}>
      <span className="goal-ring" aria-hidden="true">
        <FamilyIcon family={ladder.family} size={20} />
      </span>
      <span className="goal-body">
        <span className="goal-row">
          <span className="goal-title">{title}</span>
          {complete ? (
            <span className="goal-n goal-got">
              <Stars value={1} max={1} />
              {dict.achEarned}
            </span>
          ) : (
            <span className="goal-n">
              <b>{ladder.value}</b> / {ladder.target}
            </span>
          )}
        </span>
        <Segments
          states={segmentStates(ladder.tiers.length, ladder.done)}
          aria-label={fmt(dict.goalLevelsAria, { n: ladder.done, total: ladder.tiers.length })}
        />
      </span>
    </li>
  );
}
