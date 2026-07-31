import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateAssemblySpec, assembleBrief, writeBundle } from '../assemble.mjs';
import { validateBrief } from '../check.mjs';
import { SHOWCASES } from '../selection.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const extraSectionBodies = {
  weather: 'Dynamic wind gusts alter rain shear and grass wave speed.',
  'water-bodies': 'A carved river spline with 3-step quantised painterly specular.',
  architecture: 'A stone viaduct with 9 arches spanning 14 m each.',
  destructibility: 'Impacts dislodge stone fragments from ancient ruins along the bank.',
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

test('slice/showcase/everything section matrices are exact', () => {
  // Slice (Dune Sea)
  const sliceSpecPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'proven-dune.json');
  const sliceSpec = JSON.parse(fs.readFileSync(sliceSpecPath, 'utf8'));
  const sliceRes = assembleBrief(sliceSpec, { rootDir: repoRoot });

  assert.equal(sliceRes.brief.includes('### 2.3 Wind Field & Terrain State Buffer'), false);
  assert.equal(sliceRes.brief.includes('### 2.4 Vegetation & Foliage Systems'), false);
  assert.equal(sliceRes.brief.includes('### 2.8 Audio Engine & Atmospheric Life'), false);

  // Showcase (Alpine Dawn)
  const sigSpecPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const sigSpec = JSON.parse(fs.readFileSync(sigSpecPath, 'utf8'));
  const sigRes = assembleBrief(sigSpec, { rootDir: repoRoot });

  assert.equal(sigRes.brief.includes('### 2.3 Wind Field & Terrain State Buffer'), true);
  assert.equal(sigRes.brief.includes('### 2.4 Vegetation & Foliage Systems'), true);
  assert.equal(sigRes.brief.includes('### 2.8 Audio Engine & Atmospheric Life'), true);
  assert.equal(sigRes.brief.includes('### 2.9 Weather'), false);

  // Everything (Custom Ghibli)
  const customSpecPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'experimental-fully-custom.json');
  const customSpec = JSON.parse(fs.readFileSync(customSpecPath, 'utf8'));
  const customRes = assembleBrief(customSpec, { rootDir: repoRoot });

  assert.equal(customRes.brief.includes('### 2.9 Weather'), true);
  assert.equal(customRes.brief.includes('### 2.10 Water Bodies'), true);
  assert.equal(customRes.brief.includes('### 2.11 Architecture'), true);
  assert.equal(customRes.brief.includes('### 2.12 Destructibility'), true);
});

test('Dune Sea removes state-buffer prose and persistent Writes promises', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'proven-dune.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const { brief } = assembleBrief(spec, { rootDir: repoRoot });

  assert.equal(brief.includes('**Writes:**'), false);
  assert.equal(brief.includes('A completed run stays visible from across the field.'), false);
  assert.equal(brief.includes('STATE_CHANNEL_CONTRACT'), false);
});

test('Alpine Dawn contains the exact three formatted channel lines', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const { brief } = assembleBrief(spec, { rootDir: repoRoot });

  assert.equal(brief.includes('* **`depression`** → **`R`** (depression depth in metres, 0 -> 0.45): carve groove lowers snow depression depth'), true);
  assert.equal(brief.includes('* **`displaced-mass`** → **`G`** (displaced mass, berm height 0 -> 0.25 m): carve berms raise displaced snow mass'), true);
  assert.equal(brief.includes('* **`wetness-or-compaction`** → **`B`** (wetness 0 -> 1): groove writes wetness, interpreted as compressed sheen'), true);
});

