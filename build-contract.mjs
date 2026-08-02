import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARCHETYPES,
  BIOME_CHANNELS,
  CORE_SECTIONS,
  EXTRA_SECTIONS,
  MECHANIC_WRITES,
  RENDERING_PROFILES,
  SELECTION_PATHS,
  CREATIVE_MODES,
  AMBITIONS,
  SHOWCASES,
  validateSelection,
} from './selection.mjs';
import { THRESHOLDS } from './verify/gates.mjs';

export const BUILD_CONTRACT_SCHEMA_VERSION = 1;
export const BUILD_CONTRACT_FILENAME = 'ENVIZZLE_BUILD.json';
export const EVIDENCE_FILENAME = 'ENVIZZLE_EVIDENCE.json';
export const HANDOFF_FILENAME = 'HANDOFF.md';
export const ZERO_ASSET_STRATEGY_TEXT = '100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)';
export const INCOMPLETE_VERIFICATION_STATUS = 'incomplete verification';
export const COMPLETE_STATUS = 'complete';

export const TERRAIN_ELEVATION_CONTRACT = Object.freeze({
  renderOwner: 'gpu',
  renderMeshBaseHeight: 0,
  cpuHeightPurpose: Object.freeze(['physics', 'camera-clearance', 'foot-planting']),
  forbidCpuPredisplacedRenderVertices: true,
  requireCpuGpuParityTest: true,
  parityToleranceM: 0.03,
});

export const RENDERER_DIAGNOSTICS_EXPECTED = Object.freeze({
  'babylon-webgpu': Object.freeze({ backend: 'webgpu', shaderLanguage: 'wgsl', materialsReady: true, renderedFrames: 1, validationErrors: Object.freeze([]) }),
  'three-webgl2': Object.freeze({ backend: 'webgl2', shaderLanguage: 'glsl-es-3.00', materialsReady: true, renderedFrames: 1, validationErrors: Object.freeze([]) }),
});

export const LIFECYCLE_STATUS_VALUES = Object.freeze(['initializing', 'ready', 'failed']);
export const CAMERA_DIAGNOSTIC_METHODS = Object.freeze(['gpu-depth', 'cpu-height-with-gpu-parity']);

export const NOVELTY_BUDGET_KEYS = Object.freeze([
  'addsEngine',
  'addsAssetCategory',
  'addsPersistentBuffer',
  'addsMajorRenderPass',
  'addsSimulationSubsystem',
  'addsInput',
  'increasesAmbition',
]);

export const REQUIRED_CAPTURE_POSES = Object.freeze(['idle', 'locomotion', 'mechanic']);
export const REQUIRED_CAPTURE_FILENAMES = Object.freeze([
  'milestone_idle.png',
  'milestone_locomotion.png',
  'milestone_mechanic.png',
]);

const POSE_FILENAME_MAP = Object.freeze({
  idle: 'milestone_idle.png',
  locomotion: 'milestone_locomotion.png',
  mechanic: 'milestone_mechanic.png',
});

const REQUIRED_PROJECT_PATHS = Object.freeze([
  'index.html',
  'package.json',
  'vite.config.js',
  'DECISIONS.md',
  'PERF.md',
  'src/main.js',
]);

const ACCEPTANCE_GATES = Object.freeze({
  requiredProjectPaths: REQUIRED_PROJECT_PATHS,
  productionBuild: Object.freeze({
    required: true,
    requirement: 'The production build completes successfully before visual verification.',
  }),
  verificationHook: Object.freeze({
    required: true,
    readiness: 'window.__demo starts initializing with ready false and becomes ready only after renderer, materials, validation, and one rendered frame succeed.',
    requiredHooks: Object.freeze(['setPose', 'setCharacterVisible', 'rendererInfo', 'terrainDiagnostics', 'cameraDiagnostics', 'frameStats']),
    lifecycle: Object.freeze({
      initial: Object.freeze({ ready: false, status: 'initializing', error: null }),
      statuses: LIFECYCLE_STATUS_VALUES,
      success: Object.freeze({ ready: true, status: 'ready', error: null }),
      failure: Object.freeze({ ready: false, status: 'failed' }),
    }),
  }),
  renderer: Object.freeze({
    required: true,
    hook: 'window.__demo.rendererInfo()',
    expectedByProfile: RENDERER_DIAGNOSTICS_EXPECTED,
    requirement: 'The selected profile backend, shader language, material readiness, rendered frame count, and validation error list must be proven by the actual renderer.',
  }),
  terrain: Object.freeze({
    required: true,
    hook: 'window.__demo.terrainDiagnostics()',
    expected: TERRAIN_ELEVATION_CONTRACT,
    parity: Object.freeze({ method: 'gpu-readback', minimumSamples: 8, cpuToCpuForbidden: true }),
  }),
  runtime: Object.freeze({
    blockingBrowserOrConsoleErrors: 0,
    requirement: 'No blocking browser or console errors are present during verification.',
  }),
  captures: Object.freeze({
    required: true,
    poses: REQUIRED_CAPTURE_POSES,
    filenames: REQUIRED_CAPTURE_FILENAMES,
    screenshotEvidence: true,
  }),
  imageGates: Object.freeze({
    required: true,
    verifier: 'verify/gates.mjs',
    requirement: 'All configured image gates pass; no new artistic thresholds are introduced here.',
  }),
  camera: Object.freeze({
    required: true,
    hook: 'window.__demo.cameraDiagnostics()',
    allowedMethods: CAMERA_DIAGNOSTIC_METHODS,
    clippingThresholdM: THRESHOLDS.cameraMinDepthM,
    requirement: 'Camera distance is proven by GPU depth or by CPU height qualified by a successful GPU terrain parity test.',
  }),
  evidence: Object.freeze({
    required: true,
    buildContractFilename: BUILD_CONTRACT_FILENAME,
    evidenceFilename: EVIDENCE_FILENAME,
    requiredStatus: COMPLETE_STATUS,
    requiredMilestones: Object.freeze(['first-runnable-scene', 'systems-complete', 'final-polish']),
    requirement: 'Final verification requires complete milestone evidence, canonical current-run screenshots, console evidence, performance values, reviewed weaknesses, and corrections.',
  }),
  environmentVisuals: Object.freeze({
    required: true,
    metrics: Object.freeze(['localLuminanceVariation', 'edgeDensity']),
    thresholds: Object.freeze({ localLuminanceVariationMin: THRESHOLDS.environmentLocalLuminanceVariationMin, edgeDensityMin: THRESHOLDS.environmentEdgeDensityMin }),
  }),
  poseDifferences: Object.freeze({
    required: true,
    comparisons: Object.freeze(['idle-locomotion', 'idle-mechanic']),
    minimumChangedAreaFractions: Object.freeze({ idleLocomotion: THRESHOLDS.poseIdleLocomotionMinChangedArea, idleMechanic: THRESHOLDS.poseIdleMechanicMinChangedArea }),
  }),
  report: Object.freeze({
    required: true,
    filename: 'verify-report.json',
  }),
});

const MILESTONE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'first-runnable-scene',
    title: 'First runnable scene',
    requiredChecks: Object.freeze([
      'production build succeeds',
      'development server starts and the scene renders',
      'camera operates',
      'character or focal subject is visible',
      'no blocking browser or console errors exist',
    ]),
    requiredScreenshotEvidence: Object.freeze({
      required: true,
      minimumScreenshots: 1,
      requiredPoses: Object.freeze(['idle']),
    }),
    requiredConsoleEvidence: Object.freeze({
      required: true,
      blockingErrors: 0,
    }),
    requiredPerformanceEvidence: Object.freeze({
      required: true,
      fields: Object.freeze(['fps', 'frameTimeMs']),
    }),
    requiredVisualSelfReview: Object.freeze({
      required: true,
      inspectScreenshot: true,
      fields: Object.freeze(['reviewed', 'weaknesses', 'corrections']),
    }),
    completion: Object.freeze({
      completeStatus: COMPLETE_STATUS,
      incompleteStatus: INCOMPLETE_VERIFICATION_STATUS,
      completeRequires: Object.freeze(['all required checks pass', 'screenshot evidence is preserved', 'visual weaknesses are corrected']),
    }),
  }),
  Object.freeze({
    id: 'systems-complete',
    title: 'Systems complete',
    requiredChecks: Object.freeze([
      'core mechanic is demonstrated',
      'required interactions are demonstrated',
      'state-channel effects are visible',
      'Signature Moment is demonstrated when enabled',
      'baseline restoration or disabled behavior is demonstrated where applicable',
    ]),
    requiredScreenshotEvidence: Object.freeze({
      required: true,
      minimumScreenshots: 2,
      requiredPoses: Object.freeze(['locomotion', 'mechanic']),
    }),
    requiredConsoleEvidence: Object.freeze({
      required: true,
      blockingErrors: 0,
    }),
    requiredPerformanceEvidence: Object.freeze({
      required: true,
      fields: Object.freeze(['fps', 'frameTimeMs']),
    }),
    requiredVisualSelfReview: Object.freeze({
      required: true,
      inspectScreenshot: true,
      fields: Object.freeze(['reviewed', 'weaknesses', 'corrections']),
    }),
    completion: Object.freeze({
      completeStatus: COMPLETE_STATUS,
      incompleteStatus: INCOMPLETE_VERIFICATION_STATUS,
      completeRequires: Object.freeze(['all required checks pass', 'screenshot evidence is preserved', 'visual weaknesses are corrected']),
    }),
  }),
  Object.freeze({
    id: 'final-polish',
    title: 'Final polish',
    requiredChecks: Object.freeze([
      'composition, lighting, materials, and atmosphere are reviewed',
      'visual hierarchy and mechanic readability are reviewed',
      'performance information and console output are reviewed',
      'creative identity and scope discipline are reviewed',
      'final evidence is preserved in the output bundle or project handoff',
    ]),
    requiredScreenshotEvidence: Object.freeze({
      required: true,
      minimumScreenshots: 3,
      requiredPoses: REQUIRED_CAPTURE_POSES,
    }),
    requiredConsoleEvidence: Object.freeze({
      required: true,
      blockingErrors: 0,
    }),
    requiredPerformanceEvidence: Object.freeze({
      required: true,
      fields: Object.freeze(['fps', 'frameTimeMs']),
    }),
    requiredVisualSelfReview: Object.freeze({
      required: true,
      inspectScreenshot: true,
      fields: Object.freeze(['reviewed', 'weaknesses', 'corrections']),
    }),
    completion: Object.freeze({
      completeStatus: COMPLETE_STATUS,
      incompleteStatus: INCOMPLETE_VERIFICATION_STATUS,
      completeRequires: Object.freeze(['all required checks pass', 'all final evidence is preserved', 'visual weaknesses are corrected']),
    }),
  }),
]);

const CONTRACT_TOP_KEYS = ['schemaVersion', 'project', 'selection', 'stateChannels', 'terrainElevation', 'creative', 'acceptance', 'milestones', 'sourceOfTruth', 'architecture', 'approvedPatterns', 'forbiddenPatterns', 'implementationPlan', 'diagnostics', 'reviewCriteria'];

