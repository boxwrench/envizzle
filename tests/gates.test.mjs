import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import {
  meanLuminance, flatFrameRatio, changedAreaFraction, evaluateGates, THRESHOLDS,
} from '../verify/gates.mjs';
import { verifyDemo, verificationExitCode } from '../verify/verify_demo.mjs';
import { solid, gradient, withBlob } from './fixtures/make-synthetic.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const REQUIRED_STUB_PATHS = ['index.html', 'package.json', 'vite.config.js', 'DECISIONS.md', 'PERF.md', 'src/main.js'];

const makeStubProject = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envizzle-verify-demo-'));
  for (const rel of REQUIRED_STUB_PATHS) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '', 'utf8');
  }
  return dir;
};

const decode = (name) => {
  const png = PNG.sync.read(fs.readFileSync(`tests/fixtures/${name}`));
  return { width: png.width, height: png.height, data: png.data };
};
const okStats = { medianMs: 11, p99Ms: 15, samples: 600 };

test('meanLuminance is 0 for black and 1 for white', () => {
  assert.ok(meanLuminance(solid(8, 8, [0, 0, 0])) < 0.001);
  assert.ok(meanLuminance(solid(8, 8, [255, 255, 255])) > 0.999);
});

test('flatFrameRatio is 1 for a solid fill and low for a gradient', () => {
  assert.ok(flatFrameRatio(solid(64, 64, [10, 10, 10])) > 0.99);
  assert.ok(flatFrameRatio(gradient(256, 64)) < 0.20);
});

test('changedAreaFraction measures the painted area', () => {
  const base = gradient(200, 200);
  const measured = changedAreaFraction(base, withBlob(base, 0.10));
  assert.ok(Math.abs(measured - 0.10) < 0.02, `measured ${measured}`);
});

test('changedAreaFraction is ~0 for identical images', () => {
  const base = gradient(64, 64);
  assert.ok(changedAreaFraction(base, base) < 0.001);
});

test('changedAreaFraction rejects mismatched sizes', () => {
  assert.throws(() => changedAreaFraction(gradient(8, 8), gradient(16, 16)), /different size/i);
});

// --- Character visibility ------------------------------------------------

const makeValidSyntheticThreePoses = () => {
  const base = gradient(300, 300);
  return [
    { name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base },
    { name: 'locomotion', image: withBlob(base, 0.08), imageWithoutCharacter: base },
    { name: 'mechanic', image: withBlob(base, 0.08), imageWithoutCharacter: base },
  ];
};

// --- The regression the rewrite exists for -------------------------------

test('the real black frame from the reference run FAILS the gates', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [
      { name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base },
      { name: 'locomotion', image: decode('real-black-frame.png'), imageWithoutCharacter: base },
      { name: 'mechanic', image: withBlob(base, 0.08), imageWithoutCharacter: base },
    ],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false, 'the old script passed this frame; the new one must not');
  assert.ok(
    result.failures.some((f) => /luminance|flat/i.test(f)),
    `expected a luminance or flat-frame failure, got: ${result.failures.join(' | ')}`,
  );
});

// --- Character visibility & Three-pose requirement ------------------------

test('a valid synthetic three-pose case passes', () => {
  const result = evaluateGates({
    frames: makeValidSyntheticThreePoses(),
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, true, result.failures.join(' | '));
});

test('single pose [{ name: "idle" }] cannot pass', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /missing required captured pose/i.test(f)));
});

test('an image without imageWithoutCharacter cannot pass', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [
      { name: 'idle', image: withBlob(base, 0.08) },
      { name: 'locomotion', image: withBlob(base, 0.08), imageWithoutCharacter: base },
      { name: 'mechanic', image: withBlob(base, 0.08), imageWithoutCharacter: base },
    ],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /missing or malformed imageWithoutCharacter/i.test(f)));
});

test('one valid pose cannot substitute for all three', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [
      { name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base },
      { name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base },
      { name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base },
    ],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /duplicate captured frame/i.test(f)));
});

test('duplicate poses cannot pass', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [
      { name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base },
      { name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base },
      { name: 'locomotion', image: withBlob(base, 0.08), imageWithoutCharacter: base },
    ],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /duplicate/i.test(f)));
});

