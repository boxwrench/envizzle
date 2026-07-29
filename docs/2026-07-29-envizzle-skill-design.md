# Design: `envizzle` Skill

Invoked as `/envizzle`. Emits a self-contained implementation brief for a
one-shot, visually impressive real-time graphics tech demo.

**Date:** 2026-07-29
**Status:** Approved, ready for implementation planning

## Problem

`prompt template/` currently holds a fill-in-the-blanks prompt system: `TEMPLATE.md`
(condensed, ~9 KB), `BIOME_TECHDEMO_TEMPLATE.md` (long form, ~49 KB),
`TEMPLATE_GUIDE.md`, and `prompt_builder.html` (a standalone form with ~25 freeform
text fields). Filling it produces a Markdown brief that is handed to a coding agent,
which builds the demo. There is no packaged skill.

The system works for some systems and fails for others, and the failure is
structural. Compare what the brief hands the agent:

| System | Specification given |
|---|---|
| Grass | 4 named rings with distances, blades/m² per ring, a density law, a CPU thinning algorithm |
| State buffer | 256×256, RGBA16F, 2 cm texels, named channels, decay tuned to 60 s |
| Terrain | Clipmap rings, sub-10 cm spacing, noise layers with scale and amplitude |
| **Character** | One textarea of adjectives |

Every system specified numerically got built. The character, specified as prose, did
not. In the reference output (`COSMIC_VALLEY`, built by Gemini Flash 3.6), the
character in `src/character/player.js:30-77` is a `CylinderGeometry` torso, a
`SphereGeometry` head, two `BoxGeometry` shoulders, and a `BoxGeometry` gun. No
skeleton, no limbs, no legs, no gait, no IK. It reads on screen as a magenta
scarecrow. Section 2.5's requirement that "feet must plant rather than slide" is
unimplementable, because there are no feet.

Three contributing causes, all fixable in the brief:

1. **No construction recipe.** The brief describes what the character should look
   like but never how to build a humanoid procedurally with zero assets.
2. **An explicit escape hatch.** `BIOME_TECHDEMO_TEMPLATE.md:447` reads: "If a rig
   and locomotion animation cannot be brought to a high standard, prefer a fully
   cloth- and procedurally driven figure over a stiff or poorly animated one." The
   agent read this as permission to skip the rig entirely.
3. **No coherence checking.** The reference config paired the Ghibli Painterly
   paradigm with a palette of `#080810` obsidian and `#2b0052` violet. Painterly
   rendering reads as beautiful because it is high-key and luminous; against a
   near-black palette it produces the muddy dark frames visible in the captured
   screenshots. Nothing flagged the contradiction.

A fourth problem is in verification rather than the brief: one of the three captured
milestone screenshots is a near-black frame with the camera clipped inside a spire,
and the run still reported success.

## Goals

- A packaged skill that interviews the user, checks their choices for coherence, and
  emits a self-contained brief.
- Characters that read as finished figures rather than assembled primitives.
- Options a non-graphics-engineer can select meaningfully, including a "pick for me"
  path.
- Verification that cannot pass on a broken frame.

## Non-goals

- Changing the SnowVR demo itself. This work is confined to `prompt template/`,
  `docs/`, and `~/.claude/skills/`.
- Gameplay, progression, or UI design. The emitted brief remains a graphics tech
  demo brief.
- Supporting non-humanoid body types this round (see Decisions).

## Architecture

Source of truth lives in the repo; a copy is installed for personal use.

```
prompt template/skill/
├── SKILL.md                    router, interview flow, assembly rules
├── TEMPLATE.md                 brief skeleton with {{TOKEN}} slots
├── references/
│   ├── character-recipe.md     numeric humanoid construction spec
│   ├── showcase-configs.md     ~6 complete coherence-checked configs
│   ├── biomes.md               biome presets
│   ├── archetypes.md           character archetypes as rig parameters
│   ├── mechanics.md            centrepiece mechanic presets
│   ├── cameras.md              camera and presentation modes
│   ├── systems-optional.md     optional system axes
│   └── coherence.md            conflict rules
└── verify/
    └── verify_demo.mjs         hardened image gates
```

Installed to `~/.claude/skills/envizzle/` as a copy. The repo path is
authoritative; the install is a build artifact.

`prompt_builder.html` is retained unchanged as an optional manual path. Adding the new
presets and ambition dial to its UI is explicitly out of scope this round; the skill's
interview replaces it as the primary path, and duplicating the preset libraries into
HTML would create a second place to keep in sync.

The existing `prompt template/verify_demo.mjs` is superseded by
`skill/verify/verify_demo.mjs`, which is a rewrite rather than an edit — the gates are
different in kind, not degree. The old file is deleted once the new one passes its
fixture tests.

### Data flow

```
user request
  → SKILL.md interview (or "pick for me" → showcase config)
  → coherence.md check → report conflicts, offer fixes, user confirms
  → assemble: TEMPLATE.md + expanded preset text + character-recipe.md inlined
  → emit <PROJECT>_TECHDEMO_PROMPT.md + verify/ + HANDOFF.md
  → target agent builds demo
  → verify_demo.mjs gates → pass or mandated retake loop
```

