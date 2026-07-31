import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const assembleScript = path.join(repoRoot, 'assemble.mjs');
const validFixture = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
const invalidFixture = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'invalid.json');
const malformedFixture = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'malformed.json');

const makeTempDir = () => {
  const tmp = path.join(repoRoot, 'tests', `tmp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
};

const removeTempDir = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('assemble CLI --stdout on valid fixture exits 0', () => {
  const out = execFileSync(process.execPath, [assembleScript, validFixture, '--stdout'], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  assert.ok(out.includes('# ALPINE-DAWN — Tech Demo · Implementation Brief'));
  assert.ok(out.includes('## Assembly Decisions'));
});

test('assemble CLI --out creates output bundle and exits 0', () => {
  const tmpDir = makeTempDir();
  try {
    const out = execFileSync(process.execPath, [assembleScript, validFixture, '--out', tmpDir], {
      encoding: 'utf8',
      cwd: repoRoot,
    });
    const parsed = JSON.parse(out);
    assert.equal(parsed.ok, true);
    assert.ok(fs.existsSync(path.join(tmpDir, 'ALPINE_DAWN_TECHDEMO_PROMPT.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'HANDOFF.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'verify', 'README.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'verify', 'gates.mjs')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'verify', 'verify_demo.mjs')));

    const handoff = fs.readFileSync(path.join(tmpDir, 'HANDOFF.md'), 'utf8');
    assert.ok(handoff.includes('ALPINE_DAWN_TECHDEMO_PROMPT.md'));
    assert.ok(handoff.includes('Claude Code'));
  } finally {
    removeTempDir(tmpDir);
  }
});

test('assemble CLI refuses collision without --force and exits 2', () => {
  const tmpDir = makeTempDir();
  try {
    // Write initial bundle
    execFileSync(process.execPath, [assembleScript, validFixture, '--out', tmpDir], {
      encoding: 'utf8',
      cwd: repoRoot,
    });

    // Modify a file to check overwrite refusal
    const briefPath = path.join(tmpDir, 'ALPINE_DAWN_TECHDEMO_PROMPT.md');
    fs.writeFileSync(briefPath, 'MODIFIED_CONTENT', 'utf8');

    // Attempt second run without --force
    let error;
    try {
      execFileSync(process.execPath, [assembleScript, validFixture, '--out', tmpDir], {
        encoding: 'utf8',
        cwd: repoRoot,
        stdio: 'pipe',
      });
    } catch (err) {
      error = err;
    }

    assert.ok(error);
    assert.equal(error.status, 2);
    assert.ok(error.stderr.includes('Destination collision'));

    // Check file content was not overwritten
    const content = fs.readFileSync(briefPath, 'utf8');
    assert.equal(content, 'MODIFIED_CONTENT');
  } finally {
    removeTempDir(tmpDir);
  }
});

test('assemble CLI with --force overwrites bundle and exits 0', () => {
  const tmpDir = makeTempDir();
  try {
    execFileSync(process.execPath, [assembleScript, validFixture, '--out', tmpDir], {
      encoding: 'utf8',
      cwd: repoRoot,
    });

    const briefPath = path.join(tmpDir, 'ALPINE_DAWN_TECHDEMO_PROMPT.md');
    fs.writeFileSync(briefPath, 'MODIFIED_CONTENT', 'utf8');

    // Run with --force
    const out = execFileSync(process.execPath, [assembleScript, validFixture, '--out', tmpDir, '--force'], {
      encoding: 'utf8',
      cwd: repoRoot,
    });

    const parsed = JSON.parse(out);
    assert.equal(parsed.ok, true);

    const content = fs.readFileSync(briefPath, 'utf8');
    assert.ok(content.includes('# ALPINE-DAWN — Tech Demo · Implementation Brief'));
  } finally {
    removeTempDir(tmpDir);
  }
});

test('assemble CLI on invalid semantic fixture exits 1', () => {
  let error;
  try {
    execFileSync(process.execPath, [assembleScript, invalidFixture, '--stdout'], {
      encoding: 'utf8',
      cwd: repoRoot,
      stdio: 'pipe',
    });
  } catch (err) {
    error = err;
  }

  assert.ok(error);
  assert.equal(error.status, 1);
  const parsed = JSON.parse(error.stdout);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.errors > 0);
});

test('assemble CLI on malformed JSON fixture exits 2 with no stack trace', () => {
  let error;
  try {
    execFileSync(process.execPath, [assembleScript, malformedFixture, '--stdout'], {
      encoding: 'utf8',
      cwd: repoRoot,
      stdio: 'pipe',
    });
  } catch (err) {
    error = err;
  }

  assert.ok(error);
  assert.equal(error.status, 2);
  assert.ok(error.stderr.includes('Failed to parse JSON'));
  assert.equal(error.stderr.includes('at Module.'), false);
});

test('assemble CLI on invalid grammar combinations exits 2 with usage on stderr', () => {
  const badArgsList = [
    [validFixture, '--stdout', '--force'],
    [validFixture, '--stdout', '--stdout'],
    [validFixture, '--out', './dir', '--out', './dir2'],
    [validFixture, '--out', './dir', '--force', '--force'],
    [validFixture, '--stdout', 'extra-arg'],
    [validFixture, '--unknown-flag'],
  ];

  for (const badArgs of badArgsList) {
    let error;
    try {
      execFileSync(process.execPath, [assembleScript, ...badArgs], {
        encoding: 'utf8',
        cwd: repoRoot,
        stdio: 'pipe',
      });
    } catch (err) {
      error = err;
    }

    assert.ok(error, `Expected CLI to fail for args: ${badArgs.join(' ')}`);
    assert.equal(error.status, 2, `Expected status 2 for args: ${badArgs.join(' ')}`);
    assert.ok(error.stderr.includes('Usage:'), `Expected stderr usage for args: ${badArgs.join(' ')}`);
  }
});

test('assemble CLI when output path is a file exits 2', () => {
  const tmpDir = makeTempDir();
  const filePath = path.join(tmpDir, 'existing-file.txt');
  fs.writeFileSync(filePath, 'IAMFILE', 'utf8');

  try {
    let error;
    try {
      execFileSync(process.execPath, [assembleScript, validFixture, '--out', filePath], {
        encoding: 'utf8',
        cwd: repoRoot,
        stdio: 'pipe',
      });
    } catch (err) {
      error = err;
    }

    assert.ok(error);
    assert.equal(error.status, 2);
    assert.ok(error.stderr.includes('is a file'));
  } finally {
    removeTempDir(tmpDir);
  }
});

test('assemble CLI on missing file or bad flags exits 2 with usage on stderr', () => {
  let error;
  try {
    execFileSync(process.execPath, [assembleScript, 'nonexistent.json', '--stdout'], {
      encoding: 'utf8',
      cwd: repoRoot,
      stdio: 'pipe',
    });
  } catch (err) {
    error = err;
  }

  assert.ok(error);
  assert.equal(error.status, 2);
  assert.ok(error.stderr.includes("Failed to read file 'nonexistent.json'"));
});

test('failed validation leaves no partial bundle directory', () => {
  const tmpDir = path.join(repoRoot, 'tests', `tmp-invalid-${Date.now()}`);
  let error;
  try {
    execFileSync(process.execPath, [assembleScript, invalidFixture, '--out', tmpDir], {
      encoding: 'utf8',
      cwd: repoRoot,
      stdio: 'pipe',
    });
  } catch (err) {
    error = err;
  }

  assert.ok(error);
  assert.equal(error.status, 1);
  assert.equal(fs.existsSync(tmpDir), false, 'Output directory should not exist on validation failure');
});
