#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  crossingNodeIds,
  isOrthogonalPoints,
  orthogonalRoute,
  pathHasCurve,
  sha256
} from './lib/route-utils.mjs';

const scripts = path.dirname(new URL(import.meta.url).pathname);
const keep = process.argv.includes('--keep');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'research-route-map-tests-'));
const writeJson = (dir, name, value) => fs.writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
const run = (name, project, args = [], env = {}) => execFileSync(
  process.execPath,
  [path.join(scripts, name), project, ...args],
  {encoding: 'utf8', env: {...process.env, ...env}, stdio: ['ignore', 'pipe', 'pipe']}
);
const runExpectedFailure = (name, project) => {
  const result = spawnSync(process.execPath, [path.join(scripts, name), project], {
    encoding: 'utf8',
    env: process.env
  });
  assert.notEqual(result.status, 0, `${name} should have rejected the invalid fixture`);
  return result;
};

const framework = `# 科研技术路线框架测试稿

## 范围与类型

本测试框架用于验证科研技术路线图的静态生成合同。研究对象、阶段目标、方法映射、验证环节与成果指标均来自同一份已确认框架，测试不会在渲染阶段增加、删减或改写科学内容。默认图型是研究流程；其他标准样例分别覆盖研究框架、技术发展路线和研究对象流转。

## 相似研究与路线依据

相似研究通常从问题界定和对象边界出发，依次组织工作包、方法或数据、评价指标、验证环节以及可验收成果。技术发展路线另外要求时间层、目标能力、关键指标和决策门；研究对象流转图强调进入、筛选、分配、分析与排除原因。并列任务不被解释为先后关系。

## 阶段矩阵

每个阶段包含阶段问题、核心工作包和阶段交付物。理论、数据、方法、指标及验证节点通过 support 关系映射到阶段工作或交付物。所有事实节点带来源定位；并列子项由 children 显式记录；无适用内容以带理由的 not_applicable 记录。

## 严谨性、布局与待选项

本测试采用 A4 画布、三栏静态版式、七磅以上印刷字号、无阴影无渐变。主流程使用实线，只有可选或待验证关系可以使用带语义说明的虚线。连接线只允许水平线、垂直线或九十度正交折线，最多三个线段，不允许贝塞尔曲线、二次曲线或圆弧命令。方法栏默认 aligned，不绘制跨栏支撑线。

## 参考文献与证据附录

测试节点引用同一条公开方法学来源，仅用于结构和来源字段回归，不代表真实研究结论。生产项目仍须联网核验具体主题、比较至少三项相似研究，并在框架中保留可追溯链接、年份、访问层级、证据类别和节点定位。`;

const sourceRef = {
  source: '路线图自动化测试方法说明',
  source_type: 'external',
  locator: 'Test fixture / structural contract',
  url: 'https://example.org/research-route-map-test',
  year: 2024,
  access_level: 'full_text',
  evidence_class: 'reported'
};

const modeLayout = {
  'research-process': 'portrait-research-process',
  'research-framework': 'framework-matrix',
  'technology-roadmap': 'technology-time-layer',
  'study-flow': 'study-flow'
};

