import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const vendorDir = path.join(rootDir, 'src', 'vendor');
const outFile = path.join(vendorDir, 'supabase-js.js');

await mkdir(vendorDir, { recursive: true });

await build({
  entryPoints: ['@supabase/supabase-js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  outfile: outFile,
  sourcemap: false,
  minify: false,
  legalComments: 'none'
});

console.log(`Bundled @supabase/supabase-js to ${path.relative(rootDir, outFile)}`);
