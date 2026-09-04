import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Button, Screen } from '@/shared/ui';
import { SettingsPanel } from '@/widgets/settings-panel';
import '../../page.css';

export function SettingsPage() {
  return (
    <Screen center>
      <h1 className="page-title">{dict.settings}</h1>
      <SettingsPanel />
      <div className="page-hotkeys">{dict.hotkeys}</div>
      <Button variant="ghost" onClick={() => navigate('menu')}>
        {dict.back}
      </Button>
    </Screen>
  );
}
