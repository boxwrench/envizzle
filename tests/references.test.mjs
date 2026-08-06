import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkCoherence } from '../check.mjs';
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

// --- Batch 10 regression tests ---

test('active non-test documentation contains no Batch 3 or Batch 8 terminology', () => {
  const activeFiles = [
    'SKILL.md',
    'README.md',
    'references/modes.md',
    'references/benchmarking.md',
    'references/biomes.md',
    'references/archetypes.md',
    'references/mechanics.md',
    'references/cameras.md',
    'references/showcases.md',
    'references/assembly.md',
    'references/build-contract.md',
    'references/character-recipe.md',
  ];
  for (const file of activeFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      content,
      /Batch 3\b/,
      `${file} contains stale "Batch 3" terminology`
    );
    assert.doesNotMatch(
      content,
      /Batch 8\b/,
      `${file} contains stale "Batch 8" terminology`
    );
  }
});

test('obsolete implementation plan is absent and unreferenced', () => {
  assert.strictEqual(
    fs.existsSync('docs/2026-07-29-envizzle-skill.md'),
    false,
    'The obsolete implementation plan should be deleted'
  );
  const activeFiles = ['SKILL.md', 'README.md'];
  for (const file of activeFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      content,
      /2026-07-29-envizzle-skill\.md[^-]/,
      `${file} must not reference the deleted implementation plan`
    );
  }
});

test('retained design document contains no active prompt_builder.html or legacy screenshots/ instructions', () => {
  const design = fs.readFileSync('docs/2026-07-29-envizzle-skill-design.md', 'utf8');
  assert.doesNotMatch(
    design,
    /prompt_builder\.html[\s\S]{0,80}(retain|active|manual path|optional)/i,
    'Design document must not describe prompt_builder.html as an active or retained path'
  );
  assert.doesNotMatch(
    design,
    /screenshots\/ directory of the reference output/i,
    'Design document must not reference legacy screenshots/ evidence paths'
  );
  assert.doesNotMatch(
    design,
    /\$REFERENCE_OUTPUT/,
    'Design document must not use the legacy $REFERENCE_OUTPUT reference'
  );
});

// --- Batch 10 micro-correction regression tests ---

test('modes.md records selection decisions in the assembly specification and assigns project DECISIONS.md creation to the builder', () => {
  const content = fs.readFileSync('references/modes.md', 'utf8');
  assert.match(
    content,
    /assembly specification/i,
    'modes.md must describe selection changes as recorded in the assembly specification'
  );
  assert.match(
    content,
    /builder creates[\s\S]{0,60}DECISIONS\.md/i,
    'modes.md must state the builder creates project DECISIONS.md'
  );
  assert.doesNotMatch(
    content,
    /Record all changes and compatibility decisions in `DECISIONS\.md`/i,
    'modes.md must not claim Envizzle selection itself writes DECISIONS.md'
  );
});

test('design document contains no stale filenames, toggles, or status wording', () => {
  const design = fs.readFileSync('docs/2026-07-29-envizzle-skill-design.md', 'utf8');
  const forbidden = [
    ['showcase-configs.md', /showcase-configs\.md/i],
    ['systems-optional.md', /systems-optional\.md/i],
    ['references/coherence.md', /references\/coherence\.md/i],
    ['?hideCharacter=1', /\?hideCharacter=1/i],
    ['ready for implementation planning', /ready for implementation planning/i],
  ];
  for (const [label, re] of forbidden) {
    assert.doesNotMatch(design, re, `design document must not contain stale "${label}"`);
  }
  assert.doesNotMatch(
    design,
    /reported,\s*gated/i,
    'design document must not describe performance as unconditionally gated'
  );
});

test('design document names current real files and current behavior', () => {
  const design = fs.readFileSync('docs/2026-07-29-envizzle-skill-design.md', 'utf8');
  assert.match(design, /references\/showcases\.md/, 'design document must name references/showcases.md');
  assert.match(design, /check\.mjs|checkCoherence/, 'design document must name check.mjs or checkCoherence');
  assert.match(design, /setCharacterVisible/, 'design document must name setCharacterVisible');
  const verifyBlockStart = design.indexOf('verify/');
  assert.ok(verifyBlockStart !== -1, 'design document must contain a verify/ directory listing');
  const verifyBlock = design.slice(verifyBlockStart, verifyBlockStart + 400);
  for (const verifierFile of [
    'README.md',
    'evidence.mjs',
    'gates.mjs',
    'report.mjs',
    'verify_demo.mjs',
  ]) {
    assert.ok(
      verifyBlock.includes(verifierFile),
      `design document's verify/ listing must name ${verifierFile}`
    );
  }
  assert.match(
    design,
    /informational[\s\S]{0,20}not gated|not gated[\s\S]{0,40}headless/i,
    'design document must state performance timing is informational and not gated under headless verification'
  );
});

