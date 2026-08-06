# Creative Modes and Ambition Levels

This reference defines Envizzle's creative modes (freedom budgets) and ambition levels (section inclusions).

## Contents

- [Creative modes](#creative-modes)
  - [Proven](#proven)
  - [Signature](#signature)
  - [Experimental](#experimental)
- [Ambition levels](#ambition-levels)

---

## Creative modes

Envizzle provides three explicit creative modes. Every brief specifies one creative mode that defines the freedom budget for artistic novelty and system customization. Disabling `ENABLE_SIGNATURE_MOMENT` must restore the selected configuration without the Signature Moment.

### Proven

- Select one showcase configuration as a whole from [showcases.md](showcases.md).
- Do not enter the full Step 2 interview; continue directly to Step 3.
- Do not ask for a creative spark.
- Do not change its ambition, biome, archetype, mechanic, camera, or rendering profile.
- Do not add an independent Signature Moment.
- Treat the configured centrepiece mechanic and its strongest existing visual consequence as the signature shot.
- Permit implementation creativity only inside existing specified systems (composition, timing, shader mechanics, and polish).
- Set `ENABLE_SIGNATURE_MOMENT` to `false`; it is a no-op and no independent Signature Moment code path is required.

### Signature

- **Signature is the default creative mode.**
- Select one showcase configuration as a whole from [showcases.md](showcases.md).
- Do not enter the full Step 2 interview; continue directly to Step 3.
- Do not change its ambition, biome, archetype, mechanic, camera, or rendering profile.
- Invent exactly one Signature Moment that reuses existing specified systems.
- Enable `ENABLE_SIGNATURE_MOMENT` by default; disabling it restores the selected whole showcase without the Signature Moment.
- Ask only the optional creative-spark question (visual memory, material, emotion, or natural phenomenon) to influence the Signature Moment, unless the user said "pick for me."
- If no spark is supplied or user said "pick for me," use "surprise me."

### Experimental

Experimental permits controlled customization via two explicit paths:

1. **Base-showcase path:**
   - Begin from one named showcase configuration from [showcases.md](showcases.md).
   - Change at most one major axis: Ambition, Biome (including palette, paradigm, material behavior, and terrain values from [biomes.md](biomes.md)), Archetype (from [archetypes.md](archetypes.md)), Mechanic (from [mechanics.md](mechanics.md)), or Camera (from [cameras.md](cameras.md)).
   - Ask which single major axis will change and ask only the relevant Step 2 question for that selected axis. Do not run the remaining interview questions.
   - A rendering-profile change does not count as the single creative axis, provided it uses a complete supported rendering-profile tuple from [cameras.md](cameras.md).
   - Project name and hardware-target edits do not count as creative axes.
   - Ask the optional creative-spark question.
   - Enable `ENABLE_SIGNATURE_MOMENT` by default; disabling it restores the configuration after its one approved axis change without the Signature Moment.
   - Run required compatibility checks and continue to Step 3.

2. **Fully custom path:**
   - Enter the full Step 2 interview (`Step 2 — Fully custom interview`). Ask each Step 2 question in order.
   - Ask the optional creative-spark question.
   - Enable `ENABLE_SIGNATURE_MOMENT` by default; disabling it restores the fully custom configuration without the Signature Moment.
   - Use only named biome, archetype, mechanic, camera, ambition, and rendering-profile options from the reference files.
   - Originality comes from their deliberate combination and the Signature Moment, not from inventing unsupported engine or system contracts.
   - Continue to Step 3.

The Experimental fully custom path is the only path that runs the complete Step 2 interview.

**Experimental Mode Rules:**
- Never select Experimental automatically; require explicit user selection.
- Run `checkCoherence` on the final configuration.
- Run `validateSelection` from `selection.mjs` to verify the explicit state-channel contract, camera adjustments, ambition levels, and mode contracts.
- Record selection changes and compatibility decisions in the assembly specification. `assemble.mjs` records them in the generated brief's Assembly Decisions section and build contract. The builder creates the project's `DECISIONS.md`, recording implementation decisions, resolved engine version, trade-offs, deviations, and compatibility work.

---

## Ambition levels

`TEMPLATE.md` wraps three of its subsections in `<!--SECTION:name-->` markers. The
ambition level decides which survive. **An unselected section is deleted from the brief
entirely — body, opening marker, and closing marker.** A section left in with its tokens
unfilled is a hole, and `check.mjs` fails the brief for it; a marker left behind after
the body is deleted is also a failure. Delete cleanly.

| Level | Sections kept | What the demo contains | Tokens that must be filled |
|---|---|---|---|
| **`slice`** *(default)* | none | Terrain, primary material, character, one centrepiece mechanic, atmosphere. | Everything outside the three marked sections. |
| `showcase` | `vegetation`, `state-buffer`, `audio` | Adds vegetation, the wind field, the terrain state buffer, procedural audio, and atmospheric life. | All of the above plus `GRASS_SYSTEM_SPEC`, `WIND_FIELD_ARCH`, `STATE_BUFFER_*`, `DEFORMATION_*`, `RECOVERY_*`, `AUDIO_ENGINE_SPEC`, `ATMOSPHERIC_LIFE_SPEC`. |
| `everything` | `vegetation`, `state-buffer`, `audio` | Adds weather, water bodies, architecture, and destructibility as extra §2.9+ subsections written from the biome's own values. | All tokens, plus the four appended subsections. |

**`slice` is the default, and the default is correct for most people.** A one-shot build
collapses under a dozen systems: the agent spreads its budget across vegetation, audio,
weather, and water, and every one of them lands at 60% quality. The thing that reads as
AAA in a screenshot is one exceptional material under one exceptional sky with a figure
that moves correctly. `slice` is that, and nothing else. Choose `showcase` when the
biome's identity actually depends on vegetation or a persistent surface state — Ghibli
Valley without grass is not Ghibli Valley. Choose `everything` only when the builder has
real time and is willing to lose some of it.

Section-to-level mapping, precisely:

- `vegetation` — §2.4, consumes `GRASS_SYSTEM_SPEC`. Kept at `showcase` and `everything`.
- `state-buffer` — §2.3, consumes `DEFORMATION_TYPE`, `WIND_FIELD_ARCH`,
  `STATE_BUFFER_COVERAGE`, `STATE_BUFFER_TEXEL_SIZE`, `STATE_BUFFER_CHANNELS`,
  `RECOVERY_MECHANISM`, `DEFORMATION_MARKS`, `RECOVERY_OUTCOME`. Kept at `showcase` and
  `everything`.
- `audio` — §2.8, consumes `AUDIO_ENGINE_SPEC` and `ATMOSPHERIC_LIFE_SPEC`. Kept at
  `showcase` and `everything`.

At `slice`, biomes still publish their state-buffer and audio values in [biomes.md](biomes.md). Leave them
unused; do not delete them from the preset reference, and do not keep the section "just in case."
