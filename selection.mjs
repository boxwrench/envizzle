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

  // Enum validation
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

  // Mode and path combinations
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

  // Base Showcase validation & Changed Axes
  if (selection.path === 'showcase' || selection.path === 'base-showcase') {
    if (!selection.baseShowcase || !SHOWCASES[selection.baseShowcase]) {
      out.push(conflict(
        'base-showcase-invalid',
        'error',
        `baseShowcase '${selection.baseShowcase}' is invalid or unregistered.`,
        `Select a registered showcase: ${Object.keys(SHOWCASES).join(', ')}.`,
      ));
    }
  } else if (selection.path === 'fully-custom') {
    if (selection.baseShowcase !== null && selection.baseShowcase !== undefined) {
      out.push(conflict(
        'base-showcase-not-null',
        'error',
        `Fully custom path requires baseShowcase to be null, got '${selection.baseShowcase}'.`,
        'Set baseShowcase to null for fully custom path.',
      ));
    }
  }

  // Changed axes computation
  const majorAxes = ['ambition', 'biome', 'archetype', 'mechanic', 'camera'];
  const actualChangedMajorAxes = [];
  if (selection.baseShowcase && SHOWCASES[selection.baseShowcase]) {
    const base = SHOWCASES[selection.baseShowcase];
    for (const axis of majorAxes) {
      if (selection[axis] !== base[axis]) {
        actualChangedMajorAxes.push(axis);
      }
    }
  }

  if (!Array.isArray(selection.changedAxes)) {
    out.push(conflict(
      'changed-axes-invalid',
      'error',
      'changedAxes must be an array.',
      'Provide an array for changedAxes.',
    ));
  } else {
    if (selection.creativeMode === 'proven' || selection.creativeMode === 'signature') {
      if (selection.changedAxes.length !== 0) {
        out.push(conflict(
          'changed-axes-forbidden',
          'error',
          `${selection.creativeMode} mode requires changedAxes to be empty, got ${JSON.stringify(selection.changedAxes)}.`,
          'Set changedAxes: [].',
        ));
      }
      if (selection.baseShowcase && SHOWCASES[selection.baseShowcase]) {
        const base = SHOWCASES[selection.baseShowcase];
        if (
          selection.ambition !== base.ambition ||
          selection.biome !== base.biome ||
          selection.archetype !== base.archetype ||
          selection.mechanic !== base.mechanic ||
          selection.camera !== base.camera ||
          selection.renderingProfile !== base.renderingProfile
        ) {
          out.push(conflict(
            'showcase-drift',
            'error',
            `${selection.creativeMode} mode requires the complete base selection unchanged.`,
            'Match all base showcase properties exactly.',
          ));
        }
        if (
          JSON.stringify([...(selection.includedSections || [])].sort()) !== JSON.stringify([...base.includedSections].sort()) ||
          JSON.stringify([...(selection.extraSections || [])].sort()) !== JSON.stringify([...base.extraSections].sort())
        ) {
          out.push(conflict(
            'showcase-sections-drift',
            'error',
            `${selection.creativeMode} mode requires intact showcase sections.`,
            'Match the base showcase includedSections and extraSections exactly.',
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

  // Ambition & section rules
  const coreSections = ['vegetation', 'state-buffer', 'audio'];
  const extraSectionsList = ['weather', 'water-bodies', 'architecture', 'destructibility'];

  const incSec = selection.includedSections;
  const extSec = selection.extraSections;

  if (!Array.isArray(incSec)) {
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

  if (!Array.isArray(extSec)) {
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

  if (Array.isArray(incSec) && Array.isArray(extSec)) {
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

  // State-channel contract validation
  const hasStateBuffer = Array.isArray(incSec) && incSec.includes('state-buffer');
  const scc = selection.stateChannelContract;

  if (!hasStateBuffer) {
    if (scc && typeof scc === 'object' && Object.keys(scc).length > 0) {
      out.push(conflict(
        'state-channel-contract-prohibited',
        'error',
        'stateChannelContract must be empty when state-buffer is not included.',
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

  // Camera requirements validation
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

  // Signature Moment validation
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

  // Novelty Budget validation
  const nb = selection.noveltyBudget;
  const nbKeys = [
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
    nbKeys.forEach((key) => {
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
