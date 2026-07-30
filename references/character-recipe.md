# Character recipe — procedural humanoid

This section is a specification, not a mood board. Every other system in this brief
(terrain, grass, weather) is specified with numbers, and every one of those systems
gets built correctly. Characters described with adjectives get built as a stack of
primitives with no limbs. So the character is specified the same way the terrain is:
bone positions in metres, ring radii in metres, phase numbers, and named formulas.

Build the figure procedurally in code. Do not load a mesh or an animation clip, and
do not substitute a placeholder "for now" — the placeholder is what ships.

The character is seen from behind at mid distance almost the entire time. Spend the
budget on **silhouette, limb motion, cloth, and shading**; spend almost nothing on the
face. Keep the face shaded beneath the head covering and do not model detailed facial
features that cannot be finished to the same standard as the rest of the figure. That
priority is correct — but it is a reason to skip *eyelids*, never a reason to skip the
skeleton.

---

## Part 1 — Skeleton

Eighteen core bones (a six-bone spine chain, three bones per arm, three bones per leg)
plus the clavicle and toe pairs, for 22 in total. Rest positions below are for a
**1.75 m** figure, in metres, in character-local space: the origin is on the ground
between the feet, `+y` is up, `+z` is the character's forward direction, `+x` is the
character's left. Positive `x` values belong to `.L`, negative to `.R`.

| bone | parent | rest position (x, y, z) metres |
|---|---|---|
| hips | root | (0, 0.95, 0) |
| spine01 | hips | (0, 1.10, 0) |
| spine02 | spine01 | (0, 1.28, 0) |
| chest | spine02 | (0, 1.42, 0) |
| neck | chest | (0, 1.52, 0) |
| head | neck | (0, 1.62, 0) |
| clavicle.L | chest | (+0.06, 1.45, 0) |
| clavicle.R | chest | (-0.06, 1.45, 0) |
| upperArm.L | clavicle.L | (+0.19, 1.44, 0) |
| upperArm.R | clavicle.R | (-0.19, 1.44, 0) |
| forearm.L | upperArm.L | (+0.19, 1.16, 0) |
| forearm.R | upperArm.R | (-0.19, 1.16, 0) |
| hand.L | forearm.L | (+0.19, 0.90, 0) |
| hand.R | forearm.R | (-0.19, 0.90, 0) |
| thigh.L | hips | (+0.09, 0.92, 0) |
| thigh.R | hips | (-0.09, 0.92, 0) |
| shin.L | thigh.L | (+0.09, 0.52, 0) |
| shin.R | thigh.R | (-0.09, 0.52, 0) |
| foot.L | shin.L | (+0.09, 0.10, 0) |
| foot.R | shin.R | (-0.09, 0.10, 0) |
| toe.L | foot.L | (+0.09, 0.02, 0.14) |
| toe.R | foot.R | (-0.09, 0.02, 0.14) |

Positions are given in world-style local space for legibility. When you build the
hierarchy, each bone's local translation is its own position minus its parent's.

**Nominal segment lengths** for the 1.75 m rest pose:

| segment | length (m) |
|---|---|
| upperArm | 0.28 |
| forearm | 0.26 |
| thigh | 0.42 |
| shin | 0.40 |
| foot | 0.16 |

Use this table to sanity-check your rig, but **compute the lengths your IK actually
uses from the rest positions at build time** (`thighLength = distance(thigh, shin)`,
and so on). Two reasons: it keeps the solver consistent with whatever rest pose you
ended up with, and archetypes rescale the figure, at which point any hard-coded length
is silently wrong. For the gait formulas,
`legLength = thighLength + shinLength` — 0.82 m for a 1.75 m figure.

**Scaling.** Nothing above is a magic constant; every position is a proportion of
figure height. For a figure of height `H`, multiply every rest position by `H / 1.75`.
Derive limb lengths from the scaled rest pose, and let stride length, pelvis bob, and
swing arc follow from `legLength` rather than from literals, so a 1.45 m figure walks
correctly without a second set of numbers.

---

## Part 2 — Geometry

**The character is ONE continuous skinned mesh generated from lofted cross-section
rings; it is never an assembly of primitive meshes.**

Walk each bone chain, place rings of vertices at intervals along it, and stitch
consecutive rings into triangle strips. The torso, arms, legs, neck, and head are
regions of a single vertex buffer bound to a single skeleton — not separate objects
parented to bones.

