"""mitmproxy addon: WRD request rewriting, reverse rewriting and debug logging.

Rewrite order on responses (REQ-007): ``Location`` → ``Set-Cookie`` Domain/Path →
HTML/JS/JSON absolute URLs; other content types pass through untouched.

Hosts that must never be rewritten (INV-004): the configured WebVPN host plus
``webvpn.swufe.edu.cn`` / ``authserver.swufe.edu.cn`` — a request that is
already in WebVPN form is left alone instead of being wrapped twice.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

from mitmproxy import ctx, http
from mitmproxy.net.http.cookies import format_cookie_header, parse_cookie_headers

from swufe_bridge.allowlist import match as allowlist_match, now_iso
from swufe_bridge.config import BridgeRuntimeConfig, ConfigWatcher
from swufe_bridge.rewrite import (
    is_rewritable_content_type,
    rewrite_body_text,
    rewrite_location,
    rewrite_set_cookie_attrs,
)
from swufe_bridge.wrd_codec import WrdCodec, WrdCodecError

METADATA_ORIGINAL_URL = "swufe_original_url"
METADATA_WRD_PREFIX = "swufe_wrd_prefix"

LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})

# Diagnostic detail markers; never carry payload data (INV-001).
DETAIL_NOT_ALLOWLISTED = "not-allowlisted"
DETAIL_ENCODE_FAILED = "encode-failed"
DETAIL_LOCATION = "location"
DETAIL_SET_COOKIE = "set-cookie"
DETAIL_BODY = "body"
DETAIL_BODY_SKIPPED = "body-skipped"
DETAIL_NO_WRD_MATCH = "no-wrd-match"


def wrd_prefix_of(wrd_url: str) -> str:
    """``https://webvpn.../https/<token>/a/b`` → ``/https/<token>``."""
    parts = urlsplit(wrd_url).path.lstrip("/").split("/", 2)
    return "/" + "/".join(parts[:2])


class DebugLogger:
    """Machine-readable stderr records for the Electron host (M2 parses these)."""

    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled

    def emit(self, record: dict[str, object]) -> None:
        if not self.enabled:
            return
        print("swufe-debug " + json.dumps(record, ensure_ascii=False), file=sys.stderr, flush=True)

    def _record(self, host: str, rewritten: bool, direction: str, detail: str | None) -> None:
        self.emit(
            {
                "ts": now_iso(),
                "host": host,
                "rewritten": rewritten,
                "direction": direction,
                "detail": detail,
            }
        )

    def request(self, host: str, rewritten: bool, detail: str | None) -> None:
        self._record(host, rewritten, "request", detail)

    def response(self, host: str, rewritten: bool, detail: str | None) -> None:
        self._record(host, rewritten, "response", detail)


def report_error(code: str, message: str) -> None:
    print(f"swufe-error {code} {message}", file=sys.stderr, flush=True)


