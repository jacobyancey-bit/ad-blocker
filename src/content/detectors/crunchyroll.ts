import { BaseDetector, type Signal } from './BaseDetector';
import { classPrefix, commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const CRUNCHYROLL_HOSTS: readonly RegExp[] = [/(^|\.)crunchyroll\.com$/];

/**
 * Crunchyroll (Vrv / Sony player).
 * Uses vjs-based / custom HTML5 player with dedicated ad badges and countdown timers.
 */
export class CrunchyrollDetector extends BaseDetector {
  readonly id = 'crunchyroll';
  protected readonly playerSelectors = ['#vilos', '#velocity-player-package', '.video-player'];
  protected readonly signals: readonly Signal[] = [
    selectorSignal('cr:ad-playing', classPrefix('ad-playing', 'vjs-ad-playing'), 0.9, { visible: false }),
    selectorSignal('cr:ad-badge', classPrefix('ad-badge', 'AdBadge', 'videoAdUi'), 0.85, { nonEmpty: true }),
    selectorSignal('cr:ad-countdown', '[data-testid="ad-countdown"], .ad-countdown', 0.85, { nonEmpty: true }),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}
