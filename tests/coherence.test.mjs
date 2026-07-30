import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeLuminance, saturation, checkCoherence } from '../check.mjs';

// Verified by hand against the WCAG formula.
test('relativeLuminance matches known values', () => {
  assert.ok(Math.abs(relativeLuminance('#000000') - 0.0) < 1e-6);
  assert.ok(Math.abs(relativeLuminance('#ffffff') - 1.0) < 1e-6);
  assert.ok(Math.abs(relativeLuminance('#00ffcc') - 0.759) < 0.01);
  assert.ok(Math.abs(relativeLuminance('#d8d0b8') - 0.632) < 0.01);
  assert.ok(Math.abs(relativeLuminance('#0d3b4c') - 0.037) < 0.01);
});

test('saturation separates neon from tinted neutral', () => {
  assert.ok(Math.abs(saturation('#00ffcc') - 1.0) < 1e-6);
  assert.ok(saturation('#d8d0b8') < 0.35);
});

test('hexToRgb01 validates hex strings strictly', async () => {
  const { hexToRgb01 } = await import('../check.mjs');
  assert.deepEqual(hexToRgb01('#ffffff'), [1, 1, 1]);
  assert.throws(() => hexToRgb01('#fff'), /#rrggbb/);
  assert.throws(() => hexToRgb01('#gggggg'), /#rrggbb/);
});

test('validateConfig diagnoses missing or null config', async () => {
  const { validateConfig } = await import('../check.mjs');
  const rulesNull = validateConfig(null).map((c) => c.rule);
  assert.ok(rulesNull.includes('config-required'));
  const rulesUndefined = validateConfig(undefined).map((c) => c.rule);
  assert.ok(rulesUndefined.includes('config-required'));
});

test('validateConfig diagnoses invalid paradigm', async () => {
  const { validateConfig } = await import('../check.mjs');
  const rules = validateConfig({
    paradigm: 'invalid-paradigm',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'some behavior',
    palette: [{ role: 'sky', hex: '#a8c8e8', area: 'large' }],
  }).map((c) => c.rule);
  assert.ok(rules.includes('paradigm-invalid'));
});

test('validateConfig diagnoses missing assetStrategy', async () => {
  const { validateConfig } = await import('../check.mjs');
  const rules = validateConfig({
    paradigm: 'photoreal',
    assetStrategy: '',
    materialBehaviours: 'some behavior',
    palette: [{ role: 'sky', hex: '#a8c8e8', area: 'large' }],
  }).map((c) => c.rule);
  assert.ok(rules.includes('asset-strategy-required'));
});

test('validateConfig diagnoses missing or blank material behavior text', async () => {
  const { validateConfig } = await import('../check.mjs');
  const rules = validateConfig({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: '   ',
    palette: [{ role: 'sky', hex: '#a8c8e8', area: 'large' }],
  }).map((c) => c.rule);
  assert.ok(rules.includes('material-behaviours-required'));
});

test('validateConfig diagnoses missing or empty palette', async () => {
  const { validateConfig, checkCoherence } = await import('../check.mjs');
  const rulesEmpty = checkCoherence({
    paradigm: 'painterly',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'some behavior',
    palette: [],
  }).map((c) => c.rule);
  assert.ok(rulesEmpty.includes('palette-required'));

  const rulesMissing = validateConfig({
    paradigm: 'painterly',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'some behavior',
  }).map((c) => c.rule);
  assert.ok(rulesMissing.includes('palette-required'));
});

test('validateConfig diagnoses invalid entry hex, area, and role', async () => {
  const { validateConfig } = await import('../check.mjs');
  const rules = validateConfig({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'some behavior',
    palette: [{ role: '', hex: '#gggggg', area: 'invalid-area' }],
  }).map((c) => c.rule);
  assert.ok(rules.includes('palette-entry-invalid'));
});

test('validateConfig diagnoses palette without a large area entry', async () => {
  const { validateConfig } = await import('../check.mjs');
  const rules = validateConfig({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'some behavior',
    palette: [{ role: 'sun', hex: '#ffffff', area: 'accent' }],
  }).map((c) => c.rule);
  assert.ok(rules.includes('large-area-required'));
});

test('checkCoherence does not throw on malformed input', async () => {
  const { checkCoherence } = await import('../check.mjs');
  assert.doesNotThrow(() => checkCoherence(null));
  assert.doesNotThrow(() => checkCoherence({}));
  assert.doesNotThrow(() => checkCoherence({ palette: [{ role: '', hex: '#gggggg', area: 'huge' }] }));
  assert.ok(Array.isArray(checkCoherence(null)));
});

// The config that produced the muddy dark frames in the reference output.
const REFERENCE_BAD = {
  paradigm: 'painterly',
  assetStrategy: 'zero-asset',
  materialBehaviours: 'Palette table, cel ramp, bioluminescent veins',
  palette: [
    { role: 'sky',        hex: '#2b0052', area: 'large' },
    { role: 'terrain',    hex: '#080810', area: 'large' },
    { role: 'vegetation', hex: '#0d3b4c', area: 'large' },
    { role: 'accent-a',   hex: '#ff0066', area: 'accent' },
    { role: 'accent-b',   hex: '#00ffcc', area: 'accent' },
    { role: 'accent-c',   hex: '#ffaa00', area: 'accent' },
  ],
};

test('flags the reference config on the light-anchor rule', () => {
  // Regression guard: a naive "must contain a bright colour" rule PASSES this
  // config, because #00ffcc has luminance 0.76. The anchor must be desaturated.
  const rules = checkCoherence(REFERENCE_BAD).map((c) => c.rule);
  assert.ok(rules.includes('light-anchor'), `rules were: ${rules.join(', ')}`);
});

test('flags the reference config on large-area luminance', () => {
  assert.ok(checkCoherence(REFERENCE_BAD).map((c) => c.rule).includes('large-area-luminance'));
});

test('every conflict carries a usable fix and a valid severity', () => {
  for (const c of checkCoherence(REFERENCE_BAD)) {
    assert.ok(c.fix.length > 10, `rule ${c.rule} has no usable fix text`);
    assert.ok(['error', 'warn'].includes(c.severity));
  }
});

test('a coherent high-key painterly palette passes clean', () => {
  assert.deepEqual(checkCoherence({
    paradigm: 'painterly',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'Single-source palette table converted to linear, cel ramp, shadow wobble',
    palette: [
      { role: 'sky',        hex: '#a8c8e8', area: 'large' },
      { role: 'cloud',      hex: '#f2ece0', area: 'large' },
      { role: 'vegetation', hex: '#7a9a54', area: 'large' },
      { role: 'rock',       hex: '#6b6256', area: 'medium' },
      { role: 'shadow',     hex: '#2c3348', area: 'medium' },
      { role: 'sun-accent', hex: '#f0b24a', area: 'accent' },
    ],
  }), []);
});

test('photoreal zero-asset must declare multi-scale normals', () => {
  const rules = checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'A stock PBR material',
    palette: [
      { role: 'sky',    hex: '#b9d2ea', area: 'large' },
      { role: 'snow',   hex: '#eef2f6', area: 'large' },
      { role: 'rock',   hex: '#5d5a55', area: 'medium' },
      { role: 'shadow', hex: '#31445e', area: 'medium' },
      { role: 'night',  hex: '#0a0d12', area: 'medium' },
    ],
  }).map((c) => c.rule);
  assert.ok(rules.includes('photoreal-multiscale-normals'));
});

