# Research graph and static-design contract

`research_graph.json` is the single source of truth for scientific content. Use schema `1.2` for new projects. Schema `1.0` and `1.1` remain readable and are normalized in memory without rewriting source files.

## Graph 1.2

```json
{
  "schema_version": "1.2",
  "meta": {
    "title": "",
    "language": "zh-CN",
    "source_hash": "",
    "confirmed_draft_sha256": "",
    "intake_profile_sha256": "",
    "research_basis_sha256": "",
    "route_mode": "research-process",
    "route_archetype": "classification-diagnosis-path",
    "domain_profile": "social-policy",
    "not_applicable": [
      {"category": "ethics_compliance", "reason": "公开聚合数据且不涉及个体"}
    ]
  },
  "lanes": [
    {"id": "thinking", "label": "研究思路", "kind": "thinking"},
    {"id": "content", "label": "研究内容", "kind": "primary"},
    {"id": "methods", "label": "研究方法与数据", "kind": "method"}
  ],
  "groups": [{
    "id": "g1",
    "label": "问题界定与理论构建",
    "short_label": "问题界定",
    "order": 1,
    "stage": "problem",
    "color_role": "theory",
    "output_node": "framework"
  }],
  "nodes": [{
    "id": "background",
    "label": "研究背景与缺口",
    "children": [
      {"id": "background-policy", "label": "政策背景"},
      {"id": "background-gap", "label": "文献缺口"}
    ],
    "lane": "content",
    "group": "g1",
    "stage": "problem",
    "kind": "process",
    "role": "work_package",
    "emphasis": "normal",
    "status": "proposed",
    "source_refs": [{
      "source": "论文或网页标题",
      "source_type": "external",
      "locator": "Methods / Figure 1",
      "url": "https://...",
      "year": 2025,
      "access_level": "full_text",
      "evidence_class": "reported"
    }]
  }],
  "edges": [{
    "id": "e1",
    "from": "background",
    "to": "framework",
    "kind": "sequence",
    "label": "",
    "status": "confirmed"
  }]
}
```

## Required controlled values

- `meta.route_mode`: `research-process`, `research-framework`, `technology-roadmap`, or `study-flow`.
- `meta.domain_profile`: `general`, `experimental-biomedical`, `clinical-interventional`, `computational-data`, `engineering-design`, `social-policy`, or `evidence-synthesis`.
- `lanes[].kind`: `primary`, `thinking`, `method`, `data`, `discipline`, `outcome`, `time`, or `capability`.
- `groups[].stage`: `problem`, `theory`, `classification`, `diagnosis`, `mechanism`, `validation`, `translation`, `time_horizon`, `flow_phase`, or `other`.
- `groups[].color_role`: `theory`, `data`, `analysis`, `mechanism`, `validation`, `outcome`, `risk`, or `neutral`.
- `nodes[].kind`: `process`, `sample`, `method`, `data`, `metric`, `conclusion`, `decision`, `milestone`, `capability`, `risk`, or `note`.
- `nodes[].role`: `stage_question`, `input`, `work_package`, `method`, `indicator`, `validation`, `stage_output`, `theory`, `decision_gate`, `risk`, or `note`.
- `nodes[].emphasis`: `normal`, `accent`, `control`, or `uncertain`.
- `nodes[].status`: `proposed`, `reported`, `optional`, `pending`, or `completed`.
- `edges[].kind`: `sequence`, `causal`, `support`, `parallel`, `decision`, `feedback`, or `containment`.
- `edges[].status`: `confirmed`, `optional`, or `uncertain`.
- `source_refs[].source_type`: `external`, `user_file`, or `user_statement`.
- `source_refs[].access_level`: `full_text`, `abstract`, `metadata`, or `user_supplied`.
- `source_refs[].evidence_class`: `reported`, `synthesized`, or `optional`.

## Provenance

For a new Mermaid-confirmed project, `meta.confirmed_draft_sha256`, `meta.intake_profile_sha256`, and `meta.research_basis_sha256` must match the files locked in `draft_lock.json`. These fields are omitted for legacy Markdown-confirmed projects.

Every factual or proposed scientific node needs a non-empty `source_refs`.

Each reference needs:

- `source`, `source_type`, and `locator`;
- exactly one of `url` or `file` for external/user-file sources;
- `year` for every external source (use the publication/update year selected during research);
- `access_level`;
- `evidence_class`.

When any reference is `synthesized`, the node also needs a non-empty `synthesis_note` and at least two materially distinct references. User statements may support scope or resource availability but are not a substitute for external scientific evidence.

