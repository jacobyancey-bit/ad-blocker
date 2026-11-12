import type { BaseDetector } from './BaseDetector';
import { CRUNCHYROLL_HOSTS, CrunchyrollDetector } from './crunchyroll';
import { GenericDetector } from './generic';
import { HULU_HOSTS, HuluDetector } from './hulutv';
import { MAX_HOSTS, MaxDetector } from './max';
import { PARAMOUNT_HOSTS, ParamountDetector } from './paramountplus';
import { PEACOCK_HOSTS, PeacockDetector } from './peacock';
import { PLUTO_HOSTS, PlutoDetector } from './pluto';
import { PRIME_HOSTS, PrimeVideoDetector } from './primevideo';
import { ROKU_HOSTS, RokuDetector } from './roku';
import { TUBI_HOSTS, TubiDetector } from './tubitv';
import { TWITCH_HOSTS, TwitchDetector } from './twitch';
import { YOUTUBE_HOSTS, YouTubeDetector } from './youtube';

/**
 * Maps hostnames to site adapters. To add a service:
 *   1. create `detectors/<site>.ts` extending BaseDetector
 *   2. add an entry below
 *   3. drop `ad--*.html` / `content--*.html` snapshots in tests/detectors/fixtures/<site>/
 */
interface AdapterEntry {
  hosts: readonly RegExp[];
  create: () => BaseDetector;
}

const ADAPTERS: readonly AdapterEntry[] = [
  { hosts: YOUTUBE_HOSTS, create: () => new YouTubeDetector() },
  { hosts: HULU_HOSTS, create: () => new HuluDetector() },
  { hosts: PEACOCK_HOSTS, create: () => new PeacockDetector() },
  { hosts: TWITCH_HOSTS, create: () => new TwitchDetector() },
  { hosts: PRIME_HOSTS, create: () => new PrimeVideoDetector() },
  { hosts: PARAMOUNT_HOSTS, create: () => new ParamountDetector() },
  { hosts: MAX_HOSTS, create: () => new MaxDetector() },
  { hosts: TUBI_HOSTS, create: () => new TubiDetector() },
  { hosts: PLUTO_HOSTS, create: () => new PlutoDetector() },
  { hosts: CRUNCHYROLL_HOSTS, create: () => new CrunchyrollDetector() },
  { hosts: ROKU_HOSTS, create: () => new RokuDetector() },
];

export function createDetector(hostname: string): BaseDetector {
  const host = hostname.toLowerCase();
  for (const entry of ADAPTERS) {
    if (entry.hosts.some((re) => re.test(host))) return entry.create();
  }
  return new GenericDetector();
}
