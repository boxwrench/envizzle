# envizzle Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/envizzle`, a skill that interviews the user, coherence-checks their choices, and emits a self-contained Markdown brief that a coding agent can use to one-shot a visually impressive real-time graphics tech demo — with a numeric procedural character recipe that prevents the primitive-assembly failure mode.

**Architecture:** Presets and coherence rules live as testable ES module data (`lib/`), not prose, so assembly is deterministic and "no unreplaced token" is a real assertion. A CLI assembler substitutes tokens into `TEMPLATE.md`, inlines `references/character-recipe.md` verbatim, and strips unselected sections. Verification gates are pure functions over decoded pixel buffers, so they unit-test against synthetic buffers and integration-test against the real known-bad screenshots.

**Tech Stack:** Node 24 ESM, `node:test` + `node:assert` (built in, no test framework dependency), `pngjs` for PNG decode in tests and gates, `playwright` for the browser run (already the incumbent choice in `legacy/verify_demo.mjs`).

## Spec Refinement (deviation from approved spec, flagged)

The spec listed all presets as `references/*.md`. Implementation uses `lib/presets/*.mjs`
data modules instead, keeping only `references/character-recipe.md` as markdown.

**Rationale:** the spec's own Testing section requires asserting "no unreplaced
`{{TOKEN}}` remains" and "the known-bad reference config is flagged". Both require
presets to be structured data a program can read. Prose presets would force Claude to
assemble by hand, which is exactly the non-determinism that produces inconsistent
briefs. `coherence.md` likewise becomes `lib/coherence.mjs` because it is logic.

Human readability is preserved: each preset module's values *are* the prose strings that
get substituted, so the module reads as documentation with quotes around it.

## Global Constraints

- Node 24 ESM throughout. `"type": "module"`. No TypeScript, no build step.
- Test runner is `node:test`. Do not add jest, vitest, or mocha.
- Only two dev dependencies permitted in `package.json`: `pngjs` and `playwright`.
- Skill name is exactly `envizzle`. Invoked as `/envizzle`.
- **All paths in this plan are relative to the repo root `C:/GitHub/envizzle`.** The repo root *is* the skill root — `SKILL.md` sits at the top level so the repo can be cloned or symlinked straight into `~/.claude/skills/envizzle/`, which is a generated copy; never edit it directly.
- `legacy/` holds the six superseded files migrated out of `SnowVR/prompt template/`. It is mining source only: nothing in the shipped skill may import from it, and the installer must exclude it.
- The emitted brief must be fully self-contained: the target agent may be any model and sees only that one file. `character-recipe.md` is inlined in full, never referenced by path.
- Every file uses LF line endings.
- Commit after every task.

## File Structure

| Path | Responsibility |
|---|---|
| `SKILL.md` | Frontmatter + interview flow + assembly instructions Claude follows |
| `TEMPLATE.md` | Brief skeleton with `{{TOKEN}}` slots and `<!--SECTION:name-->` markers |
| `references/character-recipe.md` | The numeric humanoid construction spec, inlined verbatim |
| `lib/assemble.mjs` | Token substitution, section stripping, recipe inlining, CLI entry |
| `lib/color.mjs` | `relativeLuminance`, `saturation`, `hexToRgb01` — shared by coherence and gates |
| `lib/coherence.mjs` | Config → array of conflicts |
| `lib/presets/biomes.mjs` | Biome token bundles |
| `lib/presets/archetypes.mjs` | Character archetypes as rig parameters |
| `lib/presets/mechanics.mjs` | Centrepiece mechanic bundles |
| `lib/presets/cameras.mjs` | Camera/presentation modes |
| `lib/presets/optional-systems.mjs` | Optional system axes |
| `lib/presets/showcase.mjs` | 6 complete coherence-clean configs |
| `lib/ambition.mjs` | Ambition level → set of enabled section names |
| `verify/gates.mjs` | Pure pixel-buffer gate functions |
| `verify/verify_demo.mjs` | Playwright orchestrator invoking gates |
| `install.mjs` | Copy skill → `~/.claude/skills/envizzle/` |
| `tests/*.test.mjs` | All tests |
| `tests/fixtures/` | Real known-bad PNGs + synthetic generator |
| `prompt_builder.html` | Optional manual form, unchanged. Promoted out of `legacy/` in Task 11 |
| `legacy/` | Migration mining source, deleted in Task 11. Never imported by shipped code |
| `docs/` | Spec and this plan. Excluded from the install set |
| `README.md`, `.gitignore` | Repo scaffolding, already created during repo setup |

---

### Task 1: Skill scaffold and the assembler

**Files:**
- Create: `package.json`
- Create: `lib/assemble.mjs`
- Create: `TEMPLATE.md`
- Test: `tests/assemble.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class UnresolvedTokenError extends Error` with property `tokens: string[]`
  - `substituteTokens(template: string, tokens: Record<string,string>): string` — throws `UnresolvedTokenError` if any `{{...}}` remains
  - `stripSections(template: string, enabled: Set<string>): string`
  - `assemble({ template, tokens, enabledSections, characterRecipe }): string`

- [ ] **Step 1: Create the package manifest**

Create `package.json`:

```json
{
  "name": "envizzle-skill",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "assemble": "node lib/assemble.mjs",
    "install-skill": "node install.mjs"
  },
  "devDependencies": {
    "pngjs": "^7.0.0",
    "playwright": "^1.62.0"
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/assemble.test.mjs`:

```js
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
  const err = assert.throws(
    () => substituteTokens('{{A}} and {{B}} and {{A}}', { A: 'x' }),
    UnresolvedTokenError,
  );
  assert.deepEqual(err.tokens, ['B']);
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd "C:/GitHub/envizzle" && node --test tests/assemble.test.mjs`
Expected: FAIL — `Cannot find module '../lib/assemble.mjs'`

- [ ] **Step 4: Implement the assembler**

Create `lib/assemble.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Thrown when an assembled brief still contains {{TOKEN}} placeholders. */
export class UnresolvedTokenError extends Error {
  /** @param {string[]} tokens */
  constructor(tokens) {
    super(`Unresolved tokens in assembled brief: ${tokens.join(', ')}`);
    this.name = 'UnresolvedTokenError';
    this.tokens = tokens;
  }
}

// Matches {{NAME}} and {{NAME — default: anything}}. The name is the leading
// run of A-Z0-9_ ; everything up to the closing braces is a human-facing hint.
const TOKEN_RE = /\{\{([A-Z0-9_]+)(?:[^}]*)?\}\}/g;

/**
 * Replace every {{TOKEN}} with tokens[TOKEN].
 * @throws {UnresolvedTokenError} if any placeholder has no value.
 */
export function substituteTokens(template, tokens) {
  const out = template.replace(TOKEN_RE, (match, name) =>
    Object.prototype.hasOwnProperty.call(tokens, name) ? tokens[name] : match,
  );

  const missing = [...new Set([...out.matchAll(TOKEN_RE)].map((m) => m[1]))];
  if (missing.length > 0) throw new UnresolvedTokenError(missing);
  return out;
}

const SECTION_RE = /<!--SECTION:([a-z0-9-]+)-->([\s\S]*?)<!--\/SECTION-->\n?/g;

/** Keep the bodies of enabled sections, delete disabled ones entirely. */
export function stripSections(template, enabled) {
  return template.replace(SECTION_RE, (_match, name, body) =>
    enabled.has(name) ? body : '',
  );
}

/**
 * Build the final brief. Sections are stripped first so that tokens living
 * inside a disabled section never count as missing.
 */
export function assemble({ template, tokens, enabledSections, characterRecipe }) {
  const sectioned = stripSections(template, enabledSections);
  return substituteTokens(sectioned, {
    ...tokens,
    CHARACTER_RECIPE: characterRecipe,
  });
}

/** Read the canonical template and character recipe off disk. */
export function loadAssets() {
  return {
    template: fs.readFileSync(path.join(HERE, '..', 'TEMPLATE.md'), 'utf8'),
    characterRecipe: fs.readFileSync(
      path.join(HERE, '..', 'references', 'character-recipe.md'),
      'utf8',
    ),
  };
}
```

- [ ] **Step 5: Create a minimal TEMPLATE.md so `loadAssets` has something to read**

Create `TEMPLATE.md` by copying the current
`legacy/TEMPLATE.md` and making exactly these changes:

1. Replace the whole of section `### 2.5 Character, Cloth & Foot Planting` body with the single line `{{CHARACTER_RECIPE}}`.
2. Wrap these sections in section markers so the ambition dial can drop them:
   - `### 2.4 Vegetation & Foliage Systems` → `<!--SECTION:vegetation-->` … `<!--/SECTION-->`
   - `### 2.3 Wind Field & Terrain State Buffer` → `<!--SECTION:state-buffer-->` … `<!--/SECTION-->`
   - `### 2.8 Audio Engine & Atmospheric Life` → `<!--SECTION:audio-->` … `<!--/SECTION-->`
3. Append a new section, always enabled, containing the `window.__demo` contract:

```markdown
## 6. Mandatory Verification Hook

You MUST expose `window.__demo` once the loading screen dismisses. Verification
is automated and will fail the build without it.

```js
window.__demo = {
  ready: true,
  /** @param {'idle'|'locomotion'|'mechanic'} name */
  setPose(name) {},
  /** @param {boolean} visible - hide the character mesh only, keep the scene */
  setCharacterVisible(visible) {},
  /** @returns {number} metres from camera to nearest scene geometry */
  cameraNearestDepth() {},
  /** @returns {{medianMs:number, p99Ms:number, samples:number}} */
  frameStats() {},
};
```

`setCharacterVisible(false)` must hide only the character and its cloth, leaving
terrain, vegetation, and atmosphere untouched.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd "C:/GitHub/envizzle" && node --test tests/assemble.test.mjs`
Expected: PASS, 7 tests

- [ ] **Step 7: Commit**

```bash
git add "package.json" "lib/assemble.mjs" "TEMPLATE.md" "tests/assemble.test.mjs"
git commit -m "feat(envizzle): add skill scaffold and brief assembler"
```

---

### Task 2: The character recipe

**Files:**
- Create: `references/character-recipe.md`
- Test: `tests/character-recipe.test.mjs`

**Interfaces:**
- Consumes: `loadAssets()` from Task 1.
- Produces: `references/character-recipe.md` — a standalone markdown document with no tokens, safe to inline verbatim.

This is the task that fixes the reported bug. `src/character/player.js:30-77` of the
reference output built a `CylinderGeometry` torso, `SphereGeometry` head, and three
`BoxGeometry` parts because the brief gave adjectives where every working system got
numbers.

- [ ] **Step 1: Write the failing structural test**

