import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync, execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import {
  validateMilestoneEvidence,
  validateProjectMilestoneEvidence,
  CANONICAL_MILESTONE_SCREENSHOTS,
  ALL_CANONICAL_SCREENSHOT_PATHS,
  INCOMPLETE_VERIFICATION_STATUS,
  COMPLETE_STATUS,
} from '../verify/evidence.mjs';
import {
  BUILD_CONTRACT_FILENAME,
  EVIDENCE_FILENAME,
} from '../build-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function makeTmpDir() {
  const dir = path.join(repoRoot, 'tests', `tmp-evidence-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function rmTmpDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

function createValidPngBuffer() {
  const png = new PNG({ width: 1, height: 1 });
  png.data[0] = 255;
  png.data[1] = 0;
  png.data[2] = 0;
  png.data[3] = 255;
  return PNG.sync.write(png);
}

function createValidEvidenceRecord() {
  return {
    schemaVersion: 1,
    status: COMPLETE_STATUS,
    milestones: [
      {
        id: 'first-runnable-scene',
        status: COMPLETE_STATUS,
        screenshots: ['evidence/first-runnable-scene/milestone_idle.png'],
        console: { errors: [], warnings: [] },
        performance: { fps: 60, frameTimeMs: 16.67 },
        visualSelfReview: { reviewed: true, weaknesses: ['Minor aliasing'], corrections: ['Enabled MSAA'] },
      },
      {
        id: 'systems-complete',
        status: COMPLETE_STATUS,
        screenshots: ['evidence/systems-complete/milestone_locomotion.png', 'evidence/systems-complete/milestone_mechanic.png'],
        console: { errors: [], warnings: [] },
        performance: { fps: 60, frameTimeMs: 16.67 },
        visualSelfReview: { reviewed: true, weaknesses: ['Shadow pop'], corrections: ['Adjusted cascade bias'] },
      },
      {
        id: 'final-polish',
        status: COMPLETE_STATUS,
        screenshots: ['evidence/final-polish/milestone_idle.png', 'evidence/final-polish/milestone_locomotion.png', 'evidence/final-polish/milestone_mechanic.png'],
        console: { errors: [], warnings: [] },
        performance: { fps: 60, frameTimeMs: 16.67 },
        visualSelfReview: { reviewed: true, weaknesses: ['Bloom flare strong'], corrections: ['Reduced threshold'] },
      },
    ],
  };
}

function createValidProjectDirectory(projectDir) {
  const briefName = 'ALPINE_DAWN_TECHDEMO_PROMPT.md';
  const briefContent = '# ALPINE-DAWN Brief\n\nContent';
  const briefSha256 = crypto.createHash('sha256').update(briefContent, 'utf8').digest('hex');

  fs.writeFileSync(path.join(projectDir, briefName), briefContent, 'utf8');

  const contract = {
    schemaVersion: 1,
    project: {
      name: 'alpine-dawn',
      briefFilename: briefName,
      briefSha256: briefSha256,
      renderingProfile: 'WebGL2 High-Performance 3D',
      engine: 'Three.js',
      shaderLanguage: 'GLSL ES 3.0',
      shaderLanguageExtension: 'glsl',
      materialApi: 'RawShaderMaterial',
      renderingParadigm: 'Forward Plus Clustered',
      assetStrategy: '100% Zero-Asset Procedural',
      assetStrategyText: '100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)',
      targetHardware: 'Mid-range WebGL2 desktop GPU',
      coreInteractionSentence: 'Explore the scene.',
    },
    selection: {
      creativeMode: 'Signature Showcase',
      path: 'Base Showcase',
      baseShowcase: 'Alpine Dawn',
      ambition: 'High',
      includedSections: ['Terrain'],
      omittedOptionalSections: [],
      extraSections: [],
      biome: 'Alpine Sub-Arctic',
      archetype: 'Expansive Wilderness',
      mechanic: 'Snow Terrain Deformation',
      camera: '3rd-Person Orbit',
      renderingProfile: 'WebGL2 High-Performance 3D',
      cameraAdjustments: [],
      changedAxes: [],
    },
    stateChannels: { enabled: true, omittedBehavior: 'disabled', channels: [] },
    creative: { creativeSpark: 'Spark', signatureMoment: { enabled: true, text: 'Moment' }, noveltyBudget: {}, coherenceOverrides: [] },
    acceptance: {
      requiredProjectPaths: ['index.html'],
      productionBuild: { required: true },
      verificationHook: { required: true },
      runtime: { blockingBrowserOrConsoleErrors: 0 },
      captures: { required: true },
      imageGates: { required: true },
      camera: { required: true },
      report: { required: true, filename: 'verify-report.json' },
    },
    milestones: [
      {
        id: 'first-runnable-scene',
        requiredScreenshotEvidence: {
          minimumScreenshots: 1,
          requiredPoses: ['idle'],
          requiredScreenshotPaths: ['evidence/first-runnable-scene/milestone_idle.png'],
        },
      },
      {
        id: 'systems-complete',
        requiredScreenshotEvidence: {
          minimumScreenshots: 2,
          requiredPoses: ['locomotion', 'mechanic'],
          requiredScreenshotPaths: ['evidence/systems-complete/milestone_locomotion.png', 'evidence/systems-complete/milestone_mechanic.png'],
        },
      },
      {
        id: 'final-polish',
        requiredScreenshotEvidence: {
          minimumScreenshots: 3,
          requiredPoses: ['idle', 'locomotion', 'mechanic'],
          requiredScreenshotPaths: ['evidence/final-polish/milestone_idle.png', 'evidence/final-polish/milestone_locomotion.png', 'evidence/final-polish/milestone_mechanic.png'],
        },
      },
    ],
  };

  fs.writeFileSync(path.join(projectDir, BUILD_CONTRACT_FILENAME), JSON.stringify(contract, null, 2), 'utf8');

  const evidence = createValidEvidenceRecord();
  fs.writeFileSync(path.join(projectDir, EVIDENCE_FILENAME), JSON.stringify(evidence, null, 2), 'utf8');

  const pngBuf = createValidPngBuffer();
  for (const relPath of ALL_CANONICAL_SCREENSHOT_PATHS) {
    const absPath = path.join(projectDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, pngBuf);
  }

  return { briefName, briefContent, briefSha256, contract, evidence };
}

// Scenario 1: Pure schema validation rejecting unknown milestone IDs
test('Scenario 1: validateMilestoneEvidence rejects unknown milestone IDs', () => {
  const ev = createValidEvidenceRecord();
  ev.milestones[0].id = 'unknown-milestone-id';
  const val = validateMilestoneEvidence(ev);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /id is invalid|canonical order/.test(e)));
});

// Scenario 2: Pure schema validation rejecting non-canonical ordering
test('Scenario 2: validateMilestoneEvidence rejects non-canonical ordering', () => {
  const ev = createValidEvidenceRecord();
  const temp = ev.milestones[0];
  ev.milestones[0] = ev.milestones[1];
  ev.milestones[1] = temp;
  const val = validateMilestoneEvidence(ev);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /canonical order/.test(e)));
});

// Scenario 3: Pure schema validation rejecting duplicate IDs
test('Scenario 3: validateMilestoneEvidence rejects duplicate IDs', () => {
  const ev = createValidEvidenceRecord();
  ev.milestones[1].id = 'first-runnable-scene';
  const val = validateMilestoneEvidence(ev);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /duplicate ID|canonical order/.test(e)));
});

// Scenario 4: Pure schema validation rejecting invalid status strings
test('Scenario 4: validateMilestoneEvidence rejects invalid status strings', () => {
  const ev = createValidEvidenceRecord();
  ev.milestones[0].status = 'in-progress';
  const val = validateMilestoneEvidence(ev);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /status is invalid/.test(e)));
});

// Scenario 5: Pure schema validation rejecting negative/NaN performance metrics
test('Scenario 5: validateMilestoneEvidence rejects negative/NaN performance metrics', () => {
  const ev = createValidEvidenceRecord();
  ev.milestones[0].performance.fps = -10;
  const val = validateMilestoneEvidence(ev);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /performance\.fps must be a non-negative/.test(e)));

  const evNaN = createValidEvidenceRecord();
  evNaN.milestones[0].performance.frameTimeMs = NaN;
  const valNaN = validateMilestoneEvidence(evNaN);
  assert.equal(valNaN.valid, false);
  assert.ok(valNaN.errors.some((e) => /performance\.frameTimeMs must be a non-negative/.test(e)));
});

// Scenario 6: Pure schema validation rejecting empty weaknesses/corrections when status is complete
test('Scenario 6: validateMilestoneEvidence rejects empty weaknesses/corrections when complete', () => {
  const ev = createValidEvidenceRecord();
  ev.milestones[0].visualSelfReview.weaknesses = [];
  const val = validateMilestoneEvidence(ev);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /empty weaknesses/.test(e)));

  const evCorr = createValidEvidenceRecord();
  evCorr.milestones[0].visualSelfReview.corrections = ['   '];
  const valCorr = validateMilestoneEvidence(evCorr);
  assert.equal(valCorr.valid, false);
  assert.ok(valCorr.errors.some((e) => /empty corrections/.test(e)));
});

// Scenario 7: Pure schema validation rejecting complete status with console errors
test('Scenario 7: validateMilestoneEvidence rejects complete status with console errors', () => {
  const ev = createValidEvidenceRecord();
  ev.milestones[0].console.errors = ['Uncaught TypeError: Cannot read property of undefined'];
  const val = validateMilestoneEvidence(ev);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /console errors/.test(e)));
});

// Scenario 8: Pure schema validation rejecting missing required pose screenshots for a completed milestone
test('Scenario 8: validateMilestoneEvidence rejects missing required pose screenshots', () => {
  const ev = createValidEvidenceRecord();
  ev.milestones[0].screenshots = ['evidence/first-runnable-scene/milestone_locomotion.png'];
  const val = validateMilestoneEvidence(ev);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some((e) => /missing required canonical screenshot/.test(e)));
});

// Scenario 9: Disk-level validator rejecting missing ENVIZZLE_BUILD.json
test('Scenario 9: validateProjectMilestoneEvidence rejects missing ENVIZZLE_BUILD.json', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    fs.unlinkSync(path.join(tmp, BUILD_CONTRACT_FILENAME));
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /ENVIZZLE_BUILD\.json/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 10: Disk-level validator rejecting missing ENVIZZLE_EVIDENCE.json
test('Scenario 10: validateProjectMilestoneEvidence rejects missing ENVIZZLE_EVIDENCE.json', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    fs.unlinkSync(path.join(tmp, EVIDENCE_FILENAME));
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /ENVIZZLE_EVIDENCE\.json/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 11: Disk-level validator rejecting missing brief file
test('Scenario 11: validateProjectMilestoneEvidence rejects missing brief file', () => {
  const tmp = makeTmpDir();
  try {
    const { briefName } = createValidProjectDirectory(tmp);
    fs.unlinkSync(path.join(tmp, briefName));
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /Brief file.*does not exist/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 12: Disk-level validator rejecting brief SHA-256 hash mismatches
test('Scenario 12: validateProjectMilestoneEvidence rejects brief SHA-256 hash mismatch', () => {
  const tmp = makeTmpDir();
  try {
    const { briefName } = createValidProjectDirectory(tmp);
    fs.writeFileSync(path.join(tmp, briefName), '# MODIFIED BRIEF CONTENT\n', 'utf8');
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /Brief hash mismatch/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 13: Disk-level validator rejecting absolute screenshot paths
test('Scenario 13: validateProjectMilestoneEvidence rejects absolute screenshot paths', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    const evPath = path.join(tmp, EVIDENCE_FILENAME);
    const ev = JSON.parse(fs.readFileSync(evPath, 'utf8'));
    const absPath = path.resolve(path.join(tmp, 'evidence', 'first-runnable-scene', 'milestone_idle.png')).replace(/\\/g, '/');
    ev.milestones[0].screenshots = [absPath];
    fs.writeFileSync(evPath, JSON.stringify(ev, null, 2), 'utf8');
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /not a safe relative path|traversal/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 14: Disk-level validator rejecting .. traversal screenshot paths
test('Scenario 14: validateProjectMilestoneEvidence rejects .. traversal screenshot paths', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    const evPath = path.join(tmp, EVIDENCE_FILENAME);
    const ev = JSON.parse(fs.readFileSync(evPath, 'utf8'));
    ev.milestones[0].screenshots = ['../outside.png'];
    fs.writeFileSync(evPath, JSON.stringify(ev, null, 2), 'utf8');
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /not a safe relative path|outside project directory/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 15: Disk-level validator rejecting sibling-prefix escapes
test('Scenario 15: validateProjectMilestoneEvidence rejects sibling-prefix escapes', () => {
  const tmp = makeTmpDir();
  const siblingTmp = `${tmp}-sibling`;
  try {
    fs.mkdirSync(siblingTmp, { recursive: true });
    fs.writeFileSync(path.join(siblingTmp, 'escaped.png'), createValidPngBuffer());
    createValidProjectDirectory(tmp);
    const evPath = path.join(tmp, EVIDENCE_FILENAME);
    const ev = JSON.parse(fs.readFileSync(evPath, 'utf8'));
    const relativeEscape = path.relative(tmp, path.join(siblingTmp, 'escaped.png')).replace(/\\/g, '/');
    ev.milestones[0].screenshots = [relativeEscape];
    fs.writeFileSync(evPath, JSON.stringify(ev, null, 2), 'utf8');
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /not a safe relative path|outside project directory/.test(e)));
  } finally {
    rmTmpDir(tmp);
    rmTmpDir(siblingTmp);
  }
});

// Scenario 16: Disk-level validator rejecting symlinks targeting files outside project directory
test('Scenario 16: validateProjectMilestoneEvidence rejects symlinks targeting files outside project', () => {
  const tmp = makeTmpDir();
  const outsideDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(outsideDir, 'outside.png'), createValidPngBuffer());
    createValidProjectDirectory(tmp);
    const symlinkPath = path.join(tmp, 'evidence', 'first-runnable-scene', 'symlink_outside.png');
    try {
      fs.symlinkSync(path.join(outsideDir, 'outside.png'), symlinkPath);
    } catch (_) {
      // If OS environment restricts symlink creation, skip assertion cleanly
      return;
    }
    const evPath = path.join(tmp, EVIDENCE_FILENAME);
    const ev = JSON.parse(fs.readFileSync(evPath, 'utf8'));
    ev.milestones[0].screenshots = ['evidence/first-runnable-scene/symlink_outside.png'];
    fs.writeFileSync(evPath, JSON.stringify(ev, null, 2), 'utf8');
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /outside project directory|symlink/.test(e)));
  } finally {
    rmTmpDir(tmp);
    rmTmpDir(outsideDir);
  }
});

// Scenario 17: Disk-level validator rejecting legacy pose-only paths
test('Scenario 17: validateProjectMilestoneEvidence rejects legacy pose-only paths', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    const evPath = path.join(tmp, EVIDENCE_FILENAME);
    const ev = JSON.parse(fs.readFileSync(evPath, 'utf8'));
    ev.milestones[0].screenshots = ['milestone_idle.png'];
    fs.writeFileSync(evPath, JSON.stringify(ev, null, 2), 'utf8');
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /non-canonical screenshot/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 18: Disk-level validator rejecting extra arbitrary screenshot filenames not in canonical map
test('Scenario 18: validateProjectMilestoneEvidence rejects extra arbitrary screenshot filenames', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    const evPath = path.join(tmp, EVIDENCE_FILENAME);
    const ev = JSON.parse(fs.readFileSync(evPath, 'utf8'));
    ev.milestones[0].screenshots.push('evidence/first-runnable-scene/extra_shot.png');
    fs.writeFileSync(evPath, JSON.stringify(ev, null, 2), 'utf8');
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /non-canonical screenshot|unpermitted/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 19: Disk-level validator rejecting non-existent screenshot files
test('Scenario 19: validateProjectMilestoneEvidence rejects non-existent screenshot files', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    fs.unlinkSync(path.join(tmp, 'evidence', 'first-runnable-scene', 'milestone_idle.png'));
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /nonexistent screenshot file/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 20: Disk-level validator rejecting empty (0-byte) screenshot files
test('Scenario 20: validateProjectMilestoneEvidence rejects 0-byte screenshot files', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    fs.writeFileSync(path.join(tmp, 'evidence', 'first-runnable-scene', 'milestone_idle.png'), Buffer.alloc(0));
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /0 bytes/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 21: Disk-level validator rejecting corrupt/non-PNG files
test('Scenario 21: validateProjectMilestoneEvidence rejects corrupt/non-PNG files', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    fs.writeFileSync(path.join(tmp, 'evidence', 'first-runnable-scene', 'milestone_idle.png'), Buffer.from('NOT A PNG IMAGE FILE CONTENT', 'utf8'));
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /not a valid decodable PNG/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

// Scenario 22: Disk-level validator passing cleanly when all evidence exists and is valid
test('Scenario 22: validateProjectMilestoneEvidence passes cleanly when all files valid', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, true, `Validation failed: ${res.errors.join('; ')}`);
    assert.equal(res.errors.length, 0);
  } finally {
    rmTmpDir(tmp);
  }
});

test('untouched generated evidence template is structurally valid under validateMilestoneEvidence', () => {
  const template = {
    schemaVersion: 1,
    status: INCOMPLETE_VERIFICATION_STATUS,
    milestones: [
      {
        id: 'first-runnable-scene',
        status: INCOMPLETE_VERIFICATION_STATUS,
        screenshots: [],
        console: { errors: [], warnings: [] },
        performance: { fps: null, frameTimeMs: null },
        visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] },
      },
      {
        id: 'systems-complete',
        status: INCOMPLETE_VERIFICATION_STATUS,
        screenshots: [],
        console: { errors: [], warnings: [] },
        performance: { fps: null, frameTimeMs: null },
        visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] },
      },
      {
        id: 'final-polish',
        status: INCOMPLETE_VERIFICATION_STATUS,
        screenshots: [],
        console: { errors: [], warnings: [] },
        performance: { fps: null, frameTimeMs: null },
        visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] },
      },
    ],
  };

  const schemaVal = validateMilestoneEvidence(template);
  assert.equal(schemaVal.valid, true, `Untouched template must be structurally valid: ${schemaVal.errors.join('; ')}`);
});

test('untouched generated bundle fails validateProjectMilestoneEvidence', () => {
  const tmp = makeTmpDir();
  try {
    createValidProjectDirectory(tmp);
    const evidencePath = path.join(tmp, EVIDENCE_FILENAME);
    const template = {
      schemaVersion: 1,
      status: INCOMPLETE_VERIFICATION_STATUS,
      milestones: [
        {
          id: 'first-runnable-scene',
          status: INCOMPLETE_VERIFICATION_STATUS,
          screenshots: [],
          console: { errors: [], warnings: [] },
          performance: { fps: null, frameTimeMs: null },
          visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] },
        },
        {
          id: 'systems-complete',
          status: INCOMPLETE_VERIFICATION_STATUS,
          screenshots: [],
          console: { errors: [], warnings: [] },
          performance: { fps: null, frameTimeMs: null },
          visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] },
        },
        {
          id: 'final-polish',
          status: INCOMPLETE_VERIFICATION_STATUS,
          screenshots: [],
          console: { errors: [], warnings: [] },
          performance: { fps: null, frameTimeMs: null },
          visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] },
        },
      ],
    };
    fs.writeFileSync(evidencePath, JSON.stringify(template, null, 2), 'utf8');

    const res = validateProjectMilestoneEvidence(tmp);
    assert.equal(res.ok, false, 'Untouched evidence template must fail project completion validation');
    assert.ok(res.errors.some((e) => /incomplete verification/.test(e)));
  } finally {
    rmTmpDir(tmp);
  }
});

test('missing or malformed briefSha256 fails disk-level validation', () => {
  const malformedShaValues = [
    undefined,
    null,
    '',
    '   ',
    'ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890', // Uppercase
    '1234567890abcdef', // Too short
    'g'.repeat(64), // Non-hex
  ];

  for (const val of malformedShaValues) {
    const tmp = makeTmpDir();
    try {
      createValidProjectDirectory(tmp);
      const contractPath = path.join(tmp, BUILD_CONTRACT_FILENAME);
      const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      if (val === undefined) {
        delete contract.project.briefSha256;
      } else {
        contract.project.briefSha256 = val;
      }
      fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2), 'utf8');

      const res = validateProjectMilestoneEvidence(tmp);
      assert.equal(res.ok, false, `briefSha256 '${val}' must be rejected by validateProjectMilestoneEvidence`);
      assert.ok(res.errors.some((e) => /briefSha256/.test(e)));
    } finally {
      rmTmpDir(tmp);
    }
  }
});

test('pure evidence schema module can be imported and used in an isolated directory without node_modules or pngjs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envizzle-isolated-test-'));
  try {
    const evidenceCopyPath = path.join(tmpDir, 'evidence.mjs');
    const reportCopyPath = path.join(tmpDir, 'report.mjs');

    fs.copyFileSync(path.join(repoRoot, 'verify', 'evidence.mjs'), evidenceCopyPath);
    fs.copyFileSync(path.join(repoRoot, 'verify', 'report.mjs'), reportCopyPath);

    const nodeModulesPath = path.join(tmpDir, 'node_modules');
    assert.equal(fs.existsSync(nodeModulesPath), false, 'Isolated directory must not contain node_modules');

    const copyUrl = pathToFileURL(evidenceCopyPath).href;
    const script = `
      import { validateMilestoneEvidence } from '${copyUrl}';
      const template = {
        schemaVersion: 1,
        status: 'incomplete verification',
        milestones: [
          { id: 'first-runnable-scene', status: 'incomplete verification', screenshots: [], console: { errors: [], warnings: [] }, performance: { fps: null, frameTimeMs: null }, visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] } },
          { id: 'systems-complete', status: 'incomplete verification', screenshots: [], console: { errors: [], warnings: [] }, performance: { fps: null, frameTimeMs: null }, visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] } },
          { id: 'final-polish', status: 'incomplete verification', screenshots: [], console: { errors: [], warnings: [] }, performance: { fps: null, frameTimeMs: null }, visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] } }
        ]
      };
      const res = validateMilestoneEvidence(template);
      if (!res.valid) throw new Error('Validation failed: ' + res.errors.join('; '));
      console.log('GENUINE_PURE_IMPORT_OK');
    `;
    const out = execFileSync('node', ['--input-type=module', '--eval', script], { cwd: tmpDir, env: { ...process.env, NODE_PATH: '' }, encoding: 'utf8' });
    assert.ok(out.includes('GENUINE_PURE_IMPORT_OK'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('adversarial test: ENVIZZLE_BUILD.json symlink resolving outside project is rejected', (t) => {
  const tmpOutside = makeTmpDir();
  const tmpProject = makeTmpDir();
  try {
    createValidProjectDirectory(tmpProject);
    const outsideBuild = path.join(tmpOutside, 'external-build.json');
    fs.writeFileSync(outsideBuild, JSON.stringify({ schemaVersion: 1 }), 'utf8');

    const projectBuild = path.join(tmpProject, BUILD_CONTRACT_FILENAME);
    fs.unlinkSync(projectBuild);

    try {
      fs.symlinkSync(outsideBuild, projectBuild);
    } catch {
      t.skip('Host filesystem platform/permissions do not permit creating symlinks (EPERM)');
      return;
    }

    const res = validateProjectMilestoneEvidence(tmpProject);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /Path security violation|resolves outside project/.test(e)));
  } finally {
    rmTmpDir(tmpOutside);
    rmTmpDir(tmpProject);
  }
});

test('adversarial test: ENVIZZLE_EVIDENCE.json symlink resolving outside project is rejected', (t) => {
  const tmpOutside = makeTmpDir();
  const tmpProject = makeTmpDir();
  try {
    createValidProjectDirectory(tmpProject);
    const outsideEvidence = path.join(tmpOutside, 'external-evidence.json');
    fs.writeFileSync(outsideEvidence, JSON.stringify({ schemaVersion: 1 }), 'utf8');

    const projectEvidence = path.join(tmpProject, EVIDENCE_FILENAME);
    fs.unlinkSync(projectEvidence);

    try {
      fs.symlinkSync(outsideEvidence, projectEvidence);
    } catch {
      t.skip('Host filesystem platform/permissions do not permit creating symlinks (EPERM)');
      return;
    }

    const res = validateProjectMilestoneEvidence(tmpProject);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /Path security violation|resolves outside project/.test(e)));
  } finally {
    rmTmpDir(tmpOutside);
    rmTmpDir(tmpProject);
  }
});

test('evidence leak protection rejects stack traces, Unix paths, Windows paths, bearer tokens, and API credentials in console and review fields', () => {
  const leaks = [
    'Error: Failed at render (file:///C:/Users/dev/project/main.js:10:20)',
    'Traceback (most recent call last): File "/home/user/script.py", line 5',
    '/var/log/system.log output leak',
    'C:\\Users\\admin\\secret\\key.txt',
    'bearer eyJhbGciOiJIUzI1NiJ9.secret',
    'api_key=sk-1234567890abcdef123456',
    'ghp_1234567890abcdef123456',
    '-----BEGIN PRIVATE KEY-----',
  ];

  for (const leak of leaks) {
    for (const location of ['console.errors', 'console.warnings', 'visualSelfReview.weaknesses', 'visualSelfReview.corrections']) {
      const template = {
        schemaVersion: 1,
        status: INCOMPLETE_VERIFICATION_STATUS,
        milestones: [
          {
            id: 'first-runnable-scene',
            status: INCOMPLETE_VERIFICATION_STATUS,
            screenshots: [],
            console: { errors: location === 'console.errors' ? [leak] : [], warnings: location === 'console.warnings' ? [leak] : [] },
            performance: { fps: null, frameTimeMs: null },
            visualSelfReview: { reviewed: false, weaknesses: location === 'visualSelfReview.weaknesses' ? [leak] : [], corrections: location === 'visualSelfReview.corrections' ? [leak] : [] },
          },
          { id: 'systems-complete', status: INCOMPLETE_VERIFICATION_STATUS, screenshots: [], console: { errors: [], warnings: [] }, performance: { fps: null, frameTimeMs: null }, visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] } },
          { id: 'final-polish', status: INCOMPLETE_VERIFICATION_STATUS, screenshots: [], console: { errors: [], warnings: [] }, performance: { fps: null, frameTimeMs: null }, visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] } },
        ],
      };

      const res = validateMilestoneEvidence(template);
      assert.equal(res.valid, false, `Leak '${leak}' in '${location}' must fail validation`);
      assert.ok(res.errors.some((e) => /leaked sensitive data|absolute path/.test(e)));
    }
  }
});
