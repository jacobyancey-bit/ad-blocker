import { BaseDetector, type Signal } from './BaseDetector';
import { commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const PLUTO_HOSTS: readonly RegExp[] = [/(^|\.)pluto\.tv$/];

/**
 * Pluto TV. FAST streaming service with broadcast-style ad intervals.
 */
export class PlutoDetector extends BaseDetector {
  readonly id = 'pluto';
  protected readonly playerSelectors = ['#video-player-container', '.pluto-player', '.player-root'];
  protected readonly signals: readonly Signal[] = [
    selectorSignal('pluto:ad-overlay', '[class*="AdOverlay"], [class*="ad-overlay"]', 0.85, { nonEmpty: true }),
    selectorSignal('pluto:ad-countdown', '[class*="AdCountdown"], [class*="ad-countdown"], [data-testid*="ad-countdown"]', 0.85, { nonEmpty: true }),
    selectorSignal('pluto:commercial-break', '[data-testid="commercial-break-indicator"]', 0.9, { nonEmpty: true }),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}
