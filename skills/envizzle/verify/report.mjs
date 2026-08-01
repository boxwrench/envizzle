import fs from 'node:fs';
import path from 'node:path';

export const SCHEMA_VERSION = 1;
export const ALLOWED_STATUSES = Object.freeze(['passed', 'failed', 'error']);

const ALLOWED_TOP_KEYS = new Set([
  'schemaVersion',
  'status',
  'target',
  'startedAt',
  'finishedAt',
  'durationMs',
  'requiredPaths',
  'build',
  'runtime',
  'captures',
  'gates',
  'benchmark',
]);

function isPlainObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isFiniteOrNull(val) {
  return val === null || (typeof val === 'number' && Number.isFinite(val));
}

function isUnitRangeOrNull(val) {
  return val === null || (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 1);
}

function isNonNegativeOrNull(val) {
  return val === null || (typeof val === 'number' && Number.isFinite(val) && val >= 0);
}

function isNonBlankString(val) {
  return typeof val === 'string' && val.trim() !== '';
}

const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const REQUIRED_POSES = Object.freeze(['idle', 'locomotion', 'mechanic']);
export const REQUIRED_CAPTURE_FILENAMES = Object.freeze(['milestone_idle.png', 'milestone_locomotion.png', 'milestone_mechanic.png']);

export function containsLeak(str) {
  if (typeof str !== 'string') return false;
  // Stack traces
  if (/\bat\s+.*:\d+:\d+/i.test(str)) return true;
  // Windows drive letter absolute paths or UNC paths
  if (/[a-zA-Z]:[\\/]/i.test(str) || /^[a-zA-Z]:$/i.test(str) || /^(\\\\|\/\/)/.test(str)) return true;
  // Unix absolute paths (/Users, /home, /var, /usr, /etc, /opt, /tmp, /root, /bin, /sbin, /dev)
  if (/(\/(Users|home|var|usr|etc|opt|tmp|root|bin|sbin|dev)\/[^\s\n:]+)/i.test(str)) return true;
  if (/^\/(Users|home|var|usr|etc|opt|tmp|root|bin|sbin|dev)($|\/)/i.test(str)) return true;
  // Embedded Unix/Windows absolute paths in longer strings
  if (/(?:^|\s)\/(Users|home|var|usr|etc|opt|tmp|root|bin|sbin|dev)\/[^\s\n:]+/i.test(str)) return true;
  if (/(?:^|\s)[a-zA-Z]:[\\/][^\s\n:]+/i.test(str)) return true;
  // Credentials/tokens
  if (/bearer\s+[a-z0-9._-]+/i.test(str)) return true;
  if (/(api[_-]?key|secret|token|password|auth)\s*[:=]\s*\S+/i.test(str)) return true;
  return false;
}

export function isSafeRelativePath(str) {
  if (typeof str !== 'string' || str.trim() === '') return false;
  const s = str.trim();
  if (/[a-zA-Z]:[\\/]/.test(s) || /^[a-zA-Z]:$/.test(s)) return false;
  if (s.startsWith('/') || s.startsWith('\\')) return false;
  if (s.startsWith('//') || s.startsWith('\\\\')) return false;
  const normalized = s.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.includes('..')) return false;
  if (containsLeak(s)) return false;
  return true;
}

/**
 * Whether `candidate` (an absolute, realpath-resolved path) is inside `parent`
 * (also absolute, realpath-resolved), or equal to it. Uses path.relative rather
 * than string-prefix comparison so sibling directories that merely share a
 * name prefix (e.g. parent '/tmp/case' vs candidate '/tmp/case-evil/file') are
 * correctly rejected.
 */
export function isPathInside(parent, candidate) {
  const rel = path.relative(parent, candidate);
  return rel === '' ||
    (!rel.startsWith(`..${path.sep}`) &&
     rel !== '..' &&
     !path.isAbsolute(rel));
}

