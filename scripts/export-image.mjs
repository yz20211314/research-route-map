#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readJsonFile, sha256, writeJsonFile} from './lib/route-utils.mjs';

const project = process.argv[2];
if (!project) {
  console.error('Usage: node scripts/export-image.mjs <project>');
  process.exit(2);
}

const htmlPath = path.resolve(project, 'route-map.html');
const svgPath = path.resolve(project, 'route-map.svg');
const pngPath = path.resolve(project, 'route-map.png');
if (!fs.existsSync(htmlPath) || !fs.existsSync(svgPath)) {
  console.error(`Missing route-map.html or route-map.svg in ${path.resolve(project)}. Run render-html.mjs first.`);
  process.exit(1);
}
const layout = readJsonFile(project, 'render-layout.json');
const svg = fs.readFileSync(svgPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const embeddedMatch = html.match(/<svg id="route-map-svg"[\s\S]*?<\/svg>/);
const sourceSvgSha256 = sha256(svg);
if (
  !embeddedMatch
  || embeddedMatch[0] !== svg
  || layout.standalone_svg_sha256 !== sourceSvgSha256
) {
  console.error('SVG export is blocked: route-map.svg, embedded HTML SVG, and render-layout.json are not synchronized.');
  process.exit(1);
}
const target = layout.target_png ?? {
  width: layout.canvas.width * 2,
  height: layout.canvas.height * 2,
  dpi: 300
};

const moduleRoots = (process.env.RRM_NODE_MODULES ?? process.env.NODE_PATH ?? '')
  .split(path.delimiter).map((entry) => entry.trim()).filter(Boolean);
const importOptional = async (name, fallbackFiles) => {
  try { return await import(name); } catch {}
  for (const root of moduleRoots) {
    for (const file of fallbackFiles) {
      const candidate = path.join(root, name, file);
      if (fs.existsSync(candidate)) return await import(pathToFileURL(candidate).href);
    }
  }
  throw new Error(`Cannot resolve optional package ${name}`);
};

const browserCandidates = [
  process.env.RRM_CHROMIUM_EXECUTABLE,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
].filter(Boolean);
const systemBrowser = browserCandidates.find((candidate) => fs.existsSync(candidate));

let sharpModule = null;
try {
  sharpModule = (await importOptional('sharp', ['lib/index.js', 'index.js'])).default;
} catch {}

const normalizePng = async () => {
  if (!sharpModule) return null;
  const image = sharpModule(pngPath);
  const metadata = await image.metadata();
  if (metadata.width !== target.width || metadata.height !== target.height || Math.round(metadata.density ?? 0) !== target.dpi) {
    const buffer = await image
      .resize(target.width, target.height, {fit: 'fill'})
      .withMetadata({density: target.dpi})
      .png({compressionLevel: 9})
      .toBuffer();
    fs.writeFileSync(pngPath, buffer);
  }
  const normalized = await sharpModule(pngPath).metadata();
  return {width: normalized.width, height: normalized.height, density: normalized.density ?? target.dpi};
};

let mode = null;
let browserDetail = null;
if (process.env.RRM_FORCE_SVG_FALLBACK === '1') {
  browserDetail = 'Browser export intentionally disabled by RRM_FORCE_SVG_FALLBACK=1';
} else {
  try {
    const {chromium} = await importOptional('playwright', ['index.mjs', 'index.js']);
    const launchOptions = {headless: true};
    if (systemBrowser) launchOptions.executablePath = systemBrowser;
    const browser = await chromium.launch(launchOptions);
    const page = await browser.newPage({
      viewport: {width: layout.canvas.width, height: layout.canvas.height},
      deviceScaleFactor: 2
    });
    await page.goto(pathToFileURL(svgPath).href, {waitUntil: 'load'});
    await page.evaluate(() => document.fonts?.ready);
    await page.locator('#route-map-svg').screenshot({path: pngPath, animations: 'disabled'});
    await browser.close();
    mode = systemBrowser ? 'playwright-system-chromium' : 'playwright-bundled-chromium';
  } catch (error) {
    browserDetail = String(error);
  }
}

if (!mode) {
  if (!sharpModule) {
    writeJsonFile(project, 'export-report.json', {
      mode: 'failed',
      error: browserDetail,
      fallback_error: 'sharp is unavailable'
    });
    console.error('Unable to export PNG: Chromium and sharp are unavailable.');
    process.exit(1);
  }
  await sharpModule(Buffer.from(svg), {density: target.dpi})
    .resize(target.width, target.height, {fit: 'fill'})
    .withMetadata({density: target.dpi})
    .png({compressionLevel: 9})
    .toFile(pngPath);
  mode = 'standalone-svg-fallback';
}

const output = await normalizePng();
const report = {
  mode,
  target,
  output: output ?? {width: target.width, height: target.height, density: target.dpi},
  browser_executable: systemBrowser ?? null,
  browser_error: browserDetail,
  source_svg_file: 'route-map.svg',
  source_svg_sha256: sourceSvgSha256,
  same_svg_source: true,
  same_embedded_svg_source: embeddedMatch[0] === svg
};
writeJsonFile(project, 'export-report.json', report);
console.log(`Exported ${pngPath} via ${mode} (${target.width} × ${target.height})`);
