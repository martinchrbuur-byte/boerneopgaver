/**
 * Recovery script: finds records in Supabase whose chore_id no longer
 * exists in the chores table, and prints a summary with earned values.
 * Run with: node scripts/recover-orphaned-records.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const envPath = path.join(root, '.env');

function loadEnvValue(key) {
  const content = fs.readFileSync(envPath, 'utf8');
  const line = content.split(/\r?\n/).find(e => e.trim().startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing from .env`);
  return line.slice(line.indexOf('=') + 1).trim();
}

function loadKey() {
  try { return loadEnvValue('SUPABASE_PUBLISHABLE_KEY'); }
  catch { return loadEnvValue('SUPABASE_ANON_KEY'); }
}

const supabase = createClient(
  'https://mfydufcizonxjmgyrwkj.supabase.co',
  loadKey(),
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── Auth: sign in as the app user ────────────────────────────────────────────
const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error('Usage: node scripts/recover-orphaned-records.mjs <email> <password>');
  process.exit(1);
}

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) { console.error('Auth failed:', authError.message); process.exit(1); }
const userId = authData.user.id;
console.log('Signed in as', email, '(userId:', userId, ')');

// ── Fetch all chores and records for this user ───────────────────────────────
const { data: chores, error: choresError } = await supabase
  .from('chores').select('*').eq('user_id', userId);
if (choresError) { console.error('Failed to load chores:', choresError.message); process.exit(1); }

const { data: records, error: recordsError } = await supabase
  .from('records').select('*').eq('user_id', userId);
if (recordsError) { console.error('Failed to load records:', recordsError.message); process.exit(1); }

console.log(`\nFound ${chores.length} chores and ${records.length} records in Supabase.`);

const choreIds = new Set(chores.map(c => c.id));
const orphaned = records.filter(r => !choreIds.has(r.chore_id));
const valid    = records.filter(r =>  choreIds.has(r.chore_id));

console.log(`  ✓ Valid records (chore exists):   ${valid.length}`);
console.log(`  ✗ Orphaned records (chore gone):  ${orphaned.length}`);

if (orphaned.length === 0) {
  console.log('\nNo orphaned records — nothing to recover.');
  process.exit(0);
}

// ── Group orphaned records by chore_id ───────────────────────────────────────
const byChore = {};
let totalLost = 0;
for (const r of orphaned) {
  if (!byChore[r.chore_id]) byChore[r.chore_id] = { records: [], earned: 0 };
  byChore[r.chore_id].records.push(r);
  const val = typeof r.earned_value === 'number' ? r.earned_value : 0;
  byChore[r.chore_id].earned += val;
  totalLost += val;
}

console.log('\n── Orphaned records by missing chore_id ────────────────────────');
for (const [choreId, info] of Object.entries(byChore)) {
  const completedBy = [...new Set(info.records.map(r => r.completed_by).filter(Boolean))];
  const dates = info.records.map(r => r.completed_at).sort();
  console.log(`\n  chore_id: ${choreId}`);
  console.log(`    completions: ${info.records.length}`);
  console.log(`    earned value: ${info.earned.toFixed(2)} kr`);
  console.log(`    completed by: ${completedBy.join(', ') || '(unknown)'}`);
  console.log(`    date range: ${dates[0]?.slice(0,10)} → ${dates[dates.length-1]?.slice(0,10)}`);
}

console.log(`\n── Total potentially lost earned value: ${totalLost.toFixed(2)} kr`);

// ── Write full orphaned records to a JSON file for manual recovery ───────────
const outPath = path.join(root, 'scripts', 'orphaned-records-recovery.json');
fs.writeFileSync(outPath, JSON.stringify({ orphaned, byChore, totalLost }, null, 2));
console.log(`\nFull record data written to: ${outPath}`);
console.log('You can use this file to manually restore the data if needed.');
