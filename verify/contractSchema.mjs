// Vendored, standalone copy of ENVIZZLE_BUILD.json/ENVIZZLE_EVIDENCE.json validation — must stay in sync with build-contract.mjs's canonical shapes (see that file for the source of truth); this file must NOT import from it.

// ---------------------------------------------------------------------------
// Small vendored enums/constants (kept intentionally short — large frozen
// registries like the full architecture file-ownership text, the full
// approved/forbidden pattern reason strings, and the 12-category review
// criteria question text are validated structurally below instead of
// byte-for-byte, to avoid duplicating build-contract.mjs's entire frozen
// constant set inside a standalone bundle module).
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 2;

const CREATIVE_MODES = ['proven', 'signature', 'experimental'];
const SELECTION_PATHS = ['showcase', 'base-showcase', 'fully-custom'];
const AMBITIONS = ['slice', 'showcase', 'everything'];
const ARCHETYPES = ['Robed Mage', 'Traveller Coat', 'Armored Soldier', 'Desert Nomad', 'Void Wanderer'];
const RENDERING_PROFILE_IDS = ['babylon-webgpu', 'three-webgl2'];
const RENDERING_PARADIGMS = ['AAA Photoreal', 'Ghibli-Style Painterly Anime'];

const NOVELTY_BUDGET_KEYS = ['addsEngine', 'addsAssetCategory', 'addsPersistentBuffer', 'addsMajorRenderPass', 'addsSimulationSubsystem', 'addsInput', 'increasesAmbition'];
const REQUIRED_CAPTURE_POSES = ['idle', 'locomotion', 'mechanic'];
const POSE_FILENAME_MAP = { idle: 'idle.png', locomotion: 'locomotion.png', mechanic: 'mechanic.png' };

const CONTRACT_TOP_KEYS = ['schemaVersion', 'project', 'selection', 'stateChannels', 'terrainElevation', 'creative', 'acceptance', 'stages', 'sourceOfTruth', 'architecture', 'approvedPatterns', 'forbiddenPatterns', 'implementationPlan', 'diagnostics', 'reviewCriteria'];
const PROJECT_KEYS = ['name', 'briefFilename', 'briefSha256', 'renderingProfile', 'engine', 'shaderLanguage', 'shaderLanguageExtension', 'materialApi', 'renderingParadigm', 'assetStrategy', 'assetStrategyText', 'targetHardware', 'coreInteractionSentence'];
const SELECTION_KEYS = ['creativeMode', 'path', 'baseShowcase', 'ambition', 'includedSections', 'omittedOptionalSections', 'extraSections', 'biome', 'archetype', 'mechanic', 'camera', 'renderingProfile', 'cameraAdjustments', 'changedAxes'];
const STATE_CHANNEL_KEYS = ['enabled', 'omittedBehavior', 'channels'];
const STATE_ENTRY_KEYS = ['channel', 'nativeMeaning', 'owningSystem', 'writers', 'readers', 'visibleEffect', 'baselineOrReset'];
const BASELINE_KEYS = ['baseline', 'recoveryMechanism', 'recoveryOutcome'];
const CREATIVE_KEYS = ['creativeSpark', 'signatureMoment', 'noveltyBudget', 'coherenceOverrides'];
const SIGNATURE_KEYS = ['enabled', 'text', 'reusedSystem', 'verificationPose', 'instruction'];
const ACCEPTANCE_KEYS = ['requiredProjectPaths', 'productionBuild', 'verificationHook', 'renderer', 'terrain', 'runtime', 'captures', 'imageGates', 'camera', 'evidence', 'environmentVisuals', 'poseDifferences', 'report'];
const STAGE_STATUSES = ['not-started', 'in-progress', 'passed', 'failed', 'incomplete verification'];
const STAGE_IDS_IN_ORDER = ['backend-proof', 'terrain-kernel', 'environment-composition', 'character-locomotion', 'mechanic-final-polish'];
const STAGE_EVIDENCE_KEYS = ['id', 'status', 'automatedChecks', 'artifacts', 'environment', 'errors', 'warnings', 'reviewed', 'weaknesses', 'corrections', 'deviations'];
const STAGE_ENVIRONMENT_KEYS = ['browserChannel', 'browserExecutable', 'headed', 'externalServer'];
const STAGE_EVIDENCE_REQUIREMENTS = [
  { id: 'backend-proof', requiresReview: false, requiredArtifacts: [], minWeaknesses: 0, minCorrections: 0 },
  { id: 'terrain-kernel', requiresReview: false, requiredArtifacts: [], minWeaknesses: 0, minCorrections: 0 },
  { id: 'environment-composition', requiresReview: true, requiredArtifacts: ['environment_only.png', 'idle.png'], minWeaknesses: 1, minCorrections: 1 },
  { id: 'character-locomotion', requiresReview: true, requiredArtifacts: ['idle.png', 'locomotion.png'], minWeaknesses: 1, minCorrections: 1 },
  { id: 'mechanic-final-polish', requiresReview: true, requiredArtifacts: ['idle.png', 'locomotion.png', 'mechanic.png'], minWeaknesses: 1, minCorrections: 1 },
];

