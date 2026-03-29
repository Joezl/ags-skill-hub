import { SkillHubClient } from '@/components/skill-hub-client';
import { getArcGISSkills } from '@/lib/arcgis';

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const skills = await getArcGISSkills();
    return <SkillHubClient skills={skills} />;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to load ArcGIS skills.';

    return <SkillHubClient skills={[]} errorMessage={errorMessage} />;
  }
}