function makeProject(mode, stageCount = 3, schemaVersion = '1.2', sourceMode = 'legacy-framework') {
  const dir = path.join(root, `${mode}-${stageCount}-v${schemaVersion.replace('.', '')}-${sourceMode}`);
  fs.mkdirSync(dir, {recursive: true});
  if (sourceMode === 'legacy-framework') fs.writeFileSync(path.join(dir, 'research_route_framework.md'), framework);
  const landscape = mode === 'technology-roadmap';
  const W = landscape ? 1754 : 1240;
  const H = landscape ? 1240 : 1754;
  const outcomeY = mode === 'study-flow' ? null : H - 224;
  const groupStart = 140;
  const groupEnd = outcomeY ?? H - 34;
  const groupGap = 18;
  const groupHeight = Math.floor((groupEnd - groupStart - groupGap * (stageCount - 1)) / stageCount);
  const methodX = W - 220;
  const mainStart = 190;
  const mainEnd = methodX - 30;
  const widths = {question: 180, work: 250, output: 180};
  const mainGap = (mainEnd - mainStart - widths.question - widths.work - widths.output) / 2;
  const positions = {
    question: mainStart,
    work: mainStart + widths.question + mainGap,
    output: mainStart + widths.question + mainGap + widths.work + mainGap
  };
  const stageNames = mode === 'technology-roadmap'
    ? ['近期能力奠基', '中期系统集成', '远期规模应用']
    : mode === 'study-flow'
      ? ['记录识别', '资格筛选', '纳入分析']
      : Array.from({length: stageCount}, (_, index) => `阶段${index + 1}`);
  const groups = [];
  const nodes = [];
  const edges = [];
  const placements = {};
  const groupPlacements = {};
  const stageFlowNodes = {};
  const ref = () => [{...sourceRef}];
  const addNode = (node, placement) => {
    nodes.push({
      stage: 'other',
      emphasis: 'normal',
      status: 'proposed',
      children: [],
      source_refs: ref(),
      ...node
    });
    placements[node.id] = placement;
  };
  for (let index = 0; index < stageCount; index += 1) {
    const n = index + 1;
    const groupId = `g${n}`;
    const y = groupStart + index * (groupHeight + groupGap);
    const outputId = `g${n}-output`;
    groups.push({
      id: groupId,
      label: stageNames[index] ?? `阶段${n}`,
      short_label: `阶段${n}`,
      order: n,
      stage: mode === 'study-flow' ? 'flow_phase'
        : mode === 'technology-roadmap' ? 'time_horizon'
          : index === 0 ? 'problem' : index === 1 ? 'mechanism' : 'validation',
      color_role: index === 0 ? 'theory' : index === stageCount - 1 ? 'validation' : 'analysis',
      output_node: outputId
    });
    groupPlacements[groupId] = {x: 150, y, width: W - 178, height: groupHeight};
    const mainY = y + 80;
    const workHasChildren = stageCount === 3 && index === 0;
    addNode({
      id: `g${n}-question`,
      label: index === 0 ? '问题与研究对象边界' : `阶段${n}研究问题`,
      lane: 'primary',
      group: groupId,
      stage: index === 0 ? 'problem' : 'other',
      kind: index === 0 ? 'sample' : 'process',
      role: 'stage_question'
    }, {x: positions.question, y: mainY, w: widths.question, h: 60});
    addNode({
      id: `g${n}-work`,
      label: stageCount === 6 && index === 5
        ? '跨情境迁移、稳健性与Stage-6联合验证'
        : index === 1 ? '机制解释工作包' : `阶段${n}核心工作包`,
      lane: 'primary',
      group: groupId,
      stage: index === 1 ? 'mechanism' : 'other',
      kind: 'process',
      role: 'work_package',
      children: workHasChildren ? [
        {id: 'g1-work-child-a', label: '并列任务甲'},
        {id: 'g1-work-child-b', label: '并列任务乙'}
      ] : []
    }, {x: positions.work, y: workHasChildren ? y + 55 : mainY, w: widths.work, h: workHasChildren ? 110 : 60});
    addNode({
      id: outputId,
      label: `阶段${n}里程碑与交付`,
      lane: 'primary',
      group: groupId,
      stage: index === stageCount - 1 ? 'translation' : 'other',
      kind: mode === 'technology-roadmap'
        ? index === stageCount - 1 ? 'decision' : 'capability'
        : index === stageCount - 1 ? 'milestone' : 'conclusion',
      role: mode === 'technology-roadmap' && index === stageCount - 1 ? 'decision_gate' : 'stage_output'
    }, {x: positions.output, y: mainY, w: widths.output, h: 60});
    const first = `e-g${n}-question-work`;
    const second = `e-g${n}-work-output`;
    const secondKind = mode === 'technology-roadmap' && index === stageCount - 1
      ? 'decision' : index === 1 ? 'causal' : 'sequence';
    edges.push(
      {id: first, from: `g${n}-question`, to: `g${n}-work`, kind: 'sequence', label: '', status: 'confirmed'},
      {
        id: second,
        from: `g${n}-work`,
        to: outputId,
        kind: secondKind,
        label: secondKind === 'decision' ? '通过决策门' : '',
        status: 'confirmed'
      }
    );
    stageFlowNodes[groupId] = [`g${n}-question`, `g${n}-work`, outputId];
  }
  if (mode === 'study-flow') {
    for (let index = 1; index < stageCount; index += 1) {
      edges.push({
        id: `e-flow-${index}-${index + 1}`,
        from: `g${index}-output`,
        to: `g${index + 1}-question`,
        kind: 'sequence',
        label: '',
        status: 'confirmed'
      });
    }
  }
  const auxiliaries = [
    {id: 'theory', label: '理论与概念框架', lane: 'method', group: 'g1', kind: 'note', role: 'theory'},
    {id: 'data', label: '数据与证据来源', lane: 'method', group: 'g1', kind: 'data', role: 'input'},
    {id: 'method', label: '匹配研究方法', lane: 'method', group: 'g2', kind: 'method', role: 'method'},
    {id: 'indicator', label: '指标与判据', lane: 'method', group: 'g2', kind: 'metric', role: 'indicator'},
    {id: 'validation', label: '稳健性与外部验证', lane: 'method', group: 'g3', kind: 'process', role: 'validation'}
  ];
  const perGroupAux = new Map();
  for (const auxiliary of auxiliaries) {
    if (Number(auxiliary.group.slice(1)) > stageCount) continue;
    const count = perGroupAux.get(auxiliary.group) ?? 0;
    perGroupAux.set(auxiliary.group, count + 1);
    const row = groupPlacements[auxiliary.group];
    addNode(auxiliary, {x: methodX, y: row.y + 55 + count * 65, w: 180, h: 55});
    const supportTarget = mode === 'technology-roadmap' && auxiliary.group === `g${stageCount}`
      ? `${auxiliary.group}-work`
      : `${auxiliary.group}-output`;
    edges.push({
      id: `e-${auxiliary.id}-support`,
      from: auxiliary.id,
      to: supportTarget,
      kind: 'support',
      label: '',
      status: 'confirmed'
    });
  }
  const graph = {
    schema_version: schemaVersion,
    meta: {
      title: `${mode} 标准样例`,
      language: 'zh-CN',
      route_mode: mode,
      route_archetype: mode === 'technology-roadmap' ? 'maturity-gates' : 'question-work-validation',
      domain_profile: 'general',
      not_applicable: [],
      ...(mode === 'technology-roadmap' ? {
        technology_roadmap: {
          time_horizons: ['近期', '中期', '远期'],
          baseline: '当前原型能力',
          target: '可验证规模应用能力',
          update_assumption: '每个决策门后复核'
        }
      } : {})
    },
    lanes: [
      {id: 'thinking', label: '研究思路', kind: 'thinking'},
      {id: 'primary', label: '研究内容', kind: 'primary'},
      {id: 'method', label: '研究方法', kind: 'method'}
    ],
    groups,
    nodes,
    edges
  };
  const outcomeItems = mode === 'technology-roadmap' ? [
    {label: '目标能力', kind: 'capability'},
    {label: '关键KPI', kind: 'metric'},
    {label: '决策门', kind: 'decision'}
  ] : [
    {label: '理论或机制成果', kind: 'outcome'},
    {label: '数据与方法成果', kind: 'outcome'},
    {label: '验证与应用成果', kind: 'outcome'}
  ];
  const design = {
    schema_version: schemaVersion,
    title: graph.meta.title,
    route_mode: mode,
    layout_mode: modeLayout[mode],
    orientation: landscape ? 'landscape' : 'portrait',
    canvas: {width: W, height: H, background: '#FFFFFF'},
    target_png: {width: W * 2, height: H * 2, dpi: 300},
    method_rail_mode: 'aligned',
    render_edges: true,
    show_feedback: false,
    line_semantics: {orthogonal_only: true, max_segments: 3, optional_style: 'dashed'},
    typography_pt: {title: 16, stage: 10, node: 8.5, method: 7.5, secondary: 7.5, legend: 7},
    stage_header_height: 36,
    stage_rail: {x: 28, width: 110, enabled: mode === 'research-process'},
    lanes: [
      {id: 'thinking', x: 28, width: 110},
      {id: 'primary', x: 150, width: mainEnd - 150},
      {id: 'method', x: methodX, width: 180}
    ],
    column_headers: [
      {lane: 'thinking', label: '研究思路'},
      {lane: 'primary', label: '研究内容'},
      {lane: 'method', label: '研究方法'}
    ],
    group_placements: groupPlacements,
    visual_group_placements: groupPlacements,
    placements,
    stage_flow_nodes: stageFlowNodes,
    visible_edge_ids: edges.map((edge) => edge.id),
    edge_paths: {},
    ...(outcomeY ? {
      outcome_band: {
        label: mode === 'technology-roadmap' ? '目标能力、KPI与决策门' : '预期成果与验收指标',
        x: 150,
        y: outcomeY,
        width: W - 178,
        height: 190,
        items: outcomeItems
      }
    } : {})
  };
  if (schemaVersion !== '1.2') {
    delete graph.meta.route_mode;
    delete graph.meta.route_archetype;
    delete graph.meta.domain_profile;
    delete graph.meta.technology_roadmap;
    delete design.route_mode;
    delete design.layout_mode;
    delete design.target_png;
    delete design.typography_pt;
    delete design.line_semantics;
    delete design.method_rail_mode;
    design.right_rail_mode = 'aligned';
  }
  if (sourceMode === 'mermaid-draft') {
    const intake = {
      schema_version: '1.0',
      topic: '科研技术路线自动化测试',
      route_mode: mode,
      domain_profile: 'general',
      draft_revision: 1,
      research_context: {level: 'undergraduate', use_case: '测试'},
      scope: {
        core_question: '验证静态路线生成',
        object: '测试数据',
        boundary: '结构和输出',
        expected_output: '通过自动验证'
      },
      resources: {
        data_samples: '内置测试数据',
        equipment_software: 'Node.js',
        required_methods: ['结构验证'],
        excluded_methods: [],
        time_constraints: '单次测试',
        other_constraints: '无'
      },
      questions: [
        {id: 'Q1', round: 1, category: 'identity_use', question: '用途？', answer: '自动化测试'},
        {id: 'Q2', round: 1, category: 'scope', question: '研究边界？', answer: '静态生成'},
        {id: 'Q3', round: 1, category: 'feasibility', question: '可用资源？', answer: 'Node.js'}
      ],
      question_count: 3,
      unresolved: [],
      stage_override: {allowed: false, reason: ''},
      density_exception: {allowed: false, reason: ''},
      prefilled_from: []
    };
    const basis = {
      schema_version: '1.0',
      topic: intake.topic,
      searched_at: '2026-07-26T00:00:00.000Z',
      status: 'verified',
      analogues: [
        {
          title: '自动化路线样例一',
          url: 'https://example.org/route-one',
          year: 2025,
          route_pattern: '问题—实现—验证',
          transferable: '三阶段结构',
          limitation: '仅用于测试',
          access_level: 'full_text'
        },
        {
          title: '自动化路线样例二',
          url: 'https://example.org/route-two',
          year: 2024,
          route_pattern: '输入—处理—输出',
          transferable: '阶段交付',
          limitation: '不代表学术证据',
          access_level: 'full_text'
        }
      ],
      selected_pattern: '问题—实现—验证',
      method_forks: [],
      limitations: ['测试夹具'],
      source_count: 2
    };
    const draft = `---
title: 科研技术路线草图
config:
  flowchart:
    curve: stepAfter
---
flowchart TD
  %% revision: 1
  S1["阶段1：问题界定<br/>研究：明确测试边界<br/>方法：结构分析<br/>产出：测试合同"]
  S2["阶段2：静态生成<br/>研究：构建图形模型<br/>方法：规则渲染<br/>产出：HTML图"]
  S3["阶段3：质量验证<br/>研究：检查一致性<br/>方法：自动测试<br/>产出：验证报告"]
  S1 --> S2
  S2 --> S3
`;
    const intakeRaw = `${JSON.stringify(intake, null, 2)}\n`;
    const basisRaw = `${JSON.stringify(basis, null, 2)}\n`;
    fs.writeFileSync(path.join(dir, 'intake_profile.json'), intakeRaw);
    fs.writeFileSync(path.join(dir, 'research_basis.json'), basisRaw);
    fs.writeFileSync(path.join(dir, 'route_draft.mmd'), draft);
    graph.meta.confirmed_draft_sha256 = sha256(draft);
    graph.meta.intake_profile_sha256 = sha256(intakeRaw);
    graph.meta.research_basis_sha256 = sha256(basisRaw);
  }
  writeJson(dir, 'research_graph.json', graph);
  writeJson(dir, 'design_spec.json', design);
  return dir;
}