const ARCHITECTURE_KEYS = ['fileOwnership', 'terrainElevationOwnership', 'deviationPolicy'];
const FILE_OWNERSHIP_ENTRY_KEYS = ['path', 'responsibility'];
const APPROVED_PATTERN_KEYS = ['id', 'requirement', 'detection'];
const FORBIDDEN_PATTERN_KEYS = ['id', 'blocking', 'reason', 'detection'];
const IMPLEMENTATION_STAGE_KEYS = ['id', 'order', 'goal', 'allowedScope', 'requiredOutputs', 'approvedPatternIds', 'forbiddenPatternIds', 'automatedChecks', 'visualChecks', 'stopConditions', 'requiredEvidence', 'doNotProceedUntilPassed'];
const IMPLEMENTATION_STAGE_IDS_IN_ORDER = ['backend-proof', 'terrain-kernel', 'environment-composition', 'character-locomotion', 'mechanic-final-polish'];
const DIAGNOSTICS_KEYS = ['hook', 'lifecycle', 'rendererInfo', 'terrainDiagnostics', 'cameraDiagnostics', 'backendProof'];
const REVIEW_CRITERIA_KEYS = ['universal', 'biomeSpecific'];
const REVIEW_CRITERIA_CATEGORY_KEYS = ['category', 'questions'];
const UNIVERSAL_REVIEW_CATEGORIES = ['biome-identity', 'composition', 'terrain-quality', 'lod-continuity', 'material-quality', 'character-silhouette', 'character-scale', 'locomotion-readability', 'mechanic-readability', 'placeholder-detection', 'visual-hierarchy', 'scope-discipline'];

// 100% frozen (see global-constraints.md "sourceOfTruth"), small enough to compare exactly.
const SOURCE_OF_TRUTH = {
  builderRole: 'implementer',
  builderMayRedesignArchitecture: false,
  builderMayAddFallbacks: false,
  builderMaySkipStages: false,
  builderMayIgnoreFailedChecks: false,
  conflictPolicy: 'stop-and-report',
  requiredInputs: ['<PROJECT>_TECHDEMO_PROMPT.md', 'ENVIZZLE_BUILD.json', 'ENVIZZLE_EVIDENCE.json', 'HANDOFF.md', 'verify/'],
};

// Verbatim canonical shape (see global-constraints.md "Terrain elevation ownership"), engine-agnostic.
const TERRAIN_ELEVATION_OWNERSHIP = {
  renderOwner: 'gpu',
  renderMeshBaseHeight: 0,
  cpuHeightPurpose: ['physics', 'camera-clearance', 'foot-planting'],
  forbidCpuPredisplacedRenderVertices: true,
  requireCpuGpuParityTest: true,
  parityToleranceM: 0.03,
};

const DIAGNOSTICS_LIFECYCLE = {
  statuses: ['initializing', 'ready', 'failed'],
  readyRequiresStatus: 'ready',
  failureRequiresNonblankError: true,
};

const TERRAIN_DIAGNOSTICS_CONTRACT = {
  keys: ['renderOwner', 'renderMeshBaseHeight', 'parityMethod', 'paritySamples', 'parityMaxErrorM'],
  renderOwner: 'gpu',
  renderMeshBaseHeight: 0,
  parityMethod: 'gpu-readback',
  parityToleranceM: 0.03,
};

const CAMERA_DIAGNOSTICS_CONTRACT = {
  keys: ['method', 'nearestDepthM', 'terrainClearanceM'],
  allowedMethods: ['gpu-depth', 'cpu-height-with-gpu-parity'],
  forbiddenMethods: ['cpu-height-only'],
  minNearestDepthM: 0.30,
};

const RENDERER_INFO_BY_PROFILE = {
  'babylon-webgpu': { keys: ['backend', 'shaderLanguage', 'materialsReady', 'renderedFrames', 'validationErrors'], backend: 'webgpu', shaderLanguage: 'wgsl', materialsReadyRequired: true, minRenderedFrames: 1, maxValidationErrors: 0 },
  'three-webgl2': { keys: ['backend', 'shaderLanguage', 'materialsReady', 'renderedFrames', 'validationErrors'], backend: 'webgl2', shaderLanguage: 'glsl-es-300', materialsReadyRequired: true, minRenderedFrames: 1, maxValidationErrors: 0 },
};

const BACKEND_PROOF_KEYS = [
  'engineInitialized', 'activeBackend', 'activeShaderLanguage', 'materialCompilationAttempted', 'materialCompiledAgainstMesh',
  'materialReady', 'requiredAttributes', 'presentVertexBuffers', 'declaredUniforms', 'declaredResources', 'manualBindings',
  'scopedValidationErrors', 'uncapturedValidationErrors', 'deviceLosses', 'frameSubmitted', 'frameCompleted',
];

const BACKEND_PROOF_BY_PROFILE = {
  'babylon-webgpu': { keys: BACKEND_PROOF_KEYS, activeBackend: 'webgpu', activeShaderLanguage: 'wgsl', requiredAttributes: ['position', 'normal'] },
  'three-webgl2': { keys: BACKEND_PROOF_KEYS, activeBackend: 'webgl2', activeShaderLanguage: 'glsl-es-300', requiredAttributes: ['position', 'normal'] },
};

