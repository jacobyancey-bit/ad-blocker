import type { Settings, Stats, SupporterState } from './types';

/** Ad detection timing (see stateMachine.ts). */
export const DETECTION = {
  POLL_INTERVAL_MS: 300,
  MUTE_CONFIDENCE: 0.8,
  UNMUTE_CONFIDENCE: 0.2,
  MUTE_HOLD_MS: 600,
  UNMUTE_HOLD_MS: 1000,
  SAFETY_TIMEOUT_MS: 3.5 * 60 * 1000,
} as const;

/** Audio ramp timing (see audioController.ts). */
export const AUDIO = {
  FADE_OUT_MS: 250,
  FADE_IN_MS: 450,
  MAX_AD_VOLUME: 0.2,
} as const;

/** Pay-What-You-Want config. Swap CHECKOUT_URL for your real payment link. */
export const PWYW = {
  MILESTONE_ADS: 10,
  CHECKOUT_URL: 'https://buy.stripe.com/your-payment-link',
  DEFAULT_SUPPORTER_ACCENT: '#f472b6',
} as const;

/** Streaming hosts AdMute runs on by default. Used by the manifest and runtime. */
export const SUPPORTED_MATCHES = [
  'https://www.youtube.com/*',
  'https://m.youtube.com/*',
  'https://tv.youtube.com/*',
  'https://www.hulu.com/*',
  'https://www.peacocktv.com/*',
  'https://www.twitch.tv/*',
  'https://www.primevideo.com/*',
  'https://www.amazon.com/gp/video/*',
  'https://www.paramountplus.com/*',
  'https://play.max.com/*',
  'https://play.hbomax.com/*',
  'https://tubitv.com/*',
  'https://pluto.tv/*',
  'https://therokuchannel.roku.com/*',
  'https://www.crunchyroll.com/*',
] as const;

export const DEFAULT_SETTINGS: Settings = {
  adVolume: 0,
  fadeEnabled: true,
  dimOverlayEnabled: true,
  ambientSound: 'none',
  disabledDomains: [],
  customSites: [],
};

export const DEFAULT_SUPPORTER: SupporterState = {
  isSupporter: false,
  code: '',
  accent: PWYW.DEFAULT_SUPPORTER_ACCENT,
  since: null,
};

export const DEFAULT_STATS: Stats = {
  totalAdsMuted: 0,
  totalSecondsMuted: 0,
};

export const BADGE = {
  TEXT: 'MUTE',
  COLOR: '#f59e0b',
} as const;

