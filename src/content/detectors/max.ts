import { BaseDetector, type Signal } from './BaseDetector';
import { classPrefix, commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const MAX_HOSTS: readonly RegExp[] = [
  /(^|\.)max\.com$/,
  /(^|\.)hbomax\.com$/,
];

/**
 * Max (formerly HBO Max).
 * Uses Beam/Discovery video player with ad container indicators and countdown pills.
 */
export class MaxDetector extends BaseDetector {
  readonly id = 'max';
  protected readonly playerSelectors = [
    '[data-testid="player-ux"]',
    '#player',
    '.default-player-container',
    '.wbd-player',
  ];
  protected readonly signals: readonly Signal[] = [
    selectorSignal(
      'max:ad-pod-pill',
      classPrefix('AdPodPill', 'ad-pod-pill', 'AdCountdownPill', 'ad-countdown'),
      0.85,
      { nonEmpty: true },
    ),
    selectorSignal(
      'max:ad-container',
      '[data-testid*="ad-indicator"], [data-testid*="ad-countdown"], [data-testid="ad-badge"]',
      0.85,
      { nonEmpty: true },
    ),
    selectorSignal('max:ad-overlay', '.ad-overlay-view, [class*="AdBreakOverlay"]', 0.8, { nonEmpty: true }),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}