// Mirrors selection.mjs's RENDERING_PROFILES engine/shaderLang/shaderLangExt/materialApi tuple
// (exactly 2 fixed entries) — same Tier-2 "small/stable/2-entry-table" criterion already applied
// to RENDERER_INFO_BY_PROFILE above, applied consistently to the project.* rendering tuple too.
const PROJECT_FIELDS_BY_PROFILE = {
  'babylon-webgpu': { engine: 'Babylon.js 7.x pinned (private device-access risk, see the Babylon WebGPU patterns reference doc), WebGPU only', shaderLanguage: 'WGSL', shaderLanguageExtension: 'wgsl', materialApi: 'Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL' },
  'three-webgl2': { engine: 'Three.js latest stable, WebGLRenderer (WebGL2 only)', shaderLanguage: 'GLSL ES 3.00 raw modules', shaderLanguageExtension: 'glsl', materialApi: 'Three.js RawShaderMaterial on WebGLRenderer' },
};

// Minimum forbidden-pattern IDs common to every rendering profile (see global-constraints.md).
const UNIVERSAL_FORBIDDEN_PATTERN_IDS = ['webgl-fallback', 'duplicate-terrain-displacement', 'cpu-predisplaced-render-mesh', 'premature-readiness', 'suppressed-initialization-failure', 'placeholder-character', 'indistinguishable-poses', 'render-loop-allocation', 'incomplete-evidence', 'continue-after-failed-stage'];

// ---------------------------------------------------------------------------
// Primitives (mirrors build-contract.mjs's private helpers)
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isSafeRelativePath(value) {
  if (!nonEmptyString(value)) return false;
  const normalized = value.replace(/\\/g, '/');
  return !normalized.startsWith('/') && !/^[A-Za-z]:\//.test(normalized) && !normalized.split('/').includes('..');
}

function hasAbsolutePath(value) {
  return typeof value === 'string' && (
    value.startsWith('/') ||
    value.startsWith('\\') ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    /(?:^|\s)\/(?:Users|home|var|usr|etc|opt|tmp|root|bin|sbin|dev)\//i.test(value)
  );
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

function scanForNonFiniteOrAbsolute(value, pathLabel, errors) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    errors.push(`${pathLabel} must be finite`);
    return;
  }
  if (hasAbsolutePath(value)) {
    errors.push(`${pathLabel} must not contain an absolute path`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForNonFiniteOrAbsolute(entry, `${pathLabel}[${index}]`, errors));
  } else if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => scanForNonFiniteOrAbsolute(entry, `${pathLabel}.${key}`, errors));
  }
}

// Exact structural+value comparison against a small vendored canonical constant
// (used only for the handful of shapes documented as verbatim/100% frozen).
function compareCanonical(value, canonical, pathLabel, errors) {
  if (Array.isArray(canonical)) {
    if (!Array.isArray(value)) {
      errors.push(`${pathLabel} must be an array`);
      return;
    }
    if (value.length !== canonical.length) {
      errors.push(`${pathLabel} must contain exactly ${canonical.length} entries`);
      return;
    }
    canonical.forEach((entry, index) => compareCanonical(value[index], entry, `${pathLabel}[${index}]`, errors));
    return;
  }
  if (isPlainObject(canonical)) {
    if (!exactKeys(value, Object.keys(canonical), pathLabel, errors)) return;
    Object.keys(canonical).forEach((key) => compareCanonical(value[key], canonical[key], `${pathLabel}.${key}`, errors));
    return;
  }
  if (value !== canonical) errors.push(`${pathLabel} must equal ${JSON.stringify(canonical)}`);
}

// ---------------------------------------------------------------------------
// Build contract (ENVIZZLE_BUILD.json) — structural/shape validation
// ---------------------------------------------------------------------------

function validateProjectShape(project, errors) {
  if (!exactKeys(project, PROJECT_KEYS, 'project', errors)) return;
  if (!nonEmptyString(project.name) || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(project.name)) errors.push('project.name must be a safe upper-case hyphenated name');
  if (!isSafeRelativePath(project.briefFilename) || (nonEmptyString(project.name) && project.briefFilename !== `${project.name.replace(/-/g, '_')}_TECHDEMO_PROMPT.md`)) {
    errors.push('project.briefFilename must be the deterministic project brief filename');
  }
  if (typeof project.briefSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(project.briefSha256)) errors.push('project.briefSha256 must be exactly 64 lowercase hexadecimal characters');
  const profileFields = PROJECT_FIELDS_BY_PROFILE[project.renderingProfile];
  if (!profileFields) {
    errors.push(`project.renderingProfile must be one of: ${RENDERING_PROFILE_IDS.join(', ')}`);
  } else if (project.engine !== profileFields.engine || project.shaderLanguage !== profileFields.shaderLanguage || project.shaderLanguageExtension !== profileFields.shaderLanguageExtension || project.materialApi !== profileFields.materialApi) {
    errors.push('project rendering profile tuple does not match the canonical rendering profile');
  }
  if (!RENDERING_PARADIGMS.includes(project.renderingParadigm)) errors.push(`project.renderingParadigm must be one of: ${RENDERING_PARADIGMS.join(', ')}`);
  if (project.assetStrategy !== 'zero-asset') errors.push('project.assetStrategy must be zero-asset');
  if (!nonEmptyString(project.assetStrategyText)) errors.push('project.assetStrategyText must be non-empty');
  if (!nonEmptyString(project.targetHardware)) errors.push('project.targetHardware must be non-empty');
  if (!nonEmptyString(project.coreInteractionSentence)) errors.push('project.coreInteractionSentence must be non-empty');
}

