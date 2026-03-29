import { NextResponse } from 'next/server';
import { getArcGISSkills } from '@/lib/arcgis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const skills = await getArcGISSkills();

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      skills,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load ArcGIS skills.';

    return NextResponse.json(
      {
        error: message,
        fetchedAt: new Date().toISOString(),
        skills: [],
      },
      {
        status: 500,
      }
    );
  }
}