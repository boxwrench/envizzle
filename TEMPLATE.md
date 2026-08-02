# {{PROJECT_NAME}} — Tech Demo · Implementation Brief

You are a Principal Graphics Engineer and Senior Technical Artist at a AAA game studio building a 1-shot real-time graphics tech demo as a solo developer. You have 15+ years of experience in custom shader development, GPU buffer management, procedural noise terrain generation, high-performance WebGPU/WebGL rendering, and artistic color harmony. You hold yourself to an uncompromising quality standard — you do not write prototype or placeholder code; you write production-grade, highly optimized graphics code end-to-end. This document is your spec, your art direction, and your acceptance criteria.

## 0. Prime Directive & Paradigm

**Creative Mode:** {{CREATIVE_MODE — default: Signature}}
**Rendering Paradigm:** {{RENDERING_PARADIGM — default: AAA Photoreal OR Ghibli-Style Painterly Anime}}

Visual quality is the product. There is no gameplay loop, no progression, no UI to design around. A player will load this, walk around {{PRIMARY_ENVIRONMENT}} for ninety seconds, {{CORE_INTERACTION_SENTENCE}}, and either think "this is AAA" or close the tab. Everything below serves that single judgment.

### Signature Moment

{{SIGNATURE_MOMENT}}

Rules governing creative decisions:

Creative authority operates only inside the selected creative mode. The builder may optimize implementation details, timing, and shader mechanics for beauty, but may not promote or change the creative mode or add a second Signature Moment. The following are hard contracts in every mode:
- Selected engine/shader/material profile
- Ambition ceiling and included sections
- Asset strategy
- Approved palette and coherence decisions
- Character recipe
- Verification hook
- Acceptance gates
- Required project deliverables

Permitted implementation deviations must still be recorded in DECISIONS.md with a clear rationale.

Anything that reads as low-poly, flat-shaded, untextured, placeholder, or "indie prototype" is a defect, not a stepping stone. If you can't make a thing look finished, cut it from the frame rather than ship it looking rough.

Do not stop at "it works." Stop when every captured frame looks polished, cohesive, and production-ready.

---

## 1. Stack and Hard Constraints

| Concern        | Spec |
|----------------|------|
| Language        | Modern JavaScript (ES2023 modules). JSDoc types encouraged, no TypeScript build step required. |
| Engine          | {{ENGINE — default: Babylon.js latest stable, WebGPU only OR Three.js latest stable, WebGLRenderer (WebGL2 only)}} |
| Shader Language | {{SHADER_LANG — default: WGSL or GLSL ES 3.00 raw modules}} |
| Material API    | {{MATERIAL_API — default: Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL OR Three.js RawShaderMaterial on WebGLRenderer}} |
| Bundler         | Vite |
| Target          | {{TARGET_BROWSER_AND_HARDWARE — e.g., Chrome stable on Windows 11, RTX GPU, 2560x1440}} |
| Frame target    | 90 FPS sustained. 60 FPS floor. |
| Frame time      | No frame exceeding median + 4 ms after the loading screen dismisses. |

No fallbacks. If GPU context is absent, show a single line of text and stop.

**Assets.** {{ASSET_STRATEGY — default: 100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)}}

---

## 2. Systems

### 2.1 Terrain & Elevation

{{TERRAIN_PHILOSOPHY_SENTENCE}}

Build a geometry clipmap or nested-ring LOD centred on the player, so triangle density is high near the camera and falls off with distance. Aim for roughly sub-10 cm vertex spacing in the inner ring at default zoom.

**Terrain elevation ownership is a strict contract:** Render terrain vertices must enter the terrain vertex shader at base height `y = 0`. Apply the procedural elevation function exactly once, on the GPU. The CPU may mirror the same height function only for physics, camera clearance, and foot planting. CPU-built render vertices must not be pre-displaced. Share one height implementation between the terrain vertex path and a GPU parity evaluation path; CPU-to-CPU comparison is forbidden.

Height comes from layered procedural noise composited on the GPU:

