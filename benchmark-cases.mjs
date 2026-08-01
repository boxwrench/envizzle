import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOWCASES, CORE_SECTIONS, validateSelection } from './selection.mjs';
import { validateAssemblySpec } from './assemble.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname);

export const VALID_SUITES = Object.freeze(['smoke', 'full']);

const casesJsonPath = path.join(repoRoot, 'benchmarks', 'cases.json');
const rawCasesData = JSON.parse(fs.readFileSync(casesJsonPath, 'utf8'));

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

  if (typeof c.id !== 'string' || c.id.trim() === '') errors.push('Case id must be a non-empty string');
  if (typeof c.title !== 'string' || c.title.trim() === '') errors.push('Case title must be a non-empty string');
  if (!Array.isArray(c.suites) || c.suites.length === 0) {
    errors.push('Case suites must be a non-empty array');
  } else {
    for (const s of c.suites) {
      if (!VALID_SUITES.includes(s)) errors.push(`Invalid suite reference '${s}'`);
    }
  }

  if (typeof c.baseShowcase !== 'string' || !(c.baseShowcase in SHOWCASES)) {
    errors.push(`Nonexistent showcase '${c.baseShowcase}'`);
  }

  if (!['proven', 'signature', 'experimental'].includes(c.creativeMode)) {
    errors.push(`Invalid creativeMode '${c.creativeMode}'`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate registry on load
const idSet = new Set();
for (const caseDef of rawCasesData.cases) {
  const val = validateCaseDefinition(caseDef);
  if (!val.valid) {
    throw new Error(`Invalid benchmark case '${caseDef?.id}': ${val.errors.join('; ')}`);
  }
  if (idSet.has(caseDef.id)) {
    throw new Error(`Duplicate case ID '${caseDef.id}' in registry`);
  }
  idSet.add(caseDef.id);
}

export const BENCHMARK_CASES = Object.freeze(rawCasesData.cases);

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
    selection.signatureMoment = {
      enabled: false,
      text: '',
      reusedSystem: '',
      verificationPose: 'locomotion',
    };
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
