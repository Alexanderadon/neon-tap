import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { Screen } from '@/shared/ui';
import { SongDropZone } from '@/widgets/song-drop-zone';
import { TopBar } from '@/widgets/top-bar';
import './custom-page.css';

/** «Своя музыка»: the top bar and the one-card screen of SongDropZone (screens-game.html, frames 16–19). */
export function CustomSongPage() {
  return (
    <Screen frame className="customp">
      <TopBar />
      <SongDropZone
        onBack={() => {
          sfxUi();
          navigate('menu');
        }}
      />
    </Screen>
  );
}
