// Utility for selecting Asana templates based on project type

import { useIntegrationsConfig } from '../hooks/useConfig';

interface TemplateConfig {
  defaultTemplateGid: string;
  templates: Record<string, string>;
}

/**
 * Get the Asana template GID for a given project type.
 * Falls back to default template if:
 * - No project type is specified
 * - Project type is not found in templates mapping
 */
export function getTemplateGidForProjectType(
  projectType: string | undefined,
  config: TemplateConfig
): string {
  // If project type is specified and has a specific template mapping, use it
  if (projectType && config.templates[projectType]) {
    return config.templates[projectType];
  }

  // Fall back to default template
  return config.defaultTemplateGid;
}

/**
 * React hook for getting the Asana template GID based on project type.
 * Uses integrations.toml config with fallback to environment variable.
 */
export function useAsanaTemplateGid(projectType: string | undefined): string | null {
  const { config } = useIntegrationsConfig();

  if (!config?.asana) return null;

  // Use config default, falling back to env variable for backward compatibility
  const defaultGid = config.asana.default_template_gid ||
    import.meta.env.VITE_ASANA_TEMPLATE_GID;

  if (!defaultGid) return null;

  return getTemplateGidForProjectType(projectType, {
    defaultTemplateGid: defaultGid,
    templates: config.asana.templates || {},
  });
}
