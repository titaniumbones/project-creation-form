#!/usr/bin/env node
/**
 * One-time setup script to create the Project Drafts table in Airtable
 *
 * Usage: AIRTABLE_PAT=patXXX node scripts/setup-drafts-table.js
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

async function createTable(tableSchema) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tableSchema),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to create table: ${response.status}`);
  }

  return response.json();
}

async function main() {
  console.log(`Setting up Project Drafts table in base: ${BASE_ID}\n`);

  // Check if table already exists
  console.log('Checking existing tables...');
  const existingTables = await getExistingTables();
  const tableNames = existingTables.map(t => t.name);
  console.log(`Found ${existingTables.length} tables: ${tableNames.join(', ')}\n`);

  if (tableNames.includes('Project Drafts')) {
    console.log('✓ Project Drafts table already exists!');
    const draftsTable = existingTables.find(t => t.name === 'Project Drafts');
    console.log(`  Table ID: ${draftsTable.id}`);
    console.log(`  Fields: ${draftsTable.fields.map(f => f.name).join(', ')}`);
    return;
  }

  // Find the Data Team Members table for linking
  const teamMembersTable = existingTables.find(t => t.name === 'Data Team Members');
  if (!teamMembersTable) {
    console.warn('Warning: Data Team Members table not found. Approver link field will be skipped.');
  }

  // Define the table schema
  const tableSchema = {
    name: 'Project Drafts',
    description: 'Draft project scopes for approval workflow',
    fields: [
      {
        name: 'Project Name',
        type: 'singleLineText',
        description: 'Name of the project (extracted from draft data)',
      },
      {
        name: 'Draft Data',
        type: 'multilineText',
        description: 'JSON blob containing full form state',
      },
      {
        name: 'Status',
        type: 'singleSelect',
        description: 'Current status of the draft',
        options: {
          choices: [
            { name: 'Draft', color: 'grayLight2' },
            { name: 'Pending Approval', color: 'yellowLight2' },
            { name: 'Approved', color: 'greenLight2' },
            { name: 'Changes Requested', color: 'orangeLight2' },
          ],
        },
      },
      {
        name: 'Created By',
        type: 'email',
        description: 'Email of the coordinator who created the draft',
      },
      {
        name: 'Approver Email',
        type: 'email',
        description: 'Email address to send approval requests to',
      },
      {
        name: 'Approver Notes',
        type: 'multilineText',
        description: 'Feedback notes from the approver',
      },
      {
        name: 'Decision At',
        type: 'date',
        description: 'Date when the draft was approved or changes requested',
        options: {
          dateFormat: { name: 'iso' },
        },
      },
      {
        name: 'Share Token',
        type: 'singleLineText',
        description: 'Unique token for shareable review URL',
      },
    ],
  };

  // Add Approver link field if team members table exists
  if (teamMembersTable) {
    tableSchema.fields.push({
      name: 'Approver',
      type: 'multipleRecordLinks',
      description: 'Link to the approving team member',
      options: {
        linkedTableId: teamMembersTable.id,
      },
    });
  }

  console.log('Creating Project Drafts table...');
  const result = await createTable(tableSchema);

  console.log('\n✓ Project Drafts table created successfully!');
  console.log(`  Table ID: ${result.id}`);
  console.log(`  Fields created: ${result.fields.map(f => f.name).join(', ')}`);

  console.log('\n--- Next Steps ---');
  console.log('1. Set up Airtable Automations for email notifications:');
  console.log('   - Trigger: When Status changes to "Pending Approval"');
  console.log('   - Action: Send email to {Approver Email}');
  console.log('   - Subject: "Project scope needs your approval: {Project Name}"');
  console.log('   - Body: Include link to review page');
  console.log('');
  console.log('2. Optional: Add automation for "Changes Requested" status');
  console.log('   - Send email to {Created By} with feedback notes');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
