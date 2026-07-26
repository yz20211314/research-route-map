#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseMermaidDraft, validateDraftInputs} from './lib/draft-utils.mjs';
import {readConfirmedSource} from './lib/source-contract.mjs';

const scripts = path.dirname(new URL(import.meta.url).pathname);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'research-route-draft-tests-'));
const keep = process.argv.includes('--keep');
const writeJson = (dir, name, value) => fs.writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
const run = (name, project, args = []) => execFileSync(process.execPath, [path.join(scripts, name), project, ...args], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});
const fails = (name, project, args = []) => {
  const result = spawnSync(process.execPath, [path.join(scripts, name), project, ...args], {encoding: 'utf8'});
  assert.notEqual(result.status, 0, `${name} should fail`);
  return result;
};

const normalQuestions = [
  {id: 'Q1', round: 1, category: 'identity_use', question: '身份与用途？', answer: '学位论文'},
  {id: 'Q2', round: 1, category: 'scope', question: '核心问题？', answer: '解释关键关系'},
  {id: 'Q3', round: 1, category: 'feasibility', question: '可用资源？', answer: '公开数据'}
];

const intakeFor = (level, questionCount = 3) => {
  const questions = [...normalQuestions];
  if (questionCount >= 4) questions.push({id: 'Q4', round: 2, category: 'validation', question: '验证标准？', answer: '外部比较'});
  if (questionCount >= 5) questions.push({id: 'Q5', round: 2, category: 'innovation', question: '创新深度？', answer: '机制解释'});
  return {
    schema_version: '1.1',
    topic: '定制化技术路线测试',
    route_mode: 'research-process',
    domain_profile: 'general',
    draft_revision: 1,
    research_content: {
      input_level: 'outline',
      source_refs: ['用户消息：三部分研究提纲'],
      sections: [
        {id: 'RC1', title: '问题界定', summary: '明确对象、边界与理论依据'},
        {id: 'RC2', title: '核心分析', summary: '使用数据和具体技术完成分析'},
        {id: 'RC3', title: '验证输出', summary: '检验结果并形成结论'}
      ],
      gaps: []
    },
    research_context: {level, use_case: '测试与论文'},
    scope: {
      core_question: '解释对象与结果关系',
      object: '公开数据中的研究对象',
      boundary: '限定时间和区域',
      expected_output: '可验证结论'
    },
    resources: {
      data_samples: '公开数据',
      equipment_software: '常规统计软件',
      required_methods: ['比较分析'],
      excluded_methods: [],
      time_constraints: '一年内',
      other_constraints: '无'
    },
    questions,
    question_count: questions.length,
    unresolved: [],
    stage_override: {allowed: false, reason: ''},
    density_exception: {allowed: false, reason: ''},
    prefilled_from: []
  };
};

const basis = {
  schema_version: '1.0',
  topic: '定制化技术路线测试',
  searched_at: '2026-07-26T00:00:00.000Z',
  status: 'verified',
  analogues: [
    {
      title: '相似路线研究甲',
      url: 'https://example.org/analogue-a',
      year: 2025,
      route_pattern: '界定—分析—验证',
      transferable: '阶段与验证结构',
      limitation: '对象不同',
      access_level: 'full_text'
    },
    {
      title: '相似路线研究乙',
      url: 'https://example.org/analogue-b',
      year: 2024,
      route_pattern: '理论—实证—解释',
      transferable: '方法分叉',
      limitation: '数据规模不同',
      access_level: 'abstract'
    }
  ],
  selected_pattern: '界定—分析—验证',
  method_forks: [
    {id: 'F1', label: '主要分析策略', options: ['比较分析', '机制建模'], decision_status: 'chosen'}
  ],
  limitations: ['相似路线仅提供结构参照'],
  source_count: 2
};

