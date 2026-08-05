import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkCoherence } from '../check.mjs';
import { loadReferenceCatalog } from '../reference-loader.mjs';
import {
  BIOME_CHANNELS,
  ARCHETYPES,
  MECHANIC_WRITES,
  CAMERA_REQUIREMENTS,
  RENDERING_PROFILES,
  SHOWCASES,
} from '../selection.mjs';

function jsonBlocks(text) {
  const out = [];
  const re = /^#{2,4}\s+(.+?)\s*$([\s\S]*?)```json\n([\s\S]*?)```/gm;
  for (const m of text.matchAll(re)) {
    out.push({ heading: m[1], config: JSON.parse(m[3]) });
  }
  return out;
}

test('all six new reference files exist and presets.md no longer exists', () => {
  const refs = ['modes.md', 'biomes.md', 'archetypes.md', 'mechanics.md', 'cameras.md', 'showcases.md'];
  for (const f of refs) {
    assert.ok(fs.existsSync(path.join('references', f)), `missing reference file: ${f}`);
  }
  assert.equal(fs.existsSync(path.join('references', 'presets.md')), false, 'presets.md should no longer exist');
});

test('active docs and verifier-facing source contain no old camera hook method', () => {
  const activePaths = [
    'SKILL.md',
    'TEMPLATE.md',
    'README.md',
    ...fs.readdirSync('references').filter((file) => file.endsWith('.md')).map((file) => path.join('references', file)),
    'assemble.mjs',
    'build-contract.mjs',
    'benchmark.mjs',
    'selection.mjs',
    'check.mjs',
    'reference-loader.mjs',
    ...fs.readdirSync('verify').filter((file) => file.endsWith('.mjs')).map((file) => path.join('verify', file)),
  ];
  const oldHookMethod = ['cameraNearest', 'Depth'].join('');
  const oldHookPattern = new RegExp(oldHookMethod + '\\s*\\(');
  const offenders = activePaths.filter((file) => oldHookPattern.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, [], `active files still mention the renamed hook method: ${offenders.join(', ')}`);
});
test('references longer than 100 lines contain a linked Contents section near the top', () => {
  const files = fs.readdirSync('references').filter((f) => f.endsWith('.md'));
  for (const f of files) {
    if (f === 'character-recipe.md') continue;
    const filePath = path.join('references', f);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    if (lines.length > 100) {
      assert.match(content, /^## Contents\s*$/m, `${f} has ${lines.length} lines (>100) but lacks ## Contents`);
    }
  }
});

test('local Markdown file links in active skill and reference documentation resolve', () => {
  const docFiles = [
    'SKILL.md',
    'README.md',
    'references/modes.md',
    'references/biomes.md',
    'references/archetypes.md',
    'references/mechanics.md',
    'references/cameras.md',
    'references/showcases.md',
    'references/implementation-planning.md',
    'references/babylon-webgpu-patterns.md',
    'references/visual-review.md',
  ];

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  for (const file of docFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(file);

    for (const match of content.matchAll(linkRegex)) {
      const href = match[2].trim();
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#') || href.startsWith('mailto:')) {
        continue;
      }
      const targetPath = href.split('#')[0];
      if (!targetPath) continue;
      const resolved = path.resolve(dir, targetPath);
      assert.ok(
        fs.existsSync(resolved),
        `In ${file}: link '${href}' resolves to '${resolved}' which does not exist.`,
      );
    }
  }
});

test('all six registered biome names appear in biomes.md', () => {
  const content = fs.readFileSync('references/biomes.md', 'utf8');
  for (const biome of Object.keys(BIOME_CHANNELS)) {
    assert.ok(content.includes(biome), `biomes.md missing biome: ${biome}`);
  }
});

test('all registered archetypes appear in archetypes.md', () => {
  const content = fs.readFileSync('references/archetypes.md', 'utf8');
  for (const archetype of ARCHETYPES) {
    assert.ok(content.includes(archetype), `archetypes.md missing archetype: ${archetype}`);
  }
});

test('all registered mechanics appear in mechanics.md', () => {
  const content = fs.readFileSync('references/mechanics.md', 'utf8');
  for (const mechanic of Object.keys(MECHANIC_WRITES)) {
    assert.ok(content.includes(mechanic), `mechanics.md missing mechanic: ${mechanic}`);
  }
});

