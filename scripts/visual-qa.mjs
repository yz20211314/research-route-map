#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  contrastRatio,
  isOrthogonalPoints,
  normalizeDesign,
  normalizeGraph,
  normalizePointArray,
  nodeColors,
  segmentIntersectsBox,
  sha256,
  writeJsonFile
} from './lib/route-utils.mjs';

const project = process.argv[2];
if (!project) {
  console.error('Usage: node scripts/visual-qa.mjs <project>');
  process.exit(2);
}

const required = ['render-layout.json', 'research_graph.json', 'design_spec.json', 'route-map.svg', 'route-map.html', 'route-map.png', 'export-report.json'];
for (const name of required) {
  if (!fs.existsSync(path.join(project, name))) {
    console.error(`Missing ${name}.`);
    process.exit(1);
  }
}

const layout = JSON.parse(fs.readFileSync(path.join(project, 'render-layout.json'), 'utf8'));
const graphInput = JSON.parse(fs.readFileSync(path.join(project, 'research_graph.json'), 'utf8'));
const designInput = JSON.parse(fs.readFileSync(path.join(project, 'design_spec.json'), 'utf8'));
const graph = normalizeGraph(graphInput);
const design = normalizeDesign(designInput, graph);
const svg = fs.readFileSync(path.join(project, 'route-map.svg'), 'utf8');
const html = fs.readFileSync(path.join(project, 'route-map.html'), 'utf8');
const exportReport = JSON.parse(fs.readFileSync(path.join(project, 'export-report.json'), 'utf8'));
const errors = [];
const warnings = [];
const svgId = (prefix, value) => `${prefix}-${String(value ?? '')
  .normalize('NFKD')
  .replace(/[^A-Za-z0-9_.-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item'}`;

const boxes = Object.entries(layout.bounds ?? {});
const overlaps = (a, b) => (
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
);
for (const [id, box] of boxes) {
  if (
    box.x < 0 || box.y < 0
    || box.x + box.w > layout.canvas.width
    || box.y + box.h > layout.canvas.height
  ) errors.push(`node ${id} is outside canvas`);
}
for (let a = 0; a < boxes.length; a += 1) {
  for (let b = a + 1; b < boxes.length; b += 1) {
    if (overlaps(boxes[a][1], boxes[b][1])) errors.push(`node overlap: ${boxes[a][0]} / ${boxes[b][0]}`);
  }
}

const groupBoxes = Object.entries(layout.group_rows ?? {}).map(([id, value]) => [
  id,
  {x: value.x, y: value.y, w: value.width, h: value.height}
]);
for (let a = 0; a < groupBoxes.length; a += 1) {
  for (let b = a + 1; b < groupBoxes.length; b += 1) {
    if (overlaps(groupBoxes[a][1], groupBoxes[b][1])) errors.push(`macro-group overlap: ${groupBoxes[a][0]} / ${groupBoxes[b][0]}`);
  }
}
for (const node of graph.nodes) {
  const box = layout.bounds?.[node.id];
  const group = layout.group_rows?.[node.group];
  if (!box || !group) continue;
  const inside = (
    box.x >= group.x && box.y >= group.y
    && box.x + box.w <= group.x + group.width
    && box.y + box.h <= group.y + group.height
  );
  if (!inside) errors.push(`node ${node.id} falls outside macro group ${node.group}`);
}

for (const [parentId, children] of Object.entries(layout.child_layouts ?? {})) {
  const parent = layout.bounds[parentId];
  for (const child of children) {
    const inside = parent
      && child.x >= parent.x && child.y >= parent.y
      && child.x + child.w <= parent.x + parent.w
      && child.y + child.h <= parent.y + parent.h;
    if (!inside) errors.push(`child ${child.id} exceeds parent ${parentId}`);
  }
}

