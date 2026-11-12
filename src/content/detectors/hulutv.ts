import { BaseDetector, type Signal } from './BaseDetector';
import { classPrefix, commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const HULU_HOSTS: readonly RegExp[] = [/(^|\.)hulu\.com$/];

/**
 * Hulu (on-demand + Live TV). Hulu ships CSS-module class names that change between
 * releases, so we match on stable prefixes (AdUnitView, AdBadge, ...) and lean on
 * the shared text signals ("Ad 2 of 3", "Ad · 1:15", "will resume").
 */
export class HuluDetector extends BaseDetector {
  readonly id = 'hulu';
  protected readonly playerSelectors = [
    '#web-player-app',
    '.Player',
    '[class*="PlayerContainer"]',
    '.content-video-player',
  ];
  protected readonly signals: readonly Signal[] = [
    selectorSignal('hulu:ad-unit', classPrefix('AdUnitView', 'AdUnit'), 0.85, { nonEmpty: true }),
    selectorSignal('hulu:ad-container', '.ad-container', 0.6, { nonEmpty: true }),
    selectorSignal(
      'hulu:ad-countdown',
      classPrefix('ad-countdown', 'AdCountdown', 'AdBadge', 'ad-badge'),
      0.7,
      { nonEmpty: true },
    ),
    selectorSignal('hulu:ad-bar', classPrefix('AdBar', 'ad-bar'), 0.6, { nonEmpty: true }),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}

