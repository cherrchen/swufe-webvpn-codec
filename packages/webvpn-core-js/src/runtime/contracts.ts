import type { PluginErrorCode } from "../errors.ts";
import type { SafeDiagnosticRecord, NotificationDTO } from "./diagnostics.ts";

export interface HostEnvironment {
  host: "loon" | "stash";
  version: string;
  build?: number;
  platform: "ios" | "ipados" | "macos" | "other";
}

export interface HostRequestResult {
  decision: "pass" | "rewrite" | "reject";
  url?: string;
  headers?: Record<string, string>;
}

export interface HostResponseResult {
  status?: number;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
}

export interface HostAdapter {
  env(): HostEnvironment;
  read(key: string): string | null;
  write(key: string, value: string | null): boolean;
  notify(input: NotificationDTO): void;
  debug(record: SafeDiagnosticRecord): void;
  finishRequest(result: HostRequestResult): void;
  finishResponse(result: HostResponseResult): void;
}

export type { PluginErrorCode };
