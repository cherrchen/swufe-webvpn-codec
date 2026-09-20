import path from 'node:path';
import {
  existsWithExactCase,
  isDirectRun,
  readText,
  relFromRoot,
  repoRoot,
  runCli,
  stripCode,
  walkMarkdownFiles,
  type CheckResult,
  type Diagnostic,
} from './lib/util.ts';

/**
 * Checks that every relative Markdown link and image target resolves to an
 * existing file or directory, with exact case (so macOS/Windows local runs
 * agree with case-sensitive CI).
 *
 * Not checked: external URLs, pure anchors (`#section`) and heading anchors —
 * this is deliberately a link *existence* check, not a Markdown compiler.
 */

const LINK_RE = /\[[^\]]*\]\(\s*(<[^<>\n]*>|[^()\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^()]*\)))?\s*\)/g;
const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function checkLinks(): CheckResult {
  const files = walkMarkdownFiles();
  const errors: Diagnostic[] = [];
  let links = 0;

  for (const abs of files) {
    const content = stripCode(readText(abs));
    const fileRel = relFromRoot(abs);

    for (const match of content.matchAll(LINK_RE)) {
      const raw = (match[1] ?? '').trim();
      if (raw === '') continue;
      const target = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1).trim() : raw;
      if (target === '' || target.startsWith('#') || EXTERNAL_RE.test(target)) continue;
      if (target.includes('{{')) continue;

      links += 1;
      const withoutAnchor = (target.split('?')[0] ?? target).split('#')[0] ?? target;
      if (withoutAnchor === '') continue;

      let decoded = withoutAnchor;
      try {
        decoded = decodeURIComponent(withoutAnchor);
      } catch {
        // keep the raw form when the target is not valid percent-encoding
      }

      const resolved = decoded.startsWith('/')
        ? path.join(repoRoot, decoded)
        : path.resolve(path.dirname(abs), decoded);

      if (!existsWithExactCase(resolved)) {
        const line = content.slice(0, match.index ?? 0).split('\n').length;
        errors.push({
          severity: 'error',
          file: fileRel,
          line,
          message: `broken link: "${target}" -> ${relFromRoot(resolved)} not found`,
        });
      }
    }
  }

  return { name: 'docs-links', errors, warnings: [], scanned: files.length };
}

if (isDirectRun(import.meta.url)) runCli(checkLinks);
