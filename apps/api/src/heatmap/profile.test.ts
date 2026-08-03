import { describe, expect, it } from 'vitest';
import { profileForZoom } from './profile.js';

describe('profileForZoom', () => {
  it('coalesces samples more aggressively at low zoom', () => {
    const regional = profileForZoom(9);
    const street = profileForZoom(16);

    expect(regional.cellMeters).toBeGreaterThan(street.cellMeters * 20);
    expect(regional.sampleMeters).toBeGreaterThan(street.sampleMeters * 20);
  });

  it('only adds sharp route geometry at street zoom', () => {
    expect(profileForZoom(12).includeRoutes).toBe(false);
    expect(profileForZoom(13).includeRoutes).toBe(true);
  });

  it('keeps all distances positive at extreme supported zooms', () => {
    for (const zoom of [6, 8, 12, 18]) {
      const profile = profileForZoom(zoom);
      expect(profile.cellMeters).toBeGreaterThan(0);
      expect(profile.sampleMeters).toBeGreaterThan(0);
      expect(profile.simplifyMeters).toBeGreaterThan(0);
    }
  });
});
