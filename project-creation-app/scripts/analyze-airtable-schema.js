#!/usr/bin/env node
/**
 * Airtable Schema Analyzer
 *
 * Downloads and analyzes the schema of Airtable tables to help configure field mappings.
 *
 * Usage:
 *   1. Set AIRTABLE_PAT environment variable (Personal Access Token)
 *   2. Run: node scripts/analyze-airtable-schema.js
 *
 * Or pass token directly:
 *   AIRTABLE_PAT=patXXX node scripts/analyze-airtable-schema.js
 */

const BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || 'app2FYvkqaFiPzz2o';

async function getSchema(token) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to fetch schema: ${response.status}`);
  }

  return response.json();
}

function analyzeTable(table) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TABLE: ${table.name}`);
  console.log(`ID: ${table.id}`);
  console.log(`${'='.repeat(60)}`);

  const fieldsByType = {};

  for (const field of table.fields) {
    if (!fieldsByType[field.type]) {
      fieldsByType[field.type] = [];
    }
    fieldsByType[field.type].push(field);
  }

  // Print fields grouped by type
  for (const [type, fields] of Object.entries(fieldsByType).sort()) {
    console.log(`\n  ${type.toUpperCase()} fields:`);
    for (const field of fields) {
      let details = '';
      if (field.options) {
        if (field.options.choices) {
          details = ` [choices: ${field.options.choices.map(c => c.name).join(', ')}]`;
        }
        if (field.options.linkedTableId) {
          details = ` [linked to table: ${field.options.linkedTableId}]`;
        }
      }
      console.log(`    - "${field.name}" (id: ${field.id})${details}`);
    }
  }

  return {
    name: table.name,
    id: table.id,
    fields: table.fields,
    fieldsByType,
  };
}

function generateConfigSuggestion(tables) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUGGESTED CONFIG UPDATES FOR fields.toml');
  console.log(`${'='.repeat(60)}`);

  const projectsTable = tables.find(t => t.name === 'Projects');
  const milestonesTable = tables.find(t => t.name === 'Milestones');
  const assignmentsTable = tables.find(t => t.name === 'Assignments');
  const teamMembersTable = tables.find(t => t.name === 'Data Team Members');

  if (projectsTable) {
    console.log('\n[airtable.project_fields]');
    console.log('# Available URL fields in Projects table:');
    const urlFields = projectsTable.fields.filter(f => f.type === 'url' || f.type === 'text');
    for (const field of urlFields) {
      const key = field.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      console.log(`# ${key} = "${field.name}"`);
    }
  }

  if (assignmentsTable) {
    console.log('\n[airtable.assignment_fields]');
    console.log('# Available fields in Assignments table:');
    for (const field of assignmentsTable.fields) {
      console.log(`# ${field.name} (${field.type})`);
    }

    // Check for Role field options
    const roleField = assignmentsTable.fields.find(f => f.name === 'Role');
    if (roleField?.options?.choices) {
      console.log('\n[airtable.role_values]');
      console.log('# Available role choices:');
      for (const choice of roleField.options.choices) {
        console.log(`# "${choice.name}"`);
      }
    }
  }
}

function exportSchemaJson(tables, filename) {
  const fs = require('fs');
  const output = {
    exportedAt: new Date().toISOString(),
    baseId: BASE_ID,
    tables: tables.map(t => ({
      name: t.name,
      id: t.id,
      fields: t.fields.map(f => ({
        name: f.name,
        id: f.id,
        type: f.type,
        options: f.options,
      })),
    })),
  };

  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\nSchema exported to: ${filename}`);
}

async function main() {
  // Try to get token from various sources
  let token = process.env.AIRTABLE_PAT;

  if (!token) {
    // Try to read from localStorage export or .env
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, '..', '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        // Look for any token pattern
        const match = envContent.match(/AIRTABLE.*TOKEN.*=\s*(.+)/i);
        if (match) {
          token = match[1].trim();
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!token) {
    console.error('Error: AIRTABLE_PAT environment variable is required');
    console.error('');
    console.error('Get a Personal Access Token from: https://airtable.com/create/tokens');
    console.error('Required scopes: schema.bases:read');
    console.error('');
    console.error('Usage: AIRTABLE_PAT=patXXX node scripts/analyze-airtable-schema.js');
    process.exit(1);
  }

  console.log(`Fetching schema for base: ${BASE_ID}`);

  try {
    const schema = await getSchema(token);

    console.log(`\nFound ${schema.tables.length} tables:`);
    for (const table of schema.tables) {
      console.log(`  - ${table.name} (${table.fields.length} fields)`);
    }

    const analyzedTables = [];
    for (const table of schema.tables) {
      const analyzed = analyzeTable(table);
      analyzedTables.push(analyzed);
    }

    generateConfigSuggestion(schema.tables);

    // Export full schema to JSON
    const filename = `airtable-schema-${new Date().toISOString().split('T')[0]}.json`;
    exportSchemaJson(schema.tables, filename);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
