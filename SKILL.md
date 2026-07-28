---
name: research-route-map
description: Convert supplied research content or a structured research outline into an evidence-aware scientific route map. Validate content completeness, compare two to three analogous routes, ask at most five non-repeating questions, confirm a compact Mermaid draft, then generate an editable SVG, static HTML, and high-resolution PNG research-process roadmap, research framework, technology-development roadmap, or study-flow diagram with a fast or rigorous evidence profile and QA. Use when users provide research content for a thesis, proposal, fund application, or project and want a technical route map.
---

# Research Route Map

Require complete research content or a structured research outline. Never turn a title alone into a complete research design. Extract supplied content before searching or asking questions, let the user edit a compact Mermaid draft through conversation, and render only after explicit confirmation of the current revision.

This skill produces static artifacts. Do not prepare, load, inject, or deliver an editor runtime.

## Generation profiles

Every new intake may set `generation_mode` to `fast` or `rigorous`; the default is `fast`.

- `fast` reuses the supplied research content and verified analogous-route basis. It does not repeat full post-confirmation evidence deepening when the confirmed draft already covers methods/data, indicators or validation, and outputs.
- `rigorous` performs the full post-confirmation evidence pass and node-level provenance work. Use it for fund applications, doctoral research, formal review, high-risk domains, or when the user requests complete source traceability.

The profile changes evidence effort, not scientific logic or visual quality. Both profiles retain Mermaid confirmation, source locks, graph/design validation, same-source SVG/HTML/PNG export, accessibility checks, and visual QA. A fast project with a high-impact unresolved source, feasibility, ethics, or validation gap must be escalated to rigorous mode or remain provisional; never hide the gap to make the build pass.

## Required references

Before intake or drafting, read:

- [references/standards-basis.md](references/standards-basis.md)
- [references/route-taxonomy.md](references/route-taxonomy.md)
- [references/adaptive-intake.md](references/adaptive-intake.md)
- [references/mermaid-draft.md](references/mermaid-draft.md)
- [references/topic-research.md](references/topic-research.md)

Read the selected checks from [references/domain-profiles.md](references/domain-profiles.md). Before graph generation also read [references/graph-schema.md](references/graph-schema.md), [references/research-logic.md](references/research-logic.md), [references/visual-language.md](references/visual-language.md), and [references/technical-roadmap-standard.md](references/technical-roadmap-standard.md).

## Route-mode selection

Select one `route_mode`:

- `research-process` — default for “科研技术路线图/技术路线图”; show how questions are answered through work, methods/data, validation, milestones, and outcomes.
- `research-framework` — for parallel or relational theory/problem/method/indicator structures. Do not invent order among work packages.
- `technology-roadmap` — only when time horizons, maturity/capability gaps, alternatives, dependencies, risks, gates, or milestones are material.
- `study-flow` — for movement of participants, samples, records, or studies. Use an applicable domain template such as PRISMA or CONSORT when available.

When “技术路线图” is ambiguous, use `research-process` and record the assumption. Ask about mode only if the choice would materially change the research.

## Non-negotiable sequence

Fast profile:

`Topic + research content → completeness check → analogous-route presearch → adaptive intake → Mermaid draft/revisions → explicit draft confirmation → validate-draft → lock-draft → reuse verified basis → graph/design → validate-spec → lock-spec → editable SVG/static HTML → PNG → QA`

Rigorous profile:

`Topic + research content → completeness check → analogous-route presearch → adaptive intake → Mermaid draft/revisions → explicit draft confirmation → validate-draft → lock-draft → evidence deepening → graph/design → validate-spec → lock-spec → editable SVG/static HTML → PNG → QA`

For a new project, Mermaid is the only user-facing confirmation gate. Do not create `research_route_framework.md`.

Do not create `research_graph.json`, `design_spec.json`, SVG, HTML, or PNG while the Mermaid draft is unconfirmed. Legacy projects that already use `research_route_framework.md` and `framework_lock.json` remain supported; do not migrate them in place unless asked.

## 1. Interpret supplied context

Extract what the user already supplied from the research content, topic, messages, attachments, and reference diagrams. Store new-project state in intake schema 1.1, including `research_content.input_level`, source references, sections, and gaps. Store other relevant origins in `prefilled_from`. Never repeat a question whose answer is already known.

