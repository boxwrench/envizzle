#!/usr/bin/env node
/**
 * assemble.mjs — Deterministic brief assembler and safe output bundle writer for Envizzle
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateSelection,
  formatStateChannelContract,
  BIOME_CHANNELS,
  SHOWCASES,
  CORE_SECTIONS,
  EXTRA_SECTIONS,
  RENDERING_PROFILES,
} from './selection.mjs';
import { checkCoherence, validateBrief } from './check.mjs';
import { loadReferenceCatalog } from './reference-loader.mjs';

const conflict = (rule, severity, message, fix) => ({ rule, severity, message, fix });

const ALLOWED_ASSEMBLY_KEYS = [
  'selection',
  'projectName',
  'coreInteractionSentence',
  'creativeSpark',
  'builderAgent',
  'coherenceConfig',
  'coherenceOverrides',
  'extraSectionMarkdown',
];

/**
 * Validate an assembly specification object.
 * Returns array of conflict objects: { rule, severity, message, fix }
 */
export function validateAssemblySpec(spec, options = {}) {
  const out = [];

  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    out.push(conflict(
      'assembly-required',
      'error',
      'Assembly spec must be a non-null object.',
      'Provide a valid assembly spec object.',
    ));
    return out;
  }

  // Load reference catalog
  let catalog;
  try {
    catalog = loadReferenceCatalog(options);
  } catch (err) {
    out.push(conflict(
      'reference-catalog-error',
      'error',
      `Failed to load reference catalog: ${err.message}`,
      'Check reference files in repo.',
    ));
    return out;
  }

  // 1. Check unknown top-level keys
  const unknownKeys = Object.keys(spec).filter((k) => !ALLOWED_ASSEMBLY_KEYS.includes(k));
  if (unknownKeys.length > 0) {
    out.push(conflict(
      'assembly-key-unknown',
      'error',
      `Assembly spec contains unknown top-level properties: ${unknownKeys.join(', ')}.`,
      `Allowed properties: ${ALLOWED_ASSEMBLY_KEYS.join(', ')}.`,
    ));
  }

  // 2. Validate selection
  if (!spec.selection || typeof spec.selection !== 'object' || Array.isArray(spec.selection)) {
    out.push(conflict(
      'selection-required',
      'error',
      'Assembly spec requires a valid selection object.',
      'Provide a selection object in spec.selection.',
    ));
  } else {
    const selConflicts = validateSelection(spec.selection);
    out.push(...selConflicts);
  }

  const selection = spec.selection || {};
  const isWholeShowcase = selection.path === 'showcase' && (selection.creativeMode === 'proven' || selection.creativeMode === 'signature');
  const baseShowcaseObj = selection.baseShowcase && catalog.showcases[selection.baseShowcase] ? catalog.showcases[selection.baseShowcase] : null;

  // 3. Validate projectName
  let projectName = spec.projectName;
  if (!projectName || typeof projectName !== 'string' || projectName.trim() === '') {
    if (isWholeShowcase && baseShowcaseObj) {
      projectName = baseShowcaseObj.projectName;
    } else {
      out.push(conflict(
        'project-name-required',
        'error',
        'projectName is required for Experimental assembly specifications.',
        'Provide an upper-case hyphenated projectName (e.g. "MY-PROJECT").',
      ));
    }
  }

  if (projectName && typeof projectName === 'string') {
    if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(projectName) || projectName.includes('/') || projectName.includes('\\') || projectName.includes('..')) {
      out.push(conflict(
        'project-name-invalid',
        'error',
        `projectName '${projectName}' is invalid. Must be upper-case, hyphenated safe name with no path separators or traversal.`,
        'Use upper-case letters, numbers, and single hyphens (e.g. "MY-DEMO").',
      ));
    }
  }

  // 4. Validate coreInteractionSentence
  let coreSentence = spec.coreInteractionSentence;
  if (!coreSentence || typeof coreSentence !== 'string' || coreSentence.trim() === '') {
    if (isWholeShowcase && baseShowcaseObj) {
      coreSentence = baseShowcaseObj.coreInteractionSentence;
    } else {
      out.push(conflict(
        'core-interaction-sentence-required',
        'error',
        'coreInteractionSentence is required for Experimental assembly specifications.',
        'Provide a non-empty coreInteractionSentence string.',
      ));
    }
  }

  // 5. Validate creativeSpark
  if (selection.creativeMode === 'proven') {
    if (spec.creativeSpark !== undefined && spec.creativeSpark !== null && typeof spec.creativeSpark === 'string' && spec.creativeSpark.trim() !== '') {
      out.push(conflict(
        'proven-creative-spark-forbidden',
        'error',
        'Proven mode must not have a creative spark.',
        'Omit creativeSpark or set it to null/empty in Proven mode.',
      ));
    }
  }

  const biomeObj = selection.biome ? catalog.biomes[selection.biome] : null;
  const canonicalCoherence = biomeObj ? biomeObj.coherenceConfig : null;

  let effectiveCoherence = spec.coherenceConfig;
  if (effectiveCoherence === undefined || effectiveCoherence === null) {
    if (canonicalCoherence) {
      effectiveCoherence = {
        paradigm: canonicalCoherence.paradigm,
        assetStrategy: 'zero-asset',
        materialBehaviours: canonicalCoherence.materialBehaviours,
        palette: canonicalCoherence.palette,
      };
    }
  } else {
    // If coherenceConfig is provided explicitly
    if (isWholeShowcase && canonicalCoherence) {
      // Must match canonical
      const sameParadigm = effectiveCoherence.paradigm === canonicalCoherence.paradigm;
      const sameBehaviours = effectiveCoherence.materialBehaviours === canonicalCoherence.materialBehaviours;
      const samePalette = JSON.stringify(effectiveCoherence.palette) === JSON.stringify(canonicalCoherence.palette);
      if (!sameParadigm || !sameBehaviours || !samePalette) {
        out.push(conflict(
          'proven-signature-coherence-config-drift',
          'error',
          'Proven and Signature modes must use the exact canonical coherence configuration of the selected biome.',
          'Omit coherenceConfig or set it to null to use the canonical configuration.',
        ));
      }
    }
    if (!effectiveCoherence.assetStrategy) {
      effectiveCoherence = { ...effectiveCoherence, assetStrategy: 'zero-asset' };
    }
  }

  const coherenceErrors = [];
  const coherenceWarnings = [];

  if (effectiveCoherence) {
    const coherenceConflicts = checkCoherence(effectiveCoherence);
    for (const c of coherenceConflicts) {
      if (c.severity === 'error') {
        coherenceErrors.push(c);
      } else if (c.severity === 'warn') {
        coherenceWarnings.push(c);
      }
    }
  }

  // Validate coherenceOverrides
  const overrides = spec.coherenceOverrides || [];
  if (!Array.isArray(overrides)) {
    out.push(conflict(
      'coherence-overrides-invalid',
      'error',
      'coherenceOverrides must be an array.',
      'Provide an array for coherenceOverrides.',
    ));
  } else {
    const seenRules = new Set();
    const activeCoherenceErrorRules = new Set(coherenceErrors.map((e) => e.rule));

    for (const ov of overrides) {
      if (!ov || typeof ov !== 'object' || typeof ov.rule !== 'string' || typeof ov.reason !== 'string' || ov.reason.trim() === '') {
        out.push(conflict(
          'coherence-override-entry-invalid',
          'error',
          'Every coherence override entry must be an object with a rule string and a non-empty reason string.',
          'Provide { rule: string, reason: string }.',
        ));
        continue;
      }
      if (seenRules.has(ov.rule)) {
        out.push(conflict(
          'coherence-override-duplicate',
          'error',
          `Duplicate coherence override for rule '${ov.rule}'.`,
          'Provide at most one override per rule.',
        ));
      }
      seenRules.add(ov.rule);

      if (!activeCoherenceErrorRules.has(ov.rule)) {
        out.push(conflict(
          'coherence-override-unused',
          'error',
          `Coherence override '${ov.rule}' is unused because no such coherence error was raised.`,
          'Remove unused coherence overrides.',
        ));
      }
    }

    // Require matching override for every un-overridden coherence error
    for (const err of coherenceErrors) {
      if (!seenRules.has(err.rule)) {
        out.push(err);
      }
    }
  }

  // 7. Validate extraSectionMarkdown
  const selExtra = Array.isArray(selection.extraSections) ? selection.extraSections : [];
  const extraMarkdown = spec.extraSectionMarkdown;

  if (selExtra.length > 0) {
    if (!extraMarkdown || typeof extraMarkdown !== 'object' || Array.isArray(extraMarkdown)) {
      out.push(conflict(
        'extra-section-markdown-required',
        'error',
        'extraSectionMarkdown object is required when extraSections are selected.',
        `Provide extraSectionMarkdown object with keys: ${selExtra.join(', ')}.`,
      ));
    } else {
      const markdownKeys = Object.keys(extraMarkdown);
      for (const sec of selExtra) {
        if (!markdownKeys.includes(sec)) {
          out.push(conflict(
            'extra-section-markdown-missing',
            'error',
            `Missing extraSectionMarkdown body for selected extra section '${sec}'.`,
            `Provide markdown body for '${sec}'.`,
          ));
        }
      }
      for (const k of markdownKeys) {
        if (!selExtra.includes(k)) {
          out.push(conflict(
            'extra-section-markdown-unselected',
            'error',
            `extraSectionMarkdown contains body for unselected section '${k}'.`,
            'Remove unselected section bodies from extraSectionMarkdown.',
          ));
        }
      }
      for (const [k, bodyText] of Object.entries(extraMarkdown)) {
        if (selExtra.includes(k)) {
          if (typeof bodyText !== 'string' || bodyText.trim() === '') {
            out.push(conflict(
              'extra-section-body-empty',
              'error',
              `extraSectionMarkdown body for '${k}' must be a non-empty string.`,
              'Provide non-empty markdown content.',
            ));
          } else {
            if (/\{\{[A-Z0-9_]+(?::[^}]*)?\}\}/.test(bodyText)) {
              out.push(conflict(
                'extra-section-unresolved-token',
                'error',
                `extraSectionMarkdown for '${k}' contains unresolved tokens.`,
                'Remove or resolve all {{TOKEN}} tags.',
              ));
            }
            if (/\$\{([A-Za-z0-9_]+)\}/.test(bodyText)) {
              out.push(conflict(
                'extra-section-template-leak',
                'error',
                `extraSectionMarkdown for '${k}' contains \${} template literal leaks.`,
                'Remove \${} leaks.',
              ));
            }
            if (/<!--\/?SECTION:?[a-z0-9-]*-->/.test(bodyText)) {
              out.push(conflict(
                'extra-section-stray-marker',
                'error',
                `extraSectionMarkdown for '${k}' contains stray section markers.`,
                'Remove section markers.',
              ));
            }
            if (/TODO/i.test(bodyText)) {
              out.push(conflict(
                'extra-section-todo',
                'error',
                `extraSectionMarkdown for '${k}' contains TODO placeholder text.`,
                'Remove TODO placeholders.',
              ));
            }
          }
        }
      }
    }
  } else {
    if (extraMarkdown && typeof extraMarkdown === 'object' && Object.keys(extraMarkdown).length > 0) {
      out.push(conflict(
        'extra-section-markdown-unselected',
        'error',
        'extraSectionMarkdown contains bodies for sections when no extraSections are selected.',
        'Set extraSectionMarkdown to {} or omit when extraSections is [].',
      ));
    }
  }

  return out;
}

