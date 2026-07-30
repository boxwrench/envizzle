# Presets

This is the menu the `/envizzle` interview reads from. Every value here is written to be
pasted into `TEMPLATE.md` as-is — it is token text, not inspiration.

**The rule this whole file obeys.** The predecessor template specified grass with four
distance rings, blades per square metre, and a density law, and grass came back
beautiful. It specified terrain with noise layers in metres and amplitudes, and terrain
came back beautiful. It specified the character as "a Ghibli-inspired traveller with a
wind-blown coat and scarf" — and got back a cylinder, a sphere, and three boxes.
**Numbers got built. Adjectives did not.** So every preset below carries scales in
metres, counts, amplitudes, channel assignments, and grid dimensions. If you find
yourself editing one of these values into an adjective, you are undoing the only thing
that makes the brief work.

How the pieces combine: pick **one ambition level**, **one biome**, **one archetype**,
**one mechanic**, **one camera mode** — or take a whole entry from
[Showcase configs](#showcase-configs), which is the safer path and is explained there.

Palettes are carried in fenced `json` blocks so they can be machine-checked against the
coherence rules in `check.mjs`. Every palette shipped here returns zero `error`-severity
conflicts. If you edit one, re-run the check; do not relax the rule.

---

## Creative modes

Envizzle provides three explicit creative modes. Every brief specifies one creative mode that defines the freedom budget for artistic novelty and system customization.

### Proven

- Select one showcase configuration as a whole.
- Do not change its ambition, biome, archetype, mechanic, camera, or rendering profile.
- Do not add an independent Signature Moment.
- Treat the configured centrepiece mechanic and its strongest existing visual consequence as the signature shot.
- Permit implementation creativity only inside existing specified systems (composition, timing, shader mechanics, and polish).

### Signature

- **Signature is the default creative mode.**
- Select one showcase configuration as a whole.
- Do not change its ambition, biome, archetype, mechanic, camera, or rendering profile.
- Invent exactly one Signature Moment that reuses existing specified systems.
- Permit an optional user-supplied creative spark (visual memory, material, emotion, or natural phenomenon) to influence the Signature Moment.
- If no spark is supplied, use "surprise me."

### Experimental

Experimental permits controlled customization via two explicit paths:

1. **Base-showcase path:**
   - Begin from one named showcase configuration.
   - Change at most one major axis: Ambition, Biome (including palette, paradigm, material behavior, and terrain values), Archetype, Mechanic, or Camera.
   - A rendering-profile change does not count as the single creative axis, provided it uses a complete supported Batch 3 profile tuple.
   - Project name and hardware-target edits do not count as creative axes.
   - Do not copy isolated token values from unrelated showcase configurations — substitute a complete preset axis.

2. **Fully custom path:**
   - Run the one-question-at-a-time interview.
   - Use only named biome, archetype, mechanic, camera, ambition, and rendering-profile options from the preset reference.
   - Originality comes from their deliberate combination and the Signature Moment, not from inventing unsupported engine or system contracts.

**Experimental Mode Rules:**
- Never select Experimental automatically; require explicit user selection.
- Run `checkCoherence` on the final configuration.
- Manually verify mechanic writes against biome state-buffer channels, camera and character compatibility, and ambition-level sections.
- Record all changes and compatibility decisions in `DECISIONS.md`.
- Note: Batch 5 will strengthen these checks programmatically.

---

## Ambition levels

`TEMPLATE.md` wraps three of its subsections in `<!--SECTION:name-->` markers. The
ambition level decides which survive. **An unselected section is deleted from the brief
entirely — body, opening marker, and closing marker.** A section left in with its tokens
unfilled is a hole, and `check.mjs` fails the brief for it; a marker left behind after
the body is deleted is also a failure. Delete cleanly.

| Level | Sections kept | What the demo contains | Tokens that must be filled |
|---|---|---|---|
| **`slice`** *(default)* | none | Terrain, primary material, character, one centrepiece mechanic, atmosphere. | Everything outside the three marked sections. |
| `showcase` | `vegetation`, `state-buffer`, `audio` | Adds vegetation, the wind field, the terrain state buffer, procedural audio, and atmospheric life. | All of the above plus `GRASS_SYSTEM_SPEC`, `WIND_FIELD_ARCH`, `STATE_BUFFER_*`, `DEFORMATION_*`, `RECOVERY_*`, `AUDIO_ENGINE_SPEC`, `ATMOSPHERIC_LIFE_SPEC`. |
| `everything` | `vegetation`, `state-buffer`, `audio` | Adds weather, water bodies, architecture, and destructibility as extra §2.9+ subsections written from the biome's own values. | All tokens, plus the four appended subsections. |

**`slice` is the default, and the default is correct for most people.** A one-shot build
collapses under a dozen systems: the agent spreads its budget across vegetation, audio,
weather, and water, and every one of them lands at 60% quality. The thing that reads as
AAA in a screenshot is one exceptional material under one exceptional sky with a figure
that moves correctly. `slice` is that, and nothing else. Choose `showcase` when the
biome's identity actually depends on vegetation or a persistent surface state — Ghibli
Valley without grass is not Ghibli Valley. Choose `everything` only when the builder has
real time and is willing to lose some of it.

Section-to-level mapping, precisely:

- `vegetation` — §2.4, consumes `GRASS_SYSTEM_SPEC`. Kept at `showcase` and `everything`.
- `state-buffer` — §2.3, consumes `DEFORMATION_TYPE`, `WIND_FIELD_ARCH`,
  `STATE_BUFFER_COVERAGE`, `STATE_BUFFER_TEXEL_SIZE`, `STATE_BUFFER_CHANNELS`,
  `RECOVERY_MECHANISM`, `DEFORMATION_MARKS`, `RECOVERY_OUTCOME`. Kept at `showcase` and
  `everything`.
- `audio` — §2.8, consumes `AUDIO_ENGINE_SPEC` and `ATMOSPHERIC_LIFE_SPEC`. Kept at
  `showcase` and `everything`.

At `slice`, biomes still publish their state-buffer and audio values below. Leave them
unused; do not delete them from the preset, and do not keep the section "just in case."

---

## Biomes

Each entry gives drop-in text for twenty tokens plus a machine-checkable palette. Values
are written in the register of the brief, so they can be pasted without rewriting.

`TERRAIN_NOISE_LAYERS` states a wavelength in metres **and** an amplitude for every
layer. That specificity is exactly why terrain came back good in the predecessor while
the character did not, so it is non-negotiable: four layers, macro to micro, each with a
scale, an amplitude, and a structural constraint that is not just "fBm".

Palette entries carry `role`, `hex`, and `area`. `area` is screen coverage, not
importance: `large` is sky, terrain, canopy, water — the surfaces that own most of the
frame; `medium` is landmarks, architecture, and the character; `accent` is emissive and
must stay under roughly 15% of screen area whatever the entry count says.

### Alpine Snow

Photoreal. The reference biome — a wind-carved snow field under a granite cirque at low
sun. Snow is the hardest photoreal material to get right and the most rewarding, because
the failure mode (blown-out white) is obvious and the success mode (warm highlight, blue
shadow, visible grain) reads instantly.

| Token | Value |
|---|---|
| `PRIMARY_ENVIRONMENT` | a wind-carved snow field beneath a granite cirque |
| `PRIMARY_MATERIAL_NAME` | Snow |
| `NAIVE_DEFAULT` | white |
| `DEFORMATION_TYPE` | Deformation |
| `DEFORMATION_MARKS` | footprints, trails, and carve grooves |
| `RECOVERY_OUTCOME` | the field returns to undisturbed drift |
| `STATE_BUFFER_COVERAGE` | 80 m |
| `STATE_BUFFER_TEXEL_SIZE` | 2 cm |

**`TERRAIN_PHILOSOPHY_SENTENCE`** — A flat plane will kill this demo. The snow field
needs real form: drift mass you can read at a kilometre, wind shear you can read at ten
metres, and grain you can read at arm's length.

**`TERRAIN_NOISE_LAYERS`**

- **Drift forms** — 180 m wavelength, amplitude 22 m, 3 fBm octaves at lacunarity 2.03,
  gain 0.5. Sets the horizon line and where the outcrops sit.
- **Wind lobes** — 24 m wavelength, amplitude 2.6 m, sheared 3:1 along a prevailing wind
  azimuth of 118°. This layer is what stops the field reading as generic fBm.
- **Sastrugi ridges** — 2.2 m wavelength, amplitude 0.28 m, ridged (`1 - |n|`) and
  squared, stretched 5:1 downwind, with the lee face steepened to a 32° slip angle.
- **Grain ripple** — 0.35 m wavelength, amplitude 0.02 m, applied to the normal only
  beyond 12 m so it never costs vertices it does not earn.

Encode the wind azimuth as one uniform that the medium and fine layers, the spindrift,
and the cloth solver all read. One wind, everywhere.

**`TERRAIN_LANDMARKS`** — 4–7 exposed granite outcrops per km², 6–14 m tall, with snow
accumulating on faces below 38° slope and bare rock above it, blended over a 0.4 m
band. Two ice shelves per km², 3–5 m of vertical break, so mid-distance has silhouette
and a scale reference. Keep them sparse: they exist to break monotony, not to fill it.

**`FAR_FIELD_TREATMENT`** — mountains at 8–40 km with heavy aerial perspective,
raymarched as a heightfield in the sky shader with analytic normals, ridge-on-ridge
occlusion, and a 24-step sun-direction march for cast shadows. Near and far run the same
material and atmosphere functions so they meet at one palette rather than reading as
composited layers.

**`MATERIAL_BEHAVIOURS`**

1. **Multi-scale procedural normals** — three tiling scales at 8 m, 0.8 m, and 0.08 m,
   triplanar-blended on slopes above 35°, weights normalised so total normal strength is
   constant with distance.
2. **Subsurface scattering** — wrapped diffuse with a 0.35 wrap term plus back-scatter,
   tinted to a blue-white (`#c8dcf0`) at 2 cm effective depth. Snow lit from behind
   glows; snow lit from the front does not.
3. **View-dependent glinting** — high-frequency normal perturbation with a stable
   per-texel hash, narrow specular lobe (roughness 0.06), density 40 glints/m², driven
   by a hash that does not crawl under TAA.
4. **Surface state channels** — compression, wetness, and ice read from the shared state
   buffer, driving albedo down 18% and roughness down 0.3 where compacted.
5. **Contact detail** — micro-occlusion in the 4 cm band at every trail edge, with
   chunky granularity so a footprint rim reads as broken crust rather than a smooth dent.

**`STATE_BUFFER_CHANNELS`** — R: depression depth in metres, 0 → 0.45. G: displaced
mass, berm height 0 → 0.25 m. B: wetness 0 → 1. A: compaction/ice 0 → 1.

**`RECOVERY_MECHANISM`** — a wind-driven diffusion and decay pass at 0.006 m/s infill
from the upwind side, running at 15 Hz on the state target

**`WIND_FIELD_ARCH`** — a 256×256 GPU wind render target covering a 440 m world area,
scrolled toroidally with the player. Stores mean speed, gustiness, and a directional
advection vector. Sampled per-frame by spindrift particles, cloth, and every surface
that moves.

**`GRASS_SYSTEM_SPEC`** — sparse frozen tussock in 3 rings: 0–18 m at 240 tufts/m²,
14–70 m at 34 tufts/m², 60–240 m at 4 tufts/m², following the same
`min(1, (d_n/d)^1.5)` density law as a full grass system. Tufts appear only where the
drift depth channel is under 0.15 m, so vegetation follows terrain rather than sitting on
it.

**`AUDIO_ENGINE_SPEC`** — a zero-asset WebAudio synthesiser: wind as pink noise through
a 2-pole lowpass swept 300–1400 Hz by wind speed, footfall as a 40 ms filtered noise
burst pitched by the compaction channel, ice crack as a 90 Hz decaying sine with a
transient click, and a generative drone on a 3-note pedal.

**`ATMOSPHERIC_LIFE_SPEC`** — ground spindrift: 12 000 GPU particles streaming below
0.6 m along the wind azimuth, plus 2–4 ravens circling at 40–90 m on a boids flock with
a 25 m separation radius. No butterflies; this is a cold biome and inhabitants sell that.

**`FOOT_INTERACTION`** — displace snow by 6–9 cm and kick a 0.3 m spray puff of 40–60
GPU particles, fired from the single touchdown call site so it cannot desynchronise.

```json
{
  "paradigm": "photoreal",
  "materialBehaviours": "Multi-scale procedural normals at 8 m / 0.8 m / 0.08 m with triplanar blending above 35 deg slope; wrapped-diffuse subsurface with back-scatter; view-dependent glinting on a stable hash; state-buffer compression, wetness and ice; contact micro-occlusion at trail edges.",
  "palette": [
    { "role": "lit-snow", "hex": "#f0f4f8", "area": "large" },
    { "role": "sky-band", "hex": "#a8c8e4", "area": "large" },
    { "role": "shadow-snow", "hex": "#7d9dc0", "area": "large" },
    { "role": "granite-outcrop", "hex": "#4a4744", "area": "medium" },
    { "role": "crevasse-ice", "hex": "#10222e", "area": "medium" },
    { "role": "sun-glint", "hex": "#ffe6b8", "area": "accent" }
  ]
}
```

Mean large-area luminance 0.592. The blue shadow tone is a *value*, not a tint applied
afterwards — it is 0.32 luminance against the lit snow's 0.90, and that separation is the
whole read.

### Ghibli Valley

Painterly. A late-summer alpine valley with a stone viaduct, terraced meadows, and a
river. This is the biome where the palette table and the cel ramp are load-bearing: a
painterly paradigm without them degrades into flat-shaded low-poly, which the brief calls
a defect.

| Token | Value |
|---|---|
| `PRIMARY_ENVIRONMENT` | a late-summer Ghibli alpine valley with a stone viaduct |
| `PRIMARY_MATERIAL_NAME` | Meadow Grass |
| `NAIVE_DEFAULT` | green |
| `DEFORMATION_TYPE` | Grass Displacement and Trails |
| `DEFORMATION_MARKS` | trampled paths and bent-blade trails |
| `RECOVERY_OUTCOME` | the meadow stands back up |
| `STATE_BUFFER_COVERAGE` | 100 m |
| `STATE_BUFFER_TEXEL_SIZE` | 2.5 cm |

**`TERRAIN_PHILOSOPHY_SENTENCE`** — A rolling hill with a grass texture is a Unity
default. The valley needs terraced form, a river that has actually cut its bed, and a
horizon of ridgelines that recede in tone rather than in fog.

**`TERRAIN_NOISE_LAYERS`**

- **Valley form** — 320 m wavelength, amplitude 46 m, a single domain-warped ridge field
  (warp strength 24 m) so the valley has a direction rather than a bowl shape.
- **Terrace steps** — 46 m wavelength, amplitude 5.5 m, quantised to 1.8 m risers with a
  0.6 m smoothing band, which is what gives the painterly silhouette its stacked reads.
- **River carve** — a 12 m-wide channel subtracted along the flow spline, amplitude
  −3.2 m, with 2.4 m banks flared over 6 m. The river is carved, not painted.
- **Meadow undulation** — 3.5 m wavelength, amplitude 0.35 m, plus a 0.4 m wavelength
  amplitude 0.03 m normal-only layer so the ground under the grass is never flat.

**`TERRAIN_LANDMARKS`** — a stone viaduct of 9 arches, each 14 m span and 22 m tall,
crossing the valley at its narrowest point; 3 cypress clusters of 5–9 trees at 11–16 m;
one shrine platform at 6×6 m on the eastern terrace. The viaduct is the scale reference
for the entire frame — everything else is read against it.

**`FAR_FIELD_TREATMENT`** — a painterly ridge stack in the sky shader: 5 depth layers at
2, 5, 11, 22, and 45 km, each flattened toward the sky colour by an aerial-perspective
mix of 0.18, 0.34, 0.52, 0.70, 0.84. Ridges are drawn from the same palette table as the
near field, so the horizon is a value step, never a different set of colours.

**`MATERIAL_BEHAVIOURS`**

1. **Palette table** — one sRGB palette table, the block below, converted to linear on
   load exactly once. Sky, terrain, grass, stone, water, and the character all index it.
   No shader invents a colour.
2. **Cel ramp** — a 2-step cel ramp with a shadow-boundary wobble: the terminator is
   perturbed by a 0.6 m-scale noise at ±0.04 in NdotL, which is what makes the shadow
   edge read as brushwork instead of as a threshold.
3. **Grass translucency** — back-lit blades transmit at 0.45 with a warm shift toward
   `#c8d878`, computed per-blade from the Bezier tangent rather than per-pixel.
4. **Soft rim light** — a 0.22-strength rim keyed to the sky colour, widening to 0.4 on
   the character so the figure separates from the meadow at mid distance.
5. **Painterly specular** — water and wet stone only, quantised to 3 steps, never a
   smooth GGX highlight.

**`STATE_BUFFER_CHANNELS`** — R: trample, blade bend 0 → 1. G: soil-path exposure
0 → 1, revealing bare earth under repeated passes. B: wind gust magnitude, written by the
wind field. A: water wetness 0 → 1 near the river and after rain.

**`RECOVERY_MECHANISM`** — elastic blade recovery on an exponential with a 9 s time
constant for trample, and a 340 s constant for soil-path exposure

**`WIND_FIELD_ARCH`** — a 256×256 GPU wind render target covering a 440 m world area.
Simulates mean wind speed, gustiness, and directional advection. Sampled per-frame by
grass Bezier vertices, tree foliage, cloth, pollen motes, train smoke, and river ripples.

**`GRASS_SYSTEM_SPEC`** — 4 concentric distance rings with Bezier curved blade geometry
of `(2n+1)` vertices: ring 1 at 0–26 m and 1100 blades/m²; ring 2 at 22–84 m and 197
blades/m²; ring 3 at 76–290 m and 31 blades/m²; ring 4 at 260–1250 m and 3.7 blades/m²
with widened stroke width to simulate brush marks. Enforce the continuous density law
`blades/m²(d) = B_i · min(1, (d_n,i / d)^1.5)` so the rings never pop. Thin instances on
the CPU via a shuffled instance-buffer prefix, so any prefix is a fair sample and distant
blades cost zero vertex work.

**`AUDIO_ENGINE_SPEC`** — a 100% zero-asset WebAudio synthesiser: wind as filtered pink
noise, river as three bandpass resonators at 220/480/1100 Hz modulated by flow distance,
bird chirps as FM frequency sweeps on a Poisson trigger averaging 4 s, train chug as a
band-limited impulse train at 1.7 Hz, and a generative pentatonic chord bed at 62 BPM.

**`ATMOSPHERIC_LIFE_SPEC`** — flocking bird boids in two flocks of 14 at 30–120 m,
butterflies over flower patches at 0.8–2.2 m with a 1.4 Hz wing flutter, dandelion pollen
motes at 900 particles within 40 m illuminated by sun shafts, and a procedural steam
train crossing the viaduct every 75 s.

**`FOOT_INTERACTION`** — flatten blades in a 0.28 m radius and write the trample channel,
releasing 3–6 pollen motes per step.

```json
{
  "paradigm": "painterly",
  "materialBehaviours": "One sRGB palette table converted to linear on load and indexed by every surface; a 2-step cel ramp with shadow-boundary wobble at +/-0.04 NdotL on a 0.6 m noise; per-blade grass translucency at 0.45; sky-keyed soft rim light; 3-step quantised painterly specular on water and wet stone only.",
  "palette": [
    { "role": "cloud-cream", "hex": "#f6f1e0", "area": "large" },
    { "role": "sky-cerulean", "hex": "#86c5e8", "area": "large" },
    { "role": "meadow-green", "hex": "#93c25c", "area": "large" },
    { "role": "viaduct-stone", "hex": "#c0a988", "area": "medium" },
    { "role": "canopy-shadow", "hex": "#2c4630", "area": "medium" },
    { "role": "lantern-warm", "hex": "#ffb95e", "area": "accent" }
  ]
}
```

Mean large-area luminance 0.614, well above the 0.30 painterly floor. Painterly reads as
beautiful because it is high-key; the moment sky, meadow, and cloud drop into the
midtones the frame turns to mud, and no amount of shader work recovers it.

### Dune Desert

Photoreal. A barchan dune sea at high sun, with heat haze and one weathered mesa. The
interesting problem here is that sand is nearly a single hue, so the entire image rests
on value separation and grain-scale specular.

| Token | Value |
|---|---|
| `PRIMARY_ENVIRONMENT` | a barchan dune sea under a bleaching high sun |
| `PRIMARY_MATERIAL_NAME` | Sand |
| `NAIVE_DEFAULT` | tan |
| `DEFORMATION_TYPE` | Erosion and Displacement |
| `DEFORMATION_MARKS` | tracks, slide scars, and avalanche fans |
| `RECOVERY_OUTCOME` | the dune face is smooth again |
| `STATE_BUFFER_COVERAGE` | 90 m |
| `STATE_BUFFER_TEXEL_SIZE` | 2 cm |

**`TERRAIN_PHILOSOPHY_SENTENCE`** — A flat sand plane will read as a Unity default. The
dunes need mass, a slip face that obeys the angle of repose, and crests sharp enough to
throw a hard shadow edge.

**`TERRAIN_NOISE_LAYERS`**

- **Barchan crescents** — 95 m wavelength, amplitude 28 m, advected 0.6 wavelengths
  downwind so each dune's horns trail behind its crest.
- **Star-dune arms** — 16 m wavelength, amplitude 4.2 m, ridged and rotated 40° from the
  prevailing wind so the field is not a corrugation.
- **Slip-face clamp** — not a noise layer but a post-pass: clamp the lee slope to a 34°
  angle of repose over a 2 m relaxation window, amplitude change up to 1.8 m. Without
  this the dunes read as hills that happen to be beige.
- **Wind ripples** — 0.22 m wavelength, amplitude 0.012 m, aligned perpendicular to local
  wind, applied to the normal beyond 8 m and to geometry inside it.

**`TERRAIN_LANDMARKS`** — one weathered mesa 180 m across and 60 m tall at 400–900 m,
with sand ramping onto its windward face over a 40 m apron; 5–9 wind-scoured rock fins
1.5–4 m tall in the near field; one half-buried structure of 3 exposed lintels giving the
mid-distance a human scale reference.

**`FAR_FIELD_TREATMENT`** — heat-hazed plateaus and mesa silhouettes at 6–30 km,
raymarched in the sky shader, with a screen-space refraction offset of up to 3.5 px whose
amplitude scales with distance and inverse sun elevation. The horizon must dissolve, not
end.

**`MATERIAL_BEHAVIOURS`**

1. **Multi-scale procedural normals** — three tiling scales at 12 m, 0.9 m, and 0.03 m,
   triplanar above 30° slope, so dune curve, ripple, and grain all read at once.
2. **Sand subsurface** — a 0.5 wrap term with a warm amber transmission (`#e0a860`) at
   the 8 mm scale, so back-lit crests glow along a one-pixel-wide rim at high sun.
3. **Grain glinting** — narrow-lobe specular at roughness 0.09, 120 glints/m², on a
   stable hash so the sparkle does not crawl. Fade glint density to zero beyond 45 m or
   the whole dune field shimmers.
4. **Wet/dry state** — reading the moisture channel darkens albedo by 34% and drops
   roughness by 0.25, which is what makes an oasis edge or a spilled effect read.
5. **Contact detail** — a 3 cm slumping band at every track edge with visible avalanche
   granularity, because the difference between sand and snow is that sand *runs*.

**`STATE_BUFFER_CHANNELS`** — R: depression depth 0 → 0.30 m. G: displaced mass, ridge
height 0 → 0.18 m. B: moisture 0 → 1. A: wind-erosion age in seconds, normalised over
120 s.

**`RECOVERY_MECHANISM`** — wind-driven infill from the prevailing direction at
0.011 m/s, biased so the upwind edge of a track fills first and the downwind lip persists

**`WIND_FIELD_ARCH`** — a 256×256 GPU wind render target covering a 440 m world area,
with a gust model that spawns 2–5 dust devils per minute as local vorticity maxima.
Sampled by ripple advection, saltation particles, cloth, and haze density.

**`GRASS_SYSTEM_SPEC`** — sparse desert scrub in 3 rings: 0–20 m at 18 clumps/m², 16–90 m
at 2.4 clumps/m², 80–320 m at 0.3 clumps/m², using the same `min(1, (d_n/d)^1.5)` law.
Clumps only where the slope is under 12° and the erosion-age channel exceeds 0.5, so
scrub grows in interdune flats and never on a live slip face.

**`AUDIO_ENGINE_SPEC`** — a zero-asset WebAudio synthesiser: wind as pink noise through a
resonant bandpass swept 200–3000 Hz, saltation hiss as high-shelved white noise gated by
wind speed, footfall as a 60 ms noise burst with a 180 Hz body resonance, and a sparse
sine drone at 55 Hz under the dune ridges.

**`ATMOSPHERIC_LIFE_SPEC`** — low sand haze at 6000 particles below 1.2 m, 2–5 dust
devils per minute rising to 18 m, and a single distant raptor circling at 120–200 m. No
insect life in frame; emptiness is the point of a dune sea.

**`FOOT_INTERACTION`** — sink 4–7 cm, collapse a slump ring at the print edge, and kick a
puff of 25–40 dust particles that drift downwind rather than falling straight.

```json
{
  "paradigm": "photoreal",
  "materialBehaviours": "Multi-scale procedural normals at 12 m / 0.9 m / 0.03 m with triplanar blending above 30 deg slope; wrapped sand subsurface with warm amber transmission; stable-hash grain glinting faded out beyond 45 m; moisture-driven albedo and roughness; 3 cm slumping contact band at track edges.",
  "palette": [
    { "role": "lit-sand", "hex": "#e2cfa4", "area": "large" },
    { "role": "sky-haze", "hex": "#cdd9e2", "area": "large" },
    { "role": "lee-slope", "hex": "#9a7a52", "area": "large" },
    { "role": "mesa-rock", "hex": "#6b4f38", "area": "medium" },
    { "role": "shade-hollow", "hex": "#1a1310", "area": "medium" },
    { "role": "oasis-teal", "hex": "#46c8b8", "area": "accent" }
  ]
}
```

Mean large-area luminance 0.510. The lee slope at 0.214 against lit sand at 0.635 is the
entire dune read; if those two converge the field goes flat and no amount of ripple
detail brings it back.

### Ocean Shelf

Photoreal. A shallow tidal shelf over a reef, seen from above the waterline, with a
storm front on the horizon. Water is the biome where the depth-absorption curve does more
work than any surface shader.

| Token | Value |
|---|---|
| `PRIMARY_ENVIRONMENT` | a shallow tidal shelf over a living reef |
| `PRIMARY_MATERIAL_NAME` | Ocean |
| `NAIVE_DEFAULT` | blue |
| `DEFORMATION_TYPE` | Wave State and Foam |
| `DEFORMATION_MARKS` | wakes, foam trails, and sand scours |
| `RECOVERY_OUTCOME` | the surface closes over and the foam dissolves |
| `STATE_BUFFER_COVERAGE` | 70 m |
| `STATE_BUFFER_TEXEL_SIZE` | 1.5 cm |

**`TERRAIN_PHILOSOPHY_SENTENCE`** — A flat water plane is a tech demo from 2005. The
shelf needs weight, a swell that carries momentum through a turn, and a bed close enough
below the surface that you can read depth as colour.

**`TERRAIN_NOISE_LAYERS`**

- **Ocean swell** — 140 m wavelength, amplitude 2.4 m, Gerstner displacement with a
  steepness of 0.55, propagating on a fixed fetch azimuth. This is a spectrum, not fBm.
- **Wind chop** — 6 m wavelength, amplitude 0.28 m, four Gerstner components spread ±35°
  around the swell direction.
- **Capillary ripple** — 0.14 m wavelength, amplitude 0.008 m, normal-only, advected
  along the local surface gradient so it rides the chop instead of sliding under it.
- **Reef bed** — the seabed under the water: 40 m wavelength, amplitude 6.5 m, ridged and
  clamped to a 0.4 m minimum clearance under the mean waterline in the wading zone, plus
  a 1.6 m wavelength amplitude 0.5 m coral layer.

**`TERRAIN_LANDMARKS`** — 3–6 emergent rock stacks 4–12 m tall with visible tide lines at
1.8 m; one wrecked hull section 22 m long half-submerged at 200–400 m; a reef break line
where the swell steepens and throws spray, running 300 m across the frame.

**`FAR_FIELD_TREATMENT`** — a storm front on the horizon with volumetric cloud banks
raymarched in the sky shader at 16 steps, base at 900 m and top at 4200 m, plus a rain
curtain at 12–20 km rendered as an anisotropic scattering wedge. The horizon line itself
must stay a hard value edge — a soft horizon reads as fog, not distance.

**`MATERIAL_BEHAVIOURS`**

1. **Multi-scale procedural normals** — three scales at 24 m, 1.1 m, and 0.05 m, weights
   rebalanced with view angle so grazing views get more high frequency, not less.
2. **Depth absorption** — Beer-Lambert tint over path length with per-channel extinction
   coefficients of 0.35/0.09/0.04 per metre, which is what turns 0.4 m of water green and
   8 m of it deep teal without a single painted gradient.
3. **Caustics** — projected from the surface normal onto the bed at 1.6 m cell scale,
   intensity scaled by inverse depth, contributing to the shared lighting include so the
   character standing in shallows is lit by them too.
4. **Foam state** — foam written into the state buffer at wave-steepness maxima and at
   every wake, with a 12 s decay and a break-up threshold so the trailing edge shreds
   instead of fading uniformly.
5. **Subsurface scatter in the crest** — thin water at a breaking crest transmits at 0.6
   with a green shift, so a wave lit from behind glows along its lip.

**`STATE_BUFFER_CHANNELS`** — R: surface displacement offset ±0.6 m from the wake. G:
foam coverage 0 → 1. B: bed scour depth 0 → 0.22 m. A: turbidity 0 → 1 from disturbed
sand.

**`RECOVERY_MECHANISM`** — wave-action relaxation on a 4 s constant for displacement,
foam decay at 0.08/s, and turbidity settling at 0.03/s

**`WIND_FIELD_ARCH`** — a 256×256 GPU wind render target covering a 440 m world area,
coupled to the swell so gust fronts visibly roughen the chop 1.5 s before they reach the
character. Sampled by spray, cloth, and the rain curtain.

**`GRASS_SYSTEM_SPEC`** — submerged seagrass in 3 rings: 0–14 m at 380 blades/m², 12–55 m
at 46 blades/m², 48–180 m at 6 blades/m², on the same `min(1, (d_n/d)^1.5)` law. Blades
are driven by the orbital velocity of the swell rather than by wind, so they sway with the
wave phase overhead — that coupling is the detail that sells the water as water.

**`AUDIO_ENGINE_SPEC`** — a zero-asset WebAudio synthesiser: surf as bandpassed pink
noise amplitude-modulated by the swell phase, breaking waves as a noise burst with a 1.2 s
exponential decay triggered at steepness maxima, gulls as FM sweeps, and a low 38 Hz
rumble tied to the storm distance.

**`ATMOSPHERIC_LIFE_SPEC`** — spray mist at 5000 particles along the break line, 6–10
gulls on a boids flock at 8–40 m, and a school of 200 fish under the surface within 25 m
that scatters when the character wades within 3 m.

**`FOOT_INTERACTION`** — splash a 0.4 m radius crown, write foam and turbidity, and leave
a print in the bed that the scour channel erases over roughly 40 s.

```json
{
  "paradigm": "photoreal",
  "materialBehaviours": "Multi-scale procedural normals at 24 m / 1.1 m / 0.05 m rebalanced with view angle; Beer-Lambert depth absorption at 0.35/0.09/0.04 per metre; surface-projected caustics feeding the shared lighting include; state-buffer foam with break-up threshold; crest subsurface transmission at 0.6.",
  "palette": [
    { "role": "foam-crest", "hex": "#e8eff1", "area": "large" },
    { "role": "sky-overcast", "hex": "#b8cbd6", "area": "large" },
    { "role": "shelf-shallow", "hex": "#4e93a4", "area": "large" },
    { "role": "wet-rock", "hex": "#7a7266", "area": "medium" },
    { "role": "kelp-deep", "hex": "#0d2a26", "area": "medium" },
    { "role": "caustic-flash", "hex": "#b8ffe8", "area": "accent" }
  ]
}
```

Mean large-area luminance 0.561. `kelp-deep` at 0.019 is the dark tier and it must stay
small: promote it to a large area and the frame loses the airiness that makes shallow
water read as shallow.

### Volcanic

Photoreal, and deliberately low-key. This is one of the two presets that teach a
disciplined dark scene. A dark biome is not a licence for a black frame: the palette
below is genuinely dim — mean large-area luminance 0.125 — and it still passes every
coherence rule, because ash-lit steam anchors the light and the ash plain carries value
above the basalt.

The reference config that this project exists to correct paired a painterly paradigm with
`#080810` obsidian and `#2b0052` violet and produced frames that were unusable. What went
wrong was not the darkness. It was that *nothing large carried light*.

| Token | Value |
|---|---|
| `PRIMARY_ENVIRONMENT` | an ash plain over a cooling basalt flow field |
| `PRIMARY_MATERIAL_NAME` | Basalt |
| `NAIVE_DEFAULT` | orange |
| `DEFORMATION_TYPE` | Flow State and Cooling |
| `DEFORMATION_MARKS` | crust fractures and re-melt channels |
| `RECOVERY_OUTCOME` | the crust re-forms and the glow sinks back under it |
| `STATE_BUFFER_COVERAGE` | 60 m |
| `STATE_BUFFER_TEXEL_SIZE` | 1.5 cm |

**`TERRAIN_PHILOSOPHY_SENTENCE`** — Still lava is lava-coloured water. The flow needs
viscosity, memory of where it has already been, and a crust that records every place it
cracked.

**`TERRAIN_NOISE_LAYERS`**

- **Flow lobes** — 120 m wavelength, amplitude 14 m, advected 0.8 wavelengths downslope
  so the field has a direction of travel written into its form.
- **Pressure ridges** — 18 m wavelength, amplitude 3.1 m, ridged and compressed 4:1
  perpendicular to the flow direction, which is how a real flow front buckles.
- **Pahoehoe ropes** — 1.4 m wavelength, amplitude 0.16 m, sheared along the local flow
  velocity so the ropes curve where the flow turned.
- **Clinker rubble** — 0.18 m wavelength, amplitude 0.025 m, high-contrast worley applied
  to the normal beyond 6 m and to geometry inside it.

**`TERRAIN_LANDMARKS`** — 6–10 cooled basalt pillars 3–9 m tall; 2 collapsed lava tubes
of 8–14 m span with visible interior glow; one spatter cone 45 m across and 18 m tall at
300–600 m venting a steam column. The steam column is not decoration — it is the light
source the palette's anchor comes from.

**`FAR_FIELD_TREATMENT`** — an ash-hazed caldera rim at 3–15 km, raymarched in the sky
shader, lit from below by the fissure network so the underside of the ash layer carries a
dull ember glow. Aerial perspective here *brightens* with distance rather than desaturating
toward a blue, which is the inversion that makes a volcanic horizon read.

**`MATERIAL_BEHAVIOURS`**

1. **Multi-scale procedural normals** — three tiling scales at 10 m, 0.7 m, and 0.04 m,
   triplanar above 25° slope. Non-negotiable: a dark surface with one normal scale reads
   as a flat black polygon, which is precisely the failure this biome must avoid.
2. **Temperature gradient emission** — emission mapped from a temperature channel through
   a black-body ramp, 1450 K (`#ffe0a0`) down to 900 K (`#ff5a1e`) down to unlit basalt,
   with emission clipped at 8× exposure so the fissures bloom rather than solarise.
3. **Crust translucency** — thin crust below 2 cm transmits the under-glow at 0.35, so
   fractures brighten from within before they open.
4. **Flow-aligned anisotropy** — specular stretched 3:1 along the ropey flow direction on
   fresh crust, isotropic on weathered ash.
5. **Ash accumulation state** — a dust layer that lightens albedo to `#6b5f57` on
   upward-facing surfaces, and is what keeps 60% of the frame out of the dark tier.

**`STATE_BUFFER_CHANNELS`** — R: crust thickness 0 → 0.25 m. G: flow velocity magnitude
0 → 3 m/s. B: temperature normalised 0 → 1 over 300–1500 K. A: player disturbance /
fracture 0 → 1.

**`RECOVERY_MECHANISM`** — reheating from below at 0.004/s on the temperature channel and
crust re-formation at 0.002 m/s, so a fracture seals from its edges inward

**`WIND_FIELD_ARCH`** — a 256×256 GPU wind render target covering a 440 m world area,
carrying a thermal updraft term above every fissure. Sampled by embers, the steam column,
ash fall, and cloth — cloth lifting over a vent is one of the biome's best shots.

**`GRASS_SYSTEM_SPEC`** — pioneer fern in 2 rings: 0–16 m at 42 clumps/m², 14–70 m at
5 clumps/m², using the same `min(1, (d_n/d)^1.5)` law, restricted to texels where the
temperature channel is below 0.15 and crust thickness exceeds 0.1 m. Life only where the
ground has been cold long enough, which reads as narrative for free.

**`AUDIO_ENGINE_SPEC`** — a zero-asset WebAudio synthesiser: a 45 Hz sub rumble amplitude
-modulated at 0.3 Hz, gas venting as bandpassed white noise at 800–4000 Hz gated by
proximity to fissures, crust cracking as a filtered impulse with a 300 ms tail, and a
sparse detuned drone a tritone apart.

**`ATMOSPHERIC_LIFE_SPEC`** — embers at 3000 GPU particles rising on the thermal field
with a 6 s lifetime, ash fall at 4000 particles drifting down at 0.4 m/s, and heat shimmer
as a screen-space distortion of up to 5 px above vents. No fauna.

**`FOOT_INTERACTION`** — crack the crust in a 0.22 m radius, write fracture and
temperature, and expose a brief bright fissure that seals over roughly 8 s.

```json
{
  "paradigm": "photoreal",
  "materialBehaviours": "Multi-scale procedural normals at 10 m / 0.7 m / 0.04 m with triplanar blending above 25 deg slope; black-body temperature-gradient emission from 1450 K to 900 K clipped at 8x exposure; crust translucency at 0.35 below 2 cm; 3:1 flow-aligned specular anisotropy; ash accumulation lightening upward faces.",
  "palette": [
    { "role": "ash-sky", "hex": "#9a8578", "area": "large" },
    { "role": "ash-plain", "hex": "#6b5f57", "area": "large" },
    { "role": "basalt", "hex": "#14100f", "area": "large" },
    { "role": "steam-lit", "hex": "#e8dcc8", "area": "medium" },
    { "role": "lava-fissure", "hex": "#ff5a1e", "area": "accent" }
  ]
}
```

Mean large-area luminance 0.125 — above the 0.10 floor and no higher than it needs to be.
Read the structure: two of the three large areas (`ash-sky` 0.250, `ash-plain` 0.120) sit
above the basalt, `steam-lit` at 0.725 is the desaturated light anchor at medium area, and
exactly one accent carries the emissive. Darken the ash plain toward the basalt and the
palette fails `large-area-mean-floor`; demote or darken the ash sky and it fails
`large-area-all-dark` as well; demote the steam out of medium area and it fails
`light-anchor`. Note which entry is actually load-bearing: `ash-sky` at 0.250 carries the
margin, and the ash plain sits *below* the mean, so deleting it nudges the mean up rather
than down. That is the whole argument for running `checkCoherence` on an edited palette
instead of reasoning about it.

### Night City

Photoreal, and deliberately low-key — the second disciplined-dark preset. A rain-wet
street at night. What keeps it out of murk is that the brightest large area is the
*ground*: a wet road reflecting the sky is a big, bright, low-saturation surface, and it
carries the whole frame.

| Token | Value |
|---|---|
| `PRIMARY_ENVIRONMENT` | a rain-wet street under sodium lamps and a low sky glow |
| `PRIMARY_MATERIAL_NAME` | Wet Asphalt |
| `NAIVE_DEFAULT` | grey |
| `DEFORMATION_TYPE` | Wetness and Puddle State |
| `DEFORMATION_MARKS` | spray fans, tyre lines, and disturbed puddles |
| `RECOVERY_OUTCOME` | the puddle surface stills and the reflection reassembles |
| `STATE_BUFFER_COVERAGE` | 60 m |
| `STATE_BUFFER_TEXEL_SIZE` | 1 cm |

**`TERRAIN_PHILOSOPHY_SENTENCE`** — Flat wet tarmac with a reflection cube is a shader
test, not a street. The road needs camber, settled ruts that decide where the water
gathers, and a surface whose reflection breaks up exactly where the water is shallow.

**`TERRAIN_NOISE_LAYERS`**

- **Street camber and grade** — 90 m wavelength, amplitude 1.6 m, a directional gradient
  along the street axis with a 2.4% crown so water runs to the gutters by geometry rather
  than by an authored mask.
- **Settlement and ruts** — 7 m wavelength, amplitude 0.09 m, elongated 6:1 along the
  traffic direction. These decide puddle placement, and puddle placement is most of the
  image.
- **Asphalt aggregate** — 0.35 m wavelength, amplitude 0.011 m, worley-based, applied to
  geometry inside 6 m and to the normal beyond it.
- **Micro-roughness break** — 0.04 m wavelength, amplitude 0.002 m, normal-only, and the
  only thing that stops a wet road from mirroring perfectly and looking like glass.

**`TERRAIN_LANDMARKS`** — building facades on both sides at 14–30 m, set back 6–11 m,
with window grids at 2.4 m spacing; one elevated rail deck crossing at 9 m height; 8–14
street lamps at 22 m spacing on 6 m poles; 3 parked vehicles as silhouette mass. Facades
are `medium` area on purpose — they frame the shot, they do not fill it.

**`FAR_FIELD_TREATMENT`** — a city skyline at 1.5–8 km raymarched in the sky shader as a
depth-sorted block field with window emission at 0.06 density, sitting under a low cloud
deck at 300 m that catches the city's uplight. That cloud deck is what gives the sky a
value above black, and it is a requirement, not an atmosphere flourish.

**`MATERIAL_BEHAVIOURS`**

1. **Multi-scale procedural normals** — three tiling scales at 6 m, 0.4 m, and 0.02 m,
   with the finest scale gated by the wetness channel so a dry patch is rough and a wet
   patch is not.
2. **Wetness-driven reflectance** — roughness lerped 0.62 → 0.04 and specular F0 raised
   0.04 → 0.08 with wetness, plus screen-space reflection with a 24-step march and a
   distance-based roughness cone. The reflection is the light source for the lower half of
   the frame.
3. **Ripple state** — rain impacts write expanding rings into the state buffer at 0.6 m/s
   with 0.9 s lifetime; the material reads them as a normal perturbation, so reflections
   break where rain lands rather than where a texture says.
4. **Sodium-lamp falloff** — inverse-square with a 0.6 m radius source disc, colour
   `#ffb45e`, cast through the shared lighting include so the character, the road, and the
   spray all take the same light.
5. **Contact detail** — a 2 cm dark contact band at every kerb and puddle edge, and
   under the character's feet, so nothing floats.

**`STATE_BUFFER_CHANNELS`** — R: water depth 0 → 0.04 m. G: ripple phase and amplitude.
B: disturbance from footsteps and vehicles 0 → 1. A: grime/dry mask 0 → 1 marking
sheltered ground the rain has not reached.

**`RECOVERY_MECHANISM`** — surface-tension relaxation of the ripple channel on a 1.4 s
constant and drainage toward the gutter along the camber gradient at 0.008 m/s

**`WIND_FIELD_ARCH`** — a 256×256 GPU wind render target covering a 440 m world area,
carrying gust fronts that visibly shear the rain column and the steam plumes. Sampled by
rain, steam, litter, and cloth.

**`GRASS_SYSTEM_SPEC`** — weed growth in 2 rings: 0–12 m at 26 clumps/m², 10–45 m at
3 clumps/m², on the same `min(1, (d_n/d)^1.5)` law, restricted to texels within 0.4 m of a
kerb or crack. Sparse, deliberate, and placed by the same rule everywhere.

**`AUDIO_ENGINE_SPEC`** — a zero-asset WebAudio synthesiser: rain as white noise through
a 3 kHz shelf with a per-impact 8 ms transient layer, road spray as a bandpassed sweep
tied to speed, distant traffic as a 90 Hz drone with slow filter motion, a 50 Hz mains hum
under the lamps, and a sparse minor-seventh pad at 48 BPM.

**`ATMOSPHERIC_LIFE_SPEC`** — rain at 20 000 GPU particles inside 40 m with a wind-sheared
fall, steam plumes from 3–5 vents rising to 6 m, moths orbiting two of the lamps at 12–20
per lamp, and one distant train crossing the rail deck every 90 s.

**`FOOT_INTERACTION`** — displace a 0.3 m puddle crown, write ripple and disturbance,
and throw 15–25 spray droplets that catch the nearest lamp.

```json
{
  "paradigm": "photoreal",
  "materialBehaviours": "Multi-scale procedural normals at 6 m / 0.4 m / 0.02 m with the finest scale gated by wetness; wetness-driven roughness 0.62 to 0.04 with 24-step screen-space reflection; rain-impact ripple rings read from the state buffer as normal perturbation; sodium-lamp inverse-square falloff through the shared lighting include; 2 cm contact band at kerbs and feet.",
  "palette": [
    { "role": "wet-road-sheen", "hex": "#c9d4dc", "area": "large" },
    { "role": "sky-glow", "hex": "#3d4658", "area": "large" },
    { "role": "facade", "hex": "#1b1f26", "area": "medium" },
    { "role": "deep-shadow", "hex": "#080a0e", "area": "medium" },
    { "role": "sodium-lamp", "hex": "#ffb45e", "area": "accent" }
  ]
}
```

Mean large-area luminance 0.354. Note what is *not* here: no second neon hue, no violet
haze, no cyan rim on everything. One warm accent against a cool desaturated ground is a
whole night palette. The version of this scene that fails has five saturated hues and no
light anchor, and it fails at the palette stage — before a line of shader code is written,
which is the cheapest place to catch it.

---

## Character archetypes

**Archetypes are parameters on the single rig specified in
`references/character-recipe.md`. They are never alternative bodies.** The recipe's
skeleton, its six lofted geometry chains, its distance-driven gait phase, its single
write site for the planted foot position, and its one-mesh rule are fixed. An archetype
may set figure height, ring-radius scale, an ellipse-ratio override, whether the lower
body is hidden, which chains carry cloth, and ring counts. That is the entire list.

Two things follow, and both matter:

- **No archetype removes the head, the hands, or the feet.** Those are lofted chains like
  everything else, and there is no primitive escape hatch — the recipe forbids primitive
  geometry builders in character code precisely because "I couldn't loft a head so I used
  a sphere" is how the predecessor shipped a figure with no limbs.
- **Every figure is one continuous skinned mesh.** Armour plates, cloth attachment
  points, and hood brims are swellings in the radius profile and shading breaks on that
  one mesh, never separate objects parented to bones.

Cloth is given as `simulated grid → reconstructed grid`. The Verlet solver runs on the
coarse grid; the vertex shader reconstructs the fine one with Catmull-Rom. That
decoupling is why cloth can look expensive and cost little.

Each entry supplies `CHARACTER_DESCRIPTION`, `CLOTH_PANELS`, cloth shading requirements,
and the head covering, which the interview appends to the recipe as the archetype block
inside `CHARACTER_RECIPE`.

### Robed Mage

| Parameter | Value |
|---|---|
| Figure height | 1.78 m (`legLength` 0.834 m) |
| Ring-radius scale | 1.00 |
| Chest ellipse ratio | 1.25 |
| Lower body | visible; hem clears the ground by 0.12 m so the stride reads |
| Ring counts | 14 segments body, 8 hand and foot |

**`CHARACTER_DESCRIPTION`** — A layered robe with a deep cowl, long sleeves, an
over-mantle falling to mid-thigh, and a trailing hem. The silhouette is a widening cone
from shoulder to hem, broken by the mantle's horizontal edge at 1.05 m. Shell-based fur
at the hood rim and cuffs: 28 shells at 1.8 mm spacing with alpha-tested strands.

**`CLOTH_PANELS`** — hem `40×14 reconstructed to 80×36`; sleeves, two panels of
`18×10 reconstructed to 36×24`; over-mantle `30×16 reconstructed to 60×36`. Distance and
bending constraints, 6 solver iterations at 120 Hz fixed step, driven by locomotion
velocity, acceleration, and the wind field.

**Cloth shading** — sheen with an anisotropic weave response along the panel's warp
direction, subsurface transmission at 0.4 on regions under 1 mm thick, and folds carried
in the rest shape rather than in a normal map. Not a plain PBR dielectric.

**Head covering** — deep cowl, face held at 0.15 of ambient beneath it. No facial
features modelled.

### Traveller Coat

| Parameter | Value |
|---|---|
| Figure height | 1.72 m (`legLength` 0.806 m) |
| Ring-radius scale | 0.98 |
| Chest ellipse ratio | 1.30 |
| Lower body | visible |
| Ring counts | 14 segments body, 8 hand and foot |

**`CHARACTER_DESCRIPTION`** — A knee-length travelling coat, open at the front, with a
long scarf whose tail reaches 1.6 m and streams behind at speed. The coat's back vent
splits at 0.62 m from the hem, so the two halves move independently and the silhouette
reads even from directly behind. Hair is 340 procedural strands in 9 clumps, simulated on
the same solver as the scarf.

This is the archetype the predecessor described as "a Ghibli-inspired traveller with a
wind-blown coat and scarf" and received a stack of primitives for. The difference between
that sentence and this section is entirely numeric, and that is the whole lesson.

**`CLOTH_PANELS`** — coat body `36×12 reconstructed to 72×32`; each back-vent half
`20×10 reconstructed to 40×24`; scarf `48×6 reconstructed to 96×18`. 6 solver iterations
at 120 Hz, wind-field driven, with the scarf's free end mass reduced 40% so it whips
rather than swings.

**Cloth shading** — woven sheen with a 3:1 anisotropic highlight along the weave,
two-sided lighting on the coat's open front so the lining reads a different value, and
subsurface transmission at 0.35 on the scarf.

**Head covering** — a soft travelling cap with a 0.09 m brim; the face sits in its shadow.

### Armored Soldier

| Parameter | Value |
|---|---|
| Figure height | 1.83 m (`legLength` 0.858 m) |
| Ring-radius scale | 1.12 |
| Chest ellipse ratio | 1.40 |
| Lower body | visible |
| Ring counts | 16 segments body, 8 hand and foot |

**`CHARACTER_DESCRIPTION`** — Segmented plate over a padded under-layer. **Plates are
radius-profile swellings on the same skinned mesh** — the pauldron is a +0.045 m local
increase in the arm chain's radius across rings 1–3 with a hard shading break at its
edge, the greave is the same on the leg chain across rings 6–8. A tabard falls to
mid-thigh and a half-cape hangs from the left shoulder. The heavier ring-radius scale is
what makes this figure read as armoured; the plates are detail on top of that mass.

**`CLOTH_PANELS`** — tabard `24×16 reconstructed to 48×36`; half-cape
`32×20 reconstructed to 64×40`. 8 solver iterations at 120 Hz because the cape is heavy
and under-iterated heavy cloth visibly stretches; bending constraint stiffness raised to
0.85 so it hangs in broad folds instead of rippling like silk.

**Cloth shading** — heavy twill sheen with minimal transmission (0.08), and a dust/grime
mask driven by the state buffer's ground contact so the hem is dirtier than the shoulder.

**Head covering** — a closed helm with a 0.012 m visor slit; the face is not modelled at
all, and the slit carries a faint interior rim light so the head does not read as solid.

### Desert Nomad

| Parameter | Value |
|---|---|
| Figure height | 1.68 m (`legLength` 0.787 m) |
| Ring-radius scale | 0.96 |
| Chest ellipse ratio | 1.22 |
| Lower body | visible; robe hem clears the ground by 0.08 m |
| Ring counts | 14 segments body, 8 hand and foot |

**`CHARACTER_DESCRIPTION`** — Layered desert wraps: an outer over-robe with wide sleeves,
an inner tunic visible at the collar and cuff, a waist wrap of 5 visible turns, and a head
covering whose tail reaches 1.1 m. The outer layer is deliberately thin so it back-lights;
at high sun the silhouette is a bright translucent edge around a dark core, which is the
shot this archetype exists for.

**`CLOTH_PANELS`** — over-robe `44×18 reconstructed to 88×40`; sleeves, two panels of
`22×12 reconstructed to 44×28`; head tail `20×8 reconstructed to 40×20`. 6 solver
iterations at 120 Hz; air drag raised to 0.12 so the fabric billows rather than clinging.

**Cloth shading** — thin-film two-sided transmission at 0.62 with a warm shift, a woven
sheen, and self-shadowing between layers so the inner tunic reads darker than the outer
robe rather than the same value.

**Head covering** — a wrapped headcloth with a trailing tail; the face is shadowed
beneath it and additionally veiled below the eye line.

### Void Wanderer

| Parameter | Value |
|---|---|
| Figure height | 1.86 m (`legLength` 0.872 m) |
| Ring-radius scale | 1.02 |
| Chest ellipse ratio | 1.28 |
| Lower body | **hidden lower body** — leg rings hidden from the mid-thigh ring downward |
| Ring counts | 16 segments body, 8 hand and foot |

This is the corrected version of the reference output's character. That build produced a
figure with no legs because legs were hard. Here the absent lower body is a **deliberate
silhouette**: a ground-reaching mantle that never lifts, so there is nothing to hide and
nothing to explain.

The recipe permits this only under one condition, and the condition is the entire point:
**the leg bones still exist, the IK still solves, the foot plant still writes its world
position once on touchdown, and the footfall effects still fire from that call site.**
Only the leg *rings* are hidden. The mantle's motion is driven by those live bones, which
is why it reads as a figure walking under cloth rather than as a cone gliding across the
ground — and gliding is exactly what happens if the bones are removed along with the mesh.

**`CHARACTER_DESCRIPTION`** — A high-collared mantle falling to 0.02 m above the terrain,
its hem height tracked per-vertex against the terrain heightfield so it never intersects
or floats. Two shoulder streamers 2.2 m long. Hands emerge at the cuffs and are fully
modelled — they carry most of the figure's legibility once the legs are gone, so they get
their full lofted chain.

**`CLOTH_PANELS`** — mantle `52×24 reconstructed to 104×48`; each shoulder streamer
`28×6 reconstructed to 56×16`. 8 solver iterations at 120 Hz; the lowest mantle row is
constrained against terrain height with a 0.02 m offset, so the hem drags convincingly
across slopes.

**Cloth shading** — deep-value fabric with a strong sky-keyed rim at 0.45 so the
silhouette separates against every background, sheen along the vertical drape direction,
and near-zero transmission — this figure is a shape, and the shape has to hold.

**Head covering** — a high collar rising past the jaw plus a shallow hood; the face is
entirely in shadow.

---

## Centrepiece mechanics

The centrepiece receives the most polish of anything in the demo. Each entry names the
state-buffer channels it writes, because an effect that does not write to the buffer sits
*on* the world instead of *in* it, and that difference is visible immediately.

Abilities share one grammar: continuous, momentum-carrying, unbroken flow. No instant
spawns, no instant despawns. Everything eases out of the surface and settles back into it.

### Surf / Carve

| Token | Value |
|---|---|
| `CENTREPIECE_MECHANIC` | Surf-Carve |
| `CENTREPIECE_INPUT` | hold RMB |

**`CENTREPIECE_DESCRIPTION`** — Holding RMB raises a crest of compressed surface material
under the character's feet and accelerates them from walk speed to 18 m/s over 1.4 s.
Mouse movement steers carving turns up to a 34° body lean with a banked camera at 0.6 of
the lean angle.

The wake is the centrepiece: a curling, breaking mass of displaced material trailing
behind and to the outside of the turn, throwing a spray plume of 2500 GPU particles that
catches the sun and casts a shadow. Build the wake as a static lattice mesh whose vertices
carry only grid indices, with the spine encoded in a small data texture and all positions
computed in the vertex shader — a 19 m wake and a 2 m wake must cost the same upload.

**Writes:** R (depression) at −0.35 m along a 0.9 m board line; G (displaced mass) +0.22 m
in two berms 0.9 m either side of centre; B (wetness/compaction) driven to 1.0 in the
groove. A completed run stays visible from across the field.

Entry and exit ease over 0.5 s and never snap. Cloth whips backward, FOV widens by 13°,
and screen-space speed streaks fade in above 12 m/s.

- `ABILITY_1_NAME` — **Sweep**: a crescent wave that ploughs a channel with raised berms.
- `ABILITY_2_NAME` — **Ribbon**: a held continuous stream scoring curved lines in the surface.
- `ABILITY_3_NAME` — **Bloom**: an eruption column leaving a crater with a raised rim and a fallout curtain.

### Flight / Glide

| Token | Value |
|---|---|
| `CENTREPIECE_MECHANIC` | Flight-Glide |
| `CENTREPIECE_INPUT` | hold F |

**`CENTREPIECE_DESCRIPTION`** — Holding F transitions the character into a glide over
0.8 s: the body pitches forward to 62°, cloth pulls taut, and the camera pulls back from
4.2 m to 7.5 m while narrowing FOV by 6° to sell speed without distortion. Airspeed runs
14–38 m/s, trading altitude for speed on a lift-drag model with an L/D of 6.5.

The demo's best frames come from altitude, so the flight path must pass deliberately close
to terrain: a 6 m ground-effect band where the downwash visibly disturbs the surface is
worth more than any amount of sky.

**Writes:** B (wind gust / displacement) in a 6 m radius downwash disc under the character
whenever altitude is below 12 m, magnitude `1 / (1 + h/4)`; R (depression) only on
landing, at −0.12 m with a 1.2 m skid line.

- `ABILITY_1_NAME` — **Updraft**: a thermal column the glider can circle to gain 40 m.
- `ABILITY_2_NAME` — **Wingover**: a momentum-preserving reversal that trails a vortex ribbon.
- `ABILITY_3_NAME` — **Cloud Break**: a dive through the cloud deck that leaves a punched hole for 8 s.

### Beam Cannon

| Token | Value |
|---|---|
| `CENTREPIECE_MECHANIC` | Beam Cannon |
| `CENTREPIECE_INPUT` | hold LMB |

**`CENTREPIECE_DESCRIPTION`** — Holding LMB spins up a shoulder-braced beam over 0.7 s
with a visible charge bloom, then fires a continuous 0.6 m-wide beam that sweeps wherever
the camera aims. The beam is a swept tube mesh along a spine with a parallel-transported
frame, not a billboard; its core is at 4× exposure with a chromatic outer sheath, and it
refracts the background within 0.4 m of its axis.

Recoil pushes the character back at 1.8 m/s while firing, so the figure braces and the
cloth streams forward — the character reacting to its own weapon is what makes the beam
feel heavy.

**Writes:** R (depression) −0.18 m along the swept ground intersection at 0.6 m width;
A (heat / scorch / disturbance) driven to 1.0 with a 0.02/s decay, so the sweep path stays
legible for roughly 50 s.

- `ABILITY_1_NAME` — **Lance**: a single focused pulse that punches a 1.4 m crater.
- `ABILITY_2_NAME` — **Scatter**: a five-way fan that rakes a wide arc of the surface.
- `ABILITY_3_NAME` — **Overcharge**: a held vent that discharges into the ground in a spreading ring.

### Grapple Swing

| Token | Value |
|---|---|
| `CENTREPIECE_MECHANIC` | Grapple Swing |
| `CENTREPIECE_INPUT` | hold E |

**`CENTREPIECE_DESCRIPTION`** — Holding E fires an anchor at the nearest valid surface
within 45 m and swings the character on a rope simulated as a 24-segment Verlet chain with
2.5 cm visual radius. Swing speed peaks at 26 m/s at the bottom of the arc. Release
launches on the tangent, preserving momentum exactly — a grapple that scrubs velocity on
release feels broken to anyone who has played anything.

The rope must sag under its own weight when slack and go visibly taut under load, with the
character's arm IK reaching for the rope's first segment rather than for a fixed point.

**Writes:** G (displaced mass) +0.1 m in a 0.5 m radius at the anchor impact point;
R (depression) −0.14 m at each landing with a radius scaled by impact speed;
B (disturbance) 1.0 in a 2 m radius on any hard landing above 14 m/s.

- `ABILITY_1_NAME` — **Anchor Shot**: a fired anchor whose line drapes realistically before it pulls tight.
- `ABILITY_2_NAME` — **Pendulum Boost**: a timed pump at the arc's base that adds 30% speed.
- `ABILITY_3_NAME` — **Reel Slam**: a fast reel-in ending in a ground impact with a radial displacement ring.

### Summon Vehicle

| Token | Value |
|---|---|
| `CENTREPIECE_MECHANIC` | Vehicle Summon |
| `CENTREPIECE_INPUT` | press T |

**`CENTREPIECE_DESCRIPTION`** — Pressing T summons a procedural vehicle that arrives along
a spline from off-frame over 3.5 s, decelerating onto the character's position. The vehicle
is built from the same lofted-chain approach as the character — a hull profile swept along
a spine — never from primitive parts. Mounting is a 1.2 s eased transition with the
character's IK reaching for actual grab points on the hull.

Ridden, it runs 8–30 m/s with suspension travel of 0.35 m sampling terrain height at four
contact points, so the body pitches and rolls with the ground. The vehicle emits its own
light and its own particle systems, both of which write into the shared buffers, so it is
embedded in the world exactly as the character is.

**Writes:** R (depression) −0.18 m as twin tracks at 1.4 m gauge and 0.3 m width;
A (compaction / disturbance) 1.0 along the track; G (displaced mass) +0.08 m at the track
edges, more on the outside of a turn.

- `ABILITY_1_NAME` — **Arrival**: the summoning approach, with a dust or spray wall thrown on the deceleration.
- `ABILITY_2_NAME` — **Ride-Along**: sustained travel with suspension, lean, and a persistent track.
- `ABILITY_3_NAME` — **Departure**: dismount and the vehicle leaves along its spline, its track lingering.

---

## Camera modes

The camera decides what the character has to be good at. That is not a framing note — it
is a budget instruction, and it changes which parts of the rig deserve the work.

### Third Person

Over-shoulder action-MMO framing, lateral offset +0.45 m, spring arm from 4.2 m to 9.5 m
on a smooth eased zoom, pitch clamped −38° to +22°. FOV 55° at rest, widening to 68° at
full speed and tightening over 0.4 s on stopping. Velocity lag of 0.12 s under
acceleration.

**The character must look good from behind at mid distance**, occupying 12–18% of frame
height. Silhouette, limb motion, cloth, and rim light carry everything; the face is never
legible and should not be built. This is the default and the framing the character recipe
is tuned for.

### First Person

Eye position at the head bone, +0.06 m forward and +0.04 m up, with head bob inherited
from the pelvis bob at 0.35 strength so it reads without inducing nausea. FOV 78°,
narrowing to 72° when aiming a mechanic. No camera shake above 0.4° amplitude.

**The character must look good at contact range in the lower frame** — hands, forearms,
cuffs, and the hem seen when looking down. Raise the hand chain to 12 ring segments and
reconstruct cloth panels one step finer than the archetype default. Hide only the head and
neck rings, never the whole figure: a first-person view with no body in it costs the demo
its physicality, and the shadow of a bodiless camera is an obvious tell.

### Cinematic

A dolly on an authored spline with look-at damping at 0.25 s, FOV 35–42° for compression,
and a shallow depth of field equivalent to f/2.8 with the focus tracking the character at
a 0.3 s lag. Shot lengths of 6–11 s with hard cuts, never dissolves.

**The character must look good in silhouette against sky and in three-quarter profile at
6–14 m.** This is the only mode where the character is seen from the front, so the head
covering's shadow line and the chest ellipse ratio matter more here than anywhere else.
Composition is the deliverable: put the horizon on a third, and let the figure break it.

### XR

Stereo rendering at 90 Hz per eye, IPD 63 mm default, near plane 0.08 m. No screen-space
depth of field, no motion blur, and TAA resolved per-eye or not at all — a stereo mismatch
in either is immediately sickening. Comfort vignette at speeds above 6 m/s. Locomotion is
smooth with an optional snap-turn at 30°.

**The character is seen at arm's length — 0.4 to 0.8 m — so proportions matter, not just
silhouette.** This is the mode that punishes everything the other modes forgive. Ring
counts rise to 20–24 segments on the body and 10–12 on hands and feet. Segment lengths
must derive from the rest pose rather than from constants, because at this distance a
femur that is shorter than its tibia is not a subtle error — the viewer sees an animal.
The ellipse ratios are load-bearing here too: a barrel chest that passes at 8 m is
grotesque at 0.5 m. Budget the character at roughly double the third-person cost and take
it out of the far field, which stereo compresses anyway.

---

## Rendering profiles

Envizzle v0.1 supports exactly two rendering profiles. Every brief selects one profile for engine, shader language, and material construction. Automatic backend fallback (such as falling back from WebGPU to WebGL) is forbidden — the selected profile's backend is mandatory.

### Default profile: Babylon WebGPU

- **`ENGINE`**: `Babylon.js latest stable, WebGPU only`
- **`SHADER_LANG`**: `WGSL`
- **`SHADER_LANG_EXT`**: `wgsl`
- **`MATERIAL_API`**: `Babylon.js ShaderMaterial configured with ShaderLanguage.WGSL`

WebGPU is mandatory. If WebGPU is unavailable, report an unsupported-browser/device diagnostic. Do not fall back automatically.

### Alternative profile: Three WebGL2

- **`ENGINE`**: `Three.js latest stable, WebGLRenderer (WebGL2 only)`
- **`SHADER_LANG`**: `GLSL ES 3.00 raw modules`
- **`SHADER_LANG_EXT`**: `glsl`
- **`MATERIAL_API`**: `Three.js RawShaderMaterial on WebGLRenderer`

WebGL2 is the selected primary backend, not a fallback.

> [!NOTE]
> Envizzle v0.1 does not support Three.js `WebGPURenderer` with raw WGSL, `ShaderMaterial`, or `RawShaderMaterial`. A future Three WebGPU profile would require a deliberate TSL/NodeMaterial contract.

---

## Showcase configs

**Pick a showcase config as a whole. Never mix pieces across configs.**

These six combinations are checked: the palette passes the coherence rules, the paradigm
matches the material behaviours, the mechanic writes channels the biome actually declares,
and the camera matches what the archetype is built to withstand. Recombination is exactly
how that breaks — the reference config that this project exists to correct was assembled by
taking a painterly paradigm from one place and a near-black palette from another, and the
result was a set of muddy, unusable frames. Neither half was wrong alone. Together they
were unbuildable, and nobody noticed until the frames came back.

If you do want to recombine, that is allowed — but re-run `checkCoherence` on the result
first, and re-check that the mechanic's channel writes exist in the biome's
`STATE_BUFFER_CHANNELS`. Do the check before the build, not after.

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
| `RENDERING_PARADIGM` | AAA Photoreal |
| `ENGINE` | Babylon.js latest stable, WebGPU only |
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
| Mechanic | Surf / Carve (sandboard) |
| Camera | Third Person |
| Ambition | `slice` |
| `RENDERING_PARADIGM` | AAA Photoreal |
| `ENGINE` | Babylon.js latest stable, WebGPU only |
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
| `RENDERING_PARADIGM` | AAA Photoreal |
| `ENGINE` | Babylon.js latest stable, WebGPU only |
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
| `RENDERING_PARADIGM` | AAA Photoreal |
| `ENGINE` | Babylon.js latest stable, WebGPU only |
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
