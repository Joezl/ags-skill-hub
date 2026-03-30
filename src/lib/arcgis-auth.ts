import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { APP_BASE_PATH } from '@/lib/app-config';

const DEFAULT_PORTAL_URL = 'https://www.arcgis.com';
const DEFAULT_TOKEN_EXPIRY_SECONDS = 1800;
const DEFAULT_OAUTH_EXPIRATION_MINUTES = 20160;
const SESSION_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const SESSION_COOKIE_NAME = 'skillhub_arcgis_session';
const STATE_COOKIE_NAME = 'skillhub_arcgis_oauth_state';
const VERIFIER_COOKIE_NAME = 'skillhub_arcgis_oauth_verifier';
const RETURN_TO_COOKIE_NAME = 'skillhub_arcgis_return_to';

export interface ArcGISAuthAvailability {
  isConfigured: boolean;
  missing: string[];
}

export interface ArcGISViewer {
  fullName: string;
  isSignedIn: boolean;
  portalUrl: string;
  username: string;
}

interface ArcGISSessionPayload {
  accessToken: string;
  expiresAt: number;
  fullName: string;
  portalUrl: string;
  refreshToken: string | null;
  username: string;
}

interface ArcGISTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  username?: string;
  error?: {
    message?: string;
  };
}

interface ArcGISSelfResponse {
  fullName?: string;
  username?: string;
  error?: {
    message?: string;
  };
}

export interface ArcGISSession extends ArcGISViewer {
  accessToken: string;
  expiresAt: number;
  refreshToken: string | null;
}

export function getArcGISAuthAvailability(): ArcGISAuthAvailability {
  return getArcGISAuthAvailabilityFromEnv(process.env);
}

export function getArcGISAuthAvailabilityFromEnv(env: Record<string, string | undefined>): ArcGISAuthAvailability {
  const missing: string[] = [];

  if (!env.ARCGIS_OAUTH_CLIENT_ID?.trim()) {
    missing.push('ARCGIS_OAUTH_CLIENT_ID');
  }

  if (!env.SKILL_HUB_SESSION_SECRET?.trim()) {
    missing.push('SKILL_HUB_SESSION_SECRET');
  }

  return {
    isConfigured: missing.length === 0,
    missing,
  };
}

export function shouldRefreshArcGISSession(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - now <= SESSION_REFRESH_WINDOW_MS;
}

export async function getArcGISSession(): Promise<ArcGISSession | null> {
  const cookieStore = await cookies();
  const payload = await readSessionPayload(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!payload || Date.now() >= payload.expiresAt) {
    return null;
  }

  return toArcGISSession(payload);
}

export async function getArcGISViewer(): Promise<ArcGISViewer | null> {
  const session = await getArcGISSession();

  if (!session) {
    return null;
  }

  return {
    fullName: session.fullName,
    isSignedIn: true,
    portalUrl: session.portalUrl,
    username: session.username,
  };
}

export async function beginArcGISOAuth(request: NextRequest): Promise<NextResponse> {
  const basePath = getBasePath(request);
  const portalUrl = getPortalUrl();

  try {
    const callbackUrl = getOAuthCallbackUrl(request, basePath);
    const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'), basePath);
    const state = randomBytes(16).toString('hex');
    const codeVerifier = randomBytes(64).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const authorizeUrl = new URL(`${portalUrl}/sharing/rest/oauth2/authorize`);

    authorizeUrl.searchParams.set('client_id', getClientId());
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl.toString());
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('expiration', String(DEFAULT_OAUTH_EXPIRATION_MINUTES));

    const response = NextResponse.redirect(authorizeUrl);
    const transientCookieOptions = getTransientCookieOptions();

    response.cookies.set(STATE_COOKIE_NAME, state, transientCookieOptions);
    response.cookies.set(VERIFIER_COOKIE_NAME, codeVerifier, transientCookieOptions);
    response.cookies.set(RETURN_TO_COOKIE_NAME, returnTo, transientCookieOptions);

    return response;
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'ArcGIS sign-in could not be started.';
    return buildAuthRedirect(request, homePath(basePath), message, true);
  }
}

