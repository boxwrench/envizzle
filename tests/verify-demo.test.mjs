import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { assembleBrief } from '../assemble.mjs';
import { buildCaseAssemblySpec } from '../benchmark-cases.mjs';
import { parseVerifyCliArgs, verifyDemo, isBlockingGpuMessage } from '../verify/verify_demo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const REQUIRED_PATHS = ['index.html', 'package.json', 'vite.config.js', 'DECISIONS.md', 'PERF.md', 'src/main.js'];
const DEFAULT_RENDERER_INFO = { backend: 'webgpu', shaderLanguage: 'wgsl', materialsReady: true, renderedFrames: 1, validationErrors: [] };
const DEFAULT_DEMO_STATE = { status: 'ready', ready: true, error: null };
const DEFAULT_TERRAIN_DIAGNOSTICS = { renderOwner: 'gpu', renderMeshBaseHeight: 0, parityMethod: 'gpu-readback', paritySamples: 8, parityMaxErrorM: 0.012 };
const DEFAULT_CAMERA_DIAGNOSTICS = { method: 'gpu-depth', nearestDepthM: 5, terrainClearanceM: 4.5 };
const COMPLETE_SCREENSHOTS = {
  'first-runnable-scene': ['milestone_idle.png'],
  'systems-complete': ['milestone_locomotion.png', 'milestone_mechanic.png'],
  'final-polish': ['milestone_idle.png', 'milestone_locomotion.png', 'milestone_mechanic.png'],
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const validAssembly = () => JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json'), 'utf8'));

function makeCompleteEvidence(assembled) {
  const evidence = clone(assembled.evidenceTemplate);
  evidence.status = 'complete';
  evidence.briefSha256 = assembled.buildContract.project.briefSha256;
  for (const milestone of evidence.milestones) {
    milestone.status = 'complete';
    milestone.screenshots = COMPLETE_SCREENSHOTS[milestone.id].slice();
    milestone.console = { errors: [], warnings: [] };
    milestone.performance = { fps: 60, frameTimeMs: 16.67 };
    milestone.visualSelfReview = {
      reviewed: true,
      weaknesses: ['Slight contrast variation remains.'],
      corrections: ['Balanced the final lighting pass.'],
    };
  }
  return evidence;
}

function makeProject({ contract = true, evidence = true, contractMutator, evidenceMutator, sourceMain = '', assembly = validAssembly() } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envizzle-task7-'));
  const assembled = assembleBrief(assembly, { rootDir: repoRoot });
  for (const relative of REQUIRED_PATHS) {
    const full = path.join(dir, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, relative === 'src/main.js' ? sourceMain : '', 'utf8');
  }
  fs.writeFileSync(path.join(dir, assembled.fileName), assembled.brief, 'utf8');
  if (contract) {
    const value = clone(assembled.buildContract);
    const beforeMutation = JSON.stringify(value);
    contractMutator?.(value);
    if (contractMutator) assert.notEqual(JSON.stringify(value), beforeMutation, 'contract negative fixture must differ from its positive counterpart');
    fs.writeFileSync(path.join(dir, 'ENVIZZLE_BUILD.json'), JSON.stringify(value, null, 2), 'utf8');
  }
  if (evidence) {
    const value = makeCompleteEvidence(assembled);
    const beforeMutation = JSON.stringify(value);
    evidenceMutator?.(value);
    if (evidenceMutator) assert.notEqual(JSON.stringify(value), beforeMutation, 'evidence negative fixture must differ from its positive counterpart');
    fs.writeFileSync(path.join(dir, 'ENVIZZLE_EVIDENCE.json'), JSON.stringify(value, null, 2), 'utf8');
  }
  return { dir, assembled };
}

function makeNpxShim(mode = 'serve-ok') {
  const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envizzle-task7-npx-'));
  const controllerPath = path.join(shimDir, 'controller.mjs');
  fs.writeFileSync(controllerPath, `
const args = process.argv.slice(2);
const mode = ${JSON.stringify(mode)};
if (args[1] === 'build') process.exit(mode === 'build-fail' ? 1 : 0);
if (mode === 'serve-fail' || mode === 'build-fail') process.exit(1);
const port = Number(args[args.indexOf('--port') + 1]);
const { createServer } = await import('node:http');
const server = createServer((_req, res) => res.end('<html><body>stub</body></html>'));
server.listen(port);
await new Promise(() => {});
`, 'utf8');
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(shimDir, 'npx.cmd'), `@echo off\r\nnode "${controllerPath}" %*\r\n`, 'utf8');
  } else {
    const executable = path.join(shimDir, 'npx');
    fs.writeFileSync(executable, `#!/bin/sh\nexec node "${controllerPath}" "$@"\n`, 'utf8');
    fs.chmodSync(executable, 0o755);
  }
  return {
    dir: shimDir,
    cleanup() { fs.rmSync(shimDir, { recursive: true, force: true }); },
  };
}