function validateTerrainElevationShape(terrainElevation, errors) {
  const label = 'terrainElevation';
  if (!exactKeys(terrainElevation, Object.keys(TERRAIN_ELEVATION_OWNERSHIP), label, errors)) return;
  compareCanonical(terrainElevation, TERRAIN_ELEVATION_OWNERSHIP, label, errors);
}

function validateSelectionShape(selection, errors) {
  if (!exactKeys(selection, SELECTION_KEYS, 'selection', errors)) return;
  if (!CREATIVE_MODES.includes(selection.creativeMode)) errors.push('selection.creativeMode is invalid');
  if (!SELECTION_PATHS.includes(selection.path)) errors.push('selection.path is invalid');
  if (selection.baseShowcase !== null && !nonEmptyString(selection.baseShowcase)) errors.push('selection.baseShowcase must be null or a non-empty string');
  if (!AMBITIONS.includes(selection.ambition)) errors.push('selection.ambition is invalid');
  if (!ARCHETYPES.includes(selection.archetype)) errors.push('selection.archetype is invalid');
  if (!nonEmptyString(selection.biome)) errors.push('selection.biome must be a non-empty string');
  if (!nonEmptyString(selection.mechanic)) errors.push('selection.mechanic must be a non-empty string');
  if (!nonEmptyString(selection.camera)) errors.push('selection.camera must be a non-empty string');
  if (!RENDERING_PROFILE_IDS.includes(selection.renderingProfile)) errors.push('selection.renderingProfile is invalid');
  for (const key of ['includedSections', 'omittedOptionalSections', 'extraSections', 'cameraAdjustments', 'changedAxes']) {
    if (!isStringArray(selection[key])) errors.push(`selection.${key} must be an array of strings`);
  }
}

function validateStateChannelsShape(stateChannels, selection, errors) {
  if (!exactKeys(stateChannels, STATE_CHANNEL_KEYS, 'stateChannels', errors)) return;
  if (typeof stateChannels.enabled !== 'boolean') errors.push('stateChannels.enabled must be boolean');
  if (!nonEmptyString(stateChannels.omittedBehavior)) errors.push('stateChannels.omittedBehavior must be non-empty');
  if (!isPlainObject(stateChannels.channels)) {
    errors.push('stateChannels.channels must be a plain object');
    return;
  }
  const seenChannels = new Set();
  for (const [key, entry] of Object.entries(stateChannels.channels)) {
    const label = `stateChannels.channels.${key}`;
    if (!exactKeys(entry, STATE_ENTRY_KEYS, label, errors)) continue;
    if (!/^[RGBA]$/.test(entry.channel)) errors.push(`${label}.channel must be one of R, G, B, A`);
    if (seenChannels.has(entry.channel)) errors.push(`stateChannels.channels contains duplicate channel ${entry.channel}`);
    seenChannels.add(entry.channel);
    if (typeof entry.nativeMeaning !== 'string') errors.push(`${label}.nativeMeaning must be a string`);
    if (entry.owningSystem !== 'state-buffer') errors.push(`${label}.owningSystem must be state-buffer`);
    if (!Array.isArray(entry.writers) || entry.writers.length === 0 || !isStringArray(entry.writers)) errors.push(`${label}.writers must be a non-empty string array`);
    if (!Array.isArray(entry.readers) || entry.readers.length === 0 || !isStringArray(entry.readers)) errors.push(`${label}.readers must be a non-empty string array`);
    if (!nonEmptyString(entry.visibleEffect)) errors.push(`${label}.visibleEffect must be non-empty`);
    if (exactKeys(entry.baselineOrReset, BASELINE_KEYS, `${label}.baselineOrReset`, errors)) {
      if (entry.baselineOrReset.baseline !== 'zero') errors.push(`${label}.baselineOrReset.baseline must be zero`);
      if (!nonEmptyString(entry.baselineOrReset.recoveryMechanism) || !nonEmptyString(entry.baselineOrReset.recoveryOutcome)) errors.push(`${label}.baselineOrReset recovery fields must be non-empty`);
    }
  }
  if (isPlainObject(selection) && stateChannels.enabled === false && Object.keys(stateChannels.channels).length !== 0) {
    errors.push('stateChannels.channels must be empty when stateChannels.enabled is false');
  }
}