class BridgeAddon:
    def __init__(self, config_path: str | os.PathLike[str] | None = None) -> None:
        self._config_path = Path(config_path) if config_path else None
        self._watcher = ConfigWatcher(self._config_path) if self._config_path else None
        self._reported_error: str | None = None

    # --- mitmproxy lifecycle -------------------------------------------------

    def load(self, loader) -> None:
        loader.add_option(
            "swufe_config", str, "", "Path to the bridge runtime config JSON file"
        )

    def configure(self, updated) -> None:
        if "swufe_config" in updated:
            option = getattr(ctx.options, "swufe_config", "") or ""
            self._set_config_path(self._config_path or option)

    def running(self) -> None:
        listen_host = str(getattr(ctx.options, "listen_host", "") or "")
        if listen_host not in LOOPBACK_HOSTS:
            report_error(
                "LISTEN_NOT_LOOPBACK",
                f"listen_host={listen_host!r} is not a loopback address; refusing to serve",
            )
            ctx.master.shutdown()
            return
        cfg = self._config()
        summary = {
            "listen_host": listen_host,
            "listen_port": ctx.options.listen_port,
            "config": str(self._watcher.path) if self._watcher else "",
            "allowlist": list(cfg.allowlist.hosts) if cfg else [],
            "includeSwufeWildcard": cfg.allowlist.include_swufe_wildcard if cfg else False,
            "cookies": len(cfg.cookies) if cfg else 0,
            "debug": cfg.debug if cfg else False,
        }
        print("swufe-ready " + json.dumps(summary, ensure_ascii=False), file=sys.stderr, flush=True)

    # --- hooks ---------------------------------------------------------------

    def request(self, flow: http.HTTPFlow) -> None:
        cfg = self._config()
        if cfg is None:
            return
        logger = DebugLogger(cfg.debug)
        codec = WrdCodec(cfg.wrd_key, cfg.wrd_iv, cfg.webvpn_host)
        host = flow.request.pretty_host.lower()

        if not allowlist_match(host, cfg.allowlist, excluded=(cfg.webvpn_host,)):
            logger.request(host, False, DETAIL_NOT_ALLOWLISTED)
            return

        original_url = flow.request.url
        try:
            wrd_url = codec.encode_url(original_url, webvpn_base=cfg.webvpn_base)
        except WrdCodecError:
            # Leave the flow untouched: an unrewritable request goes out as-is.
            logger.request(host, False, DETAIL_ENCODE_FAILED)
            return

        flow.metadata[METADATA_ORIGINAL_URL] = original_url
        flow.metadata[METADATA_WRD_PREFIX] = wrd_prefix_of(wrd_url)
        flow.request.url = wrd_url
        self._inject_cookies(flow.request, cfg)
        self._rewrite_request_headers(flow.request, cfg, codec, host)
        logger.request(host, True, None)

    def response(self, flow: http.HTTPFlow) -> None:
        cfg = self._config()
        if cfg is None or flow.response is None:
            return
        original_url = flow.metadata.get(METADATA_ORIGINAL_URL)
        wrd_prefix = flow.metadata.get(METADATA_WRD_PREFIX)
        if not original_url or not wrd_prefix:
            # Client-initiated WebVPN traffic: nothing was rewritten on the way out.
            return

        logger = DebugLogger(cfg.debug)
        codec = WrdCodec(cfg.wrd_key, cfg.wrd_iv, cfg.webvpn_host)
        original_host = (urlsplit(original_url).hostname or "").lower()

        # Priority order is the contract: Location → Set-Cookie → body (REQ-007).
        details: list[str] = []
        if self._rewrite_location_header(flow.response, codec, cfg):
            details.append(DETAIL_LOCATION)
        if self._rewrite_set_cookie_headers(flow.response, original_host, cfg, wrd_prefix):
            details.append(DETAIL_SET_COOKIE)
        body_detail = self._rewrite_body(flow.response, codec, cfg)
        if body_detail == DETAIL_BODY:
            details.append(DETAIL_BODY)

        if details:
            logger.response(original_host, True, ", ".join(details))
        else:
            logger.response(
                original_host, False, body_detail or DETAIL_NO_WRD_MATCH
            )

    # --- internals -----------------------------------------------------------

    def _rewrite_location_header(
        self, response: http.Response, codec: WrdCodec, cfg: BridgeRuntimeConfig
    ) -> bool:
        location = response.headers.get("location")
        if not location:
            return False
        rewritten, changed = rewrite_location(location, codec, cfg.webvpn_host)
        if changed:
            response.headers["location"] = rewritten
        return changed

    def _rewrite_set_cookie_headers(
        self,
        response: http.Response,
        original_host: str,
        cfg: BridgeRuntimeConfig,
        wrd_prefix: str,
    ) -> bool:
        try:
            items = list(response.cookies.items(multi=True))
        except ValueError:
            return False  # malformed Set-Cookie: pass through untouched
        changed = False
        rebuilt = []
        for name, (value, attrs) in items:
            if rewrite_set_cookie_attrs(
                attrs,
                original_host=original_host,
                webvpn_host=cfg.webvpn_host,
                wrd_prefix=wrd_prefix,
            ):
                changed = True
            rebuilt.append((name, (value, attrs)))
        if changed:
            response.cookies = rebuilt
        return changed

    def _rewrite_body(
        self, response: http.Response, codec: WrdCodec, cfg: BridgeRuntimeConfig
    ) -> str | None:
        if not is_rewritable_content_type(response.headers.get("content-type")):
            return None
        if response.raw_content is None:
            return None
        try:
            text = response.get_text(strict=True)
        except ValueError:
            return DETAIL_BODY_SKIPPED
        rewritten, count = rewrite_body_text(text, codec, cfg.webvpn_host)
        if count == 0:
            return None
        response.text = rewritten
        return DETAIL_BODY

    def _set_config_path(self, path: str | os.PathLike[str] | None) -> None:
        self._watcher = ConfigWatcher(path) if path else None
        self._reported_error = None

    def _config(self) -> BridgeRuntimeConfig | None:
        if self._watcher is None:
            self._report_config_error("no runtime config path configured (swufe_config)")
            return None
        cfg = self._watcher.get()
        if self._watcher.error is not None:
            # A failed reload keeps serving the last good config but must be visible.
            self._report_config_error(self._watcher.error)
        else:
            self._reported_error = None
        return cfg

    def _report_config_error(self, message: str) -> None:
        if message == self._reported_error:
            return  # same failure: report once (S8)
        self._reported_error = message
        report_error("CONFIG_INVALID", message)

    def _inject_cookies(self, request: http.Request, cfg: BridgeRuntimeConfig) -> None:
        webvpn_host = cfg.webvpn_host
        injected = [
            cookie
            for cookie in cfg.cookies
            if cookie.domain is None
            or _reaches_host(cookie.domain.lstrip(".").lower(), webvpn_host)
        ]
        if not injected:
            return
        client_pairs: list[tuple[str, str | None]] = []
        for header in request.headers.get_all("cookie"):
            client_pairs.extend(parse_cookie_headers([header]))
        injected_names = {cookie.name for cookie in injected}
        kept = [(name, value) for name, value in client_pairs if name not in injected_names]
        request.headers["cookie"] = format_cookie_header(
            kept + [(cookie.name, cookie.value) for cookie in injected]
        )

    def _rewrite_request_headers(
        self, request: http.Request, cfg: BridgeRuntimeConfig, codec: WrdCodec, original_host: str
    ) -> None:
        origin = request.headers.get("origin")
        if origin:
            origin_host = (urlsplit(origin).hostname or "").lower()
            if origin_host == original_host or allowlist_match(
                origin_host, cfg.allowlist, excluded=(cfg.webvpn_host,)
            ):
                base = urlsplit(cfg.webvpn_base)
                request.headers["origin"] = f"{base.scheme}://{base.netloc}"

        referer = request.headers.get("referer")
        if referer:
            referer_host = (urlsplit(referer).hostname or "").lower()
            if allowlist_match(referer_host, cfg.allowlist, excluded=(cfg.webvpn_host,)):
                try:
                    request.headers["referer"] = codec.encode_url(
                        referer, webvpn_base=cfg.webvpn_base
                    )
                except WrdCodecError:
                    pass  # keep the original referer rather than break the request


def _reaches_host(cookie_domain: str, host: str) -> bool:
    """Whether a cookie scoped to ``cookie_domain`` is sent to ``host``.

    ``.swufe.edu.cn`` reaches ``webvpn.swufe.edu.cn`` (parent domain), while
    ``jwxt.swufe.edu.cn`` does not.
    """
    return cookie_domain == host or host.endswith("." + cookie_domain)


addons = [BridgeAddon()]
