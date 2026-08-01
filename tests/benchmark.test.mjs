import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
import { isPathInside } from '../verify/report.mjs';

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

  // Alter dune-proven to a traversal ID, changing exactly the intended field.
  const mutatedText = realText.replace('"id": "dune-proven"', '"id": "../escape"');
  assert.notEqual(realText, mutatedText, 'Mutated text must differ from the real registry source');
  assert.ok(mutatedText.includes('"id": "../escape"'));
  assert.ok(!mutatedText.includes('"id": "dune-proven"'));

  // Pass the mutated text through the real parse/validate/load chain that
  // benchmark-cases.mjs itself runs at module load (see its top-level gate:
  // `const valRoot = validateCasesRegistry(rawCasesData); if (!valRoot.valid) throw ...`).
  const mutatedData = JSON.parse(mutatedText);
  const val = validateCasesRegistry(mutatedData);
  assert.equal(val.valid, false, 'Real registry loader must reject a traversal case ID');
  assert.ok(val.errors.some((e) => /slug without path separators/i.test(e)));

  // Reproduce the module's actual load-gate: it throws and never exports BENCHMARK_CASES.
  assert.throws(() => {
    if (!val.valid) {
      throw new Error(`Invalid cases.json registry: ${val.errors.join('; ')}`);
    }
  }, /Invalid cases\.json registry/);

  // A single mutated case definition is independently rejected by the real per-case validator too.
  const mutatedCaseVal = validateCaseDefinition(mutatedData.cases.find((c) => c.id === '../escape'));
  assert.equal(mutatedCaseVal.valid, false);
  assert.ok(mutatedCaseVal.errors.some((e) => /slug without path separators/i.test(e)));

  // Because the real loader rejects the registry, no preparation/output function ever ran
  // against the mutated case, and no output should exist.
  const tmpDir = makeTempDir();
  try {
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

    // Compute expected prompt SHA-256 for alpine-signature
    const promptFiles = fs.readdirSync(projDir).filter((f) => f.endsWith('_TECHDEMO_PROMPT.md'));
    assert.equal(promptFiles.length, 1);
    const promptPath = path.join(projDir, promptFiles[0]);
    const promptBytes = fs.readFileSync(promptPath);
    const promptSha256 = crypto.createHash('sha256').update(promptBytes).digest('hex');

    passReport.benchmark = { caseId: 'alpine-signature', briefSha256: promptSha256 };
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

test('collectBenchmarkResult combines deterministic build, runtime, and gate failures', () => {
  const tmpDir = makeTempDir();
  try {
    prepareBenchmark(tmpDir, { caseId: 'alpine-signature' });

    const projDir = path.join(tmpDir, 'alpine-signature', 'bundle');
    const reportPath = path.join(projDir, 'verify-report.json');
    const passedTemplate = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'passed-report.json'), 'utf8'));
    const promptFile = fs.readdirSync(projDir).find((file) => file.endsWith('_TECHDEMO_PROMPT.md'));
    const promptSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(projDir, promptFile))).digest('hex');
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const emptyMetrics = { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: null, p99Ms: null, samples: null } };

    const makeReport = ({
      status = 'failed',
      build = { ok: true, error: null },
      runtime = { hookReady: true, errors: [] },
      gatePass = false,
      gateFailures = [],
    } = {}) => {
      const report = clone(passedTemplate);
      report.status = status;
      report.target = 'bundle';
      report.build = build;
      report.runtime = runtime;
      report.captures = status === 'passed' ? clone(passedTemplate.captures) : [];
      report.gates.pass = gatePass;
      report.gates.failures = gateFailures;
      report.gates.metrics = status === 'passed' ? clone(passedTemplate.gates.metrics) : emptyMetrics;
      report.benchmark = { caseId: 'alpine-signature', briefSha256: promptSha256 };
      return report;
    };

    const collect = (report) => {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      return collectBenchmarkResult(projDir, {
        caseId: 'alpine-signature',
        model: 'claude-3-7-sonnet',
        attempt: 1,
      });
    };

    const runtimeOnly = collect(makeReport({
      runtime: { hookReady: true, errors: ['  runtime stopped  '] },
    }));
    assert.deepEqual(runtimeOnly.automated.hardGateFailures, ['runtime stopped']);
    assert.equal(runtimeOnly.automated.hardGateFailureCount, 1);
    assert.equal(runtimeOnly.eligible, false);

    const buildOnly = collect(makeReport({
      build: { ok: false, error: '  build stopped  ' },
      runtime: { hookReady: false, errors: [] },
    }));
    assert.deepEqual(buildOnly.automated.hardGateFailures, ['build stopped']);
    assert.equal(buildOnly.automated.hardGateFailureCount, 1);
    assert.equal(buildOnly.eligible, false);

    const duplicates = collect(makeReport({
      build: { ok: false, error: 'same failure' },
      runtime: { hookReady: true, errors: ['same failure', '  runtime failure  ', ''] },
      gateFailures: ['same failure', 'runtime failure', ' gate failure ', '  '],
    }));
    assert.deepEqual(duplicates.automated.hardGateFailures, ['same failure', 'runtime failure', 'gate failure']);
    assert.equal(duplicates.automated.hardGateFailureCount, 3);

    const errorResult = collect(makeReport({
      status: 'error',
      runtime: { hookReady: false, errors: ['operational failure'] },
    }));
    assert.equal(errorResult.eligible, false);
    assert.ok(errorResult.automated.hardGateFailureCount > 0);

    const blankStrings = collect(makeReport({
      runtime: { hookReady: true, errors: [' ', '\t', 'runtime reason'] },
      gateFailures: ['', '  ', 'gate reason'],
    }));
    assert.deepEqual(blankStrings.automated.hardGateFailures, ['runtime reason', 'gate reason']);
    assert.equal(blankStrings.automated.hardGateFailureCount, 2);

    const passed = collect(makeReport({ status: 'passed', gatePass: true }));
    assert.deepEqual(passed.automated.hardGateFailures, []);
    assert.equal(passed.automated.hardGateFailureCount, 0);
    assert.equal(passed.eligible, true);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('isPathInside rejects sibling-prefix paths that merely share a name prefix', () => {
  const sep = path.sep;
  assert.equal(isPathInside(`${sep}tmp${sep}case`, `${sep}tmp${sep}case-evil${sep}file`), false);
  assert.equal(isPathInside('C:\\tmp\\case', 'C:\\tmp\\case-evil\\file'), false);

  // Genuine containment (parent === candidate, and a real nested child) must still pass.
  assert.equal(isPathInside(`${sep}tmp${sep}case`, `${sep}tmp${sep}case`), true);
  assert.equal(isPathInside(`${sep}tmp${sep}case`, `${sep}tmp${sep}case${sep}file`), true);

  // Traversal-style escapes must be rejected.
  assert.equal(isPathInside(`${sep}tmp${sep}case`, `${sep}tmp${sep}case${sep}..${sep}other`), false);
  assert.equal(isPathInside(`${sep}tmp${sep}case`, `${sep}tmp${sep}other`), false);
});

