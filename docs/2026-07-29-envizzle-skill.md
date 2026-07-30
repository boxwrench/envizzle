# envizzle Skill Implementation Plan (lean)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/envizzle`, a skill that interviews the user, checks their art-direction choices for contradictions, and emits a self-contained Markdown brief a coding agent can use to one-shot a visually impressive graphics tech demo — with a numeric procedural character recipe that prevents the primitive-assembly failure mode.

**Architecture:** This is a skill, so it is mostly markdown. Claude reads `references/presets.md`, fills `TEMPLATE.md`, and writes the brief — normal skill behaviour, no build system. Code exists only where prose genuinely cannot do the job: WCAG luminance arithmetic, and pixel statistics on screenshots. Two scripts total.

**Tech Stack:** Node 24 ESM, `node:test` + `node:assert` (built in), `pngjs`, `playwright`.

## Scope history

An earlier draft of this plan had 11 tasks: preset data modules, a token-substituting assembler with a CLI, showcase-config resolution, and an installer. That was a build system wrapped around a skill. Five of those tasks produced quoted prose strings inside `.mjs` files that Claude can simply read as markdown.

The lean version keeps both real fixes — the numeric character recipe and the coherence rules — and drops the scaffolding. **Generation moves to Claude; code only validates.**

Task 1 of the old plan is already committed (`9ca1a9d`): `TEMPLATE.md`, `lib/assemble.mjs`, `tests/assemble.test.mjs`, `package.json`. Task 1 below revises that work rather than starting fresh.

## Global Constraints

- Node 24 ESM. `"type": "module"`. No TypeScript, no build step.
- Test runner is `node:test` with `node:assert`. Do NOT add jest, vitest, or mocha.
- Only two dev dependencies permitted in `package.json`: `pngjs` and `playwright`.
- **`node --test tests/` on a bare directory fails on this machine** (Node 24 / Windows, `MODULE_NOT_FOUND`). Use an explicit glob: `node --test tests/*.test.mjs`. Fix the `test` script in `package.json` accordingly.
- All paths are relative to the repo root `C:/GitHub/envizzle`. The repo root *is* the skill root — `SKILL.md` at top level, so the repo can be cloned or symlinked straight into `~/.claude/skills/envizzle/`.
- `legacy/` is migration mining source. Nothing shipped may import from it. It is deleted in Task 5.
- The emitted brief must be fully self-contained: the target agent may be any model and sees only that one file. `references/character-recipe.md` is inlined in full, never referenced by path.
- Every file uses LF line endings.
- Commit after every task.

## File Structure

| Path | Responsibility | Status |
|---|---|---|
| `TEMPLATE.md` | Brief skeleton, 34 `{{TOKEN}}` slots, 3 `<!--SECTION:name-->` blocks | exists |
| `package.json` | Manifest, test script | exists, needs script fix |
| `check.mjs` | Validate a brief (no stray tokens/markers) + coherence rules | Task 1, 3 |
| `references/character-recipe.md` | Numeric humanoid spec, inlined into every brief | Task 2 |
| `references/presets.md` | Biomes, archetypes, mechanics, cameras, showcase configs, ambition levels | Task 4 |
| `verify/gates.mjs` | Pure pixel-buffer gate functions | Task 3 |
| `verify/verify_demo.mjs` | Playwright orchestrator | Task 3 |
| `SKILL.md` | Entry point: interview, coherence step, assembly, handoff | Task 5 |
| `prompt_builder.html` | Optional manual form, promoted out of `legacy/` | Task 5 |
| `lib/assemble.mjs` | **Deleted in Task 1** — folded into `check.mjs` | exists |

Five tasks: **1** validator, **2** character recipe, **3** verification, **4** presets, **5** skill + cleanup.

---

### Task 1: Reduce the assembler to a validator

**Files:**
- Create: `check.mjs`
- Delete: `lib/assemble.mjs`
- Delete: `tests/assemble.test.mjs`
- Create: `tests/check.test.mjs`
- Modify: `TEMPLATE.md` (one-character bug fix)
- Modify: `package.json` (test script)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `findUnresolvedTokens(brief: string): string[]` — unique token names still present
  - `findStraySectionMarkers(brief: string): string[]` — leftover `<!--SECTION:x-->` / `<!--/SECTION-->`
  - `findTemplateLiteralLeaks(brief: string): string[]` — `${NAME}` forms, which never substitute
  - `validateBrief(brief: string): { ok: boolean, problems: string[] }`

Claude writes the brief; this validates it. Generation is no longer code's job, so `assemble.mjs`'s substitution and section-stripping go away.

- [ ] **Step 1: Fix the template-literal bug in TEMPLATE.md**

`TEMPLATE.md:66` reads:

```
### 2.3 Wind Field & Terrain State Buffer (${DEFORMATION_TYPE})
```

That is JS template-literal syntax, not the `{{...}}` form used everywhere else — line 71 has the correct `{{DEFORMATION_TYPE}}` directly below it, confirming the typo. As written it leaks the literal text `${DEFORMATION_TYPE}` into every brief with the state-buffer section enabled. Change it to `{{DEFORMATION_TYPE}}`.

- [ ] **Step 2: Write the failing tests**

Create `tests/check.test.mjs`:

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/check.test.mjs`
Expected: FAIL — cannot find `../check.mjs`

- [ ] **Step 4: Write the validator**

Create `check.mjs` at the repo root:

```js
#!/usr/bin/env node
/**
 * Validate an assembled envizzle brief.
 *
 * Claude assembles the brief by reading references/presets.md and filling
 * TEMPLATE.md. This script is the safety net: it catches the mechanical
 * mistakes that are easy to make by hand and invisible to read past.
 *
 * Usage: node check.mjs <brief.md>
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// {{NAME}} and {{NAME — default: hint}}. Name is the leading run of A-Z0-9_.
const TOKEN_RE = /\{\{([A-Z0-9_]+)(?:[^}]*)?\}\}/g;
const SECTION_RE = /<!--\/?SECTION:?[a-z0-9-]*-->/g;
// ${NAME} never substitutes — it is JS template-literal syntax that leaked
// into a markdown template. TEMPLATE.md:66 shipped this bug for months.
const LITERAL_RE = /\$\{([A-Za-z0-9_]+)\}/g;

const uniqueMatches = (text, re, group = 1) =>
  [...new Set([...text.matchAll(re)].map((m) => m[group]))];

/** Token names still unfilled in the brief. */
export function findUnresolvedTokens(brief) {
  return uniqueMatches(brief, TOKEN_RE);
}

