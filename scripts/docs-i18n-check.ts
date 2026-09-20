import {
  globToRegExp,
  isDirectRun,
  readText,
  relFromRoot,
  runCli,
  walkMarkdownFiles,
  type CheckResult,
  type Diagnostic,
} from './lib/util.ts';

/**
 * Checks that long-lived documents exist in both languages:
 * `foo.md` (Chinese, source of truth) and `foo.en.md` (English counterpart).
 *
 * Only the configured bilingual scope is enforced; everything else in the
 * repository may be single-language. A file opts out with a marker comment:
 *   <!-- i18n-exempt: <reason> -->
 *
 * This does NOT compare translations. Semantic sync is a review duty
 * (see docs/development/documentation-rules.md).
 */

/** Top-level documents that must always be paired. */
const BILINGUAL_ROOT_FILES = ['README.md', 'AGENTS.md', 'CONTRIBUTING.md'];
/** Directory trees that must always be paired. */
const BILINGUAL_TREES: readonly string[] = ['docs/**'];
/** Individual files outside the trees above that must be paired. */
const BILINGUAL_FILES = ['specs/README.md', '.agents/README.md', '.agents/notes/README.md'];
/** Paths exempt from pairing, with the reason shown in reports. */
const EXCEPTIONS: ReadonlyArray<{ pattern: string; reason: string }> = [
  { pattern: '**/_template/**', reason: 'spec/template skeleton' },
  { pattern: '**/template.md', reason: 'template file' },
  { pattern: 'docs/archive/**', reason: 'archived history' },
];

/**
 * Exemption marker must be its own line within the document head, so that this
 * rule can be *documented* inside a rule file without exempting it.
 */
const EXEMPT_LINE_RE = /^[ \t]*<!--\s*i18n-exempt:\s*\S.*?-->\s*$/;
const EXEMPT_HEAD_LINES = 20;
const MATCHERS = {
  trees: BILINGUAL_TREES.map((tree) => globToRegExp(tree)),
  exceptions: EXCEPTIONS.map((entry) => ({ reason: entry.reason, matcher: globToRegExp(entry.pattern) })),
};

export function checkI18n(): CheckResult {
  const files = walkMarkdownFiles();
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const relSet = new Set(files.map((abs) => relFromRoot(abs)));
  let inScope = 0;

  for (const abs of files) {
    const rel = relFromRoot(abs);
    const isBilingual =
      BILINGUAL_ROOT_FILES.includes(rel) || BILINGUAL_FILES.includes(rel) || MATCHERS.trees.some((re) => re.test(rel));
    if (!isBilingual) continue;
    if (MATCHERS.exceptions.some((entry) => entry.matcher.test(rel))) continue;
    if (readText(abs).split('\n', EXEMPT_HEAD_LINES).some((line) => EXEMPT_LINE_RE.test(line))) continue;

    inScope += 1;
    const isEnglish = rel.endsWith('.en.md');

    if (isEnglish) {
      const base = rel.slice(0, -'.en.md'.length) + '.md';
      if (!relSet.has(base)) {
        errors.push({
          severity: 'error',
          file: rel,
          message: `missing Chinese source document "${base}"; the .md version is the source of truth (add it, or delete the .en.md)`,
        });
      }
      continue;
    }

    const english = rel.slice(0, -'.md'.length) + '.en.md';
    if (!relSet.has(english)) {
      errors.push({
        severity: 'error',
        file: rel,
        message:
          `missing English counterpart "${english}"; bilingual long-lived documents must be paired. ` +
          `Allowed alternatives: keep it under an exempt path (${EXCEPTIONS.map((e) => e.pattern).join(', ')}), ` +
          `or add "<!-- i18n-exempt: <reason> -->" when the document is intentionally single-language.`,
      });
    }
  }

  return { name: 'docs-i18n', errors, warnings, scanned: inScope };
}

if (isDirectRun(import.meta.url)) runCli(checkI18n);