test('all four camera modes replace the third-person baseline correctly', () => {
  const cameras = ['Third Person', 'First Person', 'Cinematic', 'XR'];
  for (const cam of cameras) {
    const spec = {
      selection: {
        creativeMode: 'experimental',
        path: 'base-showcase',
        baseShowcase: 'Alpine Dawn',
        changedAxes: cam === 'Third Person' ? [] : ['camera'],
        ambition: 'showcase',
        biome: 'Alpine Snow',
        archetype: 'Traveller Coat',
        mechanic: 'Surf / Carve',
        camera: cam,
        renderingProfile: 'babylon-webgpu',
        includedSections: ['vegetation', 'state-buffer', 'audio'],
        extraSections: [],
        cameraAdjustments: cam === 'Third Person' ? [] : (cam === 'First Person' ? ['hand-rings-12', 'cloth-plus-one', 'hide-head-neck-only', 'verification-framing'] : (cam === 'Cinematic' ? ['verification-framing'] : ['body-rings-20-24', 'hands-feet-rings-10-12', 'stereo-target', 'double-character-budget', 'verification-framing', 'no-dof-motion-blur'])),
        stateChannelContract: {
          depression: { channel: 'R', effect: 'carve groove lowers snow depression depth' },
          'displaced-mass': { channel: 'G', effect: 'carve berms raise displaced snow mass' },
          'wetness-or-compaction': { channel: 'B', effect: 'groove writes wetness, interpreted as compressed sheen' },
        },
        signatureMoment: {
          enabled: true,
          text: 'Camera effect test',
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
      projectName: `TEST-CAM-${cam.replace(/\s+/g, '-').toUpperCase()}`,
      coreInteractionSentence: 'carve a trail across a drift field, watch the wake break behind them',
      creativeSpark: 'surprise me',
      builderAgent: 'Claude Code',
    };

    const { brief } = assembleBrief(spec, { rootDir: repoRoot });
    assert.equal(brief.includes('**Initial Spawn Rule:**'), true);
    if (cam !== 'Third Person') {
      assert.equal(brief.includes('The window.__demo.setPose() hook must put the scene into a flat-screen, third-person verification framing'), true);
    }
  }
});

test('XR hardware and verification framing are present', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  spec.selection.camera = 'XR';
  spec.selection.creativeMode = 'experimental';
  spec.selection.path = 'base-showcase';
  spec.selection.changedAxes = ['camera'];
  spec.selection.cameraAdjustments = [
    'body-rings-20-24',
    'hands-feet-rings-10-12',
    'stereo-target',
    'double-character-budget',
    'verification-framing',
    'no-dof-motion-blur',
  ];
  spec.projectName = 'XR-ALPINE';
  spec.coreInteractionSentence = 'carve a trail in XR';

  const { brief } = assembleBrief(spec, { rootDir: repoRoot });
  assert.equal(brief.includes('Chrome stable on Windows 11 with a PC-tethered headset, 90 Hz per eye, RTX-class GPU'), true);
  assert.equal(brief.includes('Budget the character at roughly double the third-person cost'), true);
  assert.equal(brief.includes('The window.__demo.setPose() hook must put the scene into a flat-screen, third-person verification framing'), true);
});

test('character recipe is inlined fully and contains selected archetype and foot interaction', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const { brief } = assembleBrief(spec, { rootDir: repoRoot });

  assert.equal(brief.includes('## Part 1 — Skeleton'), true);
  assert.equal(brief.includes('## Part 6 — Prohibitions'), true);
  assert.equal(brief.includes('### Archetype — Traveller Coat'), true);
  assert.equal(brief.includes('### Foot interaction — Snow'), true);
  assert.equal(brief.includes('These effects fire from the single touchdown call site in Part 5, reading plantedPos[leg], and from nowhere else.'), true);
});

test('approved palette table contains every effective palette entry', () => {
  const specPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'signature-alpine.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const { brief } = assembleBrief(spec, { rootDir: repoRoot });

  assert.equal(brief.includes('**Approved Palette:**'), true);
  assert.equal(brief.includes('| lit-snow | `#f0f4f8` | large |'), true);
  assert.equal(brief.includes('| sky-band | `#a8c8e4` | large |'), true);
});

test('invalid spec fails with structured findings', () => {
  const invalidSpecPath = path.join(repoRoot, 'tests', 'fixtures', 'assemblies', 'invalid.json');
  const invalidSpec = JSON.parse(fs.readFileSync(invalidSpecPath, 'utf8'));

  const findings = validateAssemblySpec(invalidSpec, { rootDir: repoRoot });
  assert.ok(findings.some((f) => f.rule === 'project-name-required'));
  assert.ok(findings.some((f) => f.rule === 'core-interaction-sentence-required'));

  assert.throws(() => {
    assembleBrief(invalidSpec, { rootDir: repoRoot });
  }, (err) => {
    return Array.isArray(err.findings) && err.findings.length > 0;
  });
});
