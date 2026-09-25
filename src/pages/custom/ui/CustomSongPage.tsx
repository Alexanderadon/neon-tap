import { useEffect, useState } from 'react';
import { navigate, useRouteParams } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { Screen } from '@/shared/ui';
import { useSongCount, useSongs } from '@/entities/custom-song';
import { releaseSongBuffer } from '@/features/play-custom';
import { MyMusic } from '@/widgets/my-music';
import { SongDropZone } from '@/widgets/song-drop-zone';
import { TopBar } from '@/widgets/top-bar';

type View = 'list' | 'add';

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
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    releaseSongBuffer();
  }, []);

  useEffect(() => {
    if (view !== null || status === 'loading') return;
    setView(params.view === 'add' || status === 'unavailable' || count === 0 ? 'add' : 'list');
  }, [view, status, count, params.view]);

  const toDeck = () => {
    sfxUi();
    navigate('menu', { track: 'custom' });
  };

  return (
    <Screen frame>
      <TopBar />
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
