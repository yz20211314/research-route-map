# Adaptive research intake

Use this reference after a topic and research content are supplied and before authoring a Mermaid draft. A title alone is never a complete route source. The intake is deliberately small: extract supplied content first, then use analogous-route research to ask only questions that can change the route.

## Intake contract

Store new-project state in `intake_profile.json` with schema `1.1`. Schema 1.0 remains readable for existing projects.

```json
{
  "schema_version": "1.1",
  "topic": "",
  "route_mode": "research-process",
  "domain_profile": "general",
  "generation_mode": "fast",
  "draft_revision": 1,
  "research_content": {
    "input_level": "outline",
    "source_refs": ["用户消息"],
    "sections": [
      {"id": "RC1", "title": "理论分析", "summary": "界定概念并提出作用机制"},
      {"id": "RC2", "title": "实证识别", "summary": "使用数据识别效应与机制"},
      {"id": "RC3", "title": "结论应用", "summary": "形成结论与政策建议"}
    ],
    "gaps": []
  },
  "research_context": {
    "level": "master",
    "use_case": "学位论文"
  },
  "scope": {
    "core_question": "",
    "object": "",
    "boundary": "",
    "expected_output": ""
  },
  "core_problem": {
    "question": "数字技术如何影响治理效能？",
    "primary_relation": "数字技术赋能路径→治理效能",
    "object": "县域乡村治理",
    "boundary": "限定区域、时期与分析单元",
    "outcome": "治理效能指标",
    "innovation_cut": "机制与异质性",
    "exclusions": ["与主关系无关的宏观背景"]
  },
  "literature_position": {
    "main_views": ["制度视角", "技术应用视角", "绩效视角"],
    "gap": "重宏观、轻微观；重现状、轻机制",
    "increment": "补充微观机制识别与区域比较"
  },
  "empirical_design": {
    "unit": "县域/企业/个体",
    "data_source": "数据集、年鉴或访谈来源",
    "sample": "样本范围与时间",
    "variable_roles": [
      {"role": "explanatory", "name": "核心解释变量", "measure": "量化方式"},
      {"role": "outcome", "name": "被解释变量", "measure": "量化方式"}
    ],
    "baseline_model": "基准模型",
    "identification": "识别策略",
    "robustness": ["替换指标", "安慰剂/稳健性检验"],
    "heterogeneity": ["分组或交互项"],
    "mechanism": ["中介/机制变量"]
  },
  "resources": {
    "data_samples": "",
    "equipment_software": "",
    "required_methods": [],
    "excluded_methods": [],
    "time_constraints": "",
    "other_constraints": ""
  },
  "questions": [
    {
      "id": "Q1",
      "round": 1,
      "category": "identity_use",
      "question": "",
      "answer": ""
    }
  ],
  "question_count": 1,
  "unresolved": [],
  "stage_override": {
    "allowed": false,
    "reason": ""
  },
  "density_exception": {
    "allowed": false,
    "reason": ""
  },
  "prefilled_from": []
}
```

Controlled `research_context.level` values are `undergraduate`, `master`, `doctoral`, `professor-team`, and `other`.

Controlled `research_content.input_level` values are:

- `full` — the user supplied full research content;
- `outline` — the user supplied a structured outline sufficient to identify work packages, methods/evidence, and outputs;
- `title-only` — only a topic/title is available.

Controlled `generation_mode` values are:

- `fast` — default for ordinary route-map generation. Reuse the supplied research content and verified Pass 1 basis; do not repeat deep evidence research unless a high-impact gap remains.
- `rigorous` — use Pass 2 evidence deepening for fund applications, doctoral research, formal project review, high-risk domains, or when the user explicitly requests full provenance.

The generation mode controls evidence effort and provenance depth, not the visual grammar. Both modes must preserve the confirmed Mermaid logic, concrete methods/data/indicators, output coverage, SVG/HTML/PNG same-source checks, and visual QA. A fast project with an unresolved high-impact evidence or feasibility gap must be escalated to rigorous mode or remain provisional; it must not silently omit the gap.

`title-only` blocks Mermaid validation and locking. Ask the user to provide or attach research content with this compact template:

```text
研究对象与核心问题：
研究内容1：研究什么；拟用哪些数据或具体方法；形成什么结果
研究内容2：……
研究内容3：……
已有数据、方法要求与限制：
```

Do not turn a title into a complete research design. Do not count this blocking request as an adaptive research question.

## Question policy

First extract `research_content.sections[]` from the supplied message or attachment. A detailed source may resolve every route decision and therefore require zero questions.

The first round covers three decision areas, but do not ask again for information already supplied by the research content, an attachment, or an earlier answer:

1. identity and use;
2. core question, object, boundary, and expected outcome;
3. available data/samples/equipment/software, required or excluded methods, time, and resource limits.

Record only questions actually asked in `questions[]`. Therefore a prefilled attachment can reduce the first round below three questions. Round 1 has at most three questions.

Ask a second round only when an unresolved choice can materially change stages, method, feasibility, validation, or claimed innovation. Ask at most two questions from:

- a method fork found in analogous routes;
- indicator, validation, or acceptance criteria;
- innovation and theory/mechanism depth;
- data, sample, ethics, or experimental conditions;
- a stage arrangement already proposed by the user.

The complete intake has at most five asked questions and at most two rounds. Each entry needs the exact question and the user's answer. Do not count silent inferences or prefilled facts as questions; list their file or message origin in `prefilled_from`.

## Academic calibration

Use level only to control complexity. A stated user design always wins.

| Level | Default draft |
|---|---|
| `undergraduate` | exactly 3 stages; one feasible main method; basic comparison or validation |
| `master` | 3–4 stages; main method plus comparison or robustness; one explicit innovation |
| `doctoral` | 4–5 stages; theory, mechanism, or method innovation; multiple studies only with resources |
| `professor-team` | 4–5 work packages; parallel tasks, dependencies, gates, risk, and team resources |
| `other` | 3–5 stages chosen from use, resources, and deliverable |

Use `stage_override.allowed: true` with a concrete reason when the user's explicit design falls outside the default range. Six stages additionally require `density_exception.allowed: true` and a reason.

## Stop and blocking rules

Stop questioning when the remaining uncertainty will not change the route. Mark lower-impact uncertainty in `unresolved`. Never ask merely to fill a quota.

An unresolved item has:

```json
{"category": "sample_access", "reason": "尚未确认外部样本", "impact": "high"}
```

The Mermaid draft may display `待定` or `未核验`, but it cannot be locked while any `high`-impact item remains. A failed or unavailable analogous-route search is high impact until the route basis is verified.
