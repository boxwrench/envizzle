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

import { gradient, withBlob } from './fixtures/make-synthetic.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const REQUIRED_PATHS = ['index.html', 'package.json', 'vite.config.js', 'DECISIONS.md', 'PERF.md', 'src/main.js'];
const DEFAULT_RENDERER_INFO = { backend: 'webgpu', shaderLanguage: 'wgsl', materialsReady: true, renderedFrames: 1, validationErrors: [] };
const DEFAULT_DEMO_STATE = { status: 'ready', ready: true, error: null };
const DEFAULT_TERRAIN_DIAGNOSTICS = { renderOwner: 'gpu', renderMeshBaseHeight: 0, parityMethod: 'gpu-readback', paritySamples: 8, parityMaxErrorM: 0.012 };
const DEFAULT_CAMERA_DIAGNOSTICS = { method: 'gpu-depth', nearestDepthM: 5, terrainClearanceM: 4.5 };

function plusCharacter(img, cx, cy, armLen, armThick, [r, g, b] = [255, 0, 0]) {
  const out = { width: img.width, height: img.height, data: Uint8Array.from(img.data) };
  const paint = (x, y) => {
    if (x < 0 || y < 0 || x >= out.width || y >= out.height) return;
    const i = (y * out.width + x) * 4;
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
  };
  for (let y = cy - armLen; y <= cy + armLen; y++) {
    for (let x = cx - armThick; x <= cx + armThick; x++) paint(x, y);
  }
  for (let x = cx - armLen; x <= cx + armLen; x++) {
    for (let y = cy - armThick; y <= cy + armThick; y++) paint(x, y);
  }
  return out;
}

function gatePassingPngBuffer(withChar = true, pose = 'idle') {
  const base = gradient(300, 300);
  const colorMap = { idle: [255, 0, 0], locomotion: [0, 255, 0], mechanic: [0, 0, 255] };
  const img = withChar ? plusCharacter(base, 150, 150, 45, 15, colorMap[pose] ?? [255, 0, 0]) : base;
  const png = new PNG({ width: img.width, height: img.height });
  Buffer.from(img.data).copy(png.data);
  return PNG.sync.write(png);
}