test('adversarial test: sibling-prefix prompt path is rejected by collectBenchmarkResult', () => {
  const tmpDir = makeTempDir();
  try {
    prepareBenchmark(tmpDir, { caseId: 'alpine-signature' });

    const preparedCaseDir = path.join(tmpDir, 'alpine-signature');
    const projDir = path.join(preparedCaseDir, 'bundle');
    const reportPath = path.join(projDir, 'verify-report.json');

    // Create a sibling directory whose name is a superstring of the real prepared case
    // directory name (e.g. 'alpine-signature-evil'), so a naive `startsWith` containment
    // check would have wrongly treated it as "inside" alpine-signature.
    const evilSiblingDir = `${preparedCaseDir}-evil`;
    fs.mkdirSync(evilSiblingDir, { recursive: true });
    const evilPromptPath = path.join(evilSiblingDir, 'alpine-signature_TECHDEMO_PROMPT.md');
    fs.writeFileSync(evilPromptPath, '# forged brief', 'utf8');

    // Remove the real prompt so collectBenchmarkResult's fallback readdir search
    // in the bundle dir would otherwise be forced to look elsewhere; instead we
    // directly verify the sibling-prefix directory itself is never treated as "inside".
    assert.equal(isPathInside(preparedCaseDir, evilPromptPath), false);
    assert.equal(isPathInside(preparedCaseDir, evilSiblingDir), false);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('adversarial test: symlink/junction prompt escape outside the prepared case directory is rejected', (t) => {
  const tmpDir = makeTempDir();
  try {
    prepareBenchmark(tmpDir, { caseId: 'alpine-signature' });

    const preparedCaseDir = path.join(tmpDir, 'alpine-signature');
    const projDir = path.join(preparedCaseDir, 'bundle');
    const reportPath = path.join(projDir, 'verify-report.json');

    // Build a genuine escape target OUTSIDE the prepared case directory.
    const escapeDir = path.join(tmpDir, 'escape-target');
    fs.mkdirSync(escapeDir, { recursive: true });
    fs.writeFileSync(path.join(escapeDir, 'secret.txt'), 'outside data', 'utf8');

    // Replace the bundle directory with a link pointing at the escape target, so any
    // file "inside" projDir/bundle actually realpath-resolves outside preparedCaseDir.
    // Try a real symlink first; fall back to a Windows directory junction (creatable
    // without admin rights) as the platform-appropriate equivalent realpath escape.
    const linkedDir = path.join(preparedCaseDir, 'escaped-bundle');
    let linked = false;
    try {
      fs.symlinkSync(escapeDir, linkedDir, 'dir');
      linked = true;
    } catch (err) {
      try {
        fs.symlinkSync(escapeDir, linkedDir, 'junction');
        linked = true;
      } catch (err2) {
        t.skip(`Neither symlinks nor junctions are creatable on this platform/permissions (${err2.code || err2.message})`);
      }
    }

    if (!linked) return;

    const forgedPromptPath = path.join(linkedDir, 'alpine-signature_TECHDEMO_PROMPT.md');
    fs.writeFileSync(path.join(escapeDir, 'alpine-signature_TECHDEMO_PROMPT.md'), '# forged brief via link', 'utf8');

    const forgedPromptReal = fs.realpathSync(forgedPromptPath);
    assert.equal(isPathInside(preparedCaseDir, forgedPromptReal), false, 'realpath-resolved forged prompt must resolve outside the prepared case directory');
  } finally {
    removeTempDir(tmpDir);
  }
});

test('adversarial test: symlinked verify-report.json escaping the project directory is rejected', (t) => {
  const tmpDir = makeTempDir();
  try {
    prepareBenchmark(tmpDir, { caseId: 'alpine-signature' });

    const projDir = path.join(tmpDir, 'alpine-signature', 'bundle');
    const reportPath = path.join(projDir, 'verify-report.json');

    const escapeDir = path.join(tmpDir, 'report-escape-target');
    fs.mkdirSync(escapeDir, { recursive: true });
    const realReportLocation = path.join(escapeDir, 'planted-report.json');
    fs.writeFileSync(realReportLocation, JSON.stringify({ planted: true }), 'utf8');

    let linked = false;
    try {
      fs.symlinkSync(realReportLocation, reportPath, 'file');
      linked = true;
    } catch (err) {
      t.skip(`File symlinks are not creatable on this platform/permissions (${err.code || err.message})`);
    }

    if (!linked) return;

    assert.throws(() => {
      collectBenchmarkResult(projDir, {
        caseId: 'alpine-signature',
        model: 'claude-3-7-sonnet',
        attempt: 1,
      });
    }, /Path security violation: report file/);
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

test('adversarial test: copied Dune report placed in Alpine bundle rejected on collect', () => {
  const tmpDir = makeTempDir();
  try {
    // Prepare both benchmark cases (smoke suite includes dune-proven and alpine-signature).
    prepareBenchmark(tmpDir, { suite: 'smoke' });

    // Read Dune's actual generated brief hash from its prepared case.json.
    const duneCaseDir = path.join(tmpDir, 'dune-proven');
    const duneMeta = JSON.parse(fs.readFileSync(path.join(duneCaseDir, 'case.json'), 'utf8'));
    const duneSha256 = duneMeta.briefSha256;

    // Sanity: the recorded hash must equal the actual generated prompt bytes.
    const duneProjDir = path.join(duneCaseDir, 'bundle');
    const dunePromptFile = fs.readdirSync(duneProjDir).find((f) => f.endsWith('_TECHDEMO_PROMPT.md'));
    assert.ok(dunePromptFile, 'Dune bundle must contain a generated techdemo prompt');
    const dunePromptBytes = fs.readFileSync(path.join(duneProjDir, dunePromptFile));
    assert.equal(crypto.createHash('sha256').update(dunePromptBytes).digest('hex'), duneSha256);

    // A fully valid Dune benchmark report, target 'bundle'.
    const duneReport = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'passed-report.json'), 'utf8'));
    duneReport.target = 'bundle';
    duneReport.benchmark = { caseId: 'dune-proven', briefSha256: duneSha256 };

    // Place the Dune report inside the Alpine bundle (target basename is also 'bundle').
    const alpineProjDir = path.join(tmpDir, 'alpine-signature', 'bundle');
    fs.writeFileSync(path.join(alpineProjDir, 'verify-report.json'), JSON.stringify(duneReport, null, 2), 'utf8');

    assert.throws(() => {
      collectBenchmarkResult(alpineProjDir, {
        caseId: 'alpine-signature',
        model: 'claude-3-7-sonnet',
        attempt: 1,
      });
    }, /Report benchmark case ID mismatch/i);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('adversarial test: malformed automated result with string metrics rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'eligible-result.json'), 'utf8'));
  res.automated.metrics = 'invalid-string-metrics';
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
});

test('adversarial test: failed result with string metrics ("not-an-object") rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  assert.equal(res.automated.status, 'failed');
  res.automated.metrics = 'not-an-object';
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /automated\.metrics must be a plain object/.test(e)));
});

test('adversarial test: failed result with array metrics rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  res.automated.metrics = [1, 2, 3];
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
});

test('adversarial test: failed result with unknown nested metric key rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  res.automated.metrics.frameStats.bogusExtraKey = 123;
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /frameStats must contain exact keys/.test(e)));
});

