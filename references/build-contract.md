# Build Contract and Milestone Evidence

`writeBundle` emits `ENVIZZLE_BUILD.json` beside the generated brief and copies the owned verifier files (`verify/README.md`, `verify/gates.mjs`, `verify/report.mjs`, `verify/verify_demo.mjs`). It is a versioned, deterministic contract created from the same validated assembly model as the Markdown brief. It is descriptive: it does not add artistic thresholds or replace the verifier's existing acceptance rules.

## Contract

The top-level keys are exactly `schemaVersion`, `project`, `selection`, `stateChannels`, `creative`, `acceptance`, `milestones`, `sourceOfTruth`, `architecture`, `approvedPatterns`, `forbiddenPatterns`, `implementationPlan`, `diagnostics`, and `reviewCriteria` — fourteen keys in that order.

`project` records the safe project name, deterministic brief filename, deterministic SHA-256 brief hash (`briefSha256`), complete rendering-profile tuple, rendering paradigm, exact zero-asset wording, target hardware, and core interaction sentence. `selection` records the mode, route, base showcase, ambition, canonical section lists, biome, archetype, mechanic, camera, camera adjustments, and changed axes.

`stateChannels` is the validated state-buffer contract. Each channel records its native biome meaning, owning state-buffer system, mechanic writer, material reader, visible effect, and the existing zero baseline/recovery text. When the state-buffer section is omitted, the channel map is empty and the disabled/no-op behavior is explicit.

`creative` records the creative spark, bounded Signature Moment, all novelty budget flags, and any deliberate coherence overrides. Proven mode has no independent Signature Moment and every novelty flag is false.

`acceptance` records the existing required project paths, production build, verification hook, runtime, capture, image-gate, camera, and report expectations. It does not introduce new image thresholds.

`sourceOfTruth` is the frozen builder-role declaration: the builder implements an already-designed system, may not redesign architecture, add fallbacks, skip stages, or ignore failed checks, and must stop and report on conflict. It lists the required bundle inputs (`<PROJECT>_TECHDEMO_PROMPT.md`, `ENVIZZLE_BUILD.json`, `ENVIZZLE_EVIDENCE.json`, `HANDOFF.md`, `verify/`) the builder must consume together. `architecture` records the per-rendering-profile file-ownership map (which source file owns which responsibility) and the terrain elevation ownership rules — GPU owns render elevation at base height 0, the CPU height mirror exists only for physics/camera-clearance/foot-planting, and a required CPU/GPU parity test with its tolerance.

`approvedPatterns` and `forbiddenPatterns` are per-rendering-profile registries of implementation patterns, each entry an `{id, requirement/reason, detection}` triple (`forbiddenPatterns` entries also carry `blocking`). `detection` is a human-readable classification (`source-only`, `source-and-runtime`, `runtime-only`, `visual-review`, `evidence-record`, `process`); the executable regex for the source-checkable forbidden patterns lives only in `verify/patternScan.mjs`, keyed by the same `id`. `implementationPlan` is the ordered list of five build stages (`backend-proof`, `terrain-kernel`, `environment-composition`, `character-locomotion`, `mechanic-polish`); each stage records its goal, allowed scope, required outputs, the approved/forbidden pattern IDs that apply to it, automated and visual checks, stop conditions, required evidence, and `doNotProceedUntilPassed: true`.

`diagnostics` is the per-rendering-profile shape of the `window.__demo` runtime hook: its lifecycle statuses, the exact keys and accepted values for `rendererInfo()`, and the terrain/camera diagnostics contracts (render ownership, parity method and tolerance, allowed camera-depth methods and minimum depth). `reviewCriteria` pairs a frozen, always-present `universal` list of twelve visual-review categories (biome identity, composition, terrain quality, LOD continuity, material quality, character silhouette/scale, locomotion and mechanic readability, placeholder detection, visual hierarchy, scope discipline) with a `biomeSpecific` array sourced from the selected biome's optional `MORPHOLOGY_ANTI_PATTERNS`/`VISUAL_REVIEW_QUESTIONS` tokens in `references/biomes.md`; it is an empty array for biomes that do not yet define those tokens.

## Milestones

The contract contains exactly these ordered milestone IDs:

1. `first-runnable-scene`
2. `systems-complete`
3. `final-polish`

Each defines required checks, screenshot poses, console evidence, `fps`/`frameTimeMs` performance evidence, visual self-review fields, and completion semantics. The generated brief and `HANDOFF.md` repeat those instructions so the builder records evidence while working.

## Evidence

`ENVIZZLE_EVIDENCE.json` is an empty deterministic template. Its top-level status and each milestone status are either `complete` or exactly `incomplete verification`. Each milestone records screenshot filenames, console errors and warnings, performance values, and a visual self-review with weaknesses and corrections.

Missing screenshot capability or missing required evidence must remain `incomplete verification`; it is never converted into a pass. A complete milestone requires unique screenshot filenames matching pose requirements (`milestone_idle.png`, `milestone_locomotion.png`, `milestone_mechanic.png`), zero console errors, finite non-negative performance values (`fps`, `frameTimeMs`), `reviewed: true`, and nonblank entries in `weaknesses` and `corrections`. The evidence validator requires all three milestone IDs in canonical order and rejects duplicate, missing, reordered, or unknown entries.

Both JSON files use stable key/array order, two-space indentation, a final newline, and contain no timestamps, random IDs, absolute paths, or environment data. Contract validation and brief/contract agreement validation run before a bundle is written.
