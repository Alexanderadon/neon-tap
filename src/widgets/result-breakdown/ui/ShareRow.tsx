import { useEffect, useRef, useState } from 'react';
import { dict } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { copySummary, shareResultCard, type ShareCardData } from '../lib/shareCard';

interface Props {
  data: ShareCardData;
  fileName: string;
}

type Status = 'idle' | 'busy' | 'copied' | 'failed';

/** "Share" (PNG card via the share sheet or a download) and "Copy" (text summary to the clipboard). */
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
      <Button
        onClick={() => {
          void share();
        }}
        disabled={status === 'busy'}
      >
        {dict.share}
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          void copy();
        }}
      >
        {dict.copy}
      </Button>
      <span className={`result-share-status${status === 'failed' ? ' is-error' : ''}`} aria-live="polite">
        {status === 'copied' ? dict.copied : status === 'failed' ? dict.shareFailed : ''}
      </span>
    </div>
  );
}