const PROJECT_KEYS = ['name', 'briefFilename', 'briefSha256', 'renderingProfile', 'engine', 'shaderLanguage', 'shaderLanguageExtension', 'materialApi', 'renderingParadigm', 'assetStrategy', 'assetStrategyText', 'targetHardware', 'coreInteractionSentence'];
const SELECTION_KEYS = ['creativeMode', 'path', 'baseShowcase', 'ambition', 'includedSections', 'omittedOptionalSections', 'extraSections', 'biome', 'archetype', 'mechanic', 'camera', 'renderingProfile', 'cameraAdjustments', 'changedAxes'];
const STATE_CHANNEL_KEYS = ['enabled', 'omittedBehavior', 'channels'];
const STATE_ENTRY_KEYS = ['channel', 'nativeMeaning', 'owningSystem', 'writers', 'readers', 'visibleEffect', 'baselineOrReset'];
const BASELINE_KEYS = ['baseline', 'recoveryMechanism', 'recoveryOutcome'];
const CREATIVE_KEYS = ['creativeSpark', 'signatureMoment', 'noveltyBudget', 'coherenceOverrides'];
const SIGNATURE_KEYS = ['enabled', 'text', 'reusedSystem', 'verificationPose', 'instruction'];
const ACCEPTANCE_KEYS = ['requiredProjectPaths', 'productionBuild', 'verificationHook', 'renderer', 'terrain', 'runtime', 'captures', 'imageGates', 'camera', 'evidence', 'environmentVisuals', 'poseDifferences', 'report'];
const MILESTONE_KEYS = ['id', 'title', 'requiredChecks', 'requiredScreenshotEvidence', 'requiredConsoleEvidence', 'requiredPerformanceEvidence', 'requiredVisualSelfReview', 'completion'];

const clone = (value) => JSON.parse(JSON.stringify(value));

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
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

function deepFreeze(value) {
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
    return Object.freeze(value);
  }
  if (isPlainObject(value)) {
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }
  return value;
}

const SOURCE_OF_TRUTH = deepFreeze({
  builderRole: 'implementer',
  builderMayRedesignArchitecture: false,
  builderMayAddFallbacks: false,
  builderMaySkipStages: false,
  builderMayIgnoreFailedChecks: false,
  conflictPolicy: 'stop-and-report',
  requiredInputs: ['<PROJECT>_TECHDEMO_PROMPT.md', 'ENVIZZLE_BUILD.json', 'ENVIZZLE_EVIDENCE.json', 'HANDOFF.md', 'verify/'],
});

const TERRAIN_ELEVATION_OWNERSHIP = deepFreeze({
  renderOwner: 'gpu',
  renderMeshBaseHeight: 0,
  cpuHeightPurpose: ['physics', 'camera-clearance', 'foot-planting'],
  forbidCpuPredisplacedRenderVertices: true,
  requireCpuGpuParityTest: true,
  parityToleranceM: 0.03,
});

const ARCHITECTURE_DEVIATION_POLICY = 'Builder may split files further only when responsibilities stay unchanged and the deviation is documented.';

const BABYLON_FILE_OWNERSHIP = [
  { path: 'src/core/engine.js', responsibility: 'WebGPUEngine init, adapter/device failure, unsupported-backend behavior' },
  { path: 'src/core/gpuValidation.js', responsibility: 'validation scopes, uncaptured errors, device loss, validation-error storage' },
  { path: 'src/core/demoDiagnostics.js', responsibility: 'window.__demo, actual system state, no fabricated readiness' },
  { path: 'src/core/settings.js', responsibility: 'approved feature toggles only' },
  { path: 'src/shaders/', responsibility: 'Babylon-compatible WGSL sources + shared shader functions' },
  { path: 'src/terrain/heightfield.js', responsibility: 'CPU height mirroring for physics, camera clearance, foot planting ONLY' },
  { path: 'src/terrain/parity.js', responsibility: 'GPU evaluation/readback + CPU/GPU parity comparison' },
  { path: 'src/terrain/', responsibility: 'GPU-rendered terrain mesh + LOD system' },
  { path: 'src/character/', responsibility: 'rig, silhouette, animation, visibility, foot placement' },
  { path: 'src/mechanic/', responsibility: 'centrepiece mechanic + mechanic verification state' },
];

const THREE_WEBGL2_FILE_OWNERSHIP = [
  { path: 'src/core/engine.js', responsibility: 'WebGLRenderer init requesting a WebGL2 context, context-loss/unsupported-backend behavior' },
  { path: 'src/core/glValidation.js', responsibility: 'WebGL2 error capture (gl.getError, context-loss listeners), validation-error storage' },
  { path: 'src/core/demoDiagnostics.js', responsibility: 'window.__demo, actual system state, no fabricated readiness' },
  { path: 'src/core/settings.js', responsibility: 'approved feature toggles only' },
  { path: 'src/shaders/', responsibility: 'WebGL2-compatible GLSL ES 3.00 raw shader modules + shared shader functions' },
  { path: 'src/terrain/heightfield.js', responsibility: 'CPU height mirroring for physics, camera clearance, foot planting ONLY' },
  { path: 'src/terrain/parity.js', responsibility: 'GPU evaluation/readback + CPU/GPU parity comparison' },
  { path: 'src/terrain/', responsibility: 'GPU-rendered terrain mesh + LOD system' },
  { path: 'src/character/', responsibility: 'rig, silhouette, animation, visibility, foot placement' },
  { path: 'src/mechanic/', responsibility: 'centrepiece mechanic + mechanic verification state' },
];

export const ARCHITECTURE_BY_PROFILE = deepFreeze({
  'babylon-webgpu': {
    fileOwnership: BABYLON_FILE_OWNERSHIP,
    terrainElevationOwnership: TERRAIN_ELEVATION_OWNERSHIP,
    deviationPolicy: ARCHITECTURE_DEVIATION_POLICY,
  },
  'three-webgl2': {
    fileOwnership: THREE_WEBGL2_FILE_OWNERSHIP,
    terrainElevationOwnership: TERRAIN_ELEVATION_OWNERSHIP,
    deviationPolicy: ARCHITECTURE_DEVIATION_POLICY,
  },
});

const APPROVED_PATTERN_TERRAIN_ELEVATION = {
  id: 'terrain-gpu-elevation-ownership',
  requirement: 'Apply procedural terrain elevation exactly once, inside the GPU vertex shader, at render mesh base height y = 0.',
  detection: 'source-and-runtime',
};
const APPROVED_PATTERN_CPU_GPU_PARITY = {
  id: 'cpu-gpu-parity-check',
  requirement: 'Use the CPU height mirror only for physics, camera clearance, and foot planting, and verify it against a GPU readback within the parity tolerance.',
  detection: 'source-and-runtime',
};
const APPROVED_PATTERN_TRUTHFUL_READINESS = {
  id: 'truthful-readiness-lifecycle',
  requirement: 'window.__demo.ready becomes true only after status reaches "ready" and every backend readiness proof step has succeeded; never set it inside a finally block.',
  detection: 'runtime-only',
};

export const APPROVED_PATTERNS_BY_PROFILE = deepFreeze({
  'babylon-webgpu': [
    { id: 'engine-initialization', requirement: 'Initialize the engine as new BABYLON.WebGPUEngine(canvas) and await engine.initAsync(); never construct BABYLON.Engine as a fallback.', detection: 'source-only' },
    { id: 'shader-language-conformance', requirement: 'Author shaders as WGSL using BABYLON.ShaderLanguage.WGSL on ShaderMaterial, sourced from BABYLON.ShaderStore.ShadersStoreWGSL.', detection: 'source-only' },
    { id: 'binding-ownership', requirement: "Declare uniforms, textures, samplers, and storage resources through Babylon's ShaderMaterial/UniformBuffer APIs; Babylon owns the generated binding groups and numbers.", detection: 'source-only' },
    { id: 'material-mesh-compilation-proof', requirement: 'Force-compile the representative material and mesh via material.forceCompilationAsync(mesh) and confirm material.isReady(mesh) before reporting readiness.', detection: 'source-and-runtime' },
    { id: 'validation-error-capture', requirement: 'Capture both scoped and uncaptured WebGPU validation errors and device-loss events, storing them for diagnostics rather than discarding them.', detection: 'source-and-runtime' },
    { id: 'render-submission-proof', requirement: 'Submit at least one frame and, where the device exposes it, await queue.onSubmittedWorkDone() before counting the frame as complete.', detection: 'source-and-runtime' },
    APPROVED_PATTERN_TERRAIN_ELEVATION,
    APPROVED_PATTERN_CPU_GPU_PARITY,
    APPROVED_PATTERN_TRUTHFUL_READINESS,
  ],
  'three-webgl2': [
    { id: 'engine-initialization', requirement: 'Initialize the renderer as new THREE.WebGLRenderer({...}) against a context explicitly requested as "webgl2"; never silently accept a WebGL1 context as a substitute.', detection: 'source-only' },
    { id: 'shader-language-conformance', requirement: 'Author shaders as raw GLSL ES 3.00 modules for THREE.RawShaderMaterial; do not mix in WGSL syntax or Babylon shader APIs.', detection: 'source-only' },
    { id: 'binding-ownership', requirement: "Declare uniforms and attributes through Three.js's RawShaderMaterial uniform/attribute definitions; do not hand-roll WebGPU-style @group/@binding layouts.", detection: 'source-only' },
    { id: 'material-mesh-compilation-proof', requirement: 'Compile the representative material and mesh by rendering one frame and confirm the WebGL2 program linked successfully before reporting readiness.', detection: 'source-and-runtime' },
    { id: 'validation-error-capture', requirement: 'Capture WebGL2 context errors via gl.getError() polling and listen for webglcontextlost/webglcontextrestored events, storing them for diagnostics rather than discarding them.', detection: 'source-and-runtime' },
    { id: 'render-submission-proof', requirement: 'Render at least one frame and confirm submission via renderer.info.render.frame (or gl.finish()) before counting the frame as complete.', detection: 'source-and-runtime' },
    APPROVED_PATTERN_TERRAIN_ELEVATION,
    APPROVED_PATTERN_CPU_GPU_PARITY,
    APPROVED_PATTERN_TRUTHFUL_READINESS,
  ],
});

