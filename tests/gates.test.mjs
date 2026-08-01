import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import {
  meanLuminance, flatFrameRatio, changedAreaFraction, evaluateGates, THRESHOLDS,
} from '../verify/gates.mjs';
import { solid, gradient, withBlob } from './fixtures/make-synthetic.mjs';

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

// --- The regression the rewrite exists for -------------------------------

test('the real black frame from the reference run FAILS the gates', () => {
  const result = evaluateGates({
    frames: [{ name: 'locomotion', image: decode('real-black-frame.png') }],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false, 'the old script passed this frame; the new one must not');
  assert.ok(
    result.failures.some((f) => /luminance|flat/i.test(f)),
    `expected a luminance or flat-frame failure, got: ${result.failures.join(' | ')}`,
  );
});

// --- Character visibility ------------------------------------------------

test('a character occupying 8% of frame passes', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, true, result.failures.join(' | '));
});

test('an invisible character fails', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: base, imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /character/i.test(f)));
});

test('a character filling half the frame fails (camera too close)', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: withBlob(base, 0.5), imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
});

test('a camera inside geometry fails', () => {
  const result = evaluateGates({
    frames: [{ name: 'idle', image: gradient(64, 64) }],
    cameraDepthM: 0.05,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /camera/i.test(f)));
});

// --- Performance is reported, never gated -------------------------------

test('terrible frame times are reported but do not fail the run', () => {
  const result = evaluateGates({
    frames: [{ name: 'idle', image: gradient(64, 64) }],
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
// Every numeric comparison is false for NaN and undefined, so without explicit
// guards a hook that returns nothing sails through every gate.

test('a NaN camera depth fails instead of passing silently', () => {
  const result = evaluateGates({
    frames: [{ name: 'idle', image: gradient(64, 64) }],
    cameraDepthM: NaN,
    frameStats: okStats,
  });
  assert.equal(result.pass, false, 'NaN < 0.30 is false — this must not pass');
  assert.ok(result.failures.some((f) => /cameraNearestDepth/.test(f)));
});

test('an undefined camera depth fails instead of passing silently', () => {
  const result = evaluateGates({
    frames: [{ name: 'idle', image: gradient(64, 64) }],
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
    frames: [{ name: 'idle', image: gradient(64, 64) }],
    cameraDepthM: 5,
    frameStats: { medianMs: 11 },   // missing p99Ms and samples
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /frameStats/.test(f)));
  // Must not crash on toFixed of undefined.
  assert.ok(Array.isArray(result.info));
});

test('evaluateGates returns structured metrics matching image measurements', () => {
  const base = gradient(200, 200);
  const imgWithChar = withBlob(base, 0.08);
  const result = evaluateGates({
    frames: [
      { name: 'idle', image: imgWithChar, imageWithoutCharacter: base },
      { name: 'locomotion', image: base },
    ],
    cameraDepthM: 1.5,
    frameStats: { medianMs: 12, p99Ms: 18, samples: 600 },
  });

  assert.ok(result.metrics, 'metrics must be present');
  assert.equal(result.metrics.cameraNearestDepthM, 1.5);
  assert.deepEqual(result.metrics.frameStats, { medianMs: 12, p99Ms: 18, samples: 600 });
  assert.equal(result.metrics.frames.length, 2);

  const idleMetric = result.metrics.frames[0];
  assert.equal(idleMetric.name, 'idle');
  assert.ok(Math.abs(idleMetric.meanLuminance - meanLuminance(imgWithChar)) < 1e-6);
  assert.ok(Math.abs(idleMetric.flatFrameRatio - flatFrameRatio(imgWithChar)) < 1e-6);
  assert.ok(Math.abs(idleMetric.characterAreaFraction - changedAreaFraction(imgWithChar, base)) < 1e-6);

  const locoMetric = result.metrics.frames[1];
  assert.equal(locoMetric.name, 'locomotion');
  assert.equal(locoMetric.characterAreaFraction, null);
});

test('evaluateGates metrics replaces non-finite values with null', () => {
  const result = evaluateGates({
    frames: [{ name: 'idle', image: gradient(64, 64) }],
    cameraDepthM: NaN,
    frameStats: { medianMs: Infinity, p99Ms: undefined, samples: 100 },
  });

  assert.equal(result.metrics.cameraNearestDepthM, null);
  assert.equal(result.metrics.frameStats.medianMs, null);
  assert.equal(result.metrics.frameStats.p99Ms, null);
  assert.equal(result.metrics.frameStats.samples, 100);
});
