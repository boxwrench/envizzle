import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { evaluateGates } from './gates.mjs';
import { createVerificationReport, writeVerificationReport } from './report.mjs';

const REQUIRED_PATHS = Object.freeze([
  'index.html',
  'package.json',
  'vite.config.js',
  'DECISIONS.md',
  'PERF.md',
  'src/main.js',
]);

export function parseVerifyCliArgs(args) {
  let projectDir = null;
  let reportPath = null;
  let screenshotsDir = null;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--report') {
      if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
        throw new Error('Missing path for --report option');
      }
      reportPath = args[++i];
    } else if (arg === '--screenshots') {
      if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
        throw new Error('Missing directory for --screenshots option');
      }
      screenshotsDir = args[++i];
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option '${arg}'`);
    } else {
      if (projectDir !== null) {
        throw new Error(`Unexpected positional argument '${arg}'`);
      }
      projectDir = arg;
    }
  }

  if (help) {
    return { help: true };
  }

  const resolvedTarget = projectDir ? path.resolve(projectDir) : process.cwd();
  const resolvedReport = reportPath
    ? path.resolve(reportPath)
    : path.join(resolvedTarget, 'verify-report.json');
  const resolvedScreenshots = screenshotsDir
    ? path.resolve(screenshotsDir)
    : path.join(resolvedTarget, 'screenshots');

  return {
    help: false,
    projectDir: resolvedTarget,
    reportPath: resolvedReport,
    screenshotsDir: resolvedScreenshots,
  };
}

export function printVerifyHelp() {
  console.log(`Envizzle Demo Verifier

Usage:
  node verify/verify_demo.mjs [project-directory] [options]

Options:
  --report <report.json>       Path to write machine-readable verification report (default: <project-directory>/verify-report.json)
  --screenshots <directory>   Directory to save captured PNG screenshots (default: <project-directory>/screenshots/)
  --help, -h                  Show this help menu

Exit codes:
  0  Verification passed
  1  Verification failed
  2  Usage or operational error
`);
}

function toImage(buf) {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
}

function killTree(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    // Already dead
  }
  try {
    child.kill();
  } catch {
    // Already killed
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { method: 'GET' });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(
    `dev server at ${url} never accepted a connection within ${timeoutMs} ms (last error: ${lastErr?.message}). The demo's vite setup may be broken.`,
  );
}

