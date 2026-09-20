import { readdirSync } from 'node:fs';
import path from 'node:path';
import {
  isDirectRun,
  readText,
  relFromRoot,
  repoRoot,
  runCli,
  type CheckResult,
  type Diagnostic,
} from './lib/util.ts';

/**
 * Checks the structure of every feature spec under `specs/`:
 *   - the five required files exist;
 *   - each file contains the required sections (Chinese or English headings);
 *   - verification.md contains a requirement -> verification mapping table.
 *
 * Deliberately lenient: this finds obvious documentation errors, it is not a
 * documentation compiler. `specs/_template/` and hidden directories are skipped.
 */

const SPECS_DIR = path.join(repoRoot, 'specs');

interface HeadingRule {
  /** canonical section name used in error messages */
  name: string;
  /** accepted heading spellings (lower-case, punctuation-normalised) */
  aliases: readonly string[];
  /** severity when missing */
  severity: 'error' | 'warning';
}

const REQUIRED_FILES = ['spec.md', 'design.md', 'plan.md', 'tasks.md', 'verification.md'] as const;

const SPEC_RULES: readonly HeadingRule[] = [
  { name: 'Status', aliases: ['status', '状态'], severity: 'error' },
  { name: 'Background', aliases: ['background', '背景'], severity: 'error' },
  { name: 'Problem', aliases: ['problem', '问题'], severity: 'error' },
  { name: 'Goals', aliases: ['goals', '目标'], severity: 'error' },
  { name: 'Non-goals', aliases: ['non-goals', 'non goals', '非目标'], severity: 'error' },
  { name: 'Functional Requirements', aliases: ['functional requirements', '功能需求'], severity: 'error' },
  { name: 'Acceptance Criteria', aliases: ['acceptance criteria', '验收标准'], severity: 'error' },
  { name: 'Open Questions', aliases: ['open questions', '开放问题', '待解决问题'], severity: 'warning' },
  { name: 'Edge Cases', aliases: ['edge cases', '边界'], severity: 'warning' },
];

const DESIGN_RULES: readonly HeadingRule[] = [
  { name: 'Context', aliases: ['context', '上下文'], severity: 'error' },
  { name: 'Proposed Solution', aliases: ['proposed solution', '方案', '技术方案', '解决方案'], severity: 'error' },
  { name: 'Architecture Impact', aliases: ['architecture impact', '架构影响'], severity: 'error' },
  { name: 'Alternatives Considered', aliases: ['alternatives considered', '备选方案', '替代方案'], severity: 'error' },
  { name: 'Risks', aliases: ['risks', '风险'], severity: 'error' },
  { name: 'Security Considerations', aliases: ['security considerations', '安全考虑', '安全'], severity: 'warning' },
];

const PLAN_RULES: readonly HeadingRule[] = [
  { name: 'Strategy', aliases: ['strategy', '策略'], severity: 'error' },
  { name: 'Phases', aliases: ['phases', '阶段'], severity: 'error' },
  { name: 'Rollback', aliases: ['rollback', '回滚'], severity: 'error' },
  { name: 'Documentation Updates', aliases: ['documentation updates', '文档更新'], severity: 'error' },
  { name: 'Verification Plan', aliases: ['verification plan', '验证计划'], severity: 'error' },
];

const RULES_BY_FILE: Readonly<Record<string, readonly HeadingRule[]>> = {
  'spec.md': SPEC_RULES,
  'design.md': DESIGN_RULES,
  'plan.md': PLAN_RULES,
};

const TASK_PHASE_RULE: HeadingRule = {
  name: 'Phase',
  aliases: ['phase', '阶段'],
  severity: 'error',
};

const TASK_LINE_RE = /^[ \t]*[-*][ \t]*\[[ xX]\][ \t]*T\d{2,}\b/m;
const STATUS_LINE_RE = /^\s*(?:>\s*)?Status\s*[:：]\s*(\S+)/im;
const VALID_STATUSES: Record<string, true> = {
  draft: true,
  approved: true,
  'in progress': true,
  'in-progress': true,
  implemented: true,
  verified: true,
  archived: true,
};
const SPEC_DIR_RE = /^\d{3}-[a-z0-9][a-z0-9-]*$/;
const VERIFICATION_STATUS_RE = /\b(Pending|Passed|Failed|N\/A)\b/;