/**
 * Assemble a complete, self-contained implementation brief from an assembly spec.
 */
export function assembleBrief(spec, options = {}) {
  const findings = validateAssemblySpec(spec, options);
  const errors = findings.filter((f) => f.severity === 'error');
  if (errors.length > 0) {
    const err = new Error(`Assembly specification validation failed with ${errors.length} error(s): ${errors.map((e) => e.message).join(' | ')}`);
    err.findings = findings;
    throw err;
  }

  const rootDir = options.rootDir ? path.resolve(options.rootDir) : path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.join(rootDir, 'TEMPLATE.md');
  const templateText = fs.readFileSync(templatePath, 'utf8');

  const catalog = loadReferenceCatalog(options);
  const selection = spec.selection;

  // Resolve values
  const baseShowcaseObj = selection.baseShowcase && catalog.showcases[selection.baseShowcase] ? catalog.showcases[selection.baseShowcase] : null;
  const isWholeShowcase = selection.path === 'showcase' && (selection.creativeMode === 'proven' || selection.creativeMode === 'signature');

  let projectName = spec.projectName;
  if (!projectName && isWholeShowcase && baseShowcaseObj) {
    projectName = baseShowcaseObj.projectName;
  }
  const fileName = `${projectName.replace(/-/g, '_')}_TECHDEMO_PROMPT.md`;

  const creativeModeTitle = selection.creativeMode.charAt(0).toUpperCase() + selection.creativeMode.slice(1);

  const biome = catalog.biomes[selection.biome];
  const mechanic = catalog.mechanics[selection.mechanic];
  const archetype = catalog.archetypes[selection.archetype];
  const camera = catalog.cameras[selection.camera];
  const profile = catalog.renderingProfiles[selection.renderingProfile];

  // Effective coherence config
  let effectiveCoherence = spec.coherenceConfig;
  if (!effectiveCoherence) {
    effectiveCoherence = biome.coherenceConfig;
  }
  if (!effectiveCoherence.assetStrategy) {
    effectiveCoherence = { ...effectiveCoherence, assetStrategy: 'zero-asset' };
  }

  const renderingParadigm = effectiveCoherence.paradigm === 'photoreal' ? 'AAA Photoreal' : 'Ghibli-Style Painterly Anime';

  let coreInteractionSentence = spec.coreInteractionSentence;
  if (!coreInteractionSentence && isWholeShowcase && baseShowcaseObj) {
    coreInteractionSentence = baseShowcaseObj.coreInteractionSentence;
  }

  // Signature Moment
  let signatureMomentText = '';
  if (selection.creativeMode === 'proven') {
    signatureMomentText = 'Do not add an independent novelty behavior. Treat the configured centrepiece mechanic and its strongest existing visual consequence as the signature shot. Improve only composition, timing, shading, and polish within the systems already specified.';
  } else {
    const userSparkText = selection.signatureMoment.text;
    const reusedSys = selection.signatureMoment.reusedSystem;
    signatureMomentText = `${userSparkText}\n\nThis behavior reuses the ${reusedSys} system, is controlled by the ENABLE_SIGNATURE_MOMENT toggle in src/core/settings.js, and is visible in the mechanic verification pose (window.__demo.setPose('mechanic')).`;
  }

  // Target browser and hardware
  let targetHardware = 'Chrome stable on Windows 11, RTX-class GPU, 2560×1440';
  if (isWholeShowcase && baseShowcaseObj) {
    targetHardware = baseShowcaseObj.targetBrowserAndHardware;
  }
  if (selection.camera === 'XR') {
    targetHardware = 'Chrome stable on Windows 11 with a PC-tethered headset, 90 Hz per eye, RTX-class GPU';
  }

  // Format Approved Palette Table
  const paletteRows = effectiveCoherence.palette.map((entry) => `| ${entry.role} | \`${entry.hex}\` | ${entry.area} |`);
  const paletteTable = `| Role | Hex | Area |\n|---|---|---|\n${paletteRows.join('\n')}`;

  const materialBehavioursWithPalette = `${biome.tokens.MATERIAL_BEHAVIOURS}\n\n**Approved Palette:**\n\n${paletteTable}`;

  // Format State Channel Contract
  const hasStateBuffer = selection.includedSections && selection.includedSections.includes('state-buffer');
  const stateChannelContractText = hasStateBuffer ? formatStateChannelContract(selection) : '';

  // Mechanic description adjustment if state-buffer omitted
  let mechanicDescriptionText = mechanic.tokens.CENTREPIECE_DESCRIPTION;
  if (!hasStateBuffer) {
    // Remove **Writes:** paragraph and persistent promises
    mechanicDescriptionText = mechanicDescriptionText.replace(/\*\*Writes:\*\*[\s\S]*?(?=\n\n|\n-|$)/, '').trim();
    mechanicDescriptionText = mechanicDescriptionText.replace(/A completed run stays visible from across the field\./g, '');
    mechanicDescriptionText = mechanicDescriptionText.replace(/so the sweep path stays legible for roughly 50 s\./g, '');
    mechanicDescriptionText = mechanicDescriptionText.replace(/its track lingering\./g, '');
    mechanicDescriptionText = mechanicDescriptionText.trim();
  }

  // Character Recipe Composition
  const charRecipePath = path.join(rootDir, 'references', 'character-recipe.md');
  const charRecipeFull = fs.readFileSync(charRecipePath, 'utf8');
  // Strip top-level title # Character recipe — procedural humanoid
  const charRecipeBody = charRecipeFull.replace(/^# Character recipe[^\n]*\n/, '').trim();

  let ringCountAdjustment = '';
  if (selection.camera === 'First Person') {
    ringCountAdjustment = '\n\n**First Person Camera Adjustment:** Raise the hand chain to 12 ring segments.';
  } else if (selection.camera === 'XR') {
    ringCountAdjustment = '\n\n**XR Camera Adjustment:** Ring counts rise to 20–24 segments on the body and 10–12 on hands and feet.';
  }

  const singleTouchdownSentence = 'These effects fire from the single touchdown call site in Part 5, reading plantedPos[leg], and from nowhere else.';

  const fullCharacterRecipe = `${charRecipeBody}\n\n### Archetype — ${selection.archetype}\n\n${archetype.body}\n\n### Foot interaction — ${biome.tokens.PRIMARY_MATERIAL_NAME}\n\n${biome.footInteraction}\n\n${singleTouchdownSentence}${ringCountAdjustment}`;

  // Format CENTREPIECE_INPUT cleanly
  let formattedInput = mechanic.tokens.CENTREPIECE_INPUT;
  if (/^hold\s+/i.test(formattedInput)) {
    formattedInput = 'Hold ' + formattedInput.replace(/^hold\s+/i, '');
  } else if (/^press\s+/i.test(formattedInput)) {
    formattedInput = 'Press ' + formattedInput.replace(/^press\s+/i, '');
  }

  // Map 38 Tokens
  const tokenMap = {
    PROJECT_NAME: projectName,
    CREATIVE_MODE: creativeModeTitle,
    RENDERING_PARADIGM: renderingParadigm,
    PRIMARY_ENVIRONMENT: biome.tokens.PRIMARY_ENVIRONMENT,
    CORE_INTERACTION_SENTENCE: coreInteractionSentence,
    SIGNATURE_MOMENT: signatureMomentText,
    ENGINE: profile.engine,
    SHADER_LANG: profile.shaderLang,
    SHADER_LANG_EXT: profile.shaderLangExt,
    MATERIAL_API: profile.materialApi,
    TARGET_BROWSER_AND_HARDWARE: targetHardware,
    ASSET_STRATEGY: '100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)',
    TERRAIN_PHILOSOPHY_SENTENCE: biome.tokens.TERRAIN_PHILOSOPHY_SENTENCE,
    TERRAIN_NOISE_LAYERS: biome.tokens.TERRAIN_NOISE_LAYERS,
    TERRAIN_LANDMARKS: biome.tokens.TERRAIN_LANDMARKS,
    FAR_FIELD_TREATMENT: biome.tokens.FAR_FIELD_TREATMENT,
    PRIMARY_MATERIAL_NAME: biome.tokens.PRIMARY_MATERIAL_NAME,
    NAIVE_DEFAULT: biome.tokens.NAIVE_DEFAULT,
    MATERIAL_BEHAVIOURS: materialBehavioursWithPalette,
    DEFORMATION_TYPE: biome.tokens.DEFORMATION_TYPE,
    WIND_FIELD_ARCH: biome.tokens.WIND_FIELD_ARCH,
    STATE_BUFFER_COVERAGE: biome.tokens.STATE_BUFFER_COVERAGE,
    STATE_BUFFER_TEXEL_SIZE: biome.tokens.STATE_BUFFER_TEXEL_SIZE,
    STATE_BUFFER_CHANNELS: biome.tokens.STATE_BUFFER_CHANNELS,
    STATE_CHANNEL_CONTRACT: stateChannelContractText,
    RECOVERY_MECHANISM: biome.tokens.RECOVERY_MECHANISM,
    DEFORMATION_MARKS: biome.tokens.DEFORMATION_MARKS,
    RECOVERY_OUTCOME: biome.tokens.RECOVERY_OUTCOME,
    GRASS_SYSTEM_SPEC: biome.tokens.GRASS_SYSTEM_SPEC,
    CHARACTER_RECIPE: fullCharacterRecipe,
    CENTREPIECE_MECHANIC: mechanic.tokens.CENTREPIECE_MECHANIC,
    CENTREPIECE_INPUT: formattedInput,
    CENTREPIECE_DESCRIPTION: mechanicDescriptionText,
    ABILITY_1_NAME: mechanic.tokens.ABILITY_1_NAME,
    ABILITY_2_NAME: mechanic.tokens.ABILITY_2_NAME,
    ABILITY_3_NAME: mechanic.tokens.ABILITY_3_NAME,
    AUDIO_ENGINE_SPEC: biome.tokens.AUDIO_ENGINE_SPEC,
    ATMOSPHERIC_LIFE_SPEC: biome.tokens.ATMOSPHERIC_LIFE_SPEC,
  };

  // Perform Token Replacement
  let result = templateText.replace(/Hold\s+\{\{CENTREPIECE_INPUT[^}]*\}\}/g, formattedInput);
  result = result.replace(/\{\{([A-Z0-9_]+)(?:[^}]*)?\}\}/g, (match, tokenKey) => {
    if (tokenMap[tokenKey] !== undefined) {
      return tokenMap[tokenKey];
    }
    return match;
  });

  // Handle Marked Sections
  const coreSections = ['state-buffer', 'vegetation', 'audio'];
  for (const sec of coreSections) {
    const startMarker = `<!--SECTION:${sec}-->`;
    const endMarker = `<!--/SECTION-->`;
    const isKept = selection.includedSections.includes(sec);

    if (isKept) {
      // Remove marker lines, keep body
      result = result.replace(new RegExp(`${startMarker}\\r?\\n?`, 'g'), '');
      result = result.replace(new RegExp(`${endMarker}\\r?\\n?`, 'g'), '');
    } else {
      // Remove entire block including markers and body
      const blockRegex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\r?\\n?`, 'g');
      result = result.replace(blockRegex, '');
    }
  }

  // Camera Substitution in §2.6
  // Replace paragraph starting with "Use third-person, action-MMO framing..."
  const oldThirdPersonRegex = /Use third-person, action-MMO framing[\s\S]*?(?=\*\*Initial Spawn Rule:\*\*)/;
  let cameraReplacementBody = camera.body;

  if (selection.camera === 'XR') {
    if (!cameraReplacementBody.includes('Budget the character at roughly double the third-person cost')) {
      cameraReplacementBody += '\n\nBudget the character at roughly double the third-person cost and take it out of the far field.';
    }
  }

  result = result.replace(oldThirdPersonRegex, `${cameraReplacementBody}\n\n`);

  // Add verification framing instruction to §6 for non-third-person cameras
  if (selection.camera === 'First Person' || selection.camera === 'Cinematic' || selection.camera === 'XR') {
    const verifSentence = 'The window.__demo.setPose() hook must put the scene into a flat-screen, third-person verification framing where the character occupies 3–20% of the frame.';
    if (!result.includes(verifSentence)) {
      result = result.replace(/Verification[\s\S]*?will fail the build without it\./, (m) => `${m} ${verifSentence}`);
    }
  }

  // Extra Sections (§2.9 Weather, §2.10 Water Bodies, §2.11 Architecture, §2.12 Destructibility)
  const extraMarkdown = spec.extraSectionMarkdown || {};
  const extraSectionsOrdered = [
    { key: 'weather', num: '2.9', title: 'Weather' },
    { key: 'water-bodies', num: '2.10', title: 'Water Bodies' },
    { key: 'architecture', num: '2.11', title: 'Architecture' },
    { key: 'destructibility', num: '2.12', title: 'Destructibility' },
  ];

  let extraSectionsText = '';
  for (const item of extraSectionsOrdered) {
    if (selection.extraSections.includes(item.key) && extraMarkdown[item.key]) {
      extraSectionsText += `\n\n### ${item.num} ${item.title}\n\n${extraMarkdown[item.key].trim()}`;
    }
  }

  if (extraSectionsText) {
    // Insert after §2.8 Audio Engine & Atmospheric Life (or end of §2.7 if audio omitted)
    const audioSecEnd = result.indexOf('---', result.indexOf('## 2. Systems'));
    if (audioSecEnd !== -1) {
      result = result.slice(0, audioSecEnd) + extraSectionsText + '\n\n' + result.slice(audioSecEnd);
    } else {
      result += '\n' + extraSectionsText;
    }
  }

  // Append Assembly Decisions
  const coherenceWarnings = checkCoherence(effectiveCoherence).filter((c) => c.severity === 'warn');
  const overrides = spec.coherenceOverrides || [];

  let assemblyDecisionsText = `\n\n## Assembly Decisions\n\n` +
    `- **Creative Mode:** ${creativeModeTitle}\n` +
    `- **Path and Base Showcase:** ${selection.path}${selection.baseShowcase ? ` (${selection.baseShowcase})` : ''}\n` +
    `- **Changed Major Axes:** ${Array.isArray(selection.changedAxes) && selection.changedAxes.length > 0 ? selection.changedAxes.join(', ') : 'none'}\n` +
    `- **Creative Spark:** ${spec.creativeSpark || (selection.creativeMode === 'proven' ? 'none' : 'surprise me')}\n` +
    `- **Signature Moment:** ${selection.signatureMoment && selection.signatureMoment.enabled ? `${selection.signatureMoment.text} (Reused system: ${selection.signatureMoment.reusedSystem})` : 'disabled'}\n` +
    `- **Rendering Profile:** ${selection.renderingProfile}\n` +
    `- **Included Sections:** ${selection.includedSections.length > 0 ? selection.includedSections.join(', ') : 'none'}\n` +
    `- **Extra Sections:** ${selection.extraSections.length > 0 ? selection.extraSections.join(', ') : 'none'}\n` +
    `- **State Channel Contract:** ${hasStateBuffer ? Object.keys(selection.stateChannelContract).join(', ') : 'none (state-buffer omitted)'}\n` +
    `- **Selection Validation:** clean (0 errors, 0 warnings)\n` +
    `- **Coherence Validation:** clean (${coherenceWarnings.length} warning(s))`;

  if (overrides.length > 0) {
    assemblyDecisionsText += `\n\n## Deliberate Deviations\n\n` +
      overrides.map((o) => `- **${o.rule}:** ${o.reason}`).join('\n');
  }

  result += assemblyDecisionsText + '\n';

  // Final Validation
  const briefVal = validateBrief(result);
  if (!briefVal.ok) {
    throw new Error(`Assembled brief failed final validation: ${briefVal.problems.join(' | ')}`);
  }

  // Check for forbidden active reference-file links
  if (/references\/[a-z0-9_-]+\.md|TEMPLATE\.md|selection\.mjs|check\.mjs/.test(result)) {
    throw new Error('Assembled brief contains active reference file dependencies');
  }

  return {
    projectName,
    fileName,
    brief: result,
    warnings: coherenceWarnings,
  };
}

