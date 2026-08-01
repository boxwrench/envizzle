# Deterministic Assembly

This reference documents the assembly specification schema, creative input fields, mechanically derived fields, CLI usage, exit codes, and safe bundle overwrite behavior.

## Contents

- [Assembly Schema](#assembly-schema)
- [Input Fields Classification](#input-fields-classification)
  - [Creative Inputs](#creative-inputs)
  - [Mechanically Derived Fields](#mechanically-derived-fields)
- [CLI Examples](#cli-examples)
- [Exit Codes](#exit-codes)
- [Safe Overwrite Behavior](#safe-overwrite-behavior)
- [Strict Assembly Integrity](#strict-assembly-integrity)

---

## Assembly Schema

An assembly specification is a JSON object with the following shape:

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
      "text": "A high-speed carving turn erupts into a persistent crystalline spindrift arc that refracts low sunlight.",
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
  "projectName": "ALPINE-DAWN",
  "coreInteractionSentence": "carve a trail across a drift field, watch the wake break behind them",
  "creativeSpark": "crystalline ice bloom at dusk",
  "builderAgent": "Claude Code",
  "coherenceConfig": null,
  "coherenceOverrides": [],
  "extraSectionMarkdown": {}
}
```

---

## Input Fields Classification

### Creative Inputs

The model or human retains control over creative decisions:
* `signatureMoment.text`: Signature Moment wording describing the distinct visual consequence.
* `creativeSpark`: Optional creative inspiration ("surprise me" by default for Signature/Experimental, forbidden in Proven).
* `coreInteractionSentence`: Core interaction sentence for custom/Experimental projects (derived from showcase for whole showcases).
* `extraSectionMarkdown`: Prose for selected extra sections (`weather`, `water-bodies`, `architecture`, `destructibility`).
* `coherenceOverrides`: Explicitly approved art-direction coherence deviations with non-empty reasons.

### Mechanically Derived Fields

Code in `assemble.mjs` and `reference-loader.mjs` handles fragile mechanical tasks:
* **Reference prose loading:** Reading exact token values from `references/biomes.md`, `references/mechanics.md`, `references/cameras.md`, and `references/showcases.md`.
* **Token filling:** Resolving all 38 template tokens in `TEMPLATE.md` without modifying token counts or template files.
* **Section management:** Stripping omitted section blocks and every section marker (`<!--SECTION:...-->`).
* **Inlining recipes:** Inlining `references/character-recipe.md`, selected archetype parameters, and biome `FOOT_INTERACTION`.
* **Camera substitution:** Replacing §2.6 third-person text with the chosen camera mode and inserting verification framing into §6.
* **State channel contracts:** Formatting state-channel contract lines and removing state-buffer promises when state-buffer is omitted.
* **Approved palette injection:** Injecting the approved palette Markdown table into §2.2.
* **Validation:** Running selection, coherence, and final brief validation (`validateBrief`).
* **Bundle creation:** Safely emitting `<PROJECT>_TECHDEMO_PROMPT.md`, `ENVIZZLE_BUILD.json`, `ENVIZZLE_EVIDENCE.json`, `HANDOFF.md`, and `verify/`.

---

## CLI Examples

### Print Assembled Brief to STDOUT

```bash
node assemble.mjs tests/fixtures/assemblies/signature-alpine.json --stdout
```

### Emit Project Bundle to Directory

```bash
node assemble.mjs tests/fixtures/assemblies/signature-alpine.json --out ./my-project
```

### Overwrite Existing Project Bundle

```bash
node assemble.mjs tests/fixtures/assemblies/signature-alpine.json --out ./my-project --force
```

---

## Exit Codes

| Code | Meaning | Output |
|---|---|---|
| `0` | Success | Print brief (for `--stdout`) or summary JSON (for `--out`). |
| `1` | Semantic / Validation Failure | Deterministic JSON summary containing every finding `{ ok: false, errors, warnings, conflicts }`. |
| `2` | Usage / Filesystem / Overwrite Refusal | Concise stderr error message with no JavaScript stack trace. |

---

## Safe Overwrite Behavior

`writeBundle` writes seven expected target files:
1. `<PROJECT>_TECHDEMO_PROMPT.md`
2. `ENVIZZLE_BUILD.json`
3. `ENVIZZLE_EVIDENCE.json`
4. `HANDOFF.md`
5. `verify/README.md`
6. `verify/gates.mjs`
7. `verify/verify_demo.mjs`

### Overwrite Rules
* Before writing anything, complete selection validation, coherence check, and destination collision preflight.
* By default, if any of the seven expected files exist in `<output-directory>`, assembly stops immediately and exits code `2` without writing or modifying any files.
* Passing `--force` permits overwriting only those seven expected files.
* Never recursively delete or wipe the output directory.
* Unrelated files in `<output-directory>` are preserved untouched.

---

## Strict Assembly Integrity

### Input Non-Mutation
`validateAssemblySpec` and `assembleBrief` never mutate the caller's input spec object. Validated fields are copied before modification.

### Structural vs Policy Coherence Errors
* **Structural errors** (missing/null palette, non-zero-asset strategy, invalid hex) are non-overridable and always block assembly. Providing a `coherenceOverrides` entry for a structural rule has no effect.
* **Policy/art-direction errors** (luminance, contrast, saturation) can be deliberately overridden with `{ rule, reason }` entries in `coherenceOverrides`.

### Source Preflight
Before creating any output directory or file, `writeBundle` reads and caches all three verifier source files (`verify/README.md`, `verify/gates.mjs`, `verify/verify_demo.mjs`) completely in memory. It then assembles the brief, JSON contract, evidence template, and handoff, completes destination/type/collision checks, and only then writes targets. If any source read fails, the function throws immediately and no target files are created.

See [Build Contract and Milestone Evidence](build-contract.md) for the JSON schema, milestone workflow, and `incomplete verification` semantics.