function tinyPngBuffer() {
  const png = new PNG({ width: 2, height: 2 });
  png.data.fill(120);
  return PNG.sync.write(png);
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const validAssembly = () => JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json'), 'utf8'));

function makeCompleteEvidence(assembled) {
  const evidence = clone(assembled.evidenceTemplate);
  evidence.status = 'passed';
  evidence.briefSha256 = assembled.buildContract.project.briefSha256;
  evidence.stages[0].status = 'passed';
  evidence.stages[0].automatedChecks = ['rendererInfo() reports selected backend'];
  evidence.stages[1].status = 'passed';
  evidence.stages[1].automatedChecks = ['terrainDiagnostics().renderOwner is "gpu"'];
  evidence.stages[2].status = 'passed';
  evidence.stages[2].artifacts = ['environment_only.png', 'idle.png'];
  evidence.stages[2].reviewed = true;
  evidence.stages[2].weaknesses = ['Slight contrast variation remains.'];
  evidence.stages[2].corrections = ['Balanced the final lighting pass.'];
  evidence.stages[3].status = 'passed';
  evidence.stages[3].artifacts = ['idle.png', 'locomotion.png'];
  evidence.stages[3].reviewed = true;
  evidence.stages[3].weaknesses = ['Foot planting lags.'];
  evidence.stages[3].corrections = ['Tightened IK settle time.'];
  evidence.stages[4].status = 'passed';
  evidence.stages[4].artifacts = ['idle.png', 'locomotion.png', 'mechanic.png'];
  evidence.stages[4].reviewed = true;
  evidence.stages[4].weaknesses = ['Wake crest curtain thin.'];
  evidence.stages[4].corrections = ['Doubled crest density.'];
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

function makeFakePlaywright({
  gpuAvailable = true,
  webgl2Available = true,
  demoState = { status: 'ready', ready: true, error: null },
  rendererInfo = { backend: 'webgpu', shaderLanguage: 'wgsl', materialsReady: true, renderedFrames: 1, validationErrors: [] },
  rendererInfoAfterDrain,
  terrainDiagnostics = { renderOwner: 'gpu', renderMeshBaseHeight: 0, parityMethod: 'gpu-readback', paritySamples: 8, parityMaxErrorM: 0.012 },
  cameraDiagnostics = { method: 'gpu-depth', nearestDepthM: 5, terrainClearanceM: 4.5 },
  frameStats = { medianMs: 10, p99Ms: 15, samples: 100 },
  backendProof = {
    engineInitialized: true,
    activeBackend: 'webgpu',
    activeShaderLanguage: 'wgsl',
    materialCompilationAttempted: true,
    materialCompiledAgainstMesh: true,
    materialReady: true,
    requiredAttributes: ['position', 'normal'],
    presentVertexBuffers: { position: true, normal: true },
    declaredUniforms: ['world', 'viewProjection'],
    declaredResources: [],
    manualBindings: false,
    scopedValidationErrors: [],
    uncapturedValidationErrors: [],
    deviceLosses: [],
    frameSubmitted: true,
    frameCompleted: true,
  },
  onDrain,
  onPageError,
} = {}) {
  let drained = false;
  let launchOptions = null;
  let currentPose = 'idle';
  let characterVisible = true;
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
    async screenshot() { return gatePassingPngBuffer(characterVisible, currentPose); },
    async evaluate(fn, arg) {
      const source = fn.toString();
      if (source.includes('setCharacterVisible(false)') || (typeof arg === 'boolean' && !arg)) {
        characterVisible = false;
        return undefined;
      }
      if (source.includes('setCharacterVisible(true)') || (typeof arg === 'boolean' && arg)) {
        characterVisible = true;
        return undefined;
      }
      if (source.includes('setPose') || typeof arg === 'string') {
        if (arg) currentPose = arg;
        return undefined;
      }
      if (source.includes('webgl2')) return webgl2Available ? { available: true, reason: null } : { available: false, reason: 'WebGL2 context unavailable' };
      if (source.includes('navigator.gpu')) return gpuAvailable ? { available: true, reason: null } : { available: false, reason: 'navigator.gpu is undefined' };
      if (source.includes('window.__demo.status')) return demoState;
      if (source.includes('backendProof')) return backendProof;
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

test('parseVerifyCliArgs accepts --browser-channel chromium and msedge in addition to chrome', () => {
  assert.equal(parseVerifyCliArgs(['.', '--browser-channel', 'chromium']).browserChannel, 'chromium');
  assert.equal(parseVerifyCliArgs(['.', '--browser-channel', 'msedge']).browserChannel, 'msedge');
});

test('parseVerifyCliArgs accepts --browser-executable <path>', () => {
  const parsed = parseVerifyCliArgs(['.', '--browser-executable', 'C:\\Program Files\\Chrome\\chrome.exe']);
  assert.equal(parsed.browserExecutable, 'C:\\Program Files\\Chrome\\chrome.exe');
});

test('parseVerifyCliArgs rejects combining --browser-channel and --browser-executable', () => {
  assert.throws(() => parseVerifyCliArgs(['.', '--browser-channel', 'chrome', '--browser-executable', 'x']), /cannot combine/i);
});

test('parseVerifyCliArgs accepts --external-server <url> and does not spawn a dev server', () => {
  const parsed = parseVerifyCliArgs(['.', '--external-server', 'http://localhost:5173']);
  assert.equal(parsed.externalServer, 'http://localhost:5173');
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
  const project = makeProject({ evidenceMutator: (evidence) => { evidence.stages[0].status = 'not-started'; } });
  try {
    const result = await run(project, null, { skipBrowser: true });
    assert.equal(result.status, 'failed');
    assert.equal(result.pass, false);
    assert.ok(result.failures.some((message) => /incomplete verification/i.test(message)));
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

test('parseVerifyCliArgs accepts --stage with a canonical stage id', () => {
  const parsed = parseVerifyCliArgs(['.', '--stage', 'backend-proof']);
  assert.equal(parsed.stage, 'backend-proof');
});

test('parseVerifyCliArgs rejects an unknown --stage value', () => {
  assert.throws(() => parseVerifyCliArgs(['.', '--stage', 'not-a-stage']), /Unsupported --stage/);
});

test('parseVerifyCliArgs defaults --stage to null (whole-slice mode)', () => {
  const parsed = parseVerifyCliArgs(['.']);
  assert.equal(parsed.stage, null);
});

test('stage backend-proof does not require terrain or character evidence to pass', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright();
  try {
    const result = await run(project, fake, { stage: 'backend-proof' });
    assert.equal(result.status, 'passed', JSON.stringify(result.failures));
  } finally {
    cleanup(project);
  }
});

test('stage backend-proof fails when backendProof() reports a mismatched backend, manual bindings, or a nonempty validation-error list', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright({
    backendProof: {
      engineInitialized: true,
      activeBackend: 'webgl2', // mismatched: contract requires babylon-webgpu
      activeShaderLanguage: 'wgsl',
      materialCompilationAttempted: true,
      materialCompiledAgainstMesh: true,
      materialReady: true,
      requiredAttributes: ['position', 'normal'],
      presentVertexBuffers: { position: true, normal: true },
      declaredUniforms: ['world', 'viewProjection'],
      declaredResources: [],
      manualBindings: true, // forbidden
      scopedValidationErrors: ['pipeline creation failed'], // must be empty
      uncapturedValidationErrors: [],
      deviceLosses: [],
      frameSubmitted: true,
      frameCompleted: true,
    },
  });
  try {
    const result = await run(project, fake, { stage: 'backend-proof' });
    assert.equal(result.status, 'failed');
    assert.ok(result.failures.some((f) => /activeBackend/.test(f)));
    assert.ok(result.failures.some((f) => /manualBindings/.test(f)));
    assert.ok(result.failures.some((f) => /scopedValidationErrors/.test(f)));
  } finally {
    cleanup(project);
  }
});

test('stage terrain-kernel does not require character or mechanic captures', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright();
  try {
    const result = await run(project, fake, { stage: 'terrain-kernel' });
    assert.equal(result.status, 'passed', JSON.stringify(result.failures));
  } finally {
    cleanup(project);
  }
});

test('stage environment-composition passes when evidence and artifacts are valid', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright();
  try {
    const result = await run(project, fake, { stage: 'environment-composition' });
    assert.equal(result.status, 'passed', JSON.stringify(result.failures));
  } finally {
    cleanup(project);
  }
});

test('stage character-locomotion requires idle and locomotion captures', async () => {
  const project = makeProject();
  const fake = makeFakePlaywright();
  const shotsDir = path.join(project.dir, 'screenshots');
  fs.mkdirSync(shotsDir, { recursive: true });
  fs.writeFileSync(path.join(shotsDir, 'environment_only.png'), gatePassingPngBuffer(false));
  try {
    const result = await run(project, fake, { stage: 'character-locomotion' });
    assert.equal(result.status, 'passed', JSON.stringify(result.failures));
  } finally {
    cleanup(project);
  }
});

test('stage mechanic-final-polish requires mechanic capture and prior stages passed in evidence', async () => {
  const project = makeProject({
    evidenceMutator: (ev) => {
      ev.stages[0].status = 'not-started';
    },
  });
  const fake = makeFakePlaywright();
  try {
    const result = await run(project, fake, { stage: 'mechanic-final-polish' });
    assert.equal(result.status, 'failed');
    assert.ok(result.failures.some((f) => /prior stage|has not passed/i.test(f)));
  } finally {
    cleanup(project);
  }
});

test('no-stage (final) mode requires all five stages passed in evidence', async () => {
  const project = makeProject({
    evidenceMutator: (ev) => {
      ev.stages[0].status = 'not-started';
    },
  });
  const fake = makeFakePlaywright();
  try {
    const result = await run(project, fake, { stage: null });
    assert.equal(result.status, 'failed');
  } finally {
    cleanup(project);
  }
});
