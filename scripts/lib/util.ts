import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Repository root, resolved from this file's location (scripts/lib/util.ts). */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  severity: Severity;
  /** repo-relative path, POSIX separators */
  file: string;
  line?: number;
  message: string;
}

export interface CheckResult {
  name: string;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  /** number of files inspected by this check */
  scanned: number;
}

/**
 * Directories the checks never walk into: tooling output, VCS metadata and
 * common vendored/installed trees (`node_modules`, virtualenvs, cargo target).
 * Adopting projects adjust this list rather than teaching each check about
 * their own layout.
 */
const IGNORED_DIRS: Record<string, true> = {
  node_modules: true,
  '.git': true,
  dist: true,
  build: true,
  out: true,
  coverage: true,
  '.cache': true,
  '.venv': true,
  venv: true,
  __pycache__: true,
  vendor: true,
  third_party: true,
  target: true,
};

/**
 * Repo-relative POSIX path used in every report. Three checks print paths, so
 * they must agree byte for byte (Windows separators would break message matching).
 */
export function relFromRoot(abs: string): string {
  const relative = path.relative(repoRoot, abs);
  return relative.split(path.sep).join('/');
}

export function readText(abs: string): string {
  return readFileSync(abs, 'utf8');
}

/** All Markdown files in the repository, sorted, excluding ignored directories. */
export function walkMarkdownFiles(root: string = repoRoot): string[] {
  const found: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS[entry.name]) continue;
        visit(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        found.push(path.join(dir, entry.name));
      }
    }
  };
  visit(root);
  return found.sort();
}

/**
 * Glob matcher for the tiny subset this tooling needs: `**`, `*`, `?`.
 * `**\/` matches zero or more leading directories, `**` matches anything.
 */
export function globToRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i] as string;
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

/**
 * True when every path segment of `abs` exists with exactly matching case.
 * Case matters: macOS and Windows compare case-insensitively, CI does not,
 * so a mis-cased link would otherwise pass locally and fail on the runner.
 */
export function existsWithExactCase(abs: string): boolean {
  const relative = path.relative(repoRoot, abs);
  if (relative === '') return true;
  if (relative.startsWith('..')) return existsSync(abs);
  let current = repoRoot;
  for (const segment of relative.split(path.sep)) {
    if (segment === '') continue;
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return false;
    }
    if (!entries.includes(segment)) return false;
    current = path.join(current, segment);
  }
  return true;
}

/**
 * Replaces fenced code blocks and inline code spans with spaces so that
 * example Markdown inside documentation is never treated as a real link.
 * Length and line numbers are preserved.
 */
export function stripCode(content: string): string {
  const lines = content.split('\n');
  let fenceChar: string | null = null;
  let fenceLength = 0;
  const blanked = lines.map((line) => {
    const fence = /^[ \t]*(`{3,}|~{3,})/.exec(line);
    if (fenceChar === null) {
      if (!fence) return line;
      fenceChar = (fence[1] as string)[0] as string;
      fenceLength = (fence[1] as string).length;
      return ' '.repeat(line.length);
    }
    const closesFence =
      fence !== null && (fence[1] as string)[0] === fenceChar && (fence[1] as string).length >= fenceLength;
    if (closesFence) {
      fenceChar = null;
      fenceLength = 0;
    }
    return ' '.repeat(line.length);
  });
  return blanked.join('\n').replace(/`[^`\n]*`/g, (match) => ' '.repeat(match.length));
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const where = diagnostic.line === undefined ? diagnostic.file : `${diagnostic.file}:${diagnostic.line}`;
  return `${diagnostic.severity}  ${where}  ${diagnostic.message}`;
}

export function printResult(result: CheckResult): void {
  for (const diagnostic of result.errors) console.log(formatDiagnostic(diagnostic));
  for (const diagnostic of result.warnings) console.log(formatDiagnostic(diagnostic));
  const status = result.errors.length === 0 ? 'PASS' : 'FAIL';
  console.log(
    `[${status}] ${result.name}: ${result.scanned} file(s) scanned, ` +
      `${result.errors.length} error(s), ${result.warnings.length} warning(s)`,
  );
}

export function summarize(results: readonly CheckResult[]): { errors: number; warnings: number; scanned: number } {
  return results.reduce(
    (acc, result) => ({
      errors: acc.errors + result.errors.length,
      warnings: acc.warnings + result.warnings.length,
      scanned: acc.scanned + result.scanned,
    }),
    { errors: 0, warnings: 0, scanned: 0 },
  );
}

/** True when this module is executed directly (`tsx scripts/<check>.ts`), not imported by docs-check.ts. */
export function isDirectRun(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(path.resolve(entry)).href === metaUrl;
}

export function runCli(check: () => CheckResult): void {
  const result = check();
  printResult(result);
  process.exitCode = result.errors.length === 0 ? 0 : 1;
}