function validateCreativeShape(creative, selection, errors) {
  if (!exactKeys(creative, CREATIVE_KEYS, 'creative', errors)) return;
  if (!nonEmptyString(creative.creativeSpark)) errors.push('creative.creativeSpark must be non-empty');
  if (exactKeys(creative.signatureMoment, SIGNATURE_KEYS, 'creative.signatureMoment', errors)) {
    const sig = creative.signatureMoment;
    if (typeof sig.enabled !== 'boolean') errors.push('creative.signatureMoment.enabled must be boolean');
    if (typeof sig.text !== 'string' || typeof sig.reusedSystem !== 'string') errors.push('creative.signatureMoment.text/reusedSystem must be strings');
    if (!REQUIRED_CAPTURE_POSES.includes(sig.verificationPose)) errors.push('creative.signatureMoment.verificationPose is invalid');
    if (!nonEmptyString(sig.instruction)) errors.push('creative.signatureMoment.instruction must be non-empty');
    const creativeMode = selection?.creativeMode;
    if (creativeMode === 'proven' && (sig.enabled !== false || sig.text !== '' || sig.reusedSystem !== '')) {
      errors.push('Proven mode must encode no independent Signature Moment');
    }
    if ((creativeMode === 'signature' || creativeMode === 'experimental') && (sig.enabled !== true || !nonEmptyString(sig.text) || !nonEmptyString(sig.reusedSystem))) {
      errors.push('Signature and Experimental modes require exactly one bounded Signature Moment');
    }
  }
  if (exactKeys(creative.noveltyBudget, NOVELTY_BUDGET_KEYS, 'creative.noveltyBudget', errors)) {
    for (const key of NOVELTY_BUDGET_KEYS) if (creative.noveltyBudget[key] !== false) errors.push(`creative.noveltyBudget.${key} must be false`);
  }
  if (!Array.isArray(creative.coherenceOverrides)) {
    errors.push('creative.coherenceOverrides must be an array');
  } else {
    creative.coherenceOverrides.forEach((override, index) => {
      const label = `creative.coherenceOverrides[${index}]`;
      if (!exactKeys(override, ['rule', 'reason'], label, errors)) return;
      if (!nonEmptyString(override.rule) || !nonEmptyString(override.reason)) errors.push(`${label} must contain non-empty rule and reason`);
    });
  }
}

function validateAcceptanceShape(acceptance, errors) {
  const label = 'acceptance';
  if (!exactKeys(acceptance, ACCEPTANCE_KEYS, label, errors)) return;
  if (!isStringArray(acceptance.requiredProjectPaths) || acceptance.requiredProjectPaths.length === 0) errors.push(`${label}.requiredProjectPaths must be a non-empty string array`);
  for (const key of ['productionBuild', 'verificationHook', 'renderer', 'terrain', 'runtime', 'captures', 'imageGates', 'camera', 'evidence', 'environmentVisuals', 'poseDifferences', 'report']) {
    if (!isPlainObject(acceptance[key])) errors.push(`${label}.${key} must be a plain object`);
  }
  if (isPlainObject(acceptance.verificationHook) && !isStringArray(acceptance.verificationHook.requiredHooks)) errors.push(`${label}.verificationHook.requiredHooks must be a string array`);
  if (isPlainObject(acceptance.captures) && !isStringArray(acceptance.captures.poses)) errors.push(`${label}.captures.poses must be a string array`);
  if (isPlainObject(acceptance.report) && !nonEmptyString(acceptance.report.filename)) errors.push(`${label}.report.filename must be non-empty`);
}

function validateStagesShape(stages, errors) {
  const label = 'stages';
  if (!Array.isArray(stages) || stages.length !== STAGE_EVIDENCE_REQUIREMENTS.length) {
    errors.push(`${label} must contain exactly ${STAGE_EVIDENCE_REQUIREMENTS.length} entries`);
    return;
  }
  const actualIds = stages.map((s) => (isPlainObject(s) ? s.id : undefined));
  if (JSON.stringify(actualIds) !== JSON.stringify(STAGE_IDS_IN_ORDER)) errors.push(`${label} must contain exactly these IDs in order: ${STAGE_IDS_IN_ORDER.join(', ')}`);
  stages.forEach((stage, index) => {
    const entryLabel = `${label}[${index}]`;
    const req = STAGE_EVIDENCE_REQUIREMENTS[index];
    if (isPlainObject(stage) && stage.id !== req.id) errors.push(`${entryLabel}.id must be '${req.id}'`);
  });
}

function validateArchitectureShape(architecture, errors) {
  const label = 'architecture';
  if (!exactKeys(architecture, ARCHITECTURE_KEYS, label, errors)) return;
  if (!Array.isArray(architecture.fileOwnership) || architecture.fileOwnership.length === 0) {
    errors.push(`${label}.fileOwnership must be a non-empty array`);
  } else {
    architecture.fileOwnership.forEach((entry, index) => {
      const entryLabel = `${label}.fileOwnership[${index}]`;
      if (!exactKeys(entry, FILE_OWNERSHIP_ENTRY_KEYS, entryLabel, errors)) return;
      if (!nonEmptyString(entry.path) || !nonEmptyString(entry.responsibility)) errors.push(`${entryLabel} must have non-empty path and responsibility`);
    });
  }
  compareCanonical(architecture.terrainElevationOwnership, TERRAIN_ELEVATION_OWNERSHIP, `${label}.terrainElevationOwnership`, errors);
  if (!nonEmptyString(architecture.deviationPolicy)) errors.push(`${label}.deviationPolicy must be non-empty`);
}

