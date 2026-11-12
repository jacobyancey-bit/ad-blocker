import { afterEach, describe, expect, it } from 'vitest';
import {
  BaseDetector,
  combineWeights,
  guessPlayerContainer,
  pickPrimaryVideo,
  type Signal,
} from '../../src/content/detectors/BaseDetector';
import {
  classPrefix,
  isVisible,
  selectorSignal,
  shortMediaSwapSignal,
  textScanSignal,
} from '../../src/content/detectors/signals';

afterEach(() => {
  document.body.innerHTML = '';
});

function ctxFor(playerSelector = '#player') {
  const player = document.querySelector(playerSelector);
  return { doc: document, player, video: player?.querySelector('video') ?? null };
}

describe('combineWeights', () => {
  it('combines as a probabilistic OR', () => {
    expect(combineWeights([])).toBe(0);
    expect(combineWeights([0.9])).toBeCloseTo(0.9);
    expect(combineWeights([0.5, 0.6])).toBeCloseTo(0.8);
    expect(combineWeights([0.4, 0.4])).toBeCloseTo(0.64);
  });

  it('clamps out-of-range weights', () => {
    expect(combineWeights([2])).toBe(1);
    expect(combineWeights([-1, 0.5])).toBeCloseTo(0.5);
  });
});

describe('classPrefix', () => {
  const sel = classPrefix('ad-countdown', 'AdCountdown');
  const matches = (cls: string) => {
    document.body.innerHTML = `<div class="${cls}"></div>`;
    return document.body.querySelector(sel) !== null;
  };

  it('matches whole classes, BEM elements and CSS-module segments', () => {
    expect(matches('ad-countdown')).toBe(true);
    expect(matches('ad-countdown__time')).toBe(true);
    expect(matches('foo ad-countdown')).toBe(true);
    expect(matches('Player__AdCountdown_x7f2')).toBe(true);
  });

  it('does not match substrings inside other words', () => {
    expect(matches('load-countdown')).toBe(false);
    expect(matches('upload-countdown-timer')).toBe(false);
  });
});

describe('isVisible', () => {
  it('detects hidden ancestors', () => {
    document.body.innerHTML = `
      <div id="a"><span id="ok">x</span></div>
      <div style="display:none"><span id="none">x</span></div>
      <div hidden><span id="hidden">x</span></div>
      <div style="visibility:hidden"><span id="vis">x</span></div>
      <div style="opacity:0"><span id="op">x</span></div>`;
    const v = (id: string) => isVisible(document.getElementById(id)!);
    expect(v('ok')).toBe(true);
    expect(v('none')).toBe(false);
    expect(v('hidden')).toBe(false);
    expect(v('vis')).toBe(false);
    expect(v('op')).toBe(false);
  });

  it('treats detached elements as invisible', () => {
    expect(isVisible(document.createElement('div'))).toBe(false);
  });
});

describe('selectorSignal', () => {
  it('matches the player element itself', () => {
    document.body.innerHTML = `<div id="player" class="ad-showing"></div>`;
    const s = selectorSignal('x', '.ad-showing', 0.9);
    expect(s.test(ctxFor())).toBe(true);
  });

  it('respects visibility, nonEmpty and text options', () => {
    document.body.innerHTML = `
      <div id="player">
        <div class="a" style="display:none">Ad</div>
        <div class="b"></div>
        <div class="c">Live</div>
      </div>`;
    expect(selectorSignal('a', '.a', 1).test(ctxFor())).toBe(false);
    expect(selectorSignal('a', '.a', 1, { visible: false }).test(ctxFor())).toBe(true);
    expect(selectorSignal('b', '.b', 1, { nonEmpty: true }).test(ctxFor())).toBe(false);
    expect(selectorSignal('c', '.c', 1, { text: /^ad$/i }).test(ctxFor())).toBe(false);
  });
});

