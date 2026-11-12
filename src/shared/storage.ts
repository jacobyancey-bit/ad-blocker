import { DEFAULT_SETTINGS, DEFAULT_STATS, DEFAULT_SUPPORTER } from './constants';
import type { Settings, Stats, SupporterState } from './types';

/**
 * Typed wrappers around chrome.storage.
 *  - settings  -> sync  (follows the user across devices)
 *  - supporter -> sync
 *  - stats     -> local (telemetry never leaves the device)
 */

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.sync.set({ settings: next });
  return next;
}

export async function getSupporter(): Promise<SupporterState> {
  const { supporter } = await chrome.storage.sync.get('supporter');
  return { ...DEFAULT_SUPPORTER, ...(supporter as Partial<SupporterState> | undefined) };
}

export async function updateSupporter(patch: Partial<SupporterState>): Promise<SupporterState> {
  const next = { ...(await getSupporter()), ...patch };
  await chrome.storage.sync.set({ supporter: next });
  return next;
}

export async function getStats(): Promise<Stats> {
  const { stats } = await chrome.storage.local.get('stats');
  return { ...DEFAULT_STATS, ...(stats as Partial<Stats> | undefined) };
}

export async function recordAdBreak(durationSeconds: number): Promise<Stats> {
  const current = await getStats();
  const next: Stats = {
    totalAdsMuted: current.totalAdsMuted + 1,
    totalSecondsMuted: current.totalSecondsMuted + Math.max(0, durationSeconds),
  };
  await chrome.storage.local.set({ stats: next });
  return next;
}

/** Fill in any missing keys without clobbering existing user data. */
export async function ensureDefaults(): Promise<void> {
  await Promise.all([
    chrome.storage.sync.set({ settings: await getSettings(), supporter: await getSupporter() }),
    chrome.storage.local.set({ stats: await getStats() }),
  ]);
}

export function isDomainEnabled(settings: Settings, hostname: string): boolean {
  return !settings.disabledDomains.includes(hostname);
}

