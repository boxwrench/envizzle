---
name: envizzle
description: Use when the user wants a visually impressive real-time graphics tech demo, environment showcase, movement prototype, or visual vertical slice. Writes a self-contained implementation brief with a numeric procedural character recipe, curated biome and archetype presets, coherence-checked palettes, and visual verification. Do not use for a complete game requiring progression, content systems, or production gameplay architecture. Triggers on "visually stunning demo", "tech demo brief", "graphics vertical slice", and "make something that looks AAA".
---

# envizzle

## What this produces

Five artefacts, written into the user's target project directory:

| Artefact | What it is |
|---|---|
| `<PROJECT>_TECHDEMO_PROMPT.md` | The brief. One self-contained Markdown file. **This is the product.** |
| `ENVIZZLE_BUILD.json` | Versioned machine-readable build contract generated from the same validated assembly result as the brief. |
| `ENVIZZLE_EVIDENCE.json` | Empty/incomplete milestone evidence template for screenshots, console findings, performance, weaknesses, and corrections. |
| `verify/` | A copy of this skill's `verify/` directory (`verify_demo.mjs`, `gates.mjs`, `README.md`). |
| `HANDOFF.md` | Handoff, contract, evidence, and three-milestone visual self-review instructions. |

The brief must be **self-contained**. The agent that builds from it may be any
model in any tool, and it will see that one file and nothing else. It cannot open
the reference files, it cannot follow a link, and it cannot ask you a
question. Anything the builder needs is pasted into the brief, in full.

Never hand over a brief containing an unfilled `{{TOKEN}}`, a `<!--SECTION:...-->`
marker, a `${...}` form, or a "TODO". `node check.mjs` exists to catch exactly
these, and Step 4 runs it.

**Files this skill reads** (all paths relative to the skill root):

- `references/modes.md` — creative modes (freedom budgets) and ambition levels (section inclusions).
- `references/biomes.md` — six biomes, 19 tokens each, `FOOT_INTERACTION`, machine-checkable palettes.
- `references/archetypes.md` — five character archetypes as rig parameter sets, cloth panels, shading.
- `references/mechanics.md` — five centrepiece mechanics, state-buffer writes, secondary abilities.
- `references/cameras.md` — four camera modes, two supported rendering profiles.
- `references/showcases.md` — six canonical showcase configurations.
- `references/character-recipe.md` — the numeric humanoid spec, inlined into every brief.
- `references/assembly.md` — assembly specification schema, creative input fields, mechanically derived fields, CLI usage, exit codes, and safe overwrite behavior.
- `references/build-contract.md` — deterministic build contract, milestone workflow, evidence shape, and incomplete verification semantics.
- `references/benchmarking.md` — benchmark harness, 8-case registry, bundle preparation, automated verification, human visual rubric, result collection, and summary generation.
- `TEMPLATE.md` — the brief skeleton: 38 `{{TOKEN}}` slots and three `<!--SECTION:name-->` blocks.
- `selection.mjs` — `validateSelection` and `formatStateChannelContract` (CLI: `node selection.mjs`).
- `check.mjs` — `validateBrief` and `checkCoherence` (CLI: `node check.mjs`).
- `assemble.mjs` — deterministic brief assembler and safe output bundle writer (CLI: `node assemble.mjs`).
- `build-contract.mjs` — versioned contract/evidence schema and Markdown/JSON agreement validation.
- `benchmark.mjs` — benchmark case registry, bundle preparation, result collection, and comparative summary generation (CLI: `node benchmark.mjs`).
- `verify/verify_demo.mjs` — the post-build visual verifier.

---

## Step 1 — Choose a creative mode

Ask this first, before anything else:

