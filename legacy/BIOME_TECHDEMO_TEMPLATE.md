# {{PROJECT_NAME}} — Tech Demo · Implementation Brief

<!--
  TEMPLATE GUIDE
  ==============
  This template was extracted from the SnowFlow prompt that produced
  https://github.com/Noniv/snowflow_demo — a fully procedural, zero-asset
  Babylon.js + WebGPU snow rendering demo.

  HOW TO USE:
  1. Search for every {{PLACEHOLDER}} and replace it with your game-specific content.
  2. Read the <!-- GUIDANCE --> comments — they explain WHY each section matters
     and what made the snow version effective.
  3. Delete all <!-- GUIDANCE --> comments before shipping the final prompt.
  4. The template preserves the TONE and STRUCTURE of the original, which were
     critical to the quality of the output. Resist the urge to soften it.
  5. Include at least 3 CONCRETE NUMBERS (resolution, distance, count, percentage)
     in every major section. Vague specs produce vague results. The snow prompt
     specified "sub-10 cm", "4096²", "2 cm texels", "20-40 shells", "4-6 lights",
     "60 seconds visible" — this precision drove quality.
  6. Use the phrase "suggested, adjustable where a different implementation
     produces a stronger result" when you want to set a direction but give the
     AI latitude. This pattern was critical in the original.

  PROVEN BIOME IDEAS THIS TEMPLATE FITS:
  - Desert (sand dunes, heat haze, sandstorm, oasis water)
  - Ocean (waves, foam, caustics, underwater, coral)
  - Volcanic (lava flow, obsidian, ash, embers, heat distortion)
  - Forest (foliage, volumetric light, rain, puddle reflections)
  - Tundra/Ice (glaciers, aurora, refraction, cracking)
  - Alien (bioluminescence, floating particles, exotic materials)
-->

You are the sole engineer and technical artist on a real-time graphics tech demo. Build it end to end. This document is the spec, the art direction, and the acceptance criteria.

## 0. Prime Directive

Visual quality is the product. There is no gameplay loop, no progression, no UI to design around. A player will load this, walk around {{PRIMARY_ENVIRONMENT}} for ninety seconds, {{CORE_INTERACTION_SENTENCE}}, and either think "this is AAA" or close the tab. Everything below serves that single judgment.

<!--
  GUIDANCE — CORE_INTERACTION_SENTENCE:
  This is the 10-second elevator pitch of what the player DOES.
  Keep it to one sentence with 2-3 concrete verbs.

  SNOW EXAMPLE: "cast a few spells, surf across a dune"
  DESERT EXAMPLE: "trigger sandstorms, ride a sand-slide down a dune face"
  OCEAN EXAMPLE: "dive below the surface, watch a storm roll in"
  LAVA EXAMPLE: "shatter obsidian, watch lava carve new channels"
-->

Two rules that override everything else in this document:

If a requirement in this brief conflicts with making the demo more beautiful, break the requirement. Note the deviation in DECISIONS.md with a one-line rationale. You have full authority to change scope, swap techniques, or drop a feature that isn't paying for its pixels.

Anything that reads as low-poly, flat-shaded, untextured, placeholder, or "indie prototype" is a defect, not a stepping stone. If you can't make a thing look finished, cut it from the frame rather than ship it looking rough.

Do not stop at "it works." Stop when every captured frame looks polished, cohesive, and production-ready.

---

## 1. Stack and Hard Constraints

| Concern        | Spec |
|----------------|------|
| Language        | Modern JavaScript (ES2023 modules). JSDoc types encouraged, no TypeScript build step required. |
| Engine          | {{ENGINE — default: Babylon.js latest stable, WebGPU only}} |
| Shader Language | {{SHADER_LANG — default: WGSL}} |
| Bundler         | Vite |
| Target          | {{TARGET_BROWSER_AND_HARDWARE — e.g., Chrome stable on Windows 11, RTX 5070 Ti, 2560x1440}} |
| Frame target    | 90 FPS sustained. 60 FPS floor. |
| Frame time      | No frame exceeding median + 4 ms after the loading screen dismisses. |

<!--
  GUIDANCE — ENGINE:
  The original used Babylon.js with WebGPU-only (no WebGL fallback).
  The "no fallback" rule is critical — it prevents the AI from spending
  time on compatibility code instead of visual quality.
  Alternatives: Three.js (WebGPU renderer), PlayCanvas.
  If swapping, update the shader language and API references throughout.
-->

No fallbacks. No WebGL path, no mobile path, no feature detection branches. If `navigator.gpu` is absent, show a single line of text and stop. Do not spend a minute on compatibility.

**Assets.** {{ASSET_STRATEGY}}

<!--
  GUIDANCE — ASSET_STRATEGY:
  The snow demo was FULLY PROCEDURAL — zero external assets.
  This was extraordinarily effective because it:
  (a) eliminated asset-loading bugs
  (b) gave total control over quality
  (c) kept the repo self-contained

  Decide per-biome whether procedural or authored assets win:

  PROCEDURAL WINS FOR: terrain, noise-based materials, sky, basic geometry
  AUTHORED WINS FOR: complex organic shapes, PBR material scans, HDRIs

  SNOW EXAMPLE: "Generate procedurally where it produces a better or more
  controllable result, including terrain, noise, and most masks. Use free
  CC0 assets where hand-authored data wins... Vendor everything into the
  repository; no runtime CDN fetches."

  FULLY PROCEDURAL EXAMPLE: "Generate everything procedurally. No textures,
  no meshes, no HDRIs. The sky is an atmosphere integral, materials are
  noise-based, geometry is lofted from tables. The repository contains
  zero binary assets."
-->

---

## 2. Systems

### 2.1 Terrain

{{TERRAIN_PHILOSOPHY_SENTENCE}}

<!--
  GUIDANCE — TERRAIN_PHILOSOPHY_SENTENCE:
  One sentence that frames WHY the terrain needs to be exceptional.
  This sets the emotional bar for the AI.

  SNOW EXAMPLE: "A flat plane will kill this demo. The snow field needs real form."
  DESERT EXAMPLE: "A flat sand plane will read as a Unity default. The dunes need mass."
  OCEAN EXAMPLE: "A flat water plane is a tech demo from 2005. The ocean needs weight and motion."
  LAVA EXAMPLE: "Still lava is lava-coloured water. The flow needs viscosity and memory."
-->

Build a geometry clipmap or nested-ring LOD centred on the player, so triangle density is high near the camera and falls off with distance. Aim for roughly sub-10 cm vertex spacing in the inner ring at default zoom.

