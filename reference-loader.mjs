import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BIOME_CHANNELS,
  ARCHETYPES,
  MECHANIC_WRITES,
  CAMERA_REQUIREMENTS,
  RENDERING_PROFILES,
  SHOWCASES,
} from './selection.mjs';
import { checkCoherence } from './check.mjs';

const EXPECTED_BIOME_TABLE_TOKENS = [
  'PRIMARY_ENVIRONMENT',
  'PRIMARY_MATERIAL_NAME',
  'NAIVE_DEFAULT',
  'DEFORMATION_TYPE',
  'DEFORMATION_MARKS',
  'RECOVERY_OUTCOME',
  'STATE_BUFFER_COVERAGE',
  'STATE_BUFFER_TEXEL_SIZE',
];

const EXPECTED_BIOME_LABELED_TOKENS = [
  'TERRAIN_PHILOSOPHY_SENTENCE',
  'TERRAIN_NOISE_LAYERS',
  'TERRAIN_LANDMARKS',
  'FAR_FIELD_TREATMENT',
  'MATERIAL_BEHAVIOURS',
  'STATE_BUFFER_CHANNELS',
  'RECOVERY_MECHANISM',
  'WIND_FIELD_ARCH',
  'GRASS_SYSTEM_SPEC',
  'AUDIO_ENGINE_SPEC',
  'ATMOSPHERIC_LIFE_SPEC',
];

export const EXPECTED_BIOME_TOKENS = [
  ...EXPECTED_BIOME_TABLE_TOKENS,
  ...EXPECTED_BIOME_LABELED_TOKENS,
];

// Optional per-biome labeled tokens: tolerated if present, never required. They feed
// build-contract.mjs's reviewCriteria.biomeSpecific slice rather than TEMPLATE.md
// substitution, so a biome may omit them entirely without failing validation.
export const OPTIONAL_BIOME_LABELED_TOKENS = [
  'MORPHOLOGY_ANTI_PATTERNS',
  'VISUAL_REVIEW_QUESTIONS',
];

export const EXPECTED_MECHANIC_TOKENS = [
  'CENTREPIECE_MECHANIC',
  'CENTREPIECE_INPUT',
  'CENTREPIECE_DESCRIPTION',
  'ABILITY_1_NAME',
  'ABILITY_2_NAME',
  'ABILITY_3_NAME',
];

function getRepoRoot() {
  return path.dirname(fileURLToPath(import.meta.url));
}

function countOccurrences(str, sub) {
  if (!sub) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(sub, pos)) !== -1) {
    count++;
    pos += sub.length;
  }
  return count;
}

