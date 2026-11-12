import { describe, expect, it, vi } from 'vitest';
import { AdStateMachine } from '../src/content/stateMachine';

const POLL = 300;

/** Feed a constant confidence from `start` to `end` (inclusive) every `step` ms. */
function feed(sm: AdStateMachine, confidence: number, start: number, end: number, step = POLL) {
  const transitions = [];
  for (let t = start; t <= end; t += step) {
    const tr = sm.update(confidence, t);
    if (tr) transitions.push(tr);
  }
  return transitions;
}

describe('AdStateMachine — NORMAL -> MUTED', () => {
  it('starts NORMAL', () => {
    expect(new AdStateMachine().state).toBe('NORMAL');
  });

  it('does not mute before 600ms of high confidence', () => {
    const sm = new AdStateMachine();
    sm.update(0.9, 0);
    sm.update(0.9, 300);
    sm.update(0.9, 599);
    expect(sm.state).toBe('NORMAL');
  });

  it('mutes at exactly 600ms of consecutive high confidence', () => {
    const sm = new AdStateMachine();
    sm.update(0.9, 0);
    const t = sm.update(0.8, 600); // 0.8 is inclusive
    expect(t).toMatchObject({ from: 'NORMAL', to: 'MUTED', reason: 'confidence', at: 600 });
    expect(sm.state).toBe('MUTED');
  });

  it('a dead-band sample breaks the streak', () => {
    const sm = new AdStateMachine();
    sm.update(0.9, 0);
    sm.update(0.9, 300);
    sm.update(0.5, 450); // flicker
    sm.update(0.9, 600);
    sm.update(0.9, 900);
    expect(sm.state).toBe('NORMAL');
    sm.update(0.9, 1200); // 600ms since streak restarted at 600
    expect(sm.state).toBe('MUTED');
  });

  it('a low sample breaks the streak', () => {
    const sm = new AdStateMachine();
    sm.update(0.95, 0);
    sm.update(0.1, 300);
    sm.update(0.95, 600);
    expect(sm.state).toBe('NORMAL');
  });

  it('non-finite confidence breaks the streak', () => {
    const sm = new AdStateMachine();
    sm.update(0.9, 0);
    sm.update(Number.NaN, 300);
    sm.update(0.9, 600);
    expect(sm.state).toBe('NORMAL');
  });

  it('clamps out-of-range confidence', () => {
    const sm = new AdStateMachine();
    sm.update(5, 0);
    sm.update(5, 600);
    expect(sm.state).toBe('MUTED');
  });
});

describe('AdStateMachine — MUTED -> NORMAL', () => {
  function muted() {
    const sm = new AdStateMachine();
    sm.update(1, 0);
    sm.update(1, 600);
    expect(sm.state).toBe('MUTED');
    return sm;
  }

  it('does not unmute before 1000ms of low confidence', () => {
    const sm = muted();
    sm.update(0.1, 10_000);
    sm.update(0.1, 10_999);
    expect(sm.state).toBe('MUTED');
  });

  it('unmutes at exactly 1000ms of consecutive low confidence and reports duration', () => {
    const sm = muted();
    sm.update(0.2, 10_000); // 0.2 is inclusive
    const t = sm.update(0.0, 11_000);
    expect(t).toMatchObject({
      from: 'MUTED',
      to: 'NORMAL',
      reason: 'confidence',
      at: 11_000,
      adDurationMs: 10_400,
    });
  });

  it('a dead-band or high sample breaks the unmute streak', () => {
    const sm = muted();
    sm.update(0.1, 10_000);
    sm.update(0.5, 10_500);
    sm.update(0.1, 10_800);
    sm.update(0.1, 11_500);
    expect(sm.state).toBe('MUTED');
    sm.update(0.1, 11_800);
    expect(sm.state).toBe('NORMAL');
  });

  it('brief content flicker between two ads in a pod does not unmute', () => {
    const sm = muted();
    feed(sm, 0.9, 900, 30_000);
    feed(sm, 0.0, 30_300, 30_900); // 600ms gap between ads
    feed(sm, 0.9, 31_200, 60_000);
    expect(sm.state).toBe('MUTED');
  });
});

describe('AdStateMachine — safety timeout', () => {
  const SAFETY = 3.5 * 60 * 1000;

  function muted() {
    const sm = new AdStateMachine();
    sm.update(1, 0);
    sm.update(1, 600);
    return sm;
  }

  it('stays MUTED just before 3.5 minutes', () => {
    const sm = muted();
    feed(sm, 1, 900, 600 + SAFETY - 1, 1000);
    expect(sm.state).toBe('MUTED');
  });

  it('forces NORMAL at 3.5 minutes even while confidence stays high', () => {
    const sm = muted();
    const t = sm.update(1, 600 + SAFETY);
    expect(t).toMatchObject({ to: 'NORMAL', reason: 'safety-timeout', adDurationMs: SAFETY });
    expect(sm.isArmed).toBe(false);
  });

  it('does not re-mute a stuck detector after a safety timeout', () => {
    const sm = muted();
    sm.update(1, 600 + SAFETY);
    const transitions = feed(sm, 1, 600 + SAFETY + 300, 600 + SAFETY + 60_000);
    expect(transitions).toHaveLength(0);
    expect(sm.state).toBe('NORMAL');
  });

  it('re-arms after a content sample and can mute again', () => {
    const sm = muted();
    const base = 600 + SAFETY;
    sm.update(1, base);
    sm.update(0.1, base + 300); // content seen -> re-armed
    expect(sm.isArmed).toBe(true);
    sm.update(0.9, base + 600);
    sm.update(0.9, base + 1200);
    expect(sm.state).toBe('MUTED');
  });

  it('fires even if confidence oscillates in the dead band', () => {
    const sm = muted();
    for (let t = 900; t < 600 + SAFETY; t += POLL) sm.update(t % 600 === 0 ? 0.5 : 0.9, t);
    expect(sm.state).toBe('MUTED');
    expect(sm.update(0.5, 600 + SAFETY)?.reason).toBe('safety-timeout');
  });
});

describe('AdStateMachine — reset & listeners', () => {
  it('reset() while MUTED emits a reset transition', () => {
    const sm = new AdStateMachine();
    sm.update(1, 0);
    sm.update(1, 600);
    const t = sm.reset(5_000);
    expect(t).toMatchObject({ to: 'NORMAL', reason: 'reset', adDurationMs: 4_400 });
  });

  it('reset() while NORMAL clears a pending streak and returns null', () => {
    const sm = new AdStateMachine();
    sm.update(1, 0);
    sm.update(1, 300);
    expect(sm.reset(400)).toBeNull();
    sm.update(1, 600);
    expect(sm.state).toBe('NORMAL');
  });

  it('notifies listeners and supports unsubscribe', () => {
    const sm = new AdStateMachine();
    const spy = vi.fn();
    const off = sm.onTransition(spy);
    sm.update(1, 0);
    sm.update(1, 600);
    expect(spy).toHaveBeenCalledTimes(1);
    off();
    feed(sm, 0, 900, 3_000);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(sm.state).toBe('NORMAL');
  });

  it('honours custom options and validates thresholds', () => {
    const sm = new AdStateMachine({ muteHoldMs: 100 });
    sm.update(1, 0);
    sm.update(1, 100);
    expect(sm.state).toBe('MUTED');
    expect(() => new AdStateMachine({ muteThreshold: 0.3, unmuteThreshold: 0.5 })).toThrow();
  });
});

