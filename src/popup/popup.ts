import { PWYW } from '../shared/constants';
import type { StatusResponse, ToContent } from '../shared/messages';
import {
  getSettings,
  getStats,
  getSupporter,
  isDomainEnabled,
  updateSettings,
  updateSupporter,
} from '../shared/storage';
import type { AmbientSound, Settings, SupporterState, TabStatus } from '../shared/types';

/**
 * Step 7: Popup UI Logic.
 * Handles live status sync, toggles, audio sliders, PWYW supporter perks, and custom theme accents.
 */

// DOM Elements
const statusPill = document.getElementById('status-pill')!;
const domainToggle = document.getElementById('domain-toggle') as HTMLInputElement;
const domainCaption = document.getElementById('domain-caption')!;
const statsAds = document.getElementById('stats-ads')!;
const statsTime = document.getElementById('stats-time')!;
const adVolumeSlider = document.getElementById('ad-volume-slider') as HTMLInputElement;
const adVolumeLabel = document.getElementById('ad-volume-label')!;
const ambientCurrentLabel = document.getElementById('ambient-current-label')!;
const soundButtons = document.querySelectorAll<HTMLButtonElement>('.btn-sound');
const dimmerToggle = document.getElementById('dimmer-toggle') as HTMLInputElement;
const fadeToggle = document.getElementById('fade-toggle') as HTMLInputElement;
const supporterBadge = document.getElementById('supporter-badge')!;
const pwywCard = document.getElementById('pwyw-card')!;
const pwywAdsCount = document.getElementById('pwyw-ads-count')!;
const btnToggleSupporter = document.getElementById('btn-toggle-supporter') as HTMLButtonElement;
const supporterPerks = document.getElementById('supporter-perks')!;
const colorDots = document.querySelectorAll<HTMLButtonElement>('.color-dot');

let currentHostname = '';
let currentSettings: Settings;
let currentSupporter: SupporterState;

function applyThemeAccent(color: string): void {
  document.documentElement.style.setProperty('--accent', color);
  // Parse hex to RGB for alpha highlights
  const hex = color.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  }
}

function updateStatusBadge(status: TabStatus): void {
  statusPill.className = 'status-pill';
  switch (status) {
    case 'AD_MUTED':
      statusPill.classList.add('status-ad-muted');
      statusPill.textContent = 'Ad Muted';
      break;
    case 'PAUSED':
      statusPill.classList.add('status-paused');
      statusPill.textContent = 'Paused';
      break;
    case 'DISABLED':
      statusPill.classList.add('status-disabled');
      statusPill.textContent = 'Disabled';
      break;
    case 'UNSUPPORTED':
      statusPill.classList.add('status-disabled');
      statusPill.textContent = 'Inactive';
      break;
    case 'MONITORING':
    default:
      statusPill.classList.add('status-monitoring');
      statusPill.textContent = 'Monitoring';
      break;
  }
}

function formatVolumeLabel(vol: number): string {
  if (vol === 0) return '0% (Muted)';
  return `${Math.round(vol * 100)}% (Ducked)`;
}

function updateSoundSelection(sound: AmbientSound): void {
  soundButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sound === sound);
  });
  const labels: Record<AmbientSound, string> = {
    none: 'Silent',
    rain: 'Gentle Rain',
    stream: 'Running Stream',
    forest: 'Forest Breeze',
  };
  ambientCurrentLabel.textContent = labels[sound] || 'Silent';
}

function updateSupporterUI(supporter: SupporterState): void {
  if (supporter.isSupporter) {
    supporterBadge.classList.remove('hidden');
    supporterPerks.classList.remove('hidden');
    btnToggleSupporter.textContent = 'Supporter Active ❤️';
    applyThemeAccent(supporter.accent || PWYW.DEFAULT_SUPPORTER_ACCENT);

    colorDots.forEach((dot) => {
      dot.classList.toggle('active', dot.dataset.color === supporter.accent);
    });
  } else {
    supporterBadge.classList.add('hidden');
    supporterPerks.classList.add('hidden');
    btnToggleSupporter.textContent = 'I already supported ❤️';
    applyThemeAccent('#f59e0b');
  }
}

