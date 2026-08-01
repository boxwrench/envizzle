import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  BENCHMARK_CASES,
  VALID_SUITES,
  getBenchmarkCase,
  getBenchmarkCasesForSuite,
  buildCaseAssemblySpec,
} from './benchmark-cases.mjs';
import { assembleBrief, writeBundle } from './assemble.mjs';
import { validateVerificationReport, containsLeak, isPathInside } from './verify/report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname);

function isPlainObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function computeSha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/;

const ALLOWED_REVIEW_CATEGORIES = Object.freeze([
  'compositionReadability',
  'materialCoherence',
  'characterCraft',
  'mechanicLegibility',
  'creativeIdentity',
  'scopeDiscipline',
]);

/**
 * Validate human review submitted by user (must not contain visualAverage).
 */
export function validateHumanReview(review) {
  const errors = [];
  if (!isPlainObject(review)) {
    return { valid: false, errors: ['Human review must be a plain object'] };
  }

  if ('visualAverage' in review) {
    return { valid: false, errors: ["Submitted review must not contain 'visualAverage'; it is derived."] };
  }

  const allowedTopKeys = new Set(['reviewer', 'scores', 'notes']);
  for (const k of Object.keys(review)) {
    if (!allowedTopKeys.has(k)) {
      errors.push(`Unknown property '${k}' in review`);
    }
  }

  if (typeof review.reviewer !== 'string' || review.reviewer.trim() === '') {
    errors.push('reviewer must be a non-empty string');
  } else if (review.reviewer.includes('\n') || review.reviewer.includes('\r') || CONTROL_CHARS_REGEX.test(review.reviewer)) {
    errors.push('reviewer must be a single-line string without control characters');
  } else if (containsLeak(review.reviewer)) {
    errors.push('reviewer contains path, stack, or credential leakage');
  }

  if (review.notes !== undefined && review.notes !== null) {
    if (typeof review.notes !== 'string') {
      errors.push('notes must be a string if provided');
    } else if (containsLeak(review.notes)) {
      errors.push('notes contains path, stack, or credential leakage');
    }
  }

  if (!isPlainObject(review.scores)) {
    errors.push('scores must be a plain object');
    return { valid: false, errors };
  }

  for (const k of Object.keys(review.scores)) {
    if (!ALLOWED_REVIEW_CATEGORIES.includes(k)) {
      errors.push(`Unknown score category '${k}'`);
    }
  }

  for (const cat of ALLOWED_REVIEW_CATEGORIES) {
    if (!(cat in review.scores)) {
      errors.push(`Missing score category '${cat}'`);
      continue;
    }
    const val = review.scores[cat];
    if (typeof val !== 'number' || !Number.isInteger(val)) {
      errors.push(`Score category '${cat}' must be an integer, got ${JSON.stringify(val)}`);
    } else if (val < 1 || val > 5) {
      errors.push(`Score category '${cat}' must be between 1 and 5, got ${val}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate stored human review in normalized benchmark result.
 */
export function validateStoredHumanReview(review) {
  const errors = [];
  if (!isPlainObject(review)) {
    return { valid: false, errors: ['Stored human review must be a plain object'] };
  }

  const allowedTopKeys = new Set(['reviewer', 'scores', 'notes', 'visualAverage']);
  for (const k of Object.keys(review)) {
    if (!allowedTopKeys.has(k)) {
      errors.push(`Unknown property '${k}' in stored review`);
    }
  }

  if (typeof review.reviewer !== 'string' || review.reviewer.trim() === '') {
    errors.push('reviewer must be a non-empty string');
  } else if (review.reviewer.includes('\n') || review.reviewer.includes('\r') || CONTROL_CHARS_REGEX.test(review.reviewer)) {
    errors.push('reviewer must be a single-line string without control characters');
  } else if (containsLeak(review.reviewer)) {
    errors.push('reviewer contains path, stack, or credential leakage');
  }

  if (review.notes !== undefined && review.notes !== null) {
    if (typeof review.notes !== 'string') {
      errors.push('notes must be a string if provided');
    } else if (containsLeak(review.notes)) {
      errors.push('notes contains path, stack, or credential leakage');
    }
  }

  if (!isPlainObject(review.scores)) {
    errors.push('scores must be a plain object');
    return { valid: false, errors };
  }

  for (const k of Object.keys(review.scores)) {
    if (!ALLOWED_REVIEW_CATEGORIES.includes(k)) {
      errors.push(`Unknown score category '${k}'`);
    }
  }

  for (const cat of ALLOWED_REVIEW_CATEGORIES) {
    if (!(cat in review.scores)) {
      errors.push(`Missing score category '${cat}'`);
      continue;
    }
    const val = review.scores[cat];
    if (typeof val !== 'number' || !Number.isInteger(val)) {
      errors.push(`Score category '${cat}' must be an integer, got ${JSON.stringify(val)}`);
    } else if (val < 1 || val > 5) {
      errors.push(`Score category '${cat}' must be between 1 and 5, got ${val}`);
    }
  }

  const expectedAvg = computeVisualAverage(review.scores);
  if (typeof review.visualAverage !== 'number' || review.visualAverage !== expectedAvg) {
    errors.push(`visualAverage (${review.visualAverage}) does not match computed visual average (${expectedAvg})`);
  }

  return { valid: errors.length === 0, errors };
}

export function computeVisualAverage(scores) {
  let sum = 0;
  for (const c of ALLOWED_REVIEW_CATEGORIES) {
    sum += scores[c];
  }
  return Math.round((sum / ALLOWED_REVIEW_CATEGORIES.length) * 100) / 100;
}

export function validateBenchmarkResult(res) {
  const errors = [];
  if (!isPlainObject(res)) {
    return { valid: false, errors: ['Benchmark result must be a plain object'] };
  }

  const allowedKeys = new Set(['schemaVersion', 'caseId', 'modelLabel', 'attempt', 'briefSha256', 'automated', 'humanReview', 'eligible']);
  for (const k of Object.keys(res)) {
    if (!allowedKeys.has(k)) errors.push(`Unknown top-level key '${k}' in benchmark result`);
  }

  for (const reqKey of allowedKeys) {
    if (!(reqKey in res)) errors.push(`Missing required top-level key '${reqKey}' in benchmark result`);
  }

  if (errors.length > 0) return { valid: false, errors };

  if (res.schemaVersion !== 1) errors.push(`schemaVersion must be 1, got ${JSON.stringify(res.schemaVersion)}`);
  if (typeof res.caseId !== 'string' || !BENCHMARK_CASES.some((c) => c.id === res.caseId)) {
    errors.push(`Invalid caseId '${res.caseId}'`);
  }
  if (typeof res.modelLabel !== 'string' || res.modelLabel.trim() === '' || /[\r\n]/.test(res.modelLabel) || CONTROL_CHARS_REGEX.test(res.modelLabel)) {
    errors.push('modelLabel must be a non-empty single-line string');
  } else if (containsLeak(res.modelLabel)) {
    errors.push('modelLabel contains path, stack, or credential leakage (this value is embedded directly into Markdown summaries)');
  }
  if (typeof res.attempt !== 'number' || !Number.isInteger(res.attempt) || res.attempt < 1) {
    errors.push('attempt must be a positive integer >= 1');
  }
  if (typeof res.briefSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(res.briefSha256)) {
    errors.push('briefSha256 must be a lowercase 64-character hex SHA-256 hash');
  }

  if (!isPlainObject(res.automated)) {
    errors.push('automated must be a plain object');
  } else {
    const autoKeys = new Set(['status', 'pass', 'hardGateFailures', 'hardGateFailureCount', 'metrics']);
    for (const k of Object.keys(res.automated)) {
      if (!autoKeys.has(k)) errors.push(`Unknown key '${k}' in automated`);
    }
    for (const reqKey of autoKeys) {
      if (!(reqKey in res.automated)) errors.push(`Missing required key '${reqKey}' in automated`);
    }

    if (!['passed', 'failed', 'error'].includes(res.automated.status)) {
      errors.push(`automated.status must be 'passed', 'failed', or 'error', got '${res.automated.status}'`);
    }
    if (typeof res.automated.pass !== 'boolean') {
      errors.push('automated.pass must be a boolean');
    }
    if (res.automated.pass !== (res.automated.status === 'passed')) {
      errors.push(`Contradictory automated state: pass is ${res.automated.pass} but status is '${res.automated.status}'`);
    }

    if (!Array.isArray(res.automated.hardGateFailures) || res.automated.hardGateFailures.some((f) => typeof f !== 'string' || containsLeak(f))) {
      errors.push('automated.hardGateFailures must be an array of safe string failure messages without path/credential leaks');
    }
    if (typeof res.automated.hardGateFailureCount !== 'number' || res.automated.hardGateFailureCount !== (res.automated.hardGateFailures || []).length) {
      errors.push('automated.hardGateFailureCount must equal length of hardGateFailures array');
    }

    // Metrics shape must be exact and strictly typed regardless of pass/fail/error status.
    // Failed and error results may report null/empty evidence, but never a wrong-shaped
    // value (string, array, or arbitrary object) in place of the metrics object.
    if (!isPlainObject(res.automated.metrics)) {
      errors.push('automated.metrics must be a plain object');
    } else {
      const m = res.automated.metrics;
      const mKeys = Object.keys(m);
      if (mKeys.length !== 3 || !mKeys.includes('frames') || !mKeys.includes('cameraNearestDepthM') || !mKeys.includes('frameStats')) {
        errors.push(`automated.metrics must contain exact keys ['frames', 'cameraNearestDepthM', 'frameStats'], got [${mKeys.join(', ')}]`);
      }

      const knownPoses = new Set(['idle', 'locomotion', 'mechanic']);
      if (!Array.isArray(m.frames)) {
        errors.push('automated.metrics.frames must be an array');
      } else {
        const seenNames = new Set();
        for (const f of m.frames) {
          if (!isPlainObject(f)) {
            errors.push('automated.metrics.frames entries must be plain objects');
            continue;
          }
          const fKeys = Object.keys(f);
          if (fKeys.length !== 4 || !fKeys.includes('name') || !fKeys.includes('meanLuminance') || !fKeys.includes('flatFrameRatio') || !fKeys.includes('characterAreaFraction')) {
            errors.push(`automated.metrics.frames entry must contain exact keys ['name', 'meanLuminance', 'flatFrameRatio', 'characterAreaFraction'], got [${fKeys.join(', ')}]`);
          }
          if (typeof f.name !== 'string') {
            errors.push('automated.metrics.frames entry name must be a string');
          } else {
            if (!knownPoses.has(f.name)) errors.push(`automated.metrics.frames contains unknown pose '${f.name}'`);
            if (seenNames.has(f.name)) errors.push(`automated.metrics.frames contains duplicate pose '${f.name}'`);
            seenNames.add(f.name);
          }
          if (!(f.meanLuminance === null || (typeof f.meanLuminance === 'number' && Number.isFinite(f.meanLuminance)))) {
            errors.push(`automated.metrics.frames entry '${f.name}' meanLuminance must be a finite number or null`);
          }
          if (!(f.flatFrameRatio === null || (typeof f.flatFrameRatio === 'number' && Number.isFinite(f.flatFrameRatio)))) {
            errors.push(`automated.metrics.frames entry '${f.name}' flatFrameRatio must be a finite number or null`);
          }
          if (!(f.characterAreaFraction === null || (typeof f.characterAreaFraction === 'number' && Number.isFinite(f.characterAreaFraction)))) {
            errors.push(`automated.metrics.frames entry '${f.name}' characterAreaFraction must be a finite number or null`);
          }
        }
      }

      if (!(m.cameraNearestDepthM === null || (typeof m.cameraNearestDepthM === 'number' && Number.isFinite(m.cameraNearestDepthM)))) {
        errors.push('automated.metrics.cameraNearestDepthM must be a finite number or null');
      }

      if (!isPlainObject(m.frameStats)) {
        errors.push('automated.metrics.frameStats must be a plain object');
      } else {
        const fsKeys = Object.keys(m.frameStats);
        if (fsKeys.length !== 3 || !fsKeys.includes('medianMs') || !fsKeys.includes('p99Ms') || !fsKeys.includes('samples')) {
          errors.push(`automated.metrics.frameStats must contain exact keys ['medianMs', 'p99Ms', 'samples'], got [${fsKeys.join(', ')}]`);
        }
        if (!(m.frameStats.medianMs === null || (typeof m.frameStats.medianMs === 'number' && Number.isFinite(m.frameStats.medianMs)))) {
          errors.push('automated.metrics.frameStats.medianMs must be a finite number or null');
        }
        if (!(m.frameStats.p99Ms === null || (typeof m.frameStats.p99Ms === 'number' && Number.isFinite(m.frameStats.p99Ms)))) {
          errors.push('automated.metrics.frameStats.p99Ms must be a finite number or null');
        }
        if (!(m.frameStats.samples === null || (typeof m.frameStats.samples === 'number' && Number.isInteger(m.frameStats.samples) && m.frameStats.samples >= 0))) {
          errors.push('automated.metrics.frameStats.samples must be a non-negative integer or null');
        }
      }
    }

    // Passed results additionally require complete, finite, three-pose evidence.
    if (res.automated.pass === true && isPlainObject(res.automated.metrics)) {
      const m = res.automated.metrics;
      const frames = m.frames;
      if (!Array.isArray(frames) || frames.length !== 3) {
        errors.push('Passed benchmark result must contain exactly 3 frame metric records');
      } else {
        const names = new Set(frames.map((f) => f?.name));
        if (names.size !== 3 || !names.has('idle') || !names.has('locomotion') || !names.has('mechanic')) {
          errors.push('Passed benchmark result frames must contain exact unique poses idle, locomotion, mechanic');
        }
        for (const f of frames) {
          if (typeof f.meanLuminance !== 'number' || !Number.isFinite(f.meanLuminance)) errors.push(`Frame '${f.name}' missing finite meanLuminance`);
          if (typeof f.flatFrameRatio !== 'number' || !Number.isFinite(f.flatFrameRatio)) errors.push(`Frame '${f.name}' missing finite flatFrameRatio`);
          if (typeof f.characterAreaFraction !== 'number' || !Number.isFinite(f.characterAreaFraction)) errors.push(`Frame '${f.name}' missing finite characterAreaFraction`);
        }
      }
      if (typeof m.cameraNearestDepthM !== 'number' || !Number.isFinite(m.cameraNearestDepthM) || m.cameraNearestDepthM < 0) {
        errors.push('Passed benchmark result missing finite non-negative cameraNearestDepthM');
      }
      if (!isPlainObject(m.frameStats) || typeof m.frameStats.medianMs !== 'number' || !Number.isFinite(m.frameStats.medianMs) || typeof m.frameStats.p99Ms !== 'number' || !Number.isFinite(m.frameStats.p99Ms) || typeof m.frameStats.samples !== 'number' || !Number.isInteger(m.frameStats.samples) || m.frameStats.samples < 1) {
        errors.push('Passed benchmark result missing valid frameStats metrics');
      }
    }
  }

  if (res.humanReview !== null && res.humanReview !== undefined) {
    const valRev = validateStoredHumanReview(res.humanReview);
    if (!valRev.valid) {
      errors.push(`Invalid humanReview: ${valRev.errors.join('; ')}`);
    }
  }

  const expectedEligibility = res.automated?.pass === true;
  if (res.eligible !== expectedEligibility) {
    errors.push(`Contradictory state: eligible is ${res.eligible} but automated.pass is ${res.automated?.pass}`);
  }

  return { valid: errors.length === 0, errors };
}

export function parseBenchmarkCliArgs(args) {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    if (args.length > 1) throw new Error('Cannot combine --help with other arguments');
    return { command: 'help' };
  }

  const cmd = args[0];

  if (cmd === 'list') {
    const seenFlags = new Set();
    let json = false;
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--json') {
        if (seenFlags.has('json')) throw new Error('Duplicate option --json');
        seenFlags.add('json');
        json = true;
      } else if (arg === '--help' || arg === '-h') {
        throw new Error('Cannot combine --help with other arguments');
      } else {
        throw new Error(`Unknown argument '${arg}' for list command`);
      }
    }
    return { command: 'list', json };
  }

  if (cmd === 'prepare') {
    let outDir = null;
    let suite = null;
    let caseId = null;
    let force = false;

    const seenFlags = new Set();

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--suite') {
        if (seenFlags.has('suite')) throw new Error('Duplicate option --suite');
        seenFlags.add('suite');
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
          throw new Error('Missing value for --suite');
        }
        suite = args[++i];
      } else if (arg === '--case') {
        if (seenFlags.has('case')) throw new Error('Duplicate option --case');
        seenFlags.add('case');
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
          throw new Error('Missing value for --case');
        }
        caseId = args[++i];
      } else if (arg === '--force') {
        if (seenFlags.has('force')) throw new Error('Duplicate option --force');
        seenFlags.add('force');
        force = true;
      } else if (arg === '--help' || arg === '-h') {
        throw new Error('Cannot combine --help with other arguments');
      } else if (arg.startsWith('-')) {
        throw new Error(`Unknown option '${arg}' for prepare`);
      } else {
        if (outDir !== null) {
          throw new Error(`Unexpected positional argument '${arg}'`);
        }
        outDir = arg;
      }
    }

    if (!outDir) {
      throw new Error('prepare command requires <output-directory>');
    }
    if (!suite && !caseId) {
      throw new Error('prepare command requires either --suite or --case');
    }
    if (suite && caseId) {
      throw new Error('Cannot specify both --suite and --case');
    }

    return { command: 'prepare', outDir: path.resolve(outDir), suite, caseId, force };
  }

  if (cmd === 'collect') {
    let projectDir = null;
    let caseId = null;
    let model = null;
    let attemptStr = null;
    let out = null;
    let review = null;
    let force = false;

    const seenFlags = new Set();

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--case') {
        if (seenFlags.has('case')) throw new Error('Duplicate option --case');
        seenFlags.add('case');
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --case');
        caseId = args[++i];
      } else if (arg === '--model') {
        if (seenFlags.has('model')) throw new Error('Duplicate option --model');
        seenFlags.add('model');
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --model');
        model = args[++i];
      } else if (arg === '--attempt') {
        if (seenFlags.has('attempt')) throw new Error('Duplicate option --attempt');
        seenFlags.add('attempt');
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --attempt');
        attemptStr = args[++i];
      } else if (arg === '--out') {
        if (seenFlags.has('out')) throw new Error('Duplicate option --out');
        seenFlags.add('out');
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --out');
        out = args[++i];
      } else if (arg === '--review') {
        if (seenFlags.has('review')) throw new Error('Duplicate option --review');
        seenFlags.add('review');
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --review');
        review = args[++i];
      } else if (arg === '--force') {
        if (seenFlags.has('force')) throw new Error('Duplicate option --force');
        seenFlags.add('force');
        force = true;
      } else if (arg === '--help' || arg === '-h') {
        throw new Error('Cannot combine --help with other arguments');
      } else if (arg.startsWith('-')) {
        throw new Error(`Unknown option '${arg}' for collect`);
      } else {
        if (projectDir !== null) throw new Error(`Unexpected positional argument '${arg}'`);
        projectDir = arg;
      }
    }

    if (!projectDir) throw new Error('collect command requires <project-directory>');
    if (!caseId) throw new Error('collect command requires --case <case-id>');
    if (!model) throw new Error('collect command requires --model <label>');
    if (!attemptStr || !/^[1-9]\d*$/.test(attemptStr)) throw new Error('collect command requires valid --attempt <positive-integer>');
    if (!out) throw new Error('collect command requires --out <result.json>');

    return {
      command: 'collect',
      projectDir: path.resolve(projectDir),
      caseId,
      model,
      attempt: parseInt(attemptStr, 10),
      outPath: path.resolve(out),
      reviewPath: review ? path.resolve(review) : null,
      force,
    };
  }

  if (cmd === 'summarize') {
    let resultsDir = null;
    let outPath = null;
    let jsonPath = null;
    let force = false;

    const seenFlags = new Set();

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--out') {
        if (seenFlags.has('out')) throw new Error('Duplicate option --out');
        seenFlags.add('out');
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --out');
        outPath = args[++i];
      } else if (arg === '--json') {
        if (seenFlags.has('json')) throw new Error('Duplicate option --json');
        seenFlags.add('json');
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --json');
        jsonPath = args[++i];
      } else if (arg === '--force') {
        if (seenFlags.has('force')) throw new Error('Duplicate option --force');
        seenFlags.add('force');
        force = true;
      } else if (arg === '--help' || arg === '-h') {
        throw new Error('Cannot combine --help with other arguments');
      } else if (arg.startsWith('-')) {
        throw new Error(`Unknown option '${arg}' for summarize`);
      } else {
        if (resultsDir !== null) throw new Error(`Unexpected positional argument '${arg}'`);
        resultsDir = arg;
      }
    }

    if (!resultsDir) throw new Error('summarize command requires <results-directory>');
    if (!outPath) throw new Error('summarize command requires --out <summary.md>');

    return {
      command: 'summarize',
      resultsDir: path.resolve(resultsDir),
      outPath: path.resolve(outPath),
      jsonPath: jsonPath ? path.resolve(jsonPath) : null,
      force,
    };
  }

  throw new Error(`Unknown subcommand '${cmd}'`);
}

export function printBenchmarkHelp() {
  console.log(`Envizzle Benchmark CLI

Usage:
  node benchmark.mjs list [--json]
  node benchmark.mjs prepare <output-directory> (--suite <smoke|full> | --case <case-id>) [--force]
  node benchmark.mjs collect <project-directory> --case <case-id> --model <label> --attempt <integer> --out <result.json> [--review <review.json>] [--force]
  node benchmark.mjs summarize <results-directory> --out <summary.md> [--json <summary.json>] [--force]
  node benchmark.mjs --help
`);
}

function copyRecursive(src, dst) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dst, child));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

export function prepareBenchmark(outDir, options = {}) {
  let targetCases = [];
  if (options.caseId) {
    targetCases = [getBenchmarkCase(options.caseId)];
  } else if (options.suite) {
    targetCases = getBenchmarkCasesForSuite(options.suite);
  } else {
    throw new Error('Must specify caseId or suite');
  }

  const allCaseIds = new Set(BENCHMARK_CASES.map((c) => c.id));
  const targetCaseIds = new Set(targetCases.map((c) => c.id));

  // Preflight check: verify all cases build assembly specs cleanly
  const preparedBundles = [];
  for (const c of targetCases) {
    const spec = buildCaseAssemblySpec(c.id);
    const { brief, fileName } = assembleBrief(spec, { rootDir: repoRoot });
    const briefSha256 = computeSha256(brief);
    preparedBundles.push({ caseDef: c, spec, brief, fileName, briefSha256 });
  }

  const verifierSources = ['README.md', 'gates.mjs', 'verify_demo.mjs', 'report.mjs'];
  for (const vFile of verifierSources) {
    const vPath = path.join(repoRoot, 'verify', vFile);
    if (!fs.existsSync(vPath)) {
      throw new Error(`Missing required verifier source file 'verify/${vFile}'`);
    }
  }

  const destExists = fs.existsSync(outDir);
  if (destExists && !options.force) {
    const contents = fs.readdirSync(outDir);
    if (contents.length > 0) {
      throw new Error(`Destination directory '${outDir}' is not empty. Use --force to overwrite benchmark-owned files.`);
    }
  }

  // Create staging directory in sibling location
  const parentDir = path.dirname(outDir);
  const stagingDir = path.join(
    parentDir,
    `.tmp-prepare-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
  );
  fs.mkdirSync(stagingDir, { recursive: true });

  let backupDir = null;

  try {
    // 1. If outDir exists, copy UNRELATED files/directories into staging
    const benchmarkOwnedNames = new Set(['BENCHMARK.md', 'case.json', 'review-template.json', 'bundle', ...allCaseIds]);

    if (destExists) {
      for (const child of fs.readdirSync(outDir)) {
        if (!benchmarkOwnedNames.has(child)) {
          copyRecursive(path.join(outDir, child), path.join(stagingDir, child));
        } else {
          // If child is a benchmark case directory, check if it contains unrelated files inside it
          const childPath = path.join(outDir, child);
          if (fs.statSync(childPath).isDirectory() && allCaseIds.has(child)) {
            const innerFiles = fs.readdirSync(childPath);
            const innerBenchmarkFiles = new Set(['case.json', 'review-template.json', 'bundle']);
            for (const inf of innerFiles) {
              if (!innerBenchmarkFiles.has(inf)) {
                // Copy unrelated file/folder inside case directory into staging
                const targetInnerDir = path.join(stagingDir, child);
                if (!fs.existsSync(targetInnerDir)) fs.mkdirSync(targetInnerDir, { recursive: true });
                copyRecursive(path.join(childPath, inf), path.join(targetInnerDir, inf));
              }
            }
          }
        }
      }
    }

    // 2. Write BENCHMARK.md in staging
    const benchmarkDocContent = `# Envizzle Benchmark Execution Guide

This directory contains deterministic tech demo benchmark cases for evaluating AI coding agents.

## Workflow

1. Select a benchmark case (e.g. \`dune-proven\` or \`alpine-signature\`).
2. Pass the generated brief in \`bundle/<PROJECT>_TECHDEMO_PROMPT.md\` to the target builder agent.
3. Once the builder agent completes implementation, run automated verification:
   \`\`\`bash
   node verify/verify_demo.mjs <project-dir> --report verify-report.json
   \`\`\`
4. (Optional) Complete a human visual & creativity review using \`review-template.json\`.
5. Collect the run result:
   \`\`\`bash
   node benchmark.mjs collect <project-dir> --case <case-id> --model <label> --attempt 1 --out result.json
   \`\`\`
6. Summarize results across runs:
   \`\`\`bash
   node benchmark.mjs summarize <results-dir> --out summary.md --json summary.json
   \`\`\`
`;
    fs.writeFileSync(path.join(stagingDir, 'BENCHMARK.md'), benchmarkDocContent, 'utf8');

    // 3. Write prepared benchmark cases in staging
    for (const b of preparedBundles) {
      const caseDir = path.join(stagingDir, b.caseDef.id);
      if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true });

      const caseJsonData = {
        schemaVersion: 1,
        caseId: b.caseDef.id,
        creativeMode: b.caseDef.creativeMode,
        baseShowcase: b.caseDef.baseShowcase,
        coverageNotes: b.caseDef.coverageNotes,
        briefSha256: b.briefSha256,
        expectedVerifierReport: 'verify-report.json',
        responsibilities: {
          automated: 'Run npm test and verify/verify_demo.mjs <project-dir>',
          humanReview: 'Optional visual and creative evaluation using review-template.json',
        },
      };
      fs.writeFileSync(path.join(caseDir, 'case.json'), JSON.stringify(caseJsonData, null, 2) + '\n', 'utf8');

      const reviewTemplateData = {
        reviewer: 'Reviewer Name',
        scores: {
          compositionReadability: 3,
          materialCoherence: 3,
          characterCraft: 3,
          mechanicLegibility: 3,
          creativeIdentity: 3,
          scopeDiscipline: 3,
        },
        notes: 'Optional feedback and visual notes.',
      };
      fs.writeFileSync(path.join(caseDir, 'review-template.json'), JSON.stringify(reviewTemplateData, null, 2) + '\n', 'utf8');

      const bundleDir = path.join(caseDir, 'bundle');
      writeBundle(b.spec, bundleDir, { rootDir: repoRoot, force: true });

      const handoffContent = `# Handoff Instructions for ${b.caseDef.title}

Implement the procedural tech demo specification described in \`${b.fileName}\`.

Your project must satisfy all required paths, build cleanly, expose \`window.__demo\` verification hooks, and satisfy all automated image & camera gates.
`;
      fs.writeFileSync(path.join(bundleDir, 'HANDOFF.md'), handoffContent, 'utf8');
    }

    // 4. Perform atomic swap into place
    if (destExists) {
      backupDir = path.join(parentDir, `.tmp-bak-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
      fs.renameSync(outDir, backupDir);
    }

    // Allow hook to inject an artificial failure of the final swap in regression tests.
    // Injected here (after the original was moved to backup, before staging is committed)
    // so the catch block's restore-from-backup path is genuinely exercised.
    if (options._testSwapFailure) {
      throw new Error('Injected preparation swap failure');
    }

    fs.renameSync(stagingDir, outDir);

    // Swap succeeded! Remove backup if created
    if (backupDir && fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  } catch (err) {
    // Rollback swap on failure!
    if (backupDir && fs.existsSync(backupDir)) {
      if (fs.existsSync(outDir)) {
        try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) {}
      }
      fs.renameSync(backupDir, outDir);
    }
    if (fs.existsSync(stagingDir)) {
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}
    }
    throw err;
  }
}

export function collectBenchmarkResult(projectDir, options = {}) {
  const caseDef = getBenchmarkCase(options.caseId);

  if (typeof options.model !== 'string' || options.model.trim() === '' || /[\r\n]/.test(options.model) || CONTROL_CHARS_REGEX.test(options.model)) {
    throw new Error('Model label must be a non-empty single-line string without control characters');
  }

  if (typeof options.attempt !== 'number' || !Number.isInteger(options.attempt) || options.attempt < 1) {
    throw new Error('Attempt must be a positive integer >= 1');
  }

  const projAbs = path.resolve(projectDir);
  if (!fs.existsSync(projAbs)) {
    throw new Error(`Project directory '${projAbs}' does not exist`);
  }

  const projReal = fs.realpathSync(projAbs);
  const projName = path.basename(projReal);

  // 1. Locate case.json
  let candidateCasePaths = [
    path.join(projReal, 'case.json'),
    path.join(path.dirname(projReal), 'case.json'),
    path.join(projReal, '..', 'case.json'),
  ];
  let locatedCasePath = candidateCasePaths.find((p) => fs.existsSync(p));
  if (!locatedCasePath) {
    throw new Error(`case.json metadata file not found in or near project directory '${projReal}'`);
  }

  const caseMetaReal = fs.realpathSync(locatedCasePath);
  const preparedCaseDir = path.dirname(caseMetaReal);

  // case.json must be directly inside the prepared case directory (true by construction,
  // asserted defensively since preparedCaseDir is derived from it).
  if (path.dirname(caseMetaReal) !== preparedCaseDir) {
    throw new Error(`Path security violation: case.json '${caseMetaReal}' is not directly inside its prepared case directory`);
  }

  // Enforce path containment: project directory MUST remain inside prepared case directory!
  if (!isPathInside(preparedCaseDir, projReal)) {
    throw new Error(`Path security violation: project directory '${projReal}' resolves outside prepared case directory '${preparedCaseDir}'`);
  }

  let caseMeta;
  try {
    caseMeta = JSON.parse(fs.readFileSync(caseMetaReal, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse case.json metadata: ${err.message}`);
  }

  if (caseMeta.caseId !== caseDef.id) {
    throw new Error(`Case ID mismatch: expected '${caseDef.id}' but case.json metadata specified '${caseMeta.caseId}'`);
  }

  // 2. Locate generated prompt file
  const candidatePromptPaths = [
    path.join(projReal, 'bundle', `${caseDef.id}_TECHDEMO_PROMPT.md`),
    path.join(projReal, `${caseDef.id}_TECHDEMO_PROMPT.md`),
    path.join(preparedCaseDir, 'bundle', `${caseDef.id}_TECHDEMO_PROMPT.md`),
    path.join(preparedCaseDir, `${caseDef.id}_TECHDEMO_PROMPT.md`),
  ];

  let actualPromptPath = candidatePromptPaths.find((p) => fs.existsSync(p));
  if (!actualPromptPath) {
    const bundleDir = fs.existsSync(path.join(projReal, 'bundle')) ? path.join(projReal, 'bundle') : projReal;
    if (fs.existsSync(bundleDir)) {
      const files = fs.readdirSync(bundleDir).filter((f) => f.endsWith('_TECHDEMO_PROMPT.md'));
      if (files.length === 1) actualPromptPath = path.join(bundleDir, files[0]);
    }
  }

  if (!actualPromptPath || !fs.existsSync(actualPromptPath)) {
    throw new Error(`Generated techdemo prompt brief file not found for project '${projReal}'`);
  }

  const actualPromptReal = fs.realpathSync(actualPromptPath);
  if (!isPathInside(preparedCaseDir, actualPromptReal)) {
    throw new Error(`Path security violation: prompt file '${actualPromptReal}' resolves outside prepared case directory '${preparedCaseDir}'`);
  }

  // 3. Compute prompt byte hash
  const actualPromptBytes = fs.readFileSync(actualPromptReal);
  const actualPromptSha256 = crypto.createHash('sha256').update(actualPromptBytes).digest('hex');

  // 4. Compute canonical expected SHA-256 for case
  const spec = buildCaseAssemblySpec(caseDef.id);
  const { brief: canonicalBrief } = assembleBrief(spec, { rootDir: repoRoot });
  const canonicalSha256 = computeSha256(canonicalBrief);

  // Enforce SHA-256 bindings!
  if (caseMeta.briefSha256 !== actualPromptSha256) {
    throw new Error(`Prompt byte hash mismatch: case.json expected hash '${caseMeta.briefSha256}' but actual prompt file hash was '${actualPromptSha256}'`);
  }
  if (actualPromptSha256 !== canonicalSha256) {
    throw new Error(`Canonical brief hash mismatch: actual prompt hash '${actualPromptSha256}' does not match canonical benchmark brief hash '${canonicalSha256}'`);
  }

  // 5. Check verifier report
  const reportPath = path.join(projReal, 'verify-report.json');
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Verification report file '${reportPath}' not found`);
  }

  // Report must genuinely resolve inside the project directory after realpath resolution,
  // guarding against a symlinked verify-report.json escaping the sandboxed project directory.
  const reportReal = fs.realpathSync(reportPath);
  if (!isPathInside(projReal, reportReal)) {
    throw new Error(`Path security violation: report file '${reportReal}' resolves outside project directory '${projReal}'`);
  }

  let rawReport;
  try {
    rawReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse report JSON: ${err.message}`);
  }

  const valReport = validateVerificationReport(rawReport);
  if (!valReport.valid) {
    throw new Error(`Invalid verification report: ${valReport.errors.join('; ')}`);
  }

  // Enforce report benchmark identity binding!
  if (!rawReport.benchmark || typeof rawReport.benchmark !== 'object') {
    throw new Error('Report benchmark identity is missing or null. Verification report must be generated for a benchmark run.');
  }

  if (rawReport.benchmark.caseId !== caseDef.id) {
    throw new Error(`Report benchmark case ID mismatch: report specifies '${rawReport.benchmark.caseId}' but collect requested case '${caseDef.id}'`);
  }

  if (rawReport.benchmark.briefSha256 !== caseMeta.briefSha256) {
    throw new Error(`Report benchmark hash mismatch: report specifies briefSha256 '${rawReport.benchmark.briefSha256}' but case.json specifies '${caseMeta.briefSha256}'`);
  }

  if (rawReport.benchmark.briefSha256 !== actualPromptSha256) {
    throw new Error(`Report benchmark hash mismatch: report specifies briefSha256 '${rawReport.benchmark.briefSha256}' but prompt file hash was '${actualPromptSha256}'`);
  }

  if (rawReport.benchmark.briefSha256 !== canonicalSha256) {
    throw new Error(`Report benchmark hash mismatch: report specifies briefSha256 '${rawReport.benchmark.briefSha256}' but canonical brief hash was '${canonicalSha256}'`);
  }

  // Enforce report target binding
  if (rawReport.target !== projName) {
    throw new Error(`Report target mismatch: verify-report.json target is '${rawReport.target}' but project directory basename is '${projName}'`);
  }

  let humanReview = null;
  if (options.reviewPath) {
    if (!fs.existsSync(options.reviewPath)) {
      throw new Error(`Review file '${options.reviewPath}' not found`);
    }
    let rawReview;
    try {
      rawReview = JSON.parse(fs.readFileSync(options.reviewPath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse review JSON: ${err.message}`);
    }

    const valRev = validateHumanReview(rawReview);
    if (!valRev.valid) {
      throw new Error(`Invalid submitted human review: ${valRev.errors.join('; ')}`);
    }

    const scores = {
      compositionReadability: rawReview.scores.compositionReadability,
      materialCoherence: rawReview.scores.materialCoherence,
      characterCraft: rawReview.scores.characterCraft,
      mechanicLegibility: rawReview.scores.mechanicLegibility,
      creativeIdentity: rawReview.scores.creativeIdentity,
      scopeDiscipline: rawReview.scores.scopeDiscipline,
    };

    humanReview = {
      reviewer: String(rawReview.reviewer).trim(),
      scores,
      visualAverage: computeVisualAverage(scores),
      notes: typeof rawReview.notes === 'string' ? rawReview.notes.trim() : null,
    };
  }

  const isPassed = rawReport.status === 'passed' && rawReport.gates?.pass === true && rawReport.build?.ok === true;

  const normalizedResult = {
    schemaVersion: 1,
    caseId: caseDef.id,
    modelLabel: options.model.trim(),
    attempt: options.attempt,
    briefSha256: actualPromptSha256,
    automated: {
      status: rawReport.status,
      pass: isPassed,
      hardGateFailures: rawReport.gates?.failures || [],
      hardGateFailureCount: (rawReport.gates?.failures || []).length,
      metrics: rawReport.gates?.metrics || { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: null, p99Ms: null, samples: null } },
    },
    humanReview,
    eligible: isPassed,
  };

  const valRes = validateBenchmarkResult(normalizedResult);
  if (!valRes.valid) {
    throw new Error(`Constructed result failed validation: ${valRes.errors.join('; ')}`);
  }

  if (options.outPath) {
    const outAbs = path.resolve(options.outPath);
    if (fs.existsSync(outAbs) && !options.force) {
      throw new Error(`Output file '${outAbs}' already exists. Use --force to overwrite.`);
    }
    const outDir = path.dirname(outAbs);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const tmpOut = path.join(outDir, `.tmp-res-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.json`);
    try {
      fs.writeFileSync(tmpOut, JSON.stringify(normalizedResult, null, 2) + '\n', 'utf8');
      fs.renameSync(tmpOut, outAbs);
    } catch (err) {
      if (fs.existsSync(tmpOut)) {
        try { fs.unlinkSync(tmpOut); } catch (_) {}
      }
      throw err;
    }
  }

  return normalizedResult;
}

export function summarizeBenchmarkResults(resultsDir, options = {}) {
  if (!fs.existsSync(resultsDir)) {
    throw new Error(`Results directory '${resultsDir}' does not exist`);
  }

  if (!options.outPath) {
    throw new Error('summarizeBenchmarkResults requires options.outPath');
  }

  const outMdAbs = path.resolve(options.outPath);
  const outJsonAbs = options.jsonPath ? path.resolve(options.jsonPath) : null;

  if (outJsonAbs && outMdAbs === outJsonAbs) {
    throw new Error('Markdown and JSON destinations cannot resolve to the same file path');
  }

  // Collision preflight check
  if (fs.existsSync(outMdAbs) && !options.force) {
    throw new Error(`Summary Markdown destination file '${outMdAbs}' already exists. Use --force to overwrite.`);
  }
  if (outJsonAbs && fs.existsSync(outJsonAbs) && !options.force) {
    throw new Error(`Summary JSON destination file '${outJsonAbs}' already exists. Use --force to overwrite.`);
  }

  const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(`No JSON result files found in '${resultsDir}'`);
  }

  const results = [];
  for (const f of files) {
    const fullPath = path.join(resultsDir, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse result file '${f}': ${err.message}`);
    }

    // Skip summary JSON files
    if (isPlainObject(data) && Array.isArray(data.results) && typeof data.totalRuns === 'number') {
      continue;
    }

    const val = validateBenchmarkResult(data);
    if (!val.valid) {
      throw new Error(`Result file '${f}' failed validation: ${val.errors.join('; ')}`);
    }

    results.push(data);
  }

  if (results.length === 0) {
    throw new Error(`No valid benchmark result files found in '${resultsDir}'`);
  }

  // Sort results deterministically by case registry order, modelLabel, attempt
  const caseOrderMap = new Map();
  BENCHMARK_CASES.forEach((c, idx) => caseOrderMap.set(c.id, idx));

  results.sort((a, b) => {
    const idxA = caseOrderMap.has(a.caseId) ? caseOrderMap.get(a.caseId) : 999;
    const idxB = caseOrderMap.has(b.caseId) ? caseOrderMap.get(b.caseId) : 999;
    if (idxA !== idxB) return idxA - idxB;
    const mCmp = a.modelLabel.localeCompare(b.modelLabel);
    if (mCmp !== 0) return mCmp;
    return a.attempt - b.attempt;
  });

  // Build Markdown table
  let md = `# Benchmark Comparison Summary\n\n`;
  md += `| Case | Model | Attempt | Automated | Failures | Lum / Flat (idle) | Frame Stats (info) | Scores (C/M/Ch/Me/Cr/S) | Visual Avg | Eligible |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :--- | :--- | :---: | :---: | :---: |\n`;

  const failureDetails = [];
  const reviewerNotes = [];

  for (const r of results) {
    const autoStatus = r.automated?.pass ? 'PASSED' : 'FAILED';
    const failCount = r.automated?.hardGateFailureCount ?? 0;
    const eligibleText = r.eligible ? 'YES' : 'NO';

    const idleFrame = r.automated?.metrics?.frames?.find((f) => f.name === 'idle');
    const lumText = idleFrame?.meanLuminance !== null && idleFrame?.meanLuminance !== undefined
      ? idleFrame.meanLuminance.toFixed(2)
      : '-';
    const flatText = idleFrame?.flatFrameRatio !== null && idleFrame?.flatFrameRatio !== undefined
      ? (idleFrame.flatFrameRatio * 100).toFixed(0) + '%'
      : '-';
    const metricsStr = `${lumText} / ${flatText}`;

    const fsStats = r.automated?.metrics?.frameStats;
    const perfStr = (fsStats?.medianMs !== null && fsStats?.medianMs !== undefined && fsStats?.p99Ms !== null && fsStats?.p99Ms !== undefined)
      ? `${fsStats.medianMs}/${fsStats.p99Ms} ms (info)`
      : '-';

    let scoresStr = '-';
    let avgStr = '-';
    if (r.humanReview && r.humanReview.scores) {
      const s = r.humanReview.scores;
      scoresStr = `${s.compositionReadability}/${s.materialCoherence}/${s.characterCraft}/${s.mechanicLegibility}/${s.creativeIdentity}/${s.scopeDiscipline}`;
      avgStr = r.humanReview.visualAverage !== undefined ? r.humanReview.visualAverage.toFixed(2) : '-';

      if (r.humanReview.notes) {
        reviewerNotes.push({
          key: `${r.caseId} — ${r.modelLabel} (attempt ${r.attempt})`,
          reviewer: r.humanReview.reviewer,
          notes: r.humanReview.notes,
        });
      }
    }

    md += `| \`${r.caseId}\` | ${r.modelLabel} | ${r.attempt} | ${autoStatus} | ${failCount} | ${metricsStr} | ${perfStr} | ${scoresStr} | ${avgStr} | ${eligibleText} |\n`;

    if (r.automated?.hardGateFailures && r.automated.hardGateFailures.length > 0) {
      failureDetails.push({
        key: `${r.caseId} — ${r.modelLabel} (attempt ${r.attempt})`,
        failures: r.automated.hardGateFailures,
      });
    }
  }

  if (failureDetails.length > 0) {
    md += `\n## Hard Gate Failure Details\n\n`;
    for (const d of failureDetails) {
      md += `### ${d.key}\n`;
      for (const f of d.failures) {
        md += `- ${f}\n`;
      }
      md += `\n`;
    }
  }

  if (reviewerNotes.length > 0) {
    md += `## Reviewer Notes\n\n`;
    for (const n of reviewerNotes) {
      md += `### ${n.key} (${n.reviewer})\n`;
      md += `> ${n.notes}\n\n`;
    }
  }

  const summaryJsonData = outJsonAbs
    ? {
        schemaVersion: 1,
        totalRuns: results.length,
        eligibleRuns: results.filter((r) => r.eligible).length,
        results,
      }
    : null;

  // Transactional staging write & atomic commit with rollback safety
  const outDir = path.dirname(outMdAbs);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const tmpMdPath = path.join(outDir, `.tmp-summary-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.md`);
  const tmpJsonPath = outJsonAbs
    ? path.join(path.dirname(outJsonAbs), `.tmp-summary-json-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.json`)
    : null;

  const mdBak = outMdAbs + `.bak-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const jsonBak = outJsonAbs ? outJsonAbs + `.bak-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` : null;

  let mdCommitted = false;
  let jsonCommitted = false;

  try {
    fs.writeFileSync(tmpMdPath, md, 'utf8');
    if (outJsonAbs && tmpJsonPath && summaryJsonData) {
      const jsonDir = path.dirname(outJsonAbs);
      if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });
      fs.writeFileSync(tmpJsonPath, JSON.stringify(summaryJsonData, null, 2) + '\n', 'utf8');
    }

    // Create backups if force overwriting
    if (fs.existsSync(outMdAbs)) {
      fs.copyFileSync(outMdAbs, mdBak);
    }
    if (outJsonAbs && fs.existsSync(outJsonAbs)) {
      fs.copyFileSync(outJsonAbs, jsonBak);
    }

    // Commit 1: rename Markdown
    fs.renameSync(tmpMdPath, outMdAbs);
    mdCommitted = true;

    // Hook for regression test: inject second rename failure
    if (options._testSecondRenameFailure) {
      throw new Error('Injected second rename failure');
    }

    // Commit 2: rename JSON (if requested)
    if (outJsonAbs && tmpJsonPath) {
      fs.renameSync(tmpJsonPath, outJsonAbs);
      jsonCommitted = true;
    }

    // Success! Remove backups
    if (fs.existsSync(mdBak)) fs.unlinkSync(mdBak);
    if (jsonBak && fs.existsSync(jsonBak)) fs.unlinkSync(jsonBak);
  } catch (err) {
    // Transaction failed! Rollback all committed files
    if (mdCommitted) {
      if (fs.existsSync(mdBak)) {
        fs.renameSync(mdBak, outMdAbs);
      } else {
        try { fs.unlinkSync(outMdAbs); } catch (_) {}
      }
    }
    if (jsonCommitted && jsonBak) {
      if (fs.existsSync(jsonBak)) {
        fs.renameSync(jsonBak, outJsonAbs);
      } else {
        try { fs.unlinkSync(outJsonAbs); } catch (_) {}
      }
    }

    // Clean temp and backup files
    if (fs.existsSync(tmpMdPath)) try { fs.unlinkSync(tmpMdPath); } catch (_) {}
    if (tmpJsonPath && fs.existsSync(tmpJsonPath)) try { fs.unlinkSync(tmpJsonPath); } catch (_) {}
    if (fs.existsSync(mdBak)) try { fs.unlinkSync(mdBak); } catch (_) {}
    if (jsonBak && fs.existsSync(jsonBak)) try { fs.unlinkSync(jsonBak); } catch (_) {}

    throw err;
  }

  return { markdown: md, json: summaryJsonData, results };
}

// Executable CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let parsed;
  try {
    parsed = parseBenchmarkCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    printBenchmarkHelp();
    process.exit(2);
  }

  if (parsed.command === 'help') {
    printBenchmarkHelp();
    process.exit(0);
  }

  if (parsed.command === 'list') {
    if (parsed.json) {
      console.log(JSON.stringify(BENCHMARK_CASES, null, 2));
    } else {
      console.log('Benchmark Cases:');
      BENCHMARK_CASES.forEach((c) => {
        console.log(`  - ${c.id}: ${c.title} [suites: ${c.suites.join(', ')}]`);
      });
    }
    process.exit(0);
  }

  if (parsed.command === 'prepare') {
    try {
      prepareBenchmark(parsed.outDir, {
        suite: parsed.suite,
        caseId: parsed.caseId,
        force: parsed.force,
      });
      console.log(`Successfully prepared benchmark bundles in '${parsed.outDir}'`);
      process.exit(0);
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      process.exit(2);
    }
  }

  if (parsed.command === 'collect') {
    try {
      const res = collectBenchmarkResult(parsed.projectDir, {
        caseId: parsed.caseId,
        model: parsed.model,
        attempt: parsed.attempt,
        outPath: parsed.outPath,
        reviewPath: parsed.reviewPath,
        force: parsed.force,
      });
      console.log(`Successfully collected benchmark result for '${parsed.caseId}' (eligible: ${res.eligible})`);
      process.exit(res.automated.pass ? 0 : 1);
    } catch (err) {
      if (err.message.includes('Invalid') || err.message.includes('not found') || err.message.includes('failed to parse')) {
        console.log(JSON.stringify({ error: err.message, status: 'error' }, null, 2));
        process.exit(1);
      }
      console.error(`ERROR: ${err.message}`);
      process.exit(2);
    }
  }

  if (parsed.command === 'summarize') {
    try {
      summarizeBenchmarkResults(parsed.resultsDir, {
        outPath: parsed.outPath,
        jsonPath: parsed.jsonPath,
        force: parsed.force,
      });
      console.log(`Successfully generated benchmark summary in '${parsed.outPath}'`);
      process.exit(0);
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      process.exit(2);
    }
  }
}
