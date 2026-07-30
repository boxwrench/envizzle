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
