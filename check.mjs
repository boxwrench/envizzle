#!/usr/bin/env node
/**
 * Validate an assembled envizzle brief.
 *
 * Claude assembles the brief by reading references/presets.md and filling
 * TEMPLATE.md. This script is the safety net: it catches the mechanical
 * mistakes that are easy to make by hand and invisible to read past.
 *
 * Usage: node check.mjs <brief.md>
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// {{NAME}} and {{NAME — default: hint}}. Name is the leading run of A-Z0-9_.
const TOKEN_RE = /\{\{([A-Z0-9_]+)(?:[^}]*)?\}\}/g;
const SECTION_RE = /<!--\/?SECTION:?[a-z0-9-]*-->/g;
// ${NAME} never substitutes — it is JS template-literal syntax that leaked
// into a markdown template. TEMPLATE.md:66 shipped this bug for months.
const LITERAL_RE = /\$\{([A-Za-z0-9_]+)\}/g;

const uniqueMatches = (text, re, group = 1) =>
  [...new Set([...text.matchAll(re)].map((m) => m[group]))];

/** Token names still unfilled in the brief. */
export function findUnresolvedTokens(brief) {
  return uniqueMatches(brief, TOKEN_RE);
}

/** Section markers that should have been stripped along with their bodies. */
export function findStraySectionMarkers(brief) {
  return [...brief.matchAll(SECTION_RE)].map((m) => m[0]);
}

/** `${NAME}` forms, which look like tokens but never substitute. */
export function findTemplateLiteralLeaks(brief) {
  return uniqueMatches(brief, LITERAL_RE);
}