Create `tests/character-recipe.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAssets } from '../lib/assemble.mjs';

const { characterRecipe: recipe } = loadAssets();

test('recipe contains no unfilled tokens (it is inlined verbatim)', () => {
  assert.doesNotMatch(recipe, /\{\{/);
});

test('recipe specifies all 18 bones with numeric rest positions', () => {
  const bones = [
    'hips', 'spine01', 'spine02', 'chest', 'neck', 'head',
    'clavicle', 'upperArm', 'forearm', 'hand',
    'thigh', 'shin', 'foot', 'toe',
  ];
  for (const bone of bones) {
    assert.match(recipe, new RegExp(bone, 'i'), `missing bone: ${bone}`);
  }
  // Rest positions must be actual numbers, not prose.
  assert.match(recipe, /0\.95/, 'missing hips height 0.95');
  assert.match(recipe, /1\.62/, 'missing head height 1.62');
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

test('recipe specifies lofted ring geometry with radius and ellipse ratio', () => {
  assert.match(recipe, /ellipse ratio/i);
  assert.match(recipe, /1\.35/, 'missing chest ellipse ratio 1.35');
  assert.match(recipe, /0\.085/, 'missing hip ring radius 0.085');
});

test('recipe makes gait distance-driven, not clip-blended', () => {
  assert.match(recipe, /gaitPhase/);
  assert.match(recipe, /0\.78/, 'missing stride length coefficient');
  assert.match(recipe, /law of cosines/i);
});

test('recipe states the single-write-site rule for foot planting', () => {
  assert.match(recipe, /plantedPos/);
  assert.match(recipe, /no code path/i);
});

test('recipe does not reintroduce the cloth-driven-figure escape hatch', () => {
  assert.doesNotMatch(recipe, /if a rig .{0,80}cannot be brought/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/GitHub/envizzle" && node --test tests/character-recipe.test.mjs`
Expected: FAIL — `ENOENT` on `references/character-recipe.md`

- [ ] **Step 3: Write the recipe**

Create `references/character-recipe.md`. It must contain
these six parts, with these exact values:

**Part 1 — Skeleton.** A markdown table of 18 bones for a 1.75 m figure, columns
`bone | parent | rest position (x, y, z) metres`. Values: hips `(0, 0.95, 0)`,
spine01 `(0, 1.10, 0)`, spine02 `(0, 1.28, 0)`, chest `(0, 1.42, 0)`,
neck `(0, 1.52, 0)`, head `(0, 1.62, 0)`, clavicle.L/R `(±0.06, 1.45, 0)`,
upperArm.L/R `(±0.19, 1.44, 0)`, forearm.L/R `(±0.19, 1.16, 0)`,
hand.L/R `(±0.19, 0.90, 0)`, thigh.L/R `(±0.09, 0.92, 0)`,
shin.L/R `(±0.09, 0.52, 0)`, foot.L/R `(±0.09, 0.10, 0)`,
toe.L/R `(±0.09, 0.02, 0.14)`. State segment lengths: upperArm 0.28, forearm 0.26,
thigh 0.42, shin 0.40, foot 0.16.

**Part 2 — Geometry.** State the rule in bold: *the character is ONE continuous
skinned mesh generated from lofted cross-section rings; it is never an assembly of
primitive meshes.* Then the ring tables:

| Chain | Rings | Radius profile (m) | Ellipse ratio (x:z) |
|---|---|---|---|
| Torso (hips→neck) | 12 | 0.16 → 0.19 → 0.17 → 0.14 | 1.00 → 1.35 |
| Arm (shoulder→wrist) | 8 | 0.055 → 0.040 → 0.032 | 1.00 |
| Leg (hip→ankle) | 10 | 0.085 → 0.055 → 0.038 | 1.10 |

Ring resolution 12–16 segments. Rings stitch into triangle strips; ends capped.
Skin weights derived from normalized arc-length position along the chain, blended
across a 0.08 m falloff either side of each joint — deterministic, no hand-rigging.
Budget ~3–4 k triangles total.

**Part 3 — Gait.** State that sliding is prevented by construction, not discipline:

```js
// Phase advances with GROUND DISTANCE, so stride length equals ground speed
// by construction. Do not blend animation clips.
const strideLength = 0.78 * legLength * (1 + 0.35 * speedNorm);
gaitPhase = (gaitPhase + distanceThisFrame / strideLength) % 1;
```

Stance spans phase 0 → 0.6 and holds the locked world position. Swing spans
0.6 → 1.0 and arcs 0.12 m to predicted touchdown via smoothstep. Per-leg phase
offset 0.5. Two-bone analytic IK by law of cosines for hip → knee → ankle, knee
pole vector forward.

**Part 4 — Secondary motion.** Pelvis bob `y -= 0.035 * (1 - cos(4π * gaitPhase)) / 2`.
Pelvis roll ±3°, shoulders counter-rotate ±5°. Arm swing shoulder pitch
`±22° * sin(2π * (gaitPhase + 0.5))`, elbow flex 12–35°. Spine lean into
acceleration, chest pitch `clamp(accelAlongForward * 0.04, -8°, +12°)`. Head
counter-rotated to hold a level gaze.

**Part 5 — Foot planting.** The mechanism, not the goal:

```js
// On touchdown ONLY. During stance nothing writes to plantedPos — a planted
// foot cannot slide because no code path exists that could move it.
plantedPos[leg].copy(terrainRaycast(footTarget).point);
plantedNormal[leg].copy(terrainRaycast(footTarget).normal);
stateBuffer.addSplat(plantedPos[leg]);   // same call site, cannot desync
audio.footfall(plantedPos[leg]);
```

Foot orientation blends to the terrain normal at 0.7.

**Part 6 — Prohibitions.** A bold, unhedged list:

- `BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `CapsuleGeometry`, and
  `ConeGeometry` are **forbidden** anywhere in character code.
- A character assembled from separate per-body-part meshes is a **defect**, not a
  stepping stone.
- Omitting legs is permitted **only** when the chosen archetype specifies a hidden
  lower body **and** cloth reaches the ground.
- There is **no fallback**. If the rig is hard, the rig is still required.

Close with framing: character occupies 12–18% of frame height at default
third-person zoom, uses the shared lighting include, and carries rim light so the
silhouette reads against sky.

**Do not** include any sentence resembling "if a rig and locomotion animation
cannot be brought to a high standard, prefer a fully cloth-driven figure". That
line in `BIOME_TECHDEMO_TEMPLATE.md:447` is the direct cause of the reported bug.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:/GitHub/envizzle" && node --test tests/character-recipe.test.mjs`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add "references/character-recipe.md" "tests/character-recipe.test.mjs"
git commit -m "feat(envizzle): add numeric procedural humanoid recipe"
```

---

### Task 3: Colour maths and coherence rules

**Files:**
- Create: `lib/color.mjs`
- Create: `lib/coherence.mjs`
- Test: `tests/coherence.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hexToRgb01(hex: string): [number, number, number]`
  - `relativeLuminance(hex: string): number` — WCAG, linearized, 0–1
  - `saturation(hex: string): number` — HSV S, 0–1
  - `checkCoherence(config): Conflict[]` where `Conflict = { rule: string, severity: 'error'|'warn', message: string, fix: string }`

**Palette schema** (used by every preset from here on):

```js
palette: [ { role: 'sky', hex: '#a8c8e8', area: 'large' }, ... ]
// area: 'large' (sky, terrain base, vegetation base) | 'medium' | 'accent'
```

Roles are free-form strings. `area` is required and drives two rules.

- [ ] **Step 1: Write the failing tests**

Create `tests/coherence.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeLuminance, saturation } from '../lib/color.mjs';
import { checkCoherence } from '../lib/coherence.mjs';

// Values verified by hand against the WCAG formula before writing this plan.
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
  const conflicts = checkCoherence(REFERENCE_BAD);
  const rules = conflicts.map((c) => c.rule);
  // Every colour is either near-black or fully saturated neon. A bright neon
  // is NOT a substitute for a luminous light value — this is the rule that
  // actually catches the bug.
  assert.ok(rules.includes('light-anchor'), `rules were: ${rules.join(', ')}`);
});

test('flags the reference config on large-area luminance', () => {
  const rules = checkCoherence(REFERENCE_BAD).map((c) => c.rule);
  assert.ok(rules.includes('large-area-luminance'));
});

test('a bright-neon-only palette does NOT satisfy the light anchor', () => {
  // Regression guard: a naive "must contain a bright colour" rule passes this,
  // because #00ffcc has luminance 0.76. It must still fail.
  const rules = checkCoherence(REFERENCE_BAD).map((c) => c.rule);
  assert.ok(rules.includes('light-anchor'));
});

test('every conflict carries a suggested fix', () => {
  for (const c of checkCoherence(REFERENCE_BAD)) {
    assert.ok(c.fix.length > 10, `rule ${c.rule} has no usable fix text`);
    assert.ok(['error', 'warn'].includes(c.severity));
  }
});

test('a coherent high-key painterly palette passes clean', () => {
  const good = {
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
  };
  assert.deepEqual(checkCoherence(good), []);
});

test('photoreal zero-asset must declare multi-scale normals', () => {
  const rules = checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'A stock PBR material',
    palette: [
      { role: 'sky',     hex: '#b9d2ea', area: 'large' },
      { role: 'snow',    hex: '#eef2f6', area: 'large' },
      { role: 'rock',    hex: '#5d5a55', area: 'medium' },
      { role: 'shadow',  hex: '#31445e', area: 'medium' },
      { role: 'sun',     hex: '#ffd9a0', area: 'accent' },
    ],
  }).map((c) => c.rule);
  assert.ok(rules.includes('photoreal-multiscale-normals'));
});