If `research_content.input_level` is `title-only`, stop before presearch and drafting. Ask the user to provide complete content or a structured outline using the compact template in [references/adaptive-intake.md](references/adaptive-intake.md). Do not invent the missing research design and do not count this blocking request toward the five adaptive questions.

Treat reference diagrams as first-party context for information architecture, grouping rhythm, and semantic strengths only. Do not copy wording, watermarks, proprietary assets, misleading symbols, unsupported claims, false sequence, or curved connectors.

## 2. Run light analogous-route presearch

After the content gate passes, follow Pass 1 in [references/topic-research.md](references/topic-research.md). Search the web in Chinese and English when useful and inspect two to three close routes. Extract:

- common stages or work packages;
- object/sample/data and method combinations;
- validation and stage outputs;
- complexity appropriate to the user's academic identity or use;
- method forks the user must decide.

Save this compact basis as `research_basis.json`. It exists to improve the intake, not to create a literature review. Do not send the user a long search summary.

Use the intake `generation_mode` to decide whether the confirmed project needs Pass 2. Pass 1 remains required for a verified route basis in both profiles.

Classify route evidence as:

1. `reported` — actually used by a cited study;
2. `synthesized` — combined from at least two materially different sources;
3. `optional` — a defensible route requiring a user choice or resource.

Do not promise access to data, samples, equipment, cohorts, instruments, or software the user has not stated they possess.

## 3. Ask at most two rounds

Follow [references/adaptive-intake.md](references/adaptive-intake.md). A detailed supplied source may resolve the route with zero questions. Otherwise combine the still-missing parts of these three areas into no more than three clearly numbered questions:

1. identity and use;
2. core problem, object, boundary, and expected outcome;
3. available resources, required/excluded methods, time, and constraints.

Stop the turn for the user's answers. Do not produce the Mermaid draft in the same response as unanswered first-round questions.

After the answers, update `intake_profile.json`. Ask a second round only when a remaining decision can materially change the supplied route. Ask no more than two questions, selected from method fork, validation criteria, innovation/theory depth, data/sample/ethics conditions, or a stage arrangement already proposed by the user.

Total questions actually asked must not exceed five. If the first answer resolves all high-impact choices, skip round 2 and create the draft.

Academic level controls complexity only:

- undergraduate: 3 stages, one feasible main method, basic comparison/validation;
- master: 3–4 stages, main method plus comparison/robustness, one explicit innovation;
- doctoral: 4–5 stages, theory/mechanism/method innovation, multiple studies only with resources;
- professor/team: 4–5 work packages with parallel work, dependencies, gates, risks, and team resources;
- other: determine 3–5 stages from use, resources, and outcome.

An explicit user design overrides these defaults. Document the exception instead of silently forcing a template.

## 4. Create the Mermaid confirmation draft

Write the current complete draft to `route_draft.mmd` and follow [references/mermaid-draft.md](references/mermaid-draft.md).

The draft must:

- use `config.flowchart.curve: stepAfter`;
- use only straight or right-angle step connectors;
- contain 3–5 stage/work-package cards by default;
- use six stages only with a documented density exception;
- contain no more than 10 visible nodes;
- use stable IDs such as `S1`, `S2`, `D1`, `O1`, and `P1`;
- for a new `research-process`, give every `S` card exactly four lines in this order: `思路 / 内容 / 方法 / 产出`;
- keep the research-thinking phrase after `思路：` to 2–6 CJK-equivalent characters and do not expose numbered stage labels;
- put concrete data, models, variables, indicators, and validation in `内容`; put only summarized method-category names in `方法`;
- keep each stage line near 14 CJK-equivalent characters;
- use solid main flow;
- use a labeled dashed edge only for optional/uncertain support or parallel relations;
- use a decision diamond only for a genuine branch;
- contain no click callback, remote resource, script, or alternate curve.

The user-facing draft response contains only:

1. the complete Mermaid diagram;
2. at most five short positioning, assumption, or pending-item statements;
3. one editing hint, for example “可以直接说：把 S3 的方法改为案例比较。”

Do not show the full evidence table, graph schema, or long Markdown by default.

### Blocking gate: draft confirmation

Stop after displaying the draft. Continue only after explicit wording such as “确认草图” or “按此生成”.

For every requested change:

- edit by conversation; do not provide a drag editor;
- preserve unaffected node IDs;
- increment `intake_profile.json.draft_revision`;
- rewrite and display the complete Mermaid diagram;
- provide at most three short change summaries;
- treat the previous confirmation and all previous locks as stale.