test('malformed image dimensions or data cannot pass', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [
      { name: 'idle', image: { width: 0, height: 10, data: new Uint8Array(0) }, imageWithoutCharacter: base },
      { name: 'locomotion', image: withBlob(base, 0.08), imageWithoutCharacter: base },
      { name: 'mechanic', image: withBlob(base, 0.08), imageWithoutCharacter: base },
    ],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /missing or malformed image data/i.test(f)));
});

test('an invisible character fails', () => {
  const base = gradient(300, 300);
  const frames = makeValidSyntheticThreePoses();
  frames[0] = { name: 'idle', image: base, imageWithoutCharacter: base };
  const result = evaluateGates({
    frames,
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /character/i.test(f)));
});

test('a character filling half the frame fails (camera too close)', () => {
  const base = gradient(300, 300);
  const frames = makeValidSyntheticThreePoses();
  frames[0] = { name: 'idle', image: withBlob(base, 0.5), imageWithoutCharacter: base };
  const result = evaluateGates({
    frames,
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
});

test('a camera inside geometry fails', () => {
  const result = evaluateGates({
    frames: makeValidSyntheticThreePoses(),
    cameraDepthM: 0.05,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /camera/i.test(f)));
});

// --- Performance is reported, never gated -------------------------------

test('terrible frame times are reported but do not fail the run', () => {
  const result = evaluateGates({
    frames: makeValidSyntheticThreePoses(),
    cameraDepthM: 5,
    frameStats: { medianMs: 240, p99Ms: 900, samples: 100 },
  });
  assert.equal(result.pass, true, `perf must not gate; failures: ${result.failures.join(' | ')}`);
  assert.ok(result.info.some((i) => /240/.test(i)), 'median frame time not reported');
  assert.ok(result.info.some((i) => /900/.test(i)), 'p99 frame time not reported');
});

test('THRESHOLDS carries no frame-time gate', () => {
  const keys = Object.keys(THRESHOLDS).join(' ');
  assert.doesNotMatch(keys, /FrameMs|frameMs/, 'frame time must not be a threshold');
});

// --- Malformed input must never pass vacuously ---------------------------

test('a NaN camera depth fails instead of passing silently', () => {
  const result = evaluateGates({
    frames: makeValidSyntheticThreePoses(),
    cameraDepthM: NaN,
    frameStats: okStats,
  });
  assert.equal(result.pass, false, 'NaN < 0.30 is false — this must not pass');
  assert.ok(result.failures.some((f) => /cameraNearestDepth/.test(f)));
});

test('an undefined camera depth fails instead of passing silently', () => {
  const result = evaluateGates({
    frames: makeValidSyntheticThreePoses(),
    cameraDepthM: undefined,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /cameraNearestDepth/.test(f)));
});

test('an empty frame list fails instead of trivially satisfying zero gates', () => {
  const result = evaluateGates({ frames: [], cameraDepthM: 5, frameStats: okStats });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /no frames captured/i.test(f)));
});

test('malformed frameStats is diagnosed, not thrown', () => {
  const result = evaluateGates({
    frames: makeValidSyntheticThreePoses(),
    cameraDepthM: 5,
    frameStats: { medianMs: 11 },   // missing p99Ms and samples
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /frameStats/.test(f)));
  assert.ok(Array.isArray(result.info));
});

test('evaluateGates returns structured metrics matching image measurements', () => {
  const base = gradient(200, 200);
  const imgWithChar = withBlob(base, 0.08);
  const result = evaluateGates({
    frames: [
      { name: 'idle', image: imgWithChar, imageWithoutCharacter: base },
      { name: 'locomotion', image: imgWithChar, imageWithoutCharacter: base },
      { name: 'mechanic', image: base, imageWithoutCharacter: base },
    ],
    cameraDepthM: 1.5,
    frameStats: { medianMs: 12, p99Ms: 18, samples: 600 },
  });

  assert.ok(result.metrics, 'metrics must be present');
  assert.equal(result.metrics.cameraNearestDepthM, 1.5);
  assert.deepEqual(result.metrics.frameStats, { medianMs: 12, p99Ms: 18, samples: 600 });
  assert.equal(result.metrics.frames.length, 3);

  const idleMetric = result.metrics.frames[0];
  assert.equal(idleMetric.name, 'idle');
  assert.ok(Math.abs(idleMetric.meanLuminance - meanLuminance(imgWithChar)) < 1e-6);
  assert.ok(Math.abs(idleMetric.flatFrameRatio - flatFrameRatio(imgWithChar)) < 1e-6);
  assert.ok(Math.abs(idleMetric.characterAreaFraction - changedAreaFraction(imgWithChar, base)) < 1e-6);
});

