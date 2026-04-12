import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { completeRelayArcGISOAuth } from '@/lib/arcgis-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return completeRelayArcGISOAuth(request);
}