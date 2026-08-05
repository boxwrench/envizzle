# Visual Review Checklist

This reference defines the human-review question checklist used to judge captured evidence independently of the builder's own self-report — one subsection per review category, mirroring `ENVIZZLE_BUILD.json`'s `reviewCriteria.universal` entries.

## Contents

- [Biome Identity](#biome-identity)
- [Composition](#composition)
- [Terrain Quality](#terrain-quality)
- [LOD Continuity](#lod-continuity)
- [Material Quality](#material-quality)
- [Character Silhouette](#character-silhouette)
- [Character Scale](#character-scale)
- [Locomotion Readability](#locomotion-readability)
- [Mechanic Readability](#mechanic-readability)
- [Placeholder Detection](#placeholder-detection)
- [Visual Hierarchy](#visual-hierarchy)
- [Scope Discipline](#scope-discipline)
- [Biome-Specific Criteria](#biome-specific-criteria)

---

This checklist is applied by a reviewing pass that is independent of the builder (see `references/implementation-planning.md#implementation-vs-independent-review`). It is not a restatement of the builder's own required outputs — it asks whether the captured evidence actually looks and reads correctly to an outside eye, which is a different question than whether the listed steps were performed.

Each category below is a `reviewCriteria.universal` entry in the build contract, keyed by its `category` slug. Answer every question against the actual captured screenshots and diagnostics for the milestone under review, not against the intent described in the brief.

### Biome Identity

- Does the scene immediately read as the selected biome without being told what it is?
- Are the biome's signature morphology, materials, and lighting present and dominant?

### Composition

- Is the frame composed with a clear focal subject and readable depth?
- Does the camera framing match the selected camera mode's intent?

### Terrain Quality

- Does the terrain show continuous, natural elevation rather than repeated primitive shapes?
- Are terrain normals and shading consistent with the claimed elevation?

### LOD Continuity

- Are LOD or clipmap boundaries seamless, with no visible popping, cracks, or grid seams?
- Does terrain detail degrade gracefully with distance rather than dropping abruptly?

### Material Quality

- Do materials read as the intended surface type rather than a flat placeholder color?
- Is the approved palette respected and coherent across surfaces?

### Character Silhouette

- Is the character an intentional, readable silhouette rather than a primitive box, capsule, or sphere?
- Does the archetype's identity read clearly at the verification camera distance?

### Character Scale

- Is the character scaled plausibly relative to the terrain and environment?
- Does the character avoid appearing miniature or oversized against nearby landmarks?

### Locomotion Readability

- Are idle and locomotion poses visually distinguishable from each other?
- Does foot planting track the terrain surface without floating or clipping?

### Mechanic Readability

- Is the centrepiece mechanic immediately distinguishable from idle and locomotion when captured?
- Does the mechanic visibly affect the state-buffer-driven surface when enabled?

### Placeholder Detection

- Are there any unstyled default materials, missing textures, or debug-only primitives visible?
- Does anything in the frame look like scaffolding rather than a finished demo?

### Visual Hierarchy

- Does the eye land on the character or mechanic first, not on background noise?
- Is lighting and contrast used to separate subject from environment?

### Scope Discipline

- Does the captured scene match the current stage's allowed scope, with no later-stage systems built ahead of schedule?
- Is anything visible that the current milestone's requiredOutputs do not yet justify?

## Biome-Specific Criteria

Beyond the twelve universal categories above, the build contract's `reviewCriteria.biomeSpecific` adds any morphology anti-patterns and biome-specific review questions defined for the selected biome (for example, the Dune Desert anti-pattern list in `references/biomes.md`). Apply these alongside the universal checklist, not instead of it — a scene can pass every universal question and still fail a biome-specific one, such as representing dunes as a repeated primitive shape rather than a continuous ridge form.

## Environment Composition Review

Before capturing the second (post-correction) screenshot, inspect the first `environment_only.png` against every question below. Silence on a question is not a pass — write down what you actually see.

- **Biome identity:** Does the frame read as the selected biome within one second, with no caption?
- **Large-scale form:** Is the dominant landform (dune field, valley wall, reef shelf, caldera, skyline block) immediately legible at a glance?
- **Medium-scale form:** Do secondary features (ridgelines, terraces, shoreline breaks, district blocks) read as distinct from the dominant form rather than blending into noise?
- **Fine-scale form:** Does close-range surface detail (ripples, foliage, rubble, cracked pavement) avoid looking like a tiling texture repeat?
- **Hero composition:** Is there one unmistakable focal element the eye lands on first?
- **Foreground/midground/background separation:** Can you point to where each layer starts and ends without hesitating?
- **Lighting reveals form:** Does the light direction actually carve out the large-scale form's windward/lee, sunlit/shadowed, or lit/unlit distinction, rather than flatting everything to one value?
- **Atmospheric depth:** Does distance fade, haze, or color-temperature shift make the background read as farther away than the foreground?
- **Visual anti-patterns:** Call out, by name, whether any of the biome's documented anti-patterns (see `biomes.md`) are present.

Record every weakness found, even minor ones — an empty weaknesses list is itself a review failure per the evidence contract (`environment-composition` requires at least one nonblank weakness to pass). Make at least one correction in response, then re-run `node verify/verify_demo.mjs . --stage environment-composition` to capture the corrected `environment_only.png`/`idle.png` before recording the stage as `passed`.