// --- Verifier infrastructure-failure classification (no production build bypass) -----
//
// verify_demo.mjs always runs the real `npx vite build` gate now — there is no test-only
// escape hatch for it. To exercise infrastructure-failure paths without a real network
// fetch of vite, these tests put a temporary `npx` shim executable first on PATH: it
// genuinely answers `npx vite build` (exit 0/1) and `npx vite --port N --strictPort`
// (serve for real over HTTP, or fail) itself. This is "creating a temporary npx shim"
// per the task, not bypassing the build — the shim's build branch is a real child process
// that verify_demo.mjs's real execSync call actually invokes and inspects the exit code of.

function makeNpxShim(mode) {
  const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envizzle-npx-shim-'));
  const controllerPath = path.join(shimDir, 'npx-shim-controller.mjs');
  fs.writeFileSync(controllerPath, `
const args = process.argv.slice(2);
const mode = ${JSON.stringify(mode)};
if (args[1] === 'build') {
  if (mode === 'build-fail') { console.error('shim: build failed'); process.exit(1); }
  console.log('shim: build ok');
  process.exit(0);
}
// dev-server invocation: args like ['vite', '--port', 'N', '--strictPort']
if (mode === 'build-fail' || mode === 'serve-fail') {
  process.exit(1);
}
if (mode === 'serve-ok') {
  const portIdx = args.indexOf('--port');
  const port = Number(args[portIdx + 1]);
  const { createServer } = await import('node:http');
  const server = createServer((_req, res) => { res.end('<html><body>stub demo</body></html>'); });
  server.listen(port);
  await new Promise(() => {}); // idle until killed by the test harness
}
`, 'utf8');

  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(shimDir, 'npx.cmd'), `@echo off\r\nnode "${controllerPath}" %*\r\n`, 'utf8');
  } else {
    const shPath = path.join(shimDir, 'npx');
    fs.writeFileSync(shPath, `#!/bin/sh\nexec node "${controllerPath}" "$@"\n`, 'utf8');
    fs.chmodSync(shPath, 0o755);
  }

  return {
    dir: shimDir,
    cleanup() {
      fs.rmSync(shimDir, { recursive: true, force: true });
    },
  };
}

function withShimOnPath(shim, fn) {
  const originalPath = process.env.PATH;
  process.env.PATH = shim.dir + path.delimiter + originalPath;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      process.env.PATH = originalPath;
    });
}

function tinyPngBuffer() {
  const png = new PNG({ width: 2, height: 2 });
  png.data.fill(120);
  return PNG.sync.write(png);
}

function makeFakePlaywright({ evaluateImpl, isConnected = () => true, waitForFunctionImpl, gotoImpl }) {
  const page = {
    on() {},
    async goto(...args) {
      if (gotoImpl) return gotoImpl(...args);
    },
    async waitForFunction(...args) {
      if (waitForFunctionImpl) return waitForFunctionImpl(...args);
      return true;
    },
    async evaluate(fn, arg) {
      return evaluateImpl(fn.toString(), arg);
    },
    async waitForTimeout() {},
    async screenshot() {
      return tinyPngBuffer();
    },
  };
  const browser = {
    async newPage() {
      return page;
    },
    async close() {},
    isConnected,
  };
  return {
    chromium: {
      async launch() {
        return browser;
      },
    },
  };
}

/**
 * A fake Playwright whose screenshots are real gate-passing synthetic images
 * (same idle/locomotion/mechanic combo proven to pass in the pure-gates tests
 * above), so tests can prove a specific failure blocks success even when
 * every other gate would genuinely pass.
 */