function makeAdaptiveProject(stageCount = 4, suffix = '') {
  const base = makeProject('research-process', stageCount, '1.2');
  const dir = path.join(root, `research-process-adaptive-v13-${stageCount}${suffix ? `-${suffix}` : ''}`);
  fs.cpSync(base, dir, {recursive: true});
  for (const generated of ['framework_lock.json', 'validation-report.json', 'spec_lock.json', 'route-map.svg', 'route-map.html', 'render-layout.json', 'route-map.png', 'export-report.json', 'qa-report.json']) {
    fs.rmSync(path.join(dir, generated), {force: true});
  }
  const graph = JSON.parse(fs.readFileSync(path.join(dir, 'research_graph.json'), 'utf8'));
  const design12 = JSON.parse(fs.readFileSync(path.join(dir, 'design_spec.json'), 'utf8'));
  const ref = () => [{...sourceRef}];
  for (let index = 1; index <= stageCount; index += 1) {
    graph.nodes.push({
      id: `g${index}-thinking`,
      label: index === 1 ? '目标边界' : `阶段${index}研究思路`,
      lane: 'thinking',
      group: `g${index}`,
      stage: 'other',
      kind: 'note',
      role: 'input',
      emphasis: 'normal',
      status: 'proposed',
      children: index === 1 ? [
        {id: 'g1-thinking-a', label: '暗光处理'},
        {id: 'g1-thinking-b', label: '标志识别'}
      ] : [],
      source_refs: ref()
    });
  }
  const childrenFor = {
    'g1-work': [
      {id: 'g1-work-a', label: '宽度不足'},
      {id: 'g1-work-b', label: '噪声与模糊'}
    ],
    'g2-work': [
      {id: 'g2-work-a', label: '暗光照片'},
      {id: 'g2-work-b', label: '正常光图'},
      {id: 'g2-work-c', label: '框与类别'}
    ],
    'g3-output': [
      {id: 'g3-output-a', label: '增强图像'},
      {id: 'g3-output-b', label: '对照样本'},
      {id: 'g3-output-c', label: '质量报告'},
      {id: 'g3-output-d', label: '消融记录'}
    ],
    method: [
      {id: 'method-a', label: '条件扩散'},
      {id: 'method-b', label: '损失约束'}
    ]
  };
  for (const node of graph.nodes) {
    if (childrenFor[node.id]) node.children = childrenFor[node.id];
  }
  const design = {
    schema_version: '1.3',
    title: '面向交通标志识别的暗光图像预处理研究技术路线',
    route_mode: 'research-process',
    layout_strategy: 'adaptive',
    page_mode: 'content-fit',
    orientation: 'auto',
    child_layout_mode: 'tree',
    child_layout_overrides: {},
    region_labels: {
      stage: '研究阶段',
      thinking: '研究思路',
      content: '研究内容与阶段输出',
      methods: '方法数据与指标'
    },
    target_png: {scale: 2, dpi: 300},
    method_rail_mode: 'aligned',
    render_edges: true,
    show_feedback: false,
    line_semantics: {orthogonal_only: true, max_segments: 3, optional_style: 'dashed'},
    typography_pt: {title: 16, stage: 10, node: 8.5, method: 7.5, secondary: 7.5, legend: 7},
    stage_flow_nodes: design12.stage_flow_nodes,
    visible_edge_ids: design12.visible_edge_ids,
    outcome_band: {
      label: '预期成果与验收',
      items: design12.outcome_band.items
    }
  };
  writeJson(dir, 'research_graph.json', graph);
  writeJson(dir, 'design_spec.json', design);
  return dir;
}

