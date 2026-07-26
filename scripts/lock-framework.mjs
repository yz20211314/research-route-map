#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const project = process.argv[2];
const confirmed = process.argv.includes('--confirmed');
if (!project || !confirmed) {
  console.error('Usage: node scripts/lock-framework.mjs <project> --confirmed');
  console.error('Run only after the user explicitly confirms the current Markdown framework.');
  process.exit(2);
}

const frameworkPath = path.join(project, 'research_route_framework.md');
if (!fs.existsSync(frameworkPath)) {
  console.error(`Missing ${frameworkPath}`);
  process.exit(1);
}
const framework = fs.readFileSync(frameworkPath, 'utf8');
if (framework.trim().length < 500) {
  console.error('Framework is too short to represent a reviewed technical route.');
  process.exit(1);
}
if (/\{\{[^}]+\}\}/.test(framework)) {
  console.error('Framework still contains unfilled template placeholders.');
  process.exit(1);
}

const sha256 = crypto.createHash('sha256').update(framework).digest('hex');
const lock = {
  schema_version: '1.2',
  confirmed: true,
  confirmed_at: new Date().toISOString(),
  framework: {file: 'research_route_framework.md', sha256},
  contract: {
    current_markdown_revision_confirmed: true,
    downstream_content_must_derive_from_framework: true,
    invalidate_on_framework_change: true,
    confirmation_gate_precedes_graph_and_design: true,
    static_delivery_only: true
  }
};
fs.writeFileSync(path.join(project, 'framework_lock.json'), JSON.stringify(lock, null, 2));
console.log(`Locked confirmed framework: ${path.join(project, 'framework_lock.json')}`);
