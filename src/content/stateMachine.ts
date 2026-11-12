import { DETECTION } from '../shared/constants';

export type AdState = 'NORMAL' | 'MUTED';
export type TransitionReason = 'confidence' | 'safety-timeout' | 'reset';

export interface Transition {
  from: AdState;
  to: AdState;
  reason: TransitionReason;
  /** Timestamp (ms) at which the transition happened. */
  at: number;
  /** Only on MUTED -> NORMAL: how long the ad break lasted (ms). */
  adDurationMs?: number;
}

export interface StateMachineOptions {
  /** Confidence at/above which a sample counts as "ad". */
  muteThreshold: number;
  /** Confidence at/below which a sample counts as "content". */
  unmuteThreshold: number;
  /** Consecutive "ad" time required before muting. */
  muteHoldMs: number;
  /** Consecutive "content" time required before unmuting. */
  unmuteHoldMs: number;
  /** Max time to stay MUTED before forcing NORMAL. */
  safetyTimeoutMs: number;
}

export type TransitionListener = (t: Transition) => void;

const DEFAULTS: StateMachineOptions = {
  muteThreshold: DETECTION.MUTE_CONFIDENCE,
  unmuteThreshold: DETECTION.UNMUTE_CONFIDENCE,
  muteHoldMs: DETECTION.MUTE_HOLD_MS,
  unmuteHoldMs: DETECTION.UNMUTE_HOLD_MS,
  safetyTimeoutMs: DETECTION.SAFETY_TIMEOUT_MS,
};

/**
 * Debounced ad-state machine with hysteresis.
 *
 *  NORMAL -> MUTED   when confidence >= muteThreshold for muteHoldMs consecutively.
 *  MUTED  -> NORMAL  when confidence <= unmuteThreshold for unmuteHoldMs consecutively.
 *  MUTED  -> NORMAL  forced after safetyTimeoutMs (missed end-of-ad signal).
 *
 * Samples in the dead band (between the thresholds) break any pending streak.
 * After a safety timeout the machine stays "disarmed" — it won't re-mute until it
 * has seen at least one content sample — so a stuck detector can't cause a mute loop.
 *
 * The machine never reads the clock: callers pass `now` (ms) to every call.
 */
export class AdStateMachine {
  private readonly opts: StateMachineOptions;
  private readonly listeners = new Set<TransitionListener>();

  private _state: AdState = 'NORMAL';
  /** When the current qualifying streak started, or null if no streak. */
  private streakStart: number | null = null;
  /** When we entered MUTED. */
  private mutedAt: number | null = null;
  /** False after a safety timeout until a content sample is seen. */
  private armed = true;

  constructor(options: Partial<StateMachineOptions> = {}) {
    this.opts = { ...DEFAULTS, ...options };
    if (this.opts.unmuteThreshold >= this.opts.muteThreshold) {
      throw new Error('unmuteThreshold must be lower than muteThreshold');
    }
  }

  get state(): AdState {
    return this._state;
  }

  get isArmed(): boolean {
    return this.armed;
  }

  /** Subscribe to transitions. Returns an unsubscribe function. */
  onTransition(listener: TransitionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Feed one confidence sample. Returns the transition if one occurred. */
  update(confidence: number, now: number): Transition | null {
    const c = normalize(confidence);

    if (this._state === 'MUTED') {
      if (this.mutedAt !== null && now - this.mutedAt >= this.opts.safetyTimeoutMs) {
        this.armed = false;
        return this.transition('NORMAL', 'safety-timeout', now);
      }
      if (c !== null && c <= this.opts.unmuteThreshold) {
        this.streakStart ??= now;
        if (now - this.streakStart >= this.opts.unmuteHoldMs) {
          return this.transition('NORMAL', 'confidence', now);
        }
      } else {
        this.streakStart = null;
      }
      return null;
    }

    // NORMAL
    if (c !== null && c <= this.opts.unmuteThreshold) {
      this.armed = true;
    }
    if (this.armed && c !== null && c >= this.opts.muteThreshold) {
      this.streakStart ??= now;
      if (now - this.streakStart >= this.opts.muteHoldMs) {
        return this.transition('MUTED', 'confidence', now);
      }
    } else {
      this.streakStart = null;
    }
    return null;
  }

  /** Force NORMAL (e.g. user paused detection or navigated away). */
  reset(now: number): Transition | null {
    this.armed = true;
    if (this._state === 'MUTED') {
      return this.transition('NORMAL', 'reset', now);
    }
    this.streakStart = null;
    return null;
  }

  private transition(to: AdState, reason: TransitionReason, now: number): Transition {
    const t: Transition = { from: this._state, to, reason, at: now };
    if (to === 'NORMAL' && this.mutedAt !== null) {
      t.adDurationMs = now - this.mutedAt;
    }
    this._state = to;
    this.streakStart = null;
    this.mutedAt = to === 'MUTED' ? now : null;
    for (const l of this.listeners) l(t);
    return t;
  }
}

/** Clamp to [0, 1]; non-finite values are "unknown" and break streaks. */
function normalize(confidence: number): number | null {
  if (!Number.isFinite(confidence)) return null;
  return Math.min(1, Math.max(0, confidence));
}