> Which creative mode would you like to use?
> 1. **Proven** — Use one showcase configuration intact. Add no independent novelty behavior. Creativity remains in composition, timing, shader implementation, and polish.
> 2. **Signature** *(default)* — Use one showcase configuration intact. Invent exactly one bounded Signature Moment. This is the default when you say "pick for me" or do not select a mode.
> 3. **Experimental** — Permit controlled recombination (at most one changed major axis from a showcase) or the fully custom interview. Never selected automatically; requires explicit choice.

After Proven or Signature is selected, ask whether the user wants Envizzle to choose the showcase config ("pick for me") or whether they want to select one.

For Experimental, ask whether to:
- Start from a named showcase and modify it (at most 1 changed major axis: ambition, biome, archetype, mechanic, or camera), or
- Use the fully custom interview.

At any later question, "pick for me" means:
- Use Signature mode.
- Select one whole compatible showcase configuration.
- Treat the creative spark as "surprise me."
- Invent one bounded Signature Moment.

Do not maintain a second, competing route-number system.

### Progressive reference loading

Load reference files progressively as needed during selection and assembly:
- Read `references/modes.md` and `references/showcases.md` during mode and route selection.
- For a whole showcase (Proven or Signature), load only the referenced biome (from `references/biomes.md`), archetype (from `references/archetypes.md`), mechanic (from `references/mechanics.md`), camera/profile (from `references/cameras.md`), and showcase material (from `references/showcases.md`) needed to assemble it.
- For Experimental base-showcase, load the base showcase (`references/showcases.md`) and only the reference associated with the one changed axis.
- For Experimental fully custom, load the option reference relevant to each question as the interview reaches it.
- Do not load every reference file before asking the first question.

### Explicit mode-dependent control flow

Immediately after mode selection, follow the explicit control flow for the selected mode:

#### Proven
1. Select one whole showcase configuration from `references/showcases.md`.
2. Do not enter the full Step 2 interview.
3. Do not ask for a creative spark.
4. Fill the Proven `SIGNATURE_MOMENT` text. Set `ENABLE_SIGNATURE_MOMENT` to `false`; it is a no-op and no independent Signature Moment code path is required.
5. Continue directly to Step 3.

#### Signature
1. Select one whole showcase configuration from `references/showcases.md`.
2. Do not enter the full Step 2 interview.
3. Ask only the optional creative-spark question, unless the user said "pick for me."
4. Generate the bounded Signature Moment. Enable `ENABLE_SIGNATURE_MOMENT` by default; disabling it restores the selected whole showcase without the Signature Moment.
5. Continue directly to Step 3.

#### Experimental base-showcase path
1. Select one named base showcase from `references/showcases.md`.
2. Ask which single major axis will change (ambition, biome, archetype, mechanic, or camera).
3. Ask only the relevant Step 2 question for that selected axis.
4. Do not run the remaining interview questions.
5. A rendering-profile change may be accepted only as a complete supported tuple from `references/cameras.md` (and does not count as the single creative axis).
6. Ask the optional creative-spark question.
7. Run the required compatibility checks. Enable `ENABLE_SIGNATURE_MOMENT` by default; disabling it restores the configuration after its one approved axis change without the Signature Moment.
8. Continue directly to Step 3.

#### Experimental fully custom path
1. Enter the full Step 2 interview.
2. Ask each Step 2 question in order.
3. Ask the optional creative-spark question. Enable `ENABLE_SIGNATURE_MOMENT` by default; disabling it restores the fully custom configuration without the Signature Moment.
4. Continue directly to Step 3.

The Experimental fully custom path is the only path that runs the complete Step 2 interview.

### Creative Spark (Signature and Experimental modes only)

Ask once in Signature or Experimental mode (unless the user said "pick for me"):

> Do you want to give me one visual memory, material, emotion, or natural phenomenon to influence the Signature Moment, or should I surprise you?

Rules:
- The spark is inspiration, not a literal new requirement.
- Do not turn it into an additional system.
- Do not alter the palette or paradigm unless Experimental mode explicitly assigns the biome axis as its one changed axis.
- If the user says "pick for me," skip this question and use "surprise me."
- Proven mode skips this question entirely.

