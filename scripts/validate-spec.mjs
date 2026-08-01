#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  ACCESS_LEVELS,
  CHILD_LAYOUT_MODES,
  DESIGN_VERSIONS,
  DOMAIN_PROFILES,
  EDGE_KINDS,
  EDGE_STATUSES,
  EVIDENCE_CLASSES,
  GRAPH_VERSIONS,
  LAYOUT_STRATEGIES,
  LAYOUT_MODES,
  METHOD_RAIL_MODES,
  NODE_KINDS,
  NODE_ROLES,
  PAGE_MODES,
  ROUTE_MODES,
  SOURCE_TYPES,
  contrastRatio,
  isOrthogonalPoints,
  methodLikeNodeIds,
  normalizeDesign,
  normalizeGraph,
  normalizePointArray,
  pathHasCurve,
  sha256,
  visibleNodeSet,
  writeJsonFile
} from './lib/route-utils.mjs';
import {adaptiveConstants, computeAdaptiveLayout} from './lib/adaptive-layout.mjs';
import {readSourceForValidation} from './lib/source-contract.mjs';

const project = process.argv[2];
if (!project) {
  console.error('Usage: node scripts/validate-spec.mjs <project>');
  process.exit(2);
}

const errors = [];
const warnings = [];
const raw = {};
const read = (name) => {
  try {
    raw[name] = fs.readFileSync(path.join(project, name), 'utf8');
    return JSON.parse(raw[name]);
  } catch (error) {
    errors.push(`${name}: ${error.message}`);
    return null;
  }
};

const graphInput = read('research_graph.json');
const designInput = read('design_spec.json');
let source = null;
try {
  source = readSourceForValidation(project);
} catch (error) {
  errors.push(`confirmed source: ${error.message}`);
}
const sourceIntake = source?.mode === 'mermaid-draft'
  ? JSON.parse(source.files.intake_profile.raw)
  : null;

const graph = graphInput ? normalizeGraph(graphInput) : null;
const design = graph && designInput ? normalizeDesign(designInput, graph) : null;
let adaptiveLayout = null;

const ensureEnum = (value, allowed, label) => {
  if (!allowed.has(value)) errors.push(`${label}: unsupported value ${value ?? '(missing)'}`);
};

