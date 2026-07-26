# Adaptive research intake

Use this reference after a topic is supplied and before authoring a Mermaid draft. The intake is deliberately small: use prior context and a light analogous-route search to ask only questions that can change the route.

## Intake contract

Store the current state in `intake_profile.json` with schema `1.0`.

```json
{
  "schema_version": "1.0",
  "topic": "",
  "route_mode": "research-process",
  "domain_profile": "general",
  "draft_revision": 1,
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

## Question policy

The first round covers three decision areas, but do not ask again for information already supplied by the topic, an attachment, or an earlier answer:

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

Stop questioning when the remaining uncertainty will not change the route. Mark lower-impact uncertainty in `unresolved`.

An unresolved item has:

```json
{"category": "sample_access", "reason": "尚未确认外部样本", "impact": "high"}
```

The Mermaid draft may display `待定` or `未核验`, but it cannot be locked while any `high`-impact item remains. A failed or unavailable analogous-route search is high impact until the route basis is verified.
