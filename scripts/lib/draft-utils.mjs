import fs from 'node:fs';
import path from 'node:path';
import {DOMAIN_PROFILES, ROUTE_MODES, sha256} from './route-utils.mjs';

export const INTAKE_LEVELS = new Set(['undergraduate', 'master', 'doctoral', 'professor-team', 'other']);
export const BASIS_STATUSES = new Set(['verified', 'limited', 'unavailable']);
export const DRAFT_SOURCE_FILES = ['intake_profile.json', 'research_basis.json', 'route_draft.mmd'];

const ACADEMIC_STAGE_RANGE = {
  undergraduate: [3, 3],
  master: [3, 4],
  doctoral: [4, 5],
  'professor-team': [4, 5],
  other: [3, 5]
};

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const validUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const cleanLabel = (value) => value
  .replace(/^["'\[{(]+|["'\]})]+$/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&[a-z]+;/gi, ' ')
  .trim();

export const cjkEquivalentLength = (value) => {
  let score = 0;
  for (const char of cleanLabel(value)) {
    if (/\s/.test(char)) continue;
    score += /[\u0000-\u00ff]/.test(char) ? 0.5 : 1;
  }
  return score;
};

export function parseMermaidDraft(raw) {
  const nodes = [];
  const edges = [];
  const duplicateIds = [];
  const seen = new Set();
  const lines = raw.split(/\r?\n/);
  let direction = null;
  let revision = null;

  for (const line of lines) {
    const directionMatch = line.match(/^\s*flowchart\s+(TD|TB|LR|RL|BT)\s*$/i);
    if (directionMatch) direction = directionMatch[1].toUpperCase();
    const revisionMatch = line.match(/^\s*%%\s*revision:\s*(\d+)\s*$/i);
    if (revisionMatch) revision = Number(revisionMatch[1]);

    const edgeMatch = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s+(.+?)\s+([A-Za-z][A-Za-z0-9_]*)\s*$/);
    if (edgeMatch && /-->|-\.->|-\.[^>]*\.->/.test(edgeMatch[2])) {
      edges.push({
        from: edgeMatch[1],
        expression: edgeMatch[2].trim(),
        to: edgeMatch[3],
        line
      });
      continue;
    }

    const nodeMatch = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*(\{.*\}|\[.*\])(?:\s*:::[A-Za-z][A-Za-z0-9_-]*)?\s*$/);
    if (!nodeMatch) continue;
    const id = nodeMatch[1];
    if (seen.has(id)) duplicateIds.push(id);
    seen.add(id);
    const shape = nodeMatch[2].startsWith('{') ? 'decision' : 'card';
    const rawLabel = nodeMatch[2].slice(1, -1).replace(/^"|"$/g, '');
    nodes.push({
      id,
      shape,
      rawLabel,
      labelLines: rawLabel.split(/<br\s*\/?>/i).map((item) => item.trim())
    });
  }
  return {nodes, edges, duplicateIds, direction, revision};
}

