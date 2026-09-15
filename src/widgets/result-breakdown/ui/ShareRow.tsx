import { useEffect, useRef, useState } from 'react';
import { dict } from '@/shared/i18n';
import { Icon, ObjButton } from '@/shared/ui';
import { copySummary, shareResultCard, type ShareCardData } from '../lib/shareCard';

interface Props {
  data: ShareCardData;
  fileName: string;
}

type Status = 'idle' | 'busy' | 'copied' | 'failed';

/** "Share" (PNG card via the share sheet or a download) and "Copy" (text summary to the clipboard) — two object buttons. */
export function ShareRow({ data, fileName }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = (s: Status) => {
    setStatus(s);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus('idle'), 2200);
  };

  const share = async () => {
    if (status === 'busy') return;
    setStatus('busy');
    try {
      await shareResultCard(data, fileName);
      setStatus('idle');
    } catch {
      flash('failed');
    }
  };

  const copy = async () => {
    flash((await copySummary(data)) ? 'copied' : 'failed');
  };

  return (
    <div className="result-share">
      <ObjButton icon={<Icon name="tray" />} label={dict.share} onClick={() => void share()} disabled={status === 'busy'} />
      <ObjButton icon={<Icon name="file" />} label={status === 'copied' ? dict.copied : dict.copy} onClick={() => void copy()} />
      <span className={`result-share-status${status === 'failed' ? ' is-error' : ''}`} aria-live="polite">
        {status === 'failed' ? dict.shareFailed : ''}
      </span>
    </div>
  );
}
