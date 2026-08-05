import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { isSafeRelativePath, isPathInside } from './report.mjs';

export const INCOMPLETE_VERIFICATION_STATUS = 'incomplete verification';
export const COMPLETE_STATUS = 'complete';
export const BUILD_CONTRACT_FILENAME = 'ENVIZZLE_BUILD.json';
export const EVIDENCE_FILENAME = 'ENVIZZLE_EVIDENCE.json';

export const MILESTONE_IDS = Object.freeze([
  'first-runnable-scene',
  'systems-complete',
  'final-polish',
]);

export const CANONICAL_MILESTONE_SCREENSHOTS = Object.freeze({
  'first-runnable-scene': Object.freeze([
    'evidence/first-runnable-scene/milestone_idle.png',
  ]),
  'systems-complete': Object.freeze([
    'evidence/systems-complete/milestone_locomotion.png',
    'evidence/systems-complete/milestone_mechanic.png',
  ]),
  'final-polish': Object.freeze([
    'evidence/final-polish/milestone_idle.png',
    'evidence/final-polish/milestone_locomotion.png',
    'evidence/final-polish/milestone_mechanic.png',
  ]),
});

export const ALL_CANONICAL_SCREENSHOT_PATHS = Object.freeze([
  'evidence/first-runnable-scene/milestone_idle.png',
  'evidence/systems-complete/milestone_locomotion.png',
  'evidence/systems-complete/milestone_mechanic.png',
  'evidence/final-polish/milestone_idle.png',
  'evidence/final-polish/milestone_locomotion.png',
  'evidence/final-polish/milestone_mechanic.png',
]);

function isPlainObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function exactKeys(value, expected, label, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be a plain object`);
    return false;
  }
  const actual = Object.keys(value);
  const missing = expected.filter((key) => !actual.includes(key));
  const unknown = actual.filter((key) => !expected.includes(key));
  if (missing.length > 0) errors.push(`${label} is missing required keys: ${missing.join(', ')}`);
  if (unknown.length > 0) errors.push(`${label} contains unknown keys: ${unknown.join(', ')}`);
  return missing.length === 0 && unknown.length === 0;
}

function validateEvidenceMilestone(milestone, index, errors) {
  const label = `milestones[${index}]`;
  if (!exactKeys(milestone, ['id', 'status', 'screenshots', 'console', 'performance', 'visualSelfReview'], label, errors)) return;

  if (!MILESTONE_IDS.includes(milestone.id)) {
    errors.push(`${label}.id is invalid`);
  }

  if (![INCOMPLETE_VERIFICATION_STATUS, COMPLETE_STATUS].includes(milestone.status)) {
    errors.push(`${label}.status is invalid`);
  }

  if (!Array.isArray(milestone.screenshots) || milestone.screenshots.some((file) => !isSafeRelativePath(file))) {
    errors.push(`${label}.screenshots must contain safe relative filenames`);
  }

  if (exactKeys(milestone.console, ['errors', 'warnings'], `${label}.console`, errors)) {
    for (const field of ['errors', 'warnings']) {
      if (!Array.isArray(milestone.console[field]) || milestone.console[field].some((v) => typeof v !== 'string')) {
        errors.push(`${label}.console.${field} must be an array of strings`);
      }
    }
  }

  if (exactKeys(milestone.performance, ['fps', 'frameTimeMs'], `${label}.performance`, errors)) {
    for (const field of ['fps', 'frameTimeMs']) {
      const v = milestone.performance[field];
      if (!(v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0))) {
        errors.push(`${label}.performance.${field} must be a non-negative finite number or null`);
      }
    }
  }

  if (exactKeys(milestone.visualSelfReview, ['reviewed', 'weaknesses', 'corrections'], `${label}.visualSelfReview`, errors)) {
    if (typeof milestone.visualSelfReview.reviewed !== 'boolean') {
      errors.push(`${label}.visualSelfReview.reviewed must be boolean`);
    }
    for (const field of ['weaknesses', 'corrections']) {
      if (!Array.isArray(milestone.visualSelfReview[field]) || milestone.visualSelfReview[field].some((v) => typeof v !== 'string')) {
        errors.push(`${label}.visualSelfReview.${field} must be an array of strings`);
      }
    }
  }

  if (milestone.status === COMPLETE_STATUS) {
    const requiredCanonical = CANONICAL_MILESTONE_SCREENSHOTS[milestone.id];
    if (!requiredCanonical) {
      errors.push(`${label} cannot be complete without valid milestone definition`);
      return;
    }

    if (!Array.isArray(milestone.screenshots)) {
      errors.push(`${label} cannot be complete without screenshots array`);
    } else {
      const uniqueScreenshots = new Set(milestone.screenshots);
      if (uniqueScreenshots.size !== milestone.screenshots.length) {
        errors.push(`${label} cannot contain duplicate screenshot filenames`);
      }

      if (milestone.screenshots.length !== requiredCanonical.length) {
        errors.push(`${label} requires exactly ${requiredCanonical.length} canonical screenshot path(s) when complete, got ${milestone.screenshots.length}`);
      }

      for (const reqPath of requiredCanonical) {
        if (!milestone.screenshots.includes(reqPath)) {
          errors.push(`${label} missing required canonical screenshot '${reqPath}'`);
        }
      }

      for (const shotPath of milestone.screenshots) {
        if (!requiredCanonical.includes(shotPath)) {
          errors.push(`${label} contains unpermitted or non-canonical screenshot '${shotPath}'`);
        }
      }
    }

    if (!isPlainObject(milestone.console) || !Array.isArray(milestone.console.errors) || milestone.console.errors.length > 0) {
      errors.push(`${label} cannot be complete with console errors`);
    }

    if (!isPlainObject(milestone.performance) ||
        milestone.performance.fps === null || typeof milestone.performance.fps !== 'number' || !Number.isFinite(milestone.performance.fps) || milestone.performance.fps < 0 ||
        milestone.performance.frameTimeMs === null || typeof milestone.performance.frameTimeMs !== 'number' || !Number.isFinite(milestone.performance.frameTimeMs) || milestone.performance.frameTimeMs < 0) {
      errors.push(`${label} cannot be complete without non-null non-negative finite performance evidence`);
    }

    if (!isPlainObject(milestone.visualSelfReview) || milestone.visualSelfReview.reviewed !== true) {
      errors.push(`${label} cannot be complete without visual self-review`);
    } else {
      if (!Array.isArray(milestone.visualSelfReview.weaknesses) || milestone.visualSelfReview.weaknesses.length === 0 || milestone.visualSelfReview.weaknesses.some((w) => typeof w !== 'string' || w.trim() === '')) {
        errors.push(`${label} cannot be complete with empty weaknesses`);
      }
      if (!Array.isArray(milestone.visualSelfReview.corrections) || milestone.visualSelfReview.corrections.length === 0 || milestone.visualSelfReview.corrections.some((c) => typeof c !== 'string' || c.trim() === '')) {
        errors.push(`${label} cannot be complete with empty corrections`);
      }
    }
  }
}

/**
 * Pure schema validation of an ENVIZZLE_EVIDENCE.json object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateMilestoneEvidence(evidence) {
  const errors = [];
  if (!isPlainObject(evidence)) return { valid: false, errors: ['Evidence record must be a plain object'] };
  if (!exactKeys(evidence, ['schemaVersion', 'status', 'milestones'], 'evidence', errors)) return { valid: false, errors };
  if (evidence.schemaVersion !== 1) errors.push('evidence.schemaVersion must be 1');
  if (![INCOMPLETE_VERIFICATION_STATUS, COMPLETE_STATUS].includes(evidence.status)) {
    errors.push(`evidence.status must be '${INCOMPLETE_VERIFICATION_STATUS}' or '${COMPLETE_STATUS}'`);
  }

  if (!Array.isArray(evidence.milestones)) {
    errors.push('evidence.milestones must be an array');
  } else {
    const actualIds = evidence.milestones.map((m) => m?.id);
    if (JSON.stringify(actualIds) !== JSON.stringify(MILESTONE_IDS)) {
      errors.push('evidence.milestones must contain the three milestone IDs in canonical order');
    }

    const seenIds = new Set();
    const allReferencedScreenshots = [];

    evidence.milestones.forEach((milestone, index) => {
      if (seenIds.has(milestone?.id)) errors.push(`evidence.milestones contains duplicate ID '${milestone?.id}'`);
      seenIds.add(milestone?.id);
      if (Array.isArray(milestone?.screenshots)) {
        allReferencedScreenshots.push(...milestone.screenshots);
      }
      validateEvidenceMilestone(milestone, index, errors);
    });

    const uniqueAllScreenshots = new Set(allReferencedScreenshots);
    if (uniqueAllScreenshots.size !== allReferencedScreenshots.length) {
      errors.push('Milestone screenshot paths must be unique across the entire evidence record');
    }

    const allComplete = evidence.milestones.length === MILESTONE_IDS.length &&
      evidence.milestones.every((m) => m.status === COMPLETE_STATUS);

    if (evidence.status === COMPLETE_STATUS && !allComplete) {
      errors.push('evidence.status complete requires every milestone to be complete');
    }
    if (evidence.status === INCOMPLETE_VERIFICATION_STATUS && allComplete) {
      errors.push('evidence.status must be complete when every milestone is complete');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate full project milestone evidence on disk (JSON files, brief hash, and PNG images).
 * Returns { ok: boolean, errors: string[] }
 */
export function validateProjectMilestoneEvidence(projectDir, options = {}) {
  const errors = [];
  const projAbs = path.resolve(projectDir);

  if (!fs.existsSync(projAbs) || !fs.statSync(projAbs).isDirectory()) {
    return { ok: false, errors: [`Project directory '${projAbs}' does not exist or is not a directory`] };
  }

  let projReal;
  try {
    projReal = fs.realpathSync(projAbs);
  } catch (err) {
    return { ok: false, errors: [`Failed to resolve realpath for project directory '${projAbs}': ${err.message}`] };
  }

  // 1. Check ENVIZZLE_BUILD.json
  const buildContractPath = path.join(projReal, BUILD_CONTRACT_FILENAME);
  if (!fs.existsSync(buildContractPath)) {
    errors.push(`Missing build contract file '${BUILD_CONTRACT_FILENAME}'`);
  }

  let contract = null;
  if (fs.existsSync(buildContractPath)) {
    try {
      contract = JSON.parse(fs.readFileSync(buildContractPath, 'utf8'));
    } catch (err) {
      errors.push(`Failed to parse '${BUILD_CONTRACT_FILENAME}': ${err.message}`);
    }
  }

  // 2. Check brief file identified by contract and verify brief SHA-256 hash
  if (contract) {
    const briefFilename = contract.project?.briefFilename;
    if (typeof briefFilename !== 'string' || !isSafeRelativePath(briefFilename)) {
      errors.push(`Build contract specifies unsafe or invalid briefFilename '${briefFilename}'`);
    } else {
      const briefPath = path.join(projReal, briefFilename);
      if (!fs.existsSync(briefPath)) {
        errors.push(`Brief file '${briefFilename}' identified by build contract does not exist`);
      } else {
        const briefReal = fs.realpathSync(briefPath);
        if (!isPathInside(projReal, briefReal)) {
          errors.push(`Path security violation: brief file '${briefReal}' resolves outside project directory '${projReal}'`);
        } else {
          const briefBytes = fs.readFileSync(briefReal);
          const computedSha = crypto.createHash('sha256').update(briefBytes).digest('hex');
          if (contract.project?.briefSha256 && computedSha !== contract.project.briefSha256) {
            errors.push(`Brief hash mismatch: file '${briefFilename}' SHA-256 '${computedSha}' does not match contract briefSha256 '${contract.project.briefSha256}'`);
          }
        }
      }
    }
  }

  // 3. Check ENVIZZLE_EVIDENCE.json
  const evidencePath = path.join(projReal, EVIDENCE_FILENAME);
  if (!fs.existsSync(evidencePath)) {
    errors.push(`Missing evidence record file '${EVIDENCE_FILENAME}'`);
  }

  let evidence = null;
  if (fs.existsSync(evidencePath)) {
    try {
      evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    } catch (err) {
      errors.push(`Failed to parse '${EVIDENCE_FILENAME}': ${err.message}`);
    }
  }

  if (evidence) {
    const schemaVal = validateMilestoneEvidence(evidence);
    if (!schemaVal.valid) {
      errors.push(...schemaVal.errors);
    }
  }

  // 4. If evidence exists and is structurally complete, validate physical screenshot files on disk
  if (evidence && Array.isArray(evidence.milestones)) {
    for (const milestone of evidence.milestones) {
      if (milestone?.status === COMPLETE_STATUS && Array.isArray(milestone.screenshots)) {
        for (const relShotPath of milestone.screenshots) {
          if (!isSafeRelativePath(relShotPath)) {
            errors.push(`Screenshot path '${relShotPath}' in milestone '${milestone.id}' is not a safe relative path`);
            continue;
          }

          const shotAbsPath = path.join(projReal, relShotPath);
          if (!fs.existsSync(shotAbsPath)) {
            errors.push(`Milestone '${milestone.id}' references nonexistent screenshot file '${relShotPath}'`);
            continue;
          }

          let shotReal;
          try {
            shotReal = fs.realpathSync(shotAbsPath);
          } catch (err) {
            errors.push(`Milestone '${milestone.id}' screenshot file '${relShotPath}' realpath resolution failed: ${err.message}`);
            continue;
          }

          if (!isPathInside(projReal, shotReal)) {
            errors.push(`Path security violation: screenshot '${relShotPath}' resolves outside project directory '${projReal}'`);
            continue;
          }

          const stat = fs.statSync(shotReal);
          if (!stat.isFile()) {
            errors.push(`Screenshot target '${relShotPath}' is not a regular file`);
            continue;
          }

          if (stat.size === 0) {
            errors.push(`Screenshot file '${relShotPath}' is 0 bytes (empty)`);
            continue;
          }

          try {
            const buf = fs.readFileSync(shotReal);
            PNG.sync.read(buf);
          } catch (err) {
            errors.push(`Screenshot file '${relShotPath}' is not a valid decodable PNG: ${err.message}`);
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