| Chain | Rings | Radius profile (m) | Ellipse ratio (x:z) |
|---|---|---|---|
| Torso (hips→neck) | 12 | 0.16 → 0.19 → 0.17 → 0.14 | 1.00 → 1.35 |
| Arm (shoulder→wrist) | 8 | 0.055 → 0.040 → 0.032 | 1.00 |
| Leg (hip→ankle) | 10 | 0.085 → 0.055 → 0.038 | 1.10 |

Read each radius profile as control points of a curve sampled along the chain, not as
per-ring values: the torso's four numbers are hips, chest, upper chest, and neck, and
its 12 rings interpolate smoothly between them. The leg profile is hip 0.085, knee
0.055, ankle 0.038; the arm profile is shoulder 0.055, elbow 0.040, wrist 0.032.

Ring resolution is **12–16 segments**. Rings stitch into triangle strips; the ends
(crown of the head, wrists, ankles) are capped. Total budget is roughly **3–4 k
triangles** for the body — the silhouette, not surface detail, is what reads at mid
distance.

**Why the ellipse ratio matters.** A ring is not a circle. The ellipse ratio is the
`x` radius divided by the `z` radius, so 1.35 at the chest means the chest is 1.35
times as wide as it is deep. Build the rings as circles and the result is a barrel: a
human chest is a flattened oval, and a torso as deep as it is wide reads as a sack of
grain with a head on top. That single number is much of the difference between a figure
and a tube stack. Interpolate the ratio along the torso from 1.00 at the hips to 1.35
at the chest. Legs stay near 1.10 (thighs are slightly wider than deep) and arms stay
circular at 1.00.

**Skin weights.** Derive them from each vertex's normalized arc-length position along
its chain, blended across a **0.08 m** falloff either side of each joint. This is
deterministic and needs no hand-rigging:

```js
// t: the vertex's normalized arc-length position along its chain, 0..1.
// Each joint sits at a known parameter along that same chain.
// The 0.08 m falloff is converted to normalized units by dividing by chain length.
function weightsFor(t, chain) {
  const i = segmentIndexAt(t, chain);          // the two bones straddling t
  const jointT = chain.jointParam[i];          // parameter of the joint between them
  const half = 0.08 / chain.lengthMetres;      // half-width of the blend band
  const blend = smoothstep(jointT - half, jointT + half, t);
  return [
    { bone: chain.bones[i],     weight: 1 - blend },
    { bone: chain.bones[i + 1], weight: blend },
  ];
}
```

**Why this works without a rigger.** Arc length along a chain is monotonic, so every
vertex has exactly one `t`. At most two bones are ever non-zero, so the weights sum to
1 by construction — no normalization pass, and no vertex left unweighted to collapse to
the origin. The 0.08 m band is wide enough that elbows and knees crease instead of
shearing, and narrow enough that the hip does not drag the knee. Because it is a pure
function of geometry, it rebuilds identically every run: there is no rig asset that can
drift out of sync with the mesh.

Cloth panels, hair, and accessories are layered **on top of** this rig and driven by
its bone transforms. Run the cloth solver on a coarse grid (for example 36×12) and
reconstruct a finer surface (for example 72×32) in the vertex shader, so visual quality
and simulation cost stay decoupled. Pack all per-frame character data — bone matrices
in the first rows, cloth node positions after them — into one small texture or buffer,
uploaded once per frame with no allocation.

---

## Part 3 — Gait

Sliding feet are prevented **by construction, not by discipline**. The phase that
drives the legs advances with ground distance travelled, so stride length equals ground
speed as an identity rather than as a tuning result.

```js
// Phase advances with GROUND DISTANCE, so stride length equals ground speed
// by construction. Do not blend animation clips.
const strideLength = 0.78 * legLength * (1 + 0.35 * speedNorm);
gaitPhase = (gaitPhase + distanceThisFrame / strideLength) % 1;
```

`distanceThisFrame` is the **horizontal distance the character actually moved this
frame** — the XZ length of (position now − position last frame). It is not
`speed * dt`, and the distinction is the whole point: when the character is pressed
against a wall or clamped by a slope limit, intended speed is non-zero while actual
movement is zero. Feed the solver intended speed and the legs stride on the spot. Feed
it actual movement and they stop, correctly, on their own. `speedNorm` is speed
normalized to the run speed, 0..1, and lengthens the stride as the character speeds up.

