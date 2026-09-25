/** Fixed ports, paths, timeouts and channel names shared by the Main process. */

import type { CaptureMode } from '../shared/types'

export const DEFAULT_BRIDGE_PORT = 8080
export const DEFAULT_WEBVPN_BASE = 'https://webvpn.swufe.edu.cn'
export const DEFAULT_WRD_KEY = 'wrdvpnisthebest!'
export const DEFAULT_WRD_IV = 'wrdvpnisthebest!'
export const DEFAULT_HOSTS: readonly string[] = ['jwxt.swufe.edu.cn']

/** Login WebView partition (persist: survives restarts, see data-model.md SessionState). */
export const LOGIN_PARTITION = 'persist:swufe-login'

/** Capture is opt-in: the system proxy is the default (REQ-003, ADR-0006). */
export const DEFAULT_CAPTURE_MODE: CaptureMode = 'system-proxy'

/** Never rewritten by the bridge: the login flow itself (INV-004). */
export const AUTH_HOST = 'authserver.swufe.edu.cn'

export const BRIDGE_READY_TIMEOUT_MS = 30_000
export const SIDECAR_STOP_TIMEOUT_MS = 5_000
export const COMMAND_TIMEOUT_MS = 10_000
/** OS confirmation dialogs outlive the default command timeout: the macOS admin-password /
 * Touch ID prompt, and the Windows certificate dialogs that block `certutil -addstore Root`
 * ("安全警告") and `-delstore Root` ("根证书存储") until the user clicks 是(Y) (KI-021). */
export const PRIVILEGE_PROMPT_TIMEOUT_MS = 120_000
/** Session ticket. Auxiliary cookies are not a lifetime. Matches webvpn-core-js. */
export const TICKET_COOKIE_NAME = 'wengine_vpn_ticketwebvpn_swufe_edu_cn'
export const STATUS_CACHE_TTL_MS = 2_000

export const CA_BASENAME = 'mitmproxy'
export const SYSTEM_KEYCHAIN = '/Library/Keychains/System.keychain'

export const CHANNEL_DEBUG_LOG = 'swufe:debug-log'
export const CHANNEL_STATUS = 'swufe:status'
export const CHANNEL_SESSION_EXPIRED = 'swufe:session-expired'

export const CONFIG_FILENAME = 'config.json'
export const RUNTIME_CONFIG_FILENAME = 'bridge-config.json'
export const CONFDIR_NAME = 'mitmproxy'

/** User-facing error messages, verbatim from docs/ui-ux/main-window.md. */
export const ERROR_MESSAGES = {
  NOT_LOGGED_IN: '尚未登录 WebVPN：请先点击「登录 WebVPN」完成统一身份认证。',
  ALLOWLIST_EMPTY: 'allowlist 为空：请在配置文件中添加主机或启用 *.swufe.edu.cn。',
  CA_MISSING: '需要安装本机证书才能处理 HTTPS：请先点击「安装本机 CA」。',
  PROXY_CONFLICT:
    '检测到代理环境冲突：系统代理已启用，或存在 VPN / 代理工具的 TUN（虚拟网卡）模式。请先关闭 Clash / mihomo / 其它 VPN 的系统代理与 TUN 模式后再试。',
  BRIDGE_CRASH: '桥接进程异常退出：请查看日志后重新开启桥接。',
  SESSION_EXPIRED: 'WebVPN 会话已失效。桥接已停止并已清除系统代理。',
} as const