test('accent-heavy palettes are capped', () => {
  const rules = checkCoherence({
    paradigm: 'painterly',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'palette table, cel ramp',
    palette: [
      { role: 'sky',  hex: '#a8c8e8', area: 'large' },
      { role: 'base', hex: '#f2ece0', area: 'large' },
      { role: 'mid',  hex: '#6b6256', area: 'medium' },
      { role: 'a',    hex: '#ff0066', area: 'accent' },
      { role: 'b',    hex: '#00ffcc', area: 'accent' },
      { role: 'c',    hex: '#ffaa00', area: 'accent' },
      { role: 'd',    hex: '#ff00ff', area: 'accent' },
    ],
  }).map((c) => c.rule);
  assert.ok(rules.includes('accent-cap'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/GitHub/envizzle" && node --test tests/coherence.test.mjs`
Expected: FAIL — cannot find `../lib/color.mjs`

- [ ] **Step 3: Implement colour maths**

Create `lib/color.mjs`:

```js
/** '#rrggbb' → [r, g, b] each 0..1 in sRGB space. */
export function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) throw new Error(`Expected #rrggbb, got: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb01(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** HSV saturation, 0 (neutral grey) .. 1 (fully saturated). */
export function saturation(hex) {
  const [r, g, b] = hexToRgb01(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
```

- [ ] **Step 4: Implement the coherence rules**

Create `lib/coherence.mjs`:

```js
import { relativeLuminance, saturation } from './color.mjs';

const LIGHT_ANCHOR_MIN_LUM = 0.55;
const LIGHT_ANCHOR_MAX_SAT = 0.35;
const LARGE_AREA_MIN_MEAN_LUM = 0.30;
const ACCENT_MAX_FRACTION = 0.35;
const TIER_DARK = 0.15;
const TIER_LIGHT = 0.55;

const conflict = (rule, severity, message, fix) => ({ rule, severity, message, fix });

/**
 * Evaluate a demo config against the art-direction rules.
 * @returns {Array<{rule:string,severity:'error'|'warn',message:string,fix:string}>}
 */
export function checkCoherence(config) {
  const out = [];
  const palette = config.palette ?? [];
  const lums = palette.map((p) => relativeLuminance(p.hex));

  // R1 — light anchor. A saturated neon is not a light value. Without a
  // desaturated bright tone the scene reads as murk with glowing bits.
  const hasAnchor = palette.some(
    (p) =>
      relativeLuminance(p.hex) >= LIGHT_ANCHOR_MIN_LUM &&
      saturation(p.hex) <= LIGHT_ANCHOR_MAX_SAT,
  );
  if (palette.length > 0 && !hasAnchor) {
    out.push(conflict(
      'light-anchor', 'error',
      `No light anchor: the palette has no colour with luminance >= ${LIGHT_ANCHOR_MIN_LUM} and saturation <= ${LIGHT_ANCHOR_MAX_SAT}. Saturated neons do not count.`,
      'Add a desaturated bright tone — a warm off-white, pale sky tint, or bleached stone (e.g. #f2ece0, #d8d0b8) — and give it large or medium area.',
    ));
  }

  // R2 — value tiers. Needs something in each of dark / mid / light.
  if (palette.length > 0) {
    const hasDark = lums.some((l) => l < TIER_DARK);
    const hasMid = lums.some((l) => l >= TIER_DARK && l <= TIER_LIGHT);
    const hasLight = lums.some((l) => l > TIER_LIGHT);
    if (!(hasDark && hasMid && hasLight)) {
      const missing = [
        !hasDark && 'dark (<0.15)',
        !hasMid && 'mid (0.15-0.55)',
        !hasLight && 'light (>0.55)',
      ].filter(Boolean).join(', ');
      out.push(conflict(
        'value-tiers', 'error',
        `Palette is missing value tiers: ${missing}. Flat-value palettes read as unlit.`,
        'Add one colour per missing tier so the scene has readable separation between shadow, midtone, and highlight.',
      ));
    }
  }

  // R3 — large-area luminance. Painterly rendering reads as beautiful because
  // it is high-key; the colours covering most of the screen must carry light.
  const large = palette.filter((p) => p.area === 'large');
  if (config.paradigm === 'painterly' && large.length > 0) {
    const mean =
      large.reduce((s, p) => s + relativeLuminance(p.hex), 0) / large.length;
    if (mean < LARGE_AREA_MIN_MEAN_LUM) {
      out.push(conflict(
        'large-area-luminance', 'error',
        `Painterly paradigm with mean large-area luminance ${mean.toFixed(3)} (floor ${LARGE_AREA_MIN_MEAN_LUM}). Sky, terrain, and vegetation carry most of the frame; dark values there produce muddy frames.`,
        'Either raise the sky/terrain/vegetation values into the 0.30-0.70 range, or switch paradigm to photoreal where a low-key palette is supportable.',
      ));
    }
  }

  // R4 — accent cap. Emissive/neon should punctuate, not dominate.
  if (palette.length > 0) {
    const accents = palette.filter((p) => p.area === 'accent').length;
    const fraction = accents / palette.length;
    if (fraction > ACCENT_MAX_FRACTION) {
      out.push(conflict(
        'accent-cap', 'warn',
        `${accents} of ${palette.length} palette entries are accents (${(fraction * 100).toFixed(0)}%, cap ${ACCENT_MAX_FRACTION * 100}%). Emissive should stay under ~15% of screen area.`,
        'Demote some accents to medium area, or fold them into a single accent hue used sparingly.',
      ));
    }
  }

  // R5 / R6 — technique requirements implied by paradigm + zero assets.
  const behaviours = (config.materialBehaviours ?? '').toLowerCase();
  if (config.paradigm === 'photoreal' && config.assetStrategy === 'zero-asset') {
    if (!/multi-scale|multiscale/.test(behaviours)) {
      out.push(conflict(
        'photoreal-multiscale-normals', 'error',
        'Photoreal with zero assets requires multi-scale procedural normals; none declared in material behaviours.',
        'Add multi-scale procedural normal detail (three octaves minimum) so the surface reads at close, mid, and far range.',
      ));
    }
  }
  if (config.paradigm === 'painterly' && config.assetStrategy === 'zero-asset') {
    const hasTable = /palette table/.test(behaviours);
    const hasRamp = /cel ramp|toon ramp|cel-shad/.test(behaviours);
    if (!hasTable || !hasRamp) {
      out.push(conflict(
        'painterly-palette-table', 'error',
        'Painterly with zero assets requires both an explicit palette table and a cel ramp; material behaviours declare ' +
          `${hasTable ? 'a palette table' : 'no palette table'} and ${hasRamp ? 'a cel ramp' : 'no cel ramp'}.`,
        'Declare a single-source sRGB palette table converted to linear on load, plus a 2-step cel ramp with shadow-boundary wobble.',
      ));
    }
  }

  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "C:/GitHub/envizzle" && node --test tests/coherence.test.mjs`
Expected: PASS, 9 tests. In particular the reference config is flagged on both
`light-anchor` and `large-area-luminance`.

- [ ] **Step 6: Commit**

```bash
git add "lib/color.mjs" "lib/coherence.mjs" "tests/coherence.test.mjs"
git commit -m "feat(envizzle): add colour maths and art-direction coherence rules"
```

---

### Task 4: Ambition dial and biome presets

**Files:**
- Create: `lib/ambition.mjs`
- Create: `lib/presets/biomes.mjs`
- Test: `tests/presets-biomes.test.mjs`

**Interfaces:**
- Consumes: `checkCoherence` (Task 3).
- Produces:
  - `AMBITION_LEVELS: Record<'slice'|'showcase'|'everything', string[]>` — enabled section names
  - `sectionsFor(level: string): Set<string>`
  - `BIOMES: Record<string, BiomePreset>` where each preset has keys
    `label, paradigm, palette, tokens` and `tokens` is a `Record<string,string>`
    of brief token values.

- [ ] **Step 1: Write the failing tests**

Create `tests/presets-biomes.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMBITION_LEVELS, sectionsFor } from '../lib/ambition.mjs';
import { BIOMES } from '../lib/presets/biomes.mjs';
import { checkCoherence } from '../lib/coherence.mjs';

test('slice enables fewer sections than showcase, which is fewer than everything', () => {
  assert.ok(sectionsFor('slice').size < sectionsFor('showcase').size);
  assert.ok(sectionsFor('showcase').size < sectionsFor('everything').size);
});

test('slice excludes vegetation, state-buffer, and audio', () => {
  const s = sectionsFor('slice');
  assert.ok(!s.has('vegetation'));
  assert.ok(!s.has('state-buffer'));
  assert.ok(!s.has('audio'));
});

test('unknown ambition level throws with the valid names listed', () => {
  assert.throws(() => sectionsFor('nope'), /slice.*showcase.*everything/);
});

test('every biome ships at least six named biomes', () => {
  assert.ok(Object.keys(BIOMES).length >= 6);
});

test('every biome palette is coherence-clean against its own paradigm', () => {
  for (const [name, biome] of Object.entries(BIOMES)) {
    const conflicts = checkCoherence({
      paradigm: biome.paradigm,
      assetStrategy: 'zero-asset',
      materialBehaviours: biome.tokens.MATERIAL_BEHAVIOURS,
      palette: biome.palette,
    }).filter((c) => c.severity === 'error');
    assert.deepEqual(
      conflicts.map((c) => c.rule), [],
      `biome "${name}" has coherence errors`,
    );
  }
});

test('every biome supplies numeric noise layers, not adjectives', () => {
  for (const [name, biome] of Object.entries(BIOMES)) {
    const layers = biome.tokens.TERRAIN_NOISE_LAYERS;
    assert.match(layers, /\d+\s*m/, `biome "${name}" noise layers lack metre scales`);
    assert.match(layers, /amp/i, `biome "${name}" noise layers lack amplitudes`);
  }
});

test('every biome tags palette entries with an area class', () => {
  for (const [name, biome] of Object.entries(BIOMES)) {
    for (const entry of biome.palette) {
      assert.ok(
        ['large', 'medium', 'accent'].includes(entry.area),
        `biome "${name}" role "${entry.role}" has invalid area "${entry.area}"`,
      );
    }
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/GitHub/envizzle" && node --test tests/presets-biomes.test.mjs`
Expected: FAIL — cannot find `../lib/ambition.mjs`

- [ ] **Step 3: Implement the ambition dial**

Create `lib/ambition.mjs`:

```js
/**
 * Which optional brief sections each ambition level turns on. Sections not
 * listed are deleted from the brief entirely rather than left unfilled, so the
 * target agent never sees a dead placeholder.
 *
 * 'slice' is the default: a true one-shot collapses under a dozen systems.
 */
export const AMBITION_LEVELS = {
  slice: ['post-processing'],
  showcase: [
    'post-processing', 'vegetation', 'state-buffer', 'audio', 'atmospheric-life',
  ],
  everything: [
    'post-processing', 'vegetation', 'state-buffer', 'audio', 'atmospheric-life',
    'weather', 'water', 'architecture', 'destructibility',
  ],
};

/** @returns {Set<string>} enabled section names for a level. */
export function sectionsFor(level) {
  const sections = AMBITION_LEVELS[level];
  if (!sections) {
    throw new Error(
      `Unknown ambition level "${level}". Valid: slice, showcase, everything.`,
    );
  }
  return new Set(sections);
}
```

- [ ] **Step 4: Implement biome presets**

Create `lib/presets/biomes.mjs` with at least six biomes:
`alpineSnow`, `gribliValley`, `duneDesert`, `oceanShelf`, `volcanic`, `nightCity`.

Each entry follows this shape exactly. Here is `alpineSnow` complete as the
worked example — write the other five to match, changing values not structure:

```js
export const BIOMES = {
  alpineSnow: {
    label: 'Alpine Snow — high-key photoreal snowfield',
    paradigm: 'photoreal',
    palette: [
      { role: 'sky-zenith',  hex: '#5f8fc4', area: 'large' },
      { role: 'sky-horizon', hex: '#cfe0f0', area: 'large' },
      { role: 'snow-lit',    hex: '#f4f7fa', area: 'large' },
      { role: 'snow-shadow', hex: '#7d92b4', area: 'medium' },
      { role: 'rock',        hex: '#544f4a', area: 'medium' },
      { role: 'sun-warm',    hex: '#ffd9a0', area: 'accent' },
    ],
    tokens: {
      PRIMARY_ENVIRONMENT:
        'a wind-scoured alpine snowfield ringed by granite peaks',
      PRIMARY_MATERIAL_NAME: 'Snow',
      NAIVE_DEFAULT: 'flat white',
      TERRAIN_PHILOSOPHY_SENTENCE:
        'A flat plane reads as a default asset. The field needs drifts, sastrugi ridges, and wind-carved scallops.',
      TERRAIN_NOISE_LAYERS:
        'broad drift ridges (scale 320 m, amp 38 m), dune-scale drifts (scale 40 m, amp 6 m), sastrugi wind ripples (scale 3 m, amp 0.18 m), and micro grain (scale 0.4 m, amp 0.02 m)',
      TERRAIN_LANDMARKS:
        'Landmarks: exposed granite outcrops with wind-scoured lee faces, a frozen tarn, and a cornice ridge that catches rim light.',
      FAR_FIELD_TREATMENT:
        'layered granite peaks with strong aerial perspective, ice-blue shadow fill, and a high thin cirrus deck',
      MATERIAL_BEHAVIOURS: [
        '1. Multi-scale procedural normals — three octaves (drift, ripple, grain) composited so surface reads at 30 m, 3 m, and 0.3 m simultaneously.',
        '2. Wrapped-diffuse subsurface scattering with a 0.35 wrap term, tinted #9fc4e8 on the shadow side.',
        '3. TAA-stabilised specular glints from a hash-driven microfacet distribution — glints must not crawl under camera motion.',
        '4. Compaction darkening — trodden snow reads denser, wetter, and slightly blue.',
      ].join('\n'),
      STATE_BUFFER_CHANNELS: [
        '- R: Compression depth (0..1)',
        '- G: Displaced berm height (0..1)',
        '- B: Wetness / refreeze (0..1)',
        '- A: Ice glaze (0..1)',
      ].join('\n'),
      DEFORMATION_TYPE: 'Snow Deformation',
      DEFORMATION_MARKS: 'trails, berms, and boot prints',
      RECOVERY_MECHANISM: 'wind-driven infill and light refreeze',
      RECOVERY_OUTCOME: 'soften into shallow undulations without vanishing',
      FOOT_INTERACTION: 'compress snow, raise a small berm, and kick up spray',
      AUDIO_ENGINE_SPEC:
        'Synthesise wind (filtered pink noise with gust envelopes), snow crunch (short filtered noise bursts with pitch jitter per footfall), and a sparse high-string drone.',
      ATMOSPHERIC_LIFE_SPEC:
        'Low spindrift streaming off drift crests, occasional high-altitude bird silhouettes, and sun-shaft ice crystals.',
      GRASS_SYSTEM_SPEC:
        'No grass. Instead render 3 rings of wind-blown spindrift ribbons (0-30 m, 25-120 m, 100-600 m) as camera-facing strips whose density follows the same min(1,(dn/d)^1.5) law.',
    },
  },

  // ... gribliValley, duneDesert, oceanShelf, volcanic, nightCity
};
```

Constraints when authoring the remaining five:
- `volcanic` is the deliberate low-key case. Set `paradigm: 'photoreal'` (not
  painterly) so the `large-area-luminance` rule does not apply, and still include
  a desaturated light anchor such as `#e8dcc8` ash-lit steam so `light-anchor`
  passes. This biome is what teaches a disciplined dark scene.
- `nightCity` likewise uses `paradigm: 'photoreal'` with a light anchor from wet
  road sheen (e.g. `#c9d4dc`).
- `gribliValley` is `paradigm: 'painterly'` and must keep mean large-area
  luminance above 0.30 — this is the corrected version of the reference config.
- Every `MATERIAL_BEHAVIOURS` for a painterly biome must contain the literal
  substrings `palette table` and `cel ramp`, or rule R6 fails.
- Every `MATERIAL_BEHAVIOURS` for a photoreal biome must contain `multi-scale`,
  or rule R5 fails.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "C:/GitHub/envizzle" && node --test tests/presets-biomes.test.mjs`
Expected: PASS, 7 tests

- [ ] **Step 6: Commit**

```bash
git add "lib/ambition.mjs" "lib/presets/biomes.mjs" "tests/presets-biomes.test.mjs"
git commit -m "feat(envizzle): add ambition dial and six biome presets"
```

---

### Task 5: Archetype, mechanic, camera, and optional-system presets

**Files:**
- Create: `lib/presets/archetypes.mjs`
- Create: `lib/presets/mechanics.mjs`
- Create: `lib/presets/cameras.mjs`
- Create: `lib/presets/optional-systems.mjs`
- Test: `tests/presets-other.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `ARCHETYPES`, `MECHANICS`, `CAMERAS`, `OPTIONAL_SYSTEMS` — each a
  `Record<string, { label: string, tokens: Record<string,string> }>`.
  `ARCHETYPES` entries additionally carry `rig: { heightM, ringRadiusScale, hiddenLowerBody }`.

The critical constraint: archetypes are **parameters on the one rig from Task 2**,
never alternative bodies.

- [ ] **Step 1: Write the failing tests**

Create `tests/presets-other.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES } from '../lib/presets/archetypes.mjs';
import { MECHANICS } from '../lib/presets/mechanics.mjs';
import { CAMERAS } from '../lib/presets/cameras.mjs';
import { OPTIONAL_SYSTEMS } from '../lib/presets/optional-systems.mjs';
import { AMBITION_LEVELS } from '../lib/ambition.mjs';

test('ships at least five archetypes', () => {
  assert.ok(Object.keys(ARCHETYPES).length >= 5);
});

test('every archetype parameterises the shared rig rather than replacing it', () => {
  for (const [name, a] of Object.entries(ARCHETYPES)) {
    assert.equal(typeof a.rig.heightM, 'number', `${name}: rig.heightM`);
    assert.ok(a.rig.heightM > 1.2 && a.rig.heightM < 2.6, `${name}: implausible height`);
    assert.equal(typeof a.rig.ringRadiusScale, 'number', `${name}: rig.ringRadiusScale`);
    assert.equal(typeof a.rig.hiddenLowerBody, 'boolean', `${name}: rig.hiddenLowerBody`);
  }
});

test('no archetype description names a primitive geometry', () => {
  for (const [name, a] of Object.entries(ARCHETYPES)) {
    const text = JSON.stringify(a.tokens);
    for (const prim of ['BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'CapsuleGeometry']) {
      assert.doesNotMatch(text, new RegExp(prim), `${name} mentions ${prim}`);
    }
  }
});

test('archetypes with a hidden lower body declare ground-reaching cloth', () => {
  for (const [name, a] of Object.entries(ARCHETYPES)) {
    if (a.rig.hiddenLowerBody) {
      assert.match(
        a.tokens.CLOTH_PANELS, /ground|floor|hem/i,
        `${name} hides the lower body but does not reach the ground`,
      );
    }
  }
});

test('every archetype specifies cloth panels with Verlet grid dimensions', () => {
  for (const [name, a] of Object.entries(ARCHETYPES)) {
    assert.match(a.tokens.CLOTH_PANELS, /\d+\s*[x×]\s*\d+/, `${name}: no grid dims`);
  }
});

test('every mechanic declares an input binding and a state-buffer interaction', () => {
  for (const [name, m] of Object.entries(MECHANICS)) {
    assert.ok(m.tokens.CENTREPIECE_INPUT?.length > 0, `${name}: no input`);
    assert.ok(m.tokens.CENTREPIECE_DESCRIPTION?.length > 80, `${name}: description too thin`);
  }
});

test('every mechanic supplies three distinct named abilities', () => {
  for (const [name, m] of Object.entries(MECHANICS)) {
    const abilities = [m.tokens.ABILITY_1_NAME, m.tokens.ABILITY_2_NAME, m.tokens.ABILITY_3_NAME];
    assert.equal(new Set(abilities).size, 3, `${name}: abilities not distinct`);
  }
});

test('cameras cover third-person, first-person, cinematic, and xr', () => {
  for (const key of ['thirdPerson', 'firstPerson', 'cinematic', 'xr']) {
    assert.ok(CAMERAS[key], `missing camera mode: ${key}`);
  }
});

test('every camera states the character framing requirement', () => {
  for (const [name, c] of Object.entries(CAMERAS)) {
    assert.ok(
      c.tokens.CAMERA_SPEC.length > 60,
      `${name}: camera spec too thin to guide framing`,
    );
  }
});

test('every optional system maps to a section name the ambition dial knows', () => {
  const known = new Set(AMBITION_LEVELS.everything);
  for (const [name, s] of Object.entries(OPTIONAL_SYSTEMS)) {
    assert.ok(known.has(s.section), `optional system "${name}" has unknown section "${s.section}"`);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/GitHub/envizzle" && node --test tests/presets-other.test.mjs`
Expected: FAIL — cannot find `../lib/presets/archetypes.mjs`

- [ ] **Step 3: Implement archetypes**

Create `lib/presets/archetypes.mjs` with at least five:
`robedMage`, `travellerCoat`, `armoredSoldier`, `desertNomad`, `voidWanderer`.

Worked example — write the rest to match:

```js
export const ARCHETYPES = {
  robedMage: {
    label: 'Robed Mage — deep cowl, trailing hem, fur trim',
    rig: { heightM: 1.78, ringRadiusScale: 1.0, hiddenLowerBody: true },
    tokens: {
      CHARACTER_DESCRIPTION:
        'A hooded figure in a layered robe: deep cowl, long sleeves, an over-mantle, and a trailing hem that sweeps the ground. Silhouette is the whole read — the face stays in shadow beneath the cowl and is never modelled in detail. Shell-based fur at hood and cuffs, 24 shells with alpha-tested strands.',
      CLOTH_PANELS:
        'the over-mantle (Verlet grid 36x12, reconstructed to 72x32 in the vertex shader), the trailing hem which must reach the ground and fully occlude the lower legs, and both sleeve cuffs (12x8 each)',
      CLOTH_SHADING_REQUIREMENTS:
        'Cloth needs sheen with an anisotropic response for a woven read, plus subsurface scattering on thin backlit regions. A plain PBR dielectric is not acceptable.',
      HEAD_COVERING: 'deep cowl',
    },
  },

  // ... travellerCoat, armoredSoldier, desertNomad, voidWanderer
};
```

Notes: `armoredSoldier` and `travellerCoat` set `hiddenLowerBody: false` and so
must show legs, which the Task 2 rig provides. `voidWanderer` is the corrected
version of the reference output's character — set `hiddenLowerBody: true` with a
ground-reaching mantle, so the "no legs" path is legitimate rather than an excuse.

- [ ] **Step 4: Implement mechanics, cameras, and optional systems**

`mechanics.mjs` — at least five: `surfCarve`, `flightGlide`, `beamCannon`,
`grappleSwing`, `summonVehicle`. Each supplies `CENTREPIECE_MECHANIC`,
`CENTREPIECE_INPUT`, `CENTREPIECE_DESCRIPTION` (>80 chars, naming the
state-buffer channels it writes), and three distinct `ABILITY_N_NAME` values.

`cameras.mjs` — exactly the four keys the test requires plus optional extras.
Each supplies `CAMERA_SPEC` (>60 chars) covering framing, FOV behaviour, and what
the character must look good from. `xr` must state that the character is seen at
arm's length and the rig therefore needs correct proportions, not just silhouette.

`optional-systems.mjs` — one entry per section name in
`AMBITION_LEVELS.everything` that is not already covered by a biome:
`weather`, `water`, `architecture`, `destructibility`. Each has shape
`{ label, section, tokens }` where `section` matches the ambition dial name.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "C:/GitHub/envizzle" && node --test tests/presets-other.test.mjs`
Expected: PASS, 10 tests

- [ ] **Step 6: Commit**

```bash
git add "lib/presets/" "tests/presets-other.test.mjs"
git commit -m "feat(envizzle): add archetype, mechanic, camera, and optional-system presets"
```

---

### Task 6: Showcase configs and end-to-end assembly

**Files:**
- Create: `lib/presets/showcase.mjs`
- Modify: `lib/assemble.mjs` (add `buildConfig` and CLI)
- Test: `tests/showcase.test.mjs`

**Interfaces:**
- Consumes: `BIOMES`, `ARCHETYPES`, `MECHANICS`, `CAMERAS`, `sectionsFor`, `checkCoherence`, `assemble`, `loadAssets`.
- Produces:
  - `SHOWCASE: Record<string, { label, why, ambition, biome, archetype, mechanic, camera, tokenOverrides }>`
  - `buildConfig(name: string): { tokens, enabledSections, palette, paradigm }` in `assemble.mjs`
  - `buildBrief(name: string): string` in `assemble.mjs`
  - CLI: `node lib/assemble.mjs <showcase-name> [--out path]`

- [ ] **Step 1: Write the failing tests**

Create `tests/showcase.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOWCASE } from '../lib/presets/showcase.mjs';
import { buildConfig, buildBrief } from '../lib/assemble.mjs';
import { checkCoherence } from '../lib/coherence.mjs';

const names = Object.keys(SHOWCASE);

test('ships six showcase configs', () => {
  assert.equal(names.length, 6);
});

test('every showcase config references presets that exist', () => {
  for (const name of names) {
    assert.doesNotThrow(() => buildConfig(name), `config "${name}" does not resolve`);
  }
});

test('every showcase config is coherence-clean', () => {
  for (const name of names) {
    const cfg = buildConfig(name);
    const errors = checkCoherence({
      paradigm: cfg.paradigm,
      assetStrategy: 'zero-asset',
      materialBehaviours: cfg.tokens.MATERIAL_BEHAVIOURS,
      palette: cfg.palette,
    }).filter((c) => c.severity === 'error');
    assert.deepEqual(errors.map((c) => c.rule), [], `showcase "${name}" is incoherent`);
  }
});

test('every showcase config assembles with zero unresolved tokens', () => {
  for (const name of names) {
    assert.doesNotThrow(() => buildBrief(name), `showcase "${name}" failed to assemble`);
  }
});

test('every assembled brief inlines the character recipe in full', () => {
  for (const name of names) {
    const brief = buildBrief(name);
    assert.match(brief, /law of cosines/i, `${name}: recipe not inlined`);
    assert.match(brief, /BoxGeometry/, `${name}: prohibitions not inlined`);
    assert.match(brief, /gaitPhase/, `${name}: gait maths not inlined`);
  }
});

test('every assembled brief mandates the window.__demo hook', () => {
  for (const name of names) {
    assert.match(buildBrief(name), /window\.__demo/, `${name}: no verification hook`);
  }
});

test('a slice-level brief omits disabled sections entirely', () => {
  const sliceName = names.find((n) => SHOWCASE[n].ambition === 'slice');
  assert.ok(sliceName, 'expected at least one slice-level showcase config');
  const brief = buildBrief(sliceName);
  assert.doesNotMatch(brief, /SECTION/, 'section markers leaked into output');
});

test('every showcase config explains why it reads as AAA', () => {
  for (const name of names) {
    assert.ok(SHOWCASE[name].why.length > 40, `${name}: "why" is too thin`);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/GitHub/envizzle" && node --test tests/showcase.test.mjs`
Expected: FAIL — cannot find `../lib/presets/showcase.mjs`

- [ ] **Step 3: Implement the showcase configs**

Create `lib/presets/showcase.mjs`. Exactly six entries.
At least one must use `ambition: 'slice'` so the omission test has a subject.

```js
export const SHOWCASE = {
  alpineDawn: {
    label: 'Alpine Dawn',
    why: 'High-key snow with a low sun gives strong value separation and long rim-lit shadows — the cheapest route to a frame that reads as photoreal.',
    ambition: 'showcase',
    biome: 'alpineSnow',
    archetype: 'robedMage',
    mechanic: 'surfCarve',
    camera: 'thirdPerson',
    tokenOverrides: {
      PROJECT_NAME: 'ALPINE_DAWN',
      ENGINE: 'Babylon.js WebGPU',
      SHADER_LANG: 'WGSL',
      SHADER_LANG_EXT: 'wgsl',
    },
  },

  // hoshiNoTani  — gribliValley  + travellerCoat  + flightGlide   + thirdPerson (showcase)
  // duneSea      — duneDesert    + desertNomad    + surfCarve     + thirdPerson (showcase)
  // tidalShelf   — oceanShelf    + travellerCoat  + grappleSwing  + cinematic   (slice)
  // emberfall    — volcanic      + armoredSoldier + beamCannon    + thirdPerson (showcase)
  // neonMonsoon  — nightCity     + voidWanderer   + summonVehicle + thirdPerson (everything)
};
```

- [ ] **Step 4: Add config resolution and the CLI to the assembler**

Append to `lib/assemble.mjs`:

```js
import { BIOMES } from './presets/biomes.mjs';
import { ARCHETYPES } from './presets/archetypes.mjs';
import { MECHANICS } from './presets/mechanics.mjs';
import { CAMERAS } from './presets/cameras.mjs';
import { OPTIONAL_SYSTEMS } from './presets/optional-systems.mjs';
import { SHOWCASE } from './presets/showcase.mjs';
import { sectionsFor } from './ambition.mjs';

const pick = (collection, key, kind) => {
  const found = collection[key];
  if (!found) {
    throw new Error(
      `Unknown ${kind} "${key}". Valid: ${Object.keys(collection).join(', ')}.`,
    );
  }
  return found;
};

/** Resolve a showcase name into merged tokens, sections, and palette. */
export function buildConfig(name) {
  const cfg = pick(SHOWCASE, name, 'showcase config');
  const biome = pick(BIOMES, cfg.biome, 'biome');
  const archetype = pick(ARCHETYPES, cfg.archetype, 'archetype');
  const mechanic = pick(MECHANICS, cfg.mechanic, 'mechanic');
  const camera = pick(CAMERAS, cfg.camera, 'camera');

  const enabledSections = sectionsFor(cfg.ambition);
  const optionalTokens = Object.values(OPTIONAL_SYSTEMS)
    .filter((s) => enabledSections.has(s.section))
    .reduce((acc, s) => ({ ...acc, ...s.tokens }), {});

  return {
    paradigm: biome.paradigm,
    palette: biome.palette,
    enabledSections,
    tokens: {
      ...biome.tokens,
      ...archetype.tokens,
      ...mechanic.tokens,
      ...camera.tokens,
      ...optionalTokens,
      RENDERING_PARADIGM: biome.paradigm === 'painterly'
        ? 'Painterly / Stylised Anime'
        : 'AAA Photoreal',
      ASSET_STRATEGY:
        '100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)',
      TARGET_BROWSER_AND_HARDWARE:
        'Chrome stable on Windows 11, discrete GPU, 2560x1440',
      CHARACTER_RIG_HEIGHT_M: String(archetype.rig.heightM),
      CHARACTER_RING_RADIUS_SCALE: String(archetype.rig.ringRadiusScale),
      ...cfg.tokenOverrides,
    },
  };
}

/** Resolve a showcase name straight through to a finished brief. */
export function buildBrief(name) {
  const { template, characterRecipe } = loadAssets();
  const { tokens, enabledSections } = buildConfig(name);
  return assemble({ template, tokens, enabledSections, characterRecipe });
}

// CLI: node lib/assemble.mjs <showcase-name> [--out path]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, ...rest] = process.argv.slice(2);
  if (!name) {
    console.error(`Usage: node lib/assemble.mjs <showcase-name> [--out path]`);
    console.error(`Available: ${Object.keys(SHOWCASE).join(', ')}`);
    process.exit(1);
  }
  const outIdx = rest.indexOf('--out');
  const brief = buildBrief(name);
  if (outIdx !== -1 && rest[outIdx + 1]) {
    fs.writeFileSync(rest[outIdx + 1], brief, 'utf8');
    console.log(`Wrote ${rest[outIdx + 1]} (${brief.length} bytes)`);
  } else {
    process.stdout.write(brief);
  }
}
```

- [ ] **Step 5: Run the full test suite**

Run: `cd "C:/GitHub/envizzle" && node --test tests/`
Expected: PASS, all tests across all five test files

- [ ] **Step 6: Smoke-test the CLI by eye**

Run: `cd "C:/GitHub/envizzle" && node lib/assemble.mjs alpineDawn --out /tmp/brief.md && head -60 /tmp/brief.md`
Expected: a clean brief with no `{{` and no `SECTION` markers.

- [ ] **Step 7: Commit**

```bash
git add "lib/presets/showcase.mjs" "lib/assemble.mjs" "tests/showcase.test.mjs"
git commit -m "feat(envizzle): add six showcase configs and brief assembly CLI"
```

---

### Task 7: Verification gates

**Files:**
- Create: `verify/gates.mjs`
- Create: `tests/fixtures/make-synthetic.mjs`
- Create: `tests/gates.test.mjs`
- Copy: `tests/fixtures/real-black-frame.png` (from the reference output)
- Copy: `tests/fixtures/real-idle-frame.png`

**Interfaces:**
- Consumes: `pngjs`.
- Produces (all pure over `{ width, height, data: Uint8Array /* RGBA */ }`):
  - `meanLuminance(img): number`
  - `flatFrameRatio(img, bucketCount = 50): number`
  - `changedAreaFraction(a, b, threshold = 0.02): number`
  - `evaluateGates({ frames, cameraDepthM, frameStats }): { pass: boolean, failures: string[] }`
  - `THRESHOLDS` — the frozen threshold constants

Gates operate on decoded buffers rather than file paths so unit tests use exact
synthetic images and the browser run passes buffers straight through.

- [ ] **Step 1: Install the PNG decoder**

Run: `cd "C:/GitHub/envizzle" && npm install`
Expected: `pngjs` and `playwright` present in `node_modules`.

- [ ] **Step 2: Copy the real known-bad fixtures**

```bash
mkdir -p "tests/fixtures"
cp "/c/Users/wests/OneDrive/Desktop/New folder (3)/screenshots/milestone_locomotion.png" \
   "tests/fixtures/real-black-frame.png"
cp "/c/Users/wests/OneDrive/Desktop/New folder (3)/screenshots/milestone_idle.png" \
   "tests/fixtures/real-idle-frame.png"
```

`real-black-frame.png` is the frame from the reference run where the camera
clipped inside a spire and the old script still reported success.

- [ ] **Step 3: Write the synthetic fixture generator**

Create `tests/fixtures/make-synthetic.mjs`:

```js
/** Build an RGBA image buffer in memory. No disk, no PNG encode needed. */
export function solid(width, height, [r, g, b]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** A mid-grey field with a smooth gradient, so it is not flat. */
export function gradient(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = Math.round(40 + (170 * x) / Math.max(1, width - 1));
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/**
 * Copy an image and paint a centred rectangle covering `fraction` of the area.
 * Used to simulate "character present" vs "character hidden".
 */
export function withBlob(img, fraction, [r, g, b] = [255, 0, 0]) {
  const out = { width: img.width, height: img.height, data: Uint8Array.from(img.data) };
  const side = Math.round(Math.sqrt(fraction * img.width * img.height));
  const x0 = Math.floor((img.width - side) / 2);
  const y0 = Math.floor((img.height - side) / 2);
  for (let y = y0; y < y0 + side; y++) {
    for (let x = x0; x < x0 + side; x++) {
      const i = (y * out.width + x) * 4;
      out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
    }
  }
  return out;
}
```

- [ ] **Step 4: Write the failing tests**

Create `tests/gates.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { meanLuminance, flatFrameRatio, changedAreaFraction, evaluateGates, THRESHOLDS }
  from '../verify/gates.mjs';
import { solid, gradient, withBlob } from './fixtures/make-synthetic.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const decode = (name) => {
  const png = PNG.sync.read(fs.readFileSync(path.join(HERE, 'fixtures', name)));
  return { width: png.width, height: png.height, data: png.data };
};

test('meanLuminance is 0 for black and 1 for white', () => {
  assert.ok(meanLuminance(solid(8, 8, [0, 0, 0])) < 0.001);
  assert.ok(meanLuminance(solid(8, 8, [255, 255, 255])) > 0.999);
});

test('flatFrameRatio is 1 for a solid fill and low for a gradient', () => {
  assert.ok(flatFrameRatio(solid(64, 64, [10, 10, 10])) > 0.99);
  assert.ok(flatFrameRatio(gradient(256, 64)) < 0.20);
});

test('changedAreaFraction measures the painted area', () => {
  const base = gradient(200, 200);
  const withChar = withBlob(base, 0.10);
  const measured = changedAreaFraction(base, withChar);
  assert.ok(Math.abs(measured - 0.10) < 0.02, `measured ${measured}`);
});

test('changedAreaFraction is ~0 for identical images', () => {
  const base = gradient(64, 64);
  assert.ok(changedAreaFraction(base, base) < 0.001);
});

// --- The regression the whole rewrite exists for --------------------------

test('the real black frame from the reference run FAILS the gates', () => {
  const black = decode('real-black-frame.png');
  const result = evaluateGates({
    frames: [{ name: 'locomotion', image: black }],
    cameraDepthM: 5,
    frameStats: { medianMs: 16, p99Ms: 20, samples: 600 },
  });
  assert.equal(result.pass, false, 'the old script passed this frame; the new one must not');
  assert.ok(
    result.failures.some((f) => /luminance|flat/i.test(f)),
    `expected a luminance or flat-frame failure, got: ${result.failures.join(' | ')}`,
  );
});

test('the real idle frame passes the luminance and flatness gates', () => {
  const idle = decode('real-idle-frame.png');
  assert.ok(meanLuminance(idle) >= THRESHOLDS.meanLuminanceMin);
  assert.ok(flatFrameRatio(idle) <= THRESHOLDS.flatFrameMaxRatio);
});

// --- Character visibility -------------------------------------------------

test('a character occupying 8% of frame passes the visibility gate', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: { medianMs: 11, p99Ms: 15, samples: 600 },
  });
  assert.equal(result.pass, true, result.failures.join(' | '));
});

test('an invisible character fails the visibility gate', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: base, imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: { medianMs: 11, p99Ms: 15, samples: 600 },
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /character/i.test(f)));
});

test('a character filling half the frame also fails (camera too close)', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: withBlob(base, 0.5), imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: { medianMs: 11, p99Ms: 15, samples: 600 },
  });
  assert.equal(result.pass, false);
});

test('a camera inside geometry fails', () => {
  const result = evaluateGates({
    frames: [{ name: 'idle', image: gradient(64, 64) }],
    cameraDepthM: 0.05,
    frameStats: { medianMs: 11, p99Ms: 15, samples: 600 },
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /camera/i.test(f)));
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd "C:/GitHub/envizzle" && node --test tests/gates.test.mjs`
Expected: FAIL — cannot find `../verify/gates.mjs`

- [ ] **Step 6: Implement the gates**

Create `verify/gates.mjs`:

```js
/**
 * Pure image gates. Every function takes {width, height, data} where data is
 * RGBA bytes, so unit tests use synthetic buffers and the browser run passes
 * Playwright screenshots through the same code.
 */

export const THRESHOLDS = Object.freeze({
  meanLuminanceMin: 0.12,
  meanLuminanceMax: 0.85,
  flatFrameMaxRatio: 0.70,
  characterAreaMin: 0.03,
  characterAreaMax: 0.20,
  cameraMinDepthM: 0.30,
  medianFrameMsMax: 11.2,   // 90 FPS target
  p99FrameMsMax: 16.7,      // 60 FPS floor
});

// Perceptual weights on non-linear sRGB. Deliberately not linearised: this
// measures apparent brightness of a rendered frame, not physical luminance.
const lumAt = (data, i) =>
  (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;

/** Average apparent brightness, 0..1. */
export function meanLuminance({ data, width, height }) {
  let sum = 0;
  const n = width * height;
  for (let p = 0; p < n; p++) sum += lumAt(data, p * 4);
  return sum / n;
}

/**
 * Fraction of pixels sharing the single most common luminance bucket.
 * A blank, black, or blown-out frame concentrates in one bucket.
 */
export function flatFrameRatio({ data, width, height }, bucketCount = 50) {
  const buckets = new Uint32Array(bucketCount);
  const n = width * height;
  for (let p = 0; p < n; p++) {
    const b = Math.min(bucketCount - 1, Math.floor(lumAt(data, p * 4) * bucketCount));
    buckets[b]++;
  }
  return Math.max(...buckets) / n;
}

/** Fraction of pixels whose luminance differs by more than `threshold`. */
export function changedAreaFraction(a, b, threshold = 0.02) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `Cannot diff images of different size: ${a.width}x${a.height} vs ${b.width}x${b.height}`,
    );
  }
  let changed = 0;
  const n = a.width * a.height;
  for (let p = 0; p < n; p++) {
    if (Math.abs(lumAt(a.data, p * 4) - lumAt(b.data, p * 4)) > threshold) changed++;
  }
  return changed / n;
}

/**
 * Run every gate over a captured run.
 * @param {{ frames: Array<{name:string, image:object, imageWithoutCharacter?:object}>,
 *           cameraDepthM: number,
 *           frameStats: {medianMs:number, p99Ms:number, samples:number} }} run
 * @returns {{ pass: boolean, failures: string[] }}
 */
export function evaluateGates({ frames, cameraDepthM, frameStats }) {
  const failures = [];

  for (const { name, image, imageWithoutCharacter } of frames) {
    const lum = meanLuminance(image);
    if (lum < THRESHOLDS.meanLuminanceMin || lum > THRESHOLDS.meanLuminanceMax) {
      failures.push(
        `[${name}] mean luminance ${lum.toFixed(3)} outside [${THRESHOLDS.meanLuminanceMin}, ${THRESHOLDS.meanLuminanceMax}] — frame is near-black or blown out.`,
      );
    }

    const flat = flatFrameRatio(image);
    if (flat > THRESHOLDS.flatFrameMaxRatio) {
      failures.push(
        `[${name}] ${(flat * 100).toFixed(0)}% of pixels share one luminance bucket (cap ${THRESHOLDS.flatFrameMaxRatio * 100}%) — frame is effectively blank.`,
      );
    }

    if (imageWithoutCharacter) {
      const area = changedAreaFraction(image, imageWithoutCharacter);
      if (area < THRESHOLDS.characterAreaMin) {
        failures.push(
          `[${name}] character covers ${(area * 100).toFixed(1)}% of frame (floor ${THRESHOLDS.characterAreaMin * 100}%) — character is missing, off-screen, or occluded.`,
        );
      } else if (area > THRESHOLDS.characterAreaMax) {
        failures.push(
          `[${name}] character covers ${(area * 100).toFixed(1)}% of frame (cap ${THRESHOLDS.characterAreaMax * 100}%) — camera is too close to read the environment.`,
        );
      }
    }
  }

  if (cameraDepthM < THRESHOLDS.cameraMinDepthM) {
    failures.push(
      `camera nearest depth ${cameraDepthM.toFixed(2)} m below ${THRESHOLDS.cameraMinDepthM} m — camera is inside geometry.`,
    );
  }

  if (frameStats.medianMs > THRESHOLDS.medianFrameMsMax) {
    failures.push(
      `median frame time ${frameStats.medianMs.toFixed(1)} ms exceeds ${THRESHOLDS.medianFrameMsMax} ms (90 FPS target).`,
    );
  }
  if (frameStats.p99Ms > THRESHOLDS.p99FrameMsMax) {
    failures.push(
      `p99 frame time ${frameStats.p99Ms.toFixed(1)} ms exceeds ${THRESHOLDS.p99FrameMsMax} ms (60 FPS floor).`,
    );
  }

  return { pass: failures.length === 0, failures };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd "C:/GitHub/envizzle" && node --test tests/gates.test.mjs`
Expected: PASS, 11 tests.

If `the real idle frame passes` fails, print the actuals and calibrate:
`node -e "import('./verify/gates.mjs').then(async g=>{const {PNG}=await import('pngjs');const fs=await import('node:fs');const p=PNG.sync.read(fs.readFileSync('tests/fixtures/real-idle-frame.png'));console.log('lum',g.meanLuminance(p),'flat',g.flatFrameRatio(p));})"`
Adjust `THRESHOLDS` only if the real frame is genuinely acceptable to the eye —
the black frame must keep failing.

- [ ] **Step 8: Commit**

```bash
git add "verify/gates.mjs" "tests/gates.test.mjs" "tests/fixtures/" "package-lock.json"
git commit -m "feat(envizzle): add image verification gates with real known-bad fixtures"
```

---

### Task 8: Browser orchestrator

**Files:**
- Create: `verify/verify_demo.mjs`
- Create: `verify/README.md`

**Interfaces:**
- Consumes: `evaluateGates`, `THRESHOLDS` (Task 7), `playwright`, `pngjs`.
- Produces: CLI `node verify/verify_demo.mjs <path-to-demo>`, exit code 0 pass / 1 fail.

The replacement for `legacy/verify_demo.mjs`, whose line 133 logged
`PASS: Screenshots successfully saved` without inspecting any pixel.

- [ ] **Step 1: Write the orchestrator**

Create `verify/verify_demo.mjs` implementing this flow.
Reuse the structure of the old script for the parts that worked — directory
audit, `npx vite build`, dev-server spawn, Playwright launch flags.

```js
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { evaluateGates } from './gates.mjs';

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const failures = [];
const fail = (m) => { failures.push(m); console.error(`FAIL: ${m}`); };
const pass = (m) => console.log(`PASS: ${m}`);

// 1. Structure audit — required files.
for (const rel of ['index.html', 'package.json', 'vite.config.js', 'DECISIONS.md', 'PERF.md', 'src/main.js']) {
  if (fs.existsSync(path.join(targetDir, rel))) pass(`found ${rel}`);
  else fail(`missing required path: ${rel}`);
}

// 2. Production build must compile clean.
try {
  execSync('npx vite build', { cwd: targetDir, stdio: 'pipe' });
  pass('production build compiled with zero errors');
} catch (err) {
  fail(`build failed: ${err.stderr?.toString() ?? err.message}`);
}

const toImage = (buf) => {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
};

async function run() {
  const playwright = await import('playwright');   // hard dependency now, not optional
  const server = spawn('npx', ['vite', '--port', '5173'], { cwd: targetDir, shell: true });
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    // 3. The hook must exist — without it nothing below is checkable.
    try {
      await page.waitForFunction('window.__demo && window.__demo.ready === true', { timeout: 30000 });
      pass('window.__demo hook present and ready');
    } catch {
      fail('window.__demo hook missing or never became ready — see brief section 6. Cannot verify.');
      return;
    }

    if (pageErrors.length === 0) pass('zero console/runtime errors');
    else fail(`runtime errors: ${pageErrors.join(' | ')}`);

    // 4. Capture each pose with and without the character.
    const frames = [];
    for (const pose of ['idle', 'locomotion', 'mechanic']) {
      await page.evaluate((p) => window.__demo.setPose(p), pose);
      await page.waitForTimeout(1200);

      const withChar = toImage(await page.screenshot());
      await page.evaluate(() => window.__demo.setCharacterVisible(false));
      await page.waitForTimeout(300);
      const withoutChar = toImage(await page.screenshot());
      await page.evaluate(() => window.__demo.setCharacterVisible(true));

      frames.push({ name: pose, image: withChar, imageWithoutCharacter: withoutChar });

      const dir = path.join(targetDir, 'screenshots');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `milestone_${pose}.png`), PNG.sync.write(
        Object.assign(new PNG({ width: withChar.width, height: withChar.height }), { data: withChar.data }),
      ));
    }

    // 5. Run the gates.
    const cameraDepthM = await page.evaluate(() => window.__demo.cameraNearestDepth());
    const frameStats = await page.evaluate(() => window.__demo.frameStats());
    const result = evaluateGates({ frames, cameraDepthM, frameStats });
    if (result.pass) pass('all image and performance gates passed');
    else result.failures.forEach(fail);
  } finally {
    await browser.close();
    server.kill();
  }
}

run()
  .catch((e) => fail(`verification crashed: ${e.message}`))
  .finally(() => {
    console.log('\n' + '='.repeat(50));
    if (failures.length === 0) {
      console.log('VERIFICATION PASSED');
      process.exit(0);
    }
    console.log(`VERIFICATION FAILED — ${failures.length} problem(s):`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log('\nFix these and re-run. Do not proceed with failures outstanding.');
    process.exit(1);
  });
```

- [ ] **Step 2: Write the verify README**

Create `verify/README.md` documenting: how to run it, the
`window.__demo` contract, each gate and its threshold, and why the character
diff gate cannot be satisfied without a real character.

- [ ] **Step 3: Verify it fails correctly against a demo with no hook**

Run: `cd "C:/GitHub/envizzle" && node verify/verify_demo.mjs "/c/Users/wests/OneDrive/Desktop/New folder (3)"`
Expected: exit code 1, with `window.__demo hook missing` among the failures —
the reference output predates the hook, so this is the correct result and
confirms the gate is wired.

- [ ] **Step 4: Commit**

```bash
git add "verify/verify_demo.mjs" "verify/README.md"
git commit -m "feat(envizzle): rewrite verification to gate on pixels not file existence"
```

---

### Task 9: SKILL.md

**Files:**
- Create: `SKILL.md`
- Test: `tests/skill-md.test.mjs`

**Interfaces:**
- Consumes: every preset module, for the name lists it documents.
- Produces: the skill entry point Claude reads.

- [ ] **Step 1: Write the failing tests**

Create `tests/skill-md.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOWCASE } from '../lib/presets/showcase.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const skill = fs.readFileSync(path.join(HERE, '..', 'SKILL.md'), 'utf8');

test('has valid frontmatter with name and description', () => {
  const fm = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'no frontmatter block');
  assert.match(fm[1], /^name:\s*envizzle$/m);
  assert.match(fm[1], /^description:\s*\S/m);
});

test('description states when to use the skill', () => {
  const desc = skill.match(/^description:\s*(.+)$/m)[1];
  assert.ok(desc.length > 80, 'description too short to route on');
  assert.match(desc, /use when/i);
});

test('documents every showcase config by name', () => {
  for (const name of Object.keys(SHOWCASE)) {
    assert.match(skill, new RegExp(name), `SKILL.md does not mention "${name}"`);
  }
});

test('documents the pick-for-me path and forbids mixing presets', () => {
  assert.match(skill, /pick for me/i);
  assert.match(skill, /never mix|do not mix|whole/i);
});

test('instructs running the assembler rather than hand-writing the brief', () => {
  assert.match(skill, /node lib\/assemble\.mjs/);
});

test('instructs running the coherence check before assembly', () => {
  assert.match(skill, /checkCoherence|coherence/i);
});

test('names the three ambition levels', () => {
  for (const level of ['slice', 'showcase', 'everything']) {
    assert.match(skill, new RegExp(level));
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/GitHub/envizzle" && node --test tests/skill-md.test.mjs`
Expected: FAIL — `ENOENT` on `SKILL.md`

- [ ] **Step 3: Write SKILL.md**

Create `SKILL.md` with this frontmatter and structure:

```markdown
---
name: envizzle
description: Use when the user wants to one-shot a visually impressive real-time graphics tech demo or game — generates a self-contained implementation brief with a numeric procedural character recipe, curated biome and archetype presets, coherence-checked palettes, and hardened visual verification. Triggers on "one-shot a game", "visually stunning demo", "tech demo brief", "make something that looks AAA".
---
```

Body sections, in order:

1. **What this produces** — one `<PROJECT>_TECHDEMO_PROMPT.md`, plus a copy of
   `verify/` and a `HANDOFF.md`. The brief is self-contained; the target agent
   may be any model.

2. **Step 1: Choose a route.** Offer three:
   - *Pick for me* — select ONE showcase config whole. **Never mix presets across
     configs**; recombination is what produced the incoherent reference config
     (painterly paradigm over a near-black palette).
   - *Start from a showcase config and adjust* — change tokens, then re-run the
     coherence check.
   - *Fully custom* — walk the interview.

3. **Step 2: The interview** (custom route only), in this order, one question at
   a time: ambition level → biome → character archetype → centrepiece mechanic →
   camera mode → optional systems. List the valid names for each from the preset
   modules. Default ambition is `slice`.

4. **Step 3: Coherence check.** Run the rules. Report every conflict with its
   message and suggested fix. Ask the user to accept the fix or override. If they
   override, record it in the brief under a `## Deliberate Deviations` heading so
   the target agent knows the choice was intentional.

5. **Step 4: Assemble.** Run `node lib/assemble.mjs <config> --out <PROJECT>_TECHDEMO_PROMPT.md`.
   Never hand-write the brief — the assembler guarantees no unresolved tokens and
   inlines the character recipe in full.

6. **Step 5: Hand off.** Copy `verify/` next to the target project. Write
   `HANDOFF.md` telling the user which agent to give the brief to and to run
   `node verify/verify_demo.mjs .` when the agent reports done.

7. **The character rule** — a short, prominent note that the character recipe is
   non-negotiable and inlined verbatim, because prose character specs produce
   primitive-assembled scarecrows.

8. **Reference tables** — showcase config names with their `why`, biome names,
   archetype names, mechanic names, camera names, ambition levels.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:/GitHub/envizzle" && node --test tests/skill-md.test.mjs`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add "SKILL.md" "tests/skill-md.test.mjs"
git commit -m "feat(envizzle): add SKILL.md entry point and interview flow"
```

---

### Task 10: Installer

**Files:**
- Create: `install.mjs`
- Test: `tests/install.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `filesToInstall(rootDir: string): string[]` — repo-relative paths, excluding `tests/`, `node_modules/`, `package-lock.json`
  - `install({ rootDir, destDir }): { copied: number, destDir: string }`

- [ ] **Step 1: Write the failing tests**

Create `tests/install.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filesToInstall, install } from '../install.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('installs SKILL.md, TEMPLATE.md, references, lib, and verify', () => {
  const files = filesToInstall(ROOT);
  for (const required of [
    'SKILL.md', 'TEMPLATE.md',
    path.join('references', 'character-recipe.md'),
    path.join('lib', 'assemble.mjs'),
    path.join('verify', 'gates.mjs'),
  ]) {
    assert.ok(files.includes(required), `missing from install set: ${required}`);
  }
});

test('excludes tests, legacy, docs, node_modules, and the lockfile', () => {
  for (const f of filesToInstall(ROOT)) {
    assert.doesNotMatch(f, /^tests[\\/]/, `tests leaked: ${f}`);
    assert.doesNotMatch(f, /^legacy[\\/]/, `legacy mining source leaked: ${f}`);
    assert.doesNotMatch(f, /^docs[\\/]/, `docs leaked: ${f}`);
    assert.doesNotMatch(f, /node_modules/, `node_modules leaked: ${f}`);
    assert.doesNotMatch(f, /package-lock\.json/, `lockfile leaked: ${f}`);
  }
});

test('install copies the set into a fresh destination', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'envizzle-'));
  try {
    const { copied } = install({ rootDir: ROOT, destDir: dest });
    assert.ok(copied > 5);
    assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(dest, 'references', 'character-recipe.md')));
    assert.ok(!fs.existsSync(path.join(dest, 'tests')));
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

test('install is idempotent', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'envizzle-'));
  try {
    const a = install({ rootDir: ROOT, destDir: dest });
    const b = install({ rootDir: ROOT, destDir: dest });
    assert.equal(a.copied, b.copied);
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/GitHub/envizzle" && node --test tests/install.test.mjs`
Expected: FAIL — cannot find `../install.mjs`

- [ ] **Step 3: Implement the installer**

Create `install.mjs`:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// legacy/ is mining source for the migration, never shipped. docs/ is the
// spec and plan. Neither belongs in ~/.claude/skills/envizzle/.
const EXCLUDE = [
  /^tests[\\/]/, /^legacy[\\/]/, /^docs[\\/]/,
  /node_modules/, /package-lock\.json$/, /^\.git/, /^README\.md$/, /^LICENSE$/,
];

/** Repo-relative paths that belong in the installed skill. */
export function filesToInstall(rootDir) {
  const walk = (dir, prefix = '') =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const rel = path.join(prefix, entry.name);
      if (EXCLUDE.some((re) => re.test(rel))) return [];
      return entry.isDirectory() ? walk(path.join(dir, entry.name), rel) : [rel];
    });
  return walk(rootDir);
}

/** Copy the install set to destDir, creating directories as needed. */
export function install({ rootDir = HERE, destDir } = {}) {
  const target = destDir ?? path.join(os.homedir(), '.claude', 'skills', 'envizzle');
  const files = filesToInstall(rootDir);
  for (const rel of files) {
    const dest = path.join(target, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(rootDir, rel), dest);
  }
  return { copied: files.length, destDir: target };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { copied, destDir } = install();
  console.log(`Installed ${copied} files to ${destDir}`);
  console.log('Reminder: this is a generated copy. Edit the repo, then re-run.');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:/GitHub/envizzle" && node --test tests/install.test.mjs`
Expected: PASS, 4 tests

- [ ] **Step 5: Install for real and confirm the skill is discovered**

Run: `cd "C:/GitHub/envizzle" && node install.mjs && ls ~/.claude/skills/envizzle/`
Expected: `SKILL.md`, `TEMPLATE.md`, `references/`, `lib/`, `verify/`, `install.mjs`

- [ ] **Step 6: Commit**

```bash
git add "install.mjs" "tests/install.test.mjs"
git commit -m "feat(envizzle): add installer to ~/.claude/skills"
```

---

### Task 11: Retire the mining sources

**Files:**
- Move: `legacy/prompt_builder.html` → `prompt_builder.html`
- Delete: `legacy/BIOME_TECHDEMO_TEMPLATE.md`
- Delete: `legacy/TEMPLATE_GUIDE.md`
- Delete: `legacy/TEMPLATE.md`
- Delete: `legacy/og prompt.txt`
- Delete: `legacy/verify_demo.mjs`
- Modify: `README.md`

Deletion is last because Tasks 1, 2, 4, and 5 mine `legacy/` for content. Do not
start this task until the full suite passes.

Note this task is now entirely within the `envizzle` repo. The SnowVR side was
already handled during repo setup: `SnowVR/prompt template/` was removed there in
its own commit, and every file in `legacy/` is a working-tree copy taken *before*
that removal, so uncommitted edits were preserved.

- [ ] **Step 1: Confirm the whole suite passes before deleting anything**

Run: `cd "C:/GitHub/envizzle" && node --test tests/`
Expected: PASS across all seven test files. If anything fails, stop — `legacy/` is
still the only copy of some content in this repo.

- [ ] **Step 2: Confirm the content was actually mined**

Check each of these before deleting its source:

| Mining source | Content must now live in |
|---|---|
| `legacy/BIOME_TECHDEMO_TEMPLATE.md` §2.6 guidance | `references/character-recipe.md` |
| `legacy/BIOME_TECHDEMO_TEMPLATE.md` biome examples | `lib/presets/biomes.mjs` |
| `legacy/TEMPLATE_GUIDE.md` paradigm comparison | `lib/coherence.mjs` rules |
| `legacy/TEMPLATE_GUIDE.md` architectural checklist | `TEMPLATE.md` acceptance criteria |
| `legacy/TEMPLATE.md` token set | `TEMPLATE.md` |
| `legacy/verify_demo.mjs` structure audit + build check | `verify/verify_demo.mjs` |

Spot check that biome content carried over:
`grep -c "amp" lib/presets/biomes.mjs`
Expected: at least 12 (two or more amplitude figures per biome across six biomes).

Spot check that no shipped file imports from `legacy/`:
`grep -rn "legacy/" lib/ verify/ SKILL.md TEMPLATE.md references/ || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Promote the prompt builder out of legacy**

`prompt_builder.html` is not superseded — the spec keeps it as an optional manual
path. It only lives in `legacy/` because that is where the migration put it.

```bash
cd "C:/GitHub/envizzle"
git mv "legacy/prompt_builder.html" prompt_builder.html
```

- [ ] **Step 4: Delete the mining sources**

```bash
cd "C:/GitHub/envizzle"
git rm "legacy/BIOME_TECHDEMO_TEMPLATE.md" \
       "legacy/TEMPLATE_GUIDE.md" \
       "legacy/TEMPLATE.md" \
       "legacy/og prompt.txt" \
       "legacy/verify_demo.mjs"
```

- [ ] **Step 5: Update the README**

Replace the `legacy/` bullet in `README.md` with a recovery note:

```markdown
The original prompt templates this skill was distilled from
(`BIOME_TECHDEMO_TEMPLATE.md`, `TEMPLATE.md`, `TEMPLATE_GUIDE.md`,
`og prompt.txt`, `verify_demo.mjs`) lived in `legacy/` during the migration and
were removed once their content was mined. Recover any of them with:

    git log --diff-filter=D --name-only
    git show <commit>^:legacy/<file>
```

- [ ] **Step 6: Confirm nothing references the deleted files**

Run: `cd "C:/GitHub/envizzle" && grep -rn "BIOME_TECHDEMO_TEMPLATE\|TEMPLATE_GUIDE\|og prompt" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs . || echo "no dangling references"`
Expected: `no dangling references`. `docs/` is excluded because the spec and this
plan legitimately discuss those files by name.

- [ ] **Step 7: Run the suite one final time and reinstall**

```bash
cd "C:/GitHub/envizzle"
node --test tests/
node install.mjs
```
Expected: suite PASSES, and the install reports a file count with no `legacy/`
or `docs/` entries.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: retire migration mining sources

Content distilled into references/character-recipe.md, lib/presets/,
lib/coherence.mjs, and verify/. prompt_builder.html promoted to root as
the optional manual path. Deleted files recoverable from git history;
README documents how."
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| `character-recipe.md`, all six parts + prohibitions | 2 |
| Showcase configs, pick-for-me selects whole | 6 |
| `biomes.md` numeric noise layers, palettes | 4 |
| `archetypes.md` as rig parameters | 5 |
| `mechanics.md`, `cameras.md`, `systems-optional.md` | 5 |
| `coherence.md` rules | 3 |
| Ambition dial, sections omitted not blanked | 4 (dial), 1 (stripping), 6 (test) |
| `window.__demo` hook mandated in brief | 1 (template), 6 (test), 8 (enforced) |
| Gates: luminance, flat-frame, character diff, camera depth, perf | 7 |
| Retake loop on failure | 8 (exit 1 + explicit instruction) |
| Assembly tests, coherence tests, gate tests with real fixtures | 1, 3, 6, 7 |
| Repo source of truth + `~/.claude/skills/` copy | 10 |
| Standalone repo, root = skill root | repo setup (done) + 10 (install excludes non-skill dirs) |
| `prompt_builder.html` unchanged | 11 (promoted out of `legacy/`, contents untouched) |
| Old `verify_demo.mjs` deleted after new one passes | 11 (gated on Step 1) |
| Error handling: unknown preset lists valid names | 6 (`pick()`), 4 (`sectionsFor`) |
| Error handling: coherence override recorded in brief | 9 (`## Deliberate Deviations`) |

No gaps found.

**Placeholder scan** — the `// ... name, name` comments in Tasks 4, 5, and 6 mark
remaining preset entries whose full structure is given by a complete worked example
in the same step, plus explicit authoring constraints. Tests enforce count, shape,
and coherence for every entry, so a missing one fails rather than passing silently.

**Type consistency** — verified across tasks: `assemble({template, tokens, enabledSections, characterRecipe})`
is defined in Task 1 and called with those exact keys in Task 6. `checkCoherence(config)`
returns `{rule, severity, message, fix}` in Task 3 and is destructured on those keys
in Tasks 4, 6, and 9. `evaluateGates({frames, cameraDepthM, frameStats})` is defined
in Task 7 and called with those keys in Task 8. Frames carry `{name, image, imageWithoutCharacter}`
in both. `sectionsFor` returns a `Set` in Task 4 and is used as a `Set` in Tasks 1 and 6.
Preset shape `{label, tokens}` is consistent, with `rig` added only for archetypes and
`section` only for optional systems, both asserted in Task 5.
