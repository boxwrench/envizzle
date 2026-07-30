---
name: envizzle
description: Use when the user wants a visually impressive real-time graphics tech demo, environment showcase, movement prototype, or visual vertical slice. Writes a self-contained implementation brief with a numeric procedural character recipe, curated biome and archetype presets, coherence-checked palettes, and visual verification. Do not use for a complete game requiring progression, content systems, or production gameplay architecture. Triggers on "visually stunning demo", "tech demo brief", "graphics vertical slice", and "make something that looks AAA".
---

# envizzle

## What this produces

Three artefacts, written into the user's target project directory:

| Artefact | What it is |
|---|---|
| `<PROJECT>_TECHDEMO_PROMPT.md` | The brief. One self-contained Markdown file. **This is the product.** |
| `verify/` | A copy of this skill's `verify/` directory (`verify_demo.mjs`, `gates.mjs`, `README.md`). |
| `HANDOFF.md` | Five lines telling the user which agent gets the brief and how to verify the result. |

The brief must be **self-contained**. The agent that builds from it may be any
model in any tool, and it will see that one file and nothing else. It cannot open
`references/presets.md`, it cannot follow a link, and it cannot ask you a
question. Anything the builder needs is pasted into the brief, in full.

Never hand over a brief containing an unfilled `{{TOKEN}}`, a `<!--SECTION:...-->`
marker, a `${...}` form, or a "TODO". `node check.mjs` exists to catch exactly
these, and Step 4 runs it.

**Files this skill reads** (all paths relative to the skill root):

- `references/presets.md` — the menu: creative modes, ambition levels, biomes, archetypes, mechanics, camera modes, showcase configs.
- `references/character-recipe.md` — the numeric humanoid spec, inlined into every brief.
- `TEMPLATE.md` — the brief skeleton: 37 `{{TOKEN}}` slots and three `<!--SECTION:name-->` blocks.
- `check.mjs` — `validateBrief` (also a CLI) and `checkCoherence`.
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

**Creative authority and hard contracts:**
Creative authority operates only inside the selected creative mode. Creative decisions cannot override hard contracts (rendering profile, ambition ceiling, asset strategy, palette coherence decisions, character recipe, verification hook, acceptance gates, and required project deliverables).

---

## Step 2 — The interview

One question at a time. Wait for the answer before asking the next. Read the valid
names out of `references/presets.md` and offer them as a numbered list with a
one-line description each — never invent an option that is not in that file.

Order, exactly:

**1. Ambition level** — `slice`, `showcase`, or `everything`.

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

**2. Biome** — one of: Alpine Snow, Ghibli Valley, Dune Desert, Ocean Shelf,
Volcanic, Night City. This is the single largest decision: it supplies 19 of the
37 tokens and the palette that Step 3 checks.

**3. Archetype** — one of: Robed Mage, Traveller Coat, Armored Soldier, Desert
Nomad, Void Wanderer. Archetypes are **parameters on one rig**, never alternative
bodies. They supply no `{{TOKEN}}`; their content goes inside `{{CHARACTER_RECIPE}}`
(see Step 4).

**4. Mechanic** — one of: Surf / Carve, Flight / Glide, Beam Cannon, Grapple Swing,
Summon Vehicle. Check that the channels the mechanic's **Writes:** line names
actually exist in the chosen biome's `STATE_BUFFER_CHANNELS`. If they do not, say
so and offer either a different mechanic or a re-mapping written into the brief.

**5. Camera mode** — one of: Third Person, First Person, Cinematic, XR. Third
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

**7. Creative Spark (Signature and Experimental modes only)** — Ask once:

> Do you want to give me one visual memory, material, emotion, or natural phenomenon to influence the Signature Moment, or should I surprise you?

Rules:
- The spark is inspiration, not a literal new requirement.
- Do not turn it into an additional system.
- Do not alter the palette or paradigm unless Experimental mode explicitly assigns the biome axis as its one changed axis.
- If the user says "pick for me," skip this question and use "surprise me."
- Proven mode skips this question entirely.

Also collect, in the same pass:

- **`PROJECT_NAME`** — a short upper-case hyphenated name, e.g. `ALPINE-DAWN`.
- **Rendering profile (engine and shader language)** — offer exactly:
  1. **Babylon.js WebGPU + WGSL** (default): `ENGINE` = `Babylon.js latest stable, WebGPU only`, `SHADER_LANG` = `WGSL`, `SHADER_LANG_EXT` = `wgsl`, `MATERIAL_API` = `Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL`.
  2. **Three.js WebGL2 + GLSL ES 3.00** (alternative): `ENGINE` = `Three.js latest stable, WebGLRenderer (WebGL2 only)`, `SHADER_LANG` = `GLSL ES 3.00 raw modules`, `SHADER_LANG_EXT` = `glsl`, `MATERIAL_API` = `Three.js RawShaderMaterial on WebGLRenderer`.

  State that these are primary rendering profiles and automatic backend fallback is forbidden.

