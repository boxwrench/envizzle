import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Thrown when an assembled brief still contains {{TOKEN}} placeholders. */
export class UnresolvedTokenError extends Error {
  /** @param {string[]} tokens */
  constructor(tokens) {
    super(`Unresolved tokens in assembled brief: ${tokens.join(', ')}`);
    this.name = 'UnresolvedTokenError';
    this.tokens = tokens;
  }
}

// Matches {{NAME}} and {{NAME — default: anything}}. The name is the leading
// run of A-Z0-9_ ; everything up to the closing braces is a human-facing hint.
const TOKEN_RE = /\{\{([A-Z0-9_]+)(?:[^}]*)?\}\}/g;

/**
 * Replace every {{TOKEN}} with tokens[TOKEN].
 * @throws {UnresolvedTokenError} if any placeholder has no value.
 */
export function substituteTokens(template, tokens) {
  const out = template.replace(TOKEN_RE, (match, name) =>
    Object.prototype.hasOwnProperty.call(tokens, name) ? tokens[name] : match,
  );

  const missing = [...new Set([...out.matchAll(TOKEN_RE)].map((m) => m[1]))];
  if (missing.length > 0) throw new UnresolvedTokenError(missing);
  return out;
}

const SECTION_RE = /<!--SECTION:([a-z0-9-]+)-->([\s\S]*?)<!--\/SECTION-->\n?/g;

/** Keep the bodies of enabled sections, delete disabled ones entirely. */
export function stripSections(template, enabled) {
  return template.replace(SECTION_RE, (_match, name, body) =>
    enabled.has(name) ? body : '',
  );
}

/**
 * Build the final brief. Sections are stripped first so that tokens living
 * inside a disabled section never count as missing.
 */
export function assemble({ template, tokens, enabledSections, characterRecipe }) {
  const sectioned = stripSections(template, enabledSections);
  return substituteTokens(sectioned, {
    ...tokens,
    CHARACTER_RECIPE: characterRecipe,
  });
}

/** Read the canonical template and character recipe off disk. */
export function loadAssets() {
  return {
    template: fs.readFileSync(path.join(HERE, '..', 'TEMPLATE.md'), 'utf8'),
    characterRecipe: fs.readFileSync(
      path.join(HERE, '..', 'references', 'character-recipe.md'),
      'utf8',
    ),
  };
}
