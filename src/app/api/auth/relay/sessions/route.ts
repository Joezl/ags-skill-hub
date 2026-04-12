import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getArcGISAuthAvailability, getRelayLandingUrlForOrigin } from '@/lib/arcgis-auth';
import { createRelaySession } from '@/lib/relay-store';

const DEFAULT_PORTAL_URL = 'https://www.arcgis.com';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authAvailability = getArcGISAuthAvailability();

  if (!authAvailability.isConfigured) {
    return NextResponse.json(
      {
        error: 'auth_unavailable',
        missing: authAvailability.missing,
      },
      { status: 503 }
    );
  }

  const portalUrl = (process.env.ARCGIS_PORTAL_URL || DEFAULT_PORTAL_URL).replace(/\/$/, '');
  const session = createRelaySession(portalUrl);
  const authUrl = getRelayLandingUrlForOrigin(session.sessionId, request.nextUrl.origin).toString();

  return NextResponse.json({
    authUrl,
    sessionId: session.sessionId,
  });
}