Height comes from layered procedural noise composited on the GPU: {{TERRAIN_NOISE_LAYERS}}.

<!--
  GUIDANCE — TERRAIN_NOISE_LAYERS:
  List 3-4 frequency bands from macro to micro, each with a PHYSICAL SCALE
  and a DIRECTIONAL or STRUCTURAL constraint. The snow version was exceptional
  because it didn't just stack fBm — it gave the noise directional intent
  via a prevailing wind vector.

  SNOW EXAMPLE: "broad dune forms measured in tens of metres, medium drifts
  and wind lobes measured in metres, and sastrugi ridges and ripples measured
  in decimetres. Do not use a single fBm octave stack and call it done. The
  terrain needs directional structure carved by a prevailing wind. Encode a
  wind direction and let the medium and fine layers stretch and shear along it."

  DESERT EXAMPLE: "sweeping barchan dune crescents at 50-100m scale, star-dune
  arms at 10-20m, wind ripples at 10-30cm. Encode prevailing wind and let the
  slip faces form naturally on the lee side."

  OCEAN EXAMPLE: "broad swell at 50-200m wavelengths with Gerstner displacement,
  medium wind chop at 2-10m, capillary ripples at 5-20cm. Encode wind direction
  and fetch distance. The spectrum must be ocean, not fBm."
-->

{{TERRAIN_LANDMARKS}}

<!--
  GUIDANCE — TERRAIN_LANDMARKS:
  The snow version used sparse rock outcrops and ice shelves to break the
  monotony and provide scale reference. Every biome needs something like this.

  SNOW EXAMPLE: "Include a small number of exposed rock outcrops or ice shelves
  so there is silhouette and scale in the mid-distance, with snow accumulation
  blending onto their upward faces. Keep them sparse."

  DESERT EXAMPLE: "Include weathered rock formations and a distant mesa or
  arch, with sand accumulation on windward faces."

  LAVA EXAMPLE: "Include cooled basalt pillars and collapsed lava tubes that
  break through the flow surface."
-->

The far field needs {{FAR_FIELD_TREATMENT}}. The proven approach is a raymarched heightfield in the sky shader — with analytic normals, ridge-on-ridge occlusion, a sun-direction march for cast shadows, and the same material logic and atmosphere as the near field — so near and far terrain meet at one consistent colour rather than reading as composited layers. A simpler impostor ring is acceptable only if it achieves the same visual continuity.

<!--
  GUIDANCE — FAR_FIELD_TREATMENT:
  The snow demo raymarched distant mountains entirely in the sky shader —
  no geometry, behind everything by construction. This was more sophisticated
  than the original prompt's suggestion of "impostor ring or matte projection"
  and the result was seamless near-to-far colour continuity.

  SNOW EXAMPLE: "mountains and heavy aerial perspective"
  DESERT EXAMPLE: "heat-hazed plateaus and distant mesa silhouettes"
  OCEAN EXAMPLE: "a storm front on the horizon with volumetric cloud banks"
-->

### 2.2 {{PRIMARY_MATERIAL_NAME}} Shading

This shader is the most important code in the project. Budget accordingly.

Build a custom material using {{ENGINE}}'s ShaderMaterial, a PBRCustomMaterial plugin, or an equivalent approach. Use {{SHADER_LANG}} through NodeMaterial or raw shader code, not a stock PBR material with a {{NAIVE_DEFAULT}} albedo.

<!--
  GUIDANCE:
  The "not a stock PBR with [color] albedo" line is critical. It forces
  the AI to write a custom shader from scratch rather than tweaking defaults.
  Replace {{NAIVE_DEFAULT}} with whatever the lazy approach would be for your
  biome: "white" for snow, "tan" for sand, "blue" for ocean, "orange" for lava.
-->

**Required behaviours:**

{{MATERIAL_BEHAVIOURS}}

<!--
  GUIDANCE — MATERIAL_BEHAVIOURS:
  This is the most important section of the entire prompt. List 4-6 specific
  material properties, each as a bold heading + 1-2 sentences of direction.
  Be PRESCRIPTIVE about technique and OPINIONATED about what "good" looks like.

  The snow version nailed this with:
  1. Multi-scale normals (3 tiling scales, triplanar on slopes)
  2. Subsurface scattering (wrapped diffuse + back-scatter, blue-white glow)
  3. View-dependent glinting (high-freq normal perturbation, narrow lobe, stable hash)
  4. Surface state channels (compression, wetness, ice from shared buffer)
  5. Contact detail (micro-occlusion, chunky granularity at trail edges)

  DESERT EXAMPLE:
  1. Multi-scale normals — wind ripples, medium dunes, broad curves
  2. Subsurface scattering — sand is translucent; back-lit dune crests glow amber
  3. Specular glinting — individual sand grains catch sunlight, stable under TAA
  4. Heat haze — screen-space distortion increasing with distance and sun angle
  5. Wet/dry state — oasis edges darken sand albedo and tighten specular

  LAVA EXAMPLE:
  1. Emissive cracking — Voronoi-based cooled crust with bright emission in cracks
  2. Flow-dependent normals — ropy pahoehoe texture aligned to flow velocity
  3. Temperature gradient — hot (yellow-white) to cool (dark red to black) along flow age
  4. Subsurface glow — thin crust regions transmit orange light from beneath
  5. Surface state channels — temperature, flow velocity, crust thickness
-->

Build the material's core lighting response as a shared shader include (e.g., `lib/{{PRIMARY_MATERIAL_NAME}}Lighting.{{SHADER_LANG_EXT — default: wgsl}}`) that every surface in the scene imports — terrain, character, wake, particles, abilities. If a surface responds differently to the same light, the visual unity breaks. One function, used everywhere.

