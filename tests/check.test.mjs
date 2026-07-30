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
  assert.ok(findUnresolvedTokens(tpl).length >= 30, 'template lost its token slots');
  assert.ok(findUnresolvedTokens(tpl).includes('CHARACTER_RECIPE'));
  assert.ok(findStraySectionMarkers(tpl).length >= 4, 'template lost its section markers');
});
