import { BADGE } from '../shared/constants';
import type { ContentToBackground, StatusResponse, ToContent } from '../shared/messages';
import { ensureDefaults, recordAdBreak } from '../shared/storage';
import type { TabStatus } from '../shared/types';

/**
 * Step 6: Background Service Worker.
 * Manages tab-specific badges, records telemetry, and handles Alt+Shift+M shortcuts.
 */

// Initialize storage defaults on install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureDefaults();
  console.info(`[AdMute] Background worker initialized (${details.reason})`);
});

// Update badge icon state for a given tab
async function updateBadge(tabId: number, status: TabStatus): Promise<void> {
  try {
    if (status === 'AD_MUTED') {
      await chrome.action.setBadgeText({ tabId, text: BADGE.TEXT });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE.COLOR });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch {
    // Tab may have been closed
  }
}

// Handle messages sent from content scripts
chrome.runtime.onMessage.addListener((message: ContentToBackground, sender) => {
  const tabId = sender.tab?.id;

  if (message.type === 'STATUS_CHANGED' && tabId !== undefined) {
    void updateBadge(tabId, message.status);
    return;
  }

  if (message.type === 'AD_BREAK_ENDED') {
    void recordAdBreak(message.durationSeconds);
    if (tabId !== undefined) {
      void updateBadge(tabId, 'MONITORING');
    }
    return;
  }
});

// Clean up badge when tab is updated or closed
chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
});

// Keyboard shortcut handler (Alt+Shift+M)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-detection') return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id === undefined) return;

  try {
    const msg: ToContent = { type: 'TOGGLE_PAUSE' };
    const res = (await chrome.tabs.sendMessage(activeTab.id, msg)) as StatusResponse;
    if (res?.status) {
      await updateBadge(activeTab.id, res.status);
    }
  } catch {
    // Tab doesn't have content script active (e.g. chrome:// or non-video page)
  }
});
