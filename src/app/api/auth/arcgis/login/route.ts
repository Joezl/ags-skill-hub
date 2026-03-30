import type { NextRequest } from 'next/server';
import { beginArcGISOAuth } from '@/lib/arcgis-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return beginArcGISOAuth(request);
}