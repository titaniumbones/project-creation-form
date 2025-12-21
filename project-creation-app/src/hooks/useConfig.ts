// Hook for loading and parsing TOML configuration
import { useState, useEffect } from 'react';
import toml from 'toml';
import type { Config, FieldConfig } from '../types';

// Import config files as raw text
import fieldsConfig from '../config/fields.toml?raw';
import integrationsConfig from '../config/integrations.toml?raw';

interface ConfigHookResult<T> {
  config: T | null;
  error: Error | null;
  isLoading: boolean;
}

interface IntegrationsConfig {
  asana?: {
    workspace_gid?: string;
    template_gid?: string;
    team_gid?: string;
  };
  google?: {
    shared_drive_id?: string;
    projects_folder_id?: string;
    scoping_doc_template_id?: string;
    kickoff_deck_template_id?: string;
  };
}

interface FieldWithName extends FieldConfig {
  name: string;
}

export function useFieldsConfig(): ConfigHookResult<Config> {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const parsed = toml.parse(fieldsConfig) as Config;
      setConfig(parsed);
    } catch (err) {
      console.error('Failed to parse fields.toml:', err);
      setError(err as Error);
    }
  }, []);

  return { config, error, isLoading: !config && !error };
}

export function useIntegrationsConfig(): ConfigHookResult<IntegrationsConfig> {
  const [config, setConfig] = useState<IntegrationsConfig | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const parsed = toml.parse(integrationsConfig) as IntegrationsConfig;
      setConfig(parsed);
    } catch (err) {
      console.error('Failed to parse integrations.toml:', err);
      setError(err as Error);
    }
  }, []);

  return { config, error, isLoading: !config && !error };
}

// Get field configuration by field name
export function getFieldConfig(fieldsConfig: Config | null, fieldName: string): FieldConfig | null {
  return fieldsConfig?.fields?.[fieldName] || null;
}

// Get all fields for a specific section
export function getFieldsBySection(fieldsConfig: Config | null, section: string): FieldWithName[] {
  if (!fieldsConfig?.fields) return [];

  return Object.entries(fieldsConfig.fields)
    .filter(([, field]) => field.section === section)
    .map(([name, field]) => ({ name, ...field }));
}

// Get all sections in order
export function getSections(fieldsConfig: Config | null): string[] {
  if (!fieldsConfig?.fields) return [];

  const sections = new Set<string>();
  Object.values(fieldsConfig.fields).forEach(field => {
    if (field.section) sections.add(field.section);
  });

  // Return in logical order
  const order = ['basics', 'description', 'team', 'outcomes'];
  return order.filter(s => sections.has(s));
}
