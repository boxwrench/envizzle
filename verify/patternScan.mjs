/**
 * Static forbidden-pattern scanner.
 *
 * Pure module: no Playwright, no npm dependencies beyond Node builtins
 * (`fs`/`path`). Walks a built project's `src/**\/*.{js,wgsl,glsl}` tree and
 * tests each file's text against a fixed internal map of regex/string
 * checks keyed by the same `id`s used in `FORBIDDEN_PATTERNS_BY_PROFILE`
 * (see build-contract.mjs). This module never reads that registry — the
 * caller (a later task's verify_demo.mjs) passes the already
 * profile-filtered `contract.forbiddenPatterns` array in, and only IDs
 * present in that array are checked.
 *
 * Every ID this module knows about is listed in
 * `PATTERN_SCAN_IMPLEMENTED_IDS`. Some are real static detectors; some are
 * documented no-ops (always return zero hits) because the underlying
 * concept is a runtime/process/visual-review concern that cannot be
 * reliably inferred from source text alone. See `PATTERN_SCAN_NO_OP_IDS`
 * for the no-op subset. This is intentional per Task 5's brief: do not
 * invent an unreliable heuristic where no genuine static signal exists.
 *
 * All heuristic checks here are deliberately conservative, regex/string
 * based, and NOT a general JS/WGSL parser. False negatives are expected;
 * false positives are minimized by scoping checks to the file paths the
 * architecture ownership map assigns to each concern (e.g. `src/core/`,
 * `src/terrain/`, `src/character/`).
 */

import fs from 'node:fs';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.js', '.wgsl', '.glsl']);

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

/**
 * Recursively collect every `src/**\/*.{js,wgsl,glsl}` file under
 * `targetDir`, using plain `fs.readdirSync(..., {withFileTypes:true})`
 * recursion (no glob dependency). Returns [] if `targetDir/src` does not
 * exist.
 */
function collectSourceFiles(targetDir) {
  const srcDir = path.join(targetDir, 'src');
  const files = [];
  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    return files;
  }

  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SOURCE_EXTENSIONS.has(ext)) {
          const relPath = path.relative(targetDir, abs).split(path.sep).join('/');
          const content = fs.readFileSync(abs, 'utf8');
          files.push({ absPath: abs, relPath, content });
        }
      }
    }
  };
  walk(srcDir);
  return files;
}

