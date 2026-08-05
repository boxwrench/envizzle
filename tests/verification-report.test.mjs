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
  evidence: { ok: true, errors: [] },
  captures: [
    'evidence/final-polish/milestone_idle.png',
    'evidence/final-polish/milestone_locomotion.png',
    'evidence/final-polish/milestone_mechanic.png',
  ],
  gates: {
    pass: true,
    failures: [],
    info: ['mean luminance 0.420'],
    metrics: {
      frames: [
        { name: 'idle', meanLuminance: 0.42, flatFrameRatio: 0.18, characterAreaFraction: 0.08 },
        { name: 'locomotion', meanLuminance: 0.42, flatFrameRatio: 0.18, characterAreaFraction: 0.08 },
        { name: 'mechanic', meanLuminance: 0.42, flatFrameRatio: 0.18, characterAreaFraction: 0.08 },
      ],
      cameraNearestDepthM: 1.2,
      frameStats: { medianMs: 11, p99Ms: 17, samples: 600 },
    },
  },
  benchmark: null,
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
    evidence: { ok: true, errors: [] },
    captures: [
      'evidence/final-polish/milestone_idle.png',
      'evidence/final-polish/milestone_locomotion.png',
      'evidence/final-polish/milestone_mechanic.png',
    ],
    gates: {
      pass: true,
      failures: [],
      info: [],
      metrics: {
        frames: [
          { name: 'idle', meanLuminance: 0.42, flatFrameRatio: 0.18, characterAreaFraction: 0.08 },
          { name: 'locomotion', meanLuminance: 0.42, flatFrameRatio: 0.18, characterAreaFraction: 0.08 },
          { name: 'mechanic', meanLuminance: 0.42, flatFrameRatio: 0.18, characterAreaFraction: 0.08 },
        ],
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

test('validateVerificationReport accepts valid reports with benchmark field', () => {
  const sample = validReportSample();
  sample.benchmark = { caseId: 'alpine-signature', briefSha256: 'a'.repeat(64) };
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
  sample.target = '/some/absolute/path';
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /target/.test(e)));
});

test('validateVerificationReport rejects fractional duration', () => {
  const sample = validReportSample();
  sample.durationMs = 12.34;
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /durationMs/.test(e)));
});

test('validateVerificationReport rejects non-ISO timestamps', () => {
  const sample = validReportSample();
  sample.startedAt = '2026-07-31 12:00:00';
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /startedAt/.test(e)));
});

test('validateVerificationReport rejects reversed timestamps', () => {
  const sample = validReportSample();
  sample.startedAt = '2026-07-31T12:00:05.000Z';
  sample.finishedAt = '2026-07-31T12:00:00.000Z';
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /finishedAt/.test(e)));
});

test('validateVerificationReport rejects absolute or traversal requiredPaths', () => {
  const sample = validReportSample();
  sample.requiredPaths = ['../outside.js'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /requiredPaths/.test(e)));
});

test('validateVerificationReport rejects partial captures on passed status', () => {
  const samplePartial = validReportSample();
  samplePartial.captures = ['evidence/final-polish/milestone_idle.png'];
  const val = validateVerificationReport(samplePartial);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /captures/.test(e)));
});

test('validateVerificationReport rejects object captures', () => {
  const sample = validReportSample();
  sample.captures = [{ file: 'idle.png' }];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /captures/.test(e)));
});

test('validateVerificationReport rejects path or stack leakage in string fields', () => {
  const sample = validReportSample();
  sample.runtime.errors = ['Error at Object.<anonymous> (C:\\Users\\wests\\app.js:10:15)'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /leakage/.test(e)));
});

test('validateVerificationReport rejects embedded Unix or Windows absolute paths regardless of OS', () => {
  const sample1 = validReportSample();
  sample1.gates.info = ['Frame rendered at /home/user/workspace/demo.png'];
  assert.equal(validateVerificationReport(sample1).valid, false);

  const sample2 = validReportSample();
  sample2.gates.info = ['Frame saved at C:\\Users\\wests\\demo.png'];
  assert.equal(validateVerificationReport(sample2).valid, false);

  const sample3 = validReportSample();
  sample3.requiredPaths = ['C:/Users/wests/file'];
  assert.equal(validateVerificationReport(sample3).valid, false);
});