function makeGatePassingPlaywright({ gotoImpl } = {}) {
  const base = gradient(300, 300);
  const withChar = withBlob(base, 0.08);
  let characterVisible = true;

  const toPngBuffer = (img) => {
    const png = new PNG({ width: img.width, height: img.height });
    Buffer.from(img.data).copy(png.data);
    return PNG.sync.write(png);
  };

  const page = {
    on() {},
    async goto(...args) {
      if (gotoImpl) return gotoImpl(...args);
    },
    async waitForFunction() {
      return true;
    },
    async evaluate(fn) {
      const src = fn.toString();
      if (src.includes('setCharacterVisible(false)')) {
        characterVisible = false;
        return undefined;
      }
      if (src.includes('setCharacterVisible(true)')) {
        characterVisible = true;
        return undefined;
      }
      if (src.includes('setPose')) return undefined;
      if (src.includes('cameraNearestDepth')) return 5;
      if (src.includes('frameStats')) return { medianMs: 10, p99Ms: 15, samples: 100 };
      return undefined;
    },
    async waitForTimeout() {},
    async screenshot() {
      return toPngBuffer(characterVisible ? withChar : base);
    },
  };
  const browser = {
    async newPage() {
      return page;
    },
    async close() {},
    isConnected: () => true,
  };
  return {
    chromium: {
      async launch() {
        return browser;
      },
    },
  };
}

test('adversarial test: legacy skip-build environment variable cannot bypass the build gate', () => {
  const shim = makeNpxShim('build-fail');
  const runOnce = (envExtra) => {
    const projectDir = makeStubProject();
    const reportPath = path.join(projectDir, 'verify-report.json');
    let status = 0;
    try {
      execFileSync(
        process.execPath,
        [path.join(repoRoot, 'verify', 'verify_demo.mjs'), projectDir, '--report', reportPath],
        {
          cwd: repoRoot,
          stdio: 'pipe',
          env: { ...process.env, PATH: shim.dir + path.delimiter + process.env.PATH, ...envExtra },
        },
      );
    } catch (err) {
      status = err.status;
    }
    const written = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    fs.rmSync(projectDir, { recursive: true, force: true });
    return { status, written };
  };

  try {
    const withoutEnvVar = runOnce({});
    const withEnvVar = runOnce({ __VERIFY_DEMO_TEST_SKIP_BUILD: '1' });

    // Both runs must genuinely execute the real build gate and fail identically —
    // the old bypass env var must now have zero effect.
    assert.equal(withoutEnvVar.status, 1, 'build failure is a demo defect: exit 1, not 0 or 2');
    assert.equal(withEnvVar.status, 1, 'the legacy env var must not change the outcome');
    assert.equal(withoutEnvVar.written.status, 'failed');
    assert.equal(withEnvVar.written.status, 'failed');
    assert.equal(withoutEnvVar.written.build.ok, false);
    assert.equal(withEnvVar.written.build.ok, false);
  } finally {
    shim.cleanup();
  }
});