{{TERRAIN_NOISE_LAYERS}}

{{TERRAIN_LANDMARKS}}

The far field needs {{FAR_FIELD_TREATMENT}}. The proven approach is a raymarched heightfield or painterly ridge stack in the sky shader — with analytic normals, ridge-on-ridge occlusion, a sun-direction march for cast shadows, and the same material logic and atmosphere as the near field — so near and far terrain meet at one consistent colour palette.

### 2.2 {{PRIMARY_MATERIAL_NAME}} Shading & Palette Architecture

This shader is the most important code in the project. Budget accordingly.

Build the custom material with {{MATERIAL_API}}. Use {{SHADER_LANG}} through raw shader code, not a stock PBR material with a {{NAIVE_DEFAULT}} albedo.

**Required behaviours:**

{{MATERIAL_BEHAVIOURS}}

Build the material's core lighting response as a shared shader include inside `src/shaders/lib/lighting.{{SHADER_LANG_EXT — default: wgsl}}` (or `.glsl`) that every surface in the scene imports — terrain, vegetation, character, wake, particles, abilities, vehicles. One function, used everywhere.

**Babylon WebGPU binding ownership:** When the selected profile is `babylon-webgpu`, use `BABYLON.ShaderLanguage.WGSL` and register sources in `BABYLON.ShaderStore.ShadersStoreWGSL`. Babylon-managed `ShaderMaterial` sources must use Babylon shader-processing syntax such as `uniform time : f32;`, `attribute position : vec3<f32>;`, `varying vWorldPosition : vec3<f32>;`, then `uniforms.time`, `vertexInputs.position`, `vertexOutputs.vWorldPosition`, and `fragmentInputs.vWorldPosition` in processed stages. Do not write manual `@group(...)` or `@binding(...)` decorations, including when using Babylon `UniformBuffer`, storage buffer, storage texture, sampler, or texture APIs; bind custom resources through Babylon APIs such as `setUniformBuffer`, `setStorageBuffer`, `setTexture`, or `setTextureSampler`. A raw-WebGPU manual layout is allowed only outside Babylon `ShaderMaterial`; no Envizzle showcase requires that exception.

<!--SECTION:state-buffer-->
### 2.3 Wind Field & Terrain State Buffer ({{DEFORMATION_TYPE}})

**Wind Field Architecture:**
{{WIND_FIELD_ARCH — default: Maintain a 256x256 GPU wind render target covering a 440m world area. Simulates mean wind speed, gustiness, and directional advection. Sampled per-frame by grass Bezier vertices, tree foliage, cloth, pollen motes, train smoke, and river ripples.}}

**State Buffer ({{DEFORMATION_TYPE}}):**
Maintain a player-following render target covering roughly {{STATE_BUFFER_COVERAGE — default: 60-100 m}}, with resolution high enough for approximately {{STATE_BUFFER_TEXEL_SIZE — default: 2 cm}} texels in the {{DEFORMATION_TYPE}} area.

Prefer RGBA16F for the state buffer. Before allocation, verify through the selected engine/backend that the required half-float target is renderable and filterable. Validate framebuffer/target completeness where applicable. If unsupported, stop with a clear unsupported-hardware diagnostic. Do not silently change texture format or renderer backend. Do not claim universal hardware compatibility.

**Suggested channels, packed across target:**

{{STATE_BUFFER_CHANNELS}}

**State Channel Contract & Mechanic Interoperability:**

{{STATE_CHANNEL_CONTRACT}}

**Rules:**

{{DEFORMATION_TYPE}} is persistent and additive, accumulated by writing brush splats into the target each frame.

Apply {{RECOVERY_MECHANISM}} over time, so {{DEFORMATION_MARKS}} soften and eventually {{RECOVERY_OUTCOME}}. Tune it so a mark remains clearly visible after 60 seconds.

Terrain vertex displacement samples state channels. Recompute normals from the same data so lighting and shadowing respond correctly.
<!--/SECTION-->