---

## Step 3 — Coherence check (mandatory, before writing anything)

Build the config object from the chosen biome's fenced `json` block and check it.
The block gives `paradigm`, `materialBehaviours`, and `palette`; you must **add
`assetStrategy: 'zero-asset'`** yourself, because two of the six rules do not fire
without it and a missing field reads as a pass.

Write a scratch file in the skill root and run it:

```js
// coherence-check.mjs — delete when done
import { checkCoherence } from './check.mjs';

const config = {
  paradigm: 'photoreal',            // from the biome's json block
  assetStrategy: 'zero-asset',      // add this; rules R5/R6 need it
  materialBehaviours: '…',          // from the biome's json block
  palette: [ /* …the biome's palette, verbatim… */ ],
};

const conflicts = checkCoherence(config);
console.log(conflicts.length === 0 ? 'coherent' : JSON.stringify(conflicts, null, 2));
```

```bash
node coherence-check.mjs
```

Each conflict is `{rule, severity, message, fix}`. Report **every** conflict to the
user with its `message` and its `fix`, verbatim — never silently correct one. The
rules encode defaults, not truth.

- `severity: 'error'` — do not write the brief until the user either takes the fix
  or explicitly overrides.
- `severity: 'warn'` — report and continue.

**Record every override.** Append a `## Deliberate Deviations` heading to the end
of the brief (after §6) with one bullet per override: the rule name, what the user
chose instead, and their reason in their own words. Without it the builder reads a
muddy palette as a mistake to correct, and either "fixes" it or half-fixes it.

### Re-run the check after any adjustment. This is a step, not a suggestion.

Any change to a palette entry, an `area` value, or the paradigm invalidates the
previous result. Re-run `coherence-check.mjs` on the edited config before writing
the brief.

The **Volcanic** palette is the reason this is a hard step. Its mean large-area
luminance is **0.125** against a floor of **0.10** — the narrowest margin of any
shipped palette, and the only one where an ordinary-looking edit crosses a rule.
The three large areas are `ash-sky` 0.250, `ash-plain` 0.120, and `basalt` 0.006,
with `steam-lit` 0.725 as the light anchor at medium area. Verified failures:

| Edit | Fails |
|---|---|
| Darken `ash-plain` toward the basalt (e.g. `#3a342f`) | `large-area-mean-floor` |
| Demote `ash-sky` to medium, or darken it to the ash-plain value | `large-area-all-dark`, `large-area-mean-floor` |
| Demote `steam-lit` to accent | `light-anchor`, `accent-cap` |

`ash-sky` carries the margin; `ash-plain` sits below the mean, so removing or
demoting it *raises* the mean and still passes. That is exactly why you re-run the
check instead of reasoning about it — the intuitive answer here is wrong. Any
Volcanic adjustment gets re-checked without exception.

Also re-check when you recombine across showcase configs, and re-check the
mechanic's channel writes against the biome's `STATE_BUFFER_CHANNELS` at the same
time. Do the checks before the build, not after.

---

## Step 4 — Write the brief

Copy `TEMPLATE.md` to `<PROJECT>_TECHDEMO_PROMPT.md` in the target project
directory — `PROJECT_NAME` upper-cased with hyphens turned into underscores, e.g.
`ALPINE-DAWN` → `ALPINE_DAWN_TECHDEMO_PROMPT.md`. Then do the five things below,
in this order.

### 4a. Fill the 37 tokens

Paste preset text **as written**. It is token text, not inspiration: every value
carries metres, counts, amplitudes, or grid dimensions, and rewriting one into an
adjective undoes the only thing that makes the brief work.

| Source | Tokens it supplies |
|---|---|
| **Creative mode** — 2 | `CREATIVE_MODE`, `SIGNATURE_MOMENT` |
| **Showcase config** (or you, on Experimental custom route) — 9 | `PROJECT_NAME`, `RENDERING_PARADIGM`, `ENGINE`, `SHADER_LANG`, `SHADER_LANG_EXT`, `MATERIAL_API`, `ASSET_STRATEGY`, `TARGET_BROWSER_AND_HARDWARE`, `CORE_INTERACTION_SENTENCE` |
| **Biome** — 19 | `PRIMARY_ENVIRONMENT`, `PRIMARY_MATERIAL_NAME`, `NAIVE_DEFAULT`, `TERRAIN_PHILOSOPHY_SENTENCE`, `TERRAIN_NOISE_LAYERS`, `TERRAIN_LANDMARKS`, `FAR_FIELD_TREATMENT`, `MATERIAL_BEHAVIOURS`, `DEFORMATION_TYPE`, `DEFORMATION_MARKS`, `RECOVERY_MECHANISM`, `RECOVERY_OUTCOME`, `STATE_BUFFER_COVERAGE`, `STATE_BUFFER_TEXEL_SIZE`, `STATE_BUFFER_CHANNELS`, `WIND_FIELD_ARCH`, `GRASS_SYSTEM_SPEC`, `AUDIO_ENGINE_SPEC`, `ATMOSPHERIC_LIFE_SPEC` |
| **Mechanic** — 6 | `CENTREPIECE_MECHANIC`, `CENTREPIECE_INPUT`, `CENTREPIECE_DESCRIPTION`, `ABILITY_1_NAME`, `ABILITY_2_NAME`, `ABILITY_3_NAME` |
| **Character recipe + archetype** — 1 | `CHARACTER_RECIPE` (see 4c) |
| **Archetype** | none — its content goes inside `CHARACTER_RECIPE` |
| **Camera mode** | none — it substitutes §2.6 (see 4d) |

