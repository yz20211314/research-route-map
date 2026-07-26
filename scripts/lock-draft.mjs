#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {readDraftSource} from './lib/draft-utils.mjs';
import {sha256, writeJsonFile} from './lib/route-utils.mjs';

const project = process.argv[2];
const confirmed = process.argv.includes('--confirmed');
if (!project) {
  console.error('Usage: node scripts/lock-draft.mjs <project> --confirmed');
  process.exit(2);
}
if (!confirmed) {
  console.error('Draft locking requires explicit user confirmation. Re-run with --confirmed only after “确认草图” or “按此生成”.');
  process.exit(2);
}

let source;
let validationRaw;
let validation;
try {
  source = readDraftSource(project);
  validationRaw = fs.readFileSync(path.join(project, 'draft-validation-report.json'), 'utf8');
  validation = JSON.parse(validationRaw);
} catch (error) {
  console.error(`Draft locking failed: ${error.message}`);
  process.exit(1);
}
if (!validation.ok || !validation.lockable) {
  console.error('Draft locking failed: draft validation has unresolved errors.');
  process.exit(1);
}
for (const [key, hash] of Object.entries(source.hashes)) {
  if (validation.input_hashes?.[key] !== hash) {
    console.error('Draft locking failed: validation is stale. Run validate-draft.mjs against the current files.');
    process.exit(1);
  }
}

const lock = {
  schema_version: '1.0',
  confirmed: true,
  confirmed_at: new Date().toISOString(),
  revision: source.intake.draft_revision,
  inputs: {
    intake_profile: {file: 'intake_profile.json', sha256: source.hashes.intake_profile},
    research_basis: {file: 'research_basis.json', sha256: source.hashes.research_basis},
    route_draft: {file: 'route_draft.mmd', sha256: source.hashes.route_draft},
    draft_validation_report: {file: 'draft-validation-report.json', sha256: sha256(validationRaw)}
  },
  contract: {
    user_confirmed_current_revision: true,
    downstream_route_must_match_draft: true,
    route_logic_changes_require_reconfirmation: true
  }
};
writeJsonFile(project, 'draft_lock.json', lock);
console.log(`Locked revision ${lock.revision}: ${path.join(project, 'draft_lock.json')}`);
