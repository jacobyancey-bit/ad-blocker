/**
 * Core detector abstractions.
 *
 * A detector locates the player + primary <video>, evaluates a list of weighted
 * signals, and combines the fired weights into one confidence score using a
 * probabilistic OR:  confidence = 1 - Π(1 - wᵢ)
 *
 *  - one strong signal (0.9) is enough on its own
 *  - weaker signals must corroborate (0.5 + 0.6 -> 0.8)
 *  - adding signals can only increase confidence, never exceed 1
 */

export interface DetectionContext {
  doc: Document;
  /** Player container, if found. Text scans are scoped to it. */
  player: Element | null;
  /** The primary <video> element, if found. */
  video: HTMLVideoElement | null;
}

export interface Signal {
  readonly id: string;
  /** 0..1 — how much this signal alone implies "an ad is playing". */
  readonly weight: number;
  test(ctx: DetectionContext): boolean;
}

export interface DetectionResult {
  confidence: number;
  /** Ids of the signals that fired (for debugging / the overlay). */
  fired: string[];
  player: Element | null;
  video: HTMLVideoElement | null;
}

export function combineWeights(weights: readonly number[]): number {
  let miss = 1;
  for (const w of weights) miss *= 1 - Math.min(1, Math.max(0, w));
  return 1 - miss;
}

export abstract class BaseDetector {
  abstract readonly id: string;
  /** Tried in order; falls back to a heuristic guess around the primary video. */
  protected abstract readonly playerSelectors: readonly string[];
  protected abstract readonly signals: readonly Signal[];

  findPlayer(doc: Document): Element | null {
    for (const sel of this.playerSelectors) {
      const el = doc.querySelector(sel);
      if (el) return el;
    }
    const video = pickPrimaryVideo(Array.from(doc.querySelectorAll('video')));
    return video ? guessPlayerContainer(video) : null;
  }

  findVideo(doc: Document, player: Element | null): HTMLVideoElement | null {
    const scoped = player ? Array.from(player.querySelectorAll('video')) : [];
    return pickPrimaryVideo(scoped.length > 0 ? scoped : Array.from(doc.querySelectorAll('video')));
  }

  detect(doc: Document = document): DetectionResult {
    const player = this.findPlayer(doc);
    const video = this.findVideo(doc, player);
    const ctx: DetectionContext = { doc, player, video };

    const fired: string[] = [];
    const weights: number[] = [];
    for (const signal of this.signals) {
      let hit = false;
      try {
        hit = signal.test(ctx);
      } catch {
        hit = false; // a broken selector must never break detection
      }
      if (hit) {
        fired.push(signal.id);
        weights.push(signal.weight);
      }
    }
    return { confidence: combineWeights(weights), fired, player, video };
  }

  /** Node to watch with a MutationObserver. */
  observeRoot(doc: Document = document): Node {
    return this.findPlayer(doc) ?? doc.body ?? doc.documentElement;
  }
}

/** Prefer a playing, loaded, large video. */
export function pickPrimaryVideo(videos: readonly HTMLVideoElement[]): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null;
  let bestScore = -1;
  for (const v of videos) {
    const playing = !v.paused && !v.ended ? 1 : 0;
    const loaded = v.readyState >= 2 ? 1 : 0;
    const area = v.clientWidth * v.clientHeight;
    // playing dominates, then loaded, then area
    const score = playing * 1e12 + loaded * 1e11 + area;
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

/** Walk up from the video to the nearest ancestor that looks like a player. */
export function guessPlayerContainer(video: HTMLVideoElement): Element | null {
  let el = video.parentElement;
  for (let depth = 0; el && depth < 8 && el !== video.ownerDocument.body; depth++) {
    const label = `${el.id} ${el.getAttribute('class') ?? ''}`;
    if (/player/i.test(label)) return el;
    el = el.parentElement;
  }
  return video.parentElement?.parentElement ?? video.parentElement;
}
