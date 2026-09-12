export { detectInstallPlatform, isIos, isIosSafari, isAndroid, isInAppBrowser, shouldShowInstallBanner, INSTALL_DISMISS_DAYS } from './platform';
export type { InstallPlatform, PlatformInput, BannerInput } from './platform';
export { INSTALL_DISMISSED_KEY, parseDismissedAt, serializeDismissedAt } from './dismissal';
export { reduceSwUpdate, isUpdateAvailable, SW_INITIAL } from './updateState';
export type { SwUpdateState, SwUpdateEvent, SwEffect, SwPhase } from './updateState';
export { registerServiceWorker, applyUpdate, useUpdateAvailable, swStore } from './serviceWorker';
export {
  initInstallPrompt,
  promptInstall,
  readInstallDismissedAt,
  rememberInstallDismissed,
  getInstallPlatform,
  useInstallState,
  installStore,
} from './install';
export { isStandaloneDisplay, installStandaloneGuards, isZoomShortcut, isZoomWheel, isMultiTouch } from './standalone';
