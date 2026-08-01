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

const makeValidSyntheticThreePoses = () => {
  const base = gradient(300, 300);
  return [
    { name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base },
    { name: 'locomotion', image: withBlob(base, 0.08), imageWithoutCharacter: base },
    { name: 'mechanic', image: withBlob(base, 0.08), imageWithoutCharacter: base },
  ];
};

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
