import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  findUnresolvedTokens,
  findStraySectionMarkers,
  findTemplateLiteralLeaks,
  validateBrief,
} from '../check.mjs';

test('finds a bare unresolved token', () => {
  assert.deepEqual(findUnresolvedTokens('Hi {{NAME}}!'), ['NAME']);
});

test('finds a token carrying an em-dash default hint', () => {
  // TEMPLATE.md really uses this form: {{SHADER_LANG — default: WGSL}}
  assert.deepEqual(
    findUnresolvedTokens('Lang: {{SHADER_LANG — default: WGSL}}'),
    ['SHADER_LANG'],
  );
});

test('deduplicates repeated tokens', () => {
  assert.deepEqual(findUnresolvedTokens('{{A}} {{B}} {{A}}'), ['A', 'B']);
});

test('a fully filled brief has no unresolved tokens', () => {
  assert.deepEqual(findUnresolvedTokens('All filled in. No braces here.'), []);
});

test('finds stray section markers', () => {
  const found = findStraySectionMarkers('ok <!--SECTION:audio--> body <!--/SECTION-->');
  assert.equal(found.length, 2);
});

test('finds ${} template-literal leaks', () => {
  // The exact bug that shipped in the predecessor template.
  assert.deepEqual(findTemplateLiteralLeaks('State Buffer (${DEFORMATION_TYPE})'), ['DEFORMATION_TYPE']);
});

test('validateBrief passes a clean brief', () => {
  const result = validateBrief('# Brief\n\nEverything is filled in.\n');
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test('validateBrief reports every problem class at once', () => {
  const result = validateBrief('{{MISSING}} ${LEAK} <!--SECTION:audio-->');
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 3);
  assert.ok(result.problems.some((p) => /MISSING/.test(p)));
  assert.ok(result.problems.some((p) => /LEAK/.test(p)));
  assert.ok(result.problems.some((p) => /SECTION/.test(p)));
});

test('the shipped TEMPLATE.md has no ${} leaks', () => {
  // Regression guard for the TEMPLATE.md:66 bug.
  assert.deepEqual(findTemplateLiteralLeaks(fs.readFileSync('TEMPLATE.md', 'utf8')), []);
});

test('the shipped TEMPLATE.md still has its tokens and sections', () => {
  const tpl = fs.readFileSync('TEMPLATE.md', 'utf8');
  const tokens = findUnresolvedTokens(tpl);
  assert.equal(tokens.length, 37, `template tokens count is ${tokens.length}, expected 37`);
  assert.ok(tokens.includes('CREATIVE_MODE'), 'template missing CREATIVE_MODE token');
  assert.ok(tokens.includes('SIGNATURE_MOMENT'), 'template missing SIGNATURE_MOMENT token');
  assert.ok(tokens.includes('MATERIAL_API'), 'template missing MATERIAL_API token');
  assert.ok(tokens.includes('CHARACTER_RECIPE'), 'template missing CHARACTER_RECIPE token');
  assert.ok(findStraySectionMarkers(tpl).length >= 4, 'template lost its section markers');
  assert.doesNotMatch(tpl, /guarantee 100% hardware compatibility/i, 'template contains stale compatibility claim');
  assert.doesNotMatch(tpl, /break the requirement/i, 'template contains old universal break the requirement phrase');
  assert.match(tpl, /ENABLE_SIGNATURE_MOMENT/, 'template missing ENABLE_SIGNATURE_MOMENT setting');
  assert.match(tpl, /mechanic verification capture/i, 'template missing mechanic verification capture visibility requirement');
});