A general “可以” that does not clearly refer to the current draft is not enough to lock it.

## 5. Validate and lock the confirmed draft

Run:

```bash
node scripts/validate-draft.mjs <project>
node scripts/lock-draft.mjs <project> --confirmed
```

The validator checks question count, intake completeness, research status, academic stage range, high-impact pending choices, revision, Mermaid configuration, stable IDs, label density, node count, decision semantics, dashed-edge semantics, and remote/interactive content.

If web research is unavailable, a provisional draft may say `未核验` or `待定`, but validation and locking remain blocked. If the user skips a high-impact answer, preserve the pending marker and stop before final generation.

## 6. Apply the evidence profile without changing the route silently

For `rigorous` projects, follow Pass 2 in [references/topic-research.md](references/topic-research.md). Keep the locked `research_basis.json` unchanged and add deeper node-level sources to `research_graph.json`.

For `fast` projects, reuse the supplied research content and the locked Pass 1 basis. Build only the graph detail needed to preserve each confirmed work package, concrete method/data, indicator or validation, and stage output. Do not create an unnecessarily large evidence expansion just to fill internal JSON. If a high-impact gap remains, record it as unresolved and switch to `rigorous` before final generation.

If later evidence would alter a stage, method, primary edge, branch, or claimed output:

1. return to `route_draft.mmd`;
2. increment its revision;
3. show the full revised Mermaid draft;
4. obtain explicit confirmation again;
5. rerun draft validation and locking.

Never use final-graph work to make an unconfirmed research decision.

## 7. Build graph and design specifications

Write:

- `research_graph.json` — schema 1.2 scientific nodes, explicit children, semantic edges, groups/lanes, provenance, and omissions with reasons;
- `design_spec.json` — schema 1.4 semantic adaptive layout for new `research-process` projects; use legacy 1.2/1.3 contracts for compatible existing projects and other route presets;
- `design_spec.md` — optional short human-readable visual description when it helps internal review.

For a new `research-process` project:

- create exactly one primary content lane and one method lane; do not create a separate thinking lane or duplicate thinking nodes;
- use `groups[].short_label` for the 2–6-character left research-thinking rail and `groups[].label` for the content-cell title;
- place concrete models, datasets, variables, indicators, and validation inside the primary content lane;
- place only one to three childless summary method cards per group in the method lane;
- set `stage_rail.semantic_role: "thinking"` and `method_rail_content: "summary-only"`;
- use the exact visible headers `研究思路 / 研究内容与阶段输出 / 研究方法`.

Do not write node placements, group placements, lane coordinates, or column-header geometry. Set `layout_strategy: "adaptive"`, `page_mode: "content-fit"`, `orientation: "auto"`, and `child_layout_mode: "tree"`. The renderer derives the three regions, matching headers, independent cells, row heights, tree geometry, anchors, outcomes, and canvas height from one layout result.

For a Mermaid-confirmed project, graph metadata must include SHA-256 links to `route_draft.mmd`, `intake_profile.json`, and `research_basis.json` as specified in [references/graph-schema.md](references/graph-schema.md).

Apply the selected domain profile as an applicability checklist, not as permission to invent content. Record an omission as:

```json
{"category": "ethics_compliance", "reason": "公开聚合数据且不涉及个体"}
```

Verify every applicable category: objective, object/boundary, theory/context, data/evidence, work packages, methods, criteria, explanation/mechanism, validation, and outcome/impact.

## 8. Validate, render, export, and inspect

For a manual build, run in order:

1. `node scripts/validate-spec.mjs <project>`
2. `node scripts/lock-spec.mjs <project>`
3. `node scripts/render-html.mjs <project>`
4. `node scripts/export-image.mjs <project>`
5. `node scripts/visual-qa.mjs <project>`

For a single low-overhead build invocation after the draft and source locks already exist, use:

```bash
node scripts/build-route.mjs <project> --mode fast --delivery-dir <output-dir>
```

Use `--mode rigorous` when the project needs Pass 2 provenance. The build command still runs full visual QA in both modes; it only reduces orchestration round-trips. `--delivery-dir` copies only `route-map.html`, `route-map.svg`, and `route-map.png`. Internal JSON files remain in the project for reproducibility and are not copied to the delivery directory.

