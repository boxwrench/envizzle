import crypto from 'node:crypto';
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

export const BUILD_CONTRACT_SCHEMA_VERSION = 1;
export const BUILD_CONTRACT_FILENAME = 'ENVIZZLE_BUILD.json';
export const EVIDENCE_FILENAME = 'ENVIZZLE_EVIDENCE.json';
export const HANDOFF_FILENAME = 'HANDOFF.md';
export const ZERO_ASSET_STRATEGY_TEXT = '100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)';
export const INCOMPLETE_VERIFICATION_STATUS = 'incomplete verification';
export const COMPLETE_STATUS = 'complete';

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
    readiness: 'window.__demo is available and hookReady is true.',
    requiredHooks: Object.freeze(['setPose', 'setCharacterVisible', 'cameraNearestDepth', 'frameStats']),
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
    hook: 'window.__demo.cameraNearestDepth()',
    requirement: 'The camera hook returns a finite non-negative nearest-scene depth.',
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

const CONTRACT_TOP_KEYS = ['schemaVersion', 'project', 'selection', 'stateChannels', 'creative', 'acceptance', 'milestones'];
const PROJECT_KEYS = ['name', 'briefFilename', 'briefSha256', 'renderingProfile', 'engine', 'shaderLanguage', 'shaderLanguageExtension', 'materialApi', 'renderingParadigm', 'assetStrategy', 'assetStrategyText', 'targetHardware', 'coreInteractionSentence'];
const SELECTION_KEYS = ['creativeMode', 'path', 'baseShowcase', 'ambition', 'includedSections', 'omittedOptionalSections', 'extraSections', 'biome', 'archetype', 'mechanic', 'camera', 'renderingProfile', 'cameraAdjustments', 'changedAxes'];
const STATE_CHANNEL_KEYS = ['enabled', 'omittedBehavior', 'channels'];
const STATE_ENTRY_KEYS = ['channel', 'nativeMeaning', 'owningSystem', 'writers', 'readers', 'visibleEffect', 'baselineOrReset'];
const BASELINE_KEYS = ['baseline', 'recoveryMechanism', 'recoveryOutcome'];
const CREATIVE_KEYS = ['creativeSpark', 'signatureMoment', 'noveltyBudget', 'coherenceOverrides'];
const SIGNATURE_KEYS = ['enabled', 'text', 'reusedSystem', 'verificationPose', 'instruction'];
const ACCEPTANCE_KEYS = ['requiredProjectPaths', 'productionBuild', 'verificationHook', 'runtime', 'captures', 'imageGates', 'camera', 'report'];
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
  };
}

export function createBuildContract(model) {
  return {
    schemaVersion: BUILD_CONTRACT_SCHEMA_VERSION,
    ...clone(model),
  };
}

export function createEvidenceTemplate() {
  return {
    schemaVersion: BUILD_CONTRACT_SCHEMA_VERSION,
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
  validateCreative(contract, errors);
  compareCanonical(contract.acceptance, ACCEPTANCE_GATES, 'acceptance', errors);
  compareCanonical(contract.milestones, MILESTONE_DEFINITIONS, 'milestones', errors);
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
  if (!exactKeys(evidence, ['schemaVersion', 'status', 'milestones'], 'evidence', errors)) return { valid: false, errors };
  if (evidence.schemaVersion !== BUILD_CONTRACT_SCHEMA_VERSION) errors.push(`evidence.schemaVersion must be ${BUILD_CONTRACT_SCHEMA_VERSION}`);
  if (![INCOMPLETE_VERIFICATION_STATUS, COMPLETE_STATUS].includes(evidence.status)) errors.push(`evidence.status must be '${INCOMPLETE_VERIFICATION_STATUS}' or '${COMPLETE_STATUS}'`);
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
- **Creative constraints:** spark ${JSON.stringify(contract.creative.creativeSpark)}; Signature Moment ${JSON.stringify(contract.creative.signatureMoment)}; novelty budget ${JSON.stringify(contract.creative.noveltyBudget)}
- **Acceptance gates:** ${JSON.stringify(contract.acceptance)}
- **Milestones:** ${contract.milestones.map(({ id }) => id).join(', ')}; missing required evidence is recorded as \`${INCOMPLETE_VERIFICATION_STATUS}\`.
`;
}

export function renderMilestoneInstructions(contract) {
  const lines = [
    '## Implementation Milestones and Visual Self-Review',
    '',
    `Work through the three milestones in order. Preserve screenshots, console findings, performance values, visible weaknesses, and corrective actions in \`${EVIDENCE_FILENAME}\`. Missing screenshot capability or missing required evidence must be recorded exactly as **${INCOMPLETE_VERIFICATION_STATUS}** and must never be converted into a pass.`,
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

export function renderHandoff({ fileName, builderAgent, contract }) {
  const builderAgentLabel = builderAgent || 'the coding agent named by the user';
  return `# Handoff

- **Brief:** \`${fileName}\` — give this file to the coding agent, whole. It needs nothing else.
- **Build contract:** \`${BUILD_CONTRACT_FILENAME}\` — machine-readable contract generated from the same validated assembly result as the brief.
- **Evidence record:** \`${EVIDENCE_FILENAME}\` — preserve milestone screenshots, console findings, performance values, weaknesses, and corrections here.
- **Agent:** ${builderAgentLabel}
- **Milestone workflow:** complete \`first-runnable-scene\`, then \`systems-complete\`, then \`final-polish\`; inspect screenshots and correct visible weaknesses at every milestone.
- **Incomplete verification:** missing screenshot capability or required evidence must be recorded exactly as \`${INCOMPLETE_VERIFICATION_STATUS}\`; it is never a pass.
- **When the agent says it is done:** \`npm install -D playwright pngjs && node verify/verify_demo.mjs .\`
- **On failure:** the verifier lists each problem. Hand the list back to the agent and have it fix and re-run. Do not accept the demo with failures outstanding.
- **Frame times are reported, not gated** — a slow demo is a decision for you, not a build failure.
- **Engine version pinning:** When installing the engine during a generated project build, pin the exact resolved engine version in \`package.json\` and the lockfile, record that version in \`DECISIONS.md\`, and avoid floating CDN imports.
- **Mode decisions:** Record in \`DECISIONS.md\`: creative mode, base showcase or custom path, creative spark or surprise me, final Signature Moment, existing system reused by Signature Moment, any Experimental changed axis, compatibility checks performed, and permitted implementation deviations.
`;
}

export function validateAssemblyArtifacts({ model, contract, brief }) {
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

  return { valid: errors.length === 0, errors };
}

export const BUILD_CONTRACT_ACCEPTANCE = ACCEPTANCE_GATES;
export const BUILD_CONTRACT_MILESTONES = MILESTONE_DEFINITIONS;
