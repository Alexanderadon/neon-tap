import { dict, fmt } from '@/shared/i18n';
import { formatScore } from '@/shared/lib/format';
import { Icon, ListRow, ObjButton, PlaceChip, SegmentsPulse, StatePanel, Tag } from '@/shared/ui';
import { useSettings } from '@/entities/settings';
import type { ChartSource } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';
import { NicknameDialog, useSubmitScore } from '@/features/submit-score';
import './online.css';

const SHOW = 10;

interface Props {
  result: PlayResult;
  source: ChartSource;
}

/**
 * «Онлайн-рекорды» on the result screen («Подробнее»): the people above and below me as list
 * rows (place chip · name · score, my row with the cyan rim) and «ТВОЁ МЕСТО: N». Accuracy and
 * rank are not repeated here — they live in the score panel. Loading / nobody / a failed post are
 * one state panel; the failed post adds «Повторить». Hidden entirely when the backend is off.
 */
export function OnlineLeaderboard({ result, source }: Props) {
  const { status, top, position, improved, skipNickname, retry } = useSubmitScore(result, source);
  const nickname = useSettings((s) => s.nickname);
  const debug = useSettings((s) => s.debugOverlay);

  if (status === 'idle' || status === 'probing') return null;
  if (status === 'disabled') return debug ? <div className="online-debug">{dict.onlineDisabledHint}</div> : null;

  const me = nickname.toLocaleLowerCase();
  const rows = top.slice(0, SHOW);
  const meInTop = rows.some((e) => e.name.toLocaleLowerCase() === me);
  const waiting = status === 'need-name' || status === 'submitting';

  return (
    <>
      <section className="online" aria-live="polite" aria-label={dict.onlineRecords}>
        {waiting && <StatePanel icon={<SegmentsPulse />}>{dict.onlineLoading}</StatePanel>}
        {!waiting && rows.length === 0 && <StatePanel icon={<Icon name="trophy" size={32} />}>{dict.onlineEmpty}</StatePanel>}
        {!waiting && rows.length > 0 && (
          <ol className="online-list">
            {rows.map((e, i) => (
              <ListRow
                key={`${e.name}-${i}`}
                lead={<PlaceChip place={i + 1} />}
                name={e.name}
                score={formatScore(e.score)}
                me={!!me && e.name.toLocaleLowerCase() === me}
              />
            ))}
            {!meInTop && position !== null && me && <ListRow lead={<PlaceChip place={position} />} name={nickname} score={formatScore(result.score)} me />}
          </ol>
        )}
        {!waiting && position !== null && (
          <div className="online-place">
            <Tag variant="dark" shine={status === 'done' && improved}>
              {fmt(dict.onlineYourPlace, { n: position })}
            </Tag>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            role="alert"
            icon={<Icon name="cloud-off" size={32} />}
            action={<ObjButton wide icon={<Icon name="retry" />} label={dict.onlineRetry} onClick={retry} />}
          >
            {dict.onlineSubmitFailed}
          </StatePanel>
        )}
      </section>
      <NicknameDialog open={status === 'need-name'} onSkip={skipNickname} />
    </>
  );
}
