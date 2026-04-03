import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function getTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

function isLikelyText(content) {
  return !content.includes('\u0000');
}

function shouldScanFile(filePath) {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.startsWith('.git/')) {
    return false;
  }

  const ignoredExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.eot',
    '.zip', '.gz', '.tar', '.7z', '.mp4', '.mp3', '.wav', '.mov', '.avi', '.bin', '.exe', '.dll'
  ]);

  return !ignoredExtensions.has(path.extname(lowerPath));
}

function hasTrackedEnvFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  if (normalized.endsWith('.env.example') || normalized === '.env.example') {
    return false;
  }

  return normalized === '.env' || normalized.endsWith('/.env') || /\.env\.[^/]+$/.test(normalized);
}

function getSecretMatches(filePath, content) {
  const findings = [];
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const isTestFile = normalizedPath.startsWith('tests/');

  if (normalizedPath.endsWith('.env.example') || normalizedPath === '.env.example') {
    return findings;
  }

  const lines = content.split(/\r?\n/);

  const suspiciousPatterns = [
    /(SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|SECRET_KEY|PRIVATE_KEY)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{16,})/i,
    /(api[_-]?key|secret|token|password)\s*[:=]\s*['"]([A-Za-z0-9_\-]{20,})['"]/i
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }

    for (let patternIndex = 0; patternIndex < suspiciousPatterns.length; patternIndex += 1) {
      if (isTestFile && patternIndex === 0) {
        continue;
      }

      const pattern = suspiciousPatterns[patternIndex];
      if (!pattern.test(line)) {
        continue;
      }

      if (
        line.includes('__SUPABASE_PUBLISHABLE_KEY__') ||
        line.includes('${{') ||
        /your_(copied|actual|publishable)_key_here/i.test(line)
      ) {
        continue;
      }

      findings.push({
        filePath,
        line: index + 1,
        snippet: trimmed.slice(0, 180)
      });
      break;
    }
  }

  return findings;
}

function main() {
  const trackedFiles = getTrackedFiles();
  const trackedEnvFiles = trackedFiles.filter(hasTrackedEnvFile);
  const suspiciousFindings = [];

  for (const filePath of trackedFiles) {
    if (!shouldScanFile(filePath)) {
      continue;
    }

    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    if (!isLikelyText(content)) {
      continue;
    }

    suspiciousFindings.push(...getSecretMatches(filePath, content));
  }

  if (trackedEnvFiles.length === 0 && suspiciousFindings.length === 0) {
    console.log('Secret guard passed: no tracked .env files or obvious hardcoded secrets found.');
    return;
  }

  console.error('Secret guard failed.');

  if (trackedEnvFiles.length > 0) {
    console.error('Tracked .env files detected:');
    for (const filePath of trackedEnvFiles) {
      console.error(`- ${filePath}`);
    }
  }

  if (suspiciousFindings.length > 0) {
    console.error('Suspicious secret-like values detected in tracked files:');
    for (const finding of suspiciousFindings) {
      console.error(`- ${finding.filePath}:${finding.line} -> ${finding.snippet}`);
    }
  }

  process.exit(1);
}

main();
