import { BaseDetector, type Signal } from './BaseDetector';
import { classPrefix, commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const PEACOCK_HOSTS: readonly RegExp[] = [/(^|\.)peacocktv\.com$/];

/**
 * Peacock. Its player renders an ad countdown/indicator during breaks and
 * "Your show will resume shortly"-style copy; both are matched loosely.
 */
export class PeacockDetector extends BaseDetector {
  readonly id = 'peacock';
  protected readonly playerSelectors = [
    '#sky-player-container',
    '.playback-container',
    '[data-testid="player"]',
    '.video-player',
  ];
  protected readonly signals: readonly Signal[] = [
    selectorSignal(
      'peacock:ad-countdown-testid',
      '[data-testid*="ad-countdown"], [data-test-id*="ad-countdown"]',
      0.8,
      { nonEmpty: true },
    ),
    selectorSignal('peacock:ad-countdown', classPrefix('ad-countdown', 'AdCountdown'), 0.75, { nonEmpty: true }),
    selectorSignal(
      'peacock:ad-indicator',
      classPrefix('ad-indicator', 'AdIndicator', 'ad-break', 'AdBreak'),
      0.7,
      { nonEmpty: true },
    ),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}

