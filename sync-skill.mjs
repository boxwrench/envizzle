import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const targetDir = path.join(rootDir, 'skills', 'envizzle');

const itemsToCopy = [
  'SKILL.md',
  'TEMPLATE.md',
  'assemble.mjs',
  'benchmark-cases.mjs',
  'benchmark.mjs',
  'build-contract.mjs',
  'check.mjs',
  'reference-loader.mjs',
  'selection.mjs',
  'references',
  'verify'
];

fs.mkdirSync(targetDir, { recursive: true });

for (const item of itemsToCopy) {
  const src = path.join(rootDir, item);
  const dest = path.join(targetDir, item);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true, force: true });
  }
}

console.log('Successfully synced skill files to skills/envizzle/');