test('all registered cameras and both profiles appear in cameras.md', () => {
  const content = fs.readFileSync('references/cameras.md', 'utf8');
  for (const camera of Object.keys(CAMERA_REQUIREMENTS)) {
    assert.ok(content.includes(camera), `cameras.md missing camera mode: ${camera}`);
  }
  for (const profileKey of Object.keys(RENDERING_PROFILES)) {
    assert.ok(content.includes(profileKey) || content.includes(RENDERING_PROFILES[profileKey].id), `cameras.md missing profile: ${profileKey}`);
  }
  assert.match(content, /Babylon WebGPU/i);
  assert.match(content, /Three WebGL2/i);
});

test('all registered showcases appear in showcases.md', () => {
  const content = fs.readFileSync('references/showcases.md', 'utf8');
  for (const showcase of Object.keys(SHOWCASES)) {
    assert.ok(content.includes(showcase), `showcases.md missing showcase: ${showcase}`);
  }
});

test('every canonical showcase state-channel effect from SHOWCASES appears in showcases.md', () => {
  const content = fs.readFileSync('references/showcases.md', 'utf8');
  for (const [name, sc] of Object.entries(SHOWCASES)) {
    if (!sc.stateChannelContract) continue;
    for (const [key, entry] of Object.entries(sc.stateChannelContract)) {
      assert.ok(
        content.includes(entry.effect),
        `Showcase '${name}' effect '${entry.effect}' for key '${key}' missing in showcases.md`,
      );
    }
  }
});

test('every shipped biome palette in biomes.md remains parseable and coherence-clean', () => {
  const content = fs.readFileSync('references/biomes.md', 'utf8');
  const blocks = jsonBlocks(content);
  assert.equal(blocks.length, 6, `expected 6 biome palette blocks, got ${blocks.length}`);
  for (const { heading, config } of blocks) {
    const errors = checkCoherence({ ...config, assetStrategy: 'zero-asset' })
      .filter((c) => c.severity === 'error');
    assert.deepEqual(
      errors.map((c) => c.rule), [],
      `"${heading}" has coherence errors: ${errors.map((c) => c.message).join(' | ')}`,
    );
  }
});

test('every biome has MORPHOLOGY_ANTI_PATTERNS and VISUAL_REVIEW_QUESTIONS tokens, not only Dune Desert', () => {
  const catalog = loadReferenceCatalog();
  const biomeNames = ['Alpine Snow', 'Ghibli Valley', 'Dune Desert', 'Ocean Shelf', 'Volcanic', 'Night City'];
  for (const name of biomeNames) {
    const biome = catalog.biomes[name];
    assert.ok(typeof biome.tokens.MORPHOLOGY_ANTI_PATTERNS === 'string' && biome.tokens.MORPHOLOGY_ANTI_PATTERNS.trim() !== '', `${name} missing MORPHOLOGY_ANTI_PATTERNS`);
    assert.ok(typeof biome.tokens.VISUAL_REVIEW_QUESTIONS === 'string' && biome.tokens.VISUAL_REVIEW_QUESTIONS.trim() !== '', `${name} missing VISUAL_REVIEW_QUESTIONS`);
  }
});

test('every mechanic in mechanics.md has an internally consistent centrepieceEffect block', () => {
  const catalog = loadReferenceCatalog();
  const mechanicNames = ['Surf / Carve', 'Flight / Glide', 'Beam Cannon', 'Grapple Swing', 'Summon Vehicle'];
  for (const name of mechanicNames) {
    const mechanic = catalog.mechanics[name];
    assert.ok(mechanic.centrepieceEffect, `${name} is missing a centrepieceEffect block`);
    const effect = mechanic.centrepieceEffect;
    assert.ok(typeof effect.name === 'string' && effect.name.trim() !== '');
    assert.ok(typeof effect.visualGoal === 'string' && effect.visualGoal.trim() !== '');
    assert.ok(typeof effect.sharedDriver === 'string' && effect.sharedDriver.trim() !== '');
    assert.ok(Array.isArray(effect.layers) && effect.layers.length >= 2, `${name} centrepieceEffect must have at least 2 layers`);
    const layerIds = effect.layers.map((l) => l.id);
    assert.ok(layerIds.includes(effect.dominantLayerId), `${name}'s dominantLayerId must reference a real layer`);
    const particleLayers = effect.layers.filter((l) => l.type === 'particles' || l.type === 'atmospheric-particles');
    assert.ok(particleLayers.length < effect.layers.length, `${name} must not be particle-only`);
    assert.ok(Array.isArray(effect.readabilityRequirements) && effect.readabilityRequirements.length >= 3);
  }
});

