import { useCallback, useEffect, useRef, useState } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { navigate, useRouteParams } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { store } from '@/shared/lib/iap';
import { Avatar, Chip, FrameBody, Icon, ObjButton, Panel, Screen, Stars, SubHeader, Tag, useSwipeBack } from '@/shared/ui';
import { CATALOG, CoverScene, chapterAt, chapterTitle } from '@/entities/track';
import { GOALS, rankIndex, starsForTrack } from '@/entities/progress';
import { useSettings } from '@/entities/settings';
import { avatarArtOf } from '@/entities/avatar';
import { myDuels } from '@/entities/duel';
import type { OfferKind } from '@/entities/offers';
import { TopBar, type CounterTick } from '@/widgets/top-bar';
import { OfferPopups, type OfferWalletTick } from '@/widgets/offer-popups';
import {
  TrackDeck,
  affordableCount,
  focusedTrack,
  initialDeckIndex,
  isCustomCard,
  CUSTOM_CARD,
  trackIndexOf,
  useCatalogState,
  useDeckRadio,
  usePlayTrack,
} from '@/widgets/track-list';
import { GoalsPanel, goalsGotLine } from '@/widgets/goals-panel';
import { DuelList, useMyDuels } from '@/widgets/duel-list';
import { HistoryPanel } from '@/widgets/history-panel';
import { NicknameDialog } from '@/features/submit-score';
import { AvatarPicker } from '@/features/choose-avatar';
import { MenuDock, type Door } from './MenuDock';
import './menu.css';

/** The places of the menu: the deck, and the four full screens that share its top bar, scene and action zone. */
type View = 'deck' | 'profile' | 'records' | 'goals' | 'duels';

const storage = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage);

const VIEWS: readonly View[] = ['deck', 'profile', 'records', 'goals', 'duels'];
/** How long a wallet tick stays on the top bar before it reads the live wallet again (flight + tick + bump). */
const TICK_HOLD_MS = 1400;
const isView = (v: string | undefined): v is View => v !== undefined && (VIEWS as readonly string[]).includes(v);

/**
 * The main screen: top bar · chapter row · the deck · three doors (shop, records, profile) · «ИГРАТЬ»
 * (on the deck's last card, «Своя музыка», the primary is «ВЫБРАТЬ ФАЙЛ» and leads to the custom-song screen).
 * Profile, records, achievements and duels are the same screen with the middle swapped: the
 * focused track's cover tints all of them and the primary button stays «ИГРАТЬ / track». The
 * nickname question and the avatar picker are the overlays (a dialog over the dimmed screen). Other screens open a
 * view or focus a track through the route params (`navigate('menu', { view: 'records', track })`).
 * The offer popups (GDD «Донат») rise here by schedule — the 48-hour deal, the music pack — and
 * the crystal packs open from the wallet's «+».
 */
