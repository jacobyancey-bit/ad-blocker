/**
 * Visual Dimmer Overlay.
 * Injects a smooth, semi-transparent backdrop over the video element during ads.
 * Leaves pointer-events: none so user can still click Skip Ad or player controls.
 */

export class VideoDimmer {
  private overlay: HTMLDivElement | null = null;
  private currentParent: Element | null = null;
  private isDimmed = false;

  attach(target: Element): void {
    if (this.currentParent === target && this.overlay) return;
    this.detach();

    this.currentParent = target;
    const div = document.createElement('div');
    div.className = 'admute-video-dimmer';
    div.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 100;
      pointer-events: none;
      opacity: 0;
      transition: opacity 300ms ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.7);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      letter-spacing: 0.5px;
    `;

    div.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.5); padding:8px 16px; border-radius:20px; border:1px solid rgba(255,255,255,0.1);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
        <span style="font-weight:500;">Ad Muted</span>
      </div>
    `;

    // Ensure parent has relative/absolute positioning so inset:0 covers it accurately
    const computed = window.getComputedStyle(target);
    if (computed.position === 'static') {
      (target as HTMLElement).style.position = 'relative';
    }

    target.appendChild(div);
    this.overlay = div;

    if (this.isDimmed) {
      this.overlay.style.opacity = '1';
    }
  }

  dim(): void {
    this.isDimmed = true;
    if (this.overlay) {
      this.overlay.style.opacity = '1';
    }
  }

  undim(): void {
    this.isDimmed = false;
    if (this.overlay) {
      this.overlay.style.opacity = '0';
    }
  }

  detach(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.currentParent = null;
  }
}
