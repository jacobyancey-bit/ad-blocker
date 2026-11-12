import { BaseDetector, type Signal } from './BaseDetector';
import { commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const TWITCH_HOSTS: readonly RegExp[] = [/(^|\.)twitch\.tv$/];

/**
 * Twitch. Ads are stitched into the live stream, so the <video> element and its
 * duration (Infinity) don't change — DOM labels are the reliable signal. Twitch's
 * `data-a-target` attributes are fairly stable across releases.
 */
export class TwitchDetector extends BaseDetector {
  readonly id = 'twitch';
  protected readonly playerSelectors = [
    '[data-a-target="video-player"]',
    '.video-player__container',
    '.video-player',
  ];
  protected readonly signals: readonly Signal[] = [
    selectorSignal('twitch:ad-label', '[data-a-target="video-ad-label"]', 0.95),
    selectorSignal('twitch:ad-countdown', '[data-a-target="video-ad-countdown"]', 0.85),
    selectorSignal('twitch:ad-banner', '[data-test-selector="ad-banner-default-text"]', 0.6, { nonEmpty: true }),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}