const FORBIDDEN_PATTERN_WEBGL_FALLBACK = { id: 'webgl-fallback', blocking: true, reason: 'Falling back to a lesser rendering backend than the one selected for this project defeats the purpose of the rendering-profile proof.', detection: 'source-and-runtime' };
const FORBIDDEN_PATTERN_DUPLICATE_TERRAIN_DISPLACEMENT = { id: 'duplicate-terrain-displacement', blocking: true, reason: 'Applying procedural elevation more than once (e.g. on both CPU and GPU, or twice in the vertex shader) breaks the single source of truth for terrain height.', detection: 'source-and-runtime' };
const FORBIDDEN_PATTERN_CPU_PREDISPLACED_RENDER_MESH = { id: 'cpu-predisplaced-render-mesh', blocking: true, reason: 'Render vertices must enter the vertex shader flat at base height; pre-displacing them on the CPU duplicates elevation ownership and breaks GPU/CPU parity.', detection: 'source-and-runtime' };
const FORBIDDEN_PATTERN_PREMATURE_READINESS = { id: 'premature-readiness', blocking: true, reason: 'Setting window.__demo.ready to true before status reaches "ready" and every backend proof step succeeds fabricates readiness.', detection: 'runtime-only' };
const FORBIDDEN_PATTERN_SUPPRESSED_INIT_FAILURE = { id: 'suppressed-initialization-failure', blocking: true, reason: 'Catching an initialization failure and continuing without setting status to "failed" and a nonblank error hides a real backend failure.', detection: 'source-and-runtime' };
const FORBIDDEN_PATTERN_PLACEHOLDER_CHARACTER = { id: 'placeholder-character', blocking: true, reason: 'Shipping a primitive box, capsule, or sphere stand-in instead of an intentional procedural silhouette defeats the character-locomotion stage.', detection: 'visual-review' };
const FORBIDDEN_PATTERN_INDISTINGUISHABLE_POSES = { id: 'indistinguishable-poses', blocking: true, reason: 'Idle, locomotion, and mechanic captures must be visually distinguishable from each other; identical or near-identical poses indicate the pose system is not wired up.', detection: 'visual-review' };
const FORBIDDEN_PATTERN_RENDER_LOOP_ALLOCATION = { id: 'render-loop-allocation', blocking: true, reason: 'Allocating new objects, arrays, or materials inside the per-frame render loop causes garbage-collection stalls and masks true performance.', detection: 'source-only' };
const FORBIDDEN_PATTERN_INCOMPLETE_EVIDENCE = { id: 'incomplete-evidence', blocking: true, reason: 'Marking a milestone complete without the required screenshots, console findings, performance values, or visual self-review is a false completion claim.', detection: 'evidence-record' };
const FORBIDDEN_PATTERN_CONTINUE_AFTER_FAILED_STAGE = { id: 'continue-after-failed-stage', blocking: true, reason: 'Starting the next implementation stage while the current stage has not passed its automated and visual checks violates the one-stage-at-a-time workflow.', detection: 'process' };

export const FORBIDDEN_PATTERNS_BY_PROFILE = deepFreeze({
  'babylon-webgpu': [
    { id: 'manual-babylon-bindings', blocking: true, reason: "Manual @group(...)/@binding(...) declarations inside a Babylon-managed ShaderMaterial source fight Babylon's own generated binding groups and numbers, even when Babylon's UniformBuffer/storage/texture/sampler APIs are used.", detection: 'source-only' },
    { id: 'wrong-babylon-shader-language', blocking: true, reason: 'Configuring a ShaderMaterial with BABYLON.ShaderLanguage.GLSL (or any non-WGSL language) abandons the selected WGSL/WebGPU rendering profile.', detection: 'source-only' },
    { id: 'wrong-babylon-shader-store', blocking: true, reason: 'Registering shaders under a non-WGSL ShaderStore (e.g. a fallbackGlsl entry) reintroduces a forbidden fallback shader path.', detection: 'source-only' },
    FORBIDDEN_PATTERN_WEBGL_FALLBACK,
    FORBIDDEN_PATTERN_DUPLICATE_TERRAIN_DISPLACEMENT,
    FORBIDDEN_PATTERN_CPU_PREDISPLACED_RENDER_MESH,
    FORBIDDEN_PATTERN_PREMATURE_READINESS,
    FORBIDDEN_PATTERN_SUPPRESSED_INIT_FAILURE,
    FORBIDDEN_PATTERN_PLACEHOLDER_CHARACTER,
    FORBIDDEN_PATTERN_INDISTINGUISHABLE_POSES,
    FORBIDDEN_PATTERN_RENDER_LOOP_ALLOCATION,
    FORBIDDEN_PATTERN_INCOMPLETE_EVIDENCE,
    FORBIDDEN_PATTERN_CONTINUE_AFTER_FAILED_STAGE,
  ],
  'three-webgl2': [
    { id: 'wgsl-binding-syntax-in-webgl2', blocking: true, reason: 'WGSL-only @group(...)/@binding(...) binding syntax has no meaning in a WebGL2/GLSL ES 3.00 project and indicates a copy-pasted WebGPU shader path.', detection: 'source-only' },
    { id: 'wrong-webgl2-shader-language', blocking: true, reason: 'WGSL entry-point syntax (e.g. @vertex/@fragment directives or fn main()) inside a three-webgl2 project abandons the selected GLSL ES 3.00 rendering profile.', detection: 'source-only' },
    { id: 'webgl1-fallback-context', blocking: true, reason: 'Requesting a "webgl" (WebGL1) context instead of "webgl2" silently downgrades the selected rendering profile.', detection: 'source-and-runtime' },
    FORBIDDEN_PATTERN_WEBGL_FALLBACK,
    FORBIDDEN_PATTERN_DUPLICATE_TERRAIN_DISPLACEMENT,
    FORBIDDEN_PATTERN_CPU_PREDISPLACED_RENDER_MESH,
    FORBIDDEN_PATTERN_PREMATURE_READINESS,
    FORBIDDEN_PATTERN_SUPPRESSED_INIT_FAILURE,
    FORBIDDEN_PATTERN_PLACEHOLDER_CHARACTER,
    FORBIDDEN_PATTERN_INDISTINGUISHABLE_POSES,
    FORBIDDEN_PATTERN_RENDER_LOOP_ALLOCATION,
    FORBIDDEN_PATTERN_INCOMPLETE_EVIDENCE,
    FORBIDDEN_PATTERN_CONTINUE_AFTER_FAILED_STAGE,
  ],
});

const IMPLEMENTATION_PLAN = deepFreeze([
  {
    id: 'backend-proof',
    order: 1,
    goal: 'Prove the selected rendering backend, shader language, and readiness lifecycle are genuinely active before any other system is built.',
    allowedScope: ['engine initialization', 'one representative material', 'one representative mesh', 'required backend diagnostics', 'GPU validation capture', 'one successfully completed frame', 'truthful readiness state'],
    requiredOutputs: ['selected backend is active', 'selected shader language is active', 'representative shader is processed by the selected engine', 'pipeline and bindings are valid', 'representative material compiles', 'material becomes ready', 'validation error list is empty', 'at least one submitted frame completes', 'readiness changes to true only after all prior proof succeeds'],
    approvedPatternIds: ['engine-initialization', 'shader-language-conformance', 'binding-ownership', 'material-mesh-compilation-proof', 'validation-error-capture', 'render-submission-proof', 'truthful-readiness-lifecycle'],
    forbiddenPatternIds: ['webgl-fallback', 'premature-readiness', 'suppressed-initialization-failure', 'render-loop-allocation', 'continue-after-failed-stage'],
    automatedChecks: ['production build succeeds', 'rendererInfo() reports the selected backend and shader language', 'rendererInfo().materialsReady is true', 'rendererInfo().renderedFrames is at least 1', 'rendererInfo().validationErrors is empty'],
    visualChecks: ['the representative material and mesh render without visible corruption or missing textures'],
    stopConditions: ['do not build full terrain, character, particles, mechanic, or atmosphere systems until backend proof passes', 'do not add a fallback renderer under any circumstance'],
    requiredEvidence: ['window.__demo.rendererInfo() capture', 'zero scoped and uncaptured validation errors'],
    doNotProceedUntilPassed: true,
  },
  {
    id: 'terrain-kernel',
    order: 2,
    goal: 'Prove a single GPU-owned terrain patch renders correctly with a flat CPU render mirror and verified GPU/CPU parity before expanding terrain coverage.',
    allowedScope: ['one terrain patch', 'GPU-owned visual elevation', 'flat CPU-built render vertices', 'CPU mirror used only for physics, camera clearance, and foot planting', 'GPU parity evaluation', 'normals', 'camera clearance'],
    requiredOutputs: ['the single terrain patch renders with GPU-owned elevation', 'CPU-built render vertices remain flat at base height', 'CPU height mirror is used only for physics, camera clearance, and foot planting', 'GPU/CPU parity evaluation is within tolerance', 'terrain normals are correct', 'camera clearance above the terrain is verified'],
    approvedPatternIds: ['terrain-gpu-elevation-ownership', 'cpu-gpu-parity-check'],
    forbiddenPatternIds: ['duplicate-terrain-displacement', 'cpu-predisplaced-render-mesh', 'render-loop-allocation', 'continue-after-failed-stage'],
    automatedChecks: ['terrainDiagnostics().renderOwner is "gpu"', 'terrainDiagnostics().renderMeshBaseHeight is 0', 'terrainDiagnostics().parityMethod reflects a GPU readback', 'terrainDiagnostics().parityMaxErrorM is within tolerance'],
    visualChecks: ['the terrain patch shows continuous natural elevation, not a flat or corrupted plane'],
    stopConditions: ['do not add clipmap rings or continuous terrain expansion until the single patch passes'],
    requiredEvidence: ['window.__demo.terrainDiagnostics() capture', 'camera clearance confirmation'],
    doNotProceedUntilPassed: true,
  },
  {
    id: 'environment-composition',
    order: 3,
    goal: 'Expand the single terrain patch into continuous, biome-correct terrain with LOD, far field, lighting, and atmosphere, and compose the initial camera view.',
    allowedScope: ['continuous terrain expansion', 'clipmap or nested-ring LOD', 'biome morphology', 'far field', 'lighting', 'atmosphere', 'initial camera composition'],
    requiredOutputs: ['terrain expands continuously beyond the single patch without visible seams', 'biome morphology reads clearly', 'far field, lighting, and atmosphere are present', 'the initial camera composition matches the selected camera mode'],
    approvedPatternIds: ['terrain-gpu-elevation-ownership', 'cpu-gpu-parity-check'],
    forbiddenPatternIds: ['duplicate-terrain-displacement', 'cpu-predisplaced-render-mesh', 'render-loop-allocation', 'continue-after-failed-stage'],
    automatedChecks: ['production build succeeds', 'no blocking console or GPU errors'],
    visualChecks: ['the idle screenshot already clearly resembles the selected biome before character development begins'],
    stopConditions: ['do not begin character or locomotion work until the environment composition visually reads as the selected biome'],
    requiredEvidence: ['idle screenshot resembling the selected biome'],
    doNotProceedUntilPassed: true,
  },
  {
    id: 'character-locomotion',
    order: 4,
    goal: 'Build an intentional procedural character with a readable silhouette, idle and locomotion animation, foot planting, and appropriate camera framing.',
    allowedScope: ['procedural character', 'intentional silhouette', 'idle animation', 'locomotion', 'foot planting', 'appropriate camera framing', 'character visibility verification'],
    requiredOutputs: ['the character has an intentional, non-placeholder silhouette', 'idle and locomotion animations are present and visually distinguishable', 'foot planting tracks the terrain surface', 'the camera frames the character appropriately for the selected camera mode', 'character visibility is verified'],
    approvedPatternIds: [],
    forbiddenPatternIds: ['placeholder-character', 'indistinguishable-poses', 'render-loop-allocation', 'continue-after-failed-stage'],
    automatedChecks: ['setCharacterVisible(true) makes the character visible', 'setPose("idle") and setPose("locomotion") both succeed'],
    visualChecks: ['idle and locomotion poses are immediately distinguishable from each other', 'the character is not a placeholder primitive'],
    stopConditions: ['the character must not be a placeholder primitive', 'idle and locomotion must be visually distinguishable before proceeding'],
    requiredEvidence: ['idle pose screenshot', 'locomotion pose screenshot'],
    doNotProceedUntilPassed: true,
  },
  {
    id: 'mechanic-polish',
    order: 5,
    goal: 'Implement the centrepiece mechanic, add particles and secondary effects, finalize materials, lighting, and performance, and complete all evidence for final review.',
    allowedScope: ['centrepiece mechanic', 'particles and secondary effects', 'final materials', 'final lighting', 'performance cleanup', 'complete evidence', 'final visual review'],
    requiredOutputs: ['the centrepiece mechanic is demonstrated and visibly affects the scene', 'particles and secondary effects are present where specified', 'final materials and lighting are applied', 'performance is reviewed and recorded', 'all required evidence is complete across all three milestones'],
    approvedPatternIds: [],
    forbiddenPatternIds: ['indistinguishable-poses', 'render-loop-allocation', 'incomplete-evidence', 'continue-after-failed-stage'],
    automatedChecks: ['setPose("mechanic") succeeds', 'no blocking console or GPU errors', 'all three milestones report complete status with full evidence'],
    visualChecks: ['the mechanic capture is immediately distinguishable from both the idle and locomotion captures'],
    stopConditions: ['do not report the demo complete while any milestone evidence is missing or any visual weakness is uncorrected'],
    requiredEvidence: ['mechanic pose screenshot distinguishable from idle and locomotion', 'final performance values', 'final visual self-review'],
    doNotProceedUntilPassed: true,
  },
]);

