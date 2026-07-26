import {
  laneKindMap,
  typographyPx,
  visibleNodeSet
} from './route-utils.mjs';

const MARGIN = 28;
const REGION_GAP = 16;
const STAGE_GAP = 18;
const NODE_GAP = 14;
const METHOD_GAP = 12;
const GROUP_TOP = 140;
const GROUP_HEADER_INSET = 8;
const GROUP_HEADER_HEIGHT = 36;
const GROUP_BODY_GAP = 12;
const GROUP_BOTTOM_PADDING = 12;
const TREE_CHILD_GAP = 8;
const TREE_CONNECTOR_HEIGHT = 24;
const TREE_CHILD_MIN_WIDTH = 72;
const TREE_CHILD_MAX_WIDTH = 120;
const TREE_CHILD_MIN_HEIGHT = 34;
const STAGE_WIDTH = 112;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const textWidth = (value, fontSize) => {
  let width = 0;
  for (const char of String(value ?? '')) {
    if (/\s/.test(char)) width += fontSize * .32;
    else if (/[\u0000-\u00ff]/.test(char)) width += fontSize * .57;
    else width += fontSize;
  }
  return width;
};

const linesNeeded = (value, usableWidth, fontSize) => (
  Math.max(1, Math.ceil(textWidth(value, fontSize) / Math.max(1, usableWidth)))
);

const labelHeight = (value, usableWidth, fontSize, maximumLines = 2) => {
  const lines = linesNeeded(value, usableWidth, fontSize);
  if (lines > maximumLines) {
    throw new Error(`label “${value}” needs ${lines} lines; maximum is ${maximumLines}`);
  }
  return Math.max(34, lines * fontSize * 1.18 + 12);
};

const defaultRegionLabel = (lane, graph, design) => {
  const kind = lane.kind;
  const aliases = {
    thinking: 'thinking',
    primary: 'content',
    method: 'methods',
    data: 'methods'
  };
  const key = aliases[kind] ?? lane.id;
  if (design.region_labels?.[lane.id]) return design.region_labels[lane.id];
  if (design.region_labels?.[key]) return design.region_labels[key];
  if (
    kind === 'primary'
    && graph.nodes.some((node) => node.lane === lane.id && node.role === 'stage_output')
    && !/输出/.test(lane.label ?? '')
  ) return `${lane.label ?? '研究内容'}与阶段输出`;
  return lane.label ?? lane.id;
};

const fontForNode = (node, laneKinds, fonts) => (
  node.role === 'method'
  || node.kind === 'method'
  || ['method', 'data'].includes(laneKinds.get(node.lane))
    ? fonts.method
    : fonts.node
);

