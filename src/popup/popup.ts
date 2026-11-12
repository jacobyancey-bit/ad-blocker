import { getSettings, getStats, getSupporter } from '../shared/storage';
import type { StatusResponse, ToContent } from '../shared/messages';

/** Step 1: dump storage + current tab status to prove the plumbing works. */
async function render(): Promise<void> {
  const out = document.getElementById('debug');
  if (!out) return;

  const [settings, supporter, stats] = await Promise.all([getSettings(), getSupporter(), getStats()]);

  let tab: StatusResponse | string = 'not a supported site';
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id !== undefined) {
    try {
      const msg: ToContent = { type: 'GET_STATUS' };
      tab = (await chrome.tabs.sendMessage(active.id, msg)) as StatusResponse;
    } catch {
      // No content script in this tab — expected on unsupported sites.
    }
  }

  out.textContent = JSON.stringify({ tab, settings, supporter, stats }, null, 2);
}

void render();

