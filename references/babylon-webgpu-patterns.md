# Babylon WebGPU Positive Patterns

This reference defines the required Babylon.js WebGPU implementation patterns for the `babylon-webgpu` rendering profile — engine initialization, WGSL shader storage, mesh and binding interfaces, compilation and validation proof, and truthful readiness — plus one worked example.

## Contents

- [Engine Initialization](#engine-initialization)
  - [`BABYLON.WebGPUEngine`](#babylonwebgpuengine)
  - [`await engine.initAsync()`](#await-engineinitasync)
  - [No `BABYLON.Engine` Fallback](#no-babylonengine-fallback)
- [Shader Language and Storage](#shader-language-and-storage)
  - [`BABYLON.ShaderLanguage.WGSL`](#babylonshaderlanguagewgsl)
  - [`BABYLON.ShaderStore.ShadersStoreWGSL`](#babylonshaderstoreshadersstorewgsl)
  - [Babylon-Managed WGSL Declarations](#babylon-managed-wgsl-declarations)
  - [Babylon-Generated Shader Namespaces](#babylon-generated-shader-namespaces)
- [Mesh Interfaces and Data](#mesh-interfaces-and-data)
  - [Expected Vertex/Fragment Interfaces](#expected-vertexfragment-interfaces)
  - [Required Mesh Attributes and Vertex Buffers](#required-mesh-attributes-and-vertex-buffers)
- [Babylon Binding Ownership](#babylon-binding-ownership)
- [Compilation and Readiness Proof](#compilation-and-readiness-proof)
  - [Representative Mesh/Material Compilation](#representative-meshmaterial-compilation)
  - [`forceCompilationAsync(mesh)`](#forcecompilationasyncmesh)
  - [`material.isReady(mesh)`](#materialisreadymesh)
- [Validation and Device State](#validation-and-device-state)
  - [Scoped Validation Errors](#scoped-validation-errors)
  - [Uncaptured Validation Errors](#uncaptured-validation-errors)
  - [Device-Loss Handling](#device-loss-handling)
- [Render Submission and Completion](#render-submission-and-completion)
  - [Render Submission](#render-submission)
  - [`queue.onSubmittedWorkDone()` Where Available](#queueonsubmittedworkdone-where-available)
  - [One Completed Frame](#one-completed-frame)
  - [Truthful Readiness](#truthful-readiness)
- [Positive Pattern Example: Minimal WGSL ShaderMaterial](#positive-pattern-example-minimal-wgsl-shadermaterial)

---

This document describes only positive, required patterns. The corresponding forbidden patterns (`webgl-fallback`, `manual-babylon-bindings`, `wrong-babylon-shader-language`, `wrong-babylon-shader-store`, and the rest) live in `ENVIZZLE_BUILD.json`'s `forbiddenPatterns` section and are enforced by `verify/patternScan.mjs`. Everything below is what to do instead.

## Engine Initialization

### `BABYLON.WebGPUEngine`

The `babylon-webgpu` profile is engine-selected, not a fallback path picked at runtime. Construct `BABYLON.WebGPUEngine` directly against the canvas. Adapter and device acquisition happen inside its own initialization sequence (see [`await engine.initAsync()`](#await-engineinitasync)) — do not probe `navigator.gpu` yourself and branch between engines based on the result.

### `await engine.initAsync()`

`WebGPUEngine` construction is synchronous, but the engine is not usable until `initAsync()` resolves — it is where adapter acquisition and device creation actually happen. Always `await` it before creating any scene, material, or mesh, and treat a rejection as an unsupported-backend condition to report truthfully (see [Truthful Readiness](#truthful-readiness)), not a signal to construct a different engine.

### No `BABYLON.Engine` Fallback

`BABYLON.Engine` is the WebGL engine. Constructing it — as an initial choice, as a fallback when `WebGPUEngine` fails, or as a "just to get something on screen" placeholder — is forbidden for this profile under all circumstances. If WebGPU is unavailable or fails to initialize, the correct response is a truthful, reported failure, never a silent switch to a different backend. There is no environment in which falling back to `BABYLON.Engine` is the right implementation decision inside this profile.

## Shader Language and Storage

### `BABYLON.ShaderLanguage.WGSL`

Every `ShaderMaterial` in this profile is constructed with `shaderLanguage: BABYLON.ShaderLanguage.WGSL` in its options object. This tells Babylon to parse, process, and compile the associated shader sources as WGSL rather than GLSL — it is not cosmetic, and omitting it (or leaving the default) silently reinterprets WGSL source as GLSL and fails to compile.

### `BABYLON.ShaderStore.ShadersStoreWGSL`

WGSL sources for a `ShaderMaterial` are registered as string entries on `BABYLON.ShaderStore.ShadersStoreWGSL`, keyed by the shader name Babylon expects (`"<name>VertexShader"` / `"<name>FragmentShader"`), before the material is constructed. This is the supported storage path for this profile. A `.glsl` file extension, or a shader registered on the GLSL-oriented store, is a wrong-store defect even if the file's contents happen to be valid WGSL text.

### Babylon-Managed WGSL Declarations

WGSL registered through `ShadersStoreWGSL` is not consumed verbatim by the GPU — Babylon parses it, resolves its `attribute`/`uniform`/`varying` declarations against the material's configured `attributes` and `uniforms` lists, and rewrites it into the WGSL the device actually receives, including generated bind group and binding numbers. Treat the source you write as Babylon-managed WGSL: correct at the level Babylon's shader processor expects, not necessarily identical to what a raw WebGPU pipeline would compile unmodified.

### Babylon-Generated Shader Namespaces

Babylon assigns its own internal namespace and struct layout to each processed shader (`VertexInputs`, `FragmentInputs`, `vertexOutputs`, `fragmentOutputs`, and the `uniforms` struct built from the material's declared uniform list). Write against these generated names rather than inventing your own entry-point or I/O struct names — the vertex/fragment interface Babylon expects is defined by its processor, not by hand-authored WGSL conventions from outside Babylon.

## Mesh Interfaces and Data

### Expected Vertex/Fragment Interfaces

A Babylon WGSL vertex shader's entry point receives Babylon's `VertexInputs` struct and returns `FragmentInputs`; the fragment entry point receives `FragmentInputs` and returns `FragmentOutputs`. Every value the fragment stage needs from the vertex stage is written onto `vertexOutputs` inside the vertex function and read from the corresponding `input` field inside the fragment function — this is Babylon's varying-passing convention for WGSL, and it replaces hand-declared `varying` linkage between separately compiled stages.

### Required Mesh Attributes and Vertex Buffers

Every attribute a `ShaderMaterial` references (via its `attributes` option, e.g. `"position"`, `"normal"`, `"uv"`) must exist as a matching vertex buffer on the mesh being rendered with that material. A representative mesh used for [backend proof](implementation-planning.md#1-backend-proof) should carry the same attribute set the real production meshes will use, so compilation proof at this stage is proof of the interfaces later stages depend on, not a simplified stand-in that stops matching once real geometry arrives.

## Babylon Binding Ownership

Manual `@group(...)` / `@binding(...)` declarations are **forbidden** anywhere inside a Babylon-managed `ShaderMaterial` WGSL source. This restriction is not limited to raw declarations you might type by hand — it applies equally when the binding is produced through Babylon's own `UniformBuffer`, storage-buffer, texture, or sampler APIs. Babylon owns the generated binding groups and binding numbers for every resource a `ShaderMaterial` declares, and it assigns them during shader processing; a manually specified `@group`/`@binding` — however it was arrived at — conflicts with that generated layout and is a defect, not an optimization.

The only place a manual binding layout is valid is inside an explicitly-declared **raw WebGPU pipeline** — one built directly against the WebGPU API (`GPUDevice.createRenderPipeline`, hand-written bind group layouts, and so on) that does **not** go through Babylon `ShaderMaterial` or `ShaderStore` at all. That is a genuinely separate code path with its own binding ownership, and it is the only context where the constraint above does not apply.

**No current Envizzle showcase requires that exception.** Every showcase in this profile is built entirely through Babylon `ShaderMaterial`, and every material's bindings are owned by Babylon. If a future showcase design genuinely needs a raw WebGPU pipeline, that would be a deliberate, separately documented architectural decision — not something a builder reaches for locally while adding a material to fix a binding error.

## Compilation and Readiness Proof

### Representative Mesh/Material Compilation

Backend proof requires compiling one representative material against one representative mesh, and it is real compilation proof, not a piece of decoration: Babylon must genuinely process the WGSL, build the pipeline, and prepare the bindings for that mesh/material pair before anything is considered ready.

### `forceCompilationAsync(mesh)`

Call `material.forceCompilationAsync(mesh)` to drive compilation deterministically rather than waiting for the first render to trigger it implicitly. This surfaces shader-compilation and pipeline-creation failures as an awaited rejection, at a point in the code where the failure can be reported truthfully instead of being discovered later as an unexplained black mesh.

### `material.isReady(mesh)`

`material.isReady(mesh)` reports whether the material has finished compiling and preparing bindings for that specific mesh. It must return `true` before the material is treated as ready for the readiness lifecycle (see [Truthful Readiness](#truthful-readiness)) — checking it once and caching the result, or skipping the check because compilation "should" be done by now, reintroduces the premature-readiness failure this check exists to prevent.

## Validation and Device State

### Scoped Validation Errors

Push a WebGPU error scope (`device.pushErrorScope('validation')`) around pipeline and bind group creation and pop it (`popErrorScope()`) to collect scoped validation errors explicitly, rather than relying solely on the uncaptured-error event. `rendererInfo().validationErrors` must be empty before readiness — a scoped error caught and then discarded is exactly the suppressed-initialization-failure pattern this profile forbids.

### Uncaptured Validation Errors

Also listen for `device.addEventListener('uncapturederror', ...)` (or the equivalent `device.lost`-adjacent uncaptured-error surface) for the lifetime of the device, not just during initialization. An uncaptured validation error discovered after initial readiness still means the device is in a state that must be reported, not silently absorbed.

### Device-Loss Handling

Await `device.lost` and treat its resolution as a genuine failure state: report it, do not attempt to silently recreate the device and continue as if nothing happened, and do not leave `window.__demo.ready` at `true` once the device is gone. A lost device invalidates every readiness claim made before it was lost.

## Render Submission and Completion

### Render Submission

At least one real render submission — the engine actually submitting recorded GPU work for the representative mesh/material — is required before readiness. A frame that was merely scheduled, or a render loop that started but has not yet submitted anything, does not satisfy this.

### `queue.onSubmittedWorkDone()` Where Available

Where the device queue exposes `onSubmittedWorkDone()`, await it after submission to confirm the GPU actually finished the submitted work, rather than assuming completion the instant `requestAnimationFrame` ticks again. Not every environment exposes this reliably — where it is unavailable, fall back to the submitted-frame count from [Render Submission](#render-submission) alone, but prefer the stronger completion signal when the runtime provides it.

### One Completed Frame

Backend proof's required outputs include at least one submitted frame completing successfully. This is the last proof gate before readiness may become true — one frame, genuinely rendered by the selected backend with the selected shader language, with an empty validation error list and no device loss.

### Truthful Readiness

`window.__demo.ready` starts `false` and becomes `true` only after every proof step above has genuinely succeeded, in order: adapter acquisition, device creation, `WebGPUEngine.initAsync()`, Babylon shader processing, pipeline creation, binding/resource creation, forced compilation of every required material and representative mesh, all required materials ready, zero scoped validation errors, zero uncaptured validation errors, no device loss, at least one render submission, submitted GPU work completion where supported, and no delayed blocking validation error during a bounded drain period after submission.

Never set `ready` inside a `finally` block, and never suppress an initialization failure and continue as though it succeeded. On failure, `status` becomes `"failed"`, `ready` stays `false`, and `error` is set to a nonblank, normalized description of what actually went wrong. Readiness is a report of what happened, not an optimistic guess about what should have happened by now.

## Positive Pattern Example: Minimal WGSL ShaderMaterial

A minimal `ShaderMaterial` configured for WGSL, with its sources registered on `ShaderStore.ShadersStoreWGSL` and no manual `@group`/`@binding` anywhere — Babylon assigns the binding layout when it processes the registered sources.

```js
import { ShaderMaterial, ShaderLanguage, ShaderStore } from "@babylonjs/core";

// Register WGSL sources under Babylon's own shader namespace. Babylon assigns
// binding groups and numbers when it processes these sources during
// compilation — there is no @group(...) or @binding(...) anywhere below.
ShaderStore.ShadersStoreWGSL["envizzleTerrainVertexShader"] = /* wgsl */ `
  attribute position : vec3<f32>;
  attribute normal : vec3<f32>;

  uniform world : mat4x4<f32>;
  uniform viewProjection : mat4x4<f32>;

  varying vNormal : vec3<f32>;

  @vertex
  fn main(input : VertexInputs) -> FragmentInputs {
    vertexOutputs.position = uniforms.viewProjection * uniforms.world * vec4<f32>(input.position, 1.0);
    vertexOutputs.vNormal = (uniforms.world * vec4<f32>(input.normal, 0.0)).xyz;
    return vertexOutputs;
  }
`;

ShaderStore.ShadersStoreWGSL["envizzleTerrainFragmentShader"] = /* wgsl */ `
  varying vNormal : vec3<f32>;

  @fragment
  fn main(input : FragmentInputs) -> FragmentOutputs {
    let lit : f32 = clamp(dot(normalize(input.vNormal), vec3<f32>(0.4, 0.8, 0.4)), 0.0, 1.0);
    fragmentOutputs.color = vec4<f32>(vec3<f32>(lit, lit, lit), 1.0);
    return fragmentOutputs;
  }
`;

const terrainMaterial = new ShaderMaterial(
  "envizzleTerrain",
  scene,
  { vertex: "envizzleTerrain", fragment: "envizzleTerrain" },
  {
    attributes: ["position", "normal"],
    uniforms: ["world", "viewProjection"],
    shaderLanguage: ShaderLanguage.WGSL,
  },
);

await terrainMaterial.forceCompilationAsync(terrainMesh);
// material.isReady(terrainMesh) is now safe to check for readiness proof.
```
