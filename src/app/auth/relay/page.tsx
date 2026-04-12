import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  buildRelayState,
  createCodeChallenge,
  getArcGISAuthAvailability,
  getRelayCallbackUrlForOrigin,
  inferRequestOriginFromHeaders,
} from '@/lib/arcgis-auth';
import { getRelaySession } from '@/lib/relay-store';

const DEFAULT_OAUTH_EXPIRATION_MINUTES = 20160;

function RelayMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-4 text-base leading-7 text-slate-600">{body}</p>
    </main>
  );
}

export default async function RelayAuthPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const rawSessionId = resolvedSearchParams.session;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  if (!sessionId) {
    return <RelayMessage title="Missing Login Link" body="This login link is invalid. Please return to the agent and try again." />;
  }

  const session = getRelaySession(sessionId);

  if (!session || session.expiresAt < Date.now()) {
    return <RelayMessage title="Login Link Expired" body="This login link has expired. Please return to the agent and try again." />;
  }

  if (session.status === 'complete') {
    return <RelayMessage title="Already Logged In" body="This login is already complete. You can close this tab and return to the agent." />;
  }

  if (session.status === 'error') {
    return <RelayMessage title="Login Failed" body={session.errorMessage || 'ArcGIS sign-in could not be completed. Please return to the agent and try again.'} />;
  }

  const authAvailability = getArcGISAuthAvailability();

  if (!authAvailability.isConfigured) {
    return <RelayMessage title="ArcGIS Auth Unavailable" body="ArcGIS authentication is not configured on this Skill Hub deployment." />;
  }

  const headerList = await headers();
  const requestOrigin = inferRequestOriginFromHeaders(headerList);
  const authorizeUrl = new URL(`${session.portalUrl}/sharing/rest/oauth2/authorize`);

  authorizeUrl.searchParams.set('client_id', process.env.ARCGIS_OAUTH_CLIENT_ID?.trim() || '');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', getRelayCallbackUrlForOrigin(requestOrigin).toString());
  authorizeUrl.searchParams.set('code_challenge', createCodeChallenge(session.codeVerifier));
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('state', buildRelayState(session.state, session.sessionId));
  authorizeUrl.searchParams.set('expiration', String(DEFAULT_OAUTH_EXPIRATION_MINUTES));

  redirect(authorizeUrl.toString());
}