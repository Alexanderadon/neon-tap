import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { ads, isStubAds, stubAds } from '@/shared/lib/ads';
import { audioEngine, loadSong, sfxGem, sfxMilestone, sfxUi } from '@/shared/lib/audio';
import { navigate } from '@/shared/lib/router';
import { now } from '@/shared/lib/time';
import { centreOf } from '@/shared/lib/viewport';
import { unlockAllActive } from '@/shared/config/devFlags';
import type { Genre } from '@/shared/types/chart';
import {
  ActionZone,
  CrystalFlight,
  CrystalIcon,
  Disc,
  Icon,
  ObjButton,
  Panel,
  PrimaryAction,
  SubHeader,
  Tag,
  Thumb,
  Trio,
  useSwipeBack,
  type FlightPath,
} from '@/shared/ui';
import { CATALOG, PREMIUM_IDS, TRACK_IDS, TrackCover, findTrack, loadChart, type TrackMeta } from '@/entities/track';
import { dailyTrackId, grandTotalStars, localDateString, progressStore, useProgress } from '@/entities/progress';
import { isPassActive } from '@/entities/pass';
import { startSession } from '@/entities/play-session';
import { clearActiveDuel } from '@/entities/duel';
import { buyTrackWithCrystals, purchasePaths, purchasePlan, watchAdAndUnlock } from '@/features/buy-track';
import { dropShopItems, shopItems, shopList, stableOrder, type ShopItem } from '../model/shopItems';
import { arrivedSince, readSeenCrystals, writeSeenCrystals } from '../model/seenCrystals';
import { ShopCard, PREVIEW_SEC } from './ShopCard';
import { PurchaseSheet } from './PurchaseSheet';
import { AdScreen } from './AdScreen';
import { AdReward } from './AdReward';
import './shop-grid.css';

/** A wallet counter tick for the top bar: from → to after `delay` seconds (same shape as TopBar's CounterTick). */
export interface WalletTick {
  from: number;
  to: number;
  delay?: number;
}

export interface SceneTrack {
  id: string;
  genre?: Genre;
}

interface Props {
  /** The wallet's crystal chip (TopBar's `crystalsRef`) — the flights land on it. */
  crystalsRef: RefObject<HTMLElement>;
  /** The track whose cover tints the scene: the first card, the one playing, the one being bought. */
  onSceneTrack: (track: SceneTrack | null) => void;
  /** The wallet ticks (a purchase, crystals that arrived since the last visit). */
  onWalletTick: (tick: WalletTick) => void;
  /** «Назад», Escape, the back swipe. */
  onBack: () => void;
  /** The other two doors of the bottom row. */
  onRecords: () => void;
  onProfile: () => void;
  /** A tap on an owned card: open the deck on that track. */
  onTrack: (id: string) => void;
  /** «Пополнить» in the not-enough sheet — opens the crystal packs; absent when purchases are unavailable. */
  onTopUp?: () => void;
}

const TOAST_MS = 2600;
/** A preview starts a third of the way in (past the intro). */
const PREVIEW_AT = 1 / 3;
/** The wallet ticks when the last crystal lands (mockup: .8 s). */
const TICK_DELAY = 0.8;
const TICK_MS = 350;

