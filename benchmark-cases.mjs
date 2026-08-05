import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOWCASES, CORE_SECTIONS, validateSelection, normalizeProvenSignatureMoment } from './selection.mjs';
import { validateAssemblySpec } from './assemble.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname);

export const VALID_SUITES = Object.freeze(['smoke', 'full']);

const casesJsonPath = path.join(repoRoot, 'benchmarks', 'cases.json');
const rawCasesData = JSON.parse(fs.readFileSync(casesJsonPath, 'utf8'));

const SAFE_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

const VALID_AXES = Object.freeze(['biome', 'archetype', 'mechanic', 'camera', 'renderingProfile', 'ambition']);
const VALID_CAMERAS = Object.freeze(['Third Person', 'Cinematic', 'First Person', 'XR']);
const VALID_POSES = Object.freeze(['idle', 'locomotion', 'mechanic']);

export function validateCaseDefinition(c) {
  const errors = [];
  if (!c || typeof c !== 'object' || Array.isArray(c)) {
    return { valid: false, errors: ['Case definition must be a plain object'] };
  }

  const allowedKeys = new Set([
    'id',
    'title',
    'suites',
    'baseShowcase',
    'creativeMode',
    'path',
    'changedAxes',
    'creativeSpark',
    'signatureMoment',
    'camera',
    'cameraAdjustments',
    'coverageNotes',
  ]);

  for (const k of Object.keys(c)) {
    if (!allowedKeys.has(k)) {
      errors.push(`Unknown case field '${k}'`);
    }
  }

  if (typeof c.id !== 'string' || !SAFE_SLUG_REGEX.test(c.id) || c.id.includes('.') || c.id.includes('/') || c.id.includes('\\')) {
    errors.push(`Case id '${c.id}' must be a safe lowercase slug without path separators, dots, or control characters`);
  }

  if (typeof c.title !== 'string' || c.title.trim() === '' || /[\r\n]/.test(c.title)) {
    errors.push('Case title must be a non-empty single-line string');
  }

  if (!Array.isArray(c.suites) || c.suites.length === 0) {
    errors.push('Case suites must be a non-empty array');
  } else {
    const suiteSet = new Set();
    for (const s of c.suites) {
      if (!VALID_SUITES.includes(s)) {
        errors.push(`Invalid suite reference '${s}'`);
      }
      if (suiteSet.has(s)) {
        errors.push(`Duplicate suite reference '${s}'`);
      }
      suiteSet.add(s);
    }
  }

  if (typeof c.baseShowcase !== 'string' || !(c.baseShowcase in SHOWCASES)) {
    errors.push(`Nonexistent showcase '${c.baseShowcase}'`);
  }

  if (!['proven', 'signature', 'experimental'].includes(c.creativeMode)) {
    errors.push(`Invalid creativeMode '${c.creativeMode}'`);
  }

  if (!['showcase', 'base-showcase', 'fully-custom'].includes(c.path)) {
    errors.push(`Invalid path '${c.path}'`);
  }

  // Mode & path combinations
  if (c.creativeMode === 'proven') {
    if (c.path !== 'showcase') errors.push('Proven mode path must be "showcase"');
    if (c.creativeSpark !== null && c.creativeSpark !== undefined) errors.push('Proven mode must not have creativeSpark');
  } else if (c.creativeMode === 'signature') {
    if (c.path !== 'showcase') errors.push('Signature mode path must be "showcase"');
    if (typeof c.creativeSpark !== 'string' || c.creativeSpark.trim() === '') errors.push('Signature mode requires non-empty creativeSpark');
  } else if (c.creativeMode === 'experimental') {
    if (c.path !== 'base-showcase' && c.path !== 'fully-custom') errors.push('Experimental mode path must be "base-showcase" or "fully-custom"');
    if (typeof c.creativeSpark !== 'string' || c.creativeSpark.trim() === '') errors.push('Experimental mode requires non-empty creativeSpark');
  }

  if (c.changedAxes !== undefined && c.changedAxes !== null) {
    if (!Array.isArray(c.changedAxes)) {
      errors.push('changedAxes must be an array');
    } else {
      const seen = new Set();
      for (const a of c.changedAxes) {
        if (!VALID_AXES.includes(a)) errors.push(`Invalid changedAxis '${a}'`);
        if (seen.has(a)) errors.push(`Duplicate changedAxis '${a}'`);
        seen.add(a);
      }
    }
  }

  if (c.camera !== undefined && c.camera !== null) {
    if (!VALID_CAMERAS.includes(c.camera)) {
      errors.push(`Invalid camera '${c.camera}'`);
    }
  }

  if (c.cameraAdjustments !== undefined && c.cameraAdjustments !== null) {
    if (!Array.isArray(c.cameraAdjustments)) {
      errors.push('cameraAdjustments must be an array');
    } else {
      const seen = new Set();
      for (const ca of c.cameraAdjustments) {
        if (typeof ca !== 'string' || ca.trim() === '') errors.push('cameraAdjustment must be a non-empty string');
        if (seen.has(ca)) errors.push(`Duplicate cameraAdjustment '${ca}'`);
        seen.add(ca);
      }
    }
  }

  if (c.signatureMoment !== undefined && c.signatureMoment !== null) {
    if (typeof c.signatureMoment !== 'object' || Array.isArray(c.signatureMoment)) {
      errors.push('signatureMoment must be an object');
    } else {
      const sigKeys = new Set(['enabled', 'text', 'reusedSystem', 'verificationPose']);
      for (const k of Object.keys(c.signatureMoment)) {
        if (!sigKeys.has(k)) errors.push(`Unknown field '${k}' in signatureMoment`);
      }
      for (const k of sigKeys) {
        if (!(k in c.signatureMoment)) errors.push(`Missing required field '${k}' in signatureMoment`);
      }
      if (typeof c.signatureMoment.enabled !== 'boolean') errors.push('signatureMoment.enabled must be boolean');
      if (typeof c.signatureMoment.text !== 'string') errors.push('signatureMoment.text must be string');
      if (typeof c.signatureMoment.reusedSystem !== 'string') errors.push('signatureMoment.reusedSystem must be string');
      if (!VALID_POSES.includes(c.signatureMoment.verificationPose)) errors.push(`signatureMoment.verificationPose must be one of: ${VALID_POSES.join(', ')}`);

      if (c.creativeMode === 'proven' && c.signatureMoment.enabled !== false) {
        errors.push('Proven mode signatureMoment.enabled must be false');
      }
    }
  }

  if (typeof c.coverageNotes !== 'string' || c.coverageNotes.trim() === '') {
    errors.push('coverageNotes must be a non-empty string');
  }

  return { valid: errors.length === 0, errors };
}

