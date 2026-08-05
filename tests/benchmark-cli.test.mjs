import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseVerifyCliArgs, verifyDemo } from '../verify/verify_demo.mjs';
import { parseBenchmarkCliArgs, prepareBenchmark } from '../benchmark.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const makeTempDir = () => {
  const tmp = path.join(repoRoot, 'tests', `tmp-cli-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
};

const removeTempDir = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('verifier module imports silently without printing', async () => {
  const code = `
    import * as verifier from './verify/verify_demo.mjs';
    if (typeof verifier.verifyDemo !== 'function') process.exit(1);
  `;
  const out = execSync(`node --input-type=module -e "${code.replace(/\n/g, ' ')}"`, { cwd: repoRoot, stdio: 'pipe' }).toString();
  assert.equal(out, '', 'Importing verify_demo.mjs must produce zero stdout/stderr');
});

test('benchmark module imports silently without printing', async () => {
  const code = `
    import * as bench from './benchmark.mjs';
    if (typeof bench.prepareBenchmark !== 'function') process.exit(1);
  `;
  const out = execSync(`node --input-type=module -e "${code.replace(/\n/g, ' ')}"`, { cwd: repoRoot, stdio: 'pipe' }).toString();
  assert.equal(out, '', 'Importing benchmark.mjs must produce zero stdout/stderr');
});

test('parseVerifyCliArgs handles help, default paths, custom options, duplicate flags, and malformed grammar', () => {
  // Help
  assert.equal(parseVerifyCliArgs(['--help']).help, true);
  assert.equal(parseVerifyCliArgs(['-h']).help, true);

  // Defaults
  const resDefault = parseVerifyCliArgs([]);
  assert.equal(resDefault.help, false);
  assert.equal(resDefault.projectDir, process.cwd());

  // Custom project and flags
  const resCustom = parseVerifyCliArgs(['my-project', '--report', 'out.json']);
  assert.equal(resCustom.projectDir, path.resolve('my-project'));
  assert.equal(resCustom.reportPath, path.resolve('out.json'));

  // Malformed options & removed --screenshots option
  assert.throws(() => parseVerifyCliArgs(['--report']), /Missing path/);
  assert.throws(() => parseVerifyCliArgs(['--screenshots', 'shots']), /Unknown option/);
  assert.throws(() => parseVerifyCliArgs(['--invalid-flag']), /Unknown option/);
  // Duplicate flags
  assert.throws(() => parseVerifyCliArgs(['--report', 'a.json', '--report', 'b.json']), /Duplicate option --report/);

  // Combined help
  assert.throws(() => parseVerifyCliArgs(['my-project', '--help']), /Cannot combine --help with other arguments/);
});

test('verify_demo CLI rejects --screenshots and exits 2', () => {
  try {
    execSync('node verify/verify_demo.mjs --screenshots screenshots/', { cwd: repoRoot, stdio: 'pipe' });
    assert.fail('--screenshots must exit 2');
  } catch (err) {
    assert.equal(err.status, 2, '--screenshots option must exit code 2');
  }
});

test('verifyDemo rejects programmatic options.screenshotsDir override and cannot write to external directory', async () => {
  const tmpExternal = path.join(repoRoot, 'tests', `tmp-ext-${Date.now()}`);
  try {
    await assert.rejects(
      async () => {
        await verifyDemo(process.cwd(), { screenshotsDir: tmpExternal });
      },
      (err) => {
        assert.match(err.message, /screenshotsDir.*obsolete/i);
        return true;
      }
    );
    assert.equal(fs.existsSync(tmpExternal), false, 'External directory must not be created');
  } finally {
    if (fs.existsSync(tmpExternal)) fs.rmSync(tmpExternal, { recursive: true, force: true });
  }
});

test('parseBenchmarkCliArgs enforces strict attempt grammar, duplicate flags, and help combinations', () => {
  // Invalid attempt strings
  assert.throws(() => parseBenchmarkCliArgs(['collect', 'dir', '--case', 'alpine-signature', '--model', 'm', '--attempt', '1junk', '--out', 'o.json']), /valid --attempt/);
  assert.throws(() => parseBenchmarkCliArgs(['collect', 'dir', '--case', 'alpine-signature', '--model', 'm', '--attempt', '1.0', '--out', 'o.json']), /valid --attempt/);
  assert.throws(() => parseBenchmarkCliArgs(['collect', 'dir', '--case', 'alpine-signature', '--model', 'm', '--attempt', '+1', '--out', 'o.json']), /valid --attempt/);

  // Duplicate flags
  assert.throws(() => parseBenchmarkCliArgs(['prepare', 'out', '--suite', 'smoke', '--suite', 'full']), /Duplicate option --suite/);
  assert.throws(() => parseBenchmarkCliArgs(['prepare', 'out', '--suite', 'smoke', '--force', '--force']), /Duplicate option --force/);

  // Combined help
  assert.throws(() => parseBenchmarkCliArgs(['list', '--help']), /Cannot combine --help/);
  assert.throws(() => parseBenchmarkCliArgs(['prepare', 'dir', '--help']), /Cannot combine --help/);
});

test('benchmark CLI list command returns 0 and valid JSON', () => {
  const stdout = execSync('node benchmark.mjs list --json', { cwd: repoRoot, stdio: 'pipe' }).toString();
  const cases = JSON.parse(stdout);
  assert.equal(Array.isArray(cases), true);
  assert.equal(cases.length, 8);
});

test('benchmark CLI prepare command exits 0 on valid suite', () => {
  const tmpDir = makeTempDir();
  try {
    execSync(`node benchmark.mjs prepare "${tmpDir}" --suite smoke`, { cwd: repoRoot, stdio: 'pipe' });
    assert.equal(fs.existsSync(path.join(tmpDir, 'BENCHMARK.md')), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'alpine-signature', 'bundle', 'verify', 'gates.mjs')), true);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('benchmark CLI prepare command exits 2 on collision', () => {
  const tmpDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(tmpDir, 'existing.txt'), 'data', 'utf8');
    execSync(`node benchmark.mjs prepare "${tmpDir}" --suite smoke`, { cwd: repoRoot, stdio: 'pipe' });
    assert.fail('Should fail on collision');
  } catch (err) {
    assert.equal(err.status, 2);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('benchmark CLI collect command exits 0 on passed report and 1 on failed report', () => {
  const tmpDir = makeTempDir();
  try {
    prepareBenchmark(tmpDir, { caseId: 'alpine-signature' });
    const projDir = path.join(tmpDir, 'alpine-signature', 'bundle');
    const reportPath = path.join(projDir, 'verify-report.json');
    const outJson = path.join(tmpDir, 'res.json');

    // Bind reports to the actual prepared case brief hash.
    const caseMeta = JSON.parse(fs.readFileSync(path.join(tmpDir, 'alpine-signature', 'case.json'), 'utf8'));
    const benchmarkIdentity = { caseId: 'alpine-signature', briefSha256: caseMeta.briefSha256 };

    // Passed report template bound to case brief hash
    const passReport = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'passed-report.json'), 'utf8'));
    passReport.target = 'bundle';
    passReport.benchmark = { ...benchmarkIdentity };
    fs.writeFileSync(reportPath, JSON.stringify(passReport, null, 2), 'utf8');

    // Untouched incomplete bundle with passed report -> exits 1, eligible: false
    try {
      execSync(`node benchmark.mjs collect "${projDir}" --case alpine-signature --model test-agent --attempt 1 --out "${outJson}"`, { cwd: repoRoot, stdio: 'pipe' });
      assert.fail('Collect on incomplete evidence should exit 1');
    } catch (err) {
      assert.equal(err.status, 1, 'Collect on incomplete evidence must exit 1');
    }

    // Populate completed evidence & required PNGs for genuinely passed run
    const pngBuf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const ev = {
      schemaVersion: 1,
      status: 'complete',
      milestones: [
        {
          id: 'first-runnable-scene',
          status: 'complete',
          screenshots: ['evidence/first-runnable-scene/milestone_idle.png'],
          console: { errors: [], warnings: [] },
          performance: { fps: 60, frameTimeMs: 16.67 },
          visualSelfReview: { reviewed: true, weaknesses: ['Minor shadow aliasing'], corrections: ['Adjusted bias'] },
        },
        {
          id: 'systems-complete',
          status: 'complete',
          screenshots: ['evidence/systems-complete/milestone_locomotion.png', 'evidence/systems-complete/milestone_mechanic.png'],
          console: { errors: [], warnings: [] },
          performance: { fps: 60, frameTimeMs: 16.67 },
          visualSelfReview: { reviewed: true, weaknesses: ['LOD transition noticeable'], corrections: ['Smoothed LOD curve'] },
        },
        {
          id: 'final-polish',
          status: 'complete',
          screenshots: ['evidence/final-polish/milestone_idle.png', 'evidence/final-polish/milestone_locomotion.png', 'evidence/final-polish/milestone_mechanic.png'],
          console: { errors: [], warnings: [] },
          performance: { fps: 60, frameTimeMs: 16.67 },
          visualSelfReview: { reviewed: true, weaknesses: ['Bloom flare strong'], corrections: ['Reduced threshold'] },
        },
      ],
    };
    fs.writeFileSync(path.join(projDir, 'ENVIZZLE_EVIDENCE.json'), JSON.stringify(ev, null, 2), 'utf8');
    for (const s of [
      'evidence/first-runnable-scene/milestone_idle.png',
      'evidence/systems-complete/milestone_locomotion.png',
      'evidence/systems-complete/milestone_mechanic.png',
      'evidence/final-polish/milestone_idle.png',
      'evidence/final-polish/milestone_locomotion.png',
      'evidence/final-polish/milestone_mechanic.png',
    ]) {
      const full = path.join(projDir, s);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, pngBuf);
    }

    const outPass = execSync(`node benchmark.mjs collect "${projDir}" --case alpine-signature --model test-agent --attempt 1 --out "${outJson}" --force`, { cwd: repoRoot, stdio: 'pipe' }).toString();
    assert.ok(outPass.includes('Successfully collected'));
    const resData = JSON.parse(fs.readFileSync(outJson, 'utf8'));
    assert.equal(resData.eligible, true);

    // Failed report -> exit 1
    const failReport = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-report.json'), 'utf8'));
    failReport.target = 'bundle';
    failReport.benchmark = { ...benchmarkIdentity };
    fs.writeFileSync(reportPath, JSON.stringify(failReport, null, 2), 'utf8');

    try {
      execSync(`node benchmark.mjs collect "${projDir}" --case alpine-signature --model test-agent --attempt 2 --out "${outJson}" --force`, { cwd: repoRoot, stdio: 'pipe' });
      assert.fail('Collect on failed report should exit 1');
    } catch (err) {
      assert.equal(err.status, 1, 'Collect on failed report must exit 1');
    }
  } finally {
    removeTempDir(tmpDir);
  }
});

test('benchmark CLI summarize command produces summary markdown and json', () => {
  const tmpDir = makeTempDir();
  try {
    const res1 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'eligible-result.json'), 'utf8'));
    fs.writeFileSync(path.join(tmpDir, 'res-alpine.json'), JSON.stringify(res1, null, 2), 'utf8');

    const outMd = path.join(tmpDir, 'summary.md');
    const outJson = path.join(tmpDir, 'summary.json');

    execSync(`node benchmark.mjs summarize "${tmpDir}" --out "${outMd}" --json "${outJson}"`, { cwd: repoRoot, stdio: 'pipe' });

    assert.equal(fs.existsSync(outMd), true);
    assert.equal(fs.existsSync(outJson), true);

    const mdContent = fs.readFileSync(outMd, 'utf8');
    assert.ok(mdContent.includes('# Benchmark Comparison Summary'));
    assert.ok(mdContent.includes('`alpine-signature`'));
  } finally {
    removeTempDir(tmpDir);
  }
});
