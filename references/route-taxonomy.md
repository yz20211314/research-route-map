# Route-mode and research-route taxonomy

Use this reference after topic research and before drafting the Markdown framework.

## 1. Select one route mode

| Route mode | Use when | Default page grammar |
|---|---|---|
| `research-process` | the figure explains how a research question will be answered | stage axis + work packages + matched methods/data + validation + milestones/outcomes |
| `research-framework` | the figure explains concepts, questions, content, evidence, and relationships without a single dominant chronology | aligned matrix or nested framework; arrows only for supported relations |
| `technology-roadmap` | the figure plans technology/capability development over time | horizontal time horizons + capability/technology layers + maturity/KPI + gates/dependencies/risks |
| `study-flow` | the figure tracks participants, samples, records, or studies | domain-standard phases + counts/status/reasons + analysis population |

Default “科研技术路线图” to `research-process`. Do not select `technology-roadmap` merely because the Chinese phrase contains “技术”.

## 2. Select one dominant research-route archetype

The archetype describes scientific logic within the selected route mode.

| Archetype | Typical primary chain | Common use |
|---|---|---|
| Mechanism-validation | phenomenon → hypothesis → mechanism → perturbation → validation → translation | biomedical, life science, materials mechanism |
| Data-model-validation | question → data → preprocessing → model → internal/external validation → interpretation/application | computation, AI, prediction |
| Classification-diagnosis-path | boundary → classification → diagnosis → obstacle/factor → mechanism/configuration → differentiated path → evaluation | social science, public policy, rural/regional studies |
| Design-build-evaluate | need → requirements → design → prototype → test → iteration → deployment | engineering, system/product research |
| Intervention-evaluation | context → programme theory → intervention → implementation → mechanism → outcome/impact → scaling | public health, education, governance intervention |
| Evidence-synthesis | question → protocol → retrieval → screening → appraisal → synthesis → certainty → recommendation | systematic/scoping review |

Use a hybrid only when analogous studies support it. Name the dominant archetype and the borrowed secondary elements.

## 3. Required scientific categories

Treat these as an applicability checklist, not a fixed order:

1. **Why** — background, gap, practical problem, objective.
2. **Who/what/where** — object, population, unit, sample, boundary, comparison unit.
3. **Theory/context** — concepts, assumptions, contextual conditions, hypothesized relations.
4. **Evidence/data** — source, sampling/acquisition, preprocessing, quality control, ethics/compliance.
5. **Work packages** — answerable substantive tasks.
6. **Methods/techniques** — mapped to the task they answer.
7. **Measures/criteria** — variables, endpoints, indicators, thresholds, metrics, or decision rules.
8. **Explanation** — mechanism, association, causal pathway, configuration, heterogeneity, or feedback.
9. **Validation** — controls/comparators, robustness, sensitivity, triangulation, external cases, replication, or counterfactuals.
10. **Outputs/impact** — conclusions, model, path, intervention, recommendation, implementation, target capability, and assessment.

Put each non-applicable category in `meta.not_applicable` with a reason.

## 4. Stage/layer matrix

For each research-process stage or research-framework layer, record:

| Field | Question |
|---|---|
| Intent | What question or objective is addressed? |
| Inputs | Which theory, sample, data, context, or prior output enters? |
| Research content | Which two to four substantive tasks are performed? |
| Relation | Are tasks sequential, causal, parallel, optional, or a decision? |
| Methods | Which method/data answers each task? |
| Measures | What variable, indicator, result, milestone, or decision is produced? |
| Validation | How is it checked? |
| Handoff | What becomes the next stage's input? |

If a method cannot be mapped to a task, remove it or explain its role. If a stage produces no output, decision, or handoff, refine or merge it.

## 5. Mode-specific structure

### Research process

- Normally 3–6 evidence-supported macro stages.
- Each retained stage normally has an intent, two to four tasks, matched methods/data, a milestone, validation, and a handoff.
- Use sequence arrows only for actual order. Use parallel containment/bus relationships for sibling tasks.

### Research framework

- Normally 3–6 aligned layers or modules.
- Relationship and support may be conveyed by alignment and enclosure.
- Do not force every module into a top-to-bottom procedure.

### Technology roadmap

Must include the applicable subset of:

- scope and time horizon;
- current capability/maturity baseline;
- target capability and measurable performance;
- technology alternatives;
- dependencies and integration;
- milestones and decision gates;
- risks, resources/owners, and update assumptions.

If no meaningful time horizon or maturity/decision progression exists, use `research-process`.

### Study flow

- Identify the applicable study/reporting template.
- Preserve counts/status, eligibility, exclusions with reasons, allocation or processing, follow-up, and analysis when relevant.
- Do not add a generic research outcome band.

## 6. Density targets

For a full research-process/framework figure:

- normally 3–6 macro containers;
- use one region per visible lane; a typical research-process figure has stage, thinking, content/output, and method/data regions;
- target 18–45 visible nodes;
- 1–3 milestones/decisions per stage;
- no more than 5–7 color roles.

These are layout targets only. Never invent content to reach a number.
