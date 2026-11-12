import { BaseDetector, type Signal } from './BaseDetector';
import { classPrefix, commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const PRIME_HOSTS: readonly RegExp[] = [
  /(^|\.)primevideo\.com$/,
  /(^|\.)amazon\.[a-z.]+\/gp\/video/,
];

/**
 * Amazon Prime Video.
 * The ATV Web Player SDK uses explicit countdown containers and ad overlay badges.
 */
export class PrimeVideoDetector extends BaseDetector {
  readonly id = 'primevideo';
  protected readonly playerSelectors = [
    '.atvwebplayersdk-player-container',
    '.rendererContainer',
    '.dv-player-fullscreen',
    '[data-testid="player-container"]',
  ];
  protected readonly signals: readonly Signal[] = [
    selectorSignal(
      'prime:ad-timer',
      classPrefix('atvwebplayersdk-ad-timer', 'atvwebplayersdk-adtimeindicator', 'ad-timer'),
      0.85,
      { nonEmpty: true },
    ),
    selectorSignal(
      'prime:ad-overlay',
      '.atvwebplayersdk-ad-overlay, .ad-overlay, .atvwebplayersdk-ad-badge',
      0.8,
      { nonEmpty: true },
    ),
    selectorSignal(
      'prime:ad-countdown-testid',
      '[data-testid*="ad-timer"], [data-testid*="ad-countdown"], [data-testid="ad-badge"]',
      0.85,
      { nonEmpty: true },
    ),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}
