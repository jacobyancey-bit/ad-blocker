import { BaseDetector, type Signal } from './BaseDetector';
import { classPrefix, commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const TUBI_HOSTS: readonly RegExp[] = [/(^|\.)tubitv\.com$/];

/**
 * Tubi TV. Free ad-supported streaming with explicit commercial countdowns.
 */
export class TubiDetector extends BaseDetector {
  readonly id = 'tubitv';
  protected readonly playerSelectors = ['#tubi-player', '.tubi-video-player', '.web-player'];
  protected readonly signals: readonly Signal[] = [
    selectorSignal('tubi:ad-indicator', classPrefix('AdIndicator', 'ad-indicator', 'AdNotice'), 0.85, { nonEmpty: true }),
    selectorSignal('tubi:ad-countdown', '[data-testid="ad-countdown"], [data-testid="ad-pod-countdown"]', 0.9, { nonEmpty: true }),
    selectorSignal('tubi:commercial-break', '.commercial-break-banner, .ad-break-message', 0.85, { nonEmpty: true }),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}
