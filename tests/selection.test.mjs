import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSelection,
  formatStateChannelContract,
  SHOWCASES,
  normalizeProvenSignatureMoment,
} from '../selection.mjs';
import { assembleBrief } from '../assemble.mjs';
import { validateBuildContract } from '../build-contract.mjs';

/** Helper to derive a clean valid selection directly from SHOWCASES registry entry */
function deriveSelection(showcaseName, creativeMode = 'signature') {
  const base = SHOWCASES[showcaseName];
  if (!base) throw new Error(`Unknown showcase ${showcaseName}`);

  const isProven = creativeMode === 'proven';
  return {
    creativeMode,
    path: 'showcase',
    baseShowcase: showcaseName,
    changedAxes: [],
    ambition: base.ambition,
    biome: base.biome,
    archetype: base.archetype,
    mechanic: base.mechanic,
    camera: base.camera,
    renderingProfile: base.renderingProfile,
    includedSections: [...base.includedSections],
    extraSections: [...base.extraSections],
    stateChannelContract: JSON.parse(JSON.stringify(base.stateChannelContract)),
    cameraAdjustments: [...base.cameraAdjustments],
    signatureMoment: {
      enabled: !isProven,
      text: isProven ? '' : 'Canonical signature spark effect',
      reusedSystem: isProven ? '' : 'particles',
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
}

test('all six canonical showcase selections derived from SHOWCASES validate cleanly', () => {
  for (const name of Object.keys(SHOWCASES)) {
    const sel = deriveSelection(name, 'signature');
    const errors = validateSelection(sel).filter((c) => c.severity === 'error');
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

test('malformed nested inputs do not throw and return findings', () => {
  const base = deriveSelection('Alpine Dawn');

  const malformedCases = [
    { key: 'includedSections', val: {} },
    { key: 'extraSections', val: 42 },
    { key: 'changedAxes', val: 123 },
    { key: 'stateChannelContract', val: 'abc' },
    { key: 'cameraAdjustments', val: 'xyz' },
    { key: 'signatureMoment', val: 5 },
    { key: 'noveltyBudget', val: 'foo' },
  ];

  for (const { key, val } of malformedCases) {
    assert.doesNotThrow(() => {
      const res = validateSelection({ ...base, [key]: val });
      assert.ok(res.length > 0, `Expected error findings for malformed ${key}`);
      assert.ok(res.some((c) => c.severity === 'error'), `Expected error severity for malformed ${key}`);
    }, `Threw exception for malformed ${key}`);
  }
});

test('reordered canonical section arrays do not count as axis drift', () => {
  const sel = deriveSelection('Hoshi-no-Tani');
  sel.includedSections = ['audio', 'state-buffer', 'vegetation']; // reordered
  sel.extraSections = ['architecture', 'destructibility', 'weather', 'water-bodies']; // reordered

  const errors = validateSelection(sel).filter((c) => c.severity === 'error');
  assert.deepEqual(errors, []);
});

// ADVERSARIAL TEST 1
test('adversarial 1: Signature Alpine Dawn with canonical channel destinations changed returns showcase-state-contract-drift', () => {
  const sel = deriveSelection('Alpine Dawn', 'signature');
  sel.stateChannelContract['depression'].channel = 'G'; // modified channel from R to G

  const res = validateSelection(sel);
  assert.ok(res.some((c) => c.rule === 'showcase-state-contract-drift'), 'Expected showcase-state-contract-drift error');
});

// ADVERSARIAL TEST 2
test('adversarial 2: Fully custom selection with baseShowcase omitted returns base-showcase-not-null', () => {
  const sel = deriveSelection('Alpine Dawn');
  sel.creativeMode = 'experimental';
  sel.path = 'fully-custom';
  delete sel.baseShowcase; // omitted / undefined

  const res = validateSelection(sel);
  assert.ok(res.some((c) => c.rule === 'base-showcase-not-null'), 'Expected base-showcase-not-null error');
});

// ADVERSARIAL TEST 3
test('adversarial 3: Slice selection with stateChannelContract omitted returns state-channel-contract-prohibited', () => {
  const sel = deriveSelection('Dune Sea'); // Dune Sea is slice
  delete sel.stateChannelContract; // omitted / undefined

  const res = validateSelection(sel);
  assert.ok(res.some((c) => c.rule === 'state-channel-contract-prohibited'), 'Expected state-channel-contract-prohibited error');
});

// ADVERSARIAL TEST 4
test('adversarial 4: Selection with an unknown novelty-budget key returns novelty-budget-unknown', () => {
  const sel = deriveSelection('Alpine Dawn');
  sel.noveltyBudget.extraUnsupportedFlag = false;

  const res = validateSelection(sel);
  assert.ok(res.some((c) => c.rule === 'novelty-budget-unknown'), 'Expected novelty-budget-unknown error');
});

// ADVERSARIAL TEST 5
test('adversarial 5: State-channel entry with an unknown property returns state-channel-entry-unknown', () => {
  const sel = deriveSelection('Alpine Dawn');
  sel.stateChannelContract['depression'].extraProp = true;

  const res = validateSelection(sel);
  assert.ok(res.some((c) => c.rule === 'state-channel-entry-unknown'), 'Expected state-channel-entry-unknown error');
});

// ADVERSARIAL TEST 6
test('adversarial 6: Experimental Alpine Dawn with changed sections but changedAxes: [] returns changed-axes-mismatch', () => {
  const sel = deriveSelection('Alpine Dawn');
  sel.creativeMode = 'experimental';
  sel.path = 'base-showcase';
  sel.extraSections = ['weather']; // changed section while changedAxes remains []

  const res = validateSelection(sel);
  assert.ok(res.some((c) => c.rule === 'changed-axes-mismatch'), 'Expected changed-axes-mismatch error');
});

test('rejects invalid modes and mode/path combinations', () => {
  const base = deriveSelection('Alpine Dawn');

  const resMode = validateSelection({ ...base, creativeMode: 'invalid-mode' });
  assert.ok(resMode.some((c) => c.rule === 'creative-mode-invalid'));

  const resPath = validateSelection({ ...base, path: 'invalid-path' });
  assert.ok(resPath.some((c) => c.rule === 'path-invalid'));

  const resMismatch = validateSelection({ ...base, creativeMode: 'proven', path: 'fully-custom', baseShowcase: null });
  assert.ok(resMismatch.some((c) => c.rule === 'mode-path-mismatch'));
});

test('rejects Proven and Signature drift from base showcase', () => {
  const driftedProven = {
    ...deriveSelection('Alpine Dawn', 'proven'),
    biome: 'Volcanic', // changed biome without using experimental mode/path
  };
  const res = validateSelection(driftedProven);
  assert.ok(res.some((c) => c.rule === 'showcase-drift'));
});

test('rejects incorrect or excessive Experimental changed axes', () => {
  // Excessive changed axes: changing both biome and camera
  const expExcessive = {
    ...deriveSelection('Alpine Dawn'),
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
    ...deriveSelection('Alpine Dawn'),
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
    ...deriveSelection('Alpine Dawn'),
    creativeMode: 'experimental',
    path: 'fully-custom',
    baseShowcase: 'Alpine Dawn', // must be null!
  };
  const res = validateSelection(customWithBase);
  assert.ok(res.some((c) => c.rule === 'base-showcase-not-null'));
});

test('enforces ambition and section rules', () => {
  const base = deriveSelection('Alpine Dawn');

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
  const base = deriveSelection('Alpine Dawn');

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
  const base = deriveSelection('Emberfall'); // Emberfall uses First Person

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
  const base = deriveSelection('Alpine Dawn');

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
  const base = deriveSelection('Alpine Dawn');

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
  const alpine = deriveSelection('Alpine Dawn');
  const formatted = formatStateChannelContract(alpine);
  assert.match(formatted, /^\* \*\*`depression`\*\* → \*\*`R`\*\*/m);
  assert.match(formatted, /carve groove lowers snow depression depth/);

  const dune = deriveSelection('Dune Sea'); // slice -> empty contract
  assert.equal(formatStateChannelContract(dune), '');

  const invalid = { ...alpine, creativeMode: 'invalid' };
  assert.throws(() => formatStateChannelContract(invalid), /Cannot format invalid selection/);
});

test('Tidal Shelf landing-depression mapping is correctly authored and formatted', () => {
  const tidalContract = SHOWCASES['Tidal Shelf'].stateChannelContract;
  assert.equal(
    tidalContract['landing-depression'].effect,
    'landing depression becomes bed-scour depth',
    'Tidal Shelf registry effect mismatch',
  );

  const formattedTidal = formatStateChannelContract(deriveSelection('Tidal Shelf'));
  assert.match(
    formattedTidal,
    /^\* \*\*`landing-depression`\*\* → \*\*`B`\*\* \(bed scour depth 0 -> 0\.22 m\): landing depression becomes bed-scour depth$/m,
    'Formatted Tidal Shelf contract line mismatch',
  );
});

test('normalizeProvenSignatureMoment returns the exact canonical Proven shape', () => {
  assert.deepEqual(normalizeProvenSignatureMoment(), { enabled: false, text: '', reusedSystem: '', verificationPose: 'mechanic' });
});

test('selection.mjs and build-contract.mjs cannot disagree on what a valid Proven signatureMoment looks like', () => {
  const provenSelection = deriveSelection('Alpine Dawn', 'proven');
  provenSelection.signatureMoment = normalizeProvenSignatureMoment();
  const selectionFindings = validateSelection(provenSelection).filter((f) => f.severity === 'error');
  assert.equal(selectionFindings.length, 0, JSON.stringify(selectionFindings));

  const spec = {
    selection: provenSelection,
    creativeSpark: '',
    builderAgent: 'Claude Code',
    extraSectionMarkdown: {},
  };
  const { buildContract } = assembleBrief(spec);
  const contractValidation = validateBuildContract(buildContract);
  assert.equal(contractValidation.valid, true, contractValidation.errors.join('; '));
  assert.deepEqual(buildContract.creative.signatureMoment.enabled, false);
  assert.deepEqual(buildContract.creative.signatureMoment.text, '');
  assert.deepEqual(buildContract.creative.signatureMoment.reusedSystem, '');
  assert.equal(buildContract.creative.signatureMoment.verificationPose, 'mechanic');
});
