import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Button, Screen } from '@/shared/ui';
import { markWelcomeSkipped } from '@/entities/settings';
import { NicknameForm } from '@/features/submit-score';
import '../../page.css';

/** First launch: the player's name, before calibration. The menu re-checks and routes onward. */
export function WelcomePage() {
  const next = () => navigate('menu');
  const skip = () => {
    markWelcomeSkipped();
    next();
  };
  return (
    <Screen center>
      <h1 className="page-title">{dict.welcomeTitle}</h1>
      <p className="page-lead">{dict.welcomeLead}</p>
      <NicknameForm
        onSaved={next}
        hint={dict.welcomeHint}
        secondary={
          <Button type="button" variant="ghost" onClick={skip}>
            {dict.nicknameSkip}
          </Button>
        }
      />
    </Screen>
  );
}