function sanitizePathOrString(str) {
  if (typeof str !== 'string') return str;
  let cleaned = str;
  cleaned = cleaned.replace(/\s+at\s+.*:\d+:\d+/gi, '');
  cleaned = cleaned.replace(/[a-zA-Z]:[\\/][^\s\n:]+/g, (match) => path.basename(match));
  cleaned = cleaned.replace(/\/(Users|home|var|usr|etc|opt|tmp|root|bin|sbin|dev)\/[^\s\n:]+/g, (match) => path.basename(match));
  cleaned = cleaned.replace(/bearer\s+[a-z0-9._-]+/gi, 'bearer [REDACTED]');
  cleaned = cleaned.replace(/(api[_-]?key|secret|token|password|auth)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
  return cleaned.trim();
}

/**
 * Validate a verification report strictly.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateVerificationReport(report) {
  const errors = [];

  if (!isPlainObject(report)) {
    return { valid: false, errors: ['Report must be a plain non-null object'] };
  }

  const keys = Object.keys(report);
  for (const k of keys) {
    if (!ALLOWED_TOP_KEYS.has(k)) {
      errors.push(`Unknown top-level key '${k}'`);
    }
  }

  for (const reqKey of ALLOWED_TOP_KEYS) {
    if (!(reqKey in report)) {
      errors.push(`Missing required top-level key '${reqKey}'`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  if (report.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`Invalid schemaVersion ${JSON.stringify(report.schemaVersion)}, expected ${SCHEMA_VERSION}`);
  }

  if (!ALLOWED_STATUSES.includes(report.status)) {
    errors.push(`Invalid status '${report.status}', expected one of: ${ALLOWED_STATUSES.join(', ')}`);
  }

  if (typeof report.target !== 'string' || report.target.trim() === '') {
    errors.push('target must be a non-empty string');
  } else if (!isSafeRelativePath(report.target)) {
    errors.push(`target must be a safe project directory name without absolute paths or traversal, got '${report.target}'`);
  }

  if (typeof report.startedAt !== 'string' || !ISO_TIMESTAMP_REGEX.test(report.startedAt) || Number.isNaN(Date.parse(report.startedAt))) {
    errors.push(`startedAt must be a valid ISO timestamp string, got ${JSON.stringify(report.startedAt)}`);
  }

  if (typeof report.finishedAt !== 'string' || !ISO_TIMESTAMP_REGEX.test(report.finishedAt) || Number.isNaN(Date.parse(report.finishedAt))) {
    errors.push(`finishedAt must be a valid ISO timestamp string, got ${JSON.stringify(report.finishedAt)}`);
  }

  if (typeof report.startedAt === 'string' && typeof report.finishedAt === 'string' && !Number.isNaN(Date.parse(report.startedAt)) && !Number.isNaN(Date.parse(report.finishedAt))) {
    if (Date.parse(report.finishedAt) < Date.parse(report.startedAt)) {
      errors.push(`finishedAt (${report.finishedAt}) cannot be earlier than startedAt (${report.startedAt})`);
    }
  }

  if (typeof report.durationMs !== 'number' || !Number.isInteger(report.durationMs) || report.durationMs < 0) {
    errors.push(`durationMs must be a non-negative integer, got ${JSON.stringify(report.durationMs)}`);
  }

  if (!Array.isArray(report.requiredPaths) || report.requiredPaths.some((p) => typeof p !== 'string' || !isSafeRelativePath(p))) {
    errors.push('requiredPaths must be an array of safe relative path strings');
  }

  if (!isPlainObject(report.build)) {
    errors.push('build must be a plain object');
  } else {
    const buildKeys = Object.keys(report.build);
    if (buildKeys.length !== 2 || !buildKeys.includes('ok') || !buildKeys.includes('error')) {
      errors.push(`build must contain exact keys ['ok', 'error'], got [${buildKeys.join(', ')}]`);
    }
    if (typeof report.build.ok !== 'boolean') {
      errors.push('build.ok must be a boolean');
    }
    if (report.build.error !== null && typeof report.build.error !== 'string') {
      errors.push('build.error must be a string or null');
    }
    if (report.build.ok === true && report.build.error !== null) {
      errors.push('build.ok true requires build.error to be null');
    }
    if (report.build.ok === false && !isNonBlankString(report.build.error)) {
      errors.push('build.ok false requires a nonblank build.error');
    }
    if (containsLeak(report.build.error)) {
      errors.push('build.error contains path, stack, or credential leakage');
    }
  }

  if (!isPlainObject(report.runtime)) {
    errors.push('runtime must be a plain object');
  } else {
    const runtimeKeys = Object.keys(report.runtime);
    if (runtimeKeys.length !== 2 || !runtimeKeys.includes('hookReady') || !runtimeKeys.includes('errors')) {
      errors.push(`runtime must contain exact keys ['hookReady', 'errors'], got [${runtimeKeys.join(', ')}]`);
    }
    if (typeof report.runtime.hookReady !== 'boolean') {
      errors.push('runtime.hookReady must be a boolean');
    }
    if (!Array.isArray(report.runtime.errors) || report.runtime.errors.some((e) => typeof e !== 'string')) {
      errors.push('runtime.errors must be an array of strings');
    } else {
      for (const errStr of report.runtime.errors) {
        if (containsLeak(errStr)) {
          errors.push(`runtime error contains path, stack, or credential leakage: '${errStr}'`);
        }
      }
    }
  }

  if (!Array.isArray(report.captures)) {
    errors.push('captures must be an array of safe relative filename strings');
  } else {
    const seenCaptures = new Set();
    for (const c of report.captures) {
      if (typeof c !== 'string' || !isSafeRelativePath(c)) {
        errors.push('captures must be an array of safe relative filename strings');
      } else if (!REQUIRED_CAPTURE_FILENAMES.includes(c)) {
        errors.push(`Unknown capture filename '${c}'; only the known milestone capture filenames are permitted`);
      } else if (seenCaptures.has(c)) {
        errors.push(`Duplicate capture filename '${c}'`);
      } else {
        seenCaptures.add(c);
      }
    }
  }

  if (!isPlainObject(report.gates)) {
    errors.push('gates must be a plain object');
  } else {
    const gateKeys = Object.keys(report.gates);
    if (gateKeys.length !== 4 || !gateKeys.includes('pass') || !gateKeys.includes('failures') || !gateKeys.includes('info') || !gateKeys.includes('metrics')) {
      errors.push(`gates must contain exact keys ['pass', 'failures', 'info', 'metrics'], got [${gateKeys.join(', ')}]`);
    }
    if (typeof report.gates.pass !== 'boolean') {
      errors.push('gates.pass must be a boolean');
    }
    if (!Array.isArray(report.gates.failures) || report.gates.failures.some((f) => typeof f !== 'string')) {
      errors.push('gates.failures must be an array of strings');
    } else {
      for (const failStr of report.gates.failures) {
        if (containsLeak(failStr)) {
          errors.push(`gates failure contains path, stack, or credential leakage: '${failStr}'`);
        }
      }
    }
    if (!Array.isArray(report.gates.info) || report.gates.info.some((i) => typeof i !== 'string')) {
      errors.push('gates.info must be an array of strings');
    } else {
      for (const infoStr of report.gates.info) {
        if (containsLeak(infoStr)) {
          errors.push(`gates.info contains path, stack, or credential leakage: '${infoStr}'`);
        }
      }
    }

    if (!isPlainObject(report.gates.metrics)) {
      errors.push('gates.metrics must be a plain object');
    } else {
      const m = report.gates.metrics;
      const mKeys = Object.keys(m);
      if (mKeys.length !== 3 || !mKeys.includes('frames') || !mKeys.includes('cameraNearestDepthM') || !mKeys.includes('frameStats')) {
        errors.push(`gates.metrics must contain exact keys ['frames', 'cameraNearestDepthM', 'frameStats'], got [${mKeys.join(', ')}]`);
      }

      if (!Array.isArray(m.frames)) {
        errors.push('gates.metrics.frames must be an array');
      } else {
        for (let i = 0; i < m.frames.length; i++) {
          const f = m.frames[i];
          if (!isPlainObject(f)) {
            errors.push(`gates.metrics.frames[${i}] must be an object`);
          } else {
            const fKeys = Object.keys(f);
            if (fKeys.length !== 4 || !fKeys.includes('name') || !fKeys.includes('meanLuminance') || !fKeys.includes('flatFrameRatio') || !fKeys.includes('characterAreaFraction')) {
              errors.push(`gates.metrics.frames[${i}] must contain exact keys ['name', 'meanLuminance', 'flatFrameRatio', 'characterAreaFraction'], got [${fKeys.join(', ')}]`);
            }
            if (typeof f.name !== 'string') errors.push(`gates.metrics.frames[${i}].name must be string`);
            if (!isUnitRangeOrNull(f.meanLuminance)) errors.push(`gates.metrics.frames[${i}].meanLuminance must be a finite number between 0 and 1, or null`);
            if (!isUnitRangeOrNull(f.flatFrameRatio)) errors.push(`gates.metrics.frames[${i}].flatFrameRatio must be a finite number between 0 and 1, or null`);
            if (!isUnitRangeOrNull(f.characterAreaFraction)) errors.push(`gates.metrics.frames[${i}].characterAreaFraction must be a finite number between 0 and 1, or null`);
          }
        }
      }

      if (!isNonNegativeOrNull(m.cameraNearestDepthM)) {
        errors.push('gates.metrics.cameraNearestDepthM must be a non-negative finite number or null');
      }

      if (!isPlainObject(m.frameStats)) {
        errors.push('gates.metrics.frameStats must be a plain object');
      } else {
        const fsKeys = Object.keys(m.frameStats);
        if (fsKeys.length !== 3 || !fsKeys.includes('medianMs') || !fsKeys.includes('p99Ms') || !fsKeys.includes('samples')) {
          errors.push(`gates.metrics.frameStats must contain exact keys ['medianMs', 'p99Ms', 'samples'], got [${fsKeys.join(', ')}]`);
        }
        if (!isNonNegativeOrNull(m.frameStats.medianMs)) errors.push('gates.metrics.frameStats.medianMs must be a non-negative finite number or null');
        if (!isNonNegativeOrNull(m.frameStats.p99Ms)) errors.push('gates.metrics.frameStats.p99Ms must be a non-negative finite number or null');
        if (!isFiniteOrNull(m.frameStats.samples)) errors.push('gates.metrics.frameStats.samples must be finite number or null');
        if (m.frameStats.samples !== null && (typeof m.frameStats.samples !== 'number' || !Number.isInteger(m.frameStats.samples) || m.frameStats.samples < 0)) {
          errors.push('gates.metrics.frameStats.samples must be a non-negative integer or null');
        }
      }
    }
  }

  // Validate report.benchmark
  if (report.benchmark !== null && report.benchmark !== undefined) {
    if (!isPlainObject(report.benchmark)) {
      errors.push('benchmark must be null or a plain object');
    } else {
      const bKeys = Object.keys(report.benchmark);
      if (bKeys.length !== 2 || !bKeys.includes('caseId') || !bKeys.includes('briefSha256')) {
        errors.push(`benchmark must contain exact keys ['caseId', 'briefSha256'], got [${bKeys.join(', ')}]`);
      }
      if (typeof report.benchmark.caseId !== 'string' || report.benchmark.caseId.trim() === '') {
        errors.push('benchmark.caseId must be a non-empty string');
      }
      if (typeof report.benchmark.briefSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(report.benchmark.briefSha256)) {
        errors.push('benchmark.briefSha256 must be a 64-character lowercase hex string');
      }
    }
  }

  // Contradictory state & status invariant validations
  if (report.status === 'passed') {
    if (report.build?.ok !== true) {
      errors.push('Contradictory state: status is "passed" but build.ok is not true');
    }
    if (report.runtime?.hookReady !== true) {
      errors.push('Contradictory state: status is "passed" but runtime.hookReady is not true');
    }
    if (Array.isArray(report.runtime?.errors) && report.runtime.errors.length > 0) {
      errors.push('Contradictory state: status is "passed" but runtime.errors is not empty');
    }
    if (report.gates?.pass !== true) {
      errors.push('Contradictory state: status is "passed" but gates.pass is not true');
    }
    if (Array.isArray(report.gates?.failures) && report.gates.failures.length > 0) {
      errors.push('Contradictory state: status is "passed" but gates.failures is not empty');
    }
    const samples = report.gates?.metrics?.frameStats?.samples;
    if (typeof samples !== 'number' || !Number.isInteger(samples) || samples < 1) {
      errors.push('Passed report must contain a positive integer sample count in gates.metrics.frameStats.samples');
    }
    const captureSet = new Set(Array.isArray(report.captures) ? report.captures : []);
    if (captureSet.size !== 3 || !REQUIRED_CAPTURE_FILENAMES.every((f) => captureSet.has(f))) {
      errors.push(`Passed report must contain exactly the three required capture filenames [${REQUIRED_CAPTURE_FILENAMES.join(', ')}] once each`);
    }

    const frames = report.gates?.metrics?.frames || [];
    if (frames.length !== 3) {
      errors.push(`Passed report must contain exactly 3 frame metric records, got ${frames.length}`);
    }
    const frameNames = new Set(frames.map((f) => f.name));
    if (frameNames.size !== 3) {
      errors.push('Passed report frames contain duplicate pose names');
    }
    for (const pose of REQUIRED_POSES) {
      if (!frameNames.has(pose)) {
        errors.push(`Passed report is missing frame metric evidence for required pose '${pose}'`);
      }
    }
    for (const f of frames) {
      if (typeof f.meanLuminance !== 'number' || !Number.isFinite(f.meanLuminance)) {
        errors.push(`Passed frame '${f.name}' missing finite meanLuminance`);
      }
      if (typeof f.flatFrameRatio !== 'number' || !Number.isFinite(f.flatFrameRatio)) {
        errors.push(`Passed frame '${f.name}' missing finite flatFrameRatio`);
      }
      if (typeof f.characterAreaFraction !== 'number' || !Number.isFinite(f.characterAreaFraction)) {
        errors.push(`Passed frame '${f.name}' missing finite characterAreaFraction`);
      }
    }
    const depth = report.gates?.metrics?.cameraNearestDepthM;
    if (typeof depth !== 'number' || !Number.isFinite(depth) || depth < 0) {
      errors.push('Passed report missing finite non-negative cameraNearestDepthM');
    }
    const fs = report.gates?.metrics?.frameStats;
    if (typeof fs?.medianMs !== 'number' || !Number.isFinite(fs.medianMs) || fs.medianMs < 0) {
      errors.push('Passed report missing finite non-negative frameStats.medianMs');
    }
    if (typeof fs?.p99Ms !== 'number' || !Number.isFinite(fs.p99Ms) || fs.p99Ms < 0) {
      errors.push('Passed report missing finite non-negative frameStats.p99Ms');
    }
  } else if (report.status === 'failed') {
    if (report.gates?.pass !== false) {
      errors.push('Contradictory state: status is "failed" but gates.pass is not false');
    }
    const hasFailureReason =
      isNonBlankString(report.build?.error) ||
      (Array.isArray(report.runtime?.errors) && report.runtime.errors.some(isNonBlankString)) ||
      (Array.isArray(report.gates?.failures) && report.gates.failures.some(isNonBlankString));
    if (!hasFailureReason) {
      errors.push('Contradictory state: status is "failed" but no nonblank failure reason was recorded in build, runtime, or gates');
    }
  } else if (report.status === 'error') {
    if (report.gates?.pass !== false) {
      errors.push('Contradictory state: status is "error" but gates.pass is true');
    }
    const hasOperationalError =
      isNonBlankString(report.build?.error) ||
      (Array.isArray(report.runtime?.errors) && report.runtime.errors.some(isNonBlankString)) ||
      (Array.isArray(report.gates?.failures) && report.gates.failures.some(isNonBlankString));
    if (!hasOperationalError) {
      errors.push('Contradictory state: status is "error" but no operational error recorded in build, runtime, or gates');
    }
  }

  return { valid: errors.length === 0, errors };
}

export const validateReport = validateVerificationReport;

/**
 * Safely normalize a verification report.
 */
export function normalizeVerificationReport(report) {
  if (!isPlainObject(report)) {
    throw new Error('Cannot normalize invalid report: input is not a plain object');
  }

  const targetName = String(report.target || '').trim();
  const safeTarget = isSafeRelativePath(targetName) ? targetName : path.basename(targetName);

  let benchmarkNorm = null;
  if (isPlainObject(report.benchmark)) {
    benchmarkNorm = {
      caseId: String(report.benchmark.caseId || '').trim(),
      briefSha256: String(report.benchmark.briefSha256 || '').trim().toLowerCase(),
    };
  }

  const norm = {
    schemaVersion: SCHEMA_VERSION,
    status: ALLOWED_STATUSES.includes(report.status) ? report.status : 'error',
    target: safeTarget,
    startedAt: report.startedAt || new Date().toISOString(),
    finishedAt: report.finishedAt || new Date().toISOString(),
    durationMs: typeof report.durationMs === 'number' && Number.isInteger(report.durationMs) && report.durationMs >= 0
      ? report.durationMs
      : Math.floor(Math.max(0, report.durationMs || 0)),
    requiredPaths: Array.isArray(report.requiredPaths)
      ? report.requiredPaths.map((p) => sanitizePathOrString(String(p)))
      : [],
    build: {
      ok: Boolean(report.build?.ok),
      error: report.build?.error ? sanitizePathOrString(String(report.build.error)) : null,
    },
    runtime: {
      hookReady: Boolean(report.runtime?.hookReady),
      errors: Array.isArray(report.runtime?.errors)
        ? report.runtime.errors.map((e) => sanitizePathOrString(String(e)))
        : [],
    },
    captures: Array.isArray(report.captures)
      ? report.captures.map((c) => (typeof c === 'string' ? sanitizePathOrString(c) : String(c)))
      : [],
    gates: {
      pass: Boolean(report.gates?.pass),
      failures: Array.isArray(report.gates?.failures)
        ? report.gates.failures.map((f) => sanitizePathOrString(String(f)))
        : [],
      info: Array.isArray(report.gates?.info)
        ? report.gates.info.map((i) => sanitizePathOrString(String(i)))
        : [],
      metrics: {
        frames: Array.isArray(report.gates?.metrics?.frames)
          ? report.gates.metrics.frames.map((f) => ({
              name: String(f?.name ?? 'unknown'),
              meanLuminance: isFiniteOrNull(f?.meanLuminance) ? f.meanLuminance : null,
              flatFrameRatio: isFiniteOrNull(f?.flatFrameRatio) ? f.flatFrameRatio : null,
              characterAreaFraction: isFiniteOrNull(f?.characterAreaFraction) ? f.characterAreaFraction : null,
            }))
          : [],
        cameraNearestDepthM: isFiniteOrNull(report.gates?.metrics?.cameraNearestDepthM)
          ? report.gates.metrics.cameraNearestDepthM
          : null,
        frameStats: {
          medianMs: isFiniteOrNull(report.gates?.metrics?.frameStats?.medianMs)
            ? report.gates.metrics.frameStats.medianMs
            : null,
          p99Ms: isFiniteOrNull(report.gates?.metrics?.frameStats?.p99Ms)
            ? report.gates.metrics.frameStats.p99Ms
            : null,
          samples: isFiniteOrNull(report.gates?.metrics?.frameStats?.samples)
            ? report.gates.metrics.frameStats.samples
            : null,
        },
      },
    },
    benchmark: benchmarkNorm,
  };

  return norm;
}

export const normalizeReport = normalizeVerificationReport;

/**
 * Create a new verification report object.
 */
export function createVerificationReport({
  target,
  startedAt,
  finishedAt,
  durationMs,
  requiredPaths = [],
  build = { ok: true, error: null },
  runtime = { hookReady: true, errors: [] },
  captures = [],
  gates = { pass: true, failures: [], info: [], metrics: { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: null, p99Ms: null, samples: null } } },
  status = null,
  benchmark = null,
}) {
  const computedStatus = status || (
    build.ok && runtime.hookReady && (runtime.errors || []).length === 0 && gates.pass
      ? 'passed'
      : 'failed'
  );

  const rawReport = {
    schemaVersion: SCHEMA_VERSION,
    status: computedStatus,
    target: String(target || '').trim(),
    startedAt: startedAt || new Date().toISOString(),
    finishedAt: finishedAt || new Date().toISOString(),
    durationMs: typeof durationMs === 'number' ? durationMs : 0,
    requiredPaths,
    build,
    runtime,
    captures,
    gates,
    benchmark,
  };

  const normalized = normalizeVerificationReport(rawReport);
  const val = validateVerificationReport(normalized);
  if (!val.valid) {
    throw new Error(`Failed to create valid report: ${val.errors.join('; ')}`);
  }
  return normalized;
}

export const createReport = createVerificationReport;

/**
 * Write verification report atomically to reportPath.
 */
export function writeVerificationReport(reportPath, report) {
  const inputVal = validateVerificationReport(report);
  if (!inputVal.valid) {
    throw new Error(`Cannot write invalid report: ${inputVal.errors.join('; ')}`);
  }

  const normalized = normalizeVerificationReport(report);
  const val = validateVerificationReport(normalized);
  if (!val.valid) {
    throw new Error(`Cannot write invalid report: ${val.errors.join('; ')}`);
  }

  const absoluteReportPath = path.resolve(reportPath);
  const dir = path.dirname(absoluteReportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = path.join(
    dir,
    `.tmp-report-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.json`,
  );

  try {
    fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, absoluteReportPath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {
        // ignore cleanup error
      }
    }
    throw err;
  }
}

export const writeReport = writeVerificationReport;
