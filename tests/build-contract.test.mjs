import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assembleBrief,
  writeBundle,
} from '../assemble.mjs';
import { SHOWCASES } from '../selection.mjs';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  STAGE_IDS_IN_ORDER,
  STAGE_STATUSES,
  BUILD_CONTRACT_FILENAME,
  EVIDENCE_FILENAME,
  HANDOFF_FILENAME,
  BUILD_CONTRACT_STAGES,
  BUILD_CONTRACT_SOURCE_OF_TRUTH,
  BUILD_CONTRACT_IMPLEMENTATION_PLAN,
  BUILD_CONTRACT_ARCHITECTURE,
  BUILD_CONTRACT_APPROVED_PATTERNS,
  BUILD_CONTRACT_FORBIDDEN_PATTERNS,
  BUILD_CONTRACT_DIAGNOSTICS,
  DIAGNOSTICS_CONTRACT_BY_PROFILE,
  BUILD_CONTRACT_REVIEW_CRITERIA_UNIVERSAL,
  BUILD_CONTRACT_ACCEPTANCE,
  PRODUCT_PRINCIPLE_SENTENCE,
  TERRAIN_ELEVATION_OWNERSHIP_MEANING_TEXT,
  HANDOFF_STAGE_WORKFLOW_TEXT,
  createEvidenceTemplate,
  validateAssemblyArtifacts,
  validateBuildContract,
  validateStageEvidence,
  validateEvidenceContractBinding,
  renderContractSummary,
  renderStageEvidenceInstructions,
  renderProductPrinciple,
  renderArchitectureOwnership,
  renderImplementationStages,
  renderBabylonPatternGuidance,
  renderForbiddenPatterns,
  renderReviewCriteria,
  renderVisualAcceptanceHierarchy,
  renderHandoff,
} from '../build-contract.mjs';
import { prepareBenchmark } from '../benchmark.mjs';

// ---------------------------------------------------------------------------
// Task 1: unified 5-stage evidence schema v2 (replaces the milestone(3)/stage(5) split).
//
// NOTE ON DEVIATION FROM THE TASK 1 BRIEF: the brief's Step 1 assumed a `buildSampleModel()`
// helper already existed later in this file, built from `createCanonicalAssemblyModel(...)`
// with a real selection/profile/biome fixture, and told Step 2's new test to call
// `createBuildContract(buildSampleModel())`. No such helper exists anywhere in this file (it
// was never added by an earlier task). Instead, every existing test in this file that needs a
// real validated build contract already uses the established pattern
// `assembleBrief(validSignature(), { rootDir: repoRoot }).buildContract` — `assembleBrief`
// (imported above from ../assemble.mjs) internally calls `createCanonicalAssemblyModel(...)`
// and then `createBuildContract(...)` on a real fixture, so that pattern already exercises
// exactly what the brief wanted to exercise. Rather than inventing a second, parallel
// model-construction helper that duplicates assemble.mjs's own assembly logic, the new test
// below reuses the existing `assembleBrief`/`validSignature` pattern directly. `validSignature`
// and `repoRoot` are declared further down in this file (after this block), but that is safe:
// `node:test` collects `describe`/`test` registrations during module evaluation and only invokes
// their callback bodies afterward, once the whole module (including `repoRoot`/`validSignature`)
// has finished initializing.
// ---------------------------------------------------------------------------

function createValidPassedEvidence(briefSha256) {
  return {
    schemaVersion: BUILD_CONTRACT_SCHEMA_VERSION,
    briefSha256,
    status: 'passed',
    stages: [
      { id: 'backend-proof', status: 'passed', automatedChecks: ['rendererInfo() reports the selected backend and shader language'], artifacts: [], environment: { browserChannel: null, browserExecutable: null, headed: false, externalServer: null }, errors: [], warnings: [], reviewed: false, weaknesses: [], corrections: [], deviations: [] },
      { id: 'terrain-kernel', status: 'passed', automatedChecks: ['terrainDiagnostics().renderOwner is "gpu"'], artifacts: [], environment: { browserChannel: null, browserExecutable: null, headed: false, externalServer: null }, errors: [], warnings: [], reviewed: false, weaknesses: [], corrections: [], deviations: [] },
      { id: 'environment-composition', status: 'passed', automatedChecks: [], artifacts: ['environment_only.png', 'idle.png'], environment: { browserChannel: null, browserExecutable: null, headed: false, externalServer: null }, errors: [], warnings: [], reviewed: true, weaknesses: ['Foreground ripple detail repeats visibly at 15m.'], corrections: ['Added a second nonrepeating detail noise octave to the foreground band.'], deviations: [] },
      { id: 'character-locomotion', status: 'passed', automatedChecks: ['setPose("idle") and setPose("locomotion") both succeed'], artifacts: ['idle.png', 'locomotion.png'], environment: { browserChannel: null, browserExecutable: null, headed: false, externalServer: null }, errors: [], warnings: [], reviewed: true, weaknesses: ['Foot planting lags the surface by roughly 2 frames on steep slopes.'], corrections: ['Tightened the IK settle time from 180ms to 90ms.'], deviations: [] },
      { id: 'mechanic-final-polish', status: 'passed', automatedChecks: ['setPose("mechanic") succeeds'], artifacts: ['idle.png', 'locomotion.png', 'mechanic.png'], environment: { browserChannel: null, browserExecutable: null, headed: false, externalServer: null }, errors: [], warnings: ['Wake particle count drops noticeably below 15fps on integrated GPUs.'], reviewed: true, weaknesses: ['Wake crest curtain reads thin at gameplay distance.'], corrections: ['Doubled crest-curtain particle density and tightened its spawn radius.'], deviations: [] },
    ],
  };
}

describe('stage evidence schema v2', () => {
  test('createEvidenceTemplate produces exactly 5 not-started stages in canonical order', () => {
    const template = createEvidenceTemplate(null);
    assert.equal(template.schemaVersion, 2);
    assert.deepEqual(template.stages.map((s) => s.id), STAGE_IDS_IN_ORDER);
    assert.deepEqual(STAGE_IDS_IN_ORDER, ['backend-proof', 'terrain-kernel', 'environment-composition', 'character-locomotion', 'mechanic-final-polish']);
    for (const stage of template.stages) {
      assert.deepEqual(Object.keys(stage), ['id', 'status', 'automatedChecks', 'artifacts', 'environment', 'errors', 'warnings', 'reviewed', 'weaknesses', 'corrections', 'deviations']);
      assert.equal(stage.status, 'not-started');
      assert.deepEqual(stage.automatedChecks, []);
      assert.deepEqual(stage.artifacts, []);
      assert.equal(stage.environment, null);
      assert.deepEqual(stage.errors, []);
      assert.deepEqual(stage.warnings, []);
      assert.equal(stage.reviewed, false);
      assert.deepEqual(stage.weaknesses, []);
      assert.deepEqual(stage.corrections, []);
      assert.deepEqual(stage.deviations, []);
    }
    assert.equal(template.status, 'not-started');
  });

  test('a stage may pass while later stages remain not-started', () => {
    const evidence = createEvidenceTemplate('a'.repeat(64));
    evidence.stages[0].status = 'passed';
    evidence.stages[0].automatedChecks = ['rendererInfo() reports the selected backend'];
    const result = validateStageEvidence(evidence);
    assert.equal(result.valid, true, result.errors.join('; '));
  });

  test('a later stage cannot pass unless every prior stage passed', () => {
    const evidence = createEvidenceTemplate('a'.repeat(64));
    evidence.stages[1].status = 'passed'; // terrain-kernel passed, backend-proof still not-started
    const result = validateStageEvidence(evidence);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /prior stage/i.test(e)));
  });

  test('failed and incomplete verification require a nonblank explanation in errors', () => {
    const evidence = createEvidenceTemplate('a'.repeat(64));
    evidence.stages[0].status = 'failed';
    let result = validateStageEvidence(evidence);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /nonblank explanation/i.test(e)));

    evidence.stages[0].errors = ['WebGPU adapter request rejected: no compatible adapter.'];
    result = validateStageEvidence(evidence);
    assert.equal(result.valid, true, result.errors.join('; '));
  });

  test('visual stages cannot pass without required screenshot artifacts', () => {
    const evidence = createEvidenceTemplate('a'.repeat(64));
    evidence.stages[0].status = 'passed';
    evidence.stages[1].status = 'passed';
    evidence.stages[2].status = 'passed';
    evidence.stages[2].reviewed = true;
    evidence.stages[2].weaknesses = ['thin foreground detail'];
    evidence.stages[2].corrections = ['added a detail octave'];
    const result = validateStageEvidence(evidence);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /environment_only\.png/.test(e)));
  });

  test('final project completion requires all five stages passed and top-level status passed', () => {
    const evidence = createValidPassedEvidence('a'.repeat(64));
    const result = validateStageEvidence(evidence);
    assert.equal(result.valid, true, result.errors.join('; '));

    const incomplete = createValidPassedEvidence('a'.repeat(64));
    incomplete.stages[4].status = 'in-progress';
    incomplete.status = 'passed';
    const incompleteResult = validateStageEvidence(incomplete);
    assert.equal(incompleteResult.valid, false);
    assert.ok(incompleteResult.errors.some((e) => /status.*passed.*requires every stage/i.test(e)));
  });

  test('stage skipping is rejected: wrong IDs or wrong order fail validation', () => {
    const evidence = createEvidenceTemplate('a'.repeat(64));
    const reordered = { ...evidence, stages: [evidence.stages[1], evidence.stages[0], ...evidence.stages.slice(2)] };
    const result = validateStageEvidence(reordered);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /canonical order/i.test(e)));
  });

  test('build contract stages key is renamed from milestones and matches the 5 canonical IDs', () => {
    // See the file-level NOTE ON DEVIATION above: buildSampleModel() does not exist in this
    // file, so this reuses the established assembleBrief(validSignature(), ...) pattern used
    // throughout the rest of this file to obtain a real, fully validated build contract.
    const contract = assembleBrief(validSignature(), { rootDir: repoRoot }).buildContract;
    assert.ok(!('milestones' in contract), 'contract must not contain a milestones key');
    assert.deepEqual(contract.stages.map((s) => s.id), STAGE_IDS_IN_ORDER);
    assert.deepEqual(contract.implementationPlan.map((s) => s.id), STAGE_IDS_IN_ORDER);
    const validation = validateBuildContract(contract);
    assert.equal(validation.valid, true, validation.errors.join('; '));
  });

  test('diagnostics contract defines backendProof() alongside rendererInfo()', () => {
    const babylon = DIAGNOSTICS_CONTRACT_BY_PROFILE['babylon-webgpu'];
    assert.deepEqual(Object.keys(babylon), ['hook', 'lifecycle', 'rendererInfo', 'terrainDiagnostics', 'cameraDiagnostics', 'backendProof']);
    assert.deepEqual(babylon.backendProof.keys, [
      'engineInitialized', 'activeBackend', 'activeShaderLanguage', 'materialCompilationAttempted', 'materialCompiledAgainstMesh',
      'materialReady', 'requiredAttributes', 'presentVertexBuffers', 'declaredUniforms', 'declaredResources', 'manualBindings',
      'scopedValidationErrors', 'uncapturedValidationErrors', 'deviceLosses', 'frameSubmitted', 'frameCompleted',
    ]);
    assert.equal(babylon.backendProof.activeBackend, 'webgpu');
    assert.equal(babylon.backendProof.activeShaderLanguage, 'wgsl');
  });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const clone = (value) => JSON.parse(JSON.stringify(value));