describe('textScanSignal', () => {
  const adPod = textScanSignal('pod', /\bad\s*\d+\s*(?:of|\/)\s*\d+\b/i, 0.85);
  const sponsored = textScanSignal('sp', /^sponsored$/i, 0.4);

  it('matches labels split across child spans', () => {
    document.body.innerHTML = `<div id="player"><div><span>Ad</span> <span>1 of 2</span></div></div>`;
    expect(adPod.test(ctxFor())).toBe(true);
  });

  it('only scans inside the player', () => {
    document.body.innerHTML = `<aside>Sponsored</aside><div id="player"><video></video></div>`;
    expect(sponsored.test(ctxFor())).toBe(false);
  });

  it('ignores hidden text', () => {
    document.body.innerHTML = `<div id="player"><div style="display:none">Ad 1 of 2</div></div>`;
    expect(adPod.test(ctxFor())).toBe(false);
  });

  it('ignores long text blocks (e.g. descriptions)', () => {
    const long = 'In this video we review every ad 1 of 2 '.repeat(5);
    document.body.innerHTML = `<div id="player"><p>${long}</p></div>`;
    expect(adPod.test(ctxFor())).toBe(false);
  });

  it('returns false with no player', () => {
    document.body.innerHTML = `<div>Ad 1 of 2</div>`;
    expect(adPod.test({ doc: document, player: null, video: null })).toBe(false);
  });
});

describe('shortMediaSwapSignal', () => {
  function videoWithDuration(d: number) {
    const v = document.createElement('video');
    Object.defineProperty(v, 'duration', { value: d, configurable: true });
    return v;
  }
  const ctx = (video: HTMLVideoElement) => ({ doc: document, player: null, video });

  it('fires on a short video after a long one', () => {
    const s = shortMediaSwapSignal();
    expect(s.test(ctx(videoWithDuration(1800)))).toBe(false);
    expect(s.test(ctx(videoWithDuration(15)))).toBe(true);
  });

  it('does not fire without a prior long video, or for live/unknown durations', () => {
    const s = shortMediaSwapSignal();
    expect(s.test(ctx(videoWithDuration(15)))).toBe(false);
    expect(s.test(ctx(videoWithDuration(Infinity)))).toBe(false);
    expect(s.test(ctx(videoWithDuration(Number.NaN)))).toBe(false);
  });
});

describe('player & video discovery', () => {
  it('prefers a playing video', () => {
    const a = document.createElement('video');
    const b = document.createElement('video');
    Object.defineProperty(b, 'paused', { value: false });
    expect(pickPrimaryVideo([a, b])).toBe(b);
    expect(pickPrimaryVideo([])).toBeNull();
  });

  it('guesses the player container from class/id', () => {
    document.body.innerHTML = `<div class="VideoPlayer_root"><div><div><video></video></div></div></div>`;
    const v = document.querySelector('video')!;
    expect(guessPlayerContainer(v)?.className).toBe('VideoPlayer_root');
  });
});

describe('BaseDetector', () => {
  class TestDetector extends BaseDetector {
    readonly id = 'test';
    protected readonly playerSelectors = ['#player'];
    protected readonly signals: Signal[] = [
      { id: 'boom', weight: 1, test: () => { throw new Error('bad selector'); } },
      selectorSignal('flag', '.flag', 0.5),
      selectorSignal('flag2', '.flag2', 0.6),
    ];
  }

  it('combines fired signals and survives throwing signals', () => {
    document.body.innerHTML = `<div id="player"><video></video><i class="flag">x</i><i class="flag2">y</i></div>`;
    const r = new TestDetector().detect(document);
    expect(r.fired).toEqual(['flag', 'flag2']);
    expect(r.confidence).toBeCloseTo(0.8);
    expect(r.player?.id).toBe('player');
    expect(r.video).toBe(document.querySelector('video'));
  });

  it('observes the player, falling back to body', () => {
    const d = new TestDetector();
    expect(d.observeRoot(document)).toBe(document.body);
    document.body.innerHTML = `<div id="player"></div>`;
    expect(d.observeRoot(document)).toBe(document.getElementById('player'));
  });
});
