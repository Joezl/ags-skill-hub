import { describe, expect, it } from 'vitest';
import { buildDescriptorFromArgs, parseInstallDescriptor } from '../../scripts/lib/install-descriptor.mjs';

describe('install descriptor parsing', () => {
  it('parses an ARC_SKILL_INSTALL block', () => {
    const descriptor = parseInstallDescriptor(`ARC_SKILL_INSTALL
portal_url=https://www.arcgis.com
item_id=ba702393c4db4bdbacc8b3f2eb9c0449
item_url=https://www.arcgis.com/home/item.html?id=ba702393c4db4bdbacc8b3f2eb9c0449
item_title=ArcGIS Skill Manager
item_type=Code Sample
type_keywords=Agent Skill, Code, Sample
access_level=org
skill_hub_url=https://example.com/skill-hub
auth=oauth
install_mode=agent_client_oauth
END_ARC_SKILL_INSTALL`);

    expect(descriptor.portalUrl).toBe('https://www.arcgis.com');
    expect(descriptor.itemId).toBe('ba702393c4db4bdbacc8b3f2eb9c0449');
    expect(descriptor.typeKeywords).toEqual(['Agent Skill', 'Code', 'Sample']);
    expect(descriptor.auth).toBe('oauth');
    expect(descriptor.skillHubUrl).toBe('https://example.com/skill-hub');
  });

  it('parses the older natural-language ArcGIS install prompt format', () => {
    const descriptor = parseInstallDescriptor(`Install this ArcGIS agent skill from ArcGIS Online.

Skill title: ArcGIS Skill Manager
Portal URL: https://www.arcgis.com
Item ID: ba702393c4db4bdbacc8b3f2eb9c0449
Item URL: https://www.arcgis.com/home/item.html?id=ba702393c4db4bdbacc8b3f2eb9c0449
Expected item type: Code Sample
Expected type keywords: Agent Skill, Code, Sample, Skill
Access level: org`);

    expect(descriptor.portalUrl).toBe('https://www.arcgis.com');
    expect(descriptor.itemId).toBe('ba702393c4db4bdbacc8b3f2eb9c0449');
    expect(descriptor.itemTitle).toBe('ArcGIS Skill Manager');
    expect(descriptor.typeKeywords).toContain('Skill');
  });

  it('parses a raw ArcGIS item URL', () => {
    const descriptor = parseInstallDescriptor('https://www.arcgis.com/home/item.html?id=ba702393c4db4bdbacc8b3f2eb9c0449');

    expect(descriptor.portalUrl).toBe('https://www.arcgis.com');
    expect(descriptor.itemId).toBe('ba702393c4db4bdbacc8b3f2eb9c0449');
    expect(descriptor.itemUrl).toBe('https://www.arcgis.com/home/item.html?id=ba702393c4db4bdbacc8b3f2eb9c0449');
  });

  it('builds a descriptor from direct CLI args', () => {
    const descriptor = buildDescriptorFromArgs({
      accessLevel: 'org',
      item: 'abc123',
      portal: 'https://www.arcgis.com/',
      skillHubUrl: 'https://relay.example.com/skill-hub',
      typeKeywords: 'Agent Skill',
    });

    expect(descriptor.portalUrl).toBe('https://www.arcgis.com');
    expect(descriptor.itemId).toBe('abc123');
    expect(descriptor.itemUrl).toBe('https://www.arcgis.com/home/item.html?id=abc123');
    expect(descriptor.skillHubUrl).toBe('https://relay.example.com/skill-hub');
  });
});