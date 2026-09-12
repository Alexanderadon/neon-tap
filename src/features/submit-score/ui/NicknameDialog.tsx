import { dict } from '@/shared/i18n';
import { Button, Modal } from '@/shared/ui';
import { NicknameForm } from './NicknameForm';

interface Props {
  open: boolean;
  /** "Not now" — remembered for the session. */
  onSkip: () => void;
}

/** Nickname prompt on the result screen for players who skipped it at the welcome step. */
export function NicknameDialog({ open, onSkip }: Props) {
  return (
    <Modal open={open} title={dict.nicknameTitle} onClose={onSkip} closeLabel={dict.nicknameSkip} variant="dialog">
      <NicknameForm
        onSaved={onSkip}
        secondary={
          <Button type="button" variant="ghost" onClick={onSkip}>
            {dict.nicknameSkip}
          </Button>
        }
      />
    </Modal>
  );
}