Use `emphasis: "uncertain"` or `status: "pending"` when evidence or feasibility is unresolved. Do not hide uncertainty in a confident label.

## Children

Use `children[]` for two to four short parallel subitems inside a parent. Each child needs a unique `id` and `label`. Child order is visual order only. Children are not edge endpoints; promote an item to a top-level node when it needs its own semantic relationship. Do not use punctuation parsing to manufacture children.

## Edges

- `sequence` means actual order.
- `causal` means a claimed or hypothesized influence.
- `support` maps method/data/theory/indicator/validation to a work package or milestone.
- `parallel` means sibling work without order and normally renders as a bus or containment.
- `decision` connects a decision gate to its branch.
- `feedback` returns a later result to an earlier activity.
- `containment` records membership and usually does not render as an arrow.

Only `status: "optional"` or `"uncertain"` may render dashed. A dashed edge must have a non-empty label or an endpoint whose node status is `optional`, `pending`, or emphasis is `uncertain`.
Primary sequence, causal, decision, and feedback edges remain solid and therefore use `status: "confirmed"`. Model optional or weak support as an explicitly labelled `support` or `parallel` relation instead of weakening the primary chain.

## Mode-specific graph requirements

### Research process

- 3–6 ordered groups;
- at least one primary lane;
- every group has work content and an `output_node`;
- actual step order is listed in `design_spec.stage_flow_nodes`; parallel nodes are excluded from that ordered list.

### Research framework

- normally 3–6 groups/layers;
- work-package and support mapping is required;
- a group output is optional when the framework is intentionally non-procedural.

### Technology roadmap

`meta.technology_roadmap` records:

```json
{
  "time_horizons": ["近期", "中期", "远期"],
  "baseline": "当前能力或成熟度",
  "target": "目标能力",
  "update_assumption": "何时复核路线"
}
```

Use `time`, `capability`, `decision_gate`, `risk`, and `metric` nodes as applicable. Time-horizon groups are not constrained to 3–6.

### Study flow

Use `flow_phase` groups and preserve counts/status/reasons in labels or children. A generic outcome band is not required.

## Adaptive static design 1.3

Use this contract for new `research-process` figures:

```json
{
  "schema_version": "1.3",
  "route_mode": "research-process",
  "layout_strategy": "adaptive",
  "page_mode": "content-fit",
  "orientation": "auto",
  "child_layout_mode": "tree",
  "child_layout_overrides": {},
  "region_labels": {
    "stage": "研究阶段",
    "thinking": "研究思路",
    "content": "研究内容与阶段输出",
    "methods": "方法数据与指标"
  },
  "target_png": {"scale": 2, "dpi": 300},
  "method_rail_mode": "aligned",
  "render_edges": true,
  "show_feedback": false,
  "typography_pt": {
    "title": 16,
    "stage": 10,
    "node": 8.5,
    "method": 7.5,
    "secondary": 7.5,
    "legend": 7
  },
  "line_semantics": {
    "orthogonal_only": true,
    "max_segments": 3,
    "optional_style": "dashed"
  },
  "stage_flow_nodes": {
    "g1": ["background", "boundary", "framework"]
  },
  "visible_edge_ids": ["e1"],
  "outcome_band": {
    "label": "预期成果与验收",
    "items": [
      {"label": "理论成果", "kind": "outcome", "linked_node_ids": ["framework"]},
      {"label": "验证成果", "kind": "outcome", "linked_node_ids": ["validation"]}
    ]
  }
}
```

The adaptive layout owns all geometry:

- Create one region and one exactly matching header for every visible lane, plus the stage region when enabled.
- Create `region_cells[group_id][region_id]` for every stage/header intersection. Each cell reuses the region/header `x/width`, and all cells in a stage reuse the stage row `y/height`.
- Preserve an empty cell when a globally visible lane has no node in one stage. Do not merge thinking, content, method/data, or custom cells.
- Place the stage-title strip only in the primary content/output cell.
- Omit a hidden/empty lane and its header together.
- Try a 1240 px source width first; switch to 1754 px when region minima, trees, or the primary flow cannot fit.
- Derive every stage row from the maximum real height required by its cells: title plus content occupancy for the primary cell, and padded node/tree occupancy for other cells.
- Use the same stage row `y/height` for the stage polygon and every region cell.
- Use a parent—orthogonal bus—child tree for every node with two to four children unless `child_layout_overrides[node_id]` is `"grid"`.
- Derive the final source height from title, headers, stage rows, outcome band, legend, and a 28 px bottom margin.
- Resolve PNG dimensions to exactly twice the final SVG dimensions and write 300 dpi metadata.

