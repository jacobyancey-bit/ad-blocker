import { AmbientPlayer } from './ambientPlayer';
import { AudioController } from './audioController';
import { DebugOverlay, downloadSnapshot } from './debugOverlay';
import { createDetector } from './detectors/registry';
import { AdStateMachine, type Transition } from './stateMachine';
import { VideoDimmer } from './videoDimmer';
import { DETECTION } from '../shared/constants';
import type { ContentToBackground, StatusResponse, ToContent } from '../shared/messages';
import { getSettings, isDomainEnabled, updateSettings } from '../shared/storage';
import type { Settings, TabStatus } from '../shared/types';

/**
 * Step 5: Content script orchestrator.
 * Connects BaseDetector -> AdStateMachine -> AudioController.
 */

const hostname = location.hostname;
const detector = createDetector(hostname);
const stateMachine = new AdStateMachine();
const dimmer = new VideoDimmer();
const ambientPlayer = new AmbientPlayer();
const overlay = new DebugOverlay((type) => {
  const result = detector.detect(document);
  downloadSnapshot(result.player, detector.id, type);
});

let settings: Settings | null = null;
let audioController: AudioController | null = null;
let currentVideo: HTMLVideoElement | null = null;
let currentStatus: TabStatus = 'MONITORING';
let isPaused = false;
let pollTimer: number | null = null;
let observer: MutationObserver | null = null;

async function init(): Promise<void> {
  settings = await getSettings();
  ambientPlayer.setSound(settings.ambientSound);
  dimmer.setSoundCallback(async (sound) => {
    const s = sound as any;
    ambientPlayer.setSound(s);
    ambientPlayer.play();
    await updateSettings({ ambientSound: s });
  });
  if (!isDomainEnabled(settings, hostname)) {
    setStatus('DISABLED');
    return;
  }
  setStatus('MONITORING');
  startDetection();
}

function setStatus(next: TabStatus): void {
  if (currentStatus === next) return;
  currentStatus = next;
  const msg: ContentToBackground = { type: 'STATUS_CHANGED', status: next };
  try {
    chrome.runtime.sendMessage(msg);
  } catch {
    // Service worker may be asleep or inactive
  }
}

function syncAudioController(video: HTMLVideoElement | null, player: Element | null): void {
  if (player) {
    dimmer.attach(player);
  } else if (video?.parentElement) {
    dimmer.attach(video.parentElement);
  }

  if (video === currentVideo && audioController) return;
  if (audioController) {
    audioController.dispose();
    audioController = null;
  }
  currentVideo = video;
  if (!video || !settings) return;

  audioController = new AudioController(video, {
    adVolume: settings.adVolume,
    fadeEnabled: settings.fadeEnabled,
  });

  // If the state machine was already in MUTED when the video mounted, duck immediately
  if (stateMachine.state === 'MUTED' && !isPaused && currentStatus !== 'DISABLED') {
    audioController.duck();
    if (settings.dimOverlayEnabled) dimmer.dim();
    ambientPlayer.play();
  }
}

// React to state machine transitions
stateMachine.onTransition((transition: Transition) => {
  if (isPaused || currentStatus === 'DISABLED') return;

  if (transition.to === 'MUTED') {
    setStatus('AD_MUTED');
    audioController?.duck();
    if (settings?.dimOverlayEnabled) {
      dimmer.dim(settings.ambientSound);
    }
    ambientPlayer.play();
  } else if (transition.to === 'NORMAL') {
    setStatus('MONITORING');
    audioController?.restore();
    dimmer.undim();
    ambientPlayer.stop();

    if (transition.adDurationMs && transition.adDurationMs > 0) {
      const msg: ContentToBackground = {
        type: 'AD_BREAK_ENDED',
        durationSeconds: Math.round(transition.adDurationMs / 1000),
      };
      try {
        chrome.runtime.sendMessage(msg);
      } catch {
        // Ignore
      }
    }
  }
});

function tick(): void {
  if (isPaused || currentStatus === 'DISABLED') return;

  const now = performance.now();
  const result = detector.detect(document);
  syncAudioController(result.video, result.player);

  stateMachine.update(result.confidence, now);



  overlay.update({
    detectorId: detector.id,
    confidence: result.confidence,
    fired: result.fired,
    state: stateMachine.state,
    volume: result.video ? result.video.volume : 0,
  });
}

function startDetection(): void {
  stopDetection();

  // 1. Periodic poll every 300ms
  pollTimer = window.setInterval(tick, DETECTION.POLL_INTERVAL_MS);

  // 2. Event-driven observer on player/DOM changes with 100ms throttle
  let debounceTimeout: number | null = null;
  const root = detector.observeRoot(document);

  observer = new MutationObserver(() => {
    if (debounceTimeout !== null) return;
    debounceTimeout = window.setTimeout(() => {
      debounceTimeout = null;
      tick();
    }, 100);
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'aria-label', 'data-testid', 'hidden'],
  });

  // Initial immediate sample
  tick();
}

function stopDetection(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  stateMachine.reset(performance.now());
  audioController?.restore();
  dimmer.undim();
  ambientPlayer.stop();
}

// Listen for messages from popup or background service worker
chrome.runtime.onMessage.addListener((msg: ToContent, _sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    const res: StatusResponse = { status: currentStatus, hostname };
    sendResponse(res);
    return false;
  }

  if (msg.type === 'TOGGLE_PAUSE') {
    isPaused = !isPaused;
    if (isPaused) {
      setStatus('PAUSED');
      audioController?.restore();
      dimmer.undim();
      ambientPlayer.stop();
      stateMachine.reset(performance.now());
    } else {
      setStatus('MONITORING');
      tick();
    }
    const res: StatusResponse = { status: currentStatus, hostname };
    sendResponse(res);
    return false;
  }

  return false;
});

// React live to settings changes saved by the popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.settings) return;
  const next = changes.settings.newValue as Settings;
  settings = next;

  const enabled = isDomainEnabled(next, hostname);
  if (!enabled && currentStatus !== 'DISABLED') {
    setStatus('DISABLED');
    stopDetection();
  } else if (enabled && currentStatus === 'DISABLED') {
    setStatus('MONITORING');
    startDetection();
  }

  if (audioController) {
    audioController.setAdVolume(next.adVolume);
    audioController.setFadeEnabled(next.fadeEnabled);
  }
  ambientPlayer.setSound(next.ambientSound);
  if (!next.dimOverlayEnabled) {
    dimmer.undim();
  } else if (stateMachine.state === 'MUTED') {
    dimmer.dim();
  }
});

void init();