const draftFor = (stageCount, revision = 1, extra = '') => {
  const nodes = Array.from({length: stageCount}, (_, index) => {
    const number = index + 1;
    const thinking = ['问题界定', '核心分析', '验证输出', '机制解释', '成果转化', '综合提升'][index];
    return `  S${number}["思路：${thinking}<br/>内容：完成核心分析<br/>方法：比较分析法<br/>产出：阶段成果"]`;
  }).join('\n');
  const edges = Array.from({length: stageCount - 1}, (_, index) => `  S${index + 1} --> S${index + 2}`).join('\n');
  return `---
title: 定制化技术路线草图
config:
  flowchart:
    curve: stepAfter
---
flowchart TD
  %% revision: ${revision}
${nodes}
${extra}
${edges}
`;
};

const assertValid = (intake, draft) => {
  const result = validateDraftInputs(intake, structuredClone(basis), draft);
  assert.deepEqual(result.errors, [], result.errors.join('\n'));
  return result;
};

try {
  const academicCases = [
    ['undergraduate', 3, 3],
    ['master', 4, 4],
    ['doctoral', 5, 5],
    ['professor-team', 5, 3],
    ['other', 3, 3]
  ];
  for (const [level, stages, questions] of academicCases) {
    const result = assertValid(intakeFor(level, questions), draftFor(stages));
    assert.equal(result.stats.stage_count, stages);
    assert.equal(result.stats.question_count, questions);
  }

  const prefilled = intakeFor('master', 3);
  prefilled.questions = [];
  prefilled.question_count = 0;
  prefilled.prefilled_from = ['用户附件：完整研究内容、研究对象、方法与资源'];
  assertValid(prefilled, draftFor(3));

  const legacyIntake = intakeFor('undergraduate', 3);
  legacyIntake.schema_version = '1.0';
  delete legacyIntake.research_content;
  assertValid(legacyIntake, draftFor(3)
    .replaceAll('思路：', '阶段：')
    .replaceAll('内容：', '研究：'));

  const sixStage = intakeFor('doctoral', 3);
  sixStage.stage_override = {allowed: true, reason: '用户明确给出六个研究单元'};
  sixStage.density_exception = {allowed: true, reason: '领域规范需要六阶段'};
  assertValid(sixStage, draftFor(6));

  const revisionOne = parseMermaidDraft(draftFor(4, 1));
  const revisionTwo = parseMermaidDraft(draftFor(4, 2).replace('完成核心分析', '完成稳健分析'));
  assert.deepEqual(revisionOne.nodes.map((node) => node.id), revisionTwo.nodes.map((node) => node.id));
  assert.equal(revisionTwo.revision, 2);

  const project = path.join(root, 'valid-lock');
  fs.mkdirSync(project, {recursive: true});
  writeJson(project, 'intake_profile.json', intakeFor('master', 4));
  writeJson(project, 'research_basis.json', basis);
  fs.writeFileSync(path.join(project, 'route_draft.mmd'), draftFor(4));
  run('validate-draft.mjs', project);
  run('lock-draft.mjs', project, ['--confirmed']);
  assert.equal(readConfirmedSource(project).mode, 'mermaid-draft');

  fs.writeFileSync(path.join(project, 'route_draft.mmd'), draftFor(4).replace('阶段成果', '修订成果'));
  fails('lock-draft.mjs', project, ['--confirmed']);
  assert.throws(() => readConfirmedSource(project), /changed after confirmation|stale/);

  const titleOnlyProject = path.join(root, 'title-only-blocked');
  fs.mkdirSync(titleOnlyProject, {recursive: true});
  const titleOnlyIntake = intakeFor('undergraduate', 0);
  titleOnlyIntake.research_content = {
    input_level: 'title-only',
    source_refs: [],
    sections: [],
    gaps: ['请提供研究内容']
  };
  writeJson(titleOnlyProject, 'intake_profile.json', titleOnlyIntake);
  writeJson(titleOnlyProject, 'research_basis.json', basis);
  fs.writeFileSync(path.join(titleOnlyProject, 'route_draft.mmd'), draftFor(3));
  fails('validate-draft.mjs', titleOnlyProject);
  fails('lock-draft.mjs', titleOnlyProject, ['--confirmed']);

  const invalidCases = [
    {
      name: 'title-only research content',
      intake: {
        ...intakeFor('undergraduate'),
        research_content: {
          input_level: 'title-only',
          source_refs: [],
          sections: [],
          gaps: ['请提供研究内容']
        }
      },
      basis,
      draft: draftFor(3),
      match: /title-only/
    },
    {
      name: 'more than five questions',
      intake: {...intakeFor('master', 5), questions: [...intakeFor('master', 5).questions, {id: 'Q6', round: 2, category: 'extra', question: '额外问题？', answer: '额外回答'}], question_count: 6},
      basis,
      draft: draftFor(4),
      match: /at most five/
    },
    {
      name: 'unstable node ID',
      intake: intakeFor('undergraduate'),
      basis,
      draft: draftFor(3).replace('S2["', 'stageTwo["').replaceAll('S2', 'stageTwo'),
      match: /stable S\/D\/O\/P ID/
    },
    {
      name: 'curve configuration',
      intake: intakeFor('undergraduate'),
      basis,
      draft: draftFor(3).replace('stepAfter', 'basis'),
      match: /stepAfter|forbidden/
    },
    {
      name: 'unlabelled dashed edge',
      intake: intakeFor('undergraduate'),
      basis,
      draft: draftFor(3, 1, '  P1["可选支撑"]\n  P1 -.-> S2'),
      match: /semantic label/
    },
    {
      name: 'fake decision',
      intake: intakeFor('undergraduate'),
      basis,
      draft: draftFor(3, 1, '  D1{"是否继续"}\n  S1 --> D1\n  D1 --> S2'),
      match: /at least two outgoing branches|branch label/
    },
    {
      name: 'unparsable statement',
      intake: intakeFor('undergraduate'),
      basis,
      draft: draftFor(3, 1, '  S1 --x S3'),
      match: /unparsable canonical Mermaid statement/
    },
    {
      name: 'overlong label',
      intake: intakeFor('undergraduate'),
      basis,
      draft: draftFor(3).replace('完成核心分析', '完成特别复杂且无法在卡片中清晰展示的超长核心分析任务'),
      match: /exceeds 14/
    },
    {
      name: 'more than ten nodes',
      intake: {...sixStage, draft_revision: 1},
      basis,
      draft: draftFor(6, 1, '  P1["支撑1"]\n  P2["支撑2"]\n  P3["支撑3"]\n  P4["支撑4"]\n  P5["支撑5"]'),
      match: /exceeds 10/
    },
    {
      name: 'unavailable research',
      intake: {...intakeFor('undergraduate'), unresolved: [{category: 'analogues', reason: '网络不可用', impact: 'high'}]},
      basis: {...basis, status: 'unavailable', analogues: [], source_count: 0},
      draft: draftFor(3).replace('匹配数据方法', '待定未核验'),
      match: /research basis status|high-impact/
    },
    {
      name: 'skipped answer',
      intake: {...intakeFor('undergraduate'), scope: {...intakeFor('undergraduate').scope, core_question: ''}},
      basis,
      draft: draftFor(3),
      match: /scope.core_question/
    }
  ];
  for (const test of invalidCases) {
    const result = validateDraftInputs(structuredClone(test.intake), structuredClone(test.basis), test.draft);
    assert.ok(result.errors.some((message) => test.match.test(message)), `${test.name}: ${result.errors.join('\n')}`);
  }

  console.log(JSON.stringify({
    ok: true,
    academic_levels: academicCases.map(([level]) => level),
    question_paths: [0, 3, 4, 5],
    revision_lock_invalidation: true,
    rejection_tests: invalidCases.map((item) => item.name)
  }, null, 2));
} finally {
  if (!keep) fs.rmSync(root, {recursive: true, force: true});
  else console.error(`Kept fixtures at ${root}`);
}
