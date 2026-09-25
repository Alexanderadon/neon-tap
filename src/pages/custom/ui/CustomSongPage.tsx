import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { Screen } from '@/shared/ui';
import { SongDropZone } from '@/widgets/song-drop-zone';
import { TopBar } from '@/widgets/top-bar';

/** «Своя музыка»: the top bar and the one-card screen of SongDropZone (screens-game.html, frames 16–19). The frame scrolls on short viewports. */
export function CustomSongPage() {
  return (
    <Screen frame>
      <TopBar />
      <SongDropZone
        onBack={() => {
          sfxUi();
          navigate('menu', { track: 'custom' });
        }}
      />
    </Screen>
  );
}