async function withShim(shim, fn) {
  const originalPath = process.env.PATH;
  process.env.PATH = shim.dir + path.delimiter + originalPath;
  try {
    return await fn();
  } finally {
    process.env.PATH = originalPath;
  }
}

function tinyPngBuffer() {
  const png = new PNG({ width: 2, height: 2 });
  png.data.fill(120);
  return PNG.sync.write(png);
}

function makeFakePlaywright({
  gpuAvailable = true,
  webgl2Available = true,
  demoState = { status: 'ready', ready: true, error: null },
  rendererInfo = { backend: 'webgpu', shaderLanguage: 'wgsl', materialsReady: true, renderedFrames: 1, validationErrors: [] },
  rendererInfoAfterDrain,
  terrainDiagnostics = { renderOwner: 'gpu', renderMeshBaseHeight: 0, parityMethod: 'gpu-readback', paritySamples: 8, parityMaxErrorM: 0.012 },
  cameraDiagnostics = { method: 'gpu-depth', nearestDepthM: 5, terrainClearanceM: 4.5 },
  frameStats = { medianMs: 10, p99Ms: 15, samples: 100 },
  onDrain,
  onPageError,
} = {}) {
  let drained = false;
  let launchOptions = null;
  const listeners = new Map();
  const emit = (type, text) => listeners.get(type)?.forEach((listener) => listener({ type: () => 'error', text: () => text, message: text }));
  const page = {
    on(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    async goto() {
      if (onPageError) listeners.get('pageerror')?.forEach((listener) => listener({ message: onPageError }));
    },
    async waitForFunction() {},
    async waitForTimeout(ms) {
      if (ms === 1 || ms === 250) {
        drained = true;
        onDrain?.(emit);
      }
    },
    async screenshot() { return tinyPngBuffer(); },
    async evaluate(fn) {
      const source = fn.toString();
      if (source.includes('webgl2')) return webgl2Available ? { available: true, reason: null } : { available: false, reason: 'WebGL2 context unavailable' };
      if (source.includes('navigator.gpu')) return gpuAvailable ? { available: true, reason: null } : { available: false, reason: 'navigator.gpu is undefined' };
      if (source.includes('window.__demo.status')) return demoState;
      if (source.includes('rendererInfo')) return drained && rendererInfoAfterDrain ? rendererInfoAfterDrain : rendererInfo;
      if (source.includes('cameraDiagnostics')) return cameraDiagnostics;
      if (source.includes('terrainDiagnostics')) return terrainDiagnostics;
      if (source.includes('frameStats')) return frameStats;
      return undefined;
    },
  };
  const browser = {
    async newPage() { return page; },
    async close() {},
    isConnected() { return true; },
  };
  return {
    playwright: { chromium: { async launch(options) { launchOptions = options; return browser; } } },
    getLaunchOptions() { return launchOptions; },
    getGpuAvailability() { return gpuAvailable; },
  };
}

async function run(project, fake, options = {}) {
  const shim = makeNpxShim();
  try {
    return await withShim(shim, () => verifyDemo(project.dir, {
      reportPath: path.join(project.dir, 'verify-report.json'),
      screenshotsDir: path.join(project.dir, 'screenshots'),
      silent: true,
      serverReadyTimeoutMs: 3000,
      validationDrainMs: 1,
      playwright: fake?.playwright,
      ...options,
    }));
  } finally {
    shim.cleanup();
  }
}

function cleanup(project) {
  fs.rmSync(project.dir, { recursive: true, force: true });
}

test('Task 7 CLI flags parse strictly and matcher keeps unrelated console text informational', () => {
  const parsed = parseVerifyCliArgs(['demo', '--browser-channel', 'chrome', '--headed']);
  assert.equal(parsed.browserChannel, 'chrome');
  assert.equal(parsed.headed, true);
  assert.throws(() => parseVerifyCliArgs(['--browser-channel', 'firefox']), /Unsupported/);
  assert.throws(() => parseVerifyCliArgs(['--headed', '--headed']), /Duplicate/);
  assert.equal(isBlockingGpuMessage('ordinary warning about scene colors'), false);
  assert.equal(isBlockingGpuMessage('UNCAPTURED validation ERROR from the device'), true);
  assert.equal(isBlockingGpuMessage('GPUValidationError: duplicate binding'), true);
});

test('missing browser WebGPU capability is operational, not a failed demo', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright({ gpuAvailable: false });
  assert.notEqual(fake.getGpuAvailability(), true, 'missing-WebGPU fixture must differ from the available-WebGPU baseline');
  try {
    const result = await run(project, fake);
    assert.equal(result.status, 'error');
    assert.equal(result.report.environment.webgpuCapable, false);
    assert.ok(result.failures.some((message) => /WebGPU is not available/i.test(message)));
  } finally {
    cleanup(project);
  }
});

