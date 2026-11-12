import type { TabStatus } from './types';

/** Content script -> service worker */
export type ContentToBackground =
  | { type: 'STATUS_CHANGED'; status: TabStatus }
  | { type: 'AD_BREAK_ENDED'; durationSeconds: number };

/** Service worker / popup -> content script */
export type ToContent =
  | { type: 'GET_STATUS' }
  | { type: 'TOGGLE_PAUSE' };

export interface StatusResponse {
  status: TabStatus;
  hostname: string;
}

