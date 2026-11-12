import type { BaseDetector } from './BaseDetector';
import { GenericDetector } from './generic';

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

const ADAPTERS: readonly AdapterEntry[] = [];

export function createDetector(hostname: string): BaseDetector {
  const host = hostname.toLowerCase();
  for (const entry of ADAPTERS) {
    if (entry.hosts.some((re) => re.test(host))) return entry.create();
  }
  return new GenericDetector();
}