test('accent-heavy palettes are capped', () => {
  const rules = checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'multi-scale normals',
    palette: [
      { role: 'sky',  hex: '#a8c8e8', area: 'large' },
      { role: 'base', hex: '#f2ece0', area: 'large' },
      { role: 'dark', hex: '#0a0d12', area: 'medium' },
      { role: 'a',    hex: '#ff0066', area: 'accent' },
      { role: 'b',    hex: '#00ffcc', area: 'accent' },
      { role: 'c',    hex: '#ffaa00', area: 'accent' },
      { role: 'd',    hex: '#ff00ff', area: 'accent' },
    ],
  }).map((c) => c.rule);
  assert.ok(rules.includes('accent-cap'));
});

test('an empty palette fails with palette-required', () => {
  const rules = checkCoherence({ paradigm: 'painterly', assetStrategy: 'zero-asset', materialBehaviours: 'cel ramp', palette: [] })
    .map((c) => c.rule);
  assert.ok(rules.includes('palette-required'));
});

test('an all-obsidian photoreal palette cannot slip through', () => {
  // The painterly exemption on large-area luminance must not become a licence
  // for an all-dark frame. This palette is DARKER than the reference config
  // (mean large-area luminance 0.009) yet has a bright desaturated accent and
  // all three value tiers, so it passed every rule before large-area-all-dark.
  const rules = checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'multi-scale procedural normals',
    palette: [
      { role: 'sky',        hex: '#0b0b14', area: 'large' },
      { role: 'terrain',    hex: '#080810', area: 'large' },
      { role: 'vegetation', hex: '#122b2b', area: 'large' },
      { role: 'rock-rim',   hex: '#8a8378', area: 'medium' },
      { role: 'moon-spec',  hex: '#e8e8e8', area: 'accent' },
    ],
  }).map((c) => c.rule);
  assert.ok(rules.includes('large-area-all-dark'), `rules were: ${rules.join(', ')}`);
});

