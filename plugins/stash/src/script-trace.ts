import { safeDiagnostic, type SafeDiagnosticRecord } from "webvpn-core-js";

export function traceEntered(script: string, requestUrl: string | undefined): void {
  writeTrace({
    ts: new Date().toISOString(),
    host: hostnameOf(requestUrl),
    direction: "system",
    action: "entered",
    detail: requestUrl ? `${script} trace=1 ${requestUrl}` : `${script} trace=1`,
  });
}

export function traceThrew(script: string, requestUrl: string | undefined, error: unknown): void {
  const message = error instanceof Error ? error.message : "unknown";
  writeTrace({
    ts: new Date().toISOString(),
    host: hostnameOf(requestUrl),
    direction: "system",
    action: "error",
    code: "script-threw",
    detail: `${script} ${message}`,
  });
}

function writeTrace(record: SafeDiagnosticRecord): void {
  const safe = safeDiagnostic(record, false);
  if (safe) console.log(JSON.stringify(safe));
}

function hostnameOf(requestUrl: string | undefined): string | null {
  if (!requestUrl) return null;
  try {
    return new URL(requestUrl).hostname;
  } catch {
    return null;
  }
}
