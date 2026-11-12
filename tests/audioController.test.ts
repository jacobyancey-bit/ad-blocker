import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioController, rampValue, type MediaLike } from '../src/content/audioController';

/**
 * Fake media element. Like a real browser, `volumechange` is dispatched asynchronously
 * (as a queued task), and user changes go through the exact same setters.
 */
class FakeMedia extends EventTarget implements MediaLike {
  private _volume: number;
  private _muted = false;

  constructor(volume = 0.8) {
    super();
    this._volume = volume;
  }

  get volume() {
    return this._volume;
  }
  set volume(v: number) {
    if (v < 0 || v > 1) throw new RangeError(`volume out of range: ${v}`);
    this._volume = v;
    this.fire();
  }
  get muted() {
    return this._muted;
  }
  set muted(m: boolean) {
    this._muted = m;
    this.fire();
  }

  private fire() {
    setTimeout(() => this.dispatchEvent(new Event('volumechange')), 0);
  }
}

// Compile-time check: a real <video> satisfies MediaLike.
const _videoIsMediaLike: MediaLike = document.createElement('video');
void _videoIsMediaLike;

const TICK = 16;

function setup(volume = 0.8, opts: Partial<ConstructorParameters<typeof AudioController>[1]> = {}) {
  const media = new FakeMedia(volume);
  const ctrl = new AudioController(media, { now: () => Date.now(), ...opts });
  const onOverride = vi.fn();
  ctrl.onOverride(onOverride);
  return { media, ctrl, onOverride };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('rampValue', () => {
  it('hits endpoints exactly', () => {
    expect(rampValue(0.8, 0, 0)).toBe(0.8);
    expect(rampValue(0.8, 0, 1)).toBe(0);
    expect(rampValue(0, 0.6, 1)).toBe(0.6);
  });

  it('is monotonic in both directions', () => {
    let prevDown = Infinity;
    let prevUp = -Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const down = rampValue(0.8, 0, p);
      const up = rampValue(0, 0.8, p);
      expect(down).toBeLessThanOrEqual(prevDown);
      expect(up).toBeGreaterThanOrEqual(prevUp);
      prevDown = down;
      prevUp = up;
    }
  });

  it('is exponential (fade-out drops fast early)', () => {
    expect(rampValue(0.8, 0, 0.5)).toBeLessThan(0.4);
  });
});

describe('AudioController — fade out', () => {
  it('fades from pre-ad volume to 0 over ~250ms, monotonically', () => {
    const { media, ctrl } = setup(0.8);
    ctrl.duck();
    expect(ctrl.phase).toBe('fading-out');

    const samples: number[] = [];
    for (let t = 0; t < 240; t += TICK) {
      vi.advanceTimersByTime(TICK);
      samples.push(media.volume);
    }
    expect(ctrl.phase).toBe('fading-out');
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeLessThanOrEqual(samples[i - 1]!);
    }

    vi.advanceTimersByTime(TICK * 2);
    expect(media.volume).toBe(0);
    expect(ctrl.phase).toBe('ducked');
    expect(ctrl.preAdVolume).toBe(0.8);
  });

  it('ducks to the configured ad volume', () => {
    const { media, ctrl } = setup(0.8, { adVolume: 0.1 });
    ctrl.duck();
    vi.advanceTimersByTime(300);
    expect(media.volume).toBeCloseTo(0.1, 10);
  });

  it('clamps ad volume to 20%', () => {
    const { media, ctrl } = setup(0.8, { adVolume: 0.9 });
    ctrl.duck();
    vi.advanceTimersByTime(300);
    expect(media.volume).toBeCloseTo(0.2, 10);
  });

  it('never raises volume if the user was already quieter than the ad level', () => {
    const { media, ctrl } = setup(0.05, { adVolume: 0.2 });
    ctrl.duck();
    vi.advanceTimersByTime(300);
    expect(media.volume).toBeCloseTo(0.05, 10);
  });

  it('is instant when fades are disabled', () => {
    const { media, ctrl } = setup(0.8, { fadeEnabled: false });
    ctrl.duck();
    expect(media.volume).toBe(0);
    expect(ctrl.phase).toBe('ducked');
  });

  it('duck() is idempotent while ducking', () => {
    const { ctrl } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(100);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    expect(ctrl.preAdVolume).toBe(0.8);
  });
});