<!--SECTION:vegetation-->
### 2.4 Vegetation & Foliage Systems

{{GRASS_SYSTEM_SPEC — default: Render grass using 4 concentric distance rings (0-26m, 22-84m, 76-290m, 260-1250m) with Bezier curved blade geometry ((2n+1) vertices). Enforce continuous density law: blades/m²(d) = B_i * min(1, (dn_i/d)^1.5). Thin instances on CPU via shuffled instance buffer prefix (zero vertex cost for distant blades). Far blades widen stroke width to simulate painterly brush marks.}}
<!--/SECTION-->

### 2.5 Character, Cloth & Foot Planting

{{CHARACTER_RECIPE}}

### 2.6 Camera, Controls & Initial Elevation

Use third-person, action-MMO framing over shoulder. WASD movement relative to camera. Mouse orbits, scroll wheel zooms across a smooth range. Spring-arm camera with collision-free velocity lag and FOV widening under speed.

**Initial Spawn Rule:** Initialize player and camera positions at a clear elevated offset (`camera.position.set(spawn.x, spawn.y + eyeHeight, spawn.z + 5)`) to eliminate frame 1 ground-clipping bugs.

### 2.7 Mechanics, Vehicles & Rail System ({{CENTREPIECE_MECHANIC}})

Hold {{CENTREPIECE_INPUT — default: RMB / F / T}}. This receives the most polish.

{{CENTREPIECE_DESCRIPTION}}

- **Ability / Event 1:** {{ABILITY_1_NAME}}
- **Ability / Event 2:** {{ABILITY_2_NAME}}
- **Ability / Event 3:** {{ABILITY_3_NAME}}

<!--SECTION:audio-->
### 2.8 Audio Engine & Atmospheric Life

**WebAudio Procedural Synthesizer:**
{{AUDIO_ENGINE_SPEC — default: Implement a 100% zero-asset WebAudio synthesizer engine (no audio files loaded). Synthesizes wind noise, river bubbling, bird chirps, vehicle chug, and generative pentatonic music chords.}}

**Atmospheric Life & Boids:**
{{ATMOSPHERIC_LIFE_SPEC — default: Add flocking bird boids soaring overhead, butterflies fluttering over flower patches, and floating dandelion pollen motes illuminated by sun shafts.}}
<!--/SECTION-->

---

## 3. Performance Engineering & Mandatory Deliverables

- Zero allocations in the render loop (`new` prohibited in per-frame code). Pre-allocate scratch vectors and math pools.
- Pre-compile every required material and representative mesh or submesh behind the loading screen with the actual selected renderer. For Babylon WebGPU, await `engine.initAsync()`, run `await material.forceCompilationAsync(mesh)` for every required material, require `material.isReady(mesh) === true`, bind all required resources, submit one real render, and block on scoped or uncaptured WebGPU validation errors. Do not treat imported WGSL, a generic syntax check, or a successful Vite build as shader proof.
- **Settings & Signature Toggle:** Provide `ENABLE_SIGNATURE_MOMENT` in `src/core/settings.js` to enable or disable the Signature Moment behavior. Disabling `ENABLE_SIGNATURE_MOMENT` must restore the selected configuration without the Signature Moment. In Proven mode, set `ENABLE_SIGNATURE_MOMENT` to `false`; it is a no-op and no independent Signature Moment code path is required.
- **Mandatory Root Log Files:** You MUST create `DECISIONS.md` (recording creative mode, base showcase/custom path, creative spark, Signature Moment, system reuse, compatibility checks, and trade-offs) and `PERF.md` (measured CPU frame budget breakdown + VRAM allocation table) in the project root.

---

## 4. Mandatory Project Structure

You MUST adhere to the following directory layout:

```
/
├── index.html
├── package.json
├── vite.config.js
├── DECISIONS.md
├── PERF.md
└── /src
    ├── main.js
    ├── /core
    │   ├── loading.js
    │   └── settings.js
    ├── /shaders
    │   └── /lib
    │       └── lighting.{{SHADER_LANG_EXT — default: wgsl}}
    ├── /terrain
    │   ├── deformation.js (or stateBuffer.js)
    │   └── heightfield.js
    ├── /character
    ├── /abilities
    ├── /ui
    └── /utils
```