Do not include `canvas`, `column_headers`, lane coordinates, `placements`, `group_placements`, `visual_group_placements`, or `edge_paths` in a 1.3 adaptive input. These appear only in `render-layout.json` after resolution.

`render-layout.json` records `regions`, `headers`, `region_cells`, `group_rows`, `visual_groups`, `stage_boxes`, `node_anchors`, `node_layouts`, `child_layouts`, `tree_routes`, `content_bbox`, the resolved canvas, the resolved PNG target, `standalone_svg_file`, `standalone_svg_sha256`, `editable_svg`, and `semantic_layers`. In adaptive mode, `visual_groups[group_id]` points exactly to the primary content cell; `group_rows` records occupancy only and is not a visible merged container. Rendering, validation, SVG/HTML export, PNG export, and QA consume the same resolved geometry.

## Legacy explicit static design 1.2

```json
{
  "schema_version": "1.2",
  "route_mode": "research-process",
  "layout_mode": "portrait-research-process",
  "orientation": "portrait",
  "canvas": {"width": 1240, "height": 1754},
  "target_png": {"width": 2480, "height": 3508, "dpi": 300},
  "render_edges": true,
  "method_rail_mode": "aligned",
  "show_feedback": false,
  "typography_pt": {
    "title": 16,
    "stage": 10,
    "node": 8.5,
    "method": 7.5,
    "secondary": 7.5,
    "legend": 7
  },
  "line_semantics": {
    "orthogonal_only": true,
    "max_segments": 3,
    "optional_style": "dashed"
  },
  "column_headers": [
    {"lane": "thinking", "label": "研究思路"},
    {"lane": "content", "label": "研究内容"},
    {"lane": "methods", "label": "研究方法与数据"}
  ],
  "stage_flow_nodes": {
    "g1": ["background", "boundary", "framework"]
  },
  "visible_edge_ids": ["e1"],
  "group_placements": {
    "g1": {"x": 40, "y": 150, "width": 1160, "height": 250}
  },
  "visual_group_placements": {
    "g1": {"x": 190, "y": 150, "width": 770, "height": 250}
  },
  "placements": {
    "background": {"x": 205, "y": 215, "w": 180, "h": 70}
  },
  "outcome_band": {
    "label": "预期成果与验收",
    "x": 40,
    "y": 1510,
    "width": 1160,
    "height": 200,
    "items": [
      {"label": "理论成果", "kind": "outcome", "linked_node_ids": ["framework"]}
    ]
  }
}
```

## Design rules

- Adaptive 1.3 uses `adaptive-research-process`; explicit 1.2 supports `portrait-research-process`, `landscape-research-process`, `framework-matrix`, `technology-time-layer`, and `study-flow`.
- `method_rail_mode`: `aligned`, `mapped`, or `hidden`.
- Portrait source canvas is `1240 × 1754`; landscape is `1754 × 1240`. PNG is exactly 2×.
- The renderer converts `typography_pt` to source-canvas pixels using `150 / 72`.
- No final text may be below 7 pt.
- `aligned` shows method/data cards but hides support connectors.
- `mapped` shows only support connectors selected in `visible_edge_ids`.
- `hidden` hides method/data cards and their rendered connectors but preserves graph content.
- `outcome_band.items` has 2–5 items for `research-process`; no fixed four-item sequence is implied. Technology-roadmap uses target/KPI/gate items. Study-flow does not require a band.
- Custom `edge_paths` may use arrays of orthogonal points only:

```json
{
  "edge_paths": {
    "e1": [[385, 250], [430, 250], [430, 320], [470, 320]]
  }
}
```

Every adjacent point pair must share x or y. Maximum segment count defaults to three.

## Backward compatibility

- Graph schema 1.0/1.1 and design schema 1.0/1.1/1.2 remain readable.
- New research-process generation uses graph 1.2 plus adaptive design 1.3. Existing explicit 1.2 design files retain their fixed A4 geometry and are not migrated automatically.
- A new project uses `intake_profile.json`, `research_basis.json`, `route_draft.mmd`, and `draft_lock.json` as its confirmed source bundle.
- A legacy project may continue to use `research_route_framework.md` and `framework_lock.json`.
- Missing `meta.route_mode` normalizes to `research-process`.
- Existing `right_rail_mode: "header_only"` normalizes to `method_rail_mode: "hidden"`.
- Existing `hide_method_sublabels: true` plus hidden support edges normalizes to `method_rail_mode: "aligned"`.
- Legacy `causal` edges remain `causal`; legacy `interaction` normalizes to `parallel`.
- Legacy string entries in `meta.not_applicable` are accepted with a compatibility warning. New 1.2 projects require reason objects.