if (graphInput && graph) {
  ensureEnum(graphInput.schema_version, GRAPH_VERSIONS, 'research_graph.json schema_version');
  if (source?.mode === 'mermaid-draft' && graphInput.schema_version !== '1.2') {
    errors.push('Mermaid-confirmed new projects require research_graph.json schema 1.2');
  }
  if (!graph.meta.title) errors.push('research_graph.json: meta.title is required');
  if (!Array.isArray(graph.lanes) || graph.lanes.length === 0) errors.push('research_graph.json: lanes must be a non-empty array');
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) errors.push('research_graph.json: nodes must be a non-empty array');
  if (!Array.isArray(graph.edges)) errors.push('research_graph.json: edges must be an array');
  if (graphInput.schema_version === '1.2') {
    ensureEnum(graph.meta.route_mode, ROUTE_MODES, 'research_graph.json meta.route_mode');
    ensureEnum(graph.meta.domain_profile, DOMAIN_PROFILES, 'research_graph.json meta.domain_profile');
    if (source?.mode === 'mermaid-draft') {
      const draftLinks = {
        confirmed_draft_sha256: source.inputHashes.route_draft,
        intake_profile_sha256: source.inputHashes.intake_profile,
        research_basis_sha256: source.inputHashes.research_basis
      };
      for (const [field, hash] of Object.entries(draftLinks)) {
        if (graph.meta[field] !== hash) {
          errors.push(`research_graph.json: meta.${field} must match the confirmed Mermaid source bundle`);
        }
      }
    }
  } else {
    if (!graphInput.meta?.route_mode) warnings.push('legacy graph: missing meta.route_mode; normalized to research-process');
    if (!graphInput.meta?.domain_profile) warnings.push('legacy graph: missing meta.domain_profile; normalized to general');
  }

  const laneIds = new Set();
  for (const lane of graph.lanes) {
    if (!lane.id || laneIds.has(lane.id)) errors.push(`lane id is missing or duplicated: ${lane.id ?? '(empty)'}`);
    laneIds.add(lane.id);
    if (!lane.label || !lane.kind) errors.push(`lane ${lane.id}: label and kind are required`);
  }

  const groupIds = new Set();
  const groupOrders = new Set();
  for (const group of graph.groups) {
    if (!group.id || groupIds.has(group.id)) errors.push(`group id is missing or duplicated: ${group.id ?? '(empty)'}`);
    groupIds.add(group.id);
    if (!group.label) errors.push(`group ${group.id}: label is required`);
    if (Number.isFinite(group.order)) {
      if (groupOrders.has(group.order)) errors.push(`group order is duplicated: ${group.order}`);
      groupOrders.add(group.order);
    }
  }

  if (graphInput.schema_version === '1.1') {
    if (graph.groups.length < 3 || graph.groups.length > 6) errors.push('legacy schema 1.1 requires 3–6 macro groups');
  } else if (graphInput.schema_version === '1.2') {
    if (graph.meta.route_mode === 'research-process' && (graph.groups.length < 3 || graph.groups.length > 6)) {
      errors.push('research-process requires 3–6 evidence-supported macro groups');
    }
    if (graph.meta.route_mode === 'research-framework' && (graph.groups.length < 3 || graph.groups.length > 6)) {
      warnings.push('research-framework normally uses 3–6 groups/layers; confirm the exception');
    }
    if (graph.meta.route_mode === 'technology-roadmap' && !graph.meta.technology_roadmap?.time_horizons?.length) {
      errors.push('technology-roadmap requires meta.technology_roadmap.time_horizons');
    }
    if (
      graph.meta.route_mode === 'technology-roadmap'
      && graph.groups.some((group) => group.stage !== 'time_horizon')
    ) errors.push('technology-roadmap groups must use stage time_horizon');
    if (graph.meta.route_mode === 'study-flow') {
      if (graph.groups.length < 2) errors.push('study-flow requires at least two flow phases');
      if (graph.groups.some((group) => group.stage !== 'flow_phase')) {
        errors.push('study-flow groups must use stage flow_phase');
      }
    }
  }

  const nodeIds = new Set();
  const childIds = new Set();
  const nodesById = new Map();
  for (const node of graph.nodes) {
    if (!node.id || nodeIds.has(node.id)) errors.push(`node id is missing or duplicated: ${node.id ?? '(empty)'}`);
    nodeIds.add(node.id);
    nodesById.set(node.id, node);
    if (!node.label) errors.push(`node ${node.id}: label is required`);
    if (!laneIds.has(node.lane)) errors.push(`node ${node.id}: unknown lane ${node.lane}`);
    if (graphInput.schema_version !== '1.0' && !groupIds.has(node.group)) {
      errors.push(`node ${node.id}: unknown or missing group ${node.group ?? '(empty)'}`);
    }
    if (graphInput.schema_version === '1.2') {
      if (!node.role || !node.kind || !node.emphasis || !node.status) {
        errors.push(`node ${node.id}: role, kind, emphasis, and status are required in schema 1.2`);
      }
      if (node.kind) ensureEnum(node.kind, NODE_KINDS, `node ${node.id} kind`);
      if (node.role) ensureEnum(node.role, NODE_ROLES, `node ${node.id} role`);
      if (node.children.length > 4) errors.push(`node ${node.id}: children supports at most four visible child items`);
      for (const child of node.children) {
        if (!child.id || childIds.has(child.id) || nodeIds.has(child.id)) {
          errors.push(`node ${node.id}: child id is missing or duplicated: ${child.id ?? '(empty)'}`);
        }
        childIds.add(child.id);
        if (!child.label) errors.push(`node ${node.id}: child ${child.id} needs a label`);
      }
    } else if (node.sublabel && /[·、]/.test(node.sublabel)) {
      warnings.push(`legacy node ${node.id}: punctuation-delimited sublabel remains readable but is not converted into children automatically`);
    }

    if (!Array.isArray(node.source_refs) || node.source_refs.length === 0) {
      errors.push(`node ${node.id}: source_refs must contain at least one reference`);
      continue;
    }
    for (const ref of node.source_refs) {
      if (!ref.source || !ref.locator) errors.push(`node ${node.id}: each source_ref needs source and locator`);
      if (graphInput.schema_version === '1.2') {
        ensureEnum(ref.source_type, SOURCE_TYPES, `node ${node.id} source_type`);
        ensureEnum(ref.access_level, ACCESS_LEVELS, `node ${node.id} access_level`);
        ensureEnum(ref.evidence_class, EVIDENCE_CLASSES, `node ${node.id} evidence_class`);
        if (ref.source_type === 'external' && !ref.url) errors.push(`node ${node.id}: external source_ref needs url`);
        if (ref.source_type === 'external' && ref.url) {
          try {
            const url = new URL(ref.url);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
          } catch {
            errors.push(`node ${node.id}: external source_ref url must be an absolute HTTP(S) URL`);
          }
          const latestYear = new Date().getUTCFullYear() + 1;
          if (!Number.isInteger(ref.year) || ref.year < 1800 || ref.year > latestYear) {
            errors.push(`node ${node.id}: external source_ref year must be an integer from 1800 to ${latestYear}`);
          }
        }
        if (ref.source_type === 'user_file' && !ref.file) errors.push(`node ${node.id}: user_file source_ref needs file`);
      }
    }
    if (graphInput.schema_version === '1.2' && node.source_refs.some((ref) => ref.evidence_class === 'synthesized')) {
      if (!node.synthesis_note?.trim()) errors.push(`node ${node.id}: synthesized evidence requires synthesis_note`);
      const distinct = new Set(node.source_refs.map((ref) => ref.url ?? ref.file ?? `${ref.source_type}:${ref.source}`));
      if (distinct.size < 2) errors.push(`node ${node.id}: synthesized evidence requires at least two materially distinct references`);
    }
  }

  const edgeIds = new Set();
  for (const edge of graph.edges) {
    if (!edge.id || edgeIds.has(edge.id)) errors.push(`edge id is missing or duplicated: ${edge.id ?? '(empty)'}`);
    edgeIds.add(edge.id);
    if (!edge.from || !edge.to) errors.push(`edge ${edge.id}: from and to are required`);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push(`edge ${edge.id}: dangling endpoint`);
    if (graphInput.schema_version === '1.2') {
      ensureEnum(edge.kind, EDGE_KINDS, `edge ${edge.id} kind`);
      ensureEnum(edge.status, EDGE_STATUSES, `edge ${edge.id} status`);
      if (['sequence', 'causal', 'decision', 'feedback'].includes(edge.kind) && edge.status !== 'confirmed') {
        errors.push(`edge ${edge.id}: ${edge.kind} relations are solid and must use status confirmed`);
      }
      if (['optional', 'uncertain'].includes(edge.status)) {
        const from = nodesById.get(edge.from); const to = nodesById.get(edge.to);
        const endpointSignals = [from, to].some((node) => (
          ['optional', 'pending'].includes(node?.status) || node?.emphasis === 'uncertain'
        ));
        if (!edge.label?.trim() && !endpointSignals) {
          errors.push(`edge ${edge.id}: dashed optional/uncertain relation needs a label or explicit endpoint status`);
        }
      }
      if (edge.kind === 'decision' && !edge.label?.trim()) errors.push(`edge ${edge.id}: decision branch needs a label`);
    }
  }
  if (graphInput.schema_version === '1.2' && graph.meta.route_mode === 'technology-roadmap') {
    if (!graph.nodes.some((node) => node.kind === 'capability')) errors.push('technology-roadmap requires at least one capability node');
    if (!graph.nodes.some((node) => node.kind === 'metric' || node.role === 'indicator')) errors.push('technology-roadmap requires at least one KPI/metric node');
    if (!graph.nodes.some((node) => node.kind === 'decision' || node.role === 'decision_gate')) errors.push('technology-roadmap requires at least one decision gate node');
    if (!graph.edges.some((edge) => edge.kind === 'decision')) errors.push('technology-roadmap requires at least one labelled decision edge');
  }
  if (graphInput.schema_version === '1.2' && graph.meta.route_mode === 'study-flow') {
    const groupByNode = new Map(graph.nodes.map((node) => [node.id, node.group]));
    const interPhase = graph.edges.filter((edge) => (
      ['sequence', 'decision'].includes(edge.kind)
      && groupByNode.get(edge.from) !== groupByNode.get(edge.to)
    ));
    if (interPhase.length < Math.max(1, graph.groups.length - 1)) {
      errors.push('study-flow requires sequence/decision edges connecting successive flow phases');
    }
  }

  for (const group of graph.groups) {
    const members = graph.nodes.filter((node) => node.group === group.id);
    if (members.length < 2) warnings.push(`group ${group.id}: fewer than two nodes`);
    if (group.output_node && !members.some((node) => node.id === group.output_node)) {
      errors.push(`group ${group.id}: output_node must belong to the group`);
    }
    if (graph.meta.route_mode === 'research-process' && !group.output_node) {
      errors.push(`group ${group.id}: research-process requires output_node`);
    }
  }

  const notApplicable = new Set();
  for (const item of graph.meta.not_applicable) {
    if (typeof item === 'string') {
      notApplicable.add(item);
      if (graphInput.schema_version === '1.2') errors.push(`meta.not_applicable item ${item}: schema 1.2 requires {category, reason}`);
      else warnings.push(`legacy not_applicable item ${item}: reason is missing`);
    } else if (item?.category && item?.reason) notApplicable.add(item.category);
    else errors.push('meta.not_applicable: every object needs category and reason');
  }

  const checks = {
    problem_objective: (node) => node.role === 'stage_question' || node.stage === 'problem',
    object_boundary: (node) => node.kind === 'sample' || /对象|样本|边界|单元|片区|人群|区域|系统/.test(node.label),
    theory_context: (node) => node.role === 'theory',
    data_evidence: (node) => node.kind === 'data' || (node.role === 'input' && /数据|文本|资料|证据|样本/.test(node.label)),
    work_packages: (node) => node.role === 'work_package',
    methods: (node) => node.role === 'method' || node.kind === 'method',
    measures_criteria: (node) => node.role === 'indicator' || node.kind === 'metric',
    explanation: (node) => node.stage === 'mechanism' || /机制|关系|组态|因果|反馈|解释/.test(node.label),
    validation: (node) => node.role === 'validation' || node.stage === 'validation',
    outputs_impact: (node) => node.role === 'stage_output' || ['conclusion', 'milestone', 'capability'].includes(node.kind) || node.stage === 'translation'
  };
  if (graph.meta.route_mode !== 'study-flow') {
    for (const [category, predicate] of Object.entries(checks)) {
      if (!notApplicable.has(category) && !graph.nodes.some(predicate)) {
        const message = `research_graph.json: missing applicable category ${category}`;
        if (graphInput.schema_version === '1.2') errors.push(message); else warnings.push(message);
      }
    }
  }

  for (const node of graph.nodes.filter((item) => ['method', 'indicator', 'validation', 'theory'].includes(item.role))) {
    const support = graph.edges.some((edge) => (
      edge.kind === 'support'
      && (edge.from === node.id || edge.to === node.id)
      && [edge.from, edge.to].some((id) => ['work_package', 'stage_output'].includes(nodesById.get(id)?.role))
    ));
    if (!support) {
      const message = `node ${node.id}: ${node.role} should have a support edge to a work package or stage output`;
      if (graphInput.schema_version === '1.2') errors.push(message);
      else warnings.push(`legacy graph: ${message}`);
    }
  }

  if (graph.nodes.some((node) => node.emphasis === 'uncertain' || node.status === 'pending')) {
    warnings.push('graph contains uncertain/pending nodes; preserve wording and status in the figure');
  }
  if (['research-process', 'research-framework'].includes(graph.meta.route_mode)) {
    if (graph.nodes.length < 18) warnings.push('fewer than 18 nodes; full-page figure may look sparse');
    if (graph.nodes.length > 45) warnings.push('more than 45 nodes; consolidate or use landscape');
  }
}