test('three-webgl2 profile does not require WebGPU', async () => {
  const project = makeProject({ assembly: buildCaseAssemblySpec('hoshi-signature') });
  const fake = makeFakePlaywright({
    gpuAvailable: false,
    webgl2Available: true,
    rendererInfo: { backend: 'webgl2', shaderLanguage: 'glsl-es-300', materialsReady: true, renderedFrames: 1, validationErrors: [] },
  });
  try {
    const result = await run(project, fake);
    assert.notEqual(result.status, 'error', result.failures.join(' | '));
    assert.equal(result.report.environment.webgpuCapable, false);
    assert.ok(!result.failures.some((message) => /WebGPU is not available/i.test(message)));
  } finally {
    cleanup(project);
  }
});

test('renderer backend mismatch remains a demo failure when WebGPU is available', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright({ rendererInfo: { backend: 'webgl2', shaderLanguage: 'glsl-es-300', materialsReady: true, renderedFrames: 1, validationErrors: [] } });
  try {
    const result = await run(project, fake);
    assert.equal(result.status, 'failed');
    assert.notEqual(result.status, 'error');
    assert.ok(result.failures.some((message) => /backend|fallback/i.test(message)));
    assert.equal(result.report.environment.webgpuCapable, true);
  } finally {
    cleanup(project);
  }
});

test('rendererInfo readiness fields, lifecycle state, and blank failure errors cannot pass', async () => {
  const cases = [
    { label: 'false materialsReady', rendererInfo: { backend: 'webgpu', shaderLanguage: 'wgsl', materialsReady: false, renderedFrames: 1, validationErrors: [] }, pattern: /materialsReady/ },
    { label: 'zero rendered frames', rendererInfo: { backend: 'webgpu', shaderLanguage: 'wgsl', materialsReady: true, renderedFrames: 0, validationErrors: [] }, pattern: /renderedFrames/ },
    { label: 'validation errors', rendererInfo: { backend: 'webgpu', shaderLanguage: 'wgsl', materialsReady: true, renderedFrames: 1, validationErrors: ['device lost'] }, pattern: /validationErrors/ },
    { label: 'premature ready flag', demoState: { status: 'initializing', ready: true, error: null }, pattern: /never became ready/ },
    { label: 'blank failed error', demoState: { status: 'failed', ready: false, error: '   ' }, pattern: /blank error/ },
  ];
  for (const fixture of cases) {
    const project = makeProject();
    const fake = makeFakePlaywright(fixture);
    assert.notDeepEqual({ rendererInfo: fixture.rendererInfo ?? DEFAULT_RENDERER_INFO, demoState: fixture.demoState ?? DEFAULT_DEMO_STATE }, { rendererInfo: DEFAULT_RENDERER_INFO, demoState: DEFAULT_DEMO_STATE }, `${fixture.label} mutation must differ from the passing lifecycle fixture`);
    try {
      const result = await run(project, fake);
      assert.equal(result.status, 'failed', fixture.label);
      assert.equal(result.report.gates.pass, false, `${fixture.label} must also fail the machine-readable gate result`);
      assert.ok(result.failures.some((message) => fixture.pattern.test(message)), `${fixture.label}: ${result.failures.join(' | ')}`);
    } finally {
      cleanup(project);
    }
  }
});

