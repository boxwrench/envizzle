#!/usr/bin/env node
/**
 * selection.mjs — Deterministic selection validator for envizzle creative modes
 */

export const RENDERING_PROFILES = {
  'babylon-webgpu': {
    id: 'babylon-webgpu',
    engine: 'Babylon.js latest stable, WebGPU only',
    shaderLang: 'WGSL',
    shaderLangExt: 'wgsl',
    materialApi: 'Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL',
  },
  'three-webgl2': {
    id: 'three-webgl2',
    engine: 'Three.js latest stable, WebGLRenderer (WebGL2 only)',
    shaderLang: 'GLSL ES 3.00 raw modules',
    shaderLangExt: 'glsl',
    materialApi: 'Three.js RawShaderMaterial on WebGLRenderer',
  },
};

export const SHOWCASES = {
  'Alpine Dawn': {
    name: 'Alpine Dawn',
    ambition: 'showcase',
    biome: 'Alpine Snow',
    archetype: 'Traveller Coat',
    mechanic: 'Surf / Carve',
    camera: 'Third Person',
    renderingProfile: 'babylon-webgpu',
    includedSections: ['vegetation', 'state-buffer', 'audio'],
    extraSections: [],
    cameraAdjustments: [],
    stateChannelContract: {
      'depression': { channel: 'R', effect: 'carve groove lowers snow depression depth' },
      'displaced-mass': { channel: 'G', effect: 'carve berms raise displaced snow mass' },
      'wetness-or-compaction': { channel: 'B', effect: 'groove writes wetness, interpreted as compressed sheen' },
    },
  },
  'Hoshi-no-Tani': {
    name: 'Hoshi-no-Tani',
    ambition: 'everything',
    biome: 'Ghibli Valley',
    archetype: 'Traveller Coat',
    mechanic: 'Flight / Glide',
    camera: 'Cinematic',
    renderingProfile: 'three-webgl2',
    includedSections: ['vegetation', 'state-buffer', 'audio'],
    extraSections: ['weather', 'water-bodies', 'architecture', 'destructibility'],
    cameraAdjustments: ['verification-framing'],
    stateChannelContract: {
      'wind-gust': { channel: 'B', effect: 'downwash writes wind-gust magnitude' },
      'landing-depression': { channel: 'R', effect: 'landing depression becomes trample/blade bend' },
    },
  },
  'Dune Sea': {
    name: 'Dune Sea',
    ambition: 'slice',
    biome: 'Dune Desert',
    archetype: 'Desert Nomad',
    mechanic: 'Surf / Carve',
    camera: 'Third Person',
    renderingProfile: 'babylon-webgpu',
    includedSections: [],
    extraSections: [],
    cameraAdjustments: [],
    stateChannelContract: {},
  },
  'Tidal Shelf': {
    name: 'Tidal Shelf',
    ambition: 'showcase',
    biome: 'Ocean Shelf',
    archetype: 'Robed Mage',
    mechanic: 'Grapple Swing',
    camera: 'XR',
    renderingProfile: 'babylon-webgpu',
    includedSections: ['vegetation', 'state-buffer', 'audio'],
    extraSections: [],
    cameraAdjustments: [
      'body-rings-20-24',
      'hands-feet-rings-10-12',
      'stereo-target',
      'double-character-budget',
      'verification-framing',
      'no-dof-motion-blur',
    ],
    stateChannelContract: {
      'anchor-displaced-mass': { channel: 'G', effect: 'displaced mass becomes localized foam coverage' },
      'landing-depression': { channel: 'B', effect: 'landing depression becomes bed-scour depth' },
      'hard-landing-disturbance': { channel: 'A', effect: 'disturbed sand becomes turbidity' },
    },
  },
  'Emberfall': {
    name: 'Emberfall',
    ambition: 'showcase',
    biome: 'Volcanic',
    archetype: 'Armored Soldier',
    mechanic: 'Beam Cannon',
    camera: 'First Person',
    renderingProfile: 'babylon-webgpu',
    includedSections: ['vegetation', 'state-buffer', 'audio'],
    extraSections: [],
    cameraAdjustments: ['hand-rings-12', 'cloth-plus-one', 'hide-head-neck-only', 'verification-framing'],
    stateChannelContract: {
      'depression': { channel: 'R', effect: 'beam intersection reduces crust thickness' },
      'heat-scorch-disturbance': { channel: 'B', effect: 'beam heat raises normalized temperature' },
    },
  },
  'Neon Monsoon': {
    name: 'Neon Monsoon',
    ambition: 'everything',
    biome: 'Night City',
    archetype: 'Void Wanderer',
    mechanic: 'Summon Vehicle',
    camera: 'Third Person',
    renderingProfile: 'three-webgl2',
    includedSections: ['vegetation', 'state-buffer', 'audio'],
    extraSections: ['weather', 'water-bodies', 'architecture', 'destructibility'],
    cameraAdjustments: [],
    stateChannelContract: {
      'track-depression': { channel: 'R', effect: 'tracks displace puddle-water depth' },
      'track-compaction-disturbance': { channel: 'B', effect: 'vehicle passage writes surface disturbance' },
      'track-edge-displaced-mass': { channel: 'G', effect: 'edge displacement becomes ripple phase/amplitude' },
    },
  },
};