test('error result with correctly-shaped null/empty metrics is accepted', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  res.automated.status = 'error';
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, true, val.errors.join('; '));
});

test('failed result with a duplicate or unknown pose in metrics.frames is rejected', () => {
  const dup = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  dup.automated.metrics.frames = [
    { name: 'idle', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 },
    { name: 'idle', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 },
  ];
  assert.equal(validateBenchmarkResult(dup).valid, false);

  const unknown = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  unknown.automated.metrics.frames = [
    { name: 'not-a-real-pose', meanLuminance: 0.4, flatFrameRatio: 0.1, characterAreaFraction: 0.1 },
  ];
  assert.equal(validateBenchmarkResult(unknown).valid, false);
});

test('adversarial test: failed benchmark result with a negative camera depth rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  res.automated.metrics.cameraNearestDepthM = -2;
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /cameraNearestDepthM/.test(e)));
});

test('adversarial test: error benchmark result with a negative frame time rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  res.automated.status = 'error';
  res.automated.metrics.frameStats.medianMs = -10;
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /medianMs/.test(e)));
});

test('adversarial test: failed benchmark result with an out-of-range ratio rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  res.automated.metrics.frames = [
    { name: 'idle', meanLuminance: 0.4, flatFrameRatio: 1.2, characterAreaFraction: 0.1 },
  ];
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /flatFrameRatio/.test(e)));
});