export async function refreshArcGISSessionInProxy(request: NextRequest): Promise<NextResponse | null> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  const payload = await readSessionPayload(sessionCookie);

  if (!payload) {
    return buildClearedProxySessionResponse(request);
  }

  if (!shouldRefreshArcGISSession(payload.expiresAt)) {
    return null;
  }

  if (!payload.refreshToken) {
    return buildClearedProxySessionResponse(request);
  }

  try {
    const refreshedTokens = await exchangeRefreshToken({
      portalUrl: payload.portalUrl,
      refreshToken: payload.refreshToken,
    });
    const nextPayload: ArcGISSessionPayload = {
      accessToken: refreshedTokens.accessToken,
      expiresAt: refreshedTokens.expiresAt,
      fullName: payload.fullName,
      portalUrl: payload.portalUrl,
      refreshToken: refreshedTokens.refreshToken || payload.refreshToken,
      username: refreshedTokens.username || payload.username,
    };
    const encryptedSession = await encryptSession(nextPayload);

    request.cookies.set(SESSION_COOKIE_NAME, encryptedSession);

    const response = NextResponse.next({
      request: {
        headers: buildRequestHeadersWithCookies(request),
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, encryptedSession, getSessionCookieOptions(nextPayload.expiresAt));
    return response;
  } catch {
    return buildClearedProxySessionResponse(request);
  }
}

export async function completeArcGISOAuth(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const portalUrl = getPortalUrl();
  const basePath = getBasePath(request);
  const callbackUrl = getOAuthCallbackUrl(request, basePath);
  const expectedState = cookieStore.get(STATE_COOKIE_NAME)?.value;
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE_NAME)?.value;
  const returnTo = sanitizeReturnTo(cookieStore.get(RETURN_TO_COOKIE_NAME)?.value, basePath);
  const error = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  if (error) {
    return buildAuthRedirect(request, returnTo, errorDescription || error, true);
  }

  if (!state || !expectedState || state !== expectedState) {
    return buildAuthRedirect(request, returnTo, 'ArcGIS sign-in state did not match.', true);
  }

  if (!code || !codeVerifier) {
    return buildAuthRedirect(request, returnTo, 'ArcGIS sign-in did not return a usable authorization code.', true);
  }

  try {
    const tokenResponse = await exchangeAuthorizationCode({
      callbackUrl: callbackUrl.toString(),
      code,
      codeVerifier,
      portalUrl,
    });
    const profile = await fetchArcGISProfile(portalUrl, tokenResponse.accessToken);
    const session = await encryptSession({
      accessToken: tokenResponse.accessToken,
      expiresAt: tokenResponse.expiresAt,
      fullName: profile.fullName || tokenResponse.username || 'ArcGIS user',
      portalUrl,
      refreshToken: tokenResponse.refreshToken,
      username: profile.username || tokenResponse.username || 'unknown',
    });

    const response = NextResponse.redirect(buildAppUrl(request, returnTo));
    clearTransientCookies(response);
    response.cookies.set(SESSION_COOKIE_NAME, session, getSessionCookieOptions(tokenResponse.expiresAt));
    return response;
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'ArcGIS sign-in could not be completed.';
    return buildAuthRedirect(request, returnTo, message, true);
  }
}

export function clearArcGISSession(request: NextRequest): NextResponse {
  const basePath = getBasePath(request);
  const response = NextResponse.redirect(buildAppUrl(request, homePath(basePath)));

  response.cookies.set(SESSION_COOKIE_NAME, '', { ...getTransientCookieOptions(), maxAge: 0 });
  clearTransientCookies(response);

  return response;
}

function clearTransientCookies(response: NextResponse) {
  const expiredOptions = { ...getTransientCookieOptions(), maxAge: 0 };

  response.cookies.set(STATE_COOKIE_NAME, '', expiredOptions);
  response.cookies.set(VERIFIER_COOKIE_NAME, '', expiredOptions);
  response.cookies.set(RETURN_TO_COOKIE_NAME, '', expiredOptions);
}

async function exchangeAuthorizationCode(input: {
  callbackUrl: string;
  code: string;
  codeVerifier: string;
  portalUrl: string;
}): Promise<{ accessToken: string; expiresAt: number; refreshToken: string | null; username: string | null }> {
  const form = new URLSearchParams({
    client_id: getClientId(),
    code: input.code,
    code_verifier: input.codeVerifier,
    f: 'json',
    grant_type: 'authorization_code',
    redirect_uri: input.callbackUrl,
  });
  const clientSecret = getClientSecret();

  if (clientSecret) {
    form.set('client_secret', clientSecret);
  }

  const response = await fetch(`${input.portalUrl}/sharing/rest/oauth2/token`, {
    body: form,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });
  const json = (await response.json()) as ArcGISTokenResponse;

  if (!response.ok || json.error?.message || !json.access_token) {
    throw new Error(json.error?.message || `ArcGIS token exchange failed with status ${response.status}.`);
  }

  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in || DEFAULT_TOKEN_EXPIRY_SECONDS) * 1000,
    refreshToken: json.refresh_token || null,
    username: json.username || null,
  };
}

async function exchangeRefreshToken(input: {
  portalUrl: string;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresAt: number; refreshToken: string | null; username: string | null }> {
  const form = new URLSearchParams({
    client_id: getClientId(),
    f: 'json',
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  });
  const clientSecret = getClientSecret();

  if (clientSecret) {
    form.set('client_secret', clientSecret);
  }

  const response = await fetch(`${input.portalUrl}/sharing/rest/oauth2/token`, {
    body: form,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });
  const json = (await response.json()) as ArcGISTokenResponse;

  if (!response.ok || json.error?.message || !json.access_token) {
    throw new Error(json.error?.message || `ArcGIS token refresh failed with status ${response.status}.`);
  }

  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in || DEFAULT_TOKEN_EXPIRY_SECONDS) * 1000,
    refreshToken: json.refresh_token || null,
    username: json.username || null,
  };
}

