# Centrepiece Mechanics

This reference defines the five centrepiece mechanics, input triggers, visual descriptions, state-buffer channel writes, and secondary abilities.

## Contents

- [Surf / Carve](#surf--carve)
- [Flight / Glide](#flight--glide)
- [Beam Cannon](#beam-cannon)
- [Grapple Swing](#grapple-swing)
- [Summon Vehicle](#summon-vehicle)

---

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

**`centrepieceEffect`**

```json
{
  "name": "Sand Carve Wake",
  "visualGoal": "A curling wall of displaced sand that remains readable at gameplay distance.",
  "sharedDriver": "resampled movement path",
  "dominantLayerId": "wake-body",
  "layers": [
    { "id": "persistent-carve", "type": "terrain-state", "purpose": "Leave a trench and raised berms." },
    { "id": "wake-body", "type": "swept-geometry", "purpose": "Provide the dominant curling silhouette." },
    { "id": "crest-curtain", "type": "particles", "purpose": "Create dense sand close to the crest." },
    { "id": "ballistic-grains", "type": "particles", "purpose": "Throw sparse grains away from the turn." },
    { "id": "wind-dust", "type": "atmospheric-particles", "purpose": "Connect the effect to the prevailing wind." },
    { "id": "camera-response", "type": "screen-response", "purpose": "Communicate speed and loaded turns." }
  ],
  "readabilityRequirements": [
    "The effect has a readable silhouette without relying only on particles.",
    "The terrain response persists after the subject passes.",
    "The mechanic frame is unmistakably different from locomotion.",
    "The effect remains localized enough to preserve scene readability."
  ]
}
```

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

**`centrepieceEffect`**

```json
{
  "name": "Downwash Ground-Effect Trail",
  "visualGoal": "A visibly disturbed ribbon of terrain and air beneath a low, fast flight path that reads the glide's speed and altitude at a glance.",
  "sharedDriver": "resampled flight-path altitude-and-position curve",
  "dominantLayerId": "downwash-disc",
  "layers": [
    { "id": "downwash-disc", "type": "terrain-state", "purpose": "Depress and disturb the surface directly beneath low-altitude flight." },
    { "id": "vortex-ribbon", "type": "swept-geometry", "purpose": "Trail a continuous, banking-responsive ribbon behind the wingtips." },
    { "id": "surface-kickup", "type": "particles", "purpose": "Throw dust or spray from the disturbed surface into the downwash." },
    { "id": "cloud-punch", "type": "atmospheric-particles", "purpose": "Punch and re-close a hole in the cloud deck on steep dives." },
    { "id": "camera-response", "type": "screen-response", "purpose": "Pull back and narrow FOV to sell airspeed without distortion." }
  ],
  "readabilityRequirements": [
    "The downwash disturbance is visible on the terrain even without looking at the character.",
    "The vortex ribbon reads the current bank angle, not just forward motion.",
    "The mechanic frame is unmistakably different from locomotion.",
    "The effect stays legible when the flight path passes close to terrain landmarks."
  ]
}
```

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

**`centrepieceEffect`**

```json
{
  "name": "Swept Beam Scorch",
  "visualGoal": "A continuous, physically-present energy beam whose ground intersection visibly scorches the surface along its full sweep.",
  "sharedDriver": "resampled aim-direction sweep path",
  "dominantLayerId": "beam-body",
  "layers": [
    { "id": "scorch-trail", "type": "terrain-state", "purpose": "Depress and darken the ground along the beam's swept intersection, decaying slowly." },
    { "id": "beam-body", "type": "swept-geometry", "purpose": "Provide the dominant charged, refractive beam silhouette." },
    { "id": "impact-sparks", "type": "particles", "purpose": "Throw sparks and debris from the current ground-intersection point." },
    { "id": "heat-shimmer", "type": "atmospheric-particles", "purpose": "Distort air immediately around the beam's core." },
    { "id": "camera-response", "type": "screen-response", "purpose": "Add restrained recoil shake while firing." }
  ],
  "readabilityRequirements": [
    "The beam has a readable silhouette and core brightness without relying only on particles.",
    "The scorch trail persists after the beam stops firing.",
    "The mechanic frame is unmistakably different from locomotion.",
    "The effect remains localized enough to preserve scene readability even during a wide Scatter sweep."
  ]
}
```

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

**`centrepieceEffect`**

```json
{
  "name": "Anchor Impact and Rope Tension",
  "visualGoal": "A rope that visibly sags and tautens under real load, connected to a ground impact that reads the swing's momentum.",
  "sharedDriver": "resampled Verlet rope-chain state",
  "dominantLayerId": "rope-body",
  "layers": [
    { "id": "impact-crater", "type": "terrain-state", "purpose": "Displace and depress the surface at anchor and landing impact points." },
    { "id": "rope-body", "type": "swept-geometry", "purpose": "Provide the dominant sagging/taut rope silhouette between anchor and character." },
    { "id": "anchor-burst", "type": "particles", "purpose": "Throw debris at the moment the anchor strikes a surface." },
    { "id": "landing-ring", "type": "particles", "purpose": "Emit a radial displacement burst on hard landings above the speed threshold." },
    { "id": "camera-response", "type": "screen-response", "purpose": "Add a speed-scaled motion blur or FOV widen at peak swing velocity." }
  ],
  "readabilityRequirements": [
    "The rope reads its current tension state (slack vs. taut) without relying only on particles.",
    "The impact crater persists after the swing passes.",
    "The mechanic frame is unmistakably different from locomotion.",
    "The effect remains localized enough to preserve scene readability across a full swing arc."
  ]
}
```

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

**`centrepieceEffect`**

```json
{
  "name": "Arrival Dust Wall and Track Persistence",
  "visualGoal": "A vehicle that visibly decelerates into frame trailing a dust or spray wall, leaving a persistent track that reads where it has been.",
  "sharedDriver": "resampled vehicle-spline position-and-speed curve",
  "dominantLayerId": "vehicle-body",
  "layers": [
    { "id": "track-marks", "type": "terrain-state", "purpose": "Leave twin persistent tracks with compaction/disturbance along the driven path." },
    { "id": "vehicle-body", "type": "swept-geometry", "purpose": "Provide the dominant lofted-hull vehicle silhouette (never primitive parts)." },
    { "id": "arrival-wall", "type": "particles", "purpose": "Throw a dense dust or spray wall on deceleration during Arrival." },
    { "id": "ride-kickup", "type": "particles", "purpose": "Emit continuous surface kickup from all four contact points while ridden." },
    { "id": "departure-haze", "type": "atmospheric-particles", "purpose": "Trail settling dust behind the vehicle as it departs along its spline." },
    { "id": "camera-response", "type": "screen-response", "purpose": "Add suspension-driven camera sway that reads terrain contact." }
  ],
  "readabilityRequirements": [
    "The vehicle has a readable silhouette without relying only on particles.",
    "The track marks persist after the vehicle passes.",
    "The mechanic frame is unmistakably different from locomotion.",
    "The effect remains localized enough to preserve scene readability during Arrival and Departure."
  ]
}
```
