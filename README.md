# envizzle

**A Claude Code skill that writes the brief, so an agent can one-shot a
visually impressive real-time graphics demo.**

You run `/envizzle`. It asks what you want (or picks a known-good combination for
you), checks your art direction for internal contradictions, and writes a single
self-contained Markdown brief. You hand that brief to any coding agent — Claude,
Gemini, whatever — and it builds the demo.

The brief is the product. It is deliberately model-agnostic: one file, no external
references, nothing to fetch.

---

## The problem it solves

envizzle was distilled from a fill-in-the-blanks prompt template that worked
unevenly, and the pattern in *how* it failed turned out to be the whole insight.

That template specified grass with four distance rings, blades per square metre,
and a continuous density law. Grass came back beautiful. It specified terrain with
noise layers in metres and amplitudes, and a clipmap LOD. Terrain came back
beautiful. Then it specified the character like this:

> Create a Ghibli-inspired traveller with a wind-blown coat, scarf, leather
> satchel, and boots.

The character came back as a cylinder, a sphere, and three boxes. No skeleton, no
limbs, no legs. The brief had also demanded that "feet must plant rather than
slide" — unimplementable, because there were no feet.

**Systems specified with numbers got built. The system specified with adjectives
did not.** Agents do not need more encouragement; they need a recipe.

There was a second failure worth naming. The template let you pick a painterly,
Ghibli-style rendering paradigm and then hand it a palette of `#080810` obsidian
and `#2b0052` violet. Painterly rendering reads as beautiful *because* it is
high-key and luminous; against near-black it produces mud. Nothing caught the
contradiction, and the resulting frames were unusable.

## What it does differently

**The character gets a construction recipe, not an art brief.** A 22-bone
skeleton with rest positions in metres. One continuous skinned mesh generated from
lofted cross-section rings, each with a radius *and* an ellipse ratio so limbs
aren't tubes. Gait phase advanced by ground distance travelled, so stride length
equals ground speed by construction and foot sliding is not merely discouraged but
impossible. Two-bone analytic IK by law of cosines. Foot planting with a single
write site, so no code path exists that could slide a planted foot.

And an explicit prohibition list: `BoxGeometry`, `SphereGeometry`,
`CylinderGeometry`, `CapsuleGeometry`, and `ConeGeometry` are forbidden in
character code. The predecessor's escape hatch — *"if a rig cannot be brought to a
high standard, prefer a cloth-driven figure"* — is deleted, because agents took it
as permission to skip the rig entirely.

**Art direction is checked before a brief is written.** Rules reject the
combinations that produce mud: a palette needs a genuinely *desaturated* light
anchor (a bright neon does not count — that was the bug in the first draft of these
rules, since neon cyan has luminance 0.76); it needs values spanning dark, mid, and
light; and a painterly paradigm needs its large-area colours to carry actual light.
Conflicts are reported with a suggested fix, never silently corrected — the rules
encode defaults, not truth.

**Progressive reference loading.** Direct, single-level references under `references/`
allow progressive loading during interview and assembly. Envizzle reads modes and
showcases first, loading specific biome, archetype, mechanic, or camera references only
when requested by the selected mode or interview step.

**An ambition dial keeps one-shots one-shottable.** `slice` is the default, because
a single-pass build collapses under a dozen simultaneous systems. `showcase` and
`everything` open up more. Unselected sections are omitted from the brief entirely
rather than left as dead placeholders.

**Verification gates on pixels.** The predecessor's verifier captured screenshots
and then logged `PASS: Screenshots successfully saved` without inspecting a single
one — which is how a near-black frame with the camera clipped inside a rock passed
as a success. envizzle's gates check mean luminance, reject frames where 70%+ of
pixels share one luminance bucket, and diff a frame against the same frame with the
character hidden to confirm the character actually occupies 3–20% of it. That last
one is essentially unfakeable.

## Usage

```bash
npm install
npm test
```

Install as a personal skill, then invoke `/envizzle` in Claude Code. The repo root
*is* the skill root, so installation is a clone or a symlink — there is nothing to
build and nothing to copy:

```bash
git clone https://github.com/boxwrench/envizzle ~/.claude/skills/envizzle
```

```bash
# or, to keep working in your own checkout
ln -s "$PWD" ~/.claude/skills/envizzle          # macOS/Linux
New-Item -ItemType SymbolicLink -Path "$HOME\.claude\skills\envizzle" -Target "$PWD"   # Windows
```

Validate a selection object or list registered values:

```bash
node selection.mjs list
node selection.mjs validate selection.json
node selection.mjs format-state selection.json
```

Validate an art direction config for palette coherence:

```bash
node check.mjs coherence config.json
```

Assemble a self-contained brief and safe project bundle:

```bash
# Print assembled brief to stdout
node assemble.mjs assembly.json --stdout

# Emit safe project bundle (<PROJECT>_TECHDEMO_PROMPT.md, HANDOFF.md, verify/)
node assemble.mjs assembly.json --out path/to/project

# Overwrite existing bundle target files safely
node assemble.mjs assembly.json --out path/to/project --force
```

