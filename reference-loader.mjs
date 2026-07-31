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

function parseMarkdownTable(tableText) {
  const rows = tableText.trim().split('\n');
  const table = {};
  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed.startsWith('|') || trimmed.includes('|---|') || trimmed.includes('| Token |') || trimmed.includes('| Field |') || trimmed.includes('| Parameter |')) {
      continue;
    }
    const parts = trimmed.split('|').map((p) => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (parts.length >= 2) {
      const rawKey = parts[0].replace(/[`*]/g, '').trim();
      const rawVal = parts[1].trim();
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
  
  // Split biomes.md by ### headings
  const biomeSections = biomesMd.split(/^### /m).slice(1);
  const foundBiomeNames = [];

  for (const section of biomeSections) {
    const titleLineEnd = section.indexOf('\n');
    if (titleLineEnd === -1) continue;
    const name = section.substring(0, titleLineEnd).trim();
    if (!canonicalBiomeNames.includes(name)) {
      // Ignore non-canonical sections if any
      continue;
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
    const tableParsed = parseMarkdownTable(tablePart);

    for (const key of EXPECTED_BIOME_TABLE_TOKENS) {
      if (!tableParsed[key]) {
        throw new Error(`Missing table token '${key}' in biome '${name}' of references/biomes.md`);
      }
      tokens[key] = tableParsed[key];
    }

    // 2. Labeled tokens & FOOT_INTERACTION
    for (const key of EXPECTED_BIOME_LABELED_TOKENS) {
      const marker = `**\`${key}\`**`;
      const idx = body.indexOf(marker);
      if (idx === -1) {
        throw new Error(`Missing labeled token '${key}' in biome '${name}' of references/biomes.md`);
      }
      const startPos = idx + marker.length;
      // Find end of token content: next **`TOKEN`** or **`FOOT_INTERACTION`** or ```json
      let endPos = body.length;
      const nextMarkers = [
        ...EXPECTED_BIOME_LABELED_TOKENS.map((k) => `**\`${k}\`**`),
        '**`FOOT_INTERACTION`**',
        '```json',
      ];
      for (const nm of nextMarkers) {
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
      if (!content) {
        throw new Error(`Empty content for token '${key}' in biome '${name}' of references/biomes.md`);
      }
      tokens[key] = content;
    }

    // FOOT_INTERACTION
    const fiMarker = '**`FOOT_INTERACTION`**';
    const fiIdx = body.indexOf(fiMarker);
    if (fiIdx === -1) {
      throw new Error(`Missing FOOT_INTERACTION in biome '${name}' of references/biomes.md`);
    }
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

    // Fenced JSON
    const jsonMatch = body.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error(`Missing JSON coherence block in biome '${name}' of references/biomes.md`);
    }
    let coherenceConfig;
    try {
      coherenceConfig = JSON.parse(jsonMatch[1]);
    } catch (err) {
      throw new Error(`Malformed JSON coherence block in biome '${name}' of references/biomes.md: ${err.message}`);
    }

    // Cross check tokens count
    if (Object.keys(tokens).length !== 19) {
      throw new Error(`Expected exactly 19 tokens in biome '${name}', found ${Object.keys(tokens).length}`);
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
    if (!ARCHETYPES.includes(name)) continue;
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
    if (!canonicalMechanicNames.includes(name)) continue;
    if (foundMechanicNames.includes(name)) {
      throw new Error(`Duplicate mechanic entry '${name}' in references/mechanics.md`);
    }
    foundMechanicNames.push(name);

    const body = section.substring(titleLineEnd + 1);
    const tokens = {};

    // Table tokens: CENTREPIECE_MECHANIC, CENTREPIECE_INPUT
    const tableParsed = parseMarkdownTable(body);
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
    const descIdx = body.indexOf(descMarker);
    if (descIdx === -1) {
      throw new Error(`Missing CENTREPIECE_DESCRIPTION in mechanic '${name}' of references/mechanics.md`);
    }
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
    for (const abKey of abilities) {
      const match = body.match(new RegExp(`-\\s*\`\\s*${abKey}\\s*\`\\s*—\\s*(.+)`));
      if (!match || !match[1].trim()) {
        throw new Error(`Missing token '${abKey}' in mechanic '${name}' of references/mechanics.md`);
      }
      tokens[abKey] = match[1].trim();
    }

    if (Object.keys(tokens).length !== 6) {
      throw new Error(`Expected exactly 6 tokens in mechanic '${name}', found ${Object.keys(tokens).length}`);
    }

    mechanics[name] = { name, tokens, rawMarkdown: section };
  }

  for (const name of canonicalMechanicNames) {
    if (!mechanics[name]) {
      throw new Error(`Missing canonical mechanic '${name}' in references/mechanics.md`);
    }
  }

  // Parse Cameras & Rendering Profiles
  const cameras = {};
  const canonicalCameraNames = Object.keys(CAMERA_REQUIREMENTS);
  const cameraSections = camerasMd.split(/^### /m).slice(1);
  const foundCameraNames = [];

  for (const section of cameraSections) {
    const titleLineEnd = section.indexOf('\n');
    if (titleLineEnd === -1) continue;
    const name = section.substring(0, titleLineEnd).trim();

    if (canonicalCameraNames.includes(name)) {
      if (foundCameraNames.includes(name)) {
        throw new Error(`Duplicate camera entry '${name}' in references/cameras.md`);
      }
      foundCameraNames.push(name);
      // Cut off at next section or '---' or '## Rendering profiles'
      let bodyEnd = section.indexOf('\n---');
      if (bodyEnd === -1) bodyEnd = section.indexOf('\n## ');
      if (bodyEnd === -1) bodyEnd = section.length;
      const body = section.substring(titleLineEnd + 1, bodyEnd).trim();
      cameras[name] = { name, body };
    }
  }

  for (const name of canonicalCameraNames) {
    if (!cameras[name]) {
      throw new Error(`Missing canonical camera '${name}' in references/cameras.md`);
    }
  }

  // Rendering Profiles in cameras.md
  const renderingProfiles = {};
  const profileSection = camerasMd.substring(camerasMd.indexOf('## Rendering profiles'));
  const profSubsections = profileSection.split(/^### /m).slice(1);

  for (const sub of profSubsections) {
    const titleLineEnd = sub.indexOf('\n');
    if (titleLineEnd === -1) continue;
    const title = sub.substring(0, titleLineEnd).trim();

    let profKey = null;
    if (title.includes('Babylon WebGPU')) profKey = 'babylon-webgpu';
    if (title.includes('Three WebGL2')) profKey = 'three-webgl2';

    if (profKey) {
      const parseBullets = (text) => {
        const result = {};
        const matches = text.matchAll(/-\s*\*\*`([A-Z0-9_]+)`\*\*:\s*`([^`]+)`/g);
        for (const m of matches) {
          result[m[1]] = m[2];
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
    if (!canonicalShowcaseNames.includes(name)) continue;

    if (foundShowcaseNames.includes(name)) {
      throw new Error(`Duplicate showcase entry '${name}' in references/showcases.md`);
    }
    foundShowcaseNames.push(name);

    const parsed = parseMarkdownTable(section);
    const expected = SHOWCASES[name];

    const projectName = parsed.PROJECT_NAME;
    const coreInteractionSentence = parsed.CORE_INTERACTION_SENTENCE;
    const assetStrategy = parsed.ASSET_STRATEGY;
    const targetBrowserAndHardware = parsed.TARGET_BROWSER_AND_HARDWARE;
    const renderingParadigm = parsed.RENDERING_PARADIGM;
    const engine = parsed.ENGINE;
    const shaderLang = parsed['SHADER_LANG / SHADER_LANG_EXT'] ? parsed['SHADER_LANG / SHADER_LANG_EXT'].split('/')[0].trim() : parsed.SHADER_LANG;
    const shaderLangExt = parsed['SHADER_LANG / SHADER_LANG_EXT'] ? parsed['SHADER_LANG / SHADER_LANG_EXT'].split('/')[1].trim().replace(/[`]/g, '') : parsed.SHADER_LANG_EXT;
    const materialApi = parsed.MATERIAL_API;

    if (!projectName || !coreInteractionSentence || !assetStrategy || !targetBrowserAndHardware || !renderingParadigm) {
      throw new Error(`Missing required showcase fields in '${name}' of references/showcases.md`);
    }

    // Cross-check structural fields with selection.mjs SHOWCASES
    if (parsed.Biome !== expected.biome) {
      throw new Error(`Showcase '${name}' biome mismatch: expected '${expected.biome}', got '${parsed.Biome}'`);
    }
    if (parsed.Archetype !== expected.archetype) {
      throw new Error(`Showcase '${name}' archetype mismatch: expected '${expected.archetype}', got '${parsed.Archetype}'`);
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
      biome: expected.biome,
      archetype: expected.archetype,
      mechanic: expected.mechanic,
      camera: expected.camera,
      ambition: expected.ambition,
      includedSections: expected.includedSections,
      extraSections: expected.extraSections,
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
