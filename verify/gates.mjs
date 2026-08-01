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

const REQUIRED_POSES = Object.freeze(['idle', 'locomotion', 'mechanic']);

function isValidImage(img) {
  if (!img || typeof img !== 'object') return false;
  const { width, height, data } = img;
  if (typeof width !== 'number' || !Number.isInteger(width) || width <= 0) return false;
  if (typeof height !== 'number' || !Number.isInteger(height) || height <= 0) return false;
  if (!data) return false;
  const len = typeof data.length === 'number' ? data.length : data.byteLength;
  if (typeof len !== 'number' || len !== width * height * 4) return false;
  return true;
}

/**
 * Run every gate over a captured run.
 * @returns {{pass: boolean, failures: string[], info: string[], metrics: object}}
 */
export function evaluateGates({ frames, cameraDepthM, frameStats }) {
  const failures = [];
  const info = [];
  const metricFrames = [];

  // 1. Validate pose list completeness and uniqueness
  if (!Array.isArray(frames) || frames.length === 0) {
    failures.push(
      'no frames captured — window.__demo.setPose() produced nothing to inspect. Verification cannot pass on an empty capture.',
    );
  } else {
    const seenPoses = new Set();
    for (const frame of frames) {
      const name = frame?.name;
      if (!name || !REQUIRED_POSES.includes(name)) {
        failures.push(`unknown or missing pose name "${name}" in captured frames.`);
      } else if (seenPoses.has(name)) {
        failures.push(`duplicate captured frame for pose "${name}". Each pose must be captured exactly once.`);
      } else {
        seenPoses.add(name);
      }
    }
    for (const reqPose of REQUIRED_POSES) {
      if (!seenPoses.has(reqPose)) {
        failures.push(`missing required captured pose "${reqPose}". Verification requires all three poses: idle, locomotion, mechanic.`);
      }
    }
  }

  // 2. Validate numeric inputs
  if (typeof cameraDepthM !== 'number' || !Number.isFinite(cameraDepthM) || cameraDepthM < 0) {
    failures.push(
      `window.__demo.cameraNearestDepth() returned ${JSON.stringify(cameraDepthM)} instead of a finite non-negative number — the camera-clipping gate cannot run. Implement it to return metres.`,
    );
  }
  if (typeof frameStats?.medianMs !== 'number' || !Number.isFinite(frameStats.medianMs) || frameStats.medianMs < 0) {
    failures.push(
      `window.__demo.frameStats() is missing a finite non-negative "medianMs" — got ${JSON.stringify(frameStats?.medianMs)}.`,
    );
  }
  if (typeof frameStats?.p99Ms !== 'number' || !Number.isFinite(frameStats.p99Ms) || frameStats.p99Ms < 0) {
    failures.push(
      `window.__demo.frameStats() is missing a finite non-negative "p99Ms" — got ${JSON.stringify(frameStats?.p99Ms)}.`,
    );
  }
  if (typeof frameStats?.samples !== 'number' || !Number.isInteger(frameStats.samples) || frameStats.samples < 1) {
    failures.push(
      `window.__demo.frameStats() is missing a positive integer "samples" — got ${JSON.stringify(frameStats?.samples)}.`,
    );
  }

  // 3. Evaluate each frame record
  for (const { name, image, imageWithoutCharacter } of frames ?? []) {
    const validImg = isValidImage(image);
    const validImgNoChar = isValidImage(imageWithoutCharacter);

    if (!validImg) {
      failures.push(`[${name ?? 'unknown'}] missing or malformed image data (requires positive dimensions and RGBA buffer of width*height*4).`);
    }
    if (!validImgNoChar) {
      failures.push(`[${name ?? 'unknown'}] missing or malformed imageWithoutCharacter data (character removal screenshot is required for occlusion/visibility gating).`);
    }

    let lum = null;
    let flat = null;
    let charFraction = null;

    if (validImg) {
      lum = meanLuminance(image);
      flat = flatFrameRatio(image);
      info.push(`[${name}] mean luminance ${lum.toFixed(3)}`);
      if (lum < THRESHOLDS.meanLuminanceMin || lum > THRESHOLDS.meanLuminanceMax) {
        failures.push(
          `[${name}] mean luminance ${lum.toFixed(3)} outside [${THRESHOLDS.meanLuminanceMin}, ${THRESHOLDS.meanLuminanceMax}] — frame is near-black or blown out.`,
        );
      }

      if (flat > THRESHOLDS.flatFrameMaxRatio) {
        failures.push(
          `[${name}] ${(flat * 100).toFixed(0)}% of pixels share one luminance bucket (cap ${THRESHOLDS.flatFrameMaxRatio * 100}%) — frame is effectively blank.`,
        );
      }
    }

    if (validImg && validImgNoChar) {
      try {
        charFraction = changedAreaFraction(image, imageWithoutCharacter);
        info.push(`[${name}] character covers ${(charFraction * 100).toFixed(1)}% of frame`);
        if (charFraction < THRESHOLDS.characterAreaMin) {
          failures.push(
            `[${name}] character covers ${(charFraction * 100).toFixed(1)}% of frame (floor ${THRESHOLDS.characterAreaMin * 100}%) — character is missing, off-screen, or occluded.`,
          );
        } else if (charFraction > THRESHOLDS.characterAreaMax) {
          failures.push(
            `[${name}] character covers ${(charFraction * 100).toFixed(1)}% of frame (cap ${THRESHOLDS.characterAreaMax * 100}%) — camera is too close to read the environment.`,
          );
        }
      } catch (err) {
        failures.push(`[${name}] failed to calculate character area fraction: ${err.message}`);
      }
    }

    metricFrames.push({
      name: name ?? 'unknown',
      meanLuminance: typeof lum === 'number' && Number.isFinite(lum) ? lum : null,
      flatFrameRatio: typeof flat === 'number' && Number.isFinite(flat) ? flat : null,
      characterAreaFraction: typeof charFraction === 'number' && Number.isFinite(charFraction) ? charFraction : null,
    });
  }

  if (Number.isFinite(cameraDepthM) && cameraDepthM >= 0 && cameraDepthM < THRESHOLDS.cameraMinDepthM) {
    failures.push(
      `camera nearest depth ${cameraDepthM.toFixed(2)} m below ${THRESHOLDS.cameraMinDepthM} m — camera is inside geometry.`,
    );
  }

  if (Number.isFinite(frameStats?.medianMs) && Number.isFinite(frameStats?.p99Ms) && frameStats?.samples >= 1) {
    info.push(
      `frame time: median ${frameStats.medianMs.toFixed(1)} ms, p99 ${frameStats.p99Ms.toFixed(1)} ms over ${frameStats.samples} samples (informational — headless timing is not gated)`,
    );
  }

  const metrics = {
    frames: metricFrames,
    cameraNearestDepthM: typeof cameraDepthM === 'number' && Number.isFinite(cameraDepthM) && cameraDepthM >= 0 ? cameraDepthM : null,
    frameStats: {
      medianMs: typeof frameStats?.medianMs === 'number' && Number.isFinite(frameStats.medianMs) && frameStats.medianMs >= 0 ? frameStats.medianMs : null,
      p99Ms: typeof frameStats?.p99Ms === 'number' && Number.isFinite(frameStats.p99Ms) && frameStats.p99Ms >= 0 ? frameStats.p99Ms : null,
      samples: typeof frameStats?.samples === 'number' && Number.isInteger(frameStats.samples) && frameStats.samples >= 1 ? frameStats.samples : null,
    },
  };

  return { pass: failures.length === 0, failures, info, metrics };
}
