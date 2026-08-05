# Showcase Configs

This reference defines the six canonical showcase configurations.

## Contents

- [Alpine Dawn](#alpine-dawn)
- [Hoshi-no-Tani](#hoshi-no-tani)
- [Dune Sea](#dune-sea)
- [Tidal Shelf](#tidal-shelf)
- [Emberfall](#emberfall)
- [Neon Monsoon](#neon-monsoon)

---

**Pick a showcase config as a whole. Never mix pieces across configs.**

These six combinations are checked: the palette passes the coherence rules in [biomes.md](biomes.md), the paradigm
matches the material behaviours, the mechanic writes channels the biome actually declares,
and the camera matches what the archetype from [archetypes.md](archetypes.md) is built to withstand. Recombination is exactly
how that breaks — the reference config that this project exists to correct was assembled by
taking a painterly paradigm from one place and a near-black palette from another, and the
result was a set of muddy, unusable frames. Neither half was wrong alone. Together they
were unbuildable, and nobody noticed until the frames came back.

If you do want to recombine, that is allowed under Experimental mode (defined in [modes.md](modes.md)) — but run both deterministic validators before building:
- `validateSelection` from `selection.mjs` (or `node selection.mjs validate <selection.json>`) to verify mode, path, ambition, section, camera, and state-channel contract compatibility;
- `checkCoherence` from `check.mjs` (or `node check.mjs coherence <config.json>`) to verify art-direction and palette rules.

Selection-validation errors are hard blockers. Run all validation before building, not after.

Each config supplies the nine tokens the biome, archetype, mechanic, and camera do not:
`PROJECT_NAME`, `RENDERING_PARADIGM`, `ENGINE`, `SHADER_LANG`, `SHADER_LANG_EXT`, `MATERIAL_API`,
`ASSET_STRATEGY`, `TARGET_BROWSER_AND_HARDWARE`, and `CORE_INTERACTION_SENTENCE`.

### Alpine Dawn

| Field | Value |
|---|---|
| `PROJECT_NAME` | ALPINE-DAWN |
| Biome | Alpine Snow |
| Archetype | Traveller Coat |
| Mechanic | Surf / Carve |
| Camera | Third Person |
| Ambition | `showcase` |
| Included sections | `vegetation`, `state-buffer`, `audio` |
| Extra sections | none |
| State-channel contract | depression → R (depression depth in metres, 0 -> 0.45): carve groove lowers snow depression depth; displaced-mass → G (displaced mass, berm height 0 -> 0.25 m): carve berms raise displaced snow mass; wetness-or-compaction → B (wetness 0 -> 1): groove writes wetness, interpreted as compressed sheen |
| `RENDERING_PARADIGM` | AAA Photoreal |
| `ENGINE` | Babylon.js 7.x pinned (private device-access risk, see the Babylon WebGPU patterns reference doc), WebGPU only |
| `SHADER_LANG` / `SHADER_LANG_EXT` | WGSL / `wgsl` |
| `MATERIAL_API` | Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL |
| `ASSET_STRATEGY` | 100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies) |
| `TARGET_BROWSER_AND_HARDWARE` | Chrome stable on Windows 11, RTX-class GPU, 2560×1440 |
| `CORE_INTERACTION_SENTENCE` | carve a trail across a drift field, watch the wake break behind them |

**Why it reads as AAA:** low sun on snow gives the single strongest value contrast in
real-time rendering — warm highlight against blue shadow — and the carve wake writes a
persistent groove that proves the world is simulated rather than decorated.

### Hoshi-no-Tani

| Field | Value |
|---|---|
| `PROJECT_NAME` | HOSHI-NO-TANI |
| Biome | Ghibli Valley |
| Archetype | Traveller Coat |
| Mechanic | Flight / Glide |
| Camera | Cinematic |
| Ambition | `everything` |
| Included sections | `vegetation`, `state-buffer`, `audio` |
| Extra sections | `weather`, `water-bodies`, `architecture`, `destructibility` |
| State-channel contract | wind-gust → B (wind gust magnitude): downwash writes wind-gust magnitude; landing-depression → R (trample, blade bend 0 -> 1): landing depression becomes trample/blade bend |
| `RENDERING_PARADIGM` | Ghibli-Style Painterly Anime |
| `ENGINE` | Three.js latest stable, WebGLRenderer (WebGL2 only) |
| `SHADER_LANG` / `SHADER_LANG_EXT` | GLSL ES 3.00 raw modules / `glsl` |
| `MATERIAL_API` | Three.js RawShaderMaterial on WebGLRenderer |
| `ASSET_STRATEGY` | 100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies) |
| `TARGET_BROWSER_AND_HARDWARE` | Chrome stable on Windows 11, RTX-class GPU, 2560×1440 |
| `CORE_INTERACTION_SENTENCE` | walk through Bezier grass, glide over the viaduct, watch the train cross beneath them |

**Why it reads as AAA:** a high-key painterly palette driven from one table, 1100
blades/m² of curved-Bezier grass moving on a real wind field, and a cinematic camera that
frames the viaduct against a ridge stack. It is the config most likely to produce a
screenshot someone shares.

### Dune Sea

| Field | Value |
|---|---|
| `PROJECT_NAME` | DUNE-SEA |
| Biome | Dune Desert |
| Archetype | Desert Nomad |
| Mechanic | Surf / Carve |
| Camera | Third Person |
| Ambition | `slice` |
| Included sections | none |
| Extra sections | none |
| State-channel contract | none (omitted at slice) |
| `RENDERING_PARADIGM` | AAA Photoreal |
| `ENGINE` | Babylon.js 7.x pinned (private device-access risk, see the Babylon WebGPU patterns reference doc), WebGPU only |
| `SHADER_LANG` / `SHADER_LANG_EXT` | WGSL / `wgsl` |
| `MATERIAL_API` | Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL |
| `ASSET_STRATEGY` | 100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies) |
| `TARGET_BROWSER_AND_HARDWARE` | Chrome stable on Windows 11, RTX-class GPU, 2560×1440 |
| `CORE_INTERACTION_SENTENCE` | ride a slip face down a barchan crest, throw a sand plume into the sun |

**Why it reads as AAA:** this is the `slice` demonstration — no vegetation, no state
buffer, no audio, and it still holds up, because everything went into one sand shader,
one sky, and one figure. Back-lit translucent wraps against a bleached dune crest is a
complete image with four systems in it. Start here if you are building a first demo.

### Tidal Shelf

| Field | Value |
|---|---|
| `PROJECT_NAME` | TIDAL-SHELF |
| Biome | Ocean Shelf |
| Archetype | Robed Mage |
| Mechanic | Grapple Swing |
| Camera | XR |
| Ambition | `showcase` |
| Included sections | `vegetation`, `state-buffer`, `audio` |
| Extra sections | none |
| State-channel contract | anchor-displaced-mass → G (foam coverage 0 -> 1): displaced mass becomes localized foam coverage; landing-depression → B (bed scour depth 0 -> 0.22 m): landing depression becomes bed-scour depth; hard-landing-disturbance → A (turbidity 0 -> 1): disturbed sand becomes turbidity |
| `RENDERING_PARADIGM` | AAA Photoreal |
| `ENGINE` | Babylon.js 7.x pinned (private device-access risk, see the Babylon WebGPU patterns reference doc), WebGPU only |
| `SHADER_LANG` / `SHADER_LANG_EXT` | WGSL / `wgsl` |
| `MATERIAL_API` | Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL |
| `ASSET_STRATEGY` | 100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies) |
| `TARGET_BROWSER_AND_HARDWARE` | Chrome stable on Windows 11 with a PC-tethered headset, 90 Hz per eye, RTX-class GPU |
| `CORE_INTERACTION_SENTENCE` | wade the shallows, swing from a rock stack, watch a storm front close in |

**Why it reads as AAA:** water at arm's length in stereo is a scale experience nothing
else matches, and depth-absorbed shallows over a caustic-lit reef give the eye real
distance cues. The XR budget on the rig is what makes the mage's hands hold up at 0.5 m.

### Emberfall

| Field | Value |
|---|---|
| `PROJECT_NAME` | EMBERFALL |
| Biome | Volcanic |
| Archetype | Armored Soldier |
| Mechanic | Beam Cannon |
| Camera | First Person |
| Ambition | `showcase` |
| Included sections | `vegetation`, `state-buffer`, `audio` |
| Extra sections | none |
| State-channel contract | depression → R (crust thickness 0 -> 0.25 m): beam intersection reduces crust thickness; heat-scorch-disturbance → B (temperature normalised 0 -> 1): beam heat raises normalized temperature |
| `RENDERING_PARADIGM` | AAA Photoreal |
| `ENGINE` | Babylon.js 7.x pinned (private device-access risk, see the Babylon WebGPU patterns reference doc), WebGPU only |
| `SHADER_LANG` / `SHADER_LANG_EXT` | WGSL / `wgsl` |
| `MATERIAL_API` | Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL |
| `ASSET_STRATEGY` | 100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies) |
| `TARGET_BROWSER_AND_HARDWARE` | Chrome stable on Windows 11, RTX-class GPU, 2560×1440 |
| `CORE_INTERACTION_SENTENCE` | walk an ash plain, crack the crust underfoot, cut a scorch line across a cooling flow |

**Why it reads as AAA:** a disciplined dark scene, which almost nobody gets right. Ash-lit
steam anchors the light, the ash plain keeps the frame out of the dark tier, and exactly
one emissive hue punctuates it. First person puts the beam's charge bloom and the
armoured cuffs at contact range where the exposure work shows.

### Neon Monsoon

| Field | Value |
|---|---|
| `PROJECT_NAME` | NEON-MONSOON |
| Biome | Night City |
| Archetype | Void Wanderer |
| Mechanic | Summon Vehicle |
| Camera | Third Person |
| Ambition | `everything` |
| Included sections | `vegetation`, `state-buffer`, `audio` |
| Extra sections | `weather`, `water-bodies`, `architecture`, `destructibility` |
| State-channel contract | track-depression → R (water depth 0 -> 0.04 m): tracks displace puddle-water depth; track-compaction-disturbance → B (disturbance from footsteps and vehicles 0 -> 1): vehicle passage writes surface disturbance; track-edge-displaced-mass → G (ripple phase and amplitude): edge displacement becomes ripple phase/amplitude |
| `RENDERING_PARADIGM` | AAA Photoreal |
| `ENGINE` | Three.js latest stable, WebGLRenderer (WebGL2 only) |
| `SHADER_LANG` / `SHADER_LANG_EXT` | GLSL ES 3.00 raw modules / `glsl` |
| `MATERIAL_API` | Three.js RawShaderMaterial on WebGLRenderer |
| `ASSET_STRATEGY` | 100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies) |
| `TARGET_BROWSER_AND_HARDWARE` | Chrome stable on Windows 11, RTX-class GPU, 2560×1440 |
| `CORE_INTERACTION_SENTENCE` | walk a rain-lit street, summon a machine out of the dark, ride it through standing water |

**Why it reads as AAA:** the wet road is the light source, so the brightest large surface
in a night scene is the ground — which is both physically right and the reason the frame
never goes murky. A mantled figure whose hem tracks the terrain, throwing spray through
sodium light, is the shot. One warm accent, no second neon hue.
