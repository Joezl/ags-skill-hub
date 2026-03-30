import { NextResponse } from 'next/server';
import { getArcGISViewer, getArcGISSession } from '@/lib/arcgis-auth';
import { getArcGISSkills } from '@/lib/arcgis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [session, viewer] = await Promise.all([getArcGISSession(), getArcGISViewer()]);
    const skills = await getArcGISSkills({ accessToken: session?.accessToken, portalUrl: viewer?.portalUrl });

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      skills,
      viewer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load ArcGIS skills.';

    return NextResponse.json(
      {
        error: message,
        fetchedAt: new Date().toISOString(),
        skills: [],
        viewer: null,
      },
      {
        status: 500,
      }
    );
  }
}