import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const GRAPH_VERSIONS = new Set(['1.0', '1.1', '1.2']);
export const DESIGN_VERSIONS = new Set(['1.0', '1.1', '1.2', '1.3', '1.4']);
export const ROUTE_MODES = new Set(['research-process', 'research-framework', 'technology-roadmap', 'study-flow']);
export const DOMAIN_PROFILES = new Set([
  'general',
  'experimental-biomedical',
  'clinical-interventional',
  'computational-data',
  'engineering-design',
  'social-policy',
  'evidence-synthesis'
]);
export const EDGE_KINDS = new Set(['sequence', 'causal', 'support', 'parallel', 'decision', 'feedback', 'containment']);
export const EDGE_STATUSES = new Set(['confirmed', 'optional', 'uncertain']);
export const NODE_KINDS = new Set(['process', 'sample', 'method', 'data', 'metric', 'conclusion', 'decision', 'milestone', 'capability', 'risk', 'note', 'variable', 'model']);
export const NODE_ROLES = new Set(['stage_question', 'input', 'work_package', 'method', 'indicator', 'validation', 'stage_output', 'theory', 'decision_gate', 'risk', 'note', 'research_question', 'literature_gap', 'variable', 'model', 'data_source']);
export const LAYOUT_MODES = new Set([
  'portrait-research-process',
  'landscape-research-process',
  'adaptive-research-process',
  'framework-matrix',
  'technology-time-layer',
  'study-flow'
]);
export const METHOD_RAIL_MODES = new Set(['aligned', 'mapped', 'hidden']);
export const LAYOUT_STRATEGIES = new Set(['explicit', 'adaptive']);
export const PAGE_MODES = new Set(['a4', 'content-fit']);
export const CHILD_LAYOUT_MODES = new Set(['tree', 'grid']);
export const SOURCE_TYPES = new Set(['external', 'user_file', 'user_statement']);
export const ACCESS_LEVELS = new Set(['full_text', 'abstract', 'metadata', 'user_supplied']);
export const EVIDENCE_CLASSES = new Set(['reported', 'synthesized', 'optional']);

export const DEFAULT_TYPOGRAPHY_PT = {
  title: 16,
  stage: 10,
  node: 8.5,
  method: 7.5,
  secondary: 7.5,
  legend: 7
};