test('terrain ownership and parity proofs reject every invalid proof mutation', async () => {
  const cases = [
    { label: 'non-GPU render owner', terrainDiagnostics: { renderOwner: 'cpu', renderMeshBaseHeight: 0, parityMethod: 'gpu-readback', paritySamples: 8, parityMaxErrorM: 0.012 }, pattern: /renderOwner/ },
    { label: 'CPU pre-displaced render mesh', terrainDiagnostics: { renderOwner: 'gpu', renderMeshBaseHeight: 1, parityMethod: 'gpu-readback', paritySamples: 8, parityMaxErrorM: 0.012 }, pattern: /renderMeshBaseHeight|pre-displacement/ },
    { label: 'CPU-only parity method', terrainDiagnostics: { renderOwner: 'gpu', renderMeshBaseHeight: 0, parityMethod: 'cpu-only', paritySamples: 8, parityMaxErrorM: 0.012 }, pattern: /parityMethod|CPU-to-CPU/ },
    { label: 'insufficient parity samples', terrainDiagnostics: { renderOwner: 'gpu', renderMeshBaseHeight: 0, parityMethod: 'gpu-readback', paritySamples: 2, parityMaxErrorM: 0.012 }, pattern: /paritySamples/ },
    { label: 'excessive parity error', terrainDiagnostics: { renderOwner: 'gpu', renderMeshBaseHeight: 0, parityMethod: 'gpu-readback', paritySamples: 8, parityMaxErrorM: 0.031 }, pattern: /parityMaxErrorM/ },
    { label: 'invalid camera method', cameraDiagnostics: { method: 'cpu-height-only', nearestDepthM: 5, terrainClearanceM: 4.5 }, pattern: /cameraDiagnostics.*method/ },
    { label: 'camera parity method with invalid terrain proof', cameraDiagnostics: { method: 'cpu-height-with-gpu-parity', nearestDepthM: 5, terrainClearanceM: 4.5 }, terrainDiagnostics: { renderOwner: 'gpu', renderMeshBaseHeight: 0, parityMethod: 'cpu-only', paritySamples: 8, parityMaxErrorM: 0.012 }, pattern: /camera parity qualification failed|parityMethod/ },
  ];
  for (const fixture of cases) {
    const project = makeProject();
    const fake = makeFakePlaywright(fixture);
    assert.notDeepEqual({ terrainDiagnostics: fixture.terrainDiagnostics ?? DEFAULT_TERRAIN_DIAGNOSTICS, cameraDiagnostics: fixture.cameraDiagnostics ?? DEFAULT_CAMERA_DIAGNOSTICS }, { terrainDiagnostics: DEFAULT_TERRAIN_DIAGNOSTICS, cameraDiagnostics: DEFAULT_CAMERA_DIAGNOSTICS }, `${fixture.label} mutation must differ from the passing terrain/camera fixture`);
    try {
      const result = await run(project, fake);
      assert.equal(result.status, 'failed', fixture.label);
      assert.equal(result.report.gates.pass, false, `${fixture.label} must also fail the machine-readable gate result`);
      assert.ok(result.failures.some((message) => fixture.pattern.test(message)), `${fixture.label}: ${result.failures.join(' | ')}`);
    } finally {
      cleanup(project);
    }
  }
});

test('delayed blocking validation errors during the bounded drain fail the run and are reported', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright({ onDrain: (emit) => emit('console', 'uncaptured validation error: device lost') });
  try {
    const result = await run(project, fake);
    assert.equal(result.status, 'failed');
    assert.ok(result.report.runtime.errors.some((message) => /uncaptured validation error/i.test(message)));
    assert.ok(result.failures.some((message) => /incomplete verification/i.test(message)));
  } finally {
    cleanup(project);
  }
});

test('ordinary page and console errors are blocking runtime failures', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright({
    onPageError: 'ordinary page error',
    onDrain: (emit) => emit('console', 'ordinary console error'),
  });
  try {
    const result = await run(project, fake);
    assert.equal(result.status, 'failed');
    assert.ok(result.report.runtime.errors.some((message) => /ordinary page error/.test(message)));
    assert.ok(result.report.runtime.errors.some((message) => /ordinary console error/.test(message)));
  } finally {
    cleanup(project);
  }
});

test('incomplete evidence cannot pass and always carries the canonical final-pass message', async () => {
  const project = makeProject({ evidenceMutator: (evidence) => { evidence.milestones[0].performance.fps = null; } });
  try {
    const result = await run(project, null, { skipBrowser: true });
    assert.equal(result.status, 'failed');
    assert.equal(result.pass, false);
    assert.ok(result.failures.some((message) => message === 'incomplete verification: milestone or stage evidence is not complete'));
  } finally {
    cleanup(project);
  }
});

test('missing contract/evidence files cannot pass even when the build succeeds', async () => {
  const project = makeProject({ contract: false, evidence: false });
  try {
    const result = await run(project, null, { skipBrowser: true });
    assert.equal(result.status, 'failed');
    assert.ok(result.failures.some((message) => message === 'incomplete verification: milestone or stage evidence is not complete'));
  } finally {
    cleanup(project);
  }
});

test('forbidden-pattern scan is wired before build and contributes a demo failure', async () => {
  const project = makeProject({ sourceMain: 'const fallback = new BABYLON.Engine(canvas);' });
  try {
    const result = await run(project, null, { skipBrowser: true });
    assert.equal(result.status, 'failed');
    assert.ok(result.failures.some((message) => /forbidden pattern.*webgl-fallback/i.test(message)), result.failures.join(' | '));
  } finally {
    cleanup(project);
  }
});

test('--browser-channel and --headed reach browser launch and report environment', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright();
  try {
    const result = await run(project, fake, { browserChannel: 'chrome', headed: true });
    const launchOptions = fake.getLaunchOptions();
    assert.equal(launchOptions.channel, 'chrome');
    assert.equal(launchOptions.headless, false);
    assert.equal(result.report.environment.browserChannel, 'chrome');
    assert.equal(result.report.environment.headed, true);
  } finally {
    cleanup(project);
  }
});