if (designInput.schema_version === '1.3') {
  const regions = new Map((layout.regions ?? []).map((region) => [region.id, region]));
  const primaryRegion = (layout.regions ?? []).find((region) => region.kind === 'primary');
  if ((layout.headers ?? []).length !== regions.size) errors.push('adaptive header count differs from visible region count');
  for (const header of layout.headers ?? []) {
    const region = regions.get(header.id);
    if (!region || ['x', 'y', 'w', 'h'].some((key) => Math.abs(header[key] - region[key]) > .01)) {
      errors.push(`adaptive header ${header.id} is not aligned to its region`);
    }
  }
  for (const group of graph.groups) {
    const row = layout.group_rows?.[group.id];
    const cells = layout.region_cells?.[group.id] ?? {};
    if (Object.keys(cells).length !== (layout.headers ?? []).length) {
      errors.push(`stage ${group.id} cell count differs from header count`);
    }
    for (const region of regions.values()) {
      const cell = cells[region.id];
      if (!cell) {
        errors.push(`stage ${group.id} is missing cell ${region.id}`);
        continue;
      }
      if (Math.abs(cell.x - region.x) > .01 || Math.abs(cell.width - region.w) > .01) {
        errors.push(`cell ${group.id}/${region.id} is not aligned to its header`);
      }
      if (!row || Math.abs(cell.y - row.y) > .01 || Math.abs(cell.height - row.height) > .01) {
        errors.push(`cell ${group.id}/${region.id} does not share the stage row y/height`);
      }
    }
    const orderedCells = (layout.regions ?? [])
      .map((region) => cells[region.id])
      .filter(Boolean)
      .sort((a, b) => a.x - b.x);
    for (let index = 0; index < orderedCells.length - 1; index += 1) {
      if (orderedCells[index].x + orderedCells[index].width > orderedCells[index + 1].x + .01) {
        errors.push(`stage ${group.id} cells overlap`);
      }
    }
    const stage = layout.stage_boxes?.[group.id];
    const stageCell = cells.stage;
    if (stage && stageCell && ['x', 'y', 'width', 'height'].some((key) => Math.abs(stage[key] - stageCell[key]) > .01)) {
      errors.push(`stage ${group.id} polygon does not match the stage cell`);
    }
    const central = layout.visual_groups?.[group.id];
    const contentCell = primaryRegion ? cells[primaryRegion.id] : null;
    if (central && contentCell && ['x', 'y', 'width', 'height'].some((key) => Math.abs(central[key] - contentCell[key]) > .01)) {
      errors.push(`stage ${group.id} visual group spans outside its content cell`);
    }
    if ((layout.group_metrics?.[group.id]?.internal_vertical_slack ?? 0) > 12) {
      errors.push(`stage ${group.id} has more than 12px non-content vertical slack`);
    }
  }
  const bottomMargin = layout.canvas.height - (layout.content_bbox?.bottom ?? layout.canvas.height);
  if (bottomMargin < 28 || bottomMargin > 29) errors.push(`content-fit bottom margin is ${bottomMargin}px`);
  for (const node of graph.nodes) {
    const box = layout.bounds?.[node.id];
    if (!box) continue;
    const cell = layout.region_cells?.[node.group]?.[node.lane];
    if (!cell) {
      errors.push(`node ${node.id} has no region cell for lane ${node.lane}`);
      continue;
    }
    if (
      box.x < cell.x - .01 || box.y < cell.y - .01
      || box.x + box.w > cell.x + cell.width + .01
      || box.y + box.h > cell.y + cell.height + .01
    ) errors.push(`node/tree cluster ${node.id} leaves its ${node.lane} cell`);
  }
}

const graphEdgeMap = new Map(graph.edges.map((edge) => [edge.id, edge]));
const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
const maxSegments = design.line_semantics?.max_segments ?? 3;
const outcomeBox = layout.outcome_band ? {
  x: layout.outcome_band.x,
  y: layout.outcome_band.y,
  w: layout.outcome_band.width,
  h: layout.outcome_band.height
} : null;
const headerBoxes = Object.entries(layout.visual_groups ?? {}).map(([id, value]) => [
  id,
  {x: value.x + 12, y: value.y + 8, w: value.width - 24, h: design.stage_header_height ?? 40}
]);

