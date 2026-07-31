import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateAssemblySpec, assembleBrief, writeBundle } from '../assemble.mjs';
import { validateBrief } from '../check.mjs';
import { SHOWCASES, MECHANIC_WRITES } from '../selection.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const extraSectionBodies = {
  weather: 'Dynamic wind gusts alter rain shear and grass wave speed.',
  'water-bodies': 'A carved river spline with 3-step quantised painterly specular.',
  architecture: 'A stone viaduct with 9 arches spanning 14 m each.',
  destructibility: 'Impacts dislodge stone fragments from ancient ruins along the bank.',
};

const makeTempDir = () => {
  const tmp = path.join(repoRoot, 'tests', `tmp-asm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
};

const removeTempDir = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('all six canonical showcase selections can produce valid briefs', () => {
  for (const [name, showcase] of Object.entries(SHOWCASES)) {
    const spec = {
      selection: {
        creativeMode: 'signature',
        path: 'showcase',
        baseShowcase: name,
        changedAxes: [],
        ambition: showcase.ambition,
        biome: showcase.biome,
        archetype: showcase.archetype,
        mechanic: showcase.mechanic,
        camera: showcase.camera,
        renderingProfile: showcase.renderingProfile,
        includedSections: showcase.includedSections,
        extraSections: showcase.extraSections,
        cameraAdjustments: showcase.cameraAdjustments,
        stateChannelContract: showcase.stateChannelContract,
        signatureMoment: {
          enabled: true,
          text: `Signature moment for ${name}`,
          reusedSystem: 'particles',
          verificationPose: 'mechanic',
        },
        noveltyBudget: {
          addsEngine: false,
          addsAssetCategory: false,
          addsPersistentBuffer: false,
          addsMajorRenderPass: false,
          addsSimulationSubsystem: false,
          addsInput: false,
          increasesAmbition: false,
        },
      },
      creativeSpark: 'surprise me',
      builderAgent: 'Claude Code',
      extraSectionMarkdown: showcase.extraSections.length > 0 ? extraSectionBodies : {},
    };

    const { brief, fileName } = assembleBrief(spec, { rootDir: repoRoot });
    assert.ok(brief, `Brief for ${name} should be generated`);
    assert.ok(fileName.endsWith('_TECHDEMO_PROMPT.md'));

    const val = validateBrief(brief);
    assert.equal(val.ok, true, `Brief for ${name} failed validateBrief: ${val.problems.join(' | ')}`);
  }
});

test('output is deterministic byte-for-byte', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  const res1 = assembleBrief(spec, { rootDir: repoRoot });
  const res2 = assembleBrief(spec, { rootDir: repoRoot });

  assert.equal(res1.brief, res2.brief);
  assert.equal(res1.fileName, res2.fileName);
});

test('no output contains active reference-file dependencies', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const { brief } = assembleBrief(spec, { rootDir: repoRoot });

  assert.equal(/references\/[a-z0-9_-]+\.md|TEMPLATE\.md|selection\.mjs|check\.mjs/.test(brief), false);
});

test('validateAssemblySpec rejects unknown top-level keys', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  spec.unknownTopLevelKey = 123;

  const findings = validateAssemblySpec(spec, { rootDir: repoRoot });
  assert.ok(findings.some((f) => f.rule === 'assembly-key-unknown'));
});

test('validateAssemblySpec and assembleBrief do not mutate input objects', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const copyBefore = JSON.parse(JSON.stringify(spec));

  validateAssemblySpec(spec, { rootDir: repoRoot });
  assert.deepEqual(spec, copyBefore);

  assembleBrief(spec, { rootDir: repoRoot });
  assert.deepEqual(spec, copyBefore);
});

test('strict type enforcement for creativeSpark, builderAgent, projectName, coreInteractionSentence, extraSectionMarkdown', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  // creativeSpark invalid type
  const badSpark = { ...spec, creativeSpark: 123 };
  assert.ok(validateAssemblySpec(badSpark, { rootDir: repoRoot }).some((f) => f.rule === 'creative-spark-invalid-type'));

  // creativeSpark in Proven mode
  const provenSpec = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'proven-dune.json'), 'utf8'));
  const badProvenSpark = { ...provenSpec, creativeSpark: 'some spark' };
  assert.ok(validateAssemblySpec(badProvenSpark, { rootDir: repoRoot }).some((f) => f.rule === 'proven-creative-spark-forbidden'));

  // builderAgent multi-line or non-string
  const badAgent1 = { ...spec, builderAgent: 'Agent\nWithNewline' };
  assert.ok(validateAssemblySpec(badAgent1, { rootDir: repoRoot }).some((f) => f.rule === 'builder-agent-invalid'));
  const badAgent2 = { ...spec, builderAgent: 12345 };
  assert.ok(validateAssemblySpec(badAgent2, { rootDir: repoRoot }).some((f) => f.rule === 'builder-agent-invalid'));

  // projectName invalid type or blank string supplied
  const badProject = { ...spec, projectName: '   ' };
  assert.ok(validateAssemblySpec(badProject, { rootDir: repoRoot }).some((f) => f.rule === 'project-name-invalid'));

  // coreInteractionSentence invalid type or blank string supplied
  const badSentence = { ...spec, coreInteractionSentence: '   ' };
  assert.ok(validateAssemblySpec(badSentence, { rootDir: repoRoot }).some((f) => f.rule === 'core-interaction-sentence-invalid'));

  // extraSectionMarkdown non-plain object
  const badExtra = { ...spec, extraSectionMarkdown: ['weather'] };
  assert.ok(validateAssemblySpec(badExtra, { rootDir: repoRoot }).some((f) => f.rule === 'extra-section-markdown-invalid'));
});

test('structural coherence errors are non-overridable and null palette does not throw TypeError', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  spec.coherenceConfig = {
    paradigm: 'photoreal',
    materialBehaviours: 'Some behaviours',
    palette: null,
  };
  spec.coherenceOverrides = [{ rule: 'palette-required', reason: 'Attempting to override structural error' }];

  const findings = validateAssemblySpec(spec, { rootDir: repoRoot });
  assert.ok(findings.some((f) => f.rule === 'palette-required'));

  assert.throws(() => {
    assembleBrief(spec, { rootDir: repoRoot });
  }, (err) => {
    return Array.isArray(err.findings) && err.findings.some((f) => f.rule === 'palette-required');
  });

  // Non-zero-asset strategy
  spec.coherenceConfig = {
    paradigm: 'photoreal',
    assetStrategy: 'cdn-assets',
    materialBehaviours: 'Some behaviours',
    palette: [
      { role: 'lit-snow', hex: '#f0f4f8', area: 'large' },
    ],
  };
  assert.ok(validateAssemblySpec(spec, { rootDir: repoRoot }).some((f) => f.rule === 'coherence-asset-strategy-invalid'));
});

test('valid warning-only assembly succeeds and records warnings in Assembly Decisions', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  // Experimental mode permits custom coherenceConfig palette
  spec.selection.creativeMode = 'experimental';
  spec.selection.path = 'base-showcase';
  spec.selection.changedAxes = [];
  spec.projectName = 'WARN-TEST';
  spec.coreInteractionSentence = 'carve a trail across a drift field';

  spec.coherenceConfig = {
    paradigm: 'photoreal',
    assetStrategy: 'zero-asset',
    materialBehaviours: 'Multi-scale procedural normals at 8 m / 0.8 m / 0.08 m with triplanar blending above 35 deg slope.',
    palette: [
      { role: 'lit-snow', hex: '#f0f4f8', area: 'large' },
      { role: 'sky-band', hex: '#a8c8e4', area: 'large' },
      { role: 'shadow-snow', hex: '#7d9dc0', area: 'large' },
      { role: 'granite-outcrop', hex: '#4a4744', area: 'medium' },
      { role: 'crevasse-ice', hex: '#10222e', area: 'medium' },
      { role: 'accent-laser', hex: '#ff0000', area: 'accent' },
      { role: 'accent-flare', hex: '#00ff00', area: 'accent' },
      { role: 'accent-spark', hex: '#0000ff', area: 'accent' },
      { role: 'accent-glow', hex: '#ffff00', area: 'accent' },
    ],
  };

  const findings = validateAssemblySpec(spec, { rootDir: repoRoot });
  const accentCapFinding = findings.find((f) => f.rule === 'accent-cap');
  assert.ok(accentCapFinding, 'validateAssemblySpec findings must include accent-cap warning');
  assert.equal(accentCapFinding.severity, 'warn');
  assert.ok(accentCapFinding.message.includes('Emissive should stay under'));
  assert.ok(accentCapFinding.fix.includes('Demote some accents'));

  const { brief, warnings } = assembleBrief(spec, { rootDir: repoRoot });
  assert.ok(brief);
  const accentCapWarning = warnings.find((w) => w.rule === 'accent-cap');
  assert.ok(accentCapWarning, 'warnings returned by assembleBrief must include accent-cap warning');
  assert.equal(accentCapWarning.severity, 'warn');
  assert.ok(accentCapWarning.message.includes('Emissive should stay under'));
  assert.ok(accentCapWarning.fix.includes('Demote some accents'));

  assert.ok(brief.includes('## Assembly Decisions'));
  assert.ok(brief.includes('- **Coherence Validation:** clean (1 warning(s))'));
  assert.ok(brief.includes('### Coherence Warnings'));
  assert.ok(brief.includes(`- **accent-cap:** ${accentCapFinding.message} (Fix: ${accentCapFinding.fix})`));
});

test('Assembly Decisions records complete state-channel mapping keys, channels, and effects', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const { brief } = assembleBrief(spec, { rootDir: repoRoot });

  assert.ok(brief.includes('depression → R (depression depth in metres, 0 -> 0.45): carve groove lowers snow depression depth'));
  assert.ok(brief.includes('displaced-mass → G (displaced mass, berm height 0 -> 0.25 m): carve berms raise displaced snow mass'));
  assert.ok(brief.includes('wetness-or-compaction → B (wetness 0 -> 1): groove writes wetness, interpreted as compressed sheen'));
});

test('all eight core-section subsets assemble successfully and pass validateBrief', () => {
  const allCoreSections = ['vegetation', 'state-buffer', 'audio'];
  const subsets = [
    [],
    ['vegetation'],
    ['state-buffer'],
    ['audio'],
    ['vegetation', 'state-buffer'],
    ['vegetation', 'audio'],
    ['state-buffer', 'audio'],
    ['vegetation', 'state-buffer', 'audio'],
  ];

  for (const sub of subsets) {
    const isSlice = sub.length === 0;
    const spec = {
      selection: {
        creativeMode: 'experimental',
        path: 'fully-custom',
        baseShowcase: null,
        changedAxes: [],
        ambition: isSlice ? 'slice' : 'showcase',
        biome: 'Alpine Snow',
        archetype: 'Traveller Coat',
        mechanic: 'Surf / Carve',
        camera: 'Third Person',
        renderingProfile: 'babylon-webgpu',
        includedSections: sub,
        extraSections: [],
        cameraAdjustments: [],
        stateChannelContract: sub.includes('state-buffer') ? {
          depression: { channel: 'R', effect: 'carve groove lowers snow depression depth' },
          'displaced-mass': { channel: 'G', effect: 'carve berms raise displaced snow mass' },
          'wetness-or-compaction': { channel: 'B', effect: 'groove writes wetness, interpreted as compressed sheen' },
        } : {},
        signatureMoment: {
          enabled: true,
          text: `Subset test for [${sub.join(', ')}]`,
          reusedSystem: 'particles',
          verificationPose: 'mechanic',
        },
        noveltyBudget: {
          addsEngine: false,
          addsAssetCategory: false,
          addsPersistentBuffer: false,
          addsMajorRenderPass: false,
          addsSimulationSubsystem: false,
          addsInput: false,
          increasesAmbition: false,
        },
      },
      projectName: `SUBSET-${sub.length === 0 ? 'EMPTY' : sub.join('-').toUpperCase()}`,
      coreInteractionSentence: 'carve a trail across a drift field',
      creativeSpark: 'surprise me',
      builderAgent: 'Claude Code',
    };

    const { brief } = assembleBrief(spec, { rootDir: repoRoot });
    assert.ok(brief);

    // Verify section bodies
    assert.equal(brief.includes('### 2.3 Wind Field & Terrain State Buffer'), sub.includes('state-buffer'));
    assert.equal(brief.includes('### 2.4 Vegetation & Foliage Systems'), sub.includes('vegetation'));
    assert.equal(brief.includes('### 2.8 Audio Engine & Atmospheric Life'), sub.includes('audio'));

    // Verify no section markers left behind
    assert.equal(/<!--\/?SECTION:?[a-z0-9-]*-->/.test(brief), false, `Brief for [${sub.join(', ')}] contains section markers`);

    // Verify validateBrief
    const val = validateBrief(brief);
    assert.equal(val.ok, true, `Brief for subset [${sub.join(', ')}] failed validateBrief: ${val.problems.join(' | ')}`);
  }
});

test('extra sections are emitted once and in canonical order regardless of input array order', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'experimental-fully-custom.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  // Supply out-of-order extraSections array
  spec.selection.extraSections = ['destructibility', 'architecture', 'weather', 'water-bodies'];
  const { brief } = assembleBrief(spec, { rootDir: repoRoot });

  const weatherIdx = brief.indexOf('### 2.9 Weather');
  const waterIdx = brief.indexOf('### 2.10 Water Bodies');
  const archIdx = brief.indexOf('### 2.11 Architecture');
  const destIdx = brief.indexOf('### 2.12 Destructibility');

  assert.ok(weatherIdx !== -1 && waterIdx !== -1 && archIdx !== -1 && destIdx !== -1);
  assert.ok(weatherIdx < waterIdx && waterIdx < archIdx && archIdx < destIdx, 'Extra sections must be in canonical order');
});

test('omitted state-buffer and audio semantics across all five mechanics', () => {
  const mechanics = Object.keys(MECHANIC_WRITES);
  for (const mech of mechanics) {
    const projName = `OMIT-${mech.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase()}`;
    const spec = {
      selection: {
        creativeMode: 'experimental',
        path: 'fully-custom',
        baseShowcase: null,
        changedAxes: [],
        ambition: 'slice',
        biome: 'Alpine Snow',
        archetype: 'Traveller Coat',
        mechanic: mech,
        camera: 'Third Person',
        renderingProfile: 'babylon-webgpu',
        includedSections: [],
        extraSections: [],
        cameraAdjustments: [],
        stateChannelContract: {},
        signatureMoment: {
          enabled: true,
          text: `Omitting test for mechanic ${mech}`,
          reusedSystem: 'particles',
          verificationPose: 'mechanic',
        },
        noveltyBudget: {
          addsEngine: false,
          addsAssetCategory: false,
          addsPersistentBuffer: false,
          addsMajorRenderPass: false,
          addsSimulationSubsystem: false,
          addsInput: false,
          increasesAmbition: false,
        },
      },
      projectName: projName,
      coreInteractionSentence: 'interact with surface elements',
      creativeSpark: 'surprise me',
      builderAgent: 'Claude Code',
    };

    const { brief } = assembleBrief(spec, { rootDir: repoRoot });
    assert.equal(brief.includes('**Writes:**'), false, `Mechanic ${mech} should not have **Writes:** when state-buffer omitted`);
    assert.equal(brief.includes('A completed run stays visible from across the field.'), false);
    assert.equal(brief.includes('so the sweep path stays legible for roughly 50 s.'), false);
    assert.equal(brief.includes('both of which write into the shared buffers'), false);
    assert.equal(brief.includes('its track lingering.'), false);
    assert.equal(brief.includes('stateBuffer.addSplat(...) is a disabled/no-op integration hook'), true);
    assert.equal(brief.includes('audio.footfall(...) is a disabled/no-op integration hook'), true);

    const val = validateBrief(brief);
    assert.equal(val.ok, true, `Brief for mechanic ${mech} slice failed validateBrief: ${val.problems.join(' | ')}`);
  }
});

test('markdown quality checks: TERRAIN_NOISE_LAYERS is a list after blank line and no double dots', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const { brief } = assembleBrief(spec, { rootDir: repoRoot });

  assert.ok(brief.includes('Height comes from layered procedural noise composited on the GPU:\n\n- **Drift forms**'));

  // Ensure no "inside it.." or "end.." double dots while preserving ranges like "0..1"
  const doubleDotMatches = brief.match(/([a-zA-Z]{2,}\.\.)/g);
  assert.equal(doubleDotMatches, null, `Found double dots in prose: ${JSON.stringify(doubleDotMatches)}`);
});

test('writeBundle preflight: missing verifier source leaves destination untouched', () => {
  const tmpRoot = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpRoot, 'references'), { recursive: true });
    for (const f of ['biomes.md', 'archetypes.md', 'mechanics.md', 'cameras.md', 'showcases.md', 'character-recipe.md']) {
      fs.copyFileSync(path.join(repoRoot, 'references', f), path.join(tmpRoot, 'references', f));
    }
    fs.copyFileSync(path.join(repoRoot, 'TEMPLATE.md'), path.join(tmpRoot, 'TEMPLATE.md'));
    fs.copyFileSync(path.join(repoRoot, 'selection.mjs'), path.join(tmpRoot, 'selection.mjs'));
    fs.copyFileSync(path.join(repoRoot, 'check.mjs'), path.join(tmpRoot, 'check.mjs'));
    fs.copyFileSync(path.join(repoRoot, 'reference-loader.mjs'), path.join(tmpRoot, 'reference-loader.mjs'));

    // Create incomplete verify directory (missing gates.mjs)
    fs.mkdirSync(path.join(tmpRoot, 'verify'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'verify', 'README.md'), 'dummy', 'utf8');

    const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

    const outTargetDir = path.join(tmpRoot, 'output-bundle');
    fs.mkdirSync(outTargetDir, { recursive: true });
    const sentinelFile = path.join(outTargetDir, 'SENTINEL.txt');
    fs.writeFileSync(sentinelFile, 'EXISTING_SENTINEL', 'utf8');

    assert.throws(() => {
      writeBundle(spec, outTargetDir, { rootDir: tmpRoot, force: true });
    }, /Missing or unreadable verifier source file/);

    assert.equal(fs.existsSync(sentinelFile), true, 'Existing output directory contents must remain untouched');
    assert.equal(fs.readdirSync(outTargetDir).length, 1, 'No new files should be written when preflight fails');
  } finally {
    removeTempDir(tmpRoot);
  }
});

test('writeBundle collision matrix covering all five target paths and unrelated sentinel file', () => {
  const tmpDir = makeTempDir();
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  try {
    // 1. Initial write
    writeBundle(spec, tmpDir, { rootDir: repoRoot });

    // Add an unrelated sentinel file
    const sentinelPath = path.join(tmpDir, 'SENTINEL.txt');
    fs.writeFileSync(sentinelPath, 'PRESERVED_SENTINEL', 'utf8');

    const targetFilePaths = [
      path.join(tmpDir, 'ALPINE_DAWN_TECHDEMO_PROMPT.md'),
      path.join(tmpDir, 'HANDOFF.md'),
      path.join(tmpDir, 'verify', 'README.md'),
      path.join(tmpDir, 'verify', 'gates.mjs'),
      path.join(tmpDir, 'verify', 'verify_demo.mjs'),
    ];

    // 2. Collision refusal without --force for each target file
    for (const tf of targetFilePaths) {
      assert.ok(fs.existsSync(tf));
      assert.throws(() => {
        writeBundle(spec, tmpDir, { rootDir: repoRoot, force: false });
      }, (err) => err.code === 'EEXIST');
    }

    // 3. Overwrite with --force preserves unrelated sentinel file
    fs.writeFileSync(targetFilePaths[0], 'MODIFIED', 'utf8');
    writeBundle(spec, tmpDir, { rootDir: repoRoot, force: true });

    assert.equal(fs.readFileSync(sentinelPath, 'utf8'), 'PRESERVED_SENTINEL');
    assert.ok(fs.readFileSync(targetFilePaths[0], 'utf8').includes('# ALPINE-DAWN'));

    // 4. Directory collision refusal even with --force
    const dirCollisionPath = path.join(tmpDir, 'DIRECTORY_COLLISION_TECHDEMO_PROMPT.md');
    fs.mkdirSync(dirCollisionPath, { recursive: true });

    const dirSpec = JSON.parse(JSON.stringify(spec));
    dirSpec.projectName = 'DIRECTORY-COLLISION';

    assert.throws(() => {
      writeBundle(dirSpec, tmpDir, { rootDir: repoRoot, force: true });
    }, (err) => err.code === 'EISDIR');
  } finally {
    removeTempDir(tmpDir);
  }
});
