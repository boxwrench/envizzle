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
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Expected #rrggbb, got: ${hex}`);
  }
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
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
const LARGE_AREA_MIN_MEAN_LUM = 0.30;   // painterly only
const LARGE_AREA_MIN_MEAN_ANY = 0.10;   // every paradigm; tracks the runtime gate
const ACCENT_MAX_FRACTION = 0.35;
const TIER_DARK = 0.15;
const TIER_LIGHT = 0.55;

const conflict = (rule, severity, message, fix) => ({ rule, severity, message, fix });

/**
 * Validate structure and required fields of a demo config object.
 * @returns {Array<{rule:string,severity:'error'|'warn',message:string,fix:string}>}
 */
export function validateConfig(config) {
  const out = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    out.push(conflict(
      'config-required', 'error',
      'Configuration must be a non-null object.',
      'Provide a valid configuration object.',
    ));
    return out;
  }

  if (config.paradigm !== 'photoreal' && config.paradigm !== 'painterly') {
    out.push(conflict(
      'paradigm-invalid', 'error',
      `Invalid paradigm '${config.paradigm}'; expected 'photoreal' or 'painterly'.`,
      "Set paradigm to 'photoreal' or 'painterly'.",
    ));
  }

  if (typeof config.assetStrategy !== 'string' || config.assetStrategy.trim() === '') {
    out.push(conflict(
      'asset-strategy-required', 'error',
      'assetStrategy must be a non-empty string.',
      "Specify assetStrategy (e.g. 'zero-asset').",
    ));
  }

  if (typeof config.materialBehaviours !== 'string' || config.materialBehaviours.trim() === '') {
    out.push(conflict(
      'material-behaviours-required', 'error',
      'materialBehaviours must be a non-empty string.',
      'Specify materialBehaviours description string.',
    ));
  }

  if (!Array.isArray(config.palette) || config.palette.length === 0) {
    out.push(conflict(
      'palette-required', 'error',
      'palette must be a non-empty array.',
      'Provide a palette array containing at least one entry.',
    ));
  } else {
    const invalidEntries = [];
    let hasLargeArea = false;

    config.palette.forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') {
        invalidEntries.push(`index ${idx} (not an object)`);
        return;
      }
      const entryProblems = [];
      if (typeof entry.role !== 'string' || entry.role.trim() === '') {
        entryProblems.push('missing role');
      }
      if (typeof entry.hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(entry.hex)) {
        entryProblems.push('invalid hex');
      }
      if (entry.area !== 'large' && entry.area !== 'medium' && entry.area !== 'accent') {
        entryProblems.push('invalid area');
      }

      if (entryProblems.length > 0) {
        invalidEntries.push(`index ${idx}: ${entryProblems.join(', ')}`);
      } else if (entry.area === 'large') {
        hasLargeArea = true;
      }
    });

    if (invalidEntries.length > 0) {
      out.push(conflict(
        'palette-entry-invalid', 'error',
        `Invalid palette entries: ${invalidEntries.join('; ')}.`,
        "Correct entry role, hex (#rrggbb format), and area ('large', 'medium', or 'accent').",
      ));
    }

    if (!hasLargeArea) {
      out.push(conflict(
        'large-area-required', 'error',
        "Palette must contain at least one entry with area 'large'.",
        "Set area: 'large' on sky, terrain, or main surface palette entries.",
      ));
    }
  }

  return out;
}

/**
 * Evaluate a demo config against the art-direction rules.
 * @returns {Array<{rule:string,severity:'error'|'warn',message:string,fix:string}>}
 */
export function checkCoherence(config) {
  const validationConflicts = validateConfig(config);
  if (validationConflicts.length > 0) {
    return validationConflicts;
  }

  const out = [];
  const palette = config.palette;
  const lums = palette.map((p) => relativeLuminance(p.hex));

  // R1 — light anchor. A saturated neon is not a light value. Without a
  // desaturated bright tone the scene reads as murk with glowing bits.
  // The anchor must also occupy real screen area: a light tone confined to a
  // 2%-of-frame accent anchors nothing.
  const hasAnchor = palette.some(
    (p) => relativeLuminance(p.hex) >= LIGHT_ANCHOR_MIN_LUM
        && saturation(p.hex) <= LIGHT_ANCHOR_MAX_SAT
        && (p.area === 'large' || p.area === 'medium'),
  );
  if (palette.length > 0 && !hasAnchor) {
    out.push(conflict(
      'light-anchor', 'error',
      `No light anchor: no large- or medium-area colour has luminance >= ${LIGHT_ANCHOR_MIN_LUM} AND saturation <= ${LIGHT_ANCHOR_MAX_SAT}. Saturated neons do not count, and an accent-area highlight is too small to anchor a frame.`,
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

  // R3b — no all-dark large areas, EVERY paradigm. R3 exempts photoreal so a
  // deliberate night or volcanic scene stays possible, but that exemption must
  // not become a licence for an all-obsidian frame. A disciplined dark scene
  // still has something big carrying light: moonlit wet road, ash-lit steam,
  // a bright sky band. If every large area is in the dark tier, the frame is
  // murk regardless of paradigm.
  if (large.length > 0) {
    const largeLums = large.map((p) => relativeLuminance(p.hex));
    const brightest = Math.max(...largeLums);
    const meanLarge = largeLums.reduce((s, l) => s + l, 0) / largeLums.length;

    if (brightest <= TIER_DARK) {
      out.push(conflict(
        'large-area-all-dark', 'error',
        `Every large-area colour is in the dark tier (brightest is ${brightest.toFixed(3)}, needs one above ${TIER_DARK}). The frame will read as murk whatever the paradigm.`,
        'Give at least one large-area colour a value above 0.15 — a lit sky band, a wet or reflective ground plane, or a mist layer. A dark scene needs one big surface carrying light, not only small emissive accents.',
      ));
    }

    // An existence check on the brightest value alone is gameable: one large
    // area a hair over 0.15 would license arbitrarily black remaining large
    // areas. This floor is deliberately aligned with the runtime image gate's
    // meanLuminanceMin of 0.12 — a palette below it would very likely fail
    // that gate after the build, and catching it here is far cheaper.
    if (meanLarge < LARGE_AREA_MIN_MEAN_ANY) {
      out.push(conflict(
        'large-area-mean-floor', 'error',
        `Mean large-area luminance is ${meanLarge.toFixed(3)} (floor ${LARGE_AREA_MIN_MEAN_ANY}). One lit band over otherwise black surfaces still renders as murk, and the runtime luminance gate would likely reject the frame.`,
        'Raise a second large-area surface out of the dark tier, or promote a mid-value colour from medium to large area. A dark scene needs more than a single bright stripe.',
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