test('validateVerificationReport rejects credential/token leakage', () => {
  const sample = validReportSample();
  sample.gates.failures = ['Failed request with bearer eyJhbGciOiJIUzI1NiJ9.secret'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /leakage/.test(e)));
});

test('validateVerificationReport rejects negative or fractional sample count', () => {
  const sample1 = validReportSample();
  sample1.gates.metrics.frameStats.samples = -5;
  assert.equal(validateVerificationReport(sample1).valid, false);

  const sample2 = validReportSample();
  sample2.status = 'failed';
  sample2.gates.pass = false;
  sample2.gates.failures = ['Failed build'];
  sample2.gates.metrics.frameStats.samples = 10.5;
  assert.equal(validateVerificationReport(sample2).valid, false);
});

test('validateVerificationReport rejects passed reports with missing or null metrics or no captures', () => {
  const sample1 = validReportSample();
  sample1.gates.metrics.frames = [{ name: 'idle', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 }];
  assert.equal(validateVerificationReport(sample1).valid, false);

  const sample2 = validReportSample();
  sample2.captures = [];
  assert.equal(validateVerificationReport(sample2).valid, false);

  const sample3 = validReportSample();
  sample3.gates.metrics.frames[0].meanLuminance = null;
  assert.equal(validateVerificationReport(sample3).valid, false);
});

test('validateVerificationReport rejects passed reports with duplicate or unknown poses', () => {
  const sample1 = validReportSample();
  sample1.gates.metrics.frames = [
    { name: 'idle', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 },
    { name: 'idle', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 },
    { name: 'mechanic', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 },
  ];
  assert.equal(validateVerificationReport(sample1).valid, false);

  const sample2 = validReportSample();
  sample2.gates.metrics.frames = [
    { name: 'idle', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 },
    { name: 'locomotion', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 },
    { name: 'unknown-pose', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 },
  ];
  assert.equal(validateVerificationReport(sample2).valid, false);
});

test('adversarial: passed report with three arbitrary capture names is rejected', () => {
  const sample = validReportSample();
  sample.captures = ['screenshot1.png', 'screenshot2.png', 'screenshot3.png'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Unknown capture filename|exactly the three required capture filenames/.test(e)));
});

test('validateVerificationReport rejects duplicate capture filenames', () => {
  const sample = validReportSample();
  sample.captures = [
    'evidence/final-polish/milestone_idle.png',
    'evidence/final-polish/milestone_idle.png',
    'evidence/final-polish/milestone_mechanic.png',
  ];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Duplicate capture filename/.test(e)));
});

test('validateVerificationReport rejects unrecognized capture filenames', () => {
  const sample = validReportSample();
  sample.captures = [
    'evidence/final-polish/milestone_idle.png',
    'evidence/final-polish/milestone_locomotion.png',
    'evidence/final-polish/milestone_mechanic_v2.png',
  ];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
});

test('validateVerificationReport rejects unknown capture filenames on failed reports too', () => {
  const sample = validReportSample();
  sample.status = 'failed';
  sample.build = { ok: false, error: 'build failed' };
  sample.runtime = { hookReady: false, errors: [] };
  sample.gates.pass = false;
  sample.gates.failures = ['missing required path'];
  sample.gates.metrics = { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: null, p99Ms: null, samples: null } };
  sample.captures = ['not-a-real-capture.png'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Unknown capture filename/.test(e)));
});

test('validateVerificationReport accepts a failed report with zero or a subset of known captures', () => {
  const sampleEmpty = validReportSample();
  sampleEmpty.status = 'failed';
  sampleEmpty.build = { ok: false, error: 'build failed' };
  sampleEmpty.runtime = { hookReady: false, errors: [] };
  sampleEmpty.gates.pass = false;
  sampleEmpty.gates.failures = ['missing required path'];
  sampleEmpty.gates.metrics = { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: null, p99Ms: null, samples: null } };
  sampleEmpty.captures = [];
  assert.equal(validateVerificationReport(sampleEmpty).valid, true, validateVerificationReport(sampleEmpty).errors.join('; '));

  const samplePartial = validReportSample();
  samplePartial.status = 'failed';
  samplePartial.build = { ok: true, error: null };
  samplePartial.runtime = { hookReady: true, errors: ['setPose threw'] };
  samplePartial.gates.pass = false;
  samplePartial.gates.failures = ['setPose threw'];
  samplePartial.gates.metrics = { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: null, p99Ms: null, samples: null } };
  samplePartial.captures = ['milestone_idle.png'];
  assert.equal(validateVerificationReport(samplePartial).valid, true, validateVerificationReport(samplePartial).errors.join('; '));
});