export const BIOME_CHANNELS = {
  'Alpine Snow': {
    R: 'depression depth in metres, 0 -> 0.45',
    G: 'displaced mass, berm height 0 -> 0.25 m',
    B: 'wetness 0 -> 1',
    A: 'compaction/ice 0 -> 1',
  },
  'Ghibli Valley': {
    R: 'trample, blade bend 0 -> 1',
    G: 'soil-path exposure 0 -> 1',
    B: 'wind gust magnitude',
    A: 'water wetness 0 -> 1',
  },
  'Dune Desert': {
    R: 'depression depth 0 -> 0.30 m',
    G: 'displaced mass, ridge height 0 -> 0.18 m',
    B: 'moisture 0 -> 1',
    A: 'wind-erosion age in seconds',
  },
  'Ocean Shelf': {
    R: 'surface displacement offset +/-0.6 m',
    G: 'foam coverage 0 -> 1',
    B: 'bed scour depth 0 -> 0.22 m',
    A: 'turbidity 0 -> 1',
  },
  'Volcanic': {
    R: 'crust thickness 0 -> 0.25 m',
    G: 'flow velocity magnitude 0 -> 3 m/s',
    B: 'temperature normalised 0 -> 1',
    A: 'player disturbance / fracture 0 -> 1',
  },
  'Night City': {
    R: 'water depth 0 -> 0.04 m',
    G: 'ripple phase and amplitude',
    B: 'disturbance from footsteps and vehicles 0 -> 1',
    A: 'grime/dry mask 0 -> 1',
  },
};

export const MECHANIC_WRITES = {
  'Surf / Carve': ['depression', 'displaced-mass', 'wetness-or-compaction'],
  'Flight / Glide': ['wind-gust', 'landing-depression'],
  'Beam Cannon': ['depression', 'heat-scorch-disturbance'],
  'Grapple Swing': ['anchor-displaced-mass', 'landing-depression', 'hard-landing-disturbance'],
  'Summon Vehicle': ['track-depression', 'track-compaction-disturbance', 'track-edge-displaced-mass'],
};

export const CAMERA_REQUIREMENTS = {
  'Third Person': [],
  'Cinematic': ['verification-framing'],
  'First Person': ['hand-rings-12', 'cloth-plus-one', 'hide-head-neck-only', 'verification-framing'],
  'XR': [
    'body-rings-20-24',
    'hands-feet-rings-10-12',
    'stereo-target',
    'double-character-budget',
    'verification-framing',
    'no-dof-motion-blur',
  ],
};

const conflict = (rule, severity, message, fix) => ({ rule, severity, message, fix });

const areSectionSetsEqual = (arr1, arr2) => {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  const s1 = new Set(arr1);
  const s2 = new Set(arr2);
  if (s1.size !== s2.size) return false;
  for (const item of s1) {
    if (!s2.has(item)) return false;
  }
  return true;
};