Write `route-map.svg` as an editable, self-contained SVG 1.1 artifact, and embed that exact SVG string in the static HTML. Preserve real `<text>/<tspan>` elements and stable semantic groups for layers, stages, nodes, and edges. Use basic Office-compatible SVG primitives only; do not use scripts, remote resources, `foreignObject`, filters, gradients, patterns, images, marker arrowheads, or embedded fonts.

The standalone SVG is the canonical rendering source. The HTML embeds it unchanged and the PNG derives from it:

- adaptive schema 1.3/1.4: the resolved SVG at exactly 2× width and height, with 300 dpi metadata;
- legacy explicit portrait 1.2: `2480 × 3508`;
- legacy explicit landscape 1.2: `3508 × 2480`.

Playwright may capture the standalone SVG element. If unavailable, rasterize `route-map.svg` directly at 300 dpi. Repair presentation only; never change confirmed scientific logic to pass layout QA.

## Connector and visual rules

- Use straight segments only. Never use SVG `C`, `Q`, `S`, `T`, or `A` commands for connectors.
- Same-row nodes use one horizontal segment; same-column nodes use one vertical segment; other connections use orthogonal polylines, normally at most three segments.
- Primary sequence, causal, decision, and feedback relations use solid lines.
- Dashed lines are allowed only for labeled optional/uncertain `support` or `parallel` relations.
- Do not route through nodes, stage headers, unrelated groups, or outcomes.
- Arrowheads stop at node borders.
- Parallel nodes use containment or a bus, not a false sequence.
- A node with two to four `children[]` uses a parent box, an orthogonal no-arrow bus, and separate child boxes by default. Main-flow edges attach to the parent box.
- New research-process headers are `研究思路 / 研究内容与阶段输出 / 研究方法`. The left rail is the research-thinking region, not an additional research-stage column.
- Every header maps to one independent per-stage cell or rail block with the same `x/width`.
- Draw the research-content title strip only at the top of the primary content/output cell.
- Stage polygons and all per-stage cells must reuse the same row `y/height`; row height comes from the tallest real cell requirement, not an A4 height allocation.
- New schema 1.4 research-process keeps the method rail visible and defaults to `aligned`; use `mapped` only when visible mapping improves comprehension. `hidden` remains a legacy/other-preset compatibility mode.
- Use no shadows, gradients, or decorative icons. Keep all final text at 7 pt or larger.
- Preserve uncertainty words such as “拟”, “探索”, “可能”, and “验证”.

## Working artifacts and delivery

| Artifact | Purpose |
|---|---|
| `intake_profile.json` | Supplied research content, identity/use, scope, resources, questions, pending items, revision |
| `research_basis.json` | Two to three analogous routes, transferable patterns, forks, limits |
| `route_draft.mmd` | Current complete Mermaid confirmation draft |
| `draft-validation-report.json` | Intake and draft gate checks |
| `draft_lock.json` | Explicitly confirmed draft-source hashes |
| `research_graph.json` | Canonical scientific and evidence model |
| `design_spec.json` / `design_spec.md` | Static visual contract |
| `validation-report.json` | Graph/design/source checks |
| `spec_lock.json` | Confirmed source, graph, design, and validation hashes |
| `route-map.svg` | Editable Office-compatible standalone SVG |
| `route-map.html` | Self-contained static HTML |
| `route-map.png` | 2× 300 dpi adaptive image, or legacy A4 image |
| `qa-report.json` | Internal structure, line routing, accessibility, and output QA; share only when requested |

Keep intermediate files in the working project. The default user delivery is only `route-map.svg`, `route-map.html`, and `route-map.png`. Keep `qa-report.json`, graph/design files, locks, layout data, and evidence files internal unless the user asks for a quality report or machine-readable specifications.

## Ownership boundaries

- `adaptive-intake.md` owns question limits, academic calibration, and stop rules.
- `mermaid-draft.md` owns draft grammar, revision, and confirmation response.
- `topic-research.md` owns presearch and evidence deepening.
- `route-taxonomy.md` owns route modes.
- `domain-profiles.md` owns domain applicability.
- `graph-schema.md` and `research-logic.md` own scientific structure and interfaces.
- `technical-roadmap-standard.md` and `visual-language.md` own static house style.
- `scripts/` owns validation, locks, static rendering, PNG export, and QA.
- `assets/templates/legacy-research-route-framework.md` is legacy-only.