export function validateDraftInputs(intake, basis, draftRaw) {
  const errors = [];
  const warnings = [];

  if (intake?.schema_version !== '1.0') errors.push('intake_profile.json: schema_version must be 1.0');
  if (!nonEmpty(intake?.topic)) errors.push('intake_profile.json: topic is required');
  if (!ROUTE_MODES.has(intake?.route_mode)) errors.push('intake_profile.json: unsupported route_mode');
  if (!DOMAIN_PROFILES.has(intake?.domain_profile)) errors.push('intake_profile.json: unsupported domain_profile');
  if (!Number.isInteger(intake?.draft_revision) || intake.draft_revision < 1) {
    errors.push('intake_profile.json: draft_revision must be a positive integer');
  }
  const level = intake?.research_context?.level;
  if (!INTAKE_LEVELS.has(level)) errors.push('intake_profile.json: unsupported research_context.level');
  if (!nonEmpty(intake?.research_context?.use_case)) errors.push('intake_profile.json: research_context.use_case is required');

  for (const field of ['core_question', 'object', 'boundary', 'expected_output']) {
    if (!nonEmpty(intake?.scope?.[field])) errors.push(`intake_profile.json: scope.${field} is required or must be marked 待定`);
  }
  const resourceFields = ['data_samples', 'equipment_software', 'time_constraints', 'other_constraints'];
  for (const field of resourceFields) {
    if (!nonEmpty(intake?.resources?.[field])) {
      errors.push(`intake_profile.json: resources.${field} is required or must be marked 待定/无`);
    }
  }
  for (const field of ['required_methods', 'excluded_methods']) {
    if (!Array.isArray(intake?.resources?.[field])) errors.push(`intake_profile.json: resources.${field} must be an array`);
  }

  const questions = Array.isArray(intake?.questions) ? intake.questions : [];
  if (!Array.isArray(intake?.questions)) errors.push('intake_profile.json: questions must be an array');
  if (intake?.question_count !== questions.length) errors.push('intake_profile.json: question_count must equal questions.length');
  if (questions.length > 5) errors.push('intake_profile.json: at most five questions may be asked');
  const questionIds = new Set();
  let roundOne = 0;
  let roundTwo = 0;
  for (const question of questions) {
    if (!nonEmpty(question?.id) || questionIds.has(question.id)) errors.push(`intake_profile.json: question id is missing or duplicated: ${question?.id ?? '(missing)'}`);
    questionIds.add(question?.id);
    if (![1, 2].includes(question?.round)) errors.push(`intake_profile.json: question ${question?.id} has unsupported round`);
    if (question?.round === 1) roundOne += 1;
    if (question?.round === 2) roundTwo += 1;
    if (!nonEmpty(question?.category) || !nonEmpty(question?.question) || !nonEmpty(question?.answer)) {
      errors.push(`intake_profile.json: question ${question?.id} needs category, question, and answer`);
    }
  }
  if (roundOne > 3) errors.push('intake_profile.json: round 1 may contain at most three questions');
  if (roundTwo > 2) errors.push('intake_profile.json: round 2 may contain at most two questions');

  const unresolved = Array.isArray(intake?.unresolved) ? intake.unresolved : [];
  if (!Array.isArray(intake?.unresolved)) errors.push('intake_profile.json: unresolved must be an array');
  for (const item of unresolved) {
    if (!nonEmpty(item?.category) || !nonEmpty(item?.reason) || !['high', 'medium', 'low'].includes(item?.impact)) {
      errors.push('intake_profile.json: every unresolved item needs category, reason, and high/medium/low impact');
    }
    if (item?.impact === 'high') errors.push(`draft lock blocked by high-impact unresolved item: ${item.category}`);
  }

  if (basis?.schema_version !== '1.0') errors.push('research_basis.json: schema_version must be 1.0');
  if (!nonEmpty(basis?.topic)) errors.push('research_basis.json: topic is required');
  if (basis?.topic?.trim() !== intake?.topic?.trim()) errors.push('research_basis.json: topic must match intake_profile.json');
  if (!BASIS_STATUSES.has(basis?.status)) errors.push('research_basis.json: unsupported status');
  if (basis?.status !== 'verified') errors.push(`draft lock blocked: research basis status is ${basis?.status ?? 'missing'}`);
  const analogues = Array.isArray(basis?.analogues) ? basis.analogues : [];
  if (!Array.isArray(basis?.analogues)) errors.push('research_basis.json: analogues must be an array');
  if (analogues.length < 2 || analogues.length > 3) errors.push('research_basis.json: verified presearch requires two to three analogous routes');
  if (!Number.isInteger(basis?.source_count) || basis.source_count < analogues.length) {
    errors.push('research_basis.json: source_count must be an integer at least as large as analogues.length');
  }
  if (!nonEmpty(basis?.selected_pattern)) errors.push('research_basis.json: selected_pattern is required');
  analogues.forEach((item, index) => {
    const label = `research_basis.json: analogue ${index + 1}`;
    if (!nonEmpty(item?.title) || !nonEmpty(item?.route_pattern) || !nonEmpty(item?.transferable) || !nonEmpty(item?.limitation)) {
      errors.push(`${label} needs title, route_pattern, transferable, and limitation`);
    }
    if (!validUrl(item?.url)) errors.push(`${label} needs an absolute HTTP(S) url`);
    const latestYear = new Date().getUTCFullYear() + 1;
    if (!Number.isInteger(item?.year) || item.year < 1800 || item.year > latestYear) errors.push(`${label} has an invalid year`);
    if (!['full_text', 'abstract', 'metadata'].includes(item?.access_level)) errors.push(`${label} has an invalid access_level`);
  });
  if (!Array.isArray(basis?.method_forks)) errors.push('research_basis.json: method_forks must be an array');
  for (const fork of basis?.method_forks ?? []) {
    if (!nonEmpty(fork?.id) || !nonEmpty(fork?.label) || !Array.isArray(fork?.options) || fork.options.length < 2) {
      errors.push('research_basis.json: every method fork needs id, label, and at least two options');
    }
    if (!['chosen', 'pending', 'not_applicable'].includes(fork?.decision_status)) {
      errors.push(`research_basis.json: method fork ${fork?.id ?? '(missing)'} has an invalid decision_status`);
    }
    if (fork?.decision_status === 'pending') warnings.push(`method fork ${fork.id} remains pending`);
  }

  if (!nonEmpty(draftRaw)) errors.push('route_draft.mmd: file is empty');
  if (!/curve\s*:\s*stepAfter\b/.test(draftRaw)) errors.push('route_draft.mmd: config.flowchart.curve must be stepAfter');
  const curveValues = [...draftRaw.matchAll(/curve\s*:\s*([A-Za-z0-9_-]+)/g)].map((match) => match[1]);
  if (curveValues.some((value) => value !== 'stepAfter')) errors.push('route_draft.mmd: curve configurations other than stepAfter are forbidden');
  if (/%%\s*\{\s*init\b/i.test(draftRaw)) errors.push('route_draft.mmd: Mermaid init directives are forbidden');
  if (/\bclick\s+[A-Za-z]/i.test(draftRaw)) errors.push('route_draft.mmd: click callbacks are forbidden');
  if (/<\s*script\b/i.test(draftRaw)) errors.push('route_draft.mmd: scripts are forbidden');
  if (/(?:https?:)?\/\//i.test(draftRaw)) errors.push('route_draft.mmd: remote resources and links are forbidden');
  if (/\b(?:basis|bumpX|cardinal|catmullRom|linear|monotoneX|natural)\b/.test(curveValues.join(' '))) {
    errors.push('route_draft.mmd: curved or alternate edge interpolation is forbidden');
  }

  const parsed = parseMermaidDraft(draftRaw);
  const canonicalLines = draftRaw.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '---') return false;
    if (/^(?:title|config|flowchart|curve):(?:\s|$)/.test(trimmed)) return false;
    if (/^flowchart\s+(?:TD|LR)\s*$/i.test(trimmed)) return false;
    if (/^%%\s*revision:\s*\d+\s*$/i.test(trimmed)) return false;
    if (/^[A-Za-z][A-Za-z0-9_]*\s*(?:\{.*\}|\[.*\])(?:\s*:::[A-Za-z][A-Za-z0-9_-]*)?\s*$/.test(trimmed)) return false;
    if (/^[A-Za-z][A-Za-z0-9_]*\s+(?:-->|-\.->|-\.[^>]*\.->)(?:\|[^|]+\|)?\s+[A-Za-z][A-Za-z0-9_]*\s*$/.test(trimmed)) return false;
    return true;
  });
  if (canonicalLines.length) {
    errors.push(`route_draft.mmd: unsupported or unparsable canonical Mermaid statement: ${canonicalLines[0]}`);
  }
  if (!['TD', 'LR'].includes(parsed.direction)) errors.push('route_draft.mmd: flowchart direction must be TD or LR');
  if (parsed.revision !== intake?.draft_revision) {
    errors.push('route_draft.mmd: revision comment must match intake_profile.json.draft_revision');
  }
  if (parsed.duplicateIds.length) errors.push(`route_draft.mmd: duplicated node IDs: ${[...new Set(parsed.duplicateIds)].join(', ')}`);
  if (parsed.nodes.length > 10) errors.push('route_draft.mmd: visible node count exceeds 10');
  const nodeIds = new Set(parsed.nodes.map((node) => node.id));
  for (const node of parsed.nodes) {
    if (!/^(?:S|D|O|P)\d+$/.test(node.id)) errors.push(`route_draft.mmd: node ${node.id} does not use a stable S/D/O/P ID`);
    if (node.id.startsWith('D') && node.shape !== 'decision') errors.push(`route_draft.mmd: decision node ${node.id} must use {...}`);
    if (!node.id.startsWith('D') && node.shape === 'decision') errors.push(`route_draft.mmd: only D nodes may use decision shape: ${node.id}`);
    if (node.id.startsWith('S')) {
      if (node.labelLines.length > 4) errors.push(`route_draft.mmd: stage ${node.id} has more than four lines`);
      node.labelLines.forEach((line, index) => {
        if (cjkEquivalentLength(line) > 14) errors.push(`route_draft.mmd: ${node.id} line ${index + 1} exceeds 14 CJK-equivalent characters`);
      });
    } else if (node.labelLines.some((line) => cjkEquivalentLength(line) > 18)) {
      errors.push(`route_draft.mmd: node ${node.id} has an overlong label`);
    }
  }
  for (const edge of parsed.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push(`route_draft.mmd: edge ${edge.from} → ${edge.to} has an undefined endpoint`);
    if (/-\./.test(edge.expression)) {
      const label = edge.expression.match(/\|([^|]+)\|/)?.[1]?.trim()
        ?? edge.expression.match(/-\.\s*([^|.][^.]*)\s*\.->/)?.[1]?.trim();
      if (!label || !/(可选|待定|待验证|不确定|假设|弱支撑)/.test(label)) {
        errors.push(`route_draft.mmd: dashed edge ${edge.from} → ${edge.to} needs an optional/uncertain semantic label`);
      }
    }
  }
  for (const decision of parsed.nodes.filter((node) => node.id.startsWith('D'))) {
    const branches = parsed.edges.filter((edge) => edge.from === decision.id);
    if (branches.length < 2) errors.push(`route_draft.mmd: decision ${decision.id} needs at least two outgoing branches`);
    for (const branch of branches) {
      if (!/\|[^|]+\|/.test(branch.expression)) {
        errors.push(`route_draft.mmd: decision branch ${decision.id} → ${branch.to} needs a branch label`);
      }
    }
  }

  const stageCount = parsed.nodes.filter((node) => node.id.startsWith('S')).length;
  if (stageCount < 3 || stageCount > 6) errors.push('route_draft.mmd: stage count must be 3–6');
  if (stageCount === 6 && !(intake?.density_exception?.allowed && nonEmpty(intake?.density_exception?.reason))) {
    errors.push('route_draft.mmd: six stages require a documented density_exception');
  }
  if (level && ACADEMIC_STAGE_RANGE[level]) {
    const [minimum, maximum] = ACADEMIC_STAGE_RANGE[level];
    const override = intake?.stage_override?.allowed && nonEmpty(intake?.stage_override?.reason);
    if ((stageCount < minimum || stageCount > maximum) && !override) {
      errors.push(`route_draft.mmd: ${level} defaults to ${minimum}–${maximum} stages; document a stage_override`);
    }
  }
  if (basis?.status === 'unavailable' && !/(未核验|待定)/.test(draftRaw)) {
    errors.push('route_draft.mmd: unavailable research basis must be visibly marked 未核验 or 待定');
  }

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    parsed,
    stats: {
      revision: parsed.revision,
      question_count: questions.length,
      stage_count: stageCount,
      node_count: parsed.nodes.length,
      analogue_count: analogues.length
    }
  };
}

export function readDraftSource(project) {
  const raw = {
    intake_profile: fs.readFileSync(path.join(project, 'intake_profile.json'), 'utf8'),
    research_basis: fs.readFileSync(path.join(project, 'research_basis.json'), 'utf8'),
    route_draft: fs.readFileSync(path.join(project, 'route_draft.mmd'), 'utf8')
  };
  return {
    raw,
    intake: JSON.parse(raw.intake_profile),
    basis: JSON.parse(raw.research_basis),
    hashes: Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, sha256(value)]))
  };
}

export function detectSourceMode(project) {
  const hasDraftSource = DRAFT_SOURCE_FILES.some((name) => fs.existsSync(path.join(project, name)));
  return hasDraftSource ? 'mermaid-draft' : 'legacy-framework';
}
