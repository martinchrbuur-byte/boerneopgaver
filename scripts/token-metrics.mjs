import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEFAULT_TARGETS = ['src'];
const SUPPORTED_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.css']);

function estimateTokens(content) {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (!compact) return 0;
  return Math.ceil(compact.length / 4);
}

function parseArgs(argv) {
  const [command = 'report', ...rest] = argv;
  const flags = {};

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith('--')) continue;

    const key = value.slice(2);
    const next = rest[index + 1];

    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return { command, flags };
}

function toRelative(fullPath) {
  return path.relative(ROOT, fullPath).replace(/\\/g, '/');
}

async function readTargets(targets) {
  const files = [];

  async function walk(entryPath) {
    const stats = await fs.stat(entryPath);
    if (stats.isFile()) {
      const extension = path.extname(entryPath);
      if (SUPPORTED_EXTENSIONS.has(extension)) {
        files.push(entryPath);
      }
      return;
    }

    if (!stats.isDirectory()) return;

    const children = await fs.readdir(entryPath);
    for (const child of children) {
      await walk(path.join(entryPath, child));
    }
  }

  for (const target of targets) {
    const absolute = path.resolve(ROOT, target);
    try {
      await walk(absolute);
    } catch {
      // ignore missing targets
    }
  }

  return files;
}

async function collectMetrics(targets = DEFAULT_TARGETS) {
  const files = await readTargets(targets);
  const metrics = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const relativePath = toRelative(filePath);
    const lines = content ? content.split(/\r?\n/).length : 0;
    const chars = content.length;
    const tokens = estimateTokens(content);

    metrics.push({ file: relativePath, lines, chars, tokens });
  }

  metrics.sort((a, b) => b.tokens - a.tokens || a.file.localeCompare(b.file));

  const totals = metrics.reduce(
    (acc, item) => {
      acc.files += 1;
      acc.lines += item.lines;
      acc.chars += item.chars;
      acc.tokens += item.tokens;
      return acc;
    },
    { files: 0, lines: 0, chars: 0, tokens: 0 }
  );

  return { targets, totals, metrics, generatedAt: new Date().toISOString() };
}

function printReport(report) {
  console.log(`Token Metrics (${report.generatedAt})`);
  console.log(`Targets: ${report.targets.join(', ')}`);
  console.log(`Totals: files=${report.totals.files} lines=${report.totals.lines} chars=${report.totals.chars} tokens=${report.totals.tokens}`);

  for (const item of report.metrics.slice(0, 20)) {
    console.log(`${item.file.padEnd(48)} tokens=${String(item.tokens).padStart(6)} lines=${String(item.lines).padStart(5)} chars=${String(item.chars).padStart(7)}`);
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(path.resolve(ROOT, filePath), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function parseTargets(raw) {
  if (!raw) return DEFAULT_TARGETS;
  return String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function toBudget(report) {
  const maxFileTokens = {};
  for (const metric of report.metrics) {
    maxFileTokens[metric.file] = metric.tokens;
  }

  return {
    generatedAt: report.generatedAt,
    targets: report.targets,
    maxTotalTokens: report.totals.tokens,
    maxFileTokens
  };
}

async function run() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const targets = parseTargets(flags.targets);

  if (command === 'report') {
    const report = await collectMetrics(targets);
    printReport(report);
    return;
  }

  if (command === 'baseline') {
    const out = flags.out || 'scripts/token-baseline.json';
    const report = await collectMetrics(targets);
    await writeJson(out, report);
    printReport(report);
    console.log(`Baseline written: ${out}`);
    return;
  }

  if (command === 'init-budget') {
    const out = flags.out || 'scripts/token-budgets.json';
    const report = await collectMetrics(targets);
    const budget = toBudget(report);
    await writeJson(out, budget);
    printReport(report);
    console.log(`Budget written: ${out}`);
    return;
  }

  if (command === 'gate') {
    const budgetPath = flags.budget || 'scripts/token-budgets.json';
    const budgetRaw = await fs.readFile(path.resolve(ROOT, budgetPath), 'utf8');
    const budget = JSON.parse(budgetRaw);

    const report = await collectMetrics(budget.targets || targets);
    printReport(report);

    const errors = [];

    if (typeof budget.maxTotalTokens === 'number' && report.totals.tokens > budget.maxTotalTokens) {
      errors.push(`Total tokens exceeded: ${report.totals.tokens} > ${budget.maxTotalTokens}`);
    }

    const maxFileTokens = budget.maxFileTokens || {};
    for (const metric of report.metrics) {
      const fileBudget = maxFileTokens[metric.file];
      if (typeof fileBudget === 'number' && metric.tokens > fileBudget) {
        errors.push(`${metric.file} exceeded: ${metric.tokens} > ${fileBudget}`);
      }
    }

    if (errors.length) {
      console.error('Token budget gate failed:');
      for (const error of errors) {
        console.error(`- ${error}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Token budget gate passed: ${report.totals.tokens}/${budget.maxTotalTokens}`);
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
