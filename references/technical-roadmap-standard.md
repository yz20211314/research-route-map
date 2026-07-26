# Static research-route house style (internal)

This is an internal rendering contract, not a universal external standard. Read `standards-basis.md` before applying it.

## Research-process default

For new research-process figures, prefer an adaptive visible-region page:

- research thinking: a concise 2–6-character rail label from `groups[].short_label`;
- content: concrete research tasks, data, models, indicators, validation, and stage outputs;
- methods: one to three stage-aligned summary research-method cards;
- bottom: optional 2–5 item outcome/assessment band derived from confirmed milestones.

Generate the exact headers `研究思路 / 研究内容与阶段输出 / 研究方法` and reuse each region width. Do not render a separate “研究阶段” column or duplicate thinking nodes. Put the research-content title strip only at the top of the content/output cell. Try 1240 px width first and switch to 1754 px when trees or the primary flow cannot fit. Derive height from content; do not stretch rows to fill A4. Legacy 1.0–1.3 designs retain their prior contracts.

## Method rail

- `aligned` is the default: show summary method cards and suppress cross-column support connectors.
- `mapped`: show selected summary-method-to-task support connectors.
- `hidden`: legacy/other-preset compatibility only; schema 1.4 research-process keeps all three columns visible.

Keep all support relations in the graph.

Summary method cards use broad categories such as 文献分析法、理论分析法、调查研究法、案例分析法、计量分析法 or 比较分析法. Move FO法、specific datasets, machine-learning models, variables, indicators, thresholds, and robustness techniques into the content flow.

## Research-process stage grammar

For every retained stage:

1. state a concise stage objective;
2. show two to five visible content nodes;
3. distinguish ordered from parallel tasks;
4. designate a supported milestone/output;
5. align specific methods/data;
6. show validation or handoff.

Only actual ordered tasks belong in `stage_flow_nodes`. A parallel work package uses enclosure, siblings, or a bus and must not be inserted into a false arrow chain.

## Connector grammar

- Use straight or 90-degree orthogonal segments only.
- Same-row nodes: horizontal line.
- Same-column nodes: vertical line.
- Other nodes: orthogonal polyline, normally at most three segments.
- Never use connector curves or SVG `C`, `Q`, `S`, `T`, or `A` path commands.
- Sequence/causal/decision/feedback: solid.
- Support: solid gray when visible.
- Optional/uncertain support or parallel relation: dashed gray plus a label or explicit optional/pending endpoint.
- Containment: enclosure, not a directional arrow.
- Tree containment: no-arrow orthogonal trunk/bus/branches from a parent title box to two to four child boxes.
- Keep arrowheads outside node content and stop them at borders.
- Avoid unrelated nodes, headers, groups, and outcome bands. Change ports or bends instead of curving.

## Other modes

### Research framework

Use aligned modules, enclosure, and explicit relationships. Do not require a stage spine, output node per layer, or step arrow per box.

### Technology roadmap

Default to landscape. Use horizontal time horizons and vertical layers such as requirements/capabilities, technologies, validation/demonstration, and risks/resources. Show measurable targets, maturity progression, dependencies, and decision gates.

### Study flow

Use the domain-standard phases. Preserve counts/status and exclusion reasons. Do not add generic stage rails or outcome bands that are not part of the study flow.

## Typography at final output size

- title: 16 pt;
- column or time-layer header: 10 pt;
- stage header: 10 pt;
- primary node: 8.5 pt;
- method/data and secondary text: 7.5 pt;
- legend: 7 pt;
- absolute floor: 7 pt.

Use CJK-capable sans-serif fonts. Compress wording or change orientation before reducing size.

## Style

- white page background;
- no shadows, gradients, ornamental patterns, or decorative icons;
- color never carries meaning alone;
- normal text contrast at least 4.5:1;
- essential borders/connectors against adjacent colors at least 3:1;
- stage colors remain distinguishable in grayscale through labels and boundaries;
- uncertainty is expressed by wording and status, with dashed line/border only as a secondary cue.

## Outcomes

For research-process, render 2–5 outcome/assessment items derived from confirmed milestones. Items are not connected by arrows unless the confirmed graph says they are sequential.

For technology-roadmap, the bottom or final region may show target capability, KPI, and decision criteria.

For research-framework and study-flow, the outcome region is optional or not applicable.
