export { CodecError, PluginError } from "./errors.ts";
export type { CodecErrorCode, PluginErrorCode } from "./errors.ts";
export { WrdCodec, DEFAULT_IV, DEFAULT_KEY, DEFAULT_WEBVPN_HOST, gatewayHost } from "./codec/wrd-codec.ts";
export type { WrdCodecOptions } from "./codec/wrd-codec.ts";
export {
  decideRoute,
  defaultRoutingPolicy,
  normalizeHost,
  tryNormalizeHost,
  AUTH_HOST,
  DEFAULT_HOSTS,
  EXCLUDED_HOSTS,
  GATEWAY_HOST,
} from "./routing/allowlist.ts";
export type { RouteDecision, RoutingPolicy } from "./routing/allowlist.ts";
export { classifyGatewayRequest, gatewayRequestAllowsInjection } from "./routing/gateway-request.ts";
export type { GatewayRequestKind } from "./routing/gateway-request.ts";
export {
  STORAGE_KEYS,
  TICKET_COOKIE_NAME,
  applyNewerCookie,
  applyTicketSetCookie,
  captureSession,
  cookiePairValue,
  createSessionStore,
  headerValue,
  memoryKv,
  parseSession,
  promoteSession,
  sessionExpiredByClock,
  sessionMatchesGateway,
  ticketLifetimeFromSetCookie,
} from "./session/session.ts";
export type {
  KeyValueStore,
  SessionCaptureInput,
  SessionCaptureResult,
  SessionParseResult,
  SessionRecordV1,
  SessionStore,
  TicketLifetime,
  TicketSetCookieResult,
} from "./session/session.ts";
export {
  DEFAULT_BODY_REWRITE_MAX_BYTES,
  GATEWAY_ROOT_PREFIXES,
  mergeCookies,
  rewriteRequest,
  wrdPrefixOf,
} from "./rewrite/request.ts";
export type { RequestDTO, RequestDecision, RequestRewriteContext, RewriteSettings } from "./rewrite/request.ts";
export {
  decodeWrdReference,
  isGatewayBootstrapHtml,
  isRewritableContentType,
  rewriteBodyText,
  rewriteLocation,
  rewriteSetCookieAttrs,
  stripWrdPrefix,
  GATEWAY_BOOTSTRAP_MAX_BYTES,
  REWRITABLE_CONTENT_TYPES,
} from "./rewrite/body.ts";
export { rewriteResponse } from "./rewrite/response.ts";
export type { ResponseDTO, ResponseRewriteResult } from "./rewrite/response.ts";
export { diagnosticContainsSensitive, notificationFor, redactText, safeDiagnostic } from "./runtime/diagnostics.ts";
export type { NotificationDTO, SafeDiagnosticRecord } from "./runtime/diagnostics.ts";
export { defaultSettings, parseSettings, stashTile, toRewriteSettings } from "./runtime/settings.ts";
export type { PluginSettingsV1, RuntimeCompatibility, StashTileViewModel } from "./runtime/settings.ts";
export {
  BUILTIN_SITES,
  MIGRATION_WARNING,
  SETTINGS_BODY_MAX_BYTES,
  SETTINGS_ORIGIN,
  SETTINGS_PAGE_URL,
  SETTINGS_PREFIX,
  classifySettingsRoute,
  compileRoutingPolicy,
  defaultSettingsV2,
  handleSettingsRequest,
  isSettingsNamespaceUrl,
  loadSettingsV2,
  migrateV1ToV2,
  pageFromSettings,
  settingsErrorResponse,
  toPublicSettings,
  toRewriteSettingsFromV2,
  validateSettingsHostname,
  validateSettingsUpdate,
} from "./runtime/settings-v2.ts";
export type {
  BuiltinSite,
  LoadedSettings,
  SessionStatusProvider,
  SettingsHttpResponse,
  SettingsPageDTO,
  SettingsPublicDTO,
  SettingsRequestDTO,
  SettingsRouteDecision,
  SettingsV2,
  SettingsValidationCode,
  SettingsValidationResult,
} from "./runtime/settings-v2.ts";
export type { HostAdapter, HostEnvironment, HostRequestResult, HostResponseResult } from "./runtime/contracts.ts";
