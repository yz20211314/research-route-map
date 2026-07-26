# Standards basis and applicability

This file separates external requirements and guidance from the skill's internal visual defaults. There is no single authoritative layout standard for all scientific research route maps.

## Rule hierarchy

| Level | Meaning | Examples | How the skill uses it |
|---|---|---|---|
| External requirement | A binding requirement for a specific funder, publisher, medium, or standard | current application instructions; WCAG contrast criteria | enforce only when the requested output is in scope |
| Domain guidance | A discipline- or study-type-specific reporting/design checklist | NIH rigor; CONSORT; PRISMA; ARRIVE; TRIPOD | use as an applicability and transparency checklist, not as evidence that the design is valid |
| Flow convention | A symbol or connection convention for a defined diagram family | ISO 5807 for information-processing flowcharts | apply only when that diagram family is requested; do not claim it governs all research diagrams |
| House default | This skill's chosen static visual grammar | adaptive visible regions, content-fit height, stage rail, aligned method cards, orthogonal connectors | use when it fits the confirmed research logic; override when the selected route mode requires another preset |

## External bases

### Chinese research proposals

- National Natural Science Foundation of China, 2026 application-form reform:
  https://www.nsfc.gov.cn/p1/3381/2821/99242.html
- Relevance: encourages concise expression according to the research's own logic and removes a fixed internal outline for major general/young-investigator applications.
- Consequence: portrait A4, three columns, a fixed number of stages, and a fixed outcome band are not funding requirements. They remain legacy-compatible presets, not defaults for new adaptive research-process figures.

### Technology roadmaps

- IEEE Roadmaps:
  https://roadmaps.ieee.org/about/
- NASA technology-roadmap example:
  https://ntrs.nasa.gov/api/citations/20250004024/downloads/ICES-2025-61.pdf
- Relevance: true technology roadmaps are forward-looking, use time horizons, capability gaps, performance targets, milestones, decision points, dependencies, risk, and periodic updates.
- Consequence: use `technology-roadmap` only when these elements are materially present.

### Scientific rigor and reporting

- NIH rigor and reproducibility:
  https://www.grants.nih.gov/policy-and-compliance/policy-topics/reproducibility
- EQUATOR reporting-guideline library:
  https://resources.equator-network.org/reporting-guidelines/
- PRISMA 2020 flow diagrams:
  https://www.prisma-statement.org/prisma-2020-flow-diagram
- Relevance: study designs need domain-specific controls, samples, bias safeguards, analysis, validation, and transparent reporting.
- Consequence: route construction loads a domain profile. Reporting guidance supports transparency but does not make design decisions for the researcher.

### Flow symbols

- ISO 5807:1985:
  https://www.iso.org/standard/11955.html
- Scope: symbols and conventions for data, program, system, program-network, and system-resource charts.
- Consequence: do not present ISO 5807 as a universal research-route-map standard. Use decision symbols only for true decisions and do not reuse a document symbol as a generic research-method card.

### Figure quality and accessibility

- NIH figure guidance:
  https://grants.nih.gov/grants-process/write-application/general-grant-writing-tips/tips-for-tables-charts-and-figures
- Nature figure preparation:
  https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/
- WCAG 2.2:
  https://www.w3.org/TR/wcag/
- Relevance: figures should be self-explanatory, readable, accessible without color alone, and suitable for grayscale/print; vector text and standard fonts are preferred.
- House thresholds: normal text contrast at least 4.5:1, essential graphical boundaries at least 3:1, final text no smaller than 7 pt.

## Rule provenance matrix

| Rule | Source class | Applicable route mode | Skill strength |
|---|---|---|---|
| Organize content by the confirmed research logic, not a fixed grant outline | current NSFC application guidance plus topic evidence | all | mandatory |
| Default ambiguous “科研技术路线图” to a problem→task→method/evidence→validation→output research process | house interpretation of common proposal use | `research-process` | default; user may select another mode |
| Use time horizons, capability gaps, measurable targets, dependencies, risks, milestones, and decision gates | IEEE/NASA roadmap practice | `technology-roadmap` | mandatory for this mode |
| Preserve identification/screening/allocation/inclusion counts and reasons required by the applicable guideline | PRISMA/CONSORT or selected domain guideline | `study-flow` | mandatory when the guideline is in scope |
| Load controls, samples, bias safeguards, analysis, validation, and transparency checks from the selected domain profile | NIH rigor and EQUATOR-family guidance | all, profile-dependent | applicability check; never substitutes for design evidence |
| Use true decision symbols only for actual decisions | ISO 5807 convention, narrowly applied | all | mandatory |
| Use adaptive content-fit research-process layout, editable standalone SVG, static HTML with the identical embedded SVG, 2× 300 dpi PNG, and straight/orthogonal connectors | house rendering contract | `research-process` | mandatory for new projects |
| Preserve fixed A4 geometry for legacy explicit 1.0–1.2 designs | compatibility contract | all | mandatory when reading existing projects |
| Use two to three analogous routes to ask no more than five non-repeating adaptive questions | user-selected conversational research contract | all | mandatory for new projects |
| Use a compact revisioned Mermaid diagram as the sole user confirmation gate | user-selected confirmation contract | all | mandatory for new projects; legacy Markdown remains readable |
| Generate one header and one independent per-stage cell per visible region, keep empty stage/lane cells, place stage titles only in the content cell, and switch from 1240 to 1754 px when necessary | house layout preset | `research-process` | mandatory for new projects |
| Keep normal text at 4.5:1, essential graphics at 3:1, final type at least 7 pt, and retain grayscale meaning | WCAG plus NIH/Nature figure guidance, with house print threshold | all | mandatory QA threshold |
| Produce no editor runtime and deliver editable SVG, static HTML, PNG, and QA report | user-selected external-editing workflow | all | mandatory |

## Internal decisions

- Default “科研技术路线图” to `research-process`.
- For a new research-process figure, derive headers from visible regions, create one matching independent cell per stage and region, derive stage height from actual cell requirements, and use content-fit height. Try 1240 px width before 1754 px.
- Preserve A4 portrait/landscape only for legacy explicit designs or an external delivery requirement.
- Write an editable standalone SVG, embed it unchanged in the static HTML, and derive the PNG from that standalone SVG.
- Use straight and orthogonal connectors only.
- Use dashed connectors only for optional or uncertain semantics and never as the sole semantic cue.
- Ask at most three first-round questions and at most two high-impact follow-ups.
- Use a stable-ID Mermaid draft with `stepAfter`, at most 10 visible nodes, and explicit confirmation before graph generation.
- Do not load or deliver an editor runtime; editing occurs in external SVG-capable software.
