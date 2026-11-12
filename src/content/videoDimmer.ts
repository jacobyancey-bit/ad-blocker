/**
 * Visual Dimmer Overlay.
 * Injects a smooth, semi-transparent backdrop over the video element during ads.
 * Leaves pointer-events: none so user can still click Skip Ad or player controls.
 */

export class VideoDimmer {
  private overlay: HTMLDivElement | null = null;
  private currentParent: Element | null = null;
  private isDimmed = false;
  private onSelectSound?: (sound: string) => void;

  setSoundCallback(cb: (sound: string) => void): void {
    this.onSelectSound = cb;
  }

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
      pointer-events: auto;
      opacity: 0;
      transition: opacity 300ms ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.9);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      gap: 16px;
    `;

    div.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; background:rgba(20,20,25,0.7); padding:8px 18px; border-radius:24px; border:1px solid rgba(255,255,255,0.15); box-shadow:0 4px 16px rgba(0,0,0,0.5);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
        <span style="font-weight:600; color:#f3f4f6; letter-spacing:0.3px;">Commercial Muted</span>
      </div>

      <!-- On-Screen Quick Sound Selector -->
      <div style="display:flex; flex-direction:column; align-items:center; gap:8px; background:rgba(15,17,23,0.85); padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); backdrop-filter:blur(10px);">
        <span style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Soundscape</span>
        <div style="display:flex; gap:8px;">
          <button type="button" class="admute-sound-btn" data-sound="none" style="background:#202636; border:1px solid rgba(255,255,255,0.1); color:#e5e7eb; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:12px; font-weight:500; display:flex; align-items:center; gap:5px; transition:all 0.15s ease;">
            <span>🔇</span><span>Silent</span>
          </button>
          <button type="button" class="admute-sound-btn" data-sound="rain" style="background:#202636; border:1px solid rgba(255,255,255,0.1); color:#e5e7eb; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:12px; font-weight:500; display:flex; align-items:center; gap:5px; transition:all 0.15s ease;">
            <span>🌧️</span><span>Rain</span>
          </button>
          <button type="button" class="admute-sound-btn" data-sound="stream" style="background:#202636; border:1px solid rgba(255,255,255,0.1); color:#e5e7eb; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:12px; font-weight:500; display:flex; align-items:center; gap:5px; transition:all 0.15s ease;">
            <span>💧</span><span>Stream</span>
          </button>
          <button type="button" class="admute-sound-btn" data-sound="forest" style="background:#202636; border:1px solid rgba(255,255,255,0.1); color:#e5e7eb; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:12px; font-weight:500; display:flex; align-items:center; gap:5px; transition:all 0.15s ease;">
            <span>🌲</span><span>Forest</span>
          </button>
        </div>
      </div>
    `;

    // Hook up sound buttons
    div.querySelectorAll<HTMLButtonElement>('.admute-sound-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sound = btn.dataset.sound || 'none';
        this.highlightActiveButton(div, sound);
        this.onSelectSound?.(sound);
      });
    });

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

  private highlightActiveButton(root: HTMLElement, sound: string): void {
    root.querySelectorAll<HTMLButtonElement>('.admute-sound-btn').forEach((btn) => {
      const active = btn.dataset.sound === sound;
      btn.style.background = active ? 'rgba(245, 158, 11, 0.2)' : '#202636';
      btn.style.borderColor = active ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)';
      btn.style.color = active ? '#ffffff' : '#e5e7eb';
    });
  }

  dim(currentSound = 'none'): void {
    this.isDimmed = true;
    if (this.overlay) {
      this.highlightActiveButton(this.overlay, currentSound);
      this.overlay.style.opacity = '1';
      this.overlay.style.pointerEvents = 'auto';
    }
  }

  undim(): void {
    this.isDimmed = false;
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      this.overlay.style.pointerEvents = 'none';
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

