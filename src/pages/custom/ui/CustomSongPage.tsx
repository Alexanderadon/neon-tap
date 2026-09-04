import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Button, Screen } from '@/shared/ui';
import { SongDropZone } from '@/widgets/song-drop-zone';
import '../../page.css';

export function CustomSongPage() {
  return (
    <Screen center>
      <h1 className="page-title">{dict.customTitle}</h1>
      <p className="page-intro">{dict.customIntro}</p>
      <SongDropZone />
      <Button variant="ghost" onClick={() => navigate('menu')}>
        {dict.back}
      </Button>
    </Screen>
  );
}
