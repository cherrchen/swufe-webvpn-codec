/** Codec failures. Messages must not include key, cookie, or token values. */
export type CodecErrorCode =
  | "INVALID_KEY"
  | "INVALID_IV"
  | "INVALID_URL"
  | "UNSUPPORTED_SCHEME"
  | "INVALID_TOKEN"
  | "DECRYPT_FAILED";

/** Plugin failures. User-facing copy is mapped by the host adapter. */
export type PluginErrorCode =
  | "MITM_NOT_READY"
  | "NOT_LOGGED_IN"
  | "SESSION_EXPIRED"
  | "CODEC_FAILED"
  | "INVALID_SETTINGS"
  | "RUNTIME_INCOMPATIBLE"
  | "BODY_TOO_LARGE"
  | "REWRITE_FAILED"
  | "STORAGE_FAILED";

export class CodecError extends Error {
  readonly code: CodecErrorCode;

  constructor(code: CodecErrorCode) {
    super(code);
    this.name = "CodecError";
    this.code = code;
  }
}

export class PluginError extends Error {
  readonly code: PluginErrorCode;

  constructor(code: PluginErrorCode) {
    super(code);
    this.name = "PluginError";
    this.code = code;
  }
}
