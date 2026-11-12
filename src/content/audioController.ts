import { AUDIO } from '../shared/constants';

/** Minimal surface of HTMLMediaElement the controller needs (a real <video> satisfies it). */
export interface MediaLike {
  volume: number;
  muted: boolean;
  addEventListener(type: 'volumechange', listener: () => void): void;
  removeEventListener(type: 'volumechange', listener: () => void): void;
}

export type AudioPhase = 'idle' | 'fading-out' | 'ducked' | 'fading-in' | 'overridden';

export interface AudioControllerOptions {
  fadeOutMs: number;
  fadeInMs: number;
  /** Volume during ads, clamped to [0, AUDIO.MAX_AD_VOLUME]. */
  adVolume: number;
  fadeEnabled: boolean;
  /** Ramp step interval. */
  tickMs: number;
  /** Clock (ms). Injectable for tests. */
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (id: unknown) => void;
}

/** Quietest level used by the exponential curve (-60 dB). */
const FLOOR = 0.001;
/** Tolerance when comparing the element's volume to what we last wrote. */
const EPSILON = 0.005;

/**
 * Exponential volume interpolation (perceptually smooth). `p` in [0, 1].
 * Zero endpoints are handled via a -60 dB floor; p = 1 always returns `to` exactly.
 */
export function rampValue(from: number, to: number, p: number): number {
  if (p <= 0) return from;
  if (p >= 1) return to;
  const a = Math.max(from, FLOOR);
  const b = Math.max(to, FLOOR);
  return clamp01(a * Math.pow(b / a, p));
}

interface Ramp {
  from: number;
  to: number;
  start: number;
  duration: number;
}

/**
 * Smoothly ducks a media element's volume during ads and restores it afterwards.
 *
 *  idle --duck()--> fading-out --> ducked --restore()--> fading-in --> idle
 *
 * If the user changes volume/mute while we're ducking, we immediately stop and enter
 * `overridden` for the rest of the ad pod (never fight the user). `restore()` then just
 * returns to idle without touching the volume.
 */
export class AudioController {
  private readonly opts: AudioControllerOptions;
  private readonly overrideListeners = new Set<() => void>();

  private _phase: AudioPhase = 'idle';
  private savedVolume = 1;
  private expectedVolume: number | null = null;
  private expectedMuted = false;
  private ramp: Ramp | null = null;
  private timer: unknown = null;
  private safetyMuteTimer: unknown = null;
  private disposed = false;

  constructor(
    private readonly media: MediaLike,
    options: Partial<AudioControllerOptions> = {},
  ) {
    this.opts = {
      fadeOutMs: AUDIO.FADE_OUT_MS,
      fadeInMs: AUDIO.FADE_IN_MS,
      adVolume: 0,
      fadeEnabled: true,
      tickMs: 16,
      now: () => performance.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      ...options,
    };
    this.opts.adVolume = clampAdVolume(this.opts.adVolume);
    media.addEventListener('volumechange', this.handleVolumeChange);
  }

  get phase(): AudioPhase {
    return this._phase;
  }

  /** The volume that will be restored after the ad. */
  get preAdVolume(): number {
    return this.savedVolume;
  }

  /** Called once when the user takes control during an ad. Returns unsubscribe. */
  onOverride(listener: () => void): () => void {
    this.overrideListeners.add(listener);
    return () => this.overrideListeners.delete(listener);
  }

  /** Ad started: fade down to the ad volume. */
  duck(): void {
    if (this.disposed) return;
    switch (this._phase) {
      case 'idle':
        // Remember whatever positive volume the user had; default to 0.8 if starting at 0
        this.savedVolume = this.media.volume > 0 ? this.media.volume : (this.savedVolume || 0.8);
        this.expectedMuted = this.media.muted;
        this.expectedVolume = this.media.volume;
        this._phase = 'fading-out';
        this.startRamp(this.duckTarget(), this.opts.fadeOutMs);
        return;
      case 'fading-in':
        // A new ad started while restoring — keep the original pre-ad volume.
        this._phase = 'fading-out';
        this.startRamp(this.duckTarget(), this.opts.fadeOutMs);
        return;
      default:
        return; // already ducking, or user is in control for this pod
    }
  }

