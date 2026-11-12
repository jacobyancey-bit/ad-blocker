/** Detection state of a single tab, as surfaced to the popup and badge. */
export type TabStatus = 'MONITORING' | 'AD_MUTED' | 'PAUSED' | 'DISABLED' | 'UNSUPPORTED';

/** User preferences — synced across the user's Chrome profile. */
export interface Settings {
  /** Volume to duck to during ads, 0.0 (full mute) – 0.2 (20%). */
  adVolume: number;
  /** Smooth fade transitions on/off. */
  fadeEnabled: boolean;
  /** Hostnames where the user has turned AdMute off. */
  disabledDomains: string[];
  /** Extra hostnames the user granted permission for. */
  customSites: string[];
}

/** PWYW supporter status — synced, purely cosmetic perks. */
export interface SupporterState {
  isSupporter: boolean;
  /** Optional code the user entered (not validated server-side). */
  code: string;
  /** Accent color unlocked for supporters (CSS color). */
  accent: string;
  /** Epoch ms when supporter status was set. */
  since: number | null;
}

/** Local-only telemetry. Never leaves the device. */
export interface Stats {
  totalAdsMuted: number;
  totalSecondsMuted: number;
}

