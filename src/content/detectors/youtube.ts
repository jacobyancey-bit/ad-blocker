import { BaseDetector, type Signal } from './BaseDetector';
import { commonTextSignals, selectorSignal, shortMediaSwapSignal } from './signals';

export const YOUTUBE_HOSTS: readonly RegExp[] = [/(^|\.)youtube\.com$/];

/**
 * YouTube (www, m, tv). The player root gets `ad-showing` / `ad-interrupting`
 * classes during video ads — the strongest signal. Overlay/skip/badge elements
 * corroborate in case the class names change. The always-present (but empty)
 * `.ytp-ad-module` container is deliberately NOT used as a signal.
 */
export class YouTubeDetector extends BaseDetector {
  readonly id = 'youtube';
  protected readonly playerSelectors = ['#movie_player', '#shorts-player', '.html5-video-player'];
  protected readonly signals: readonly Signal[] = [
    selectorSignal('yt:ad-showing', '.html5-video-player.ad-showing', 0.95, { visible: false }),
    selectorSignal('yt:ad-interrupting', '.html5-video-player.ad-interrupting', 0.9, { visible: false }),
    selectorSignal(
      'yt:ad-overlay',
      '.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout, .ytp-ad-player-overlay-instream-info',
      0.7,
    ),
    selectorSignal(
      'yt:skip-button',
      '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-slot',
      0.6,
    ),
    selectorSignal(
      'yt:ad-badge',
      '.ytp-ad-badge, .ytp-ad-simple-ad-badge, .ytp-ad-preview-container, .ytp-ad-duration-remaining',
      0.6,
      { nonEmpty: true },
    ),
    ...commonTextSignals(),
    shortMediaSwapSignal(),
  ];
}