const areStateContractsEqual = (c1, c2) => {
  if (!c1 || !c2 || typeof c1 !== 'object' || Array.isArray(c1) || Array.isArray(c2)) return false;
  const k1 = Object.keys(c1).sort();
  const k2 = Object.keys(c2).sort();
  if (JSON.stringify(k1) !== JSON.stringify(k2)) return false;
  for (const key of k1) {
    if (!c1[key] || !c2[key] || typeof c1[key] !== 'object' || typeof c2[key] !== 'object') return false;
    if (c1[key].channel !== c2[key].channel || c1[key].effect !== c2[key].effect) return false;
  }
  return true;
};

/**
 * Validate a creative selection object deterministically.
 * @returns {Array<{rule:string, severity:'error'|'warn', message:string, fix:string}>}
 */
export function validateSelection(selection) {
  const out = [];

  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    out.push(conflict(
      'selection-required',
      'error',
      'Selection must be a non-null object.',
      'Provide a valid selection object.',
    ));
    return out;
  }

  // 1. Enum validation
  const validModes = ['proven', 'signature', 'experimental'];
  if (!validModes.includes(selection.creativeMode)) {
    out.push(conflict(
      'creative-mode-invalid',
      'error',
      `Invalid creativeMode '${selection.creativeMode}'. Expected one of: ${validModes.join(', ')}.`,
      'Set creativeMode to proven, signature, or experimental.',
    ));
  }

  const validPaths = ['showcase', 'base-showcase', 'fully-custom'];
  if (!validPaths.includes(selection.path)) {
    out.push(conflict(
      'path-invalid',
      'error',
      `Invalid path '${selection.path}'. Expected one of: ${validPaths.join(', ')}.`,
      'Set path to showcase, base-showcase, or fully-custom.',
    ));
  }

  const validAmbitions = ['slice', 'showcase', 'everything'];
  if (!validAmbitions.includes(selection.ambition)) {
    out.push(conflict(
      'ambition-invalid',
      'error',
      `Invalid ambition '${selection.ambition}'. Expected one of: ${validAmbitions.join(', ')}.`,
      'Set ambition to slice, showcase, or everything.',
    ));
  }

  if (!Object.keys(BIOME_CHANNELS).includes(selection.biome)) {
    out.push(conflict(
      'biome-invalid',
      'error',
      `Invalid biome '${selection.biome}'.`,
      `Select a registered biome: ${Object.keys(BIOME_CHANNELS).join(', ')}.`,
    ));
  }

  const validArchetypes = ['Robed Mage', 'Traveller Coat', 'Armored Soldier', 'Desert Nomad', 'Void Wanderer'];
  if (!validArchetypes.includes(selection.archetype)) {
    out.push(conflict(
      'archetype-invalid',
      'error',
      `Invalid archetype '${selection.archetype}'.`,
      `Select a registered archetype: ${validArchetypes.join(', ')}.`,
    ));
  }

  if (!Object.keys(MECHANIC_WRITES).includes(selection.mechanic)) {
    out.push(conflict(
      'mechanic-invalid',
      'error',
      `Invalid mechanic '${selection.mechanic}'.`,
      `Select a registered mechanic: ${Object.keys(MECHANIC_WRITES).join(', ')}.`,
    ));
  }

  if (!Object.keys(CAMERA_REQUIREMENTS).includes(selection.camera)) {
    out.push(conflict(
      'camera-invalid',
      'error',
      `Invalid camera '${selection.camera}'.`,
      `Select a registered camera mode: ${Object.keys(CAMERA_REQUIREMENTS).join(', ')}.`,
    ));
  }

  if (!Object.keys(RENDERING_PROFILES).includes(selection.renderingProfile)) {
    out.push(conflict(
      'rendering-profile-invalid',
      'error',
      `Invalid renderingProfile '${selection.renderingProfile}'.`,
      `Select a registered profile: ${Object.keys(RENDERING_PROFILES).join(', ')}.`,
    ));
  }

  // 2. Mode & path mismatch validation
  if (selection.creativeMode === 'proven' || selection.creativeMode === 'signature') {
    if (selection.path !== 'showcase') {
      out.push(conflict(
        'mode-path-mismatch',
        'error',
        `Mode '${selection.creativeMode}' requires path 'showcase', got '${selection.path}'.`,
        "Set path: 'showcase'.",
      ));
    }
  } else if (selection.creativeMode === 'experimental') {
    if (selection.path !== 'base-showcase' && selection.path !== 'fully-custom') {
      out.push(conflict(
        'mode-path-mismatch',
        'error',
        `Experimental mode requires path 'base-showcase' or 'fully-custom', got '${selection.path}'.`,
        "Set path to 'base-showcase' or 'fully-custom'.",
      ));
    }
  }

  // 3. Base Showcase validation
  if (selection.path === 'showcase' || selection.path === 'base-showcase') {
    if (typeof selection.baseShowcase !== 'string' || !SHOWCASES[selection.baseShowcase]) {
      out.push(conflict(
        'base-showcase-invalid',
        'error',
        `baseShowcase '${selection.baseShowcase}' is invalid or unregistered.`,
        `Select a registered showcase: ${Object.keys(SHOWCASES).join(', ')}.`,
      ));
    }
  } else if (selection.path === 'fully-custom') {
    if (selection.baseShowcase !== null) {
      out.push(conflict(
        'base-showcase-not-null',
        'error',
        `Fully custom path requires baseShowcase to be exactly null, got ${selection.baseShowcase === undefined ? 'undefined' : JSON.stringify(selection.baseShowcase)}.`,
        'Set baseShowcase to null for fully custom path.',
      ));
    }
  }

  // 4. Validate changedAxes array
  const allowedChangedAxisNames = ['ambition', 'biome', 'archetype', 'mechanic', 'camera'];
  const isChangedAxesValidArray = Array.isArray(selection.changedAxes);

  if (!isChangedAxesValidArray) {
    out.push(conflict(
      'changed-axes-invalid',
      'error',
      'changedAxes must be an array.',
      'Provide an array for changedAxes.',
    ));
  } else {
    const seenAxes = new Set();
    let hasDuplicateAxes = false;
    let hasUnknownAxes = false;
    for (const axis of selection.changedAxes) {
      if (!allowedChangedAxisNames.includes(axis)) {
        hasUnknownAxes = true;
      }
      if (seenAxes.has(axis)) {
        hasDuplicateAxes = true;
      }
      seenAxes.add(axis);
    }
    if (hasUnknownAxes) {
      out.push(conflict(
        'changed-axes-entry-invalid',
        'error',
        `changedAxes contains invalid axis entries. Allowed entries: ${allowedChangedAxisNames.join(', ')}.`,
        `Use only valid major axes: ${allowedChangedAxisNames.join(', ')}.`,
      ));
    }
    if (hasDuplicateAxes) {
      out.push(conflict(
        'changed-axes-duplicate',
        'error',
        'changedAxes contains duplicate entries.',
        'Remove duplicate entries from changedAxes.',
      ));
    }
  }

  // 5. Compute actual changed major axes
  const baseShowcaseObj = (typeof selection.baseShowcase === 'string' && SHOWCASES[selection.baseShowcase])
    ? SHOWCASES[selection.baseShowcase]
    : null;

  const actualChangedMajorAxes = [];
  if (baseShowcaseObj) {
    if (selection.biome !== baseShowcaseObj.biome) actualChangedMajorAxes.push('biome');
    if (selection.archetype !== baseShowcaseObj.archetype) actualChangedMajorAxes.push('archetype');
    if (selection.mechanic !== baseShowcaseObj.mechanic) actualChangedMajorAxes.push('mechanic');
    if (selection.camera !== baseShowcaseObj.camera) actualChangedMajorAxes.push('camera');

    const isAmbitionValDifferent = selection.ambition !== baseShowcaseObj.ambition;
    const isIncSectionsDifferent = !areSectionSetsEqual(selection.includedSections, baseShowcaseObj.includedSections);
    const isExtraSectionsDifferent = !areSectionSetsEqual(selection.extraSections, baseShowcaseObj.extraSections);

    if (isAmbitionValDifferent || isIncSectionsDifferent || isExtraSectionsDifferent) {
      actualChangedMajorAxes.push('ambition');
    }
  }

  // Cross-field checks for mode and changedAxes
  if (isChangedAxesValidArray) {
    if (selection.creativeMode === 'proven' || selection.creativeMode === 'signature') {
      if (selection.changedAxes.length !== 0) {
        out.push(conflict(
          'changed-axes-forbidden',
          'error',
          `${selection.creativeMode} mode requires changedAxes to be empty, got ${JSON.stringify(selection.changedAxes)}.`,
          'Set changedAxes: [].',
        ));
      }
      if (baseShowcaseObj) {
        if (
          selection.ambition !== baseShowcaseObj.ambition ||
          selection.biome !== baseShowcaseObj.biome ||
          selection.archetype !== baseShowcaseObj.archetype ||
          selection.mechanic !== baseShowcaseObj.mechanic ||
          selection.camera !== baseShowcaseObj.camera ||
          selection.renderingProfile !== baseShowcaseObj.renderingProfile
        ) {
          out.push(conflict(
            'showcase-drift',
            'error',
            `${selection.creativeMode} mode requires the complete base selection unchanged.`,
            'Match all base showcase properties exactly.',
          ));
        }
        if (
          !areSectionSetsEqual(selection.includedSections, baseShowcaseObj.includedSections) ||
          !areSectionSetsEqual(selection.extraSections, baseShowcaseObj.extraSections)
        ) {
          out.push(conflict(
            'showcase-sections-drift',
            'error',
            `${selection.creativeMode} mode requires intact showcase sections.`,
            'Match the base showcase includedSections and extraSections exactly.',
          ));
        }
        if (!areStateContractsEqual(selection.stateChannelContract, baseShowcaseObj.stateChannelContract)) {
          out.push(conflict(
            'showcase-state-contract-drift',
            'error',
            `${selection.creativeMode} mode requires the exact canonical stateChannelContract of the showcase.`,
            'Match the canonical showcase stateChannelContract exactly.',
          ));
        }
      }
    } else if (selection.creativeMode === 'experimental' && selection.path === 'base-showcase') {
      if (actualChangedMajorAxes.length > 1) {
        out.push(conflict(
          'excessive-changed-axes',
          'error',
          `Experimental base-showcase mode permits at most 1 changed major axis, found ${actualChangedMajorAxes.length}: ${actualChangedMajorAxes.join(', ')}.`,
          'Change at most one major axis from the base showcase.',
        ));
      }
      const sortedDeclared = [...selection.changedAxes].sort();
      const sortedActual = [...actualChangedMajorAxes].sort();
      if (JSON.stringify(sortedDeclared) !== JSON.stringify(sortedActual)) {
        out.push(conflict(
          'changed-axes-mismatch',
          'error',
          `changedAxes ${JSON.stringify(selection.changedAxes)} does not match actual changed major axes ${JSON.stringify(actualChangedMajorAxes)}.`,
          `Set changedAxes to ${JSON.stringify(actualChangedMajorAxes)}.`,
        ));
      }
    } else if (selection.path === 'fully-custom') {
      if (selection.changedAxes.length !== 0) {
        out.push(conflict(
          'changed-axes-not-empty',
          'error',
          `Fully custom path requires changedAxes: [], got ${JSON.stringify(selection.changedAxes)}.`,
          'Set changedAxes: [].',
        ));
      }
    }
  }

  // 6. Validate includedSections and extraSections
  const coreSections = ['vegetation', 'state-buffer', 'audio'];
  const extraSectionsList = ['weather', 'water-bodies', 'architecture', 'destructibility'];

  const incSec = selection.includedSections;
  const extSec = selection.extraSections;
  const isIncSecArray = Array.isArray(incSec);
  const isExtSecArray = Array.isArray(extSec);

  if (!isIncSecArray) {
    out.push(conflict(
      'included-sections-invalid',
      'error',
      'includedSections must be an array.',
      'Provide an array for includedSections.',
    ));
  } else {
    if (new Set(incSec).size !== incSec.length) {
      out.push(conflict(
        'included-sections-duplicate',
        'error',
        'includedSections contains duplicate section names.',
        'Remove duplicate section names from includedSections.',
      ));
    }
    const unknownInc = incSec.filter((s) => !coreSections.includes(s));
    if (unknownInc.length > 0) {
      out.push(conflict(
        'included-sections-unknown',
        'error',
        `includedSections contains unknown or invalid sections: ${unknownInc.join(', ')}.`,
        `Use core sections: ${coreSections.join(', ')}.`,
      ));
    }
  }

  if (!isExtSecArray) {
    out.push(conflict(
      'extra-sections-invalid',
      'error',
      'extraSections must be an array.',
      'Provide an array for extraSections.',
    ));
  } else {
    if (new Set(extSec).size !== extSec.length) {
      out.push(conflict(
        'extra-sections-duplicate',
        'error',
        'extraSections contains duplicate section names.',
        'Remove duplicate section names from extraSections.',
      ));
    }
    const unknownExt = extSec.filter((s) => !extraSectionsList.includes(s));
    if (unknownExt.length > 0) {
      out.push(conflict(
        'extra-sections-unknown',
        'error',
        `extraSections contains unknown or invalid sections: ${unknownExt.join(', ')}.`,
        `Use extra sections: ${extraSectionsList.join(', ')}.`,
      ));
    }
  }

  if (isIncSecArray && isExtSecArray) {
    if (selection.ambition === 'slice') {
      if (incSec.length !== 0 || extSec.length !== 0) {
        out.push(conflict(
          'slice-sections-forbidden',
          'error',
          "Ambition level 'slice' requires includedSections and extraSections to be empty.",
          'Set includedSections: [] and extraSections: [].',
        ));
      }
    } else if (selection.ambition === 'showcase') {
      if (incSec.length === 0) {
        out.push(conflict(
          'showcase-ambition-requires-sections',
          'error',
          "Ambition level 'showcase' requires at least one core section in includedSections, or must be downgraded to 'slice'.",
          "Add core sections to includedSections, or change ambition to 'slice'.",
        ));
      }
      if (extSec.length !== 0) {
        out.push(conflict(
          'showcase-extra-sections-forbidden',
          'error',
          "Ambition level 'showcase' forbids extraSections.",
          'Set extraSections: [].',
        ));
      }
    } else if (selection.ambition === 'everything') {
      const hasAllCore = coreSections.every((s) => incSec.includes(s));
      if (!hasAllCore) {
        out.push(conflict(
          'everything-core-sections-required',
          'error',
          "Ambition level 'everything' requires all three core sections (vegetation, state-buffer, audio).",
          "Include all core sections in includedSections: ['vegetation', 'state-buffer', 'audio'].",
        ));
      }
      if (extSec.length === 0) {
        out.push(conflict(
          'everything-extra-sections-required',
          'error',
          "Ambition level 'everything' requires at least one extra section.",
          'Add at least one extra section to extraSections.',
        ));
      }
    }
  }

  // 7. Validate stateChannelContract
  const hasStateBuffer = isIncSecArray && incSec.includes('state-buffer');
  const scc = selection.stateChannelContract;

  if (!hasStateBuffer) {
    if (!scc || typeof scc !== 'object' || Array.isArray(scc) || Object.keys(scc).length !== 0) {
      out.push(conflict(
        'state-channel-contract-prohibited',
        'error',
        'stateChannelContract must be an empty object {} when state-buffer is not included.',
        'Set stateChannelContract: {}.',
      ));
    }
  } else {
    if (!scc || typeof scc !== 'object' || Array.isArray(scc)) {
      out.push(conflict(
        'state-channel-contract-required',
        'error',
        'stateChannelContract must be a valid object when state-buffer is included.',
        'Provide a complete stateChannelContract mapping.',
      ));
    } else {
      const expectedWrites = MECHANIC_WRITES[selection.mechanic] || [];
      const sccKeys = Object.keys(scc);

      const missingKeys = expectedWrites.filter((k) => !sccKeys.includes(k));
      if (missingKeys.length > 0) {
        out.push(conflict(
          'mechanic-write-missing',
          'error',
          `stateChannelContract is missing required write keys for mechanic '${selection.mechanic}': ${missingKeys.join(', ')}.`,
          `Include write keys: ${expectedWrites.join(', ')}.`,
        ));
      }

      const unknownKeys = sccKeys.filter((k) => !expectedWrites.includes(k));
      if (unknownKeys.length > 0) {
        out.push(conflict(
          'mechanic-write-unknown',
          'error',
          `stateChannelContract contains unknown write keys for mechanic '${selection.mechanic}': ${unknownKeys.join(', ')}.`,
          `Remove invalid keys. Valid keys for '${selection.mechanic}': ${expectedWrites.join(', ')}.`,
        ));
      }

      const usedChannels = [];
      sccKeys.forEach((key) => {
        const entry = scc[key];
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          out.push(conflict(
            'state-channel-entry-invalid',
            'error',
            `stateChannelContract key '${key}' must be an object with channel and effect.`,
            "Provide { channel: 'R'|'G'|'B'|'A', effect: string }.",
          ));
          return;
        }

        const allowedEntryKeys = ['channel', 'effect'];
        const unknownEntryProps = Object.keys(entry).filter((k) => !allowedEntryKeys.includes(k));
        if (unknownEntryProps.length > 0) {
          out.push(conflict(
            'state-channel-entry-unknown',
            'error',
            `stateChannelContract key '${key}' contains unknown properties: ${unknownEntryProps.join(', ')}.`,
            "State channel entries may contain only 'channel' and 'effect'.",
          ));
        }

        const validChannels = ['R', 'G', 'B', 'A'];
        if (!validChannels.includes(entry.channel)) {
          out.push(conflict(
            'state-channel-target-invalid',
            'error',
            `stateChannelContract key '${key}' has invalid channel '${entry.channel}'.`,
            "Set channel to 'R', 'G', 'B', or 'A'.",
          ));
        } else {
          usedChannels.push({ key, channel: entry.channel });
        }

        if (typeof entry.effect !== 'string' || entry.effect.trim() === '') {
          out.push(conflict(
            'state-channel-effect-required',
            'error',
            `stateChannelContract key '${key}' requires a non-empty string effect.`,
            'Provide a non-empty effect string.',
          ));
        }
      });

      const channelCounts = {};
      usedChannels.forEach(({ channel }) => {
        channelCounts[channel] = (channelCounts[channel] || 0) + 1;
      });
      const duplicateChannels = Object.keys(channelCounts).filter((c) => channelCounts[c] > 1);
      if (duplicateChannels.length > 0) {
        out.push(conflict(
          'state-channel-duplicate-target',
          'error',
          `stateChannelContract assigns duplicate destination channels: ${duplicateChannels.join(', ')}.`,
          'Assign unique destination channels (R, G, B, A) within the contract.',
        ));
      }
    }
  }

  // 8. Validate cameraAdjustments
  const camAdj = selection.cameraAdjustments;
  if (!Array.isArray(camAdj)) {
    out.push(conflict(
      'camera-adjustments-invalid',
      'error',
      'cameraAdjustments must be an array.',
      'Provide an array for cameraAdjustments.',
    ));
  } else {
    const reqAdj = CAMERA_REQUIREMENTS[selection.camera] || [];
    if (new Set(camAdj).size !== camAdj.length) {
      out.push(conflict(
        'camera-adjustments-duplicate',
        'error',
        'cameraAdjustments contains duplicate adjustment entries.',
        'Remove duplicate entries from cameraAdjustments.',
      ));
    }
    const sortedCam = [...camAdj].sort();
    const sortedReq = [...reqAdj].sort();
    if (JSON.stringify(sortedCam) !== JSON.stringify(sortedReq)) {
      out.push(conflict(
        'camera-adjustments-mismatch',
        'error',
        `cameraAdjustments ${JSON.stringify(camAdj)} does not match required adjustments ${JSON.stringify(reqAdj)} for camera mode '${selection.camera}'.`,
        `Set cameraAdjustments to ${JSON.stringify(reqAdj)}.`,
      ));
    }
  }

  // 9. Validate signatureMoment
  const sig = selection.signatureMoment;
  if (!sig || typeof sig !== 'object' || Array.isArray(sig)) {
    out.push(conflict(
      'signature-moment-invalid',
      'error',
      'signatureMoment must be an object.',
      'Provide a signatureMoment object.',
    ));
  } else {
    if (selection.creativeMode === 'proven') {
      if (sig.enabled !== false) {
        out.push(conflict(
          'proven-signature-enabled-forbidden',
          'error',
          'Proven mode requires signatureMoment.enabled to be false.',
          'Set signatureMoment.enabled: false.',
        ));
      }
    } else if (selection.creativeMode === 'signature' || selection.creativeMode === 'experimental') {
      if (sig.enabled !== true) {
        out.push(conflict(
          'signature-moment-disabled',
          'error',
          `${selection.creativeMode} mode requires signatureMoment.enabled to be true.`,
          'Set signatureMoment.enabled: true.',
        ));
      }
      if (typeof sig.text !== 'string' || sig.text.trim() === '') {
        out.push(conflict(
          'signature-moment-text-required',
          'error',
          'signatureMoment.text must be a non-empty string when enabled.',
          'Provide a non-empty description in signatureMoment.text.',
        ));
      }
      if (typeof sig.reusedSystem !== 'string' || sig.reusedSystem.trim() === '') {
        out.push(conflict(
          'signature-moment-reused-system-required',
          'error',
          'signatureMoment.reusedSystem must be a non-empty string when enabled.',
          'Specify the reused system in signatureMoment.reusedSystem.',
        ));
      }
      if (sig.verificationPose !== 'mechanic') {
        out.push(conflict(
          'signature-moment-verification-pose-invalid',
          'error',
          `signatureMoment.verificationPose must be 'mechanic', got '${sig.verificationPose}'.`,
          "Set signatureMoment.verificationPose: 'mechanic'.",
        ));
      }
    }
  }

  // 10. Validate noveltyBudget
  const nb = selection.noveltyBudget;
  const allowedNbKeys = [
    'addsEngine',
    'addsAssetCategory',
    'addsPersistentBuffer',
    'addsMajorRenderPass',
    'addsSimulationSubsystem',
    'addsInput',
    'increasesAmbition',
  ];

  if (!nb || typeof nb !== 'object' || Array.isArray(nb)) {
    out.push(conflict(
      'novelty-budget-invalid',
      'error',
      'noveltyBudget must be an object.',
      'Provide a noveltyBudget object.',
    ));
  } else {
    const unknownNbKeys = Object.keys(nb).filter((k) => !allowedNbKeys.includes(k));
    if (unknownNbKeys.length > 0) {
      out.push(conflict(
        'novelty-budget-unknown',
        'error',
        `noveltyBudget contains unknown properties: ${unknownNbKeys.join(', ')}.`,
        `Allowed noveltyBudget properties: ${allowedNbKeys.join(', ')}.`,
      ));
    }

    allowedNbKeys.forEach((key) => {
      if (typeof nb[key] !== 'boolean') {
        out.push(conflict(
          'novelty-budget-type-error',
          'error',
          `noveltyBudget.${key} must be a boolean false.`,
          `Set noveltyBudget.${key}: false.`,
        ));
      } else if (nb[key] !== false) {
        out.push(conflict(
          'novelty-budget-violation',
          'error',
          `noveltyBudget.${key} is true; zero-expansion novelty budget requires all flags to be false.`,
          `Set noveltyBudget.${key}: false.`,
        ));
      }
    });
  }

  return out;
}

/**
 * Format the state channel contract into a Markdown list block.
 * @param {object} selection
 * @returns {string}
 */
export function formatStateChannelContract(selection) {
  const errors = validateSelection(selection).filter((c) => c.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`Cannot format invalid selection: ${errors.map((e) => e.message).join(' | ')}`);
  }

  if (!selection.includedSections || !selection.includedSections.includes('state-buffer')) {
    return '';
  }

  const mechanic = selection.mechanic;
  const biome = selection.biome;
  const writes = MECHANIC_WRITES[mechanic] || [];
  const biomeChanMap = BIOME_CHANNELS[biome] || {};

  const lines = writes.map((key) => {
    const entry = selection.stateChannelContract[key];
    const channel = entry.channel;
    const nativeMeaning = biomeChanMap[channel] || '';
    return `* **\`${key}\`** → **\`${channel}\`** (${nativeMeaning}): ${entry.effect}`;
  });

  return lines.join('\n');
}
