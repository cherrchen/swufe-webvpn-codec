export const SETTINGS_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>SWUFE WebVPN</title>
<style>
  :root { color-scheme: light dark; --bg: #f2f2f7; --card: #fff; --text: #111; --muted: #6b6b70; --line: #e5e5ea; --ok: #1b7f3a; --bad: #b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg: #000; --card: #1c1c1e; --text: #f2f2f7; --muted: #a1a1a6; --line: #333; --ok: #6dcc8a; --bad: #ff8a80; } }
  body { margin: 0; font: 16px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; background: var(--bg); color: var(--text); padding: calc(16px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom)); }
  h1 { font-size: 22px; margin: 0 0 12px; }
  section { background: var(--card); border-radius: 12px; margin: 0 0 16px; overflow: hidden; }
  .row, label.row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--line); }
  .row > span:first-child { flex: 1; }
  .row:last-child { border-bottom: 0; }
  .meta { color: var(--muted); font-size: 13px; }
  button, input, select { font: inherit; }
  select { border: 0; background: transparent; color: inherit; }
  button { border: 0; background: transparent; color: #007aff; padding: 12px 14px; }
  input { flex: 1; border: 0; background: transparent; color: inherit; min-width: 0; }
  .error { color: var(--bad); font-size: 13px; padding: 0 14px 12px; }
  .banner { font-size: 14px; padding: 10px 12px; border-radius: 10px; margin: 0 0 12px; }
  .ok { background: color-mix(in srgb, var(--ok) 16%, transparent); }
  .bad { background: color-mix(in srgb, var(--bad) 16%, transparent); }
</style>
</head>
<body>
<h1>SWUFE WebVPN</h1>
<p id="status" class="meta">状态：读取中</p>
<p class="meta">已选网站在同一 Stash 中共用当前 WebVPN 账号。</p>
<p id="warning" class="banner" hidden>部分旧网站设置不再受支持，请检查当前列表</p>
<p id="feedback" class="banner" hidden></p>
<section id="builtin"></section>
<section>
  <div id="custom"></div>
  <label class="row"><input id="host" placeholder="name.swufe.edu.cn" autocapitalize="none" spellcheck="false"><button id="add" type="button">添加网站</button></label>
  <p id="host-error" class="error" hidden>请输入 name.swufe.edu.cn 格式的主机名</p>
</section>
<section>
  <button id="save" type="button">保存</button>
  <button id="login" type="button">打开网页登录</button>
</section>
<script>
const origin = "https://webvpn.swufe.edu.cn";
const api = origin + "/__swufe_bridge__/api/settings";
const state = { token: "", builtin: { jwxt: true }, custom: [], schemes: {}, status: "logged-out" };
const statusText = { "logged-in": "已登录", "logged-out": "未登录", expired: "会话已失效", incompatible: "插件需要更新" };
function show(id, text, kind) {
  const node = document.getElementById(id);
  node.hidden = !text;
  node.textContent = text || "";
  if (kind) node.className = "banner " + kind;
}
function schemeSelect(host) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", host + " 协议");
  for (const scheme of ["http", "https"]) {
    const option = document.createElement("option");
    option.value = scheme;
    option.textContent = scheme;
    select.append(option);
  }
  select.value = state.schemes[host] === "https" ? "https" : "http";
  select.addEventListener("change", () => {
    if (select.value === "https") state.schemes[host] = "https";
    else delete state.schemes[host];
  });
  return select;
}
function render() {
  document.getElementById("status").textContent = "状态：" + (statusText[state.status] || "未登录");
  const builtin = document.getElementById("builtin");
  builtin.replaceChildren();
  const row = document.createElement("div");
  row.className = "row";
  const text = document.createElement("span");
  text.append(document.createTextNode("教务系统"));
  text.append(document.createElement("br"));
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = "jwxt.swufe.edu.cn";
  text.append(meta);
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = state.builtin.jwxt === true;
  toggle.setAttribute("aria-label", "教务系统");
  toggle.addEventListener("change", () => { state.builtin.jwxt = toggle.checked; });
  row.append(text, schemeSelect("jwxt.swufe.edu.cn"), toggle);
  builtin.append(row);
  const custom = document.getElementById("custom");
  custom.replaceChildren();
  state.custom.forEach((host, index) => {
    const item = document.createElement("div");
    item.className = "row";
    const name = document.createElement("span");
    name.textContent = host;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", () => { state.custom.splice(index, 1); delete state.schemes[host]; render(); });
    item.append(name, schemeSelect(host), remove);
    custom.append(item);
  });
}
async function load() {
  const response = await fetch(api, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    show("feedback", "设置暂不可用", "bad");
    return;
  }
  state.token = body.token || "";
  state.builtin = body.data.settings.builtinSiteStates;
  state.custom = body.data.settings.customHosts.slice();
  state.schemes = body.data.settings.hostSchemes || {};
  state.status = body.data.status;
  show("warning", body.data.migrationWarnings && body.data.migrationWarnings.length ? "部分旧网站设置不再受支持，请检查当前列表" : "");
  render();
}
document.getElementById("add").addEventListener("click", () => {
  const value = document.getElementById("host").value.trim().toLowerCase().replace(/\\.+$/, "");
  const ok = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value) && value.endsWith(".swufe.edu.cn") && value !== "swufe.edu.cn";
  document.getElementById("host-error").hidden = ok;
  if (!ok || state.custom.includes(value) || value === "jwxt.swufe.edu.cn" || value === "webvpn.swufe.edu.cn" || value === "authserver.swufe.edu.cn") {
    document.getElementById("host-error").hidden = false;
    return;
  }
  state.custom.push(value);
  document.getElementById("host").value = "";
  render();
});
document.getElementById("save").addEventListener("click", async () => {
  show("feedback", "正在保存", "");
  const response = await fetch(api, {
    method: "POST",
    headers: { "content-type": "application/json", "x-swufe-settings-token": state.token },
    body: JSON.stringify({ schemaVersion: 2, builtinSiteStates: state.builtin, customHosts: state.custom, hostSchemes: state.schemes })
  });
  const body = await response.json().catch(() => ({}));
  if (response.ok && body.ok) {
    show("feedback", "已保存", "ok");
    show("warning", "");
    await load();
    return;
  }
  show("feedback", "保存失败，请重试", "bad");
});
document.getElementById("login").addEventListener("click", () => { location.href = origin + "/"; });
load().catch(() => show("feedback", "设置暂不可用", "bad"));
</script>
</body>
</html>`;