function intrinsicNode(node, design, laneKinds, fonts) {
  const children = Array.isArray(node.children) ? node.children.slice(0, 4) : [];
  const requested = design.child_layout_overrides?.[node.id] ?? design.child_layout_mode ?? 'tree';
  const fontSize = fontForNode(node, laneKinds, fonts);
  const isTree = children.length >= 2 && requested === 'tree';

  if (isTree) {
    const childSizes = children.map((child) => {
      // Leave a full glyph of horizontal breathing room on both sides. Browser
      // CJK fallback metrics are often wider than the deterministic estimator.
      const desired = textWidth(child.label, fonts.secondary) + 24;
      const width = clamp(desired, TREE_CHILD_MIN_WIDTH, TREE_CHILD_MAX_WIDTH);
      const requiredLines = linesNeeded(child.label, width - 12, fonts.secondary);
      if (requiredLines > 2) {
        throw new Error(`node ${node.id} child “${child.label}” needs more than two lines at 120px`);
      }
      return {
        id: child.id,
        label: child.label,
        w: width,
        h: Math.max(TREE_CHILD_MIN_HEIGHT, requiredLines * fonts.secondary * 1.16 + 12),
        lines: requiredLines
      };
    });
    const leavesWidth = childSizes.reduce((sum, child) => sum + child.w, 0)
      + TREE_CHILD_GAP * Math.max(0, childSizes.length - 1);
    const width = Math.max(120, leavesWidth);
    const parentHeight = labelHeight(node.label, width - 18, fontSize, 2);
    const childHeight = Math.max(...childSizes.map((child) => child.h));
    const childY = parentHeight + TREE_CONNECTOR_HEIGHT;
    let cursor = (width - leavesWidth) / 2;
    const childBoxes = childSizes.map((child) => {
      const box = {id: child.id, label: child.label, x: cursor, y: childY, w: child.w, h: childHeight};
      cursor += child.w + TREE_CHILD_GAP;
      return box;
    });
    const busY = parentHeight + TREE_CONNECTOR_HEIGHT / 2;
    const centers = childBoxes.map((child) => child.x + child.w / 2);
    const routes = [
      [{x: width / 2, y: parentHeight}, {x: width / 2, y: busY}],
      ...(centers.length > 1 ? [[
        {x: centers[0], y: busY},
        {x: centers.at(-1), y: busY}
      ]] : []),
      ...childBoxes.map((child) => [
        {x: child.x + child.w / 2, y: busY},
        {x: child.x + child.w / 2, y: child.y}
      ])
    ];
    return {
      id: node.id,
      mode: 'tree',
      w: width,
      h: childY + childHeight,
      parent: {x: 0, y: 0, w: width, h: parentHeight},
      anchor: {x: 0, y: 0, w: width, h: parentHeight},
      children: childBoxes,
      routes
    };
  }

  if (children.length >= 2) {
    const columns = children.length <= 2 ? 1 : 2;
    const rows = Math.ceil(children.length / columns);
    const width = clamp(Math.max(textWidth(node.label, fontSize) + 22, 160), 160, 230);
    const height = Math.max(78, 34 + rows * 30 + Math.max(0, rows - 1) * 3 + 8);
    return {
      id: node.id,
      mode: 'grid',
      w: width,
      h: height,
      parent: {x: 0, y: 0, w: width, h: height},
      anchor: {x: 0, y: 0, w: width, h: height},
      children: []
    };
  }

  const extra = children.length === 1 ? 24 : 0;
  const label = children.length === 1 ? `${node.label} ${children[0].label}` : node.label;
  const width = clamp(textWidth(label, fontSize) + 28, 120, 230);
  const height = labelHeight(label, width - 18, fontSize, 2) + extra;
  return {
    id: node.id,
    mode: children.length === 1 ? 'single-child' : 'card',
    w: width,
    h: Math.max(58, height),
    parent: {x: 0, y: 0, w: width, h: Math.max(58, height)},
    anchor: {x: 0, y: 0, w: width, h: Math.max(58, height)},
    children: []
  };
}

const orderedLaneNodes = (graph, group, lane, visible, design) => {
  const members = graph.nodes.filter((node) => (
    node.group === group.id && node.lane === lane.id && visible.has(node.id)
  ));
  if (lane.kind !== 'primary') return members;
  const specified = (design.stage_flow_nodes?.[group.id] ?? [])
    .map((id) => members.find((node) => node.id === id))
    .filter(Boolean);
  const selected = new Set(specified.map((node) => node.id));
  return [...specified, ...members.filter((node) => !selected.has(node.id))];
};

const packPrimary = (nodes, templates, capacity, allowWrap) => {
  if (!nodes.length) return [];
  const singleWidth = nodes.reduce((sum, node) => sum + templates[node.id].w, 0)
    + NODE_GAP * Math.max(0, nodes.length - 1);
  if (singleWidth <= capacity) return [nodes];
  if (!allowWrap) throw new Error(`primary flow needs ${Math.ceil(singleWidth)}px but only ${Math.floor(capacity)}px is available`);
  const rows = [];
  let row = [];
  let used = 0;
  for (const node of nodes) {
    const width = templates[node.id].w;
    if (width > capacity) throw new Error(`node ${node.id} is wider than its content region`);
    const next = row.length ? used + NODE_GAP + width : width;
    if (row.length && next > capacity) {
      rows.push(row);
      row = [node];
      used = width;
    } else {
      row.push(node);
      used = next;
    }
  }
  if (row.length) rows.push(row);
  if (rows.length > 2) throw new Error('primary flow requires more than two rows; split the stage or shorten labels');
  return rows;
};

const translateBox = (box, x, y) => ({x: x + box.x, y: y + box.y, w: box.w, h: box.h});

const translateTemplate = (template, x, y) => ({
  mode: template.mode,
  bounds: {x, y, w: template.w, h: template.h},
  parent: translateBox(template.parent, x, y),
  anchor: translateBox(template.anchor, x, y),
  children: (template.children ?? []).map((child) => ({
    ...child,
    x: x + child.x,
    y: y + child.y
  })),
  routes: (template.routes ?? []).map((route) => route.map((point) => ({
    x: x + point.x,
    y: y + point.y
  })))
});

