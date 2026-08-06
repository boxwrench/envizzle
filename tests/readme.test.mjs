import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const readme = fs.readFileSync('README.md', 'utf8');

test('README.md contains no stale token counts', () => {
  assert.doesNotMatch(readme, /\b34\b|\b37\b/, 'README.md contains stale 34 or 37 token count');
  assert.match(readme, /38\s+`?\{\{TOKEN\}\}`?|38\s+token/i, 'README.md must mention 38 tokens');
});

test('README.md contains no references to deleted references/presets.md', () => {
  assert.doesNotMatch(readme, /references\/presets\.md/, 'README.md references deleted presets.md');
});

test('README.md lists all six new reference files', () => {
  const refs = [
    'references/modes.md',
    'references/biomes.md',
    'references/archetypes.md',
    'references/mechanics.md',
    'references/cameras.md',
    'references/showcases.md',
  ];
  for (const ref of refs) {
    assert.ok(readme.includes(ref), `README.md missing reference file link: ${ref}`);
  }
});

test('README.md documents selection and coherence CLI commands', () => {
  assert.match(readme, /node selection\.mjs/i, 'README.md missing selection CLI command');
  assert.match(readme, /node check\.mjs coherence/i, 'README.md missing coherence CLI command');
});

test('README.md documents installation as a standalone skill across platforms', () => {
  assert.match(readme, /repository root is the canonical source of truth/i, 'README.md must mention repository root as the canonical source of truth');
  assert.match(readme, /do not maintain a duplicated `skills\/envizzle\/` tree/i, 'README.md must prohibit a duplicated skills/envizzle tree');
  assert.match(readme, /linking is recommended during development/i, 'README.md must recommend linking during development');
  assert.match(readme, /copying or installing a snapshot is appropriate for stable installations/i, 'README.md must document snapshot installation');
  assert.match(readme, /gemini skills link/i, 'README.md must document Gemini CLI installation');
  assert.match(readme, /gemini skills install https:\/\/github\.com\/boxwrench\/envizzle --scope user --consent/i, 'README.md must document Gemini Git installation');
  assert.match(readme, /workspace scope may be used instead of user scope/i, 'README.md must document Gemini workspace scope');
  assert.match(readme, /\.claude\/skills/i, 'README.md must document .claude/skills');
  assert.match(readme, /New-Item -ItemType Junction/i, 'README.md must include a Windows directory junction example');
  assert.match(readme, /\/envizzle/i, 'README.md must document Claude invocation');
  assert.match(readme, /\.agents\/skills/i, 'README.md must document .agents/skills');
  assert.match(readme, /\$envizzle/i, 'README.md must document Codex invocation');
  assert.match(readme, /~?\/.gemini\/config\/skills/i, 'README.md must document ~/.gemini/config/skills');
  assert.match(readme, /standalone skill,\s+not an Antigravity plugin/i, 'README.md must state standalone skill, not an Antigravity plugin');
  assert.match(readme, /plugin-specific commands,[\s\S]*MCP servers[\s\S]*marketplace distribution/i, 'README.md must explain when plugin packaging would be appropriate');
  assert.match(readme, /outside the Envizzle/i, 'README.md must instruct writing generated projects outside Envizzle repo');
});

// --- Batch 10 regression tests ---

test('README.md does not claim "nothing to fetch"', () => {
  assert.doesNotMatch(
    readme,
    /nothing to fetch/i,
    'README.md must not claim "nothing to fetch"'
  );
});

test('README.md does not contain legacy-file recovery instructions', () => {
  assert.doesNotMatch(
    readme,
    /git restore --source=/i,
    'README.md must not contain git restore recovery instructions'
  );
  assert.doesNotMatch(
    readme,
    /legacy\//i,
    'README.md must not reference legacy/ directory'
  );
  assert.doesNotMatch(
    readme,
    /git log --diff-filter=D/i,
    'README.md must not contain git log deletion recovery commands'
  );
});

test('README.md accurately distinguishes Envizzle self-containment from runtime dependencies', () => {
  assert.match(
    readme,
    /no hidden dependency/i,
    'README.md must state no hidden dependency on Envizzle source references'
  );
  assert.match(
    readme,
    /install.*engine.*dependenc|engine.*dependenc.*install|dependencies named by the bundle/i,
    'README.md must acknowledge the builder may install runtime dependencies'
  );
});

test('README.md does not reference the obsolete implementation plan', () => {
  assert.doesNotMatch(
    readme,
    /2026-07-29-envizzle-skill\.md/,
    'README.md must not reference the deleted implementation plan'
  );
  assert.doesNotMatch(
    readme,
    /implementation plan/i,
    'README.md must not claim docs/ contains an implementation plan'
  );
});
