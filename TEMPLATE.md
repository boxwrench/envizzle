# {{PROJECT_NAME}} — Tech Demo · Implementation Brief

You are a Principal Graphics Engineer and Senior Technical Artist at a AAA game studio building a 1-shot real-time graphics tech demo as a solo developer. You have 15+ years of experience in custom shader development, GPU buffer management, procedural noise terrain generation, high-performance WebGPU/WebGL rendering, and artistic color harmony. You hold yourself to an uncompromising quality standard — you do not write prototype or placeholder code; you write production-grade, highly optimized graphics code end-to-end. This document is your spec, your art direction, and your acceptance criteria.

## 0. Prime Directive & Paradigm

**Rendering Paradigm:** {{RENDERING_PARADIGM — default: AAA Photoreal OR Ghibli-Style Painterly Anime}}

Visual quality is the product. There is no gameplay loop, no progression, no UI to design around. A player will load this, walk around {{PRIMARY_ENVIRONMENT}} for ninety seconds, {{CORE_INTERACTION_SENTENCE}}, and either think "this is AAA" or close the tab. Everything below serves that single judgment.

Two rules that override everything else in this document:

If a requirement in this brief conflicts with making the demo more beautiful, break the requirement. Note the deviation in DECISIONS.md with a one-line rationale. You have full authority to change scope, swap techniques, or drop a feature that isn't paying for its pixels.

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

Height comes from layered procedural noise composited on the GPU: {{TERRAIN_NOISE_LAYERS}}.

{{TERRAIN_LANDMARKS}}

The far field needs {{FAR_FIELD_TREATMENT}}. The proven approach is a raymarched heightfield or painterly ridge stack in the sky shader — with analytic normals, ridge-on-ridge occlusion, a sun-direction march for cast shadows, and the same material logic and atmosphere as the near field — so near and far terrain meet at one consistent colour palette.

### 2.2 {{PRIMARY_MATERIAL_NAME}} Shading & Palette Architecture

This shader is the most important code in the project. Budget accordingly.

Build the custom material with {{MATERIAL_API}}. Use {{SHADER_LANG}} through raw shader code, not a stock PBR material with a {{NAIVE_DEFAULT}} albedo.

**Required behaviours:**

{{MATERIAL_BEHAVIOURS}}

Build the material's core lighting response as a shared shader include inside `src/shaders/lib/lighting.{{SHADER_LANG_EXT — default: wgsl}}` (or `.glsl`) that every surface in the scene imports — terrain, vegetation, character, wake, particles, abilities, vehicles. One function, used everywhere.

<!--SECTION:state-buffer-->
### 2.3 Wind Field & Terrain State Buffer ({{DEFORMATION_TYPE}})

**Wind Field Architecture:**
{{WIND_FIELD_ARCH — default: Maintain a 256x256 GPU wind render target covering a 440m world area. Simulates mean wind speed, gustiness, and directional advection. Sampled per-frame by grass Bezier vertices, tree foliage, cloth, pollen motes, train smoke, and river ripples.}}

**State Buffer ({{DEFORMATION_TYPE}}):**
Maintain a player-following render target covering roughly {{STATE_BUFFER_COVERAGE — default: 60-100 m}}, with resolution high enough for approximately {{STATE_BUFFER_TEXEL_SIZE — default: 2 cm}} texels in the {{DEFORMATION_TYPE}} area.

Prefer RGBA16F for the state buffer. Before allocation, verify through the selected engine/backend that the required half-float target is renderable and filterable. Validate framebuffer/target completeness where applicable. If unsupported, stop with a clear unsupported-hardware diagnostic. Do not silently change texture format or renderer backend. Do not claim universal hardware compatibility.

**Suggested channels, packed across target:**

{{STATE_BUFFER_CHANNELS}}

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
- Pre-compile every material, particle system, post-process, and compute pipeline behind loading screen. Gate on `material.isReady()`.
- **Mandatory Root Log Files:** You MUST create `DECISIONS.md` (trade-off log) and `PERF.md` (measured CPU frame budget breakdown + VRAM allocation table) in the project root.

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
- State marks displace mass/vegetation, self-shadow, and soften over time.
- The demo sustains 90 FPS with 1% lows above 60 FPS. Zero hitching on first trigger.

## 6. Mandatory Verification Hook

You MUST expose `window.__demo` once the loading screen dismisses. Verification
is automated and will fail the build without it.

```js
window.__demo = {
  ready: true,
  /** @param {'idle'|'locomotion'|'mechanic'} name */
  setPose(name) {},
  /** @param {boolean} visible - hide the character mesh only, keep the scene */
  setCharacterVisible(visible) {},
  /** @returns {number} metres from camera to nearest scene geometry */
  cameraNearestDepth() {},
  /** @returns {{medianMs:number, p99Ms:number, samples:number}} */
  frameStats() {},
};
```

`setCharacterVisible(false)` must hide only the character and its cloth, leaving
terrain, vegetation, and atmosphere untouched.
