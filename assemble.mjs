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
  MECHANIC_WRITES,
  SHOWCASES,
  CORE_SECTIONS,
  EXTRA_SECTIONS,
  RENDERING_PROFILES,
} from './selection.mjs';
import { checkCoherence, validateBrief } from './check.mjs';
import { loadReferenceCatalog } from './reference-loader.mjs';
import {
  BUILD_CONTRACT_FILENAME,
  EVIDENCE_FILENAME,
  HANDOFF_FILENAME,
  createBuildContract,
  createCanonicalAssemblyModel,
  createEvidenceTemplate,
  renderContractSummary,
  renderHandoff,
  renderMilestoneInstructions,
  validateAssemblyArtifacts,
  validateBuildContract,
} from './build-contract.mjs';

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

const ALLOWED_COHERENCE_CONFIG_KEYS = [
  'paradigm',
  'assetStrategy',
  'materialBehaviours',
  'palette',
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
  const isBaseShowcasePath = (selection.path === 'showcase' || selection.path === 'base-showcase');
  const baseShowcaseObj = selection.baseShowcase && catalog.showcases[selection.baseShowcase] ? catalog.showcases[selection.baseShowcase] : null;
  const isWholeShowcase = selection.path === 'showcase' && (selection.creativeMode === 'proven' || selection.creativeMode === 'signature');

  // 3. Validate projectName
  if (spec.projectName !== undefined && spec.projectName !== null) {
    if (typeof spec.projectName !== 'string' || spec.projectName.trim() === '') {
      out.push(conflict(
        'project-name-invalid',
        'error',
        'Supplied projectName must be a non-empty string.',
        'Provide an upper-case hyphenated projectName or set to null/undefined to derive.',
      ));
    } else {
      if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(spec.projectName) || spec.projectName.includes('/') || spec.projectName.includes('\\') || spec.projectName.includes('..')) {
        out.push(conflict(
          'project-name-invalid',
          'error',
          `projectName '${spec.projectName}' is invalid. Must be upper-case, hyphenated safe name with no path separators or traversal.`,
          'Use upper-case letters, numbers, and single hyphens (e.g. "MY-DEMO").',
        ));
      }
    }
  } else {
    if (!isWholeShowcase || !baseShowcaseObj) {
      out.push(conflict(
        'project-name-required',
        'error',
        'projectName is required for Experimental assembly specifications.',
        'Provide an upper-case hyphenated projectName (e.g. "MY-PROJECT").',
      ));
    }
  }

  // 4. Validate coreInteractionSentence
  if (spec.coreInteractionSentence !== undefined && spec.coreInteractionSentence !== null) {
    if (typeof spec.coreInteractionSentence !== 'string' || spec.coreInteractionSentence.trim() === '') {
      out.push(conflict(
        'core-interaction-sentence-invalid',
        'error',
        'Supplied coreInteractionSentence must be a non-empty string.',
        'Provide a non-empty string or set to null/undefined to derive.',
      ));
    }
  } else {
    if (!isWholeShowcase || !baseShowcaseObj) {
      out.push(conflict(
        'core-interaction-sentence-required',
        'error',
        'coreInteractionSentence is required for Experimental assembly specifications.',
        'Provide a non-empty coreInteractionSentence string.',
      ));
    }
  }

  // 5. Validate creativeSpark
  if (spec.creativeSpark !== undefined && spec.creativeSpark !== null) {
    if (typeof spec.creativeSpark !== 'string') {
      out.push(conflict(
        'creative-spark-invalid-type',
        'error',
        'creativeSpark must be a string when supplied.',
        'Provide a string for creativeSpark or omit it.',
      ));
    } else if (selection.creativeMode === 'proven' && spec.creativeSpark.trim() !== '') {
      out.push(conflict(
        'proven-creative-spark-forbidden',
        'error',
        'Proven mode must not have a creative spark.',
        'Omit creativeSpark or set it to null/empty in Proven mode.',
      ));
    }
  }

  // 6. Validate builderAgent
  if (spec.builderAgent !== undefined && spec.builderAgent !== null) {
    if (typeof spec.builderAgent !== 'string' || spec.builderAgent.trim() === '' || /[\r\n]/.test(spec.builderAgent)) {
      out.push(conflict(
        'builder-agent-invalid',
        'error',
        'builderAgent must be a non-empty, single-line string when supplied.',
        'Provide a single-line string for builderAgent.',
      ));
    }
  }

  // 7. Validate coherenceConfig & structural errors
  const biomeObj = selection.biome ? catalog.biomes[selection.biome] : null;
  const canonicalCoherence = biomeObj ? biomeObj.coherenceConfig : null;

  let coherenceErrors = [];
  let coherenceWarnings = [];
  let isStructuralCoherenceError = false;

  if (spec.coherenceConfig !== undefined && spec.coherenceConfig !== null) {
    if (typeof spec.coherenceConfig !== 'object' || Array.isArray(spec.coherenceConfig)) {
      out.push(conflict(
        'coherence-config-invalid',
        'error',
        'coherenceConfig must be a plain object when supplied.',
        'Provide a plain object for coherenceConfig.',
      ));
      isStructuralCoherenceError = true;
    } else {
      const unknownCohKeys = Object.keys(spec.coherenceConfig).filter((k) => !ALLOWED_COHERENCE_CONFIG_KEYS.includes(k));
      if (unknownCohKeys.length > 0) {
        out.push(conflict(
          'coherence-config-unknown-key',
          'error',
          `coherenceConfig contains unknown properties: ${unknownCohKeys.join(', ')}.`,
          `Allowed properties: ${ALLOWED_COHERENCE_CONFIG_KEYS.join(', ')}.`,
        ));
        isStructuralCoherenceError = true;
      }

      if (spec.coherenceConfig.assetStrategy !== undefined && spec.coherenceConfig.assetStrategy !== 'zero-asset') {
        out.push(conflict(
          'coherence-asset-strategy-invalid',
          'error',
          `assetStrategy in coherenceConfig must be 'zero-asset', got '${spec.coherenceConfig.assetStrategy}'.`,
          "Set assetStrategy: 'zero-asset'.",
        ));
        isStructuralCoherenceError = true;
      }

      const cfg = spec.coherenceConfig;
      if (!['photoreal', 'painterly'].includes(cfg.paradigm)) {
        out.push(conflict(
          'coherence-paradigm-invalid',
          'error',
          `paradigm in coherenceConfig must be 'photoreal' or 'painterly', got '${cfg.paradigm}'.`,
          "Set paradigm to 'photoreal' or 'painterly'.",
        ));
        isStructuralCoherenceError = true;
      }

      if (typeof cfg.materialBehaviours !== 'string' || cfg.materialBehaviours.trim() === '') {
        out.push(conflict(
          'coherence-material-behaviours-invalid',
          'error',
          'materialBehaviours in coherenceConfig must be a non-empty string.',
          'Provide non-empty materialBehaviours.',
        ));
        isStructuralCoherenceError = true;
      }

      if (!Array.isArray(cfg.palette) || cfg.palette.length === 0) {
        out.push(conflict(
          'palette-required',
          'error',
          'palette in coherenceConfig must be a non-empty array.',
          'Provide a non-empty palette array.',
        ));
        isStructuralCoherenceError = true;
      } else {
        let hasLargeArea = false;
        for (let i = 0; i < cfg.palette.length; i++) {
          const entry = cfg.palette[i];
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            out.push(conflict(
              'palette-entry-invalid',
              'error',
              `Palette entry at index ${i} must be a plain object.`,
              'Provide { role, hex, area } object.',
            ));
            isStructuralCoherenceError = true;
            continue;
          }
          if (typeof entry.role !== 'string' || entry.role.trim() === '') {
            out.push(conflict(
              'palette-role-invalid',
              'error',
              `Palette entry at index ${i} has invalid role.`,
              'Provide non-empty role string.',
            ));
            isStructuralCoherenceError = true;
          }
          if (typeof entry.hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(entry.hex)) {
            out.push(conflict(
              'palette-hex-invalid',
              'error',
              `Palette entry at index ${i} has invalid hex '${entry.hex}'.`,
              'Use valid 6-character hex format e.g. "#f0f4f8".',
            ));
            isStructuralCoherenceError = true;
          }
          if (!['large', 'medium', 'accent'].includes(entry.area)) {
            out.push(conflict(
              'palette-area-invalid',
              'error',
              `Palette entry at index ${i} has invalid area '${entry.area}'.`,
              "Set area to 'large', 'medium', or 'accent'.",
            ));
            isStructuralCoherenceError = true;
          }
          if (entry.area === 'large') {
            hasLargeArea = true;
          }
        }
        if (!hasLargeArea) {
          out.push(conflict(
            'palette-large-area-required',
            'error',
            'Palette must contain at least one large-area entry.',
            'Assign area: "large" to at least one primary background/surface entry.',
          ));
          isStructuralCoherenceError = true;
        }
      }

      const isWholeShowcase = selection.path === 'showcase' && (selection.creativeMode === 'proven' || selection.creativeMode === 'signature');
      if (isWholeShowcase && canonicalCoherence) {
        const sameParadigm = cfg.paradigm === canonicalCoherence.paradigm;
        const sameBehaviours = cfg.materialBehaviours === canonicalCoherence.materialBehaviours;
        const samePalette = JSON.stringify(cfg.palette) === JSON.stringify(canonicalCoherence.palette);
        if (!sameParadigm || !sameBehaviours || !samePalette) {
          out.push(conflict(
            'proven-signature-coherence-config-drift',
            'error',
            'Proven and Signature modes must use the exact canonical coherence configuration of the selected biome.',
            'Omit coherenceConfig or set it to null to use the canonical configuration.',
          ));
        }
      }

      if (!isStructuralCoherenceError) {
        const coherenceConflicts = checkCoherence({
          paradigm: cfg.paradigm,
          assetStrategy: 'zero-asset',
          materialBehaviours: cfg.materialBehaviours,
          palette: cfg.palette,
        });
        for (const c of coherenceConflicts) {
          if (c.severity === 'error') coherenceErrors.push(c);
          else if (c.severity === 'warn') coherenceWarnings.push(c);
        }
      }
    }
  } else {
    // Using canonical coherence config
    if (canonicalCoherence) {
      const coherenceConflicts = checkCoherence({
        paradigm: canonicalCoherence.paradigm,
        assetStrategy: 'zero-asset',
        materialBehaviours: canonicalCoherence.materialBehaviours,
        palette: canonicalCoherence.palette,
      });
      for (const c of coherenceConflicts) {
        if (c.severity === 'error') coherenceErrors.push(c);
        else if (c.severity === 'warn') coherenceWarnings.push(c);
      }
    }
  }

  // 8. Validate coherenceOverrides
  const overrides = spec.coherenceOverrides;
  if (overrides !== undefined && overrides !== null) {
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

      for (let i = 0; i < overrides.length; i++) {
        const ov = overrides[i];
        if (!ov || typeof ov !== 'object' || Array.isArray(ov)) {
          out.push(conflict(
            'coherence-override-entry-invalid',
            'error',
            `coherenceOverrides entry at index ${i} must be a plain object.`,
            'Provide { rule: string, reason: string }.',
          ));
          continue;
        }

        const allowedOvKeys = ['rule', 'reason'];
        const unknownOvProps = Object.keys(ov).filter((k) => !allowedOvKeys.includes(k));
        if (unknownOvProps.length > 0) {
          out.push(conflict(
            'coherence-override-entry-unknown',
            'error',
            `coherenceOverrides entry for '${ov.rule || i}' contains unknown properties: ${unknownOvProps.join(', ')}.`,
            "Override entries may contain only 'rule' and 'reason'.",
          ));
        }

        if (typeof ov.rule !== 'string' || typeof ov.reason !== 'string' || ov.reason.trim() === '') {
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

      // Require matching override for un-overridden coherence error
      for (const err of coherenceErrors) {
        if (!seenRules.has(err.rule)) {
          out.push(err);
        }
      }
    }
  } else {
    // No overrides provided: un-overridden coherence errors are errors
    for (const err of coherenceErrors) {
      out.push(err);
    }
  }

  // Include policy warnings in findings
  for (const warn of coherenceWarnings) {
    out.push(warn);
  }

  // 9. Validate extraSectionMarkdown
  const selExtra = Array.isArray(selection.extraSections) ? selection.extraSections : [];
  const extraMarkdown = spec.extraSectionMarkdown;

  if (extraMarkdown !== undefined && extraMarkdown !== null) {
    if (typeof extraMarkdown !== 'object' || Array.isArray(extraMarkdown)) {
      out.push(conflict(
        'extra-section-markdown-invalid',
        'error',
        'extraSectionMarkdown must be a plain object when supplied.',
        'Provide a plain object for extraSectionMarkdown.',
      ));
    } else if (selExtra.length > 0) {
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
    } else {
      if (Object.keys(extraMarkdown).length > 0) {
        out.push(conflict(
          'extra-section-markdown-unselected',
          'error',
          'extraSectionMarkdown contains bodies for sections when no extraSections are selected.',
          'Set extraSectionMarkdown to {} or omit when extraSections is [].',
        ));
      }
    }
  } else {
    if (selExtra.length > 0) {
      out.push(conflict(
        'extra-section-markdown-required',
        'error',
        'extraSectionMarkdown object is required when extraSections are selected.',
        `Provide extraSectionMarkdown object with keys: ${selExtra.join(', ')}.`,
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

  const baseShowcaseObj = selection.baseShowcase && catalog.showcases[selection.baseShowcase] ? catalog.showcases[selection.baseShowcase] : null;

  let projectName = spec.projectName;
  if (!projectName && baseShowcaseObj) {
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
  if (!coreInteractionSentence && baseShowcaseObj) {
    coreInteractionSentence = baseShowcaseObj.coreInteractionSentence;
  }

  // Creative Spark
  let creativeSparkVal = 'surprise me';
  if (selection.creativeMode === 'proven') {
    creativeSparkVal = 'none';
  } else if (typeof spec.creativeSpark === 'string' && spec.creativeSpark.trim() !== '') {
    creativeSparkVal = spec.creativeSpark.trim();
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
  if (baseShowcaseObj) {
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
  const hasAudio = selection.includedSections && selection.includedSections.includes('audio');
  const stateChannelContractText = hasStateBuffer ? formatStateChannelContract(selection) : '';

  // Mechanic description & ability text adjustment if state-buffer omitted
  let mechanicDescriptionText = mechanic.tokens.CENTREPIECE_DESCRIPTION;
  let ability1Text = mechanic.tokens.ABILITY_1_NAME;
  let ability2Text = mechanic.tokens.ABILITY_2_NAME;
  let ability3Text = mechanic.tokens.ABILITY_3_NAME;

  if (!hasStateBuffer) {
    // Remove **Writes:** paragraph and persistent promises across ALL 5 mechanics
    mechanicDescriptionText = mechanicDescriptionText.replace(/\*\*Writes:\*\*[\s\S]*?(?=\n\n|\n-|$)/, '').trim();
    mechanicDescriptionText = mechanicDescriptionText.replace(/A completed run stays visible from across the field\./g, '');
    mechanicDescriptionText = mechanicDescriptionText.replace(/so the sweep path stays legible for roughly 50 s\./g, '');
    mechanicDescriptionText = mechanicDescriptionText.replace(/both of which write into the shared buffers[\s\S]*?as the character is/g, 'both of which integrate into the scene, so it is embedded in the world exactly as the character is');
    mechanicDescriptionText = mechanicDescriptionText.trim();

    if (selection.mechanic === 'Summon Vehicle') {
      ability2Text = ability2Text.replace(/,\s*and a persistent track\./g, '.').replace(/and a persistent track/g, '');
      ability3Text = ability3Text.replace(/,\s*its track lingering\./g, '.').replace(/its track lingering/g, '');
    }
  }

  // Character Recipe Composition
  const charRecipePath = path.join(rootDir, 'references', 'character-recipe.md');
  const charRecipeFull = fs.readFileSync(charRecipePath, 'utf8');
  const charRecipeBody = charRecipeFull.replace(/^# Character recipe[^\n]*\n/, '').trim();

  let ringCountAdjustment = '';
  if (selection.camera === 'First Person') {
    ringCountAdjustment = '\n\n**First Person Camera Adjustment:** Raise the hand chain to 12 ring segments.';
  } else if (selection.camera === 'XR') {
    ringCountAdjustment = '\n\n**XR Camera Adjustment:** Ring counts rise to 20–24 segments on the body and 10–12 on hands and feet.';
  }

  let singleTouchdownSentence = 'These effects fire from the single touchdown call site in Part 5, reading plantedPos[leg], and from nowhere else.';
  const omittedNotes = [];
  if (!hasStateBuffer) {
    omittedNotes.push('Note: state-buffer is omitted; stateBuffer.addSplat(...) is a disabled/no-op integration hook and must not cause a state buffer to be instantiated.');
  }
  if (!hasAudio) {
    omittedNotes.push('Note: audio is omitted; audio.footfall(...) is a disabled/no-op integration hook and must not cause an audio system to be instantiated.');
  }

  if (omittedNotes.length > 0) {
    singleTouchdownSentence += ` (${omittedNotes.join(' ')})`;
  }

  const fullCharacterRecipe = `${charRecipeBody}\n\n### Archetype — ${selection.archetype}\n\n${archetype.body}\n\n### Foot interaction — ${biome.tokens.PRIMARY_MATERIAL_NAME}\n\n${biome.footInteraction}\n\n${singleTouchdownSentence}${ringCountAdjustment}`;

  // Format CENTREPIECE_INPUT cleanly
  let formattedInput = mechanic.tokens.CENTREPIECE_INPUT;
  if (/^hold\s+/i.test(formattedInput)) {
    formattedInput = 'Hold ' + formattedInput.replace(/^hold\s+/i, '');
  } else if (/^press\s+/i.test(formattedInput)) {
    formattedInput = 'Press ' + formattedInput.replace(/^press\s+/i, '');
  }

  const canonicalModel = createCanonicalAssemblyModel({
    projectName,
    fileName,
    selection,
    profile,
    effectiveCoherence,
    renderingParadigm,
    targetHardware,
    coreInteractionSentence,
    creativeSpark: creativeSparkVal,
    signatureMomentInstruction: signatureMomentText,
    biome,
    coherenceOverrides: spec.coherenceOverrides || [],
  });
  const buildContract = createBuildContract(canonicalModel);
  const contractValidation = validateBuildContract(buildContract);
  if (!contractValidation.valid) {
    throw new Error(`Generated build contract failed validation: ${contractValidation.errors.join(' | ')}`);
  }

  // Map 38 Tokens
  const tokenMap = {
    PROJECT_NAME: canonicalModel.project.name,
    CREATIVE_MODE: canonicalModel.selection.creativeMode.charAt(0).toUpperCase() + canonicalModel.selection.creativeMode.slice(1),
    RENDERING_PARADIGM: canonicalModel.project.renderingParadigm,
    PRIMARY_ENVIRONMENT: biome.tokens.PRIMARY_ENVIRONMENT,
    CORE_INTERACTION_SENTENCE: canonicalModel.project.coreInteractionSentence,
    SIGNATURE_MOMENT: canonicalModel.creative.signatureMoment.instruction,
    ENGINE: canonicalModel.project.engine,
    SHADER_LANG: canonicalModel.project.shaderLanguage,
    SHADER_LANG_EXT: canonicalModel.project.shaderLanguageExtension,
    MATERIAL_API: canonicalModel.project.materialApi,
    TARGET_BROWSER_AND_HARDWARE: canonicalModel.project.targetHardware,
    ASSET_STRATEGY: canonicalModel.project.assetStrategyText,
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
    ABILITY_1_NAME: ability1Text,
    ABILITY_2_NAME: ability2Text,
    ABILITY_3_NAME: ability3Text,
    AUDIO_ENGINE_SPEC: biome.tokens.AUDIO_ENGINE_SPEC,
    ATMOSPHERIC_LIFE_SPEC: biome.tokens.ATMOSPHERIC_LIFE_SPEC,
  };

  // Perform Token Replacement cleanly (preventing double periods ..)
  let result = templateText.replace(/Hold\s+\{\{CENTREPIECE_INPUT[^}]*\}\}/g, formattedInput);
  result = result.replace(/\{\{([A-Z0-9_]+)(?:[^}]*)?\}\}(\.?)/g, (match, tokenKey, trailingDot) => {
    if (tokenMap[tokenKey] !== undefined) {
      const val = tokenMap[tokenKey];
      if (trailingDot === '.' && val.endsWith('.')) {
        return val;
      }
      return val + trailingDot;
    }
    return match;
  });

  // Handle Marked Core Sections Independently
  const coreSections = ['state-buffer', 'vegetation', 'audio'];
  for (const sec of coreSections) {
    const isKept = selection.includedSections.includes(sec);
    const blockRegex = new RegExp(`<!--SECTION:${sec}-->[\\s\\S]*?<!--/SECTION-->[\\r\\n]*`, 'g');

    if (isKept) {
      result = result.replace(blockRegex, (match) => {
        // Strip only start and end markers of this block
        let inner = match.replace(new RegExp(`<!--SECTION:${sec}-->[\\r\\n]*`), '');
        inner = inner.replace(new RegExp(`[\\r\\n]*<!--/SECTION-->[\\r\\n]*`), '\n\n');
        return inner;
      });
    } else {
      result = result.replace(blockRegex, '');
    }
  }

  // Camera Substitution in §2.6
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
    const audioSecEnd = result.indexOf('---', result.indexOf('## 2. Systems'));
    if (audioSecEnd !== -1) {
      result = result.slice(0, audioSecEnd) + extraSectionsText + '\n\n' + result.slice(audioSecEnd);
    } else {
      result += '\n' + extraSectionsText;
    }
  }

  // Format State Channel Contract for Assembly Decisions
  let stateChannelDecisionsText = 'none (state-buffer omitted)';
  if (hasStateBuffer && selection.stateChannelContract && Object.keys(selection.stateChannelContract).length > 0) {
    const biomeChanMap = BIOME_CHANNELS[selection.biome] || {};
    const contractEntries = (MECHANIC_WRITES[selection.mechanic] || []).map((key) => {
      const entry = selection.stateChannelContract[key];
      const channel = entry.channel;
      const meaning = biomeChanMap[channel] || '';
      return `${key} → ${channel} (${meaning}): ${entry.effect}`;
    });
    stateChannelDecisionsText = contractEntries.join('; ');
  }

  const selConflicts = validateSelection(selection);
  const selErrorsCount = selConflicts.filter((c) => c.severity === 'error').length;
  const selWarningsCount = selConflicts.filter((c) => c.severity === 'warn').length;

  const cohConflicts = checkCoherence({
    paradigm: effectiveCoherence.paradigm,
    assetStrategy: 'zero-asset',
    materialBehaviours: effectiveCoherence.materialBehaviours,
    palette: effectiveCoherence.palette,
  });
  const cohRawErrors = cohConflicts.filter((c) => c.severity === 'error');
  const cohWarnings = cohConflicts.filter((c) => c.severity === 'warn');
  const overrides = Array.isArray(spec.coherenceOverrides)
    ? [...spec.coherenceOverrides].sort((a, b) => String(a.rule).localeCompare(String(b.rule)))
    : [];

  const rawErrorRules = new Set(cohRawErrors.map((c) => c.rule));
  const acceptedOverrides = overrides.filter((o) => rawErrorRules.has(o.rule));
  const unoverriddenErrorCount = cohRawErrors.length - acceptedOverrides.length;

  let cohStatus = 'clean';
  let cohCountsText = `${cohWarnings.length} warning(s)`;

  if (unoverriddenErrorCount > 0) {
    cohStatus = 'has errors';
  } else if (acceptedOverrides.length > 0) {
    cohStatus = 'accepted deliberate deviation';
    cohCountsText = `${acceptedOverrides.length} override(s), ${cohWarnings.length} warning(s)`;
  }

  let assemblyDecisionsText = `\n\n## Assembly Decisions\n\n` +
    `- **Creative Mode:** ${creativeModeTitle}\n` +
    `- **Path and Base Showcase:** ${selection.path}${selection.baseShowcase ? ` (${selection.baseShowcase})` : ''}\n` +
    `- **Changed Major Axes:** ${canonicalModel.selection.changedAxes.length > 0 ? canonicalModel.selection.changedAxes.join(', ') : 'none'}\n` +
    `- **Creative Spark:** ${creativeSparkVal}\n` +
    `- **Signature Moment:** ${selection.signatureMoment && selection.signatureMoment.enabled ? `${selection.signatureMoment.text} (Reused system: ${selection.signatureMoment.reusedSystem})` : 'disabled'}\n` +
    `- **Rendering Profile:** ${selection.renderingProfile}\n` +
    `- **Included Sections:** ${canonicalModel.selection.includedSections.length > 0 ? canonicalModel.selection.includedSections.join(', ') : 'none'}\n` +
    `- **Extra Sections:** ${canonicalModel.selection.extraSections.length > 0 ? canonicalModel.selection.extraSections.join(', ') : 'none'}\n` +
    `- **State Channel Contract:** ${stateChannelDecisionsText}\n` +
    `- **Selection Validation:** clean (${selErrorsCount} errors, ${selWarningsCount} warnings)\n` +
    `- **Coherence Validation:** ${cohStatus} (${cohCountsText})`;

  if (cohWarnings.length > 0) {
    assemblyDecisionsText += `\n\n### Coherence Warnings\n\n` +
      cohWarnings.map((w) => `- **${w.rule}:** ${w.message} (Fix: ${w.fix})`).join('\n');
  }

  if (overrides.length > 0) {
    assemblyDecisionsText += `\n\n## Deliberate Deviations\n\n` +
      overrides.map((o) => `- **${o.rule}:** ${o.reason}`).join('\n');
  }

  result += assemblyDecisionsText + '\n';

  result += `\n\n${renderContractSummary(buildContract)}\n${renderMilestoneInstructions(buildContract)}\n`;

  // Final Validation
  const briefVal = validateBrief(result);
  if (!briefVal.ok) {
    throw new Error(`Assembled brief failed final validation: ${briefVal.problems.join(' | ')}`);
  }

  if (/references\/[a-z0-9_-]+\.md|TEMPLATE\.md|selection\.mjs|check\.mjs/.test(result)) {
    throw new Error('Assembled brief contains active reference file dependencies');
  }

  const artifactAgreement = validateAssemblyArtifacts({
    model: canonicalModel,
    contract: buildContract,
    brief: result,
  });
  if (!artifactAgreement.valid) {
    throw new Error(`Brief/build-contract agreement failed: ${artifactAgreement.errors.join(' | ')}`);
  }

  return {
    projectName,
    fileName,
    brief: result,
    warnings: cohWarnings,
    assemblyModel: canonicalModel,
    buildContract,
    evidenceTemplate: createEvidenceTemplate(),
  };
}

/**
 * Safely write the generated project bundle to output directory.
 */
export function writeBundle(spec, outDir, options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : path.dirname(fileURLToPath(import.meta.url));
  const verifySrc = path.join(rootDir, 'verify');

  // Preflight 1: Read all verifier files into memory before creating/modifying targets
  const verifierFiles = ['README.md', 'gates.mjs', 'verify_demo.mjs'];
  const cachedVerifierFiles = {};
  for (const vf of verifierFiles) {
    const srcPath = path.join(verifySrc, vf);
    if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
      throw new Error(`Missing or unreadable verifier source file: '${srcPath}'`);
    }
    try {
      cachedVerifierFiles[vf] = fs.readFileSync(srcPath, 'utf8');
    } catch (err) {
      throw new Error(`Missing or unreadable verifier source file: '${srcPath}': ${err.message}`);
    }
  }

  // Preflight 2: Assemble brief to determine output fileName
  const { projectName, fileName, brief, warnings, buildContract, evidenceTemplate } = assembleBrief(spec, options);
  const buildContractText = JSON.stringify(buildContract, null, 2) + '\n';
  const evidenceText = JSON.stringify(evidenceTemplate, null, 2) + '\n';
  const handoffContent = renderHandoff({
    fileName,
    builderAgent: spec.builderAgent,
    contract: buildContract,
  });
  const targetDir = path.resolve(outDir);

  // Preflight 3: Output directory and verify directory path type checks
  if (fs.existsSync(targetDir) && !fs.statSync(targetDir).isDirectory()) {
    const err = new Error(`Output path '${targetDir}' exists and is a file, not a directory.`);
    err.code = 'ENOTDIR';
    throw err;
  }

  const verifyTargetDir = path.join(targetDir, 'verify');
  if (fs.existsSync(verifyTargetDir) && !fs.statSync(verifyTargetDir).isDirectory()) {
    const err = new Error(`Verify path '${verifyTargetDir}' exists and is a file, not a directory.`);
    err.code = 'ENOTDIR';
    throw err;
  }

  // Preflight 4: Target file collisions and type checks
  const targetFiles = [
    path.join(targetDir, fileName),
    path.join(targetDir, BUILD_CONTRACT_FILENAME),
    path.join(targetDir, EVIDENCE_FILENAME),
    path.join(targetDir, HANDOFF_FILENAME),
    path.join(targetDir, 'verify', 'README.md'),
    path.join(targetDir, 'verify', 'gates.mjs'),
    path.join(targetDir, 'verify', 'verify_demo.mjs'),
  ];

  for (const tf of targetFiles) {
    if (fs.existsSync(tf) && fs.statSync(tf).isDirectory()) {
      const err = new Error(`Target file path '${tf}' is a directory collision.`);
      err.code = 'EISDIR';
      throw err;
    }
  }

  const existingCollisions = targetFiles.filter((f) => fs.existsSync(f));
  if (existingCollisions.length > 0 && !options.force) {
    const err = new Error(`Destination collision: target file '${existingCollisions[0]}' already exists. Use --force to overwrite.`);
    err.code = 'EEXIST';
    throw err;
  }

  // All preflight checks passed — perform writes from cached verifier contents
  fs.mkdirSync(verifyTargetDir, { recursive: true });

  fs.writeFileSync(path.join(targetDir, fileName), brief, 'utf8');
  fs.writeFileSync(path.join(targetDir, BUILD_CONTRACT_FILENAME), buildContractText, 'utf8');
  fs.writeFileSync(path.join(targetDir, EVIDENCE_FILENAME), evidenceText, 'utf8');
  fs.writeFileSync(path.join(targetDir, HANDOFF_FILENAME), handoffContent, 'utf8');

  for (const vf of verifierFiles) {
    const dest = path.join(targetDir, 'verify', vf);
    fs.writeFileSync(dest, cachedVerifierFiles[vf], 'utf8');
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

  if (args.length === 0 || (args.length === 1 && (args[0] === '--help' || args[0] === '-h' || args[0] === 'help'))) {
    printUsageAndExit(args.length === 0 ? 2 : 0, args.length === 0);
  }

  let stdoutCount = 0;
  let outCount = 0;
  let forceCount = 0;
  let positionalArgs = [];
  let outDir = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--stdout') {
      stdoutCount++;
    } else if (arg === '--out') {
      outCount++;
      if (i + 1 >= args.length) {
        printUsageAndExit(2, true);
      }
      outDir = args[++i];
      if (!outDir || outDir.startsWith('-')) {
        printUsageAndExit(2, true);
      }
    } else if (arg === '--force') {
      forceCount++;
    } else if (arg.startsWith('-')) {
      printUsageAndExit(2, true);
    } else {
      positionalArgs.push(arg);
    }
  }

  if (stdoutCount > 1 || outCount > 1 || forceCount > 1) {
    printUsageAndExit(2, true);
  }

  if (stdoutCount > 0 && forceCount > 0) {
    printUsageAndExit(2, true);
  }

  if (stdoutCount > 0 && outCount > 0) {
    printUsageAndExit(2, true);
  }

  if (stdoutCount === 0 && outCount === 0) {
    printUsageAndExit(2, true);
  }

  if (positionalArgs.length !== 1) {
    printUsageAndExit(2, true);
  }

  const specFile = positionalArgs[0];

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

  if (stdoutFlag(stdoutCount)) {
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
      const result = writeBundle(spec, outDir, { force: forceCount > 0 });
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (err) {
      if (err.code === 'EEXIST' || err.code === 'ENOTDIR' || err.code === 'EISDIR') {
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
      process.exit(2);
    }
  }

  printUsageAndExit(2, true);
}

function stdoutFlag(count) {
  return count > 0;
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
