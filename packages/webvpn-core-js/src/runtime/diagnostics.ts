const FORBIDDEN = ["cookie", "authorization", "password", "body", "token", "set-cookie"] as const;

export interface SafeDiagnosticRecord {
  ts: string;
  host: string | null;
  direction: "request" | "response" | "system";
  action: "pass" | "rewrite" | "session-captured" | "session-expired" | "body-skipped" | "error" | "entered";
  code?: string;
  detail?: string;
}

export interface NotificationDTO {
  event: "login-required" | "session-expired" | "codec-failed" | "runtime-incompatible";
  title: string;
  body: string;
  openUrl?: string;
}

const REDACTED = "[redacted]";

export function safeDiagnostic(record: SafeDiagnosticRecord, debug: boolean): SafeDiagnosticRecord | null {
  if (!debug && record.direction !== "system") {
    return null;
  }
  const detail = record.detail ? redactText(record.detail) : undefined;
  return {
    ts: record.ts,
    host: record.host,
    direction: record.direction,
    action: record.action,
    ...(record.code ? { code: record.code } : {}),
    ...(detail ? { detail } : {}),
  };
}

export function redactText(value: string): string {
  let text = value.replace(/[0-9a-fA-F]{32,}/g, REDACTED);
  text = text.replace(/([?&][^=\s]+=)[^&\s]*/g, `$1${REDACTED}`);
  for (const word of FORBIDDEN) {
    const pattern = new RegExp(`(${word}\\s*[:=]\\s*)([^\\s,;]+)`, "gi");
    text = text.replace(pattern, `$1${REDACTED}`);
  }
  return text;
}

export function notificationFor(event: NotificationDTO["event"]): NotificationDTO {
  if (event === "login-required" || event === "session-expired") {
    return {
      event,
      title: "SWUFE WebVPN",
      body: "打开网页登录",
      openUrl: "https://webvpn.swufe.edu.cn",
    };
  }
  if (event === "codec-failed") {
    return { event, title: "SWUFE WebVPN", body: "WebVPN 地址转换失败，可能需要更新插件" };
  }
  return { event, title: "SWUFE WebVPN", body: "插件与当前宿主不兼容" };
}

export function diagnosticContainsSensitive(record: SafeDiagnosticRecord | null): boolean {
  if (!record) {
    return false;
  }
  const text = JSON.stringify(record);
  return /wengine_vpn|(?:password|authorization|cookie)\s*[:=]\s*(?!\[redacted\])\S+/i.test(text);
}
