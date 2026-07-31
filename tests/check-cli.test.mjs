import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runCheckCli(args) {
  const res = spawnSync(process.execPath, ['check.mjs', ...args], {
    encoding: 'utf8',
  });
  return {
    code: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
  };
}

test('check CLI brief legacy and explicit forms work', () => {
  // TEMPLATE.md contains unfilled tokens so it should report FAILED and exit 1
  const legacy = runCheckCli(['TEMPLATE.md']);
  assert.equal(legacy.code, 1);
  assert.match(legacy.stderr, /FAILED: TEMPLATE\.md/);

  const explicit = runCheckCli(['brief', 'TEMPLATE.md']);
  assert.equal(explicit.code, 1);
  assert.match(explicit.stderr, /FAILED: TEMPLATE\.md/);
});

test('check CLI coherence on coherent.json exits 0 with ok: true', () => {
  const { code, stdout } = runCheckCli(['coherence', 'tests/fixtures/configs/coherent.json']);
  assert.equal(code, 0);
  const data = JSON.parse(stdout);
  assert.equal(data.ok, true);
  assert.equal(data.errors, 0);
});

test('check CLI coherence on incoherent.json exits 1 with all conflicts', () => {
  const { code, stdout } = runCheckCli(['coherence', 'tests/fixtures/configs/incoherent.json']);
  assert.equal(code, 1);
  const data = JSON.parse(stdout);
  assert.equal(data.ok, false);
  assert.ok(data.errors >= 2);
  assert.ok(data.conflicts.length >= 2);
});

test('check CLI coherence with warning-only conflicts exits 0', () => {
  // Create a temp config that triggers accent-cap warning but no errors
  const config = {
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'Multi-scale procedural normals at 8 m / 0.8 m / 0.08 m triplanar',
    palette: [
      { role: 'lit-snow', hex: '#f0f4f8', area: 'large' },
      { role: 'sky-band', hex: '#a8c8e4', area: 'large' },
      { role: 'shadow-snow', hex: '#7d9dc0', area: 'large' },
      { role: 'dark-granite', hex: '#1a1816', area: 'medium' },
      { role: 'accent-1', hex: '#ffe6b8', area: 'accent' },
      { role: 'accent-2', hex: '#ff0000', area: 'accent' },
      { role: 'accent-3', hex: '#00ff00', area: 'accent' },
    ],
  };
  const tmpPath = path.join('tests', 'fixtures', 'configs', 'tmp-warn.json');
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2));

  try {
    const { code, stdout } = runCheckCli(['coherence', tmpPath]);
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.equal(data.ok, true);
    assert.equal(data.errors, 0);
    assert.ok(data.warnings > 0);
    assert.ok(data.conflicts.some((c) => c.rule === 'accent-cap'));
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
});

test('check CLI coherence on malformed JSON exits 2 without stack trace', () => {
  const tmpPath = path.join('tests', 'fixtures', 'configs', 'tmp-malformed.json');
  fs.writeFileSync(tmpPath, '{ invalid json');

  try {
    const { code, stderr } = runCheckCli(['coherence', tmpPath]);
    assert.equal(code, 2);
    assert.doesNotMatch(stderr, /at JSON\.parse|at Module\._compile/i);
    assert.match(stderr, /Failed to parse JSON/i);
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
});

test('check CLI --help exits 0 with usage on stdout', () => {
  const { code, stdout } = runCheckCli(['--help']);
  assert.equal(code, 0);
  assert.match(stdout, /Usage:/);
});

test('check CLI unknown command exits 2 with usage on stderr', () => {
  const { code, stderr } = runCheckCli(['unknown', 'arg1', 'arg2']);
  assert.equal(code, 2);
  assert.match(stderr, /Usage:/);
});
