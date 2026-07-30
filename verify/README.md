# verify/

Automated verification for a generated envizzle tech demo. This replaces
`legacy/verify_demo.mjs`, whose final step logged `PASS: Screenshots
successfully saved` without looking at a single pixel — a near-black frame
with the camera clipped inside a rock spire passed as a success. This
directory adds gates that actually inspect the captured frames before
declaring anything a pass.

## Running it

```bash
node verify/verify_demo.mjs [path-to-generated-demo]
```

Defaults to the current working directory if no path is given. It:

1. Audits the directory for required files (`index.html`, `package.json`,
   `vite.config.js`, `DECISIONS.md`, `PERF.md`, `src/main.js`).
2. Runs `npx vite build` and fails on any build error.
3. Boots a local `vite` dev server and launches headless Chromium via
   Playwright with WebGPU flags enabled.
4. Waits for the `window.__demo` hook (see below). If it never appears,
   verification stops there — nothing past this point is checkable without
   it.
5. Checks for runtime/console errors.
6. Cycles through the `idle`, `locomotion`, and `mechanic` poses. For each,
   captures a screenshot with the character visible and one with it hidden,
   and writes `screenshots/milestone_<pose>.png`.
7. Reads camera depth and frame-time stats from the hook.
8. Runs `evaluateGates` (see `gates.mjs`) over everything captured and
   reports pass/fail.

Exit code is `0` only if every check — including every image gate — passed.

## The `window.__demo` contract

A generated demo must expose this hook on `window` for verification to run
past the "hook missing" stage:

```js
window.__demo = {
  ready: true,                       // becomes true once the scene has loaded and is rendering
  setPose(name),                     // 'idle' | 'locomotion' | 'mechanic' — move the demo to that milestone
  setCharacterVisible(bool),         // toggle the character's visibility, nothing else in the scene
  cameraNearestDepth(),              // metres from the camera to the nearest solid geometry along its view direction
  frameStats(),                      // { medianMs, p99Ms, samples } over a recent rolling window
};
```

Without this hook the orchestrator cannot drive poses, measure camera depth,
or isolate the character for the visibility gate — so it fails fast and
explicitly (`window.__demo hook missing`) instead of quietly skipping checks
and reporting success anyway.

## The gates (`gates.mjs`)

All gates are pure functions over `{ width, height, data }` (RGBA bytes), so
the same code is exercised by unit tests with synthetic buffers and by the
real Playwright run with decoded PNG screenshots.

| Gate | Threshold | Catches |
| --- | --- | --- |
| `meanLuminance` | `[0.12, 0.85]` | Near-black or blown-out frames — the exact class of failure the predecessor missed. |
| `flatFrameRatio` | `<= 0.70` | Blank/flat frames: a frame where 70%+ of pixels land in one luminance bucket is not showing a rendered scene, whatever its average brightness. |
| `changedAreaFraction` (with vs. without character) | `[0.03, 0.20]` of frame area | Character invisible, off-screen, or occluded (below floor); camera so close the environment can't be read (above cap). |
| camera nearest depth | `>= 0.30 m` | Camera clipped inside geometry — the reference failure had the camera inside a rock spire. |

Thresholds live in the frozen `THRESHOLDS` object in `gates.mjs`.

### Why the character-diff gate needs a real character

`changedAreaFraction` compares a frame with the character visible against
the same frame with it hidden. This only works if the demo actually renders
a distinct, hideable character mesh at `setCharacterVisible(false)` —  a
placeholder cube or an empty scene will either show 0% change (fails the
floor) or an unrelated change unrelated to the character. There's no way to
satisfy this gate without a real character being present and toggleable;
that's the point — it can't be gamed by a static test scene.

### Why frame time is informational, not gated

`frameStats()` (median and p99 frame time) is written to `info`, never to
`failures`. Verification runs headless, frequently on software rendering
with no relationship to the target machine's GPU. Gating on a number that
means nothing about real-world performance would fail every honest headless
run — the opposite failure mode from the predecessor script, but just as
useless. Use `PERF.md` and manual testing on target hardware to validate the
90 FPS target; use this tool to validate that the frame is a real, visible,
correctly framed rendering of the scene.