/** Section markers that should have been stripped along with their bodies. */
export function findStraySectionMarkers(brief) {
  return [...brief.matchAll(SECTION_RE)].map((m) => m[0]);
}

/** `${NAME}` forms, which look like tokens but never substitute. */
export function findTemplateLiteralLeaks(brief) {
  return uniqueMatches(brief, LITERAL_RE);
}

/** @returns {{ok: boolean, problems: string[]}} */
export function validateBrief(brief) {
  const problems = [];

  const tokens = findUnresolvedTokens(brief);
  if (tokens.length > 0) {
    problems.push(
      `${tokens.length} unresolved token(s): ${tokens.join(', ')}. Fill them, or omit the section that contains them.`,
    );
  }

  const leaks = findTemplateLiteralLeaks(brief);
  if (leaks.length > 0) {
    problems.push(
      `${leaks.length} \${} template-literal leak(s): ${leaks.join(', ')}. These never substitute — rewrite as {{NAME}} and fill them.`,
    );
  }

  const markers = findStraySectionMarkers(brief);
  if (markers.length > 0) {
    problems.push(
      `${markers.length} stray section marker(s): ${[...new Set(markers)].join(', ')}. Delete the marker lines; keep or drop the body deliberately.`,
    );
  }

  return { ok: problems.length === 0, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node check.mjs <brief.md>');
    process.exit(2);
  }
  const { ok, problems } = validateBrief(fs.readFileSync(file, 'utf8'));
  if (ok) {
    console.log(`OK: ${file} has no unresolved tokens, leaks, or stray markers.`);
    process.exit(0);
  }
  console.error(`FAILED: ${file}`);
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
  process.exit(1);
}
```

- [ ] **Step 5: Delete the superseded assembler**

```bash
git rm lib/assemble.mjs tests/assemble.test.mjs
```

`lib/` should now be empty; remove the directory if git leaves it behind.

- [ ] **Step 6: Fix the test script in package.json**

`node --test tests/` fails on this machine. Change the `test` script to:

```json
"test": "node --test tests/*.test.mjs"
```

Remove the `assemble` script if present. Keep `pngjs` and `playwright` as the only devDependencies.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test tests/check.test.mjs`
Expected: PASS, 10 tests. Then confirm the script works: `npm test`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: replace assembler with brief validator

Generation is Claude's job in a skill; code only validates. Drops token
substitution and section stripping, keeps and extends the checks. Adds a
\${} leak detector and fixes TEMPLATE.md:66, which shipped JS
template-literal syntax that could never substitute."
```

---

### Task 2: The character recipe

**Files:**
- Modify: `references/character-recipe.md` (currently a one-line placeholder)
- Test: `tests/character-recipe.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: a standalone markdown document with no tokens, safe to inline verbatim.

This task fixes the bug the whole project exists for. In the reference output, `src/character/player.js:30-77` built a `CylinderGeometry` torso, a `SphereGeometry` head, and three `BoxGeometry` parts — because every system specified with numbers got built, and the character was specified with adjectives.

Mining source: `legacy/BIOME_TECHDEMO_TEMPLATE.md` §2.6 (line ~406) holds the predecessor's character guidance. Read it to see what was there, then write something far more specific. **Do not carry over its line 447**, which reads *"If a rig and locomotion animation cannot be brought to a high standard, prefer a fully cloth- and procedurally driven figure"* — agents took that as permission to skip the rig entirely.

- [ ] **Step 1: Write the failing structural test**

Create `tests/character-recipe.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/character-recipe.test.mjs`
Expected: FAIL — the placeholder file is one line.

- [ ] **Step 3: Write the recipe**

Replace `references/character-recipe.md` entirely. Six parts, with these exact values.

**Part 1 — Skeleton.** A markdown table of 18 bones for a 1.75 m figure, columns `bone | parent | rest position (x, y, z) metres`:

hips `(0, 0.95, 0)`, spine01 `(0, 1.10, 0)`, spine02 `(0, 1.28, 0)`, chest `(0, 1.42, 0)`, neck `(0, 1.52, 0)`, head `(0, 1.62, 0)`, clavicle.L/R `(±0.06, 1.45, 0)`, upperArm.L/R `(±0.19, 1.44, 0)`, forearm.L/R `(±0.19, 1.16, 0)`, hand.L/R `(±0.19, 0.90, 0)`, thigh.L/R `(±0.09, 0.92, 0)`, shin.L/R `(±0.09, 0.50, 0)`, foot.L/R `(±0.09, 0.10, 0)`, toe.L/R `(±0.09, 0.02, 0.14)`.

Segment lengths: upperArm 0.28, forearm 0.26, thigh 0.42, shin 0.40, foot 0.16.

**Part 2 — Geometry.** Lead with the rule in bold: **the character is ONE continuous skinned mesh generated from lofted cross-section rings; it is never an assembly of primitive meshes.** Then:

| Chain | Rings | Radius profile (m) | Ellipse ratio (x:z) |
|---|---|---|---|
| Torso (hips→neck) | 12 | 0.16 → 0.19 → 0.17 → 0.14 | 1.00 → 1.35 |
| Head (neck→crown) | 6 | 0.055 → 0.098 → 0.072 | 0.86 (narrower than deep) |
| Arm (shoulder→wrist) | 8 | 0.055 → 0.040 → 0.032 | 1.00 |
| Hand (wrist→fingertip) | 3 | 0.032 → 0.040 → 0.018 | 0.45 (flat paddle) |
| Leg (hip→ankle) | 10 | 0.085 → 0.055 → 0.038 | 1.10 |
| Foot (ankle→toe) | 4 | 0.038 → 0.045 → 0.030 | 0.62 (wider than tall) |

**Every chain in that table is required.** The torso/arm/leg rows alone leave a figure with no head, no hands, and no feet — and an agent that caps the arm at the wrist and finds spheres forbidden will ship a headless torso. Foot geometry is also load-bearing for Part 5, which blends foot orientation to the terrain normal; there must be a foot to orient.

Ring resolution 12–16 segments (6–8 for hand and foot). Rings stitch into triangle strips; ends capped at the crown, fingertips, and toe tips. Skin weights derived from normalized arc-length position along the chain, blended across a 0.08 m falloff either side of each joint — deterministic, requiring no hand-rigging. Budget ~3–4 k triangles. Explain *why* the ellipse ratio matters: a chest that is as deep as it is wide reads as a barrel, and that single number is much of the difference between a figure and a tube stack.