<!--
  GUIDANCE — SHARED SHADER INCLUDE:
  This is a CRITICAL architectural pattern from the snow demo. The repo created
  src/shaders/lib/ with shared includes like snowSubsurface.wgsl, noise.wgsl,
  lighting.wgsl, deformationRead.wgsl, atmosphereCommon.wgsl. The SAME
  snowSubsurface function was called by the terrain shader, the robe shader,
  the wake shader, the spray shader, the water shader, AND the ice shader.
  This is why "a spell lights the snow through a berm crest" worked — every
  surface ran the identical light response.

  Since WGSL has no native #include, use ES module string composition:
  import the .wgsl files as raw strings (via Vite's ?raw suffix) and
  concatenate them into the shader source at build time.
-->

### 2.3 Terrain State and {{DEFORMATION_TYPE}}

This is the core interactive system. Everything writes here; the {{PRIMARY_MATERIAL_NAME}} shader reads it.

<!--
  GUIDANCE — DEFORMATION_TYPE:
  The snow version called this "Deformation" — the persistent buffer where
  footprints, spells, and surfing all left marks. This concept maps to:

  DESERT: "Erosion and Displacement" (footprints, wind erosion, sand avalanches)
  OCEAN: "Wave State and Foam" (wakes, splash patterns, foam persistence)
  LAVA: "Flow State and Cooling" (crust formation, channel carving, reheating)
  FOREST: "Deformation and Moisture" (muddy footprints, rain accumulation, puddles)
-->

Maintain a player-following render target covering roughly {{STATE_BUFFER_COVERAGE — default: 60-100 m}}, with resolution high enough for approximately {{STATE_BUFFER_TEXEL_SIZE — default: 2 cm}} texels in the {{DEFORMATION_TYPE}} area. A {{STATE_BUFFER_SPEC — default: 4096 sq R16F}} target scrolled toroidally as the player moves is a reasonable starting point. Snap movement to texel boundaries to avoid swimming.

**Suggested channels, packed across one or two targets as appropriate:**

{{STATE_BUFFER_CHANNELS}}

<!--
  GUIDANCE — STATE_BUFFER_CHANNELS:
  List the channels your material needs to read. Each one should be a
  persistent, GPU-writable value that accumulates over time.

  SNOW EXAMPLE:
  - Depression depth — how far the surface is pushed down
  - Displaced mass — snow pushed out of a depression, forming berms
  - Compression, wetness, and ice — persistent surface states for shading

  DESERT EXAMPLE:
  - Depression depth — footprint/track depth
  - Displaced mass — sand pushed to edges forming ridges
  - Moisture — wet sand from oasis proximity or spells
  - Wind erosion age — how long this area has been exposed to wind

  LAVA EXAMPLE:
  - Crust thickness — how much the surface has cooled
  - Flow velocity — current magma movement speed and direction
  - Temperature — drives emission color and material properties
  - Player disturbance — crust cracking from character weight
-->

**Rules:**

{{DEFORMATION_TYPE}} is persistent and additive, accumulated by writing brush splats into the target each frame. Never rebuild it from a list of past events.

Apply {{RECOVERY_MECHANISM}} over time, so {{DEFORMATION_MARKS}} soften and eventually {{RECOVERY_OUTCOME}}. Tune it so a {{DEFORMATION_MARK_SINGULAR}} remains clearly visible after 60 seconds.

<!--
  GUIDANCE — RECOVERY_MECHANISM:
  How does the environment "heal"?

  SNOW: "slow refill through a gentle diffusion and decay pass" — trails soften
  DESERT: "wind-driven infill from prevailing direction" — tracks fill from upwind
  LAVA: "reheat from below and crust re-formation" — cracks seal over
  OCEAN: "wave action and foam decay" — wakes dissolve
-->

Terrain vertex displacement samples the {{STATE_BUFFER_CHANNELS}} channels. Recompute normals from the same data so lighting and shadowing respond correctly. A {{DEFORMATION_MARK_SINGULAR}} that does not self-shadow is a failure.

Player feet, the {{CENTREPIECE_MECHANIC}} wake, and every {{ABILITY_NOUN}} write into this buffer. That shared write path is what makes the {{ABILITY_NOUN_PLURAL}} feel embedded in the {{PRIMARY_MATERIAL_NAME}} rather than like effects floating above it.

### 2.4 Atmosphere and Lighting

{{ATMOSPHERE_DIRECTION}}

<!--
  GUIDANCE — ATMOSPHERE_DIRECTION:
  Describe the lighting setup in 2-3 sentences. The critical insight from
  the snow version: the cool-shadow / warm-light contrast was ESSENTIAL.
  Every biome needs an equivalent dominant contrast:

  SNOW: Low warm sun + strongly blue-shifted ambient = warm highlights, blue shadows
  DESERT: High harsh sun + warm amber ambient = bleached highlights, deep purple shadows
  LAVA: Dim overcast sky + bright emissive ground = inverted lighting, ground illuminates upward
  OCEAN: Dramatic low sun + deep teal ambient = golden highlights, deep blue-green shadows
  FOREST: Dappled canopy light + green-shifted ambient = golden shafts, deep green shadows
-->

Use cascaded shadow maps with PCSS-style soft filtering. Tune cascade splits so near-field {{DEFORMATION_MARK_SINGULAR}} shadows stay crisp.

If terrain geometry exists only in the vertex shader (no CPU-side mesh — which is the case for procedural clipmap terrain), the engine's built-in shadow generator will not work. You will need to implement shadow cascades yourself, registering each caster's actual vertex program. Budget for this — it is a significant system. Texel-snap cascade projections in world space and stabilise against a rotation-invariant bounding sphere to eliminate shadow shimmer.

{{SKY_APPROACH}}

<!--
  GUIDANCE — SKY_APPROACH:
  SNOW EXAMPLE: "Use a high-quality HDRI or a physically based sky model if it
  gives better control over sun angle. Ambient light must be strongly blue-shifted.
  The cool-shadow and warm-light contrast is essential to the snow rendering."

  NOTE: The snow demo ultimately used a Nishita single-scattering atmosphere model
  with analytic computation rather than an HDRI, because it needed the sun angle
  slider to correctly drag all ambient/horizon/zenith values with it. Consider
  whether your biome needs the same kind of parametric control.
-->

Add fog and aerial perspective with height falloff. Distance should compress contrast noticeably.

Add {{AMBIENT_MOTION_EFFECT}}: {{AMBIENT_MOTION_DESCRIPTION}}. It should make the environment feel alive without obscuring the terrain.

<!--
  GUIDANCE — AMBIENT_MOTION_EFFECT:
  The snow demo used "ground blow / spindrift" — low wind-driven snow streaming
  across the field. Every biome needs an equivalent ambient motion:

  DESERT: "dust devils and low sand haze"
  OCEAN: "spray mist and distant whitecaps"
  LAVA: "rising heat shimmer and ember particles"
  FOREST: "falling leaves and pollen motes"
-->

Add volumetric light shafts only where they materially improve the image. Keep them restrained.

{{ABILITY_NOUN_PLURAL}} emit light. Budget 4-6 dynamic lights maximum, with tight radii. Ensure the {{PRIMARY_MATERIAL_NAME}} shader's {{LIGHT_INTERACTION_TERM}} responds to them so a {{ABILITY_NOUN_SINGULAR}} visibly {{LIGHT_INTERACTION_DESCRIPTION}}.

<!--
  GUIDANCE — LIGHT_INTERACTION_TERM and DESCRIPTION:
  The snow version had spells illuminate the snow's subsurface scattering,
  so light visibly traveled THROUGH the drift. This was a standout effect.

  SNOW: subsurface-scattering term — "illuminates the snow from within the drift it touches"
  DESERT: specular/translucency — "catches individual sand grains in its radius"
  LAVA: emissive response — "reheats the crust in its radius, brightening the cracks"
  OCEAN: caustic/refraction — "projects caustic patterns onto the sea floor"
-->

### 2.5 Post-Processing

Order matters. Suggested chain:

{{POST_PROCESSING_CHAIN}}

<!--
  GUIDANCE:
  The snow version used:
  TAA -> SSAO -> SSR (wet/icy only) -> restrained DoF -> restrained bloom
  -> ACES/AgX tonemapping -> subtle film grain -> post-TAA sharpening

  Key principles that made it work:
  1. TAA is essential for stabilising glinting and thin geometry
  2. Every post-process individually toggleable for A/B comparison
  3. The PRIMARY FAILURE MODE was called out explicitly

  SNOW: "Blown-out white is the primary failure mode for snow renders"
  DESERT: "Washed-out highlights and dead shadows are the failure mode"
  LAVA: "Clipped emissive and lost dark detail are the failure mode"
  OCEAN: "Banding in deep blues and clipped foam highlights are the failure mode"
-->

Build a shared depth prepass that carries linear view depth and a material-type mask (e.g., specular/ice flag). Feed this into every post-process that needs depth — TAA reprojection, DoF, volumetric shafts, SSR gating. One prepass, read everywhere. Do not let each post-process compute its own depth.

TAA is essential for stabilising {{TAA_STABILISATION_TARGETS}}. Every post-process should be individually toggleable from the settings overlay for A/B comparison. {{PRIMARY_FAILURE_MODE}}, so monitor {{FAILURE_MODE_METRIC}} constantly.

### 2.6 Character and {{CHARACTER_COSTUME}}

The character will be seen from behind at mid-distance almost the entire time. Spend the budget on silhouette, cloth, and shading; spend almost nothing on the face.

{{CHARACTER_DESCRIPTION}}

<!--
  GUIDANCE — CHARACTER_DESCRIPTION:
  Describe the character's outfit in terms of SILHOUETTE and MATERIAL PROPERTIES,
  not lore. Focus on what MOVES (cloth panels, hair, accessories) and what
  CATCHES LIGHT in interesting ways.

  SNOW EXAMPLE: "Create a hooded, layered robe with a deep cowl, long sleeves,
  an over-mantle, and a trailing hem. Use shell-based fur at the hood and cuffs,
  with roughly 20-40 shells and alpha-tested strands."

  DESERT EXAMPLE: "Create flowing desert robes with layered wraps, a head
  covering with a long tail, and leather belts with hanging pouches. Use
  translucent fabric layers that catch backlight."

  LAVA EXAMPLE: "Create a heat-resistant suit with segmented obsidian-like
  armor plates over a glowing under-layer. Exposed joints emit heat shimmer."
-->

Add cloth simulation to {{CLOTH_PANELS}}. A GPU or CPU Verlet simulation with distance and bending constraints is acceptable. Drive it with locomotion velocity, acceleration, and the wind field. During {{CENTREPIECE_MECHANIC}}, the cloth should {{CLOTH_CENTREPIECE_REACTION}}.

Decouple simulation resolution from visual tessellation. Run the Verlet solver on a coarse grid (e.g., 36×12) and reconstruct a finer surface (e.g., 72×32) in the vertex shader using Catmull-Rom or similar interpolation. This lets you increase visual quality without increasing physics cost. Folds should live in the rest shape rather than in a normal map.

Pack all per-frame character data into a single small texture or buffer: bone transforms, cloth node positions, and any other animated state. One upload per frame, no allocation. A texture where rows 0–N are bone matrices and rows N+ are simulation node positions is a proven pattern.

{{CLOTH_SHADING_REQUIREMENTS}}

<!--
  GUIDANCE:
  SNOW EXAMPLE: "Cloth shading needs sheen or fuzz and an anisotropic response
  for a woven appearance, plus subsurface scattering on thin regions. Do not
  use a plain PBR dielectric."
-->

Keep the face in shadow beneath the {{HEAD_COVERING}}. Do not model detailed facial features that cannot be finished to the same standard.

If a rig and locomotion animation cannot be brought to a high standard, prefer a fully cloth- and procedurally driven figure over a stiff or poorly animated one. Feet must plant rather than slide. Achieve this architecturally: a foot's world position is written once on touchdown and held absolutely fixed while IK reaches for it. A planted foot cannot slide because no code path exists to move it. Advance gait phase with ground distance traveled so stride length equals ground speed by construction — do not blend animation clips.

Feet {{FOOT_INTERACTION}} on each step. This must be frame-accurate with each footfall.

<!--
  GUIDANCE — FOOT_INTERACTION:
  SNOW: "displace snow and kick up spray"
  DESERT: "sink into sand and kick up puffs of dust"
  LAVA: "crack the crust and cause brief bright fissures"
  OCEAN: "splash and leave temporary foam prints"
-->

### 2.7 Camera and Controls

Use third-person, action-MMO framing. Position the camera over the shoulder with a slight offset rather than directly behind the character.

WASD movement is relative to camera facing. The mouse orbits. The scroll wheel zooms across a smooth, eased range.

Use a spring-arm camera with collision-free but velocity-aware behaviour. It should lag slightly under acceleration, widen the FOV under speed, and tighten on stopping. All transitions must ease, with no snapping.

Add subtle camera shake to heavy {{ABILITY_NOUN_PLURAL}} and hard {{CENTREPIECE_MECHANIC}} {{CENTREPIECE_VERB_PLURAL}}. Keep it subtle.

### 2.8 {{ABILITY_NOUN_PLURAL}}: Keys 1-5

All five {{ABILITY_NOUN_PLURAL}} share one bending grammar: continuous, momentum-carrying, unbroken flow. No instant spawns and no instant despawns. Everything eases in from the {{PRIMARY_MATERIAL_NAME}} and settles back into it. Every {{ABILITY_NOUN_SINGULAR}} reads and writes the terrain state buffer.

<!--
  GUIDANCE:
  The "continuous, momentum-carrying, unbroken flow" principle was essential.
  It prevents the AI from making effects that pop in/out. Adapt the VERBS
  to your biome but keep the PHILOSOPHY.
-->

Suggested set, adjustable where a different implementation produces a stronger result:

{{ABILITY_1_NAME}} — {{ABILITY_1_DESCRIPTION}}

{{ABILITY_2_NAME}} — {{ABILITY_2_DESCRIPTION}}

{{ABILITY_3_NAME}} — {{ABILITY_3_DESCRIPTION}}

{{ABILITY_4_NAME}} — {{ABILITY_4_DESCRIPTION}}

{{ABILITY_5_NAME}} — {{ABILITY_5_DESCRIPTION}}

<!--
  GUIDANCE — ABILITY DESIGN:
  Each ability in the snow version:
  1. Had a CLEAR VISUAL IDENTITY (crescent wave, held stream, eruption, crystals, vortex)
  2. LEFT A PERSISTENT MARK on the terrain buffer
  3. Used SHARED PRIMITIVES (swept surfaces, GPU particles, the same brush() call)
  4. Was described with PHYSICAL verbs (rises, ploughs, erupts, grows, strips)

  SNOW EXAMPLES:
  Sweep — crescent wave of slush, ploughs a channel with berms
  Ribbon — held continuous stream, scores curved lines in snow
  Bloom — eruption column, crater with raised rim, fallout curtain
  Crystallize — refractive ice crystals grow from drift
  Vortex — swirling column strips surface snow, settles back

  DESERT EXAMPLES:
  Sandblast — directional jet strips sand to bedrock
  Quicksand — sinkhole forms, swallowing sand inward
  Glass — lightning fuses sand into fulgurite formations
  Dust Devil — localised vortex lifts and re-deposits sand
  Dune Surge — wave of sand rises and travels forward
-->

**Implementation direction:** {{ABILITY_IMPLEMENTATION_DIRECTION}}

All abilities that move a coherent body of {{ABILITY_MATERIAL_NAME}} should share a single mesh and a single draw call. Implement a strand manager: one mesh with N strands, where inactive strands are zeroed rather than removed. The draw count must not depend on how many abilities are active. Each ability module configures its strand(s) — shape, position, lifetime — but does not own geometry.

<!--
  GUIDANCE — STRAND ARCHITECTURE:
  The snow demo's waterBody.js managed one mesh, one draw, eight strands.
  Four of the five spells were structurally the same object: a swept surface
  along a spine with a radius, a parallel-transported frame, and a foam channel.
  An unused strand was zeroed, so the draw count was constant regardless of
  active spells. This is a major performance win and also forces architectural
  consistency across abilities.

  SNOW EXAMPLE: "use swept procedural ribbon or tube meshes updated on the
  GPU from a spline or particle spine for the coherent water body, GPU compute
  particles for spray, mist, and droplets, and a refraction pass for translucency."
-->

**{{ABILITY_MATERIAL_NAME}} shading needs:**

{{ABILITY_MATERIAL_PROPERTIES}}

<!--
  GUIDANCE:
  List 4-6 specific material requirements for the ability effects.

  SNOW (WATER) EXAMPLE:
  - Refraction with restrained chromatic dispersion
  - Depth-based absorption tint
  - Animated flow-map normals
  - Foam and slush at the leading edge
  - Shed droplets with correct motion-blur streaking

  REFRACTION OPTIMISATION (from the snow demo):
  Full screen-space refraction with a scene copy is expensive. If the sky
  LUT already stores a solved ground bounce, refraction can sample it
  directly — three lookups at three indices of refraction give chromatic
  dispersion, and path-length absorption gives tint. No second opaque pass,
  no scene copy. Prefer this approach if your biome uses an analytic sky.
-->

### 2.9 {{CENTREPIECE_MECHANIC}}: Hold {{CENTREPIECE_INPUT — default: RMB}}

This will be used more than everything else combined. It receives the most polish.

{{CENTREPIECE_DESCRIPTION}}

<!--
  GUIDANCE — CENTREPIECE_DESCRIPTION:
  This is the MOST IMPORTANT interactive element. Describe it in 3-4 paragraphs:
  1. What PHYSICALLY happens (mechanic)
  2. What it LOOKS like (visual centrepiece)
  3. What it WRITES to the terrain buffer (persistence)
  4. How it FEELS (transitions, camera, cloth, speed cues)

  SNOW (SURF) EXAMPLE:
  "Holding RMB raises a crest of compressed snow under the player's feet. The
  player accelerates. Mouse movement steers carving turns with visible body
  lean and a banked camera.

  The wake is the centrepiece: a curling, breaking wave of displaced snow trails
  behind and towards the outside of the turn, throwing a spray plume that catches
  sunlight and casts a shadow.

  Snow-surf carves a deep, persistent groove into the terrain buffer with high
  berms. A completed run should remain visible from across the field.

  Entering and exiting use eased transitions, never snaps. The robe whips
  backwards, the FOV widens, and wind streaks appear in screen space."

  DESERT (SANDBOARD) EXAMPLE:
  "Holding RMB summons a slab of compressed sand under the player's feet.
  The player slides downhill, accelerating with slope..."

  LAVA (OBSIDIAN SKATE) EXAMPLE:
  "Holding RMB flash-cools a path of obsidian ahead of the player's feet.
  The player glides on the smooth surface..."
-->

Implementation direction for the wake: build it as a static lattice mesh with vertices carrying only grid indices (column, row, side). Encode the spine as a small data texture and place all vertices in the vertex shader. Upload cost must be constant regardless of wake length — a 19-metre wake and a 2-metre wake should cost the same buffer and the same upload. Normals must be differenced from the same point function the geometry uses, so they cannot disagree with the surface.

There is no audio in this demo. Every sensation — speed, impact, weight, wind — must be communicated purely through visual cues: FOV changes, screen-space streaks, cloth reaction, camera shake, and particle density.

Turning at speed should feel weighty and analogue. Tune it by hand until it feels good, not merely until it compiles.

---

## 3. Performance Engineering

Garbage collection is your primary enemy. A 12 ms garbage-collection pause is a visible hitch and instantly destroys the AAA impression.

- Zero allocations in the render loop. Do not use `new` inside per-frame code. Pre-allocate scratch `Vector3`, `Matrix`, and `Quaternion` instances at module scope and reuse them.
- Do not use `map`, `filter`, `reduce`, spread syntax, or destructuring that creates new objects in hot paths. Use plain indexed `for` loops.
- Do not construct strings each frame, including for the performance overlay. Update the overlay on a throttled interval and reuse buffers.
- Use object pools for every transient effect, particle burst, and decal.
- Use pre-allocated typed arrays for all GPU buffer uploads. Write into them rather than rebuilding them.
- Use `scene.freezeActiveMeshes()`, `mesh.freezeWorldMatrix()`, `material.freeze()`, and `scene.blockMaterialDirtyMechanism` aggressively for static content.
- Use thin instances for all repeated geometry.
- Profile with the Chrome performance panel and {{ENGINE}}'s inspector. Ship a frame-time graph in the overlay showing the 1% low, not merely an FPS counter. Average FPS will hide the exact hitching problem that matters most.
- Set a frame budget and hold to it. At 90 FPS, the total budget is 11.1 ms. Allocate it explicitly across terrain, {{PRIMARY_MATERIAL_NAME}} shading, shadows, VFX, cloth, and post-processing. Record actual measured cost per system in PERF.md.
- Track VRAM consumption. Document the size of every major allocation (heightfield textures, deformation targets, shadow cascades, LUTs) in PERF.md. A 4096² RGBA16F texture is 128 MB. Budget accordingly.

<!--
  GUIDANCE:
  This section is almost entirely reusable as-is. The only things to adjust:
  - Engine-specific API names if you swap away from Babylon.js
  - The specific freeze/optimisation methods for your engine
  - The frame budget allocation if your biome has different cost distribution
  - The VRAM estimate for your biome's texture/buffer set
-->

---

## 4. Loading and Pipeline Warm-up

WebGPU pipeline compilation stutter is a real and severe risk. A shader that first compiles when the player {{DEFERRED_ACTION_EXAMPLE}} will produce a multi-hundred-millisecond freeze.

<!--
  GUIDANCE — DEFERRED_ACTION_EXAMPLE:
  SNOW: "casts spell 4"
  DESERT: "triggers the first sandstorm"
  LAVA: "walks onto the first active flow"
-->

Before the loading screen dismisses:

- Load and decode every texture, HDRI, mesh, and buffer.
- Force-compile every material and particle-system pipeline, including every {{ABILITY_NOUN_SINGULAR}}, post-process, and shader permutation, by rendering them once to a tiny offscreen target.
- Gate every material and pipeline on the engine's readiness check (e.g., `material.isReady()`). Do not assume that creating a material compiles it. Exercise each pipeline with real geometry — not just material creation — behind the loading screen. Verify `isReady()` returns true for every permutation before fading in.
- Warm every render target and run several frames of every compute pass.
- Only then fade in.

A four-second load with a clean first minute is better than an instant load that hitches. Present a tasteful loading screen. This is the first thing anyone sees, so it must not resemble an unstyled browser default.

---

## 5. UI

Provide only a settings and performance overlay, toggled with a key such as F1 or backtick and hidden by default.

Contents:

- Frame-time graph with 1% low.
- Draw-call and triangle counts.
- Individual toggles for every post-process and major system.
- Quality presets.
- Sliders for the art parameters most likely to need live tuning, including {{TUNING_SLIDERS}}.

<!--
  GUIDANCE — TUNING_SLIDERS:
  List the 5-8 parameters that will need the most iteration.

  SNOW EXAMPLE: "sun angle, fog density, glint intensity, deformation depth,
  and refill rate"

  DESERT EXAMPLE: "sun angle, heat haze intensity, sand translucency, wind
  speed, dust density, and dune slip angle"

  LAVA EXAMPLE: "emission temperature, crust thickness rate, flow speed,
  heat distortion radius, and ambient glow intensity"
-->

Build this early. It will save hours.

No HUD. No crosshair. No {{ABILITY_NOUN_SINGULAR}} bar. Nothing else on screen, ever.

Implement a single centralized settings object that every system reads. The UI overlay writes directly into this object. Do not let systems maintain their own independent parameter stores — it will make live tuning impossible when values disagree.

---

## 6. Project Structure

Suggested structure; adapt as needed:

```
/src
  /core        engine bootstrap, render loop, resource manager, pooling
  /terrain     {{TERRAIN_MODULES — e.g., "clipmap, procedural heightfield, deformation buffers"}}
  /shaders     {{SHADER_LANG}}
    /lib       shared includes: noise, lighting, {{PRIMARY_MATERIAL_NAME}} response, deformation read, atmosphere
  /character   controller, {{CHARACTER_COSTUME}} cloth, {{CHARACTER_DETAIL}}
  /{{ABILITY_DIR — e.g., "spells"}}   one module per {{ABILITY_NOUN_SINGULAR}} + shared {{ABILITY_MATERIAL_NAME}} body + light pool
  /vfx         particle systems, decals, spray
  /render      sky + IBL, shadow cascades, depth prepass
  /post        post-process chain
  /ui          settings overlay
  /assets      vendored, with ASSETS.md

DECISIONS.md   every deviation from this brief + rationale
PERF.md        measured frame budget per system + VRAM budget
```

<!--
  GUIDANCE — PROJECT STRUCTURE:
  The snow demo's actual structure matched this closely. Key additions vs.
  the original prompt:
  - /shaders/lib/ for shared WGSL includes (critical for visual unity)
  - /render/ as a separate directory for sky, shadows, depth prepass
  - The ability directory includes the shared body mesh + light pool
  - PERF.md tracks VRAM as well as CPU frame budget
-->

---

## 7. Milestones

Take a 1440p screenshot at every milestone, inspect it critically, and commit the screenshots.

1. **Foundation** — WebGPU boot, Vite, render loop, settings overlay with frame graph, camera, and WASD movement on a placeholder plane.

2. **Terrain and {{PRIMARY_MATERIAL_NAME}} Shading** — {{TERRAIN_MODULES}}, procedural heightfield, full {{PRIMARY_MATERIAL_NAME}} material with {{MILESTONE_2_KEY_FEATURES}}. **Gate: a static screenshot with no character already looks polished, atmospheric, and production-ready. Do not proceed until this is true.**

<!--
  GUIDANCE — MILESTONE_2_KEY_FEATURES:
  List the 3-4 material features + atmosphere features that must be present.

  SNOW EXAMPLE: "subsurface scattering and glinting, sun, cascaded shadows,
  sky IBL, and fog"
-->

3. **{{DEFORMATION_TYPE}}** — Full terrain state buffer, footfall displacement with {{DEFORMATION_EDGE_FEATURE}}, {{RECOVERY_MECHANISM_SHORT}}, correct normals, and self-shadowing. **Gate: {{DEFORMATION_MARK_PLURAL}} visibly {{DEFORMATION_GATE_VERB}}, form {{DEFORMATION_EDGE_FEATURE_PLURAL}}, and integrate correctly with lighting.**

<!--
  GUIDANCE:
  SNOW EXAMPLE: "footprints and trails visibly displace mass, form raised edges,
  and integrate correctly with lighting"
-->

4. **Character** — {{CHARACTER_COSTUME}}, cloth simulation, {{CHARACTER_DETAIL}}, locomotion, foot planting, and {{FOOT_INTERACTION_SHORT}} on footfall.

5. **{{CENTREPIECE_MECHANIC}}** — The centrepiece. Spend disproportionate time here.

6. **{{ABILITY_NOUN_PLURAL}}** — All five {{ABILITY_NOUN_PLURAL}}, each writing into the terrain.

7. **Post-processing and polish pass** — Full chain, tonemapping calibration, {{AMBIENT_MOTION_EFFECT}}, and restrained light shafts.

8. **Performance hardening** — Profile, eliminate every allocation in the loop, verify 90 FPS with clean 1% lows, and verify that warm-up covers every pipeline.

---

## 8. Visual Acceptance Criteria

Before declaring the demo complete, verify each item against a fresh 1440p screenshot and in motion:

- No visible faceting, hard polygon edges, or flat-shaded surfaces anywhere in frame.
- {{ACCEPTANCE_HIGHLIGHT_CRITERION}}
- Distant terrain shows clear aerial perspective and contrast compression.
- Surface detail is legible at three distinct scales simultaneously: {{THREE_SCALES}}.
- {{DEFORMATION_MARK_PLURAL}} have {{DEFORMATION_VISUAL_CRITERIA}}.
- {{MATERIAL_SPECIFIC_ACCEPTANCE_1}}
- The {{CHARACTER_COSTUME}} reads as {{COSTUME_QUALITY_BAR}}.
- {{ABILITY_MATERIAL_ACCEPTANCE}}
- {{ABILITY_LIGHT_ACCEPTANCE}}
- Every {{ABILITY_NOUN_SINGULAR}} leaves a mark on the terrain that persists after the effect ends.
- The {{CENTREPIECE_MECHANIC}} wake looks like {{CENTREPIECE_QUALITY_BAR}}.
- The demo sustains 90 FPS with 1% lows above 60 FPS.
- No hitch occurs on the first cast of any {{ABILITY_NOUN_SINGULAR}}.

<!--
  GUIDANCE — ACCEPTANCE CRITERIA:
  Each criterion should be FALSIFIABLE — you can look at a screenshot
  and say yes or no. Avoid vague terms like "looks good."

  SNOW EXAMPLES:
  - "Snow highlights are not clipped to pure white; shadows are blue rather than grey or black."
  - "Surface detail is legible at three distinct scales simultaneously: dunes, ripples, and grain."
  - "Trails have raised berms, self-shadow correctly, and soften over time."
  - "Sparkle appears only at grazing angles and does not crawl or shimmer in motion."
  - "The robe reads as layered fabric with real cloth motion, and the fur trim reads as fur."
  - "Spell water is translucent and refractive, with visible internal light scatter."
  - "Spell light visibly illuminates the snow it touches, including through-scatter."
  - "The snow-surf wake looks like displaced mass with momentum, not merely particle spray."
-->

---

## 9. Working Agreement

Build, don't test-loop. Playwright is available for capturing screenshots at milestones and catching hard regressions. Use it for those purposes. Do not build a test suite; time spent on tests is time not spent on the {{PRIMARY_MATERIAL_NAME}} shader.

Look at your own output constantly. Capture screenshots, inspect them critically, and iterate on values. Most of the quality gap between "prototype" and "AAA" is parameter tuning, and you can only close it by looking.

Do not move on from an ugly milestone. Milestone 2 in particular is a hard gate.

When a technique is not working, replace it rather than patching it. You have full latitude over the approach.

Record every deviation in DECISIONS.md, briefly. One line is sufficient.

Ship something worth screenshotting.

---

<!--
  ============================================================
  PLACEHOLDER QUICK REFERENCE
  ============================================================

  IDENTITY and FRAMING:
    {{PROJECT_NAME}}                    — e.g., "SANDSTORM", "MAGMAFLOW", "DEEPBLUE"
    {{PRIMARY_ENVIRONMENT}}             — e.g., "a desert dune field", "a volcanic flow field"
    {{CORE_INTERACTION_SENTENCE}}       — e.g., "trigger sandstorms, sandboard down a dune"

  TECH STACK (usually keep defaults):
    {{ENGINE}}                          — default: "Babylon.js latest stable, WebGPU only"
    {{SHADER_LANG}}                     — default: "WGSL"
    {{TARGET_BROWSER_AND_HARDWARE}}     — default: "Chrome stable on Windows 11, RTX 5070 Ti, 2560x1440"
    {{ASSET_STRATEGY}}                  — procedural vs. authored asset policy

  TERRAIN:
    {{TERRAIN_PHILOSOPHY_SENTENCE}}     — one sentence framing why terrain must be exceptional
    {{TERRAIN_NOISE_LAYERS}}            — 3-4 frequency bands with physical scales
    {{TERRAIN_LANDMARKS}}               — sparse features that break monotony
    {{FAR_FIELD_TREATMENT}}             — what the horizon looks like
    {{TERRAIN_MODULES}}                 — e.g., "clipmap, procedural heightfield, deformation buffers"

  PRIMARY MATERIAL:
    {{PRIMARY_MATERIAL_NAME}}           — e.g., "Snow", "Sand", "Lava", "Ocean"
    {{NAIVE_DEFAULT}}                   — e.g., "white", "tan", "orange", "blue"
    {{MATERIAL_BEHAVIOURS}}             — 4-6 material properties with technique direction

  STATE BUFFER:
    {{DEFORMATION_TYPE}}                — e.g., "Deformation", "Erosion", "Flow State"
    {{STATE_BUFFER_COVERAGE}}           — default: "60-100 m"
    {{STATE_BUFFER_TEXEL_SIZE}}         — default: "2 cm"
    {{STATE_BUFFER_SPEC}}               — default: "4096 sq R16F"
    {{STATE_BUFFER_CHANNELS}}           — list of persistent channels
    {{RECOVERY_MECHANISM}}              — how the environment heals
    {{RECOVERY_MECHANISM_SHORT}}        — short version for milestones
    {{RECOVERY_OUTCOME}}                — e.g., "heal", "fill in", "re-crust"
    {{DEFORMATION_MARKS}}               — plural noun, e.g., "trails", "tracks", "channels"
    {{DEFORMATION_MARK_SINGULAR}}       — e.g., "trail", "track", "channel"
    {{DEFORMATION_MARK_PLURAL}}         — same as DEFORMATION_MARKS
    {{DEFORMATION_EDGE_FEATURE}}        — e.g., "berms", "ridges", "cooled edges"
    {{DEFORMATION_EDGE_FEATURE_PLURAL}} — same
    {{DEFORMATION_GATE_VERB}}           — e.g., "displace mass", "erode sand", "crack crust"
    {{DEFORMATION_VISUAL_CRITERIA}}     — e.g., "raised berms, self-shadow correctly, and soften over time"

  ATMOSPHERE:
    {{ATMOSPHERE_DIRECTION}}            — 2-3 sentences on sun position and light contrast
    {{SKY_APPROACH}}                    — HDRI vs. procedural sky
    {{AMBIENT_MOTION_EFFECT}}           — e.g., "spindrift", "dust haze", "ember particles"
    {{AMBIENT_MOTION_DESCRIPTION}}      — one sentence describing the motion
    {{LIGHT_INTERACTION_TERM}}          — e.g., "subsurface-scattering term"
    {{LIGHT_INTERACTION_DESCRIPTION}}   — e.g., "illuminates the snow from within the drift"

  POST-PROCESSING:
    {{POST_PROCESSING_CHAIN}}           — ordered list of post effects
    {{TAA_STABILISATION_TARGETS}}       — e.g., "glinting and thin geometry"
    {{PRIMARY_FAILURE_MODE}}            — e.g., "Blown-out white is the primary failure mode"
    {{FAILURE_MODE_METRIC}}             — e.g., "highlight roll-off"

  CHARACTER:
    {{CHARACTER_COSTUME}}               — e.g., "robe", "desert wraps", "volcanic suit"
    {{CHARACTER_DESCRIPTION}}           — detailed outfit description
    {{CHARACTER_DETAIL}}                — secondary feature, e.g., "shell fur", "flowing scarves"
    {{CLOTH_PANELS}}                    — e.g., "hem, sleeves, and mantle"
    {{CLOTH_CENTREPIECE_REACTION}}      — e.g., "whip backwards sharply"
    {{CLOTH_SHADING_REQUIREMENTS}}      — material properties for cloth
    {{HEAD_COVERING}}                   — e.g., "hood", "headwrap", "helmet"
    {{FOOT_INTERACTION}}                — e.g., "displace snow and kick up spray"
    {{FOOT_INTERACTION_SHORT}}          — short version for milestones

  ABILITIES:
    {{ABILITY_NOUN}}                    — e.g., "spell", "power", "technique"
    {{ABILITY_NOUN_SINGULAR}}           — same
    {{ABILITY_NOUN_PLURAL}}             — e.g., "spells", "powers", "techniques"
    {{ABILITY_DIR}}                     — directory name, e.g., "spells", "powers"
    {{ABILITY_1-5_NAME}}                — names of the five abilities
    {{ABILITY_1-5_DESCRIPTION}}         — one-paragraph descriptions
    {{ABILITY_IMPLEMENTATION_DIRECTION}}— shared rendering approach
    {{ABILITY_MATERIAL_NAME}}           — e.g., "Water", "Sand", "Magma"
    {{ABILITY_MATERIAL_PROPERTIES}}     — 4-6 material requirements
    {{ABILITY_MATERIAL_ACCEPTANCE}}     — acceptance criterion
    {{ABILITY_LIGHT_ACCEPTANCE}}        — light interaction acceptance criterion

  CENTREPIECE:
    {{CENTREPIECE_MECHANIC}}            — e.g., "Snow-surf", "Sand-slide", "Lava-skate"
    {{CENTREPIECE_INPUT}}               — default: "RMB"
    {{CENTREPIECE_DESCRIPTION}}         — 3-4 paragraph description
    {{CENTREPIECE_VERB_PLURAL}}         — e.g., "carves", "slides", "glides"
    {{CENTREPIECE_QUALITY_BAR}}         — e.g., "displaced mass with momentum, not merely particle spray"

  TUNING and ACCEPTANCE:
    {{TUNING_SLIDERS}}                  — 5-8 slider parameters
    {{THREE_SCALES}}                    — e.g., "dunes, ripples, and grain"
    {{ACCEPTANCE_HIGHLIGHT_CRITERION}}  — e.g., "highlights not clipped to pure white"
    {{MATERIAL_SPECIFIC_ACCEPTANCE_1}}  — biome-specific visual check
    {{COSTUME_QUALITY_BAR}}             — e.g., "layered fabric with real cloth motion"
    {{DEFERRED_ACTION_EXAMPLE}}         — e.g., "casts spell 4"

  MILESTONE-SPECIFIC:
    {{MILESTONE_2_KEY_FEATURES}}        — 3-4 features that gate milestone 2

  NEW IN V2 (from repo analysis):
    {{SHADER_LANG_EXT}}                 — default: "wgsl" (file extension for shader includes)
-->

---

<!--
  ============================================================
  APPENDIX: PROVEN ARCHITECTURAL PATTERNS
  ============================================================
  These patterns emerged during the snow demo's development and were
  critical to its success. They are now baked into the template body,
  but this checklist helps verify your filled-in prompt covers them.

  [ ] Shared shader lib/ directory with one lighting function used by ALL surfaces
  [ ] Hand-rolled shadow cascades (needed if terrain has no CPU geometry)
  [ ] One-texture GPU upload for all per-frame character data
  [ ] Strand-based shared mesh for abilities (constant draw count)
  [ ] Static lattice + data texture for the centrepiece wake
  [ ] Refraction via sky LUT (no scene copy)
  [ ] Raymarched far field in the sky shader (not separate geometry)
  [ ] Centralized settings object (UI writes, all systems read)
  [ ] Catmull-Rom tessellation decoupling for cloth
  [ ] Foot planting by architectural constraint (position written once, held fixed)
  [ ] VRAM budget tracking alongside CPU frame budget
  [ ] Depth prepass shared by the entire post-processing chain
  [ ] isReady() gating on every pipeline during warm-up
  [ ] "No audio" → all speed/impact sensation via visual cues
-->
