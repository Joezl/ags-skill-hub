import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeRelaySession, consumeRelayToken, createRelaySession, failRelaySession, getRelaySession, purgeExpiredRelaySessions } from './relay-store';

describe('relay store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    purgeExpiredRelaySessions();
  });

  it('creates pending relay sessions with a ttl', () => {
    const session = createRelaySession('https://www.arcgis.com/');

    expect(session.portalUrl).toBe('https://www.arcgis.com');
    expect(session.status).toBe('pending');
    expect(session.expiresAt).toBe(1_600_000);
    expect(getRelaySession(session.sessionId)?.sessionId).toBe(session.sessionId);
  });

  it('completes and consumes relay tokens exactly once', () => {
    const session = createRelaySession('https://www.arcgis.com');

    completeRelaySession(session.sessionId, 'secret-token', 2_000_000);

    expect(consumeRelayToken(session.sessionId)).toEqual({
      accessToken: 'secret-token',
      portalUrl: 'https://www.arcgis.com',
      tokenExpiresAt: 2_000_000,
    });
    expect(consumeRelayToken(session.sessionId)).toBeNull();
    expect(getRelaySession(session.sessionId)).toBeNull();
  });

  it('stores relay failures without consuming the session', () => {
    const session = createRelaySession('https://www.arcgis.com');

    failRelaySession(session.sessionId, 'Login failed');

    expect(getRelaySession(session.sessionId)).toMatchObject({
      errorMessage: 'Login failed',
      status: 'error',
    });
    expect(consumeRelayToken(session.sessionId)).toBeNull();
  });

  it('purges expired sessions', () => {
    const session = createRelaySession('https://www.arcgis.com');

    vi.spyOn(Date, 'now').mockReturnValue(session.expiresAt + 1);
    purgeExpiredRelaySessions();

    expect(getRelaySession(session.sessionId)).toBeNull();
  });
});