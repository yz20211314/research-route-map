#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {readDraftSource, validateDraftInputs} from './lib/draft-utils.mjs';
import {writeJsonFile} from './lib/route-utils.mjs';

const project = process.argv[2];
if (!project) {
  console.error('Usage: node scripts/validate-draft.mjs <project>');
  process.exit(2);
}

let source;
try {
  source = readDraftSource(project);
} catch (error) {
  const report = {
    schema_version: '1.0',
    ok: false,
    lockable: false,
    validated_at: new Date().toISOString(),
    errors: [error.message],
    warnings: [],
    input_hashes: {}
  };
  fs.mkdirSync(project, {recursive: true});
  writeJsonFile(project, 'draft-validation-report.json', report);
  console.error(`Draft validation failed: ${error.message}`);
  process.exit(1);
}

const result = validateDraftInputs(source.intake, source.basis, source.raw.route_draft);
const report = {
  schema_version: '1.0',
  ok: result.errors.length === 0,
  lockable: result.errors.length === 0,
  validated_at: new Date().toISOString(),
  source_mode: 'mermaid-draft',
  input_hashes: source.hashes,
  stats: result.stats,
  errors: result.errors,
  warnings: result.warnings
};
writeJsonFile(project, 'draft-validation-report.json', report);

console.log(`Draft validation: ${report.ok ? 'PASS' : 'FAIL'}`);
console.log(`Questions: ${report.stats.question_count}; stages: ${report.stats.stage_count}; nodes: ${report.stats.node_count}; revision: ${report.stats.revision ?? 'missing'}`);
for (const warning of report.warnings) console.log(`WARN: ${warning}`);
for (const error of report.errors) console.error(`ERROR: ${error}`);
console.log(`Report: ${path.join(project, 'draft-validation-report.json')}`);
if (!report.ok) process.exit(1);
