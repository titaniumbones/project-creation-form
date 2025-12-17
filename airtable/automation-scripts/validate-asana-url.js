/**
 * Airtable Automation Script: Validate Asana URL and Update Status
 *
 * This script validates that a pasted Asana URL is properly formatted
 * and optionally updates the project status.
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. In Airtable, go to Automations > Create automation
 * 2. Trigger: "When record updated" with condition:
 *    - "Asana Board" is not empty
 * 3. Action: "Run script"
 * 4. Configure Input Variables (in the left panel):
 *
 *    Variable Name   | Type | Source
 *    ----------------|------|----------------------------------
 *    recordId        | Text | Record ID (from trigger)
 *    asanaUrl        | Text | Asana Board field
 *    currentStatus   | Text | Status field
 *
 * 5. Copy this entire script into the script editor
 * 6. Add "Update record" action after script (optional):
 *    - Record ID: use recordId from script output
 *    - Status: use newStatus from script output (if you want auto-status update)
 */

// Get input variables from automation configuration
const inputConfig = input.config();

const recordId = inputConfig.recordId;
const asanaUrl = inputConfig.asanaUrl || '';
const currentStatus = inputConfig.currentStatus || 'In Ideation';

// Validate Asana URL format
function validateAsanaUrl(url) {
    if (!url || url.trim() === '') {
        return { valid: false, reason: 'URL is empty' };
    }

    // Check if it's an Asana URL
    const asanaPattern = /^https:\/\/app\.asana\.com\/0\/(\d+)/;
    const match = url.match(asanaPattern);

    if (!match) {
        return {
            valid: false,
            reason: 'URL does not match Asana project format. Expected: https://app.asana.com/0/PROJECT_ID/...'
        };
    }

    return {
        valid: true,
        projectGid: match[1],
        reason: 'Valid Asana project URL'
    };
}

// Validate the URL
const validation = validateAsanaUrl(asanaUrl);

if (validation.valid) {
    console.log(`Valid Asana URL detected`);
    console.log(`Project GID: ${validation.projectGid}`);

    // Determine new status (only upgrade from "In Ideation")
    let newStatus = currentStatus;
    if (currentStatus === 'In Ideation') {
        newStatus = 'Active';
        console.log(`Status will be updated: ${currentStatus} → ${newStatus}`);
    } else {
        console.log(`Status unchanged: ${currentStatus}`);
    }

    // Output for subsequent actions
    output.set('recordId', recordId);
    output.set('isValid', true);
    output.set('projectGid', validation.projectGid);
    output.set('newStatus', newStatus);
    output.set('message', 'Asana project linked successfully');

} else {
    console.log(`Invalid Asana URL: ${validation.reason}`);

    // Output error state (don't update status)
    output.set('recordId', recordId);
    output.set('isValid', false);
    output.set('projectGid', '');
    output.set('newStatus', currentStatus);
    output.set('message', validation.reason);
}

console.log('URL validation completed');
