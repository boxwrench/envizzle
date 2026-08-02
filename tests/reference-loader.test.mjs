import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  loadReferenceCatalog,
  EXPECTED_BIOME_TOKENS,
  EXPECTED_MECHANIC_TOKENS,
  OPTIONAL_BIOME_LABELED_TOKENS,
} from '../reference-loader.mjs';
import { checkCoherence } from '../check.mjs';
import { SHOWCASES } from '../selection.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function withTempCatalog(modifyFn, testFn) {
  const tmpRoot = path.join(repoRoot, 'tests', `tmp-ref-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  fs.mkdirSync(path.join(tmpRoot, 'references'), { recursive: true });

  const refFiles = ['biomes.md', 'archetypes.md', 'mechanics.md', 'cameras.md', 'showcases.md'];
  for (const f of refFiles) {
    fs.copyFileSync(path.join(repoRoot, 'references', f), path.join(tmpRoot, 'references', f));
  }

  try {
    modifyFn(tmpRoot);
    testFn(tmpRoot);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

test('loadReferenceCatalog loads exact canonical entry counts', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  assert.equal(Object.keys(catalog.biomes).length, 6);
  assert.equal(Object.keys(catalog.archetypes).length, 5);
  assert.equal(Object.keys(catalog.mechanics).length, 5);
  assert.equal(Object.keys(catalog.cameras).length, 4);
  assert.equal(Object.keys(catalog.renderingProfiles).length, 2);
  assert.equal(Object.keys(catalog.showcases).length, 6);
});

test('every biome has at least the 19 required tokens, FOOT_INTERACTION, and parseable coherence JSON', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, biome] of Object.entries(catalog.biomes)) {
    const presentOptionalCount = OPTIONAL_BIOME_LABELED_TOKENS.filter((key) => biome.tokens[key] !== undefined).length;
    assert.equal(
      Object.keys(biome.tokens).length,
      19 + presentOptionalCount,
      `Biome ${name} should have 19 required tokens plus ${presentOptionalCount} optional tokens`,
    );
    for (const token of EXPECTED_BIOME_TOKENS) {
      assert.ok(biome.tokens[token], `Biome ${name} missing token ${token}`);
      assert.ok(biome.tokens[token].trim().length > 0, `Biome ${name} token ${token} is empty`);
    }
    assert.ok(biome.footInteraction, `Biome ${name} missing footInteraction`);
    assert.ok(biome.footInteraction.trim().length > 0, `Biome ${name} footInteraction is empty`);
    assert.ok(biome.coherenceConfig, `Biome ${name} missing coherenceConfig`);
    assert.ok(Array.isArray(biome.coherenceConfig.palette), `Biome ${name} palette should be array`);
  }
});

test('Dune Desert defines both optional morphology review tokens with the exact anti-pattern and positive-requirement content; all other biomes leave them absent', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  const dune = catalog.biomes['Dune Desert'];
  const normalizeWhitespace = (s) => s.replace(/\s+/g, ' ').trim();
  assert.equal(
    normalizeWhitespace(dune.tokens.MORPHOLOGY_ANTI_PATTERNS),
    'Do not represent dunes as overlapping cones, pyramids, low-resolution square tiles, visibly independent LOD grids, or repeated isolated procedural primitives.',
  );
  const positiveRequirements = [
    'crescent-shaped barchan forms',
    'shallow windward slopes',
    'steeper slip faces',
    'multiple dune scales',
    'continuous ridges',
    'readable wind direction',
    'seamless LOD boundaries',
    'layered dune horizon',
    'natural elevation continuity',
    'visible locomotion wake',
    'clearly readable surf/carve mechanic',
  ];
  const normalizedVisualReviewQuestions = normalizeWhitespace(dune.tokens.VISUAL_REVIEW_QUESTIONS);
  for (const phrase of positiveRequirements) {
    assert.ok(
      normalizedVisualReviewQuestions.includes(phrase),
      `Dune Desert VISUAL_REVIEW_QUESTIONS missing positive requirement '${phrase}'`,
    );
  }

  for (const [name, biome] of Object.entries(catalog.biomes)) {
    if (name === 'Dune Desert') continue;
    assert.equal(biome.tokens.MORPHOLOGY_ANTI_PATTERNS, undefined, `Biome ${name} should not define MORPHOLOGY_ANTI_PATTERNS yet`);
    assert.equal(biome.tokens.VISUAL_REVIEW_QUESTIONS, undefined, `Biome ${name} should not define VISUAL_REVIEW_QUESTIONS yet`);
  }
});

test('all canonical biome configurations remain coherence-clean', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, biome] of Object.entries(catalog.biomes)) {
    const fullConfig = {
      paradigm: biome.coherenceConfig.paradigm,
      assetStrategy: 'zero-asset',
      materialBehaviours: biome.coherenceConfig.materialBehaviours,
      palette: biome.coherenceConfig.palette,
    };
    const conflicts = checkCoherence(fullConfig);
    const errors = conflicts.filter((c) => c.severity === 'error');
    assert.equal(errors.length, 0, `Biome ${name} coherence config has errors: ${JSON.stringify(errors)}`);
  }
});

test('every mechanic has exactly six tokens', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, mechanic] of Object.entries(catalog.mechanics)) {
    assert.equal(Object.keys(mechanic.tokens).length, 6, `Mechanic ${name} should have 6 tokens`);
    for (const token of EXPECTED_MECHANIC_TOKENS) {
      assert.ok(mechanic.tokens[token], `Mechanic ${name} missing token ${token}`);
      assert.ok(mechanic.tokens[token].trim().length > 0, `Mechanic ${name} token ${token} is empty`);
    }
  }
});

test('archetype and camera sections remain substantial', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, archetype] of Object.entries(catalog.archetypes)) {
    assert.ok(archetype.body.length > 200, `Archetype ${name} body too short`);
  }
  for (const [name, camera] of Object.entries(catalog.cameras)) {
    assert.ok(camera.body.length > 100, `Camera ${name} body too short`);
  }
});

test('parsed showcase structural fields agree with SHOWCASES', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, expected] of Object.entries(SHOWCASES)) {
    const parsed = catalog.showcases[name];
    assert.ok(parsed, `Showcase ${name} missing from parsed catalog`);
    assert.equal(parsed.biome, expected.biome);
    assert.equal(parsed.archetype, expected.archetype);
    assert.equal(parsed.mechanic, expected.mechanic);
    assert.equal(parsed.camera, expected.camera);
    assert.equal(parsed.ambition, expected.ambition);
    assert.deepEqual(parsed.includedSections, expected.includedSections);
    assert.deepEqual(parsed.extraSections, expected.extraSections);
    assert.equal(parsed.renderingProfile, expected.renderingProfile);
  }
});

test('loader regression 1: rejects duplicate biome table token', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content.replace('| `NAIVE_DEFAULT` | white |', '| `NAIVE_DEFAULT` | white |\n| `NAIVE_DEFAULT` | white |');
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Duplicate table-token row 'NAIVE_DEFAULT'/);
    }
  );
});

test('loader regression 2: rejects duplicate biome labeled token', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content.replace('**`TERRAIN_PHILOSOPHY_SENTENCE`**', '**`TERRAIN_PHILOSOPHY_SENTENCE`**\n\n**`TERRAIN_PHILOSOPHY_SENTENCE`**');
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Duplicate labeled-token marker 'TERRAIN_PHILOSOPHY_SENTENCE'/);
    }
  );
});

test('loader regression 3: rejects unknown biome entry', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content + '\n\n### Unknown Biome\n\nSome body text.\n';
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Unknown biome entry 'Unknown Biome'/);
    }
  );
});

test('loader regression 4: rejects duplicate mechanic ability', () => {
  withTempCatalog(
    (root) => {
      const mechPath = path.join(root, 'references', 'mechanics.md');
      const content = fs.readFileSync(mechPath, 'utf8');
      const modified = content.replace('- `ABILITY_1_NAME` — **Sweep**', '- `ABILITY_1_NAME` — **Sweep**\n- `ABILITY_1_NAME` — **Sweep Duplicate**');
      fs.writeFileSync(mechPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Duplicate ability field 'ABILITY_1_NAME'/);
    }
  );
});

test('loader regression 5: rejects duplicate rendering profile', () => {
  withTempCatalog(
    (root) => {
      const camPath = path.join(root, 'references', 'cameras.md');
      const content = fs.readFileSync(camPath, 'utf8');
      const modified = content + '\n\n### Default profile: Babylon WebGPU\n\n- **`ENGINE`**: `Babylon.js`\n';
      fs.writeFileSync(camPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Duplicate rendering profile 'babylon-webgpu'/);
    }
  );
});

test('loader regression 6: rejects unknown showcase', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content + '\n\n### Unknown Showcase\n\n| Field | Value |\n|---|---|\n';
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Unknown showcase entry 'Unknown Showcase'/);
    }
  );
});

test('loader regression 7: rejects changed showcase mechanic', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace('| Mechanic | Surf / Carve |', '| Mechanic | Flight / Glide |');
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Showcase 'Alpine Dawn' mechanic mismatch/);
    }
  );
});

test('loader regression 8: rejects changed showcase camera or ambition', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace('| Camera | Third Person |', '| Camera | First Person |');
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Showcase 'Alpine Dawn' camera mismatch/);
    }
  );

  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace('| Ambition | `showcase` |', '| Ambition | `slice` |');
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Showcase 'Alpine Dawn' ambition mismatch/);
    }
  );
});

test('loader regression 9: rejects changed included/extra sections', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace('`vegetation`, `state-buffer`, `audio`', '`vegetation`');
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Showcase 'Alpine Dawn' includedSections mismatch/);
    }
  );
});

test('loader regression 10: rejects changed state-channel contract', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace('depression → R', 'depression → G');
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Showcase 'Alpine Dawn' state-channel contract string mismatch/);
    }
  );
});

test('loader regression 11: rejects changed rendering tuple', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace('WGSL / `wgsl`', 'GLSL / `glsl`');
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Showcase 'Alpine Dawn' rendering profile tuple mismatch/);
    }
  );
});

test('loader regression 12: rejects changed state-channel effect text', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace(
        'carve groove lowers snow depression depth',
        'MUTATED effect text for carve groove'
      );
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /state-channel contract string mismatch for key 'depression'/);
    }
  );
});

test('loader regression 13: rejects swapped state channels', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace(
        'depression → R',
        'depression → G'
      ).replace(
        'displaced-mass → G',
        'displaced-mass → R'
      );
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /state-channel contract string mismatch for key 'depression'/);
    }
  );
});

test('loader regression 14: rejects unknown biome table token', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content.replace(
        '| `NAIVE_DEFAULT` | white |',
        '| `NAIVE_DEFAULT` | white |\n| `UNKNOWN_TABLE_TOKEN` | unknown |'
      );
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Unknown table token 'UNKNOWN_TABLE_TOKEN'/);
    }
  );
});

test('loader regression 15: rejects unknown biome labeled token', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content.replace(
        '**`TERRAIN_PHILOSOPHY_SENTENCE`**',
        '**`UNKNOWN_LABELED_TOKEN`** — Extra prose.\n\n**`TERRAIN_PHILOSOPHY_SENTENCE`**'
      );
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Unknown labeled token 'UNKNOWN_LABELED_TOKEN'/);
    }
  );
});

test('loader regression 16: rejects unknown biome coherence-config property', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content.replace(
        '"paradigm": "photoreal",',
        '"paradigm": "photoreal",\n    "unknownProperty": true,'
      );
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Unknown property 'unknownProperty'/);
    }
  );
});

test('loader regression 17: rejects unknown palette-entry property', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content.replace(
        '{ "role": "lit-snow", "hex": "#f0f4f8", "area": "large" }',
        '{ "role": "lit-snow", "hex": "#f0f4f8", "area": "large", "extraField": "invalid" }'
      );
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Unknown palette-entry property 'extraField'/);
    }
  );
});

test('loader regression 18: rejects unknown rendering-profile field', () => {
  withTempCatalog(
    (root) => {
      const camPath = path.join(root, 'references', 'cameras.md');
      const content = fs.readFileSync(camPath, 'utf8');
      const modified = content.replace(
        '- **`ENGINE`**: `Babylon.js',
        '- **`EXTRA_PROFILE_FIELD`**: `invalid`\n- **`ENGINE`**: `Babylon.js'
      );
      fs.writeFileSync(camPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Unknown rendering-profile field 'EXTRA_PROFILE_FIELD'/);
    }
  );
});