export function MenuPage() {
  const state = useCatalogState();
  const params = useRouteParams();
  const [index, setIndex] = useState(() => {
    // Back from the custom-song screen: the deck opens on its «Своя музыка» card.
    if (params.track === 'custom') return CUSTOM_CARD;
    const wanted = params.track ? CATALOG.findIndex((t) => t.id === params.track) : -1;
    return wanted >= 0 ? wanted : initialDeckIndex(state, storage());
  });
  const [view, setView] = useState<View>(() => (isView(params.view) ? params.view : 'deck'));
  const [askName, setAskName] = useState(false);
  const [askAvatar, setAskAvatar] = useState(false);
  const { busy, play } = usePlayTrack();
  // The deck's last card is «Своя музыка», not a track: the views that need one show the last track.
  const custom = isCustomCard(index);
  const { track, lock } = focusedTrack(state, index);
  const badge = affordableCount(state);
  // The radio: the focused song, quietly, while the menu is up and no song is being started (silent on the custom card).
  useDeckRadio(custom ? undefined : track.id, busy === null);

  // Offers: an explicit ask from the wallet's «+», and the wallet tick after a purchase (the crystals fly into the chip).
  const [offer, setOffer] = useState<OfferKind | null>(null);
  const [tick, setTick] = useState<CounterTick | null>(null);
  const crystalsRef = useRef<HTMLElement>(null);
  const offerHandled = useCallback(() => setOffer(null), []);
  const onWalletTick = useCallback((t: OfferWalletTick) => setTick(t), []);
  const topUp = useCallback(() => {
    sfxUi();
    setOffer('crystals');
  }, []);
  useEffect(() => {
    if (!tick) return;
    const id = window.setTimeout(() => setTick(null), (tick.delay ?? 0) * 1000 + TICK_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [tick]);

  const goTo = useCallback((v: View) => {
    sfxUi();
    setView(v);
  }, []);
  const back = useCallback(() => setView((v) => (v === 'goals' || v === 'duels' ? 'profile' : 'deck')), []);
  // Asleep while a dialog is up: its own back gesture closes it, and must not also leave the view.
  useSwipeBack(back, view !== 'deck' && !askName && !askAvatar && offer === null);
  useEffect(() => {
    if (view === 'deck') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && back();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, back]);

  const open = (screen: 'shop' | 'settings' | 'tutorial' | 'custom') => {
    sfxUi();
    navigate(screen);
  };
  /** The primary action: play `id` (a duel's track) or the focused card — the custom card opens the custom-song screen. */
  const onPlay = (id?: string) => {
    if (busy) return;
    if (id === undefined && custom) {
      open('custom');
      return;
    }
    sfxUi();
    const target = id ?? track.id;
    const l = target === track.id ? lock : null;
    if (l?.locked) {
      if (l.premium) navigate('shop');
      return;
    }
    void play(target);
  };

  const shopDoor: Door = { key: 'shop', badge, onTap: () => open('shop') };
  const doors: Record<View, readonly [Door, Door, Door]> = {
    deck: [shopDoor, { key: 'records', onTap: () => goTo('records') }, { key: 'profile', onTap: () => goTo('profile') }],
    profile: [shopDoor, { key: 'records', onTap: () => goTo('records') }, { key: 'menu', onTap: () => goTo('deck') }],
    records: [shopDoor, { key: 'menu', onTap: () => goTo('deck') }, { key: 'profile', onTap: () => goTo('profile') }],
    goals: [shopDoor, { key: 'menu', onTap: () => goTo('deck') }, { key: 'profile', onTap: () => goTo('profile') }],
    duels: [shopDoor, { key: 'menu', onTap: () => goTo('deck') }, { key: 'profile', onTap: () => goTo('profile') }],
  };

  const chapter = chapterAt(trackIndexOf(index)) ?? { start: 0, end: CATALOG.length, number: 1 };
  const chapterTracks = CATALOG.slice(chapter.start, chapter.end);
  const chapterDone = chapterTracks.filter((t) => starsForTrack(state.save.tracks[t.id]) > 0).length;
  const chapterLine = `${chapterTitle(chapter)} · ${fmt(dict.deckChapterProgress, { done: chapterDone, total: chapterTracks.length })}`;

  return (
    <Screen frame className="menu">
      <CoverScene id={custom ? undefined : track.id} genre={custom ? undefined : track.genre} />
      <TopBar onCrystalsTap={() => open('shop')} onTopUp={store.available() ? topUp : undefined} crystalsRef={crystalsRef} crystals={tick ?? undefined} />

      {view === 'deck' && <TrackDeck index={index} onIndexChange={setIndex} onPlay={() => onPlay()} />}

      {view === 'profile' && (
        <>
          <SubHeader tag={<Tag>{dict.profile}</Tag>} text={chapterLine} />
          <FrameBody scroll>
            <ProfileView
              onNickname={() => setAskName(true)}
              onAvatar={() => setAskAvatar(true)}
              onGoals={() => goTo('goals')}
              onDuels={() => goTo('duels')}
              onOpen={open}
            />
          </FrameBody>
        </>
      )}

      {view === 'records' && (
        <>
          <SubHeader center>
            <b>{track.title}</b>
            <span>·</span>
            {chapterTitle(chapter)}
          </SubHeader>
          <FrameBody scroll>
            <HistoryPanel trackId={track.id} />
          </FrameBody>
        </>
      )}

      {view === 'goals' && (
        <>
          <SubHeader tag={<Tag>{dict.goalsTitle}</Tag>} text={goalsGotLine(state.save.goalsClaimed)} />
          <FrameBody scroll>
            <GoalsPanel />
          </FrameBody>
        </>
      )}

      {view === 'duels' && <DuelsView onPlay={onPlay} />}

      <MenuDock doors={doors[view]} track={track} lock={lock} custom={custom} stars={state.stars} busy={busy !== null} onPlay={() => onPlay()} />

      <NicknameDialog open={askName} onSkip={() => setAskName(false)} />
      <AvatarPicker open={askAvatar} onClose={() => setAskAvatar(false)} />
      <OfferPopups auto request={offer} onRequestHandled={offerHandled} crystalsRef={crystalsRef} onWalletTick={onWalletTick} />
    </Screen>
  );
}

interface ProfileProps {
  onNickname: () => void;
  onAvatar: () => void;
  onGoals: () => void;
  onDuels: () => void;
  onOpen: (screen: 'settings' | 'tutorial' | 'custom') => void;
}

/** Profile: the player card (tap → nickname), the avatar row (tap → the picker), five wide doors, the licenses line. */
function ProfileView({ onNickname, onAvatar, onGoals, onDuels, onOpen }: ProfileProps) {
  const state = useCatalogState();
  const nickname = useSettings((s) => s.nickname);
  const avatar = useSettings((s) => s.avatar);
  const art = avatarArtOf(avatar);
  const tutorialDone = useSettings((s) => s.tutorialDone);
  const bests = Object.values(state.save.tracks);
  const passed = bests.filter((b) => starsForTrack(b) > 0).length;
  const rankS = bests.filter((b) => rankIndex(b.rank) >= rankIndex('S')).length;
  const combo = state.save.counters.maxCombo;
  const claimed = state.save.goalsClaimed.length;
  const duelsCount = myDuels().length;
  return (
    <div className="profile">
      <Panel className="profile-card" onPress={onNickname} aria-label={dict.profileCardAria}>
        <span className="profile-who">
          <Avatar name={nickname} size={48} art={art} />
          <span className="profile-two">
            <b className="profile-name">{nickname || dict.you}</b>
            <small className="profile-hint">{dict.nicknameFor}</small>
          </span>
          <Icon name="chevron" size={20} className="profile-chev" />
        </span>
        <span className="profile-stats">
          <span>
            {dict.passedShort}{' '}
            <b>
              {passed} / {CATALOG.length}
            </b>
          </span>
          <span>
            {dict.rankSShort} <b>{rankS}</b>
          </span>
          <span>
            {dict.comboShort} <b>{combo}</b>
          </span>
        </span>
      </Panel>
      <div className="profile-doors">
        <ObjButton
          wide
          icon={<Icon name="user" />}
          label={dict.avatarRow}
          onClick={onAvatar}
          aria-label={dict.avatarPickAria}
          end={
            <span className="profile-ava-end">
              <Avatar name={nickname} art={art} />
              <Icon name="chevron" />
            </span>
          }
        />
        <ObjButton
          wide
          icon={<Icon name="trophy" />}
          label={dict.goalsTitle}
          onClick={onGoals}
          end={
            <Chip variant="gd" icon={<Stars value={1} max={1} />}>
              {claimed} / {GOALS.length}
            </Chip>
          }
        />
        <ObjButton wide icon={<Icon name="duel" />} label={dict.duelsTitle} onClick={onDuels} end={<Chip>{duelsCount}</Chip>} />
        <ObjButton wide icon={<Icon name="note" />} label={dict.customSong} onClick={() => onOpen('custom')} end={<Icon name="chevron" />} />
        <ObjButton
          wide
          icon={<Icon name="book" />}
          label={dict.tutorial}
          onClick={() => onOpen('tutorial')}
          end={tutorialDone ? <Tag>{dict.passedShort}</Tag> : <Tag variant="dark">{dict.notPassedShort}</Tag>}
        />
        <ObjButton wide icon={<Icon name="sliders" />} label={dict.settings} onClick={() => onOpen('settings')} end={<Icon name="chevron" />} />
      </div>
      <a className="profile-foot" href={`${import.meta.env.BASE_URL}music/LICENSES.md`} target="_blank" rel="noreferrer">
        {dict.licenses}
      </a>
    </div>
  );
}

/** My duels: the sub-header counts calls and answers; the list is the widget's. */
function DuelsView({ onPlay }: { onPlay: (trackId: string) => void }) {
  const duels = useMyDuels();
  const { calls, answers } = duels.summary;
  const line =
    calls === 0 ? (
      dict.duelsNone
    ) : (
      <>
        <b>{calls}</b> {plural(calls, dict.duelCallNoun)} · <b>{answers}</b> {plural(answers, dict.duelAnswerNoun)}
      </>
    );
  return (
    <>
      <SubHeader tag={<Tag>{dict.duelsTitle}</Tag>} text={line} />
      <FrameBody scroll>
        <DuelList state={duels} onPlay={onPlay} />
      </FrameBody>
    </>
  );
}
