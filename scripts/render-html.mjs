#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  accessibleDescription,
  boxFrom,
  computeBounds,
  contrastRatio,
  crossingNodeIds,
  esc,
  graphReadingOrder,
  isDashedEdge,
  longestSegmentMidpoint,
  nodeColors,
  normalizeDesign,
  normalizeGraph,
  orthogonalRoute,
  pointsToPath,
  round,
  sha256,
  splitText,
  typographyPx,
  visibleNodeSet,
  writeJsonFile
} from './lib/route-utils.mjs';
import {computeAdaptiveLayout} from './lib/adaptive-layout.mjs';

const project = process.argv[2];
if (!project) {
  console.error('Usage: node scripts/render-html.mjs <project>');
  process.exit(2);
}

const required = ['research_graph.json', 'design_spec.json', 'spec_lock.json'];
for (const name of required) {
  if (!fs.existsSync(path.join(project, name))) {
    console.error(`Rendering is blocked: ${name} is missing.`);
    process.exit(1);
  }
}

const graphRaw = fs.readFileSync(path.join(project, 'research_graph.json'), 'utf8');
const designRaw = fs.readFileSync(path.join(project, 'design_spec.json'), 'utf8');
const specLock = JSON.parse(fs.readFileSync(path.join(project, 'spec_lock.json'), 'utf8'));
if (!specLock.inputs || Object.values(specLock.inputs).some((entry) => {
  if (!entry?.file || !entry?.sha256) return true;
  const filePath = path.join(project, entry.file);
  return !fs.existsSync(filePath) || sha256(fs.readFileSync(filePath, 'utf8')) !== entry.sha256;
})) {
  console.error('Rendering is blocked: a confirmed source, graph, design, or validation file changed after spec locking.');
  process.exit(1);
}

const graphInput = JSON.parse(graphRaw);
const designInput = JSON.parse(designRaw);
const graph = normalizeGraph(graphInput);
let design = normalizeDesign(designInput, graph);
const adaptiveLayout = design.layout_strategy === 'adaptive'
  ? computeAdaptiveLayout(graph, design)
  : null;
if (adaptiveLayout) {
  const primaryRegion = adaptiveLayout.regions.find((region) => region.kind === 'primary');
  const methodRegion = adaptiveLayout.regions.find((region) => (
    ['method', 'data'].includes(region.kind)
    && primaryRegion
    && region.x >= primaryRegion.x + primaryRegion.w
  ));
  design = {
    ...design,
    orientation: adaptiveLayout.orientation,
    canvas: adaptiveLayout.canvas,
    target_png: adaptiveLayout.target_png,
    outcome_band: adaptiveLayout.outcome_band,
    ...(primaryRegion && methodRegion ? {
      method_support_bus_x: (
        primaryRegion.x + primaryRegion.w + methodRegion.x
      ) / 2
    } : {})
  };
}
const W = design.canvas.width;
const H = design.canvas.height;
const fonts = typographyPx(design);
const visible = visibleNodeSet(graph, design);
const bounds = adaptiveLayout?.bounds ?? computeBounds(graph, design);
const nodeAnchors = adaptiveLayout?.node_anchors ?? bounds;
const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
const laneKind = new Map(graph.lanes.map((lane) => [lane.id, lane.kind]));
const visibleEdgeIds = new Set(design.visible_edge_ids);

const borderWidth = design.border_width ?? 1.4;
const accentBorderWidth = design.accent_border_width ?? 2.4;
const stageHeaderHeight = design.stage_header_height ?? Math.max(34, fonts.stage * 1.75);
const stageColors = ['#C9DCF4', '#C8E5E2', '#F5DDA0', '#DDC6EE', '#F2C5B3', '#CDE5BC'];
const editableFontFamily = 'PingFang SC,Microsoft YaHei,Noto Sans CJK SC,Source Han Sans SC,Arial,sans-serif';
const svgId = (prefix, value) => `${prefix}-${String(value ?? '')
  .normalize('NFKD')
  .replace(/[^A-Za-z0-9_.-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item'}`;
const arrowheadSvg = (points, {
  fill = design.theme.ink,
  size = 8,
  className = 'editable-arrowhead'
} = {}) => {
  if (!Array.isArray(points) || points.length < 2) return '';
  const tip = points.at(-1);
  let previousIndex = points.length - 2;
  while (
    previousIndex >= 0
    && Math.abs(points[previousIndex].x - tip.x) < .01
    && Math.abs(points[previousIndex].y - tip.y) < .01
  ) previousIndex -= 1;
  if (previousIndex < 0) return '';
  const previous = points[previousIndex];
  const horizontal = Math.abs(tip.x - previous.x) >= Math.abs(tip.y - previous.y);
  const direction = horizontal
    ? Math.sign(tip.x - previous.x)
    : Math.sign(tip.y - previous.y);
  if (!direction) return '';
  const half = size * .52;
  const base = horizontal
    ? {x: tip.x - direction * size, y: tip.y}
    : {x: tip.x, y: tip.y - direction * size};
  const triangle = horizontal
    ? [
      tip,
      {x: base.x, y: base.y - half},
      {x: base.x, y: base.y + half}
    ]
    : [
      tip,
      {x: base.x - half, y: base.y},
      {x: base.x + half, y: base.y}
    ];
  return `<polygon class="${esc(className)}" data-editable-part="arrowhead" points="${triangle.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')}" fill="${fill}"/>`;
};

