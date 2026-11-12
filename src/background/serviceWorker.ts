import { ensureDefaults } from '../shared/storage';

/**
 * Step 1: initialise storage defaults on install/update.
 * Badge, stats and the Alt+Shift+M command are added at Step 6.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureDefaults();
  console.info(`[AdMute] installed (${details.reason}); storage defaults ensured.`);
});