| quantity | value | meaning |
|---|---|---|
| stance | phase 0.0 → 0.6 | foot is planted; holds its locked world position |
| swing | phase 0.6 → 1.0 | foot travels to the predicted touchdown point |
| swing arc height | 0.12 m | peak lift of the foot mid-swing, eased with smoothstep |
| per-leg phase offset | 0.5 | one leg runs half a cycle behind the other |

Stance occupying 0.6 of the cycle rather than 0.5 is deliberate: the two stance windows
overlap by 0.2 of the cycle, and that double-support phase is what makes the motion
read as a walk. At 0.5 the figure is technically running, and below 0.5 there are
frames with no foot on the ground at all, so the character appears to hop.

The per-leg offset of exactly **0.5** puts the legs in antiphase. Any other value reads
as a limp; 0 puts both feet down together, which is a hop. The same 0.5 is reused in
Part 4 to pair each arm with the opposite leg.

Use **smoothstep** for the swing arc, in both height and horizontal progress, so the
foot decelerates into touchdown. Linear interpolation makes the foot arrive at full
speed and every plant looks like a stamp.

Solve hip → knee → ankle with **two-bone analytic IK by the law of cosines**. Roughly
twenty lines, no solver dependency, no iteration, and none of the jitter an iterative
solver produces near full extension.

```js
// Two-bone analytic IK, hip -> knee -> ankle.
// a = thigh length, b = shin length, both measured from the rest pose.
function solveTwoBone(rootPos, targetPos, poleDir, a, b) {
  const toTarget = targetPos.clone().sub(rootPos);
  // Never allow full extension: a locked knee pops visibly, and at exactly
  // a + b the acos argument drifts past 1 and yields NaN.
  const d = Math.min(toTarget.length(), (a + b) * 0.999);
  // Law of cosines for the interior knee angle. PI means a straight leg.
  const kneeInterior = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  // Law of cosines again, for how far the thigh swings off the root->target line.
  const rootOffset = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const aim = toTarget.normalize();
  // The bend plane is spanned by aim and the pole vector; the knee points along
  // the pole. Pole = the character's forward direction, so knees never invert.
  const bendAxis = aim.clone().cross(poleDir).normalize();
  return {
    kneeBend: Math.PI - kneeInterior,   // 0 when straight, growing as it flexes
    aim,
    rootOffset,
    bendAxis,
  };
}
```

Compose the thigh rotation as "aim at the target, then rotate by `rootOffset` about
`bendAxis`", and apply `kneeBend` to the shin about the same axis. The knee pole vector
points **forward**; without it the solver has a free rotation about the hip-to-ankle
line and knees flip inward between frames. The same routine solves the arm, with the
elbow pole pointing backward.

Do not blend animation clips at any point in this system. There are no clips.

---

## Part 4 — Secondary motion

These are what separate a rig that works from a rig that looks alive. All of them are
functions of `gaitPhase`, so they cost nothing and cannot desynchronise from the feet.

| motion | formula / range |
|---|---|
| pelvis bob | `y -= 0.035 * (1 - cos(4π * gaitPhase)) / 2` |
| pelvis roll | ±3° |
| shoulder counter-rotation | ±5°, opposing the pelvis |
| arm swing (shoulder pitch) | `±22° * sin(2π * (gaitPhase + 0.5))` |
| elbow flex | 12° → 35° across the swing |
| spine lean | chest pitch `clamp(accelAlongForward * 0.04, -8°, +12°)` |
| head | counter-rotated to hold a level gaze |

The bob uses **4π**, not 2π: the pelvis dips once per footfall and there are two
footfalls per gait cycle. Use 2π and the figure dips once per two steps, which reads as
a lurch. The expression `(1 - cos(angle)) / 2` stays within 0..1, so the pelvis only
ever drops — by up to 0.035 m — and never rises above its rest height.

Pelvis roll and shoulder counter-rotation must oppose each other. That counter-twist
through the spine is most of what makes a walk look human; rotate the shoulders with the
hips and the figure walks like a plank.

Arm swing carries the same `+ 0.5` phase offset as the legs, which makes each arm swing
with the **opposite** leg. This is contralateral gait, and it is what humans do.
In-phase arms read as marching, and viewers notice immediately even if they cannot say
why.

