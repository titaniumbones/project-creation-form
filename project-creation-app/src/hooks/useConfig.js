// Hook for loading and parsing TOML configuration
import { useState, useEffect } from 'react';
import toml from 'toml';

// Import config files as raw text
import fieldsConfig from '../config/fields.toml?raw';
import integrationsConfig from '../config/integrations.toml?raw';

export function useFieldsConfig() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const parsed = toml.parse(fieldsConfig);
      setConfig(parsed);
    } catch (err) {
      console.error('Failed to parse fields.toml:', err);
      setError(err);
    }
  }, []);

  return { config, error, isLoading: !config && !error };
}

export function useIntegrationsConfig() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const parsed = toml.parse(integrationsConfig);
      setConfig(parsed);
    } catch (err) {
      console.error('Failed to parse integrations.toml:', err);
      setError(err);
    }
  }, []);

  return { config, error, isLoading: !config && !error };
}

// Get field configuration by field name
export function getFieldConfig(fieldsConfig, fieldName) {
  return fieldsConfig?.fields?.[fieldName] || null;
}

// Get all fields for a specific section
export function getFieldsBySection(fieldsConfig, section) {
  if (!fieldsConfig?.fields) return [];

  return Object.entries(fieldsConfig.fields)
    .filter(([_, field]) => field.section === section)
    .map(([name, field]) => ({ name, ...field }));
}

// Get all sections in order
export function getSections(fieldsConfig) {
  if (!fieldsConfig?.fields) return [];

  const sections = new Set();
  Object.values(fieldsConfig.fields).forEach(field => {
    if (field.section) sections.add(field.section);
  });

  // Return in logical order
  const order = ['basics', 'description', 'team', 'outcomes'];
  return order.filter(s => sections.has(s));
}
