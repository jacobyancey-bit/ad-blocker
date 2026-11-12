import { getSettings, isDomainEnabled } from '../shared/storage';
import type { StatusResponse, ToContent } from '../shared/messages';
import type { TabStatus } from '../shared/types';

/**
 * Step 1: proves the content script is injected on supported sites and can read storage.
 * The detector + state machine + audio controller get wired in at Step 5.
 */
const hostname = location.hostname;
let status: TabStatus = 'MONITORING';

async function init(): Promise<void> {
  const settings = await getSettings();
  status = isDomainEnabled(settings, hostname) ? 'MONITORING' : 'DISABLED';
  console.info(`[AdMute] content script loaded on ${hostname} — status: ${status}`, settings);
}

chrome.runtime.onMessage.addListener((msg: ToContent, _sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    const res: StatusResponse = { status, hostname };
    sendResponse(res);
  }
  return false;
});

void init();

