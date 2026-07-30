/**
 * Pure image gates. Every function takes {width, height, data} where data is
 * RGBA bytes, so unit tests use synthetic buffers and the browser run passes
 * Playwright screenshots through the same code.
 *
 * Frame time is REPORTED, never gated: verification runs headless, often on
 * software rendering, so a frame time here says nothing about the target
 * machine. Gating on it would fail every honest run.
 */

export const THRESHOLDS = Object.freeze({
  meanLuminanceMin: 0.12,
  meanLuminanceMax: 0.85,
  flatFrameMaxRatio: 0.70,
  characterAreaMin: 0.03,
  characterAreaMax: 0.20,
  cameraMinDepthM: 0.30,
});

// Perceptual weights on non-linear sRGB. Deliberately not linearised: this
// measures apparent brightness of a rendered frame, not physical luminance.
const lumAt = (data, i) =>
  (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;

/** Average apparent brightness, 0..1. */
export function meanLuminance({ data, width, height }) {
  let sum = 0;
  const n = width * height;
  for (let p = 0; p < n; p++) sum += lumAt(data, p * 4);
  return sum / n;
}

/**
 * Fraction of pixels sharing the single most common luminance bucket.
 * A blank, black, or blown-out frame concentrates in one bucket.
 */
export function flatFrameRatio({ data, width, height }, bucketCount = 50) {
  const buckets = new Uint32Array(bucketCount);
  const n = width * height;
  for (let p = 0; p < n; p++) {
    const b = Math.min(bucketCount - 1, Math.floor(lumAt(data, p * 4) * bucketCount));
    buckets[b]++;
  }
  return Math.max(...buckets) / n;
}

/** Fraction of pixels whose luminance differs by more than `threshold`. */
export function changedAreaFraction(a, b, threshold = 0.02) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `Cannot diff images of different size: ${a.width}x${a.height} vs ${b.width}x${b.height}`,
    );
  }
  let changed = 0;
  const n = a.width * a.height;
  for (let p = 0; p < n; p++) {
    if (Math.abs(lumAt(a.data, p * 4) - lumAt(b.data, p * 4)) > threshold) changed++;
  }
  return changed / n;
}

/**
 * Run every gate over a captured run.
 * @returns {{pass: boolean, failures: string[], info: string[]}}
 */
export function evaluateGates({ frames, cameraDepthM, frameStats }) {
  const failures = [];
  const info = [];

  // Guard the inputs before gating on them. Every numeric comparison below is
  // false for NaN and undefined, so a hook that returns nothing would sail
  // through every threshold and report success — exactly the vacuous pass this
  // module exists to eliminate. An empty frame list is the same failure: zero
  // frames trivially satisfy zero image gates.
  if (!Array.isArray(frames) || frames.length === 0) {
    failures.push(
      'no frames captured — window.__demo.setPose() produced nothing to inspect. Verification cannot pass on an empty capture.',
    );
  }
  if (typeof cameraDepthM !== 'number' || !Number.isFinite(cameraDepthM)) {
    failures.push(
      `window.__demo.cameraNearestDepth() returned ${JSON.stringify(cameraDepthM)} instead of a finite number — the camera-clipping gate cannot run. Implement it to return metres.`,
    );
  }
  for (const key of ['medianMs', 'p99Ms', 'samples']) {
    if (typeof frameStats?.[key] !== 'number' || !Number.isFinite(frameStats[key])) {
      failures.push(
        `window.__demo.frameStats() is missing a finite "${key}" — got ${JSON.stringify(frameStats?.[key])}. Frame time is informational, but a malformed hook is still a defect.`,
      );
    }
  }

  for (const { name, image, imageWithoutCharacter } of frames ?? []) {
    const lum = meanLuminance(image);
    info.push(`[${name}] mean luminance ${lum.toFixed(3)}`);
    if (lum < THRESHOLDS.meanLuminanceMin || lum > THRESHOLDS.meanLuminanceMax) {
      failures.push(
        `[${name}] mean luminance ${lum.toFixed(3)} outside [${THRESHOLDS.meanLuminanceMin}, ${THRESHOLDS.meanLuminanceMax}] — frame is near-black or blown out.`,
      );
    }

    const flat = flatFrameRatio(image);
    if (flat > THRESHOLDS.flatFrameMaxRatio) {
      failures.push(
        `[${name}] ${(flat * 100).toFixed(0)}% of pixels share one luminance bucket (cap ${THRESHOLDS.flatFrameMaxRatio * 100}%) — frame is effectively blank.`,
      );
    }

    if (imageWithoutCharacter) {
      const area = changedAreaFraction(image, imageWithoutCharacter);
      info.push(`[${name}] character covers ${(area * 100).toFixed(1)}% of frame`);
      if (area < THRESHOLDS.characterAreaMin) {
        failures.push(
          `[${name}] character covers ${(area * 100).toFixed(1)}% of frame (floor ${THRESHOLDS.characterAreaMin * 100}%) — character is missing, off-screen, or occluded.`,
        );
      } else if (area > THRESHOLDS.characterAreaMax) {
        failures.push(
          `[${name}] character covers ${(area * 100).toFixed(1)}% of frame (cap ${THRESHOLDS.characterAreaMax * 100}%) — camera is too close to read the environment.`,
        );
      }
    }
  }

  if (Number.isFinite(cameraDepthM) && cameraDepthM < THRESHOLDS.cameraMinDepthM) {
    failures.push(
      `camera nearest depth ${cameraDepthM.toFixed(2)} m below ${THRESHOLDS.cameraMinDepthM} m — camera is inside geometry.`,
    );
  }

  // Reported only. See the module comment. Guarded so a malformed hook yields
  // the diagnosis pushed above rather than a TypeError from toFixed().
  if (Number.isFinite(frameStats?.medianMs) && Number.isFinite(frameStats?.p99Ms)) {
    info.push(
      `frame time: median ${frameStats.medianMs.toFixed(1)} ms, p99 ${frameStats.p99Ms.toFixed(1)} ms over ${frameStats.samples} samples (informational — headless timing is not gated)`,
    );
  }

  return { pass: failures.length === 0, failures, info };
}
