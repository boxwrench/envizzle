import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadReferenceCatalog, EXPECTED_BIOME_TOKENS, EXPECTED_MECHANIC_TOKENS } from '../reference-loader.mjs';
import { checkCoherence } from '../check.mjs';
import { SHOWCASES } from '../selection.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

test('loadReferenceCatalog loads exact canonical entry counts', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  assert.equal(Object.keys(catalog.biomes).length, 6);
  assert.equal(Object.keys(catalog.archetypes).length, 5);
  assert.equal(Object.keys(catalog.mechanics).length, 5);
  assert.equal(Object.keys(catalog.cameras).length, 4);
  assert.equal(Object.keys(catalog.renderingProfiles).length, 2);
  assert.equal(Object.keys(catalog.showcases).length, 6);
});

test('every biome has exactly 19 tokens, FOOT_INTERACTION, and parseable coherence JSON', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, biome] of Object.entries(catalog.biomes)) {
    assert.equal(Object.keys(biome.tokens).length, 19, `Biome ${name} should have 19 tokens`);
    for (const token of EXPECTED_BIOME_TOKENS) {
      assert.ok(biome.tokens[token], `Biome ${name} missing token ${token}`);
      assert.ok(biome.tokens[token].trim().length > 0, `Biome ${name} token ${token} is empty`);
    }
    assert.ok(biome.footInteraction, `Biome ${name} missing footInteraction`);
    assert.ok(biome.footInteraction.trim().length > 0, `Biome ${name} footInteraction is empty`);
    assert.ok(biome.coherenceConfig, `Biome ${name} missing coherenceConfig`);
    assert.ok(Array.isArray(biome.coherenceConfig.palette), `Biome ${name} palette should be array`);
  }
});

test('all canonical biome configurations remain coherence-clean', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, biome] of Object.entries(catalog.biomes)) {
    const fullConfig = {
      paradigm: biome.coherenceConfig.paradigm,
      assetStrategy: 'zero-asset',
      materialBehaviours: biome.coherenceConfig.materialBehaviours,
      palette: biome.coherenceConfig.palette,
    };
    const conflicts = checkCoherence(fullConfig);
    const errors = conflicts.filter((c) => c.severity === 'error');
    assert.equal(errors.length, 0, `Biome ${name} coherence config has errors: ${JSON.stringify(errors)}`);
  }
});

test('every mechanic has exactly six tokens', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, mechanic] of Object.entries(catalog.mechanics)) {
    assert.equal(Object.keys(mechanic.tokens).length, 6, `Mechanic ${name} should have 6 tokens`);
    for (const token of EXPECTED_MECHANIC_TOKENS) {
      assert.ok(mechanic.tokens[token], `Mechanic ${name} missing token ${token}`);
      assert.ok(mechanic.tokens[token].trim().length > 0, `Mechanic ${name} token ${token} is empty`);
    }
  }
});

test('archetype and camera sections remain substantial', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, archetype] of Object.entries(catalog.archetypes)) {
    assert.ok(archetype.body.length > 200, `Archetype ${name} body too short`);
  }
  for (const [name, camera] of Object.entries(catalog.cameras)) {
    assert.ok(camera.body.length > 100, `Camera ${name} body too short`);
  }
});

test('parsed showcase structural fields agree with SHOWCASES', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, expected] of Object.entries(SHOWCASES)) {
    const parsed = catalog.showcases[name];
    assert.ok(parsed, `Showcase ${name} missing from parsed catalog`);
    assert.equal(parsed.biome, expected.biome);
    assert.equal(parsed.archetype, expected.archetype);
    assert.equal(parsed.mechanic, expected.mechanic);
    assert.equal(parsed.camera, expected.camera);
    assert.equal(parsed.ambition, expected.ambition);
    assert.deepEqual(parsed.includedSections, expected.includedSections);
    assert.deepEqual(parsed.extraSections, expected.extraSections);
    assert.equal(parsed.renderingProfile, expected.renderingProfile);
  }
});

test('missing or duplicate token fields fail loudly', () => {
  // Test with invalid rootDir
  assert.throws(() => {
    loadReferenceCatalog({ rootDir: '/non/existent/dir' });
  }, /Reference file missing/);
});

test('no reference parser relies on historical references/presets.md', () => {
  const presetsPath = path.join(repoRoot, 'references', 'presets.md');
  assert.equal(fs.existsSync(presetsPath), false, 'references/presets.md should not exist');
  assert.doesNotThrow(() => {
    loadReferenceCatalog({ rootDir: repoRoot });
  });
});
