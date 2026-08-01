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
  environmentLocalLuminanceVariationMin: 0.006,
  environmentEdgeDensityMin: 0.012,
  environmentBlockSize: 16,
  poseIdleLocomotionMinChangedArea: 0.015,
  poseIdleMechanicMinChangedArea: 0.020,
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

/** Average within-block luminance standard deviation, a local-detail measure. */
export function localLuminanceVariation({ data, width, height }, blockSize = THRESHOLDS.environmentBlockSize) {
  let total = 0;
  let blocks = 0;
  for (let y0 = 0; y0 < height; y0 += blockSize) {
    for (let x0 = 0; x0 < width; x0 += blockSize) {
      let count = 0;
      let sum = 0;
      let sumSq = 0;
      for (let y = y0; y < Math.min(height, y0 + blockSize); y++) {
        for (let x = x0; x < Math.min(width, x0 + blockSize); x++) {
          const value = lumAt(data, (y * width + x) * 4);
          count++;
          sum += value;
          sumSq += value * value;
        }
      }
      if (count > 1) total += Math.sqrt(Math.max(0, sumSq / count - (sum / count) ** 2));
      blocks++;
    }
  }
  return blocks > 0 ? total / blocks : 0;
}

/** Fraction of neighbouring pixel comparisons with a visible luminance edge. */
export function edgeDensity({ data, width, height }, edgeThreshold = 0.035) {
  let edges = 0;
  let comparisons = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const here = lumAt(data, (y * width + x) * 4);
      if (x + 1 < width) {
        comparisons++;
        if (Math.abs(here - lumAt(data, (y * width + x + 1) * 4)) >= edgeThreshold) edges++;
      }
      if (y + 1 < height) {
        comparisons++;
        if (Math.abs(here - lumAt(data, ((y + 1) * width + x) * 4)) >= edgeThreshold) edges++;
      }
    }
  }
  return comparisons > 0 ? edges / comparisons : 0;
}

function exactObjectKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value)) === JSON.stringify(expected);
}

export function validateRendererDiagnostics(diagnostics, expected) {
  const errors = [];
  const keys = ['backend', 'shaderLanguage', 'materialsReady', 'renderedFrames', 'validationErrors'];
  if (!exactObjectKeys(diagnostics, keys)) {
    errors.push(`rendererInfo() must contain exact keys [${keys.join(', ')}]`);
    return errors;
  }
  if (diagnostics.backend !== expected?.backend) errors.push(`rendererInfo().backend must be '${expected?.backend}'`);
  if (diagnostics.shaderLanguage !== expected?.shaderLanguage) errors.push(`rendererInfo().shaderLanguage must be '${expected?.shaderLanguage}'`);
  if (diagnostics.materialsReady !== true) errors.push('rendererInfo().materialsReady must be true after forced material compilation');
  if (typeof diagnostics.renderedFrames !== 'number' || !Number.isInteger(diagnostics.renderedFrames) || diagnostics.renderedFrames < 1) errors.push('rendererInfo().renderedFrames must be a positive integer');
  if (!Array.isArray(diagnostics.validationErrors)) errors.push('rendererInfo().validationErrors must be an array');
  else if (diagnostics.validationErrors.length > 0) errors.push(`rendererInfo().validationErrors must be empty, got ${diagnostics.validationErrors.length} validation error(s)`);
  return errors;
}

export function validateTerrainDiagnostics(diagnostics, toleranceM = 0.03) {
  const errors = [];
  const keys = ['renderOwner', 'renderMeshBaseHeight', 'parityMethod', 'paritySamples', 'parityMaxErrorM'];
  if (!exactObjectKeys(diagnostics, keys)) {
    errors.push(`terrainDiagnostics() must contain exact keys [${keys.join(', ')}]`);
    return errors;
  }
  if (diagnostics.renderOwner !== 'gpu') errors.push('terrainDiagnostics().renderOwner must be gpu');
  if (diagnostics.renderMeshBaseHeight !== 0) errors.push('terrainDiagnostics().renderMeshBaseHeight must be exactly 0');
  if (diagnostics.parityMethod !== 'gpu-readback') errors.push('terrainDiagnostics().parityMethod must be gpu-readback; CPU-to-CPU comparison is forbidden');
  if (typeof diagnostics.paritySamples !== 'number' || !Number.isInteger(diagnostics.paritySamples) || diagnostics.paritySamples < 8) errors.push('terrainDiagnostics().paritySamples must be a positive integer of at least 8');
  if (typeof diagnostics.parityMaxErrorM !== 'number' || !Number.isFinite(diagnostics.parityMaxErrorM) || diagnostics.parityMaxErrorM < 0) errors.push('terrainDiagnostics().parityMaxErrorM must be finite and non-negative');
  else if (diagnostics.parityMaxErrorM > toleranceM) errors.push(`terrainDiagnostics().parityMaxErrorM ${diagnostics.parityMaxErrorM} exceeds contract tolerance ${toleranceM}`);
  return errors;
}