The emitted brief must be fully self-contained. The target agent may be any model
(the reference run used Gemini Flash 3.6) and sees only that one file, so
`character-recipe.md` is **inlined in full at assembly time**, never referenced by
path.

## Components

### 1. `references/character-recipe.md`

The core fix. Gives the character the same numeric treatment grass already receives.

**Skeleton.** 18 bones with absolute rest positions in meters for a 1.75 m figure:
hips 0.95 · spine01 1.10 · spine02 1.28 · chest 1.42 · neck 1.52 · head 1.62 ·
clavicle and upperArm ±0.19 at 1.44 · elbow 1.16 · wrist 0.90 · thigh ±0.09 at 0.92 ·
knee 0.52 · ankle 0.10 · toe 0.02. Segment lengths stated explicitly so "build a rig"
has one interpretation.

**Geometry.** One continuous skinned mesh built from lofted cross-section rings. Each
limb and the torso is a spline carrying N rings; each ring has a radius *and* an
ellipse ratio, so limbs are not tubes.

- Torso: 12 rings, radius 0.16 → 0.19 → 0.17 → 0.14, ellipse ratio 1.0 → 1.35
  (chest wider than deep)
- Arm: 8 rings, radius 0.055 → 0.040 → 0.032
- Leg: 10 rings, radius 0.085 → 0.055 → 0.038
- 12–16 segments per ring, stitched into triangle strips, ends capped
- Skin weights derived deterministically from arc-length position along the chain,
  with a 0.08 m smooth falloff at joints — computable, requiring no hand-rigging
- Target ~3–4 k triangles

**Gait.** Distance-driven, which makes sliding impossible by construction rather than
by discipline. `gaitPhase += distanceThisFrame / strideLength`, where
`strideLength = 0.78 × legLength × (1 + 0.35 × speedNorm)`. Stance spans phase
0 → 0.6 and holds the locked world position; swing spans 0.6 → 1.0 and arcs 0.12 m to
the predicted touchdown point via smoothstep. Two-bone analytic IK by law of cosines
for hip → knee → ankle, knee pole vector forward — roughly 20 lines, no solver
dependency. Secondary motion: pelvis bob `−0.035 × (1 − cos 4π·phase) / 2`, pelvis
roll ±3°, counter-rotating shoulders, arm swing ±22° with 12–35° elbow flex, spine
lean into acceleration clamped to [−8°, +12°], head counter-rotated to hold a level
gaze.

**Foot planting.** Architectural rather than aspirational. On touchdown, write
`plantedPos[leg]` once from a terrain raycast, storing hit point and normal. During
stance the IK target reads only from that stored vector, and no code path writes to
it — the existing template asks for this outcome but never states the mechanism. Foot
orientation aligns to the terrain normal at 0.7 blend. The state-buffer splat and the
footfall audio event emit from the same call site as the plant write, so they cannot
desync.

**Prohibitions.** Currently absent, and their absence is the proximate cause of the
failure:

- `BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `CapsuleGeometry`, and
  `ConeGeometry` are forbidden anywhere in character code.
- A character assembled from separate per-body-part meshes is a defect, not a
  stepping stone.
- Omitting legs is permitted only when the chosen archetype specifies a hidden lower
  body *and* cloth reaches the ground.
- The `BIOME_TECHDEMO_TEMPLATE.md:447` escape hatch is deleted, not softened.

**Framing.** The character occupies 12–18% of frame height at default third-person
zoom, uses the shared lighting include, and carries rim light so the silhouette reads
against sky.

### 2. Preset libraries

`showcase-configs.md` holds ~6 complete configs with every token filled, each already
coherence-checked, each with one line on why it reads as AAA:

| Config | Paradigm and palette intent |
|---|---|
| Alpine Dawn | Photoreal snow, high-key blue and gold |
| Hoshi-no-Tani | Painterly valley, luminous greens and golds |
| Dune Sea | Photoreal desert, amber and rose |
| Tidal Shelf | Stylized ocean shelf, teal and white |
| Emberfall | Volcanic — deliberately demonstrates a *disciplined* dark scene |
| Neon Monsoon | Night city rain, heavy practical lights, wet reflections |

"Pick for me" selects one of these whole. It never mixes presets, because
recombination is what produced the incoherent reference config.

`biomes.md`, `archetypes.md`, `mechanics.md`, `cameras.md`, and `systems-optional.md`
supply à-la-carte pieces for custom builds. Each biome entry carries numeric noise
layers with scale and amplitude, palette hexes, far-field treatment, material
behaviours, vegetation spec, state-buffer channels, audio spec, and atmospheric life.

Archetypes are **parameters on the single rig**, not alternative bodies: height, ring
radius multipliers, cloth panel list with Verlet grid dimensions, material
parameters, head covering, and foot interaction.

`cameras.md` covers third-person action-MMO (current hardcoded default),
first-person, cinematic orbit and flythrough, top-down, and VR/XR — each noting what
the character must look good from.

`systems-optional.md` covers time-of-day and weather, water and reflections,
architecture and structures, volumetrics and post-processing look, creature life
beyond boids, and destructibility.

### 3. `references/coherence.md`

Rules evaluated after selection and before assembly:

- Painterly paradigm requires mean scene luminance ≥ 0.35 and a lightest palette
  value ≥ `#d8d0b8`. The reference config's `#080810` and `#2b0052` fail here.
