import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { refreshArcGISSessionInProxy } from '@/lib/arcgis-auth';

export async function proxy(request: NextRequest) {
  const refreshedResponse = await refreshArcGISSessionInProxy(request);

  if (refreshedResponse) {
    return refreshedResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/skill-hub', '/skill-hub/api/skills'],
};