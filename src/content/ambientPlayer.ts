import type { AmbientSound } from '../shared/types';

/**
 * MP3-based Ambient Sound Player.
 * Plays high-quality recorded soundscapes located in public/sounds/:
 *   - rain.mp3
 *   - stream.mp3
 *   - forest.mp3
 * Includes smooth volume fade-in and fade-out ramps.
 */

export class AmbientPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentSound: AmbientSound = 'none';
  private isPlaying = false;
  private fadeInterval: number | null = null;

  setSound(sound: AmbientSound): void {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.stop();
    }
    this.currentSound = sound;
    if (wasPlaying && sound !== 'none') {
      this.play();
    }
  }

  play(): void {
    if (this.currentSound === 'none' || this.isPlaying) return;
    this.isPlaying = true;

    try {
      this.clearFade();
      const soundFile = `${this.currentSound}.mp3`;
      const url = chrome.runtime.getURL(`sounds/${soundFile}`);

      if (!this.audio) {
        this.audio = new Audio();
        this.audio.loop = true;
      }

      this.audio.src = url;
      this.audio.volume = 0.05; // Start quiet

      const playPromise = this.audio.play();
      if (playPromise) {
        playPromise.catch((err) => {
          console.warn('[AdMute] Ambient audio play error:', err);
        });
      }

      // Smooth fade-in to pleasant background volume (default 0.25) over 400ms
      const targetVolume = 0.25;
      const step = 0.02;
      this.fadeInterval = window.setInterval(() => {
        if (!this.audio) {
          this.clearFade();
          return;
        }
        if (this.audio.volume < targetVolume) {
          this.audio.volume = Math.min(targetVolume, this.audio.volume + step);
        } else {
          this.clearFade();
        }
      }, 30);
    } catch (err) {
      console.warn('[AdMute] Ambient audio initialization skipped:', err);
    }
  }

  stop(): void {
    if (!this.isPlaying || !this.audio) return;
    this.isPlaying = false;

    this.clearFade();
    // Smooth fade-out over 250ms
    const step = 0.03;
    this.fadeInterval = window.setInterval(() => {
      if (!this.audio) {
        this.clearFade();
        return;
      }
      if (this.audio.volume > step) {
        this.audio.volume = Math.max(0, this.audio.volume - step);
      } else {
        this.clearFade();
        this.audio.pause();
        this.audio.currentTime = 0;
      }
    }, 25);
  }

  private clearFade(): void {
    if (this.fadeInterval !== null) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
}
