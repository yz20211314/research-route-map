#!/usr/bin/env node
import assert from 'node:assert/strict';
import {analyzeResearchLogic} from './lib/logic-qa.mjs';

const coreProblem = {
  question: '数字化如何提升乡村治理效能？',
  primary_relation: '数字技术赋能路径→治理效能',
  object: '县域乡村治理',
  boundary: '限定县域与样本期',
  outcome: '治理效能指数',
  innovation_cut: '机制与区域异质性',
  exclusions: ['宏观政策沿革']
};
const literature = {
  main_views: ['宏观制度视角', '技术应用视角', '治理绩效视角'],
  gap: '重现状、轻机制，微观证据不足',
  increment: '补充机制检验与区域比较'
};
const empirical = {
  unit: '县域',
  data_source: '统计年鉴与问卷匹配数据',
  sample: '2015—2024年县域面板',
  variable_roles: [
    {role: 'explanatory', name: '数字化水平', measure: '数字基础设施指数'},
    {role: 'outcome', name: '治理效能', measure: '综合评价指数'},
    {role: 'control', name: '财政能力', measure: '一般公共预算收入'}
  ],
  baseline_model: '双向固定效应模型',
  identification: '工具变量与滞后项',
  robustness: ['替换指标', '安慰剂检验'],
  heterogeneity: ['区域分组'],
  mechanism: ['资源配置效率']
};

const graph = {
  schema_version: '1.2',
  meta: {title: '数字赋能乡村治理现代化', route_mode: 'research-process', core_problem: coreProblem, literature_position: literature, empirical_design: empirical},
  lanes: [{id: 'content', label: '研究内容', kind: 'primary'}, {id: 'methods', label: '研究方法', kind: 'method'}],
  groups: [
    {id: 'g1', label: '问题界定', output_node: 'n2'},
    {id: 'g2', label: '机制分析', output_node: 'n4'},
    {id: 'g3', label: '实证检验', output_node: 'n6'}
  ],
  nodes: [
    {id: 'n1', label: '核心问题', group: 'g1', lane: 'content', role: 'stage_question', kind: 'process'},
    {id: 'n2', label: '理论框架', group: 'g1', lane: 'content', role: 'stage_output', kind: 'conclusion'},
    {id: 'n3', label: '作用机制', group: 'g2', lane: 'content', role: 'work_package', kind: 'process'},
    {id: 'n4', label: '机制假设', group: 'g2', lane: 'content', role: 'stage_output', kind: 'conclusion'},
    {id: 'n5', label: '双向固定效应模型', group: 'g3', lane: 'methods', role: 'model', kind: 'model'},
    {id: 'n6', label: '治理效能检验', group: 'g3', lane: 'content', role: 'stage_output', kind: 'conclusion'}
  ],
  edges: [
    {id: 'e1', from: 'n1', to: 'n2', kind: 'sequence'},
    {id: 'e2', from: 'n2', to: 'n3', kind: 'sequence'},
    {id: 'e3', from: 'n3', to: 'n4', kind: 'sequence'},
    {id: 'e4', from: 'n5', to: 'n6', kind: 'support'}
  ]
};

const valid = analyzeResearchLogic(graph, {core_problem: coreProblem, literature_position: literature, empirical_design: empirical});
assert.equal(valid.errors.length, 0);
assert.equal(valid.valid, true);
assert.equal(valid.metrics.semantic_sections.empirical_design, true);
assert.equal(valid.metrics.work_node_count, 5);

const incomplete = structuredClone(graph);
incomplete.meta.core_problem = {question: '只有问题'};
const bad = analyzeResearchLogic(incomplete, {});
assert.ok(bad.errors.some((item) => item.includes('core_problem.primary_relation')));
assert.equal(bad.valid, false);

const generic = structuredClone(graph);
generic.meta = {title: '通用路线', route_mode: 'research-process'};
generic.nodes = Array.from({length: 7}, (_, index) => ({
  id: `w${index + 1}`, label: `工作包${index + 1}`, group: 'g1', lane: 'content', role: 'work_package', kind: 'process'
}));
generic.groups = [{id: 'g1', label: '单一阶段', output_node: 'w7'}];
generic.edges = generic.nodes.slice(0, -1).map((node, index) => ({id: `s${index}`, from: node.id, to: generic.nodes[index + 1].id, kind: 'sequence'}));
const genericReport = analyzeResearchLogic(generic, {});
assert.ok(genericReport.warnings.some((item) => item.includes('long linear chain')));
assert.equal(analyzeResearchLogic(generic, {}, {strict: true}).strict_errors.length > 0, true);

console.log('logic QA tests passed');