function buildRegions(graph, design, visible, templates, width) {
  const stageEnabled = graph.meta.route_mode === 'research-process' && design.stage_rail?.enabled !== false;
  const visibleLanes = graph.lanes.filter((lane) => graph.nodes.some((node) => (
    node.lane === lane.id && visible.has(node.id)
  )));
  const regions = [];
  if (stageEnabled) {
    const stageLabel = design.stage_rail?.semantic_role === 'thinking'
      ? design.region_labels.thinking
      : design.region_labels.stage;
    regions.push({id: 'stage', kind: 'stage', lane: null, label: stageLabel, minimum: STAGE_WIDTH});
  }
  for (const lane of visibleLanes) {
    const members = graph.nodes.filter((node) => node.lane === lane.id && visible.has(node.id));
    const maximumNodeWidth = Math.max(0, ...members.map((node) => templates[node.id].w));
    const base = lane.kind === 'thinking' ? 150
      : lane.kind === 'primary' ? 300
        : ['method', 'data'].includes(lane.kind) ? 210
          : 180;
    regions.push({
      id: lane.id,
      kind: lane.kind,
      lane: lane.id,
      label: defaultRegionLabel(lane, graph, design),
      minimum: Math.max(base, Math.ceil(maximumNodeWidth))
    });
  }
  const gaps = REGION_GAP * Math.max(0, regions.length - 1);
  const available = width - MARGIN * 2 - gaps;
  const primary = regions.filter((region) => region.kind === 'primary');
  const fixed = regions.filter((region) => region.kind !== 'primary');
  const fixedWidth = fixed.reduce((sum, region) => sum + region.minimum, 0);
  const primaryMinimum = primary.reduce((sum, region) => sum + region.minimum, 0);
  if (fixedWidth + primaryMinimum > available) {
    throw new Error(`visible regions need ${fixedWidth + primaryMinimum + gaps + MARGIN * 2}px, wider than ${width}px`);
  }
  const primaryShare = primary.length ? (available - fixedWidth) / primary.length : 0;
  let cursor = MARGIN;
  for (const region of regions) {
    const regionWidth = region.kind === 'primary'
      ? primaryShare
      : region.minimum;
    region.x = cursor;
    region.y = 84;
    region.w = regionWidth;
    region.h = 38;
    cursor += regionWidth + REGION_GAP;
  }
  return regions;
}