const DIAGNOSTICS_LIFECYCLE = deepFreeze({
  statuses: ['initializing', 'ready', 'failed'],
  readyRequiresStatus: 'ready',
  failureRequiresNonblankError: true,
});

const TERRAIN_DIAGNOSTICS_CONTRACT = deepFreeze({
  keys: ['renderOwner', 'renderMeshBaseHeight', 'parityMethod', 'paritySamples', 'parityMaxErrorM'],
  renderOwner: 'gpu',
  renderMeshBaseHeight: 0,
  parityMethod: 'gpu-readback',
  parityToleranceM: 0.03,
});

const CAMERA_DIAGNOSTICS_CONTRACT = deepFreeze({
  keys: ['method', 'nearestDepthM', 'terrainClearanceM'],
  allowedMethods: ['gpu-depth', 'cpu-height-with-gpu-parity'],
  forbiddenMethods: ['cpu-height-only'],
  minNearestDepthM: 0.30,
});

export const DIAGNOSTICS_CONTRACT_BY_PROFILE = deepFreeze({
  'babylon-webgpu': {
    hook: 'window.__demo',
    lifecycle: DIAGNOSTICS_LIFECYCLE,
    rendererInfo: {
      keys: ['backend', 'shaderLanguage', 'materialsReady', 'renderedFrames', 'validationErrors'],
      backend: 'webgpu',
      shaderLanguage: 'wgsl',
      materialsReadyRequired: true,
      minRenderedFrames: 1,
      maxValidationErrors: 0,
    },
    terrainDiagnostics: TERRAIN_DIAGNOSTICS_CONTRACT,
    cameraDiagnostics: CAMERA_DIAGNOSTICS_CONTRACT,
  },
  'three-webgl2': {
    hook: 'window.__demo',
    lifecycle: DIAGNOSTICS_LIFECYCLE,
    rendererInfo: {
      keys: ['backend', 'shaderLanguage', 'materialsReady', 'renderedFrames', 'validationErrors'],
      backend: 'webgl2',
      shaderLanguage: 'glsl-es-300',
      materialsReadyRequired: true,
      minRenderedFrames: 1,
      maxValidationErrors: 0,
    },
    terrainDiagnostics: TERRAIN_DIAGNOSTICS_CONTRACT,
    cameraDiagnostics: CAMERA_DIAGNOSTICS_CONTRACT,
  },
});

const REVIEW_CRITERIA_UNIVERSAL = deepFreeze([
  { category: 'biome-identity', questions: ['Does the scene immediately read as the selected biome without being told what it is?', "Are the biome's signature morphology, materials, and lighting present and dominant?"] },
  { category: 'composition', questions: ['Is the frame composed with a clear focal subject and readable depth?', "Does the camera framing match the selected camera mode's intent?"] },
  { category: 'terrain-quality', questions: ['Does the terrain show continuous, natural elevation rather than repeated primitive shapes?', 'Are terrain normals and shading consistent with the claimed elevation?'] },
  { category: 'lod-continuity', questions: ['Are LOD or clipmap boundaries seamless, with no visible popping, cracks, or grid seams?', 'Does terrain detail degrade gracefully with distance rather than dropping abruptly?'] },
  { category: 'material-quality', questions: ['Do materials read as the intended surface type rather than a flat placeholder color?', 'Is the approved palette respected and coherent across surfaces?'] },
  { category: 'character-silhouette', questions: ['Is the character an intentional, readable silhouette rather than a primitive box, capsule, or sphere?', "Does the archetype's identity read clearly at the verification camera distance?"] },
  { category: 'character-scale', questions: ['Is the character scaled plausibly relative to the terrain and environment?', 'Does the character avoid appearing miniature or oversized against nearby landmarks?'] },
  { category: 'locomotion-readability', questions: ['Are idle and locomotion poses visually distinguishable from each other?', 'Does foot planting track the terrain surface without floating or clipping?'] },
  { category: 'mechanic-readability', questions: ['Is the centrepiece mechanic immediately distinguishable from idle and locomotion when captured?', 'Does the mechanic visibly affect the state-buffer-driven surface when enabled?'] },
  { category: 'placeholder-detection', questions: ['Are there any unstyled default materials, missing textures, or debug-only primitives visible?', 'Does anything in the frame look like scaffolding rather than a finished demo?'] },
  { category: 'visual-hierarchy', questions: ['Does the eye land on the character or mechanic first, not on background noise?', 'Is lighting and contrast used to separate subject from environment?'] },
  { category: 'scope-discipline', questions: ["Does the captured scene match the current stage's allowed scope, with no later-stage systems built ahead of schedule?", "Is anything visible that the current milestone's requiredOutputs do not yet justify?"] },
]);

const REVIEW_CRITERIA_KEYS = ['universal', 'biomeSpecific'];
const REVIEW_CRITERIA_CATEGORY_KEYS = ['category', 'questions'];

function biomeReviewCriteria(biome) {
  const entries = [];
  const morphologyAntiPatterns = biome?.tokens?.MORPHOLOGY_ANTI_PATTERNS;
  if (nonEmptyString(morphologyAntiPatterns)) {
    entries.push({ category: 'morphology-anti-patterns', questions: [morphologyAntiPatterns] });
  }
  const visualReviewQuestions = biome?.tokens?.VISUAL_REVIEW_QUESTIONS;
  if (nonEmptyString(visualReviewQuestions)) {
    entries.push({ category: 'biome-visual-review-questions', questions: [visualReviewQuestions] });
  }
  return entries;
}

function canonicalSections(values, registry) {
  return registry.filter((value) => Array.isArray(values) && values.includes(value));
}

function canonicalChangedAxes(values) {
  const order = ['ambition', 'biome', 'archetype', 'mechanic', 'camera'];
  return order.filter((axis) => Array.isArray(values) && values.includes(axis));
}

function canonicalStateChannels({ selection, biome }) {
  const enabled = selection.includedSections.includes('state-buffer');
  const channels = {};
  const writeKeys = enabled ? (MECHANIC_WRITES[selection.mechanic] || []) : [];
  for (const key of writeKeys) {
    const source = selection.stateChannelContract[key];
    const nativeMeaning = BIOME_CHANNELS[selection.biome]?.[source.channel] || '';
    channels[key] = {
      channel: source.channel,
      nativeMeaning,
      owningSystem: 'state-buffer',
      writers: [selection.mechanic],
      readers: [biome.tokens.PRIMARY_MATERIAL_NAME],
      visibleEffect: source.effect,
      baselineOrReset: {
        baseline: 'zero',
        recoveryMechanism: biome.tokens.RECOVERY_MECHANISM,
        recoveryOutcome: biome.tokens.RECOVERY_OUTCOME,
      },
    };
  }
  return {
    enabled,
    omittedBehavior: 'state-buffer.addSplat(...) is a disabled/no-op integration hook when state-buffer is omitted.',
    channels,
  };
}

export function createCanonicalAssemblyModel({
  projectName,
  fileName,
  briefSha256 = null,
  selection,
  profile,
  effectiveCoherence,
  renderingParadigm,
  targetHardware,
  coreInteractionSentence,
  creativeSpark,
  signatureMomentInstruction,
  biome,
  coherenceOverrides = [],
}) {
  const includedSections = canonicalSections(selection.includedSections, CORE_SECTIONS);
  const extraSections = canonicalSections(selection.extraSections, EXTRA_SECTIONS);
  return {
    project: {
      name: projectName,
      briefFilename: fileName,
      ...(briefSha256 ? { briefSha256 } : {}),
      renderingProfile: profile.id,
      engine: profile.engine,
      shaderLanguage: profile.shaderLang,
      shaderLanguageExtension: profile.shaderLangExt,
      materialApi: profile.materialApi,
      renderingParadigm,
      assetStrategy: 'zero-asset',
      assetStrategyText: ZERO_ASSET_STRATEGY_TEXT,
      targetHardware,
      coreInteractionSentence,
    },
    selection: {
      creativeMode: selection.creativeMode,
      path: selection.path,
      baseShowcase: selection.baseShowcase,
      ambition: selection.ambition,
      includedSections,
      omittedOptionalSections: EXTRA_SECTIONS.filter((section) => !extraSections.includes(section)),
      extraSections,
      biome: selection.biome,
      archetype: selection.archetype,
      mechanic: selection.mechanic,
      camera: selection.camera,
      renderingProfile: profile.id,
      cameraAdjustments: Array.isArray(selection.cameraAdjustments) ? [...selection.cameraAdjustments].sort() : [],
      changedAxes: canonicalChangedAxes(selection.changedAxes),
    },
    stateChannels: canonicalStateChannels({ selection, biome }),
    terrainElevation: clone(TERRAIN_ELEVATION_CONTRACT),
    creative: {
      creativeSpark,
      signatureMoment: {
        enabled: selection.signatureMoment.enabled,
        text: selection.signatureMoment.text,
        reusedSystem: selection.signatureMoment.reusedSystem,
        verificationPose: selection.signatureMoment.verificationPose,
        instruction: signatureMomentInstruction,
      },
      noveltyBudget: NOVELTY_BUDGET_KEYS.reduce((result, key) => {
        result[key] = selection.noveltyBudget[key];
        return result;
      }, {}),
      coherenceOverrides: clone(coherenceOverrides || []).sort((a, b) => String(a.rule).localeCompare(String(b.rule))),
    },
    acceptance: clone(ACCEPTANCE_GATES),
    milestones: clone(MILESTONE_DEFINITIONS),
    sourceOfTruth: clone(SOURCE_OF_TRUTH),
    architecture: clone(ARCHITECTURE_BY_PROFILE[profile.id]),
    approvedPatterns: clone(APPROVED_PATTERNS_BY_PROFILE[profile.id]),
    forbiddenPatterns: clone(FORBIDDEN_PATTERNS_BY_PROFILE[profile.id]),
    implementationPlan: clone(IMPLEMENTATION_PLAN),
    diagnostics: clone(DIAGNOSTICS_CONTRACT_BY_PROFILE[profile.id]),
    reviewCriteria: {
      universal: clone(REVIEW_CRITERIA_UNIVERSAL),
      biomeSpecific: biomeReviewCriteria(biome),
    },
  };
}

export function createBuildContract(model) {
  return {
    schemaVersion: BUILD_CONTRACT_SCHEMA_VERSION,
    ...clone(model),
  };
}

