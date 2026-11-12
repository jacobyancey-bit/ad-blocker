/**
 * In-page debug overlay and DOM snapshot capture helper.
 * Enabled via Alt+Shift+D or by setting debugMode in settings.
 */

export interface OverlayState {
  detectorId: string;
  confidence: number;
  fired: string[];
  state: string;
  volume: number;
}

export class DebugOverlay {
  private container: HTMLDivElement | null = null;
  private confidenceEl: HTMLElement | null = null;
  private stateEl: HTMLElement | null = null;
  private firedEl: HTMLElement | null = null;
  private volumeEl: HTMLElement | null = null;
  private visible = false;

  constructor(
    private readonly onCapture: (type: 'ad' | 'content') => void,
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        this.toggle();
      }
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.mount();
    } else {
      this.unmount();
    }
  }

  update(state: OverlayState): void {
    if (!this.visible || !this.container) return;
    if (this.confidenceEl) {
      this.confidenceEl.textContent = `${(state.confidence * 100).toFixed(0)}%`;
      this.confidenceEl.style.color = state.confidence >= 0.8 ? '#f59e0b' : '#10b981';
    }
    if (this.stateEl) {
      this.stateEl.textContent = state.state;
    }
    if (this.volumeEl) {
      this.volumeEl.textContent = `${Math.round(state.volume * 100)}%`;
    }
    if (this.firedEl) {
      this.firedEl.textContent = state.fired.length > 0 ? state.fired.join(', ') : 'none';
    }
  }

  private mount(): void {
    if (this.container) return;
    const div = document.createElement('div');
    div.id = 'admute-debug-overlay';
    div.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      background: rgba(15, 17, 21, 0.95);
      color: #e5e7eb;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11px;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      width: 260px;
      pointer-events: auto;
    `;

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="color:#f59e0b; font-size:12px;">AdMute Debugger</strong>
        <span style="cursor:pointer; opacity:0.6;" id="admute-dbg-close">✕</span>
      </div>
      <div style="display:grid; grid-template-columns: 80px 1fr; row-gap:4px; margin-bottom:10px;">
        <div>State:</div><div id="admute-dbg-state">NORMAL</div>
        <div>Confidence:</div><div id="admute-dbg-conf" style="font-weight:bold;">0%</div>
        <div>Volume:</div><div id="admute-dbg-vol">100%</div>
        <div>Fired:</div><div id="admute-dbg-fired" style="word-break:break-all; opacity:0.8;">none</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button id="admute-btn-snap-ad" style="flex:1; background:#ef4444; color:white; border:none; padding:4px 6px; border-radius:4px; cursor:pointer; font-size:10px; font-weight:600;">Snap [Ad]</button>
        <button id="admute-btn-snap-content" style="flex:1; background:#3b82f6; color:white; border:none; padding:4px 6px; border-radius:4px; cursor:pointer; font-size:10px; font-weight:600;">Snap [Show]</button>
      </div>
    `;

    document.documentElement.appendChild(div);
    this.container = div;
    this.confidenceEl = div.querySelector('#admute-dbg-conf');
    this.stateEl = div.querySelector('#admute-dbg-state');
    this.volumeEl = div.querySelector('#admute-dbg-vol');
    this.firedEl = div.querySelector('#admute-dbg-fired');

    div.querySelector('#admute-dbg-close')?.addEventListener('click', () => this.toggle());
    div.querySelector('#admute-btn-snap-ad')?.addEventListener('click', () => this.onCapture('ad'));
    div.querySelector('#admute-btn-snap-content')?.addEventListener('click', () => this.onCapture('content'));
  }

  private unmount(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

/**
 * Strips personal scripts/identifying details and triggers a client-side download
 * of player markup so it can be added to tests/detectors/fixtures/<site>/
 */
export function downloadSnapshot(player: Element | null, site: string, type: 'ad' | 'content'): void {
  const root = player ? player.cloneNode(true) as HTMLElement : document.body.cloneNode(true) as HTMLElement;
  // Strip scripts, iframes, and sensitive input fields
  root.querySelectorAll('script, iframe, input, meta, link').forEach((el) => el.remove());

  const html = `<!-- Snapshot captured from ${site} [${type}] on ${new Date().toISOString()} -->\n` + root.outerHTML;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}--${site}-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
