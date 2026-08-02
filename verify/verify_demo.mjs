import { execSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { evaluateGates } from './gates.mjs';
import { createVerificationReport, writeVerificationReport } from './report.mjs';
import {
  validateBuildContractStandalone,
  validateEvidenceStandalone,
  validateEvidenceContractBinding,
} from './contractSchema.mjs';
import { scanForForbiddenPatterns } from './patternScan.mjs';

const REQUIRED_PATHS = Object.freeze([
  'index.html',
  'package.json',
  'vite.config.js',
  'DECISIONS.md',
  'PERF.md',
  'src/main.js',
]);

const ALLOWED_BROWSER_CHANNELS = Object.freeze(['chrome']);

// Mirrors contractSchema.mjs's (unexported) RENDERER_INFO_BY_PROFILE backend/shaderLanguage
// tuple. Small/stable/2-entry, so it is vendored locally rather than exporting a private
// const across module boundaries — same tradeoff contractSchema.mjs itself documents.
const RENDERER_TUPLE_BY_PROFILE = Object.freeze({
  'babylon-webgpu': { backend: 'webgpu', shaderLanguage: 'wgsl' },
  'three-webgl2': { backend: 'webgl2', shaderLanguage: 'glsl-es-300' },
});

const RENDERER_INFO_KEYS = Object.freeze(['backend', 'shaderLanguage', 'materialsReady', 'renderedFrames', 'validationErrors']);
const TERRAIN_DIAGNOSTICS_KEYS = Object.freeze(['renderOwner', 'renderMeshBaseHeight', 'parityMethod', 'paritySamples', 'parityMaxErrorM']);
const MIN_PARITY_SAMPLES = 8;
const TERRAIN_PARITY_MAX_ERROR_M = 0.03;

const EVIDENCE_INCOMPLETE_MESSAGE = 'incomplete verification: milestone or stage evidence is not complete';

// GPU-validation blocking-concept matcher (verbatim keyword list, global-constraints.md
// "GPU validation blocking-concept matcher"). Case-insensitive substring match. Everything
// that doesn't match one of these stays informational — it is recorded but never fails a run.
const BLOCKING_GPU_KEYWORDS = Object.freeze([
  'gpuvalidationerror',
  'duplicate binding',
  'bind group',
  'pipeline creation',
  'shader compilation',
  'material compilation',
  'adapter unavailable',
  'backend fallback',
  'webgpu initialization failure',
  'device lost',
  'missing vertex buffer',
  'incompatible vertex input',
  'incompatible varying',
  'incompatible output structure',
  'invalid entry point',
]);

/** Case-insensitive keyword match against the exact Global Constraints blocking list. */
export function isBlockingGpuMessage(text) {
  if (typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  if (lower.includes('uncaptured') && lower.includes('error')) return true;
  return BLOCKING_GPU_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Strict runtime validation for the terrain ownership/parity proof consumed by camera gates. */
function validateTerrainDiagnostics(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['window.__demo.terrainDiagnostics() must return an object.'];
  }

  const actualKeys = Object.keys(value);
  const missingKeys = TERRAIN_DIAGNOSTICS_KEYS.filter((key) => !actualKeys.includes(key));
  const unknownKeys = actualKeys.filter((key) => !TERRAIN_DIAGNOSTICS_KEYS.includes(key));
  if (missingKeys.length > 0 || unknownKeys.length > 0) {
    errors.push(`window.__demo.terrainDiagnostics() has the wrong keys — missing [${missingKeys.join(', ')}], unknown [${unknownKeys.join(', ')}].`);
  }

  if (value.renderOwner !== 'gpu') {
    errors.push(`window.__demo.terrainDiagnostics().renderOwner is ${JSON.stringify(value.renderOwner)}, expected "gpu".`);
  }
  if (typeof value.renderMeshBaseHeight !== 'number' || !Number.isFinite(value.renderMeshBaseHeight) || value.renderMeshBaseHeight !== 0) {
    errors.push(`window.__demo.terrainDiagnostics().renderMeshBaseHeight is ${JSON.stringify(value.renderMeshBaseHeight)}, expected the flat render-mesh base height 0 (CPU pre-displacement is forbidden).`);
  }
  if (value.parityMethod !== 'gpu-readback') {
    errors.push(`window.__demo.terrainDiagnostics().parityMethod is ${JSON.stringify(value.parityMethod)}, expected "gpu-readback"; CPU-to-CPU parity is not proof of GPU parity.`);
  }
  if (typeof value.paritySamples !== 'number' || !Number.isInteger(value.paritySamples) || value.paritySamples < MIN_PARITY_SAMPLES) {
    errors.push(`window.__demo.terrainDiagnostics().paritySamples is ${JSON.stringify(value.paritySamples)}, expected an integer >= ${MIN_PARITY_SAMPLES}.`);
  }
  if (typeof value.parityMaxErrorM !== 'number' || !Number.isFinite(value.parityMaxErrorM) || value.parityMaxErrorM < 0 || value.parityMaxErrorM > TERRAIN_PARITY_MAX_ERROR_M) {
    errors.push(`window.__demo.terrainDiagnostics().parityMaxErrorM is ${JSON.stringify(value.parityMaxErrorM)}, expected a finite value in [0, ${TERRAIN_PARITY_MAX_ERROR_M}] m.`);
  }
  return errors;
}
export function parseVerifyCliArgs(args) {
  let projectDir = null;
  let reportPath = null;
  let screenshotsDir = null;
  let help = false;
  let browserChannel = null;
  let headed = false;

  const seenFlags = new Set();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      if (seenFlags.has('help')) throw new Error('Duplicate option --help');
      seenFlags.add('help');
      help = true;
    } else if (arg === '--report') {
      if (seenFlags.has('report')) throw new Error('Duplicate option --report');
      seenFlags.add('report');
      if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
        throw new Error('Missing path for --report option');
      }
      reportPath = args[++i];
    } else if (arg === '--screenshots') {
      if (seenFlags.has('screenshots')) throw new Error('Duplicate option --screenshots');
      seenFlags.add('screenshots');
      if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
        throw new Error('Missing directory for --screenshots option');
      }
      screenshotsDir = args[++i];
    } else if (arg === '--browser-channel') {
      if (seenFlags.has('browserChannel')) throw new Error('Duplicate option --browser-channel');
      seenFlags.add('browserChannel');
      if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
        throw new Error('Missing name for --browser-channel option');
      }
      const value = args[++i];
      if (!ALLOWED_BROWSER_CHANNELS.includes(value)) {
        throw new Error(`Unsupported --browser-channel '${value}'. Allowed values: ${ALLOWED_BROWSER_CHANNELS.join(', ')}`);
      }
      browserChannel = value;
    } else if (arg === '--headed') {
      if (seenFlags.has('headed')) throw new Error('Duplicate option --headed');
      seenFlags.add('headed');
      headed = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option '${arg}'`);
    } else {
      if (projectDir !== null) {
        throw new Error(`Unexpected positional argument '${arg}'`);
      }
      projectDir = arg;
    }
  }

  if (help) {
    if (args.length > 1) {
      throw new Error('Cannot combine --help with other arguments');
    }
    return { help: true };
  }

  const resolvedTarget = projectDir ? path.resolve(projectDir) : process.cwd();
  const resolvedReport = reportPath
    ? path.resolve(reportPath)
    : path.join(resolvedTarget, 'verify-report.json');
  const resolvedScreenshots = screenshotsDir
    ? path.resolve(screenshotsDir)
    : path.join(resolvedTarget, 'screenshots');

  return {
    help: false,
    projectDir: resolvedTarget,
    reportPath: resolvedReport,
    screenshotsDir: resolvedScreenshots,
    browserChannel,
    headed,
  };
}

export function printVerifyHelp() {
  console.log(`Envizzle Demo Verifier

Usage:
  node verify/verify_demo.mjs [project-directory] [options]

Options:
  --report <report.json>       Path to write machine-readable verification report (default: <project-directory>/verify-report.json)
  --screenshots <directory>   Directory to save captured PNG screenshots (default: <project-directory>/screenshots/)
  --browser-channel <name>    Launch a specific Chromium channel instead of the bundled build (allowed: chrome)
  --headed                    Launch the browser headed instead of headless
  --help, -h                  Show this help menu

Exit codes:
  0  Verification passed
  1  Verification failed
  2  Usage or operational error
`);
}

function toImage(buf) {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
}

function killTree(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    // Already dead
  }
  try {
    child.kill();
  } catch {
    // Already killed
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { method: 'GET' });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(
    `dev server at ${url} never accepted a connection within ${timeoutMs} ms (last error: ${lastErr?.message}). The demo's vite setup may be broken.`,
  );
}

