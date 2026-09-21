import { checkI18n } from './docs-i18n-check.ts';
import { checkLinks } from './docs-links-check.ts';
import { checkSpecs } from './spec-check.ts';
import { summarize, type CheckResult } from './lib/util.ts';

/**
 * Documentation quality gate: runs every individual check and exits non-zero
 * on any error. Warnings are reported but do not fail the run.
 *
 * Individual checks remain runnable on their own:
 *   pnpm run docs:links | docs:i18n | spec:check
 */

const checks: ReadonlyArray<() => CheckResult> = [checkLinks, checkI18n, checkSpecs];
const results = checks.map((check) => check());

for (const result of results) {
  for (const diagnostic of result.errors) {
    console.log(`error    ${diagnostic.line === undefined ? diagnostic.file : `${diagnostic.file}:${diagnostic.line}`}  ${diagnostic.message}`);
  }
  for (const diagnostic of result.warnings) {
    console.log(`warning  ${diagnostic.line === undefined ? diagnostic.file : `${diagnostic.file}:${diagnostic.line}`}  ${diagnostic.message}`);
  }
  const status = result.errors.length === 0 ? 'PASS' : 'FAIL';
  console.log(
    `[${status}] ${result.name}: ${result.scanned} file(s) scanned, ` +
      `${result.errors.length} error(s), ${result.warnings.length} warning(s)`,
  );
}

const totals = summarize(results);
console.log(
  `\nSummary: ${totals.errors} error(s), ${totals.warnings} warning(s), ` +
    `${results.length} check(s), ${totals.scanned} file review(s)`,
);

process.exitCode = totals.errors === 0 ? 0 : 1;