export async function verifyDemo(projectDir, options = {}) {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const targetDir = path.resolve(projectDir);
  const targetName = path.basename(targetDir);
  const reportPath = options.reportPath
    ? path.resolve(options.reportPath)
    : path.join(targetDir, 'verify-report.json');
  const shotDir = options.screenshotsDir
    ? path.resolve(options.screenshotsDir)
    : path.join(targetDir, 'screenshots');

  const failures = [];
  const logInfo = [];
  const fail = (m) => {
    failures.push(m);
    if (!options.silent) console.error(`FAIL: ${m}`);
  };
  const pass = (m) => {
    if (!options.silent) console.log(`PASS: ${m}`);
  };

  // Check required paths
  const missingPaths = [];
  for (const rel of REQUIRED_PATHS) {
    if (fs.existsSync(path.join(targetDir, rel))) {
      pass(`found ${rel}`);
    } else {
      missingPaths.push(rel);
      fail(`missing required path: ${rel}`);
    }
  }

  let buildOk = missingPaths.length === 0;
  let buildError = missingPaths.length > 0 ? `Missing required paths: ${missingPaths.join(', ')}` : null;

  if (buildOk) {
    try {
      execSync('npx vite build', { cwd: targetDir, stdio: 'pipe' });
      pass('production build compiled with zero errors');
    } catch (err) {
      buildOk = false;
      buildError = `build failed: ${err.stderr?.toString() ?? err.message}`;
      fail(buildError);
    }
  }

  let hookReady = false;
  const runtimeErrors = [];
  let gateResult = {
    pass: false,
    failures: buildOk ? ['Runtime check failed'] : [buildError],
    info: [],
    metrics: {
      frames: [],
      cameraNearestDepthM: null,
      frameStats: { medianMs: null, p99Ms: null, samples: null },
    },
  };

  if (buildOk && !options.skipBrowser) {
    let server = null;
    let browser = null;
    try {
      const playwright = options.playwright || (await import('playwright'));

      const port = 5300 + Math.floor(Math.random() * 600);
      const origin = `http://localhost:${port}`;
      server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
        cwd: targetDir,
        shell: true,
        detached: process.platform !== 'win32',
      });

      await waitForServer(origin, 30000);

      browser = await playwright.chromium.launch({
        headless: true,
        args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'],
      });

      const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
      page.on('pageerror', (e) => runtimeErrors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') runtimeErrors.push(m.text());
      });

      await page.goto(origin, { waitUntil: 'networkidle' });

      try {
        await page.waitForFunction('window.__demo && window.__demo.ready === true', { timeout: 30000 });
        hookReady = true;
        pass('window.__demo hook present and ready');
      } catch {
        hookReady = false;
        fail('window.__demo hook missing or never became ready — see the brief\'s verification-hook section. Cannot verify.');
      }

      if (hookReady) {
        if (runtimeErrors.length === 0) pass('zero console/runtime errors');
        else fail(`runtime errors: ${runtimeErrors.join(' | ')}`);

        const frames = [];
        fs.mkdirSync(shotDir, { recursive: true });

        for (const pose of ['idle', 'locomotion', 'mechanic']) {
          await page.evaluate((p) => window.__demo.setPose(p), pose);
          await page.waitForTimeout(1200);

          const withCharBuf = await page.screenshot();
          await page.evaluate(() => window.__demo.setCharacterVisible(false));
          await page.waitForTimeout(300);
          const withoutCharBuf = await page.screenshot();
          await page.evaluate(() => window.__demo.setCharacterVisible(true));

          frames.push({
            name: pose,
            image: toImage(withCharBuf),
            imageWithoutCharacter: toImage(withoutCharBuf),
          });
          fs.writeFileSync(path.join(shotDir, `milestone_${pose}.png`), withCharBuf);
        }

        const cameraDepthM = await page.evaluate(() => window.__demo.cameraNearestDepth());
        const frameStats = await page.evaluate(() => window.__demo.frameStats());
        gateResult = evaluateGates({ frames, cameraDepthM, frameStats });

        gateResult.info.forEach((i) => {
          logInfo.push(i);
          if (!options.silent) console.log(`INFO: ${i}`);
        });

        if (gateResult.pass) pass('all image gates passed');
        else gateResult.failures.forEach(fail);
      }
    } catch (err) {
      fail(`verification crashed: ${err.message}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (_) {}
      }
      if (server) {
        killTree(server);
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;
  const overallPass = buildOk && hookReady && runtimeErrors.length === 0 && gateResult.pass;

  const report = createVerificationReport({
    target: targetName,
    startedAt,
    finishedAt,
    durationMs,
    requiredPaths: REQUIRED_PATHS.slice(),
    build: { ok: buildOk, error: buildError },
    runtime: { hookReady, errors: runtimeErrors },
    captures: ['milestone_idle.png', 'milestone_locomotion.png', 'milestone_mechanic.png'],
    gates: {
      pass: gateResult.pass,
      failures: gateResult.failures || [],
      info: gateResult.info || [],
      metrics: gateResult.metrics || { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: null, p99Ms: null, samples: null } },
    },
    status: overallPass ? 'passed' : 'failed',
  });

  writeVerificationReport(reportPath, report);

  return {
    pass: overallPass,
    failures,
    info: logInfo,
    report,
    reportPath,
  };
}

// Executable entry point when invoked via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let parsed;
  try {
    parsed = parseVerifyCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    printVerifyHelp();
    process.exit(2);
  }

  if (parsed.help) {
    printVerifyHelp();
    process.exit(0);
  }

  if (!fs.existsSync(parsed.projectDir)) {
    console.error(`ERROR: Project directory '${parsed.projectDir}' does not exist.`);
    process.exit(2);
  }

  verifyDemo(parsed.projectDir, {
    reportPath: parsed.reportPath,
    screenshotsDir: parsed.screenshotsDir,
  })
    .then((result) => {
      console.log('\n' + '='.repeat(50));
      if (result.pass) {
        console.log('VERIFICATION PASSED');
        process.exit(0);
      } else {
        console.log(`VERIFICATION FAILED — ${result.failures.length} problem(s):`);
        result.failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
        console.log('\nFix these and re-run. Do not proceed with failures outstanding.');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(`VERIFICATION ERROR: ${err.message}`);
      process.exit(2);
    });
}
