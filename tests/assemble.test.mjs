import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  substituteTokens,
  stripSections,
  assemble,
  UnresolvedTokenError,
} from '../lib/assemble.mjs';

test('substitutes a bare token', () => {
  assert.equal(substituteTokens('Hi {{NAME}}!', { NAME: 'Ada' }), 'Hi Ada!');
});

test('substitutes a token carrying an em-dash default hint', () => {
  // TEMPLATE.md uses this real form: {{SHADER_LANG — default: WGSL or GLSL}}
  const out = substituteTokens('Lang: {{SHADER_LANG — default: WGSL}}', {
    SHADER_LANG: 'GLSL',
  });
  assert.equal(out, 'Lang: GLSL');
});

test('throws UnresolvedTokenError naming every missing token', () => {
  // Node's assert.throws() does not return the caught error (unlike some
  // other assertion libraries), so the error identity/shape check has to
  // happen inside a validator function rather than on a captured return
  // value. See task-1-report.md for details.
  assert.throws(
    () => substituteTokens('{{A}} and {{B}} and {{A}}', { A: 'x' }),
    (err) => {
      assert.ok(err instanceof UnresolvedTokenError);
      assert.deepEqual(err.tokens, ['B']);
      return true;
    },
  );
});

test('keeps enabled sections and drops disabled ones', () => {
  const tpl = [
    'keep-always',
    '<!--SECTION:vegetation-->veg-body<!--/SECTION-->',
    '<!--SECTION:audio-->audio-body<!--/SECTION-->',
  ].join('\n');
  const out = stripSections(tpl, new Set(['vegetation']));
  assert.match(out, /veg-body/);
  assert.doesNotMatch(out, /audio-body/);
  assert.doesNotMatch(out, /SECTION/);
});

test('assemble inlines the character recipe verbatim', () => {
  const out = assemble({
    template: 'A {{X}}\n{{CHARACTER_RECIPE}}',
    tokens: { X: 'brief' },
    enabledSections: new Set(),
    characterRecipe: '## Recipe\nbone hips 0.95',
  });
  assert.match(out, /bone hips 0\.95/);
});

test('assemble rejects a brief that still contains a token', () => {
  assert.throws(
    () => assemble({
      template: '{{MISSING}}',
      tokens: {},
      enabledSections: new Set(),
      characterRecipe: '',
    }),
    UnresolvedTokenError,
  );
});

test('sections are stripped before token checking, so disabled-section tokens do not fail', () => {
  const out = assemble({
    template: 'ok\n<!--SECTION:audio-->{{AUDIO_SPEC}}<!--/SECTION-->',
    tokens: {},
    enabledSections: new Set(),
    characterRecipe: '',
  });
  assert.equal(out.trim(), 'ok');
});
