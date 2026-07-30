import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { evaluateGates } from './gates.mjs';

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const failures = [];
const fail = (m) => { failures.push(m); console.error(`FAIL: ${m}`); };
const pass = (m) => console.log(`PASS: ${m}`);

for (const rel of ['index.html', 'package.json', 'vite.config.js', 'DECISIONS.md', 'PERF.md', 'src/main.js']) {
  if (fs.existsSync(path.join(targetDir, rel))) pass(`found ${rel}`);
  else fail(`missing required path: ${rel}`);
}

try {
  execSync('npx vite build', { cwd: targetDir, stdio: 'pipe' });
  pass('production build compiled with zero errors');
} catch (err) {
  fail(`build failed: ${err.stderr?.toString() ?? err.message}`);
}

const toImage = (buf) => {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
};

/** Poll until the dev server answers, or throw after timeoutMs. */
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

async function run() {
  const playwright = await import('playwright');
  const server = spawn('npx', ['vite', '--port', '5173'], { cwd: targetDir, shell: true });

  // Wait for the dev server to actually accept connections. Without this, a
  // slow vite boot yields ERR_CONNECTION_REFUSED, which surfaces as
  // "verification crashed" and reads like a defect in the demo.
  //
  // The kill-on-throw matters more than it looks: this happens BEFORE the
  // try/finally below, so without it a timeout orphans `npx vite` still
  // holding port 5173 — and the NEXT run's readiness poll would succeed
  // against that stale server, verifying nothing. Same vacuous-pass class
  // this whole module exists to eliminate.
  try {
    await waitForServer('http://localhost:5173', 30000);
  } catch (err) {
    server.kill();
    throw err;
  }

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    // Without the hook nothing below is checkable.
    try {
      await page.waitForFunction('window.__demo && window.__demo.ready === true', { timeout: 30000 });
      pass('window.__demo hook present and ready');
    } catch {
      fail('window.__demo hook missing or never became ready — see the brief\'s verification-hook section. Cannot verify.');
      return;
    }

    if (pageErrors.length === 0) pass('zero console/runtime errors');
    else fail(`runtime errors: ${pageErrors.join(' | ')}`);

    const frames = [];
    const shotDir = path.join(targetDir, 'screenshots');
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
    const result = evaluateGates({ frames, cameraDepthM, frameStats });

    result.info.forEach((i) => console.log(`INFO: ${i}`));
    if (result.pass) pass('all image gates passed');
    else result.failures.forEach(fail);
  } finally {
    await browser.close();
    server.kill();
  }
}

run()
  .catch((e) => fail(`verification crashed: ${e.message}`))
  .finally(() => {
    console.log('\n' + '='.repeat(50));
    if (failures.length === 0) {
      console.log('VERIFICATION PASSED');
      process.exit(0);
    }
    console.log(`VERIFICATION FAILED — ${failures.length} problem(s):`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log('\nFix these and re-run. Do not proceed with failures outstanding.');
    process.exit(1);
  });