export function validateCameraDiagnostics(diagnostics, { terrainDiagnostics = null, toleranceM = 0.03, cameraMinDepthM = THRESHOLDS.cameraMinDepthM } = {}) {
  const errors = [];
  const keys = ['method', 'nearestDepthM', 'terrainClearanceM'];
  if (!exactObjectKeys(diagnostics, keys)) {
    errors.push(`cameraDiagnostics() must contain exact keys [${keys.join(', ')}]`);
    return errors;
  }
  if (!['gpu-depth', 'cpu-height-with-gpu-parity'].includes(diagnostics.method)) errors.push('cameraDiagnostics().method must be gpu-depth or cpu-height-with-gpu-parity');
  for (const field of ['nearestDepthM', 'terrainClearanceM']) {
    if (typeof diagnostics[field] !== 'number' || !Number.isFinite(diagnostics[field]) || diagnostics[field] < 0) errors.push(`cameraDiagnostics().${field} must be finite and non-negative`);
  }
  if (typeof diagnostics.terrainClearanceM === 'number' && diagnostics.terrainClearanceM <= 0) errors.push('cameraDiagnostics().terrainClearanceM must be greater than zero');
  if (typeof diagnostics.nearestDepthM === 'number' && diagnostics.nearestDepthM >= 0 && diagnostics.nearestDepthM < cameraMinDepthM) errors.push(`camera nearest depth ${diagnostics.nearestDepthM.toFixed(2)} m below ${cameraMinDepthM} m — camera is inside geometry`);
  if (diagnostics.method === 'cpu-height-with-gpu-parity') errors.push(...validateTerrainDiagnostics(terrainDiagnostics, toleranceM).map((e) => `camera parity qualification failed: ${e}`));
  return errors;
}

const REQUIRED_POSES = Object.freeze(['idle', 'locomotion', 'mechanic']);

function isValidImage(img) {
  if (!img || typeof img !== 'object') return false;
  const { width, height, data } = img;
  if (typeof width !== 'number' || !Number.isInteger(width) || width <= 0) return false;
  if (typeof height !== 'number' || !Number.isInteger(height) || height <= 0) return false;
  if (!data) return false;
  if (Array.isArray(data)) return false;
  const isTypedOrBuffer =
    (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) ||
    data instanceof Uint8Array ||
    data instanceof Uint8ClampedArray;
  if (!isTypedOrBuffer) return false;
  if (data.length !== width * height * 4) return false;
  return true;
}

/**
 * Run every gate over a captured run.
 * @returns {{pass: boolean, failures: string[], info: string[], metrics: object}}
 */
