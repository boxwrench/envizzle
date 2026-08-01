# Envizzle Generated-Demo Benchmarking Reference

This document describes the benchmark harness, case registry, automated verification integration, human visual rubric, result collection, and comparative summary generation.

## Contents

- [Overview & Intent](#overview--intent)
- [Suite Definitions](#suite-definitions)
- [Preparing Benchmark Bundles](#preparing-benchmark-bundles)
- [Agent Prompt Handoff](#agent-prompt-handoff)
- [Running Automated Verification](#running-automated-verification)
- [Human Visual & Creativity Rubric](#human-visual--creativity-rubric)
- [Scoring Anchors (1, 3, and 5)](#scoring-anchors-1-3-and-5)
- [Collecting Benchmark Results](#collecting-benchmark-results)
- [Summarizing Benchmark Runs](#summarizing-benchmark-runs)
- [Automated Eligibility vs Subjective Scores](#automated-eligibility-vs-subjective-scores)
- [Reproducibility & Brief Hashes](#reproducibility--brief-hashes)
- [What Batch 8 Intentionally Does Not Automate](#what-batch-8-intentionally-does-not-automate)

---

## Overview & Intent

The Envizzle benchmark harness turns procedural tech demo briefs into measurable, repeatable evaluation runs across different AI coding agents.

Automated verification enforces technical hard gates (build compilation, runtime hook readiness, rendering luminance, flat-frame ratio, character visibility, camera depth, and performance metrics), while an optional human rubric evaluates visual identity and creative craft.

Automated correctness and human visual judgment remain strictly separate: subjective creativity scores never override a failed automated build or image gate.

---

## Suite Definitions

The registry defines eight benchmark cases across two suites:

1. **`smoke` suite (3 cases):**
   - `dune-proven`: Proven mode baseline for Dune Sea sand dunes.
   - `alpine-signature`: Signature mode canonical showcase for Alpine Dawn photoreal snow carving.
   - `alpine-experimental-camera`: Experimental mode changing camera axis to Cinematic with verification-framing adjustments.

2. **`full` suite (8 cases):**
   - All 6 Signature canonical showcases (`alpine-signature`, `hoshi-signature`, `dune-signature`, `tidal-signature`, `ember-signature`, `neon-signature`).
   - Baseline Proven case (`dune-proven`).
   - Camera axis Experimental case (`alpine-experimental-camera`).

---

## Preparing Benchmark Bundles

Use `benchmark.mjs prepare` to emit isolated benchmark bundles:

```bash
# Prepare the smoke suite into a target directory
node benchmark.mjs prepare benchmarks/smoke-run --suite smoke

# Prepare a single case
node benchmark.mjs prepare benchmarks/alpine-run --case alpine-signature

# Force overwrite existing benchmark files
node benchmark.mjs prepare benchmarks/full-run --suite full --force
```

Each prepared case directory contains:
- `case.json`: Metadata, SHA-256 brief hash, expected report path.
- `review-template.json`: Pre-populated human review template.
- `bundle/`:
  - `<PROJECT>_TECHDEMO_PROMPT.md`: Assembled tech demo brief.
  - `HANDOFF.md`: Handoff instructions for the builder agent.
  - `verify/`: Embedded verifier source files (`verify_demo.mjs`, `gates.mjs`, `report.mjs`, `README.md`).

---

## Agent Prompt Handoff

When evaluating an agent, pass ONLY the assembled brief (`bundle/<PROJECT>_TECHDEMO_PROMPT.md`) and standard workspace setup. Do not provide hidden hints, custom scaffolding, or pre-built asset files beyond what the brief specifies.

The builder agent must implement the tech demo in zero-asset procedural WebGL/WebGPU code using standard Vite structure and expose the required `window.__demo` hook.

---

## Running Automated Verification

Run automated verification on the generated demo project:

```bash
# Standard verification writing verify-report.json
node verify/verify_demo.mjs <project-directory>

# Specify explicit report path and screenshot directory
node verify/verify_demo.mjs <project-directory> --report verify-report.json --screenshots screenshots/
```

Verification executes build checks, Playwright headless captures, and gate evaluations, emitting `verify-report.json` with `schemaVersion: 1`.

---

## Human Visual & Creativity Rubric

The human visual evaluation rates 6 categories on an integer scale from 1 to 5:

1. `compositionReadability`: Visual hierarchy, framing, and clear separation of ground/character/sky.
2. `materialCoherence`: Palette harmony, noise detail, and surface material response.
3. `characterCraft`: Proportional character silhouette, clothing motion, and distinct pose readability.
4. `mechanicLegibility`: Clear visual feedback during movement and surface state deformation.
5. `creativeIdentity`: Authored visual surprise, memorable aesthetic quality, or serendipitous style.
6. `scopeDiscipline`: Adherence to selected mode boundaries without uncontrolled scope creep.

---

## Scoring Anchors (1, 3, and 5)

| Category | Score 1 (Deficient) | Score 3 (Satisfactory) | Score 5 (Exceptional) |
| :--- | :--- | :--- | :--- |
| **`compositionReadability`** | Cluttered or muddy framing; character blends into background. | Clear ground/sky separation; character distinguishable. | Striking cinematic framing; excellent contrast and focal balance. |
| **`materialCoherence`** | Flat unlit colors; jarring palette conflicts or broken noise. | Cohesive color scheme; readable procedural texture layers. | Rich, harmonious palette; multi-scale procedural material depth. |
| **`characterCraft`** | Blocky primitive box; floating or clipping silhouette. | Well-proportioned stylized rig; clear movement poses. | Elegant authored silhouette; fluid cloth/appendage secondary motion. |
| **`mechanicLegibility`** | No surface interaction feedback; motion reads as static. | Noticeable terrain deformation and particle trail on move. | Dynamic, high-impact surface reaction with immediate visual feedback. |
| **`creativeIdentity`** | Generic asset-store template appearance. | Solid execution of requested biome and archetype theme. | Memorable authored style, artistic flair, and visual serendipity. |
| **`scopeDiscipline`** | Violates contract limits or introduces broken extra features. | Follows brief requirements within selected mode scope. | Perfect adherence to mode constraints with highly polished execution. |

Visual Average is calculated as the arithmetic mean of all 6 category scores rounded to 2 decimal places:
$$\text{VisualAverage} = \operatorname{round}\left(\frac{\sum_{i=1}^6 \text{Score}_i}{6}, 2\right)$$

---

## Collecting Benchmark Results

Use `benchmark.mjs collect` to validate and normalize run results into structured JSON:

```bash
node benchmark.mjs collect <project-directory> \
  --case alpine-signature \
  --model claude-3-7-sonnet \
  --attempt 1 \
  --out results/alpine-claude-attempt1.json \
  --review review.json
```

The output JSON records:
- `schemaVersion: 1`
- `caseId`, `modelLabel`, `attempt`, `briefSha256`
- `automated`: Status, pass boolean, failure list & count, structured metrics.
- `humanReview`: Scores, visual average, reviewer label, notes.
- `eligible`: Boolean (`true` only if automated pass is `true`).

---

## Summarizing Benchmark Runs

Use `benchmark.mjs summarize` to generate deterministic comparison tables:

```bash
node benchmark.mjs summarize results/ --out summary.md --json summary.json
```

The Markdown output formats runs ordered by:
1. Benchmark case registry order
2. Model label alphabetically
3. Attempt number

Identical inputs produce byte-identical Markdown and JSON output.

---

## Automated Eligibility vs Subjective Scores

Automated verification determines **eligibility**. An ineligible run (`automated.pass === false`) is flagged `eligible: false` and can never be ranked above an eligible run, regardless of human visual scores.

Human visual scores evaluate subjective artistic execution for eligible runs.

---

## Reproducibility & Brief Hashes

Every generated brief's content is hashed using SHA-256 (`briefSha256`). `case.json` and result records store this hash, and `benchmark.mjs collect` strictly verifies that the actual prompt file bytes match both the case metadata hash and the canonical derived benchmark brief hash.

---

## What Batch 8 Intentionally Does Not Automate

1. **Model API Execution:** Batch 8 does not call LLM APIs or launch external AI coding agents.
2. **Automated Human Scoring:** Subjective aesthetic evaluations are performed by human reviewers using `review-template.json`.
3. **Headless Frame Gating:** Frame rate performance metrics are recorded as informational data and do not trigger build failures on headless software renderers.
