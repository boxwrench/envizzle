import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleBrief } from '../assemble.mjs';
import { SHOWCASES } from '../selection.mjs';
import {
  validateBuildContract as realValidateBuildContract,
  createBuildContract as realCreateBuildContract,
  validateStageEvidence as realValidateStageEvidence,
  createEvidenceTemplate as realCreateEvidenceTemplate,
  STAGE_IDS_IN_ORDER,
} from '../build-contract.mjs';
import {
  validateBuildContractStandalone,
  validateEvidenceStandalone,
  validateEvidenceContractBinding,
} from '../verify/contractSchema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const clone = (value) => JSON.parse(JSON.stringify(value));

// Same pattern used by tests/build-contract.test.mjs to generate a real, fully-formed contract
// for a canonical showcase, reused here so this file's "agreement" tests exercise real
// end-to-end assembly output rather than hand-built fixtures.
const allFalseNoveltyBudget = () => ({
  addsEngine: false,
  addsAssetCategory: false,
  addsPersistentBuffer: false,
  addsMajorRenderPass: false,
  addsSimulationSubsystem: false,
  addsInput: false,
  increasesAmbition: false,
});

const canonicalShowcaseSpec = (name, creativeMode = 'signature') => {
  const showcase = SHOWCASES[name];
  const extraSectionMarkdown = Object.fromEntries(showcase.extraSections.map((section) => [section, `Canonical ${section} content for ${name}.`]));
  return {
    selection: {
      creativeMode,
      path: 'showcase',
      baseShowcase: name,
      changedAxes: [],
      ambition: showcase.ambition,
      biome: showcase.biome,
      archetype: showcase.archetype,
      mechanic: showcase.mechanic,
      camera: showcase.camera,
      renderingProfile: showcase.renderingProfile,
      includedSections: showcase.includedSections,
      extraSections: showcase.extraSections,
      cameraAdjustments: showcase.cameraAdjustments,
      stateChannelContract: showcase.stateChannelContract,
      signatureMoment: creativeMode === 'proven'
        ? { enabled: false, text: '', reusedSystem: '', verificationPose: 'mechanic' }
        : { enabled: true, text: `A bounded Signature Moment for ${name}.`, reusedSystem: 'particles', verificationPose: 'mechanic' },
      noveltyBudget: allFalseNoveltyBudget(),
    },
    builderAgent: 'Claude Code',
    ...(Object.keys(extraSectionMarkdown).length > 0 ? { extraSectionMarkdown } : {}),
  };
};

const validSignature = () => JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json'), 'utf8'));

test('verify/contractSchema.mjs does not import anything from build-contract.mjs (or anything else)', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'verify', 'contractSchema.mjs'), 'utf8');
  const importLines = source.match(/^import .*$/gm) || [];
  assert.equal(importLines.length, 0, `contractSchema.mjs must have zero imports (found: ${importLines.join(' | ')})`);
  // Prose comments are allowed to reference build-contract.mjs by name (the module intentionally
  // documents its own vendoring tradeoff); what must never appear is an actual import specifier.
  assert.doesNotMatch(source, /(?:import|require)\s*\(?\s*['"][^'"]*build-contract\.mjs['"]/, 'contractSchema.mjs must not import from build-contract.mjs');
});

test('standalone validator agrees with the real validator on every canonical showcase (both accept)', () => {
  for (const name of Object.keys(SHOWCASES)) {
    const result = assembleBrief(canonicalShowcaseSpec(name), { rootDir: repoRoot });
    const real = realValidateBuildContract(result.buildContract);
    const standalone = validateBuildContractStandalone(result.buildContract);
    assert.equal(real.valid, true, `${name}: real validator unexpectedly rejected: ${real.errors.join('; ')}`);
    assert.equal(standalone.valid, true, `${name}: standalone validator unexpectedly rejected: ${standalone.errors.join('; ')}`);

    const realEvidence = realValidateStageEvidence(result.evidenceTemplate);
    const standaloneEvidence = validateEvidenceStandalone(result.evidenceTemplate);
    assert.equal(realEvidence.valid, true, `${name}: real evidence validator unexpectedly rejected: ${realEvidence.errors.join('; ')}`);
    assert.equal(standaloneEvidence.valid, true, `${name}: standalone evidence validator unexpectedly rejected: ${standaloneEvidence.errors.join('; ')}`);
  }
});