test('validateVerificationReport rejects failed report with build.ok false and build.error null', () => {
  const sample = validReportSample();
  sample.status = 'failed';
  sample.build = { ok: false, error: null };
  sample.gates.pass = false;
  sample.gates.failures = ['build failed'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /build\.ok false requires a nonblank build\.error/.test(e)));
});

test('validateVerificationReport rejects a build.ok true report with a non-null build.error', () => {
  const sample = validReportSample();
  sample.build.error = 'unexpected build message';
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /build\.ok true requires build\.error to be null/.test(e)));
});

test('validateVerificationReport rejects failed report with gates.pass true', () => {
  const sample = validReportSample();
  sample.status = 'failed';
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /status is "failed" but gates\.pass is not false/.test(e)));
});

test('validateVerificationReport rejects failed report containing only blank failure strings', () => {
  const sample = validReportSample();
  sample.status = 'failed';
  sample.runtime = { hookReady: true, errors: [' ', '\t'] };
  sample.gates.pass = false;
  sample.gates.failures = ['', '   '];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /no nonblank failure reason/.test(e)));
});

test('validateVerificationReport rejects a failed report with a negative camera depth', () => {
  const sample = validReportSample();
  sample.status = 'failed';
  sample.build = { ok: true, error: null };
  sample.runtime = { hookReady: true, errors: [] };
  sample.gates.pass = false;
  sample.gates.failures = ['camera nearest depth below threshold'];
  sample.gates.metrics.cameraNearestDepthM = -1.5;
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /cameraNearestDepthM/.test(e)));
});

test('validateVerificationReport rejects an error report with a negative frame time', () => {
  const sample = validReportSample();
  sample.status = 'error';
  sample.build = { ok: false, error: 'build failed' };
  sample.runtime = { hookReady: false, errors: [] };
  sample.gates.pass = false;
  sample.gates.failures = ['build failed'];
  sample.gates.metrics = { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: -5, p99Ms: null, samples: null } };
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /medianMs/.test(e)));
});

test('validateVerificationReport rejects out-of-range luminance and flat-frame ratios regardless of status', () => {
  const sample1 = validReportSample();
  sample1.status = 'failed';
  sample1.gates.pass = false;
  sample1.gates.failures = ['bad metric'];
  sample1.gates.metrics.frames[0].meanLuminance = 1.5;
  const val1 = validateVerificationReport(sample1);
  assert.equal(val1.valid, false);
  assert.ok(val1.errors.some((e) => /meanLuminance/.test(e)));

  const sample2 = validReportSample();
  sample2.status = 'failed';
  sample2.gates.pass = false;
  sample2.gates.failures = ['bad metric'];
  sample2.gates.metrics.frames[0].flatFrameRatio = -0.2;
  const val2 = validateVerificationReport(sample2);
  assert.equal(val2.valid, false);
  assert.ok(val2.errors.some((e) => /flatFrameRatio/.test(e)));

  const sample3 = validReportSample();
  sample3.status = 'failed';
  sample3.gates.pass = false;
  sample3.gates.failures = ['bad metric'];
  sample3.gates.metrics.frames[0].characterAreaFraction = 1.01;
  const val3 = validateVerificationReport(sample3);
  assert.equal(val3.valid, false);
  assert.ok(val3.errors.some((e) => /characterAreaFraction/.test(e)));
});

test('validateVerificationReport rejects error report with no operational reason', () => {
  const sample = validReportSample();
  sample.status = 'error';
  sample.gates.pass = false;
  sample.build = { ok: true, error: null };
  sample.runtime = { hookReady: true, errors: ['  '] };
  sample.gates.failures = ['\t'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /no operational error recorded/.test(e)));
});

test('validateVerificationReport rejects passed report containing a failure message', () => {
  const sample = validReportSample();
  sample.gates.failures = ['unexpected failure'];
  const val = validateVerificationReport(sample);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /status is "passed" but gates\.failures is not empty/.test(e)));
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