const groups = [...graph.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const defaultGroupBox = (group, index) => {
  const startY = 142;
  const endY = design.outcome_band?.y ?? H - 42;
  const gap = 28;
  const rowHeight = Math.max(150, (endY - startY - gap * Math.max(0, groups.length - 1)) / Math.max(1, groups.length));
  return {x: 28, y: startY + index * (rowHeight + gap), width: W - 56, height: rowHeight};
};
const groupRows = Object.fromEntries(groups.map((group, index) => [
  group.id,
  adaptiveLayout?.group_rows?.[group.id]
    ?? design.group_placements?.[group.id]
    ?? defaultGroupBox(group, index)
]));
const visualGroup = (groupId) => adaptiveLayout?.visual_groups?.[groupId]
  ?? design.visual_group_placements?.[groupId]
  ?? groupRows[groupId];
const groupStyle = new Map(groups.map((group, index) => {
  const supplied = design.group_styles?.[group.id] ?? {};
  const header = supplied.header_fill ?? stageColors[index % stageColors.length];
  return [group.id, {
    header,
    fill: supplied.fill ?? '#F8FAFC',
    stroke: supplied.stroke ?? '#475569'
  }];
}));

const textSvg = ({
  text,
  x,
  y,
  fontSize,
  weight = 600,
  fill = design.theme.ink,
  maxChars = 12,
  maxLines = 3,
  lineHeight = fontSize * 1.2,
  anchor = 'middle',
  className = ''
}) => {
  const lines = splitText(text, Math.max(2, maxChars), maxLines);
  const start = y - (lines.length - 1) * lineHeight / 2;
  return `<text${className ? ` class="${esc(className)}"` : ''} data-editable-text="true" x="${round(x)}" y="${round(start)}" text-anchor="${anchor}" dominant-baseline="middle" font-family="${editableFontFamily}" font-size="${round(fontSize)}" font-weight="${weight}" fill="${fill}">${lines.map((line, index) => `<tspan x="${round(x)}" dy="${index ? round(lineHeight) : 0}">${esc(line)}</tspan>`).join('')}</text>`;
};

const title = design.title ?? graph.meta.title;
const description = accessibleDescription(graph);

const columnHeaders = adaptiveLayout?.headers ?? (design.column_headers ?? []).map((header) => {
  const lane = (design.lanes ?? []).find((item) => item.id === header.lane)
    ?? (() => {
      const source = graph.lanes.find((item) => item.id === header.lane);
      if (source?.kind === 'thinking') return {x: 28, width: W * .11};
      if (['method', 'data'].includes(source?.kind)) return {x: W * .81, width: W * .17};
      return {x: W * .15, width: W * .64};
    })();
  return {
    ...header,
    id: header.id ?? header.lane,
    x: lane.x,
    y: header.y ?? design.column_header_y ?? 92,
    w: lane.width,
    h: header.height ?? 38
  };
});
const headerFill = (header) => {
  if (header.fill) return header.fill;
  const kind = adaptiveLayout?.regions?.find((region) => region.id === header.id)?.kind;
  if (kind === 'stage' || kind === 'thinking') return '#E6EEF9';
  if (kind === 'primary') return '#EAF4E2';
  if (['method', 'data'].includes(kind)) return '#E7F3F1';
  return '#EEF2F7';
};
const columnHeadersSvg = columnHeaders.map((header) => {
  const regionId = header.id ?? header.lane;
  return `<g id="${svgId('header', regionId)}" class="column-header" data-region="${esc(regionId)}"${header.lane ? ` data-lane="${esc(header.lane)}"` : ''}>
    <rect x="${round(header.x)}" y="${round(header.y)}" width="${round(header.w)}" height="${round(header.h)}" rx="4" fill="${headerFill(header)}" stroke="#475569" stroke-width="${borderWidth}"/>
    ${textSvg({text: header.label, x: header.x + header.w / 2, y: header.y + header.h / 2, fontSize: fonts.stage, weight: 750, maxChars: Math.floor(header.w / fonts.stage)})}
  </g>`;
}).join('');

const legacyLanesSvg = graph.groups.length ? '' : graph.lanes.map((lane, index) => {
  const supplied = (design.lanes ?? []).find((item) => item.id === lane.id);
  const x = supplied?.x ?? 28 + index * ((W - 56) / Math.max(1, graph.lanes.length));
  const width = supplied?.width ?? (W - 56) / Math.max(1, graph.lanes.length) - 14;
  const y = supplied?.y ?? 112;
  const height = supplied?.height ?? H - 150;
  return `<g class="legacy-lane">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="#F8FAFC" stroke="#94A3B8" stroke-width="${borderWidth}"/>
    ${textSvg({text: lane.label, x: x + width / 2, y: y + 18, fontSize: fonts.stage, weight: 700, maxChars: Math.floor(width / fonts.stage)})}
  </g>`;
}).join('');

const adaptiveStageRegion = adaptiveLayout?.regions?.find((region) => region.kind === 'stage');
const adaptivePrimaryRegion = adaptiveLayout?.regions?.find((region) => region.kind === 'primary');
const primaryRegionId = adaptivePrimaryRegion?.id ?? 'content';
const stageRail = adaptiveStageRegion
  ? {x: adaptiveStageRegion.x, width: adaptiveStageRegion.w, enabled: true}
  : (design.stage_rail ?? {x: 28, width: Math.max(100, W * .1), enabled: true});
const groupSvg = groups.map((group, index) => {
  const row = groupRows[group.id];
  const box = visualGroup(group.id);
  const cells = adaptiveLayout?.region_cells?.[group.id] ?? null;
  const railBox = adaptiveLayout?.stage_boxes?.[group.id]
    ?? {x: stageRail.x, y: row?.y, width: stageRail.width, height: row?.height};
  const style = groupStyle.get(group.id);
  if (!row || !box) return '';
  const railPoints = `${round(railBox.x)},${round(railBox.y)} ${round(railBox.x + railBox.width * .82)},${round(railBox.y)} ${round(railBox.x + railBox.width)},${round(railBox.y + railBox.height / 2)} ${round(railBox.x + railBox.width * .82)},${round(railBox.y + railBox.height)} ${round(railBox.x)},${round(railBox.y + railBox.height)}`;
  const rail = design.route_mode === 'research-process' && stageRail.enabled !== false ? `
    <polygon class="stage-rail" points="${railPoints}" fill="${style.header}" stroke="#475569" stroke-width="${borderWidth}"/>
    ${textSvg({text: group.short_label ?? group.label, x: railBox.x + railBox.width * .43, y: railBox.y + railBox.height / 2, fontSize: fonts.stage, weight: 750, maxChars: 6, maxLines: 3})}` : '';
  if (cells) {
    const cellSvg = adaptiveLayout.regions
      .filter((region) => region.kind !== 'stage')
      .map((region) => {
        const cell = cells[region.id];
        if (!cell) return '';
        return `<rect class="region-cell region-${esc(region.kind)}" data-group-id="${esc(group.id)}" data-region-id="${esc(region.id)}"${region.lane ? ` data-lane="${esc(region.lane)}"` : ''} x="${round(cell.x)}" y="${round(cell.y)}" width="${round(cell.width)}" height="${round(cell.height)}" rx="7" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${borderWidth}"/>`;
      }).join('');
    return `<g id="${svgId('stage', group.id)}" class="stage-group adaptive-stage-group" data-group-id="${esc(group.id)}">
      ${cellSvg}
      <rect class="stage-header" data-region-id="${esc(primaryRegionId)}" x="${round(box.x + 12)}" y="${round(box.y + 8)}" width="${round(box.width - 24)}" height="${round(stageHeaderHeight)}" rx="4" fill="${style.header}" stroke="#475569" stroke-width="${borderWidth}"/>
      ${textSvg({text: group.label, x: box.x + box.width / 2, y: box.y + 8 + stageHeaderHeight / 2, fontSize: fonts.stage, weight: 750, maxChars: Math.max(12, Math.floor((box.width - 32) / fonts.stage)), maxLines: 2, className: 'stage-header-label'})}
      ${rail}
    </g>`;
  }
  return `<g id="${svgId('stage', group.id)}" class="stage-group" data-group-id="${esc(group.id)}">
    <rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}" rx="7" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${borderWidth}"/>
    <rect class="stage-header" x="${round(box.x + 12)}" y="${round(box.y + 8)}" width="${round(box.width - 24)}" height="${round(stageHeaderHeight)}" rx="4" fill="${style.header}" stroke="#475569" stroke-width="${borderWidth}"/>
    ${textSvg({text: group.label, x: box.x + box.width / 2, y: box.y + 8 + stageHeaderHeight / 2, fontSize: fonts.stage, weight: 750, maxChars: Math.max(12, Math.floor((box.width - 32) / fonts.stage)), maxLines: 2})}
    ${rail}
  </g>`;
}).join('');

const edgeRoutes = [];
const renderableEdges = design.render_edges ? graph.edges.filter((edge) => (
  visibleEdgeIds.has(edge.id)
  && visible.has(edge.from)
  && visible.has(edge.to)
  && edge.kind !== 'containment'
  && !(edge.kind === 'support' && design.method_rail_mode !== 'mapped')
  && !(edge.kind === 'feedback' && design.show_feedback !== true)
)) : [];

const edgeSvg = renderableEdges.map((edge) => {
  const route = orthogonalRoute(edge, bounds, graph, design, nodeAnchors);
  if (!route.points.length) return '';
  const crossed = crossingNodeIds(route.points, bounds, new Set([edge.from, edge.to]));
  const dashed = isDashedEdge(edge);
  const muted = ['support', 'feedback'].includes(edge.kind) || dashed;
  const stroke = muted ? design.theme.muted : design.theme.ink;
  const width = edge.kind === 'support' ? 1.2 : edge.kind === 'feedback' ? 1.4 : 1.8;
  const hasArrow = !['parallel'].includes(edge.kind);
  const dash = dashed ? ' stroke-dasharray="8 6"' : '';
  const labelPoint = longestSegmentMidpoint(route.points);
  const label = edge.label?.trim() ? (() => {
    const fontSize = fonts.legend;
    const boxWidth = Math.max(34, edge.label.length * fontSize * .85 + 12);
    return `<g class="edge-label">
      <rect x="${round(labelPoint.x - boxWidth / 2)}" y="${round(labelPoint.y - fontSize * .8)}" width="${round(boxWidth)}" height="${round(fontSize * 1.6)}" rx="2" fill="#FFFFFF" stroke="none"/>
      ${textSvg({text: edge.label, x: labelPoint.x, y: labelPoint.y, fontSize, weight: 600, maxChars: Math.max(4, edge.label.length), maxLines: 1})}
    </g>`;
  })() : '';
  edgeRoutes.push({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    status: edge.status,
    dashed,
    label: edge.label ?? '',
    points: route.points,
    segments: route.points.length - 1,
    source: route.source,
    crossed_nodes: crossed
  });
  return `<g id="${svgId('edge', edge.id)}" class="graph-edge edge-${esc(edge.kind)}${dashed ? ' edge-dashed' : ''}" data-edge-id="${esc(edge.id)}">
    <path data-editable-part="connector" d="${pointsToPath(route.points)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="square" stroke-linejoin="miter"${dash}/>
    ${hasArrow ? arrowheadSvg(route.points, {fill: stroke, size: Math.max(6.5, width * 4.4)}) : ''}
    ${label}
  </g>`;
}).join('');

const structuralRoutes = [];
const connectorSvg = [];
const orthogonalBetweenBoxes = (from, to, id, kind) => {
  const p = {x: from.x + from.width / 2, y: from.y + from.height};
  const q = {x: to.x + to.width / 2, y: to.y};
  const points = Math.abs(p.x - q.x) < .01
    ? [p, q]
    : [p, {x: p.x, y: (p.y + q.y) / 2}, {x: q.x, y: (p.y + q.y) / 2}, q];
  structuralRoutes.push({id, kind, points, segments: points.length - 1, dashed: false, crossed_nodes: []});
  connectorSvg.push(`<g id="${svgId('edge', id)}" class="structural-edge-group ${kind}" data-edge-id="${esc(id)}">
    <path class="structural-edge ${kind}" data-editable-part="connector" d="${pointsToPath(points)}" fill="none" stroke="${design.theme.ink}" stroke-width="2.8" stroke-linejoin="miter"/>
    ${arrowheadSvg(points, {fill: design.theme.ink, size: 9})}
  </g>`);
};

if (design.route_mode === 'research-process' && design.stage_connectors !== false) {
  for (let index = 0; index < groups.length - 1; index += 1) {
    orthogonalBetweenBoxes(visualGroup(groups[index].id), visualGroup(groups[index + 1].id), `stage-${index + 1}`, 'stage-connector');
  }
  if (groups.length && design.outcome_band) {
    orthogonalBetweenBoxes(visualGroup(groups.at(-1).id), design.outcome_band, 'stage-outcome', 'stage-connector');
  }
}
if (design.route_mode === 'research-process' && design.rail_connectors !== false && stageRail.enabled !== false) {
  const x = stageRail.x + stageRail.width / 2;
  for (let index = 0; index < groups.length - 1; index += 1) {
    const from = adaptiveLayout?.stage_boxes?.[groups[index].id] ?? groupRows[groups[index].id];
    const to = adaptiveLayout?.stage_boxes?.[groups[index + 1].id] ?? groupRows[groups[index + 1].id];
    const points = [{x, y: from.y + from.height}, {x, y: to.y}];
    structuralRoutes.push({id: `rail-${index + 1}`, kind: 'rail-connector', points, segments: 1, dashed: false, crossed_nodes: []});
    connectorSvg.push(`<g id="${svgId('edge', `rail-${index + 1}`)}" class="structural-edge-group rail-connector" data-edge-id="rail-${index + 1}">
      <path class="structural-edge rail-connector" data-editable-part="connector" d="${pointsToPath(points)}" fill="none" stroke="#475569" stroke-width="2.8"/>
      ${arrowheadSvg(points, {fill: '#475569', size: 9})}
    </g>`);
  }
}

const childLayouts = {...(adaptiveLayout?.child_layouts ?? {})};
const treeRoutes = adaptiveLayout?.tree_routes ?? [];
const treeRouteSvg = treeRoutes.map((route) => (
  `<path id="${svgId('tree-edge', route.id)}" class="tree-edge structural-edge tree-containment" data-tree-route-id="${esc(route.id)}" data-editable-part="containment" d="${pointsToPath(route.points)}" fill="none" stroke="#64748B" stroke-width="1.1" stroke-linecap="square" stroke-linejoin="miter"/>`
)).join('');
const nodeSvg = graph.nodes.filter((node) => visible.has(node.id)).map((node) => {
  const box = bounds[node.id];
  if (!box) return '';
  const adaptiveNode = adaptiveLayout?.node_layouts?.[node.id];
  const style = groupStyle.get(node.group);
  const colors = nodeColors(node, design, style?.header ? '#F8FAFC' : design.theme.paper);
  const isDecision = node.kind === 'decision' || node.role === 'decision_gate';
  const isOutput = node.role === 'stage_output' || node.kind === 'milestone';
  const dashed = node.status === 'optional' || node.status === 'pending' || node.emphasis === 'uncertain';
  const strokeDash = dashed ? ' stroke-dasharray="7 5"' : '';
  const fontSize = (node.role === 'method' || node.kind === 'method' || ['method', 'data'].includes(laneKind.get(node.lane)))
    ? fonts.method : fonts.node;
  const children = Array.isArray(node.children) ? node.children.slice(0, 4) : [];
  if (adaptiveNode?.mode === 'tree') {
    const parent = adaptiveNode.parent;
    const parentMaxChars = Math.max(4, Math.floor((parent.w - 16) / (fontSize * .92)));
    let parentShape = `<rect x="${round(parent.x)}" y="${round(parent.y)}" width="${round(parent.w)}" height="${round(parent.h)}" rx="${isOutput ? 5 : 4}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${isOutput ? accentBorderWidth : borderWidth}"${strokeDash}/>`;
    if (isOutput) {
      parentShape += `<rect x="${round(parent.x + 3)}" y="${round(parent.y + 3)}" width="${round(parent.w - 6)}" height="${round(parent.h - 6)}" rx="3" fill="none" stroke="${colors.stroke}" stroke-width="1"/>`;
    }
    const childrenSvg = adaptiveNode.children.map((child) => `<g class="tree-part tree-child" data-child-id="${esc(child.id)}">
      <rect x="${round(child.x)}" y="${round(child.y)}" width="${round(child.w)}" height="${round(child.h)}" rx="3" fill="#FFFFFF" stroke="#64748B" stroke-width=".9"/>
      ${textSvg({
        text: child.label,
        x: child.x + child.w / 2,
        y: child.y + child.h / 2,
        fontSize: fonts.secondary,
        weight: 500,
        fill: colors.text,
        maxChars: Math.max(3, Math.ceil(child.label.length / (child.lines ?? 1))),
        maxLines: 2
      })}
    </g>`).join('');
    const badge = dashed ? (() => {
      const text = node.status === 'optional' ? '可选' : '待定';
      const width = fonts.legend * 2.5;
      return `<g class="status-badge"><rect x="${round(parent.x + parent.w - width - 3)}" y="${round(parent.y + 3)}" width="${round(width)}" height="${round(fonts.legend * 1.5)}" rx="2" fill="#FFFFFF" stroke="#64748B" stroke-width=".8"/>${textSvg({text, x: parent.x + parent.w - width / 2 - 3, y: parent.y + 3 + fonts.legend * .75, fontSize: fonts.legend, weight: 650, maxChars: 2, maxLines: 1})}</g>`;
    })() : '';
    return `<g id="${svgId('node', node.id)}" class="route-node tree-node" data-node-id="${esc(node.id)}" data-child-layout="tree">
      <g class="tree-part tree-parent">${parentShape}${textSvg({text: node.label, x: parent.x + parent.w / 2, y: parent.y + parent.h / 2, fontSize, weight: isOutput ? 800 : 650, fill: colors.text, maxChars: parentMaxChars, maxLines: 2})}${badge}</g>
      ${childrenSvg}
    </g>`;
  }
  const labelLines = children.length ? 1 : 2;
  const maxChars = Math.max(4, Math.floor((box.w - 16) / (fontSize * .92)));
  let shape;
  if (isDecision) {
    const points = `${box.x + box.w / 2},${box.y} ${box.x + box.w},${box.y + box.h / 2} ${box.x + box.w / 2},${box.y + box.h} ${box.x},${box.y + box.h / 2}`;
    shape = `<polygon points="${points}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${isOutput ? accentBorderWidth : borderWidth}"${strokeDash}/>`;
  } else {
    shape = `<rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.w)}" height="${round(box.h)}" rx="${isOutput ? 5 : 4}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${isOutput ? accentBorderWidth : borderWidth}"${strokeDash}/>`;
    if (isOutput) {
      shape += `<rect x="${round(box.x + 3)}" y="${round(box.y + 3)}" width="${round(box.w - 6)}" height="${round(box.h - 6)}" rx="3" fill="none" stroke="${colors.stroke}" stroke-width="1"/>`;
    }
  }
  let content = '';
  if (adaptiveNode?.mode === 'single-child') {
    const child = children[0];
    content += textSvg({
      text: node.label,
      x: box.x + box.w / 2,
      y: box.y + box.h / 2 - fontSize * .55,
      fontSize,
      weight: isOutput ? 800 : 650,
      fill: colors.text,
      maxChars,
      maxLines: 2
    });
    content += textSvg({
      text: child?.label ?? node.sublabel ?? '',
      x: box.x + box.w / 2,
      y: box.y + box.h - fonts.secondary * 1.15,
      fontSize: fonts.secondary,
      weight: 500,
      fill: colors.text,
      maxChars: Math.max(4, Math.floor((box.w - 14) / (fonts.secondary * .88))),
      maxLines: 1
    });
  } else if (children.length) {
    const labelY = box.y + Math.max(13, fontSize);
    content += textSvg({text: node.label, x: box.x + box.w / 2, y: labelY, fontSize, weight: isOutput ? 800 : 650, fill: colors.text, maxChars, maxLines: 1});
    const columns = children.length <= 2 ? 1 : 2;
    const rows = Math.ceil(children.length / columns);
    const gap = 3;
    const innerX = box.x + 7;
    const innerY = box.y + fontSize * 1.7 + 6;
    const availableH = Math.max(12, box.y + box.h - innerY - 6);
    const childH = (availableH - gap * (rows - 1)) / rows;
    const childW = (box.w - 14 - gap * (columns - 1)) / columns;
    childLayouts[node.id] = [];
    children.forEach((child, index) => {
      const col = index % columns; const row = Math.floor(index / columns);
      const x = innerX + col * (childW + gap);
      const y = innerY + row * (childH + gap);
      childLayouts[node.id].push({id: child.id, x, y, w: childW, h: childH});
      content += `<rect x="${round(x)}" y="${round(y)}" width="${round(childW)}" height="${round(childH)}" rx="2" fill="#FFFFFF" fill-opacity=".62" stroke="#64748B" stroke-width=".8"/>`;
      content += textSvg({
        text: child.label,
        x: x + childW / 2,
        y: y + childH / 2,
        fontSize: fonts.secondary,
        weight: 500,
        fill: colors.text,
        maxChars: Math.max(3, Math.floor((childW - 6) / (fonts.secondary * .9))),
        maxLines: Math.max(1, Math.floor(childH / (fonts.secondary * 1.15)))
      });
    });
  } else {
    const hasSub = Boolean(node.sublabel);
    content += textSvg({
      text: node.label,
      x: box.x + box.w / 2,
      y: box.y + box.h / 2 - (hasSub ? fontSize * .55 : 0),
      fontSize,
      weight: isOutput ? 800 : 650,
      fill: colors.text,
      maxChars,
      maxLines: labelLines
    });
    if (hasSub) {
      content += textSvg({
        text: node.sublabel,
        x: box.x + box.w / 2,
        y: box.y + box.h - fonts.secondary * .9,
        fontSize: fonts.secondary,
        weight: 400,
        fill: colors.text,
        maxChars: Math.max(5, Math.floor((box.w - 14) / (fonts.secondary * .88))),
        maxLines: 2
      });
    }
  }
  const badge = dashed ? (() => {
    const text = node.status === 'optional' ? '可选' : '待定';
    const width = fonts.legend * 2.5;
    return `<g class="status-badge"><rect x="${round(box.x + box.w - width - 3)}" y="${round(box.y + 3)}" width="${round(width)}" height="${round(fonts.legend * 1.5)}" rx="2" fill="#FFFFFF" stroke="#64748B" stroke-width=".8"/>${textSvg({text, x: box.x + box.w - width / 2 - 3, y: box.y + 3 + fonts.legend * .75, fontSize: fonts.legend, weight: 650, maxChars: 2, maxLines: 1})}</g>`;
  })() : '';
  return `<g id="${svgId('node', node.id)}" class="route-node" data-node-id="${esc(node.id)}">${shape}${content}${badge}</g>`;
}).join('');

const outcomeLayout = (() => {
  const band = design.outcome_band;
  if (!band) return {svg: '', layout: null};
  const items = band.items ?? [];
  const titleHeight = Math.max(34, fonts.stage * 1.8);
  const gap = 12;
  const innerX = band.x + 14;
  const itemY = band.y + titleHeight + 20;
  const itemH = Math.max(40, band.height - titleHeight - 34);
  const itemW = (band.width - 28 - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
  const itemLayouts = [];
  const itemSvg = items.map((item, index) => {
    const x = item.x ?? innerX + index * (itemW + gap);
    const y = item.y ?? itemY;
    const w = item.w ?? itemW;
    const h = item.h ?? itemH;
    itemLayouts.push({x, y, w, h, label: item.label, kind: item.kind ?? 'outcome'});
    return `<g id="${svgId('outcome', item.id ?? `${index + 1}`)}" class="outcome-item">
      <rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="4" fill="#FFFFFF" stroke="#475569" stroke-width="${borderWidth}"/>
      ${textSvg({text: item.label, x: x + w / 2, y: y + h / 2 - (item.sublabel ? fonts.node * .65 : 0), fontSize: fonts.node, weight: 750, maxChars: Math.max(5, Math.floor((w - 14) / fonts.node)), maxLines: 2})}
      ${item.sublabel ? textSvg({text: item.sublabel, x: x + w / 2, y: y + h / 2 + fonts.secondary * 1.1, fontSize: fonts.secondary, weight: 400, fill: design.theme.muted, maxChars: Math.max(6, Math.floor((w - 14) / fonts.secondary)), maxLines: 2}) : ''}
    </g>`;
  }).join('');
  return {
    svg: `<g class="outcome-band">
      <rect x="${band.x}" y="${band.y}" width="${band.width}" height="${band.height}" rx="5" fill="#F8FAFC" stroke="#475569" stroke-width="2"/>
      <rect x="${band.x + 12}" y="${band.y + 9}" width="${band.width - 24}" height="${titleHeight}" rx="3" fill="#DCE8F3" stroke="#64748B" stroke-width="1"/>
      ${textSvg({text: band.label ?? '预期成果与验收', x: band.x + band.width / 2, y: band.y + 9 + titleHeight / 2, fontSize: fonts.stage, weight: 800, maxChars: Math.floor((band.width - 30) / fonts.stage), maxLines: 1})}
      ${itemSvg}
    </g>`,
    layout: {...band, items: itemLayouts}
  };
})();

const legend = design.show_legend === false ? '' : textSvg({
  text: '粗实线：阶段递进　细实线：步骤/支撑　虚线：可选或待验证',
  x: W - 30,
  y: adaptiveLayout?.legend_y ?? H - fonts.legend,
  fontSize: fonts.legend,
  weight: 400,
  fill: design.theme.muted,
  maxChars: 60,
  maxLines: 1,
  anchor: 'end'
});

const semanticLayers = [
  'background-title',
  'headers',
  'stages',
  'connectors',
  'nodes',
  'outcomes',
  'legend'
];
const svg = `<svg id="route-map-svg" xmlns="http://www.w3.org/2000/svg" version="1.1" xml:space="preserve" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="route-map-title route-map-desc" data-editable-svg="office-compatible">
  <title id="route-map-title">${esc(title)}</title>
  <desc id="route-map-desc">${esc(description)}</desc>
  <g id="layer-background-title" data-layer="background-title">
    <rect width="${W}" height="${H}" fill="${design.theme.paper}"/>
    <rect x="28" y="18" width="${W - 56}" height="56" rx="5" fill="${design.theme.theory}" stroke="#334155" stroke-width="${borderWidth}"/>
    ${textSvg({text: title, x: W / 2, y: 46, fontSize: fonts.title, weight: 800, maxChars: Math.max(16, Math.floor((W - 90) / fonts.title)), maxLines: 2})}
  </g>
  <g id="layer-headers" data-layer="headers">${legacyLanesSvg}${columnHeadersSvg}</g>
  <g id="layer-stages" data-layer="stages">${groupSvg}</g>
  <g id="layer-connectors" data-layer="connectors">${edgeSvg}${connectorSvg.join('')}${treeRouteSvg}</g>
  <g id="layer-nodes" data-layer="nodes">${nodeSvg}</g>
  <g id="layer-outcomes" data-layer="outcomes">${outcomeLayout.svg}</g>
  <g id="layer-legend" data-layer="legend">${legend}</g>
</svg>`;

const readingOrder = graphReadingOrder(graph).filter((node) => visible.has(node.id));
const longDescription = groups.length
  ? groups.map((group) => {
    const nodes = readingOrder.filter((node) => node.group === group.id);
    return `<section><h2>${esc(group.label)}</h2><ol>${nodes.map((node) => {
      const children = (node.children ?? []).map((child) => `<li>${esc(child.label)}</li>`).join('');
      return `<li><strong>${esc(node.label)}</strong>${node.sublabel ? `：${esc(node.sublabel)}` : ''}${children ? `<ul>${children}</ul>` : ''}</li>`;
    }).join('')}</ol></section>`;
  }).join('')
  : `<ol>${readingOrder.map((node) => {
    const children = (node.children ?? []).map((child) => `<li>${esc(child.label)}</li>`).join('');
    return `<li><strong>${esc(node.label)}</strong>${node.sublabel ? `：${esc(node.sublabel)}` : ''}${children ? `<ul>${children}</ul>` : ''}</li>`;
  }).join('')}</ol>`;

const html = `<!doctype html>
<html lang="${esc(graph.meta.language ?? 'zh-CN')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;background:#E5E7EB;color:#1F2937;font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",Arial,sans-serif}
    body{padding:0}
    #route-map{width:${W}px;height:${H}px;margin:0 auto;background:#fff}
    #route-map-svg{display:block;width:${W}px;height:${H}px;max-width:none}
    .route-map-viewport{width:100%;overflow:auto}
    .route-map-accessible{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
    @media(max-width:${W}px){
      #route-map{width:100%;height:auto}
      #route-map-svg{width:100%;height:auto}
    }
    @media print{
      @page{${design.page_mode === 'content-fit' ? '' : `size:${design.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};`}margin:0}
      html,body{background:#fff}
      #route-map{width:100%;height:auto}
      #route-map-svg{width:100%;height:auto}
    }
  </style>
</head>
<body>
  <div class="route-map-viewport">
    <main id="route-map" aria-describedby="route-map-long-description">${svg}</main>
  </div>
  <article id="route-map-long-description" class="route-map-accessible">
    <h1>${esc(title)}</h1>
    <p>${esc(description)}</p>
    ${longDescription}
  </article>
</body>
</html>`;

fs.writeFileSync(path.join(project, 'route-map.svg'), svg);
fs.writeFileSync(path.join(project, 'route-map.html'), html);
const paletteChecks = {
  ink_on_paper: contrastRatio(design.theme.ink, design.theme.paper),
  ink_on_theory: contrastRatio(design.theme.ink, design.theme.theory),
  white_on_accent: contrastRatio('#FFFFFF', design.theme.accent),
  muted_on_paper: contrastRatio(design.theme.muted, design.theme.paper)
};
writeJsonFile(project, 'render-layout.json', {
  schema_version: designInput.schema_version,
  route_mode: graph.meta.route_mode,
  layout_strategy: design.layout_strategy,
  page_mode: design.page_mode,
  orientation: design.orientation,
  canvas: {width: W, height: H},
  target_png: design.target_png,
  regions: adaptiveLayout?.regions ?? [],
  headers: columnHeaders,
  bounds,
  node_anchors: nodeAnchors,
  node_layouts: adaptiveLayout?.node_layouts ?? {},
  child_layouts: childLayouts,
  tree_routes: treeRoutes,
  group_rows: groupRows,
  region_cells: adaptiveLayout?.region_cells ?? {},
  visual_groups: Object.fromEntries(groups.map((group) => [group.id, visualGroup(group.id)])),
  stage_boxes: adaptiveLayout?.stage_boxes ?? {},
  group_metrics: adaptiveLayout?.group_metrics ?? {},
  edge_routes: [...edgeRoutes, ...structuralRoutes],
  rendered_graph_edges: edgeRoutes.length,
  structural_edges: structuralRoutes.length + treeRoutes.length,
  outcome_band: outcomeLayout.layout,
  content_bbox: adaptiveLayout?.content_bbox ?? null,
  typography_pt: design.typography_pt,
  palette_checks: paletteChecks,
  standalone_svg_file: 'route-map.svg',
  standalone_svg_sha256: sha256(svg),
  embedded_svg_sha256: sha256(svg),
  editable_svg: {
    office_compatible: true,
    svg_version: '1.1',
    text_as_text: true,
    external_resources: false,
    scripts: false,
    foreign_object: false,
    marker_arrowheads: false
  },
  semantic_layers: semanticLayers,
  accessible_description: description,
  static_only: true
});
console.log(`Wrote editable ${path.join(project, 'route-map.svg')} and static ${path.join(project, 'route-map.html')}`);