**Creative authority and hard contracts:**
Creative authority operates only inside the selected creative mode. Creative decisions cannot override hard contracts (rendering profile, ambition ceiling, asset strategy, palette coherence decisions, character recipe, verification hook, acceptance gates, and required project deliverables).

---

## Step 2 — Fully custom interview

This step runs only for the Experimental fully custom mode. Other paths may reference a single relevant question from this section but must not enter the complete interview. The Experimental fully custom path is the only path that runs the complete Step 2 interview.

One question at a time. Wait for the answer before asking the next. Read the valid
names out of the relevant direct reference files and offer them as a numbered list with a
one-line description each — never invent an option that is not in those files.

Order, exactly:

**1. Ambition level** — read from `references/modes.md`: `slice`, `showcase`, or `everything`.

> **`slice` is the default and is correct for most people.** A one-shot build
> collapses under a dozen simultaneous systems; every one lands at 60% quality.
> Say this when you ask. Choose `showcase` when the biome's identity depends on
> vegetation or a persistent surface state. Choose `everything` only when the
> builder has real time to spend.

The level decides which of `TEMPLATE.md`'s three marked sections survive:

| Level | Sections kept |
|---|---|
| `slice` *(default)* | none |
| `showcase` | `vegetation`, `state-buffer`, `audio` |
| `everything` | those three, plus four extra `§2.9`+ subsections |

**2. Biome** — read from `references/biomes.md`: Alpine Snow, Ghibli Valley, Dune Desert, Ocean Shelf,
Volcanic, Night City. This is the single largest decision: it supplies 19 of the
38 tokens and the palette that Step 3 checks.

**3. Archetype** — read from `references/archetypes.md`: Robed Mage, Traveller Coat, Armored Soldier, Desert
Nomad, Void Wanderer. Archetypes are **parameters on one rig**, never alternative
bodies. They supply no `{{TOKEN}}`; their content goes inside `{{CHARACTER_RECIPE}}`
(see Step 4).

**4. Mechanic** — read from `references/mechanics.md`: Surf / Carve, Flight / Glide, Beam Cannon, Grapple Swing,
Summon Vehicle. Check that the channels the mechanic's **Writes:** line names
actually exist in the chosen biome's `STATE_BUFFER_CHANNELS`. If they do not, say
so and offer either a different mechanic or a re-mapping written into the brief.

**5. Camera mode** — read from `references/cameras.md`: Third Person, First Person, Cinematic, XR. Third
Person is the default and the framing the character recipe is tuned for. Two
consequences to state when you ask, because they are invisible otherwise:

- **Camera modes supply no `{{TOKEN}}` values at all.** The chosen mode replaces
  the body of `TEMPLATE.md` §2.6 by substitution (Step 4). Skip this and the brief
  silently ships third-person prose to someone who asked for XR.
- **Choosing XR overrides `TARGET_BROWSER_AND_HARDWARE`**, whatever the showcase
  config or default said. Use a stereo target, e.g. `Chrome stable on Windows 11
  with a PC-tethered headset, 90 Hz per eye, RTX-class GPU`.

**6. Optional systems** — what this means depends on the level chosen in question 1,
so phrase it accordingly:

- At `slice`: **skip this question entirely.** There are no optional systems. Do
  not offer to add one back; that is what `showcase` is.
- At `showcase`: confirm the three sections (vegetation, state buffer + wind field,
  procedural audio + atmospheric life). The user may drop any of them; a dropped
  section is deleted exactly as at `slice`.
- At `everything`: the four extra subsections are **weather**, **water bodies**,
  **architecture**, and **destructibility**, appended as `§2.9`–`§2.12`. Confirm
  which the user wants. If they want none, they are at `showcase` — say so and
  change the level rather than writing an `everything` brief with nothing extra.

Also collect, in the same pass:

- **`PROJECT_NAME`** — a short upper-case hyphenated name, e.g. `ALPINE-DAWN`.
- **Rendering profile (engine and shader language)** — read from `references/cameras.md`, offer exactly:
  1. **Babylon.js WebGPU + WGSL** (default): `ENGINE` = `Babylon.js latest stable, WebGPU only`, `SHADER_LANG` = `WGSL`, `SHADER_LANG_EXT` = `wgsl`, `MATERIAL_API` = `Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL`.
  2. **Three.js WebGL2 + GLSL ES 3.00** (alternative): `ENGINE` = `Three.js latest stable, WebGLRenderer (WebGL2 only)`, `SHADER_LANG` = `GLSL ES 3.00 raw modules`, `SHADER_LANG_EXT` = `glsl`, `MATERIAL_API` = `Three.js RawShaderMaterial on WebGLRenderer`.

  State that these are primary rendering profiles and automatic backend fallback is forbidden.

---

## Step 3 — Selection & Coherence validation (mandatory, before writing anything)

After mode choices and before generation:

1. **Construct the selection object** matching `selection.mjs` schema (`creativeMode`, `path`, `baseShowcase`, `changedAxes`, `ambition`, `biome`, `archetype`, `mechanic`, `camera`, `renderingProfile`, `includedSections`, `extraSections`, `stateChannelContract`, `cameraAdjustments`, `signatureMoment`, `noveltyBudget`).
2. **Run `validateSelection(selection)`** from `selection.mjs` (or via CLI `node selection.mjs validate <selection.json>`) to validate mode, route, section, camera, channel, and budget contracts.
3. **Run `checkCoherence(config)`** from `check.mjs` (or via CLI `node check.mjs coherence <config.json>`) on the chosen biome's palette and paradigm config (with `assetStrategy: 'zero-asset'`).
4. **Report every conflict** from both validators with its `message` and `fix`, verbatim.
   - `validateSelection` errors (`severity: 'error'`): hard blockers that cannot be overridden under any circumstances. Creative freedom operates only within hard structural contracts.
   - `checkCoherence` errors (`severity: 'error'`): block generation by default, but may proceed if the user explicitly decides to override, recorded in `DECISIONS.md` under `## Deliberate Deviations`.
   - `severity: 'warn'`: report and continue.
5. **Format state-channel contract** using `formatStateChannelContract(selection)` (or via CLI `node selection.mjs format-state <selection.json>`) when `state-buffer` is included, and insert it into `TEMPLATE.md` at `{{STATE_CHANNEL_CONTRACT}}`.
6. **Record in DECISIONS.md**: creative mode, route/path, changed axis, sections, profile, channel contract mappings, validator results, and any deliberate overrides.

### Re-run checks after any adjustment.

Any change to a selection parameter or palette entry invalidates previous results. Re-run coherence check and selection validator before writing the brief. Volcanic adjustments and custom axis recombinations get re-checked without exception.

---

## Step 4 — Deterministic assembly & brief output

Deterministic brief assembly using `assemble.mjs` is the preferred mechanical path after Step 3. See [references/assembly.md](references/assembly.md) for full specification schema, CLI usage, and overwrite rules.

### Preferred Path: `assemble.mjs`

1. Construct the assembly JSON matching the schema in [references/assembly.md](references/assembly.md).
2. Run the assembler: `node assemble.mjs <assembly.json> --out <target-project-directory>`.
3. Resolve every reported finding or error if validation fails.
4. Hand off only a successfully assembled and validated bundle.

The manual composition rules below remain the authoritative specification and fallback.

Copy `TEMPLATE.md` to `<PROJECT>_TECHDEMO_PROMPT.md` in the target project
directory — `PROJECT_NAME` upper-cased with hyphens turned into underscores, e.g.
`ALPINE-DAWN` → `ALPINE_DAWN_TECHDEMO_PROMPT.md`. Then do the five things below,
in this order.