function attemptLayout(graph, design, width, allowWrap) {
  const fonts = typographyPx(design);
  const visible = visibleNodeSet(graph, design);
  const laneKinds = laneKindMap(graph);
  const templates = Object.fromEntries(graph.nodes
    .filter((node) => visible.has(node.id))
    .map((node) => [node.id, intrinsicNode(node, design, laneKinds, fonts)]));
  const regions = buildRegions(graph, design, visible, templates, width);
  const regionByLane = new Map(regions.filter((region) => region.lane).map((region) => [region.lane, region]));
  const stageRegion = regions.find((region) => region.kind === 'stage') ?? null;
  const primaryRegion = regions.find((region) => region.kind === 'primary') ?? null;
  const groups = [...graph.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const bounds = {};
  const nodeAnchors = {};
  const nodeLayouts = {};
  const childLayouts = {};
  const treeRoutes = [];
  const groupRows = {};
  const regionCells = {};
  const visualGroups = {};
  const stageBoxes = {};
  const groupMetrics = {};
  let y = GROUP_TOP;

  for (const group of groups) {
    const lanePlans = [];
    for (const lane of graph.lanes) {
      const region = regionByLane.get(lane.id);
      if (!region) continue;
      const nodes = orderedLaneNodes(graph, group, lane, visible, design);
      if (!nodes.length) {
        lanePlans.push({lane, region, nodes, rows: [], height: 0});
        continue;
      }
      const capacity = region.w - 16;
      if (lane.kind === 'primary') {
        const rows = packPrimary(nodes, templates, capacity, allowWrap);
        const rowHeights = rows.map((row) => Math.max(...row.map((node) => templates[node.id].h)));
        const height = rowHeights.reduce((sum, value) => sum + value, 0)
          + NODE_GAP * Math.max(0, rows.length - 1);
        lanePlans.push({lane, region, nodes, rows, rowHeights, height});
      } else {
        const gap = ['method', 'data'].includes(lane.kind) ? METHOD_GAP : NODE_GAP;
        const height = nodes.reduce((sum, node) => sum + templates[node.id].h, 0)
          + gap * Math.max(0, nodes.length - 1);
        lanePlans.push({lane, region, nodes, rows: [], height, gap});
      }
    }

    const cellRequiredHeights = Object.fromEntries(regions.map((region) => {
      if (region.kind === 'stage') return [region.id, 0];
      const plan = lanePlans.find((candidate) => candidate.region.id === region.id);
      const bodyHeight = plan?.height ?? 0;
      const requiredHeight = region.kind === 'primary'
        ? GROUP_HEADER_INSET + GROUP_HEADER_HEIGHT + GROUP_BODY_GAP
          + bodyHeight + GROUP_BOTTOM_PADDING
        : GROUP_BOTTOM_PADDING * 2 + bodyHeight;
      return [region.id, requiredHeight];
    }));
    const maximumRequiredHeight = Math.max(64, ...Object.values(cellRequiredHeights));
    const rowHeight = maximumRequiredHeight;
    groupRows[group.id] = {x: MARGIN, y, width: width - MARGIN * 2, height: rowHeight};
    regionCells[group.id] = Object.fromEntries(regions.map((region) => [
      region.id,
      {
        x: region.x,
        y,
        width: region.w,
        height: rowHeight,
        lane: region.lane,
        kind: region.kind
      }
    ]));
    if (primaryRegion) visualGroups[group.id] = {...regionCells[group.id][primaryRegion.id]};
    if (stageRegion) {
      stageBoxes[group.id] = {...regionCells[group.id][stageRegion.id]};
    }
    groupMetrics[group.id] = {
      content_height: lanePlans.find((plan) => plan.lane.kind === 'primary')?.height ?? 0,
      required_height: maximumRequiredHeight,
      internal_vertical_slack: rowHeight - maximumRequiredHeight,
      lane_heights: Object.fromEntries(lanePlans.map((plan) => [plan.lane.id, plan.height])),
      cell_required_heights: cellRequiredHeights
    };

    for (const plan of lanePlans) {
      if (!plan.nodes.length) continue;
      if (plan.lane.kind === 'primary') {
        const bodyTop = y + GROUP_HEADER_INSET + GROUP_HEADER_HEIGHT + GROUP_BODY_GAP;
        const availableHeight = rowHeight
          - GROUP_HEADER_INSET - GROUP_HEADER_HEIGHT - GROUP_BODY_GAP - GROUP_BOTTOM_PADDING;
        let rowY = bodyTop + (availableHeight - plan.height) / 2;
        plan.rows.forEach((row, rowIndex) => {
          const totalWidth = row.reduce((sum, node) => sum + templates[node.id].w, 0)
            + NODE_GAP * Math.max(0, row.length - 1);
          let x = plan.region.x + (plan.region.w - totalWidth) / 2;
          const rowHeightValue = plan.rowHeights[rowIndex];
          for (const node of row) {
            const template = templates[node.id];
            const nodeY = rowY + (rowHeightValue - template.h) / 2;
            const translated = translateTemplate(template, x, nodeY);
            nodeLayouts[node.id] = translated;
            bounds[node.id] = translated.bounds;
            nodeAnchors[node.id] = translated.anchor;
            if (translated.children.length) childLayouts[node.id] = translated.children;
            translated.routes.forEach((points, index) => treeRoutes.push({
              id: `${node.id}-tree-${index + 1}`,
              node_id: node.id,
              kind: 'containment',
              points,
              segments: points.length - 1,
              dashed: false
            }));
            x += template.w + NODE_GAP;
          }
          rowY += rowHeightValue + NODE_GAP;
        });
      } else {
        const bodyTop = y + GROUP_BOTTOM_PADDING;
        const availableHeight = rowHeight - GROUP_BOTTOM_PADDING * 2;
        let nodeY = bodyTop + (availableHeight - plan.height) / 2;
        for (const node of plan.nodes) {
          const template = templates[node.id];
          const x = plan.region.x + (plan.region.w - template.w) / 2;
          const translated = translateTemplate(template, x, nodeY);
          nodeLayouts[node.id] = translated;
          bounds[node.id] = translated.bounds;
          nodeAnchors[node.id] = translated.anchor;
          if (translated.children.length) childLayouts[node.id] = translated.children;
          translated.routes.forEach((points, index) => treeRoutes.push({
            id: `${node.id}-tree-${index + 1}`,
            node_id: node.id,
            kind: 'containment',
            points,
            segments: points.length - 1,
            dashed: false
          }));
          nodeY += template.h + plan.gap;
        }
      }
    }
    y += rowHeight + STAGE_GAP;
  }

  const lastGroupBottom = groups.length
    ? groupRows[groups.at(-1).id].y + groupRows[groups.at(-1).id].height
    : GROUP_TOP;
  const outcomeInput = design.outcome_band;
  let outcomeBand = null;
  let contentBottom = lastGroupBottom;
  if (outcomeInput) {
    const items = outcomeInput.items ?? [];
    const titleHeight = Math.max(34, fonts.stage * 1.8);
    const gap = 12;
    const x = MARGIN;
    const bandWidth = width - MARGIN * 2;
    const innerX = x + 14;
    const itemWidth = (bandWidth - 28 - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
    const itemLines = items.map((item) => linesNeeded(item.label, itemWidth - 16, fonts.node));
    if (itemLines.some((lines) => lines > 2)) throw new Error('outcome item needs more than two lines');
    const itemHeight = Math.max(58, ...itemLines.map((lines) => lines * fonts.node * 1.2 + 18));
    const bandY = lastGroupBottom + STAGE_GAP;
    const itemY = bandY + 9 + titleHeight + 14;
    const bandHeight = 9 + titleHeight + 14 + itemHeight + 14;
    outcomeBand = {
      ...outcomeInput,
      x,
      y: bandY,
      width: bandWidth,
      height: bandHeight,
      items: items.map((item, index) => ({
        ...item,
        x: innerX + index * (itemWidth + gap),
        y: itemY,
        w: itemWidth,
        h: itemHeight
      }))
    };
    contentBottom = bandY + bandHeight;
  }

  const legendHeight = design.show_legend === false ? 0 : 18;
  const legendY = contentBottom + (legendHeight ? 16 : 0);
  if (legendHeight) contentBottom = legendY + legendHeight;
  const resolvedHeight = design.page_mode === 'a4'
    ? (width === 1754 ? 1240 : 1754)
    : Math.ceil(contentBottom + MARGIN);
  if (contentBottom + MARGIN > resolvedHeight) {
    throw new Error(`content height ${Math.ceil(contentBottom + MARGIN)}px exceeds resolved page height ${resolvedHeight}px`);
  }
  const scale = design.target_png?.scale ?? 2;
  const dpi = design.target_png?.dpi ?? 300;
  return {
    adaptive: true,
    orientation: width === 1754 ? 'landscape' : 'portrait',
    canvas: {width, height: resolvedHeight},
    target_png: {width: width * scale, height: resolvedHeight * scale, dpi},
    regions: regions.map((region) => ({
      id: region.id,
      lane: region.lane,
      kind: region.kind,
      label: region.label,
      x: region.x,
      y: region.y,
      w: region.w,
      h: region.h
    })),
    headers: regions.map((region) => ({
      id: region.id,
      lane: region.lane,
      label: region.label,
      x: region.x,
      y: region.y,
      w: region.w,
      h: region.h
    })),
    bounds,
    node_anchors: nodeAnchors,
    node_layouts: nodeLayouts,
    child_layouts: childLayouts,
    tree_routes: treeRoutes,
    group_rows: groupRows,
    region_cells: regionCells,
    visual_groups: visualGroups,
    stage_boxes: stageBoxes,
    group_metrics: groupMetrics,
    outcome_band: outcomeBand,
    legend_y: legendY,
    content_bbox: {
      x: MARGIN,
      y: 18,
      w: width - MARGIN * 2,
      h: contentBottom - 18,
      bottom: contentBottom
    }
  };
}

export function computeAdaptiveLayout(graph, design) {
  if (design.layout_strategy !== 'adaptive') {
    throw new Error('computeAdaptiveLayout requires layout_strategy adaptive');
  }
  const requested = design.orientation ?? 'auto';
  const attempts = requested === 'auto'
    ? [{width: 1240, allowWrap: false}, {width: 1754, allowWrap: true}]
    : requested === 'landscape'
      ? [{width: 1754, allowWrap: true}]
      : [{width: 1240, allowWrap: true}];
  const failures = [];
  for (const attempt of attempts) {
    try {
      return attemptLayout(graph, design, attempt.width, attempt.allowWrap);
    } catch (error) {
      failures.push(`${attempt.width}px: ${error.message}`);
    }
  }
  throw new Error(`adaptive layout failed (${failures.join('; ')})`);
}

export const adaptiveConstants = {
  margin: MARGIN,
  region_gap: REGION_GAP,
  stage_gap: STAGE_GAP,
  node_gap: NODE_GAP,
  method_gap: METHOD_GAP,
  group_vertical_padding: GROUP_BOTTOM_PADDING,
  tree_child_gap: TREE_CHILD_GAP,
  tree_child_min_width: TREE_CHILD_MIN_WIDTH,
  tree_child_max_width: TREE_CHILD_MAX_WIDTH
};