export const DEFAULT_THEME = {
  ink: '#1F2937',
  muted: '#64748B',
  paper: '#FFFFFF',
  neutral: '#F3F4F6',
  theory: '#E6EEF9',
  method: '#E7F3F1',
  evidence: '#FFF2D8',
  accent: '#B93838',
  outcome: '#EAF4E2',
  validation: '#EEE8F8'
};

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const readJsonFile = (project, name) => JSON.parse(fs.readFileSync(path.join(project, name), 'utf8'));
export const readTextFile = (project, name) => fs.readFileSync(path.join(project, name), 'utf8');
export const writeJsonFile = (project, name, value) => {
  fs.writeFileSync(path.join(project, name), `${JSON.stringify(value, null, 2)}\n`);
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export function normalizeGraph(input) {
  const graph = clone(input);
  graph.meta ??= {};
  graph.meta.route_mode ??= 'research-process';
  graph.meta.domain_profile ??= 'general';
  graph.meta.not_applicable ??= [];
  graph.lanes ??= [];
  graph.groups ??= [];
  graph.nodes ??= [];
  graph.edges ??= [];
  for (const node of graph.nodes) {
    node.children ??= [];
    node.status ??= node.emphasis === 'uncertain' ? 'pending' : 'proposed';
  }
  for (const edge of graph.edges) {
    if (edge.kind === 'interaction') edge.kind = 'parallel';
    edge.status ??= 'confirmed';
  }
  return graph;
}

const defaultLayoutFor = (routeMode, orientation) => {
  if (routeMode === 'technology-roadmap') return 'technology-time-layer';
  if (routeMode === 'study-flow') return 'study-flow';
  if (routeMode === 'research-framework') return 'framework-matrix';
  return orientation === 'landscape' ? 'landscape-research-process' : 'portrait-research-process';
};

export function normalizeDesign(input, graph) {
  const design = clone(input);
  const routeMode = design.route_mode ?? graph.meta.route_mode ?? 'research-process';
  const sourceCanvas = design.canvas ?? {width: 1240, height: 1754};
  const orientation = design.orientation ?? (sourceCanvas.width > sourceCanvas.height ? 'landscape' : 'portrait');
  const adaptive = ['1.3', '1.4'].includes(input.schema_version) || design.layout_strategy === 'adaptive';
  const semanticResearchProcess = input.schema_version === '1.4' && routeMode === 'research-process';
  design.route_mode = routeMode;
  design.orientation = orientation;
  design.canvas = sourceCanvas;
  design.layout_strategy ??= adaptive ? 'adaptive' : 'explicit';
  design.page_mode ??= adaptive ? 'content-fit' : 'a4';
  design.child_layout_mode ??= adaptive ? 'tree' : 'grid';
  design.child_layout_overrides ??= {};
  design.region_labels = semanticResearchProcess ? {
    thinking: '研究思路',
    content: '研究内容与阶段输出',
    methods: '研究方法',
    ...(design.region_labels ?? {})
  } : {
    stage: '研究阶段',
    thinking: '研究思路',
    content: '研究内容与阶段输出',
    methods: '方法数据与指标',
    ...(design.region_labels ?? {})
  };
  if (semanticResearchProcess) {
    design.stage_rail = {
      enabled: true,
      semantic_role: 'thinking',
      ...(design.stage_rail ?? {})
    };
    design.method_rail_content ??= 'summary-only';
  }
  design.layout_mode = adaptive && routeMode === 'research-process'
    ? 'adaptive-research-process'
    : ({
    'portrait-technical-roadmap': 'portrait-research-process',
    'portrait-modular': 'framework-matrix'
  })[design.layout_mode] ?? design.layout_mode ?? defaultLayoutFor(routeMode, orientation);
  if (!design.method_rail_mode) {
    if (design.right_rail_mode === 'header_only') design.method_rail_mode = 'hidden';
    else if (design.show_method_support_edges === true) design.method_rail_mode = 'mapped';
    else design.method_rail_mode = 'aligned';
  }
  design.target_png ??= adaptive ? {scale: 2, dpi: 300} : {
      width: Math.round(sourceCanvas.width * 2),
      height: Math.round(sourceCanvas.height * 2),
      dpi: 300
    };
  design.typography_pt ??= ['1.2', '1.3', '1.4'].includes(input.schema_version) ? {...DEFAULT_TYPOGRAPHY_PT} : null;
  design.line_semantics ??= {orthogonal_only: true, max_segments: 3, optional_style: 'dashed'};
  design.render_edges = design.render_edges !== false;
  // Edge labels are useful for diagnostics, but they quickly collide with
  // dense research-route nodes. Keep the data in the graph and let each
  // design opt into labels explicitly when there is enough space.
  design.render_edge_labels = design.render_edge_labels !== false;
  design.show_feedback ??= false;
  design.visible_edge_ids ??= graph.edges.map((edge) => edge.id);
  design.hidden_node_ids ??= [];
  design.placements ??= {};
  design.group_placements ??= {};
  design.visual_group_placements ??= {};
  design.stage_flow_nodes ??= {};
  design.edge_paths ??= {};
  design.theme = {...DEFAULT_THEME, ...(design.theme ?? {})};
  return design;
}

export const ptToSourcePx = (pt) => Number(pt) * 150 / 72;

export function typographyPx(design) {
  if (design.typography_pt) {
    return Object.fromEntries(Object.entries({...DEFAULT_TYPOGRAPHY_PT, ...design.typography_pt})
      .map(([key, value]) => [key, ptToSourcePx(value)]));
  }
  return {
    title: design.typography?.title ?? 26,
    stage: design.typography?.stage ?? 16,
    node: design.typography?.node ?? 13,
    method: design.typography?.method ?? 12,
    secondary: design.typography?.sublabel ?? 11,
    legend: design.typography?.legend ?? 10
  };
}

export const boxFrom = (value) => value ? {
  x: Number(value.x),
  y: Number(value.y),
  w: Number(value.w ?? value.width),
  h: Number(value.h ?? value.height)
} : null;

export const placementFrom = (box) => box ? {
  x: box.x,
  y: box.y,
  width: box.w ?? box.width,
  height: box.h ?? box.height
} : null;

export const center = (box) => ({x: box.x + box.w / 2, y: box.y + box.h / 2});

export function laneKindMap(graph) {
  return new Map(graph.lanes.map((lane) => [lane.id, lane.kind]));
}

export function methodLikeNodeIds(graph) {
  const kinds = laneKindMap(graph);
  return new Set(graph.nodes
    .filter((node) => ['method', 'data'].includes(kinds.get(node.lane)) || node.role === 'method' || node.kind === 'method')
    .map((node) => node.id));
}

export function visibleNodeSet(graph, design) {
  const hidden = new Set(design.hidden_node_ids ?? []);
  if (design.method_rail_mode === 'hidden') {
    for (const id of methodLikeNodeIds(graph)) hidden.add(id);
  }
  return new Set(graph.nodes.filter((node) => !hidden.has(node.id)).map((node) => node.id));
}

/**
 * Keep a stage's visible sequence continuous when one or more internal
 * stage-flow nodes are intentionally hidden. The canonical graph remains
 * unchanged; the returned synthetic edges exist only in the rendered view.
 */
export function contractHiddenStageFlowEdges(graph, design, visible = visibleNodeSet(graph, design)) {
  const selected = new Set(design.visible_edge_ids ?? graph.edges.map((edge) => edge.id));
  const eligible = graph.edges.filter((edge) => selected.has(edge.id));
  const rendered = eligible.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  const directSequence = new Set(rendered
    .filter((edge) => edge.kind === 'sequence')
    .map((edge) => `${edge.from}\u0000${edge.to}`));
  const byPair = new Map(eligible
    .filter((edge) => edge.kind === 'sequence' && edge.status === 'confirmed')
    .map((edge) => [`${edge.from}\u0000${edge.to}`, edge]));
  const synthetic = [];

  for (const group of graph.groups) {
    const fullFlow = design.stage_flow_nodes?.[group.id] ?? [];
    const visibleFlow = fullFlow.filter((id) => visible.has(id));
    for (let index = 0; index < visibleFlow.length - 1; index += 1) {
      const from = visibleFlow[index];
      const to = visibleFlow[index + 1];
      const pairKey = `${from}\u0000${to}`;
      if (directSequence.has(pairKey)) continue;
      const fromIndex = fullFlow.indexOf(from);
      const toIndex = fullFlow.indexOf(to, fromIndex + 1);
      if (fromIndex < 0 || toIndex <= fromIndex + 1) continue;
      const sourceEdges = [];
      let complete = true;
      for (let cursor = fromIndex; cursor < toIndex; cursor += 1) {
        const edge = byPair.get(`${fullFlow[cursor]}\u0000${fullFlow[cursor + 1]}`);
        if (!edge) {
          complete = false;
          break;
        }
        sourceEdges.push(edge);
      }
      if (!complete || !sourceEdges.length) continue;
      const labels = [...new Set(sourceEdges.map((edge) => edge.label?.trim()).filter(Boolean))];
      synthetic.push({
        id: `bypass-${group.id}-${from}-${to}`,
        from,
        to,
        kind: 'sequence',
        status: 'confirmed',
        label: labels.join('·'),
        synthetic: true,
        source_edge_ids: sourceEdges.map((edge) => edge.id)
      });
      directSequence.add(pairKey);
    }
  }

  return [...rendered, ...synthetic];
}

function defaultGroupBoxes(graph, design) {
  const groups = [...graph.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const {width, height} = design.canvas;
  const startY = 142;
  const outcomeTop = design.outcome_band?.y ?? height - 44;
  const gap = 28;
  const available = outcomeTop - startY - gap * Math.max(0, groups.length - 1);
  const rowHeight = Math.max(150, available / Math.max(1, groups.length));
  return Object.fromEntries(groups.map((group, index) => [
    group.id,
    {x: 28, y: startY + index * (rowHeight + gap), width: width - 56, height: rowHeight}
  ]));
}

function laneSpecs(graph, design) {
  const supplied = design.lanes ?? [];
  const map = new Map(supplied.map((lane) => [lane.id, lane]));
  if (map.size) return map;
  const W = design.canvas.width;
  const thinking = graph.lanes.find((lane) => lane.kind === 'thinking');
  const primary = graph.lanes.find((lane) => lane.kind === 'primary') ?? graph.lanes[0];
  const method = graph.lanes.find((lane) => ['method', 'data'].includes(lane.kind));
  if (thinking) map.set(thinking.id, {id: thinking.id, x: 28, width: W * .11});
  if (primary) map.set(primary.id, {id: primary.id, x: W * .15, width: W * .64});
  if (method) map.set(method.id, {id: method.id, x: W * .81, width: W * .17});
  for (const lane of graph.lanes) {
    if (!map.has(lane.id)) map.set(lane.id, {id: lane.id, x: W * .15, width: W * .64});
  }
  return map;
}

export function computeBounds(graph, design) {
  const visible = visibleNodeSet(graph, design);
  const result = {};
  for (const node of graph.nodes) {
    if (!visible.has(node.id)) continue;
    const supplied = boxFrom(design.placements?.[node.id]);
    if (supplied && Object.values(supplied).every(Number.isFinite)) result[node.id] = supplied;
  }
  const groups = defaultGroupBoxes(graph, design);
  const laneMap = laneSpecs(graph, design);
  const graphLaneKinds = laneKindMap(graph);
  const allGroupBoxes = Object.fromEntries(graph.groups.map((group) => [
    group.id,
    design.group_placements?.[group.id] ?? groups[group.id]
  ]));
  for (const group of graph.groups) {
    const groupBox = placementFrom(allGroupBoxes[group.id]);
    if (!groupBox) continue;
    for (const lane of graph.lanes) {
      const missing = graph.nodes.filter((node) => (
        visible.has(node.id)
        && node.group === group.id
        && node.lane === lane.id
        && !result[node.id]
      ));
      if (!missing.length) continue;
      const spec = laneMap.get(lane.id) ?? {x: groupBox.x + 12, width: groupBox.width - 24};
      const top = groupBox.y + 56;
      const bottom = groupBox.y + groupBox.height - 14;
      const kind = graphLaneKinds.get(lane.id);
      if (kind === 'primary' && design.stage_flow_nodes?.[group.id]?.length) {
        const order = design.stage_flow_nodes[group.id].filter((id) => missing.some((node) => node.id === id));
        const remaining = missing.filter((node) => !order.includes(node.id));
        const nodes = [...order.map((id) => missing.find((node) => node.id === id)), ...remaining];
        const gap = 14;
        const w = Math.max(92, Math.min(190, (spec.width - gap * (nodes.length + 1)) / Math.max(1, nodes.length)));
        const y = top + Math.max(0, (bottom - top - 70) / 2);
        nodes.forEach((node, index) => {
          result[node.id] = {x: spec.x + gap + index * (w + gap), y, w, h: 70};
        });
      } else {
        const gap = 10;
        const rows = missing.length;
        const h = Math.min(66, Math.max(42, (bottom - top - gap * Math.max(0, rows - 1)) / Math.max(1, rows)));
        const w = Math.min(kind === 'primary' ? 250 : 190, spec.width - 16);
        missing.forEach((node, index) => {
          result[node.id] = {
            x: spec.x + (spec.width - w) / 2,
            y: top + index * (h + gap),
            w,
            h
          };
        });
      }
    }
  }
  const ungrouped = graph.nodes.filter((node) => visible.has(node.id) && !result[node.id]);
  ungrouped.forEach((node, index) => {
    const spec = laneMap.get(node.lane) ?? {x: 40, width: design.canvas.width - 80};
    result[node.id] = {
      x: spec.x + 10,
      y: 150 + index * 88,
      w: Math.min(240, spec.width - 20),
      h: 64
    };
  });
  return result;
}

export const dedupeOrthogonalPoints = (points) => {
  const unique = [];
  for (const point of points) {
    const p = {x: Number(point.x), y: Number(point.y)};
    const last = unique.at(-1);
    if (!last || Math.abs(last.x - p.x) > .01 || Math.abs(last.y - p.y) > .01) unique.push(p);
  }
  let changed = true;
  while (changed && unique.length > 2) {
    changed = false;
    for (let index = 1; index < unique.length - 1; index += 1) {
      const a = unique[index - 1];
      const b = unique[index];
      const c = unique[index + 1];
      if ((Math.abs(a.x - b.x) < .01 && Math.abs(b.x - c.x) < .01)
        || (Math.abs(a.y - b.y) < .01 && Math.abs(b.y - c.y) < .01)) {
        unique.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return unique;
};

export const isOrthogonalPoints = (points) => (
  Array.isArray(points)
  && points.length >= 2
  && points.every((point) => Number.isFinite(Number(point.x ?? point[0])) && Number.isFinite(Number(point.y ?? point[1])))
  && points.slice(1).every((point, index) => {
    const a = points[index];
    const ax = Number(a.x ?? a[0]); const ay = Number(a.y ?? a[1]);
    const bx = Number(point.x ?? point[0]); const by = Number(point.y ?? point[1]);
    return Math.abs(ax - bx) < .01 || Math.abs(ay - by) < .01;
  })
);

export const normalizePointArray = (value) => value.map((point) => ({
  x: Number(point.x ?? point[0]),
  y: Number(point.y ?? point[1])
}));

export const pathHasCurve = (value) => typeof value === 'string' && /[CQSTA]/i.test(value);

export function parseLinearSvgPath(value) {
  if (typeof value !== 'string' || pathHasCurve(value)) return null;
  const tokens = value.match(/[MLHVZmlhvz]|-?\d+(?:\.\d+)?/g);
  if (!tokens?.length) return null;
  const points = [];
  let index = 0;
  let command = null;
  let current = {x: 0, y: 0};
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[MLHVZmlhvz]$/.test(token)) {
      command = token;
      index += 1;
      if (/^[Zz]$/.test(command)) break;
      continue;
    }
    if (!command) return null;
    if (/^[MmLl]$/.test(command)) {
      const x = Number(tokens[index]); const y = Number(tokens[index + 1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      current = command === command.toLowerCase() ? {x: current.x + x, y: current.y + y} : {x, y};
      points.push({...current});
      index += 2;
      if (/^[Mm]$/.test(command)) command = command === 'm' ? 'l' : 'L';
    } else if (/^[Hh]$/.test(command)) {
      const x = Number(tokens[index]);
      current = {x: command === 'h' ? current.x + x : x, y: current.y};
      points.push({...current});
      index += 1;
    } else if (/^[Vv]$/.test(command)) {
      const y = Number(tokens[index]);
      current = {x: current.x, y: command === 'v' ? current.y + y : y};
      points.push({...current});
      index += 1;
    } else return null;
  }
  const result = dedupeOrthogonalPoints(points);
  return isOrthogonalPoints(result) ? result : null;
}

export function segmentIntersectsBox(a, b, box, padding = 2) {
  const left = box.x - padding;
  const right = box.x + box.w + padding;
  const top = box.y - padding;
  const bottom = box.y + box.h + padding;
  if (Math.abs(a.y - b.y) < .01) {
    const lo = Math.min(a.x, b.x); const hi = Math.max(a.x, b.x);
    return a.y > top && a.y < bottom && hi > left && lo < right;
  }
  if (Math.abs(a.x - b.x) < .01) {
    const lo = Math.min(a.y, b.y); const hi = Math.max(a.y, b.y);
    return a.x > left && a.x < right && hi > top && lo < bottom;
  }
  return true;
}

export function crossingNodeIds(points, bounds, excluded = new Set()) {
  const crossed = new Set();
  for (let index = 0; index < points.length - 1; index += 1) {
    for (const [id, box] of Object.entries(bounds)) {
      if (!excluded.has(id) && segmentIntersectsBox(points[index], points[index + 1], box)) crossed.add(id);
    }
  }
  return [...crossed];
}

const routeLength = (points) => points.slice(1).reduce((sum, point, index) => (
  sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y)
), 0);

const horizontalPorts = (from, to) => {
  const fc = center(from); const tc = center(to);
  return tc.x >= fc.x
    ? [{x: from.x + from.w, y: fc.y}, {x: to.x, y: tc.y}]
    : [{x: from.x, y: fc.y}, {x: to.x + to.w, y: tc.y}];
};

const verticalPorts = (from, to) => {
  const fc = center(from); const tc = center(to);
  return tc.y >= fc.y
    ? [{x: fc.x, y: from.y + from.h}, {x: tc.x, y: to.y}]
    : [{x: fc.x, y: from.y}, {x: tc.x, y: to.y + to.h}];
};

export function orthogonalRoute(edge, bounds, graph, design, anchors = bounds) {
  const custom = design.edge_paths?.[edge.id];
  if (Array.isArray(custom)) {
    const points = normalizePointArray(custom);
    if (isOrthogonalPoints(points)) return {points: dedupeOrthogonalPoints(points), source: 'custom'};
  } else {
    const legacy = parseLinearSvgPath(custom);
    if (legacy) return {points: legacy, source: 'legacy-linear'};
  }
  const from = anchors[edge.from] ?? bounds[edge.from];
  const to = anchors[edge.to] ?? bounds[edge.to];
  if (!from || !to) return {points: [], source: 'unresolved'};
  const methodIds = methodLikeNodeIds(graph);
  const requestedOrientation = design.edge_orientation_overrides?.[edge.id];
  let orientation;
  let ports;
  if (edge.kind === 'support' && (methodIds.has(edge.from) || methodIds.has(edge.to))) {
    if (methodIds.has(edge.from)) {
      ports = [{x: from.x, y: from.y + from.h / 2}, {x: to.x + to.w, y: to.y + to.h / 2}];
    } else {
      ports = [{x: from.x + from.w, y: from.y + from.h / 2}, {x: to.x, y: to.y + to.h / 2}];
    }
    orientation = 'horizontal';
  } else {
    const fc = center(from); const tc = center(to);
    const overlapsX = from.x < to.x + to.w && to.x < from.x + from.w;
    const overlapsY = from.y < to.y + to.h && to.y < from.y + from.h;
    const sameRow = Math.abs(fc.y - tc.y) <= Math.max(from.h, to.h) * .35;
    const sameColumn = Math.abs(fc.x - tc.x) <= Math.max(from.w, to.w) * .25;
    orientation = ['horizontal', 'vertical'].includes(requestedOrientation)
      ? requestedOrientation
      : overlapsX && !overlapsY ? 'vertical'
        : overlapsY && !overlapsX ? 'horizontal'
          : sameRow ? 'horizontal' : sameColumn ? 'vertical'
            : Math.abs(fc.x - tc.x) >= Math.abs(fc.y - tc.y) ? 'horizontal' : 'vertical';
    ports = orientation === 'horizontal' ? horizontalPorts(from, to) : verticalPorts(from, to);
  }
  const [p, q] = ports;
  if (
    orientation === 'horizontal'
    && edge.kind === 'support'
    && Number.isFinite(design.method_support_bus_x)
  ) {
    const busX = design.method_support_bus_x;
    return {
      points: dedupeOrthogonalPoints([
        p,
        {x: busX, y: p.y},
        {x: busX, y: q.y},
        q
      ]),
      source: 'method-support-bus'
    };
  }
  if ((orientation === 'horizontal' && Math.abs(p.y - q.y) < .01)
    || (orientation === 'vertical' && Math.abs(p.x - q.x) < .01)) {
    return {points: [p, q], source: 'direct'};
  }
  const W = design.canvas.width; const H = design.canvas.height;
  const candidates = [];
  if (orientation === 'horizontal') {
    const obstacleChannels = Object.entries(bounds)
      .filter(([id]) => ![edge.from, edge.to].includes(id))
      .flatMap(([, box]) => [box.x - 18, box.x + box.w + 18]);
    const values = [...new Set([
      (p.x + q.x) / 2,
      Math.min(p.x, q.x) - 18,
      Math.max(p.x, q.x) + 18,
      ...obstacleChannels
    ])]
      .filter((value) => value > 8 && value < W - 8);
    for (const x of values) candidates.push(dedupeOrthogonalPoints([p, {x, y: p.y}, {x, y: q.y}, q]));
  } else {
    const obstacleChannels = Object.entries(bounds)
      .filter(([id]) => ![edge.from, edge.to].includes(id))
      .flatMap(([, box]) => [box.y - 18, box.y + box.h + 18]);
    const values = [...new Set([
      (p.y + q.y) / 2,
      Math.min(p.y, q.y) - 18,
      Math.max(p.y, q.y) + 18,
      ...obstacleChannels
    ])]
      .filter((value) => value > 8 && value < H - 8);
    for (const y of values) candidates.push(dedupeOrthogonalPoints([p, {x: p.x, y}, {x: q.x, y}, q]));
  }
  const excluded = new Set([edge.from, edge.to]);
  candidates.sort((a, b) => {
    const aCross = crossingNodeIds(a, bounds, excluded).length;
    const bCross = crossingNodeIds(b, bounds, excluded).length;
    return aCross - bCross || routeLength(a) - routeLength(b);
  });
  return {points: candidates[0] ?? [p, q], source: 'orthogonal'};
}

export const pointsToPath = (points) => points.length
  ? `M ${points.map((point, index) => `${index ? 'L ' : ''}${round(point.x)} ${round(point.y)}`).join(' ')}`
  : '';

export const round = (value) => Math.round(Number(value) * 100) / 100;

export function longestSegmentMidpoint(points) {
  let best = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]; const b = points[index + 1];
    const length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (!best || length > best.length) best = {length, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
  }
  return best ?? {x: 0, y: 0, length: 0};
}

export const isDashedEdge = (edge) => ['optional', 'uncertain'].includes(edge.status);

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

export function splitText(value, maxChars = 12, maxLines = 3) {
  const text = String(value ?? '').trim();
  if (!text) return [];
  const lines = [];
  let rest = text;
  while (rest.length > maxChars && lines.length < maxLines - 1) {
    let cut = maxChars;
    const candidate = rest.slice(0, maxChars + 1);
    const boundary = Math.max(
      candidate.lastIndexOf('·'),
      candidate.lastIndexOf('、'),
      candidate.lastIndexOf('，'),
      candidate.lastIndexOf(' '),
      candidate.lastIndexOf('/')
    );
    if (boundary >= Math.floor(maxChars * .55)) cut = boundary + 1;
    if (
      cut < rest.length
      && /[A-Za-z0-9-]/.test(rest[cut - 1] ?? '')
      && /[A-Za-z0-9-]/.test(rest[cut] ?? '')
    ) {
      let tokenStart = cut - 1;
      let tokenEnd = cut;
      while (tokenStart > 0 && /[A-Za-z0-9-]/.test(rest[tokenStart - 1])) tokenStart -= 1;
      while (tokenEnd < rest.length && /[A-Za-z0-9-]/.test(rest[tokenEnd])) tokenEnd += 1;
      if (tokenStart >= Math.floor(maxChars * .55)) cut = tokenStart;
      else if (tokenEnd <= Math.ceil(maxChars * 1.3)) cut = tokenEnd;
    }
    lines.push(rest.slice(0, cut).replace(/[·、，\s/]$/, ''));
    rest = rest.slice(cut).replace(/^[·、，\s/]/, '');
  }
  lines.push(rest);
  return lines.slice(0, maxLines);
}

const srgb = (channel) => {
  const value = channel / 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex) {
  const normalized = String(hex).trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  const channels = [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));
  return .2126 * srgb(channels[0]) + .7152 * srgb(channels[1]) + .0722 * srgb(channels[2]);
}

export function contrastRatio(a, b) {
  const x = relativeLuminance(a); const y = relativeLuminance(b);
  if (x === null || y === null) return null;
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

export function nodeColors(node, design, groupColor) {
  const custom = design.node_styles?.[node.id] ?? {};
  if (custom.fill) return {fill: custom.fill, text: custom.text ?? design.theme.ink, stroke: custom.stroke ?? design.theme.muted};
  if (node.emphasis === 'accent') return {fill: design.theme.accent, text: '#FFFFFF', stroke: design.theme.accent};
  if (node.emphasis === 'control') return {fill: design.theme.neutral, text: design.theme.ink, stroke: design.theme.muted};
  if (node.role === 'method' || node.kind === 'method') return {fill: design.theme.method, text: design.theme.ink, stroke: design.theme.muted};
  if (node.role === 'indicator' || node.kind === 'metric') return {fill: design.theme.evidence, text: design.theme.ink, stroke: design.theme.muted};
  if (node.role === 'validation') return {fill: design.theme.validation, text: design.theme.ink, stroke: design.theme.muted};
  if (node.role === 'stage_output' || node.kind === 'milestone' || node.stage === 'translation') {
    return {fill: design.theme.outcome, text: design.theme.ink, stroke: design.theme.accent};
  }
  if (node.role === 'theory') return {fill: design.theme.theory, text: design.theme.ink, stroke: design.theme.muted};
  return {fill: groupColor ?? design.theme.paper, text: design.theme.ink, stroke: design.theme.muted};
}

export function graphReadingOrder(graph) {
  const groupOrder = new Map([...graph.groups]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((group, index) => [group.id, index]));
  return [...graph.nodes].sort((a, b) => (
    (groupOrder.get(a.group) ?? 999) - (groupOrder.get(b.group) ?? 999)
    || String(a.lane).localeCompare(String(b.lane))
    || String(a.id).localeCompare(String(b.id))
  ));
}

export function accessibleDescription(graph) {
  const modeLabels = {
    'research-process': '科研流程路线图',
    'research-framework': '研究框架图',
    'technology-roadmap': '技术发展路线图',
    'study-flow': '研究对象流转图'
  };
  const groups = [...graph.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const parts = [`${modeLabels[graph.meta.route_mode] ?? '研究路线图'}：${graph.meta.title}。`];
  for (const group of groups) {
    const nodes = graphReadingOrder(graph).filter((node) => node.group === group.id);
    parts.push(`${group.label}：${nodes.map((node) => {
      const children = (node.children ?? []).map((child) => child.label).filter(Boolean);
      return children.length ? `${node.label}（${children.join('、')}）` : node.label;
    }).join('；')}。`);
  }
  return parts.join('');
}
