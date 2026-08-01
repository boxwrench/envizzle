# Build Contract and Milestone Evidence

`writeBundle` emits `ENVIZZLE_BUILD.json` beside the generated brief. It is a
versioned, deterministic contract created from the same validated assembly model
as the Markdown brief. It is descriptive: it does not add artistic thresholds
or replace the verifier's existing acceptance rules.

## Contract

The top-level keys are exactly `schemaVersion`, `project`, `selection`,
`stateChannels`, `creative`, `acceptance`, and `milestones`.

`project` records the safe project name, deterministic brief filename, complete
rendering-profile tuple, rendering paradigm, exact zero-asset wording, target
hardware, and core interaction sentence. `selection` records the mode, route,
base showcase, ambition, canonical section lists, biome, archetype, mechanic,
camera, camera adjustments, and changed axes.

`stateChannels` is the validated state-buffer contract. Each channel records its
native biome meaning, owning state-buffer system, mechanic writer, material
reader, visible effect, and the existing zero baseline/recovery text. When the
state-buffer section is omitted, the channel map is empty and the disabled/no-op
behavior is explicit.

`creative` records the creative spark, bounded Signature Moment, all novelty
budget flags, and any deliberate coherence overrides. Proven mode has no
independent Signature Moment and every novelty flag is false.

`acceptance` records the existing required project paths, production build,
verification hook, runtime, capture, image-gate, camera, and report
expectations. It does not introduce new image thresholds.

## Milestones

The contract contains exactly these ordered milestone IDs:

1. `first-runnable-scene`
2. `systems-complete`
3. `final-polish`

Each defines required checks, screenshot poses, console evidence,
`fps`/`frameTimeMs` performance evidence, visual self-review fields, and
completion semantics. The generated brief and `HANDOFF.md` repeat those
instructions so the builder records evidence while working.

## Evidence

`ENVIZZLE_EVIDENCE.json` is an empty deterministic template. Its top-level
status and each milestone status are either `complete` or exactly
`incomplete verification`. Each milestone records screenshot filenames,
console errors and warnings, performance values, and a visual self-review with
weaknesses and corrections.

Missing screenshot capability or missing required evidence must remain
`incomplete verification`; it is never converted into a pass. A complete
milestone requires screenshots, no console errors, finite performance values,
and `reviewed: true`. The evidence validator requires all three milestone IDs in
canonical order and rejects duplicate, missing, reordered, or unknown entries.

Both JSON files use stable key/array order, two-space indentation, a final
newline, and contain no timestamps, random IDs, absolute paths, or environment
data. Contract validation and brief/contract agreement validation run before a
bundle is written.