**Scaling for non-1.75 m archetypes.** Both rest positions *and* ring radii scale by `H / 1.75`, with the archetype's ring-radius multiplier applied on top. Radii must scale too — a 1.45 m figure with a 0.19 m adult chest radius reads as dwarfish rather than short.

**Part 3 — Gait.** State that sliding is prevented by construction, not by discipline:

```js
// Phase advances with GROUND DISTANCE, so stride length equals ground speed
// by construction. Do not blend animation clips.
const strideLength = 0.78 * legLength * (1 + 0.35 * speedNorm);
gaitPhase = (gaitPhase + distanceThisFrame / strideLength) % 1;
```

Stance spans phase 0 → 0.6 and holds the locked world position. Swing spans 0.6 → 1.0 and arcs 0.12 m to predicted touchdown via smoothstep. Per-leg phase offset 0.5. Two-bone analytic IK by law of cosines for hip → knee → ankle, knee pole vector forward — roughly 20 lines, no solver dependency.

**Part 4 — Secondary motion.** Pelvis bob `y -= bobAmplitude * (1 - cos(4π * gaitPhase)) / 2`. Pelvis roll ±3°, shoulders counter-rotate ±5°. Arm swing shoulder pitch `±22° * sin(2π * (gaitPhase + 0.5))`, elbow flex 12–35°. Spine lean into acceleration: chest pitch `clamp(accelAlongForward * 0.04, -8°, +12°)`. Head counter-rotated to hold a level gaze.

**Every length in the gait must derive from `legLength`, not from a literal**, or a short archetype bobs like an adult and over-lifts its feet. At the 1.75 m reference figure `legLength` is 0.82 m, giving:

| Quantity | Reference value | Expressed relative to legLength |
|---|---|---|
| stride length | — | `0.78 * legLength * (1 + 0.35 * speedNorm)` |
| pelvis bob amplitude | 0.035 m | `0.043 * legLength` |
| swing arc height | 0.12 m | `0.146 * legLength` |
| joint weight falloff | 0.08 m | `0.098 * legLength` |

State both columns. Angles (roll, pitch, elbow flex) are scale-invariant and stay as degrees.

**Part 5 — Foot planting.** Give the mechanism, not the goal:

```js
// On touchdown ONLY. During stance nothing writes to plantedPos — a planted
// foot cannot slide because no code path exists that could move it.
const hit = terrainRaycast(footTarget);
plantedPos[leg].copy(hit.point);
plantedNormal[leg].copy(hit.normal);
stateBuffer.addSplat(plantedPos[leg]);   // same call site, cannot desync
audio.footfall(plantedPos[leg]);
```

Foot orientation blends to the terrain normal at 0.7.

**Part 6 — Prohibitions.** Bold and unhedged:

- `BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `CapsuleGeometry`, and `ConeGeometry` are **forbidden** anywhere in character code.
- A character assembled from separate per-body-part meshes is a **defect**, not a stepping stone.
- Omitting legs is permitted **only** when the chosen archetype specifies a hidden lower body **and** cloth reaches the ground.
- There is **no fallback**. If the rig is hard, the rig is still required.

Close with framing: the character occupies 12–18% of frame height at default third-person zoom, uses the scene's shared lighting include, and carries rim light so the silhouette reads against sky.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/character-recipe.test.mjs`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add numeric procedural humanoid recipe

Gives the character the same numeric treatment grass and terrain already
had. Removes the predecessor's escape hatch, which agents read as
permission to skip the rig and ship primitives."
```

---

### Task 3: Verification with teeth

**Files:**
- Create: `verify/gates.mjs`
- Create: `verify/verify_demo.mjs`
- Create: `verify/README.md`
- Create: `tests/fixtures/make-synthetic.mjs`
- Create: `tests/fixtures/real-black-frame.png` (copied)
- Create: `tests/fixtures/real-idle-frame.png` (copied)
- Create: `tests/gates.test.mjs`
- Modify: `check.mjs` (add coherence rules — see Step 8)
- Create: `tests/coherence.test.mjs`

**Interfaces:**
- Produces from `verify/gates.mjs`, all pure over `{ width, height, data: Uint8Array /* RGBA */ }`:
  - `meanLuminance(img): number`
  - `flatFrameRatio(img, bucketCount = 50): number`
  - `changedAreaFraction(a, b, threshold = 0.02): number`
  - `evaluateGates({ frames, cameraDepthM, frameStats }): { pass, failures: string[], info: string[] }`
  - `THRESHOLDS` — frozen constants
- Produces from `check.mjs`: `relativeLuminance(hex)`, `saturation(hex)`, `hexToRgb01(hex)`, `checkCoherence(config): Conflict[]`

The predecessor's `legacy/verify_demo.mjs:133` logged `PASS: Screenshots successfully saved` without inspecting a single pixel — which is how a near-black frame with the camera clipped inside a spire passed as success.

**Controller decision, already made — do not gate on performance.** The brief targets 90 FPS, but verification runs headless, often on software rendering, where nothing reaches it (the reference run measured 60.1 FPS / 16.6 ms). Frame time measured headless says nothing about the target machine. `evaluateGates` reports median and p99 in an `info` array and they **never** contribute to `failures`. Image gates stay hard.

- [ ] **Step 1: Install dependencies**

Run: `npm install`
Expected: `pngjs` and `playwright` present.

- [ ] **Step 2: Copy the real known-bad fixtures**

The reference output is the demo built from the predecessor template by Gemini Flash 3.6. Set `REFERENCE_OUTPUT` to its path — ask the controller if you do not have it.

```bash
mkdir -p tests/fixtures
cp "$REFERENCE_OUTPUT/screenshots/milestone_locomotion.png" tests/fixtures/real-black-frame.png
cp "$REFERENCE_OUTPUT/screenshots/milestone_idle.png"       tests/fixtures/real-idle-frame.png
```

`real-black-frame.png` is the frame the old script passed.

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

/** A grey field with a horizontal gradient, so it is not flat. */
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
 * Copy an image and paint a centred square covering `fraction` of the area.
 * Simulates "character present" vs "character hidden".
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

- [ ] **Step 4: Write the failing gate tests**

Create `tests/gates.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import {
  meanLuminance, flatFrameRatio, changedAreaFraction, evaluateGates, THRESHOLDS,
} from '../verify/gates.mjs';
import { solid, gradient, withBlob } from './fixtures/make-synthetic.mjs';

