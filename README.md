# envizzle

A Claude Code skill that emits a self-contained implementation brief for a
one-shot, visually impressive real-time graphics tech demo.

Invoked as `/envizzle`. It interviews you (or picks a config for you), checks your
art-direction choices for internal contradictions, and writes a single Markdown
brief you hand to any coding agent.

## Why it exists

The predecessor was a fill-in-the-blanks prompt template. It specified grass with
four distance rings, blades per square metre, and a density law — and grass got
built correctly. It specified the character with a paragraph of adjectives, and
the character came back as a cylinder, a sphere, and three boxes.

envizzle fixes that asymmetry. The character gets the same numeric treatment
everything else already had: an 18-bone skeleton with rest positions in metres,
lofted cross-section ring geometry, gait phase driven by ground distance so foot
sliding is impossible by construction, and an explicit prohibition on primitive
geometry.

It also catches art-direction contradictions the old template could not. A
painterly paradigm over a near-black palette produces muddy frames; that
combination is now rejected before a brief is written.

## Layout

| Path | What it is |
|---|---|
| `SKILL.md` | Skill entry point — interview flow and assembly rules |
| `TEMPLATE.md` | Brief skeleton with `{{TOKEN}}` slots |
| `references/character-recipe.md` | The numeric humanoid spec, inlined into every brief |
| `lib/presets/` | Biomes, archetypes, mechanics, cameras, showcase configs |
| `lib/coherence.mjs` | Art-direction conflict rules |
| `lib/assemble.mjs` | Brief assembler + CLI |
| `verify/` | Playwright run with image gates that reject blank frames |
| `docs/` | Design spec and implementation plan |
| `legacy/` | The original templates, kept until their content is mined |
| `prompt_builder.html` | Standalone manual form, an alternative to the interview |

The repo root *is* the skill root, so it can be cloned or symlinked directly into
`~/.claude/skills/envizzle/`.

## Usage

```bash
npm install
npm test

# Emit a brief from a showcase config
node lib/assemble.mjs alpineDawn --out ALPINE_DAWN_TECHDEMO_PROMPT.md

# Verify a demo an agent built from a brief
node verify/verify_demo.mjs path/to/demo

# Install as a personal skill
node install.mjs
```

`~/.claude/skills/envizzle/` is a generated copy. Edit here, then re-run
`node install.mjs`.

## Status

Design and plan are complete and committed under `docs/`. Implementation has not
started — `SKILL.md`, `lib/`, `verify/`, and `tests/` do not exist yet.

Origin: distilled from the prompt template that previously lived in
`SnowVR/prompt template/`.