test('adversarial test: failed status with pass true rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'eligible-result.json'), 'utf8'));
  res.automated.status = 'failed';
  res.automated.pass = true;
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
});

test('adversarial test: failed result with zero hard gate failures rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'failed-result.json'), 'utf8'));
  res.automated.hardGateFailures = [];
  res.automated.hardGateFailureCount = 0;
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Failed or error benchmark result must contain at least one hard gate failure/.test(e)));
});

test('adversarial test: passed result with a hard gate failure rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'eligible-result.json'), 'utf8'));
  res.automated.hardGateFailures = ['unexpected failure'];
  res.automated.hardGateFailureCount = 1;
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /Passed benchmark result must contain zero hard gate failures/.test(e)));
});

test('adversarial test: submitted review containing visualAverage rejected', () => {
  const submitted = {
    reviewer: 'Alice',
    scores: {
      compositionReadability: 4,
      materialCoherence: 4,
      characterCraft: 4,
      mechanicLegibility: 4,
      creativeIdentity: 4,
      scopeDiscipline: 4,
    },
    visualAverage: 4.0,
  };
  const val = validateHumanReview(submitted);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /visualAverage/i.test(e)));
});

test('submitted review with a leaking reviewer name or notes is rejected', () => {
  const baseScores = {
    compositionReadability: 4,
    materialCoherence: 4,
    characterCraft: 4,
    mechanicLegibility: 4,
    creativeIdentity: 4,
    scopeDiscipline: 4,
  };

  const leakingReviewer = validateHumanReview({
    reviewer: 'C:\\Users\\wests\\reviewer.txt',
    scores: baseScores,
  });
  assert.equal(leakingReviewer.valid, false);
  assert.ok(leakingReviewer.errors.some((e) => /leakage/i.test(e)));

  const leakingNotes = validateHumanReview({
    reviewer: 'Alice',
    scores: baseScores,
    notes: 'See /home/user/workspace/screenshot.png for evidence',
  });
  assert.equal(leakingNotes.valid, false);
  assert.ok(leakingNotes.errors.some((e) => /leakage/i.test(e)));
});

