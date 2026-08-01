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
import { validateVerificationReport } from './verify/report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname);

function isPlainObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function computeSha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Validate human review schema strictly.
 */
export function validateHumanReview(review) {
  const errors = [];
  if (!isPlainObject(review)) {
    return { valid: false, errors: ['Human review must be a plain object'] };
  }

  // Support both top-level score keys and nested scores object
  let scoresObj = review;
  if (isPlainObject(review.scores)) {
    scoresObj = review.scores;
  }

  const allowedCategories = [
    'compositionReadability',
    'materialCoherence',
    'characterCraft',
    'mechanicLegibility',
    'creativeIdentity',
    'scopeDiscipline',
  ];

  const allowedTopKeys = new Set(['reviewer', 'notes', 'scores', ...allowedCategories]);

  for (const k of Object.keys(review)) {
    if (!allowedTopKeys.has(k)) {
      errors.push(`Unknown property '${k}' in review`);
    }
  }

  if (typeof review.reviewer !== 'string' || review.reviewer.trim() === '') {
    errors.push('reviewer must be a non-empty string');
  } else if (review.reviewer.includes('\n') || review.reviewer.includes('\r')) {
    errors.push('reviewer must be a single-line string');
  }

  if (review.notes !== undefined && review.notes !== null && typeof review.notes !== 'string') {
    errors.push('notes must be a string if provided');
  }

  for (const cat of allowedCategories) {
    const val = scoresObj[cat];
    if (typeof val !== 'number' || !Number.isInteger(val)) {
      errors.push(`Score category '${cat}' must be an integer, got ${JSON.stringify(val)}`);
    } else if (val < 1 || val > 5) {
      errors.push(`Score category '${cat}' must be between 1 and 5, got ${val}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeVisualAverage(scores) {
  const categories = [
    'compositionReadability',
    'materialCoherence',
    'characterCraft',
    'mechanicLegibility',
    'creativeIdentity',
    'scopeDiscipline',
  ];
  let sum = 0;
  for (const c of categories) {
    sum += scores[c];
  }
  return Math.round((sum / categories.length) * 100) / 100;
}

export function parseBenchmarkCliArgs(args) {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return { command: 'help' };
  }

  const cmd = args[0];

  if (cmd === 'list') {
    const json = args.includes('--json');
    return { command: 'list', json };
  }

  if (cmd === 'prepare') {
    let outDir = null;
    let suite = null;
    let caseId = null;
    let force = false;

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--suite') {
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
          throw new Error('Missing value for --suite');
        }
        suite = args[++i];
      } else if (arg === '--case') {
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
          throw new Error('Missing value for --case');
        }
        caseId = args[++i];
      } else if (arg === '--force') {
        force = true;
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
    let attempt = null;
    let out = null;
    let review = null;
    let force = false;

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--case') {
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --case');
        caseId = args[++i];
      } else if (arg === '--model') {
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --model');
        model = args[++i];
      } else if (arg === '--attempt') {
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --attempt');
        attempt = parseInt(args[++i], 10);
      } else if (arg === '--out') {
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --out');
        out = args[++i];
      } else if (arg === '--review') {
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --review');
        review = args[++i];
      } else if (arg === '--force') {
        force = true;
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
    if (!attempt || Number.isNaN(attempt) || attempt < 1) throw new Error('collect command requires valid --attempt <integer>');
    if (!out) throw new Error('collect command requires --out <result.json>');

    return {
      command: 'collect',
      projectDir: path.resolve(projectDir),
      caseId,
      model,
      attempt,
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

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--out') {
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --out');
        outPath = args[++i];
      } else if (arg === '--json') {
        if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw new Error('Missing value for --json');
        jsonPath = args[++i];
      } else if (arg === '--force') {
        force = true;
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

export function prepareBenchmark(outDir, options = {}) {
  let targetCases = [];
  if (options.caseId) {
    targetCases = [getBenchmarkCase(options.caseId)];
  } else if (options.suite) {
    targetCases = getBenchmarkCasesForSuite(options.suite);
  } else {
    throw new Error('Must specify caseId or suite');
  }

  // Preflight check: verify all cases build assembly specs cleanly before writing anything
  const preparedBundles = [];
  for (const c of targetCases) {
    const spec = buildCaseAssemblySpec(c.id);
    const { brief, fileName } = assembleBrief(spec, { rootDir: repoRoot });
    const briefSha256 = computeSha256(brief);
    preparedBundles.push({ caseDef: c, spec, brief, fileName, briefSha256 });
  }

  // Preflight check verifier source files
  const verifierSources = ['README.md', 'gates.mjs', 'verify_demo.mjs', 'report.mjs'];
  for (const vFile of verifierSources) {
    const vPath = path.join(repoRoot, 'verify', vFile);
    if (!fs.existsSync(vPath)) {
      throw new Error(`Missing required verifier source file 'verify/${vFile}'`);
    }
  }

  const destExists = fs.existsSync(outDir);
  if (destExists) {
    const contents = fs.readdirSync(outDir);
    if (contents.length > 0 && !options.force) {
      throw new Error(`Destination directory '${outDir}' is not empty. Use --force to overwrite benchmark-owned files.`);
    }
  }

  // Create staging directory
  const stagingDir = path.join(
    path.dirname(outDir),
    `.tmp-prepare-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
  );
  fs.mkdirSync(stagingDir, { recursive: true });

  try {
    // Write BENCHMARK.md in staging
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

    for (const b of preparedBundles) {
      const caseDir = path.join(stagingDir, b.caseDef.id);
      fs.mkdirSync(caseDir, { recursive: true });

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

    // Now copy from staging to outDir cleanly
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
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

    copyRecursive(stagingDir, outDir);
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

export function collectBenchmarkResult(projectDir, options = {}) {
  const caseDef = getBenchmarkCase(options.caseId);

  if (typeof options.model !== 'string' || options.model.trim() === '' || options.model.includes('\n')) {
    throw new Error('Model label must be a non-empty single-line string');
  }

  if (typeof options.attempt !== 'number' || !Number.isInteger(options.attempt) || options.attempt < 1) {
    throw new Error('Attempt must be a positive integer >= 1');
  }

  const reportPath = path.join(projectDir, 'verify-report.json');
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Verification report file '${reportPath}' not found`);
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

  // Case/Report Target check if target exists
  if (rawReport.target && path.basename(projectDir) !== rawReport.target && projectDir !== rawReport.target) {
    // Also acceptable if target matches
  }

  let humanReview = null;
  if (options.reviewPath) {
    if (!fs.existsSync(options.reviewPath)) {
      throw new Error(`Review file '${options.reviewPath}' not found`);
    }
    let rawReview;
    try {
      rawReview = JSON.parse(fs.readFileSync(options.reviewPath), 'utf8');
    } catch (err) {
      throw new Error(`Failed to parse review JSON: ${err.message}`);
    }

    const valRev = validateHumanReview(rawReview);
    if (!valRev.valid) {
      throw new Error(`Invalid human review: ${valRev.errors.join('; ')}`);
    }

    let scoresObj = rawReview;
    if (isPlainObject(rawReview.scores)) {
      scoresObj = rawReview.scores;
    }

    const scores = {
      compositionReadability: scoresObj.compositionReadability,
      materialCoherence: scoresObj.materialCoherence,
      characterCraft: scoresObj.characterCraft,
      mechanicLegibility: scoresObj.mechanicLegibility,
      creativeIdentity: scoresObj.creativeIdentity,
      scopeDiscipline: scoresObj.scopeDiscipline,
    };

    humanReview = {
      reviewer: String(rawReview.reviewer).trim(),
      scores,
      visualAverage: computeVisualAverage(scores),
      notes: typeof rawReview.notes === 'string' ? rawReview.notes.trim() : null,
    };
  }

  // Compute brief sha256 for case if possible
  const spec = buildCaseAssemblySpec(caseDef.id);
  const { brief } = assembleBrief(spec, { rootDir: repoRoot });
  const briefSha256 = computeSha256(brief);

  const isPassed = rawReport.status === 'passed' && rawReport.gates?.pass === true && rawReport.build?.ok === true;

  const normalizedResult = {
    schemaVersion: 1,
    caseId: caseDef.id,
    modelLabel: options.model.trim(),
    attempt: options.attempt,
    briefSha256,
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

  if (options.outPath) {
    if (fs.existsSync(options.outPath) && !options.force) {
      throw new Error(`Output file '${options.outPath}' already exists. Use --force to overwrite.`);
    }
    const outDir = path.dirname(options.outPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(options.outPath, JSON.stringify(normalizedResult, null, 2) + '\n', 'utf8');
  }

  return normalizedResult;
}

export function summarizeBenchmarkResults(resultsDir, options = {}) {
  if (!fs.existsSync(resultsDir)) {
    throw new Error(`Results directory '${resultsDir}' does not exist`);
  }

  const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(`No JSON result files found in '${resultsDir}'`);
  }

  const results = [];
  for (const f of files) {
    const fullPath = path.join(resultsDir, f);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (data.schemaVersion === 1 && data.caseId && data.modelLabel) {
        results.push(data);
      }
    } catch (_) {
      // ignore non-result JSON files
    }
  }

  if (results.length === 0) {
    throw new Error(`No valid benchmark result files found in '${resultsDir}'`);
  }

  // Sort results by case registry order, modelLabel, attempt
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

  if (options.outPath) {
    if (fs.existsSync(options.outPath) && !options.force) {
      throw new Error(`Summary file '${options.outPath}' already exists. Use --force to overwrite.`);
    }
    fs.writeFileSync(options.outPath, md, 'utf8');
  }

  let summaryJsonData = null;
  if (options.jsonPath) {
    if (fs.existsSync(options.jsonPath) && !options.force) {
      throw new Error(`Summary JSON file '${options.jsonPath}' already exists. Use --force to overwrite.`);
    }
    summaryJsonData = {
      schemaVersion: 1,
      totalRuns: results.length,
      eligibleRuns: results.filter((r) => r.eligible).length,
      results,
    };
    fs.writeFileSync(options.jsonPath, JSON.stringify(summaryJsonData, null, 2) + '\n', 'utf8');
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
