# Topic-first web research

Use this reference after the user supplies complete research content or a structured outline, or when the user asks to supplement that material with analogous studies. A title-only request must return to the content gate in `adaptive-intake.md`.

## Two-pass research and generation profiles

The skill supports two generation profiles. `fast` is the default for ordinary route-map generation and `rigorous` is opt-in for formal evidence-heavy work. The profile changes how much evidence work is performed after draft confirmation; it never changes the confirmed stages, methods, outputs, line routing, or QA rules.

Use research in two deliberately different passes.

### Pass 1: analogous-route presearch

After the research-content completeness check passes and before asking adaptive questions, inspect two to three close studies, established programs, or domain route templates when available. Extract only:

- common stage or work-package structure;
- object/sample/data and method pairings;
- validation and stage outputs;
- complexity differences relevant to the user's academic level or use;
- method forks the user must decide.

Save the result in `research_basis.json`. This pass exists to check the supplied structure and improve questions, not to author or replace the user's research content. Do not send a long literature summary.

### Pass 2: evidence deepening (`rigorous` by default)

After the user confirms the Mermaid draft, rigorous mode deepens evidence for node provenance, validation, domain rigor, and recent methods. Keep a confirmed `research_basis.json` unchanged. Put additional supporting references in `research_graph.json`.

In fast mode, reuse the supplied research content and the verified Pass 1 basis. Do not repeat the full query cluster or rebuild a large node-level evidence table when the confirmed draft already contains the required methods, data, indicators, validation, and outputs. Escalate to rigorous mode when a high-impact source, feasibility, ethics, or validation gap remains, or when the user asks for complete provenance.

If deeper research would change a stage, method, branch, or primary sequence, revise `route_draft.mmd`, increment its revision, and return to user confirmation. Never silently change confirmed research logic.

## Search design

Build query clusters rather than one broad query:

1. Topic and population/object: topic synonyms + organism/population/system.
2. Mechanism or relationship: target phenomenon + mechanism/pathway/factor/association.
3. Method: topic + experiment/assay/model/algorithm/dataset/validation.
4. Route precedent: topic + study design/workflow/technical route/methodology.
5. Translation: topic + intervention/application/clinical/implementation/outcome.

Search Chinese and English equivalents when both literatures are relevant. Start with the last five years, then add seminal older work and formal standards.

## Source target

For Pass 1, aim for two to three close route analogues. For Pass 2, aim for 6–12 useful sources in total, not a large undigested bibliography. When available, include:

- at least three closely analogous primary studies;
- one review or consensus source that maps the field;
- one authoritative database, guideline, registry, or standard for key methods or definitions;
- a recent method paper when the proposed route depends on a specialized technique.

If fewer than three close analogues exist, say so and widen the search one dimension at a time: neighboring population, adjacent mechanism, or equivalent method. Label the widened analogy.

## Extraction fields

For every analogous study record:

- full title, year, direct link, publication type, and evidence status;
- research question and object/sample/data;
- route sequence in verbs, not only a list of methods;
- core technique, controls/comparators, validation, indicators, and outcome;
- limitations, resource requirements, and what is transferable to the user's topic.

## Synthesis rules

- Preserve the difference between a published route and the proposed route.
- Cite each borrowed method or route pattern near the claim that uses it.
- Explain why a method transfers to the topic; similarity of keywords alone is insufficient.
- Mark optional high-cost or high-risk branches instead of silently making them mandatory.
- Avoid treating review recommendations as completed experimental evidence.
- For medical or clinical topics, distinguish exploratory, preclinical, observational, and interventional evidence.

## Failure handling

When a paper is inaccessible, use its abstract only for claims contained in the abstract and label the limitation. Do not cite a search-result snippet as evidence.

If the web is unavailable, the conversational intake may continue and a provisional Mermaid draft may be shown only when it visibly says `未核验` or `待定`. Set `research_basis.json.status` to `unavailable` and add a high-impact unresolved item. Draft locking and final generation remain blocked until route evidence is verified.