export function createEvidenceTemplate(briefSha256 = null) {
  return {
    schemaVersion: BUILD_CONTRACT_SCHEMA_VERSION,
    briefSha256,
    status: INCOMPLETE_VERIFICATION_STATUS,
    milestones: MILESTONE_DEFINITIONS.map(({ id }) => ({
      id,
      status: INCOMPLETE_VERIFICATION_STATUS,
      screenshots: [],
      console: { errors: [], warnings: [] },
      performance: { fps: null, frameTimeMs: null },
      visualSelfReview: { reviewed: false, weaknesses: [], corrections: [] },
    })),
  };
}

function validateProject(project, errors) {
  if (!exactKeys(project, PROJECT_KEYS, 'project', errors)) return;
  if (!nonEmptyString(project.name) || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(project.name)) errors.push('project.name must be a safe upper-case hyphenated name');
  if (!isSafeRelativePath(project.briefFilename) || project.briefFilename !== `${project.name.replace(/-/g, '_')}_TECHDEMO_PROMPT.md`) errors.push('project.briefFilename must be the deterministic project brief filename');
  if (typeof project.briefSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(project.briefSha256)) errors.push('project.briefSha256 must be exactly 64 lowercase hexadecimal characters');
  const profile = RENDERING_PROFILES[project.renderingProfile];
  if (!profile) {
    errors.push(`project.renderingProfile must be one of: ${Object.keys(RENDERING_PROFILES).join(', ')}`);
  } else {
    if (project.engine !== profile.engine || project.shaderLanguage !== profile.shaderLang || project.shaderLanguageExtension !== profile.shaderLangExt || project.materialApi !== profile.materialApi) {
      errors.push('project rendering profile tuple does not match the canonical rendering profile');
    }
  }
  if (!['AAA Photoreal', 'Ghibli-Style Painterly Anime'].includes(project.renderingParadigm)) errors.push('project.renderingParadigm is invalid');
  if (project.assetStrategy !== 'zero-asset' || project.assetStrategyText !== ZERO_ASSET_STRATEGY_TEXT) errors.push('project asset strategy must use the canonical zero-asset contract');
  if (!nonEmptyString(project.targetHardware)) errors.push('project.targetHardware must be non-empty');
  if (!nonEmptyString(project.coreInteractionSentence)) errors.push('project.coreInteractionSentence must be non-empty');
}

function validateTerrainElevation(contract, errors) {
  if (!exactKeys(contract.terrainElevation, Object.keys(TERRAIN_ELEVATION_CONTRACT), 'terrainElevation', errors)) return;
  if (JSON.stringify(Object.keys(contract.terrainElevation)) !== JSON.stringify(Object.keys(TERRAIN_ELEVATION_CONTRACT))) errors.push('terrainElevation keys must remain in canonical order');
  compareCanonical(contract.terrainElevation, TERRAIN_ELEVATION_CONTRACT, 'terrainElevation', errors);
  if (contract.terrainElevation.renderOwner !== 'gpu') errors.push('terrainElevation.renderOwner must be gpu');
  if (contract.terrainElevation.renderMeshBaseHeight !== 0) errors.push('terrainElevation.renderMeshBaseHeight must be exactly 0');
  if (!Array.isArray(contract.terrainElevation.cpuHeightPurpose) || JSON.stringify(contract.terrainElevation.cpuHeightPurpose) !== JSON.stringify(TERRAIN_ELEVATION_CONTRACT.cpuHeightPurpose)) errors.push('terrainElevation.cpuHeightPurpose must contain physics, camera-clearance, foot-planting in canonical order');
  if (contract.terrainElevation.forbidCpuPredisplacedRenderVertices !== true) errors.push('terrainElevation.forbidCpuPredisplacedRenderVertices must be true');
  if (contract.terrainElevation.requireCpuGpuParityTest !== true) errors.push('terrainElevation.requireCpuGpuParityTest must be true');
  if (typeof contract.terrainElevation.parityToleranceM !== 'number' || !Number.isFinite(contract.terrainElevation.parityToleranceM) || contract.terrainElevation.parityToleranceM < 0) errors.push('terrainElevation.parityToleranceM must be finite and non-negative');
}

function contractSelectionForValidation(contract) {
  const channels = contract.stateChannels.channels;
  const stateChannelContract = Object.fromEntries(Object.entries(channels).map(([key, entry]) => [key, {
    channel: entry.channel,
    effect: entry.visibleEffect,
  }]));
  return {
    ...contract.selection,
    stateChannelContract,
    signatureMoment: {
      enabled: contract.creative.signatureMoment.enabled,
      text: contract.creative.signatureMoment.text,
      reusedSystem: contract.creative.signatureMoment.reusedSystem,
      verificationPose: contract.creative.signatureMoment.verificationPose,
    },
    noveltyBudget: contract.creative.noveltyBudget,
  };
}

function validateSelectionContract(contract, errors) {
  if (!exactKeys(contract.selection, SELECTION_KEYS, 'selection', errors)) return;
  if (!isPlainObject(contract.stateChannels) || !isPlainObject(contract.stateChannels.channels) || !isPlainObject(contract.creative) || !isPlainObject(contract.creative.signatureMoment) || !isPlainObject(contract.creative.noveltyBudget)) {
    errors.push('selection cannot be cross-validated until stateChannels and creative sections are well-formed');
    return;
  }
  if (!CREATIVE_MODES.includes(contract.selection.creativeMode)) errors.push('selection.creativeMode is invalid');
  if (!SELECTION_PATHS.includes(contract.selection.path)) errors.push('selection.path is invalid');
  if (contract.selection.baseShowcase !== null && (typeof contract.selection.baseShowcase !== 'string' || !SHOWCASES[contract.selection.baseShowcase])) errors.push('selection.baseShowcase is invalid');
  if (!AMBITIONS.includes(contract.selection.ambition)) errors.push('selection.ambition is invalid');
  if (!ARCHETYPES.includes(contract.selection.archetype)) errors.push('selection.archetype is invalid');
  for (const key of ['includedSections', 'omittedOptionalSections', 'extraSections', 'cameraAdjustments', 'changedAxes']) {
    if (!Array.isArray(contract.selection[key]) || contract.selection[key].some((value) => typeof value !== 'string')) errors.push(`selection.${key} must be an array of strings`);
  }
  const expectedOmitted = EXTRA_SECTIONS.filter((section) => !contract.selection.extraSections.includes(section));
  if (JSON.stringify(contract.selection.omittedOptionalSections) !== JSON.stringify(expectedOmitted)) errors.push('selection.omittedOptionalSections contradicts selection.extraSections');
  if (JSON.stringify(contract.selection.includedSections) !== JSON.stringify(canonicalSections(contract.selection.includedSections, CORE_SECTIONS))) errors.push('selection.includedSections is not in canonical order');
  if (JSON.stringify(contract.selection.extraSections) !== JSON.stringify(canonicalSections(contract.selection.extraSections, EXTRA_SECTIONS))) errors.push('selection.extraSections is not in canonical order');
  if (JSON.stringify(contract.selection.changedAxes) !== JSON.stringify(canonicalChangedAxes(contract.selection.changedAxes))) errors.push('selection.changedAxes is not in canonical order');
  if (JSON.stringify(contract.selection.cameraAdjustments) !== JSON.stringify([...contract.selection.cameraAdjustments].sort())) errors.push('selection.cameraAdjustments is not in canonical order');

  const selectionFindings = validateSelection(contractSelectionForValidation(contract));
  for (const finding of selectionFindings.filter((finding) => finding.severity === 'error')) {
    errors.push(`selection contract: ${finding.rule}: ${finding.message}`);
  }
}

function validateStateChannels(contract, errors) {
  if (!exactKeys(contract.stateChannels, STATE_CHANNEL_KEYS, 'stateChannels', errors)) return;
  if (typeof contract.stateChannels.enabled !== 'boolean') errors.push('stateChannels.enabled must be boolean');
  if (contract.stateChannels.omittedBehavior !== 'state-buffer.addSplat(...) is a disabled/no-op integration hook when state-buffer is omitted.') errors.push('stateChannels.omittedBehavior is not canonical');
  if (!isPlainObject(contract.stateChannels.channels)) {
    errors.push('stateChannels.channels must be a plain object');
    return;
  }
  const expectedKeys = contract.stateChannels.enabled ? (MECHANIC_WRITES[contract.selection?.mechanic] || []) : [];
  const actualKeys = Object.keys(contract.stateChannels.channels);
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) errors.push(`stateChannels.channels must contain exactly: ${expectedKeys.join(', ')}`);
  const nativeMap = BIOME_CHANNELS[contract.selection?.biome] || {};
  const seenChannels = new Set();
  for (const key of actualKeys) {
    const entry = contract.stateChannels.channels[key];
    if (!exactKeys(entry, STATE_ENTRY_KEYS, `stateChannels.channels.${key}`, errors)) continue;
    if (!/^[RGBA]$/.test(entry.channel)) errors.push(`stateChannels.channels.${key}.channel must be one of R, G, B, A`);
    if (seenChannels.has(entry.channel)) errors.push(`stateChannels.channels contains duplicate channel ${entry.channel}`);
    seenChannels.add(entry.channel);
    if (entry.nativeMeaning !== nativeMap[entry.channel]) errors.push(`stateChannels.channels.${key}.nativeMeaning disagrees with BIOME_CHANNELS`);
    if (entry.owningSystem !== 'state-buffer') errors.push(`stateChannels.channels.${key}.owningSystem must be state-buffer`);
    if (!Array.isArray(entry.writers) || entry.writers.length === 0 || entry.writers.some((value) => !nonEmptyString(value))) errors.push(`stateChannels.channels.${key}.writers must be a non-empty string array`);
    if (!Array.isArray(entry.readers) || entry.readers.length === 0 || entry.readers.some((value) => !nonEmptyString(value))) errors.push(`stateChannels.channels.${key}.readers must be a non-empty string array`);
    if (!nonEmptyString(entry.visibleEffect)) errors.push(`stateChannels.channels.${key}.visibleEffect must be non-empty`);
    if (exactKeys(entry.baselineOrReset, BASELINE_KEYS, `stateChannels.channels.${key}.baselineOrReset`, errors)) {
      if (entry.baselineOrReset.baseline !== 'zero') errors.push(`stateChannels.channels.${key}.baselineOrReset.baseline must be zero`);
      if (!nonEmptyString(entry.baselineOrReset.recoveryMechanism) || !nonEmptyString(entry.baselineOrReset.recoveryOutcome)) errors.push(`stateChannels.channels.${key}.baselineOrReset recovery fields must be non-empty`);
    }
  }
}

