import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const skill = fs.readFileSync('SKILL.md', 'utf8');

test('has frontmatter naming the skill envizzle', () => {
  const fm = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'no frontmatter block');
  assert.match(fm[1], /^name:\s*envizzle\s*$/m);
  assert.match(fm[1], /^description:\s*\S/m);
});

test('description says when to use the skill and is long enough to route on', () => {
  const desc = skill.match(/^description:\s*(.+)$/m)[1];
  assert.ok(desc.length > 80, `description is only ${desc.length} chars`);
  assert.match(desc, /use when/i);
});

test('documents the pick-for-me path and creative modes constraints', () => {
  assert.match(skill, /pick for me/i);
  assert.match(skill, /Proven/);
  assert.match(skill, /Signature/);
  assert.match(skill, /Experimental/);
  assert.match(skill, /at most 1 changed major axis/i);
});

test('creative modes rules and novelty budgets are documented in SKILL.md', () => {
  assert.match(skill, /\bProven\b/);
  assert.match(skill, /\bSignature\b/);
  assert.match(skill, /\bExperimental\b/);
  assert.match(skill, /Signature[\s\S]{0,100}default/i);
  assert.match(skill, /pick for me[\s\S]{0,200}Signature/i);
  assert.match(skill, /Proven[\s\S]{0,100}no independent novelty/i);
  assert.match(skill, /Signature[\s\S]{0,100}one bounded Signature Moment/i);
  assert.match(skill, /Never selected automatically/i);
  assert.match(skill, /at most 1 changed major axis/i);
  assert.match(skill, /custom interview/i);
  assert.match(skill, /Creative Spark/i);
  assert.match(skill, /reuses? an existing/i);
  assert.match(skill, /hard contracts/i);
  assert.match(skill, /DECISIONS\.md/i);
});

test('names the three ambition levels and the default', () => {
  for (const level of ['slice', 'showcase', 'everything']) {
    assert.match(skill, new RegExp(`\\b${level}\\b`));
  }
  assert.match(skill, /slice[^\n]{0,80}default|default[^\n]{0,80}slice/i);
});

test('points at the real files it depends on', () => {
  for (const f of [
    'references/presets.md',
    'references/character-recipe.md',
    'TEMPLATE.md',
    'check.mjs',
    'verify/verify_demo.mjs',
  ]) {
    assert.match(skill, new RegExp(f.replace(/[/.]/g, '\\$&')), `does not mention ${f}`);
  }
});

test('mandates inlining the character recipe verbatim', () => {
  assert.match(skill, /inline/i);
  assert.match(skill, /verbatim|in full/i);
});

test('instructs running the validator on the finished brief', () => {
  assert.match(skill, /node check\.mjs/);
});

test('instructs running the coherence check and recording overrides', () => {
  assert.match(skill, /coherence/i);
  assert.match(skill, /deliberate deviation|override/i);
});

test('does not reference files that no longer exist', () => {
  for (const gone of ['lib/assemble.mjs', 'legacy/', 'install.mjs', 'prompt_builder.html']) {
    assert.doesNotMatch(skill, new RegExp(gone.replace(/[/.]/g, '\\$&')), `references removed ${gone}`);
  }
});

test('frontmatter description accurately scopes skill triggers and excludes complete games', () => {
  const desc = skill.match(/^description:\s*(.+)$/m)[1];
  assert.ok(
    desc.includes('visual vertical slice') || desc.includes('environment showcase'),
    'description should name visual vertical slice or environment showcase'
  );
  assert.match(
    desc,
    /do not use for (a )?complete game/i,
    'description should explicitly exclude complete game scope'
  );
  assert.doesNotMatch(
    skill,
    /one-shot a game/i,
    'SKILL.md should not contain stale trigger phrase "one-shot a game"'
  );
});

test('stale manual builder prompt_builder.html is removed and unreferenced in active docs', () => {
  assert.strictEqual(
    fs.existsSync('prompt_builder.html'),
    false,
    'prompt_builder.html file should no longer exist on disk'
  );
  const readme = fs.readFileSync('README.md', 'utf8');
  assert.doesNotMatch(
    readme,
    /prompt_builder\.html/i,
    'active README.md should not advertise or reference prompt_builder.html'
  );
});

test('camera modes are documented as a section substitution, not a token fill', () => {
  assert.match(skill, /2\.6/);
  assert.match(skill, /camera[\s\S]{0,400}(no|zero)[^\n]{0,40}token/i);
});

test('XR is documented as overriding the hardware target token', () => {
  assert.match(skill, /XR[\s\S]{0,600}TARGET_BROWSER_AND_HARDWARE/);
});

test('says where FOOT_INTERACTION goes, since it is not a template token', () => {
  assert.match(skill, /FOOT_INTERACTION/);
  assert.match(skill, /FOOT_INTERACTION[\s\S]{0,600}(CHARACTER_RECIPE|character recipe)/i);
});

test('makes re-running the coherence check mandatory after any palette edit', () => {
  assert.match(skill, /re-?run[^\n]{0,120}coherence|coherence[^\n]{0,120}re-?run/i);
  assert.match(skill, /volcanic/i);
});

test('requires stripping every section marker, kept sections included', () => {
  assert.match(skill, /<!--SECTION:/);
  assert.match(skill, /<!--\/SECTION-->/);
});

test('documents explicit mode control flow, interview reservation, baseline wording, and Proven toggle behavior', () => {
  assert.match(skill, /#### Proven[\s\S]*?Do not enter the full Step 2 interview[\s\S]*?Continue directly to Step 3/i);
  assert.match(skill, /#### Signature[\s\S]*?Do not enter the full Step 2 interview[\s\S]*?Ask only the optional creative-spark question[\s\S]*?Continue directly to Step 3/i);
  assert.match(skill, /#### Experimental base-showcase path[\s\S]*?Ask only the relevant Step 2 question for that selected axis/i);
  assert.match(skill, /The Experimental fully custom path is the only path that runs the complete Step 2 interview/);
  assert.match(skill, /## Step 2 — Fully custom interview/);
  assert.doesNotMatch(skill, /Creative Spark.*7|7\\. Creative Spark/);
  assert.match(skill, /restores the selected configuration without the Signature Moment|removable, restoring the selected configuration/);
  assert.match(skill, /Set `ENABLE_SIGNATURE_MOMENT` to `false`; it is a no-op/);
});

test('SKILL.md contains no stale token-count or manual verification phrases', () => {
  assert.doesNotMatch(skill, /37 tokens|of the 37|one of the 37|manually verify mechanic/i);
});

test('SKILL.md documents validateSelection errors as hard blockers', () => {
  assert.match(skill, /validateSelection[\s\S]{0,200}hard blockers/i);
  assert.match(skill, /checkCoherence[\s\S]{0,200}Deliberate Deviations/i);
});