test('a light anchor confined to an accent does not count', () => {
  // R1's own fix text says the anchor belongs at large or medium area.
  const rules = checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'multi-scale procedural normals',
    palette: [
      { role: 'sky',      hex: '#3a4450', area: 'large' },
      { role: 'ground',   hex: '#2b2f36', area: 'large' },
      { role: 'shadow',   hex: '#0a0d12', area: 'medium' },
      { role: 'headlamp', hex: '#f2ece0', area: 'accent' },
    ],
  }).map((c) => c.rule);
  assert.ok(rules.includes('light-anchor'), `rules were: ${rules.join(', ')}`);
});

test('one lit band over near-black large areas does not buy a pass', () => {
  // large-area-all-dark is an existence check on the brightest value, so a
  // single large area a hair over 0.15 would otherwise license arbitrarily
  // black remaining large areas. Mean here is 0.056.
  const rules = checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'multi-scale procedural normals',
    palette: [
      { role: 'haze-band',  hex: '#707070', area: 'large' },
      { role: 'terrain',    hex: '#050508', area: 'large' },
      { role: 'vegetation', hex: '#060b0b', area: 'large' },
      { role: 'cliff-lip',  hex: '#d8d0b8', area: 'medium' },
      { role: 'ember',      hex: '#ff5a1e', area: 'accent' },
    ],
  }).map((c) => c.rule);
  assert.ok(rules.includes('large-area-mean-floor'), `rules were: ${rules.join(', ')}`);
});

test('a volcanic palette authored to the floor passes', () => {
  // Proof the floor leaves the deliberate low-key biome buildable — Task 4
  // must ship this preset. Two large areas carrying light, not one stripe.
  assert.deepEqual(checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'multi-scale procedural normals, emissive crust fissures',
    palette: [
      { role: 'ash-sky',      hex: '#9a8578', area: 'large' },
      { role: 'ash-plain',    hex: '#6b5f57', area: 'large' },
      { role: 'basalt',       hex: '#14100f', area: 'large' },
      { role: 'steam-lit',    hex: '#e8dcc8', area: 'medium' },
      { role: 'lava-fissure', hex: '#ff5a1e', area: 'accent' },
    ],
  }), []);
});

test('a disciplined dark photoreal scene still passes', () => {
  // Night city: dark overall, but the wet road carries light at large area.
  assert.deepEqual(checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'multi-scale procedural normals, wet-surface reflectance',
    palette: [
      { role: 'wet-road-sheen', hex: '#c9d4dc', area: 'large' },
      { role: 'sky-glow',       hex: '#3d4658', area: 'large' },
      { role: 'facade',         hex: '#1b1f26', area: 'medium' },
      { role: 'deep-shadow',    hex: '#080a0e', area: 'medium' },
      { role: 'sodium-lamp',    hex: '#ffb45e', area: 'accent' },
    ],
  }), []);
});