### 4a. Fill the 38 tokens

Paste reference text **as written**. It is token text, not inspiration: every value
carries metres, counts, amplitudes, or grid dimensions, and rewriting one into an
adjective undoes the only thing that makes the brief work.

| Source | Tokens it supplies |
|---|---|
| **Creative mode** — 2 | `CREATIVE_MODE`, `SIGNATURE_MOMENT` |
| **Showcase config** (from `references/showcases.md`, or derived on Experimental custom route) — 9 | `PROJECT_NAME`, `RENDERING_PARADIGM`, `ENGINE`, `SHADER_LANG`, `SHADER_LANG_EXT`, `MATERIAL_API`, `ASSET_STRATEGY`, `TARGET_BROWSER_AND_HARDWARE`, `CORE_INTERACTION_SENTENCE` |
| **Biome** (from `references/biomes.md`) — 19 | `PRIMARY_ENVIRONMENT`, `PRIMARY_MATERIAL_NAME`, `NAIVE_DEFAULT`, `TERRAIN_PHILOSOPHY_SENTENCE`, `TERRAIN_NOISE_LAYERS`, `TERRAIN_LANDMARKS`, `FAR_FIELD_TREATMENT`, `MATERIAL_BEHAVIOURS`, `DEFORMATION_TYPE`, `DEFORMATION_MARKS`, `RECOVERY_MECHANISM`, `RECOVERY_OUTCOME`, `STATE_BUFFER_COVERAGE`, `STATE_BUFFER_TEXEL_SIZE`, `STATE_BUFFER_CHANNELS`, `WIND_FIELD_ARCH`, `GRASS_SYSTEM_SPEC`, `AUDIO_ENGINE_SPEC`, `ATMOSPHERIC_LIFE_SPEC` |
| **Mechanic** (from `references/mechanics.md`) — 6 | `CENTREPIECE_MECHANIC`, `CENTREPIECE_INPUT`, `CENTREPIECE_DESCRIPTION`, `ABILITY_1_NAME`, `ABILITY_2_NAME`, `ABILITY_3_NAME` |
| **Character recipe + archetype** — 1 | `CHARACTER_RECIPE` (see 4c) |
| **State-channel contract** — 1 | `STATE_CHANNEL_CONTRACT` (formatted by selection validator) |
| **Archetype** (from `references/archetypes.md`) | none — its content goes inside `CHARACTER_RECIPE` |
| **Camera mode** (from `references/cameras.md`) | none — it substitutes §2.6 (see 4d) |

On the Experimental custom route, derive the nine config-level tokens like this:

- `RENDERING_PARADIGM` — from the biome's `paradigm` field: `photoreal` → `AAA Photoreal`; `painterly` → `Ghibli-Style Painterly Anime`. Never contradict the biome's own `json` block.
- `ENGINE`, `SHADER_LANG`, `SHADER_LANG_EXT`, `MATERIAL_API` — from the chosen rendering profile in `references/cameras.md` (default Babylon WebGPU or alternative Three WebGL2).
- `ASSET_STRATEGY` — `100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)`.
- `TARGET_BROWSER_AND_HARDWARE` — `Chrome stable on Windows 11, RTX-class GPU, 2560×1440`, unless the camera mode is XR (see 4d).
- `CORE_INTERACTION_SENTENCE` — you write it. It is a lower-case verb fragment that slots into "…walk around {{PRIMARY_ENVIRONMENT}} for ninety seconds, **{{CORE_INTERACTION_SENTENCE}}**, and either think 'this is AAA' or close the tab." Name the mechanic and one thing the biome does, e.g. `carve a trail across a drift field, watch the wake break behind them`.

**Deriving `CREATIVE_MODE` and `SIGNATURE_MOMENT`:**

