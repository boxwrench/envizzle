import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkCoherence } from '../check.mjs';

const md = fs.readFileSync('references/presets.md', 'utf8');

/** Extract every fenced json block, with the nearest preceding heading. */
function jsonBlocks(text) {
  const out = [];
  const re = /^#{2,4}\s+(.+?)\s*$([\s\S]*?)```json\n([\s\S]*?)```/gm;
  for (const m of text.matchAll(re)) {
    out.push({ heading: m[1], config: JSON.parse(m[3]) });
  }
  return out;
}

/** The body of a top-level `## Heading` section, matched by prefix. */
function section(prefix) {
  return md.split(/^##\s+/m).find((s) => s.toLowerCase().startsWith(prefix.toLowerCase()));
}

test('presets file is substantial', () => {
  assert.ok(md.length > 6000, `presets.md is only ${md.length} chars`);
});

test('declares the three ambition levels', () => {
  for (const level of ['slice', 'showcase', 'everything']) {
    assert.match(md, new RegExp(`\\b${level}\\b`), `missing ambition level: ${level}`);
  }
});

test('slice is stated as the default', () => {
  assert.match(md, /slice[^\n]{0,80}default|default[^\n]{0,80}slice/i);
});

test('ships at least six biomes with parseable palettes', () => {
  const blocks = jsonBlocks(md);
  assert.ok(blocks.length >= 6, `found only ${blocks.length} json config blocks`);
});

test('every palette entry is well-formed', () => {
  for (const { heading, config } of jsonBlocks(md)) {
    assert.ok(Array.isArray(config.palette), `${heading}: no palette array`);
    for (const e of config.palette) {
      assert.match(e.hex, /^#[0-9a-f]{6}$/i, `${heading}: bad hex ${e.hex}`);
      assert.ok(['large', 'medium', 'accent'].includes(e.area), `${heading}: bad area ${e.area}`);
      assert.ok(typeof e.role === 'string' && e.role.length > 0, `${heading}: missing role`);
    }
  }
});

test('every shipped palette is coherence-clean', () => {
  for (const { heading, config } of jsonBlocks(md)) {
    const errors = checkCoherence({ ...config, assetStrategy: 'zero-asset' })
      .filter((c) => c.severity === 'error');
    assert.deepEqual(
      errors.map((c) => c.rule), [],
      `"${heading}" has coherence errors: ${errors.map((c) => c.message).join(' | ')}`,
    );
  }
});

test('every biome gives numeric noise layers, not adjectives', () => {
  // Biomes are `###` entries under the single `## Biomes` section, so the split
  // that isolates one biome is on `###`, not on `##`.
  const biomes = section('Biomes');
  assert.ok(biomes, 'no "Biomes" section');
  const biomeSections = biomes
    .split(/^###\s+/m)
    .slice(1) // [0] is the section preamble, not a biome
    .filter((s) => /noise|TERRAIN_NOISE/i.test(s));
  assert.ok(
    biomeSections.length >= 6,
    `only ${biomeSections.length} biomes describe noise layers`,
  );
  for (const s of biomeSections) {
    const name = s.split('\n')[0];
    assert.match(s, /\d+\s*m\b/, `${name}: noise layers lack metre scales`);
    assert.match(s, /amp/i, `${name}: noise layers lack amplitudes`);
  }
});

test('archetypes parameterise the shared rig and never name a primitive', () => {
  const s = section('Character archetypes');
  assert.ok(s, 'no "Character archetypes" section');
  for (const prim of [
    'BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'CapsuleGeometry', 'ConeGeometry',
  ]) {
    assert.doesNotMatch(s, new RegExp(prim), `archetypes mention ${prim}`);
  }
  assert.match(s, /height/i);
  assert.match(s, /hidden lower body/i);
  assert.match(s, /\d+\s*[x×]\s*\d+/, 'no Verlet grid dimensions');
  assert.match(s, /character-recipe\.md/, 'archetypes do not point at the shared rig');
});

test('at least five archetypes, five mechanics, four camera modes', () => {
  const count = (heading, min) => {
    const s = section(heading);
    assert.ok(s, `no "${heading}" section`);
    const rows = s.split('\n').filter((l) => /^\s*###\s+/.test(l));
    assert.ok(rows.length >= min, `${heading}: found ${rows.length}, need ${min}`);
  };
  count('character archetypes', 5);
  count('centrepiece mechanics', 5);
  count('camera', 4);
});

test('showcase configs are whole and never to be mixed', () => {
  const s = section('Showcase configs');
  assert.ok(s, 'no "Showcase configs" section');
  assert.match(s, /never mix|do not mix|as a whole/i);
  const entries = s.split('\n').filter((l) => /^\s*###\s+/.test(l));
  assert.ok(entries.length >= 6, `found ${entries.length} showcase configs, need 6`);
});

test('rendering profiles section documents exactly two supported profiles', () => {
  const s = section('Rendering profiles');
  assert.ok(s, 'no "Rendering profiles" section');
  assert.match(s, /Default profile:\s*Babylon WebGPU/i);
  assert.match(s, /Alternative profile:\s*Three WebGL2/i);
  assert.match(s, /Envizzle v0\.1 supports exactly two rendering profiles/i);
});

test('showcase configs follow strict profile contracts', () => {
  const s = section('Showcase configs');
  assert.ok(s, 'no "Showcase configs" section');
  assert.doesNotMatch(s, /Three\.js.*WebGPU/i, 'showcase config contains Three.js with WebGPU');
  assert.doesNotMatch(s, /WebGL.*fallback/i, 'showcase config describes WebGL as fallback');

  const configs = s.split(/^###\s+/m).slice(1);
  assert.equal(configs.length, 6, `expected 6 showcase configs, got ${configs.length}`);

  for (const cfg of configs) {
    const name = cfg.split('\n')[0].trim();
    assert.match(cfg, /`MATERIAL_API`/, `${name} missing MATERIAL_API token`);

    if (/Three\.js/i.test(cfg)) {
      assert.match(cfg, /WebGLRenderer \(WebGL2 only\)/, `${name} missing WebGLRenderer (WebGL2 only)`);
      assert.match(cfg, /GLSL ES 3\.00 raw modules/, `${name} missing GLSL ES 3.00 raw modules`);
      assert.match(cfg, /`glsl`/, `${name} missing glsl extension`);
      assert.match(cfg, /Three\.js RawShaderMaterial on WebGLRenderer/, `${name} missing Three.js RawShaderMaterial on WebGLRenderer`);
    } else if (/Babylon\.js/i.test(cfg)) {
      assert.match(cfg, /WebGPU only/, `${name} missing WebGPU only`);
      assert.match(cfg, /WGSL/, `${name} missing WGSL`);
      assert.match(cfg, /`wgsl`/, `${name} missing wgsl extension`);
      assert.match(cfg, /Babylon\.js ShaderMaterial configured with ShaderLanguage\.WGSL/, `${name} missing Babylon.js ShaderMaterial API`);
    } else {
      assert.fail(`${name} does not specify a recognized engine`);
    }
  }
});

test('Creative modes section exists and documents mode rules', () => {
  const s = section('Creative modes');
  assert.ok(s, 'no "Creative modes" section');

  const subsections = s.split('\n').filter((l) => /^\s*###\s+/.test(l));
  assert.equal(subsections.length, 3, `expected 3 creative mode subsections, got ${subsections.length}`);
  assert.match(s, /### Proven/);
  assert.match(s, /### Signature/);
  assert.match(s, /### Experimental/);

  assert.match(s, /Signature is the default creative mode|Signature is the default/i);
  assert.match(s, /Never select Experimental automatically|Never select Experimental/i);
  assert.match(s, /named showcase/i);
  assert.match(s, /at most one major axis/i);
  assert.match(s, /complete supported/i);
  assert.match(s, /checkCoherence/i);

  assert.match(s, /Proven[\s\S]*?continue directly to Step 3/i);
  assert.match(s, /Signature[\s\S]*?continue directly to Step 3/i);
  assert.match(s, /Base-showcase path[\s\S]*?ask only the relevant Step 2 question/i);
  assert.match(s, /Fully custom path[\s\S]*?Enter the full Step 2 interview/i);

  assert.match(s, /Experimental fully custom path is the only path that runs the complete Step 2 interview/i);

  assert.match(s, /restore the selected configuration without the Signature Moment/i);

  assert.match(s, /Proven[\s\S]*?ENABLE_SIGNATURE_MOMENT[\s\S]*?(false|no-op)/i);
  assert.match(s, /Signature[\s\S]*?ENABLE_SIGNATURE_MOMENT[\s\S]*?default/i);
  assert.match(s, /Experimental[\s\S]*?ENABLE_SIGNATURE_MOMENT[\s\S]*?default/i);
});

test('presets.md contains no stale token-count or manual verification phrases', () => {
  assert.doesNotMatch(md, /37 tokens|of the 37|one of the 37|manually verify mechanic/i);
});