test('standalone validator agrees with the real validator across mode coverage (Proven, Signature, Experimental, fully custom)', () => {
  const proven = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'proven-dune.json'), 'utf8'));
  const signature = validSignature();
  const experimentalCamera = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'experimental-base-camera.json'), 'utf8'));
  const fullyCustom = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'experimental-fully-custom.json'), 'utf8'));

  for (const spec of [proven, signature, experimentalCamera, fullyCustom]) {
    const contract = assembleBrief(spec, { rootDir: repoRoot }).buildContract;
    assert.equal(realValidateBuildContract(contract).valid, true);
    assert.equal(validateBuildContractStandalone(contract).valid, true);
  }
});

test('vendored contractSchema.mjs accepts the same schema-v2 contract/evidence build-contract.mjs produces', () => {
  const model = assembleBrief(canonicalShowcaseSpec('Alpine Dawn'), { rootDir: repoRoot }).assemblyModel;
  const contract = realCreateBuildContract(model);
  const canonical = realValidateBuildContract(contract);
  const vendored = validateBuildContractStandalone(contract);
  assert.equal(canonical.valid, true, canonical.errors.join('; '));
  assert.equal(vendored.valid, true, vendored.errors.join('; '));

  const evidence = realCreateEvidenceTemplate(contract.project.briefSha256);
  const canonicalEvidence = realValidateStageEvidence(evidence);
  const vendoredEvidence = validateEvidenceStandalone(evidence);
  assert.equal(canonicalEvidence.valid, true, canonicalEvidence.errors.join('; '));
  assert.equal(vendoredEvidence.valid, true, vendoredEvidence.errors.join('; '));
  assert.deepEqual(evidence.stages.map((s) => s.id), STAGE_IDS_IN_ORDER);
});

test('the pinned babylon-webgpu engine string is identical in selection.mjs and the vendored verify/contractSchema.mjs', () => {
  const selectionSource = fs.readFileSync(path.join(repoRoot, 'selection.mjs'), 'utf8');
  const contractSchemaSource = fs.readFileSync(path.join(repoRoot, 'verify', 'contractSchema.mjs'), 'utf8');
  const engineMatch = selectionSource.match(/engine: '([^']+)',\s*\n\s*shaderLang: 'WGSL'/);
  assert.ok(engineMatch, 'expected to find the babylon-webgpu engine string in selection.mjs');
  const pinnedEngine = engineMatch[1];
  assert.match(pinnedEngine, /^Babylon\.js \d/, 'the engine string must pin an exact Babylon.js version, not "latest stable"');
  assert.ok(
    contractSchemaSource.includes(`engine: '${pinnedEngine}'`),
    'verify/contractSchema.mjs must vendor the exact same pinned babylon-webgpu engine string as selection.mjs',
  );
  assert.equal(SHOWCASES['Alpine Dawn'].renderingProfile, 'babylon-webgpu');
});

const assertBothReject = (label, mutate) => {
  const result = assembleBrief(validSignature(), { rootDir: repoRoot });
  const mutated = clone(result.buildContract);
  const before = JSON.stringify(mutated);
  mutate(mutated);
  assert.notEqual(JSON.stringify(mutated), before, `${label} mutation must actually change the contract`);

  const real = realValidateBuildContract(mutated);
  const standalone = validateBuildContractStandalone(mutated);
  assert.equal(real.valid, false, `${label}: real validator should reject this mutation`);
  assert.equal(standalone.valid, false, `${label}: standalone validator should also reject this mutation`);
  return { real, standalone };
};

test('standalone validator agrees with the real validator: missing top-level key is rejected by both', () => {
  assertBothReject('missing project key', (contract) => {
    delete contract.project;
  });
});

test('standalone validator agrees with the real validator: missing nested required key is rejected by both', () => {
  assertBothReject('missing project.briefSha256', (contract) => {
    delete contract.project.briefSha256;
  });
});

test('standalone validator agrees with the real validator: wrong enum value is rejected by both', () => {
  assertBothReject('project.renderingParadigm wrong enum', (contract) => {
    contract.project.renderingParadigm = 'Not A Real Paradigm';
  });
});

test('standalone validator agrees with the real validator: wrong creativeMode enum is rejected by both', () => {
  assertBothReject('selection.creativeMode wrong enum', (contract) => {
    contract.selection.creativeMode = 'not-a-real-mode';
  });
});

test('standalone validator agrees with the real validator: non-finite number anywhere in the contract is rejected by both', () => {
  assertBothReject('non-finite architecture.terrainElevationOwnership.parityToleranceM', (contract) => {
    contract.architecture.terrainElevationOwnership.parityToleranceM = Infinity;
  });
});