- `CREATIVE_MODE` — `Proven`, `Signature`, or `Experimental`.
- `SIGNATURE_MOMENT` —
  - In **Proven** mode, use this exact meaning:
    > Do not add an independent novelty behavior. Treat the configured centrepiece mechanic and its strongest existing visual consequence as the signature shot. Improve only composition, timing, shading, and polish within the systems already specified.
  - In **Signature** and **Experimental** modes:
    1. Generate three candidate Signature Moments internally.
    2. Reject any candidate that merely restates an existing preset behavior.
    3. Reject any candidate that requires a new major system.
    4. Select the candidate with the strongest distinctiveness-to-cost ratio.
    5. Fill `SIGNATURE_MOMENT` with a single paragraph naming its trigger, visible behavior, existing system reused, implementation boundary, and appearance in `window.__demo.setPose('mechanic')`.

**Bounded novelty budget rules for Signature Moment:**
- Be distinct from the preset's existing centrepiece behavior.
- Reuse an existing material, shader, particle system, state buffer, atmospheric system, camera behavior, or mechanic.
- Use the existing mechanic input or an automatic environmental trigger.
- Add no new engine, renderer, asset category, persistent GPU buffer, major render pass, simulation subsystem, or separate gameplay input.
- Add no new optional section and never increase the ambition level. At `slice`, the Signature Moment must reuse a system that survives at `slice`.
- Remain compatible with the zero-asset strategy.
- Be controlled by `ENABLE_SIGNATURE_MOMENT` in `src/core/settings.js` and be removable, restoring the selected configuration without the Signature Moment.
- Be visible when `window.__demo.setPose('mechanic')` is called.
- Remain exactly one behavior, not a bundle of related features.

**When `state-buffer` is omitted (at `slice` or if dropped), edit the mechanic text as you paste it.** Every mechanic's `CENTREPIECE_DESCRIPTION` ends with a **Writes:** paragraph naming state-buffer channels, and some add a line like *"a completed run stays visible from across the field."* When `state-buffer` is omitted, drop the **Writes:** paragraph and any sentence promising a persistent mark; the mechanic's payload is its motion, its wake or beam mesh, and its particles. Leaving that prose in points the builder at a system the brief does not contain. When `state-buffer` is included, keep the paragraph and insert `{{STATE_CHANNEL_CONTRACT}}` formatted by `selection.mjs`.

Tokens written as `{{NAME — default: …}}` in `TEMPLATE.md` carry a hint inside the
braces. Replace the **whole** brace expression, hint included. A leftover hint is
an unresolved token and `check.mjs` fails it.

### 4b. Delete the unselected sections — and every marker

`TEMPLATE.md` has three marked blocks:

| Marker | Section |
|---|---|
| `<!--SECTION:state-buffer-->` … `<!--/SECTION-->` | §2.3 Wind Field & Terrain State Buffer |
| `<!--SECTION:vegetation-->` … `<!--/SECTION-->` | §2.4 Vegetation & Foliage Systems |
| `<!--SECTION:audio-->` … `<!--/SECTION-->` | §2.8 Audio Engine & Atmospheric Life |

- Section **not** kept at this ambition level: delete the opening marker, the whole
  body including its `###` heading, and the closing marker. An omitted section is
  gone, not blanked — a heading with unfilled tokens under it is a hole.
- Section **kept**: delete the two marker lines anyway and leave the body. Markers
  are a template mechanism; `check.mjs` fails the brief for any marker that
  survives, kept section or not.

Renumber nothing. §2.3, §2.4, and §2.8 simply do not appear at `slice`.

At `everything`, append `§2.9 Weather`, `§2.10 Water Bodies`, `§2.11 Architecture`,
and `§2.12 Destructibility` after §2.8, written in the register of the rest of the
brief and **from the biome's own numbers** — its wind azimuth, its state-buffer
channels, its landmark spans. Each one needs counts, scales in metres, and a
channel it reads or writes. Do not introduce a new `{{TOKEN}}`; write the values in.

### 4c. The `{{CHARACTER_RECIPE}}` slot