test('the Dune Sea Proven showcase resolves to the exact Sand Carve Wake recipe', () => {
  const catalog = loadReferenceCatalog();
  const effect = catalog.mechanics['Surf / Carve'].centrepieceEffect;
  assert.equal(effect.name, 'Sand Carve Wake');
  assert.equal(effect.dominantLayerId, 'wake-body');
  assert.deepEqual(effect.layers.map((l) => l.id), ['persistent-carve', 'wake-body', 'crest-curtain', 'ballistic-grains', 'wind-dust', 'camera-response']);
});

test('the exact Tidal Shelf landing interpretation remains preserved in showcases.md', () => {
  const content = fs.readFileSync('references/showcases.md', 'utf8');
  assert.match(
    content,
    /landing-depression\s*→\s*B\s*\(bed scour depth 0 -> 0\.22 m\):\s*landing depression becomes bed-scour depth/,
    'showcases.md missing exact Tidal Shelf landing interpretation',
  );
});

test('modes.md declares creative modes and ambition levels', () => {
  const content = fs.readFileSync('references/modes.md', 'utf8');
  for (const mode of ['Proven', 'Signature', 'Experimental']) {
    assert.ok(content.includes(mode), `modes.md missing mode: ${mode}`);
  }
  for (const level of ['slice', 'showcase', 'everything']) {
    assert.ok(content.includes(level), `modes.md missing ambition level: ${level}`);
  }
});