function getLineNumber(content, index) {
  if (index <= 0) return 1;
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

// ---------------------------------------------------------------------------
// Generic helpers shared by multiple checkers
// ---------------------------------------------------------------------------

/** Run a global regex over every file (optionally filtered), collecting {file, line} hits. */
function scanRegex(files, regex, filterFn) {
  const hits = [];
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  for (const file of files) {
    if (filterFn && !filterFn(file)) continue;
    const re = new RegExp(regex.source, flags);
    let m = re.exec(file.content);
    while (m !== null) {
      hits.push({ file: file.relPath, line: getLineNumber(file.content, m.index) });
      if (re.lastIndex === m.index) re.lastIndex += 1; // guard against zero-width matches
      m = re.exec(file.content);
    }
  }
  return hits;
}

/**
 * Find braced blocks whose opening delimiter matches `declRegex` (the regex
 * MUST consume through and including the opening `{`). Depth-counts braces
 * from there to find the matching close. This is a small bounded
 * brace-matcher for two specific heuristics below (render-loop-allocation,
 * suppressed-initialization-failure) — not a general parser.
 */
function extractBracedBlocks(content, declRegex, nameExtractor) {
  const blocks = [];
  const flags = declRegex.flags.includes('g') ? declRegex.flags : `${declRegex.flags}g`;
  const re = new RegExp(declRegex.source, flags);
  let m = re.exec(content);
  while (m !== null) {
    const braceIdx = re.lastIndex - 1; // index of the opening '{' just consumed
    let depth = 0;
    let end = -1;
    for (let i = braceIdx; i < content.length; i++) {
      const ch = content[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) break; // unbalanced braces past this point; stop rather than mis-scan
    blocks.push({
      name: nameExtractor ? nameExtractor(m) : null,
      start: braceIdx,
      end,
      declIndex: m.index,
    });
    re.lastIndex = end + 1;
    m = re.exec(content);
  }
  return blocks;
}

function isBabylonShaderPath(file) {
  return (
    file.relPath.startsWith('src/shaders/') ||
    file.content.includes('ShaderMaterial') ||
    file.content.includes('ShaderStore')
  );
}

function isRenderOwnedTerrainFile(file) {
  if (!file.relPath.startsWith('src/terrain/')) return false;
  const base = file.relPath.split('/').pop();
  return base !== 'heightfield.js' && base !== 'parity.js';
}

function isCharacterFile(file) {
  return file.relPath.startsWith('src/character/');
}

function isCoreFile(file) {
  return file.relPath.startsWith('src/core/');
}

// ---------------------------------------------------------------------------
// babylon-webgpu-only checkers
// ---------------------------------------------------------------------------

/** Manual @group(/@binding( declarations inside Babylon-managed shader sources. */
function checkManualBabylonBindings(files) {
  return [
    ...scanRegex(files, /@group\(/g, isBabylonShaderPath),
    ...scanRegex(files, /@binding\(/g, isBabylonShaderPath),
  ];
}

/** BABYLON.ShaderLanguage.GLSL, or a .glsl shader file, inside a babylon-webgpu project. */
function checkWrongBabylonShaderLanguage(files) {
  const hits = scanRegex(files, /BABYLON\.ShaderLanguage\.GLSL\b/g);
  for (const file of files) {
    if (file.relPath.startsWith('src/shaders/') && file.relPath.toLowerCase().endsWith('.glsl')) {
      hits.push({ file: file.relPath, line: 1 });
    }
  }
  return hits;
}

/** A fallbackGlsl ShaderStore registration reintroducing a forbidden fallback shader path. */
function checkWrongBabylonShaderStore(files) {
  return scanRegex(files, /fallbackGlsl\b/g);
}

// ---------------------------------------------------------------------------
// three-webgl2-only checkers
// ---------------------------------------------------------------------------

/** WGSL-only @group(/@binding( syntax with no meaning in a WebGL2/GLSL project. */
function checkWgslBindingSyntaxInWebgl2(files) {
  return [...scanRegex(files, /@group\(/g), ...scanRegex(files, /@binding\(/g)];
}

/** WGSL entry-point syntax (@vertex/@fragment/fn main() ) inside a three-webgl2 project. */
function checkWrongWebgl2ShaderLanguage(files) {
  return [
    ...scanRegex(files, /@vertex\b/g),
    ...scanRegex(files, /@fragment\b/g),
    ...scanRegex(files, /fn\s+main\s*\(/g),
  ];
}

/** getContext('webgl') / getContext("webgl") — v1 context instead of v2. */
function checkWebgl1FallbackContext(files) {
  return scanRegex(files, /getContext\(\s*['"]webgl['"]\s*[,)]/g);
}

// ---------------------------------------------------------------------------
// Shared/universal checkers
// ---------------------------------------------------------------------------

/** Falling back to a lesser rendering backend than the one selected. */
function checkWebglFallback(files) {
  return [
    ...scanRegex(files, /new\s+BABYLON\.Engine\s*\(/g),
    ...scanRegex(files, /new\s+THREE\.WebGL1Renderer\s*\(/g),
  ];
}

/**
 * CPU-side pre-displacement of render-owned terrain vertices. Scoped to
 * `src/terrain/**` excluding `heightfield.js` and `parity.js`, which the
 * architecture ownership map explicitly allows to compute CPU heights for
 * physics/camera-clearance/foot-planting. Any other terrain file assigning
 * a vertex/position `.y` from a height/elevation expression is suspect.
 */
function checkCpuPredisplacedRenderMesh(files) {
  return scanRegex(files, /\.y\s*=\s*[^;\n]*(?:height|elevation)/gi, isRenderOwnedTerrainFile);
}

/** Setting window.__demo.ready = true without a nearby status==='ready' guard. */
function checkPrematureReadiness(files) {
  const hits = [];
  const guardRe = /status\s*===?\s*['"]ready['"]/;
  for (const file of files) {
    const re = /(?:\bready\s*:\s*true\b|\.ready\s*=\s*true\b)/g;
    let m = re.exec(file.content);
    while (m !== null) {
      const windowStart = Math.max(0, m.index - 150);
      const preceding = file.content.slice(windowStart, m.index);
      if (!guardRe.test(preceding)) {
        hits.push({ file: file.relPath, line: getLineNumber(file.content, m.index) });
      }
      m = re.exec(file.content);
    }
  }
  return hits;
}

/**
 * A catch block, inside src/core/**, that never sets status to "failed".
 * Bounded brace-match per catch block, not a general parser — see
 * `extractBracedBlocks`.
 */
function checkSuppressedInitializationFailure(files) {
  const hits = [];
  const declRe = /catch\s*\([^)]*\)\s*\{/g;
  for (const file of files) {
    if (!isCoreFile(file)) continue;
    const blocks = extractBracedBlocks(file.content, declRe);
    for (const block of blocks) {
      const body = file.content.slice(block.start, block.end + 1);
      if (!/status\s*[:=]\s*['"]failed['"]/.test(body)) {
        hits.push({ file: file.relPath, line: getLineNumber(file.content, block.declIndex) });
      }
    }
  }
  return hits;
}

/** A primitive box/sphere/capsule stand-in inside src/character/**. */
function checkPlaceholderCharacter(files) {
  return scanRegex(
    files,
    /\b(?:Box|Sphere|Capsule)Geometry\s*\(|\bCreate(?:Box|Sphere|Capsule)\s*\(/g,
    isCharacterFile,
  );
}

/**
 * `new ` allocation inside a function whose name looks like a per-frame
 * render/animate/tick loop. Bounded brace-match per function body, not a
 * general parser — see `extractBracedBlocks`.
 */
function checkRenderLoopAllocation(files) {
  const hits = [];
  const declRe =
    /(?:function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function)?\s*\([^)]*\)\s*=>\s*\{|([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{)/g;
  for (const file of files) {
    const blocks = extractBracedBlocks(file.content, declRe, (m) => m[1] || m[2] || m[3] || null);
    for (const block of blocks) {
      if (!block.name || !/render|animate|tick/i.test(block.name)) continue;
      const body = file.content.slice(block.start, block.end + 1);
      const allocRe = /\bnew\s+[A-Za-z_$]/g;
      let am = allocRe.exec(body);
      while (am !== null) {
        const absIndex = block.start + am.index;
        hits.push({ file: file.relPath, line: getLineNumber(file.content, absIndex) });
        am = allocRe.exec(body);
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Documented no-ops
//
// These IDs describe runtime, process, or visual-review concerns
// (`detection: 'runtime-only' | 'process' | 'evidence-record' |
// 'visual-review'` in build-contract.mjs, or a cross-file/semantic concept
// like "applied twice" that plain regex cannot safely distinguish from a
// single legitimate application) that source-text regex cannot reliably
// detect without an unacceptable false-positive rate. Per Task 5's brief,
// these are implemented as always-empty checks rather than invented
// heuristics, and are listed explicitly so callers know not to rely on
// them for real detection.
// ---------------------------------------------------------------------------

const noOp = () => [];

export const PATTERN_SCAN_NO_OP_IDS = Object.freeze([
  'duplicate-terrain-displacement',
  'indistinguishable-poses',
  'incomplete-evidence',
  'continue-after-failed-stage',
]);

// ---------------------------------------------------------------------------
// Registry + public API
// ---------------------------------------------------------------------------

const PATTERN_CHECKERS = {
  'manual-babylon-bindings': checkManualBabylonBindings,
  'wrong-babylon-shader-language': checkWrongBabylonShaderLanguage,
  'wrong-babylon-shader-store': checkWrongBabylonShaderStore,
  'wgsl-binding-syntax-in-webgl2': checkWgslBindingSyntaxInWebgl2,
  'wrong-webgl2-shader-language': checkWrongWebgl2ShaderLanguage,
  'webgl1-fallback-context': checkWebgl1FallbackContext,
  'webgl-fallback': checkWebglFallback,
  'cpu-predisplaced-render-mesh': checkCpuPredisplacedRenderMesh,
  'placeholder-character': checkPlaceholderCharacter,
  'premature-readiness': checkPrematureReadiness,
  'suppressed-initialization-failure': checkSuppressedInitializationFailure,
  'render-loop-allocation': checkRenderLoopAllocation,
  'duplicate-terrain-displacement': noOp,
  'indistinguishable-poses': noOp,
  'incomplete-evidence': noOp,
  'continue-after-failed-stage': noOp,
};

/** Every pattern id this module has an executable check for (real detector or documented no-op). */
export const PATTERN_SCAN_IMPLEMENTED_IDS = Object.freeze(Object.keys(PATTERN_CHECKERS));

/**
 * Scan `targetDir/src/**\/*.{js,wgsl,glsl}` for forbidden-pattern hits.
 *
 * @param {string} targetDir - root of the built project (contains `src/`).
 * @param {Array<{id:string, reason?:string}>} forbiddenPatterns - the
 *   already profile-filtered forbidden-patterns array to check (the caller
 *   passes `contract.forbiddenPatterns`). Only ids present in this array
 *   are checked; ids in this array with no registered checker are
 *   silently skipped (they are not part of this module's coverage).
 * @returns {Array<{id:string, file:string, line:number, reason:string}>}
 */
export function scanForForbiddenPatterns(targetDir, forbiddenPatterns) {
  if (typeof targetDir !== 'string' || targetDir.trim() === '') {
    throw new TypeError('scanForForbiddenPatterns: targetDir must be a non-empty string');
  }
  if (!Array.isArray(forbiddenPatterns)) {
    throw new TypeError('scanForForbiddenPatterns: forbiddenPatterns must be an array');
  }

  const files = collectSourceFiles(targetDir);
  const hits = [];

  for (const pattern of forbiddenPatterns) {
    const id = pattern?.id;
    if (typeof id !== 'string' || id === '') continue;
    const checker = PATTERN_CHECKERS[id];
    if (typeof checker !== 'function') continue; // no static detector registered for this id
    const reason = typeof pattern?.reason === 'string' && pattern.reason.length > 0 ? pattern.reason : id;
    const found = checker(files);
    for (const hit of found) {
      hits.push({ id, file: hit.file, line: hit.line, reason });
    }
  }

  return hits;
}