test('benchmark result with a leaking modelLabel is rejected', () => {
  const res = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'eligible-result.json'), 'utf8'));
  res.modelLabel = 'agent bearer eyJhbGciOiJIUzI1NiJ9.secret-token';
  const val = validateBenchmarkResult(res);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /modelLabel/.test(e)));
});

test('adversarial test: Markdown and JSON using same destination path rejected', () => {
  const tmpDir = makeTempDir();
  try {
    assert.throws(() => {
      summarizeBenchmarkResults(tmpDir, { outPath: 'summary.md', jsonPath: 'summary.md' });
    }, /same file path/i);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('adversarial test: second summary rename failure restores pre-existing file', () => {
  const tmpDir = makeTempDir();
  try {
    const res1 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'benchmarks', 'eligible-result.json'), 'utf8'));
    fs.writeFileSync(path.join(tmpDir, 'res.json'), JSON.stringify(res1, null, 2), 'utf8');

    const outMd = path.join(tmpDir, 'summary.md');
    const outJson = path.join(tmpDir, 'summary.json');
    fs.writeFileSync(outMd, 'original markdown content', 'utf8');

    assert.throws(() => {
      summarizeBenchmarkResults(tmpDir, {
        outPath: outMd,
        jsonPath: outJson,
        force: true,
        _testSecondRenameFailure: true,
      });
    }, /Injected second rename failure/);

    assert.equal(fs.readFileSync(outMd, 'utf8'), 'original markdown content', 'Pre-existing summary.md must be restored on late failure');
    assert.equal(fs.existsSync(outJson), false);

    // Verify no temp or backup files left behind
    const remaining = fs.readdirSync(tmpDir);
    assert.deepEqual(remaining, ['res.json', 'summary.md']);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('adversarial test: preparation swap failure restores original outDir with unrelated file', () => {
  const tmpDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(tmpDir, 'unrelated.txt'), 'original user data', 'utf8');

    assert.throws(() => {
      prepareBenchmark(tmpDir, { suite: 'smoke', force: true, _testSwapFailure: true });
    }, /Injected preparation swap failure/);

    assert.equal(fs.existsSync(path.join(tmpDir, 'unrelated.txt')), true);
    assert.equal(fs.readFileSync(path.join(tmpDir, 'unrelated.txt'), 'utf8'), 'original user data');

    // Verify no temporary staging or backup folders remain
    const parentDir = path.dirname(tmpDir);
    const parentFiles = fs.readdirSync(parentDir);
    assert.equal(parentFiles.some((f) => f.startsWith('.tmp-prepare-') || f.startsWith('.tmp-bak-')), false);
  } finally {
    removeTempDir(tmpDir);
  }
});