/**
 * Safely write the generated project bundle to output directory.
 */
export function writeBundle(spec, outDir, options = {}) {
  const { projectName, fileName, brief, warnings } = assembleBrief(spec, options);
  const targetDir = path.resolve(outDir);

  const targetFiles = [
    path.join(targetDir, fileName),
    path.join(targetDir, 'HANDOFF.md'),
    path.join(targetDir, 'verify', 'README.md'),
    path.join(targetDir, 'verify', 'gates.mjs'),
    path.join(targetDir, 'verify', 'verify_demo.mjs'),
  ];

  // Destination collision preflight
  const existingCollisions = targetFiles.filter((f) => fs.existsSync(f));
  if (existingCollisions.length > 0 && !options.force) {
    const err = new Error(`Destination collision: target file '${existingCollisions[0]}' already exists. Use --force to overwrite.`);
    err.code = 'EEXIST';
    throw err;
  }

  // Create directories
  fs.mkdirSync(path.join(targetDir, 'verify'), { recursive: true });

  // Write brief
  fs.writeFileSync(path.join(targetDir, fileName), brief, 'utf8');

  // Write HANDOFF.md
  const builderAgentLabel = spec.builderAgent || 'the coding agent named by the user';
  const handoffContent = `# Handoff\n\n` +
    `- **Brief:** \`${fileName}\` — give this file to the coding agent, whole. It needs nothing else.\n` +
    `- **Agent:** ${builderAgentLabel}\n` +
    `- **When the agent says it is done:** \`npm install -D playwright pngjs && node verify/verify_demo.mjs .\` \n` +
    `- **On failure:** the verifier lists each problem. Hand the list back to the agent and have it fix and re-run. Do not accept the demo with failures outstanding.\n` +
    `- **Frame times are reported, not gated** — a slow demo is a decision for you, not a build failure.\n` +
    `- **Engine version pinning:** When installing the engine during a generated project build, pin the exact resolved engine version in \`package.json\` and the lockfile, record that version in \`DECISIONS.md\`, and avoid floating CDN imports.\n` +
    `- **Mode decisions:** Record in \`DECISIONS.md\`: creative mode, base showcase or custom path, creative spark or surprise me, final Signature Moment, existing system reused by Signature Moment, any Experimental changed axis, compatibility checks performed, and permitted implementation deviations.\n`;

  fs.writeFileSync(path.join(targetDir, 'HANDOFF.md'), handoffContent, 'utf8');

  // Copy verify directory from repo root
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : path.dirname(fileURLToPath(import.meta.url));
  const verifySrc = path.join(rootDir, 'verify');

  for (const f of ['README.md', 'gates.mjs', 'verify_demo.mjs']) {
    const src = path.join(verifySrc, f);
    const dest = path.join(targetDir, 'verify', f);
    fs.copyFileSync(src, dest);
  }

  return {
    ok: true,
    projectName,
    fileName,
    outDir: targetDir,
    writtenFiles: targetFiles,
    warnings,
  };
}

