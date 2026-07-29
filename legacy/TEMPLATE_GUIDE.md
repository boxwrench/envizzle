# Biome Tech Demo Prompt Template — Companion Guide

> Companion guide for [TEMPLATE.md](file:///C:/GitHub/SnowVR/prompt%20template/TEMPLATE.md). Use this document to understand why each placeholder exists, what made the SnowFlow & Hoshi-no-Tani demos effective, and how to adapt them for photoreal or painterly biomes.

---

## 1. Architectural Paradigms Compared

| Feature | 💎 AAA Photoreal Paradigm (`snowflow_demo`) | 🎨 Ghibli Painterly Paradigm (`hoshi-no-tani`) |
|---|---|---|
| **Art Goal** | Grounded physical realism, micro-surface granularity | Cell-shaded anime harmony, hand-drawn warmth |
| **Engine Stack** | Babylon.js WebGPU + raw WGSL | Three.js WebGPU/WebGL + raw GLSL modules |
| **Shading Strategy** | Multi-scale normals, wrapped SSS, TAA glints | Palette table (sRGB→linear), painterly shadow wobble |
| **Terrain LOD** | Sub-10cm clipmap rings + toroidal state RT | 4-ring Bezier grass LOD with $(d_n/d)^{1.5}$ density law |
| **Wind & Motion** | Surface spindrift particles | 2D scrolled Wind RT (256x256 covering 440m) |
| **Audio Strategy** | Visual-only (all speed/impact via visual cues) | 100% zero-asset WebAudio synth (wind, water, birds, train) |
| **Atmospheric Life** | Low wind particle stream | Flocking bird boids, pollen motes, butterflies, viaduct train |

---

## 2. Placeholder Quick Reference

| Placeholder | Category | Photoreal Snow Example | Ghibli Valley Example |
|---|---|---|---|
| `{{RENDERING_PARADIGM}}` | Paradigm | AAA Photoreal WebGPU | Ghibli-Style Painterly Anime |
| `{{PROJECT_NAME}}` | Identity | `SNOWFLOW` | `HOSHI-NO-TANI` |
| `{{PRIMARY_ENVIRONMENT}}` | Identity | `a snow-covered alpine field` | `a late-summer Ghibli alpine valley with a stone viaduct` |
| `{{CORE_INTERACTION_SENTENCE}}` | Identity | `cast spells, surf across dunes, carve trails` | `walk through Bezier grass, summon steam train, fly through cloud decks` |
| `{{ENGINE}}` | Stack | `Babylon.js WebGPU only` | `Three.js WebGPU/WebGL` |
| `{{SHADER_LANG}}` | Stack | `WGSL` | `WGSL or GLSL modules` |
| `{{ASSET_STRATEGY}}` | Stack | `100% Zero-Asset Procedural` | `100% Zero-Asset Procedural` |
| `{{PRIMARY_MATERIAL_NAME}}` | Material | `Snow` | `Meadow Grass` |
| `{{MATERIAL_BEHAVIOURS}}` | Material | Multi-scale normals, SSS, glints, ice states | Palette table, soft rim light, shadow wobble, grass translucency |
| `{{WIND_FIELD_ARCH}}` | Wind | Uniform wind vector + spindrift particles | 256x256 GPU wind RT covering 440m world area |
| `{{DEFORMATION_TYPE}}` | State | `Deformation` | `Grass Displacement & Trails` |
| `{{STATE_BUFFER_CHANNELS}}` | State | R: depth, G: berms, B: wetness, A: ice | R: trample, G: soil path, B: wind gust, A: water wetness |
| `{{GRASS_SYSTEM_SPEC}}` | Vegetation | Procedural fur shells on robe trim | 4-ring Bezier blade LOD, $(d_n/d)^{1.5}$ law, shuffled CPU prefix thinning |
| `{{CHARACTER_COSTUME}}` | Costume | `hooded robe with fur trim` | `Ghibli traveller coat & scarf` |
| `{{CENTREPIECE_MECHANIC}}` | Mechanic | `Snow-Surf (RMB)` | `Flight Mode (F) & Train Summon (T)` |
| `{{CENTREPIECE_DESCRIPTION}}` | Mechanic | Carves deep persistent groove into snow state RT | Flight camera + procedural steam train chugging along viaduct |
| `{{AUDIO_ENGINE_SPEC}}` | Audio | Visual-only execution | WebAudio synth for wind, river bubbling, bird chirps, train chug |
| `{{ATMOSPHERIC_LIFE_SPEC}}` | Life | Low spindrift snow particles | Flocking bird boids, butterflies, pollen motes |

---

## 3. Section-by-Section Guidance

### §2.1 Terrain & Elevation
- **Photoreal:** Use sub-10cm clipmap rings centred on player. Layered procedural noise (dunes, drifts, sastrugi).
- **Ghibli Painterly:** Use terraced valley ridges, river carving, and stone viaduct cliff faces.

### §2.2 Shading & Palette Architecture
- **Photoreal:** Multi-scale triplanar normals + wrapped-diffuse SSS + TAA-stabilized glints.
- **Ghibli Painterly:** Define a single sRGB palette table for sky, clouds, grass, rocks, river, foliage, and train. Convert sRGB hex to linear on load. Use painterly shadow wobble jitter.

### §2.3 Wind Field & State Buffer
- **2D Wind Field RT:** Maintain a 256x256 render target covering 440m around player. Simulates wind speed, gustiness, and directional advection. Sampled by grass Bezier vertices, trees, cloth, smoke, and pollen motes.
- **State Buffer:** Track persistent ground displacement (footstep trample, soil path exposure, moisture).

### §2.4 Vegetation & Foliage Systems (Ghibli Grass LOD)
- **4-Ring Bezier Blade LOD:**
  - Ring 1 (0-26m): 1100 blades/m², high Bezier segment count.
  - Ring 2 (22-84m): 197 blades/m².
  - Ring 3 (76-290m): 31 blades/m².
  - Ring 4 (260-1250m): 3.7 blades/m², wider stroke width.
- **Continuous Density Law:** $\text{blades}/m^2(d) = B_i \cdot \min\left(1, \left(\frac{d_{n,i}}{d}\right)^{1.5}\right)$.
- **CPU Shuffled Prefix Thinning:** Instance buffer is shuffled so any prefix is a fair sample; CPU lowers instance count with zero vertex shader overhead.

### §2.8 Audio Engine & Atmospheric Life
- **WebAudio Sound Synthesizer:** Zero audio files loaded over network. Synthesizes wind noise (filtered pink noise), river water (bandpass resonators), bird chirps (FM frequency sweeps), and train chug.
- **Atmospheric Life Boids:** Flocking bird boids, floating dandelion seeds/pollen, and butterflies.

---

## 4. Architectural Patterns Checklist

- [ ] **Shared Shader Library:** Shared include (`lib/lighting`) imported by ALL scene shaders.
- [ ] **Palette Harmony (Ghibli):** Single sRGB palette table driving sky, terrain, foliage, and vehicles.
- [ ] **4-Ring Bezier Grass LOD (Ghibli):** Continuous $(d_n/d)^{1.5}$ density law with CPU shuffled prefix thinning.
- [ ] **2D Scrolled Wind Field RT:** 256x256 wind RT sampled by grass, trees, cloth, smoke, and pollen.
- [ ] **Toroidal State Target:** Scrolled target for persistent ground deformation & path trample.
- [ ] **One-Texture GPU Upload:** Bone transforms & cloth nodes packed into a single data texture.
- [ ] **WebAudio Sound Engine (Ghibli):** Zero-asset WebAudio synthesizer for wind, water, birds, and music.
- [ ] **Atmospheric Life Boids:** Flocking bird boids, pollen motes, and butterflies.
- [ ] **Dynamic Rail / Vehicle Element:** Procedural train chugging along a viaduct with smoke particles.
- [ ] **Architectural Foot Planting:** Stance foot locked in world space to eliminate foot sliding.
- [ ] **Pipeline Readiness Warm-up:** `isReady()` checks & offscreen rendering behind loading screen.
- [ ] **Centralized State Store:** Single settings object written by UI overlay and read by all systems.
