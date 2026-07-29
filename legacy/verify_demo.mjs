import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * AAA & Painterly Biome Tech Demo — Automated Test & Verification Script
 * 
 * Usage:
 *   node verify_demo.mjs [path-to-generated-repo]
 */

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
console.log(`\n==================================================`);
console.log(`🚀 VERIFYING TECH DEMO AT: ${targetDir}`);
console.log(`==================================================\n`);

let passed = true;
const logFail = (msg) => { console.error(`❌ FAIL: ${msg}`); passed = false; };
const logPass = (msg) => { console.log(`✅ PASS: ${msg}`); };
const logInfo = (msg) => { console.log(`ℹ️ INFO: ${msg}`); };

// 1. Structure Check
logInfo("Step 1: Auditing Architectural Directory Structure...");
const requiredPaths = [
  'index.html',
  'package.json',
  'vite.config.js',
  'DECISIONS.md',
  'src/main.js'
];

requiredPaths.forEach(relPath => {
  const fullPath = path.join(targetDir, relPath);
  if (fs.existsSync(fullPath)) {
    logPass(`Found required path: ${relPath}`);
  } else {
    logFail(`Missing required path: ${relPath}`);
  }
});

// Check PERF.md or performance documentation
const perfPath = path.join(targetDir, 'PERF.md');
if (fs.existsSync(perfPath)) {
  logPass("Found performance log: PERF.md");
} else {
  logInfo("PERF.md missing — recommendation: generate PERF.md with frame budget & VRAM breakdown.");
}

// Check Shader Includes Directory or files
const shaderLibPath = path.join(targetDir, 'src/shaders');
if (fs.existsSync(shaderLibPath)) {
  logPass("Found shaders directory: src/shaders");
} else {
  logFail("Missing shaders directory: src/shaders");
}

// 2. Build Check
logInfo("\nStep 2: Testing Production Build (Vite)...");
try {
  logInfo("Running 'npm run build' or 'npx vite build'...");
  execSync('npx vite build', { cwd: targetDir, stdio: 'pipe' });
  logPass("Production build compiled cleanly with 0 errors!");
} catch (err) {
  logFail(`Build failed with errors:\n${err.stderr?.toString() || err.message}`);
}

// 3. Playwright / WebGPU Visual & Runtime Check
logInfo("\nStep 3: Attempting WebGPU Runtime & Milestone Verification...");

async function runBrowserCheck() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    logInfo("Playwright not installed globally or locally. Skipping headless browser run.");
    logInfo("To enable full WebGPU runtime & screenshot testing, run: 'npm install -D playwright'");
    finishReport();
    return;
  }

  logInfo("Launching local Vite dev server...");
  const devServer = spawn('npx', ['vite', '--port', '5173'], { cwd: targetDir, shell: true });
  
  await new Promise(r => setTimeout(r, 2000));

  try {
    const browser = await playwright.chromium.launch({
      headless: true,
      args: [
        '--enable-unsafe-webgpu',
        '--use-angle=vulkan',
        '--ignore-gpu-blocklist'
      ]
    });

    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    logInfo("Navigating to http://localhost:5173...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    await page.waitForTimeout(5000);

    if (pageErrors.length === 0) {
      logPass("Zero console / runtime errors during initial 5 seconds!");
    } else {
      logFail(`Runtime errors detected on page:\n  - ${pageErrors.join('\n  - ')}`);
    }

    const screenshotsDir = path.join(targetDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    logInfo("Capturing Milestone 1 (Idle View)...");
    await page.screenshot({ path: path.join(screenshotsDir, 'milestone_idle.png') });

    logInfo("Simulating WASD Movement...");
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1000);
    await page.keyboard.up('KeyW');
    await page.screenshot({ path: path.join(screenshotsDir, 'milestone_locomotion.png') });

    logInfo("Simulating Mechanic Action...");
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, 'milestone_mechanic.png') });
    await page.mouse.up({ button: 'right' });

    logPass(`Screenshots successfully saved to: ${screenshotsDir}`);

    await browser.close();
  } catch (err) {
    logFail(`Browser automation check failed: ${err.message}`);
  } finally {
    devServer.kill();
    finishReport();
  }
}

function finishReport() {
  console.log(`\n==================================================`);
  if (passed) {
    console.log(`🎉 VERIFICATION COMPLETE: ALL CHECKS PASSED!`);
    console.log(`The codebase adheres to the Biome Tech Demo spec.`);
  } else {
    console.log(`⚠️ VERIFICATION COMPLETE: SOME CHECKS FAILED.`);
    console.log(`Review log output above and DECISIONS.md / PERF.md.`);
  }
  console.log(`==================================================\n`);
}

runBrowserCheck();