test('loader regression 19: rejects showcase rendering-paradigm drift', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace(
        '| `RENDERING_PARADIGM` | AAA Photoreal |',
        '| `RENDERING_PARADIGM` | Ghibli-Style Painterly Anime |'
      );
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Showcase 'Alpine Dawn' rendering paradigm mismatch/);
    }
  );
});

test('loader regression 20: rejects non-exact asset strategy', () => {
  withTempCatalog(
    (root) => {
      const showPath = path.join(root, 'references', 'showcases.md');
      const content = fs.readFileSync(showPath, 'utf8');
      const modified = content.replace(
        '100% Zero-Asset Procedural (zero runtime CDN texture/mesh/audio dependencies)',
        'NOT 100% Zero-Asset Procedural; use a CDN'
      );
      fs.writeFileSync(showPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Showcase 'Alpine Dawn' assetStrategy must promise 100% Zero-Asset Procedural/);
    }
  );
});

test('loader regression 21: rejects duplicate optional biome labeled token', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content.replace(
        '**`MORPHOLOGY_ANTI_PATTERNS`**',
        '**`MORPHOLOGY_ANTI_PATTERNS`** — Duplicate.\n\n**`MORPHOLOGY_ANTI_PATTERNS`**'
      );
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Duplicate labeled-token marker 'MORPHOLOGY_ANTI_PATTERNS'/);
    }
  );
});

