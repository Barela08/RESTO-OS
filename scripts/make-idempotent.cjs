const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'supabase', 'migrations', '20261112000002_secure_rls_and_functions.sql');
let content = fs.readFileSync(file, 'utf8');

// Replace any CREATE POLICY that doesn't already have DROP POLICY IF EXISTS before it
const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/^CREATE POLICY "([^"]+)" ON ([a-zA-Z0-9_]+)/);
  if (match) {
    const polName = match[1];
    const tblName = match[2];
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    if (!prevLine.includes(`DROP POLICY IF EXISTS "${polName}"`)) {
      newLines.push(`DROP POLICY IF EXISTS "${polName}" ON ${tblName};`);
    }
  }
  newLines.push(line);
}

fs.writeFileSync(file, newLines.join('\n'), 'utf8');
console.log('Successfully made all CREATE POLICY statements idempotent in migration 02.');