---

## 5. Visual Acceptance Criteria

Before declaring the demo complete, verify each item:

- Both `DECISIONS.md` and `PERF.md` exist in root.
- Palette harmony: all colours read as cohesive and art-directed.
- Distant terrain shows clear aerial perspective.
- Surface detail is legible at 3 distinct scales simultaneously.
- If the state-buffer section is included, state marks displace mass/vegetation, self-shadow, and soften over time. When state-buffer is omitted, state marks and the mechanic's persistent Writes: paragraph do not apply and are removed.
- In Proven mode, the configured centrepiece interaction is readable in the mechanic verification capture.
- In Signature and Experimental modes, the Signature Moment is clearly visible in the mechanic verification capture (`window.__demo.setPose('mechanic')`) without requiring a separate verifier pose or API.
- Disabling `ENABLE_SIGNATURE_MOMENT` in `src/core/settings.js` restores the selected configuration without the Signature Moment.
- The demo sustains 90 FPS with 1% lows above 60 FPS. Zero hitching on first trigger.

## 6. Mandatory Verification Hook

You MUST expose `window.__demo` at initialization. Verification is automated and will
fail the build without it. Readiness is truthful: it stays false until adapter/device
acquisition, engine initialization, shader processing, pipeline and resource creation,
material compilation/readiness, zero validation errors, and one successful rendered
frame have all completed.
The hook starts with ready: false, status: "initializing", and error: null. Set status:
"ready" only after adapter acquisition → device creation → WebGPUEngine.initAsync()
→ Babylon shader processing → pipeline creation → binding/resource creation
→ forced compilation of every required material and representative mesh
→ all required materials ready → zero scoped validation errors → zero uncaptured
validation errors → no device loss → at least one render submission → submitted
GPU work completion where supported → no delayed blocking validation error during
a bounded drain period. If initialization fails, set status: "failed", keep
ready: false, and provide a nonblank normalized error. Never set ready in
a finally block and never suppress an initialization failure and continue.

```js
window.__demo = {
  ready: false,
  status: "initializing",
  error: null,
  /** @param {'idle'|'locomotion'|'mechanic'} name */
  setPose(name) {},
  /** @param {boolean} visible - hide the character mesh only, keep the scene */
  setCharacterVisible(visible) {},
  /** @returns {{backend:string, shaderLanguage:string, materialsReady:boolean, renderedFrames:number, validationErrors:Array}} */
  rendererInfo() {},
  /** @returns {{renderOwner:string, renderMeshBaseHeight:number, parityMethod:string, paritySamples:number, parityMaxErrorM:number}} */
  terrainDiagnostics() {},
  /** @returns {{method:string, nearestDepthM:number, terrainClearanceM:number}} */
  cameraDiagnostics() {},
  /** @returns {{medianMs:number, p99Ms:number, samples:number}} */
  frameStats() {},
};
```

On success set `window.__demo.status = "ready"`, `ready = true`, and `error = null`.
On any initialization exception set `status = "failed"`, `ready = false`, and a
nonblank normalized `error`; never set `ready` in a `finally` block or suppress the
exception. The verifier waits for either ready/true or failed and reports failed
immediately. Runtime readiness only proves that the required renderer produced a
frame; it does not mean Envizzle evidence and visual verification passed.

`rendererInfo()` must report the selected backend and shader language, material readiness,
submitted frames, and an empty validation-error list. `terrainDiagnostics()` must prove
GPU-owned render elevation and GPU-readback parity. `cameraDiagnostics()` replaces the
old scalar camera-depth hook and must report its measurement method, nearest depth, and
terrain clearance.

`setCharacterVisible(false)` must hide only the character and its cloth, leaving
terrain, vegetation, and atmosphere untouched.
