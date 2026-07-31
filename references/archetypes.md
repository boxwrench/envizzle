# Character Archetypes

This reference defines the five character archetypes as numeric parameter sets on the single rig specified in [character-recipe.md](character-recipe.md).

## Contents

- [Robed Mage](#robed-mage)
- [Traveller Coat](#traveller-coat)
- [Armored Soldier](#armored-soldier)
- [Desert Nomad](#desert-nomad)
- [Void Wanderer](#void-wanderer)

---

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