Spine lean reads from acceleration along forward, not from velocity: a character at
constant speed stands upright and leans only while starting, stopping, or turning. The
asymmetric clamp (−8° back, +12° forward) is intentional — people lean further into
acceleration than they lean back while braking.

Head counter-rotation holds the gaze level while the chest pitches and the pelvis
rolls, so the most legible part of the silhouette stays stable.

---

## Part 5 — Foot planting

The mechanism, not the goal. A planted foot holds a **stored world position**; it is
never recomputed while planted, because a value that is never recomputed cannot drift.

```js
// On touchdown ONLY. During stance nothing writes to plantedPos — a planted
// foot cannot slide because no code path exists that could move it.
const hit = terrainRaycast(footTarget);
plantedPos[leg].copy(hit.point);
plantedNormal[leg].copy(hit.normal);
stateBuffer.addSplat(plantedPos[leg]);   // same call site, cannot desync
audio.footfall(plantedPos[leg]);
```

Everything belonging to a footfall — the deformation splat into the state buffer, the
footstep sound, any particle burst — is triggered from this one call site, reading the
same `plantedPos`. Effects fired from a separate timer or from an animation event drift
out of sync within seconds. Effects fired here cannot, because there is only one event.

During stance, IK **reaches for** `plantedPos[leg]`. It does not re-raycast, it does
not re-project onto the terrain, and it does not offset for the character's motion.
Re-raycasting each frame is precisely the bug: as the body moves, the ray hits a
slightly different point and the foot creeps. Write once, read many.

Blend foot orientation toward `plantedNormal[leg]` at **0.7** — the sole tilts most of
the way onto a slope but not fully, since a real ankle does not perfectly conform.

At the touchdown frame, `footTarget` is the **predicted** touchdown point: extrapolate
the character's ground position forward by the remaining swing time and raycast there.
Raycasting the foot's current mid-air position plants it behind where the body will be,
and the leg spends the whole of stance dragging.

---

## Part 6 — Prohibitions

- `BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `CapsuleGeometry`, and
  `ConeGeometry` are **forbidden** anywhere in character code. The prohibition extends
  to any equivalent primitive builder in the engine you are using.
- A character assembled from separate per-body-part meshes is a **defect**, not a
  stepping stone.
- Omitting legs is permitted **only** when the chosen archetype specifies a hidden
  lower body **and** cloth reaches the ground. Even then the leg bones still exist and
  still drive the plant, the cloth, and the footfall effects.
- There is **no fallback**. If the rig is hard, the rig is still required. If time runs
  short, ship the character with unfinished *shading* — never with an unfinished
  skeleton.

A figure with no limbs is not a simplification of this specification; it is a failure of
it. If the arms and legs are missing, or if the body is more than one mesh, the
character is wrong no matter how good the cloth looks.

---

## Archetype parameters

Presets adjust this rig; they never replace it. An archetype may set:

| parameter | effect |
|---|---|
| figure height | scales every rest position by `H / 1.75`; limb lengths, stride, bob, and swing arc all follow |
| ring-radius scale | multiplies the radius profiles for a heavier or slighter build; ellipse ratios are unchanged |
| ellipse-ratio override | the chest ratio may move within roughly 1.15–1.45; it is never 1.00 |
| hidden lower body | hides leg *rings* only, under the Part 6 condition; leg bones, IK, planting, and footfall effects stay live |
| cloth panels | which chains carry simulated cloth, and how far it reaches |
| ring counts | may rise for a close-framed archetype, within the triangle budget |

Everything else in this document is fixed. Bone names, hierarchy, the distance-driven
phase, the single write site for `plantedPos`, and the one-mesh rule are not
archetype-dependent.

---

## Framing

The character occupies **12–18% of frame height** at default third-person zoom. Below
12% the limb motion this specification exists to produce is not visible; above 18% the
face and hands start demanding detail the budget was deliberately spent elsewhere.
Verify the figure's height in a captured frame rather than assuming it.

The character uses the scene's shared lighting include — the same function the terrain
and vegetation call — so the figure is lit by the same sky and sun and cannot look
pasted on. Carry a **rim light** so the silhouette reads against bright sky, which is
the background it will be seen against most of the time.