for (const route of layout.edge_routes ?? []) {
  const points = normalizePointArray(route.points ?? []);
  if (!isOrthogonalPoints(points)) errors.push(`edge ${route.id} is not orthogonal`);
  if (route.segments > maxSegments) errors.push(`edge ${route.id} has ${route.segments} segments; maximum is ${maxSegments}`);
  if (route.crossed_nodes?.length) errors.push(`edge ${route.id} crosses node(s): ${route.crossed_nodes.join(', ')}`);
  if (route.dashed) {
    const edge = graphEdgeMap.get(route.id);
    const endpointSignals = edge && [nodeMap.get(edge.from), nodeMap.get(edge.to)].some((node) => (
      ['optional', 'pending'].includes(node?.status) || node?.emphasis === 'uncertain'
    ));
    if (!edge || !['optional', 'uncertain'].includes(edge.status)) errors.push(`dashed edge ${route.id} lacks optional/uncertain semantic status`);
    if (edge && ['sequence', 'causal', 'decision', 'feedback'].includes(edge.kind)) {
      errors.push(`dashed edge ${route.id} uses solid-only relation kind ${edge.kind}`);
    }
    if (!route.label?.trim() && !endpointSignals) errors.push(`dashed edge ${route.id} lacks label or endpoint status`);
  }
  const edge = graphEdgeMap.get(route.id);
  const endpointGroups = new Set(edge ? [nodeMap.get(edge.from)?.group, nodeMap.get(edge.to)?.group] : []);
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]; const b = points[index + 1];
    for (const [groupId, box] of groupBoxes) {
      if (!endpointGroups.has(groupId) && !route.kind?.includes('connector') && segmentIntersectsBox(a, b, box, 0)) {
        errors.push(`edge ${route.id} crosses unrelated group ${groupId}`);
      }
    }
    for (const [groupId, box] of headerBoxes) {
      if (!route.kind?.includes('connector') && segmentIntersectsBox(a, b, box, 0)) {
        errors.push(`edge ${route.id} crosses stage header ${groupId}`);
      }
    }
    if (outcomeBox && route.id !== 'stage-outcome' && segmentIntersectsBox(a, b, outcomeBox, 0)) {
      errors.push(`edge ${route.id} crosses outcome band`);
    }
  }
}

for (const route of layout.tree_routes ?? []) {
  const points = normalizePointArray(route.points ?? []);
  if (!isOrthogonalPoints(points)) errors.push(`tree route ${route.id} is not orthogonal`);
  if (route.segments > 3) errors.push(`tree route ${route.id} has more than three segments`);
  const nodeLayout = layout.node_layouts?.[route.node_id];
  const protectedBoxes = nodeLayout
    ? [nodeLayout.parent, ...(nodeLayout.children ?? [])]
    : [];
  for (let index = 0; index < points.length - 1; index += 1) {
    for (const box of protectedBoxes) {
      if (segmentIntersectsBox(points[index], points[index + 1], box, -1)) {
        errors.push(`tree route ${route.id} enters parent/child text box`);
      }
    }
  }
}

if (design.method_rail_mode !== 'mapped' && (layout.edge_routes ?? []).some((route) => route.kind === 'support')) {
  errors.push(`${design.method_rail_mode} method rail rendered support connectors`);
}