if (designInput && design && graph) {
  ensureEnum(designInput.schema_version, DESIGN_VERSIONS, 'design_spec.json schema_version');
  if (source?.mode === 'mermaid-draft' && !['1.2', '1.3', '1.4'].includes(designInput.schema_version)) {
    errors.push('Mermaid-confirmed projects require design_spec.json schema 1.2, 1.3, or 1.4');
  }
  if (
    sourceIntake?.schema_version === '1.1'
    && graph.meta.route_mode === 'research-process'
    && designInput.schema_version !== '1.4'
  ) {
    errors.push('intake schema 1.1 research-process projects require design_spec.json schema 1.4');
  }
  const {width, height} = design.canvas;
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) {
    errors.push('design_spec.json: canvas width/height must be positive numbers');
  }
  if (designInput.schema_version === '1.2') {
    ensureEnum(design.route_mode, ROUTE_MODES, 'design_spec.json route_mode');
    ensureEnum(design.layout_mode, LAYOUT_MODES, 'design_spec.json layout_mode');
    ensureEnum(design.method_rail_mode, METHOD_RAIL_MODES, 'design_spec.json method_rail_mode');
    if (design.route_mode !== graph.meta.route_mode) errors.push('design route_mode must match graph meta.route_mode');
    const compatibleLayouts = {
      'research-process': new Set(['portrait-research-process', 'landscape-research-process']),
      'research-framework': new Set(['framework-matrix']),
      'technology-roadmap': new Set(['technology-time-layer']),
      'study-flow': new Set(['study-flow'])
    };
    if (!compatibleLayouts[design.route_mode]?.has(design.layout_mode)) {
      errors.push(`layout_mode ${design.layout_mode} is incompatible with route_mode ${design.route_mode}`);
    }
    if (
      design.layout_mode === 'portrait-research-process' && design.orientation !== 'portrait'
      || design.layout_mode === 'landscape-research-process' && design.orientation !== 'landscape'
    ) errors.push(`layout_mode ${design.layout_mode} conflicts with orientation ${design.orientation}`);
    if (design.orientation === 'portrait' && (width !== 1240 || height !== 1754)) {
      errors.push('schema 1.2 portrait source canvas must be 1240 × 1754');
    }
    if (design.orientation === 'landscape' && (width !== 1754 || height !== 1240)) {
      errors.push('schema 1.2 landscape source canvas must be 1754 × 1240');
    }
    if (design.target_png?.width !== width * 2 || design.target_png?.height !== height * 2 || design.target_png?.dpi !== 300) {
      errors.push('schema 1.2 target_png must be exactly 2× source canvas at 300 dpi');
    }
    if (design.line_semantics?.orthogonal_only !== true) errors.push('schema 1.2 requires line_semantics.orthogonal_only: true');
    if (!(Number.isInteger(design.line_semantics?.max_segments) && design.line_semantics.max_segments >= 1 && design.line_semantics.max_segments <= 3)) {
      errors.push('schema 1.2 line_semantics.max_segments must be an integer from 1 to 3');
    }
    for (const [key, value] of Object.entries(design.typography_pt ?? {})) {
      if (!Number.isFinite(value) || value < 7) errors.push(`typography_pt.${key} must be at least 7 pt`);
    }
    for (const required of ['title', 'stage', 'node', 'method', 'secondary', 'legend']) {
      if (!Number.isFinite(design.typography_pt?.[required])) errors.push(`typography_pt.${required} is required`);
    }
    if (design.editor?.enabled === true) errors.push('schema 1.2 static workflow does not support editor.enabled');
  }
  if (['1.3', '1.4'].includes(designInput.schema_version)) {
    const schemaLabel = designInput.schema_version;
    if (graphInput.schema_version !== '1.2') {
      errors.push(`design schema ${schemaLabel} requires research_graph.json schema 1.2`);
    }
    ensureEnum(design.route_mode, ROUTE_MODES, 'design_spec.json route_mode');
    ensureEnum(design.layout_mode, LAYOUT_MODES, 'design_spec.json layout_mode');
    ensureEnum(design.layout_strategy, LAYOUT_STRATEGIES, 'design_spec.json layout_strategy');
    ensureEnum(design.page_mode, PAGE_MODES, 'design_spec.json page_mode');
    ensureEnum(design.child_layout_mode, CHILD_LAYOUT_MODES, 'design_spec.json child_layout_mode');
    ensureEnum(design.method_rail_mode, METHOD_RAIL_MODES, 'design_spec.json method_rail_mode');
    if (design.route_mode !== graph.meta.route_mode) errors.push('design route_mode must match graph meta.route_mode');
    if (design.route_mode !== 'research-process') {
      errors.push(`schema ${schemaLabel} adaptive layout currently supports research-process`);
    }
    if (design.layout_strategy !== 'adaptive' || design.layout_mode !== 'adaptive-research-process') {
      errors.push(`schema ${schemaLabel} requires adaptive layout_strategy and adaptive-research-process layout_mode`);
    }
    if (design.page_mode !== 'content-fit') errors.push(`schema ${schemaLabel} requires page_mode content-fit`);
    if (!['auto', 'portrait', 'landscape'].includes(designInput.orientation ?? 'auto')) {
      errors.push(`schema ${schemaLabel} orientation must be auto, portrait, or landscape`);
    }
    if (design.target_png?.scale !== 2 || design.target_png?.dpi !== 300) {
      errors.push(`schema ${schemaLabel} target_png must use scale 2 and dpi 300`);
    }
    if (design.line_semantics?.orthogonal_only !== true) errors.push(`schema ${schemaLabel} requires line_semantics.orthogonal_only: true`);
    if (!(Number.isInteger(design.line_semantics?.max_segments) && design.line_semantics.max_segments >= 1 && design.line_semantics.max_segments <= 3)) {
      errors.push(`schema ${schemaLabel} line_semantics.max_segments must be an integer from 1 to 3`);
    }
    for (const [key, value] of Object.entries(design.typography_pt ?? {})) {
      if (!Number.isFinite(value) || value < 7) errors.push(`typography_pt.${key} must be at least 7 pt`);
    }
    for (const required of ['title', 'stage', 'node', 'method', 'secondary', 'legend']) {
      if (!Number.isFinite(design.typography_pt?.[required])) errors.push(`typography_pt.${required} is required`);
    }
    if (design.editor?.enabled === true) errors.push(`schema ${schemaLabel} static workflow does not support editor.enabled`);
    if ((designInput.column_headers ?? []).length) errors.push(`schema ${schemaLabel} derives headers from visible regions; column_headers must be omitted`);
    for (const field of ['placements', 'group_placements', 'visual_group_placements', 'edge_paths']) {
      if (Object.keys(designInput[field] ?? {}).length) {
        errors.push(`schema ${schemaLabel} adaptive layout derives ${field}; explicit values must be omitted`);
      }
    }
    if (designInput.schema_version === '1.4') {
      if (design.stage_rail?.enabled !== true || design.stage_rail?.semantic_role !== 'thinking') {
        errors.push('schema 1.4 requires stage_rail.enabled true and semantic_role thinking');
      }
      if (design.method_rail_content !== 'summary-only') {
        errors.push('schema 1.4 requires method_rail_content summary-only');
      }
      if (design.method_rail_mode === 'hidden') {
        errors.push('schema 1.4 fixed three-column research-process cannot hide the research-method rail');
      }
      const requiredLabels = {
        thinking: '研究思路',
        content: '研究内容与阶段输出',
        methods: '研究方法'
      };
      for (const [key, expected] of Object.entries(requiredLabels)) {
        if (design.region_labels?.[key] !== expected) {
          errors.push(`schema 1.4 region_labels.${key} must be ${expected}`);
        }
      }
      if (graph.lanes.some((lane) => lane.kind === 'thinking')) {
        errors.push('schema 1.4 research-process must not contain a separate thinking lane');
      }
      const primaryLanes = graph.lanes.filter((lane) => lane.kind === 'primary');
      const methodLanes = graph.lanes.filter((lane) => lane.kind === 'method');
      if (graph.lanes.length !== 2 || primaryLanes.length !== 1 || methodLanes.length !== 1) {
        errors.push('schema 1.4 research-process requires exactly one primary content lane and one method lane');
      }
      const thinkingLength = (value) => [...String(value ?? '')].reduce((sum, char) => (
        sum + (/\s/.test(char) ? 0 : /[\u0000-\u00ff]/.test(char) ? .5 : 1)
      ), 0);
      for (const group of graph.groups) {
        const length = thinkingLength(group.short_label);
        if (length < 2 || length > 6 || /\d/.test(group.short_label ?? '')) {
          errors.push(`group ${group.id}: short_label must be an unnumbered 2–6 character research-thinking phrase`);
        }
      }
      const methodLaneIds = new Set(methodLanes.map((lane) => lane.id));
      const concreteMethodPattern = /(?:CLDS|PSW|2SRI|FO法|mAP|随机森林|梯度提升|工具变量|门槛回归|分段回归|数据库|数据源|指标|变量|样本)/i;
      for (const node of graph.nodes.filter((item) => methodLaneIds.has(item.lane))) {
        if (node.kind !== 'method' || node.role !== 'method') {
          errors.push(`method rail node ${node.id} must use kind method and role method`);
        }
        if (node.children?.length) {
          errors.push(`method rail node ${node.id} must be a summary card without children`);
        }
        if (concreteMethodPattern.test(node.label)) {
          errors.push(`method rail node ${node.id} is too specific; move data, models, variables, and indicators to the content lane`);
        }
      }
      for (const group of graph.groups) {
        const methodCount = graph.nodes.filter((node) => (
          node.group === group.id && methodLaneIds.has(node.lane)
        )).length;
        if (methodCount < 1 || methodCount > 3) {
          errors.push(`group ${group.id}: summary method rail requires 1–3 method cards`);
        }
      }
    }
    for (const [nodeId, mode] of Object.entries(design.child_layout_overrides ?? {})) {
      if (!graph.nodes.some((node) => node.id === nodeId)) errors.push(`child_layout_overrides: unknown node ${nodeId}`);
      ensureEnum(mode, CHILD_LAYOUT_MODES, `child_layout_overrides.${nodeId}`);
    }
    try {
      adaptiveLayout = computeAdaptiveLayout(graph, design);
      if (adaptiveLayout.headers.length !== adaptiveLayout.regions.length) {
        errors.push('adaptive layout: header count must equal visible region count');
      }
      if (designInput.schema_version === '1.4') {
        const headerLabels = adaptiveLayout.headers.map((header) => header.label);
        const expected = ['研究思路', '研究内容与阶段输出', '研究方法'];
        if (headerLabels.length !== expected.length || headerLabels.some((label, index) => label !== expected[index])) {
          errors.push(`schema 1.4 adaptive headers must be exactly ${expected.join(' / ')}`);
        }
      }
      const regionById = new Map(adaptiveLayout.regions.map((region) => [region.id, region]));
      const primaryRegion = adaptiveLayout.regions.find((region) => region.kind === 'primary');
      for (const header of adaptiveLayout.headers) {
        const region = regionById.get(header.id);
        if (!region || ['x', 'y', 'w', 'h'].some((key) => Math.abs(header[key] - region[key]) > .01)) {
          errors.push(`adaptive layout: header ${header.id} must exactly reuse its region geometry`);
        }
      }
      for (const group of graph.groups) {
        const row = adaptiveLayout.group_rows[group.id];
        const cells = adaptiveLayout.region_cells[group.id] ?? {};
        if (Object.keys(cells).length !== adaptiveLayout.headers.length) {
          errors.push(`adaptive layout: group ${group.id} cell count must equal header count`);
        }
        for (const region of adaptiveLayout.regions) {
          const cell = cells[region.id];
          if (!cell) {
            errors.push(`adaptive layout: group ${group.id} is missing region cell ${region.id}`);
            continue;
          }
          if (Math.abs(cell.x - region.x) > .01 || Math.abs(cell.width - region.w) > .01) {
            errors.push(`adaptive layout: cell ${group.id}/${region.id} must exactly reuse its header x/width`);
          }
          if (!row || Math.abs(cell.y - row.y) > .01 || Math.abs(cell.height - row.height) > .01) {
            errors.push(`adaptive layout: cell ${group.id}/${region.id} must share the group row y/height`);
          }
        }
        const orderedCells = adaptiveLayout.regions
          .map((region) => cells[region.id])
          .filter(Boolean)
          .sort((a, b) => a.x - b.x);
        for (let index = 0; index < orderedCells.length - 1; index += 1) {
          if (orderedCells[index].x + orderedCells[index].width > orderedCells[index + 1].x + .01) {
            errors.push(`adaptive layout: group ${group.id} region cells overlap`);
          }
        }
        const stage = adaptiveLayout.stage_boxes[group.id];
        const visual = adaptiveLayout.visual_groups[group.id];
        const stageCell = cells.stage;
        if (stage && stageCell && ['x', 'y', 'width', 'height'].some((key) => Math.abs(stage[key] - stageCell[key]) > .01)) {
          errors.push(`adaptive layout: stage block ${group.id} must exactly match the stage cell`);
        }
        const contentCell = primaryRegion ? cells[primaryRegion.id] : null;
        if (visual && contentCell && ['x', 'y', 'width', 'height'].some((key) => Math.abs(visual[key] - contentCell[key]) > .01)) {
          errors.push(`adaptive layout: visual group ${group.id} must point only to the content cell`);
        }
        const slack = adaptiveLayout.group_metrics[group.id]?.internal_vertical_slack;
        if (Number.isFinite(slack) && slack > adaptiveConstants.group_vertical_padding) {
          errors.push(`adaptive layout: group ${group.id} has ${slack}px non-content vertical slack`);
        }
      }
      for (const route of adaptiveLayout.tree_routes) {
        if (!isOrthogonalPoints(route.points)) errors.push(`adaptive tree route ${route.id} is not orthogonal`);
        if (route.points.length - 1 > 3) errors.push(`adaptive tree route ${route.id} exceeds three segments`);
      }
      for (const node of graph.nodes.filter((item) => visibleNodeSet(graph, design).has(item.id))) {
        const nodeBox = adaptiveLayout.bounds[node.id];
        if (!nodeBox) errors.push(`adaptive layout: visible node ${node.id} has no resolved bounds`);
        const laneCell = adaptiveLayout.region_cells[node.group]?.[node.lane];
        if (!laneCell) {
          errors.push(`adaptive layout: visible node ${node.id} has no cell for lane ${node.lane}`);
        } else if (nodeBox && (
          nodeBox.x < laneCell.x - .01
          || nodeBox.y < laneCell.y - .01
          || nodeBox.x + nodeBox.w > laneCell.x + laneCell.width + .01
          || nodeBox.y + nodeBox.h > laneCell.y + laneCell.height + .01
        )) {
          errors.push(`adaptive layout: node/tree cluster ${node.id} leaves its ${node.lane} cell`);
        }
        const requested = design.child_layout_overrides?.[node.id] ?? design.child_layout_mode;
        if (node.children.length >= 2 && node.children.length <= 4 && requested === 'tree') {
          if (adaptiveLayout.node_layouts[node.id]?.mode !== 'tree') errors.push(`adaptive layout: node ${node.id} did not resolve to tree`);
          const children = adaptiveLayout.child_layouts[node.id] ?? [];
          if (children.length !== node.children.length) errors.push(`adaptive layout: node ${node.id} lost tree children`);
          for (const child of children) {
            if (child.w < adaptiveConstants.tree_child_min_width || child.w > adaptiveConstants.tree_child_max_width) {
              errors.push(`adaptive layout: child ${child.id} width is outside 72–120px`);
            }
          }
        }
      }
      const expectedWidth = adaptiveLayout.canvas.width * 2;
      const expectedHeight = adaptiveLayout.canvas.height * 2;
      if (
        adaptiveLayout.target_png.width !== expectedWidth
        || adaptiveLayout.target_png.height !== expectedHeight
        || adaptiveLayout.target_png.dpi !== 300
      ) errors.push('adaptive layout: target PNG must be the resolved SVG at 2× and 300 dpi');
      const bottomMargin = adaptiveLayout.canvas.height - adaptiveLayout.content_bbox.bottom;
      if (bottomMargin < adaptiveConstants.margin || bottomMargin > adaptiveConstants.margin + 1) {
        errors.push(`adaptive layout: content-fit bottom margin is ${bottomMargin}px instead of ${adaptiveConstants.margin}px`);
      }
    } catch (error) {
      errors.push(`adaptive layout: ${error.message}`);
    }
  }

  if (!['1.3', '1.4'].includes(designInput.schema_version)) {
    if (design.orientation === 'portrait' && width >= height) errors.push('portrait orientation requires height greater than width');
    if (design.orientation === 'landscape' && width <= height) errors.push('landscape orientation requires width greater than height');
  }

  const visible = visibleNodeSet(graph, design);
  if (designInput.schema_version === '1.2') {
    for (const node of graph.nodes.filter((item) => visible.has(item.id))) {
      const box = design.placements?.[node.id];
      if (!box || ![box.x, box.y, box.w ?? box.width, box.h ?? box.height].every(Number.isFinite)) {
        errors.push(`design_spec.json: visible node ${node.id} needs a complete placement`);
      }
    }
    if (['research-process', 'research-framework'].includes(design.route_mode)) {
      for (const group of graph.groups) {
        const box = design.group_placements?.[group.id];
        if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite)) {
          errors.push(`design_spec.json: group ${group.id} needs a complete group_placement`);
        }
      }
    }
  }

  for (const [edgeId, pathValue] of Object.entries(design.edge_paths ?? {})) {
    if (Array.isArray(pathValue)) {
      const points = normalizePointArray(pathValue);
      if (!isOrthogonalPoints(points)) errors.push(`edge_path ${edgeId}: points must be horizontal/vertical`);
      if (points.length - 1 > (design.line_semantics?.max_segments ?? 3)) {
        errors.push(`edge_path ${edgeId}: exceeds maximum segment count`);
      }
    } else if (typeof pathValue === 'string') {
      if (['1.2', '1.3', '1.4'].includes(designInput.schema_version)) errors.push(`edge_path ${edgeId}: schema ${designInput.schema_version} requires an array of points`);
      else if (pathHasCurve(pathValue)) warnings.push(`legacy edge_path ${edgeId}: curved path will be ignored and rerouted orthogonally`);
    } else errors.push(`edge_path ${edgeId}: unsupported path format`);
  }

  if (design.route_mode === 'research-process') {
    if (!['1.3', '1.4'].includes(designInput.schema_version) && (!Array.isArray(design.column_headers) || design.column_headers.length < 3)) {
      const message = 'research-process requires at least three column headers';
      if (designInput.schema_version === '1.2') errors.push(message);
      else warnings.push(`legacy design: ${message}`);
    }
    const laneSpecs = new Map((design.lanes ?? []).map((lane) => [lane.id, lane]));
    const headerBoxes = (design.column_headers ?? []).map((header) => {
      const lane = laneSpecs.get(header.lane);
      return lane && Number.isFinite(lane.x) && Number.isFinite(lane.width)
        ? {id: header.lane, x: lane.x, y: header.y ?? design.column_header_y ?? 92, w: lane.width, h: header.height ?? 38}
        : null;
    }).filter(Boolean);
    for (const box of headerBoxes) {
      if (box.x < 0 || box.y < 0 || box.x + box.w > width || box.y + box.h > height) {
        const message = `column header ${box.id} falls outside the canvas`;
        if (designInput.schema_version === '1.2') errors.push(message);
        else warnings.push(`legacy design: ${message}`);
      }
    }
    for (let a = 0; a < headerBoxes.length; a += 1) {
      for (let b = a + 1; b < headerBoxes.length; b += 1) {
        const first = headerBoxes[a]; const second = headerBoxes[b];
        const overlap = (
          first.x < second.x + second.w && first.x + first.w > second.x
          && first.y < second.y + second.h && first.y + first.h > second.y
        );
        if (overlap) {
          const message = `column headers ${first.id} and ${second.id} overlap`;
          if (designInput.schema_version === '1.2') errors.push(message);
          else warnings.push(`legacy design: ${message}`);
        }
      }
    }
    const visibleEdges = new Set(design.visible_edge_ids);
    for (const group of graph.groups) {
      const flow = design.stage_flow_nodes?.[group.id];
      if (!Array.isArray(flow) || flow.length < 2 || flow.length > 5) {
        const message = `design_spec.json: ${group.id} must define two to five ordered stage_flow_nodes`;
        if (['1.2', '1.3', '1.4'].includes(designInput.schema_version)) errors.push(message);
        else if (flow) warnings.push(`legacy design: ${message}`);
        continue;
      }
      if (flow.at(-1) !== group.output_node) {
        const message = `design_spec.json: ${group.id} flow must end with output_node ${group.output_node}`;
        if (['1.2', '1.3', '1.4'].includes(designInput.schema_version)) errors.push(message);
        else warnings.push(`legacy design: ${message}`);
      }
      for (let index = 0; index < flow.length - 1; index += 1) {
        const edge = graph.edges.find((item) => (
          item.from === flow[index]
          && item.to === flow[index + 1]
          && ['sequence', 'causal'].includes(item.kind)
        ));
        if (!edge) {
          const message = `design_spec.json: missing ordered edge ${flow[index]} -> ${flow[index + 1]}`;
          if (['1.2', '1.3', '1.4'].includes(designInput.schema_version)) errors.push(message);
          else warnings.push(`legacy design: ${message}`);
        } else if (!visibleEdges.has(edge.id)) {
          const message = `design_spec.json: ordered edge ${edge.id} must be visible`;
          if (['1.2', '1.3', '1.4'].includes(designInput.schema_version)) errors.push(message);
          else warnings.push(`legacy design: ${message}`);
        }
      }
    }
    if (!design.outcome_band) warnings.push('research-process has no outcome band; confirm that final milestones alone are sufficient');
  }

  if (design.outcome_band) {
    const count = design.outcome_band.items?.length ?? 0;
    if (design.route_mode === 'research-process' && (count < 2 || count > 5)) {
      errors.push('research-process outcome band must contain 2–5 items');
    }
    if (design.route_mode === 'study-flow') warnings.push('study-flow includes an outcome band; confirm that the domain template requires it');
  }
  if (design.route_mode === 'technology-roadmap') {
    const kinds = new Set((design.outcome_band?.items ?? []).map((item) => item.kind));
    for (const [kind, label] of [['capability', 'target capability'], ['metric', 'KPI'], ['decision', 'decision gate']]) {
      if (!kinds.has(kind)) errors.push(`technology-roadmap outcome band requires a ${label} item with kind ${kind}`);
    }
  }

  const visibleEdges = new Set(design.visible_edge_ids);
  const methodIds = methodLikeNodeIds(graph);
  for (const methodId of methodIds) {
    const mapped = graph.edges.some((edge) => (
      edge.kind === 'support'
      && (edge.from === methodId || edge.to === methodId)
      && [edge.from, edge.to].some((id) => graph.nodes.some((node) => node.id === id && ['work_package', 'stage_output'].includes(node.role)))
    ));
    if (!mapped) {
      const message = `method/data node ${methodId} lacks a semantic support edge`;
      if (graphInput.schema_version === '1.2') errors.push(message);
      else warnings.push(`legacy graph: ${message}`);
    }
    if (design.method_rail_mode === 'mapped') {
      const rendered = graph.edges.some((edge) => edge.kind === 'support' && visibleEdges.has(edge.id) && (edge.from === methodId || edge.to === methodId));
      if (!rendered) {
        const message = `mapped method/data node ${methodId} lacks a visible support edge`;
        if (['1.2', '1.3', '1.4'].includes(designInput.schema_version)) errors.push(message);
        else warnings.push(`legacy design: ${message}`);
      }
    }
  }

  const baseFills = [
    design.theme.paper,
    design.theme.neutral,
    design.theme.theory,
    design.theme.method,
    design.theme.evidence,
    design.theme.outcome,
    design.theme.validation
  ].filter(Boolean);
  for (const fill of baseFills) {
    const textContrast = contrastRatio(design.theme.ink, fill);
    if (textContrast !== null && textContrast < 4.5) errors.push(`theme contrast: ink ${design.theme.ink} on ${fill} is ${textContrast.toFixed(2)}:1`);
  }
}

const inputHashes = raw['research_graph.json'] && raw['design_spec.json'] && source ? {
  ...source.inputHashes,
  research_graph: sha256(raw['research_graph.json']),
  design_spec: sha256(raw['design_spec.json'])
} : {};
const result = {
  schema_version: '1.3',
  ok: errors.length === 0,
  source_mode: source?.mode ?? null,
  route_mode: graph?.meta?.route_mode ?? null,
  input_hashes: inputHashes,
  errors,
  warnings,
  node_count: graph?.nodes?.length ?? 0,
  edge_count: graph?.edges?.length ?? 0
};
writeJsonFile(project, 'validation-report.json', result);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