- Every palette needs ≥3 distinct value tiers spanning ≥0.55 in luminance.
- Emissive and neon accents are capped at roughly 15% of screen area.
- Photoreal with zero assets requires multi-scale procedural normals.
- Painterly with zero assets requires a palette table plus a cel ramp.

Conflicts are reported to the user with a suggested fix. They are not silently
auto-corrected, because the user may have a deliberate intent the rules do not model.

### 4. Ambition dial

| Level | Systems included |
|---|---|
| Slice (default) | Terrain, material, character, one mechanic, atmosphere — ~6 |
| Showcase | Adds vegetation, wind field, state buffer, audio, atmospheric life — ~11 |
| Everything | Adds 2–3 optional axes |

Sections not selected are omitted from the emitted brief entirely rather than left as
unfilled placeholders, so the target agent never sees dead tokens.

Slice is the default because a true one-shot collapses under a dozen systems.
Showcase is roughly the current level.

### 5. Verification

The brief gains a hard requirement: the demo must expose a `window.__demo` hook with
pose setters, a `?hideCharacter=1` toggle, and frame statistics. Without it none of
the gates below are checkable, which is why the black frame passed.

`verify_demo.mjs` gates:

| Gate | Threshold |
|---|---|
| Mean luminance | within [0.12, 0.85] |
| Flat-frame rejection | fail if >70% of pixels fall within 2% of a single value |
| Character visible | screenshot with and without character; changed area 3–20% of frame |
| Camera not inside geometry | nearest depth > 0.3 m |
| Performance | median and p99 frame time reported, gated |

The character-visible diff is the important one: it is essentially unfakeable, since
the only way to pass is for a character to actually occupy plausible screen area.

Gate failures trigger a mandated retake loop in the brief rather than a pass.

## Error handling

- **Coherence conflict:** reported with suggested fix; user confirms or overrides.
  Overrides are recorded in the emitted brief so the target agent knows the choice
  was deliberate.
- **Missing `window.__demo` hook:** verification fails with a specific message naming
  the hook, rather than a generic failure.
- **Gate failure:** the brief instructs the agent to fix and re-capture, not to
  proceed. Acceptance criteria list the gates explicitly.
- **Unknown preset name:** the skill lists valid names rather than guessing.

## Testing

The skill's output is a document, so testing focuses on the parts that can fail
mechanically:

1. **Assembly tests.** For each of the ~6 showcase configs, assemble the brief and
   assert: no unreplaced `{{TOKEN}}` remains, the character recipe is present in
   full, and omitted-section content is absent at Slice level.
2. **Coherence rule tests.** Feed the known-bad reference config (`#080810` +
   `#2b0052` + painterly) and assert it is flagged. Feed each showcase config and
   assert none is flagged.
3. **Verification script tests.** Run `verify_demo.mjs` gates against fixture
   images: the actual black `milestone_locomotion.png` from the reference output must
   fail the flat-frame and luminance gates; `milestone_idle.png` must fail the
   character-visible gate only if the character diff is out of range.
4. **End-to-end, manual.** Emit one brief, hand it to an agent, confirm the character
   is a rigged figure rather than primitives.

Fixture images come from the `screenshots/` directory of the reference output — the
demo built from the predecessor template by Gemini Flash 3.6 — referred to
throughout the plan as `$REFERENCE_OUTPUT`. That run produced genuine known-bad
frames, including one near-black frame that the old verifier passed, so the gates
are tested against real failures rather than only synthetic ones.

## Decisions

**One rigged humanoid, archetypes reskin it.** Rejected shipping separate recipes for
floating entities, quadrupeds, and mounted riders. Three or four shallow recipes are
worse than one deep one, and the failure mode being fixed is shallowness. Non-humanoid
body types can be added later once the humanoid recipe is proven.

**"Pick for me" selects a whole config, never mixes.** Recombining independently
reasonable presets is exactly how the reference config ended up with a painterly
paradigm over a near-black palette.

**Character recipe is inlined, not referenced.** The target agent is not necessarily
Claude and has no access to the skill directory.

**Coherence conflicts are reported, not auto-fixed.** The rules encode defaults, not
truth; a user may want something the rules reject.

**Repo is source of truth, `~/.claude/skills/` holds a copy.** Accepts a sync step in
exchange for version control plus global availability.

**Slice is the default ambition level.** The stated goal is one-shot or near-one-shot
success, and system count is the main thing working against that.
