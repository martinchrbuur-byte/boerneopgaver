import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distSrcDir = path.join(distDir, 'src');

const rootFiles = [
  'index.html',
  'favicon.svg',
  'manifest.webmanifest',
  'service-worker.js',
  '.nojekyll'
];

await rm(distDir, { recursive: true, force: true });
await mkdir(distSrcDir, { recursive: true });

for (const fileName of rootFiles) {
  await cp(path.join(rootDir, fileName), path.join(distDir, fileName));
}

await cp(path.join(rootDir, 'src'), distSrcDir, { recursive: true });

const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
if (publishableKey) {
  const configPath = path.join(distSrcDir, 'config', 'supabaseConfig.js');
  const configContent = await readFile(configPath, 'utf8');
  await writeFile(
    configPath,
    configContent.replace('__SUPABASE_PUBLISHABLE_KEY__', publishableKey),
    'utf8'
  );
  console.log('Injected Supabase publishable key into dist build.');
} else {
  console.log('No publishable key in env; dist build keeps placeholder config.');
}

const spotifyConnectUrl = process.env.SPOTIFY_CONNECT_URL || '';
const spotifyRecommendationsEndpoint = process.env.SPOTIFY_RECOMMENDATIONS_ENDPOINT || '';

if (spotifyConnectUrl || spotifyRecommendationsEndpoint) {
  const appConfigPath = path.join(distSrcDir, 'config', 'appConfig.js');
  const appConfigContent = await readFile(appConfigPath, 'utf8');
  const nextContent = appConfigContent
    .replace('__SPOTIFY_CONNECT_URL__', spotifyConnectUrl)
    .replace('__SPOTIFY_RECOMMENDATIONS_ENDPOINT__', spotifyRecommendationsEndpoint);
  await writeFile(appConfigPath, nextContent, 'utf8');
  console.log('Injected Spotify public endpoints into dist build.');
} else {
  console.log('No Spotify endpoint env vars found; dist build keeps Spotify placeholders.');
}

console.log(`Static site prepared in ${path.relative(rootDir, distDir)}`);