test('adversarial test: server readiness failure is classified as status: error (exit 2), not a demo defect', async () => {
  const shim = makeNpxShim('serve-fail');
  const projectDir = makeStubProject();
  try {
    const reportPath = path.join(projectDir, 'verify-report.json');
    const result = await withShimOnPath(shim, () =>
      verifyDemo(projectDir, {
        reportPath,
        screenshotsDir: path.join(projectDir, 'screenshots'),
        silent: true,
        serverReadyTimeoutMs: 800,
      }));

    assert.equal(result.status, 'error', `expected operational error, got status '${result.status}'`);
    assert.equal(result.report.gates.pass, false);
    assert.equal(result.pass, false);
    assert.ok(
      result.failures.some((f) => /server|connection|port/i.test(f)),
      `expected an operational server/port failure string, got: ${result.failures.join(' | ')}`,
    );

    const written = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(written.status, 'error');
    assert.equal(written.gates.pass, false);
  } finally {
    shim.cleanup();
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('adversarial test: setPose throwing is a demo defect (status: failed), not an operational error', async () => {
  const shim = makeNpxShim('serve-ok');
  const projectDir = makeStubProject();
  try {
    const reportPath = path.join(projectDir, 'verify-report.json');
    const fakePlaywright = makeFakePlaywright({
      evaluateImpl(src) {
        if (src.includes('setPose')) throw new Error('Injected: window.__demo.setPose threw');
        if (src.includes('setCharacterVisible')) return undefined;
        if (src.includes('cameraNearestDepth')) return 5;
        if (src.includes('frameStats')) return { medianMs: 10, p99Ms: 15, samples: 100 };
        return undefined;
      },
    });

    const result = await withShimOnPath(shim, () =>
      verifyDemo(projectDir, {
        reportPath,
        screenshotsDir: path.join(projectDir, 'screenshots'),
        silent: true,
        serverReadyTimeoutMs: 5000,
        playwright: fakePlaywright,
      }));

    assert.equal(result.status, 'failed', `setPose throwing must be a demo defect (status: failed), got '${result.status}'`);
    assert.equal(result.pass, false);
    assert.ok(
      result.failures.some((f) => /setPose|demo pose\/visibility hook/i.test(f)),
      `expected a setPose failure message, got: ${result.failures.join(' | ')}`,
    );
  } finally {
    shim.cleanup();
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('adversarial test: camera/frame-stat hook throwing is a demo defect (status: failed), not an operational error', async () => {
  const shim = makeNpxShim('serve-ok');
  const projectDir = makeStubProject();
  try {
    const reportPath = path.join(projectDir, 'verify-report.json');
    const fakePlaywright = makeFakePlaywright({
      evaluateImpl(src) {
        if (src.includes('setPose')) return undefined;
        if (src.includes('setCharacterVisible')) return undefined;
        if (src.includes('cameraNearestDepth')) throw new Error('Injected: window.__demo.cameraNearestDepth threw');
        if (src.includes('frameStats')) return { medianMs: 10, p99Ms: 15, samples: 100 };
        return undefined;
      },
    });

    const result = await withShimOnPath(shim, () =>
      verifyDemo(projectDir, {
        reportPath,
        screenshotsDir: path.join(projectDir, 'screenshots'),
        silent: true,
        serverReadyTimeoutMs: 5000,
        playwright: fakePlaywright,
      }));

    assert.equal(result.status, 'failed', `camera hook throwing must be a demo defect (status: failed), got '${result.status}'`);
    assert.equal(result.pass, false);
    assert.ok(
      result.failures.some((f) => /camera\/frame-stat hook/i.test(f)),
      `expected a camera/frame-stat hook failure message, got: ${result.failures.join(' | ')}`,
    );
    // The three pose captures still happened before the camera hook ran.
    assert.equal(result.report.captures.length, 3);
  } finally {
    shim.cleanup();
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('adversarial test: browser disconnecting mid-capture is classified as status: error, not a demo defect', async () => {
  const shim = makeNpxShim('serve-ok');
  const projectDir = makeStubProject();
  try {
    const reportPath = path.join(projectDir, 'verify-report.json');
    const fakePlaywright = makeFakePlaywright({
      isConnected: () => false, // simulate a genuinely crashed/disconnected browser
      evaluateImpl(src) {
        if (src.includes('setPose')) throw new Error('Target closed');
        return undefined;
      },
    });

    const result = await withShimOnPath(shim, () =>
      verifyDemo(projectDir, {
        reportPath,
        screenshotsDir: path.join(projectDir, 'screenshots'),
        silent: true,
        serverReadyTimeoutMs: 5000,
        playwright: fakePlaywright,
      }));

    assert.equal(result.status, 'error', `a disconnected browser must be operational (status: error), got '${result.status}'`);
    assert.equal(result.report.gates.pass, false);
  } finally {
    shim.cleanup();
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// --- verificationExitCode: pure exit-code policy helper, used by the CLI --------------
//
// The CLI must derive its process.exit() code from this same function, so these tests
// prove actual exit-code policy without launching a browser, real or otherwise, and
// without caring whether Chromium happens to be installed on the machine running them.

test('verificationExitCode: status "error" always maps to exit 2', () => {
  assert.equal(verificationExitCode({ status: 'error', pass: false }), 2);
  assert.equal(verificationExitCode({ status: 'error', pass: true }), 2);
});

test('verificationExitCode: status "passed" with pass true maps to exit 0', () => {
  assert.equal(verificationExitCode({ status: 'passed', pass: true }), 0);
});

test('verificationExitCode: status "failed" maps to exit 1', () => {
  assert.equal(verificationExitCode({ status: 'failed', pass: false }), 1);
});

test('verificationExitCode: passed status with pass false (contradictory) still maps to exit 1, not 0', () => {
  assert.equal(verificationExitCode({ status: 'passed', pass: false }), 1);
});

test('adversarial test: injected browser-launch failure maps to status error and exit code 2, without launching a real browser', async () => {
  const shim = makeNpxShim('serve-ok');
  const projectDir = makeStubProject();
  try {
    const reportPath = path.join(projectDir, 'verify-report.json');
    const failingPlaywright = {
      chromium: {
        async launch() {
          throw new Error('Injected: chromium.launch() failed');
        },
      },
    };

    const result = await withShimOnPath(shim, () =>
      verifyDemo(projectDir, {
        reportPath,
        screenshotsDir: path.join(projectDir, 'screenshots'),
        silent: true,
        serverReadyTimeoutMs: 5000,
        playwright: failingPlaywright,
      }));

    assert.equal(result.status, 'error', `injected launch failure must be operational (status: error), got '${result.status}'`);
    assert.equal(verificationExitCode(result), 2);

    const written = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(written.status, 'error');
    assert.equal(written.gates.pass, false);
  } finally {
    shim.cleanup();
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// --- Hook-readiness disconnect classification -------------------------------------

test('adversarial test: disconnected browser during hook readiness is classified as status error (exit 2), not a demo failure', async () => {
  const shim = makeNpxShim('serve-ok');
  const projectDir = makeStubProject();
  try {
    const reportPath = path.join(projectDir, 'verify-report.json');
    const fakePlaywright = makeFakePlaywright({
      isConnected: () => false,
      waitForFunctionImpl: async () => {
        throw new Error('Target closed');
      },
      evaluateImpl() {
        return undefined;
      },
    });

    const result = await withShimOnPath(shim, () =>
      verifyDemo(projectDir, {
        reportPath,
        screenshotsDir: path.join(projectDir, 'screenshots'),
        silent: true,
        serverReadyTimeoutMs: 5000,
        playwright: fakePlaywright,
      }));

    assert.equal(result.status, 'error', `a disconnected browser during hook readiness must be operational (status: error), got '${result.status}'`);
    assert.equal(result.pass, false);
    assert.equal(verificationExitCode(result), 2);
  } finally {
    shim.cleanup();
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('adversarial test: connected browser with hook readiness timeout is classified as status failed (exit 1), a demo defect', async () => {
  const shim = makeNpxShim('serve-ok');
  const projectDir = makeStubProject();
  try {
    const reportPath = path.join(projectDir, 'verify-report.json');
    const fakePlaywright = makeFakePlaywright({
      waitForFunctionImpl: async () => {
        throw new Error('Timeout 30000ms exceeded');
      },
      evaluateImpl() {
        return undefined;
      },
    });

    const result = await withShimOnPath(shim, () =>
      verifyDemo(projectDir, {
        reportPath,
        screenshotsDir: path.join(projectDir, 'screenshots'),
        silent: true,
        serverReadyTimeoutMs: 5000,
        playwright: fakePlaywright,
      }));

    assert.equal(result.status, 'failed', `a connected browser with hook timeout must be a demo defect (status: failed), got '${result.status}'`);
    assert.equal(result.pass, false);
    assert.equal(verificationExitCode(result), 1);
    assert.ok(result.failures.some((f) => /hook missing or never became ready/i.test(f)));
  } finally {
    shim.cleanup();
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// --- Every recorded demo failure must block success -------------------------------

test('adversarial test: connected page.goto() failure blocks success even when every later gate would pass', async () => {
  const shim = makeNpxShim('serve-ok');
  const projectDir = makeStubProject();
  try {
    const reportPath = path.join(projectDir, 'verify-report.json');
    const fakePlaywright = makeGatePassingPlaywright({
      gotoImpl: async () => {
        throw new Error('net::ERR_CONNECTION_REFUSED');
      },
    });

    const result = await withShimOnPath(shim, () =>
      verifyDemo(projectDir, {
        reportPath,
        screenshotsDir: path.join(projectDir, 'screenshots'),
        silent: true,
        serverReadyTimeoutMs: 5000,
        playwright: fakePlaywright,
      }));

    assert.equal(result.status, 'failed', 'a navigation failure must block success even when hooks and gates would otherwise pass');
    assert.equal(result.pass, false);
    assert.equal(verificationExitCode(result), 1);
    assert.ok(
      result.report.gates.failures.some((f) => /Failed to load demo page/i.test(f)),
      `expected the navigation failure inside report.gates.failures, got: ${result.report.gates.failures.join(' | ')}`,
    );
    assert.equal(result.report.captures.length, 3, 'later captures must still have succeeded, proving the navigation failure alone caused the block');
    assert.equal(result.report.runtime.hookReady, true, 'hook readiness must still have succeeded, proving the navigation failure alone caused the block');
  } finally {
    shim.cleanup();
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});