// --- Batch 10 second micro-correction regression tests ---

test('design document frames Envizzle as emitting a nine-file bundle, not only a brief', () => {
  const design = fs.readFileSync('docs/2026-07-29-envizzle-skill-design.md', 'utf8');
  assert.doesNotMatch(
    design,
    /Emits a self-contained implementation brief for a/,
    'design document must not claim Envizzle emits only a self-contained brief'
  );
  assert.match(
    design,
    /nine-file bundle/i,
    'design document must describe the deterministic nine-file bundle'
  );
  assert.match(
    design,
    /brief is the primary/i,
    'design document must state the brief is the primary prompt within the bundle'
  );
});

test('design document does not claim character prohibitions are currently absent', () => {
  const design = fs.readFileSync('docs/2026-07-29-envizzle-skill-design.md', 'utf8');
  assert.doesNotMatch(
    design,
    /Currently absent, and their absence is the proximate cause/i,
    'design document must not claim the current recipe lacks prohibitions'
  );
  assert.match(
    design,
    /predecessor[\s\S]{0,120}no construction recipe and no foot-?\s*planting mechanism/i,
    'design document must attribute the missing construction/foot-planting mechanisms to the predecessor'
  );
  assert.match(
    design,
    /current character recipe includes both/i,
    'design document must state the current recipe includes construction and foot-planting mechanisms'
  );
});

test('design document coherence-rule summary agrees with check.mjs thresholds', () => {
  const design = fs.readFileSync('docs/2026-07-29-envizzle-skill-design.md', 'utf8');
  assert.doesNotMatch(
    design,
    /Painterly paradigm requires mean scene luminance/i,
    'design document must not restate the old painterly/lightest-value coherence summary'
  );
  assert.doesNotMatch(
    design,
    /≥3 distinct value tiers spanning ≥0\.55/,
    'design document must not restate the old value-tier summary'
  );
  assert.match(design, /luminance\s*≥\s*0\.55/, 'design document must state the light-anchor luminance floor of 0.55');
  assert.match(design, /saturation\s*≤\s*0\.35/, 'design document must state the light-anchor saturation ceiling of 0.35');
  assert.match(design, /≥\s*0\.30/, 'design document must state the painterly large-area luminance floor of 0.30');
  assert.match(design, /dark \(luminance < 0\.15\)/, 'design document must state the dark value-tier boundary');
  assert.match(design, /light \(> 0\.55\)/, 'design document must state the light value-tier boundary');
  assert.match(design, /more than 35% of palette entries/i, 'design document must state the 35% accent-cap threshold');
  assert.match(design, /no more than 15% of the rendered frame/i, 'design document must preserve the ~15% screen-area artistic intent');
  assert.match(design, /multi-scale procedural normals/i, 'design document must preserve the photoreal multi-scale-normal requirement');
  assert.match(design, /palette table plus a cel ramp/i, 'design document must preserve the painterly palette-table/cel-ramp requirement');
});

test('design document ambition table states exact section rules per level', () => {
  const design = fs.readFileSync('docs/2026-07-29-envizzle-skill-design.md', 'utf8');
  assert.doesNotMatch(
    design,
    /Adds 2[–-]3 optional axes/i,
    'design document must not restate the old vague "Adds 2-3 optional axes" claim'
  );
  assert.match(
    design,
    /Slice \(default\)[\s\S]{0,40}None[\s\S]{0,40}None/,
    'design document must state slice has no core and no extra sections'
  );
  assert.match(
    design,
    /Showcase[\s\S]{0,120}forbidden at this level/i,
    'design document must state showcase forbids extra sections'
  );
  assert.match(
    design,
    /Everything[\s\S]{0,60}All three core sections, required[\s\S]{0,120}At least one of the four supported extras/i,
    'design document must state everything requires all core sections plus at least one extra'
  );
});

test('design document states the camera-depth gate as a >= 0.30 m pass threshold', () => {
  const design = fs.readFileSync('docs/2026-07-29-envizzle-skill-design.md', 'utf8');
  assert.doesNotMatch(
    design,
    /nearest depth > 0\.3 m \|/,
    'design document must not restate the old bare ">0.3 m" camera-depth wording'
  );
  assert.match(
    design,
    /passes at >= 0\.30 m, fails below 0\.30 m/,
    'design document must state the camera-depth gate passes at >= 0.30 m and fails below it'
  );
});