function validateCreative(contract, errors) {
  if (!exactKeys(contract.creative, CREATIVE_KEYS, 'creative', errors)) return;
  if (!nonEmptyString(contract.creative.creativeSpark)) errors.push('creative.creativeSpark must be non-empty');
  if (!exactKeys(contract.creative.signatureMoment, SIGNATURE_KEYS, 'creative.signatureMoment', errors)) return;
  const sig = contract.creative.signatureMoment;
  if (typeof sig.enabled !== 'boolean') errors.push('creative.signatureMoment.enabled must be boolean');
  if (typeof sig.text !== 'string' || typeof sig.reusedSystem !== 'string' || !REQUIRED_CAPTURE_POSES.includes(sig.verificationPose) || !nonEmptyString(sig.instruction)) errors.push('creative.signatureMoment contains invalid fields');
  if (contract.selection?.creativeMode === 'proven' && (sig.enabled !== false || sig.text !== '' || sig.reusedSystem !== '')) errors.push('Proven mode must encode no independent Signature Moment');
  if ((contract.selection?.creativeMode === 'signature' || contract.selection?.creativeMode === 'experimental') && (sig.enabled !== true || !nonEmptyString(sig.text) || !nonEmptyString(sig.reusedSystem))) errors.push('Signature and Experimental modes require exactly one bounded Signature Moment');
  if (!exactKeys(contract.creative.noveltyBudget, NOVELTY_BUDGET_KEYS, 'creative.noveltyBudget', errors)) return;
  for (const key of NOVELTY_BUDGET_KEYS) if (contract.creative.noveltyBudget[key] !== false) errors.push(`creative.noveltyBudget.${key} must be false`);
  if (!Array.isArray(contract.creative.coherenceOverrides)) {
    errors.push('creative.coherenceOverrides must be an array');
  } else {
    for (const [index, override] of contract.creative.coherenceOverrides.entries()) {
      if (!exactKeys(override, ['rule', 'reason'], `creative.coherenceOverrides[${index}]`, errors)) continue;
      if (!nonEmptyString(override.rule) || !nonEmptyString(override.reason)) errors.push(`creative.coherenceOverrides[${index}] must contain non-empty rule and reason`);
    }
  }
}

function validateReviewCriteria(contract, errors) {
  const label = 'reviewCriteria';
  if (!isPlainObject(contract.reviewCriteria)) {
    errors.push(`${label} must be a plain object`);
    return;
  }
  if (!exactKeys(contract.reviewCriteria, REVIEW_CRITERIA_KEYS, label, errors)) return;
  compareCanonical(contract.reviewCriteria.universal, REVIEW_CRITERIA_UNIVERSAL, `${label}.universal`, errors);
  const biomeSpecific = contract.reviewCriteria.biomeSpecific;
  if (!Array.isArray(biomeSpecific)) {
    errors.push(`${label}.biomeSpecific must be an array`);
    return;
  }
  biomeSpecific.forEach((entry, index) => {
    const entryLabel = `${label}.biomeSpecific[${index}]`;
    if (!exactKeys(entry, REVIEW_CRITERIA_CATEGORY_KEYS, entryLabel, errors)) return;
    if (!nonEmptyString(entry.category)) errors.push(`${entryLabel}.category must be a non-empty string`);
    if (!Array.isArray(entry.questions) || entry.questions.length === 0 || entry.questions.some((q) => !nonEmptyString(q))) {
      errors.push(`${entryLabel}.questions must be a non-empty array of non-empty strings`);
    }
  });
}

export function validateBuildContract(contract) {
  const errors = [];
  if (!isPlainObject(contract)) return { valid: false, errors: ['Build contract must be a plain object'] };
  if (!exactKeys(contract, CONTRACT_TOP_KEYS, 'build contract', errors)) return { valid: false, errors };
  if (contract.schemaVersion !== BUILD_CONTRACT_SCHEMA_VERSION) errors.push(`schemaVersion must be ${BUILD_CONTRACT_SCHEMA_VERSION}`);
  validateProject(contract.project, errors);
  validateSelectionContract(contract, errors);
  if (isPlainObject(contract.project) && isPlainObject(contract.selection) && contract.project.renderingProfile !== contract.selection.renderingProfile) {
    errors.push('project.renderingProfile must equal selection.renderingProfile');
  }
  validateStateChannels(contract, errors);
  validateTerrainElevation(contract, errors);
  validateCreative(contract, errors);
  compareCanonical(contract.acceptance, ACCEPTANCE_GATES, 'acceptance', errors);
  compareCanonical(contract.milestones, MILESTONE_DEFINITIONS, 'milestones', errors);
  compareCanonical(contract.sourceOfTruth, SOURCE_OF_TRUTH, 'sourceOfTruth', errors);
  const architectureCanonical = isPlainObject(contract.project) ? ARCHITECTURE_BY_PROFILE[contract.project.renderingProfile] : undefined;
  if (architectureCanonical) {
    compareCanonical(contract.architecture, architectureCanonical, 'architecture', errors);
  } else {
    errors.push('architecture cannot be validated without a valid project.renderingProfile');
  }
  const approvedPatternsCanonical = isPlainObject(contract.project) ? APPROVED_PATTERNS_BY_PROFILE[contract.project.renderingProfile] : undefined;
  if (approvedPatternsCanonical) {
    compareCanonical(contract.approvedPatterns, approvedPatternsCanonical, 'approvedPatterns', errors);
  } else {
    errors.push('approvedPatterns cannot be validated without a valid project.renderingProfile');
  }
  const forbiddenPatternsCanonical = isPlainObject(contract.project) ? FORBIDDEN_PATTERNS_BY_PROFILE[contract.project.renderingProfile] : undefined;
  if (forbiddenPatternsCanonical) {
    compareCanonical(contract.forbiddenPatterns, forbiddenPatternsCanonical, 'forbiddenPatterns', errors);
  } else {
    errors.push('forbiddenPatterns cannot be validated without a valid project.renderingProfile');
  }
  compareCanonical(contract.implementationPlan, IMPLEMENTATION_PLAN, 'implementationPlan', errors);
  if (Array.isArray(contract.implementationPlan)) {
    const expectedStageIds = IMPLEMENTATION_PLAN.map(({ id }) => id);
    const actualStageIds = contract.implementationPlan.map((stage) => (isPlainObject(stage) ? stage.id : undefined));
    if (JSON.stringify(actualStageIds) !== JSON.stringify(expectedStageIds)) errors.push(`implementationPlan must contain exactly these stage IDs in order: ${expectedStageIds.join(', ')}`);
    const expectedOrders = IMPLEMENTATION_PLAN.map(({ order }) => order);
    const actualOrders = contract.implementationPlan.map((stage) => (isPlainObject(stage) ? stage.order : undefined));
    if (JSON.stringify(actualOrders) !== JSON.stringify(expectedOrders)) errors.push(`implementationPlan stage order must be exactly: ${expectedOrders.join(', ')}`);
  }
  const diagnosticsCanonical = isPlainObject(contract.project) ? DIAGNOSTICS_CONTRACT_BY_PROFILE[contract.project.renderingProfile] : undefined;
  if (diagnosticsCanonical) {
    compareCanonical(contract.diagnostics, diagnosticsCanonical, 'diagnostics', errors);
  } else {
    errors.push('diagnostics cannot be validated without a valid project.renderingProfile');
  }
  validateReviewCriteria(contract, errors);
  scanForNonFiniteOrAbsolute(contract, 'contract', errors);
  return { valid: errors.length === 0, errors };
}

