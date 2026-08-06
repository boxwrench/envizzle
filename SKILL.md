---
name: envizzle
description: Use when the user wants a visually impressive real-time graphics tech demo, environment showcase, movement prototype, or visual vertical slice. Writes a self-contained implementation brief with a numeric procedural character recipe, curated biome and archetype presets, coherence-checked palettes, and visual verification. Do not use for a complete game requiring progression, content systems, or production gameplay architecture. Triggers on "visually stunning demo", "tech demo brief", "graphics vertical slice", and "make something that looks AAA".
---

# envizzle

## What this produces

Nine files, organized into five artifact groups, written into the user's target project directory:

| Artifact group | Files | What they are |
|---|---|---|
| Brief | `<PROJECT>_TECHDEMO_PROMPT.md` | The brief. One self-contained Markdown file. **This is the product.** |
| Build contract | `ENVIZZLE_BUILD.json` | Versioned machine-readable build contract generated from the same validated assembly result as the brief. |
| Evidence template | `ENVIZZLE_EVIDENCE.json` | Empty/incomplete milestone evidence template for screenshots, console findings, performance, weaknesses, and corrections. |
| Verifier | `verify/verify_demo.mjs`, `verify/gates.mjs`, `verify/report.mjs`, `verify/evidence.mjs`, `verify/README.md` | Post-build visual verification, image gates, structured report generation, and evidence utilities. |
| Handoff | `HANDOFF.md` | Handoff, contract, evidence, and three-milestone visual self-review instructions. |

The builder receives the complete nine-file bundle as its workspace. `<PROJECT>_TECHDEMO_PROMPT.md` is the primary task prompt. The brief contains all required creative and implementation direction. The JSON sidecars and verifier files define machine-readable contracts, evidence, and verification. The builder must not depend on Envizzle repository references, hidden scaffolding, or external design instructions. Missing required information is an Envizzle assembly defect, not an invitation to invent hidden requirements or request reference files.

Never hand over a brief containing an unfilled `{{TOKEN}}`, a `<!--SECTION:...-->`
marker, a `${...}` form, or a "TODO". `node check.mjs` exists to catch exactly
these, and the assembler runs it.

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
4. Generate the bounded Signature Moment. Enable `ENABLE_SIGNATURE_MOMENT` by default; disabling it restores the selected configuration without the Signature Moment.
5. Continue directly to Step 3.

#### Experimental base-showcase path
1. Select one named base showcase from `references/showcases.md`.
2. Ask which single major axis will change (ambition, biome, archetype, mechanic, or camera).
3. Ask only the relevant Step 2 question for that selected axis.
4. Do not run the remaining interview questions.
5. A rendering-profile change may be accepted only as a complete supported rendering-profile tuple from `references/cameras.md` (and does not count as the single creative axis).
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

**Bounded novelty budget:** The Signature Moment must be distinct from preset behavior, reuses an existing material, shader, particle system, state buffer, atmospheric system, camera behavior, or mechanic, adds no new engine, renderer, asset category, persistent buffer, major render pass, simulation subsystem, or input, never increases ambition or adds a section, and is controlled by `ENABLE_SIGNATURE_MOMENT` in `src/core/settings.js`.

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
  the body of `TEMPLATE.md` §2.6 by substitution. Skip this and the brief
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
   - `checkCoherence` errors (`severity: 'error'`): block generation by default, but may proceed if the user explicitly decides to override, recorded in the assembly specification under deliberate deviations.
   - `severity: 'warn'`: report and continue.
5. **Validate the state-channel contract** when `state-buffer` is included: confirm `selection.stateChannelContract` is present and matches the chosen mechanic's channels. `formatStateChannelContract(selection)` (or via CLI `node selection.mjs format-state <selection.json>`) may be used to inspect or report the deterministic mapping, but never to edit `TEMPLATE.md` or any assembled output by hand. Preserve `stateChannelContract` in the assembly specification passed to `assemble.mjs`, which formats and injects it at `{{STATE_CHANNEL_CONTRACT}}`.
6. **Record in the assembly specification**: creative mode, route/path, changed axis, sections, profile, channel contract mappings, validator results, and any deliberate overrides. The assembler writes these choices into the generated brief's Assembly Decisions section and build contract. The builder creates the project's required `DECISIONS.md`, recording implementation decisions, resolved engine version, trade-offs, deviations, and compatibility work.

### Re-run checks after any adjustment.

Any change to a selection parameter or palette entry invalidates previous results. Re-run coherence check and selection validator before writing the brief. Volcanic adjustments and custom axis recombinations get re-checked without exception.

---

## Step 4 — Deterministic assembly & brief output

Brief assembly uses `assemble.mjs`. See [references/assembly.md](references/assembly.md) for the full specification schema, CLI usage, and overwrite rules.

1. Construct a valid assembly specification using [references/assembly.md](references/assembly.md), preserving the user's validated selection and creative inputs.
2. Run: `node assemble.mjs <assembly.json> --out <target-project-directory>`
3. Resolve every reported finding or error if validation fails.
4. Hand off only a successfully assembled nine-file bundle.

If assembly fails, the correct action is to fix the specification or assembler error, not to assemble manually.

### Invariants enforced by assembly

- All 38 template tokens are resolved.
- Optional sections follow the validated ambition and section selection.
- Section markers (`<!--SECTION:...-->` … `<!--/SECTION-->`) and template-literal leaks (`${...}`) are absent.
- The numeric character recipe is inlined verbatim.
- Camera and rendering-profile substitutions remain compatible.
- Brief, build contract, evidence template, and handoff agree.
- No generated brief depends on Envizzle reference files.

---

## Step 5 — Hand off

The assembled bundle contains all nine files (`<PROJECT>_TECHDEMO_PROMPT.md`, `ENVIZZLE_BUILD.json`, `ENVIZZLE_EVIDENCE.json`, `HANDOFF.md`, `verify/README.md`, `verify/evidence.mjs`, `verify/gates.mjs`, `verify/report.mjs`, `verify/verify_demo.mjs`). Provide the complete nine-file bundle as the builder agent's workspace.

Tell the user, in one line, what to paste where.

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
