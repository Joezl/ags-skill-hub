import type { NextRequest } from 'next/server';
import { completeArcGISOAuth } from '@/lib/arcgis-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return completeArcGISOAuth(request);
}