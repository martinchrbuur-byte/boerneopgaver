import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const envPath = path.join(root, '.env');

function loadEnvValue(key) {
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found');
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const line = content
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  if (!line) {
    throw new Error(`${key} is missing from .env`);
  }

  return line.slice(line.indexOf('=') + 1).trim();
}

function loadSupabaseKey() {
  try {
    return loadEnvValue('SUPABASE_PUBLISHABLE_KEY');
  } catch {
    return loadEnvValue('SUPABASE_ANON_KEY');
  }
}

const publishableKey = loadSupabaseKey();
const supabase = createClient('https://mfydufcizonxjmgyrwkj.supabase.co', publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const timestamp = Date.now();
const userId = `healthcheck-${timestamp}`;
const choreId = `chore_${timestamp}`;
const recordId = `record_${timestamp}`;

async function run() {
  const results = [];

  const choresRead = await supabase.from('chores').select('id', { count: 'exact', head: true });
  if (choresRead.error) {
    throw new Error(`Read test failed for chores: ${choresRead.error.message}`);
  }
  results.push('Read access to chores: OK');

  const uiUpsert = await supabase
    .from('ui_state')
    .upsert({ id: userId, user_id: userId, active_role: 'parent' });
  if (uiUpsert.error) {
    throw new Error(`Write test failed for ui_state: ${uiUpsert.error.message}`);
  }
  results.push('Write access to ui_state: OK');

  const choreInsert = await supabase
    .from('chores')
    .insert({
      id: choreId,
      name: 'Supabase test chore',
      created_at: new Date(timestamp).toISOString(),
      assigned_to: ['Andrea'],
      user_id: userId
    });
  if (choreInsert.error) {
    throw new Error(`Write test failed for chores: ${choreInsert.error.message}`);
  }
  results.push('Write access to chores: OK');

  const recordInsert = await supabase
    .from('records')
    .insert({
      id: recordId,
      chore_id: choreId,
      completed_at: new Date(timestamp).toISOString(),
      undone_at: null,
      user_id: userId
    });
  if (recordInsert.error) {
    throw new Error(`Write test failed for records: ${recordInsert.error.message}`);
  }
  results.push('Write access to records: OK');

  const cleanupRecord = await supabase.from('records').delete().eq('id', recordId);
  if (cleanupRecord.error) {
    throw new Error(`Cleanup failed for records: ${cleanupRecord.error.message}`);
  }

  const cleanupChore = await supabase.from('chores').delete().eq('id', choreId);
  if (cleanupChore.error) {
    throw new Error(`Cleanup failed for chores: ${cleanupChore.error.message}`);
  }

  const cleanupUi = await supabase.from('ui_state').delete().eq('id', userId);
  if (cleanupUi.error) {
    throw new Error(`Cleanup failed for ui_state: ${cleanupUi.error.message}`);
  }

  results.push('Cleanup: OK');

  console.log('Supabase test passed');
  for (const item of results) {
    console.log(`- ${item}`);
  }
}

run().catch((error) => {
  console.error('Supabase test failed');
  console.error(error.message);
  process.exit(1);
});
