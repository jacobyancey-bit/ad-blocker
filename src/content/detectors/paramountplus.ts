import { BaseDetector, type Signal } from './BaseDetector';
import { classPrefix, commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const PARAMOUNT_HOSTS: readonly RegExp[] = [/(^|\.)paramountplus\.com$/];

/**
 * Paramount+. Uses CBS/Viacom video player with ad container indicators,
 * ad countdown timers, and "Commercial Break" overlays.
 */
export class ParamountDetector extends BaseDetector {
  readonly id = 'paramountplus';
  protected readonly playerSelectors = [
    '#main-container .video-player-container',
    '.player-container',
    '.cbs-player',
    '.video-container',
  ];
  protected readonly signals: readonly Signal[] = [
    selectorSignal(
      'paramount:ad-break-indicator',
      classPrefix('ad-break-indicator', 'ad-indicator', 'adCountdown', 'ad-countdown'),
      0.85,
      { nonEmpty: true },
    ),
    selectorSignal(
      'paramount:ad-overlay',
      '.ad-overlay-container, .ad-message-container, [class*="AdNotice"]',
      0.8,
      { nonEmpty: true },
    ),
    selectorSignal(
      'paramount:ad-badge',
      '[data-testid*="ad-badge"], [data-testid*="ad-countdown"]',
      0.85,
      { nonEmpty: true },
    ),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}
