import {normalizeGraph} from './route-utils.mjs';

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const hasContent = (value) => value && Object.values(value).some((item) => (
  Array.isArray(item) ? item.length > 0 : nonEmpty(item)
));

const stable = (value) => JSON.stringify(value ?? null);

function checkCoreProblem(section, prefix, errors) {
  if (!hasContent(section)) return false;
  for (const field of ['question', 'primary_relation', 'object', 'boundary', 'outcome']) {
    if (!nonEmpty(section?.[field])) errors.push(`${prefix}.${field} is required`);
  }
  if (!Array.isArray(section?.exclusions)) errors.push(`${prefix}.exclusions must be an array`);
  return true;
}

function checkLiterature(section, prefix, errors) {
  if (!hasContent(section)) return false;
  if (!Array.isArray(section?.main_views) || section.main_views.length < 1) errors.push(`${prefix}.main_views needs at least one summarized view`);
  for (const field of ['gap', 'increment']) {
    if (!nonEmpty(section?.[field])) errors.push(`${prefix}.${field} is required`);
  }
  return true;
}

function checkEmpirical(section, prefix, errors) {
  if (!hasContent(section)) return false;
  for (const field of ['unit', 'data_source', 'sample', 'baseline_model']) {
    if (!nonEmpty(section?.[field])) errors.push(`${prefix}.${field} is required`);
  }
  if (!Array.isArray(section?.variable_roles) || section.variable_roles.length < 2) {
    errors.push(`${prefix}.variable_roles needs at least two roles`);
  } else {
    for (const item of section.variable_roles) {
      if (!nonEmpty(item?.role) || !nonEmpty(item?.name) || !nonEmpty(item?.measure)) {
        errors.push(`${prefix}.variable_roles items need role, name, and measure`);
      }
    }
  }
  for (const field of ['robustness', 'heterogeneity', 'mechanism']) {
    if (!Array.isArray(section?.[field])) errors.push(`${prefix}.${field} must be an array`);
  }
  return true;
}

/**
 * Check whether a route has enough semantic anchors to be more than a generic
 * stage chain. This is deliberately separate from validate-spec: old graphs
 * remain valid, while V2 projects get actionable logic warnings/errors.
 */