async function init(): Promise<void> {
  const [settings, supporter, stats] = await Promise.all([
    getSettings(),
    getSupporter(),
    getStats(),
  ]);

  currentSettings = settings;
  currentSupporter = supporter;

  // Set stats metrics
  statsAds.textContent = stats.totalAdsMuted.toLocaleString();
  const minutesSaved = Math.round(stats.totalSecondsMuted / 60);
  statsTime.textContent = `${minutesSaved}m`;

  // Bind settings inputs
  adVolumeSlider.value = settings.adVolume.toString();
  adVolumeLabel.textContent = formatVolumeLabel(settings.adVolume);
  updateSoundSelection(settings.ambientSound);
  dimmerToggle.checked = settings.dimOverlayEnabled;
  fadeToggle.checked = settings.fadeEnabled;

  // Render Supporter UI
  updateSupporterUI(supporter);

  // PWYW milestone visibility
  pwywAdsCount.textContent = `${stats.totalAdsMuted || 10}+`;
  if (stats.totalAdsMuted < PWYW.MILESTONE_ADS && !supporter.isSupporter) {
    // Keep visible if user hits milestone or already supported, but show encouragement
    pwywCard.style.opacity = '0.9';
  }

  // Detect active tab state
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id !== undefined && activeTab.url) {
    try {
      const url = new URL(activeTab.url);
      currentHostname = url.hostname;
      domainCaption.textContent = `Active on ${currentHostname}`;

      const enabled = isDomainEnabled(settings, currentHostname);
      domainToggle.checked = enabled;

      const msg: ToContent = { type: 'GET_STATUS' };
      const res = (await chrome.tabs.sendMessage(activeTab.id, msg)) as StatusResponse;
      if (res?.status) {
        updateStatusBadge(res.status);
      } else {
        updateStatusBadge(enabled ? 'MONITORING' : 'DISABLED');
      }
    } catch {
      // Content script not loaded on this tab
      domainCaption.textContent = 'Non-streaming page';
      updateStatusBadge('UNSUPPORTED');
      domainToggle.disabled = true;
    }
  } else {
    domainCaption.textContent = 'No active tab';
    updateStatusBadge('UNSUPPORTED');
    domainToggle.disabled = true;
  }

  // Event Listeners
  domainToggle.addEventListener('change', async () => {
    if (!currentHostname) return;
    const disabled = [...currentSettings.disabledDomains];
    if (domainToggle.checked) {
      const idx = disabled.indexOf(currentHostname);
      if (idx !== -1) disabled.splice(idx, 1);
      updateStatusBadge('MONITORING');
    } else {
      if (!disabled.includes(currentHostname)) disabled.push(currentHostname);
      updateStatusBadge('DISABLED');
    }
    currentSettings = await updateSettings({ disabledDomains: disabled });
  });

  adVolumeSlider.addEventListener('input', async () => {
    const val = parseFloat(adVolumeSlider.value);
    adVolumeLabel.textContent = formatVolumeLabel(val);
    currentSettings = await updateSettings({ adVolume: val });
  });

  soundButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sound = (btn.dataset.sound || 'none') as AmbientSound;
      updateSoundSelection(sound);
      currentSettings = await updateSettings({ ambientSound: sound });
    });
  });

  dimmerToggle.addEventListener('change', async () => {
    currentSettings = await updateSettings({ dimOverlayEnabled: dimmerToggle.checked });
  });

  fadeToggle.addEventListener('change', async () => {
    currentSettings = await updateSettings({ fadeEnabled: fadeToggle.checked });
  });

  btnToggleSupporter.addEventListener('click', async () => {
    const nextSupporter = !currentSupporter.isSupporter;
    currentSupporter = await updateSupporter({
      isSupporter: nextSupporter,
      since: nextSupporter ? Date.now() : null,
    });
    updateSupporterUI(currentSupporter);
  });

  colorDots.forEach((dot) => {
    dot.addEventListener('click', async () => {
      if (!currentSupporter.isSupporter) return;
      const color = dot.dataset.color || PWYW.DEFAULT_SUPPORTER_ACCENT;
      currentSupporter = await updateSupporter({ accent: color });
      updateSupporterUI(currentSupporter);
    });
  });
}

void init();