On the Experimental custom route, derive the nine config-level tokens like this:

- `RENDERING_PARADIGM` — from the biome's `paradigm` field: `photoreal` → `AAA Photoreal`; `painterly` → `Ghibli-Style Painterly Anime`. Never contradict the biome's own `json` block.
- `ENGINE`, `SHADER_LANG`, `SHADER_LANG_EXT`, `MATERIAL_API` — from the chosen rendering profile (default Babylon WebGPU or alternative Three WebGL2).
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
- Be controlled by `ENABLE_SIGNATURE_MOMENT` in `src/core/settings.js` and be removable without breaking the base showcase.
- Be visible when `window.__demo.setPose('mechanic')` is called.
- Remain exactly one behavior, not a bundle of related features.

**At `slice`, edit the mechanic text as you paste it.** Every mechanic's
`CENTREPIECE_DESCRIPTION` ends with a **Writes:** paragraph naming state-buffer
channels, and some add a line like *"a completed run stays visible from across the
field."* At `slice` there is no §2.3, so drop the **Writes:** paragraph and any
sentence promising a persistent mark; the mechanic's payload is its motion, its wake
or beam mesh, and its particles. Leaving that prose in points the builder at a
system the brief does not contain — the Dune Sea showcase config is `slice` with
Surf / Carve and hits this directly. At `showcase` and `everything`, keep the
paragraph and confirm each channel it names exists in the biome's
`STATE_BUFFER_CHANNELS`; the channels are lettered per biome, so B in one biome is
wind gust and in another is temperature. Match on meaning, not on letter.

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
   `references/presets.md`.

3. **The biome's `FOOT_INTERACTION` text**, headed
   `### Foot interaction — <PRIMARY_MATERIAL_NAME>`.

**`FOOT_INTERACTION` is not one of the 37 tokens.** It has no slot in
`TEMPLATE.md`. Every biome supplies it, and it is appended to the inlined
`CHARACTER_RECIPE` here — nowhere else. Under it, add one sentence tying it to the
recipe: *these effects fire from the single touchdown call site in Part 5, reading
`plantedPos[leg]`, and from nowhere else.* Without that sentence the builder wires
the footfall effect to a timer and it drifts out of sync within seconds.

If the camera mode is First Person or XR, add a line after the archetype block
raising the ring counts as that mode's entry in `references/presets.md` specifies.
Do not edit the recipe body to do it.

### 4d. Substitute §2.6 with the chosen camera mode

§2.6 in `TEMPLATE.md` is hard-coded third-person prose and holds **no token**.
Replace the paragraph beginning "Use third-person, action-MMO framing…" with the
chosen mode's full text from the *Camera modes* section of
`references/presets.md`, including its bolded **"The character must look good…"**
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
| `references/presets.md` → *Creative modes* | 3 modes: Proven, Signature (default), Experimental |
| `references/presets.md` → *Ambition levels* | The three levels, what each keeps, which tokens each requires |
| `references/presets.md` → *Biomes* | 6 biomes: 19 tokens each, `FOOT_INTERACTION`, and a machine-checkable palette |
| `references/presets.md` → *Character archetypes* | 5 archetypes as rig parameters, with cloth panels and shading |
| `references/presets.md` → *Centrepiece mechanics* | 5 mechanics, each naming the state-buffer channels it writes |
| `references/presets.md` → *Camera modes* | 4 modes; substituted into §2.6, no tokens |
| `references/presets.md` → *Showcase configs* | 6 checked combinations; take one whole |
| `references/character-recipe.md` | The humanoid spec, inlined verbatim at `{{CHARACTER_RECIPE}}` |
| `TEMPLATE.md` | The skeleton: 37 tokens, 3 marked sections, the `window.__demo` hook in §6 |
| `check.mjs` | `validateBrief` (CLI: `node check.mjs <brief>`) and `checkCoherence(config)` |
| `verify/verify_demo.mjs` | Post-build verification: build, console errors, and the image gates |