export function validateCasesRegistry(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Registry root must be a plain object'] };
  }

  const rootKeys = new Set(['schemaVersion', 'cases']);
  for (const k of Object.keys(data)) {
    if (!rootKeys.has(k)) {
      errors.push(`Unknown root key '${k}'`);
    }
  }

  if (data.schemaVersion !== 1) {
    errors.push(`schemaVersion must be 1, got ${JSON.stringify(data.schemaVersion)}`);
  }

  if (!Array.isArray(data.cases)) {
    errors.push('cases must be an array');
  } else {
    const idSet = new Set();
    for (let i = 0; i < data.cases.length; i++) {
      const caseDef = data.cases[i];
      const val = validateCaseDefinition(caseDef);
      if (!val.valid) {
        errors.push(`Case [${i}] (${caseDef?.id || 'unknown'}): ${val.errors.join('; ')}`);
      }
      if (caseDef?.id) {
        if (idSet.has(caseDef.id)) {
          errors.push(`Duplicate case ID '${caseDef.id}' in registry`);
        }
        idSet.add(caseDef.id);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Validate registry on load
const valRoot = validateCasesRegistry(rawCasesData);
if (!valRoot.valid) {
  throw new Error(`Invalid cases.json registry: ${valRoot.errors.join('; ')}`);
}

export const BENCHMARK_CASES = deepFreeze(rawCasesData.cases);

export function getBenchmarkCase(caseId) {
  const found = BENCHMARK_CASES.find((c) => c.id === caseId);
  if (!found) {
    throw new Error(`Benchmark case '${caseId}' not found in registry`);
  }
  return found;
}

export function getBenchmarkCasesForSuite(suiteName) {
  if (!VALID_SUITES.includes(suiteName)) {
    throw new Error(`Invalid benchmark suite '${suiteName}'. Expected one of: ${VALID_SUITES.join(', ')}`);
  }
  return BENCHMARK_CASES.filter((c) => c.suites.includes(suiteName));
}

const extraSectionBodies = {
  weather: 'Dynamic atmospheric weather effects composited into rendering pipeline.',
  'water-bodies': 'Procedural water surface mesh with dynamic wave equations.',
  architecture: 'Parametric architectural structures integrated into the scene grid.',
  destructibility: 'Physical surface impacts triggering dynamic mesh fracture particles.',
};

export function buildCaseAssemblySpec(caseId) {
  const caseDef = getBenchmarkCase(caseId);
  const baseShowcase = SHOWCASES[caseDef.baseShowcase];
  if (!baseShowcase) {
    throw new Error(`Base showcase '${caseDef.baseShowcase}' not found for case '${caseId}'`);
  }

  const projNameSuffix = caseDef.id.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  const projectName = `BENCH-${projNameSuffix}`;

  const selection = {
    creativeMode: caseDef.creativeMode,
    path: caseDef.path,
    baseShowcase: caseDef.baseShowcase,
    changedAxes: caseDef.changedAxes || [],
    ambition: baseShowcase.ambition,
    biome: baseShowcase.biome,
    archetype: baseShowcase.archetype,
    mechanic: baseShowcase.mechanic,
    camera: caseDef.camera || baseShowcase.camera,
    renderingProfile: baseShowcase.renderingProfile,
    includedSections: baseShowcase.includedSections,
    extraSections: baseShowcase.extraSections,
    cameraAdjustments: caseDef.cameraAdjustments || baseShowcase.cameraAdjustments || [],
    stateChannelContract: baseShowcase.stateChannelContract,
    signatureMoment: caseDef.signatureMoment || {
      enabled: caseDef.creativeMode !== 'proven',
      text: caseDef.creativeMode === 'proven' ? '' : `Signature moment for ${caseDef.baseShowcase}`,
      reusedSystem: 'particles',
      verificationPose: 'mechanic',
    },
    noveltyBudget: {
      addsEngine: false,
      addsAssetCategory: false,
      addsPersistentBuffer: false,
      addsMajorRenderPass: false,
      addsSimulationSubsystem: false,
      addsInput: false,
      increasesAmbition: false,
    },
  };

  if (caseDef.creativeMode === 'proven') {
    selection.signatureMoment = normalizeProvenSignatureMoment();
  }

  const selConflicts = validateSelection(selection);
  const selErrors = selConflicts.filter((c) => c.severity === 'error');
  if (selErrors.length > 0) {
    throw new Error(`Derived selection for case '${caseId}' failed validateSelection: ${selErrors.map((e) => e.message).join('; ')}`);
  }

  const coreSentence = baseShowcase.coreInteractionSentence || 'interact with procedural environment elements';

  const extraSectionMarkdown = {};
  for (const s of baseShowcase.extraSections || []) {
    extraSectionMarkdown[s] = extraSectionBodies[s] || `Custom procedural ${s} section.`;
  }

  const spec = {
    selection,
    projectName,
    coreInteractionSentence: coreSentence,
    creativeSpark: caseDef.creativeSpark,
    builderAgent: 'Benchmark Agent',
    extraSectionMarkdown,
  };

  const asmFindings = validateAssemblySpec(spec, { rootDir: repoRoot });
  const asmErrors = asmFindings.filter((f) => f.severity === 'error');
  if (asmErrors.length > 0) {
    throw new Error(`Derived assembly spec for case '${caseId}' failed validateAssemblySpec: ${asmErrors.map((e) => e.message).join('; ')}`);
  }

  return spec;
}

// Derive and validate all cases before export completes
for (const caseDef of BENCHMARK_CASES) {
  try {
    buildCaseAssemblySpec(caseDef.id);
  } catch (err) {
    throw new Error(`Benchmark case '${caseDef.id}' failed derivation: ${err.message}`);
  }
}
