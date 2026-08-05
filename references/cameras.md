# Camera Modes and Rendering Profiles

This reference defines the four camera modes and two supported rendering profiles (Babylon.js WebGPU + WGSL and Three.js WebGL2 + GLSL ES 3.00).

## Contents

- [Camera modes](#camera-modes)
  - [Third Person](#third-person)
  - [First Person](#first-person)
  - [Cinematic](#cinematic)
  - [XR](#xr)
- [Rendering profiles](#rendering-profiles)
  - [Default profile: Babylon WebGPU](#default-profile-babylon-webgpu)
  - [Alternative profile: Three WebGL2](#alternative-profile-three-webgl2)

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

- **`ENGINE`**: `Babylon.js 7.x pinned (private device-access risk, see the Babylon WebGPU patterns reference doc), WebGPU only`
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
