#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {analyzeResearchLogic} from './lib/logic-qa.mjs';

const project = process.argv[2];
const strict = process.argv.includes('--strict');
if (!project) {
  console.error('Usage: node scripts/validate-logic.mjs <project> [--strict]');
  process.exit(2);
}

const readJson = (name, fallback = {}) => {
  const file = path.join(project, name);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const graph = readJson('research_graph.json', null);
if (!graph) {
  console.error('research_graph.json is required');
  process.exit(1);
}
const intake = readJson('intake_profile.json', {});
const report = analyzeResearchLogic(graph, intake, {strict});
fs.writeFileSync(path.join(project, 'logic-validation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
if (report.errors.length || report.strict_errors.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