const decode = (name) => {
  const png = PNG.sync.read(fs.readFileSync(`tests/fixtures/${name}`));
  return { width: png.width, height: png.height, data: png.data };
};
const okStats = { medianMs: 11, p99Ms: 15, samples: 600 };

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
  const measured = changedAreaFraction(base, withBlob(base, 0.10));
  assert.ok(Math.abs(measured - 0.10) < 0.02, `measured ${measured}`);
});

test('changedAreaFraction is ~0 for identical images', () => {
  const base = gradient(64, 64);
  assert.ok(changedAreaFraction(base, base) < 0.001);
});

test('changedAreaFraction rejects mismatched sizes', () => {
  assert.throws(() => changedAreaFraction(gradient(8, 8), gradient(16, 16)), /different size/i);
});

// --- The regression the rewrite exists for -------------------------------

test('the real black frame from the reference run FAILS the gates', () => {
  const result = evaluateGates({
    frames: [{ name: 'locomotion', image: decode('real-black-frame.png') }],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false, 'the old script passed this frame; the new one must not');
  assert.ok(
    result.failures.some((f) => /luminance|flat/i.test(f)),
    `expected a luminance or flat-frame failure, got: ${result.failures.join(' | ')}`,
  );
});

// --- Character visibility ------------------------------------------------

test('a character occupying 8% of frame passes', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: withBlob(base, 0.08), imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, true, result.failures.join(' | '));
});

test('an invisible character fails', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: base, imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /character/i.test(f)));
});