This slot takes three pieces, in this order:

1. **`references/character-recipe.md`, inlined in full, verbatim.** All six parts
   (Skeleton, Geometry, Gait, Secondary motion, Foot planting, Prohibitions) plus
   its *Archetype parameters* and *Framing* sections. Copy the file's body — drop
   only its top-level `# Character recipe` title, and demote nothing else. Do not
   summarise it, do not trim the tables, do not paraphrase the prohibitions, and do
   not replace the code block in Part 5 with a description of it.

2. **An archetype block**, headed `### Archetype — <name>`, carrying the
   archetype's parameter table (figure height, ring-radius scale, chest ellipse
   ratio, lower body, ring counts) and its `CHARACTER_DESCRIPTION`, `CLOTH_PANELS`,
   cloth shading, and head covering, all pasted verbatim from
   `references/archetypes.md`.

3. **The biome's `FOOT_INTERACTION` text**, headed
   `### Foot interaction — <PRIMARY_MATERIAL_NAME>`, pasted verbatim from `references/biomes.md`.

**`FOOT_INTERACTION` is not one of the 38 tokens.** It has no slot in
`TEMPLATE.md`. Every biome supplies it, and it is appended to the inlined
`CHARACTER_RECIPE` here — nowhere else. Under it, add one sentence tying it to the
recipe: *these effects fire from the single touchdown call site in Part 5, reading
`plantedPos[leg]`, and from nowhere else.* Without that sentence the builder wires
the footfall effect to a timer and it drifts out of sync within seconds.

If the camera mode is First Person or XR, add a line after the archetype block
raising the ring counts as that mode's entry in `references/cameras.md` specifies.
Do not edit the recipe body to do it.

### 4d. Substitute §2.6 with the chosen camera mode

§2.6 in `TEMPLATE.md` is hard-coded third-person prose and holds **no token**.
Replace the paragraph beginning "Use third-person, action-MMO framing…" with the
chosen mode's full text from `references/cameras.md`, including its bolded **"The character must look good…"**
sentence — that sentence is a budget instruction, not framing colour.

Keep the **Initial Spawn Rule** paragraph in every mode.

For **XR**, additionally:

- Overwrite `TARGET_BROWSER_AND_HARDWARE` with a stereo target. XR wins over
  whatever the showcase config or the default supplied.
- State that the character budget is roughly double the third-person cost, taken
  out of the far field.

For **First Person**, **Cinematic**, and **XR**, also add one sentence to §6: the
`window.__demo.setPose()` hook must put the scene into a flat-screen, third-person
verification framing where the character occupies 3–20% of the frame. The verifier
renders a 2560×1440 monoscopic page and diffs the character against the same frame
with the character hidden; in a first-person or stereo view the character occupies
almost none of it and that gate cannot pass, however good the demo is.

### 4e. Validate

```bash
node check.mjs <PROJECT>_TECHDEMO_PROMPT.md
```

It reports unresolved tokens, `${…}` template-literal leaks, and stray section
markers. Fix everything it reports and re-run until it prints `OK`. Then read the
brief once yourself for the things a validator cannot see: a token filled with the
wrong biome's text, a mechanic writing a channel the biome does not declare, and a
§2.6 that still says "third-person" when the user asked for something else.

---

## Step 5 — Hand off

1. Copy this skill's `verify/` directory next to the target project so
   `verify/verify_demo.mjs`, `verify/gates.mjs`, and `verify/README.md` sit beside
   the brief.
2. Write `HANDOFF.md` in the same directory:

```markdown
# Handoff

- **Brief:** `<PROJECT>_TECHDEMO_PROMPT.md` — give this file to the coding agent, whole. It needs nothing else.
- **Agent:** <the agent the user named, e.g. Claude Code in this repo>
- **When the agent says it is done:** `npm install -D playwright pngjs && node verify/verify_demo.mjs .`
- **On failure:** the verifier lists each problem. Hand the list back to the agent and have it fix and re-run. Do not accept the demo with failures outstanding.
- **Frame times are reported, not gated** — a slow demo is a decision for you, not a build failure.
- **Engine version pinning:** When installing the engine during a generated project build, pin the exact resolved engine version in `package.json` and the lockfile, record that version in `DECISIONS.md`, and avoid floating CDN imports.
- **Mode decisions:** Record in `DECISIONS.md`: creative mode, base showcase or custom path, creative spark or surprise me, final Signature Moment, existing system reused by Signature Moment, any Experimental changed axis, compatibility checks performed, and permitted implementation deviations.
```

3. Tell the user, in one line, what to paste where.

---

## The character rule

**The recipe in `references/character-recipe.md` is inlined into every brief in
full, verbatim. This is not negotiable, and it is not summarisable.**

The predecessor template specified grass with four distance rings and a density
law, and terrain with noise layers in metres and amplitudes. Both came back
beautiful. It specified the character in prose — *"a Ghibli-inspired traveller with
a wind-blown coat, scarf, leather satchel, and boots"* — and got back **a cylinder
torso, a sphere head, and three boxes**: no skeleton, no limbs, no legs. The same
brief demanded that feet "plant rather than slide", which was unimplementable
because there were no feet.

Numbers got built. Adjectives did not. If you find yourself compressing the bone
table, dropping the Part 5 code block, or rewriting the prohibitions as a sentence,
you are reproducing the failure this skill exists to prevent.

---

## Reference index

| Where | What is in it |
|---|---|
| `references/modes.md` | 3 modes: Proven, Signature (default), Experimental; 3 ambition levels: slice, showcase, everything |
| `references/biomes.md` | 6 biomes: 19 tokens each, `FOOT_INTERACTION`, and a machine-checkable palette |
| `references/archetypes.md` | 5 archetypes as rig parameters, with cloth panels and shading |
| `references/mechanics.md` | 5 mechanics, each naming the state-buffer channels it writes |
| `references/cameras.md` | 4 camera modes (substituted into §2.6) and 2 rendering profiles |
| `references/showcases.md` | 6 canonical showcase configurations |
| `references/character-recipe.md` | The humanoid spec, inlined verbatim at `{{CHARACTER_RECIPE}}` |
| `references/assembly.md` | Assembly schema, creative vs mechanically derived fields, CLI exit codes, safe overwrite rules, strict integrity |
| `references/build-contract.md` | Build contract schema, milestone workflow, evidence shape, and incomplete verification |
| `references/benchmarking.md` | Benchmark harness, 8-case registry, bundle preparation, automated verification, human visual rubric, result collection, summary generation |
| `TEMPLATE.md` | The skeleton: 38 tokens, 3 marked sections, the `window.__demo` hook in §6 |
| `selection.mjs` | `validateSelection`, `formatStateChannelContract` (CLI: `node selection.mjs`) |
| `check.mjs` | `validateBrief`, `checkCoherence` (CLI: `node check.mjs`) |
| `assemble.mjs` | Deterministic brief assembler and safe bundle writer (CLI: `node assemble.mjs`) |
| `build-contract.mjs` | Deterministic contract/evidence generation and Markdown/JSON agreement validation |
| `benchmark.mjs` | Benchmark case registry, bundle preparation, result collection, comparative summary generation (CLI: `node benchmark.mjs`) |
| `reference-loader.mjs` | Strict reference loader with duplicate/unknown entry detection and cross-checking |
| `verify/verify_demo.mjs` | Post-build verification: build, console errors, and the image gates |
## Staged build-supervisor references

Use `references/implementation-planning.md`, `references/babylon-webgpu-patterns.md`,
and `references/visual-review.md` when applying the 5-stage build-supervisor model.
They hold the canonical stage order, rendering-profile patterns, and visual review
questions; the build contract and verifier enforce forbidden-pattern enforcement
at a high level.