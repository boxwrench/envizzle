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

test('verify README documents the truthful verification hook and CLI controls', () => {
  const content = fs.readFileSync('verify/README.md', 'utf8');
  assert.match(content, /--browser-channel chrome/);
  assert.match(content, /--headed/);
  assert.match(content, /ready: false/);
  assert.match(content, /status: "initializing"/);
  assert.match(content, /rendererInfo\(\)/);
  assert.match(content, /terrainDiagnostics\(\)/);
  assert.match(content, /cameraDiagnostics\(\)/);
  assert.doesNotMatch(content, /cameraNearestDepth/);
});

test('TEMPLATE.md documents the same truthful verification hook shape', () => {
  const content = fs.readFileSync('TEMPLATE.md', 'utf8');
  assert.match(content, /## 6\. Mandatory Verification Hook/);
  assert.match(content, /ready: false/);
  assert.match(content, /status: "initializing"/);
  assert.match(content, /rendererInfo\(\)/);
  assert.match(content, /terrainDiagnostics\(\)/);
  assert.match(content, /cameraDiagnostics\(\)/);
  assert.doesNotMatch(content, /cameraNearestDepth/);
});
test('README.md recovery instructions contain actual retrieval command and no batch process history', () => {
  const content = fs.readFileSync('README.md', 'utf8');
  assert.match(content, /git\s+(restore|show)/, 'README.md recovery instructions must contain git restore or git show command');
  assert.doesNotMatch(content, /In Batch 6/i, 'README.md status section must not contain "In Batch 6"');
});

test('README.md documents installation as a standalone skill across platforms', () => {
  const content = fs.readFileSync('README.md', 'utf8');
  assert.match(content, /repository root is the canonical source of truth/i, 'README.md must mention repository root as the canonical source of truth');
  assert.match(content, /do not maintain a duplicated `skills\/envizzle\/` tree/i, 'README.md must prohibit a duplicated skills/envizzle tree');
  assert.match(content, /linking is recommended during development/i, 'README.md must recommend linking during development');
  assert.match(content, /copying or installing a snapshot is appropriate for stable installations/i, 'README.md must document snapshot installation');
  assert.match(content, /gemini skills link/i, 'README.md must document Gemini CLI installation');
  assert.match(content, /gemini skills install https:\/\/github\.com\/boxwrench\/envizzle --scope user --consent/i, 'README.md must document Gemini Git installation');
  assert.match(content, /workspace scope may be used instead of user scope/i, 'README.md must document Gemini workspace scope');
  assert.match(content, /\.claude\/skills/i, 'README.md must document .claude/skills');
  assert.match(content, /New-Item -ItemType Junction/i, 'README.md must include a Windows directory junction example');
  assert.match(content, /\/envizzle/i, 'README.md must document Claude invocation');
  assert.match(content, /\.agents\/skills/i, 'README.md must document .agents/skills');
  assert.match(content, /\$envizzle/i, 'README.md must document Codex invocation');
  assert.match(content, /~?\/\.gemini\/config\/skills/i, 'README.md must document ~/.gemini/config/skills');
  assert.match(content, /standalone skill,\s+not an Antigravity plugin/i, 'README.md must state standalone skill, not an Antigravity plugin');
  assert.match(content, /plugin-specific commands,[\s\S]*MCP servers[\s\S]*marketplace distribution/i, 'README.md must explain when plugin packaging would be appropriate');
  assert.match(content, /outside the Envizzle/i, 'README.md must instruct writing generated projects outside Envizzle repo');
});
