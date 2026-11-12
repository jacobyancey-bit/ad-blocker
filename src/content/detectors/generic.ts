import { BaseDetector, type Signal } from './BaseDetector';
import { classPrefix, commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

/**
 * Fallback for any site without a dedicated adapter (Prime Video, Paramount+, Max,
 * user-added sites). Relies on stable, cross-site signals: common ad-state classes
 * used by popular player frameworks (video.js/IMA, Shaka, Prime's SDK), ad test-ids,
 * and visible player text.
 */
export class GenericDetector extends BaseDetector {
  readonly id: string = 'generic';
  protected readonly playerSelectors: readonly string[] = [];
  protected readonly signals: readonly Signal[] = [
    selectorSignal(
      'generic:ad-state-class',
      classPrefix('ad-showing', 'ad-playing', 'ad-interrupting', 'vjs-ad-playing', 'AdPlaying', 'adPlaying'),
      0.8,
      { visible: false },
    ),
    selectorSignal(
      'generic:ad-timer',
      classPrefix(
        'ad-countdown',
        'ad-timer',
        'AdCountdown',
        'AdTimer',
        'atvwebplayersdk-ad-timer',
        'atvwebplayersdk-adtimeindicator',
      ),
      0.7,
      { nonEmpty: true },
    ),
    selectorSignal(
      'generic:ad-testid',
      '[data-testid*="ad-countdown"], [data-testid*="ad-timer"], [data-testid="ad-badge"], [data-testid*="AdBadge"]',
      0.7,
      { nonEmpty: true },
    ),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}
