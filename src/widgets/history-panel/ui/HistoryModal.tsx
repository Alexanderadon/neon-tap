import { dict } from '@/shared/i18n';
import { Modal } from '@/shared/ui';
import { HistoryPanel } from './HistoryPanel';

interface Props {
  /** Track to show; null = closed. */
  track: { id: string; title: string } | null;
  onClose: () => void;
}

/** Slide-over with the attempt history of one track (opened from the track card). */
export function HistoryModal({ track, onClose }: Props) {
  return (
    <Modal open={track !== null} title={track ? `${dict.records} · ${track.title}` : dict.records} onClose={onClose} closeLabel={dict.recordsClose}>
      {track && <HistoryPanel trackId={track.id} />}
    </Modal>
  );
}