function discoverBenchmarkContext(targetDir) {
  let caseJsonPath = path.join(targetDir, 'case.json');
  if (!fs.existsSync(caseJsonPath)) {
    caseJsonPath = path.join(path.dirname(targetDir), 'case.json');
  }
  if (!fs.existsSync(caseJsonPath)) {
    caseJsonPath = path.join(targetDir, '..', 'case.json');
  }

  if (!fs.existsSync(caseJsonPath)) {
    return null;
  }

  let caseMeta;
  try {
    caseMeta = JSON.parse(fs.readFileSync(caseJsonPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse case.json: ${err.message}`);
  }

  if (typeof caseMeta.caseId !== 'string' || typeof caseMeta.briefSha256 !== 'string') {
    throw new Error('case.json missing required caseId or briefSha256');
  }

  // Find prompt files ending in _TECHDEMO_PROMPT.md
  const candidateDirs = [targetDir, path.join(targetDir, 'bundle'), path.dirname(targetDir)];
  const candidatePromptPaths = new Set();

  for (const cd of candidateDirs) {
    if (fs.existsSync(cd) && fs.statSync(cd).isDirectory()) {
      for (const file of fs.readdirSync(cd)) {
        if (file.endsWith('_TECHDEMO_PROMPT.md')) {
          candidatePromptPaths.add(path.join(cd, file));
        }
      }
    }
  }

  const promptFiles = Array.from(candidatePromptPaths);
  if (promptFiles.length === 0) {
    throw new Error(`No techdemo prompt brief file found for benchmark case '${caseMeta.caseId}'`);
  }
  if (promptFiles.length > 1) {
    throw new Error(`Multiple candidate prompt brief files found for benchmark case '${caseMeta.caseId}': [${promptFiles.map((p) => path.basename(p)).join(', ')}]`);
  }

  const promptPath = promptFiles[0];
  const promptBytes = fs.readFileSync(promptPath);
  const actualHash = crypto.createHash('sha256').update(promptBytes).digest('hex');

  if (actualHash !== caseMeta.briefSha256) {
    throw new Error(`Prompt file hash mismatch: prompt file '${path.basename(promptPath)}' hash '${actualHash}' does not match case.json briefSha256 '${caseMeta.briefSha256}'`);
  }

  return {
    caseId: caseMeta.caseId,
    briefSha256: caseMeta.briefSha256,
  };
}

/** Reads and JSON.parses a file, never throwing — failures are reported as {data:null, error}. */
function loadJsonFile(filePath) {
  const base = path.basename(filePath);
  if (!fs.existsSync(filePath)) {
    return { data: null, error: `${base} not found in target directory` };
  }
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return { data: null, error: `Failed to read ${base}: ${err.message}` };
  }
  try {
    return { data: JSON.parse(raw), error: null };
  } catch (err) {
    return { data: null, error: `Failed to parse ${base} as JSON: ${err.message}` };
  }
}

/** SHA-256 of the actual brief file on disk named by contract.project.briefFilename, or null. */
function computeActualBriefSha256(targetDir, contract) {
  if (!contract || typeof contract !== 'object') return null;
  const project = contract.project;
  if (!project || typeof project.briefFilename !== 'string' || project.briefFilename.trim() === '') return null;
  const briefPath = path.join(targetDir, project.briefFilename);
  if (!fs.existsSync(briefPath)) return null;
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(briefPath)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Evidence final-pass gate (global-constraints.md "Evidence final-pass gate"). Verifier may
 * still run early and produce screenshots when evidence is incomplete — this function is only
 * ever consulted at the very end, to decide the FINAL pass/fail status. Whenever it rejects,
 * `reasons` always begins with the exact canonical incomplete-verification string so callers
 * can surface it verbatim regardless of which specific sub-condition tripped.
 */
function evaluateEvidenceFinalGate({
  contract,
  contractValidation,
  evidence,
  evidenceValidation,
  actualBriefSha256,
  writtenCaptures,
  shotDir,
  blockingConsoleErrors,
}) {
  const reasons = [];

  if (!contract) {
    reasons.push('ENVIZZLE_BUILD.json is missing');
  } else if (!contractValidation.valid) {
    reasons.push(`ENVIZZLE_BUILD.json failed validation: ${contractValidation.errors.join('; ')}`);
  }

  if (!evidence) {
    reasons.push('ENVIZZLE_EVIDENCE.json is missing');
  } else if (!evidenceValidation.valid) {
    reasons.push(`ENVIZZLE_EVIDENCE.json failed validation: ${evidenceValidation.errors.join('; ')}`);
  } else if (evidence.status !== 'complete') {
    reasons.push(`evidence.status is '${evidence.status}', not complete`);
  }

  if (contract && evidence) {
    const bindingValidation = validateEvidenceContractBinding(contract, evidence);
    if (!bindingValidation.valid) {
      reasons.push(`evidence/contract binding failed: ${bindingValidation.errors.join('; ')}`);
    }
  }

  const contractBriefSha = contract && contract.project ? contract.project.briefSha256 : undefined;
  const evidenceBriefSha = evidence ? evidence.briefSha256 : undefined;
  const allHashesPresent =
    typeof contractBriefSha === 'string' && typeof evidenceBriefSha === 'string' && typeof actualBriefSha256 === 'string';
  if (!allHashesPresent || contractBriefSha !== evidenceBriefSha || evidenceBriefSha !== actualBriefSha256) {
    reasons.push('evidence.briefSha256, contract.project.briefSha256, and the actual brief file hash do not all match');
  }

  if (evidence && Array.isArray(evidence.milestones)) {
    for (const milestone of evidence.milestones) {
      if (!milestone || typeof milestone !== 'object' || !Array.isArray(milestone.screenshots)) continue;
      for (const shot of milestone.screenshots) {
        if (!writtenCaptures.includes(shot)) {
          reasons.push(`screenshot '${shot}' listed in evidence milestone '${milestone.id}' was not generated by this verification run`);
        } else if (!fs.existsSync(path.join(shotDir, shot))) {
          reasons.push(`screenshot '${shot}' listed in evidence milestone '${milestone.id}' does not exist on disk`);
        }
      }
    }
  }

  if (blockingConsoleErrors.length > 0) {
    reasons.push(`blocking console/GPU-validation errors present: ${blockingConsoleErrors.join(' | ')}`);
  }

  if (reasons.length === 0) {
    return { pass: true, reasons: [] };
  }
  return { pass: false, reasons: [EVIDENCE_INCOMPLETE_MESSAGE, ...reasons] };
}

export async function verifyDemo(projectDir, options = {}) {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const targetDir = path.resolve(projectDir);
  const targetName = path.basename(targetDir);
  const reportPath = options.reportPath
    ? path.resolve(options.reportPath)
    : path.join(targetDir, 'verify-report.json');
  const shotDir = options.screenshotsDir
    ? path.resolve(options.screenshotsDir)
    : path.join(targetDir, 'screenshots');
  const browserChannel = typeof options.browserChannel === 'string' ? options.browserChannel : null;
  const headed = Boolean(options.headed);

  const failures = [];
  const logInfo = [];
  const writtenCaptures = [];
  let isOperationalError = false;
  let webgpuCapable = false;

  const fail = (m) => {
    failures.push(m);
    if (!options.silent) console.error(`FAIL: ${m}`);
  };
  const pass = (m) => {
    if (!options.silent) console.log(`PASS: ${m}`);
  };

  let benchmarkContext = null;
  try {
    benchmarkContext = discoverBenchmarkContext(targetDir);
  } catch (err) {
    isOperationalError = true;
    fail(`Benchmark discovery error: ${err.message}`);
  }

  // Item 1: load and validate ENVIZZLE_BUILD.json / ENVIZZLE_EVIDENCE.json early. A missing or
  // invalid contract/evidence is a genuine demo/bundle defect, not an infra problem — it must
  // NOT hard-abort the run here. It feeds the same evidence-gate logic evaluated at the very
  // end (see evaluateEvidenceFinalGate below), so the verifier can still build, launch, and
  // capture screenshots even when evidence starts incomplete (the normal, expected state before
  // a human completes the visual self-review).
  const buildContractLoad = loadJsonFile(path.join(targetDir, 'ENVIZZLE_BUILD.json'));
  const contract = buildContractLoad.data;
  const contractValidation = contract !== null
    ? validateBuildContractStandalone(contract)
    : { valid: false, errors: [buildContractLoad.error] };

  const evidenceLoad = loadJsonFile(path.join(targetDir, 'ENVIZZLE_EVIDENCE.json'));
  const evidence = evidenceLoad.data;
  const evidenceValidation = evidence !== null
    ? validateEvidenceStandalone(evidence)
    : { valid: false, errors: [evidenceLoad.error] };

  const actualBriefSha256 = computeActualBriefSha256(targetDir, contract);

  // Check required paths
  const missingPaths = [];
  for (const rel of REQUIRED_PATHS) {
    if (fs.existsSync(path.join(targetDir, rel))) {
      pass(`found ${rel}`);
    } else {
      missingPaths.push(rel);
      fail(`missing required path: ${rel}`);
    }
  }

  // Item 2: static forbidden-pattern scan, right after the required-paths check, before the
  // production build. Only runs when the contract loaded (its forbiddenPatterns array is
  // already profile-filtered per Task 1). A hit is a non-operational demo-source defect — it
  // feeds `failures` via `fail()` but never blocks the build/browser stages by itself.
  if (contract && Array.isArray(contract.forbiddenPatterns)) {
    let patternHits = [];
    try {
      patternHits = scanForForbiddenPatterns(targetDir, contract.forbiddenPatterns);
    } catch (err) {
      fail(`forbidden-pattern scan crashed: ${err.message}`);
    }
    if (patternHits.length > 0) {
      for (const hit of patternHits) {
        fail(`forbidden pattern '${hit.id}' detected at ${hit.file}:${hit.line} — ${hit.reason}`);
      }
    } else {
      pass('forbidden-pattern scan found no hits');
    }
  }

  let buildOk = missingPaths.length === 0 && !isOperationalError;
  let buildError = isOperationalError
    ? failures[0]
    : (missingPaths.length > 0 ? `Missing required paths: ${missingPaths.join(', ')}` : null);

  if (buildOk) {
    try {
      execSync('npx vite build', { cwd: targetDir, stdio: 'pipe' });
      pass('production build compiled with zero errors');
    } catch (err) {
      buildOk = false;
      buildError = `build failed: ${err.stderr?.toString() ?? err.message}`;
      fail(buildError);
    }
  }

  let hookReady = false;
  const runtimeErrors = [];
  const consoleWarnings = [];
  let blockingConsoleErrors = [];
  let informationalConsoleMessages = [];
  let navFailureMessage = null;
  let rendererInfo = null;

  // Reclassify after each asynchronous phase so delayed validation/device-loss messages are
  // included while non-blocking diagnostics remain informational.
  const refreshConsoleClassification = () => {
    const previousBlocking = new Set(blockingConsoleErrors);
    const allConsoleMessages = [...runtimeErrors, ...consoleWarnings];
    blockingConsoleErrors = allConsoleMessages.filter(isBlockingGpuMessage);
    informationalConsoleMessages = allConsoleMessages.filter((m) => !isBlockingGpuMessage(m));
    return blockingConsoleErrors.filter((m) => !previousBlocking.has(m));
  };
  let gateResult = {
    pass: false,
    failures: buildOk ? ['Runtime check failed'] : [buildError || 'Build check failed'],
    info: [],
    metrics: {
      frames: [],
      cameraNearestDepthM: null,
      frameStats: { medianMs: null, p99Ms: null, samples: null },
    },
  };

  if (buildOk && !options.skipBrowser) {
    let server = null;
    let browser = null;
    // Demo-level defects (setPose/setCharacterVisible/camera/frame-stat hooks throwing,
    // or malformed hook return values) are recorded here and never rethrown to the outer
    // catch below — only genuine infrastructure failures (Playwright load, server spawn,
    // server unreachable, browser launch, or the browser/page actually disconnecting, or
    // the verifier's own environment lacking WebGPU) reach the outer catch and set
    // isOperationalError.
    try {
      let playwright;
      try {
        playwright = options.playwright || (await import('playwright'));
      } catch (pwErr) {
        isOperationalError = true;
        throw new Error(`Failed to load Playwright: ${pwErr.message}`);
      }

      const port = 5300 + Math.floor(Math.random() * 600);
      const origin = `http://localhost:${port}`;
      try {
        server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
          cwd: targetDir,
          shell: true,
          detached: process.platform !== 'win32',
        });
      } catch (spawnErr) {
        isOperationalError = true;
        throw new Error(`Failed to spawn dev server: ${spawnErr.message}`);
      }

      try {
        await waitForServer(origin, options.serverReadyTimeoutMs ?? 30000);
      } catch (srvErr) {
        isOperationalError = true;
        throw srvErr;
      }

      try {
        browser = await playwright.chromium.launch({
          headless: !headed,
          ...(browserChannel ? { channel: browserChannel } : {}),
          args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'],
        });
      } catch (launchErr) {
        isOperationalError = true;
        throw new Error(`Failed to launch browser: ${launchErr.message}`);
      }

      const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
      page.on('pageerror', (e) => runtimeErrors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') runtimeErrors.push(m.text());
        else if (m.type() === 'warning') consoleWarnings.push(m.text());
      });

      try {
        await page.goto(origin, { waitUntil: 'networkidle' });
      } catch (navErr) {
        if (!browser.isConnected()) {
          isOperationalError = true;
          throw new Error(`Browser infrastructure disconnected while loading the demo page: ${navErr.message}`);
        }
        // The browser itself is healthy; the demo page failed to load — a demo defect.
        // Recorded separately from `failures` too, since whatever gate result gets
        // computed later (even a fully passing one) must not silently supersede this.
        navFailureMessage = `Failed to load demo page: ${navErr.message}`;
        fail(navFailureMessage);
      }

      // Item 7: WebGPU-unavailable vs. forbidden-fallback distinction. If the browser
      // environment itself lacks WebGPU (or adapter acquisition fails), that is an
      // operational/infrastructure limitation of the verifier, not a demo defect — it must
      // never be reported as a "failed" (demo defect) result. A demo that has WebGPU
      // available but still renders on a non-webgpu backend is caught separately below,
      // as a genuine (non-operational) rendererInfo() mismatch.
      let gpuCheck;
      try {
        gpuCheck = await page.evaluate(async () => {
          if (!window.navigator || !window.navigator.gpu) {
            return { available: false, reason: 'navigator.gpu is undefined' };
          }
          try {
            const adapter = await window.navigator.gpu.requestAdapter();
            if (!adapter) return { available: false, reason: 'navigator.gpu.requestAdapter() returned null' };
            return { available: true, reason: null };
          } catch (err) {
            return { available: false, reason: `navigator.gpu.requestAdapter() threw: ${err && err.message}` };
          }
        });
      } catch (gpuErr) {
        if (!browser.isConnected()) {
          isOperationalError = true;
          throw new Error(`Browser infrastructure disconnected while checking WebGPU availability: ${gpuErr.message}`);
        }
        isOperationalError = true;
        throw new Error(`Failed to evaluate WebGPU availability: ${gpuErr.message}`);
      }

      webgpuCapable = Boolean(gpuCheck && gpuCheck.available);
      if (!webgpuCapable) {
        isOperationalError = true;
        throw new Error(
          `WebGPU is not available in this browser environment (${gpuCheck && gpuCheck.reason ? gpuCheck.reason : 'navigator.gpu unavailable'}) — this is a verifier infrastructure limitation, not a demo defect. Verification is incomplete.`,
        );
      }

      // Item 3: status-aware readiness poll. Wait for a terminal status ('ready' or
      // 'failed'), then read the actual state — never accept the old bare `ready === true`
      // signal on its own.
      let hookTimedOut = false;
      try {
        await page.waitForFunction(
          "window.__demo && (window.__demo.status === 'ready' || window.__demo.status === 'failed')",
          { timeout: options.hookReadyTimeoutMs ?? 30000 },
        );
      } catch (waitErr) {
        if (!browser.isConnected()) {
          isOperationalError = true;
          throw new Error(`Browser infrastructure disconnected while waiting for window.__demo hook readiness: ${waitErr.message}`);
        }
        hookTimedOut = true;
      }

      if (hookTimedOut) {
        hookReady = false;
        fail('window.__demo hook missing or never became ready — see the brief\'s verification-hook section. Cannot verify.');
      } else {
        let demoState;
        try {
          demoState = await page.evaluate(() => ({
            status: window.__demo ? window.__demo.status : null,
            ready: window.__demo ? window.__demo.ready : null,
            error: window.__demo ? window.__demo.error : null,
          }));
        } catch (readErr) {
          if (!browser.isConnected()) {
            isOperationalError = true;
            throw new Error(`Browser infrastructure disconnected while reading window.__demo status: ${readErr.message}`);
          }
          demoState = null;
          fail(`window.__demo status read failed: ${readErr.message}`);
        }
        demoState = demoState || {};

        if (demoState.status === 'ready' && demoState.ready === true) {
          hookReady = true;
          pass('window.__demo hook present and ready');
        } else if (demoState.status === 'failed') {
          hookReady = false;
          const normalizedError = typeof demoState.error === 'string' ? demoState.error.trim() : '';
          if (normalizedError === '') {
            fail('window.__demo reported status "failed" with a blank error — initialization failures must set a nonblank, normalized error message.');
          } else {
            fail(`window.__demo reported initialization failure: ${normalizedError}`);
          }
        } else {
          hookReady = false;
          fail('window.__demo hook missing or never became ready — see the brief\'s verification-hook section. Cannot verify.');
        }
      }

      // Item 4: rendererInfo() validation, right after hook-ready.
      if (hookReady) {
        try {
          rendererInfo = await page.evaluate(() => window.__demo.rendererInfo());
        } catch (riErr) {
          if (!browser.isConnected()) {
            isOperationalError = true;
            throw new Error(`Browser infrastructure disconnected while reading window.__demo.rendererInfo(): ${riErr.message}`);
          }
          fail(`window.__demo.rendererInfo() failed: ${riErr.message}`);
          rendererInfo = null;
        }

        if (rendererInfo === null || typeof rendererInfo !== 'object' || Array.isArray(rendererInfo)) {
          if (rendererInfo !== null) {
            fail(`window.__demo.rendererInfo() returned ${JSON.stringify(rendererInfo)} instead of an object.`);
          }
          rendererInfo = null;
        } else {
          const actualKeys = Object.keys(rendererInfo);
          const missingKeys = RENDERER_INFO_KEYS.filter((k) => !actualKeys.includes(k));
          const unknownKeys = actualKeys.filter((k) => !RENDERER_INFO_KEYS.includes(k));
          if (missingKeys.length > 0 || unknownKeys.length > 0) {
            fail(`window.__demo.rendererInfo() has the wrong keys — missing [${missingKeys.join(', ')}], unknown [${unknownKeys.join(', ')}].`);
          }

          const expectedTuple = contractValidation.valid && contract?.project?.renderingProfile
            ? RENDERER_TUPLE_BY_PROFILE[contract.project.renderingProfile]
            : null;
          if (expectedTuple) {
            if (rendererInfo.backend !== expectedTuple.backend) {
              fail(`window.__demo.rendererInfo().backend is ${JSON.stringify(rendererInfo.backend)}, expected ${JSON.stringify(expectedTuple.backend)} for renderingProfile '${contract.project.renderingProfile}' — a non-matching backend means a forbidden fallback renderer was used.`);
            }
            if (rendererInfo.shaderLanguage !== expectedTuple.shaderLanguage) {
              fail(`window.__demo.rendererInfo().shaderLanguage is ${JSON.stringify(rendererInfo.shaderLanguage)}, expected ${JSON.stringify(expectedTuple.shaderLanguage)} for renderingProfile '${contract.project.renderingProfile}'.`);
            }
          }
          if (rendererInfo.materialsReady !== true) {
            fail(`window.__demo.rendererInfo().materialsReady is ${JSON.stringify(rendererInfo.materialsReady)}, expected true.`);
          }
          if (typeof rendererInfo.renderedFrames !== 'number' || !Number.isInteger(rendererInfo.renderedFrames) || rendererInfo.renderedFrames < 1) {
            fail(`window.__demo.rendererInfo().renderedFrames is ${JSON.stringify(rendererInfo.renderedFrames)}, expected an integer >= 1.`);
          }
          if (!Array.isArray(rendererInfo.validationErrors) || rendererInfo.validationErrors.length > 0) {
            fail(`window.__demo.rendererInfo().validationErrors is ${JSON.stringify(rendererInfo.validationErrors)}, expected an empty array.`);
          }
        }
      }

      if (hookReady) {
        const frames = [];
        fs.mkdirSync(shotDir, { recursive: true });

        let captureError = null;
        try {
          for (const pose of ['idle', 'locomotion', 'mechanic']) {
            await page.evaluate((p) => window.__demo.setPose(p), pose);
            await page.waitForTimeout(1200);

            const withCharBuf = await page.screenshot();
            await page.evaluate(() => window.__demo.setCharacterVisible(false));
            await page.waitForTimeout(300);
            const withoutCharBuf = await page.screenshot();
            await page.evaluate(() => window.__demo.setCharacterVisible(true));

            frames.push({
              name: pose,
              image: toImage(withCharBuf),
              imageWithoutCharacter: toImage(withoutCharBuf),
            });
            const shotName = `milestone_${pose}.png`;
            fs.writeFileSync(path.join(shotDir, shotName), withCharBuf);
            writtenCaptures.push(shotName);
          }
        } catch (err) {
          if (!browser.isConnected()) {
            isOperationalError = true;
            throw new Error(`Browser infrastructure disconnected during pose capture: ${err.message}`);
          }
          captureError = err;
          fail(`demo pose/visibility hook failed: ${err.message}`);
        }

        // Item 8: allow a bounded drain after the last render submission so delayed validation
        // errors and device-loss messages cannot arrive after the verifier has already decided
        // that the run is clean.
        let validationDrainError = null;
        try {
          await page.waitForTimeout(options.validationDrainMs ?? 250);
        } catch (err) {
          if (!browser.isConnected()) {
            isOperationalError = true;
            throw new Error(`Browser infrastructure disconnected during validation drain: ${err.message}`);
          }
          validationDrainError = err;
          fail(`validation-error drain failed: ${err.message}`);
        }

        let drainedRendererInfo = null;
        try {
          drainedRendererInfo = await page.evaluate(() => window.__demo.rendererInfo());
        } catch (err) {
          if (!browser.isConnected()) {
            isOperationalError = true;
            throw new Error(`Browser infrastructure disconnected while checking delayed renderer validation errors: ${err.message}`);
          }
          validationDrainError = validationDrainError || err;
          fail(`delayed renderer validation check failed: ${err.message}`);
        }
        if (drainedRendererInfo && typeof drainedRendererInfo === 'object') {
          rendererInfo = drainedRendererInfo;
          if (Array.isArray(drainedRendererInfo.validationErrors) && drainedRendererInfo.validationErrors.length > 0) {
            fail(`window.__demo.rendererInfo().validationErrors became nonempty during the bounded validation drain: ${JSON.stringify(drainedRendererInfo.validationErrors)}`);
          }
        }

        refreshConsoleClassification();
        if (blockingConsoleErrors.length === 0) {
          pass('zero blocking GPU-validation/console errors');
        } else {
          fail(`blocking console/GPU-validation errors: ${blockingConsoleErrors.join(' | ')}`);
        }
        if (validationDrainError || captureError || writtenCaptures.length !== 3) {
          gateResult.pass = false;
          gateResult.failures = [
            ...(gateResult.failures || []),
            validationDrainError ? `validation-error drain failed: ${validationDrainError.message}` : (captureError ? `demo pose/visibility hook failed: ${captureError.message}` : 'Incomplete capture evidence after pose loop'),
            ...blockingConsoleErrors,
          ];
        } else {
          let cameraDiagnostics;
          let frameStats;
          let terrainDiagnostics = null;
          let terrainValidationErrors = [];
          let hookError = null;
          try {
            cameraDiagnostics = await page.evaluate(() => window.__demo.cameraDiagnostics());
            frameStats = await page.evaluate(() => window.__demo.frameStats());
            // Item 5: collect and validate the complete terrain ownership/parity proof. The
            // hook is required even for gpu-depth camera diagnostics because it is the source
            // of truth that rules out CPU pre-displacement and CPU-only parity claims.
            terrainDiagnostics = await page.evaluate(() => window.__demo.terrainDiagnostics());
            terrainValidationErrors = validateTerrainDiagnostics(terrainDiagnostics);
          } catch (err) {
            if (!browser.isConnected()) {
              isOperationalError = true;
              throw new Error(`Browser infrastructure disconnected during metrics collection: ${err.message}`);
            }
            hookError = err;
            fail(`camera/frame-stat hook failed: ${err.message}`);
          }

          if (hookError) {
            gateResult.pass = false;
            gateResult.failures = [...(gateResult.failures || []), `camera/frame-stat hook failed: ${hookError.message}`, ...blockingConsoleErrors];
          } else {
            gateResult = evaluateGates({ frames, cameraDiagnostics, frameStats });
            gateResult.metrics = {
              ...gateResult.metrics,
              rendererInfo,
              rendererDiagnostics: rendererInfo,
              terrainDiagnostics,
            };

            if (blockingConsoleErrors.length > 0) {
              gateResult.pass = false;
              gateResult.failures = [...(gateResult.failures || []), ...blockingConsoleErrors];
            }

            if (terrainValidationErrors.length > 0) {
              gateResult.pass = false;
              gateResult.failures = [...(gateResult.failures || []), ...terrainValidationErrors];
              terrainValidationErrors.forEach(fail);
            }
            gateResult.info.forEach((i) => {
              logInfo.push(i);
              if (!options.silent) console.log(`INFO: ${i}`);
            });
            informationalConsoleMessages.forEach((m) => {
              const msg = `non-blocking console/runtime message: ${m}`;
              logInfo.push(msg);
              if (!options.silent) console.log(`INFO: ${msg}`);
            });

            if (gateResult.pass) pass('all image gates passed');
            else gateResult.failures.forEach(fail);
          }
        }
      }
    } catch (err) {
      // Only genuine infrastructure failures reach here — see the comment above.
      isOperationalError = true;
      gateResult.pass = false;
      gateResult.failures = [...(gateResult.failures || []), err.message];
      fail(`verification crashed: ${err.message}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (_) {}
      }
      if (server) {
        killTree(server);
      }
    }
  }

  // A recorded demo-level failure (e.g. navigation) must never be silently superseded
  // by an otherwise-passing gate result computed later in the flow.
  if (navFailureMessage) {
    gateResult = {
      ...gateResult,
      pass: false,
      failures: [...(gateResult.failures || []), navFailureMessage],
    };
  }

  // Re-check after metric collection because page errors can be delivered asynchronously.
  const lateBlockingMessages = refreshConsoleClassification();
  if (lateBlockingMessages.length > 0) {
    gateResult = {
      ...gateResult,
      pass: false,
      failures: [...(gateResult.failures || []), ...lateBlockingMessages],
    };
    lateBlockingMessages.forEach((message) => fail(`blocking console/GPU-validation error: ${message}`));
  }

  // Item 9: evidence final-pass gate, evaluated unconditionally at the very end so the exact
  // canonical incomplete-verification message surfaces whenever contract/evidence binding,
  // screenshot provenance, or blocking console/GPU errors are not fully clean — even when
  // every earlier image/renderer gate happened to pass. Skipped only when the run is already
  // an operational error (that status is already unambiguous and already carries its own
  // operational failure reason).
  const evidenceGate = evaluateEvidenceFinalGate({
    contract,
    contractValidation,
    evidence,
    evidenceValidation,
    actualBriefSha256,
    writtenCaptures,
    shotDir,
    blockingConsoleErrors,
  });
  if (!evidenceGate.pass && !isOperationalError) {
    gateResult = {
      ...gateResult,
      pass: false,
      failures: [...(gateResult.failures || []), ...evidenceGate.reasons],
    };
    evidenceGate.reasons.forEach(fail);
  }

  // Keep the machine-readable gate result aligned with every recorded demo defect. This is
  // especially important for rendererInfo/readiness failures discovered before image gates run.
  if (failures.length > 0) {
    const existingGateFailures = new Set(gateResult.failures || []);
    const unrepresentedFailures = failures.filter((failure) => !existingGateFailures.has(failure));
    if (unrepresentedFailures.length > 0) {
      gateResult = {
        ...gateResult,
        pass: false,
        failures: [...(gateResult.failures || []), ...unrepresentedFailures],
      };
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;
  const overallPass = buildOk && hookReady && blockingConsoleErrors.length === 0 && gateResult.pass && !isOperationalError && failures.length === 0;
  const status = isOperationalError ? 'error' : (overallPass ? 'passed' : 'failed');

  const environment = {
    browserChannel,
    headed,
    webgpuCapable,
  };

  const report = createVerificationReport({
    target: targetName,
    startedAt,
    finishedAt,
    durationMs,
    requiredPaths: REQUIRED_PATHS.slice(),
    build: { ok: buildOk, error: buildError },
    runtime: { hookReady, errors: blockingConsoleErrors },
    captures: writtenCaptures,
    environment,
    gates: {
      pass: gateResult.pass,
      failures: gateResult.failures || [],
      info: gateResult.info || [],
      metrics: gateResult.metrics || { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: null, p99Ms: null, samples: null } },
    },
    status,
    benchmark: benchmarkContext,
  });

  writeVerificationReport(reportPath, report);

  return {
    pass: overallPass,
    failures,
    info: logInfo,
    report,
    reportPath,
    status,
  };
}

/**
 * Pure exit-code policy for a verifyDemo() result. The CLI below must derive its
 * process.exit() code from this same function, so tests can prove the exit-code
 * policy directly without launching a browser.
 */
export function verificationExitCode(result) {
  if (result.status === 'error') return 2;
  if (result.pass && result.status === 'passed') return 0;
  return 1;
}

// Executable entry point when invoked via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let parsed;
  try {
    parsed = parseVerifyCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    printVerifyHelp();
    process.exit(2);
  }

  if (parsed.help) {
    printVerifyHelp();
    process.exit(0);
  }

  if (!fs.existsSync(parsed.projectDir)) {
    console.error(`ERROR: Project directory '${parsed.projectDir}' does not exist.`);
    process.exit(2);
  }

  verifyDemo(parsed.projectDir, {
    reportPath: parsed.reportPath,
    screenshotsDir: parsed.screenshotsDir,
    browserChannel: parsed.browserChannel,
    headed: parsed.headed,
  })
    .then((result) => {
      console.log('\n' + '='.repeat(50));
      if (result.status === 'error') {
        console.log(`VERIFICATION ERROR — ${result.failures.length} operational failure(s):`);
        result.failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
      } else if (result.pass && result.status === 'passed') {
        console.log('VERIFICATION PASSED');
      } else {
        console.log(`VERIFICATION FAILED — ${result.failures.length} problem(s):`);
        result.failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
        console.log('\nFix these and re-run. Do not proceed with failures outstanding.');
      }
      process.exit(verificationExitCode(result));
    })
    .catch((err) => {
      console.error(`VERIFICATION ERROR: ${err.message}`);
      process.exit(2);
    });
}