export function evaluateGates({ frames, cameraDepthM, cameraDiagnostics = null, terrainDiagnostics = null, frameStats }) {
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

  // 2. Validate numeric inputs and camera proof. cameraDepthM remains a narrow
  // compatibility input for pure legacy unit fixtures; browser verification uses
  // cameraDiagnostics exclusively.
  const effectiveCameraDiagnostics = cameraDiagnostics || (typeof cameraDepthM === 'number'
    ? { method: 'gpu-depth', nearestDepthM: cameraDepthM, terrainClearanceM: 1 }
    : null);
  failures.push(...validateCameraDiagnostics(effectiveCameraDiagnostics, { terrainDiagnostics }));
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
    let environmentVariation = null;
    let environmentEdges = null;

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
        environmentVariation = localLuminanceVariation(imageWithoutCharacter);
        environmentEdges = edgeDensity(imageWithoutCharacter);
        info.push(`[${name}] environment local variation ${environmentVariation.toFixed(3)}, edge density ${environmentEdges.toFixed(3)}`);
        if (environmentVariation < THRESHOLDS.environmentLocalLuminanceVariationMin) failures.push(`[${name}] environment local luminance variation ${environmentVariation.toFixed(3)} is below ${THRESHOLDS.environmentLocalLuminanceVariationMin} — character-hidden environment is too smooth.`);
        if (environmentEdges < THRESHOLDS.environmentEdgeDensityMin) failures.push(`[${name}] environment edge density ${environmentEdges.toFixed(3)} is below ${THRESHOLDS.environmentEdgeDensityMin} — character-hidden environment lacks readable structure.`);
      } catch (err) {
        failures.push(`[${name}] failed to calculate character area fraction: ${err.message}`);
      }
    }

    metricFrames.push({
      name: name ?? 'unknown',
      meanLuminance: typeof lum === 'number' && Number.isFinite(lum) ? lum : null,
      flatFrameRatio: typeof flat === 'number' && Number.isFinite(flat) ? flat : null,
      characterAreaFraction: typeof charFraction === 'number' && Number.isFinite(charFraction) ? charFraction : null,
      localLuminanceVariation: typeof environmentVariation === 'number' && Number.isFinite(environmentVariation) ? environmentVariation : null,
      edgeDensity: typeof environmentEdges === 'number' && Number.isFinite(environmentEdges) ? environmentEdges : null,
    });
  }

  const frameByName = new Map((frames || []).map((frame) => [frame?.name, frame]));
  const poseDifferences = { idleLocomotion: null, idleMechanic: null };
  for (const [key, otherName, threshold] of [
    ['idleLocomotion', 'locomotion', THRESHOLDS.poseIdleLocomotionMinChangedArea],
    ['idleMechanic', 'mechanic', THRESHOLDS.poseIdleMechanicMinChangedArea],
  ]) {
    const idle = frameByName.get('idle')?.image;
    const other = frameByName.get(otherName)?.image;
    if (isValidImage(idle) && isValidImage(other)) {
      try {
        poseDifferences[key] = changedAreaFraction(idle, other);
        info.push(`[${key}] changed area ${(poseDifferences[key] * 100).toFixed(1)}%`);
        if (poseDifferences[key] < threshold) failures.push(`[${key}] changed area ${(poseDifferences[key] * 100).toFixed(1)}% is below ${threshold * 100}% — captures are too similar.`);
      } catch (err) {
        failures.push(`[${key}] failed to calculate pose difference: ${err.message}`);
      }
    } else {
      failures.push(`[${key}] cannot be measured because both pose images are required.`);
    }
  }

  if (Number.isFinite(frameStats?.medianMs) && Number.isFinite(frameStats?.p99Ms) && frameStats?.samples >= 1) {
    info.push(
      `frame time: median ${frameStats.medianMs.toFixed(1)} ms, p99 ${frameStats.p99Ms.toFixed(1)} ms over ${frameStats.samples} samples (informational — headless timing is not gated)`,
    );
  }

  const metrics = {
    frames: metricFrames,
    cameraDiagnostics: effectiveCameraDiagnostics && typeof effectiveCameraDiagnostics === 'object' ? effectiveCameraDiagnostics : null,
    cameraNearestDepthM: typeof effectiveCameraDiagnostics?.nearestDepthM === 'number' && Number.isFinite(effectiveCameraDiagnostics.nearestDepthM) && effectiveCameraDiagnostics.nearestDepthM >= 0 ? effectiveCameraDiagnostics.nearestDepthM : null,
    terrainDiagnostics: terrainDiagnostics && typeof terrainDiagnostics === 'object' ? terrainDiagnostics : null,
    poseDifferences,
    frameStats: {
      medianMs: typeof frameStats?.medianMs === 'number' && Number.isFinite(frameStats.medianMs) && frameStats.medianMs >= 0 ? frameStats.medianMs : null,
      p99Ms: typeof frameStats?.p99Ms === 'number' && Number.isFinite(frameStats.p99Ms) && frameStats.p99Ms >= 0 ? frameStats.p99Ms : null,
      samples: typeof frameStats?.samples === 'number' && Number.isInteger(frameStats.samples) && frameStats.samples >= 1 ? frameStats.samples : null,
    },
  };

  return { pass: failures.length === 0, failures, info, metrics };
}