test('a character filling half the frame fails (camera too close)', () => {
  const base = gradient(300, 300);
  const result = evaluateGates({
    frames: [{ name: 'idle', image: withBlob(base, 0.5), imageWithoutCharacter: base }],
    cameraDepthM: 5,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
});

test('a camera inside geometry fails', () => {
  const result = evaluateGates({
    frames: [{ name: 'idle', image: gradient(64, 64) }],
    cameraDepthM: 0.05,
    frameStats: okStats,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => /camera/i.test(f)));
});

// --- Performance is reported, never gated -------------------------------

test('terrible frame times are reported but do not fail the run', () => {
  const result = evaluateGates({
    frames: [{ name: 'idle', image: gradient(64, 64) }],
    cameraDepthM: 5,
    frameStats: { medianMs: 240, p99Ms: 900, samples: 100 },
  });
  assert.equal(result.pass, true, `perf must not gate; failures: ${result.failures.join(' | ')}`);
  assert.ok(result.info.some((i) => /240/.test(i)), 'median frame time not reported');
  assert.ok(result.info.some((i) => /900/.test(i)), 'p99 frame time not reported');
});

test('THRESHOLDS carries no frame-time gate', () => {
  const keys = Object.keys(THRESHOLDS).join(' ');
  assert.doesNotMatch(keys, /FrameMs|frameMs/, 'frame time must not be a threshold');
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `node --test tests/gates.test.mjs`
Expected: FAIL — cannot find `../verify/gates.mjs`

- [ ] **Step 6: Implement the gates**

Create `verify/gates.mjs`:

```js
/**
 * Pure image gates. Every function takes {width, height, data} where data is
 * RGBA bytes, so unit tests use synthetic buffers and the browser run passes
 * Playwright screenshots through the same code.
 *
 * Frame time is REPORTED, never gated: verification runs headless, often on
 * software rendering, so a frame time here says nothing about the target
 * machine. Gating on it would fail every honest run.
 */

export const THRESHOLDS = Object.freeze({
  meanLuminanceMin: 0.12,
  meanLuminanceMax: 0.85,
  flatFrameMaxRatio: 0.70,
  characterAreaMin: 0.03,
  characterAreaMax: 0.20,
  cameraMinDepthM: 0.30,
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
 * @returns {{pass: boolean, failures: string[], info: string[]}}
 */
export function evaluateGates({ frames, cameraDepthM, frameStats }) {
  const failures = [];
  const info = [];

  for (const { name, image, imageWithoutCharacter } of frames) {
    const lum = meanLuminance(image);
    info.push(`[${name}] mean luminance ${lum.toFixed(3)}`);
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
      info.push(`[${name}] character covers ${(area * 100).toFixed(1)}% of frame`);
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

  // Reported only. See the module comment.
  info.push(
    `frame time: median ${frameStats.medianMs.toFixed(1)} ms, p99 ${frameStats.p99Ms.toFixed(1)} ms over ${frameStats.samples} samples (informational — headless timing is not gated)`,
  );

  return { pass: failures.length === 0, failures, info };
}
```

- [ ] **Step 7: Run gate tests and calibrate**

Run: `node --test tests/gates.test.mjs`
Expected: PASS, 12 tests.

Then print the real fixtures' actual statistics and record them in your report:

```bash
node -e "
import('pngjs').then(async ({PNG}) => {
  const g = await import('./verify/gates.mjs');
  const fs = await import('node:fs');
  for (const f of ['real-black-frame.png','real-idle-frame.png']) {
    const p = PNG.sync.read(fs.readFileSync('tests/fixtures/'+f));
    console.log(f, 'lum', g.meanLuminance(p).toFixed(4), 'flat', g.flatFrameRatio(p).toFixed(4));
  }
});
"
```

The black frame must fail. If the idle frame *also* fails the luminance floor, **do not lower the threshold to accommodate it** — report the numbers and note that the reference idle frame is itself a dark, mediocre frame. That is a finding, not a calibration error.

- [ ] **Step 8: Add coherence rules to check.mjs**

Append colour maths and rules to `check.mjs`. Palette schema used by `references/presets.md`:

```js
palette: [ { role: 'sky', hex: '#a8c8e8', area: 'large' }, ... ]
// area: 'large' (sky, terrain base, vegetation base) | 'medium' | 'accent'
```

```js
// ---------------------------------------------------------------- colour ---

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
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

// ------------------------------------------------------------- coherence ---

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
    (p) => relativeLuminance(p.hex) >= LIGHT_ANCHOR_MIN_LUM
        && saturation(p.hex) <= LIGHT_ANCHOR_MAX_SAT,
  );
  if (palette.length > 0 && !hasAnchor) {
    out.push(conflict(
      'light-anchor', 'error',
      `No light anchor: no colour has luminance >= ${LIGHT_ANCHOR_MIN_LUM} AND saturation <= ${LIGHT_ANCHOR_MAX_SAT}. Saturated neons do not count.`,
      'Add a desaturated bright tone — warm off-white, pale sky tint, bleached stone (e.g. #f2ece0, #d8d0b8) — at large or medium area.',
    ));
  }

  // R2 — value tiers. Needs something dark, mid, and light.
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
        'Add one colour per missing tier so shadow, midtone, and highlight separate.',
      ));
    }
  }

  // R3 — large-area luminance. Painterly reads as beautiful because it is
  // high-key; the colours covering most of the screen must carry light.
  const large = palette.filter((p) => p.area === 'large');
  if (config.paradigm === 'painterly' && large.length > 0) {
    const mean = large.reduce((s, p) => s + relativeLuminance(p.hex), 0) / large.length;
    if (mean < LARGE_AREA_MIN_MEAN_LUM) {
      out.push(conflict(
        'large-area-luminance', 'error',
        `Painterly paradigm with mean large-area luminance ${mean.toFixed(3)} (floor ${LARGE_AREA_MIN_MEAN_LUM}). Sky, terrain, and vegetation carry most of the frame; dark values there produce muddy frames.`,
        'Raise sky/terrain/vegetation into the 0.30-0.70 range, or switch to photoreal where a low-key palette is supportable.',
      ));
    }
  }

  // R4 — accent cap. Emissive should punctuate, not dominate.
  if (palette.length > 0) {
    const accents = palette.filter((p) => p.area === 'accent').length;
    const fraction = accents / palette.length;
    if (fraction > ACCENT_MAX_FRACTION) {
      out.push(conflict(
        'accent-cap', 'warn',
        `${accents} of ${palette.length} entries are accents (${(fraction * 100).toFixed(0)}%, cap ${ACCENT_MAX_FRACTION * 100}%). Emissive should stay under ~15% of screen area.`,
        'Demote some accents to medium area, or fold them into one accent hue used sparingly.',
      ));
    }
  }

  // R5 / R6 — techniques implied by paradigm + zero assets.
  const behaviours = (config.materialBehaviours ?? '').toLowerCase();
  if (config.paradigm === 'photoreal' && config.assetStrategy === 'zero-asset'
      && !/multi-scale|multiscale/.test(behaviours)) {
    out.push(conflict(
      'photoreal-multiscale-normals', 'error',
      'Photoreal with zero assets requires multi-scale procedural normals; none declared.',
      'Declare multi-scale procedural normal detail (three octaves minimum) so the surface reads close, mid, and far.',
    ));
  }
  if (config.paradigm === 'painterly' && config.assetStrategy === 'zero-asset') {
    const hasTable = /palette table/.test(behaviours);
    const hasRamp = /cel ramp|toon ramp|cel-shad/.test(behaviours);
    if (!hasTable || !hasRamp) {
      out.push(conflict(
        'painterly-palette-table', 'error',
        `Painterly with zero assets requires both a palette table and a cel ramp; declared ${hasTable ? 'a palette table' : 'no palette table'} and ${hasRamp ? 'a cel ramp' : 'no cel ramp'}.`,
        'Declare a single-source sRGB palette table converted to linear on load, plus a 2-step cel ramp with shadow-boundary wobble.',
      ));
    }
  }

  return out;
}
```

- [ ] **Step 9: Write and run the coherence tests**

Create `tests/coherence.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeLuminance, saturation, checkCoherence } from '../check.mjs';

// Verified by hand against the WCAG formula.
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

test('hexToRgb01 rejects malformed hex', async () => {
  const { hexToRgb01 } = await import('../check.mjs');
  assert.throws(() => hexToRgb01('#fff'), /#rrggbb/);
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
  // Regression guard: a naive "must contain a bright colour" rule PASSES this
  // config, because #00ffcc has luminance 0.76. The anchor must be desaturated.
  const rules = checkCoherence(REFERENCE_BAD).map((c) => c.rule);
  assert.ok(rules.includes('light-anchor'), `rules were: ${rules.join(', ')}`);
});

test('flags the reference config on large-area luminance', () => {
  assert.ok(checkCoherence(REFERENCE_BAD).map((c) => c.rule).includes('large-area-luminance'));
});

test('every conflict carries a usable fix and a valid severity', () => {
  for (const c of checkCoherence(REFERENCE_BAD)) {
    assert.ok(c.fix.length > 10, `rule ${c.rule} has no usable fix text`);
    assert.ok(['error', 'warn'].includes(c.severity));
  }
});

test('a coherent high-key painterly palette passes clean', () => {
  assert.deepEqual(checkCoherence({
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
  }), []);
});

test('photoreal zero-asset must declare multi-scale normals', () => {
  const rules = checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'A stock PBR material',
    palette: [
      { role: 'sky',    hex: '#b9d2ea', area: 'large' },
      { role: 'snow',   hex: '#eef2f6', area: 'large' },
      { role: 'rock',   hex: '#5d5a55', area: 'medium' },
      { role: 'shadow', hex: '#31445e', area: 'medium' },
      { role: 'night',  hex: '#0a0d12', area: 'medium' },
    ],
  }).map((c) => c.rule);
  assert.ok(rules.includes('photoreal-multiscale-normals'));
});

test('accent-heavy palettes are capped', () => {
  const rules = checkCoherence({
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'multi-scale normals',
    palette: [
      { role: 'sky',  hex: '#a8c8e8', area: 'large' },
      { role: 'base', hex: '#f2ece0', area: 'large' },
      { role: 'dark', hex: '#0a0d12', area: 'medium' },
      { role: 'a',    hex: '#ff0066', area: 'accent' },
      { role: 'b',    hex: '#00ffcc', area: 'accent' },
      { role: 'c',    hex: '#ffaa00', area: 'accent' },
      { role: 'd',    hex: '#ff00ff', area: 'accent' },
    ],
  }).map((c) => c.rule);
  assert.ok(rules.includes('accent-cap'));
});

test('an empty palette produces no palette conflicts', () => {
  assert.deepEqual(
    checkCoherence({ paradigm: 'painterly', assetStrategy: 'other', materialBehaviours: '' })
      .map((c) => c.rule),
    [],
  );
});
```

Run: `node --test tests/coherence.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 10: Write the Playwright orchestrator**

Create `verify/verify_demo.mjs`. Reuse what worked in `legacy/verify_demo.mjs` — the directory audit, `npx vite build`, dev-server spawn, and Playwright launch flags — and add the gates.

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

for (const rel of ['index.html', 'package.json', 'vite.config.js', 'DECISIONS.md', 'PERF.md', 'src/main.js']) {
  if (fs.existsSync(path.join(targetDir, rel))) pass(`found ${rel}`);
  else fail(`missing required path: ${rel}`);
}

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
  const playwright = await import('playwright');
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

    // Without the hook nothing below is checkable.
    try {
      await page.waitForFunction('window.__demo && window.__demo.ready === true', { timeout: 30000 });
      pass('window.__demo hook present and ready');
    } catch {
      fail('window.__demo hook missing or never became ready — see the brief\'s verification-hook section. Cannot verify.');
      return;
    }

    if (pageErrors.length === 0) pass('zero console/runtime errors');
    else fail(`runtime errors: ${pageErrors.join(' | ')}`);

    const frames = [];
    const shotDir = path.join(targetDir, 'screenshots');
    fs.mkdirSync(shotDir, { recursive: true });

    for (const pose of ['idle', 'locomotion', 'mechanic']) {
      await page.evaluate((p) => window.__demo.setPose(p), pose);
      await page.waitForTimeout(1200);

      const withCharBuf = await page.screenshot();
      await page.evaluate(() => window.__demo.setCharacterVisible(false));
      await page.waitForTimeout(300);
      const withoutCharBuf = await page.screenshot();
      await page.evaluate(() => window.__demo.setCharacterVisible(true));

      frames.push({
        name: pose,
        image: toImage(withCharBuf),
        imageWithoutCharacter: toImage(withoutCharBuf),
      });
      fs.writeFileSync(path.join(shotDir, `milestone_${pose}.png`), withCharBuf);
    }

    const cameraDepthM = await page.evaluate(() => window.__demo.cameraNearestDepth());
    const frameStats = await page.evaluate(() => window.__demo.frameStats());
    const result = evaluateGates({ frames, cameraDepthM, frameStats });

    result.info.forEach((i) => console.log(`INFO: ${i}`));
    if (result.pass) pass('all image gates passed');
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

Note the screenshot is written from the original PNG buffer, not re-encoded from the decoded image — simpler and lossless.

- [ ] **Step 11: Write verify/README.md**

Document how to run it, the `window.__demo` contract, each gate and threshold, why frame time is informational, and why the character-diff gate cannot be satisfied without a real character.

- [ ] **Step 12: Confirm the orchestrator fails correctly on a demo with no hook**

Run against the reference output (ask the controller for `$REFERENCE_OUTPUT`):
`node verify/verify_demo.mjs "$REFERENCE_OUTPUT"`
Expected: exit code 1 with `window.__demo hook missing` among the failures. The reference output predates the hook, so this is the correct result and proves the gate is wired rather than vacuously passing.

- [ ] **Step 13: Run the full suite and commit**

```bash
npm test
git add -A
git commit -m "feat: add image verification gates and coherence rules

Gates reject near-black frames, blank frames, and missing characters via a
with/without-character diff. The predecessor logged PASS after saving
screenshots without inspecting any pixel. Frame time is reported, not
gated: headless timing says nothing about the target machine.

Coherence rules catch the painterly-over-near-black contradiction. The
light-anchor rule requires a DESATURATED bright tone, because a naive
bright-colour check passes neon cyan at luminance 0.76."
```

---

### Task 4: The presets

**Files:**
- Create: `references/presets.md`
- Create: `tests/presets.test.mjs`

**Interfaces:**
- Consumes: `checkCoherence` from `check.mjs` (Task 3).
- Produces: one markdown file Claude reads during the interview. It is documentation, not code — but its palettes are machine-checkable, so it carries them in fenced `json` blocks the test can parse.

Mining source: `legacy/BIOME_TECHDEMO_TEMPLATE.md` and `legacy/TEMPLATE_GUIDE.md` hold the predecessor's biome examples and its paradigm comparison table. Read both before writing.

- [ ] **Step 1: Write the failing tests**

Create `tests/presets.test.mjs`. The tests parse the markdown, so the format must be predictable: every biome section carries a fenced ```json block holding `{ "paradigm": ..., "palette": [...], "materialBehaviours": "..." }`.

```js
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
  // Each biome section must state scales in metres and amplitudes.
  const biomeSections = md.split(/^##\s+/m).filter((s) => /noise|TERRAIN_NOISE/i.test(s));
  assert.ok(biomeSections.length >= 6, 'fewer than six biomes describe noise layers');
  for (const s of biomeSections) {
    const name = s.split('\n')[0];
    assert.match(s, /\d+\s*m\b/, `${name}: noise layers lack metre scales`);
    assert.match(s, /amp/i, `${name}: noise layers lack amplitudes`);
  }
});

test('archetypes parameterise the shared rig and never name a primitive', () => {
  const section = md.split(/^##\s+/m).find((s) => /^Character archetypes/i.test(s));
  assert.ok(section, 'no "Character archetypes" section');
  for (const prim of ['BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'CapsuleGeometry']) {
    assert.doesNotMatch(section, new RegExp(prim), `archetypes mention ${prim}`);
  }
  assert.match(section, /height/i);
  assert.match(section, /hidden lower body/i);
  assert.match(section, /\d+\s*[x×]\s*\d+/, 'no Verlet grid dimensions');
});

test('at least five archetypes, five mechanics, four camera modes', () => {
  const count = (heading, min) => {
    const section = md.split(/^##\s+/m).find((s) => s.toLowerCase().startsWith(heading));
    assert.ok(section, `no "${heading}" section`);
    const rows = section.split('\n').filter((l) => /^\s*###\s+/.test(l));
    assert.ok(rows.length >= min, `${heading}: found ${rows.length}, need ${min}`);
  };
  count('character archetypes', 5);
  count('centrepiece mechanics', 5);
  count('camera', 4);
});

test('showcase configs are whole and never to be mixed', () => {
  const section = md.split(/^##\s+/m).find((s) => /^Showcase configs/i.test(s));
  assert.ok(section, 'no "Showcase configs" section');
  assert.match(section, /never mix|do not mix|as a whole/i);
  const entries = section.split('\n').filter((l) => /^\s*###\s+/.test(l));
  assert.ok(entries.length >= 6, `found ${entries.length} showcase configs, need 6`);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/presets.test.mjs`
Expected: FAIL — `references/presets.md` does not exist.

- [ ] **Step 3: Write references/presets.md**

Structure, in this order. Section headings are load-bearing — the tests match on them.

**`## Ambition levels`** — a table. `slice` (default): terrain, material, character, one mechanic, atmosphere. `showcase`: adds vegetation, wind field, state buffer, audio, atmospheric life. `everything`: adds weather, water, architecture, destructibility. State that unselected `<!--SECTION:name-->` blocks are deleted from the brief entirely, markers and all, and that `slice` is the default because a one-shot collapses under a dozen systems. Map each level to the section names in `TEMPLATE.md`: `vegetation`, `state-buffer`, `audio`.

**`## Biomes`** — six `###` subsections: Alpine Snow, Ghibli Valley, Dune Desert, Ocean Shelf, Volcanic, Night City. Each carries prose token values (`PRIMARY_ENVIRONMENT`, `PRIMARY_MATERIAL_NAME`, `NAIVE_DEFAULT`, `TERRAIN_PHILOSOPHY_SENTENCE`, `TERRAIN_NOISE_LAYERS`, `TERRAIN_LANDMARKS`, `FAR_FIELD_TREATMENT`, `MATERIAL_BEHAVIOURS`, `STATE_BUFFER_CHANNELS`, `DEFORMATION_TYPE`, `DEFORMATION_MARKS`, `RECOVERY_MECHANISM`, `RECOVERY_OUTCOME`, `FOOT_INTERACTION`, `AUDIO_ENGINE_SPEC`, `ATMOSPHERIC_LIFE_SPEC`, `GRASS_SYSTEM_SPEC`, `WIND_FIELD_ARCH`, `STATE_BUFFER_COVERAGE`, `STATE_BUFFER_TEXEL_SIZE`) **plus** a fenced `json` block with `paradigm`, `materialBehaviours`, and `palette`.

`TERRAIN_NOISE_LAYERS` must give scale in metres and amplitude for every layer — that specificity is why terrain came back good while the character did not.

Constraints, or the coherence tests fail:
- Painterly biomes (Ghibli Valley) need mean large-area luminance ≥ 0.30, and `materialBehaviours` containing the literal substrings `palette table` and `cel ramp`.
- Photoreal biomes need `materialBehaviours` containing `multi-scale`.
- Every palette needs a desaturated light anchor (luminance ≥ 0.55, saturation ≤ 0.35), all three value tiers, and accents ≤ 35% of entries.
- **Volcanic and Night City are the deliberate low-key cases.** Make them `photoreal`, so the large-area rule does not apply, and still give each a desaturated light anchor — ash-lit steam `#e8dcc8` for Volcanic, wet-road sheen `#c9d4dc` for Night City. These two teach a disciplined dark scene, which is what the reference config failed at.

**`## Character archetypes`** — at least five `###` entries: Robed Mage, Traveller Coat, Armored Soldier, Desert Nomad, Void Wanderer. Each states rig parameters (height in metres, ring-radius scale, whether the lower body is hidden), `CHARACTER_DESCRIPTION`, `CLOTH_PANELS` with Verlet grid dimensions like `36x12 reconstructed to 72x32`, cloth shading requirements, and head covering. Open the section by stating that archetypes are **parameters on the single rig in `character-recipe.md`**, never alternative bodies. Never name a primitive geometry.

Void Wanderer is the corrected version of the reference output's character: hidden lower body with a ground-reaching mantle, so "no legs" is a deliberate silhouette rather than an excuse.

**`## Centrepiece mechanics`** — at least five `###` entries: Surf/Carve, Flight/Glide, Beam Cannon, Grapple Swing, Summon Vehicle. Each gives `CENTREPIECE_MECHANIC`, `CENTREPIECE_INPUT`, `CENTREPIECE_DESCRIPTION` naming which state-buffer channels it writes, and three distinct ability names.

**`## Camera modes`** — at least four `###` entries: Third Person, First Person, Cinematic, XR. Each states framing, FOV behaviour, and what the character must look good from. XR must note the character is seen at arm's length, so proportions matter, not just silhouette.

**`## Showcase configs`** — six `###` entries, each naming its biome, archetype, mechanic, camera, ambition level, engine/shader choice, and one line on why it reads as AAA: Alpine Dawn, Hoshi-no-Tani, Dune Sea, Tidal Shelf, Emberfall, Neon Monsoon. At least one at `slice`.

Open the section with the rule: **pick a showcase config as a whole; never mix pieces across configs.** Explain why — the reference config paired a painterly paradigm with a near-black palette, and recombination is how that happens.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/presets.test.mjs`
Expected: PASS, 10 tests. If the coherence test fails on a palette you wrote, fix the palette — do not weaken the rule.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add preset library

Six biomes, five archetypes, five mechanics, four camera modes, six
showcase configs, three ambition levels. Palettes live in fenced json so
the coherence rules can be asserted against every shipped preset.

Volcanic and Night City are deliberately low-key photoreal cases that
demonstrate a disciplined dark scene."
```

---

### Task 5: SKILL.md, README, and cleanup

**Files:**
- Create: `SKILL.md`
- Create: `tests/skill-md.test.mjs`
- Move: `legacy/prompt_builder.html` → `prompt_builder.html`
- Delete: `legacy/` (remaining four files)
- Modify: `README.md`

- [ ] **Step 1: Confirm the whole suite passes before deleting anything**

Run: `npm test`
Expected: PASS across `check`, `character-recipe`, `gates`, `coherence`, `presets`. If anything fails, stop — `legacy/` is still the only copy of some content.

- [ ] **Step 2: Write the failing tests**

Create `tests/skill-md.test.mjs`:

```js
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

test('documents the pick-for-me path and forbids mixing presets', () => {
  assert.match(skill, /pick for me/i);
  assert.match(skill, /never mix|do not mix|as a whole/i);
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
  for (const gone of ['lib/assemble.mjs', 'legacy/', 'install.mjs']) {
    assert.doesNotMatch(skill, new RegExp(gone.replace(/[/.]/g, '\\$&')), `references removed ${gone}`);
  }
});
```

- [ ] **Step 3: Write SKILL.md**

Frontmatter:

```markdown
---
name: envizzle
description: Use when the user wants to one-shot a visually impressive real-time graphics tech demo or game — writes a self-contained implementation brief with a numeric procedural character recipe, curated biome and archetype presets, coherence-checked palettes, and hardened visual verification. Triggers on "one-shot a game", "visually stunning demo", "tech demo brief", "make something that looks AAA".
---
```

Body, in order:

1. **What this produces** — one `<PROJECT>_TECHDEMO_PROMPT.md`, plus a copy of `verify/` and a short `HANDOFF.md`. Self-contained, because the target agent may be any model and sees only that file.

2. **Step 1: Choose a route.** Three: *pick for me* (select ONE showcase config from `references/presets.md` whole — never mix pieces across configs, since recombination is what pairs a painterly paradigm with a near-black palette); *start from a showcase config and adjust*; *fully custom*.

3. **Step 2: The interview** (custom route), one question at a time, in order: ambition level → biome → archetype → mechanic → camera → optional systems. Read the valid names from `references/presets.md`. Default ambition is `slice`.

4. **Step 3: Coherence check.** Extract the chosen palette and paradigm, run the rules in `check.mjs` (`checkCoherence`), and report every conflict with its message and suggested fix. Ask the user to accept or override. Record overrides in the brief under a `## Deliberate Deviations` heading so the target agent knows the choice was intentional.

5. **Step 4: Write the brief.** Fill `TEMPLATE.md` from the chosen presets. Inline `references/character-recipe.md` **in full, verbatim**, at the `{{CHARACTER_RECIPE}}` slot. Delete `<!--SECTION:name-->` blocks not enabled by the ambition level — markers and bodies both. Then validate: `node check.mjs <PROJECT>_TECHDEMO_PROMPT.md`. Fix anything it reports before handing over.

6. **Step 5: Hand off.** Copy `verify/` next to the target project. Write `HANDOFF.md` naming which agent gets the brief and telling the user to run `node verify/verify_demo.mjs .` when the agent reports done.

7. **The character rule** — short and prominent: the recipe is non-negotiable and inlined verbatim, because prose character specs produce primitive-assembled scarecrows. Cite the concrete failure: a cylinder torso, sphere head, and three boxes.

8. **Reference index** — a short table pointing at `references/presets.md` sections and `references/character-recipe.md`.

- [ ] **Step 4: Run the skill tests**

Run: `node --test tests/skill-md.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Verify no shipped file imports from legacy/**

Run: `grep -rn "legacy/" check.mjs verify/ SKILL.md TEMPLATE.md references/ tests/ || echo clean`
Expected: `clean`.

- [ ] **Step 6: Promote the prompt builder and delete the rest of legacy/**

`prompt_builder.html` is not superseded — it is the optional manual path, and only sits in `legacy/` because that is where the migration put it.

```bash
git mv legacy/prompt_builder.html prompt_builder.html
git rm "legacy/BIOME_TECHDEMO_TEMPLATE.md" "legacy/TEMPLATE_GUIDE.md" "legacy/TEMPLATE.md" "legacy/verify_demo.mjs"
```

- [ ] **Step 7: Update README.md**

Fix the layout table: remove `lib/`, `install.mjs`, and `legacy/`; add `check.mjs`, `references/presets.md`, `prompt_builder.html`. Replace the Status section — implementation is complete. Replace the install instructions: there is no `install.mjs`; clone or symlink the repo to `~/.claude/skills/envizzle/`. Add a recovery note:

```markdown
The original prompt templates this skill was distilled from
(`BIOME_TECHDEMO_TEMPLATE.md`, `TEMPLATE.md`, `TEMPLATE_GUIDE.md`,
`verify_demo.mjs`) lived in `legacy/` during the migration and were removed once
their content was mined. Recover any with:

    git log --diff-filter=D --name-only
    git show <commit>^:legacy/<file>
```

- [ ] **Step 8: Full suite, then commit**

```bash
npm test
git add -A
git commit -m "feat: add SKILL.md and retire migration sources

SKILL.md is the entry point: route, interview, coherence check, write,
validate, hand off. Content from legacy/ is now distilled into
references/ and check.mjs, so the mining sources are removed;
prompt_builder.html is promoted to root as the optional manual path."
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| Numeric character recipe, all six parts + prohibitions | 2 |
| Escape hatch deleted | 2 (asserted by test) |
| Coherence rules, incl. desaturated light anchor | 3 |
| Reference config flagged | 3 (asserted directly) |
| Ambition dial, sections omitted not blanked | 4 (levels), 5 (SKILL.md instructs), 1 (validator catches stray markers) |
| Biomes with numeric noise layers | 4 |
| Archetypes as rig parameters | 4 |
| Mechanics, cameras, optional systems | 4 |
| Showcase configs, pick-for-me selects whole | 4, 5 |
| `window.__demo` hook mandated | already in `TEMPLATE.md` §6; enforced in 3 |
| Gates: luminance, flat-frame, character diff, camera depth | 3 |
| Perf reported not gated | 3 (controller decision, asserted by test) |
| Retake loop on failure | 3 (exit 1 + explicit instruction) |
| Brief validated before handoff | 1, 5 |
| Repo root = skill root, symlinkable | 5 (README) |
| `prompt_builder.html` kept unchanged | 5 (promoted, contents untouched) |
| Legacy deleted after mining | 5 (gated on suite passing) |

**Dropped from the previous plan, deliberately:** preset `.mjs` modules (now markdown), the token-substituting assembler and its CLI (Claude assembles; `check.mjs` validates), showcase-config resolution code, and `install.mjs` (clone or symlink instead). None carried requirements that the lean shape loses.

**Placeholder scan:** Tasks 2 and 4 specify content structure plus exact required values rather than transcribable prose, because they produce documents, not code. Every structural requirement has a corresponding assertion, so an incomplete document fails rather than passing silently.

**Type consistency:** `checkCoherence(config)` returns `{rule, severity, message, fix}` in Task 3 and is destructured on those keys in Tasks 3 and 4. Palette entries are `{role, hex, area}` in both the rules and the presets. `evaluateGates({frames, cameraDepthM, frameStats})` returns `{pass, failures, info}` in Task 3 and is consumed on those keys by the orchestrator in the same task. Frames carry `{name, image, imageWithoutCharacter}` in gates, tests, and orchestrator alike. `validateBrief` returns `{ok, problems}` in Task 1 and is used by the CLI in the same file.
