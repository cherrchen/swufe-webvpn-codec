/**
 * Renderer-side fixed user-facing literals (verbatim from spec 002's 文案表 /
 * docs/ui-ux). Main-side error texts stay in `src/main/constants.ts`.
 */

export const CA_WARNING_TEXT = '本证书用于在本机解密并改写 HTTPS，仅限个人设备；可随时卸载。'
export const CA_PROMPT_INSTALLING = '正在安装本机 CA：请在随后弹出的系统授权窗口输入管理员密码…'
export const CA_INSTALLED = '本机 CA 已安装并被系统信任。'
export const CA_UNINSTALLING = '正在卸载本机 CA…'
export const CA_UNINSTALLED = '本机 CA 已卸载。'
export const caInstallFailed = (message: string): string => `安装失败：${message}`
export const caUninstallFailed = (message: string): string => `卸载失败：${message}`

export const HOST_EMPTY = '请输入主机名。'
export const hostInvalid = (host: string): string => `主机名不合法：${host}`
export const hostAdded = (host: string): string => `已添加 ${host}。`
export const hostRemoved = (host: string): string => `已删除 ${host}。`

export const CAPTURE_MODE_HINT =
  '系统代理：全部流量经本桥；指定应用：只有所选应用的流量经本桥，本 App 不设置系统代理（切换时会撤销本 App 设置过的系统代理）。'
export const CAPTURE_GUIDANCE =
  '首次启用时 macOS 会安装并激活 mitmproxy 的网络扩展：请在系统设置 → 通用 → 登录项与扩展（或弹出的授权提示）中允许。未在 5 秒内确认会导致启用失败，授权后点「重试」。'

export const EMPTY_LOG_ROWS = '尚无日志：开启调试日志并产生流量后在此显示。'
export const EMPTY_CANDIDATES = '暂无候选应用：请点「刷新列表」重试。'
export const NO_FILTER_MATCH = '没有匹配的应用。'
export const selectedNotRunning = (pattern: string): string => `${pattern}（当前未运行）`

export const loginOpenFailed = (message: string): string => `打开登录窗口失败：${message}`

export const ERROR_BOUNDARY = (reason: string): string =>
  `界面加载失败：${reason}。可点「重新加载窗口」重试。`