function makeSemanticAdaptiveProject(stageCount = 4, suffix = '') {
  const dir = makeAdaptiveProject(stageCount, `semantic${suffix ? `-${suffix}` : ''}`);
  const graph = JSON.parse(fs.readFileSync(path.join(dir, 'research_graph.json'), 'utf8'));
  const design = JSON.parse(fs.readFileSync(path.join(dir, 'design_spec.json'), 'utf8'));
  const thinkingNodeIds = new Set(graph.nodes
    .filter((node) => graph.lanes.find((lane) => lane.id === node.lane)?.kind === 'thinking')
    .map((node) => node.id));
  graph.lanes = graph.lanes.filter((lane) => lane.kind !== 'thinking');
  graph.nodes = graph.nodes.filter((node) => !thinkingNodeIds.has(node.id));
  graph.edges = graph.edges.filter((edge) => !thinkingNodeIds.has(edge.from) && !thinkingNodeIds.has(edge.to));

  const detailIds = new Set(['theory', 'data', 'indicator', 'validation']);
  for (const node of graph.nodes) {
    if (detailIds.has(node.id)) node.lane = 'primary';
  }
  const methodNames = ['文献分析法', '调查研究法', '计量分析法', '政策分析法'];
  const methodLane = graph.lanes.find((lane) => lane.kind === 'method');
  methodLane.label = '研究方法';
  const existingMethodNodes = graph.nodes.filter((node) => node.lane === methodLane.id);
  for (const node of existingMethodNodes) {
    node.kind = 'method';
    node.role = 'method';
    node.label = methodNames[Math.max(0, Number(node.group.slice(1)) - 1)] ?? '综合分析法';
    node.children = [];
  }
  for (let index = 1; index <= stageCount; index += 1) {
    const groupId = `g${index}`;
    if (graph.nodes.some((node) => node.group === groupId && node.lane === methodLane.id)) continue;
    const nodeId = `g${index}-summary-method`;
    graph.nodes.push({
      id: nodeId,
      label: methodNames[index - 1] ?? '综合分析法',
      lane: methodLane.id,
      group: groupId,
      stage: 'other',
      kind: 'method',
      role: 'method',
      emphasis: 'normal',
      status: 'proposed',
      children: [],
      source_refs: [{...sourceRef}]
    });
    graph.edges.push({
      id: `e-${nodeId}-support`,
      from: nodeId,
      to: `g${index}-work`,
      kind: 'support',
      label: '',
      status: 'confirmed'
    });
  }
  const thinkingLabels = ['理论构建', '风险识别', '机制检验', '分类治理', '综合验证', '成果转化'];
  const contentLabels = [
    '人工智能职业替代风险影响幸福感的理论逻辑与分析框架',
    '人工智能应用背景下的现状特征与职业替代风险识别',
    '职业替代风险影响生活幸福感的作用效应与机制识别',
    '职业韧性与居民幸福感协同提升的分类治理体系'
  ];
  graph.groups.forEach((group, index) => {
    group.short_label = thinkingLabels[index];
    group.label = contentLabels[index] ?? group.label;
  });
  graph.meta.title = '人工智能职业替代风险影响江苏居民生活幸福感的机制与治理研究';
  const contentDetails = {
    'g1-work': ['概念理论界定', '直接效应解释', '超时劳动传导', '三类渠道识别'],
    'g2-work': ['FO任务修正', '随机森林测度', 'CLDS数据匹配', '职业风险画像'],
    'g3-work': ['PSW与IV识别', '中介与2SRI', '门槛回归检验', '群体异质分析'],
    'g4-work': ['风险分级预警', '职业能力重塑', '工时保障优化', '分类政策匹配']
  };
  for (const [nodeId, labels] of Object.entries(contentDetails)) {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node) continue;
    node.children = labels.map((label, index) => ({id: `${nodeId}-semantic-${index + 1}`, label}));
  }
  const dataNode = graph.nodes.find((node) => node.id === 'data');
  if (dataNode) {
    dataNode.group = 'g2';
    dataNode.label = '数据与职业编码';
    dataNode.children = [
      {id: 'data-clds', label: 'CLDS微观数据'},
      {id: 'data-jiangsu', label: '江苏问卷调查'},
      {id: 'data-coding', label: '职业编码匹配'}
    ];
    const dataEdge = graph.edges.find((edge) => edge.id === 'e-data-support');
    if (dataEdge) dataEdge.to = 'g2-work';
  }
  const indicatorNode = graph.nodes.find((node) => node.id === 'indicator');
  if (indicatorNode) {
    indicatorNode.label = '变量与评价指标';
    indicatorNode.children = [
      {id: 'indicator-risk', label: '职业替代概率'},
      {id: 'indicator-happiness', label: '生活幸福感'},
      {id: 'indicator-hours', label: '超时劳动指标'}
    ];
  }
  const validationNode = graph.nodes.find((node) => node.id === 'validation');
  if (validationNode) {
    validationNode.label = '稳健性与识别检验';
    validationNode.children = [
      {id: 'validation-measure', label: '更换核心指标'},
      {id: 'validation-sample', label: '调整样本范围'},
      {id: 'validation-model', label: '改变模型设定'}
    ];
  }

  design.schema_version = '1.4';
  design.stage_rail = {enabled: true, semantic_role: 'thinking'};
  design.region_labels = {
    thinking: '研究思路',
    content: '研究内容与阶段输出',
    methods: '研究方法'
  };
  design.method_rail_content = 'summary-only';
  design.hidden_node_ids = [];
  writeJson(dir, 'research_graph.json', graph);
  writeJson(dir, 'design_spec.json', design);
  return dir;
}

function validate(project) {
  run('validate-spec.mjs', project);
  const report = JSON.parse(fs.readFileSync(path.join(project, 'validation-report.json'), 'utf8'));
  assert.equal(report.ok, true, report.errors.join('\n'));
  return report;
}

