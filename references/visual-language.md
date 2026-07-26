# Static visual language

## Layout presets

### `adaptive-research-process`

- Default for new research-process figures.
- Generate one header for each visible region: stage, thinking, primary content/output, method/data, or another visible custom lane.
- Header geometry is not independent; it exactly reuses its region's horizontal boundary.
- Every stage renders one independent cell for every visible header. Empty stage/lane intersections remain as empty cells so columns never collapse locally.
- The stage-title strip belongs only to the primary content/output cell. Thinking, method/data, and custom cells never repeat it.
- Try a 1240 px source width, then switch to 1754 px when minimum readable geometry does not fit.
- Use content-fit height rather than distributing unused A4 height across stage rows.
- The stage polygon and every per-stage region cell share the same row `y/height`.

### `portrait-research-process`

- A4 source canvas `1240 × 1754`.
- Narrow left stage rail, wide center content lane, right method/data rail.
- Prefer this preset when all labels remain at or above the typography floor and all stages fit without collisions.

### `landscape-research-process`

- A4 source canvas `1754 × 1240`.
- Use when content is horizontally wide, contains many parallel tasks, or portrait fails final-size typography/geometry QA.

### `framework-matrix`

- Use aligned or nested modules for questions, theory, evidence, methods, indicators, validation, and outputs.
- Arrows are optional and represent only explicit scientific relations.

### `technology-time-layer`

- Landscape by default.
- Horizontal time horizons; vertical requirement/capability, technology, validation/demonstration, and risk/resource layers.

### `study-flow`

- Orientation follows the applicable domain template.
- Preserve counts, status, and reasons.

## Geometry

- Adaptive source width is `1240` or `1754`; source height is derived from visible content.
- Adaptive PNG target is exactly 2× the resolved source canvas with 300 dpi metadata.
- Legacy explicit A4 source canvas remains `1240 × 1754` portrait or `1754 × 1240` landscape.
- Keep 28–40 source-pixel outer margins.
- Adaptive research-process uses 28 px page margins, 16 px region gaps, 18 px stage gaps, 14 px content-node gaps, 12 px method-stack gaps, and 12 px container vertical padding.
- The content-cell requirement is stage-title height plus its gap, content occupancy, and padding. Other cells use their own occupancy plus vertical padding. A stage row takes the maximum of those real cell requirements.
- Keep 16 px gutters between independent cells. Do not draw a merged container across thinking and content or across any other pair of non-stage regions.
- Use solid macro containers. Optional/pending containers may use a dashed border only with a textual status.
- Keep no more than two nested container levels.

## Connectors

- All connectors consist of horizontal/vertical straight segments.
- Use one segment for aligned nodes and an orthogonal polyline for other nodes.
- Maximum connector complexity is set by `line_semantics.max_segments` and may not exceed three segments. Change ports or layout when three segments cannot avoid an obstacle.
- Prefer designated ports: left/right for within-stage and method mapping, top/bottom for stage handoff.
- A connector must not pass through an unrelated node, header, group, or outcome region.
- No Bezier curves, splines, or arcs.

### Line semantics

| Relation | Visual |
|---|---|
| sequence | solid dark arrow |
| causal | solid dark arrow with optional label |
| decision | solid arrow from a decision node; branch label required |
| feedback | solid muted return arrow with “反馈/修正” label |
| support | thin solid gray line/arrow when method mode is `mapped` |
| parallel | bus or containment, no direction unless order is separately supported |
| optional/uncertain support or parallel status | dashed gray orthogonal line plus label/status |
| containment | enclosure, normally no connector |

## Nodes and grouping

- Stage/thinking labels are concise noun phrases, normally 4–8 CJK characters.
- Put full questions in the framework, accessible description, or a widened content node.
- Use `children[]` for two to four parallel subitems inside a parent; never infer children from punctuation.
- Default child layout is a tree: parent title box above, vertical trunk, horizontal bus, then two to four child boxes connected by vertical branches.
- Tree containment lines have no arrowhead and contain only `M/L` horizontal or vertical segments.
- Child boxes are 72–120 px wide, use at most two text lines, and have an 8 px gap.
- The parent does not draw an outer box around the whole tree cluster. Stage-output parents retain the red double-border emphasis.
- Main-flow edges connect to the parent title box; the full tree cluster remains an obstacle for unrelated edges.
- Use per-node `"grid"` only for an explicit exception; lack of space must not silently change a tree into a grid.
- Use a decision shape only for a real branch or gate.
- Do not use a document shape to mean “research method”.

## Typography

Specifications are final print points:

- title 16 pt;
- stage/column header 10 pt;
- primary node 8.5 pt;
- method/data 7.5 pt;
- secondary 7.5 pt;
- legend 7 pt;
- never below 7 pt.

The renderer converts points to source pixels at `150 / 72`. Use local CJK-capable sans-serif fonts such as `Noto Sans CJK SC`, `Source Han Sans SC`, `PingFang SC`, or `Microsoft YaHei`.

## Palette and accessibility

Default roles:

```text
ink       #1F2937
muted     #64748B
paper     #FFFFFF
neutral   #F3F4F6
theory    #E6EEF9
method    #E7F3F1
evidence  #FFF2D8
accent    #B93838
outcome   #EAF4E2
```

- Text contrast: at least 4.5:1 for normal text.
- Essential graphical boundary/connector contrast: at least 3:1.
- Do not use color as the only status or stage cue.
- Test grayscale; keep labels and boundaries sufficient without hue.
- Use black/dark text rather than colored text on light fills.

## Editable SVG, static HTML, and PNG

- Produce `route-map.svg` as the canonical rendering source and embed the exact same SVG string in HTML.
- Use SVG 1.1 basic primitives with stable semantic group IDs for layers, stages, nodes, and edges.
- Preserve text as `<text>/<tspan>` elements with local font fallbacks; do not outline text or embed fonts.
- Use explicit connector paths and polygon arrowheads instead of marker arrowheads.
- Do not use scripts, remote resources, `foreignObject`, filters, gradients, patterns, images, or CSS URL references.
- HTML contains one embedded SVG and no editor scripts or remote runtime.
- Add an SVG `<title>` and `<desc>`, an HTML summary, and a structured long description in graph reading order.
- The PNG is derived from the standalone SVG.
- No shadows, gradients, watermarks, or decorative density.

## QA rejection criteria

Reject if:

- connector geometry contains a curve/arc command;
- a dashed connector lacks optional/uncertain semantics plus label/status;
- a connector crosses an unrelated node/header/group/outcome;
- text is below 7 pt, clipped, or missing glyphs;
- nodes or macro groups overlap;
- color/graphical contrast fails;
- adaptive PNG dimensions are not exactly 2× the resolved SVG, or a legacy explicit image misses its A4 target;
- headers do not exactly match visible-region geometry;
- any stage has a different number of cells than headers, or a cell does not reuse its header `x/width`;
- a stage polygon or per-stage cell differs from its row `y/height`;
- a merged container spans two or more non-stage regions, or a stage title appears outside the primary content/output cell;
- an adaptive row has more than 12 px non-content vertical slack;
- a tree line is curved, uses an arrowhead, crosses text, or a child label is clipped;
- HTML lacks accessible title/description/reading order;
- HTML contains editor/runtime code;
- standalone SVG differs from the HTML-embedded SVG or the PNG source hash;
- editable text, semantic groups, or the required Office-compatible SVG declaration is missing;
- SVG contains scripts, external references, `foreignObject`, filters, gradients, patterns, images, marker arrowheads, or CSS URL references.
