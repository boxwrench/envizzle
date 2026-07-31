import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('README.md contains no stale token counts', () => {
  const content = fs.readFileSync('README.md', 'utf8');
  assert.doesNotMatch(content, /\b34\b|\b37\b/, 'README.md contains stale 34 or 37 token count');
  assert.match(content, /38\s+`?\{\{TOKEN\}\}`?|38\s+token/i, 'README.md must mention 38 tokens');
});

test('README.md contains no references to deleted references/presets.md', () => {
  const content = fs.readFileSync('README.md', 'utf8');
  assert.doesNotMatch(content, /references\/presets\.md/, 'README.md references deleted presets.md');
});

test('README.md lists all six new reference files', () => {
  const content = fs.readFileSync('README.md', 'utf8');
  const refs = [
    'references/modes.md',
    'references/biomes.md',
    'references/archetypes.md',
    'references/mechanics.md',
    'references/cameras.md',
    'references/showcases.md',
  ];
  for (const ref of refs) {
    assert.ok(content.includes(ref), `README.md missing reference file link: ${ref}`);
  }
});

test('README.md documents selection and coherence CLI commands', () => {
  const content = fs.readFileSync('README.md', 'utf8');
  assert.match(content, /node selection\.mjs/i, 'README.md missing selection CLI command');
  assert.match(content, /node check\.mjs coherence/i, 'README.md missing coherence CLI command');
});

test('README.md recovery instructions contain actual retrieval command and no batch process history', () => {
  const content = fs.readFileSync('README.md', 'utf8');
  assert.match(content, /git\s+(restore|show)/, 'README.md recovery instructions must contain git restore or git show command');
  assert.doesNotMatch(content, /In Batch 6/i, 'README.md status section must not contain "In Batch 6"');
});