type View = 'list' | 'ad' | 'reward';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The weekly tracks in the deck (the shop's «Новинки» shelf) and the road without them. */
const DROP_TRACKS = CATALOG.filter((t) => t.drop === true);
const ROAD_TRACKS = CATALOG.filter((t) => t.drop !== true);

/**
 * The shop (package B): the «МАГАЗИН» sub-header, the list of ShopCards — the «Новинки» shelf first
 * (the weekly tracks out now: 150 crystals, or an ad in their first 14 days), then the road and the
 * premium tracks — the bottom action zone, and every state on top of it: the purchase sheet (enough
 * / not enough crystals; the rewarded ad is a way only for a weekly track), the stub's ad frame, the
 * «Трек открыт!» reward, the gold toast, and the crystals flying into the wallet. The page around it
 * draws the scene and the top bar.
 */
export function ShopGrid({ crystalsRef, onSceneTrack, onWalletTick, onBack, onRecords, onProfile, onTrack, onTopUp }: Props) {
  const save = useProgress((s) => s);
  const stars = grandTotalStars(save, TRACK_IDS);
  /**
   * The clock of this visit: a weekly track's ad window does not close under the finger. The same
   * `dropState` as the menu's badge (`forSale`), read at the visit instead of the menu's last save.
   */
  const [nowMs] = useState(now);
  const live = useMemo(
    () =>
      shopList(
        shopItems({ catalog: ROAD_TRACKS, stars, premium: PREMIUM_IDS, purchased: save.purchased }),
        dropShopItems({ drops: DROP_TRACKS, nowMs, purchased: save.purchased, pass: isPassActive(), unlockAll: unlockAllActive() }),
      ),
    [stars, save.purchased, nowMs],
  );
  const orderRef = useRef<string[] | null>(null);
  if (orderRef.current === null) orderRef.current = live.map((i) => i.track.id);
  const order = orderRef.current;
  const items = useMemo(() => stableOrder(live, order), [live, order]);
  const daily = useMemo(() => {
    const id = dailyTrackId(localDateString(), TRACK_IDS);
    return id ? (findTrack(id) ?? null) : null;
  }, []);

  const [view, setView] = useState<View>('list');
  const [sheet, setSheet] = useState<ShopItem | null>(null);
  const [adTrack, setAdTrack] = useState<TrackMeta | null>(null);
  const [rewardTrack, setRewardTrack] = useState<TrackMeta | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flight, setFlight] = useState<FlightPath | null>(null);
  /** The balance the cards still show while a tick is pending (prices recolour with the chip, not before). */
  const [heldBalance, setHeldBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const sheetPrimaryRef = useRef<HTMLDivElement>(null);
  const listPrimaryRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // --- wallet ticks and flights ---
  const launchTick = useCallback(
    (from: number, to: number, origin: { x: number; y: number } | null) => {
      const target = centreOf(crystalsRef.current);
      const fly = origin !== null && target !== null && !reducedMotion();
      const delay = fly ? TICK_DELAY : 0;
      if (fly) setFlight({ from: origin, to: target });
      setHeldBalance(from);
      onWalletTick({ from, to, delay });
      window.setTimeout(
        () => {
          if (mounted.current) setHeldBalance(null);
        },
        delay * 1000 + TICK_MS,
      );
    },
    [crystalsRef, onWalletTick],
  );
  const endFlight = useCallback(() => setFlight(null), []);

  // Crystals that arrived since the last visit fly in (mockup screen 7); the balance seen is remembered per viewer.
  const crystals = save.crystals;
  useEffect(() => {
    const store = storage();
    const seen = readSeenCrystals(store);
    const arrived = arrivedSince(seen, crystals);
    if (!(arrived > 0) || seen === null) {
      writeSeenCrystals(store, crystals);
      return;
    }
    // The seen balance is written when the flight starts, so a strict-mode double mount still flies once.
    const t = window.setTimeout(() => {
      writeSeenCrystals(store, crystals);
      launchTick(seen, crystals, centreOf(listPrimaryRef.current?.querySelector('.primary-lead')));
    }, 400);
    return () => window.clearTimeout(t);
    // Mount only: a later change of the balance is a purchase, handled by `buy`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Whatever balance the visit ends with was seen (a crystal pack bought over the shop must not fly again next time).
  useEffect(() => () => writeSeenCrystals(storage(), progressStore.get().crystals), []);

  // --- toast ---
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  // --- preview (five seconds of the song) ---
  const [previewing, setPreviewing] = useState<string | null>(null);
  const previewToken = useRef(0);
  const stopPreview = useCallback(() => {
    previewToken.current++;
    audioEngine.stop();
    setPreviewing(null);
  }, []);
  useEffect(() => stopPreview, [stopPreview]);
  const togglePreview = useCallback(
    async (track: TrackMeta) => {
      if (previewing === track.id) {
        stopPreview();
        return;
      }
      const token = ++previewToken.current;
      setPreviewing(track.id);
      try {
        await audioEngine.ensureContext();
        const buffer = await loadSong(`${import.meta.env.BASE_URL}music/${track.id}.mp3`);
        if (token !== previewToken.current) return;
        audioEngine.preview(buffer, buffer.duration * PREVIEW_AT, PREVIEW_SEC, () => {
          if (token === previewToken.current) setPreviewing(null);
        });
      } catch {
        // The clip did not load (network): the disc quietly returns to the triangle.
        if (token === previewToken.current) setPreviewing(null);
      }
    },
    [previewing, stopPreview],
  );

  // --- the scene follows the focus: the ad / reward track, the sheet, the preview, else the first card ---
  const previewTrack = previewing ? items.find((i) => i.track.id === previewing)?.track : undefined;
  const focus = adTrack ?? rewardTrack ?? sheet?.track ?? previewTrack ?? items[0]?.track ?? null;
  const focusId = focus?.id;
  const focusGenre = focus?.genre;
  useEffect(() => {
    onSceneTrack(focusId ? { id: focusId, genre: focusGenre } : null);
  }, [focusId, focusGenre, onSceneTrack]);

  // --- back: closes what is open first, then leaves ---
  const back = useCallback(() => {
    if (view === 'ad') return;
    if (sheet) {
      setSheet(null);
      return;
    }
    if (view === 'reward') {
      setView('list');
      setRewardTrack(null);
      return;
    }
    onBack();
  }, [view, sheet, onBack]);
  useSwipeBack(back, view !== 'ad');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back]);

  // --- play (the daily track from «ЗАРАБОТАТЬ», the unlocked track from «ИГРАТЬ») ---
  const playTrack = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(id);
      stopPreview();
      try {
        const chart = await loadChart(id);
        clearActiveDuel();
        startSession(chart, 'catalog');
        navigate('game');
      } finally {
        if (mounted.current) setBusy(null);
      }
    },
    [busy, stopPreview],
  );

  // --- purchase ---
  const openSheet = useCallback((item: ShopItem) => {
    sfxUi();
    setSheet(item);
  }, []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const buy = useCallback(() => {
    if (!sheet) return;
    const item = sheet;
    const before = save.crystals;
    const origin = centreOf(sheetPrimaryRef.current?.querySelector('.primary-lead'));
    const { ok } = buyTrackWithCrystals(item.track.id, item.price);
    setSheet(null);
    if (!ok) return;
    sfxGem(true);
    setJustBought(item.track.id);
    setToast(fmt(dict.shopBoughtToast, { title: item.track.title }));
    writeSeenCrystals(storage(), before - item.price);
    launchTick(before, before - item.price, origin);
  }, [sheet, save.crystals, launchTick]);

  const startAd = useCallback(async () => {
    // The ad opens the week's new track only (its first 14 days); the sheet shows no ad for anything else.
    if (!sheet || sheet.drop?.adEligible !== true) return;
    const item = sheet;
    setSheet(null);
    stopPreview();
    setAdTrack(item.track);
    setView('ad');
    const { unlocked } = await watchAdAndUnlock(item.track.id, item.drop);
    if (!mounted.current) return;
    setAdTrack(null);
    if (unlocked) {
      sfxMilestone();
      setJustBought(item.track.id);
      setRewardTrack(item.track);
      setView('reward');
    } else {
      setView('list');
    }
  }, [sheet, stopPreview]);
  const closeAd = useCallback(() => {
    // The stub resolves 'closed' (no reward); a real provider shows its own confirmation and closes itself.
    if (isStubAds) stubAds.cancel();
  }, []);

  const earn = useCallback(() => {
    setSheet(null);
    if (daily) void playTrack(daily.id);
    else onBack();
  }, [daily, playTrack, onBack]);

  const balance = heldBalance ?? save.crystals;
  const plan = sheet ? purchasePlan(sheet.price, save.crystals) : null;
  const paths = plan ? purchasePaths(plan, sheet?.drop?.adEligible === true && ads.available()) : null;
  const empty = items.length === 0;
  // The «Новинки» shelf: the weekly tracks lead the list (they keep their place when bought during the visit).
  const shelf = items[0]?.drop !== undefined;

  const trio = (
    <Trio>
      <ObjButton icon={<Icon name="back" size={20} />} label={dict.back} onClick={back} />
      <ObjButton icon={<Icon name="trophy" size={20} />} label={dict.records} onClick={onRecords} />
      <ObjButton icon={<Icon name="user" size={20} />} label={dict.profile} onClick={onProfile} />
    </Trio>
  );

  return (
    <div className="shop-body">
      {view === 'reward' && rewardTrack ? (
        <SubHeader center>
          <b>{rewardTrack.title}</b>
          <span>·</span>
          <span>{rewardTrack.drop ? dict.dropTag : rewardTrack.premium ? dict.shopPremium : dict.shopBought}</span>
        </SubHeader>
      ) : (
        <SubHeader tag={<Tag>{dict.shop}</Tag>} text={dict.shopEarnHint} />
      )}

      {view === 'reward' && rewardTrack ? (
        <AdReward track={rewardTrack} />
      ) : (
        <div className="shop-list" role="list">
          {empty && (
            <Panel layout="score" className="shop-empty">
              <Icon name="bag" size={32} />
              <span>{dict.shopEmpty}</span>
            </Panel>
          )}
          {shelf && (
            <div className="shop-shelf" role="heading" aria-level={2}>
              <Tag>{dict.dropsChapter}</Tag>
            </div>
          )}
          {items.map((it) => (
            <ShopCard
              key={it.track.id}
              item={it}
              balance={balance}
              previewing={previewing === it.track.id}
              justBought={justBought === it.track.id}
              onPreview={() => void togglePreview(it.track)}
              onOpen={() => (it.kind === 'owned' ? onTrack(it.track.id) : openSheet(it))}
            />
          ))}
        </div>
      )}

      <ActionZone className={view === 'reward' ? 'shop-actions shop-actions-reward' : 'shop-actions'}>
        {toast && (
          <div className="shop-toast" role="status">
            <span className="shop-cy">
              <CrystalIcon size={20} />
            </span>
            {toast}
          </div>
        )}
        {trio}
        <div className="shop-primary" ref={listPrimaryRef}>
          {view === 'reward' && rewardTrack ? (
            <PrimaryAction
              lead={
                <Disc>
                  <Icon name="play" size={24} />
                </Disc>
              }
              label={dict.play}
              sub={rewardTrack.title}
              beat
              disabled={busy !== null}
              onClick={() => void playTrack(rewardTrack.id)}
            />
          ) : (
            <PrimaryAction
              lead={
                daily ? (
                  <Thumb>
                    <TrackCover id={daily.id} genre={daily.genre} title={daily.title} />
                  </Thumb>
                ) : (
                  <Disc>
                    <Icon name="play" size={24} />
                  </Disc>
                )
              }
              label={empty ? dict.play : dict.shopEarn}
              sub={daily ? (empty ? daily.title : fmt(dict.shopDailyLabel, { title: daily.title })) : dict.shopEarnHint}
              beat
              disabled={busy !== null}
              onClick={earn}
            />
          )}
        </div>
      </ActionZone>

      {sheet && plan && paths && (
        <PurchaseSheet
          item={sheet}
          plan={plan}
          paths={paths}
          daily={daily}
          onBuy={buy}
          onAd={() => void startAd()}
          onEarn={earn}
          onClose={closeSheet}
          onTopUp={
            onTopUp &&
            (() => {
              setSheet(null);
              onTopUp();
            })
          }
          primaryRef={sheetPrimaryRef}
        />
      )}
      {/* The stub's own frame; a real network shows its own player. */}
      {view === 'ad' && adTrack && isStubAds && <AdScreen track={adTrack} onClose={closeAd} />}
      {flight && <CrystalFlight path={flight} onDone={endFlight} />}
    </div>
  );
}