function printUsageAndExit(code, toStderr = false) {
  const usage = `Usage:
  node assemble.mjs <assembly.json> --stdout
  node assemble.mjs <assembly.json> --out <directory> [--force]
  node assemble.mjs --help`;
  if (toStderr) {
    console.error(usage);
  } else {
    console.log(usage);
  }
  process.exit(code);
}

function runCli() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h') || args.includes('help')) {
    printUsageAndExit(args.length === 0 ? 2 : 0, args.length === 0);
  }

  const specFile = args[0];
  if (!specFile || specFile.startsWith('-')) {
    printUsageAndExit(2, true);
  }

  const stdoutFlag = args.includes('--stdout');
  const outIdx = args.indexOf('--out');
  const forceFlag = args.includes('--force');

  if ((stdoutFlag && outIdx !== -1) || (!stdoutFlag && outIdx === -1)) {
    printUsageAndExit(2, true);
  }

  let outDir = null;
  if (outIdx !== -1) {
    outDir = args[outIdx + 1];
    if (!outDir || outDir.startsWith('-')) {
      printUsageAndExit(2, true);
    }
  }

  // Check unknown flags
  const allowedFlags = ['--stdout', '--out', '--force'];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out') {
      i++;
      continue;
    }
    if (!allowedFlags.includes(arg)) {
      printUsageAndExit(2, true);
    }
  }

  let rawSpec;
  try {
    rawSpec = fs.readFileSync(specFile, 'utf8');
  } catch (err) {
    console.error(`Failed to read file '${specFile}': ${err.message}`);
    process.exit(2);
  }

  let spec;
  try {
    spec = JSON.parse(rawSpec);
  } catch (err) {
    console.error(`Failed to parse JSON in '${specFile}': ${err.message}`);
    process.exit(2);
  }

  if (stdoutFlag) {
    try {
      const { brief } = assembleBrief(spec);
      process.stdout.write(brief);
      process.exit(0);
    } catch (err) {
      if (err.findings) {
        const errors = err.findings.filter((f) => f.severity === 'error').length;
        const warnings = err.findings.filter((f) => f.severity === 'warn').length;
        console.log(JSON.stringify({ ok: false, errors, warnings, conflicts: err.findings }, null, 2));
        process.exit(1);
      }
      console.error(err.message);
      process.exit(1);
    }
  }

  if (outDir) {
    try {
      const result = writeBundle(spec, outDir, { force: forceFlag });
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (err) {
      if (err.code === 'EEXIST') {
        console.error(err.message);
        process.exit(2);
      }
      if (err.findings) {
        const errors = err.findings.filter((f) => f.severity === 'error').length;
        const warnings = err.findings.filter((f) => f.severity === 'warn').length;
        console.log(JSON.stringify({ ok: false, errors, warnings, conflicts: err.findings }, null, 2));
        process.exit(1);
      }
      console.error(err.message);
      process.exit(1);
    }
  }

  printUsageAndExit(2, true);
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase();
  } catch {
    return false;
  }
}

if (isMain()) {
  runCli();
}
