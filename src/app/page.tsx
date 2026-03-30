import { getArcGISAuthAvailability, getArcGISViewer, getArcGISSession } from '@/lib/arcgis-auth';
import { SkillHubClient } from '@/components/skill-hub-client';
import { getArcGISSkills } from '@/lib/arcgis';

export const dynamic = 'force-dynamic';

function buildAuthErrorMessage(authError?: string | string[]) {
  const rawValue = Array.isArray(authError) ? authError[0] : authError;

  if (!rawValue) {
    return undefined;
  }

  return decodeURIComponent(rawValue);
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const authErrorMessage = buildAuthErrorMessage(resolvedSearchParams.authError);
  const authAvailability = getArcGISAuthAvailability();
  const renderTimestamp = Date.now();
  const [session, viewer] = await Promise.all([getArcGISSession(), getArcGISViewer()]);

  try {
    const skills = await getArcGISSkills({ accessToken: session?.accessToken, portalUrl: viewer?.portalUrl });
    return <SkillHubClient authConfigured={authAvailability.isConfigured} skills={skills} viewer={viewer} errorMessage={authErrorMessage} renderTimestamp={renderTimestamp} />;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to load ArcGIS skills.';

    return <SkillHubClient authConfigured={authAvailability.isConfigured} skills={[]} viewer={viewer} errorMessage={authErrorMessage || errorMessage} renderTimestamp={renderTimestamp} />;
  }
}
