import { describe, expect, it } from 'vitest';
import { getArcGISAuthAvailabilityFromEnv, inferRequestOriginFromHeaders, parseRelayState, shouldRefreshArcGISSession } from './arcgis-auth';

describe('arcgis auth helpers', () => {
  it('reports missing web auth environment variables', () => {
    expect(
      getArcGISAuthAvailabilityFromEnv({
        ARCGIS_PORTAL_URL: 'https://www.arcgis.com',
      })
    ).toEqual({
      isConfigured: false,
      missing: ['ARCGIS_OAUTH_CLIENT_ID', 'SKILL_HUB_SESSION_SECRET'],
    });
  });

  it('marks auth as configured when the required values are present', () => {
    expect(
      getArcGISAuthAvailabilityFromEnv({
        ARCGIS_OAUTH_CLIENT_ID: 'abc123',
        SKILL_HUB_SESSION_SECRET: 'super-secret',
      })
    ).toEqual({
      isConfigured: true,
      missing: [],
    });
  });

  it('refreshes sessions that are close to expiry', () => {
    const now = 1_000_000;

    expect(shouldRefreshArcGISSession(now + 4 * 60 * 1000, now)).toBe(true);
    expect(shouldRefreshArcGISSession(now + 6 * 60 * 1000, now)).toBe(false);
    expect(shouldRefreshArcGISSession(now - 1, now)).toBe(true);
  });

  it('parses relay state values that include the session id', () => {
    expect(parseRelayState('state123:session456')).toEqual({
      sessionId: 'session456',
      state: 'state123',
    });
    expect(parseRelayState('missing-separator')).toBeNull();
  });

  it('infers request origin from forwarded headers', () => {
    const headers = new Headers({
      host: 'localhost:3000',
      'x-forwarded-host': 'skillhub.example.com',
      'x-forwarded-proto': 'https',
    });

    expect(inferRequestOriginFromHeaders(headers)).toBe('https://skillhub.example.com');
  });
});