function validatePatternListShape(patterns, entryKeys, label, errors) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return;
  }
  const seenIds = new Set();
  patterns.forEach((entry, index) => {
    const entryLabel = `${label}[${index}]`;
    if (!exactKeys(entry, entryKeys, entryLabel, errors)) return;
    if (!nonEmptyString(entry.id)) errors.push(`${entryLabel}.id must be non-empty`);
    if (seenIds.has(entry.id)) errors.push(`${label} contains duplicate id ${entry.id}`);
    seenIds.add(entry.id);
    if (!nonEmptyString(entry.detection)) errors.push(`${entryLabel}.detection must be non-empty`);
    if (entryKeys.includes('blocking') && typeof entry.blocking !== 'boolean') {
      errors.push(`${entryLabel}.blocking must be boolean`);
    }
    if (entryKeys.includes('requirement') && !nonEmptyString(entry.requirement)) errors.push(`${entryLabel}.requirement must be non-empty`);
    if (entryKeys.includes('reason') && !nonEmptyString(entry.reason)) errors.push(`${entryLabel}.reason must be non-empty`);
  });
}

function validateForbiddenPatternsShape(forbiddenPatterns, errors) {
  validatePatternListShape(forbiddenPatterns, FORBIDDEN_PATTERN_KEYS, 'forbiddenPatterns', errors);
  if (Array.isArray(forbiddenPatterns)) {
    const ids = forbiddenPatterns.map((p) => (isPlainObject(p) ? p.id : undefined));
    const missingUniversal = UNIVERSAL_FORBIDDEN_PATTERN_IDS.filter((id) => !ids.includes(id));
    if (missingUniversal.length > 0) errors.push(`forbiddenPatterns is missing universal required ids: ${missingUniversal.join(', ')}`);
  }
}

function validateImplementationPlanShape(implementationPlan, errors) {
  const label = 'implementationPlan';
  if (!Array.isArray(implementationPlan) || implementationPlan.length !== IMPLEMENTATION_STAGE_IDS_IN_ORDER.length) {
    errors.push(`${label} must contain exactly ${IMPLEMENTATION_STAGE_IDS_IN_ORDER.length} stages`);
    return;
  }
  const actualIds = implementationPlan.map((s) => (isPlainObject(s) ? s.id : undefined));
  if (JSON.stringify(actualIds) !== JSON.stringify(IMPLEMENTATION_STAGE_IDS_IN_ORDER)) errors.push(`${label} must contain exactly these stage IDs in order: ${IMPLEMENTATION_STAGE_IDS_IN_ORDER.join(', ')}`);
  implementationPlan.forEach((stage, index) => {
    const entryLabel = `${label}[${index}]`;
    if (!exactKeys(stage, IMPLEMENTATION_STAGE_KEYS, entryLabel, errors)) return;
    if (stage.order !== index + 1) errors.push(`${entryLabel}.order must equal ${index + 1}`);
    if (!nonEmptyString(stage.goal)) errors.push(`${entryLabel}.goal must be non-empty`);
    for (const key of ['allowedScope', 'requiredOutputs', 'approvedPatternIds', 'forbiddenPatternIds', 'automatedChecks', 'visualChecks', 'stopConditions', 'requiredEvidence']) {
      if (!isStringArray(stage[key])) errors.push(`${entryLabel}.${key} must be a string array`);
    }
    if (stage.doNotProceedUntilPassed !== true) errors.push(`${entryLabel}.doNotProceedUntilPassed must be true`);
  });
}

function validateDiagnosticsShape(diagnostics, renderingProfile, errors) {
  const label = 'diagnostics';
  if (!exactKeys(diagnostics, DIAGNOSTICS_KEYS, label, errors)) return;
  if (diagnostics.hook !== 'window.__demo') errors.push(`${label}.hook must be window.__demo`);
  compareCanonical(diagnostics.lifecycle, DIAGNOSTICS_LIFECYCLE, `${label}.lifecycle`, errors);
  compareCanonical(diagnostics.terrainDiagnostics, TERRAIN_DIAGNOSTICS_CONTRACT, `${label}.terrainDiagnostics`, errors);
  compareCanonical(diagnostics.cameraDiagnostics, CAMERA_DIAGNOSTICS_CONTRACT, `${label}.cameraDiagnostics`, errors);
  const rendererCanonical = RENDERER_INFO_BY_PROFILE[renderingProfile];
  if (rendererCanonical) {
    compareCanonical(diagnostics.rendererInfo, rendererCanonical, `${label}.rendererInfo`, errors);
  } else if (isPlainObject(diagnostics.rendererInfo)) {
    errors.push(`${label}.rendererInfo cannot be validated without a valid renderingProfile`);
  }
  const backendProofCanonical = BACKEND_PROOF_BY_PROFILE[renderingProfile];
  if (backendProofCanonical) {
    compareCanonical(diagnostics.backendProof, backendProofCanonical, `${label}.backendProof`, errors);
  } else if (isPlainObject(diagnostics.backendProof)) {
    errors.push(`${label}.backendProof cannot be validated without a valid renderingProfile`);
  }
}

