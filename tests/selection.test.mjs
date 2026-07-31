import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSelection,
  formatStateChannelContract,
  RENDERING_PROFILES,
  SHOWCASES,
  BIOME_CHANNELS,
  MECHANIC_WRITES,
  CAMERA_REQUIREMENTS,
} from '../selection.mjs';

const canonicalShowcases = [
  {
    name: 'Alpine Dawn',
    selection: {
      creativeMode: 'signature',
      path: 'showcase',
      baseShowcase: 'Alpine Dawn',
      changedAxes: [],
      ambition: 'showcase',
      biome: 'Alpine Snow',
      archetype: 'Traveller Coat',
      mechanic: 'Surf / Carve',
      camera: 'Third Person',
      renderingProfile: 'babylon-webgpu',
      includedSections: ['vegetation', 'state-buffer', 'audio'],
      extraSections: [],
      stateChannelContract: {
        'depression': { channel: 'R', effect: 'carve groove lowers snow depression depth' },
        'displaced-mass': { channel: 'G', effect: 'carve berms raise displaced snow mass' },
        'wetness-or-compaction': { channel: 'B', effect: 'groove writes wetness, interpreted as compressed sheen' },
      },
      cameraAdjustments: [],
      signatureMoment: {
        enabled: true,
        text: 'Spindrift plume on carve threshold',
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
    },
  },
  {
    name: 'Hoshi-no-Tani',
    selection: {
      creativeMode: 'signature',
      path: 'showcase',
      baseShowcase: 'Hoshi-no-Tani',
      changedAxes: [],
      ambition: 'everything',
      biome: 'Ghibli Valley',
      archetype: 'Traveller Coat',
      mechanic: 'Flight / Glide',
      camera: 'Cinematic',
      renderingProfile: 'three-webgl2',
      includedSections: ['vegetation', 'state-buffer', 'audio'],
      extraSections: ['weather', 'water-bodies', 'architecture', 'destructibility'],
      stateChannelContract: {
        'wind-gust': { channel: 'B', effect: 'downwash writes wind-gust magnitude' },
        'landing-depression': { channel: 'R', effect: 'landing depression becomes trample/blade bend' },
      },
      cameraAdjustments: ['verification-framing'],
      signatureMoment: {
        enabled: true,
        text: 'Thermal updraft glint on viaduct flyby',
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
    },
  },
  {
    name: 'Dune Sea',
    selection: {
      creativeMode: 'proven',
      path: 'showcase',
      baseShowcase: 'Dune Sea',
      changedAxes: [],
      ambition: 'slice',
      biome: 'Dune Desert',
      archetype: 'Desert Nomad',
      mechanic: 'Surf / Carve',
      camera: 'Third Person',
      renderingProfile: 'babylon-webgpu',
      includedSections: [],
      extraSections: [],
      stateChannelContract: {},
      cameraAdjustments: [],
      signatureMoment: {
        enabled: false,
        text: '',
        reusedSystem: '',
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
    },
  },
  {
    name: 'Tidal Shelf',
    selection: {
      creativeMode: 'signature',
      path: 'showcase',
      baseShowcase: 'Tidal Shelf',
      changedAxes: [],
      ambition: 'showcase',
      biome: 'Ocean Shelf',
      archetype: 'Robed Mage',
      mechanic: 'Grapple Swing',
      camera: 'XR',
      renderingProfile: 'babylon-webgpu',
      includedSections: ['vegetation', 'state-buffer', 'audio'],
      extraSections: [],
      stateChannelContract: {
        'anchor-displaced-mass': { channel: 'G', effect: 'displaced mass becomes localized foam coverage' },
        'landing-depression': { channel: 'B', effect: 'landing depression becomes bed-scour depth' },
        'hard-landing-disturbance': { channel: 'A', effect: 'disturbed sand becomes turbidity' },
      },
      cameraAdjustments: [
        'body-rings-20-24',
        'hands-feet-rings-10-12',
        'stereo-target',
        'double-character-budget',
        'verification-framing',
        'no-dof-motion-blur',
      ],
      signatureMoment: {
        enabled: true,
        text: 'Luminous caustic flash at grapple apex',
        reusedSystem: 'shaders',
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
    },
  },
  {
    name: 'Emberfall',
    selection: {
      creativeMode: 'signature',
      path: 'showcase',
      baseShowcase: 'Emberfall',
      changedAxes: [],
      ambition: 'showcase',
      biome: 'Volcanic',
      archetype: 'Armored Soldier',
      mechanic: 'Beam Cannon',
      camera: 'First Person',
      renderingProfile: 'babylon-webgpu',
      includedSections: ['vegetation', 'state-buffer', 'audio'],
      extraSections: [],
      stateChannelContract: {
        'depression': { channel: 'R', effect: 'beam intersection reduces crust thickness' },
        'heat-scorch-disturbance': { channel: 'B', effect: 'beam heat raises normalized temperature' },
      },
      cameraAdjustments: ['hand-rings-12', 'cloth-plus-one', 'hide-head-neck-only', 'verification-framing'],
      signatureMoment: {
        enabled: true,
        text: 'Crust incandescence along scorch vector',
        reusedSystem: 'material',
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
    },
  },
  {
    name: 'Neon Monsoon',
    selection: {
      creativeMode: 'signature',
      path: 'showcase',
      baseShowcase: 'Neon Monsoon',
      changedAxes: [],
      ambition: 'everything',
      biome: 'Night City',
      archetype: 'Void Wanderer',
      mechanic: 'Summon Vehicle',
      camera: 'Third Person',
      renderingProfile: 'three-webgl2',
      includedSections: ['vegetation', 'state-buffer', 'audio'],
      extraSections: ['weather', 'water-bodies', 'architecture', 'destructibility'],
      stateChannelContract: {
        'track-depression': { channel: 'R', effect: 'tracks displace puddle-water depth' },
        'track-compaction-disturbance': { channel: 'B', effect: 'vehicle passage writes surface disturbance' },
        'track-edge-displaced-mass': { channel: 'G', effect: 'edge displacement becomes ripple phase/amplitude' },
      },
      cameraAdjustments: [],
      signatureMoment: {
        enabled: true,
        text: 'Sodium reflections flare during vehicle arrival',
        reusedSystem: 'shaders',
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
    },
  },
];

test('all six canonical showcase selections validate cleanly', () => {
  for (const { name, selection } of canonicalShowcases) {
    const errors = validateSelection(selection).filter((c) => c.severity === 'error');
    assert.deepEqual(errors, [], `Canonical showcase '${name}' failed validation: ${errors.map((e) => e.message).join(', ')}`);
  }
});

test('null, primitive, and array inputs do not throw and return selection-required', () => {
  for (const invalidInput of [null, undefined, 42, 'string', true, []]) {
    assert.doesNotThrow(() => {
      const res = validateSelection(invalidInput);
      assert.equal(res.length, 1);
      assert.equal(res[0].rule, 'selection-required');
    });
  }
});

test('rejects invalid modes and mode/path combinations', () => {
  const base = { ...canonicalShowcases[0].selection };

  const resMode = validateSelection({ ...base, creativeMode: 'invalid-mode' });
  assert.ok(resMode.some((c) => c.rule === 'creative-mode-invalid'));

  const resPath = validateSelection({ ...base, path: 'invalid-path' });
  assert.ok(resPath.some((c) => c.rule === 'path-invalid'));

  const resMismatch = validateSelection({ ...base, creativeMode: 'proven', path: 'fully-custom', baseShowcase: null });
  assert.ok(resMismatch.some((c) => c.rule === 'mode-path-mismatch'));
});

test('rejects Proven and Signature drift from base showcase', () => {
  const driftedProven = {
    ...canonicalShowcases[0].selection,
    creativeMode: 'proven',
    signatureMoment: { enabled: false, text: '', reusedSystem: '', verificationPose: 'mechanic' },
    biome: 'Volcanic', // changed biome without using experimental mode/path
  };
  const res = validateSelection(driftedProven);
  assert.ok(res.some((c) => c.rule === 'showcase-drift'));
});

test('rejects incorrect or excessive Experimental changed axes', () => {
  // Excessive changed axes: changing both biome and camera
  const expExcessive = {
    ...canonicalShowcases[0].selection,
    creativeMode: 'experimental',
    path: 'base-showcase',
    biome: 'Volcanic',
    camera: 'First Person',
    cameraAdjustments: ['hand-rings-12', 'cloth-plus-one', 'hide-head-neck-only', 'verification-framing'],
    stateChannelContract: {
      'depression': { channel: 'R', effect: 'carve groove lowers crust thickness' },
      'displaced-mass': { channel: 'G', effect: 'carve berms raise flow velocity' },
      'wetness-or-compaction': { channel: 'B', effect: 'groove writes temperature' },
    },
    changedAxes: ['biome', 'camera'],
  };
  const resExcessive = validateSelection(expExcessive);
  assert.ok(resExcessive.some((c) => c.rule === 'excessive-changed-axes'));

  // Mismatched declared changedAxes vs actual
  const expMismatch = {
    ...canonicalShowcases[0].selection,
    creativeMode: 'experimental',
    path: 'base-showcase',
    biome: 'Volcanic',
    stateChannelContract: {
      'depression': { channel: 'R', effect: 'carve groove lowers crust thickness' },
      'displaced-mass': { channel: 'G', effect: 'carve berms raise flow velocity' },
      'wetness-or-compaction': { channel: 'B', effect: 'groove writes temperature' },
    },
    changedAxes: ['camera'], // actual changed axis is 'biome'
  };
  const resMismatch = validateSelection(expMismatch);
  assert.ok(resMismatch.some((c) => c.rule === 'changed-axes-mismatch'));
});

test('rejects fully-custom selections with a non-null baseShowcase', () => {
  const customWithBase = {
    creativeMode: 'experimental',
    path: 'fully-custom',
    baseShowcase: 'Alpine Dawn',
    changedAxes: [],
    ambition: 'slice',
    biome: 'Alpine Snow',
    archetype: 'Traveller Coat',
    mechanic: 'Surf / Carve',
    camera: 'Third Person',
    renderingProfile: 'babylon-webgpu',
    includedSections: [],
    extraSections: [],
    stateChannelContract: {},
    cameraAdjustments: [],
    signatureMoment: { enabled: true, text: 'spark text', reusedSystem: 'particles', verificationPose: 'mechanic' },
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
  const res = validateSelection(customWithBase);
  assert.ok(res.some((c) => c.rule === 'base-showcase-not-null'));
});

test('enforces ambition and section rules', () => {
  const base = { ...canonicalShowcases[0].selection };

  // slice with included sections
  const resSlice = validateSelection({ ...base, ambition: 'slice', includedSections: ['vegetation'] });
  assert.ok(resSlice.some((c) => c.rule === 'slice-sections-forbidden'));

  // showcase with no core sections
  const resShowcaseNoCore = validateSelection({ ...base, ambition: 'showcase', includedSections: [] });
  assert.ok(resShowcaseNoCore.some((c) => c.rule === 'showcase-ambition-requires-sections'));

  // showcase with extra sections
  const resShowcaseExtra = validateSelection({ ...base, ambition: 'showcase', extraSections: ['weather'] });
  assert.ok(resShowcaseExtra.some((c) => c.rule === 'showcase-extra-sections-forbidden'));

  // everything missing core or extra
  const resEverythingNoExtra = validateSelection({
    ...base,
    ambition: 'everything',
    includedSections: ['vegetation', 'state-buffer', 'audio'],
    extraSections: [],
  });
  assert.ok(resEverythingNoExtra.some((c) => c.rule === 'everything-extra-sections-required'));
});

test('enforces state-channel contract rules', () => {
  const base = { ...canonicalShowcases[0].selection };

  // Missing write key
  const missingKeyContract = { ...base.stateChannelContract };
  delete missingKeyContract['depression'];
  const resMissing = validateSelection({ ...base, stateChannelContract: missingKeyContract });
  assert.ok(resMissing.some((c) => c.rule === 'mechanic-write-missing'));

  // Unknown write key
  const unknownKeyContract = { ...base.stateChannelContract, 'unknown-write': { channel: 'A', effect: 'bad' } };
  const resUnknown = validateSelection({ ...base, stateChannelContract: unknownKeyContract });
  assert.ok(resUnknown.some((c) => c.rule === 'mechanic-write-unknown'));

  // Invalid channel
  const invalidChanContract = {
    ...base.stateChannelContract,
    'depression': { channel: 'Z', effect: 'effect' },
  };
  const resChan = validateSelection({ ...base, stateChannelContract: invalidChanContract });
  assert.ok(resChan.some((c) => c.rule === 'state-channel-target-invalid'));

  // Duplicate destination channel
  const dupChanContract = {
    'depression': { channel: 'R', effect: 'eff1' },
    'displaced-mass': { channel: 'R', effect: 'eff2' },
    'wetness-or-compaction': { channel: 'B', effect: 'eff3' },
  };
  const resDup = validateSelection({ ...base, stateChannelContract: dupChanContract });
  assert.ok(resDup.some((c) => c.rule === 'state-channel-duplicate-target'));
});

test('enforces camera adjustments rules', () => {
  const base = { ...canonicalShowcases[0].selection, camera: 'First Person' };

  // Missing required camera adjustment
  const resMissing = validateSelection({ ...base, cameraAdjustments: ['hand-rings-12'] });
  assert.ok(resMissing.some((c) => c.rule === 'camera-adjustments-mismatch'));

  // Extra camera adjustment
  const resExtra = validateSelection({
    ...base,
    cameraAdjustments: ['hand-rings-12', 'cloth-plus-one', 'hide-head-neck-only', 'verification-framing', 'stereo-target'],
  });
  assert.ok(resExtra.some((c) => c.rule === 'camera-adjustments-mismatch'));

  // Duplicate adjustment
  const resDup = validateSelection({
    ...base,
    cameraAdjustments: ['hand-rings-12', 'hand-rings-12', 'cloth-plus-one', 'hide-head-neck-only', 'verification-framing'],
  });
  assert.ok(resDup.some((c) => c.rule === 'camera-adjustments-duplicate'));
});

test('enforces Signature Moment enablement and required fields', () => {
  const base = { ...canonicalShowcases[0].selection };

  // Proven with signature enabled -> error
  const resProvenEnabled = validateSelection({
    ...base,
    creativeMode: 'proven',
    signatureMoment: { enabled: true, text: 'txt', reusedSystem: 'sys', verificationPose: 'mechanic' },
  });
  assert.ok(resProvenEnabled.some((c) => c.rule === 'proven-signature-enabled-forbidden'));

  // Signature mode with signature disabled -> error
  const resSigDisabled = validateSelection({
    ...base,
    creativeMode: 'signature',
    signatureMoment: { enabled: false, text: '', reusedSystem: '', verificationPose: 'mechanic' },
  });
  assert.ok(resSigDisabled.some((c) => c.rule === 'signature-moment-disabled'));

  // Signature mode missing text or reusedSystem or wrong verificationPose
  const resSigBadFields = validateSelection({
    ...base,
    signatureMoment: { enabled: true, text: '', reusedSystem: 'sys', verificationPose: 'idle' },
  });
  assert.ok(resSigBadFields.some((c) => c.rule === 'signature-moment-text-required'));
  assert.ok(resSigBadFields.some((c) => c.rule === 'signature-moment-verification-pose-invalid'));
});

test('rejects novelty-budget flags when true', () => {
  const base = { ...canonicalShowcases[0].selection };

  for (const flag of [
    'addsEngine',
    'addsAssetCategory',
    'addsPersistentBuffer',
    'addsMajorRenderPass',
    'addsSimulationSubsystem',
    'addsInput',
    'increasesAmbition',
  ]) {
    const res = validateSelection({
      ...base,
      noveltyBudget: { ...base.noveltyBudget, [flag]: true },
    });
    assert.ok(res.some((c) => c.rule === 'novelty-budget-violation'), `Flag ${flag}=true was not rejected`);
  }
});

test('formatStateChannelContract produces deterministic output and throws on invalid selection', () => {
  const alpine = canonicalShowcases[0].selection;
  const formatted = formatStateChannelContract(alpine);
  assert.match(formatted, /^\* \*\*`depression`\*\* → \*\*`R`\*\*/m);
  assert.match(formatted, /carve groove lowers snow depression depth/);

  const dune = canonicalShowcases[2].selection; // slice -> empty contract
  assert.equal(formatStateChannelContract(dune), '');

  const invalid = { ...alpine, creativeMode: 'invalid' };
  assert.throws(() => formatStateChannelContract(invalid), /Cannot format invalid selection/);
});
