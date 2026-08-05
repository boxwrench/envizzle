import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { evaluateGates } from './gates.mjs';
import { createVerificationReport, writeVerificationReport } from './report.mjs';
import { validateProjectMilestoneEvidence } from './evidence.mjs';

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

  const seenFlags = new Set();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      if (seenFlags.has('help')) throw new Error('Duplicate option --help');
      seenFlags.add('help');
      help = true;
    } else if (arg === '--report') {
      if (seenFlags.has('report')) throw new Error('Duplicate option --report');
      seenFlags.add('report');
      if (i + 1 >= args.length || args[i + 1].startsWith('-')) {
        throw new Error('Missing path for --report option');
      }
      reportPath = args[++i];
    } else if (arg === '--screenshots') {
      if (seenFlags.has('screenshots')) throw new Error('Duplicate option --screenshots');
      seenFlags.add('screenshots');
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
    if (args.length > 1) {
      throw new Error('Cannot combine --help with other arguments');
    }
    return { help: true };
  }

  const resolvedTarget = projectDir ? path.resolve(projectDir) : process.cwd();
  const resolvedReport = reportPath
    ? path.resolve(reportPath)
    : path.join(resolvedTarget, 'verify-report.json');
  const resolvedScreenshots = screenshotsDir
    ? path.resolve(screenshotsDir)
    : path.join(resolvedTarget, 'evidence', 'final-polish');

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