function validateReviewCriteriaShape(reviewCriteria, errors) {
  const label = 'reviewCriteria';
  if (!exactKeys(reviewCriteria, REVIEW_CRITERIA_KEYS, label, errors)) return;
  const universal = reviewCriteria.universal;
  if (!Array.isArray(universal) || universal.length !== UNIVERSAL_REVIEW_CATEGORIES.length) {
    errors.push(`${label}.universal must contain exactly ${UNIVERSAL_REVIEW_CATEGORIES.length} categories`);
  } else {
    const categories = universal.map((entry) => (isPlainObject(entry) ? entry.category : undefined));
    if (JSON.stringify(categories) !== JSON.stringify(UNIVERSAL_REVIEW_CATEGORIES)) errors.push(`${label}.universal categories must equal the canonical 12-category list in order`);
    universal.forEach((entry, index) => {
      const entryLabel = `${label}.universal[${index}]`;
      if (!exactKeys(entry, REVIEW_CRITERIA_CATEGORY_KEYS, entryLabel, errors)) return;
      if (!Array.isArray(entry.questions) || entry.questions.length === 0 || !isStringArray(entry.questions)) errors.push(`${entryLabel}.questions must be a non-empty string array`);
    });
  }
  const biomeSpecific = reviewCriteria.biomeSpecific;
  if (!Array.isArray(biomeSpecific)) {
    errors.push(`${label}.biomeSpecific must be an array`);
  } else {
    biomeSpecific.forEach((entry, index) => {
      const entryLabel = `${label}.biomeSpecific[${index}]`;
      if (!exactKeys(entry, REVIEW_CRITERIA_CATEGORY_KEYS, entryLabel, errors)) return;
      if (!nonEmptyString(entry.category)) errors.push(`${entryLabel}.category must be non-empty`);
      if (!Array.isArray(entry.questions) || entry.questions.length === 0 || !isStringArray(entry.questions)) errors.push(`${entryLabel}.questions must be a non-empty string array`);
    });
  }
}

/**
 * Standalone structural validation of an ENVIZZLE_BUILD.json contract. Validates shape, key
 * sets, enums, and non-finite/absolute-path rejection — it does NOT compare against the repo's
 * exact frozen per-showcase constants (those aren't available outside build-contract.mjs).
 */
