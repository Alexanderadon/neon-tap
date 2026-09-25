import { useEffect, useState } from 'react';
import { navigate, useRouteParams } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { dict } from '@/shared/i18n';
import { FrameBody, Screen, SegmentsPulse, StatePanel } from '@/shared/ui';
import { useSongCount, useSongs, type SongsStatus } from '@/entities/custom-song';
import { releaseSongBuffer } from '@/features/play-custom';
import { MyMusic } from '@/widgets/my-music';
import { SongDropZone } from '@/widgets/song-drop-zone';
import { TopBar } from '@/widgets/top-bar';

type View = 'list' | 'add';

/** The view to open: none while the list loads; `add` when asked, with no storage or with no songs; else `list`. */
function pickView(status: SongsStatus, count: number, wanted: string | undefined): View | null {
  if (status === 'loading') return null;
  return wanted === 'add' || status === 'unavailable' || count === 0 ? 'add' : 'list';
}

/**
 * «Моя музыка»: the top bar and one of two views — `list` (the saved songs, MyMusic) or `add` (the
 * one-card screen of SongDropZone, screens-game.html frames 16–19; `navigate('custom', {view:
 * 'add'})`). With no saved songs, or no storage at all, it opens on `add`. The view is chosen once
 * the list has loaded and then kept (saving the first song does not throw the player out of the
 * add view). Opening the screen lets go of the last run's decoded song. The frame scrolls on short viewports.
 */
export function CustomSongPage() {
  const params = useRouteParams();
  const status = useSongs((s) => s.status);
  const count = useSongCount();
  const [view, setView] = useState<View | null>(() => pickView(status, count, params.view));

  useEffect(() => {
    releaseSongBuffer();
  }, []);

  useEffect(() => {
    if (view === null) setView(pickView(status, count, params.view));
  }, [view, status, count, params.view]);

  const toDeck = () => {
    sfxUi();
    navigate('menu', { track: 'custom' });
  };

  return (
    <Screen frame>
      <TopBar />
      {view === null && (
        <FrameBody>
          <StatePanel icon={<SegmentsPulse />}>{dict.loading}</StatePanel>
        </FrameBody>
      )}
      {view === 'list' && <MyMusic onBack={toDeck} onAdd={() => navigate('custom', { view: 'add' })} freeMode={params.mode === 'free'} />}
      {view === 'add' && (
        <SongDropZone
          onBack={() => {
            if (count === 0) return toDeck();
            sfxUi();
            navigate('custom', { view: 'list' });
          }}
          onFreeSpace={() => navigate('custom', { view: 'list', mode: 'free' })}
        />
      )}
    </Screen>
  );
}