/** `## Background` -> `background`; inline code, emphasis and trailing colons are removed. */
function headingKey(line: string): string | undefined {
  const match = /^#{2,6}\s+(.*?)\s*#*\s*$/.exec(line);
  if (!match) return undefined;
  return (match[1] ?? '')
    .replace(/`/g, '')
    .replace(/[*_]/g, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/[:：]\s*$/, '')
    .trim()
    .toLowerCase();
}

function matchesRule(keys: readonly string[], aliases: readonly string[]): boolean {
  return keys.some((key) =>
    aliases.some(
      (alias) =>
        key === alias ||
        key.startsWith(`${alias} `) ||
        key.startsWith(`${alias}:`) ||
        key.startsWith(`${alias}（`) ||
        key.startsWith(`${alias}(`) ||
        key.startsWith(`${alias}—`) ||
        key.startsWith(`${alias} -`),
    ),
  );
}

function tableHasRequirementStatusMapping(content: string): boolean {
  for (const line of content.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    const cells = line.split('|').map((cell) => cell.trim().toLowerCase());
    if (cells.length < 4) continue;
    const hasRequirement = cells.some((cell) => /requirement|需求|req/i.test(cell));
    const hasStatus = cells.some((cell) => /status|状态/i.test(cell));
    if (hasRequirement && hasStatus) return true;
  }
  return false;
}

function checkSpecDir(dirAbs: string): { errors: Diagnostic[]; warnings: Diagnostic[] } {
  const dirName = path.basename(dirAbs);
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const relDir = relFromRoot(dirAbs);
  const entries = readdirSync(dirAbs, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  if (!SPEC_DIR_RE.test(dirName)) {
    warnings.push({
      severity: 'warning',
      file: relDir,
      message: `spec directory name "${dirName}" does not match "<id>-<feature-name>" (e.g. 001-user-authentication)`,
    });
  }

  for (const required of REQUIRED_FILES) {
    if (!entries.includes(required)) {
      errors.push({
        severity: 'error',
        file: `${relDir}/${required}`,
        message:
          `missing required spec file "${required}"; copy specs/_template/ to create a complete spec ` +
          `(required: ${REQUIRED_FILES.join(', ')})`,
      });
    }
  }

  for (const [fileName, rules] of Object.entries(RULES_BY_FILE)) {
    if (!entries.includes(fileName)) continue;
    const content = readText(path.join(dirAbs, fileName));
    const keys = content
      .split('\n')
      .map((line) => headingKey(line))
      .filter((key): key is string => key !== undefined);
    for (const rule of rules) {
      if (matchesRule(keys, rule.aliases)) continue;
      const diagnostic: Diagnostic = {
        severity: rule.severity,
        file: `${relDir}/${fileName}`,
        message: `missing section "${rule.name}" (accepted headings: ${rule.aliases.join(' / ')})`,
      };
      if (rule.severity === 'error') errors.push(diagnostic);
      else warnings.push(diagnostic);
    }

    if (fileName === 'spec.md') {
      const statusMatch = STATUS_LINE_RE.exec(content);
      if (statusMatch === null) {
        warnings.push({
          severity: 'warning',
          file: `${relDir}/${fileName}`,
          message: 'no "Status:" line found; the feature lifecycle state must be explicit',
        });
      } else if (!VALID_STATUSES[(statusMatch[1] ?? '').trim().toLowerCase().replace(/\s+/g, ' ')]) {
        warnings.push({
          severity: 'warning',
          file: `${relDir}/${fileName}`,
          message: `unknown status "${statusMatch[1]}"; expected Draft | Approved | In Progress | Implemented | Verified | Archived`,
        });
      }
    }
  }

  if (entries.includes('tasks.md')) {
    const content = readText(path.join(dirAbs, 'tasks.md'));
    const taskFile = `${relDir}/tasks.md`;
    const keys = content
      .split('\n')
      .map((line) => headingKey(line))
      .filter((key): key is string => key !== undefined);
    if (!matchesRule(keys, TASK_PHASE_RULE.aliases)) {
      errors.push({
        severity: 'error',
        file: taskFile,
        message: 'missing a phase heading (e.g. "## Phase 1" / "## 阶段 1")',
      });
    }
    if (!TASK_LINE_RE.test(content)) {
      warnings.push({
        severity: 'warning',
        file: taskFile,
        message: 'no task line found; expected entries like "- [ ] T001 <action> — output: … — depends on: … — verify: …"',
      });
    }
  }

  if (entries.includes('verification.md')) {
    const content = readText(path.join(dirAbs, 'verification.md'));
    const verificationFile = `${relDir}/verification.md`;
    if (!tableHasRequirementStatusMapping(content)) {
      errors.push({
        severity: 'error',
        file: verificationFile,
        message: 'no requirement -> verification mapping table found (expected columns "Requirement" and "Status")',
      });
    }
    if (!VERIFICATION_STATUS_RE.test(content)) {
      errors.push({
        severity: 'error',
        file: verificationFile,
        message: 'no verification status found; expected at least one of Pending / Passed / Failed / N/A',
      });
    }
  }

  return { errors, warnings };
}

export function checkSpecs(): CheckResult {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  let scanned = 0;

  let dirs: string[] = [];
  try {
    dirs = readdirSync(SPECS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.'))
      .map((entry) => path.join(SPECS_DIR, entry.name));
  } catch {
    dirs = [];
  }

  for (const dirAbs of dirs) {
    scanned += 1;
    const result = checkSpecDir(dirAbs);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return { name: 'spec-check', errors, warnings, scanned };
}

if (isDirectRun(import.meta.url)) runCli(checkSpecs);