function parseMarkdownTable(tableText, sourceName = 'table') {
  const rows = tableText.trim().split('\n');
  const table = {};
  for (const row of rows) {
    const trimmed = row.trim();
    if (
      !trimmed.startsWith('|') ||
      trimmed.includes('|---|') ||
      trimmed.includes('| Token |') ||
      trimmed.includes('| Field |') ||
      trimmed.includes('| Parameter |')
    ) {
      continue;
    }
    const parts = trimmed
      .split('|')
      .map((p) => p.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (parts.length >= 2) {
      const rawKey = parts[0].replace(/[`*]/g, '').trim();
      const rawVal = parts[1].trim();
      if (Object.prototype.hasOwnProperty.call(table, rawKey)) {
        throw new Error(`Duplicate table-token row '${rawKey}' in ${sourceName}`);
      }
      table[rawKey] = rawVal;
    }
  }
  return table;
}

export function loadReferenceCatalog(options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : getRepoRoot();

  const readRef = (filename) => {
    const filePath = path.join(rootDir, 'references', filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Reference file missing: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  };

  const biomesMd = readRef('biomes.md');
  const archetypesMd = readRef('archetypes.md');
  const mechanicsMd = readRef('mechanics.md');
  const camerasMd = readRef('cameras.md');
  const showcasesMd = readRef('showcases.md');

  // Parse Biomes
  const biomes = {};
  const canonicalBiomeNames = Object.keys(BIOME_CHANNELS);
  const biomeSections = biomesMd.split(/^### /m).slice(1);
  const foundBiomeNames = [];

  for (const section of biomeSections) {
    const titleLineEnd = section.indexOf('\n');
    if (titleLineEnd === -1) continue;
    const name = section.substring(0, titleLineEnd).trim();

    if (!canonicalBiomeNames.includes(name)) {
      throw new Error(`Unknown biome entry '${name}' in references/biomes.md`);
    }
    if (foundBiomeNames.includes(name)) {
      throw new Error(`Duplicate biome entry '${name}' in references/biomes.md`);
    }
    foundBiomeNames.push(name);

    const body = section.substring(titleLineEnd + 1);
    const tokens = {};

    // 1. Table tokens
    const tableEnd = body.indexOf('\n\n**`TERRAIN_PHILOSOPHY_SENTENCE`**');
    const tablePart = tableEnd !== -1 ? body.substring(0, tableEnd) : body;
    const tableParsed = parseMarkdownTable(tablePart, `biome '${name}' of references/biomes.md`);

    for (const key of Object.keys(tableParsed)) {
      if (!EXPECTED_BIOME_TABLE_TOKENS.includes(key)) {
        throw new Error(`Unknown table token '${key}' in biome '${name}' of references/biomes.md`);
      }
    }

    for (const key of EXPECTED_BIOME_TABLE_TOKENS) {
      if (!tableParsed[key]) {
        throw new Error(`Missing table token '${key}' in biome '${name}' of references/biomes.md`);
      }
      tokens[key] = tableParsed[key];
    }

    // 2. Labeled tokens & FOOT_INTERACTION
    const allowedBiomeLabeledMarkers = [
      ...EXPECTED_BIOME_LABELED_TOKENS,
      ...OPTIONAL_BIOME_LABELED_TOKENS,
      'FOOT_INTERACTION',
    ];
    const foundLabeledMarkers = [...body.matchAll(/\*\*`([A-Z0-9_]+)`\*\*/g)].map((m) => m[1]);
    for (const markerKey of foundLabeledMarkers) {
      if (!allowedBiomeLabeledMarkers.includes(markerKey)) {
        throw new Error(`Unknown labeled token '${markerKey}' in biome '${name}' of references/biomes.md`);
      }
    }

    // Boundary markers used to bound each labeled token's content, shared by both the
    // required and optional labeled-token passes below.
    const labeledMarkers = [
      ...EXPECTED_BIOME_LABELED_TOKENS.map((k) => `**\`${k}\`**`),
      ...OPTIONAL_BIOME_LABELED_TOKENS.map((k) => `**\`${k}\`**`),
      '**`FOOT_INTERACTION`**',
      '```json',
    ];

    const extractLabeledContent = (marker) => {
      const idx = body.indexOf(marker);
      const startPos = idx + marker.length;
      let endPos = body.length;
      for (const nm of labeledMarkers) {
        if (nm === marker) continue;
        const nIdx = body.indexOf(nm, startPos);
        if (nIdx !== -1 && nIdx < endPos) {
          endPos = nIdx;
        }
      }
      let content = body.substring(startPos, endPos).trim();
      if (content.startsWith('—')) {
        content = content.substring(1).trim();
      }
      return content;
    };

    for (const key of EXPECTED_BIOME_LABELED_TOKENS) {
      const marker = `**\`${key}\`**`;
      const occurrences = countOccurrences(body, marker);
      if (occurrences === 0) {
        throw new Error(`Missing labeled token '${key}' in biome '${name}' of references/biomes.md`);
      }
      if (occurrences > 1) {
        throw new Error(`Duplicate labeled-token marker '${key}' in biome '${name}' of references/biomes.md`);
      }

      const content = extractLabeledContent(marker);
      if (!content) {
        throw new Error(`Empty content for token '${key}' in biome '${name}' of references/biomes.md`);
      }
      tokens[key] = content;
    }

    // 2b. Optional labeled tokens: tolerated if present, never required.
    for (const key of OPTIONAL_BIOME_LABELED_TOKENS) {
      const marker = `**\`${key}\`**`;
      const occurrences = countOccurrences(body, marker);
      if (occurrences === 0) continue;
      if (occurrences > 1) {
        throw new Error(`Duplicate labeled-token marker '${key}' in biome '${name}' of references/biomes.md`);
      }

      const content = extractLabeledContent(marker);
      if (!content) {
        throw new Error(`Empty content for token '${key}' in biome '${name}' of references/biomes.md`);
      }
      tokens[key] = content;
    }

    // FOOT_INTERACTION
    const fiMarker = '**`FOOT_INTERACTION`**';
    const fiOccurrences = countOccurrences(body, fiMarker);
    if (fiOccurrences === 0) {
      throw new Error(`Missing FOOT_INTERACTION in biome '${name}' of references/biomes.md`);
    }
    if (fiOccurrences > 1) {
      throw new Error(`Duplicate FOOT_INTERACTION in biome '${name}' of references/biomes.md`);
    }

    const fiIdx = body.indexOf(fiMarker);
    const fiStartPos = fiIdx + fiMarker.length;
    let fiEndPos = body.indexOf('```json', fiStartPos);
    if (fiEndPos === -1) fiEndPos = body.length;
    let footInteraction = body.substring(fiStartPos, fiEndPos).trim();
    if (footInteraction.startsWith('—')) {
      footInteraction = footInteraction.substring(1).trim();
    }
    if (!footInteraction) {
      throw new Error(`Empty FOOT_INTERACTION in biome '${name}' of references/biomes.md`);
    }

    // Fenced JSON coherence block
    const jsonBlocks = body.match(/```json\s*\n([\s\S]*?)\n```/g);
    if (!jsonBlocks || jsonBlocks.length === 0) {
      throw new Error(`Missing JSON coherence block in biome '${name}' of references/biomes.md`);
    }
    if (jsonBlocks.length > 1) {
      throw new Error(`Duplicate JSON coherence block in biome '${name}' of references/biomes.md`);
    }

    const jsonMatch = body.match(/```json\s*\n([\s\S]*?)\n```/);
    let coherenceConfig;
    try {
      coherenceConfig = JSON.parse(jsonMatch[1]);
    } catch (err) {
      throw new Error(`Malformed JSON coherence block in biome '${name}' of references/biomes.md: ${err.message}`);
    }

    const allowedCohKeys = ['paradigm', 'assetStrategy', 'materialBehaviours', 'palette'];
    for (const k of Object.keys(coherenceConfig)) {
      if (!allowedCohKeys.includes(k)) {
        throw new Error(`Unknown property '${k}' in JSON coherence block of biome '${name}' in references/biomes.md`);
      }
    }

    // Default assetStrategy to zero-asset if missing
    if (!coherenceConfig.assetStrategy) {
      coherenceConfig.assetStrategy = 'zero-asset';
    }

    // Validate shape safely
    if (
      !coherenceConfig ||
      typeof coherenceConfig !== 'object' ||
      Array.isArray(coherenceConfig) ||
      !['photoreal', 'painterly'].includes(coherenceConfig.paradigm) ||
      coherenceConfig.assetStrategy !== 'zero-asset' ||
      typeof coherenceConfig.materialBehaviours !== 'string' ||
      !coherenceConfig.materialBehaviours.trim() ||
      !Array.isArray(coherenceConfig.palette) ||
      coherenceConfig.palette.length === 0
    ) {
      throw new Error(`Malformed JSON coherence block shape in biome '${name}' of references/biomes.md`);
    }

    const allowedPaletteEntryKeys = ['role', 'hex', 'area'];
    for (const p of coherenceConfig.palette) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        throw new Error(`Malformed palette entry in JSON coherence block of biome '${name}' in references/biomes.md`);
      }
      for (const k of Object.keys(p)) {
        if (!allowedPaletteEntryKeys.includes(k)) {
          throw new Error(`Unknown palette-entry property '${k}' in JSON coherence block of biome '${name}' in references/biomes.md`);
        }
      }
      if (
        typeof p.role !== 'string' ||
        typeof p.hex !== 'string' ||
        !/^#[0-9a-fA-F]{6}$/.test(p.hex) ||
        !['large', 'medium', 'accent'].includes(p.area)
      ) {
        throw new Error(`Malformed palette entry in JSON coherence block of biome '${name}' in references/biomes.md`);
      }
    }

    // Run checkCoherence safely
    try {
      const cohErrors = checkCoherence({
        paradigm: coherenceConfig.paradigm,
        assetStrategy: 'zero-asset',
        materialBehaviours: coherenceConfig.materialBehaviours,
        palette: coherenceConfig.palette,
      }).filter((c) => c.severity === 'error');

      if (cohErrors.length > 0) {
        throw new Error(`Coherence check error in biome '${name}': ${cohErrors.map((e) => e.message).join(' | ')}`);
      }
    } catch (err) {
      if (err.message.startsWith('Coherence check error in biome')) {
        throw err;
      }
      throw new Error(`Coherence check failed for biome '${name}' of references/biomes.md: ${err.message}`);
    }

    // Cross-check tokens count: 19 required table+labeled tokens, plus however many of
    // the optional labeled tokens this biome chose to define.
    const presentOptionalCount = OPTIONAL_BIOME_LABELED_TOKENS.filter((key) => tokens[key] !== undefined).length;
    const expectedTokenCount = 19 + presentOptionalCount;
    if (Object.keys(tokens).length !== expectedTokenCount) {
      throw new Error(`Expected exactly ${expectedTokenCount} tokens in biome '${name}', found ${Object.keys(tokens).length}`);
    }

    biomes[name] = {
      name,
      tokens,
      footInteraction,
      coherenceConfig,
      rawMarkdown: section,
    };
  }

  for (const name of canonicalBiomeNames) {
    if (!biomes[name]) {
      throw new Error(`Missing canonical biome '${name}' in references/biomes.md`);
    }
  }

  // Parse Archetypes
  const archetypes = {};
  const archetypeSections = archetypesMd.split(/^### /m).slice(1);
  const foundArchetypeNames = [];

  for (const section of archetypeSections) {
    const titleLineEnd = section.indexOf('\n');
    if (titleLineEnd === -1) continue;
    const name = section.substring(0, titleLineEnd).trim();
    if (!ARCHETYPES.includes(name)) {
      throw new Error(`Unknown archetype entry '${name}' in references/archetypes.md`);
    }
    if (foundArchetypeNames.includes(name)) {
      throw new Error(`Duplicate archetype entry '${name}' in references/archetypes.md`);
    }
    foundArchetypeNames.push(name);
    const body = section.substring(titleLineEnd + 1).trim();
    if (!body) {
      throw new Error(`Empty body for archetype '${name}' in references/archetypes.md`);
    }
    archetypes[name] = { name, body };
  }

  for (const name of ARCHETYPES) {
    if (!archetypes[name]) {
      throw new Error(`Missing canonical archetype '${name}' in references/archetypes.md`);
    }
  }

  // Parse Mechanics
  const mechanics = {};
  const canonicalMechanicNames = Object.keys(MECHANIC_WRITES);
  const mechanicSections = mechanicsMd.split(/^### /m).slice(1);
  const foundMechanicNames = [];

  for (const section of mechanicSections) {
    const titleLineEnd = section.indexOf('\n');
    if (titleLineEnd === -1) continue;
    const name = section.substring(0, titleLineEnd).trim();
    if (!canonicalMechanicNames.includes(name)) {
      throw new Error(`Unknown mechanic entry '${name}' in references/mechanics.md`);
    }
    if (foundMechanicNames.includes(name)) {
      throw new Error(`Duplicate mechanic entry '${name}' in references/mechanics.md`);
    }
    foundMechanicNames.push(name);

    const body = section.substring(titleLineEnd + 1);
    const tokens = {};

    // Table tokens: CENTREPIECE_MECHANIC, CENTREPIECE_INPUT
    const tableParsed = parseMarkdownTable(body, `mechanic '${name}' of references/mechanics.md`);
    const allowedMechanicTableKeys = ['CENTREPIECE_MECHANIC', 'CENTREPIECE_INPUT'];
    for (const k of Object.keys(tableParsed)) {
      if (!allowedMechanicTableKeys.includes(k)) {
        throw new Error(`Unknown table token '${k}' in mechanic '${name}' of references/mechanics.md`);
      }
    }
    if (!tableParsed.CENTREPIECE_MECHANIC) {
      throw new Error(`Missing CENTREPIECE_MECHANIC in mechanic '${name}' of references/mechanics.md`);
    }
    if (!tableParsed.CENTREPIECE_INPUT) {
      throw new Error(`Missing CENTREPIECE_INPUT in mechanic '${name}' of references/mechanics.md`);
    }
    tokens.CENTREPIECE_MECHANIC = tableParsed.CENTREPIECE_MECHANIC;
    tokens.CENTREPIECE_INPUT = tableParsed.CENTREPIECE_INPUT;

    // CENTREPIECE_DESCRIPTION
    const descMarker = '**`CENTREPIECE_DESCRIPTION`**';
    const descOccurrences = countOccurrences(body, descMarker);
    if (descOccurrences === 0) {
      throw new Error(`Missing CENTREPIECE_DESCRIPTION in mechanic '${name}' of references/mechanics.md`);
    }
    if (descOccurrences > 1) {
      throw new Error(`Duplicate CENTREPIECE_DESCRIPTION in mechanic '${name}' of references/mechanics.md`);
    }

    const foundMechBoldMarkers = [...body.matchAll(/\*\*`([A-Za-z0-9_]+)`\*\*/g)].map((m) => m[1]);
    for (const mKey of foundMechBoldMarkers) {
      if (mKey !== 'CENTREPIECE_DESCRIPTION' && mKey !== 'centrepieceEffect') {
        throw new Error(`Unknown labeled token '${mKey}' in mechanic '${name}' of references/mechanics.md`);
      }
    }

    const descIdx = body.indexOf(descMarker);
    const descStart = descIdx + descMarker.length;
    let descEnd = body.indexOf('- `ABILITY_1_NAME`', descStart);
    if (descEnd === -1) descEnd = body.length;
    let descContent = body.substring(descStart, descEnd).trim();
    if (descContent.startsWith('—')) {
      descContent = descContent.substring(1).trim();
    }
    tokens.CENTREPIECE_DESCRIPTION = descContent;

    // Abilities
    const abilities = ['ABILITY_1_NAME', 'ABILITY_2_NAME', 'ABILITY_3_NAME'];
    const foundAbilityKeys = [...body.matchAll(/-\s*`\s*([A-Z0-9_]+)\s*`\s*—/g)].map((m) => m[1]);
    for (const abKey of foundAbilityKeys) {
      if (!abilities.includes(abKey)) {
        throw new Error(`Unknown ability field '${abKey}' in mechanic '${name}' of references/mechanics.md`);
      }
    }

    for (const abKey of abilities) {
      const regex = new RegExp(`-\\s*\`\\s*${abKey}\\s*\`\\s*—\\s*(.+)`, 'g');
      const matches = [...body.matchAll(regex)];
      if (matches.length === 0) {
        throw new Error(`Missing token '${abKey}' in mechanic '${name}' of references/mechanics.md`);
      }
      if (matches.length > 1) {
        throw new Error(`Duplicate ability field '${abKey}' in mechanic '${name}' of references/mechanics.md`);
      }
      tokens[abKey] = matches[0][1].trim();
    }

    if (Object.keys(tokens).length !== 6) {
      throw new Error(`Expected exactly 6 tokens in mechanic '${name}', found ${Object.keys(tokens).length}`);
    }

    const effectMarker = '**`centrepieceEffect`**';
    const effectIdx = body.indexOf(effectMarker);
    if (effectIdx === -1) {
      throw new Error(`Missing centrepieceEffect block in mechanic '${name}' of references/mechanics.md`);
    }
    const jsonMatch = body.substring(effectIdx).match(/```json\s*\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error(`Missing or malformed fenced JSON block under centrepieceEffect in mechanic '${name}' of references/mechanics.md`);
    }
    let centrepieceEffect;
    try {
      centrepieceEffect = JSON.parse(jsonMatch[1]);
    } catch (err) {
      throw new Error(`Malformed centrepieceEffect JSON block in mechanic '${name}' of references/mechanics.md: ${err.message}`);
    }

    mechanics[name] = { name, tokens, centrepieceEffect, rawMarkdown: section };
  }

  for (const name of canonicalMechanicNames) {
    if (!mechanics[name]) {
      throw new Error(`Missing canonical mechanic '${name}' in references/mechanics.md`);
    }
  }

  // Parse Cameras & Rendering Profiles
  const cameras = {};
  const canonicalCameraNames = Object.keys(CAMERA_REQUIREMENTS);

  const renderingProfilesMarker = '## Rendering profiles';
  const renderingProfilesIdx = camerasMd.indexOf(renderingProfilesMarker);
  const cameraPart = renderingProfilesIdx !== -1 ? camerasMd.substring(0, renderingProfilesIdx) : camerasMd;
  const profilePart = renderingProfilesIdx !== -1 ? camerasMd.substring(renderingProfilesIdx) : '';

  const cameraSections = cameraPart.split(/^### /m).slice(1);
  const foundCameraNames = [];

  for (const section of cameraSections) {
    const titleLineEnd = section.indexOf('\n');
    if (titleLineEnd === -1) continue;
    const name = section.substring(0, titleLineEnd).trim();

    if (!canonicalCameraNames.includes(name)) {
      throw new Error(`Unknown camera entry '${name}' in references/cameras.md`);
    }
    if (foundCameraNames.includes(name)) {
      throw new Error(`Duplicate camera entry '${name}' in references/cameras.md`);
    }
    foundCameraNames.push(name);

    let bodyEnd = section.indexOf('\n---');
    if (bodyEnd === -1) bodyEnd = section.indexOf('\n## ');
    if (bodyEnd === -1) bodyEnd = section.length;
    const body = section.substring(titleLineEnd + 1, bodyEnd).trim();
    cameras[name] = { name, body };
  }

  for (const name of canonicalCameraNames) {
    if (!cameras[name]) {
      throw new Error(`Missing canonical camera '${name}' in references/cameras.md`);
    }
  }

  // Rendering Profiles in cameras.md
  const renderingProfiles = {};
  const profSubsections = profilePart.split(/^### /m).slice(1);
  const foundProfileKeys = [];

  for (const sub of profSubsections) {
    const titleLineEnd = sub.indexOf('\n');
    if (titleLineEnd === -1) continue;
    const title = sub.substring(0, titleLineEnd).trim();

    let profKey = null;
    if (title.includes('Babylon WebGPU')) profKey = 'babylon-webgpu';
    else if (title.includes('Three WebGL2')) profKey = 'three-webgl2';
    else {
      throw new Error(`Unknown rendering profile section '${title}' in references/cameras.md`);
    }

    if (foundProfileKeys.includes(profKey)) {
      throw new Error(`Duplicate rendering profile '${profKey}' in references/cameras.md`);
    }
    foundProfileKeys.push(profKey);

    const parseBullets = (text) => {
      const allowedProfileFields = ['ENGINE', 'SHADER_LANG', 'SHADER_LANG_EXT', 'MATERIAL_API'];
      const result = {};
      const matches = [...text.matchAll(/-\s*\*\*`([A-Z0-9_]+)`\*\*:?\s*`([^`]+)`/g)];
      for (const m of matches) {
        const key = m[1];
        const val = m[2];
        if (!allowedProfileFields.includes(key)) {
          throw new Error(`Unknown rendering-profile field '${key}' in '${profKey}' of references/cameras.md`);
        }
        if (Object.prototype.hasOwnProperty.call(result, key)) {
          throw new Error(`Duplicate rendering-profile field '${key}' in '${profKey}' of references/cameras.md`);
        }
        result[key] = val;
      }
      if (Object.keys(result).length !== 4) {
        throw new Error(`Expected exactly 4 rendering profile fields in '${profKey}', found ${Object.keys(result).length}`);
      }
      return result;
    };

    const parsed = parseBullets(sub);
    const engine = parsed.ENGINE;
    const shaderLang = parsed.SHADER_LANG;
    const shaderLangExt = parsed.SHADER_LANG_EXT;
    const materialApi = parsed.MATERIAL_API;

    const expected = RENDERING_PROFILES[profKey];
    if (
      engine !== expected.engine ||
      shaderLang !== expected.shaderLang ||
      shaderLangExt !== expected.shaderLangExt ||
      materialApi !== expected.materialApi
    ) {
      throw new Error(`Rendering profile field mismatch for '${profKey}' between references/cameras.md and selection.mjs`);
    }

    renderingProfiles[profKey] = {
      id: profKey,
      engine,
      shaderLang,
      shaderLangExt,
      materialApi,
    };
  }

  if (Object.keys(renderingProfiles).length !== 2) {
    throw new Error(`Expected exactly 2 rendering profiles in references/cameras.md, found ${Object.keys(renderingProfiles).length}`);
  }

  // Parse Showcases
  const showcases = {};
  const canonicalShowcaseNames = Object.keys(SHOWCASES);
  const showcaseSections = showcasesMd.split(/^### /m).slice(1);
  const foundShowcaseNames = [];

  for (const section of showcaseSections) {
    const titleLineEnd = section.indexOf('\n');
    if (titleLineEnd === -1) continue;
    const name = section.substring(0, titleLineEnd).trim();

    if (!canonicalShowcaseNames.includes(name)) {
      throw new Error(`Unknown showcase entry '${name}' in references/showcases.md`);
    }
    if (foundShowcaseNames.includes(name)) {
      throw new Error(`Duplicate showcase entry '${name}' in references/showcases.md`);
    }
    foundShowcaseNames.push(name);

    const parsed = parseMarkdownTable(section, `showcase '${name}' in references/showcases.md`);

    const allowedShowcaseFields = [
      'PROJECT_NAME',
      'Biome',
      'Archetype',
      'Mechanic',
      'Camera',
      'Ambition',
      'Included sections',
      'Extra sections',
      'State-channel contract',
      'RENDERING_PARADIGM',
      'ENGINE',
      'SHADER_LANG / SHADER_LANG_EXT',
      'SHADER_LANG',
      'SHADER_LANG_EXT',
      'MATERIAL_API',
      'ASSET_STRATEGY',
      'TARGET_BROWSER_AND_HARDWARE',
      'CORE_INTERACTION_SENTENCE',
    ];

    for (const k of Object.keys(parsed)) {
      if (!allowedShowcaseFields.includes(k)) {
        throw new Error(`Unknown showcase field '${k}' in '${name}' of references/showcases.md`);
      }
    }

    const expected = SHOWCASES[name];

    const projectName = parsed.PROJECT_NAME;
    const coreInteractionSentence = parsed.CORE_INTERACTION_SENTENCE;
    const assetStrategy = parsed.ASSET_STRATEGY;
    const targetBrowserAndHardware = parsed.TARGET_BROWSER_AND_HARDWARE;
    const renderingParadigm = parsed.RENDERING_PARADIGM;
    const engine = parsed.ENGINE;
    const shaderLang = parsed['SHADER_LANG / SHADER_LANG_EXT']
      ? parsed['SHADER_LANG / SHADER_LANG_EXT'].split('/')[0].trim()
      : parsed.SHADER_LANG;
    const shaderLangExt = parsed['SHADER_LANG / SHADER_LANG_EXT']
      ? parsed['SHADER_LANG / SHADER_LANG_EXT'].split('/')[1].trim().replace(/[`]/g, '')
      : parsed.SHADER_LANG_EXT;
    const materialApi = parsed.MATERIAL_API;

    if (!projectName || !coreInteractionSentence || !assetStrategy || !targetBrowserAndHardware || !renderingParadigm) {
      throw new Error(`Missing required showcase fields in '${name}' of references/showcases.md`);
    }

    if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(projectName) || projectName.includes('/') || projectName.includes('\\') || projectName.includes('..')) {
      throw new Error(`Showcase '${name}' projectName '${projectName}' is invalid`);
    }

    if (assetStrategy !== '100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)') {
      throw new Error(`Showcase '${name}' assetStrategy must promise 100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)`);
    }

    const selectedBiomeObj = biomes[parsed.Biome];
    if (!selectedBiomeObj) {
      throw new Error(`Showcase '${name}' references unknown biome '${parsed.Biome}'`);
    }
    const expectedParadigmString = selectedBiomeObj.coherenceConfig.paradigm === 'photoreal'
      ? 'AAA Photoreal'
      : 'Ghibli-Style Painterly Anime';

    if (renderingParadigm !== expectedParadigmString) {
      throw new Error(`Showcase '${name}' rendering paradigm mismatch: expected '${expectedParadigmString}', got '${renderingParadigm}'`);
    }

    // Parse included and extra sections
    const parsedIncStr = parsed['Included sections'] || '';
    const parsedExtraStr = parsed['Extra sections'] || '';

    const parsedIncSections = parsedIncStr === 'none' || !parsedIncStr
      ? []
      : parsedIncStr.split(',').map((s) => s.replace(/[`]/g, '').trim());

    const parsedExtraSections = parsedExtraStr === 'none' || !parsedExtraStr
      ? []
      : parsedExtraStr.split(',').map((s) => s.replace(/[`]/g, '').trim());

    const parsedAmbition = (parsed.Ambition || '').replace(/[`]/g, '').trim();

    // Cross-check structural fields with selection.mjs SHOWCASES
    if (parsed.Biome !== expected.biome) {
      throw new Error(`Showcase '${name}' biome mismatch: expected '${expected.biome}', got '${parsed.Biome}'`);
    }
    if (parsed.Archetype !== expected.archetype) {
      throw new Error(`Showcase '${name}' archetype mismatch: expected '${expected.archetype}', got '${parsed.Archetype}'`);
    }
    if (parsed.Mechanic !== expected.mechanic) {
      throw new Error(`Showcase '${name}' mechanic mismatch: expected '${expected.mechanic}', got '${parsed.Mechanic}'`);
    }
    if (parsed.Camera !== expected.camera) {
      throw new Error(`Showcase '${name}' camera mismatch: expected '${expected.camera}', got '${parsed.Camera}'`);
    }
    if (parsedAmbition !== expected.ambition) {
      throw new Error(`Showcase '${name}' ambition mismatch: expected '${expected.ambition}', got '${parsedAmbition}'`);
    }

    const sortArr = (arr) => [...arr].sort();
    if (JSON.stringify(sortArr(parsedIncSections)) !== JSON.stringify(sortArr(expected.includedSections))) {
      throw new Error(`Showcase '${name}' includedSections mismatch: expected ${JSON.stringify(expected.includedSections)}, got ${JSON.stringify(parsedIncSections)}`);
    }
    if (JSON.stringify(sortArr(parsedExtraSections)) !== JSON.stringify(sortArr(expected.extraSections))) {
      throw new Error(`Showcase '${name}' extraSections mismatch: expected ${JSON.stringify(expected.extraSections)}, got ${JSON.stringify(parsedExtraSections)}`);
    }

    // Cross-check rendering profile tuple
    const expectedProfile = RENDERING_PROFILES[expected.renderingProfile];
    if (
      engine !== expectedProfile.engine ||
      shaderLang !== expectedProfile.shaderLang ||
      shaderLangExt !== expectedProfile.shaderLangExt ||
      materialApi !== expectedProfile.materialApi
    ) {
      throw new Error(`Showcase '${name}' rendering profile tuple mismatch with '${expected.renderingProfile}'`);
    }

    // Parse and compare full state-channel contract
    const sccStr = parsed['State-channel contract'] || '';
    if (expected.includedSections.includes('state-buffer') && Object.keys(expected.stateChannelContract).length > 0) {
      const entries = sccStr.split(';').map((e) => e.trim()).filter((e) => e.length > 0);
      const parsedContract = {};
      for (const entryStr of entries) {
        const match = entryStr.match(/^([a-z0-9-]+)\s*→\s*([RGBA])\s*\(([^)]+)\):\s*(.+)$/);
        if (!match) {
          throw new Error(`Showcase '${name}' state-channel contract string malformed entry: '${entryStr}'`);
        }
        const key = match[1];
        const channel = match[2];
        const nativeMeaning = match[3].trim();
        const effect = match[4].trim();
        if (Object.prototype.hasOwnProperty.call(parsedContract, key)) {
          throw new Error(`Showcase '${name}' state-channel contract duplicate key '${key}'`);
        }
        parsedContract[key] = { channel, nativeMeaning, effect };
      }

      const expectedKeys = Object.keys(expected.stateChannelContract);
      const parsedKeys = Object.keys(parsedContract);
      if (parsedKeys.length !== expectedKeys.length || expectedKeys.some((k) => !parsedContract[k])) {
        throw new Error(`Showcase '${name}' state-channel contract key set mismatch: expected [${expectedKeys.join(', ')}], got [${parsedKeys.join(', ')}]`);
      }

      const biomeChanMap = BIOME_CHANNELS[expected.biome] || {};
      for (const [key, expVal] of Object.entries(expected.stateChannelContract)) {
        const pVal = parsedContract[key];
        if (pVal.channel !== expVal.channel) {
          throw new Error(`Showcase '${name}' state-channel contract string mismatch for key '${key}': channel mismatch expected '${expVal.channel}', got '${pVal.channel}'`);
        }
        if (pVal.effect !== expVal.effect) {
          throw new Error(`Showcase '${name}' state-channel contract string mismatch for key '${key}': effect mismatch expected '${expVal.effect}', got '${pVal.effect}'`);
        }
        const expectedNative = biomeChanMap[expVal.channel];
        if (pVal.nativeMeaning !== expectedNative) {
          throw new Error(`Showcase '${name}' state-channel contract string mismatch for key '${key}': native channel meaning mismatch expected '${expectedNative}', got '${pVal.nativeMeaning}'`);
        }
      }
    } else {
      if (sccStr.trim() !== 'none (omitted at slice)') {
        throw new Error(`Showcase '${name}' state-channel contract should state none (omitted at slice) when state-buffer is omitted`);
      }
    }

    showcases[name] = {
      name,
      projectName,
      renderingParadigm,
      engine,
      shaderLang,
      shaderLangExt,
      materialApi,
      assetStrategy,
      targetBrowserAndHardware,
      coreInteractionSentence,
      biome: parsed.Biome,
      archetype: parsed.Archetype,
      mechanic: parsed.Mechanic,
      camera: parsed.Camera,
      ambition: parsedAmbition,
      includedSections: parsedIncSections,
      extraSections: parsedExtraSections,
      stateChannelContract: expected.stateChannelContract,
      cameraAdjustments: expected.cameraAdjustments,
      renderingProfile: expected.renderingProfile,
    };
  }

  for (const name of canonicalShowcaseNames) {
    if (!showcases[name]) {
      throw new Error(`Missing canonical showcase '${name}' in references/showcases.md`);
    }
  }

  return {
    biomes,
    archetypes,
    mechanics,
    cameras,
    renderingProfiles,
    showcases,
  };
}
