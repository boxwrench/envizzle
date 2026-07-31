import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function runSelectionCli(args) {
  const res = spawnSync(process.execPath, ['selection.mjs', ...args], {
    encoding: 'utf8',
  });
  return {
    code: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
  };
}

test('selection CLI list command outputs valid JSON and exits 0', () => {
  const { code, stdout } = runSelectionCli(['list']);
  assert.equal(code, 0);
  const data = JSON.parse(stdout);
  assert.ok(Array.isArray(data.creativeModes));
  assert.ok(Array.isArray(data.paths));
  assert.ok(Array.isArray(data.ambitions));
  assert.ok(Array.isArray(data.showcases));
  assert.ok(Array.isArray(data.renderingProfiles));
  assert.ok(Array.isArray(data.biomes));
  assert.ok(Array.isArray(data.archetypes));
  assert.ok(Array.isArray(data.mechanics));
  assert.ok(Array.isArray(data.cameras));
  assert.ok(Array.isArray(data.coreSections));
  assert.ok(Array.isArray(data.extraSections));
});

test('selection CLI validate on valid fixtures exits 0', () => {
  const validFixtures = [
    'tests/fixtures/selections/proven-dune.json',
    'tests/fixtures/selections/signature-alpine.json',
    'tests/fixtures/selections/experimental-base-camera.json',
    'tests/fixtures/selections/experimental-fully-custom.json',
  ];

  for (const fixture of validFixtures) {
    const { code, stdout } = runSelectionCli(['validate', fixture]);
    assert.equal(code, 0, `Expected 0 for ${fixture}`);
    const res = JSON.parse(stdout);
    assert.equal(res.ok, true, `Expected ok: true for ${fixture}`);
    assert.equal(res.errors, 0, `Expected 0 errors for ${fixture}`);
  }
});

test('selection CLI validate on invalid-signature-drift.json returns showcase-drift and exits 1', () => {
  const { code, stdout } = runSelectionCli(['validate', 'tests/fixtures/selections/invalid-signature-drift.json']);
  assert.equal(code, 1);
  const res = JSON.parse(stdout);
  assert.equal(res.ok, false);
  assert.ok(res.errors > 0);
  assert.ok(res.conflicts.some((c) => c.rule === 'showcase-drift'));
});

test('selection CLI validate on invalid-two-axes.json returns excessive-changed-axes and exits 1', () => {
  const { code, stdout } = runSelectionCli(['validate', 'tests/fixtures/selections/invalid-two-axes.json']);
  assert.equal(code, 1);
  const res = JSON.parse(stdout);
  assert.equal(res.ok, false);
  assert.ok(res.errors > 0);
  assert.ok(res.conflicts.some((c) => c.rule === 'excessive-changed-axes'));
});

test('selection CLI validate on malformed.json exits 2 without a stack trace', () => {
  const { code, stderr } = runSelectionCli(['validate', 'tests/fixtures/selections/malformed.json']);
  assert.equal(code, 2);
  assert.doesNotMatch(stderr, /at JSON\.parse|at Module\._compile/i);
  assert.match(stderr, /Failed to parse JSON/i);
});

test('selection CLI format-state output for Alpine Dawn matches expected Markdown', () => {
  const { code, stdout } = runSelectionCli(['format-state', 'tests/fixtures/selections/signature-alpine.json']);
  assert.equal(code, 0);
  assert.match(stdout, /\* \*\*`depression`\*\* → \*\*`R`\*\*/);
  assert.match(stdout, /\* \*\*`displaced-mass`\*\* → \*\*`G`\*\*/);
  assert.match(stdout, /\* \*\*`wetness-or-compaction`\*\* → \*\*`B`\*\*/);
});

test('selection CLI format-state output for Dune Sea is empty string and exits 0', () => {
  const { code, stdout } = runSelectionCli(['format-state', 'tests/fixtures/selections/proven-dune.json']);
  assert.equal(code, 0);
  assert.equal(stdout, '');
});

test('selection CLI unknown and incomplete commands exit 2 with usage on stderr', () => {
  const unknown = runSelectionCli(['unknown-command']);
  assert.equal(unknown.code, 2);
  assert.match(unknown.stderr, /Usage:/);

  const missingArg = runSelectionCli(['validate']);
  assert.equal(missingArg.code, 2);
  assert.match(missingArg.stderr, /Usage:/);
});
