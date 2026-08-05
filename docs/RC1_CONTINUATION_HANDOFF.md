# RC1 Continuation Handoff

## Branch and checkpoint

- Branch: `release/v0.1.0-rc1`
- Main base: `74055d5c2d83426709c719820bb8544a5611950e`
- WIP hardening checkpoint: `e008a0e94d9b8d17b73c8fa4279db4a95d4c0b7f`

The branch is intentionally unmerged and untagged. The original broken checkout at
`C:\GitHub\envizzle` remains untouched; continue in
`C:\GitHub\envizzle-release-work` or a fresh clone of this release branch.

## Safely completed before this checkpoint

- Recovered the interrupted Phase 2 cleanup without rewriting history.
- Deleted duplicate packaging: `plugin.json`, `sync-skill.mjs`, and
  `skills/envizzle/`.
- Removed the `sync-skill` package script.
- Added README installation instructions and focused README regression coverage.
- Pushed cleanup commit `74055d5` to Batch 9 and fast-forwarded `main` to it.
- Created and pushed `release/v0.1.0-rc1`.

## Partial RC1 work in the WIP checkpoint

- Added canonical terrain elevation ownership and CPU/GPU parity contract fields.
- Added evidence `briefSha256` template binding.
- Added generated terrain, Babylon binding-ownership, truthful-readiness, and
  whole-bundle handoff prose.
- Started renderer, terrain, camera, environment-detail, and pose-difference gate
  implementation.
- Started report and benchmark metric-schema migration.
- Started targeted Babylon WebGPU source-contract lint and readiness/evidence helpers.

## Current validation state

- `git diff --check` passed before the WIP commit.
- Silent imports passed for `assemble.mjs`, `build-contract.mjs`,
  `verify/gates.mjs`, `verify/report.mjs`, and `verify/verify_demo.mjs`.
- The full test suite has **not** been made green after the WIP changes.
- No browser, real WebGPU run, or Dune demo was launched.
- No Dune RC bundle has been generated.

## Resume order

1. Read the consolidated release requirements and inspect the WIP diff from
   `74055d5..e008a0e`.
2. Finish `verify/verify_demo.mjs`: evidence-completion gating, current-run
   screenshot checks, adapter proof, renderer diagnostics, warning handling, and
   final report population.
3. Complete the strict report and benchmark metric migration, then update affected
   fixtures.
4. Add the requested focused regression matrix, including synthetic environment and
   pose-difference fixtures. Unit tests must not launch a real browser.
5. Run `npm test`, resolve all failures, then run all required silent imports and the
   external skill validator.
6. Generate `../envizzle-v0.1.0-rc1-smoke` only after tests pass; inspect the copied
   Dune bundle without building the demo.
7. Create the final focused RC commit and push normally. Do not merge or tag the
   release branch.

## Important implementation notes

- Keep `schemaVersion: 1`.
- Do not change the 38 logical `TEMPLATE.md` tokens without first identifying a real
  template-contract blocker.
- Do not describe source lint, imported WGSL text, or Vite build success as proof of
  Babylon WGSL success. The authoritative proof remains Babylon shader processing,
  real WebGPU pipeline/binding creation, forced material compilation, readiness,
  zero validation errors, and a successfully submitted rendered frame.
- Preserve the generated-project requirement: projects must be outside the Envizzle
  source repository.
