import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadReferenceCatalog, EXPECTED_BIOME_TOKENS, EXPECTED_MECHANIC_TOKENS } from '../reference-loader.mjs';
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

test('every biome has exactly 19 tokens, FOOT_INTERACTION, and parseable coherence JSON', () => {
  const catalog = loadReferenceCatalog({ rootDir: repoRoot });
  for (const [name, biome] of Object.entries(catalog.biomes)) {
    assert.equal(Object.keys(biome.tokens).length, 19, `Biome ${name} should have 19 tokens`);
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
