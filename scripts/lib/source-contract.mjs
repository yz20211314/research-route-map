import fs from 'node:fs';
import path from 'node:path';
import {detectSourceMode, readDraftSource} from './draft-utils.mjs';
import {sha256} from './route-utils.mjs';

const readRaw = (project, file) => fs.readFileSync(path.join(project, file), 'utf8');

export function readSourceForValidation(project) {
  const mode = detectSourceMode(project);
  if (mode === 'mermaid-draft') {
    const source = readDraftSource(project);
    return {
      mode,
      inputHashes: source.hashes,
      files: {
        intake_profile: {file: 'intake_profile.json', raw: source.raw.intake_profile},
        research_basis: {file: 'research_basis.json', raw: source.raw.research_basis},
        route_draft: {file: 'route_draft.mmd', raw: source.raw.route_draft}
      }
    };
  }
  const frameworkRaw = readRaw(project, 'research_route_framework.md');
  return {
    mode,
    inputHashes: {framework: sha256(frameworkRaw)},
    files: {framework: {file: 'research_route_framework.md', raw: frameworkRaw}}
  };
}

const verifyLockEntry = (project, label, entry) => {
  if (!entry?.file || !entry?.sha256) throw new Error(`${label}: lock entry is incomplete`);
  const raw = readRaw(project, entry.file);
  if (sha256(raw) !== entry.sha256) throw new Error(`${label}: ${entry.file} changed after confirmation`);
  return {file: entry.file, raw, sha256: entry.sha256};
};

export function readConfirmedSource(project) {
  const source = readSourceForValidation(project);
  if (source.mode === 'mermaid-draft') {
    const lockRaw = readRaw(project, 'draft_lock.json');
    const lock = JSON.parse(lockRaw);
    if (!lock.confirmed || !lock.contract?.user_confirmed_current_revision) {
      throw new Error('draft_lock.json does not record explicit confirmation');
    }
    const expected = {
      intake_profile: source.inputHashes.intake_profile,
      research_basis: source.inputHashes.research_basis,
      route_draft: source.inputHashes.route_draft
    };
    for (const [key, hash] of Object.entries(expected)) {
      if (lock.inputs?.[key]?.sha256 !== hash) throw new Error(`draft_lock.json is stale for ${key}`);
      verifyLockEntry(project, `draft_lock.json ${key}`, lock.inputs[key]);
    }
    const reportEntry = verifyLockEntry(project, 'draft_lock.json draft_validation_report', lock.inputs?.draft_validation_report);
    const report = JSON.parse(reportEntry.raw);
    if (!report.ok || !report.lockable) throw new Error('draft validation report is not lockable');
    if (lock.revision !== JSON.parse(source.files.intake_profile.raw).draft_revision) {
      throw new Error('draft_lock.json revision is stale');
    }
    return {
      ...source,
      lock,
      lockFile: {file: 'draft_lock.json', raw: lockRaw, sha256: sha256(lockRaw)},
      confirmedInputs: {
        intake_profile: {file: 'intake_profile.json', raw: source.files.intake_profile.raw, sha256: source.inputHashes.intake_profile},
        research_basis: {file: 'research_basis.json', raw: source.files.research_basis.raw, sha256: source.inputHashes.research_basis},
        route_draft: {file: 'route_draft.mmd', raw: source.files.route_draft.raw, sha256: source.inputHashes.route_draft},
        draft_validation_report: reportEntry,
        draft_lock: {file: 'draft_lock.json', raw: lockRaw, sha256: sha256(lockRaw)}
      }
    };
  }

  const lockRaw = readRaw(project, 'framework_lock.json');
  const lock = JSON.parse(lockRaw);
  const frameworkHash = source.inputHashes.framework;
  if (!lock.confirmed || lock.framework?.sha256 !== frameworkHash) {
    throw new Error('framework confirmation is missing or stale');
  }
  return {
    ...source,
    lock,
    lockFile: {file: 'framework_lock.json', raw: lockRaw, sha256: sha256(lockRaw)},
    confirmedInputs: {
      framework: {file: 'research_route_framework.md', raw: source.files.framework.raw, sha256: frameworkHash},
      framework_lock: {file: 'framework_lock.json', raw: lockRaw, sha256: sha256(lockRaw)}
    }
  };
}