test('every biome in biomes.md gives numeric noise layers, not adjectives', () => {
  const content = fs.readFileSync('references/biomes.md', 'utf8');
  const biomeSections = content.split(/^###\s+/m).slice(1);
  assert.equal(biomeSections.length, 6, `expected 6 biomes, got ${biomeSections.length}`);
  for (const s of biomeSections) {
    const name = s.split('\n')[0];
    assert.match(s, /\d+\s*m\b/, `${name}: noise layers lack metre scales`);
    assert.match(s, /amp/i, `${name}: noise layers lack amplitudes`);
  }
});

test('archetypes parameterise the shared rig and never name a primitive', () => {
  const content = fs.readFileSync('references/archetypes.md', 'utf8');
  for (const prim of [
    'BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'CapsuleGeometry', 'ConeGeometry',
  ]) {
    assert.doesNotMatch(content, new RegExp(prim), `archetypes mention ${prim}`);
  }
  assert.match(content, /height/i);
  assert.match(content, /hidden lower body/i);
  assert.match(content, /\d+\s*[x×]\s*\d+/, 'no Verlet grid dimensions');
  assert.match(content, /character-recipe\.md/, 'archetypes do not point at the shared rig');
});

test('showcases.md names selection validation and coherence validation, omitting stale manual re-check', () => {
  const content = fs.readFileSync('references/showcases.md', 'utf8');
  assert.match(content, /validateSelection|selection\.mjs validate/, 'showcases.md must mention selection validation');
  assert.match(content, /checkCoherence|check\.mjs coherence/, 'showcases.md must mention coherence validation');
  assert.doesNotMatch(content, /re-check that the mechanic/, 'showcases.md must not contain stale manual channel re-check instruction');
});

test('biomes.md distinguishes nineteen template tokens from FOOT_INTERACTION without stating twenty tokens', () => {
  const content = fs.readFileSync('references/biomes.md', 'utf8');
  assert.match(content, /nineteen (template )?tokens/i, 'biomes.md must state nineteen template tokens');
  assert.match(content, /FOOT_INTERACTION/, 'biomes.md must mention FOOT_INTERACTION');
  assert.doesNotMatch(content, /twenty tokens/i, 'biomes.md must not claim twenty tokens');
});

function assertFollowsReferenceDocConvention(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(content, /^# .+$/m, `${filePath} must have an H1 title`);
  assert.match(content, /^## Contents\s*$/m, `${filePath} must have a ## Contents section`);
  assert.match(content, /^---\s*$/m, `${filePath} must have a --- divider after Contents`);
  assert.match(content, /^## (?!Contents\s*$).+$/m, `${filePath} must have at least one H2 section besides Contents`);
  return content;
}

test('all three new staged-build reference files exist', () => {
  const refs = ['implementation-planning.md', 'babylon-webgpu-patterns.md', 'visual-review.md'];
  for (const f of refs) {
    assert.ok(fs.existsSync(path.join('references', f)), `missing reference file: ${f}`);
  }
});

test('the three new staged-build reference files follow the H1/Contents/---/H2 structural convention', () => {
  for (const f of ['implementation-planning.md', 'babylon-webgpu-patterns.md', 'visual-review.md']) {
    assertFollowsReferenceDocConvention(path.join('references', f));
  }
});

test('the three new staged-build reference files contain no leftover template tokens or TODO markers', () => {
  for (const f of ['implementation-planning.md', 'babylon-webgpu-patterns.md', 'visual-review.md']) {
    const content = fs.readFileSync(path.join('references', f), 'utf8');
    assert.doesNotMatch(content, /\{\{[A-Z0-9_]+\}\}/, `${f} must not contain unresolved {{TOKEN}} placeholders`);
    assert.doesNotMatch(content, /\bTODO\b/, `${f} must not contain TODO markers`);
    assert.doesNotMatch(content, /\bFIXME\b/, `${f} must not contain FIXME markers`);
    assert.doesNotMatch(content, /\bTBD\b/, `${f} must not contain TBD markers`);
  }
});

test('implementation-planning.md covers the builder role, all five stage IDs, and stop-and-report', () => {
  const content = fs.readFileSync('references/implementation-planning.md', 'utf8');
  for (const stageId of ['backend-proof', 'terrain-kernel', 'environment-composition', 'character-locomotion', 'mechanic-polish']) {
    assert.ok(content.includes(stageId), `implementation-planning.md missing stage id: ${stageId}`);
  }
  assert.match(content, /stop-and-report/i);
  assert.match(content, /already-designed system/, 'implementation-planning.md must include the exact product-principle sentence');
});

test('babylon-webgpu-patterns.md covers the required ordered topics and binding-ownership constraints', () => {
  const content = fs.readFileSync('references/babylon-webgpu-patterns.md', 'utf8');
  const requiredSnippets = [
    'BABYLON.WebGPUEngine',
    'engine.initAsync()',
    'BABYLON.Engine',
    'BABYLON.ShaderLanguage.WGSL',
    'BABYLON.ShaderStore.ShadersStoreWGSL',
    'forceCompilationAsync',
    'material.isReady(mesh)',
    'onSubmittedWorkDone',
    '@group',
    '@binding',
  ];
  for (const snippet of requiredSnippets) {
    assert.ok(content.includes(snippet), `babylon-webgpu-patterns.md missing required content: ${snippet}`);
  }
  assert.match(content, /^## Babylon Binding Ownership\s*$/m, 'babylon-webgpu-patterns.md must have an explicit Babylon binding ownership section');
  assert.doesNotMatch(content, /arbitrary standalone raw WGSL/i, 'babylon-webgpu-patterns.md must not describe Babylon ShaderMaterial WGSL as arbitrary standalone raw WGSL');
  assert.match(content, /```js/, 'babylon-webgpu-patterns.md must include a positive code example');
});

test('visual-review.md covers all twelve review categories', () => {
  const content = fs.readFileSync('references/visual-review.md', 'utf8');
  for (const category of [
    'Biome Identity', 'Composition', 'Terrain Quality', 'LOD Continuity', 'Material Quality',
    'Character Silhouette', 'Character Scale', 'Locomotion Readability', 'Mechanic Readability',
    'Placeholder Detection', 'Visual Hierarchy', 'Scope Discipline',
  ]) {
    assert.ok(content.includes(category), `visual-review.md missing review category: ${category}`);
  }
});

test('engine._device private-field access is documented as isolated to one helper and fails closed', () => {
  const doc = fs.readFileSync('references/babylon-webgpu-patterns.md', 'utf8');
  assert.ok(doc.includes('## Device Access'));
  assert.ok(doc.includes('getWebGPUDeviceOrFailClosed'));
  assert.ok(doc.includes('unresolved RC risk'));
  assert.ok(/throw new Error/.test(doc), 'the compatibility helper must fail closed, not silently return undefined');
});

test('no reference doc other than babylon-webgpu-patterns.md casually references engine._device', () => {
  const refDir = 'references';
  for (const file of fs.readdirSync(refDir)) {
    if (file === 'babylon-webgpu-patterns.md') continue;
    const text = fs.readFileSync(path.join(refDir, file), 'utf8');
    assert.ok(!text.includes('_device'), `${file} must not reference the private engine._device field directly`);
  }
});