function discoverBenchmarkContext(targetDir) {
  let caseJsonPath = path.join(targetDir, 'case.json');
  if (!fs.existsSync(caseJsonPath)) {
    caseJsonPath = path.join(path.dirname(targetDir), 'case.json');
  }
  if (!fs.existsSync(caseJsonPath)) {
    caseJsonPath = path.join(targetDir, '..', 'case.json');
  }

  if (!fs.existsSync(caseJsonPath)) {
    return null;
  }

  let caseMeta;
  try {
    caseMeta = JSON.parse(fs.readFileSync(caseJsonPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse case.json: ${err.message}`);
  }

  if (typeof caseMeta.caseId !== 'string' || typeof caseMeta.briefSha256 !== 'string') {
    throw new Error('case.json missing required caseId or briefSha256');
  }

  // Find prompt files ending in _TECHDEMO_PROMPT.md
  const candidateDirs = [targetDir, path.join(targetDir, 'bundle'), path.dirname(targetDir)];
  const candidatePromptPaths = new Set();

  for (const cd of candidateDirs) {
    if (fs.existsSync(cd) && fs.statSync(cd).isDirectory()) {
      for (const file of fs.readdirSync(cd)) {
        if (file.endsWith('_TECHDEMO_PROMPT.md')) {
          candidatePromptPaths.add(path.join(cd, file));
        }
      }
    }
  }

  const promptFiles = Array.from(candidatePromptPaths);
  if (promptFiles.length === 0) {
    throw new Error(`No techdemo prompt brief file found for benchmark case '${caseMeta.caseId}'`);
  }
  if (promptFiles.length > 1) {
    throw new Error(`Multiple candidate prompt brief files found for benchmark case '${caseMeta.caseId}': [${promptFiles.map((p) => path.basename(p)).join(', ')}]`);
  }

  const promptPath = promptFiles[0];
  const promptBytes = fs.readFileSync(promptPath);
  const actualHash = crypto.createHash('sha256').update(promptBytes).digest('hex');

  if (actualHash !== caseMeta.briefSha256) {
    throw new Error(`Prompt file hash mismatch: prompt file '${path.basename(promptPath)}' hash '${actualHash}' does not match case.json briefSha256 '${caseMeta.briefSha256}'`);
  }

  return {
    caseId: caseMeta.caseId,
    briefSha256: caseMeta.briefSha256,
  };
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
    : path.join(targetDir, 'evidence', 'final-polish');

  const failures = [];
  const logInfo = [];
  const writtenCaptures = [];
  let isOperationalError = false;

  const fail = (m) => {
    failures.push(m);
    if (!options.silent) console.error(`FAIL: ${m}`);
  };
  const pass = (m) => {
    if (!options.silent) console.log(`PASS: ${m}`);
  };

  let benchmarkContext = null;
  try {
    benchmarkContext = discoverBenchmarkContext(targetDir);
  } catch (err) {
    isOperationalError = true;
    fail(`Benchmark discovery error: ${err.message}`);
  }

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

  let buildOk = missingPaths.length === 0 && !isOperationalError;
  let buildError = isOperationalError
    ? failures[0]
    : (missingPaths.length > 0 ? `Missing required paths: ${missingPaths.join(', ')}` : null);

  const isWin = process.platform === 'win32';
  const buildCmd = isWin ? 'cmd.exe' : 'npx';
  const buildArgs = isWin ? ['/d', '/s', '/c', 'npx', 'vite', 'build'] : ['vite', 'build'];

  if (buildOk) {
    try {
      execFileSync(buildCmd, buildArgs, { cwd: targetDir, stdio: 'pipe', shell: false });
      pass('production build compiled with zero errors');
    } catch (err) {
      buildOk = false;
      buildError = `build failed: ${err.stderr?.toString() ?? err.message}`;
      fail(buildError);
    }
  }

  let hookReady = false;
  const runtimeErrors = [];
  let navFailureMessage = null;
  let gateResult = {
    pass: false,
    failures: buildOk ? ['Runtime check failed'] : [buildError || 'Build check failed'],
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
    // Demo-level defects (setPose/setCharacterVisible/camera/frame-stat hooks throwing,
    // or malformed hook return values) are recorded here and never rethrown to the outer
    // catch below — only genuine infrastructure failures (Playwright load, server spawn,
    // server unreachable, browser launch, or the browser/page actually disconnecting)
    // reach the outer catch and set isOperationalError.
    try {
      let playwright;
      try {
        playwright = options.playwright || (await import('playwright'));
      } catch (pwErr) {
        isOperationalError = true;
        throw new Error(`Failed to load Playwright: ${pwErr.message}`);
      }

      const port = 5300 + Math.floor(Math.random() * 600);
      const origin = `http://localhost:${port}`;
      try {
        if (isWin) {
          server = spawn('cmd.exe', ['/d', '/s', '/c', 'npx', 'vite', '--port', String(port), '--strictPort'], {
            cwd: targetDir,
            shell: false,
          });
        } else {
          server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
            cwd: targetDir,
            shell: false,
            detached: true,
          });
        }
      } catch (spawnErr) {
        isOperationalError = true;
        throw new Error(`Failed to spawn dev server: ${spawnErr.message}`);
      }

      try {
        await waitForServer(origin, options.serverReadyTimeoutMs ?? 30000);
      } catch (srvErr) {
        isOperationalError = true;
        throw srvErr;
      }

      try {
        browser = await playwright.chromium.launch({
          headless: true,
          args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'],
        });
      } catch (launchErr) {
        isOperationalError = true;
        throw new Error(`Failed to launch browser: ${launchErr.message}`);
      }

      const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
      page.on('pageerror', (e) => runtimeErrors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') runtimeErrors.push(m.text());
      });

      try {
        await page.goto(origin, { waitUntil: 'networkidle' });
      } catch (navErr) {
        if (!browser.isConnected()) {
          isOperationalError = true;
          throw new Error(`Browser infrastructure disconnected while loading the demo page: ${navErr.message}`);
        }
        // The browser itself is healthy; the demo page failed to load — a demo defect.
        // Recorded separately from `failures` too, since whatever gate result gets
        // computed later (even a fully passing one) must not silently supersede this.
        navFailureMessage = `Failed to load demo page: ${navErr.message}`;
        fail(navFailureMessage);
      }

      try {
        await page.waitForFunction('window.__demo && window.__demo.ready === true', { timeout: 30000 });
        hookReady = true;
        pass('window.__demo hook present and ready');
      } catch (hookErr) {
        if (!browser.isConnected()) {
          isOperationalError = true;
          throw new Error(`Browser infrastructure disconnected while waiting for window.__demo hook readiness: ${hookErr.message}`);
        }
        hookReady = false;
        fail('window.__demo hook missing or never became ready — see the brief\'s verification-hook section. Cannot verify.');
      }

      if (hookReady) {
        const frames = [];
        fs.mkdirSync(shotDir, { recursive: true });

        let captureError = null;
        try {
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
            const shotRelPath = path.relative(targetDir, path.join(shotDir, `milestone_${pose}.png`));
            const normalizedRelPath = shotRelPath.replace(/\\/g, '/');
            const destPath = path.join(targetDir, normalizedRelPath);
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.writeFileSync(destPath, withCharBuf);
            writtenCaptures.push(normalizedRelPath);
          }
        } catch (err) {
          if (!browser.isConnected()) {
            isOperationalError = true;
            throw new Error(`Browser infrastructure disconnected during pose capture: ${err.message}`);
          }
          captureError = err;
          fail(`demo pose/visibility hook failed: ${err.message}`);
        }

        if (runtimeErrors.length === 0) {
          pass('zero console/runtime errors');
        } else {
          fail(`runtime errors: ${runtimeErrors.join(' | ')}`);
        }

        if (captureError || writtenCaptures.length !== 3) {
          gateResult.pass = false;
          gateResult.failures = [
            ...(gateResult.failures || []),
            captureError ? `demo pose/visibility hook failed: ${captureError.message}` : 'Incomplete capture evidence after pose loop',
            ...runtimeErrors,
          ];
        } else {
          let cameraDepthM;
          let frameStats;
          let hookError = null;
          try {
            cameraDepthM = await page.evaluate(() => window.__demo.cameraNearestDepth());
            frameStats = await page.evaluate(() => window.__demo.frameStats());
          } catch (err) {
            if (!browser.isConnected()) {
              isOperationalError = true;
              throw new Error(`Browser infrastructure disconnected during metrics collection: ${err.message}`);
            }
            hookError = err;
            fail(`camera/frame-stat hook failed: ${err.message}`);
          }

          if (hookError) {
            gateResult.pass = false;
            gateResult.failures = [...(gateResult.failures || []), `camera/frame-stat hook failed: ${hookError.message}`, ...runtimeErrors];
          } else {
            gateResult = evaluateGates({ frames, cameraDepthM, frameStats });

            if (runtimeErrors.length > 0) {
              gateResult.pass = false;
              gateResult.failures = [...(gateResult.failures || []), ...runtimeErrors];
            }

            gateResult.info.forEach((i) => {
              logInfo.push(i);
              if (!options.silent) console.log(`INFO: ${i}`);
            });

            if (gateResult.pass) pass('all image gates passed');
            else gateResult.failures.forEach(fail);
          }
        }
      }
    } catch (err) {
      // Only genuine infrastructure failures reach here — see the comment above.
      isOperationalError = true;
      gateResult.pass = false;
      gateResult.failures = [...(gateResult.failures || []), err.message];
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

  // A recorded demo-level failure (e.g. navigation) must never be silently superseded
  // by an otherwise-passing gate result computed later in the flow.
  if (navFailureMessage) {
    gateResult = {
      ...gateResult,
      pass: false,
      failures: [...(gateResult.failures || []), navFailureMessage],
    };
  }

  let evidenceOk = false;
  const evidenceErrors = [];
  try {
    const evVal = validateProjectMilestoneEvidence(targetDir);
    evidenceOk = evVal.ok;
    if (!evVal.ok) {
      for (const err of evVal.errors) {
        evidenceErrors.push(err);
        fail(`milestone evidence failure: ${err}`);
      }
    } else {
      pass('milestone evidence validated cleanly');
    }
  } catch (err) {
    evidenceOk = false;
    const errMsg = `Failed to validate milestone evidence: ${err.message}`;
    evidenceErrors.push(errMsg);
    fail(errMsg);
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;
  const overallPass = buildOk && hookReady && runtimeErrors.length === 0 && gateResult.pass && evidenceOk && !isOperationalError && failures.length === 0;
  const status = isOperationalError ? 'error' : (overallPass ? 'passed' : 'failed');

  const report = createVerificationReport({
    target: targetName,
    startedAt,
    finishedAt,
    durationMs,
    requiredPaths: REQUIRED_PATHS.slice(),
    build: { ok: buildOk, error: buildError },
    runtime: { hookReady, errors: runtimeErrors },
    evidence: { ok: evidenceOk, errors: evidenceErrors },
    captures: writtenCaptures,
    gates: {
      pass: gateResult.pass,
      failures: gateResult.failures || [],
      info: gateResult.info || [],
      metrics: gateResult.metrics || { frames: [], cameraNearestDepthM: null, frameStats: { medianMs: null, p99Ms: null, samples: null } },
    },
    status,
    benchmark: benchmarkContext,
  });

  writeVerificationReport(reportPath, report);

  return {
    pass: overallPass,
    failures,
    info: logInfo,
    report,
    reportPath,
    status,
  };
}

/**
 * Pure exit-code policy for a verifyDemo() result. The CLI below must derive its
 * process.exit() code from this same function, so tests can prove the exit-code
 * policy directly without launching a browser.
 */
export function verificationExitCode(result) {
  if (result.status === 'error') return 2;
  if (result.pass && result.status === 'passed') return 0;
  return 1;
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
      if (result.status === 'error') {
        console.log(`VERIFICATION ERROR — ${result.failures.length} operational failure(s):`);
        result.failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
      } else if (result.pass && result.status === 'passed') {
        console.log('VERIFICATION PASSED');
      } else {
        console.log(`VERIFICATION FAILED — ${result.failures.length} problem(s):`);
        result.failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
        console.log('\nFix these and re-run. Do not proceed with failures outstanding.');
      }
      process.exit(verificationExitCode(result));
    })
    .catch((err) => {
      console.error(`VERIFICATION ERROR: ${err.message}`);
      process.exit(2);
    });
}
