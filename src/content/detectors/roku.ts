import { BaseDetector, type Signal } from './BaseDetector';
import { classPrefix, commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const ROKU_HOSTS: readonly RegExp[] = [/(^|\.)therokuchannel\.roku\.com$/];

/**
 * The Roku Channel. Web player includes commercial break indicators and ad timers.
 */
export class RokuDetector extends BaseDetector {
  readonly id = 'roku';
  protected readonly playerSelectors = ['#roku-player-container', '.roku-player', '.video-player-root'];
  protected readonly signals: readonly Signal[] = [
    selectorSignal('roku:ad-indicator', classPrefix('ad-indicator', 'AdIndicator', 'ad-timer'), 0.85, { nonEmpty: true }),
    selectorSignal('roku:ad-badge', '[data-testid="ad-badge"], [data-testid="ad-timer"]', 0.85, { nonEmpty: true }),
    selectorSignal('roku:commercial-break', '.commercial-break-overlay', 0.9, { nonEmpty: true }),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}
