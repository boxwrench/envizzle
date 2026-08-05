# Implementation Planning and Stage Discipline

This reference defines the builder role, the five-stage implementation plan, checkpoint and stop-and-report behavior, the exact meaning of stage completion, and the separation between implementation and independent review.

## Contents

- [Builder Role](#builder-role)
- [The Five Stages](#the-five-stages)
  - [1. `backend-proof`](#1-backend-proof)
  - [2. `terrain-kernel`](#2-terrain-kernel)
  - [3. `environment-composition`](#3-environment-composition)
  - [4. `character-locomotion`](#4-character-locomotion)
  - [5. `mechanic-polish`](#5-mechanic-polish)
- [Stage Completion](#stage-completion)
- [Checkpoint Behavior](#checkpoint-behavior)
- [Stop-and-Report](#stop-and-report)
- [Implementation vs. Independent Review](#implementation-vs-independent-review)

---

## Builder Role

The generated bundle names the builder an **implementer**, not a designer. `ENVIZZLE_BUILD.json`'s `sourceOfTruth` section records this role in machine-checkable form (`builderRole: "implementer"`, `builderMayRedesignArchitecture: false`, `builderMayAddFallbacks: false`, `builderMaySkipStages: false`, `builderMayIgnoreFailedChecks: false`), and every generated brief states the same rule in prose:

> The builder implements an already-designed system. It may make bounded implementation decisions inside each approved stage, but it may not redesign the renderer, terrain ownership, shader integration, fallback strategy, module responsibilities, readiness lifecycle, verification interfaces, or stage order.

This is the single sentence to hold onto when a stage feels awkward: the discomfort is not license to change architecture. A builder that hits friction inside the approved scope resolves it with an implementation decision; a builder that wants to change the renderer, the shader language, the ownership of terrain elevation, or the order of the stages has left the implementer role and must stop and report instead of proceeding.

The builder works **one stage at a time** and must not continue past a failed checkpoint. Both halves of that sentence are load-bearing: stages are not a checklist to work in parallel, and a failure is not a note to fix later — it blocks all further work until it is resolved.

## The Five Stages

`ENVIZZLE_BUILD.json`'s `implementationPlan` array contains exactly five stage entries, in this fixed order. Each entry has the same schema: `id`, `order`, `goal`, `allowedScope`, `requiredOutputs`, `approvedPatternIds`, `forbiddenPatternIds`, `automatedChecks`, `visualChecks`, `stopConditions`, `requiredEvidence`, `doNotProceedUntilPassed`.

### 1. `backend-proof`

Prove the selected rendering backend, shader language, and readiness lifecycle are genuinely active before any other system is built. Allowed scope is narrow on purpose: engine initialization, one representative material, one representative mesh, required backend diagnostics, GPU validation capture, one successfully completed frame, and a truthful readiness state. Full terrain, character, particles, mechanic, and atmosphere systems are explicitly out of scope here — and so is any fallback renderer, under any circumstance.

### 2. `terrain-kernel`

Prove a single GPU-owned terrain patch renders correctly, with a flat CPU render mirror and verified GPU/CPU parity, before expanding terrain coverage. The CPU height mirror exists only for physics, camera clearance, and foot planting — never for rendering. Do not add clipmap rings or continuous terrain expansion until the single patch passes.

### 3. `environment-composition`

Expand the single terrain patch into continuous, biome-correct terrain with LOD, far field, lighting, and atmosphere, and compose the initial camera view. The idle screenshot must already clearly resemble the selected biome before character development begins — that resemblance is required evidence for this stage, not a nice-to-have.

### 4. `character-locomotion`

Build an intentional procedural character with a readable silhouette, idle and locomotion animation, foot planting, and appropriate camera framing. The character must not be a placeholder primitive, and idle and locomotion must be visually distinguishable before proceeding.

### 5. `mechanic-polish`

Implement the centrepiece mechanic, add particles and secondary effects, finalize materials and lighting, clean up performance, and complete all evidence for final review. The mechanic capture must be immediately distinguishable from both the idle and locomotion captures. Do not report the demo complete while any milestone evidence is missing or any visual weakness is uncorrected.

## Stage Completion

A stage is **complete** only when every one of its `requiredOutputs`, `automatedChecks`, and `visualChecks` is satisfied. Partial satisfaction is not completion: a stage with four of five required outputs met is an incomplete stage, not a "mostly done" one, and the builder does not advance past it.

`doNotProceedUntilPassed: true` is present on every stage entry for this reason. It is not a suggestion — the builder must not start work belonging to a later stage until the current stage's own required outputs, automated checks, and visual checks all pass. Building later systems on top of an unpassed stage is explicitly prohibited: a terrain kernel built on a backend that has not proven itself, or a character built on terrain that has not proven GPU/CPU parity, inherits every unresolved defect from the stage beneath it and hides that defect behind visible progress elsewhere.

## Checkpoint Behavior

Each stage's `automatedChecks` and `visualChecks` are its checkpoint. The builder runs the automated checks, captures the required evidence, and inspects the visual result before considering the stage done. A checkpoint that has not been run is not a passed checkpoint — the absence of a failure is not evidence of a pass.

## Stop-and-Report

`sourceOfTruth.conflictPolicy` is exactly `"stop-and-report"`. Its meaning is precise and does not leave room for improvisation:

- **Halt work.** Do not continue building on top of, or around, the failed check.
- **Report the specific failed check.** Name the exact `requiredOutput`, `automatedCheck`, or `visualCheck` that did not pass — not a general "something is wrong."
- **Do not attempt a workaround.** Do not add a fallback, substitute a simpler implementation, suppress the failure, or otherwise route around the problem to keep moving. A workaround that hides a failed checkpoint is a failed checkpoint plus a second, undisclosed defect.

Stop-and-report applies identically to a failed automated check, a failed visual check, and any point where the builder would otherwise have to make a decision outside its bounded implementation authority (see [Builder Role](#builder-role)).

## Implementation vs. Independent Review

The builder implements a stage, runs that stage's checks, captures evidence, and self-reports the result. That self-report is real work and it is required — but it is not the final word on whether the result is acceptable.

A separate reviewing pass exists specifically to avoid the builder grading its own work: `ENVIZZLE_BUILD.json`'s `reviewCriteria` section (see `references/build-contract.md` and `references/visual-review.md`) defines the independent questions a reviewer — human or a separate agent — asks against the captured evidence. The builder's self-report and the independent review check different things: self-report confirms the stage's own defined outputs exist; independent review asks whether what was built actually looks and behaves the way the brief intended, including things a builder close to its own work is prone to miss (placeholder geometry, indistinguishable poses, scope creep into a later stage). Both are required. Neither substitutes for the other, and the builder's own sign-off never closes out a stage on its own.