export function validateBuildContractStandalone(contract) {
  const errors = [];
  if (!isPlainObject(contract)) return { valid: false, errors: ['Build contract must be a plain object'] };
  if (!exactKeys(contract, CONTRACT_TOP_KEYS, 'build contract', errors)) return { valid: false, errors };
  if (contract.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  validateProjectShape(contract.project, errors);
  validateSelectionShape(contract.selection, errors);
  if (isPlainObject(contract.project) && isPlainObject(contract.selection) && contract.project.renderingProfile !== contract.selection.renderingProfile) {
    errors.push('project.renderingProfile must equal selection.renderingProfile');
  }
  validateStateChannelsShape(contract.stateChannels, contract.selection, errors);
  validateTerrainElevationShape(contract.terrainElevation, errors);
  validateCreativeShape(contract.creative, contract.selection, errors);
  validateAcceptanceShape(contract.acceptance, errors);
  validateStagesShape(contract.stages, errors);
  compareCanonical(contract.sourceOfTruth, SOURCE_OF_TRUTH, 'sourceOfTruth', errors);
  validateArchitectureShape(contract.architecture, errors);
  validatePatternListShape(contract.approvedPatterns, APPROVED_PATTERN_KEYS, 'approvedPatterns', errors);
  validateForbiddenPatternsShape(contract.forbiddenPatterns, errors);
  validateImplementationPlanShape(contract.implementationPlan, errors);
  const renderingProfile = isPlainObject(contract.project) ? contract.project.renderingProfile : undefined;
  validateDiagnosticsShape(contract.diagnostics, renderingProfile, errors);
  validateReviewCriteriaShape(contract.reviewCriteria, errors);
  scanForNonFiniteOrAbsolute(contract, 'contract', errors);
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Evidence record (ENVIZZLE_EVIDENCE.json)
// ---------------------------------------------------------------------------

function validateStageEnvironmentShape(environment, label, errors) {
  if (environment === null) return;
  if (!exactKeys(environment, STAGE_ENVIRONMENT_KEYS, label, errors)) return;
  if (environment.browserChannel !== null && typeof environment.browserChannel !== 'string') errors.push(`${label}.browserChannel must be null or a string`);
  if (environment.browserExecutable !== null && typeof environment.browserExecutable !== 'string') errors.push(`${label}.browserExecutable must be null or a string`);
  if (typeof environment.headed !== 'boolean') errors.push(`${label}.headed must be boolean`);
  if (environment.externalServer !== null && typeof environment.externalServer !== 'string') errors.push(`${label}.externalServer must be null or a string`);
}

function validateOneStageEvidenceShape(stage, index, requirements, priorStagesAllPassed, errors) {
  const label = `stages[${index}]`;
  if (!exactKeys(stage, STAGE_EVIDENCE_KEYS, label, errors)) return;
  if (stage.id !== requirements.id) errors.push(`${label}.id must be '${requirements.id}'`);
  if (!STAGE_STATUSES.includes(stage.status)) errors.push(`${label}.status is invalid`);
  if (!Array.isArray(stage.automatedChecks) || stage.automatedChecks.some((v) => typeof v !== 'string')) errors.push(`${label}.automatedChecks must be an array of strings`);
  if (!Array.isArray(stage.artifacts) || stage.artifacts.some((v) => !isSafeRelativePath(v))) errors.push(`${label}.artifacts must contain safe relative filenames`);
  validateStageEnvironmentShape(stage.environment, `${label}.environment`, errors);
  if (!Array.isArray(stage.errors) || stage.errors.some((v) => typeof v !== 'string')) errors.push(`${label}.errors must be an array of strings`);
  if (!Array.isArray(stage.warnings) || stage.warnings.some((v) => typeof v !== 'string')) errors.push(`${label}.warnings must be an array of strings`);
  if (typeof stage.reviewed !== 'boolean') errors.push(`${label}.reviewed must be boolean`);
  for (const field of ['weaknesses', 'corrections', 'deviations']) {
    if (!Array.isArray(stage[field]) || stage[field].some((v) => typeof v !== 'string')) errors.push(`${label}.${field} must be an array of strings`);
  }

  if (stage.status === 'failed' || stage.status === 'incomplete verification') {
    if (!Array.isArray(stage.errors) || !stage.errors.some((e) => typeof e === 'string' && e.trim() !== '')) {
      errors.push(`${label} with status '${stage.status}' requires a nonblank explanation in errors`);
    }
  }

  if (stage.status === 'passed') {
    if (!priorStagesAllPassed) {
      errors.push(`${label} cannot pass because a prior stage has not passed`);
    }
    if (Array.isArray(stage.errors) && stage.errors.length > 0) {
      errors.push(`${label} cannot pass with a nonempty errors list`);
    }
    for (const filename of requirements.requiredArtifacts) {
      if (!Array.isArray(stage.artifacts) || !stage.artifacts.includes(filename)) {
        errors.push(`${label} requires artifact '${filename}' to pass`);
      }
    }
    if (requirements.requiresReview) {
      if (stage.reviewed !== true) errors.push(`${label} cannot pass without reviewed set to true`);
      if (!Array.isArray(stage.weaknesses) || stage.weaknesses.filter((w) => w.trim() !== '').length < requirements.minWeaknesses) {
        errors.push(`${label} requires at least ${requirements.minWeaknesses} nonblank weakness(es) to pass`);
      }
      if (!Array.isArray(stage.corrections) || stage.corrections.filter((c) => c.trim() !== '').length < requirements.minCorrections) {
        errors.push(`${label} requires at least ${requirements.minCorrections} correction(s) to pass`);
      }
    }
  }
}

/**
 * Standalone structural validation of an ENVIZZLE_EVIDENCE.json record: schemaVersion, status,
 * briefSha256, and the 5-stage shape (with stage-gating rules).
 */
export function validateEvidenceStandalone(evidence) {
  const errors = [];
  if (!isPlainObject(evidence)) return { valid: false, errors: ['Evidence record must be a plain object'] };
  if (!exactKeys(evidence, ['schemaVersion', 'briefSha256', 'status', 'stages'], 'evidence', errors)) return { valid: false, errors };
  if (evidence.schemaVersion !== SCHEMA_VERSION) errors.push(`evidence.schemaVersion must be ${SCHEMA_VERSION}`);
  if (!STAGE_STATUSES.includes(evidence.status)) errors.push(`evidence.status must be one of: ${STAGE_STATUSES.join(', ')}`);
  if (!(evidence.briefSha256 === null || (typeof evidence.briefSha256 === 'string' && /^[0-9a-f]{64}$/.test(evidence.briefSha256)))) {
    errors.push('evidence.briefSha256 must be null or exactly 64 lowercase hexadecimal characters');
  }
  if (!Array.isArray(evidence.stages)) {
    errors.push('evidence.stages must be an array');
    return { valid: errors.length === 0, errors };
  }
  const actualIds = evidence.stages.map((s) => (isPlainObject(s) ? s.id : undefined));
  if (JSON.stringify(actualIds) !== JSON.stringify(STAGE_IDS_IN_ORDER)) {
    errors.push(`evidence.stages must contain exactly these stage IDs in canonical order: ${STAGE_IDS_IN_ORDER.join(', ')}`);
  } else {
    let priorStagesAllPassed = true;
    evidence.stages.forEach((stage, index) => {
      validateOneStageEvidenceShape(stage, index, STAGE_EVIDENCE_REQUIREMENTS[index], priorStagesAllPassed, errors);
      priorStagesAllPassed = priorStagesAllPassed && isPlainObject(stage) && stage.status === 'passed';
    });
    const allPassed = evidence.stages.length === STAGE_IDS_IN_ORDER.length && evidence.stages.every((s) => isPlainObject(s) && s.status === 'passed');
    if (evidence.status === 'passed' && !allPassed) errors.push('evidence.status passed requires every stage to have passed');
    if (evidence.status !== 'passed' && allPassed) errors.push('evidence.status must be passed when every stage has passed');
  }
  scanForNonFiniteOrAbsolute(evidence, 'evidence', errors);
  return { valid: errors.length === 0, errors };
}

/**
 * Cross-checks evidence.briefSha256 against contract.project.briefSha256.
 */
export function validateEvidenceContractBinding(contract, evidence) {
  const errors = [];
  if (!isPlainObject(contract) || !isPlainObject(contract.project) || typeof contract.project.briefSha256 !== 'string') {
    errors.push('evidence-contract binding requires a valid contract.project.briefSha256');
    return { valid: false, errors };
  }
  if (!isPlainObject(evidence) || typeof evidence.briefSha256 !== 'string') {
    errors.push('evidence.briefSha256 must be a string to bind against the contract');
    return { valid: false, errors };
  }
  if (evidence.briefSha256 !== contract.project.briefSha256) {
    errors.push('evidence.briefSha256 does not match contract.project.briefSha256');
  }
  return { valid: errors.length === 0, errors };
}