const makeTempDir = () => {
  const tmp = path.join(repoRoot, 'tests', `tmp-contract-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
};

const removeTempDir = (dir) => {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
};

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

test('all six canonical showcases produce valid deterministic build contracts', () => {
  for (const name of Object.keys(SHOWCASES)) {
    const result = assembleBrief(canonicalShowcaseSpec(name), { rootDir: repoRoot });
    const repeated = assembleBrief(canonicalShowcaseSpec(name), { rootDir: repoRoot });
    const contractValidation = validateBuildContract(result.buildContract);
    const evidenceValidation = validateStageEvidence(result.evidenceTemplate);
    assert.equal(contractValidation.valid, true, `${name}: ${contractValidation.errors.join('; ')}`);
    assert.equal(evidenceValidation.valid, true, `${name}: ${evidenceValidation.errors.join('; ')}`);
    assert.deepEqual(result.buildContract.stages.map((stage) => stage.id), BUILD_CONTRACT_STAGES.map((stage) => stage.id));
    assert.equal(result.brief, repeated.brief, `${name}: Markdown output is not deterministic`);
    assert.equal(JSON.stringify(result.buildContract, null, 2), JSON.stringify(repeated.buildContract, null, 2), `${name}: JSON output is not deterministic`);
    assert.equal(validateAssemblyArtifacts({ model: result.assemblyModel, contract: result.buildContract, brief: result.brief }).valid, true);
  }
});

test('mode coverage preserves Proven, Signature, Experimental camera, and fully custom contracts', () => {
  const proven = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'proven-dune.json'), 'utf8'));
  const signature = validSignature();
  const experimentalCamera = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'experimental-base-camera.json'), 'utf8'));
  const fullyCustom = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'experimental-fully-custom.json'), 'utf8'));

  const provenContract = assembleBrief(proven, { rootDir: repoRoot }).buildContract;
  const signatureContract = assembleBrief(signature, { rootDir: repoRoot }).buildContract;
  const cameraContract = assembleBrief(experimentalCamera, { rootDir: repoRoot }).buildContract;
  const customContract = assembleBrief(fullyCustom, { rootDir: repoRoot }).buildContract;

  assert.equal(provenContract.selection.creativeMode, 'proven');
  assert.equal(provenContract.creative.signatureMoment.enabled, false);
  assert.equal(signatureContract.selection.creativeMode, 'signature');
  assert.equal(signatureContract.creative.signatureMoment.enabled, true);
  assert.deepEqual(cameraContract.selection.changedAxes, ['camera']);
  assert.equal(cameraContract.selection.path, 'base-showcase');
  assert.equal(customContract.selection.path, 'fully-custom');
  assert.equal(customContract.selection.baseShowcase, null);
  for (const contract of [provenContract, signatureContract, cameraContract, customContract]) {
    assert.equal(validateBuildContract(contract).valid, true);
    assert.deepEqual(Object.values(contract.creative.noveltyBudget), [false, false, false, false, false, false, false]);
  }
});

test('generated bundle contains deterministic contract and incomplete evidence template', () => {
  const tmpDir = makeTempDir();
  try {
    const spec = validSignature();
    const assembled = assembleBrief(spec, { rootDir: repoRoot });
    writeBundle(spec, tmpDir, { rootDir: repoRoot });
    const contractPath = path.join(tmpDir, BUILD_CONTRACT_FILENAME);
    const evidencePath = path.join(tmpDir, EVIDENCE_FILENAME);
    const contractText = fs.readFileSync(contractPath, 'utf8');
    const evidenceText = fs.readFileSync(evidencePath, 'utf8');
    assert.equal(contractText.endsWith('\n'), true);
    assert.equal(evidenceText.endsWith('\n'), true);
    assert.equal(validateBuildContract(JSON.parse(contractText)).valid, true);
    const evidence = JSON.parse(evidenceText);
    assert.equal(evidence.status, 'not-started');
    assert.equal(validateStageEvidence(evidence).valid, true);
    assert.deepEqual(evidence.stages.map((stage) => stage.id), STAGE_IDS_IN_ORDER);
    const handoff = fs.readFileSync(path.join(tmpDir, HANDOFF_FILENAME), 'utf8');
    const brief = fs.readFileSync(path.join(tmpDir, assembled.fileName), 'utf8');
    assert.match(handoff, /backend-proof.*terrain-kernel.*environment-composition.*character-locomotion.*mechanic-final-polish/s);
    assert.match(handoff, /incomplete verification/);
    assert.match(brief, /Implementation Stages and Visual Self-Review/);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('repeated assembly produces byte-identical Markdown and JSON contract output', () => {
  const first = assembleBrief(validSignature(), { rootDir: repoRoot });
  const second = assembleBrief(validSignature(), { rootDir: repoRoot });
  assert.equal(first.brief, second.brief);
  assert.equal(JSON.stringify(first.buildContract, null, 2) + '\n', JSON.stringify(second.buildContract, null, 2) + '\n');
});

const assertInvalidContractMutation = (label, mutate) => {
  const result = assembleBrief(validSignature(), { rootDir: repoRoot });
  const mutated = clone(result.buildContract);
  const before = JSON.stringify(mutated);
  mutate(mutated);
  assert.notEqual(JSON.stringify(mutated), before, `${label} mutation must change the generated contract`);
  const validation = validateBuildContract(mutated);
  assert.equal(validation.valid, false, `${label} must be rejected`);
  return validation.errors.join('; ');
};

test('adversarial contract mutation: JSON Signature versus Proven brief is rejected', () => {
  const errors = assertInvalidContractMutation('creative mode', (contract) => {
    contract.selection.creativeMode = 'proven';
  });
  assert.match(errors, /Proven mode|signature/i);
});

test('adversarial contract mutation: different camera is rejected', () => {
  const errors = assertInvalidContractMutation('camera', (contract) => {
    contract.selection.camera = 'Cinematic';
  });
  assert.match(errors, /camera|selection contract/i);
});

test('adversarial contract mutation: omitted state channel is rejected', () => {
  const errors = assertInvalidContractMutation('missing state channel', (contract) => {
    delete contract.stateChannels.channels.depression;
  });
  assert.match(errors, /stateChannels|missing|required/i);
});

test('adversarial contract mutation: unknown state channel is rejected', () => {
  const errors = assertInvalidContractMutation('unknown state channel', (contract) => {
    contract.stateChannels.channels.unknown = clone(contract.stateChannels.channels.depression);
  });
  assert.match(errors, /stateChannels|exactly/i);
});

test('adversarial contract mutation: novelty budget expansion is rejected', () => {
  const errors = assertInvalidContractMutation('novelty budget', (contract) => {
    contract.creative.noveltyBudget.addsInput = true;
  });
  assert.match(errors, /noveltyBudget|false/i);
});

test('adversarial contract mutation: wrong base showcase is rejected', () => {
  const errors = assertInvalidContractMutation('base showcase', (contract) => {
    contract.selection.baseShowcase = 'Dune Sea';
  });
  assert.match(errors, /showcase|selection contract/i);
});

test('adversarial contract mutation: contradictory included and omitted sections is rejected', () => {
  const errors = assertInvalidContractMutation('section omission', (contract) => {
    contract.selection.omittedOptionalSections = [];
  });
  assert.match(errors, /omitted|contradict/i);
});

test('adversarial contract mutation: missing, duplicate, and reordered stages are rejected', () => {
  const missing = assertInvalidContractMutation('missing stage', (contract) => {
    contract.stages.pop();
  });
  assert.match(missing, /stages|exactly/i);

  const duplicate = assertInvalidContractMutation('duplicate stage', (contract) => {
    contract.stages[1] = clone(contract.stages[0]);
  });
  assert.match(duplicate, /stages|must equal/i);

  const reordered = assertInvalidContractMutation('reordered stages', (contract) => {
    [contract.stages[0], contract.stages[1]] = [contract.stages[1], contract.stages[0]];
  });
  assert.match(reordered, /stages|must equal/i);
});

test('adversarial contract mutation: stage artifact requirements cannot be removed', () => {
  const errors = assertInvalidContractMutation('stage artifact requirement', (contract) => {
    delete contract.stages[2].requiredArtifacts;
  });
  assert.match(errors, /stages|missing|required/i);
});

test('contract rejects unknown keys at every schema level', () => {
  const paths = [
    ['top level', (contract) => { contract.unexpected = true; }],
    ['project', (contract) => { contract.project.unexpected = true; }],
    ['selection', (contract) => { contract.selection.unexpected = true; }],
    ['state channels', (contract) => { contract.stateChannels.unexpected = true; }],
    ['state channel entry', (contract) => { contract.stateChannels.channels.depression.unexpected = true; }],
    ['baseline', (contract) => { contract.stateChannels.channels.depression.baselineOrReset.unexpected = true; }],
    ['creative', (contract) => { contract.creative.unexpected = true; }],
    ['signature moment', (contract) => { contract.creative.signatureMoment.unexpected = true; }],
    ['novelty budget', (contract) => { contract.creative.noveltyBudget.unexpected = true; }],
    ['coherence override', (contract) => { contract.creative.coherenceOverrides.push({ rule: 'new-rule', reason: 'new reason', unexpected: true }); }],
    ['acceptance', (contract) => { contract.acceptance.unexpected = true; }],
    ['stage', (contract) => { contract.stages[0].unexpected = true; }],
    ['sourceOfTruth', (contract) => { contract.sourceOfTruth.unexpected = true; }],
    ['architecture', (contract) => { contract.architecture.unexpected = true; }],
    ['architecture file ownership entry', (contract) => { contract.architecture.fileOwnership[0].unexpected = true; }],
    ['approved pattern entry', (contract) => { contract.approvedPatterns[0].unexpected = true; }],
    ['forbidden pattern entry', (contract) => { contract.forbiddenPatterns[0].unexpected = true; }],
    ['implementation plan stage', (contract) => { contract.implementationPlan[0].unexpected = true; }],
    ['diagnostics', (contract) => { contract.diagnostics.unexpected = true; }],
    ['diagnostics rendererInfo', (contract) => { contract.diagnostics.rendererInfo.unexpected = true; }],
    ['review criteria', (contract) => { contract.reviewCriteria.unexpected = true; }],
    ['review criteria universal entry', (contract) => { contract.reviewCriteria.universal[0].unexpected = true; }],
  ];
  for (const [label, mutate] of paths) {
    assertInvalidContractMutation(`unknown ${label} key`, mutate);
  }
});

test('adversarial evidence mutation: false passed status without evidence is rejected', () => {
  const evidence = createEvidenceTemplate();
  evidence.status = 'passed';
  const before = JSON.stringify(evidence);
  assert.notEqual(evidence.status, 'not-started');
  const validation = validateStageEvidence(evidence);
  assert.equal(JSON.stringify(evidence), before);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /passed|stage/i);
});

test('adversarial evidence mutation: missing artifact capability cannot silently pass', () => {
  const evidence = createEvidenceTemplate();
  evidence.status = 'passed';
  for (const stage of evidence.stages) {
    stage.status = 'passed';
    stage.reviewed = true;
    stage.weaknesses = ['placeholder weakness'];
    stage.corrections = ['placeholder correction'];
  }
  const before = JSON.stringify(evidence);
  assert.equal(evidence.stages.every((stage) => stage.artifacts.length === 0), true);
  const validation = validateStageEvidence(evidence);
  assert.equal(JSON.stringify(evidence), before);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /artifact/i);
});

test('brief and generated JSON contract cross-validation rejects valid-shaped disagreement', () => {
  const tmpDir = makeTempDir();
  try {
    const spec = validSignature();
    const assembled = assembleBrief(spec, { rootDir: repoRoot });
    writeBundle(spec, tmpDir, { rootDir: repoRoot });
    const generatedContract = JSON.parse(fs.readFileSync(path.join(tmpDir, BUILD_CONTRACT_FILENAME), 'utf8'));
    generatedContract.creative.creativeSpark = 'different but valid spark';
    assert.notEqual(generatedContract.creative.creativeSpark, assembled.buildContract.creative.creativeSpark);
    assert.equal(validateBuildContract(generatedContract).valid, true, 'The mutation remains schema-valid so agreement must catch it');
    const jsonAgreement = validateAssemblyArtifacts({ model: assembled.assemblyModel, contract: generatedContract, brief: assembled.brief });
    assert.equal(jsonAgreement.valid, false);

    const mutatedModel = clone(assembled.assemblyModel);
    mutatedModel.project.renderingParadigm = 'Ghibli-Style Painterly Anime';
    assert.notEqual(mutatedModel.project.renderingParadigm, assembled.assemblyModel.project.renderingParadigm);
    const modelAgreement = validateAssemblyArtifacts({ model: mutatedModel, contract: assembled.buildContract, brief: assembled.brief });
    assert.equal(modelAgreement.valid, false);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('verifier source read failure leaves destination completely unchanged', () => {
  const tmpDir = makeTempDir();
  const originalReadFileSync = fs.readFileSync;
  try {
    const sentinel = path.join(tmpDir, 'sentinel.txt');
    fs.writeFileSync(sentinel, 'preserve me', 'utf8');
    const sourcePath = path.join(repoRoot, 'verify', 'gates.mjs');
    fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
      if (path.resolve(String(filePath)) === sourcePath) throw new Error('forced verifier read failure');
      return originalReadFileSync.call(this, filePath, ...args);
    };
    assert.throws(() => writeBundle(validSignature(), tmpDir, { rootDir: repoRoot, force: true }), /Missing or unreadable verifier source file/);
    assert.deepEqual(fs.readdirSync(tmpDir), ['sentinel.txt']);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve me');
  } finally {
    fs.readFileSync = originalReadFileSync;
    removeTempDir(tmpDir);
  }
});

test('force output preserves unrelated sentinels while owning contract and evidence files', () => {
  const tmpDir = makeTempDir();
  try {
    writeBundle(validSignature(), tmpDir, { rootDir: repoRoot });
    const sentinel = path.join(tmpDir, 'UNRELATED.txt');
    fs.writeFileSync(sentinel, 'sentinel', 'utf8');
    const contractPath = path.join(tmpDir, BUILD_CONTRACT_FILENAME);
    fs.writeFileSync(contractPath, 'changed', 'utf8');
    writeBundle(validSignature(), tmpDir, { rootDir: repoRoot, force: true });
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'sentinel');
    assert.equal(validateBuildContract(JSON.parse(fs.readFileSync(contractPath, 'utf8'))).valid, true);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('output collision leaves every existing bundle file byte-identical', () => {
  const tmpDir = makeTempDir();
  try {
    writeBundle(validSignature(), tmpDir, { rootDir: repoRoot });
    const before = new Map();
    const collect = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        const relative = path.relative(tmpDir, entryPath);
        if (entry.isDirectory()) collect(entryPath);
        else before.set(relative, fs.readFileSync(entryPath));
      }
    };
    collect(tmpDir);
    assert.throws(() => writeBundle(validSignature(), tmpDir, { rootDir: repoRoot }), /Destination collision/);
    const after = new Map();
    const collectAfter = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        const relative = path.relative(tmpDir, entryPath);
        if (entry.isDirectory()) collectAfter(entryPath);
        else after.set(relative, fs.readFileSync(entryPath));
      }
    };
    collectAfter(tmpDir);
    assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
    for (const [relative, contents] of before) assert.deepEqual(after.get(relative), contents, relative);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('generated bundle contains all verifier files', () => {
  const tmpDir = makeTempDir();
  try {
    const spec = validSignature();
    const result = writeBundle(spec, tmpDir, { rootDir: repoRoot });
    const expectedFiles = [
      'README.md',
      'gates.mjs',
      'report.mjs',
      'patternScan.mjs',
      'contractSchema.mjs',
      'metricSchema.mjs',
      'verify_demo.mjs',
    ];
    for (const file of expectedFiles) {
      const fullPath = path.join(tmpDir, 'verify', file);
      assert.equal(fs.existsSync(fullPath), true, `Missing verifier file verify/${file}`);
    }
    const verifierTargetPaths = expectedFiles.map((f) => path.join(tmpDir, 'verify', f));
    for (const vf of verifierTargetPaths) {
      assert.equal(result.writtenFiles.includes(vf), true, `writtenFiles missing ${vf}`);
    }
  } finally {
    removeTempDir(tmpDir);
  }
});

test('copied verify/verify_demo.mjs imports silently from generated bundle', async () => {
  const tmpDir = makeTempDir();
  try {
    const spec = validSignature();
    writeBundle(spec, tmpDir, { rootDir: repoRoot });
    const verifierPath = path.join(tmpDir, 'verify', 'verify_demo.mjs');
    const verifierModule = await import(pathToFileURL(verifierPath).href);
    assert.equal(typeof verifierModule.parseVerifyCliArgs, 'function');
  } finally {
    removeTempDir(tmpDir);
  }
});

test('deleting or making source verify/report.mjs unreadable causes preflight rejection before any bundle file is written', () => {
  const tmpDir = makeTempDir();
  const originalReadFileSync = fs.readFileSync;
  try {
    const sentinel = path.join(tmpDir, 'sentinel.txt');
    fs.writeFileSync(sentinel, 'preserve me', 'utf8');
    const reportPath = path.join(repoRoot, 'verify', 'report.mjs');
    fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
      if (path.resolve(String(filePath)) === reportPath) {
        throw new Error('forced report.mjs read failure');
      }
      return originalReadFileSync.call(this, filePath, ...args);
    };
    assert.throws(() => writeBundle(validSignature(), tmpDir, { rootDir: repoRoot, force: true }), /Missing or unreadable verifier source file/);
    assert.deepEqual(fs.readdirSync(tmpDir), ['sentinel.txt']);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve me');
  } finally {
    fs.readFileSync = originalReadFileSync;
    removeTempDir(tmpDir);
  }
});

test('smoke benchmark preparation produces three bundles whose copied verifiers import successfully', async () => {
  const tmpDir = makeTempDir();
  try {
    prepareBenchmark(tmpDir, { suite: 'smoke' });
    const smokeCaseIds = ['dune-proven', 'alpine-signature', 'alpine-experimental-camera'];
    for (const caseId of smokeCaseIds) {
      const verifierPath = path.join(tmpDir, caseId, 'bundle', 'verify', 'verify_demo.mjs');
      assert.equal(fs.existsSync(verifierPath), true, `Missing verifier in ${caseId}`);
      const verifierModule = await import(pathToFileURL(verifierPath).href);
      assert.equal(typeof verifierModule.parseVerifyCliArgs, 'function');
    }
  } finally {
    removeTempDir(tmpDir);
  }
});

// NOTE: createValidPassedEvidence() (the schema-v2 replacement for the old 3-milestone
// createValidCompletedEvidence() fixture) is declared near the top of this file, in the
// "stage evidence schema v2" section, and reused here per the Task 1 brief's Step 6
// instruction to keep exactly one definition.

test('fully populated five-stage passed evidence record validates', () => {
  const ev = createValidPassedEvidence(null);
  const validation = validateStageEvidence(ev);
  assert.equal(validation.valid, true, `Evidence validation failed: ${validation.errors.join('; ')}`);
});

test('adversarial evidence mutation: environment-composition passed with only unrelated.png is rejected', () => {
  const ev = createValidPassedEvidence('a'.repeat(64));
  const before = JSON.stringify(ev.stages[2].artifacts);
  ev.stages[2].artifacts = ['unrelated.png'];
  assert.notEqual(JSON.stringify(ev.stages[2].artifacts), before, 'artifacts field must be changed before testing');
  const validation = validateStageEvidence(ev);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /environment_only\.png|idle\.png/i);
});

test('adversarial evidence mutation: character-locomotion passed with only locomotion.png is rejected', () => {
  const ev = createValidPassedEvidence('a'.repeat(64));
  const before = JSON.stringify(ev.stages[3].artifacts);
  ev.stages[3].artifacts = ['locomotion.png'];
  assert.notEqual(JSON.stringify(ev.stages[3].artifacts), before, 'artifacts field must be changed before testing');
  const validation = validateStageEvidence(ev);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /idle\.png/i);
});

test('adversarial evidence mutation: mechanic-final-polish passed with only one artifact is rejected', () => {
  const ev = createValidPassedEvidence('a'.repeat(64));
  const before = JSON.stringify(ev.stages[4].artifacts);
  ev.stages[4].artifacts = ['idle.png'];
  assert.notEqual(JSON.stringify(ev.stages[4].artifacts), before, 'artifacts field must be changed before testing');
  const validation = validateStageEvidence(ev);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /locomotion\.png|mechanic\.png/i);
});

test('adversarial evidence mutation: passed stage with empty weaknesses is rejected', () => {
  const ev = createValidPassedEvidence('a'.repeat(64));
  const before = JSON.stringify(ev.stages[2].weaknesses);
  ev.stages[2].weaknesses = [];
  assert.notEqual(JSON.stringify(ev.stages[2].weaknesses), before, 'weaknesses field must be changed before testing');
  const validation = validateStageEvidence(ev);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /nonblank weakness/i);
});

test('adversarial evidence mutation: passed stage with empty corrections is rejected', () => {
  const ev = createValidPassedEvidence('a'.repeat(64));
  const before = JSON.stringify(ev.stages[2].corrections);
  ev.stages[2].corrections = [];
  assert.notEqual(JSON.stringify(ev.stages[2].corrections), before, 'corrections field must be changed before testing');
  const validation = validateStageEvidence(ev);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /nonblank correction/i);
});

test('adversarial evidence mutation: top-level passed status when one stage remains not passed is rejected', () => {
  const ev = createValidPassedEvidence('a'.repeat(64));
  const before = ev.stages[0].status;
  ev.stages[0].status = 'incomplete verification';
  ev.stages[0].errors = ['Forced failure for test: adapter request rejected.'];
  assert.notEqual(ev.stages[0].status, before, 'stage status field must be changed before testing');
  const validation = validateStageEvidence(ev);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /evidence\.status passed requires every stage to have passed/i);
});

test('strict contract validation requires project.briefSha256 to be 64 lowercase hex characters', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const contract = clone(assembled.buildContract);

  assert.equal(typeof contract.project.briefSha256, 'string');
  assert.equal(/^[0-9a-f]{64}$/.test(contract.project.briefSha256), true);

  const missingSha = clone(contract);
  delete missingSha.project.briefSha256;
  assert.equal(validateBuildContract(missingSha).valid, false);

  const upperSha = clone(contract);
  upperSha.project.briefSha256 = contract.project.briefSha256.toUpperCase();
  assert.equal(validateBuildContract(upperSha).valid, false);

  const invalidLenSha = clone(contract);
  invalidLenSha.project.briefSha256 = contract.project.briefSha256.slice(0, 63);
  assert.equal(validateBuildContract(invalidLenSha).valid, false);
});

test('adversarial brief mutation: camera-only Markdown mutation in main brief body is rejected', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const originalBrief = assembled.brief;
  const originalContractJson = JSON.stringify(assembled.buildContract);
  const originalModelJson = JSON.stringify(assembled.assemblyModel);

  const mutatedBrief = originalBrief.replace('Over-shoulder action-MMO framing', 'Over-shoulder cinematic framing');
  assert.notEqual(mutatedBrief, originalBrief, 'Markdown brief bytes must change');
  assert.equal(JSON.stringify(assembled.buildContract), originalContractJson, 'Contract must remain untouched');
  assert.equal(JSON.stringify(assembled.assemblyModel), originalModelJson, 'Model must remain untouched');

  const agreement = validateAssemblyArtifacts({
    model: assembled.assemblyModel,
    contract: assembled.buildContract,
    brief: mutatedBrief,
  });
  assert.equal(agreement.valid, false);
  assert.match(agreement.errors.join('; '), /briefSha256|computed brief hash/i);
});

test('adversarial brief mutation: state-channel-only Markdown mutation in main brief body is rejected', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const originalBrief = assembled.brief;
  const originalContractJson = JSON.stringify(assembled.buildContract);
  const originalModelJson = JSON.stringify(assembled.assemblyModel);

  const mutatedBrief = originalBrief.replace('carve groove lowers snow depression depth', 'carve groove increases snow depression depth');
  assert.notEqual(mutatedBrief, originalBrief, 'Markdown brief bytes must change');
  assert.equal(JSON.stringify(assembled.buildContract), originalContractJson, 'Contract must remain untouched');
  assert.equal(JSON.stringify(assembled.assemblyModel), originalModelJson, 'Model must remain untouched');

  const agreement = validateAssemblyArtifacts({
    model: assembled.assemblyModel,
    contract: assembled.buildContract,
    brief: mutatedBrief,
  });
  assert.equal(agreement.valid, false);
  assert.match(agreement.errors.join('; '), /briefSha256|computed brief hash/i);
});

test('adversarial brief mutation: stage-instruction-only Markdown mutation is rejected', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const originalBrief = assembled.brief;
  const originalContractJson = JSON.stringify(assembled.buildContract);
  const originalModelJson = JSON.stringify(assembled.assemblyModel);

  const mutatedBrief = originalBrief.replace('Work through the five stages in order.', 'Work through the stages in any order.');
  assert.notEqual(mutatedBrief, originalBrief, 'Markdown brief bytes must change');
  assert.equal(JSON.stringify(assembled.buildContract), originalContractJson, 'Contract must remain untouched');
  assert.equal(JSON.stringify(assembled.assemblyModel), originalModelJson, 'Model must remain untouched');

  const agreement = validateAssemblyArtifacts({
    model: assembled.assemblyModel,
    contract: assembled.buildContract,
    brief: mutatedBrief,
  });
  assert.equal(agreement.valid, false);
  assert.match(agreement.errors.join('; '), /briefSha256|computed brief hash/i);
});

test('written prompt SHA-256 equals ENVIZZLE_BUILD.json project.briefSha256', () => {
  const tmpDir = makeTempDir();
  try {
    const spec = validSignature();
    const { fileName } = assembleBrief(spec, { rootDir: repoRoot });
    writeBundle(spec, tmpDir, { rootDir: repoRoot });

    const promptPath = path.join(tmpDir, fileName);
    const contractPath = path.join(tmpDir, BUILD_CONTRACT_FILENAME);
    const promptText = fs.readFileSync(promptPath, 'utf8');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

    const computedHash = crypto.createHash('sha256').update(promptText, 'utf8').digest('hex');
    assert.equal(contract.project.briefSha256, computedHash);
  } finally {
    removeTempDir(tmpDir);
  }
});

test('build contract has exactly the 15 canonical top-level keys in order', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const keys = Object.keys(assembled.buildContract);
  assert.deepEqual(keys, [
    'schemaVersion', 'project', 'selection', 'stateChannels', 'terrainElevation', 'creative', 'acceptance', 'stages',
    'sourceOfTruth', 'architecture', 'approvedPatterns', 'forbiddenPatterns', 'implementationPlan', 'diagnostics', 'reviewCriteria',
  ]);
  assert.equal(keys.length, 15);
});

test('sourceOfTruth matches the canonical frozen value for every showcase', () => {
  for (const name of Object.keys(SHOWCASES)) {
    const assembled = assembleBrief(canonicalShowcaseSpec(name), { rootDir: repoRoot });
    assert.deepEqual(assembled.buildContract.sourceOfTruth, BUILD_CONTRACT_SOURCE_OF_TRUTH);
  }
});

test('adversarial contract mutation: sourceOfTruth builderRole mutated is rejected', () => {
  const errors = assertInvalidContractMutation('sourceOfTruth.builderRole', (contract) => {
    contract.sourceOfTruth.builderRole = 'reviewer';
  });
  assert.match(errors, /sourceOfTruth/);
});

test('adversarial contract mutation: sourceOfTruth missing required key is rejected', () => {
  const errors = assertInvalidContractMutation('sourceOfTruth missing conflictPolicy', (contract) => {
    delete contract.sourceOfTruth.conflictPolicy;
  });
  assert.match(errors, /sourceOfTruth|missing/i);
});

test('adversarial contract mutation: builderMayIgnoreFailedChecks flipped true is rejected', () => {
  const errors = assertInvalidContractMutation('sourceOfTruth.builderMayIgnoreFailedChecks', (contract) => {
    contract.sourceOfTruth.builderMayIgnoreFailedChecks = true;
  });
  assert.match(errors, /sourceOfTruth/);
});

test('architecture matches the canonical per-profile frozen value for both rendering profiles and differs between them', () => {
  const babylonAssembled = assembleBrief(canonicalShowcaseSpec('Alpine Dawn'), { rootDir: repoRoot });
  assert.equal(babylonAssembled.buildContract.project.renderingProfile, 'babylon-webgpu');
  assert.deepEqual(babylonAssembled.buildContract.architecture, BUILD_CONTRACT_ARCHITECTURE['babylon-webgpu']);

  const threeAssembled = assembleBrief(canonicalShowcaseSpec('Hoshi-no-Tani'), { rootDir: repoRoot });
  assert.equal(threeAssembled.buildContract.project.renderingProfile, 'three-webgl2');
  assert.deepEqual(threeAssembled.buildContract.architecture, BUILD_CONTRACT_ARCHITECTURE['three-webgl2']);

  assert.notDeepEqual(BUILD_CONTRACT_ARCHITECTURE['babylon-webgpu'], BUILD_CONTRACT_ARCHITECTURE['three-webgl2']);
  assert.deepEqual(
    BUILD_CONTRACT_ARCHITECTURE['babylon-webgpu'].terrainElevationOwnership,
    BUILD_CONTRACT_ARCHITECTURE['three-webgl2'].terrainElevationOwnership,
    'terrain elevation ownership is engine-agnostic and must be identical across profiles',
  );
});

test('adversarial contract mutation: architecture terrainElevationOwnership non-finite value is rejected', () => {
  const errors = assertInvalidContractMutation('architecture.terrainElevationOwnership.parityToleranceM', (contract) => {
    contract.architecture.terrainElevationOwnership.parityToleranceM = Infinity;
  });
  assert.match(errors, /architecture|finite/i);
});

test('adversarial contract mutation: architecture fileOwnership entry text mutated is rejected', () => {
  const errors = assertInvalidContractMutation('architecture.fileOwnership[0].responsibility', (contract) => {
    contract.architecture.fileOwnership[0].responsibility = 'something else entirely';
  });
  assert.match(errors, /architecture/i);
});

test('adversarial contract mutation: architecture missing terrainElevationOwnership key is rejected', () => {
  const errors = assertInvalidContractMutation('architecture missing terrainElevationOwnership', (contract) => {
    delete contract.architecture.terrainElevationOwnership;
  });
  assert.match(errors, /architecture|missing/i);
});

test('approvedPatterns and forbiddenPatterns match the canonical per-profile frozen registries', () => {
  const babylonAssembled = assembleBrief(canonicalShowcaseSpec('Alpine Dawn'), { rootDir: repoRoot });
  assert.deepEqual(babylonAssembled.buildContract.approvedPatterns, BUILD_CONTRACT_APPROVED_PATTERNS['babylon-webgpu']);
  assert.deepEqual(babylonAssembled.buildContract.forbiddenPatterns, BUILD_CONTRACT_FORBIDDEN_PATTERNS['babylon-webgpu']);

  const threeAssembled = assembleBrief(canonicalShowcaseSpec('Hoshi-no-Tani'), { rootDir: repoRoot });
  assert.deepEqual(threeAssembled.buildContract.approvedPatterns, BUILD_CONTRACT_APPROVED_PATTERNS['three-webgl2']);
  assert.deepEqual(threeAssembled.buildContract.forbiddenPatterns, BUILD_CONTRACT_FORBIDDEN_PATTERNS['three-webgl2']);
});

test('forbidden pattern registries contain the global minimum ID list and stay structurally parallel across profiles', () => {
  const universalIds = ['webgl-fallback', 'duplicate-terrain-displacement', 'cpu-predisplaced-render-mesh', 'premature-readiness', 'suppressed-initialization-failure', 'placeholder-character', 'indistinguishable-poses', 'render-loop-allocation', 'incomplete-evidence', 'continue-after-failed-stage'];
  const babylonIds = BUILD_CONTRACT_FORBIDDEN_PATTERNS['babylon-webgpu'].map((p) => p.id);
  const threeIds = BUILD_CONTRACT_FORBIDDEN_PATTERNS['three-webgl2'].map((p) => p.id);
  for (const id of universalIds) {
    assert.equal(babylonIds.includes(id), true, `babylon-webgpu missing universal id ${id}`);
    assert.equal(threeIds.includes(id), true, `three-webgl2 missing universal id ${id}`);
  }
  assert.equal(babylonIds.includes('manual-babylon-bindings'), true);
  assert.equal(babylonIds.includes('wrong-babylon-shader-language'), true);
  assert.equal(babylonIds.includes('wrong-babylon-shader-store'), true);
  assert.equal(new Set(babylonIds).size, babylonIds.length, 'no duplicate ids in babylon-webgpu registry');
  assert.equal(new Set(threeIds).size, threeIds.length, 'no duplicate ids in three-webgl2 registry');
  assert.equal(babylonIds.length, threeIds.length, 'both profiles should carry a structurally parallel pattern count');
});

test('adversarial contract mutation: approvedPatterns cross-profile registry swap is rejected', () => {
  const errors = assertInvalidContractMutation('approvedPatterns cross-profile swap', (contract) => {
    const otherProfile = contract.project.renderingProfile === 'babylon-webgpu' ? 'three-webgl2' : 'babylon-webgpu';
    contract.approvedPatterns = clone(BUILD_CONTRACT_APPROVED_PATTERNS[otherProfile]);
  });
  assert.match(errors, /approvedPatterns/i);
});

test('adversarial contract mutation: forbiddenPatterns blocking flag flipped is rejected', () => {
  const errors = assertInvalidContractMutation('forbiddenPatterns[0].blocking', (contract) => {
    contract.forbiddenPatterns[0].blocking = false;
  });
  assert.match(errors, /forbiddenPatterns/i);
});

test('implementationPlan contains exactly 5 stages in canonical ID and order, matching the frozen constant', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  assert.deepEqual(assembled.buildContract.implementationPlan.map((s) => s.id), ['backend-proof', 'terrain-kernel', 'environment-composition', 'character-locomotion', 'mechanic-final-polish']);
  assert.deepEqual(assembled.buildContract.implementationPlan.map((s) => s.order), [1, 2, 3, 4, 5]);
  assert.deepEqual(assembled.buildContract.implementationPlan, BUILD_CONTRACT_IMPLEMENTATION_PLAN);
});

test('adversarial contract mutation: implementationPlan reordered stages is rejected', () => {
  const errors = assertInvalidContractMutation('implementationPlan reordered stages', (contract) => {
    [contract.implementationPlan[0], contract.implementationPlan[1]] = [contract.implementationPlan[1], contract.implementationPlan[0]];
  });
  assert.match(errors, /implementationPlan/i);
});

test('adversarial contract mutation: implementationPlan stage order contradicts stage IDs', () => {
  const errors = assertInvalidContractMutation('implementationPlan order contradiction', (contract) => {
    contract.implementationPlan[0].order = 2;
    contract.implementationPlan[1].order = 1;
  });
  assert.match(errors, /implementationPlan/i);
});

test('adversarial contract mutation: implementationPlan doNotProceedUntilPassed flipped is rejected', () => {
  const errors = assertInvalidContractMutation('implementationPlan[0].doNotProceedUntilPassed', (contract) => {
    contract.implementationPlan[0].doNotProceedUntilPassed = false;
  });
  assert.match(errors, /implementationPlan/i);
});

test('adversarial contract mutation: implementationPlan missing stage is rejected', () => {
  const errors = assertInvalidContractMutation('implementationPlan missing stage', (contract) => {
    contract.implementationPlan.pop();
  });
  assert.match(errors, /implementationPlan/i);
});

test('diagnostics matches the canonical per-profile contract shape for both profiles', () => {
  const babylonAssembled = assembleBrief(canonicalShowcaseSpec('Alpine Dawn'), { rootDir: repoRoot });
  assert.deepEqual(babylonAssembled.buildContract.diagnostics, BUILD_CONTRACT_DIAGNOSTICS['babylon-webgpu']);
  assert.equal(babylonAssembled.buildContract.diagnostics.rendererInfo.backend, 'webgpu');
  assert.equal(babylonAssembled.buildContract.diagnostics.rendererInfo.shaderLanguage, 'wgsl');

  const threeAssembled = assembleBrief(canonicalShowcaseSpec('Hoshi-no-Tani'), { rootDir: repoRoot });
  assert.deepEqual(threeAssembled.buildContract.diagnostics, BUILD_CONTRACT_DIAGNOSTICS['three-webgl2']);
  assert.equal(threeAssembled.buildContract.diagnostics.rendererInfo.backend, 'webgl2');
  assert.equal(threeAssembled.buildContract.diagnostics.rendererInfo.shaderLanguage, 'glsl-es-300');
});

test('adversarial contract mutation: diagnostics rendererInfo wrong backend enum is rejected', () => {
  const errors = assertInvalidContractMutation('diagnostics.rendererInfo.backend', (contract) => {
    contract.diagnostics.rendererInfo.backend = contract.diagnostics.rendererInfo.backend === 'webgpu' ? 'webgl2' : 'webgpu';
  });
  assert.match(errors, /diagnostics/i);
});

test('adversarial contract mutation: diagnostics cameraDiagnostics non-finite threshold is rejected', () => {
  const errors = assertInvalidContractMutation('diagnostics.cameraDiagnostics.minNearestDepthM', (contract) => {
    contract.diagnostics.cameraDiagnostics.minNearestDepthM = Infinity;
  });
  assert.match(errors, /diagnostics|finite/i);
});

test('adversarial contract mutation: diagnostics missing lifecycle key is rejected', () => {
  const errors = assertInvalidContractMutation('diagnostics missing lifecycle', (contract) => {
    delete contract.diagnostics.lifecycle;
  });
  assert.match(errors, /diagnostics|missing/i);
});

test('reviewCriteria universal slice matches the canonical frozen 12-category set', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  assert.deepEqual(assembled.buildContract.reviewCriteria.universal, BUILD_CONTRACT_REVIEW_CRITERIA_UNIVERSAL);
  assert.equal(assembled.buildContract.reviewCriteria.universal.length, 12);
  const categories = assembled.buildContract.reviewCriteria.universal.map((c) => c.category);
  assert.deepEqual(categories, [
    'biome-identity', 'composition', 'terrain-quality', 'lod-continuity', 'material-quality',
    'character-silhouette', 'character-scale', 'locomotion-readability', 'mechanic-readability',
    'placeholder-detection', 'visual-hierarchy', 'scope-discipline',
  ]);
});

test('reviewCriteria biomeSpecific is populated for every biome now that all six define the optional morphology tokens', () => {
  for (const name of Object.keys(SHOWCASES)) {
    const assembled = assembleBrief(canonicalShowcaseSpec(name), { rootDir: repoRoot });
    assert.equal(
      assembled.buildContract.reviewCriteria.biomeSpecific.length,
      2,
      `${name} (biome ${SHOWCASES[name].biome}) should have 2 biomeSpecific entries`,
    );
    assert.equal(validateBuildContract(assembled.buildContract).valid, true);
  }
});

test('reviewCriteria biomeSpecific is populated end-to-end for a Dune-based showcase from references/biomes.md tokens', () => {
  // This is the cross-task wiring proof: Task 1 added the biomeReviewCriteria() plumbing
  // reading biome.tokens.MORPHOLOGY_ANTI_PATTERNS / VISUAL_REVIEW_QUESTIONS, and this task
  // is the first to actually populate those tokens (Dune Desert only, in biomes.md). This
  // test proves the full path — reference-loader.mjs parsing through createBuildContract —
  // actually produces non-empty content, not just that the markdown file has the right text.
  const duneShowcaseName = Object.keys(SHOWCASES).find((name) => SHOWCASES[name].biome === 'Dune Desert');
  assert.ok(duneShowcaseName, 'expected at least one canonical showcase built on the Dune Desert biome');

  const assembled = assembleBrief(canonicalShowcaseSpec(duneShowcaseName), { rootDir: repoRoot });
  const { biomeSpecific } = assembled.buildContract.reviewCriteria;

  assert.equal(Array.isArray(biomeSpecific), true);
  assert.equal(biomeSpecific.length, 2);

  const normalizeWhitespace = (s) => s.replace(/\s+/g, ' ').trim();

  const morphology = biomeSpecific.find((entry) => entry.category === 'morphology-anti-patterns');
  assert.ok(morphology, 'expected a morphology-anti-patterns entry');
  assert.equal(morphology.questions.length, 1);
  assert.equal(
    normalizeWhitespace(morphology.questions[0]),
    'Do not represent dunes as overlapping cones, pyramids, low-resolution square tiles, visibly independent LOD grids, or repeated isolated procedural primitives.',
  );

  const visualReview = biomeSpecific.find((entry) => entry.category === 'biome-visual-review-questions');
  assert.ok(visualReview, 'expected a biome-visual-review-questions entry');
  assert.equal(visualReview.questions.length, 1);
  const normalizedVisualReview = normalizeWhitespace(visualReview.questions[0]);
  assert.match(normalizedVisualReview, /crescent-shaped barchan/);
  assert.match(normalizedVisualReview, /surf\/carve mechanic/);

  assert.equal(validateBuildContract(assembled.buildContract).valid, true);

  // Also prove it via the raw fixture path used for the Proven-mode Dune showcase, so the
  // wiring is proven under a second, independently authored entry point (not just the
  // canonicalShowcaseSpec helper above).
  const proven = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'proven-dune.json'), 'utf8'));
  const provenAssembled = assembleBrief(proven, { rootDir: repoRoot });
  assert.equal(provenAssembled.buildContract.selection.biome, 'Dune Desert');
  assert.equal(provenAssembled.buildContract.reviewCriteria.biomeSpecific.length, 2);
  assert.equal(validateBuildContract(provenAssembled.buildContract).valid, true);
});

test('adversarial contract mutation: reviewCriteria universal question text mutated is rejected', () => {
  const errors = assertInvalidContractMutation('reviewCriteria.universal[0].questions[0]', (contract) => {
    contract.reviewCriteria.universal[0].questions[0] = 'A different question entirely.';
  });
  assert.match(errors, /reviewCriteria/i);
});

test('adversarial contract mutation: reviewCriteria biomeSpecific entry with empty category is rejected', () => {
  const errors = assertInvalidContractMutation('reviewCriteria.biomeSpecific empty category', (contract) => {
    contract.reviewCriteria.biomeSpecific.push({ category: '', questions: ['something'] });
  });
  assert.match(errors, /reviewCriteria|non-empty/i);
});

test('adversarial contract mutation: reviewCriteria biomeSpecific entry with unknown key is rejected', () => {
  const errors = assertInvalidContractMutation('reviewCriteria.biomeSpecific unknown key', (contract) => {
    contract.reviewCriteria.biomeSpecific.push({ category: 'x', questions: ['y'], extra: true });
  });
  assert.match(errors, /reviewCriteria|unknown/i);
});

test('adversarial contract mutation: reviewCriteria missing biomeSpecific key is rejected', () => {
  const errors = assertInvalidContractMutation('reviewCriteria missing biomeSpecific', (contract) => {
    delete contract.reviewCriteria.biomeSpecific;
  });
  assert.match(errors, /reviewCriteria|missing/i);
});

test('evidence template briefSha256 defaults to null and validates', () => {
  const evidence = createEvidenceTemplate();
  assert.equal(evidence.briefSha256, null);
  assert.equal(validateStageEvidence(evidence).valid, true);
});

test('adversarial evidence mutation: briefSha256 malformed string is rejected', () => {
  const evidence = createEvidenceTemplate();
  const before = evidence.briefSha256;
  evidence.briefSha256 = 'not-a-valid-hash';
  assert.notEqual(evidence.briefSha256, before);
  const validation = validateStageEvidence(evidence);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /briefSha256/i);
});

test('adversarial evidence mutation: passed evidence with a valid-looking briefSha256 still validates structurally', () => {
  const ev = createValidPassedEvidence(null);
  ev.briefSha256 = 'a'.repeat(64);
  const validation = validateStageEvidence(ev);
  assert.equal(validation.valid, true, validation.errors.join('; '));
});

test('validateEvidenceContractBinding rejects a missing evidence briefSha256, rejects a mismatch, and accepts a match', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const contract = assembled.buildContract;

  const missingErrors = [];
  validateEvidenceContractBinding(contract, createEvidenceTemplate(), missingErrors);
  assert.equal(missingErrors.length > 0, true);
  assert.match(missingErrors.join('; '), /briefSha256/i);

  const mismatchErrors = [];
  const evidenceWrongHash = { ...createEvidenceTemplate(), briefSha256: '0'.repeat(64) };
  assert.notEqual(evidenceWrongHash.briefSha256, contract.project.briefSha256);
  validateEvidenceContractBinding(contract, evidenceWrongHash, mismatchErrors);
  assert.equal(mismatchErrors.length > 0, true);
  assert.match(mismatchErrors.join('; '), /does not match/i);

  const matchErrors = [];
  const evidenceMatchingHash = { ...createEvidenceTemplate(), briefSha256: contract.project.briefSha256 };
  validateEvidenceContractBinding(contract, evidenceMatchingHash, matchErrors);
  assert.equal(matchErrors.length, 0, matchErrors.join('; '));
});

// ---------------------------------------------------------------------------
// Task 4: render*() functions for the 7 staged-build-supervisor sections,
// the ACCEPTANCE_GATES hook-shape update, and the HANDOFF.md rewrite.
// ---------------------------------------------------------------------------

const babylonContract = () => assembleBrief(canonicalShowcaseSpec('Alpine Dawn'), { rootDir: repoRoot }).buildContract;
const threeWebgl2Contract = () => assembleBrief(canonicalShowcaseSpec('Hoshi-no-Tani'), { rootDir: repoRoot }).buildContract;
const duneContract = () => {
  const duneShowcaseName = Object.keys(SHOWCASES).find((name) => SHOWCASES[name].biome === 'Dune Desert');
  return assembleBrief(canonicalShowcaseSpec(duneShowcaseName), { rootDir: repoRoot }).buildContract;
};
const nonDuneContract = () => babylonContract();

test('ACCEPTANCE_GATES.camera.hook and verificationHook.requiredHooks reference the new truthful window.__demo hook shape', () => {
  assert.equal(BUILD_CONTRACT_ACCEPTANCE.camera.hook, 'window.__demo.cameraDiagnostics()');
  assert.doesNotMatch(BUILD_CONTRACT_ACCEPTANCE.camera.hook, /cameraNearestDepth/);
  assert.deepEqual(BUILD_CONTRACT_ACCEPTANCE.verificationHook.requiredHooks, [
    'setPose', 'setCharacterVisible', 'rendererInfo', 'terrainDiagnostics', 'cameraDiagnostics', 'frameStats', 'backendProof',
  ]);
  assert.doesNotMatch(BUILD_CONTRACT_ACCEPTANCE.verificationHook.requiredHooks.join(','), /cameraNearestDepth/);
});

test('assembled contract acceptance gates carry the new hook shape for every showcase', () => {
  for (const name of Object.keys(SHOWCASES)) {
    const assembled = assembleBrief(canonicalShowcaseSpec(name), { rootDir: repoRoot });
    assert.deepEqual(assembled.buildContract.acceptance, BUILD_CONTRACT_ACCEPTANCE);
    assert.equal(assembled.buildContract.acceptance.camera.hook, 'window.__demo.cameraDiagnostics()');
  }
});

test('adversarial contract mutation: reverting acceptance.camera.hook to the old cameraNearestDepth() shape is rejected', () => {
  const errors = assertInvalidContractMutation('acceptance.camera.hook reverted to old shape', (contract) => {
    contract.acceptance.camera.hook = 'window.__demo.cameraNearestDepth()';
  });
  assert.match(errors, /acceptance/i);
});

test('adversarial contract mutation: reverting acceptance.verificationHook.requiredHooks to the old hook list is rejected', () => {
  const errors = assertInvalidContractMutation('acceptance.verificationHook.requiredHooks reverted to old shape', (contract) => {
    contract.acceptance.verificationHook.requiredHooks = ['setPose', 'setCharacterVisible', 'cameraNearestDepth', 'frameStats'];
  });
  assert.match(errors, /acceptance/i);
});

test('renderProductPrinciple includes the exact verbatim product-principle sentence and sourceOfTruth fields', () => {
  const contract = babylonContract();
  const rendered = renderProductPrinciple(contract);
  assert.match(rendered, /^## Product Principle/);
  assert.ok(rendered.includes(PRODUCT_PRINCIPLE_SENTENCE), 'must include the exact product-principle sentence verbatim');
  assert.match(rendered, /may not redesign the renderer, terrain ownership, shader integration, fallback strategy, module responsibilities, readiness lifecycle, verification interfaces, or stage order/);
  assert.match(rendered, /`implementer`/);
  assert.match(rendered, /`stop-and-report`/);
  for (const input of contract.sourceOfTruth.requiredInputs) {
    assert.ok(rendered.includes(`\`${input}\``), `missing required input ${input}`);
  }
});

