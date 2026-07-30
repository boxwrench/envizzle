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

test('hexToRgb01 rejects malformed hex', async () => {
  const { hexToRgb01 } = await import('../check.mjs');
  assert.throws(() => hexToRgb01('#fff'), /#rrggbb/);
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

test('an empty palette produces no palette conflicts', () => {
  assert.deepEqual(
    checkCoherence({ paradigm: 'painterly', assetStrategy: 'other', materialBehaviours: '' })
      .map((c) => c.rule),
    [],
  );
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
