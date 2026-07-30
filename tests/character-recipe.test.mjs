import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const recipe = fs.readFileSync('references/character-recipe.md', 'utf8');

test('recipe is substantial, not a placeholder', () => {
  assert.ok(recipe.length > 3000, `recipe is only ${recipe.length} chars`);
});

test('recipe contains no unfilled tokens (it is inlined verbatim)', () => {
  assert.doesNotMatch(recipe, /\{\{/);
  assert.doesNotMatch(recipe, /\$\{/);
});

test('recipe names all 18 bones', () => {
  for (const bone of [
    'hips', 'spine01', 'spine02', 'chest', 'neck', 'head',
    'clavicle', 'upperArm', 'forearm', 'hand',
    'thigh', 'shin', 'foot', 'toe',
  ]) {
    assert.match(recipe, new RegExp(bone, 'i'), `missing bone: ${bone}`);
  }
});

test('recipe gives numeric rest positions, not prose', () => {
  for (const v of ['0.95', '1.10', '1.28', '1.42', '1.52', '1.62', '0.92', '0.50']) {
    assert.match(recipe, new RegExp(v.replace('.', '\\.')), `missing rest height ${v}`);
  }
});

test('recipe gives segment lengths', () => {
  for (const v of ['0.28', '0.26', '0.42', '0.40', '0.16']) {
    assert.match(recipe, new RegExp(v.replace('.', '\\.')), `missing segment length ${v}`);
  }
});

test('recipe specifies lofted ring geometry with radius and ellipse ratio', () => {
  assert.match(recipe, /ellipse ratio/i);
  assert.match(recipe, /1\.35/, 'missing chest ellipse ratio');
  assert.match(recipe, /0\.085/, 'missing hip ring radius');
  assert.match(recipe, /0\.055/, 'missing knee/shoulder ring radius');
});

test('recipe mandates one continuous skinned mesh', () => {
  assert.match(recipe, /one continuous|single continuous/i);
  assert.match(recipe, /skinned mesh/i);
});

test('recipe makes gait distance-driven, not clip-blended', () => {
  assert.match(recipe, /gaitPhase/);
  assert.match(recipe, /0\.78/, 'missing stride length coefficient');
  assert.match(recipe, /law of cosines/i);
  assert.match(recipe, /distance/i);
});

test('recipe states the single-write-site rule for foot planting', () => {
  assert.match(recipe, /plantedPos/);
  assert.match(recipe, /no code path/i);
});

test('recipe forbids every primitive geometry the reference output used', () => {
  for (const prim of [
    'BoxGeometry', 'SphereGeometry', 'CylinderGeometry',
    'CapsuleGeometry', 'ConeGeometry',
  ]) {
    assert.match(recipe, new RegExp(prim), `missing prohibition: ${prim}`);
  }
  assert.match(recipe, /forbidden/i);
});

test('recipe does not reintroduce the cloth-driven-figure escape hatch', () => {
  assert.doesNotMatch(recipe, /if a rig .{0,80}cannot be brought/i);
  assert.doesNotMatch(recipe, /prefer a fully cloth/i);
});

test('recipe states frame framing so the character is readable', () => {
  assert.match(recipe, /12/, 'missing frame-height percentage floor');
  assert.match(recipe, /18/, 'missing frame-height percentage ceiling');
});