/** @returns {{ok: boolean, problems: string[]}} */
export function validateBrief(brief) {
  const problems = [];

  const tokens = findUnresolvedTokens(brief);
  if (tokens.length > 0) {
    problems.push(
      `${tokens.length} unresolved token(s): ${tokens.join(', ')}. Fill them, or omit the section that contains them.`,
    );
  }

  const leaks = findTemplateLiteralLeaks(brief);
  if (leaks.length > 0) {
    problems.push(
      `${leaks.length} \${} template-literal leak(s): ${leaks.join(', ')}. These never substitute — rewrite as {{NAME}} and fill them.`,
    );
  }

  const markers = findStraySectionMarkers(brief);
  if (markers.length > 0) {
    problems.push(
      `${markers.length} stray section marker(s): ${[...new Set(markers)].join(', ')}. Delete the marker lines; keep or drop the body deliberately.`,
    );
  }

  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------- colour ---

/** '#rrggbb' → [r, g, b] each 0..1 in sRGB space. */
export function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) throw new Error(`Expected #rrggbb, got: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb01(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** HSV saturation, 0 (neutral grey) .. 1 (fully saturated). */
export function saturation(hex) {
  const [r, g, b] = hexToRgb01(hex);
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

// ------------------------------------------------------------- coherence ---

const LIGHT_ANCHOR_MIN_LUM = 0.55;
const LIGHT_ANCHOR_MAX_SAT = 0.35;
const LARGE_AREA_MIN_MEAN_LUM = 0.30;
const ACCENT_MAX_FRACTION = 0.35;
const TIER_DARK = 0.15;
const TIER_LIGHT = 0.55;

const conflict = (rule, severity, message, fix) => ({ rule, severity, message, fix });

/**
 * Evaluate a demo config against the art-direction rules.
 * @returns {Array<{rule:string,severity:'error'|'warn',message:string,fix:string}>}
 */
export function checkCoherence(config) {
  const out = [];
  const palette = config.palette ?? [];
  const lums = palette.map((p) => relativeLuminance(p.hex));

  // R1 — light anchor. A saturated neon is not a light value. Without a
  // desaturated bright tone the scene reads as murk with glowing bits.
  const hasAnchor = palette.some(
    (p) => relativeLuminance(p.hex) >= LIGHT_ANCHOR_MIN_LUM
        && saturation(p.hex) <= LIGHT_ANCHOR_MAX_SAT,
  );
  if (palette.length > 0 && !hasAnchor) {
    out.push(conflict(
      'light-anchor', 'error',
      `No light anchor: no colour has luminance >= ${LIGHT_ANCHOR_MIN_LUM} AND saturation <= ${LIGHT_ANCHOR_MAX_SAT}. Saturated neons do not count.`,
      'Add a desaturated bright tone — warm off-white, pale sky tint, bleached stone (e.g. #f2ece0, #d8d0b8) — at large or medium area.',
    ));
  }

  // R2 — value tiers. Needs something dark, mid, and light.
  if (palette.length > 0) {
    const hasDark = lums.some((l) => l < TIER_DARK);
    const hasMid = lums.some((l) => l >= TIER_DARK && l <= TIER_LIGHT);
    const hasLight = lums.some((l) => l > TIER_LIGHT);
    if (!(hasDark && hasMid && hasLight)) {
      const missing = [
        !hasDark && 'dark (<0.15)',
        !hasMid && 'mid (0.15-0.55)',
        !hasLight && 'light (>0.55)',
      ].filter(Boolean).join(', ');
      out.push(conflict(
        'value-tiers', 'error',
        `Palette is missing value tiers: ${missing}. Flat-value palettes read as unlit.`,
        'Add one colour per missing tier so shadow, midtone, and highlight separate.',
      ));
    }
  }

  // R3 — large-area luminance. Painterly reads as beautiful because it is
  // high-key; the colours covering most of the screen must carry light.
  const large = palette.filter((p) => p.area === 'large');
  if (config.paradigm === 'painterly' && large.length > 0) {
    const mean = large.reduce((s, p) => s + relativeLuminance(p.hex), 0) / large.length;
    if (mean < LARGE_AREA_MIN_MEAN_LUM) {
      out.push(conflict(
        'large-area-luminance', 'error',
        `Painterly paradigm with mean large-area luminance ${mean.toFixed(3)} (floor ${LARGE_AREA_MIN_MEAN_LUM}). Sky, terrain, and vegetation carry most of the frame; dark values there produce muddy frames.`,
        'Raise sky/terrain/vegetation into the 0.30-0.70 range, or switch to photoreal where a low-key palette is supportable.',
      ));
    }
  }

  // R4 — accent cap. Emissive should punctuate, not dominate.
  if (palette.length > 0) {
    const accents = palette.filter((p) => p.area === 'accent').length;
    const fraction = accents / palette.length;
    if (fraction > ACCENT_MAX_FRACTION) {
      out.push(conflict(
        'accent-cap', 'warn',
        `${accents} of ${palette.length} entries are accents (${(fraction * 100).toFixed(0)}%, cap ${ACCENT_MAX_FRACTION * 100}%). Emissive should stay under ~15% of screen area.`,
        'Demote some accents to medium area, or fold them into one accent hue used sparingly.',
      ));
    }
  }

  // R5 / R6 — techniques implied by paradigm + zero assets.
  const behaviours = (config.materialBehaviours ?? '').toLowerCase();
  if (config.paradigm === 'photoreal' && config.assetStrategy === 'zero-asset'
      && !/multi-scale|multiscale/.test(behaviours)) {
    out.push(conflict(
      'photoreal-multiscale-normals', 'error',
      'Photoreal with zero assets requires multi-scale procedural normals; none declared.',
      'Declare multi-scale procedural normal detail (three octaves minimum) so the surface reads close, mid, and far.',
    ));
  }
  if (config.paradigm === 'painterly' && config.assetStrategy === 'zero-asset') {
    const hasTable = /palette table/.test(behaviours);
    const hasRamp = /cel ramp|toon ramp|cel-shad/.test(behaviours);
    if (!hasTable || !hasRamp) {
      out.push(conflict(
        'painterly-palette-table', 'error',
        `Painterly with zero assets requires both a palette table and a cel ramp; declared ${hasTable ? 'a palette table' : 'no palette table'} and ${hasRamp ? 'a cel ramp' : 'no cel ramp'}.`,
        'Declare a single-source sRGB palette table converted to linear on load, plus a 2-step cel ramp with shadow-boundary wobble.',
      ));
    }
  }

  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node check.mjs <brief.md>');
    process.exit(2);
  }
  const { ok, problems } = validateBrief(fs.readFileSync(file, 'utf8'));
  if (ok) {
    console.log(`OK: ${file} has no unresolved tokens, leaks, or stray markers.`);
    process.exit(0);
  }
  console.error(`FAILED: ${file}`);
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
  process.exit(1);
}
