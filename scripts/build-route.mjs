#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';

const args = process.argv.slice(2);
const project = args[0] && !args[0].startsWith('--') ? args[0] : undefined;
if (!project) {
  console.error('Usage: node scripts/build-route.mjs <project> [--mode fast|rigorous] [--delivery-dir <dir>]');
  process.exit(2);
}

const optionValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const intakePath = path.join(project, 'intake_profile.json');
let intake = null;
if (fs.existsSync(intakePath)) {
  try {
    intake = JSON.parse(fs.readFileSync(intakePath, 'utf8'));
  } catch (error) {
    console.error(`Build mode cannot be read from intake_profile.json: ${error.message}`);
    process.exit(1);
  }
}

const mode = optionValue('--mode') ?? intake?.generation_mode ?? 'fast';
if (!['fast', 'rigorous'].includes(mode)) {
  console.error(`Unsupported build mode: ${mode}. Use fast or rigorous.`);
  process.exit(2);
}
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  ['validate-spec', 'validate-spec.mjs'],
  ['validate-logic', 'validate-logic.mjs'],
  ['lock-spec', 'lock-spec.mjs'],
  ['render', 'render-html.mjs'],
  ['export-png', 'export-image.mjs'],
  ['visual-qa', 'visual-qa.mjs']
];
const timings = [];

for (const [label, script] of steps) {
  const started = performance.now();
  const result = spawnSync(
    process.execPath,
    [path.join(scriptsDir, script), project],
    {
      stdio: 'inherit',
      env: {...process.env, RRM_BUILD_MODE: mode}
    }
  );
  const elapsed = Math.round(performance.now() - started);
  timings.push({step: label, elapsed_ms: elapsed});
  if (result.error) {
    console.error(`Build failed in ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Build failed in ${label} with exit code ${result.status ?? 'unknown'}.`);
    process.exit(result.status ?? 1);
  }
}

const deliveryDir = optionValue('--delivery-dir');
const outputs = ['route-map.html', 'route-map.svg', 'route-map.png'];
if (deliveryDir) {
  fs.mkdirSync(deliveryDir, {recursive: true});
  for (const file of outputs) {
    const source = path.join(project, file);
    if (!fs.existsSync(source)) {
      console.error(`Delivery copy failed: ${file} is missing after build.`);
      process.exit(1);
    }
    fs.copyFileSync(source, path.join(deliveryDir, file));
  }
}

console.log(JSON.stringify({
  build_mode: mode,
  internal_files_retained: true,
  delivery_outputs: outputs,
  delivery_dir: deliveryDir ?? null,
  timings_ms: timings
}, null, 2));