test('standalone validator agrees with the real validator: absolute path anywhere in the contract is rejected by both', () => {
  assertBothReject('absolute path in project.targetHardware', (contract) => {
    contract.project.targetHardware = 'C:\\Users\\someone\\hardware-notes.txt';
  });
});

// Regression test for the review finding: validateProjectShape previously only checked
// engine/shaderLanguage/shaderLanguageExtension/materialApi were non-empty strings, without
// cross-checking them against the canonical tuple for the *stated* renderingProfile. This
// mutation is well-typed (every field is a legitimate non-empty string) but wrong for the
// declared babylon-webgpu profile — it must still be rejected by both validators.
test('standalone validator agrees with the real validator: well-typed but wrong-for-profile project tuple is rejected by both', () => {
  const result = assembleBrief(canonicalShowcaseSpec('Alpine Dawn'), { rootDir: repoRoot });
  assert.equal(result.buildContract.project.renderingProfile, 'babylon-webgpu', 'fixture assumption: Alpine Dawn is babylon-webgpu');
  const mutated = clone(result.buildContract);
  const before = JSON.stringify(mutated);
  mutated.project.engine = 'Three.js latest stable, WebGLRenderer (WebGL2 only)';
  mutated.project.shaderLanguage = 'GLSL ES 3.00 raw modules';
  mutated.project.shaderLanguageExtension = 'glsl';
  mutated.project.materialApi = 'Three.js RawShaderMaterial on WebGLRenderer';
  assert.notEqual(JSON.stringify(mutated), before, 'mutation must actually change the contract');
  // Sanity check: every mutated field is still a legitimate non-empty string, and matches the
  // *other* profile's real tuple exactly — this is not a garbage/malformed value, it is simply
  // the wrong tuple for the profile actually declared on this contract.
  for (const field of ['engine', 'shaderLanguage', 'shaderLanguageExtension', 'materialApi']) {
    assert.equal(typeof mutated.project[field], 'string');
    assert.notEqual(mutated.project[field].trim(), '');
  }

  const real = realValidateBuildContract(mutated);
  const standalone = validateBuildContractStandalone(mutated);
  assert.equal(real.valid, false, 'real validator should reject a wrong-for-profile rendering tuple');
  assert.equal(standalone.valid, false, 'standalone validator should also reject a wrong-for-profile rendering tuple');
  assert.match(standalone.errors.join('; '), /rendering profile tuple/i);
});

test('standalone validator agrees with the real validator: project.briefFilename not matching the deterministic name-derived pattern is rejected by both', () => {
  assertBothReject('briefFilename does not match derived name pattern', (contract) => {
    contract.project.briefFilename = 'SOMETHING_ELSE_TECHDEMO_PROMPT.md';
  });
});

test('standalone validator agrees with the real validator: unknown key injected at top level is rejected by both', () => {
  assertBothReject('unknown top-level key', (contract) => {
    contract.unexpected = true;
  });
});

test('standalone validator agrees with the real validator: reordered stages are rejected by both', () => {
  assertBothReject('reordered stages', (contract) => {
    [contract.stages[0], contract.stages[1]] = [contract.stages[1], contract.stages[0]];
  });
});

test('standalone validator agrees with the real validator: tampered sourceOfTruth is rejected by both', () => {
  assertBothReject('sourceOfTruth.builderMayIgnoreFailedChecks flipped true', (contract) => {
    contract.sourceOfTruth.builderMayIgnoreFailedChecks = true;
  });
});

// --- Evidence ---------------------------------------------------------------

function createValidPassedEvidence(briefSha256 = 'a'.repeat(64)) {
  return {
    schemaVersion: 2,
    briefSha256,
    status: 'passed',
    stages: [
      { id: 'backend-proof', status: 'passed', automatedChecks: ['rendererInfo() reports selected backend'], artifacts: [], environment: null, errors: [], warnings: [], reviewed: false, weaknesses: [], corrections: [], deviations: [] },
      { id: 'terrain-kernel', status: 'passed', automatedChecks: ['terrainDiagnostics().renderOwner is "gpu"'], artifacts: [], environment: null, errors: [], warnings: [], reviewed: false, weaknesses: [], corrections: [], deviations: [] },
      { id: 'environment-composition', status: 'passed', automatedChecks: [], artifacts: ['environment_only.png', 'idle.png'], environment: null, errors: [], warnings: [], reviewed: true, weaknesses: ['Foreground detail repeats.'], corrections: ['Added detail octave.'], deviations: [] },
      { id: 'character-locomotion', status: 'passed', automatedChecks: ['setPose("idle") and setPose("locomotion") succeed'], artifacts: ['idle.png', 'locomotion.png'], environment: null, errors: [], warnings: [], reviewed: true, weaknesses: ['Foot planting lags.'], corrections: ['Tightened IK settle time.'], deviations: [] },
      { id: 'mechanic-final-polish', status: 'passed', automatedChecks: ['setPose("mechanic") succeeds'], artifacts: ['idle.png', 'locomotion.png', 'mechanic.png'], environment: null, errors: [], warnings: [], reviewed: true, weaknesses: ['Wake crest curtain thin.'], corrections: ['Doubled crest density.'], deviations: [] },
    ],
  };
}