test('loader regression 22: rejects empty optional biome labeled token content', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content.replace(
        '**`VISUAL_REVIEW_QUESTIONS`** — Do the dunes show recognizable crescent-shaped barchan forms\nwith shallow windward slopes, steeper slip faces, and multiple dune scales, joined by\ncontinuous ridges with a readable wind direction, seamless LOD boundaries, and a layered\ndune horizon with natural elevation continuity, and is there a visible locomotion wake\nand a clearly readable surf/carve mechanic?',
        '**`VISUAL_REVIEW_QUESTIONS`**'
      );
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      assert.throws(() => loadReferenceCatalog({ rootDir: root }), /Empty content for token 'VISUAL_REVIEW_QUESTIONS'/);
    }
  );
});

test('loader regression 23: an optional biome labeled token defined on a non-Dune biome is tolerated and counted', () => {
  withTempCatalog(
    (root) => {
      const bioPath = path.join(root, 'references', 'biomes.md');
      const content = fs.readFileSync(bioPath, 'utf8');
      const modified = content.replace(
        '**`FOOT_INTERACTION`** — displace snow by 6–9 cm',
        '**`MORPHOLOGY_ANTI_PATTERNS`** — Do not represent snow as a flat unlit plane.\n\n**`FOOT_INTERACTION`** — displace snow by 6–9 cm'
      );
      fs.writeFileSync(bioPath, modified, 'utf8');
    },
    (root) => {
      const catalog = loadReferenceCatalog({ rootDir: root });
      assert.equal(
        catalog.biomes['Alpine Snow'].tokens.MORPHOLOGY_ANTI_PATTERNS,
        'Do not represent snow as a flat unlit plane.',
      );
      assert.equal(Object.keys(catalog.biomes['Alpine Snow'].tokens).length, 20);
    }
  );
});

test('missing or duplicate token fields fail loudly', () => {
  assert.throws(() => {
    loadReferenceCatalog({ rootDir: '/non/existent/dir' });
  }, /Reference file missing/);
});

test('no reference parser relies on historical references/presets.md', () => {
  const presetsPath = path.join(repoRoot, 'references', 'presets.md');
  assert.equal(fs.existsSync(presetsPath), false, 'references/presets.md should not exist');
  assert.doesNotThrow(() => {
    loadReferenceCatalog({ rootDir: repoRoot });
  });
});