export function analyzeResearchLogic(graphInput, intake = {}, {strict = false} = {}) {
  const graph = normalizeGraph(graphInput ?? {});
  const errors = [];
  const warnings = [];
  const core = intake.core_problem ?? graph.meta.core_problem;
  const literature = intake.literature_position ?? graph.meta.literature_position;
  const empirical = intake.empirical_design ?? graph.meta.empirical_design;

  const corePresent = checkCoreProblem(core, 'core_problem', errors);
  const literaturePresent = checkLiterature(literature, 'literature_position', errors);
  const empiricalPresent = checkEmpirical(empirical, 'empirical_design', errors);

  if (intake.core_problem && graph.meta.core_problem && stable(intake.core_problem) !== stable(graph.meta.core_problem)) {
    warnings.push('intake_profile.core_problem and graph.meta.core_problem differ; confirm the graph is the approved semantic version');
  }
  if (intake.literature_position && graph.meta.literature_position && stable(intake.literature_position) !== stable(graph.meta.literature_position)) {
    warnings.push('intake_profile.literature_position and graph.meta.literature_position differ; confirm the graph is the approved semantic version');
  }
  if (intake.empirical_design && graph.meta.empirical_design && stable(intake.empirical_design) !== stable(graph.meta.empirical_design)) {
    warnings.push('intake_profile.empirical_design and graph.meta.empirical_design differ; confirm the graph is the approved semantic version');
  }

  const nodes = graph.nodes;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incident = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    incident.get(edge.from)?.push(edge);
    incident.get(edge.to)?.push(edge);
  }
  const workNodes = nodes.filter((node) => ['work_package', 'stage_output', 'stage_question'].includes(node.role) || node.kind === 'process');
  const supportNodes = nodes.filter((node) => ['method', 'data', 'metric', 'validation', 'theory', 'variable', 'model'].includes(node.kind) || ['method', 'indicator', 'validation', 'theory', 'variable', 'model', 'data_source'].includes(node.role));

  const groupStats = graph.groups.map((group) => {
    const members = nodes.filter((node) => node.group === group.id);
    const directWork = members.filter((node) => ['work_package', 'stage_output', 'stage_question'].includes(node.role) || node.kind === 'process');
    if (directWork.length > 3) warnings.push(`group ${group.id} has ${directWork.length} direct work nodes; split into parallel modules or promote a mechanism branch instead of stuffing labels`);
    if (members.length > 8) warnings.push(`group ${group.id} has ${members.length} nodes; use an internal branch/layout rather than shrinking typography`);
    if (members.length === 0) warnings.push(`group ${group.id} has no nodes`);
    return {id: group.id, member_count: members.length, direct_work_count: directWork.length};
  });

  const labels = new Map();
  for (const node of nodes) {
    for (const item of [{id: node.id, label: node.label}, ...(node.children ?? []).map((child) => ({
      id: `${node.id}/${child.id}`,
      label: child.label
    }))]) {
      const key = String(item.label ?? '').trim();
      if (key.length < 4) continue;
      const previous = labels.get(key) ?? [];
      previous.push(item.id);
      labels.set(key, previous);
    }
  }
  for (const [label, ids] of labels) {
    if (ids.length > 1) warnings.push(`duplicate node label “${label}” appears in ${ids.join(', ')}; distinguish variables, mechanisms, or outputs`);
  }

  for (const node of supportNodes) {
    const supported = (incident.get(node.id) ?? []).some((edge) => edge.kind === 'support' && [edge.from, edge.to].some((id) => {
      const endpoint = nodeById.get(id);
      return endpoint && endpoint.id !== node.id && (workNodes.includes(endpoint) || ['work_package', 'stage_output'].includes(endpoint.role));
    }));
    if (!supported) warnings.push(`support node ${node.id} (${node.label}) lacks a support edge to a work package/output`);
  }

  const isolatedWork = workNodes.filter((node) => (incident.get(node.id) ?? []).length === 0);
  if (isolatedWork.length) warnings.push(`isolated work nodes: ${isolatedWork.map((node) => node.id).join(', ')}`);

  const sequenceEdges = graph.edges.filter((edge) => edge.kind === 'sequence');
  const primaryPathNodes = new Set(sequenceEdges.flatMap((edge) => [edge.from, edge.to]));
  const coreConcentration = workNodes.length ? Number((workNodes.filter((node) => primaryPathNodes.has(node.id)).length / workNodes.length).toFixed(3)) : 0;
  if (workNodes.length >= 6 && coreConcentration > 0.9 && graph.edges.filter((edge) => ['parallel', 'causal', 'decision', 'feedback'].includes(edge.kind)).length === 0) {
    warnings.push('route is a long linear chain with no mechanism, decision, validation, or parallel relation; check for template-shaped sequencing');
  }
  if (corePresent && !literaturePresent) warnings.push('core problem is present but literature gap/academic increment is missing');
  if (corePresent && !empiricalPresent && ['research-process', 'study-flow'].includes(graph.meta.route_mode)) {
    warnings.push('core problem is present but empirical/data or feasibility design is missing; mark the route provisional if this is intentional');
  }
  if (empiricalPresent && /提质|增效/.test(String(core?.outcome ?? ''))) {
    const outcomeRole = empirical.variable_roles?.find((item) => item.role === 'outcome');
    if (outcomeRole && !/提质|增效|质量|效率/.test(String(outcomeRole.measure ?? ''))) {
      warnings.push('core outcome mentions 提质/增效 but the outcome measure does not explicitly operationalize quality or efficiency');
    }
  }
  const translationGroups = new Set(graph.groups
    .filter((group) => group.stage === 'translation')
    .map((group) => group.id));
  if (empiricalPresent && translationGroups.size && empirical.mechanism?.length) {
    const translationText = nodes
      .filter((node) => translationGroups.has(node.group))
      .flatMap((node) => [node.label, ...(node.children ?? []).map((child) => child.label)])
      .join(' ');
    for (const mechanism of empirical.mechanism) {
      if (nonEmpty(mechanism) && !translationText.includes(mechanism)) {
        warnings.push(`mechanism “${mechanism}” is not traced into a translation/path node`);
      }
    }
  }

  const allWarnings = strict ? [] : warnings;
  const strictErrors = strict ? warnings : [];
  return {
    schema_version: '1.0',
    valid: errors.length === 0 && strictErrors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(allWarnings)],
    strict_errors: [...new Set(strictErrors)],
    metrics: {
      group_count: graph.groups.length,
      node_count: nodes.length,
      work_node_count: workNodes.length,
      support_node_count: supportNodes.length,
      sequence_edge_count: sequenceEdges.length,
      core_concentration: coreConcentration,
      semantic_sections: {core_problem: corePresent, literature_position: literaturePresent, empirical_design: empiricalPresent},
      groups: groupStats
    }
  };
}