test('standalone evidence validator agrees with the real evidence validator: passed/correct record is accepted by both', () => {
  const evidence = createValidPassedEvidence();
  assert.equal(realValidateStageEvidence(evidence).valid, true, realValidateStageEvidence(evidence).errors.join('; '));
  assert.equal(validateEvidenceStandalone(evidence).valid, true, validateEvidenceStandalone(evidence).errors.join('; '));
});

test('standalone evidence validator agrees with the real evidence validator: missing stage is rejected by both', () => {
  const evidence = createValidPassedEvidence();
  evidence.stages.pop();
  const real = realValidateStageEvidence(evidence);
  const standalone = validateEvidenceStandalone(evidence);
  assert.equal(real.valid, false);
  assert.equal(standalone.valid, false);
});

test('standalone evidence validator agrees with the real evidence validator: missing required pose screenshot is rejected by both', () => {
  const evidence = createValidPassedEvidence();
  evidence.stages[2].artifacts = ['unrelated.png'];
  const real = realValidateStageEvidence(evidence);
  const standalone = validateEvidenceStandalone(evidence);
  assert.equal(real.valid, false);
  assert.equal(standalone.valid, false);
});

test('standalone evidence validator agrees with the real evidence validator: malformed briefSha256 is rejected by both', () => {
  const evidence = createValidPassedEvidence();
  evidence.briefSha256 = 'not-a-sha';
  const real = realValidateStageEvidence(evidence);
  const standalone = validateEvidenceStandalone(evidence);
  assert.equal(real.valid, false);
  assert.equal(standalone.valid, false);
});

test('standalone evidence validator agrees with the real evidence validator: passed status without all stages passed is rejected by both', () => {
  const evidence = createValidPassedEvidence();
  evidence.stages[0].status = 'incomplete verification';
  const real = realValidateStageEvidence(evidence);
  const standalone = validateEvidenceStandalone(evidence);
  assert.equal(real.valid, false);
  assert.equal(standalone.valid, false);
});

// --- Evidence-contract binding ----------------------------------------------

test('validateEvidenceContractBinding accepts matching briefSha256 and rejects a mismatch', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const contract = assembled.buildContract;
  const matchingEvidence = clone(assembled.evidenceTemplate);
  matchingEvidence.briefSha256 = contract.project.briefSha256;
  const matchResult = validateEvidenceContractBinding(contract, matchingEvidence);
  assert.equal(matchResult.valid, true, matchResult.errors.join('; '));

  const mismatchedEvidence = clone(assembled.evidenceTemplate);
  mismatchedEvidence.briefSha256 = 'f'.repeat(64);
  assert.notEqual(mismatchedEvidence.briefSha256, contract.project.briefSha256);
  const mismatchResult = validateEvidenceContractBinding(contract, mismatchedEvidence);
  assert.equal(mismatchResult.valid, false);
  assert.match(mismatchResult.errors.join('; '), /briefSha256/i);
});

test('validateEvidenceContractBinding rejects when evidence.briefSha256 is missing or malformed', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const contract = assembled.buildContract;
  const nullEvidence = clone(assembled.evidenceTemplate);
  nullEvidence.briefSha256 = null;
  const result = validateEvidenceContractBinding(contract, nullEvidence);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('; '), /string/i);
});

// --- createBuildContract cross-check (real generator, standalone validator) --

test('standalone validator accepts a contract produced directly by the real createBuildContract on a real assembly model', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const regenerated = realCreateBuildContract(assembled.assemblyModel);
  const real = realValidateBuildContract(regenerated);
  const standalone = validateBuildContractStandalone(regenerated);
  assert.equal(real.valid, true, real.errors.join('; '));
  assert.equal(standalone.valid, true, standalone.errors.join('; '));
});
