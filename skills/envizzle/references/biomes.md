# Biomes

This reference defines the six canonical Envizzle biomes, their numeric terrain layers, material behaviours, surface state channels, and machine-checkable palettes.

## Contents

- [Alpine Snow](#alpine-snow)
- [Ghibli Valley](#ghibli-valley)
- [Dune Desert](#dune-desert)
- [Ocean Shelf](#ocean-shelf)
- [Volcanic](#volcanic)
- [Night City](#night-city)

---

Each entry gives drop-in text for nineteen template tokens plus `FOOT_INTERACTION`
(which is deliberately not one of the 38 template tokens), along with its machine-checkable
palette. Values
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