Assembly input example (`assembly.json`):

```json
{
  "selection": {
    "creativeMode": "signature",
    "path": "showcase",
    "baseShowcase": "Alpine Dawn",
    "changedAxes": [],
    "ambition": "showcase",
    "biome": "Alpine Snow",
    "archetype": "Traveller Coat",
    "mechanic": "Surf / Carve",
    "camera": "Third Person",
    "renderingProfile": "babylon-webgpu",
    "includedSections": ["vegetation", "state-buffer", "audio"],
    "extraSections": [],
    "cameraAdjustments": [],
    "stateChannelContract": {
      "depression": { "channel": "R", "effect": "carve groove lowers snow depression depth" },
      "displaced-mass": { "channel": "G", "effect": "carve berms raise displaced snow mass" },
      "wetness-or-compaction": { "channel": "B", "effect": "groove writes wetness, interpreted as compressed sheen" }
    },
    "signatureMoment": {
      "enabled": true,
      "text": "A high-speed carving turn erupts into a persistent crystalline spindrift arc.",
      "reusedSystem": "particles",
      "verificationPose": "mechanic"
    },
    "noveltyBudget": {
      "addsEngine": false,
      "addsAssetCategory": false,
      "addsPersistentBuffer": false,
      "addsMajorRenderPass": false,
      "addsSimulationSubsystem": false,
      "addsInput": false,
      "increasesAmbition": false
    }
  },
  "builderAgent": "Claude Code"
}
```

The assembler validates selection and coherence rules, fills all 38 template tokens, inlines the character recipe and foot interaction, substitutes camera mode and state channel contracts, and writes the output bundle. Target collisions are refused by default unless `--force` is specified.

Validate an assembled brief:

```bash
node check.mjs ALPINE_DAWN_TECHDEMO_PROMPT.md
```

Verify a demo an agent built from a brief:

```bash
node verify/verify_demo.mjs path/to/demo
```

Verification requires the demo to expose a `window.__demo` hook (pose setters, a
character-visibility toggle, frame stats). The brief mandates it; without it the
image gates cannot run, and the verifier says so instead of passing.

## Layout

| Path | What it is |
|---|---|
| `SKILL.md` | Skill entry point — route, interview, coherence check, assembly rules |
| `TEMPLATE.md` | Brief skeleton: 38 `{{TOKEN}}` slots and three optional sections |
| `references/modes.md` | Creative modes (Proven, Signature, Experimental) and ambition levels |
| `references/biomes.md` | Biome definitions, terrain noise layers, material behaviours, palettes |
| `references/archetypes.md` | Character archetypes as rig parameter sets, cloth panels, shading |
| `references/mechanics.md` | Centrepiece mechanics and state-buffer channel writes |
| `references/cameras.md` | Camera modes and rendering profiles |
| `references/showcases.md` | Canonical showcase configurations |
| `references/character-recipe.md` | The numeric humanoid spec, inlined verbatim into every brief |
| `references/assembly.md` | Assembly specification schema, input classification, CLI, and bundle rules |
| `selection.mjs` | Selection validator (CLI: `node selection.mjs`) and central registries |
| `check.mjs` | Brief validator (CLI) plus art-direction coherence rules (`node check.mjs coherence`) |
| `reference-loader.mjs` | Strict reference loader and token extractor |
| `assemble.mjs` | Deterministic brief assembler and safe output bundle writer |
| `verify/` | Playwright run with the image gates |
| `tests/` | `node:test` suite over all of the above |
| `docs/` | Design spec and implementation plan |

## Status

**Envizzle is in public alpha.** Progressive reference loading, central registries,
operable selection CLI, coherence CLI, deterministic brief assembly, safe project-bundle output,
test fixtures, cross-file contract verification, and strict assembly integrity (input non-mutation,
non-overridable structural coherence errors, source preflight, independent section replacement,
state-buffer omission across all five mechanics) are implemented, and all unit tests pass (`npm test`).
Multi-agent generated-demo benchmarking remains listed as future work. See `docs/2026-07-29-envizzle-skill-design.md` for the reasoning behind the
design and `docs/2026-07-29-envizzle-skill.md` for the task plan it was built from.

The original prompt templates this skill was distilled from
(`BIOME_TECHDEMO_TEMPLATE.md`, `TEMPLATE.md`, `TEMPLATE_GUIDE.md`,
`verify_demo.mjs`) lived in `legacy/` during the migration and were removed once
their content was mined. Recover any with:

```bash
git log --diff-filter=D --summary -- legacy/
git restore --source=<deletion-commit>^ -- legacy/<file>
```

## Attribution

MIT licensed — see [LICENSE](LICENSE). The licence requires that the copyright
notice be retained in copies and substantial portions, so if you build on envizzle,
keep the notice and a link back to this repo.

Distilled from a prompt template developed for [SnowVR](https://github.com/boxwrench/SnowVR),
which itself grew out of the `snowflow_demo` tech demo brief.
