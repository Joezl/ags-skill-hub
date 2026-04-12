import { randomBytes } from 'node:crypto';

const RELAY_SESSION_TTL_MS = 10 * 60 * 1000;

declare global {
  var __skillHubRelaySessions: Map<string, RelaySession> | undefined;
}

export interface RelaySession {
  sessionId: string;
  portalUrl: string;
  state: string;
  codeVerifier: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'complete' | 'error';
  accessToken?: string;
  tokenExpiresAt?: number;
  errorMessage?: string;
}

const relaySessions = globalThis.__skillHubRelaySessions ?? new Map<string, RelaySession>();

if (!globalThis.__skillHubRelaySessions) {
  globalThis.__skillHubRelaySessions = relaySessions;
}

export function createRelaySession(portalUrl: string): RelaySession {
  purgeExpiredRelaySessions();

  const createdAt = Date.now();
  const session: RelaySession = {
    codeVerifier: randomBytes(64).toString('base64url'),
    createdAt,
    expiresAt: createdAt + RELAY_SESSION_TTL_MS,
    portalUrl: portalUrl.replace(/\/$/, ''),
    sessionId: randomBytes(32).toString('hex'),
    state: randomBytes(16).toString('hex'),
    status: 'pending',
  };

  relaySessions.set(session.sessionId, session);
  return session;
}

export function getRelaySession(sessionId: string): RelaySession | null {
  return relaySessions.get(sessionId) || null;
}

export function completeRelaySession(sessionId: string, accessToken: string, tokenExpiresAt: number): void {
  const session = relaySessions.get(sessionId);

  if (!session) {
    return;
  }

  relaySessions.set(sessionId, {
    ...session,
    accessToken,
    errorMessage: undefined,
    status: 'complete',
    tokenExpiresAt,
  });
}

export function failRelaySession(sessionId: string, errorMessage: string): void {
  const session = relaySessions.get(sessionId);

  if (!session) {
    return;
  }

  relaySessions.set(sessionId, {
    ...session,
    errorMessage,
    status: 'error',
  });
}

export function consumeRelayToken(sessionId: string): { accessToken: string; tokenExpiresAt: number; portalUrl: string } | null {
  const session = relaySessions.get(sessionId);

  if (!session || session.status !== 'complete' || session.expiresAt < Date.now() || !session.accessToken || !session.tokenExpiresAt) {
    return null;
  }

  relaySessions.delete(sessionId);

  return {
    accessToken: session.accessToken,
    portalUrl: session.portalUrl,
    tokenExpiresAt: session.tokenExpiresAt,
  };
}

export function purgeExpiredRelaySessions(): void {
  const now = Date.now();

  for (const [sessionId, session] of relaySessions.entries()) {
    if (session.expiresAt < now) {
      relaySessions.delete(sessionId);
    }
  }
}