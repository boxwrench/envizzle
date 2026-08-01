import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BENCHMARK_CASES,
  VALID_SUITES,
  getBenchmarkCase,
  getBenchmarkCasesForSuite,
  buildCaseAssemblySpec,
} from '../benchmark-cases.mjs';
import {
  prepareBenchmark,
  collectBenchmarkResult,
  summarizeBenchmarkResults,
  validateHumanReview,
  computeVisualAverage,
} from '../benchmark.mjs';
import { assembleBrief } from '../assemble.mjs';
import { validateBrief } from '../check.mjs';
import { SHOWCASES } from '../selection.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const makeTempDir = () => {
  const tmp = path.join(repoRoot, 'tests', `tmp-bm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
};

const removeTempDir = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('exact eight-case registry and suite membership', () => {
  assert.equal(BENCHMARK_CASES.length, 8);
  const ids = BENCHMARK_CASES.map((c) => c.id);
  assert.deepEqual(ids, [
    'dune-proven',
    'alpine-signature',
    'hoshi-signature',
    'dune-signature',
    'tidal-signature',
    'ember-signature',
    'neon-signature',
    'alpine-experimental-camera',
  ]);

  const smokeCases = getBenchmarkCasesForSuite('smoke');
  assert.equal(smokeCases.length, 3);
  assert.deepEqual(smokeCases.map((c) => c.id), ['dune-proven', 'alpine-signature', 'alpine-experimental-camera']);

  const fullCases = getBenchmarkCasesForSuite('full');
  assert.equal(fullCases.length, 8);
});

test('six canonical Signature cases cover all showcases, biomes, archetypes, mechanics, profiles, cameras, ambitions', () => {
  const sigCases = BENCHMARK_CASES.filter((c) => c.creativeMode === 'signature');
  assert.equal(sigCases.length, 6);

  const coveredShowcases = new Set(sigCases.map((c) => c.baseShowcase));
  assert.equal(coveredShowcases.size, 6);

  for (const [name, showcase] of Object.entries(SHOWCASES)) {
    assert.ok(coveredShowcases.has(name), `Signature cases must cover showcase '${name}'`);
    const caseDef = sigCases.find((c) => c.baseShowcase === name);
    assert.ok(caseDef);
    const spec = buildCaseAssemblySpec(caseDef.id);
    assert.equal(spec.selection.biome, showcase.biome);
    assert.equal(spec.selection.archetype, showcase.archetype);
    assert.equal(spec.selection.mechanic, showcase.mechanic);
    assert.equal(spec.selection.camera, showcase.camera);
    assert.equal(spec.selection.renderingProfile, showcase.renderingProfile);
    assert.equal(spec.selection.ambition, showcase.ambition);
  }
});

test('every benchmark case derives a valid assembly spec and brief', () => {
  for (const c of BENCHMARK_CASES) {
    const spec = buildCaseAssemblySpec(c.id);
    assert.ok(spec);

    const { brief, fileName } = assembleBrief(spec, { rootDir: repoRoot });
    assert.ok(brief, `Brief for case '${c.id}' must be generated`);
    assert.ok(fileName.endsWith('_TECHDEMO_PROMPT.md'));

    const val = validateBrief(brief);
    assert.equal(val.ok, true, `Brief for case '${c.id}' failed validateBrief: ${val.problems.join(' | ')}`);

    // Verify all novelty budget flags are false
    for (const [flag, val] of Object.entries(spec.selection.noveltyBudget)) {
      assert.equal(val, false, `Novelty budget flag '${flag}' must be false for case '${c.id}'`);
    }

    // Verify no section markers left
    assert.equal(/<!--\/?SECTION:?[a-z0-9-]*-->/.test(brief), false, `Brief for case '${c.id}' contains section markers`);
  }
});

test('deterministic brief hashes across identical builds', () => {
  const spec1 = buildCaseAssemblySpec('alpine-signature');
  const res1 = assembleBrief(spec1, { rootDir: repoRoot });

  const spec2 = buildCaseAssemblySpec('alpine-signature');
  const res2 = assembleBrief(spec2, { rootDir: repoRoot });

  assert.equal(res1.brief, res2.brief);
});

test('safe smoke and full preparation creates complete bundles', () => {
  const tmpDir = makeTempDir();
  try {
    prepareBenchmark(tmpDir, { suite: 'smoke' });

    assert.equal(fs.existsSync(path.join(tmpDir, 'BENCHMARK.md')), true);
    for (const caseId of ['dune-proven', 'alpine-signature', 'alpine-experimental-camera']) {
      const caseDir = path.join(tmpDir, caseId);
      assert.equal(fs.existsSync(path.join(caseDir, 'case.json')), true);
      assert.equal(fs.existsSync(path.join(caseDir, 'review-template.json')), true);
      assert.equal(fs.existsSync(path.join(caseDir, 'bundle', 'HANDOFF.md')), true);
      assert.equal(fs.existsSync(path.join(caseDir, 'bundle', 'verify', 'verify_demo.mjs')), true);
    }
  } finally {
    removeTempDir(tmpDir);
  }
});

test('prepare collision refusal without --force', () => {
  const tmpDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(tmpDir, 'unrelated.txt'), 'content', 'utf8');

    assert.throws(() => {
      prepareBenchmark(tmpDir, { suite: 'smoke' });
    }, /is not empty/);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('prepare force preservation of unrelated files', () => {
  const tmpDir = makeTempDir();
  try {
    const unrelatedFile = path.join(tmpDir, 'unrelated.txt');
    fs.writeFileSync(unrelatedFile, 'keep me', 'utf8');

    prepareBenchmark(tmpDir, { suite: 'smoke', force: true });

    assert.equal(fs.existsSync(unrelatedFile), true);
    assert.equal(fs.readFileSync(unrelatedFile, 'utf8'), 'keep me');
  } finally {
    removeTempDir(tmpDir);
  }
});

test('strict review schema and score boundaries', () => {
  // Valid review
  const validRev = {
    reviewer: 'Alice',
    scores: {
      compositionReadability: 4,
      materialCoherence: 5,
      characterCraft: 3,
      mechanicLegibility: 4,
      creativeIdentity: 5,
      scopeDiscipline: 4,
    },
    notes: 'Good job',
  };
  const val1 = validateHumanReview(validRev);
  assert.equal(val1.valid, true, val1.errors.join('; '));
  assert.equal(computeVisualAverage(validRev.scores), 4.17);

  // Fractional score reject
  const badFrac = { ...validRev, scores: { ...validRev.scores, compositionReadability: 3.5 } };
  assert.equal(validateHumanReview(badFrac).valid, false);

  // Out of range score reject
  const badRange = { ...validRev, scores: { ...validRev.scores, materialCoherence: 6 } };
  assert.equal(validateHumanReview(badRange).valid, false);

  // Blank reviewer reject
  const badReviewer = { ...validRev, reviewer: '   ' };
  assert.equal(validateHumanReview(badReviewer).valid, false);

  // Non-string notes reject
  const badNotes = { ...validRev, notes: 12345 };
  assert.equal(validateHumanReview(badNotes).valid, false);
});

test('collect passed, failed, reviewed, and unreviewed runs', () => {
  const tmpDir = makeTempDir();
  try {
    const projectDir = path.join(tmpDir, 'my-demo');
    fs.mkdirSync(projectDir, { recursive: true });

    const passedReport = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'passed-report.json'), 'utf8'));
    fs.writeFileSync(path.join(projectDir, 'verify-report.json'), JSON.stringify(passedReport, null, 2), 'utf8');

    const reviewPath = path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'valid-review.json');

    const resReviewed = collectBenchmarkResult(projectDir, {
      caseId: 'alpine-signature',
      model: 'claude-3-7-sonnet',
      attempt: 1,
      reviewPath,
    });

    assert.equal(resReviewed.eligible, true);
    assert.equal(resReviewed.automated.pass, true);
    assert.ok(resReviewed.humanReview);
    assert.equal(resReviewed.humanReview.reviewer, 'Alice Reviewer');

    const resUnreviewed = collectBenchmarkResult(projectDir, {
      caseId: 'alpine-signature',
      model: 'claude-3-7-sonnet',
      attempt: 2,
    });

    assert.equal(resUnreviewed.eligible, true);
    assert.equal(resUnreviewed.humanReview, null);

    // Failed report collection
    const failedReport = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-report.json'), 'utf8'));
    fs.writeFileSync(path.join(projectDir, 'verify-report.json'), JSON.stringify(failedReport, null, 2), 'utf8');

    const resFailed = collectBenchmarkResult(projectDir, {
      caseId: 'alpine-signature',
      model: 'claude-3-7-sonnet',
      attempt: 3,
      reviewPath,
    });

    assert.equal(resFailed.eligible, false);
    assert.equal(resFailed.automated.pass, false);
    assert.equal(resFailed.automated.hardGateFailureCount, 1);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('deterministic summary ordering and bytes', () => {
  const tmpDir = makeTempDir();
  try {
    const result1 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'eligible-result.json'), 'utf8'));
    const result2 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));

    fs.writeFileSync(path.join(tmpDir, 'res-alpine.json'), JSON.stringify(result1, null, 2), 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'res-dune.json'), JSON.stringify(result2, null, 2), 'utf8');

    const outMd1 = path.join(tmpDir, 'summary1.md');
    const outJson1 = path.join(tmpDir, 'summary1.json');
    summarizeBenchmarkResults(tmpDir, { outPath: outMd1, jsonPath: outJson1 });

    const outMd2 = path.join(tmpDir, 'summary2.md');
    const outJson2 = path.join(tmpDir, 'summary2.json');
    summarizeBenchmarkResults(tmpDir, { outPath: outMd2, jsonPath: outJson2, force: true });

    const bytesMd1 = fs.readFileSync(outMd1, 'utf8');
    const bytesMd2 = fs.readFileSync(outMd2, 'utf8');
    assert.equal(bytesMd1, bytesMd2, 'Summary markdown must be byte-identical');

    const bytesJson1 = fs.readFileSync(outJson1, 'utf8');
    const bytesJson2 = fs.readFileSync(outJson2, 'utf8');
    assert.equal(bytesJson1, bytesJson2, 'Summary JSON must be byte-identical');

    // Verify ordering: dune-proven comes before alpine-signature in registry order
    const idxDune = bytesMd1.indexOf('`dune-proven`');
    const idxAlpine = bytesMd1.indexOf('`alpine-signature`');
    assert.ok(idxDune !== -1 && idxAlpine !== -1);
    assert.ok(idxDune < idxAlpine, 'Results must be sorted by case registry order');
  } finally {
    removeTempDir(tmpDir);
  }
});
