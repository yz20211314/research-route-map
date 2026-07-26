#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {readConfirmedSource} from './lib/source-contract.mjs';
import {sha256} from './lib/route-utils.mjs';

const project = process.argv[2];
if (!project) { console.error('Usage: node scripts/lock-spec.mjs <project>'); process.exit(2); }
const read = (name) => fs.readFileSync(path.join(project, name), 'utf8');
let source;
try {
  source = readConfirmedSource(project);
} catch (error) {
  console.error(`Confirmed-source check failed: ${error.message}`);
  process.exit(1);
}
const graph = read('research_graph.json');
const design = read('design_spec.json');
const validationRaw = read('validation-report.json');
const validation = JSON.parse(validationRaw);
if (!validation.ok) {
  console.error('Spec validation has errors. Fix them and run validate-spec.mjs again.');
  process.exit(1);
}
if (validation.source_mode !== source.mode) {
  console.error('Validation report source mode is stale or incompatible with the confirmed source.');
  process.exit(1);
}
const expectedValidationHashes = {
  ...source.inputHashes,
  research_graph: sha256(graph),
  design_spec: sha256(design)
};
if (Object.entries(expectedValidationHashes).some(([key, hash]) => validation.input_hashes?.[key] !== hash)) {
  console.error('Validation report is stale. Run validate-spec.mjs against the current confirmed source, graph, and design.');
  process.exit(1);
}
const sourceInputs = Object.fromEntries(Object.entries(source.confirmedInputs).map(([key, entry]) => [
  key,
  {file: entry.file, sha256: entry.sha256}
]));
const lock = {
  schema_version: '1.3',
  locked_at: new Date().toISOString(),
  inputs: {
    ...sourceInputs,
    research_graph: {file: 'research_graph.json', sha256: sha256(graph)},
    design_spec: {file: 'design_spec.json', sha256: sha256(design)},
    validation_report: {file: 'validation-report.json', sha256: sha256(validationRaw)}
  },
  contract: {
    source_mode: source.mode,
    content_locked: true,
    render_must_not_add_or_remove_nodes: true,
    static_only: true,
    orthogonal_connectors_only: true,
    output: ['route-map.html', 'route-map.png', 'qa-report.json']
  }
};
fs.writeFileSync(path.join(project, 'spec_lock.json'), JSON.stringify(lock, null, 2));
console.log(`Locked ${path.join(project, 'spec_lock.json')}`);
