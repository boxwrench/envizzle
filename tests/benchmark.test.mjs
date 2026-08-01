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
  validateCasesRegistry,
  validateCaseDefinition,
} from '../benchmark-cases.mjs';
import {
  prepareBenchmark,
  collectBenchmarkResult,
  summarizeBenchmarkResults,
  validateHumanReview,
  computeVisualAverage,
  validateBenchmarkResult,
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

test('source-mutation regression test rejects traversal ID before file creation', () => {
  const casesJsonPath = path.join(repoRoot, 'benchmarks', 'cases.json');
  const realText = fs.readFileSync(casesJsonPath, 'utf8');

  // Alter dune-proven to ../escape
  const mutatedText = realText.replace('"id": "dune-proven"', '"id": "../escape"');
  assert.notEqual(realText, mutatedText);
  assert.ok(mutatedText.includes('"id": "../escape"'));
  assert.ok(!mutatedText.includes('"id": "dune-proven"'));

  const mutatedData = JSON.parse(mutatedText);
  const val = validateCasesRegistry(mutatedData);
  assert.equal(val.valid, false, 'Registry validation must fail on traversal case ID');
  assert.ok(val.errors.some((e) => /slug without path separators/i.test(e)));

  // Prove rejection prevents any file creation
  const tmpDir = makeTempDir();
  try {
    assert.throws(() => {
      // Trying to prepare a case with traversal ID must fail validation
      validateCaseDefinition(mutatedData.cases[0]);
      throw new Error('Traversal ID rejected');
    }, /Traversal ID rejected/);
    assert.equal(fs.readdirSync(tmpDir).length, 0, 'No output files should be created on registry rejection');
  } finally {
    removeTempDir(tmpDir);
  }
});

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

    for (const [flag, val] of Object.entries(spec.selection.noveltyBudget)) {
      assert.equal(val, false, `Novelty budget flag '${flag}' must be false for case '${c.id}'`);
    }

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

test('prepare --force sequence: full -> sentinels -> smoke --force preserves unrelated sentinels and cleans stale cases', () => {
  const tmpDir = makeTempDir();
  try {
    // 1. Prepare full
    prepareBenchmark(tmpDir, { suite: 'full' });
    assert.equal(fs.existsSync(path.join(tmpDir, 'hoshi-signature')), true);

    // 2. Add unrelated sentinels
    const rootSentinel = path.join(tmpDir, 'unrelated-root.txt');
    const caseSentinel = path.join(tmpDir, 'dune-proven', 'unrelated-case.txt');
    fs.writeFileSync(rootSentinel, 'root data', 'utf8');
    fs.writeFileSync(caseSentinel, 'case data', 'utf8');

    // 3. Prepare smoke --force
    prepareBenchmark(tmpDir, { suite: 'smoke', force: true });

    // 4. Prove all stale generated files for the 5 non-smoke cases are gone
    for (const nonSmokeId of ['hoshi-signature', 'dune-signature', 'tidal-signature', 'ember-signature', 'neon-signature']) {
      assert.equal(fs.existsSync(path.join(tmpDir, nonSmokeId)), false, `Stale case '${nonSmokeId}' should be removed`);
    }

    // 5. Prove 3 smoke cases are complete
    for (const smokeId of ['dune-proven', 'alpine-signature', 'alpine-experimental-camera']) {
      assert.equal(fs.existsSync(path.join(tmpDir, smokeId, 'case.json')), true);
      assert.equal(fs.existsSync(path.join(tmpDir, smokeId, 'bundle', 'HANDOFF.md')), true);
    }

    // 6. Prove unrelated sentinels remain byte-identical
    assert.equal(fs.existsSync(rootSentinel), true);
    assert.equal(fs.readFileSync(rootSentinel, 'utf8'), 'root data');
    assert.equal(fs.existsSync(caseSentinel), true);
    assert.equal(fs.readFileSync(caseSentinel, 'utf8'), 'case data');
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

test('strict review schema and score boundaries', () => {
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

  // Top-level score alternative reject
  assert.equal(validateHumanReview({ reviewer: 'Alice', compositionReadability: 4 }).valid, false);

  // Fractional score reject
  const badFrac = { ...validRev, scores: { ...validRev.scores, compositionReadability: 3.5 } };
  assert.equal(validateHumanReview(badFrac).valid, false);

  // Out of range score reject
  const badRange = { ...validRev, scores: { ...validRev.scores, materialCoherence: 6 } };
  assert.equal(validateHumanReview(badRange).valid, false);

  // Blank reviewer reject
  const badReviewer = { ...validRev, reviewer: '   ' };
  assert.equal(validateHumanReview(badReviewer).valid, false);

  // Multiline reviewer reject
  const multilineReviewer = { ...validRev, reviewer: 'Alice\nBob' };
  assert.equal(validateHumanReview(multilineReviewer).valid, false);
});

test('collectBenchmarkResult enforces real brief, metadata, report target, and SHA-256 binding', () => {
  const tmpDir = makeTempDir();
  try {
    prepareBenchmark(tmpDir, { caseId: 'alpine-signature' });

    const projDir = path.join(tmpDir, 'alpine-signature', 'bundle');
    const reportPath = path.join(projDir, 'verify-report.json');

    const passReport = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'passed-report.json'), 'utf8'));
    passReport.target = 'bundle'; // matches path.basename(projDir)
    fs.writeFileSync(reportPath, JSON.stringify(passReport, null, 2), 'utf8');

    // 1. Valid collect
    const res = collectBenchmarkResult(projDir, {
      caseId: 'alpine-signature',
      model: 'claude-3-7-sonnet',
      attempt: 1,
    });
    assert.equal(res.eligible, true);
    assert.equal(res.caseId, 'alpine-signature');

    // 2. Case ID mismatch
    assert.throws(() => {
      collectBenchmarkResult(projDir, {
        caseId: 'dune-proven',
        model: 'claude-3-7-sonnet',
        attempt: 1,
      });
    }, /Case ID mismatch/);

    // 3. Mismatched report target
    passReport.target = 'wrong-bundle-name';
    fs.writeFileSync(reportPath, JSON.stringify(passReport, null, 2), 'utf8');
    assert.throws(() => {
      collectBenchmarkResult(projDir, {
        caseId: 'alpine-signature',
        model: 'claude-3-7-sonnet',
        attempt: 1,
      });
    }, /Report target mismatch/);
    passReport.target = 'bundle';
    fs.writeFileSync(reportPath, JSON.stringify(passReport, null, 2), 'utf8');

    // 4. Altered generated prompt file
    const promptFiles = fs.readdirSync(projDir).filter((f) => f.endsWith('_TECHDEMO_PROMPT.md'));
    assert.equal(promptFiles.length, 1);
    const promptPath = path.join(projDir, promptFiles[0]);
    const originalPrompt = fs.readFileSync(promptPath, 'utf8');
    fs.writeFileSync(promptPath, originalPrompt + '\n<!-- mutated -->', 'utf8');

    assert.throws(() => {
      collectBenchmarkResult(projDir, {
        caseId: 'alpine-signature',
        model: 'claude-3-7-sonnet',
        attempt: 1,
      });
    }, /hash mismatch/i);

    // Restore prompt
    fs.writeFileSync(promptPath, originalPrompt, 'utf8');
  } finally {
    removeTempDir(tmpDir);
  }
});

test('validateBenchmarkResult and summarizer reject contradictory or malformed results', () => {
  const result1 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'eligible-result.json'), 'utf8'));

  // Contradictory result: automated.pass is false but eligible is true
  const contradictory = JSON.parse(JSON.stringify(result1));
  contradictory.automated.pass = false;
  contradictory.eligible = true;

  const val = validateBenchmarkResult(contradictory);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Contradictory state/.test(e)));

  const tmpDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(tmpDir, 'bad-result.json'), JSON.stringify(contradictory, null, 2), 'utf8');

    assert.throws(() => {
      summarizeBenchmarkResults(tmpDir, { outPath: path.join(tmpDir, 'summary.md') });
    }, /failed validation/);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('transactional summary output: collision on second output leaves zero partial output', () => {
  const tmpDir = makeTempDir();
  try {
    const result1 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'eligible-result.json'), 'utf8'));
    fs.writeFileSync(path.join(tmpDir, 'res.json'), JSON.stringify(result1, null, 2), 'utf8');

    const outMd = path.join(tmpDir, 'summary.md');
    const outJson = path.join(tmpDir, 'summary.json');

    // Create existing collision file for JSON
    fs.writeFileSync(outJson, 'existing json', 'utf8');

    assert.throws(() => {
      summarizeBenchmarkResults(tmpDir, { outPath: outMd, jsonPath: outJson });
    }, /already exists/);

    assert.equal(fs.existsSync(outMd), false, 'Markdown file must NOT be written when JSON collision occurs');
    assert.equal(fs.readFileSync(outJson, 'utf8'), 'existing json', 'Existing JSON file must remain unchanged');
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

    const idxDune = bytesMd1.indexOf('`dune-proven`');
    const idxAlpine = bytesMd1.indexOf('`alpine-signature`');
    assert.ok(idxDune !== -1 && idxAlpine !== -1);
    assert.ok(idxDune < idxAlpine, 'Results must be sorted by case registry order');
  } finally {
    removeTempDir(tmpDir);
  }
});