async function fetchArcGISProfile(portalUrl: string, accessToken: string): Promise<{ fullName: string; username: string }> {
  const url = new URL(`${portalUrl}/sharing/rest/community/self`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('token', accessToken);

  const response = await fetch(url, { cache: 'no-store' });
  const json = (await response.json()) as ArcGISSelfResponse;

  if (!response.ok || json.error?.message) {
    throw new Error(json.error?.message || `ArcGIS profile lookup failed with status ${response.status}.`);
  }

  return {
    fullName: json.fullName || json.username || 'ArcGIS user',
    username: json.username || 'unknown',
  };
}

async function encryptSession(payload: ArcGISSessionPayload): Promise<string> {
  return new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .encrypt(await getSessionKey());
}

async function decryptSession(token: string): Promise<ArcGISSessionPayload> {
  const { payload } = await jwtDecrypt(token, await getSessionKey());

  return {
    accessToken: readPayloadString(payload.accessToken),
    expiresAt: readPayloadNumber(payload.expiresAt),
    fullName: readPayloadString(payload.fullName),
    portalUrl: readPayloadString(payload.portalUrl),
    refreshToken: readPayloadNullableString(payload.refreshToken),
    username: readPayloadString(payload.username),
  };
}

async function getSessionKey() {
  const secret = process.env.SKILL_HUB_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error('Missing SKILL_HUB_SESSION_SECRET in the local environment.');
  }

  return createHash('sha256').update(secret).digest();
}

async function readSessionPayload(token: string | null | undefined): Promise<ArcGISSessionPayload | null> {
  if (!token) {
    return null;
  }

  try {
    return await decryptSession(token);
  } catch {
    return null;
  }
}

function toArcGISSession(payload: ArcGISSessionPayload): ArcGISSession {
  return {
    accessToken: payload.accessToken,
    expiresAt: payload.expiresAt,
    fullName: payload.fullName,
    isSignedIn: true,
    portalUrl: payload.portalUrl,
    refreshToken: payload.refreshToken,
    username: payload.username,
  };
}

function getPortalUrl(): string {
  return (process.env.ARCGIS_PORTAL_URL || DEFAULT_PORTAL_URL).replace(/\/$/, '');
}

function getClientId(): string {
  const clientId = process.env.ARCGIS_OAUTH_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error('Missing ARCGIS_OAUTH_CLIENT_ID in the local environment.');
  }

  return clientId;
}

function getClientSecret(): string {
  return process.env.ARCGIS_OAUTH_CLIENT_SECRET?.trim() || '';
}

function getSessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    maxAge: Math.max(1, Math.floor((expiresAt - Date.now()) / 1000)),
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

function buildRequestHeadersWithCookies(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  const cookieHeader = request.cookies
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader);
  } else {
    requestHeaders.delete('cookie');
  }

  return requestHeaders;
}

function buildClearedProxySessionResponse(request: NextRequest): NextResponse {
  request.cookies.delete(SESSION_COOKIE_NAME);

  const response = NextResponse.next({
    request: {
      headers: buildRequestHeadersWithCookies(request),
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, '', { ...getTransientCookieOptions(), maxAge: 0 });
  return response;
}

function getTransientCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 15,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

function buildAuthRedirect(request: NextRequest, returnTo: string, message: string, clearTransient: boolean): NextResponse {
  const redirectUrl = buildAppUrl(request, returnTo);
  redirectUrl.searchParams.set('authError', message);
  const response = NextResponse.redirect(redirectUrl);

  if (clearTransient) {
    clearTransientCookies(response);
  }

  response.cookies.set(SESSION_COOKIE_NAME, '', { ...getTransientCookieOptions(), maxAge: 0 });
  return response;
}

function buildAppUrl(request: NextRequest, path: string): URL {
  return new URL(path, request.nextUrl.origin);
}

function getOAuthCallbackUrl(request: NextRequest, basePath: string): URL {
  const configuredUrl = process.env.ARCGIS_OAUTH_REDIRECT_URI?.trim();

  if (configuredUrl) {
    return new URL(configuredUrl);
  }

  return buildAppUrl(request, `${basePath}/api/auth/arcgis/callback`);
}

function getBasePath(request: NextRequest): string {
  return APP_BASE_PATH;
}

function sanitizeReturnTo(value: string | null | undefined, basePath: string): string {
  if (!value) {
    return homePath(basePath);
  }

  if (!value.startsWith('/')) {
    return homePath(basePath);
  }

  if (basePath && !value.startsWith(basePath)) {
    return homePath(basePath);
  }

  return value;
}

function homePath(basePath: string): string {
  return basePath || '/';
}

function readPayloadString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readPayloadNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readPayloadNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}