function validateEvidenceMilestone(milestone, index, errors) {
  const label = `milestones[${index}]`;
  if (!exactKeys(milestone, ['id', 'status', 'screenshots', 'console', 'performance', 'visualSelfReview'], label, errors)) return;
  if (!['first-runnable-scene', 'systems-complete', 'final-polish'].includes(milestone.id)) errors.push(`${label}.id is invalid`);
  if (![INCOMPLETE_VERIFICATION_STATUS, COMPLETE_STATUS].includes(milestone.status)) errors.push(`${label}.status is invalid`);
  if (!Array.isArray(milestone.screenshots) || milestone.screenshots.some((file) => !isSafeRelativePath(file))) errors.push(`${label}.screenshots must contain safe relative filenames`);
  if (exactKeys(milestone.console, ['errors', 'warnings'], `${label}.console`, errors)) {
    for (const field of ['errors', 'warnings']) if (!Array.isArray(milestone.console[field]) || milestone.console[field].some((value) => typeof value !== 'string')) errors.push(`${label}.console.${field} must be an array of strings`);
  }
  if (exactKeys(milestone.performance, ['fps', 'frameTimeMs'], `${label}.performance`, errors)) {
    for (const field of ['fps', 'frameTimeMs']) if (!(milestone.performance[field] === null || (typeof milestone.performance[field] === 'number' && Number.isFinite(milestone.performance[field]) && milestone.performance[field] >= 0))) errors.push(`${label}.performance.${field} must be a non-negative finite number or null`);
  }
  if (exactKeys(milestone.visualSelfReview, ['reviewed', 'weaknesses', 'corrections'], `${label}.visualSelfReview`, errors)) {
    if (typeof milestone.visualSelfReview.reviewed !== 'boolean') errors.push(`${label}.visualSelfReview.reviewed must be boolean`);
    for (const field of ['weaknesses', 'corrections']) if (!Array.isArray(milestone.visualSelfReview[field]) || milestone.visualSelfReview[field].some((value) => typeof value !== 'string')) errors.push(`${label}.visualSelfReview.${field} must be an array of strings`);
  }
  if (milestone.status === COMPLETE_STATUS) {
    const def = MILESTONE_DEFINITIONS.find((d) => d.id === milestone.id);
    if (!def) {
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
      const minCount = def.requiredScreenshotEvidence.minimumScreenshots;
      if (milestone.screenshots.length < minCount) {
        errors.push(`${label} requires at least ${minCount} screenshot(s) when complete`);
      }
      for (const pose of def.requiredScreenshotEvidence.requiredPoses) {
        const expectedFilename = POSE_FILENAME_MAP[pose];
        if (expectedFilename && !milestone.screenshots.includes(expectedFilename)) {
          errors.push(`${label} missing required pose screenshot '${expectedFilename}' for pose '${pose}'`);
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

export function validateMilestoneEvidence(evidence) {
  const errors = [];
  if (!isPlainObject(evidence)) return { valid: false, errors: ['Evidence record must be a plain object'] };
  if (!exactKeys(evidence, ['schemaVersion', 'briefSha256', 'status', 'milestones'], 'evidence', errors)) return { valid: false, errors };
  if (evidence.schemaVersion !== BUILD_CONTRACT_SCHEMA_VERSION) errors.push(`evidence.schemaVersion must be ${BUILD_CONTRACT_SCHEMA_VERSION}`);
  if (![INCOMPLETE_VERIFICATION_STATUS, COMPLETE_STATUS].includes(evidence.status)) errors.push(`evidence.status must be '${INCOMPLETE_VERIFICATION_STATUS}' or '${COMPLETE_STATUS}'`);
  if (!(evidence.briefSha256 === null || (typeof evidence.briefSha256 === 'string' && /^[0-9a-f]{64}$/.test(evidence.briefSha256)))) {
    errors.push('evidence.briefSha256 must be null or exactly 64 lowercase hexadecimal characters');
  }
  if (!Array.isArray(evidence.milestones)) {
    errors.push('evidence.milestones must be an array');
  } else {
    const expectedIds = MILESTONE_DEFINITIONS.map(({ id }) => id);
    const actualIds = evidence.milestones.map((milestone) => milestone?.id);
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) errors.push('evidence.milestones must contain the three milestone IDs in canonical order');
    const seen = new Set();
    evidence.milestones.forEach((milestone, index) => {
      if (seen.has(milestone?.id)) errors.push(`evidence.milestones contains duplicate ID '${milestone?.id}'`);
      seen.add(milestone?.id);
      validateEvidenceMilestone(milestone, index, errors);
    });
    const allComplete = evidence.milestones.length === MILESTONE_DEFINITIONS.length && evidence.milestones.every((milestone) => milestone.status === COMPLETE_STATUS);
    if (evidence.status === COMPLETE_STATUS && !allComplete) errors.push('evidence.status complete requires every milestone to be complete');
    if (evidence.status === INCOMPLETE_VERIFICATION_STATUS && allComplete) errors.push('evidence.status must be complete when every milestone is complete');
  }
  scanForNonFiniteOrAbsolute(evidence, 'evidence', errors);
  return { valid: errors.length === 0, errors };
}

/**
 * Cross-checks evidence.briefSha256 against contract.project.briefSha256.
 * Not yet wired into any pass/fail gate — that wiring lands in a later task.
 */
export function validateEvidenceContractBinding(contract, evidence, errors) {
  if (!isPlainObject(contract) || !isPlainObject(contract.project) || typeof contract.project.briefSha256 !== 'string') {
    errors.push('evidence-contract binding requires a valid contract.project.briefSha256');
    return;
  }
  if (!isPlainObject(evidence) || typeof evidence.briefSha256 !== 'string') {
    errors.push('evidence.briefSha256 must be a string to bind against the contract');
    return;
  }
  if (evidence.briefSha256 !== contract.project.briefSha256) {
    errors.push('evidence.briefSha256 does not match contract.project.briefSha256');
  }
}

export function renderContractSummary(contract) {
  const stateLines = contract.stateChannels.enabled
    ? Object.entries(contract.stateChannels.channels).map(([key, value]) => `${key}=${value.channel}/${value.visibleEffect}/${value.nativeMeaning}`).join('; ')
    : 'state-buffer omitted';
  return `## Envizzle Build Contract Summary

- **Build contract:** \`${BUILD_CONTRACT_FILENAME}\`
- **Project:** \`${contract.project.name}\` / \`${contract.project.briefFilename}\`
- **Rendering profile:** \`${contract.project.renderingProfile}\` / ${contract.project.engine} / ${contract.project.shaderLanguage} / ${contract.project.renderingParadigm}
- **Asset strategy:** ${contract.project.assetStrategyText}
- **Creative mode and path:** \`${contract.selection.creativeMode}\` / \`${contract.selection.path}\` / base showcase \`${contract.selection.baseShowcase ?? 'none'}\`
- **Selection:** ambition \`${contract.selection.ambition}\`; sections [${contract.selection.includedSections.join(', ')}]; omitted optional [${contract.selection.omittedOptionalSections.join(', ')}]; extra [${contract.selection.extraSections.join(', ')}]; biome \`${contract.selection.biome}\`; archetype \`${contract.selection.archetype}\`; mechanic \`${contract.selection.mechanic}\`; camera \`${contract.selection.camera}\`; camera adjustments [${contract.selection.cameraAdjustments.join(', ')}]; changed axes [${contract.selection.changedAxes.join(', ')}]
- **State channels:** ${stateLines}
- **Terrain elevation ownership:** Render terrain vertices enter the vertex shader at base height \`y = 0\`; the procedural elevation function is applied exactly once on the GPU. CPU height may be mirrored only for physics, camera clearance, and foot planting, with GPU parity readback.
- **Renderer/readiness proof:** ${JSON.stringify(contract.acceptance.renderer.expectedByProfile[contract.project.renderingProfile])}; lifecycle starts initializing and cannot become ready before compilation, validation, bindings, and one rendered frame.
- **Camera proof:** \`${contract.acceptance.camera.hook}\`; allowed methods ${contract.acceptance.camera.allowedMethods.join(', ')}; clipping threshold ${contract.acceptance.camera.clippingThresholdM} m.
- **Creative constraints:** spark ${JSON.stringify(contract.creative.creativeSpark)}; Signature Moment ${JSON.stringify(contract.creative.signatureMoment)}; novelty budget ${JSON.stringify(contract.creative.noveltyBudget)}
- **Acceptance gates:** ${JSON.stringify(contract.acceptance)}
- **Milestones:** ${contract.milestones.map(({ id }) => id).join(', ')}; missing required evidence is recorded as \`${INCOMPLETE_VERIFICATION_STATUS}\`.
`;
}

export function renderMilestoneInstructions(contract) {
  const lines = [
    '## Implementation Milestones and Visual Self-Review',
    '',
    `Work through the three milestones in order. Preserve screenshots, console findings, performance values, visible weaknesses, and corrective actions in \`${EVIDENCE_FILENAME}\`. Missing screenshot capability or missing required evidence must be recorded exactly as **${INCOMPLETE_VERIFICATION_STATUS}** and must never be converted into a pass. The verifier overwrites canonical current-run screenshots before checking evidence existence.`,
    '',
  ];
  for (const [index, milestone] of contract.milestones.entries()) {
    lines.push(`### ${index + 1}. ${milestone.title} (\`${milestone.id}\`)`, '');
    lines.push(`- **Required checks:** ${milestone.requiredChecks.join('; ')}.`);
    lines.push(`- **Screenshot evidence:** capture at least ${milestone.requiredScreenshotEvidence.minimumScreenshots} screenshot(s); required poses: ${milestone.requiredScreenshotEvidence.requiredPoses.join(', ')}.`);
    lines.push(`- **Console evidence:** record console findings; blocking errors allowed: ${milestone.requiredConsoleEvidence.blockingErrors}.`);
    lines.push(`- **Performance evidence:** record ${milestone.requiredPerformanceEvidence.fields.join(' and ')}.`);
    lines.push(`- **Visual self-review:** inspect each required screenshot, set reviewed, record visible weaknesses, and record the corrections made.`);
    lines.push(`- **Completion:** use \`${milestone.completion.completeStatus}\` only after every check and evidence requirement is satisfied; otherwise use \`${milestone.completion.incompleteStatus}\`.`);
    lines.push('');
  }
  return lines.join('\n');
}

export const PRODUCT_PRINCIPLE_SENTENCE = 'The builder implements an already-designed system. It may make bounded implementation decisions inside each approved stage, but it may not redesign the renderer, terrain ownership, shader integration, fallback strategy, module responsibilities, readiness lifecycle, verification interfaces, or stage order.';

export const TERRAIN_ELEVATION_OWNERSHIP_MEANING_TEXT = 'Render terrain vertices must enter the terrain vertex shader at base height y = 0. Apply procedural elevation exactly once, on the GPU. The CPU may mirror the same height function only for physics, camera clearance, and foot planting. CPU-built render vertices must not be pre-displaced.';

export const HANDOFF_STAGE_WORKFLOW_TEXT = "Read the entire bundle. Implement one stage only. Run that stage's automated checks. Capture required evidence. Inspect the screenshot. Correct visible weaknesses. Stop and report the result. Do not start the next stage until the current stage passes.";

const BABYLON_PATTERNS_DOC_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'references', 'babylon-webgpu-patterns.md');
const BABYLON_PATTERN_EXAMPLE_HEADING = '## Positive Pattern Example: Minimal WGSL ShaderMaterial';

let cachedBabylonPatternExample = null;

// Deliberately simple: locate the stable marker heading and grab the single fenced ```js
// block underneath it, verbatim. Not a general Markdown parser by design (Task 4 brief).
function extractBabylonPatternExample() {
  if (cachedBabylonPatternExample !== null) return cachedBabylonPatternExample;
  const docText = fs.readFileSync(BABYLON_PATTERNS_DOC_PATH, 'utf8');
  const headingIndex = docText.indexOf(BABYLON_PATTERN_EXAMPLE_HEADING);
  if (headingIndex === -1) {
    throw new Error(`renderBabylonPatternGuidance: could not find heading "${BABYLON_PATTERN_EXAMPLE_HEADING}" in references/babylon-webgpu-patterns.md`);
  }
  const afterHeading = docText.slice(headingIndex + BABYLON_PATTERN_EXAMPLE_HEADING.length);
  const fenceMatch = afterHeading.match(/```js\r?\n([\s\S]*?)```/);
  if (!fenceMatch) {
    throw new Error(`renderBabylonPatternGuidance: could not find a fenced js code example under "${BABYLON_PATTERN_EXAMPLE_HEADING}"`);
  }
  cachedBabylonPatternExample = fenceMatch[1].replace(/\r\n/g, '\n').trimEnd();
  return cachedBabylonPatternExample;
}

// The 5-entry IMPLEMENTATION_PLAN's forbiddenPatternIds only list the universal (profile-shared)
// IDs — a stage doesn't know which forbidden patterns are profile-specific. Compute that here by
// intersecting FORBIDDEN_PATTERNS_BY_PROFILE across all profiles: anything present in every
// profile's list is universal; everything else is profile-specific.
function universalForbiddenPatternIds() {
  const profileIdSets = Object.values(FORBIDDEN_PATTERNS_BY_PROFILE).map((list) => new Set(list.map((pattern) => pattern.id)));
  const [first, ...rest] = profileIdSets;
  if (!first) return [];
  return [...first].filter((id) => rest.every((set) => set.has(id)));
}

function profileSpecificForbiddenPatterns(contract) {
  const universal = new Set(universalForbiddenPatternIds());
  return contract.forbiddenPatterns.filter((pattern) => !universal.has(pattern.id));
}

function forbiddenPatternsById(contract) {
  const byId = new Map();
  for (const pattern of contract.forbiddenPatterns) byId.set(pattern.id, pattern);
  return byId;
}

// Resolves the full forbidden-pattern objects relevant to one implementation stage. For
// backend-proof specifically, this also surfaces every profile-specific forbidden pattern
// (e.g. wrong-babylon-shader-language, manual-babylon-bindings, wrong-babylon-shader-store for
// babylon-webgpu) even though IMPLEMENTATION_PLAN's own forbiddenPatternIds only lists the
// universal IDs — backend-proof is where engine/shader-language/binding choices get proven, so
// a builder reading that stage's rendered instructions needs to see the profile-specific
// violations too, not just the profile-neutral universal list.
function stageForbiddenPatterns(contract, stage) {
  const byId = forbiddenPatternsById(contract);
  const declared = stage.forbiddenPatternIds.map((id) => byId.get(id)).filter(Boolean);
  if (stage.id !== 'backend-proof') return declared;
  const declaredIds = new Set(stage.forbiddenPatternIds);
  const profileSpecific = profileSpecificForbiddenPatterns(contract).filter((pattern) => !declaredIds.has(pattern.id));
  return [...declared, ...profileSpecific];
}

export function renderProductPrinciple(contract) {
  const sot = contract.sourceOfTruth;
  return `## Product Principle

${PRODUCT_PRINCIPLE_SENTENCE}

The builder works one stage at a time and must not continue after a failed checkpoint.

- **Builder role:** \`${sot.builderRole}\`
- **May redesign architecture:** ${sot.builderMayRedesignArchitecture}
- **May add fallbacks:** ${sot.builderMayAddFallbacks}
- **May skip stages:** ${sot.builderMaySkipStages}
- **May ignore failed checks:** ${sot.builderMayIgnoreFailedChecks}
- **Conflict policy:** \`${sot.conflictPolicy}\` — stop and report instead of resolving the conflict independently.
- **Required inputs:** ${sot.requiredInputs.map((input) => `\`${input}\``).join(', ')}
`;
}

export function renderArchitectureOwnership(contract) {
  const arch = contract.architecture;
  const lines = [
    '## Architecture Ownership',
    '',
    `Rendering profile: \`${contract.project.renderingProfile}\`. ${arch.deviationPolicy}`,
    '',
    '### File Ownership',
    '',
  ];
  for (const entry of arch.fileOwnership) {
    lines.push(`- \`${entry.path}\` — ${entry.responsibility}`);
  }
  lines.push('', '### Terrain Elevation Ownership', '', TERRAIN_ELEVATION_OWNERSHIP_MEANING_TEXT, '');
  const teo = arch.terrainElevationOwnership;
  lines.push(`- **Render owner:** \`${teo.renderOwner}\`; render mesh base height: ${teo.renderMeshBaseHeight}`);
  lines.push(`- **CPU height purpose:** ${teo.cpuHeightPurpose.join(', ')}`);
  lines.push(`- **Forbid CPU pre-displaced render vertices:** ${teo.forbidCpuPredisplacedRenderVertices}`);
  lines.push(`- **Require CPU/GPU parity test:** ${teo.requireCpuGpuParityTest}; tolerance ${teo.parityToleranceM} m`);
  lines.push('');
  return lines.join('\n');
}

