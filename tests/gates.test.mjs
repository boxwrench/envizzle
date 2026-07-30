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
