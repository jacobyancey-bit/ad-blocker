import type { DetectionContext, Signal } from './BaseDetector';

/** Reusable signal factories shared by all site adapters. */

const MAX_TEXT_LENGTH = 80;
const MAX_TEXT_NODES = 1500;

/** Visible = connected and no ancestor (up to <body>) is hidden / display:none / visibility:hidden / opacity:0. */
export function isVisible(el: Element): boolean {
  if (!el.isConnected) return false;
  const doc = el.ownerDocument;
  const view = doc.defaultView;
  for (let node: Element | null = el; node && node !== doc.body; node = node.parentElement) {
    if (node.hasAttribute('hidden')) return false;
    const style = view?.getComputedStyle(node);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
      return false;
    }
  }
  return true;
}

/** Elements matching `selector` within `root`, including `root` itself. */
export function queryAllIncluding(root: Document | Element, selector: string): Element[] {
  const out: Element[] = [];
  if (root instanceof Element && root.matches(selector)) out.push(root);
  out.push(...Array.from(root.querySelectorAll(selector)));
  return out;
}

/**
 * Selector matching classes that *start with* one of the given names, either as a whole
 * class or as a BEM / CSS-module segment. Avoids substring false positives such as
 * `ad-countdown` matching `load-countdown`.
 */
export function classPrefix(...names: string[]): string {
  return names
    .flatMap((n) => [`[class^="${n}"]`, `[class*=" ${n}"]`, `[class*="__${n}"]`])
    .join(', ');
}

export interface SelectorSignalOptions {
  /** Search inside the player (default) or the whole document. */
  scope?: 'player' | 'document';
  /** Require the element to be visible (default true). */
  visible?: boolean;
  /** Require non-empty content (text or child elements). */
  nonEmpty?: boolean;
  /** Require the element's text to match. */
  text?: RegExp;
}

export function selectorSignal(
  id: string,
  selector: string,
  weight: number,
  opts: SelectorSignalOptions = {},
): Signal {
  const { scope = 'player', visible = true, nonEmpty = false, text } = opts;
  return {
    id,
    weight,
    test(ctx: DetectionContext): boolean {
      const root = scope === 'player' ? (ctx.player ?? ctx.doc) : ctx.doc;
      for (const el of queryAllIncluding(root, selector)) {
        if (nonEmpty && el.childElementCount === 0 && !el.textContent?.trim()) continue;
        if (text && !text.test(normalize(el.textContent))) continue;
        if (visible && !isVisible(el)) continue;
        return true;
      }
      return false;
    },
  };
}

/**
 * Scans visible short text inside the player. Each text node is tested along with its
 * parent's and grandparent's text, so labels split across spans ("Ad" + "1 of 2") match.
 * Never scans outside the player — "Sponsored" in a page sidebar must not count.
 */
export function textScanSignal(id: string, pattern: RegExp, weight: number): Signal {
  return {
    id,
    weight,
    test(ctx: DetectionContext): boolean {
      if (!ctx.player) return false;
      const walker = ctx.doc.createTreeWalker(ctx.player, NodeFilter.SHOW_TEXT);
      const checked = new Set<Element>();
      let count = 0;
      for (let node = walker.nextNode(); node && count < MAX_TEXT_NODES; node = walker.nextNode()) {
        count++;
        const own = normalize(node.textContent);
        if (!own) continue;
        const parent = node.parentElement;
        // Text from a hidden element must not leak in via an ancestor's textContent.
        if (!parent || !isVisible(parent)) continue;
        const grandparent = parent.parentElement;

        const candidates: Array<[string, Element | null]> = [[own, parent]];
        for (const el of [parent, grandparent]) {
          if (el && !checked.has(el)) {
            checked.add(el);
            candidates.push([normalize(el.textContent), el]);
          }
        }
        for (const [text, el] of candidates) {
          if (text.length > MAX_TEXT_LENGTH || !pattern.test(text)) continue;
          if (el && isVisible(el)) return true;
        }
      }
      return false;
    },
  };
}

/**
 * Text patterns common to most streaming players. Weights are tuned so only
 * unambiguous phrases can mute on their own; the rest must corroborate.
 */
export function commonTextSignals(): Signal[] {
  return [
    textScanSignal('text:ad-pod', /\bad\s*\d+\s*(?:of|\/)\s*\d+\b/i, 0.85),
    textScanSignal('text:commercial-break-active', /\bcommercial break\s+(?:in progress|will end|ends)\b/i, 0.85),
    textScanSignal('text:commercial-break', /\bcommercial break\b/i, 0.5),
    textScanSignal(
      'text:will-resume',
      /\b(?:video|show|program|programme|content|stream|episode)\s+will\s+(?:resume|play|begin|start)\b/i,
      0.75,
    ),
    textScanSignal('text:ad-ends-in', /\b(?:ad|ads|advertisement)\s+(?:ends?|ending|remaining)\b/i, 0.75),
    textScanSignal('text:ad-timer', /^(?:ad|advertisement)\s*[·•:|-]?\s*\d{1,2}:\d{2}$/i, 0.6),
    textScanSignal('text:skip-ad', /^skip\s+ads?$/i, 0.6),
    textScanSignal('text:ad-label', /^(?:ad|ads|advertisement)$/i, 0.5),
    textScanSignal('text:sponsored', /^sponsored$/i, 0.4),
  ];
}

/**
 * Stateful: fires when the video becomes short (<= 120s) after a long (>= 5 min) video
 * was seen on this page — typical of an ad swapped into the player. Supporting signal
 * only; too weak to mute on its own (autoplaying a short clip is legitimate).
 */
export function shortMediaSwapSignal(weight = 0.4): Signal {
  let longest = 0;
  return {
    id: 'media:short-swap',
    weight,
    test({ video }: DetectionContext): boolean {
      if (!video) return false;
      const d = video.duration;
      if (!Number.isFinite(d) || d <= 0) return false;
      if (d >= 300) {
        longest = Math.max(longest, d);
        return false;
      }
      return longest >= 300 && d <= 120;
    },
  };
}

function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}
