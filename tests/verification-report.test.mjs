import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createVerificationReport,
  validateVerificationReport,
  normalizeVerificationReport,
  writeVerificationReport,
  SCHEMA_VERSION,
} from '../verify/report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const validReportSample = () => ({
  schemaVersion: 1,
  status: 'passed',
  target: 'my-demo-project',
  startedAt: '2026-07-31T12:00:00.000Z',
  finishedAt: '2026-07-31T12:00:05.000Z',
  durationMs: 5000,
  requiredPaths: ['index.html', 'package.json'],
  build: { ok: true, error: null },
  runtime: { hookReady: true, errors: [] },
  captures: ['idle.png', 'locomotion.png'],
  gates: {
    pass: true,
    failures: [],
    info: ['mean luminance 0.420'],
    metrics: {
      frames: [
        { name: 'idle', meanLuminance: 0.42, flatFrameRatio: 0.18, characterAreaFraction: 0.08 },
      ],
      cameraNearestDepthM: 1.2,
      frameStats: { medianMs: 11, p99Ms: 17, samples: 600 },
    },
  },
});

test('createVerificationReport creates valid schemaVersion 1 report', () => {
  const report = createVerificationReport({
    target: 'my-demo-project',
    startedAt: '2026-07-31T12:00:00.000Z',
    finishedAt: '2026-07-31T12:00:05.000Z',
    durationMs: 5000,
    requiredPaths: ['index.html'],
    build: { ok: true, error: null },
    runtime: { hookReady: true, errors: [] },
    captures: ['idle.png'],
    gates: {
      pass: true,
      failures: [],
      info: [],
      metrics: {
        frames: [{ name: 'idle', meanLuminance: 0.42, flatFrameRatio: 0.18, characterAreaFraction: 0.08 }],
        cameraNearestDepthM: 1.2,
        frameStats: { medianMs: 11, p99Ms: 17, samples: 600 },
      },
    },
  });

  assert.equal(report.schemaVersion, SCHEMA_VERSION);
  assert.equal(report.status, 'passed');
  assert.equal(report.target, 'my-demo-project');
  const val = validateVerificationReport(report);
  assert.equal(val.valid, true, val.errors.join('; '));
});

test('validateVerificationReport accepts valid reports', () => {
  const sample = validReportSample();
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, true, val.errors.join('; '));
});

test('validateVerificationReport rejects unknown top-level keys', () => {
  const sample = validReportSample();
  sample.unknownKey = 'invalid';
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Unknown top-level key/.test(e)));
});

test('validateVerificationReport rejects missing required top-level keys', () => {
  const sample = validReportSample();
  delete sample.runtime;
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Missing required top-level key/.test(e)));
});

test('validateVerificationReport rejects wrong schemaVersion', () => {
  const sample = validReportSample();
  sample.schemaVersion = 2;
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Invalid schemaVersion/.test(e)));
});

test('validateVerificationReport rejects invalid status', () => {
  const sample = validReportSample();
  sample.status = 'unknown-status';
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Invalid status/.test(e)));
});

test('validateVerificationReport rejects absolute target paths', () => {
  const sample = validReportSample();
  sample.target = path.resolve('/some/absolute/path');
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /absolute path/.test(e)));
});

test('validateVerificationReport rejects non-finite metrics', () => {
  const sample = validReportSample();
  sample.gates.metrics.frames[0].meanLuminance = NaN;
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /meanLuminance/.test(e)));
});

test('validateVerificationReport rejects malformed frame records', () => {
  const sample = validReportSample();
  sample.gates.metrics.frames = ['not-an-object'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /must be an object/.test(e)));
});

test('validateVerificationReport rejects contradictory state: passed status with failing gates', () => {
  const sample = validReportSample();
  sample.status = 'passed';
  sample.gates.pass = false;
  sample.gates.failures = ['Mean luminance outside bounds'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Contradictory state/.test(e)));
});

test('validateVerificationReport rejects contradictory state: passed status with failing build', () => {
  const sample = validReportSample();
  sample.status = 'passed';
  sample.build.ok = false;
  sample.build.error = 'Build failed';
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Contradictory state/.test(e)));
});

test('writeVerificationReport performs atomic sibling write and rename', () => {
  const tmpDir = path.join(repoRoot, 'tests', `tmp-rpt-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const reportPath = path.join(tmpDir, 'test-report.json');
    const sample = validReportSample();

    writeVerificationReport(reportPath, sample);

    assert.equal(fs.existsSync(reportPath), true);
    const read = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(read.schemaVersion, 1);
    assert.equal(read.target, 'my-demo-project');

    // Verify no temporary files remain in directory
    const files = fs.readdirSync(tmpDir);
    assert.deepEqual(files, ['test-report.json']);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('writeVerificationReport cleans up temp file on failure', () => {
  const tmpDir = path.join(repoRoot, 'tests', `tmp-rpt-fail-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const reportPath = path.join(tmpDir, 'test-report.json');
    const invalidSample = validReportSample();
    invalidSample.target = '  '; // invalid target

    assert.throws(() => {
      writeVerificationReport(reportPath, invalidSample);
    }, /Cannot write invalid report/);

    const files = fs.readdirSync(tmpDir);
    assert.equal(files.length, 0, 'No temporary files should be left behind on write failure');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
