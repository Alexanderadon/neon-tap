import { dict, fmt } from '@/shared/i18n';
import { CrystalIcon, Line, Segments, segmentStates } from '@/shared/ui';
import { CALENDAR_REWARDS, FamilyIcon, calendarView, localDateString, useProgress } from '@/entities/progress';

/**
 * The login calendar on the achievements screen: seven marks in a loop (5 · 5 · 10 · 10 · 15 · 15 ·
 * 30 crystals), the ones made gold, the next one cyan, its crystals on the right — or «сегодня
 * отмечено» once today's first passed run made its mark. A missed day resets nothing, so there is
 * nothing to hurry for: no countdown, no warning.
 */
export function CalendarStrip() {
  const calendar = useProgress((s) => s.calendar);
  const view = calendarView(calendar, localDateString());
  const total = CALENDAR_REWARDS.length;
  const states = segmentStates(total, view.today ? -1 : view.next, view.done);
  const aria = fmt(dict.calendarAria, { done: view.done, total, rewards: CALENDAR_REWARDS.join(', ') });
  return (
    <section className="goals-cal" aria-label={aria}>
      <div className="goal goal-cal">
        <span className="goal-ring" aria-hidden="true">
          <FamilyIcon family="daily" size={20} />
        </span>
        <span className="goal-body">
          <span className="goal-row">
            <span className="goal-title">{dict.calendarTitle}</span>
            {view.today ? (
              <span className="goal-n">{dict.calendarToday}</span>
            ) : (
              <span className="goal-n goal-cal-next">
                <CrystalIcon size={16} />
                {fmt(dict.calendarNext, { n: CALENDAR_REWARDS[view.next] })}
              </span>
            )}
          </span>
          <Segments states={states} />
          <span className="goal-cal-rewards" aria-hidden="true">
            {CALENDAR_REWARDS.map((reward, i) => (
              <span
                key={i}
                className={states[i] === 'done' ? 'goal-cal-r goal-cal-r-done' : states[i] === 'current' ? 'goal-cal-r goal-cal-r-cur' : 'goal-cal-r'}
              >
                {reward}
              </span>
            ))}
          </span>
        </span>
      </div>
      <Line className="goals-cal-hint">{dict.calendarHint}</Line>
    </section>
  );
}
