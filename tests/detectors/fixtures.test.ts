import { afterEach, describe, expect, it } from 'vitest';
import { createDetector } from '../../src/content/detectors/registry';
import { DETECTION } from '../../src/shared/constants';

/**
 * Snapshot regression suite — auto-discovers every file in ./fixtures/<site>/.
 *
 *   ad--<name>.html       must score >= MUTE_CONFIDENCE   (0.8)
 *   content--<name>.html  must score <= UNMUTE_CONFIDENCE (0.2)
 *
 * When a site changes its player, capture a fresh snapshot, drop it in the folder,
 * watch it fail, fix the adapter, watch it pass.
 */

interface SiteConfig {
  hostname: string;
  detectorId: string;
}

const SITES: Record<string, SiteConfig> = {
  generic: { hostname: 'example.com', detectorId: 'generic' },
  youtube: { hostname: 'www.youtube.com', detectorId: 'youtube' },
};

const files = import.meta.glob<string>('./fixtures/*/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const bySite = new Map<string, Array<[string, string]>>();
for (const [path, html] of Object.entries(files)) {
  const [, site, file] = path.match(/\.\/fixtures\/([^/]+)\/([^/]+)$/) ?? [];
  if (!site || !file) continue;
  bySite.set(site, [...(bySite.get(site) ?? []), [file, html]]);
}

afterEach(() => {
  document.body.innerHTML = '';
});

it('has at least one fixture folder', () => {
  expect(bySite.size).toBeGreaterThan(0);
});

for (const [site, fixtures] of bySite) {
  describe(`fixtures/${site}`, () => {
    const config = SITES[site];

    it('is a known site folder', () => {
      expect(config, `Add "${site}" to SITES in fixtures.test.ts`).toBeDefined();
    });
    if (!config) return;

    it(`routes ${config.hostname} to the "${config.detectorId}" detector`, () => {
      expect(createDetector(config.hostname).id).toBe(config.detectorId);
    });

    for (const [file, html] of fixtures) {
      const label = file.split('--')[0];

      it(file, () => {
        document.body.innerHTML = html;
        const result = createDetector(config.hostname).detect(document);
        const detail = `confidence=${result.confidence.toFixed(3)} fired=[${result.fired.join(', ')}]`;

        if (label === 'ad') {
          expect(result.confidence, detail).toBeGreaterThanOrEqual(DETECTION.MUTE_CONFIDENCE);
        } else if (label === 'content') {
          expect(result.confidence, detail).toBeLessThanOrEqual(DETECTION.UNMUTE_CONFIDENCE);
        } else {
          throw new Error(`Fixture "${file}" must be named ad--*.html or content--*.html`);
        }
      });
    }
  });
}