describe('AudioController — fade in', () => {
  it('restores the exact pre-ad volume over ~450ms', () => {
    const { media, ctrl } = setup(0.73);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    ctrl.restore();
    expect(ctrl.phase).toBe('fading-in');

    vi.advanceTimersByTime(400);
    expect(ctrl.phase).toBe('fading-in');
    expect(media.volume).toBeLessThan(0.73);

    vi.advanceTimersByTime(100);
    expect(media.volume).toBe(0.73);
    expect(ctrl.phase).toBe('idle');
  });

  it('a full cycle never mistakes its own writes for user input', () => {
    const { media, ctrl, onOverride } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    ctrl.restore();
    vi.advanceTimersByTime(600);
    expect(onOverride).not.toHaveBeenCalled();
    expect(media.volume).toBe(0.8);
  });

  it('re-ducking during fade-in keeps the original pre-ad volume', () => {
    const { media, ctrl } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    ctrl.restore();
    vi.advanceTimersByTime(200); // partially restored
    ctrl.duck(); // next ad in the pod
    vi.advanceTimersByTime(300);
    expect(ctrl.phase).toBe('ducked');
    ctrl.restore();
    vi.advanceTimersByTime(500);
    expect(media.volume).toBe(0.8);
  });

  it('restore() while idle does nothing', () => {
    const { media, ctrl } = setup(0.8);
    ctrl.restore();
    vi.advanceTimersByTime(500);
    expect(media.volume).toBe(0.8);
    expect(ctrl.phase).toBe('idle');
  });
});

describe('AudioController — manual user override', () => {
  it('yields when the user changes volume while ducked', () => {
    const { media, ctrl, onOverride } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(300);

    media.volume = 0.5; // user drags the slider during the ad
    vi.advanceTimersByTime(1);
    expect(ctrl.phase).toBe('overridden');
    expect(onOverride).toHaveBeenCalledTimes(1);

    ctrl.restore(); // ad ends
    vi.advanceTimersByTime(500);
    expect(media.volume).toBe(0.5); // user's choice is kept
    expect(ctrl.phase).toBe('idle');
  });

  it('stops a fade-out immediately if the user changes volume mid-ramp', () => {
    const { media, ctrl, onOverride } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(100);
    media.volume = 0.6;
    vi.advanceTimersByTime(500);
    expect(media.volume).toBe(0.6);
    expect(ctrl.phase).toBe('overridden');
    expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it('yields when the user toggles mute during an ad', () => {
    const { media, ctrl, onOverride } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    media.muted = true;
    vi.advanceTimersByTime(1);
    expect(ctrl.phase).toBe('overridden');
    expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it('ignores further duck() calls for the rest of the overridden pod', () => {
    const { media, ctrl } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    media.volume = 0.5;
    vi.advanceTimersByTime(1);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    expect(media.volume).toBe(0.5);
  });

  it('resumes normal ducking on the next pod, saving the new volume', () => {
    const { media, ctrl } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    media.volume = 0.5;
    vi.advanceTimersByTime(1);
    ctrl.restore();

    ctrl.duck(); // next ad break
    expect(ctrl.preAdVolume).toBe(0.5);
    vi.advanceTimersByTime(300);
    expect(media.volume).toBe(0);
    ctrl.restore();
    vi.advanceTimersByTime(500);
    expect(media.volume).toBe(0.5);
  });

  it('a user change during fade-in stops restoring without an override event', () => {
    const { media, ctrl, onOverride } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    ctrl.restore();
    vi.advanceTimersByTime(100);
    media.volume = 0.3;
    vi.advanceTimersByTime(500);
    expect(media.volume).toBe(0.3);
    expect(ctrl.phase).toBe('idle');
    expect(onOverride).not.toHaveBeenCalled();
  });
});

describe('AudioController — live settings & disposal', () => {
  it('setAdVolume() while ducked ramps to the new level', () => {
    const { media, ctrl } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    ctrl.setAdVolume(0.15);
    vi.advanceTimersByTime(300);
    expect(media.volume).toBeCloseTo(0.15, 10);
    expect(ctrl.phase).toBe('ducked');
  });

  it('dispose() mid-ad restores volume instantly and detaches', () => {
    const { media, ctrl, onOverride } = setup(0.8);
    ctrl.duck();
    vi.advanceTimersByTime(300);
    ctrl.dispose();
    expect(media.volume).toBe(0.8);

    media.volume = 0.2;
    ctrl.duck();
    vi.advanceTimersByTime(500);
    expect(media.volume).toBe(0.2);
    expect(onOverride).not.toHaveBeenCalled();
  });
});