  /** Ad ended: fade back to the exact pre-ad volume. */
  restore(): void {
    if (this.disposed) return;
    switch (this._phase) {
      case 'fading-out':
      case 'ducked':
      case 'overridden':
        this._phase = 'fading-in';
        this.expectedVolume = null;
        this.media.muted = false;
        // Unconditionally restore volume back up to at least 0.7
        const target = Math.max(this.savedVolume, 0.7);
        this.startRamp(target, this.opts.fadeInMs);
        // Direct write backup in case player's own internal script resets it
        setTimeout(() => {
          if (this._phase === 'idle' || this._phase === 'fading-in') {
            this.media.muted = false;
            if (this.media.volume < 0.2) {
              this.write(target);
            }
          }
        }, this.opts.fadeInMs + 50);
        return;
      default:
        // Even if idle, ensure not left muted
        if (this.media.muted) this.media.muted = false;
        return;
    }
  }

  /** Update the ad volume; applies live if currently ducked. */
  setAdVolume(volume: number): void {
    this.opts.adVolume = clampAdVolume(volume);
    if (this._phase === 'ducked' || this._phase === 'fading-out') {
      this._phase = 'fading-out';
      this.startRamp(this.duckTarget(), this.opts.fadeOutMs);
    }
  }

  setFadeEnabled(enabled: boolean): void {
    this.opts.fadeEnabled = enabled;
  }

  /** Stop controlling the element. If mid-ad, restore the pre-ad volume instantly. */
  dispose(): void {
    if (this.disposed) return;
    this.cancelRamp();
    if (this._phase === 'fading-out' || this._phase === 'ducked' || this._phase === 'fading-in') {
      this.write(this.savedVolume);
    }
    this._phase = 'idle';
    this.expectedVolume = null;
    this.media.removeEventListener('volumechange', this.handleVolumeChange);
    this.overrideListeners.clear();
    this.disposed = true;
  }

  // --- internals -----------------------------------------------------------

  private duckTarget(): number {
    // Never *raise* the volume during an ad.
    return Math.min(this.opts.adVolume, this.savedVolume);
  }

  private get controlling(): boolean {
    return this._phase === 'fading-out' || this._phase === 'ducked' || this._phase === 'fading-in';
  }

  private readonly handleVolumeChange = (): void => {
    if (this.controlling && this.isUserChange()) this.yieldToUser();
  };

  private isUserChange(): boolean {
    if (this.expectedVolume === null) return false;
    return (
      Math.abs(this.media.volume - this.expectedVolume) > EPSILON ||
      this.media.muted !== this.expectedMuted
    );
  }

  private yieldToUser(): void {
    this.cancelRamp();
    this.expectedVolume = null;
    if (this._phase === 'fading-in') {
      this._phase = 'idle'; // ad is already over; just stop restoring
      return;
    }
    this._phase = 'overridden';
    for (const l of this.overrideListeners) l();
  }

  private startRamp(to: number, duration: number): void {
    this.cancelRamp();
    if (!this.opts.fadeEnabled || duration <= 0) {
      this.write(to);
      this.finishPhase();
      return;
    }
    this.ramp = { from: this.media.volume, to, start: this.opts.now(), duration };
    this.tick();
  }

  private readonly tick = (): void => {
    this.timer = null;
    const ramp = this.ramp;
    if (!ramp) return;
    if (this.isUserChange()) {
      this.yieldToUser();
      return;
    }
    const p = Math.min(1, (this.opts.now() - ramp.start) / ramp.duration);
    this.write(rampValue(ramp.from, ramp.to, p));
    if (p >= 1) {
      this.ramp = null;
      this.finishPhase();
    } else {
      this.timer = this.opts.setTimer(this.tick, this.opts.tickMs);
    }
  };

  private finishPhase(): void {
    if (this._phase === 'fading-out') {
      this._phase = 'ducked';
    } else if (this._phase === 'fading-in') {
      this._phase = 'idle';
      this.expectedVolume = null;
    }
  }

  private cancelRamp(): void {
    if (this.timer !== null) this.opts.clearTimer(this.timer);
    if (this.safetyMuteTimer !== null) this.opts.clearTimer(this.safetyMuteTimer);
    this.timer = null;
    this.safetyMuteTimer = null;
    this.ramp = null;
  }

  private write(volume: number): void {
    this.media.volume = clamp01(volume);
    this.expectedVolume = this.media.volume;
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function clampAdVolume(v: number): number {
  return Number.isFinite(v) ? Math.min(AUDIO.MAX_AD_VOLUME, Math.max(0, v)) : 0;
}

