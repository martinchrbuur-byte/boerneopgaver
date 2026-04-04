import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const envPath = path.join(root, '.env');
const outputPath = path.join(root, 'docs', 'feedback-inbox.md');
const defaultUrl = 'https://mfydufcizonxjmgyrwkj.supabase.co';

function loadEnvFile() {
  if (!fs.existsSync(envPath)) {
    return new Map();
  }

  const entries = new Map();
  const content = fs.readFileSync(envPath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const [key, ...rest] = trimmed.split('=');
    entries.set(key.trim(), rest.join('=').trim());
  }

  return entries;
}

function getEnvValue(key, fallbackMap) {
  return process.env[key] || fallbackMap.get(key) || '';
}

function escapeMarkdown(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function formatCategory(category) {
  switch (category) {
    case 'bug':
      return 'Fejl';
    case 'idea':
      return 'Idé';
    case 'quality':
      return 'Forbedring';
    case 'question':
      return 'Spørgsmål';
    default:
      return 'Generelt';
  }
}

function renderFeedbackFile(entries) {
  const generatedAt = new Date().toISOString();
  const header = [
    '# Feedback inbox',
    '',
    '> Auto-generated from Supabase parent feedback. Edit in the app, not in this file.',
    '',
    `Generated: ${generatedAt}`,
    `Entries: ${entries.length}`,
    ''
  ];

  if (entries.length === 0) {
    return `${header.join('\n')}_No feedback entries yet._\n`;
  }

  const body = entries.map((entry, index) => {
    const title = escapeMarkdown(entry.title || `Feedback ${index + 1}`);
    const message = escapeMarkdown(entry.message || '');
    const userId = escapeMarkdown(entry.user_id || 'unknown');
    const createdAt = escapeMarkdown(entry.created_at || 'unknown');
    return [
      `## ${index + 1}. ${title}`,
      '',
      `- Category: ${formatCategory(entry.category)}`,
      `- User: ${userId}`,
      `- Created: ${createdAt}`,
      '',
      message,
      ''
    ].join('\n');
  });

  return `${header.join('\n')}${body.join('\n')}`;
}

async function run() {
  const envMap = loadEnvFile();
  const supabaseUrl = getEnvValue('SUPABASE_URL', envMap) || defaultUrl;
  const serviceRoleKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY', envMap);

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to import feedback into the workspace.');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await client
    .from('feedback')
    .select('id, user_id, title, message, category, created_at, created_by, status')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch feedback: ${error.message}`);
  }

  const content = renderFeedbackFile(data || []);
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`Imported ${(data || []).length} feedback entries into ${path.relative(root, outputPath)}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});