function render(project) {
  if (fs.existsSync(path.join(project, 'route_draft.mmd'))) {
    run('validate-draft.mjs', project);
    run('lock-draft.mjs', project, ['--confirmed']);
  } else {
    run('lock-framework.mjs', project, ['--confirmed']);
  }
  validate(project);
  run('lock-spec.mjs', project);
  run('render-html.mjs', project);
  const svg = fs.readFileSync(path.join(project, 'route-map.svg'), 'utf8');
  const html = fs.readFileSync(path.join(project, 'route-map.html'), 'utf8');
  const embedded = html.match(/<svg id="route-map-svg"[\s\S]*?<\/svg>/)?.[0];
  const layout = JSON.parse(fs.readFileSync(path.join(project, 'render-layout.json'), 'utf8'));
  assert.equal(embedded, svg);
  assert.equal(layout.standalone_svg_sha256, sha256(svg));
  assert.equal(layout.editable_svg.text_as_text, true);
  assert.deepEqual(layout.semantic_layers, [
    'background-title',
    'headers',
    'stages',
    'connectors',
    'nodes',
    'outcomes',
    'legend'
  ]);
  assert.match(svg, /data-editable-svg="office-compatible"/);
  assert.match(svg, /<text\b[^>]*data-editable-text="true"/);
  assert.doesNotMatch(svg, /<script\b|<foreignObject\b|<style\b|<filter\b|<linearGradient\b|<radialGradient\b|<marker\b/i);
  assert.match(svg, /id="layer-connectors"/);
  assert.match(svg, /id="node-g1-question"/);
  assert.match(svg, /id="edge-e-g1-question-work"/);
  assert.equal((html.match(/<svg\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /editor-runtime|ReactFlow|route-map-editor/i);
  const pathData = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(pathData.some(pathHasCurve), false);
}

try {
  const simpleGraph = {
    meta: {route_mode: 'research-process'},
    lanes: [{id: 'primary', kind: 'primary'}, {id: 'method', kind: 'method'}],
    nodes: [
      {id: 'a', lane: 'primary'}, {id: 'b', lane: 'primary'},
      {id: 'c', lane: 'primary'}, {id: 'd', lane: 'method'}, {id: 'e', lane: 'method'}
    ],
    edges: []
  };
  const simpleDesign = {
    canvas: {width: 1000, height: 800},
    method_rail_mode: 'mapped',
    edge_paths: {}
  };
  const horizontal = orthogonalRoute(
    {id: 'h', from: 'a', to: 'b', kind: 'sequence'},
    {a: {x: 100, y: 100, w: 100, h: 50}, b: {x: 400, y: 100, w: 100, h: 50}},
    simpleGraph,
    simpleDesign
  ).points;
  assert.equal(horizontal.length, 2);
  assert.equal(horizontal[0].y, horizontal[1].y);
  const vertical = orthogonalRoute(
    {id: 'v', from: 'a', to: 'c', kind: 'sequence'},
    {a: {x: 100, y: 100, w: 100, h: 50}, c: {x: 100, y: 350, w: 100, h: 50}},
    simpleGraph,
    simpleDesign
  ).points;
  assert.equal(vertical.length, 2);
  assert.equal(vertical[0].x, vertical[1].x);
  const doglegBounds = {
    a: {x: 100, y: 100, w: 100, h: 50},
    b: {x: 500, y: 350, w: 100, h: 50},
    blocker: {x: 300, y: 205, w: 80, h: 80}
  };
  const dogleg = orthogonalRoute(
    {id: 'dogleg', from: 'a', to: 'b', kind: 'sequence'},
    doglegBounds,
    simpleGraph,
    simpleDesign
  ).points;
  assert.equal(isOrthogonalPoints(dogleg), true);
  assert.ok(dogleg.length - 1 <= 3);
  assert.deepEqual(crossingNodeIds(dogleg, doglegBounds, new Set(['a', 'b'])), []);
  const busBounds = {
    c: {x: 500, y: 220, w: 180, h: 60},
    d: {x: 900, y: 160, w: 100, h: 50},
    e: {x: 900, y: 300, w: 100, h: 50}
  };
  const bus1 = orthogonalRoute({id: 'bus1', from: 'd', to: 'c', kind: 'support'}, busBounds, simpleGraph, simpleDesign).points;
  const bus2 = orthogonalRoute({id: 'bus2', from: 'e', to: 'c', kind: 'support'}, busBounds, simpleGraph, simpleDesign).points;
  assert.equal(bus1[1].x, bus2[1].x, 'mapped supports should share the preferred trunk x-coordinate');
  assert.equal(pathHasCurve('M 0 0 C 10 10 20 20 30 30'), true);
  assert.equal(pathHasCurve('M 0 0 L 30 0 L 30 30'), false);

  const stageReports = [];
  const stageProjects = {};
  for (const count of [3, 4, 5, 6]) {
    const project = makeProject('research-process', count);
    const report = validate(project);
    stageReports.push({count, ok: report.ok, groups: count});
    stageProjects[count] = project;
  }
  const modeProjects = {};
  for (const mode of Object.keys(modeLayout)) {
    const project = makeProject(mode, 3);
    render(project);
    modeProjects[mode] = project;
  }
  for (const version of ['1.0', '1.1']) {
    const project = makeProject('research-process', 3, version);
    render(project);
    assert.equal(JSON.parse(fs.readFileSync(path.join(project, 'validation-report.json'), 'utf8')).ok, true);
  }
  const draftConfirmedProject = makeProject('research-process', 3, '1.2', 'mermaid-draft');
  render(draftConfirmedProject);
  const draftSpecLock = JSON.parse(fs.readFileSync(path.join(draftConfirmedProject, 'spec_lock.json'), 'utf8'));
  assert.equal(draftSpecLock.contract.source_mode, 'mermaid-draft');
  assert.ok(draftSpecLock.inputs.route_draft);
  assert.ok(draftSpecLock.inputs.draft_lock);
  assert.deepEqual(draftSpecLock.contract.output, ['route-map.svg', 'route-map.html', 'route-map.png']);
  assert.ok(draftSpecLock.contract.internal_quality.includes('qa-report.json'));

  const adaptiveProject = makeAdaptiveProject();
  render(adaptiveProject);
  run('export-image.mjs', adaptiveProject);
  run('visual-qa.mjs', adaptiveProject);
  const adaptiveLayout = JSON.parse(fs.readFileSync(path.join(adaptiveProject, 'render-layout.json'), 'utf8'));
  const adaptiveQa = JSON.parse(fs.readFileSync(path.join(adaptiveProject, 'qa-report.json'), 'utf8'));
  assert.equal(adaptiveQa.ok, true, adaptiveQa.errors.join('\n'));
  assert.equal(adaptiveLayout.schema_version, '1.3');
  assert.deepEqual(adaptiveLayout.headers.map((header) => header.label), [
    '研究阶段',
    '研究思路',
    '研究内容与阶段输出',
    '方法数据与指标'
  ]);
  assert.equal(adaptiveLayout.headers.length, adaptiveLayout.regions.length);
  for (const header of adaptiveLayout.headers) {
    const region = adaptiveLayout.regions.find((item) => item.id === header.id);
    assert.deepEqual(
      [header.x, header.y, header.w, header.h],
      [region.x, region.y, region.w, region.h]
    );
  }
  const adaptivePrimary = adaptiveLayout.regions.find((region) => region.kind === 'primary');
  const adaptiveGraph = JSON.parse(fs.readFileSync(path.join(adaptiveProject, 'research_graph.json'), 'utf8'));
  for (const group of Object.keys(adaptiveLayout.group_rows)) {
    const cells = adaptiveLayout.region_cells[group];
    assert.equal(Object.keys(cells).length, adaptiveLayout.headers.length);
    for (const region of adaptiveLayout.regions) {
      const cell = cells[region.id];
      assert.ok(cell, `missing ${group}/${region.id} cell`);
      assert.deepEqual([cell.x, cell.width], [region.x, region.w]);
      assert.deepEqual(
        [cell.y, cell.height],
        [adaptiveLayout.group_rows[group].y, adaptiveLayout.group_rows[group].height]
      );
    }
    assert.deepEqual(adaptiveLayout.stage_boxes[group], cells.stage);
    assert.deepEqual(adaptiveLayout.visual_groups[group], cells[adaptivePrimary.id]);
  }
  for (const node of adaptiveGraph.nodes) {
    const box = adaptiveLayout.bounds[node.id];
    if (!box) continue;
    const cell = adaptiveLayout.region_cells[node.group][node.lane];
    assert.ok(box.x >= cell.x && box.y >= cell.y);
    assert.ok(box.x + box.w <= cell.x + cell.width);
    assert.ok(box.y + box.h <= cell.y + cell.height);
  }
  const adaptiveHtml = fs.readFileSync(path.join(adaptiveProject, 'route-map.html'), 'utf8');
  assert.equal((adaptiveHtml.match(/class="region-cell /g) ?? []).length, 3 * 4);
  assert.equal((adaptiveHtml.match(/class="stage-header" data-region-id="primary"/g) ?? []).length, 4);
  assert.doesNotMatch(adaptiveHtml, /merged-stage-container/);
  assert.ok(adaptiveLayout.tree_routes.length >= 4);
  assert.ok(Object.values(adaptiveLayout.node_layouts).some((node) => node.mode === 'tree'));
  assert.equal(adaptiveLayout.target_png.width, adaptiveLayout.canvas.width * 2);
  assert.equal(adaptiveLayout.target_png.height, adaptiveLayout.canvas.height * 2);
  assert.ok([1240, 1754].includes(adaptiveLayout.canvas.width));
  assert.equal(adaptiveLayout.canvas.height - adaptiveLayout.content_bbox.bottom >= 28, true);

  const semanticProject = makeSemanticAdaptiveProject();
  render(semanticProject);
  run('export-image.mjs', semanticProject);
  run('visual-qa.mjs', semanticProject);
  const semanticGraph = JSON.parse(fs.readFileSync(path.join(semanticProject, 'research_graph.json'), 'utf8'));
  const semanticLayout = JSON.parse(fs.readFileSync(path.join(semanticProject, 'render-layout.json'), 'utf8'));
  const semanticQa = JSON.parse(fs.readFileSync(path.join(semanticProject, 'qa-report.json'), 'utf8'));
  assert.equal(semanticQa.ok, true, semanticQa.errors.join('\n'));
  assert.deepEqual(semanticQa.warnings, [], semanticQa.warnings.join('\n'));
  assert.equal(semanticLayout.schema_version, '1.4');
  assert.deepEqual(semanticLayout.headers.map((header) => header.label), [
    '研究思路',
    '研究内容与阶段输出',
    '研究方法'
  ]);
  assert.deepEqual(semanticGraph.lanes.map((lane) => lane.kind), ['primary', 'method']);
  assert.equal(semanticGraph.nodes.some((node) => node.lane === 'thinking'), false);
  const semanticMethodLane = semanticGraph.lanes.find((lane) => lane.kind === 'method').id;
  assert.ok(semanticGraph.nodes.filter((node) => node.lane === semanticMethodLane).every((node) => (
    node.kind === 'method' && node.role === 'method' && node.children.length === 0
  )));
  assert.ok(['theory', 'data', 'indicator', 'validation'].every((id) => (
    semanticGraph.nodes.find((node) => node.id === id)?.lane === 'primary'
  )));
  const semanticContentText = semanticGraph.nodes
    .filter((node) => node.lane === 'primary')
    .flatMap((node) => [node.label, ...(node.children ?? []).map((child) => child.label)])
    .join(' ');
  for (const token of ['FO', 'CLDS', 'PSW', 'IV', '2SRI', '指标', '稳健性']) {
    assert.match(semanticContentText, new RegExp(token, 'i'));
  }
  const semanticMethodText = semanticGraph.nodes
    .filter((node) => node.lane === semanticMethodLane)
    .map((node) => node.label)
    .join(' ');
  assert.doesNotMatch(semanticMethodText, /FO|CLDS|PSW|2SRI|指标|稳健性/i);
  assert.ok(Object.values(semanticLayout.region_cells).every((cells) => Object.keys(cells).length === 3));

  const semanticRejections = [
    {
      name: 'old research-stage header',
      mutate: (_graph, design) => { design.region_labels.thinking = '研究阶段'; },
      match: /region_labels\.thinking|headers/
    },
    {
      name: 'separate thinking lane',
      mutate: (graph) => { graph.lanes.push({id: 'thinking', label: '研究思路', kind: 'thinking'}); },
      match: /separate thinking lane|exactly one primary/
    },
    {
      name: 'overlong research thinking',
      mutate: (graph) => { graph.groups[0].short_label = '非常复杂冗长的研究思路'; },
      match: /short_label/
    },
    {
      name: 'method tree children',
      mutate: (graph) => {
        const node = graph.nodes.find((item) => item.lane === semanticMethodLane);
        node.children = [{id: 'bad-method-child-a', label: 'CLDS数据'}, {id: 'bad-method-child-b', label: '指标'}];
      },
      match: /without children/
    },
    {
      name: 'specific method rail detail',
      mutate: (graph) => {
        graph.nodes.find((item) => item.lane === semanticMethodLane).label = 'CLDS数据库';
      },
      match: /too specific/
    },
    {
      name: 'hidden semantic method rail',
      mutate: (_graph, design) => { design.method_rail_mode = 'hidden'; },
      match: /cannot hide/
    },
    {
      name: 'metric in method rail',
      mutate: (graph) => {
        const node = graph.nodes.find((item) => item.lane === semanticMethodLane);
        node.kind = 'metric';
        node.role = 'indicator';
      },
      match: /kind method and role method/
    }
  ];
  for (const rejection of semanticRejections) {
    const project = path.join(root, `semantic-reject-${rejection.name.replaceAll(' ', '-')}`);
    fs.cpSync(semanticProject, project, {recursive: true});
    const graph = JSON.parse(fs.readFileSync(path.join(project, 'research_graph.json'), 'utf8'));
    const design = JSON.parse(fs.readFileSync(path.join(project, 'design_spec.json'), 'utf8'));
    rejection.mutate(graph, design);
    writeJson(project, 'research_graph.json', graph);
    writeJson(project, 'design_spec.json', design);
    runExpectedFailure('validate-spec.mjs', project);
    const report = JSON.parse(fs.readFileSync(path.join(project, 'validation-report.json'), 'utf8'));
    assert.ok(report.errors.some((message) => rejection.match.test(message)), `${rejection.name}: ${report.errors.join('\n')}`);
  }

  const adaptiveStageLayouts = [{count: 4, height: adaptiveLayout.canvas.height}];
  for (const count of [3, 5, 6]) {
    const project = makeAdaptiveProject(count, 'stage-count');
    render(project);
    const layout = JSON.parse(fs.readFileSync(path.join(project, 'render-layout.json'), 'utf8'));
    assert.equal(layout.canvas.height - layout.content_bbox.bottom >= 28, true);
    assert.equal(Object.keys(layout.group_rows).length, count);
    adaptiveStageLayouts.push({count, height: layout.canvas.height});
  }

  const noThinkingProject = makeAdaptiveProject(3, 'no-thinking');
  const noThinkingDesign = JSON.parse(fs.readFileSync(path.join(noThinkingProject, 'design_spec.json'), 'utf8'));
  noThinkingDesign.hidden_node_ids = ['g1-thinking', 'g2-thinking', 'g3-thinking'];
  writeJson(noThinkingProject, 'design_spec.json', noThinkingDesign);
  render(noThinkingProject);
  const noThinkingLayout = JSON.parse(fs.readFileSync(path.join(noThinkingProject, 'render-layout.json'), 'utf8'));
  assert.deepEqual(noThinkingLayout.headers.map((header) => header.label), [
    '研究阶段', '研究内容与阶段输出', '方法数据与指标'
  ]);
  assert.ok(Object.values(noThinkingLayout.region_cells).every((cells) => Object.keys(cells).length === 3));

  const hiddenMethodProject = makeAdaptiveProject(3, 'hidden-method');
  const hiddenMethodDesign = JSON.parse(fs.readFileSync(path.join(hiddenMethodProject, 'design_spec.json'), 'utf8'));
  hiddenMethodDesign.method_rail_mode = 'hidden';
  writeJson(hiddenMethodProject, 'design_spec.json', hiddenMethodDesign);
  render(hiddenMethodProject);
  const hiddenMethodLayout = JSON.parse(fs.readFileSync(path.join(hiddenMethodProject, 'render-layout.json'), 'utf8'));
  assert.deepEqual(hiddenMethodLayout.headers.map((header) => header.label), [
    '研究阶段', '研究思路', '研究内容与阶段输出'
  ]);
  assert.ok(Object.values(hiddenMethodLayout.region_cells).every((cells) => Object.keys(cells).length === 3));

  const customLaneProject = makeAdaptiveProject(3, 'custom-lane');
  const customGraph = JSON.parse(fs.readFileSync(path.join(customLaneProject, 'research_graph.json'), 'utf8'));
  const customDesign = JSON.parse(fs.readFileSync(path.join(customLaneProject, 'design_spec.json'), 'utf8'));
  customGraph.lanes.push({id: 'risk', label: '风险与资源', kind: 'discipline'});
  customGraph.nodes.push({
    id: 'g1-risk',
    label: '资源边界',
    lane: 'risk',
    group: 'g1',
    stage: 'other',
    kind: 'risk',
    role: 'risk',
    emphasis: 'uncertain',
    status: 'pending',
    children: [],
    source_refs: [{...sourceRef}]
  });
  customDesign.region_labels.risk = '风险与资源';
  writeJson(customLaneProject, 'research_graph.json', customGraph);
  writeJson(customLaneProject, 'design_spec.json', customDesign);
  render(customLaneProject);
  const customLaneLayout = JSON.parse(fs.readFileSync(path.join(customLaneProject, 'render-layout.json'), 'utf8'));
  assert.equal(customLaneLayout.headers.at(-1).label, '风险与资源');
  assert.equal(customLaneLayout.headers.length, 5);
  assert.ok(Object.values(customLaneLayout.region_cells).every((cells) => Object.keys(cells).length === 5));

  const adaptiveMappedProject = makeAdaptiveProject(3, 'mapped-methods');
  const adaptiveMappedDesign = JSON.parse(fs.readFileSync(path.join(adaptiveMappedProject, 'design_spec.json'), 'utf8'));
  adaptiveMappedDesign.method_rail_mode = 'mapped';
  writeJson(adaptiveMappedProject, 'design_spec.json', adaptiveMappedDesign);
  render(adaptiveMappedProject);
  run('export-image.mjs', adaptiveMappedProject);
  run('visual-qa.mjs', adaptiveMappedProject);
  const adaptiveMappedQa = JSON.parse(fs.readFileSync(path.join(adaptiveMappedProject, 'qa-report.json'), 'utf8'));
  assert.equal(adaptiveMappedQa.ok, true, adaptiveMappedQa.errors.join('\n'));
  assert.ok(JSON.parse(fs.readFileSync(path.join(adaptiveMappedProject, 'render-layout.json'), 'utf8'))
    .edge_routes.some((route) => route.kind === 'support'));

  const mappedProject = makeProject('research-process', 3);
  const mappedDesign = JSON.parse(fs.readFileSync(path.join(mappedProject, 'design_spec.json'), 'utf8'));
  mappedDesign.method_rail_mode = 'mapped';
  writeJson(mappedProject, 'design_spec.json', mappedDesign);
  render(mappedProject);
  run('export-image.mjs', mappedProject);
  run('visual-qa.mjs', mappedProject);
  const mappedQa = JSON.parse(fs.readFileSync(path.join(mappedProject, 'qa-report.json'), 'utf8'));
  assert.equal(mappedQa.ok, true, mappedQa.errors.join('\n'));
  assert.ok(JSON.parse(fs.readFileSync(path.join(mappedProject, 'render-layout.json'), 'utf8'))
    .edge_routes.some((route) => route.kind === 'support'));

  const hiddenProject = makeProject('research-process', 3);
  const hiddenDesign = JSON.parse(fs.readFileSync(path.join(hiddenProject, 'design_spec.json'), 'utf8'));
  hiddenDesign.method_rail_mode = 'hidden';
  writeJson(hiddenProject, 'design_spec.json', hiddenDesign);
  render(hiddenProject);
  const hiddenHtml = fs.readFileSync(path.join(hiddenProject, 'route-map.html'), 'utf8');
  assert.doesNotMatch(hiddenHtml, /data-node-id="(?:theory|data|method|indicator|validation)"/);
  assert.doesNotMatch(hiddenHtml, /class="graph-edge edge-support/);

  const invalidDashed = makeProject('research-process', 3);
  const badGraph = JSON.parse(fs.readFileSync(path.join(invalidDashed, 'research_graph.json'), 'utf8'));
  badGraph.edges.push({
    id: 'bad-unlabelled-optional',
    from: 'g1-question',
    to: 'g1-output',
    kind: 'parallel',
    label: '',
    status: 'optional'
  });
  writeJson(invalidDashed, 'research_graph.json', badGraph);
  runExpectedFailure('validate-spec.mjs', invalidDashed);
  const invalidReport = JSON.parse(fs.readFileSync(path.join(invalidDashed, 'validation-report.json'), 'utf8'));
  assert.ok(invalidReport.errors.some((message) => message.includes('needs a label or explicit endpoint status')));

  const invalidPolyline = makeProject('research-process', 3);
  const badDesign = JSON.parse(fs.readFileSync(path.join(invalidPolyline, 'design_spec.json'), 'utf8'));
  badDesign.edge_paths['e-g1-question-work'] = [
    [370, 250],
    [400, 250],
    [400, 260],
    [450, 260],
    [450, 250]
  ];
  writeJson(invalidPolyline, 'design_spec.json', badDesign);
  runExpectedFailure('validate-spec.mjs', invalidPolyline);
  const badPolylineReport = JSON.parse(fs.readFileSync(path.join(invalidPolyline, 'validation-report.json'), 'utf8'));
  assert.ok(badPolylineReport.errors.some((message) => message.includes('exceeds maximum segment count')));

  const qaProject = modeProjects['research-process'];
  run('export-image.mjs', qaProject);
  run('visual-qa.mjs', qaProject);
  const cleanQa = JSON.parse(fs.readFileSync(path.join(qaProject, 'qa-report.json'), 'utf8'));
  assert.equal(cleanQa.ok, true, cleanQa.errors.join('\n'));

  const fastDelivery = path.join(root, 'fast-delivery');
  run('build-route.mjs', draftConfirmedProject, ['--mode', 'fast', '--delivery-dir', fastDelivery]);
  assert.deepEqual(fs.readdirSync(fastDelivery).sort(), ['route-map.html', 'route-map.png', 'route-map.svg']);
  assert.equal(fs.existsSync(path.join(fastDelivery, 'qa-report.json')), false);

  const rigorousDelivery = path.join(root, 'rigorous-delivery');
  run('build-route.mjs', draftConfirmedProject, ['--mode', 'rigorous', '--delivery-dir', rigorousDelivery]);
  assert.deepEqual(fs.readdirSync(rigorousDelivery).sort(), ['route-map.html', 'route-map.png', 'route-map.svg']);

  const denseProject = stageProjects[6];
  render(denseProject);
  run('export-image.mjs', denseProject);
  run('visual-qa.mjs', denseProject);
  const denseQa = JSON.parse(fs.readFileSync(path.join(denseProject, 'qa-report.json'), 'utf8'));
  assert.equal(denseQa.ok, true, denseQa.errors.join('\n'));
  assert.deepEqual(denseQa.dom_checks.desktop.overflows, []);

  const fallbackProject = modeProjects['research-framework'];
  run('export-image.mjs', fallbackProject, [], {RRM_FORCE_SVG_FALLBACK: '1'});
  run('visual-qa.mjs', fallbackProject);
  const fallbackExport = JSON.parse(fs.readFileSync(path.join(fallbackProject, 'export-report.json'), 'utf8'));
  const fallbackQa = JSON.parse(fs.readFileSync(path.join(fallbackProject, 'qa-report.json'), 'utf8'));
  assert.equal(fallbackExport.mode, 'standalone-svg-fallback');
  assert.equal(fallbackQa.ok, true, fallbackQa.errors.join('\n'));

  const cleanLayoutRaw = fs.readFileSync(path.join(qaProject, 'render-layout.json'), 'utf8');
  const crossingLayout = JSON.parse(cleanLayoutRaw);
  const crossingRoute = crossingLayout.edge_routes.find((route) => route.kind === 'sequence');
  assert.ok(crossingRoute, 'crossing test needs a sequence route');
  crossingRoute.crossed_nodes = ['g1-output'];
  writeJson(qaProject, 'render-layout.json', crossingLayout);
  runExpectedFailure('visual-qa.mjs', qaProject);
  const crossingQa = JSON.parse(fs.readFileSync(path.join(qaProject, 'qa-report.json'), 'utf8'));
  assert.ok(crossingQa.errors.some((message) => message.includes('crosses node')));
  fs.writeFileSync(path.join(qaProject, 'render-layout.json'), cleanLayoutRaw);

  const adaptiveLayoutRaw = fs.readFileSync(path.join(adaptiveProject, 'render-layout.json'), 'utf8');
  const misalignedCellLayout = JSON.parse(adaptiveLayoutRaw);
  misalignedCellLayout.region_cells.g1.thinking.x += 5;
  writeJson(adaptiveProject, 'render-layout.json', misalignedCellLayout);
  runExpectedFailure('visual-qa.mjs', adaptiveProject);
  const misalignedCellQa = JSON.parse(fs.readFileSync(path.join(adaptiveProject, 'qa-report.json'), 'utf8'));
  assert.ok(misalignedCellQa.errors.some((message) => message.includes('not aligned to its header')));
  fs.writeFileSync(path.join(adaptiveProject, 'render-layout.json'), adaptiveLayoutRaw);

  const cleanSvg = fs.readFileSync(path.join(qaProject, 'route-map.svg'), 'utf8');
  const cleanHtml = fs.readFileSync(path.join(qaProject, 'route-map.html'), 'utf8');
  const curvedSvg = cleanSvg.replace(
    /(<path\b[^>]*class="[^"]*structural-edge[^"]*"[^>]*\bd=")[^"]+(")/,
    '$1M 10 10 C 20 20 30 30 40 40$2'
  );
  const curvedHtml = cleanHtml.replace(cleanSvg, curvedSvg);
  assert.notEqual(curvedSvg, cleanSvg, 'curve injection did not find a structural connector');
  fs.writeFileSync(path.join(qaProject, 'route-map.svg'), curvedSvg);
  fs.writeFileSync(path.join(qaProject, 'route-map.html'), curvedHtml);
  runExpectedFailure('visual-qa.mjs', qaProject);
  const curveQa = JSON.parse(fs.readFileSync(path.join(qaProject, 'qa-report.json'), 'utf8'));
  assert.ok(curveQa.errors.some((message) => message.includes('curve or arc')));
  fs.writeFileSync(path.join(qaProject, 'route-map.svg'), cleanSvg);
  fs.writeFileSync(path.join(qaProject, 'route-map.html'), cleanHtml);

  const divergentSvg = cleanSvg.replace('data-editable-svg="office-compatible"', 'data-editable-svg="office-compatible" data-test-divergence="true"');
  fs.writeFileSync(path.join(qaProject, 'route-map.svg'), divergentSvg);
  runExpectedFailure('visual-qa.mjs', qaProject);
  const divergentQa = JSON.parse(fs.readFileSync(path.join(qaProject, 'qa-report.json'), 'utf8'));
  assert.ok(divergentQa.errors.some((message) => message.includes('differs from the HTML embedded SVG')));
  fs.writeFileSync(path.join(qaProject, 'route-map.svg'), cleanSvg);

  const missingGroupSvg = cleanSvg.replace('id="node-g1-question"', 'id="node-g1-question-removed"');
  const missingGroupHtml = cleanHtml.replace(cleanSvg, missingGroupSvg);
  fs.writeFileSync(path.join(qaProject, 'route-map.svg'), missingGroupSvg);
  fs.writeFileSync(path.join(qaProject, 'route-map.html'), missingGroupHtml);
  runExpectedFailure('visual-qa.mjs', qaProject);
  const missingGroupQa = JSON.parse(fs.readFileSync(path.join(qaProject, 'qa-report.json'), 'utf8'));
  assert.ok(missingGroupQa.errors.some((message) => message.includes('missing editable node group g1-question')));
  fs.writeFileSync(path.join(qaProject, 'route-map.svg'), cleanSvg);
  fs.writeFileSync(path.join(qaProject, 'route-map.html'), cleanHtml);

  const unsafeSvg = cleanSvg.replace('</svg>', '<foreignObject x="0" y="0" width="1" height="1"></foreignObject></svg>');
  const unsafeHtml = cleanHtml.replace(cleanSvg, unsafeSvg);
  fs.writeFileSync(path.join(qaProject, 'route-map.svg'), unsafeSvg);
  fs.writeFileSync(path.join(qaProject, 'route-map.html'), unsafeHtml);
  runExpectedFailure('visual-qa.mjs', qaProject);
  const unsafeQa = JSON.parse(fs.readFileSync(path.join(qaProject, 'qa-report.json'), 'utf8'));
  assert.ok(unsafeQa.errors.some((message) => message.includes('unsupported foreignObject')));
  fs.writeFileSync(path.join(qaProject, 'route-map.svg'), cleanSvg);
  fs.writeFileSync(path.join(qaProject, 'route-map.html'), cleanHtml);

  const result = {
    ok: true,
    root,
    route_modes: Object.keys(modeProjects),
    stage_counts: stageReports,
    legacy_versions: ['1.0', '1.1'],
    confirmation_modes: ['mermaid-draft', 'legacy-framework'],
    method_rail_modes: ['aligned', 'mapped', 'hidden'],
    adaptive_layout: [
      'dynamic visible-region headers',
      'one independent stage cell per visible header',
      'stage title restricted to the content cell',
      'schema 1.4 thinking/content/method semantics',
      'summary-only method rail',
      'content-fit height for 3–6 stages',
      '2–4 child trees across lanes',
      'hidden/empty/custom lane reflow',
      '2× 300 dpi PNG'
    ],
    adaptive_stage_layouts: adaptiveStageLayouts,
    rejection_tests: [
      ...semanticRejections.map((item) => item.name),
      'unlabelled optional edge',
      'more than three orthogonal segments',
      'edge crossing a node',
      'misaligned stage cell',
      'SVG curve command',
      'standalone/embedded SVG divergence',
      'missing editable group',
      'Office-incompatible SVG element'
    ],
    stress_tests: ['long Chinese/English mixed node', 'six-stage dense layout', 'standalone-SVG browser fallback'],
    static_artifacts: ['route-map.svg', 'route-map.html', 'route-map.png'],
    internal_quality_artifacts: ['qa-report.json', 'validation-report.json', 'render-layout.json', 'export-report.json']
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (!keep) fs.rmSync(root, {recursive: true, force: true});
  else console.error(`Kept fixtures at ${root}`);
}