test('renderArchitectureOwnership includes the verbatim terrain elevation ownership meaning text and every file-ownership row', () => {
  const contract = babylonContract();
  const rendered = renderArchitectureOwnership(contract);
  assert.match(rendered, /^## Architecture Ownership/);
  assert.ok(rendered.includes(TERRAIN_ELEVATION_OWNERSHIP_MEANING_TEXT), 'must include the exact terrain elevation ownership meaning text verbatim');
  for (const entry of contract.architecture.fileOwnership) {
    assert.ok(rendered.includes(entry.path), `missing file ownership path ${entry.path}`);
    assert.ok(rendered.includes(entry.responsibility), `missing file ownership responsibility for ${entry.path}`);
  }
  assert.match(rendered, /base height y = 0/);
});

test('renderArchitectureOwnership differs between rendering profiles but shares identical terrain elevation ownership text', () => {
  const babylonRendered = renderArchitectureOwnership(babylonContract());
  const threeRendered = renderArchitectureOwnership(threeWebgl2Contract());
  assert.notEqual(babylonRendered, threeRendered);
  assert.ok(babylonRendered.includes(TERRAIN_ELEVATION_OWNERSHIP_MEANING_TEXT));
  assert.ok(threeRendered.includes(TERRAIN_ELEVATION_OWNERSHIP_MEANING_TEXT));
  assert.match(babylonRendered, /WGSL/);
  assert.match(threeRendered, /GLSL/);
});

test('renderImplementationStages iterates all five stages in canonical order with their full field set', () => {
  const contract = babylonContract();
  const rendered = renderImplementationStages(contract);
  assert.match(rendered, /^## Implementation Stages/);
  const stageOrder = ['backend-proof', 'terrain-kernel', 'environment-composition', 'character-locomotion', 'mechanic-final-polish'];
  let lastIndex = -1;
  for (const id of stageOrder) {
    const index = rendered.indexOf(`### ${stageOrder.indexOf(id) + 1}. ${id}`);
    assert.ok(index > lastIndex, `stage ${id} missing or out of order`);
    lastIndex = index;
  }
  for (const stage of contract.implementationPlan) {
    for (const output of stage.requiredOutputs) assert.ok(rendered.includes(output), `missing requiredOutput "${output}" for stage ${stage.id}`);
  }
});

test('renderImplementationStages surfaces profile-specific forbidden patterns under the backend-proof stage for babylon-webgpu', () => {
  const rendered = renderImplementationStages(babylonContract());
  const backendProofSection = rendered.slice(rendered.indexOf('### 1. backend-proof'), rendered.indexOf('### 2. terrain-kernel'));
  for (const id of ['manual-babylon-bindings', 'wrong-babylon-shader-language', 'wrong-babylon-shader-store']) {
    assert.ok(backendProofSection.includes(id), `backend-proof stage text missing profile-specific forbidden pattern ${id}`);
  }
  // These profile-specific IDs must not also leak into unrelated later stages.
  const terrainKernelSection = rendered.slice(rendered.indexOf('### 2. terrain-kernel'), rendered.indexOf('### 3. environment-composition'));
  assert.doesNotMatch(terrainKernelSection, /wrong-babylon-shader-language/);
});

test('renderImplementationStages surfaces profile-specific forbidden patterns under the backend-proof stage for three-webgl2', () => {
  const rendered = renderImplementationStages(threeWebgl2Contract());
  const backendProofSection = rendered.slice(rendered.indexOf('### 1. backend-proof'), rendered.indexOf('### 2. terrain-kernel'));
  for (const id of ['wgsl-binding-syntax-in-webgl2', 'wrong-webgl2-shader-language', 'webgl1-fallback-context']) {
    assert.ok(backendProofSection.includes(id), `backend-proof stage text missing profile-specific forbidden pattern ${id}`);
  }
});

test('renderBabylonPatternGuidance splices the verbatim positive-pattern code example for babylon-webgpu only', () => {
  const babylonRendered = renderBabylonPatternGuidance(babylonContract());
  assert.match(babylonRendered, /### Positive Pattern Example: Minimal WGSL ShaderMaterial/);
  assert.match(babylonRendered, /```js/);
  assert.match(babylonRendered, /ShaderStore\.ShadersStoreWGSL\["envizzleTerrainVertexShader"\]/);
  assert.match(babylonRendered, /forceCompilationAsync\(terrainMesh\)/);
  // The spliced example itself contains no manual @group(N)/@binding(N) *declarations* (the only
  // occurrences of those substrings are inside a comment explaining their absence) — confirm no
  // WGSL attribute-style usage like "@group(0)" appears anywhere in the code fence.
  const codeExampleBlock = babylonRendered.slice(babylonRendered.indexOf('```js'));
  assert.doesNotMatch(codeExampleBlock, /@group\(\d/);
  assert.doesNotMatch(codeExampleBlock, /@binding\(\d/);

  const threeRendered = renderBabylonPatternGuidance(threeWebgl2Contract());
  assert.doesNotMatch(threeRendered, /Positive Pattern Example/);
  assert.doesNotMatch(threeRendered, /```js/);
  assert.match(threeRendered, /three-webgl2/);
});

test('renderBabylonPatternGuidance lists every approved and forbidden pattern for the contract\'s own profile only', () => {
  const babylonContractValue = babylonContract();
  const rendered = renderBabylonPatternGuidance(babylonContractValue);
  for (const pattern of babylonContractValue.approvedPatterns) assert.ok(rendered.includes(pattern.id), `missing approved pattern ${pattern.id}`);
  for (const pattern of babylonContractValue.forbiddenPatterns) assert.ok(rendered.includes(pattern.id), `missing forbidden pattern ${pattern.id}`);
  // Three-webgl2-only forbidden pattern IDs must not appear for a babylon-webgpu contract.
  for (const pattern of BUILD_CONTRACT_FORBIDDEN_PATTERNS['three-webgl2']) {
    if (!BUILD_CONTRACT_FORBIDDEN_PATTERNS['babylon-webgpu'].some((p) => p.id === pattern.id)) {
      assert.doesNotMatch(rendered, new RegExp(pattern.id));
    }
  }
});

test('renderForbiddenPatterns lists every forbidden pattern and groups profile-specific ones under backend-proof for both profiles', () => {
  const babylonRendered = renderForbiddenPatterns(babylonContract());
  assert.match(babylonRendered, /^## Forbidden Patterns/);
  assert.match(babylonRendered, /### Forbidden Patterns by Implementation Stage/);
  assert.match(babylonRendered, /\*\*backend-proof:\*\*[^\n]*manual-babylon-bindings/);
  assert.match(babylonRendered, /\*\*backend-proof:\*\*[^\n]*wrong-babylon-shader-language/);
  assert.match(babylonRendered, /\*\*backend-proof:\*\*[^\n]*wrong-babylon-shader-store/);

  const threeRendered = renderForbiddenPatterns(threeWebgl2Contract());
  assert.match(threeRendered, /\*\*backend-proof:\*\*[^\n]*wgsl-binding-syntax-in-webgl2/);
  assert.match(threeRendered, /\*\*backend-proof:\*\*[^\n]*wrong-webgl2-shader-language/);
  assert.match(threeRendered, /\*\*backend-proof:\*\*[^\n]*webgl1-fallback-context/);
});

test('renderReviewCriteria includes all 12 universal categories and omits the Biome-Specific heading when biomeSpecific is empty', () => {
  // Every real biome now defines the optional morphology tokens (Task 12), so no live
  // showcase produces an empty biomeSpecific array anymore. Force the case synthetically
  // to keep renderReviewCriteria's omit-when-empty branch covered.
  const base = nonDuneContract();
  const contract = { ...base, reviewCriteria: { ...base.reviewCriteria, biomeSpecific: [] } };
  assert.deepEqual(contract.reviewCriteria.biomeSpecific, []);
  const rendered = renderReviewCriteria(contract);
  assert.match(rendered, /^## Review Criteria/);
  for (const entry of BUILD_CONTRACT_REVIEW_CRITERIA_UNIVERSAL) {
    assert.ok(rendered.includes(entry.category), `missing universal category ${entry.category}`);
  }
  assert.doesNotMatch(rendered, /### Biome-Specific/);
});

test('renderReviewCriteria includes the verbatim Dune anti-pattern and positive-requirement text when biome is Dune Desert', () => {
  const contract = duneContract();
  const rendered = renderReviewCriteria(contract);
  assert.match(rendered, /### Biome-Specific/);
  // Source markdown hard-wraps long lines, so normalize whitespace before matching the
  // verbatim sentence (same technique the existing biomeSpecific end-to-end test uses).
  const normalizeWhitespace = (s) => s.replace(/\s+/g, ' ').trim();
  const normalizedRendered = normalizeWhitespace(rendered);
  assert.match(normalizedRendered, /Do not represent dunes as overlapping cones, pyramids, low-resolution square tiles, visibly independent LOD grids, or repeated isolated procedural primitives\./);
  assert.match(normalizedRendered, /crescent-shaped barchan/);
  assert.match(normalizedRendered, /surf\/carve mechanic/);
});

test('renderHandoff no longer contains the old "needs nothing else" sentence and contains the exact stop-and-report stage workflow text', () => {
  const contract = babylonContract();
  const rendered = renderHandoff({ fileName: 'X_TECHDEMO_PROMPT.md', builderAgent: 'Claude Code', contract });
  assert.doesNotMatch(rendered, /needs nothing else/i);
  assert.ok(rendered.includes(HANDOFF_STAGE_WORKFLOW_TEXT), 'must include the exact HANDOFF.md stage workflow text verbatim');
  assert.match(rendered, /Implement the five stages in order\./);
  assert.doesNotMatch(rendered, /Do not ask the user for approval after every successful stage\.[\s\S]*Do not ask the user for approval after every successful stage\./, 'workflow text must not be duplicated');
  assert.match(rendered, /the complete implementation brief/i);
});

test('assembleBrief wires every staged section and enables hard drift detection', () => {
  const assembled = assembleBrief(validSignature(), { rootDir: repoRoot });
  const withoutFlag = validateAssemblyArtifacts({ model: assembled.assemblyModel, contract: assembled.buildContract, brief: assembled.brief });
  assert.equal(withoutFlag.valid, true, withoutFlag.errors.join('; '));

  const withFlag = validateAssemblyArtifacts({ model: assembled.assemblyModel, contract: assembled.buildContract, brief: assembled.brief, checkStagedSections: true });
  assert.equal(withFlag.valid, true, withFlag.errors.join('; '));
});

function buildSyntheticStagedBrief(contract) {
  return [
    renderContractSummary(contract),
    renderStageEvidenceInstructions(contract),
    renderProductPrinciple(contract),
    renderArchitectureOwnership(contract),
    renderImplementationStages(contract),
    renderBabylonPatternGuidance(contract),
    renderForbiddenPatterns(contract),
    renderReviewCriteria(contract),
    renderVisualAcceptanceHierarchy(contract),
  ].join('\n');
}

function syntheticAssembly(contract) {
  // Build a self-consistent {model, contract, brief} triple: recompute the brief hash for a
  // synthetic brief containing every render*() section, patch it onto a cloned contract, and
  // derive `model` the same way createBuildContract expects (schemaVersion stripped).
  const brief = buildSyntheticStagedBrief(contract);
  const briefSha256 = crypto.createHash('sha256').update(brief, 'utf8').digest('hex');
  const patchedContract = clone(contract);
  patchedContract.project.briefSha256 = briefSha256;
  const { schemaVersion, ...model } = clone(patchedContract);
  return { model, contract: patchedContract, brief };
}

test('checkStagedSections:true validates a synthetic brief that contains every new render*() section', () => {
  const contract = babylonContract();
  const { model, contract: patchedContract, brief } = syntheticAssembly(contract);
  const result = validateAssemblyArtifacts({ model, contract: patchedContract, brief, checkStagedSections: true });
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('checkStagedSections:true rejects a synthetic brief with one render*() section stripped out (proves drift detection works, not just exists)', () => {
  const contract = babylonContract();
  const { model, contract: patchedContract, brief } = syntheticAssembly(contract);

  const strippedSection = renderForbiddenPatterns(patchedContract);
  assert.ok(brief.includes(strippedSection), 'precondition: the synthetic brief must actually contain the section being stripped');
  const strippedBrief = brief.replace(strippedSection, '');
  assert.notEqual(strippedBrief, brief, 'stripping must actually change the brief');

  const result = validateAssemblyArtifacts({ model, contract: patchedContract, brief: strippedBrief, checkStagedSections: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('brief does not contain the canonical forbidden pattern list'));
});

test('checkStagedSections:true rejects a synthetic brief with the product principle section stripped out', () => {
  const contract = threeWebgl2Contract();
  const { model, contract: patchedContract, brief } = syntheticAssembly(contract);

  const strippedSection = renderProductPrinciple(patchedContract);
  const strippedBrief = brief.replace(strippedSection, '');
  assert.notEqual(strippedBrief, brief);

  const result = validateAssemblyArtifacts({ model, contract: patchedContract, brief: strippedBrief, checkStagedSections: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('brief does not contain the canonical product principle'));
});

test('renderHandoff instructs autonomous construction of the complete five-stage slice, not per-stage approval pauses', () => {
  const contract = babylonContract();
  const handoff = renderHandoff({ fileName: contract.project.briefFilename, builderAgent: 'test-agent', contract });
  assert.ok(!/give this file to the coding agent, whole\. it needs nothing else/i.test(handoff));
  assert.ok(/read the entire bundle/i.test(handoff));
  assert.ok(/implement the five stages in order/i.test(handoff));
  assert.ok(/do not ask the user for approval after every successful stage/i.test(handoff));
  assert.ok(/stop and report only when/i.test(handoff));
  for (const requiredFile of ['ENVIZZLE_BUILD.json', 'ENVIZZLE_EVIDENCE.json', 'HANDOFF.md', 'verify/']) {
    assert.ok(handoff.includes(requiredFile));
  }
});

test('renderVisualAcceptanceHierarchy renders the 5-item acceptance hierarchy with the entry-condition principle first', () => {
  const contract = babylonContract();
  const text = renderVisualAcceptanceHierarchy(contract);
  assert.ok(text.includes('Technical correctness is the entry condition'));
  const order = ['honest', 'selected biome', 'dramatic visual response', 'feel connected', 'Performance and implementation quality'];
  let lastIndex = -1;
  for (const phrase of order) {
    const idx = text.indexOf(phrase);
    assert.ok(idx > lastIndex, `expected "${phrase}" to appear after the previous hierarchy item`);
    lastIndex = idx;
  }
});
