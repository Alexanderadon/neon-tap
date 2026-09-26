import { useCallback, useEffect, useRef, useState } from 'react';
import { dict } from '@/shared/i18n';
import { navigate, type Screen } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { ActionZone, Disc, Frame, Icon, Line, ObjButton, PrimaryAction, SubHeader, Tag, Trio, useSwipeBack } from '@/shared/ui';
import { CoverScene, TRACK_IDS, findTrack } from '@/entities/track';
import { dailyTrackId, localDateString } from '@/entities/progress';
import { TopBar } from '@/widgets/top-bar';
import { ResetDialog, SettingsPanel } from '@/widgets/settings-panel';
import './settings-page.css';

const toMenu = () => navigate('menu');

/** «Подстройка» remembers it was opened from here: saved or skipped, it comes back to the settings. */
const toCalibration = () => {
  sfxUi();
  navigate('calibration', { from: 'settings' });
};

/**
 * Settings (screens-onboard C6): the top bar, «НАСТРОЙКИ · применяется сразу», the scrolling column
 * of panels with a 32 px fade at both ends (the latency screen is its wide «Подстройка» row — the
 * word does not fit a trio cell), and the action zone — Профиль · Обучение · Сброс over «ГОТОВО /
 * в меню» (the settings are opened from the profile). The reset opens the dialog instead of a system confirm.
 */
export function SettingsPage() {
  useSwipeBack(toMenu);
  const [reset, setReset] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ up: false, down: false });
  // Fades only where there is more to scroll: measured on scroll, resize and after the first layout.
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const up = el.scrollTop > 1;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setMore((m) => (m.up === up && m.down === down ? m : { up, down }));
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  const daily = dailyTrackId(localDateString(), TRACK_IDS) ?? undefined;
  const go = (screen: Screen) => () => {
    sfxUi();
    navigate(screen);
  };
  return (
    <Frame className="settings-page">
      <CoverScene id={daily} genre={daily ? findTrack(daily)?.genre : undefined} />
      <TopBar />
      <SubHeader tag={<Tag>{dict.settings}</Tag>}>
        <Line className="sub-right">{dict.appliesNow}</Line>
      </SubHeader>
      <div className={['settings-scroll', more.up && 'is-more-up', more.down && 'is-more-down'].filter(Boolean).join(' ')}>
        <div ref={scrollRef} className="settings-scroll-in" onScroll={measure}>
          <SettingsPanel onCalibrate={toCalibration} />
        </div>
      </div>
      <ActionZone className="settings-actions">
        <Trio>
          <ObjButton
            icon={<Icon name="user" />}
            label={dict.profile}
            onClick={() => {
              sfxUi();
              navigate('menu', { view: 'profile' });
            }}
          />
          <ObjButton icon={<Icon name="cap" />} label={dict.tutorial} onClick={go('tutorial')} />
          <ObjButton
            danger
            icon={<Icon name="trash" />}
            label={dict.resetShort}
            onClick={() => {
              sfxUi();
              setReset(true);
            }}
          />
        </Trio>
        <PrimaryAction
          lead={
            <Disc>
              <Icon name="check" />
            </Disc>
          }
          label={dict.done}
          sub={dict.toMenuShort}
          beat={!reset}
          onClick={go('menu')}
        />
      </ActionZone>
      <ResetDialog open={reset} onClose={() => setReset(false)} />
    </Frame>
  );
}
