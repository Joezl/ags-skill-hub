import type { NextRequest } from 'next/server';
import { completeArcGISOAuth, completeRelayArcGISOAuth, parseRelayState } from '@/lib/arcgis-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (parseRelayState(request.nextUrl.searchParams.get('state'))) {
    return completeRelayArcGISOAuth(request);
  }

  return completeArcGISOAuth(request);
}