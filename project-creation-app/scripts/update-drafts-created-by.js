#!/usr/bin/env node
/**
 * Update the Project Drafts table to change "Created By" from email to a link field
 *
 * Usage: AIRTABLE_PAT=patXXX node scripts/update-drafts-created-by.js
 */

const BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || 'app2FYvkqaFiPzz2o';
const PAT = process.env.AIRTABLE_PAT;

if (!PAT) {
  console.error('Error: AIRTABLE_PAT environment variable is required');
  process.exit(1);
}

async function getExistingTables() {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: {
      'Authorization': `Bearer ${PAT}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to fetch tables: ${response.status}`);
  }

  const data = await response.json();
  return data.tables || [];
}

async function updateField(tableId, fieldId, updates) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields/${fieldId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to update field: ${response.status}`);
  }

  return response.json();
}

async function createField(tableId, fieldDef) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fieldDef),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to create field: ${response.status}`);
  }

  return response.json();
}

async function deleteField(tableId, fieldId) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields/${fieldId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${PAT}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to delete field: ${response.status}`);
  }

  return true;
}

async function main() {
  console.log('Updating Project Drafts table...\n');

  const tables = await getExistingTables();

  const draftsTable = tables.find(t => t.name === 'Project Drafts');
  if (!draftsTable) {
    console.error('Project Drafts table not found!');
    process.exit(1);
  }

  const teamMembersTable = tables.find(t => t.name === 'Data Team Members');
  if (!teamMembersTable) {
    console.error('Data Team Members table not found!');
    process.exit(1);
  }

  console.log(`Found Project Drafts table: ${draftsTable.id}`);
  console.log(`Found Data Team Members table: ${teamMembersTable.id}`);

  // Check current fields
  const createdByField = draftsTable.fields.find(f => f.name === 'Created By');
  const createdByMemberField = draftsTable.fields.find(f => f.name === 'Created By Member');

  if (createdByMemberField) {
    console.log('\n✓ "Created By Member" field already exists!');
    console.log(`  Field ID: ${createdByMemberField.id}`);
    return;
  }

  // Create new link field
  console.log('\nCreating "Created By Member" link field...');
  const newField = await createField(draftsTable.id, {
    name: 'Created By Member',
    type: 'multipleRecordLinks',
    description: 'Link to the team member who created the draft',
    options: {
      linkedTableId: teamMembersTable.id,
    },
  });

  console.log(`✓ Created field: ${newField.id}`);

  // Optionally delete old email field
  if (createdByField && createdByField.type === 'email') {
    console.log('\nNote: Old "Created By" email field still exists.');
    console.log('You can delete it manually in Airtable if no longer needed.');
  }

  console.log('\n✓ Done! Update your fields.toml to use "Created By Member" instead of "Created By"');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