export function renderImplementationStages(contract) {
  const lines = [
    '## Implementation Stages',
    '',
    'Implement these five stages strictly in order. Each stage has a required goal, an allowed scope, required outputs, approved and forbidden patterns, automated and visual checks, stop conditions, and required evidence. Do not proceed to the next stage until the current stage has passed every automated check, every visual check, and every stop condition.',
    '',
  ];
  for (const stage of contract.implementationPlan) {
    lines.push(`### ${stage.order}. ${stage.id}`, '');
    lines.push(`- **Goal:** ${stage.goal}`);
    lines.push(`- **Allowed scope:** ${stage.allowedScope.join('; ')}.`);
    lines.push(`- **Required outputs:** ${stage.requiredOutputs.join('; ')}.`);
    lines.push(`- **Approved patterns:** ${stage.approvedPatternIds.length > 0 ? stage.approvedPatternIds.join(', ') : 'none beyond the profile defaults'}.`);
    const stagePatterns = stageForbiddenPatterns(contract, stage);
    lines.push(`- **Forbidden patterns:** ${stagePatterns.map((pattern) => `\`${pattern.id}\` (${pattern.reason})`).join(' ')}`);
    lines.push(`- **Automated checks:** ${stage.automatedChecks.join('; ')}.`);
    lines.push(`- **Visual checks:** ${stage.visualChecks.join('; ')}.`);
    lines.push(`- **Stop conditions:** ${stage.stopConditions.join('; ')}.`);
    lines.push(`- **Required evidence:** ${stage.requiredEvidence.join('; ')}.`);
    lines.push(`- **Do not proceed until passed:** ${stage.doNotProceedUntilPassed}.`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderBabylonPatternGuidance(contract) {
  const lines = [
    '## Rendering-Profile Pattern Guidance',
    '',
    `Rendering profile: \`${contract.project.renderingProfile}\`. These approved and forbidden patterns are canonical for this profile; do not redesign around them.`,
    '',
    '### Approved Patterns',
    '',
  ];
  for (const pattern of contract.approvedPatterns) {
    lines.push(`- \`${pattern.id}\` (${pattern.detection}): ${pattern.requirement}`);
  }
  lines.push('', '### Forbidden Patterns', '');
  for (const pattern of contract.forbiddenPatterns) {
    lines.push(`- \`${pattern.id}\` (${pattern.detection}): ${pattern.reason}`);
  }
  if (contract.project.renderingProfile === 'babylon-webgpu') {
    lines.push(
      '',
      '### Positive Pattern Example: Minimal WGSL ShaderMaterial',
      '',
      'Canonical worked example from the bundled rendering-profile pattern reference — a ShaderMaterial configured for WGSL, registered on `ShaderStore.ShadersStoreWGSL`, with no manual `@group`/`@binding` anywhere; Babylon owns the generated binding layout:',
      '',
      '```js',
      extractBabylonPatternExample(),
      '```',
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function renderForbiddenPatterns(contract) {
  const lines = [
    '## Forbidden Patterns',
    '',
    `The following patterns are forbidden for the \`${contract.project.renderingProfile}\` rendering profile. Every entry is blocking unless noted otherwise.`,
    '',
  ];
  for (const pattern of contract.forbiddenPatterns) {
    lines.push(`- \`${pattern.id}\` — ${pattern.reason} (detection: ${pattern.detection}; blocking: ${pattern.blocking}).`);
  }
  lines.push('', '### Forbidden Patterns by Implementation Stage', '');
  for (const stage of contract.implementationPlan) {
    const stagePatterns = stageForbiddenPatterns(contract, stage);
    lines.push(`- **${stage.id}:** ${stagePatterns.length > 0 ? stagePatterns.map((pattern) => `\`${pattern.id}\``).join(', ') : 'none'}.`);
  }
  lines.push('');
  return lines.join('\n');
}

export function renderReviewCriteria(contract) {
  const rc = contract.reviewCriteria;
  const lines = [
    '## Review Criteria',
    '',
    'Independent visual review evaluates the captured evidence against these categories. This is the check applied after implementation, not the builder self-report.',
    '',
    '### Universal',
    '',
  ];
  for (const entry of rc.universal) {
    lines.push(`- **${entry.category}:** ${entry.questions.join(' ')}`);
  }
  if (rc.biomeSpecific.length > 0) {
    lines.push('', '### Biome-Specific', '');
    for (const entry of rc.biomeSpecific) {
      lines.push(`- **${entry.category}:** ${entry.questions.join(' ')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function renderHandoff({ fileName, builderAgent, contract }) {
  const builderAgentLabel = builderAgent || 'the coding agent named by the user';
  return `# Handoff

- **Complete bundle:** consume the entire generated bundle: \`${fileName}\`, \`${BUILD_CONTRACT_FILENAME}\`, \`${EVIDENCE_FILENAME}\`, \`${HANDOFF_FILENAME}\`, and \`verify/\`.
- **Brief:** \`${fileName}\` — consume this brief together with the build contract, the evidence record, this handoff, and the verifier; no single file stands alone.
- **Build contract:** \`${BUILD_CONTRACT_FILENAME}\` — machine-readable contract generated from the same validated assembly result as the brief.
- **Evidence record:** \`${EVIDENCE_FILENAME}\` — preserve milestone screenshots, console findings, performance values, weaknesses, and corrections here.
- **Verifier:** \`verify/\` — run it after each stage; it is part of the required bundle, not an optional extra.
- **Agent:** ${builderAgentLabel}
- **Coding-agent workflow:** consume the entire bundle; build the first terrain frame; run verification immediately; inspect and correct the idle screenshot; continue to systems-complete; run verification again; complete final polish; populate all evidence fields; run final verification; never claim completion while any failure or incomplete-verification reason remains.
- **Workflow:** ${HANDOFF_STAGE_WORKFLOW_TEXT}
- **Milestone workflow:** complete \`first-runnable-scene\`, then \`systems-complete\`, then \`final-polish\`; inspect screenshots and correct visible weaknesses at every milestone.
- **Incomplete verification:** missing screenshot capability or required evidence must be recorded exactly as \`${INCOMPLETE_VERIFICATION_STATUS}\`; it is never a pass.
- **When the agent says it is done:** \`npm install -D playwright pngjs && node verify/verify_demo.mjs .\`
- **On failure:** the verifier lists each problem. Hand the list back to the agent and have it fix and re-run. Do not accept the demo with failures outstanding.
- **Frame times are reported, not gated** — a slow demo is a decision for you, not a build failure.
- **Engine version pinning:** When installing the engine during a generated project build, pin the exact resolved engine version in \`package.json\` and the lockfile, record that version in \`DECISIONS.md\`, and avoid floating CDN imports.
- **Mode decisions:** Record in \`DECISIONS.md\`: creative mode, base showcase or custom path, creative spark or surprise me, final Signature Moment, existing system reused by Signature Moment, any Experimental changed axis, compatibility checks performed, and permitted implementation deviations.
`;
}

// `checkStagedSections` remains opt-in (default false) so synthetic or partial callers can choose whether to enforce every staged section. The production assembler passes `true` after appending all render*() output, keeping the canonical brief/contract drift check load-bearing.
export function validateAssemblyArtifacts({ model, contract, brief, checkStagedSections = false }) {
  const errors = [];
  if (typeof brief !== 'string') {
    errors.push('brief must be a string');
    return { valid: false, errors };
  }

  const computedHash = crypto.createHash('sha256').update(brief, 'utf8').digest('hex');

  if (!isPlainObject(contract) || !isPlainObject(contract.project) || contract.project.briefSha256 !== computedHash) {
    errors.push(`contract briefSha256 (${contract?.project?.briefSha256}) does not match computed brief hash (${computedHash})`);
  }

  const expectedModel = clone(model);
  if (isPlainObject(expectedModel) && isPlainObject(expectedModel.project)) {
    expectedModel.project.briefSha256 = computedHash;
  }
  const expectedContract = createBuildContract(expectedModel);

  const contractValidation = validateBuildContract(contract);
  errors.push(...contractValidation.errors.map((error) => `contract: ${error}`));

  if (JSON.stringify(contract) !== JSON.stringify(expectedContract)) {
    errors.push('contract does not match the canonical validated assembly model');
  }

  if (!brief.includes(renderContractSummary(contract))) {
    errors.push('brief does not contain the canonical build-contract summary');
  }
  if (!brief.includes(renderMilestoneInstructions(contract))) {
    errors.push('brief does not contain the canonical milestone instructions');
  }
  if (checkStagedSections) {
    if (!brief.includes(renderProductPrinciple(contract))) {
      errors.push('brief does not contain the canonical product principle');
    }
    if (!brief.includes(renderArchitectureOwnership(contract))) {
      errors.push('brief does not contain the canonical architecture ownership section');
    }
    if (!brief.includes(renderImplementationStages(contract))) {
      errors.push('brief does not contain the canonical implementation stage instructions');
    }
    if (!brief.includes(renderBabylonPatternGuidance(contract))) {
      errors.push('brief does not contain the canonical rendering-profile pattern guidance');
    }
    if (!brief.includes(renderForbiddenPatterns(contract))) {
      errors.push('brief does not contain the canonical forbidden pattern list');
    }
    if (!brief.includes(renderReviewCriteria(contract))) {
      errors.push('brief does not contain the canonical review criteria');
    }
  }

  return { valid: errors.length === 0, errors };
}

export const BUILD_CONTRACT_ACCEPTANCE = ACCEPTANCE_GATES;
export const BUILD_CONTRACT_MILESTONES = MILESTONE_DEFINITIONS;
export const BUILD_CONTRACT_SOURCE_OF_TRUTH = SOURCE_OF_TRUTH;
export const BUILD_CONTRACT_IMPLEMENTATION_PLAN = IMPLEMENTATION_PLAN;
export const BUILD_CONTRACT_ARCHITECTURE = ARCHITECTURE_BY_PROFILE;
export const BUILD_CONTRACT_APPROVED_PATTERNS = APPROVED_PATTERNS_BY_PROFILE;
export const BUILD_CONTRACT_FORBIDDEN_PATTERNS = FORBIDDEN_PATTERNS_BY_PROFILE;
export const BUILD_CONTRACT_DIAGNOSTICS = DIAGNOSTICS_CONTRACT_BY_PROFILE;
export const BUILD_CONTRACT_REVIEW_CRITERIA_UNIVERSAL = REVIEW_CRITERIA_UNIVERSAL;