const svgMatch = html.match(/<svg id="route-map-svg"[\s\S]*?<\/svg>/);
if (!svgMatch) errors.push('HTML does not contain the embedded route-map SVG');
else {
  if (svgMatch[0] !== svg) errors.push('standalone SVG differs from the HTML embedded SVG');
  if (sha256(svg) !== layout.standalone_svg_sha256) errors.push('standalone SVG hash differs from render-layout.json');
  if (sha256(svgMatch[0]) !== layout.embedded_svg_sha256) errors.push('embedded SVG hash differs from render-layout.json');
  const connectorPathTags = [...svg.matchAll(/<path\b[^>]*class="[^"]*(?:graph-edge|structural-edge)[^"]*"[^>]*>/g)].map((match) => match[0]);
  const allPathData = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
  if (allPathData.some((value) => /[CQSTA]/i.test(value))) errors.push('embedded SVG contains a curve or arc path command');
  if (connectorPathTags.some((tag) => /[CQSTA]/i.test(tag.match(/\bd="([^"]+)"/)?.[1] ?? ''))) {
    errors.push('connector path contains a curve or arc command');
  }
  const treePathTags = [...svg.matchAll(/<path\b[^>]*class="[^"]*tree-edge[^"]*"[^>]*>/g)].map((match) => match[0]);
  if (treePathTags.some((tag) => /\bmarker-(?:start|mid|end)=/.test(tag))) {
    errors.push('tree containment line must not use arrow markers');
  }
  if (treePathTags.length !== (layout.tree_routes ?? []).length) {
    errors.push('embedded tree route count differs from render-layout.json');
  }
}

if (!/<title id="route-map-title">/.test(svg) || !/<desc id="route-map-desc">/.test(svg)) {
  errors.push('SVG lacks accessible title/description');
}
if (!/id="route-map-long-description"/.test(html)) errors.push('HTML lacks a structured long description');
if (/route-map-editor|editor-runtime|mountRouteMapEditor|ReactFlow|reactflow/i.test(html)) {
  errors.push('static HTML contains editor/runtime code');
}
if ((html.match(/<svg\b/g) ?? []).length !== 1) errors.push('static HTML must contain exactly one SVG');
if (!/<svg\b[^>]*\bversion="1\.1"/.test(svg)) errors.push('standalone SVG does not declare SVG 1.1');
if (!/<svg\b[^>]*\bdata-editable-svg="office-compatible"/.test(svg)) {
  errors.push('standalone SVG lacks the Office-compatible editability declaration');
}
const forbiddenOfficeSvg = [
  ['script', /<script\b/i],
  ['foreignObject', /<foreignObject\b/i],
  ['style', /<style\b/i],
  ['filter', /<(?:filter|fe[A-Za-z]+)\b/i],
  ['gradient', /<(?:linearGradient|radialGradient)\b/i],
  ['pattern', /<pattern\b/i],
  ['external image', /<image\b/i],
  ['marker arrowhead', /<marker\b|marker-(?:start|mid|end)=/i],
  ['external reference', /\b(?:href|xlink:href)\s*=\s*["'](?!#)/i],
  ['CSS URL reference', /\burl\s*\(/i]
];
for (const [label, pattern] of forbiddenOfficeSvg) {
  if (pattern.test(svg)) errors.push(`standalone SVG contains unsupported ${label}`);
}
if (!/<text\b[^>]*\bdata-editable-text="true"/.test(svg)) {
  errors.push('standalone SVG does not preserve editable text elements');
}
const textTags = [...svg.matchAll(/<text\b[^>]*>/g)].map((match) => match[0]);
if (textTags.some((tag) => !/\bdata-editable-text="true"/.test(tag))) {
  errors.push('standalone SVG contains an unmarked or non-editable text element');
}
if (/<path\b[^>]*\bdata-editable-text=/.test(svg)) {
  errors.push('standalone SVG contains text converted to a path');
}
const editablePathTags = [...svg.matchAll(/<path\b[^>]*>/g)].map((match) => match[0]);
if (editablePathTags.some((tag) => !/\bdata-editable-part="(?:connector|containment)"/.test(tag))) {
  errors.push('standalone SVG contains an unexplained path that may be outlined text');
}
const expectedLayers = layout.semantic_layers ?? [];
for (const layer of expectedLayers) {
  if (!svg.includes(`id="${svgId('layer', layer)}"`)) errors.push(`standalone SVG is missing semantic layer ${layer}`);
}
for (const node of graph.nodes) {
  if (layout.bounds?.[node.id] && !svg.includes(`id="${svgId('node', node.id)}"`)) {
    errors.push(`standalone SVG is missing editable node group ${node.id}`);
  }
}
for (const group of graph.groups) {
  if (layout.group_rows?.[group.id] && !svg.includes(`id="${svgId('stage', group.id)}"`)) {
    errors.push(`standalone SVG is missing editable stage group ${group.id}`);
  }
}
for (const route of layout.edge_routes ?? []) {
  if (!svg.includes(`id="${svgId('edge', route.id)}"`)) {
    errors.push(`standalone SVG is missing editable edge group ${route.id}`);
  }
}

if (['1.2', '1.3'].includes(designInput.schema_version)) {
  for (const [key, value] of Object.entries(layout.typography_pt ?? {})) {
    if (value < 7) errors.push(`typography ${key} is below 7 pt`);
  }
} else if (!layout.typography_pt) {
  warnings.push('legacy design uses CSS-pixel typography; final point-size compliance is not guaranteed');
}

for (const [name, ratio] of Object.entries(layout.palette_checks ?? {})) {
  const threshold = name.startsWith('ink_') || name.startsWith('white_') || name.startsWith('muted_') ? 4.5 : 3;
  if (ratio !== null && ratio < threshold) errors.push(`contrast ${name} is ${ratio.toFixed(2)}:1; requires ${threshold}:1`);
}
for (const node of graph.nodes) {
  if (!layout.bounds?.[node.id]) continue;
  const colors = nodeColors(node, design, design.theme.paper);
  const ratio = contrastRatio(colors.text, colors.fill);
  if (ratio !== null && ratio < 4.5) errors.push(`node ${node.id} text contrast is ${ratio.toFixed(2)}:1`);
  const borderRatio = contrastRatio(colors.stroke, colors.fill);
  if (borderRatio !== null && borderRatio < 3) {
    const message = `node ${node.id} border contrast is ${borderRatio.toFixed(2)}:1; requires 3:1 grayscale distinction`;
    if (['1.2', '1.3'].includes(designInput.schema_version)) errors.push(message);
    else warnings.push(message);
  }
}

if (
  exportReport.output?.width !== layout.target_png.width
  || exportReport.output?.height !== layout.target_png.height
) errors.push('PNG dimensions do not match target_png');
if (Math.round(exportReport.output?.density ?? 0) !== 300) errors.push('PNG density is not 300 dpi');
if (exportReport.source_svg_sha256 !== sha256(svg)) errors.push('PNG export source hash differs from standalone SVG');
if (exportReport.same_svg_source !== true) errors.push('PNG export did not confirm the standalone SVG source');
if (exportReport.same_embedded_svg_source !== true) errors.push('PNG export did not confirm the matching HTML embedded SVG');

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
  throw new Error(`Cannot resolve ${name}`);
};

let domChecks = {available: false};
try {
  const {chromium} = await importOptional('playwright', ['index.mjs', 'index.js']);
  const candidates = [
    process.env.RRM_CHROMIUM_EXECUTABLE,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ].filter(Boolean);
  const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
  const browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  const page = await browser.newPage({viewport: {width: layout.canvas.width, height: layout.canvas.height}});
  await page.goto(pathToFileURL(path.join(project, 'route-map.html')).href, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts?.ready);
  const measured = await page.evaluate(() => {
    const overflows = [];
    for (const group of document.querySelectorAll('.route-node:not(.tree-node)')) {
      const shape = group.querySelector(':scope > rect, :scope > polygon');
      if (!shape) continue;
      const shapeBox = shape.getBBox();
      for (const text of group.querySelectorAll('text')) {
        const box = text.getBBox();
        if (
          box.x < shapeBox.x - 1 || box.y < shapeBox.y - 1
          || box.x + box.width > shapeBox.x + shapeBox.width + 1
          || box.y + box.height > shapeBox.y + shapeBox.height + 1
        ) overflows.push(group.dataset.nodeId);
      }
    }
    const otherOverflows = [];
    const checkTextInside = (root, shape, texts, label) => {
      if (!shape) return;
      const shapeBox = shape.getBBox();
      for (const text of texts) {
        const box = text.getBBox();
        if (
          box.x < shapeBox.x - 1 || box.y < shapeBox.y - 1
          || box.x + box.width > shapeBox.x + shapeBox.width + 1
          || box.y + box.height > shapeBox.y + shapeBox.height + 1
        ) otherOverflows.push(label);
      }
    };
    for (const group of document.querySelectorAll('.tree-node')) {
      for (const part of group.querySelectorAll(':scope > .tree-part')) {
        checkTextInside(part, part.querySelector(':scope > rect'), part.querySelectorAll(':scope > text'), `${group.dataset.nodeId}:${part.getAttribute('class')}`);
      }
    }
    for (const [index, group] of [...document.querySelectorAll('.column-header,.outcome-item')].entries()) {
      checkTextInside(group, group.querySelector(':scope > rect'), group.querySelectorAll(':scope > text'), `${group.getAttribute('class')}#${index + 1}`);
    }
    for (const [index, group] of [...document.querySelectorAll('.stage-group')].entries()) {
      const shape = group.querySelector(':scope > .stage-header');
      const text = group.querySelector(':scope > .stage-header-label');
      checkTextInside(group, shape, text ? [text] : [], `stage-header#${index + 1}`);
    }
    for (const [index, group] of [...document.querySelectorAll('.outcome-band')].entries()) {
      const shapes = group.querySelectorAll(':scope > rect');
      const texts = group.querySelectorAll(':scope > text');
      checkTextInside(group, shapes[1], texts.length ? [texts[0]] : [], `outcome-header#${index + 1}`);
    }
    const route = document.getElementById('route-map');
    const svg = document.getElementById('route-map-svg');
    return {
      font_status: document.fonts?.status ?? 'unknown',
      font_candidates: Object.fromEntries([
        'Noto Sans CJK SC',
        'Source Han Sans SC',
        'PingFang SC',
        'Microsoft YaHei'
      ].map((name) => [name, document.fonts?.check(`16px "${name}"`) ?? false])),
      overflows: [...new Set(overflows)],
      other_overflows: [...new Set(otherOverflows)],
      region_cell_counts: Object.fromEntries([...document.querySelectorAll('.adaptive-stage-group')].map((group) => [
        group.dataset.groupId,
        group.querySelectorAll(':scope > .region-cell').length
      ])),
      stage_header_regions: Object.fromEntries([...document.querySelectorAll('.adaptive-stage-group')].map((group) => [
        group.dataset.groupId,
        group.querySelector(':scope > .stage-header')?.dataset.regionId ?? null
      ])),
      merged_stage_containers: document.querySelectorAll('.adaptive-stage-group > rect:not(.region-cell):not(.stage-header)').length,
      route_width: route.getBoundingClientRect().width,
      route_height: route.getBoundingClientRect().height,
      svg_count: document.querySelectorAll('svg').length,
      svg_width: svg.getBoundingClientRect().width,
      svg_height: svg.getBoundingClientRect().height
    };
  });
  if (measured.overflows.length) {
    const message = `DOM text overflow in node(s): ${measured.overflows.join(', ')}`;
    if (['1.2', '1.3'].includes(designInput.schema_version)) errors.push(message);
    else warnings.push(`legacy design: ${message}`);
  }
  if (measured.other_overflows.length) {
    const message = `DOM text overflow in structural text: ${measured.other_overflows.join(', ')}`;
    if (['1.2', '1.3'].includes(designInput.schema_version)) errors.push(message);
    else warnings.push(`legacy design: ${message}`);
  }
  if (designInput.schema_version === '1.3') {
    const expectedCellCount = Math.max(0, (layout.headers ?? []).length - 1);
    for (const group of graph.groups) {
      if (measured.region_cell_counts[group.id] !== expectedCellCount) {
        errors.push(`DOM stage ${group.id} does not render one independent cell per non-stage header`);
      }
      const primaryRegion = (layout.regions ?? []).find((region) => region.kind === 'primary');
      if (measured.stage_header_regions[group.id] !== primaryRegion?.id) {
        errors.push(`DOM stage title ${group.id} is not inside the content column`);
      }
    }
    if (measured.merged_stage_containers) errors.push('DOM contains a merged adaptive stage container');
  }
  if (measured.font_status !== 'loaded') warnings.push(`document font status is ${measured.font_status}`);
  if (!Object.values(measured.font_candidates).some(Boolean)) {
    const message = 'no configured CJK font candidate is available';
    if (['1.2', '1.3'].includes(designInput.schema_version)) errors.push(message);
    else warnings.push(`legacy design: ${message}`);
  }
  if (Math.round(measured.svg_width) !== layout.canvas.width || Math.round(measured.svg_height) !== layout.canvas.height) {
    errors.push('desktop HTML SVG size differs from source canvas');
  }
  await page.setViewportSize({width: Math.max(320, Math.floor(layout.canvas.width / 2)), height: 900});
  const narrow = await page.evaluate(() => {
    const svg = document.getElementById('route-map-svg').getBoundingClientRect();
    return {left: svg.left, right: svg.right, viewport: window.innerWidth, width: svg.width};
  });
  if (narrow.left < -1 || narrow.right > narrow.viewport + 1) errors.push('narrow HTML viewport clips or overflows horizontally');
  domChecks = {available: true, executable_path: executablePath ?? null, desktop: measured, narrow};
  await browser.close();
} catch (error) {
  domChecks = {available: false, warning: String(error)};
  warnings.push('browser DOM QA unavailable; static geometry checks were used');
}

const selfChecks = {
  static_html_only: !/route-map-editor|editor-runtime|ReactFlow/i.test(html),
  standalone_editable_svg: errors.every((message) => !message.startsWith('standalone SVG')),
  svg_html_identical: Boolean(svgMatch && svgMatch[0] === svg),
  one_embedded_svg: (html.match(/<svg\b/g) ?? []).length === 1,
  orthogonal_connectors: (layout.edge_routes ?? []).every((route) => isOrthogonalPoints(normalizePointArray(route.points ?? []))),
  orthogonal_tree_routes: (layout.tree_routes ?? []).every((route) => isOrthogonalPoints(normalizePointArray(route.points ?? []))),
  no_connector_curves: !/[CQSTA]/i.test(
    [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1]).join(' ')
  ),
  png_dimensions: exportReport.output?.width === layout.target_png.width && exportReport.output?.height === layout.target_png.height,
  accessible_description: Boolean(layout.accessible_description),
  grayscale_contrast_checked: Object.keys(layout.palette_checks ?? {}).length > 0
};
const result = {
  schema_version: designInput.schema_version,
  ok: errors.length === 0,
  route_mode: graph.meta.route_mode,
  errors: [...new Set(errors)],
  warnings: [...new Set(warnings)],
  checked_nodes: boxes.length,
  checked_edges: (layout.edge_routes?.length ?? 0) + (layout.tree_routes?.length ?? 0),
  output: {
    svg: 'route-map.svg',
    html: 'route-map.html',
    png: 'route-map.png',
    png_width: exportReport.output?.width ?? null,
    png_height: exportReport.output?.height ?? null,
    dpi: exportReport.output?.density ?? null,
    export_mode: exportReport.mode ?? null,
    same_svg_source: exportReport.same_svg_source === true,
    same_embedded_svg_source: exportReport.same_embedded_svg_source === true
  },
  dom_checks: domChecks,
  self_checks: selfChecks
};
writeJsonFile(project, 'qa-report.json', result);
console.log(JSON.stringify(result, null, 2));
if (result.errors.length) process.exit(1);
