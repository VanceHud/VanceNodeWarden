export interface AdminPageRenderState {
  authenticated: boolean;
  adminEnabled: boolean;
}

export function renderAdminPageHTML(state: AdminPageRenderState): string {
  const stateJson = JSON.stringify(state);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>NodeWarden Admin</title>
  <style>
    :root {
      --bg: #070b14;
      --bg-soft: #0d1324;
      --card: rgba(15, 23, 42, 0.72);
      --card-2: rgba(15, 23, 42, 0.9);
      --line: rgba(148, 163, 184, 0.25);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --primary: #60a5fa;
      --primary-2: #2563eb;
      --success: #22c55e;
      --danger: #ef4444;
      --warning: #f59e0b;
      --radius: 16px;
      --radius-sm: 12px;
      --shadow: 0 18px 45px rgba(2, 6, 23, 0.45);
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      color: var(--text);
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background:
        radial-gradient(1200px 700px at 80% -20%, rgba(37, 99, 235, 0.22), transparent 60%),
        radial-gradient(900px 600px at -20% 10%, rgba(99, 102, 241, 0.2), transparent 55%),
        var(--bg);
      min-height: 100%;
      padding: 28px;
    }

    .shell {
      width: min(1240px, 100%);
      margin: 0 auto;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(15,23,42,.78), rgba(2,6,23,.74));
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 18px 22px;
      border-bottom: 1px solid var(--line);
      background: rgba(15, 23, 42, 0.65);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      letter-spacing: .2px;
    }

    .logo {
      width: 38px;
      height: 38px;
      border-radius: 11px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #2563eb, #60a5fa);
      color: #fff;
      font-size: 14px;
      font-weight: 800;
      box-shadow: 0 8px 20px rgba(37, 99, 235, .45);
      user-select: none;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      font-size: 12px;
      color: var(--muted);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--warning);
    }

    .badge.ok .dot { background: var(--success); }

    .content {
      padding: 22px;
      display: grid;
      gap: 18px;
    }

    .notice {
      display: none;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
      background: rgba(15, 23, 42, 0.8);
      font-size: 14px;
    }

    .notice.show { display: block; }
    .notice.error { border-color: rgba(239, 68, 68, .4); color: #fecaca; background: rgba(127, 29, 29, .25); }
    .notice.success { border-color: rgba(34, 197, 94, .35); color: #bbf7d0; background: rgba(22, 101, 52, .25); }

    .card {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--card);
      padding: 16px;
    }

    .card h2 {
      margin: 0 0 10px 0;
      font-size: 18px;
      letter-spacing: .2px;
    }

    .muted { color: var(--muted); }
    .mono { font-family: var(--mono); }

    .form-row {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr auto;
      align-items: center;
    }

    input {
      width: 100%;
      height: 42px;
      border-radius: 11px;
      border: 1px solid rgba(148, 163, 184, .35);
      background: rgba(15, 23, 42, .68);
      color: var(--text);
      padding: 0 12px;
      outline: none;
      transition: border-color .15s ease, box-shadow .15s ease;
    }

    input:focus {
      border-color: rgba(96, 165, 250, .9);
      box-shadow: 0 0 0 4px rgba(59, 130, 246, .2);
    }

    .btn {
      height: 42px;
      border: 1px solid transparent;
      border-radius: 11px;
      background: #1e293b;
      color: var(--text);
      padding: 0 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s ease;
    }

    .btn:hover { transform: translateY(-1px); }
    .btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }

    .btn.primary {
      background: linear-gradient(135deg, var(--primary-2), var(--primary));
      box-shadow: 0 8px 22px rgba(37, 99, 235, .35);
      color: #eff6ff;
    }

    .btn.ghost {
      border-color: rgba(148, 163, 184, .3);
      background: transparent;
      color: var(--muted);
    }

    .btn.danger {
      background: rgba(127, 29, 29, .35);
      border-color: rgba(239, 68, 68, .4);
      color: #fecaca;
    }

    .tabs {
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: 999px;
      overflow: hidden;
      background: rgba(15, 23, 42, .56);
    }

    .tab-btn {
      border: none;
      background: transparent;
      color: var(--muted);
      height: 40px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 600;
    }

    .tab-btn.active {
      background: rgba(37, 99, 235, .25);
      color: #dbeafe;
    }

    .tab-pane { display: none; }
    .tab-pane.active { display: block; }

    .stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }

    .stat {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--card-2);
      padding: 12px;
    }

    .stat .k {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 8px;
    }

    .stat .v {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: .2px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    th, td {
      border-bottom: 1px solid rgba(148, 163, 184, .2);
      text-align: left;
      padding: 10px 8px;
      vertical-align: top;
    }

    th {
      color: #cbd5e1;
      font-size: 12px;
      letter-spacing: .3px;
      text-transform: uppercase;
    }

    .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, .28);
      color: #cbd5e1;
      font-size: 12px;
    }

    .chip.warn { color: #fcd34d; border-color: rgba(245, 158, 11, .5); }

    .audit-list {
      display: grid;
      gap: 10px;
      max-height: 520px;
      overflow: auto;
      padding-right: 4px;
    }

    .audit-item {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--card-2);
      padding: 10px 12px;
    }

    .audit-top {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 13px;
    }

    .audit-detail {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--mono);
      font-size: 12px;
      color: #a5b4fc;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .hidden { display: none !important; }

    @media (max-width: 1080px) {
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 640px) {
      body { padding: 10px; }
      .topbar, .content { padding: 14px; }
      .form-row { grid-template-columns: 1fr; }
      .stats { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="logo">NW</span>
        <div>
          <div>NodeWarden Admin</div>
          <div class="muted" style="font-size:12px;">后台管理控制台</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span id="adminStatus" class="badge"><span class="dot"></span><span>未启用</span></span>
        <button id="logoutBtn" class="btn ghost hidden" type="button">退出登录</button>
      </div>
    </header>

    <main class="content">
      <div id="notice" class="notice"></div>

      <section id="disabledPanel" class="card hidden">
        <h2>后台管理未启用</h2>
        <p class="muted">请在 Cloudflare Workers 环境变量中设置 <span class="mono">ADMIN_TOKEN</span> 后刷新页面。</p>
      </section>

      <section id="loginPanel" class="card hidden">
        <h2>管理员登录</h2>
        <p class="muted">使用 <span class="mono">ADMIN_TOKEN</span> 登录后台。</p>
        <form id="loginForm" class="form-row">
          <input id="adminTokenInput" type="password" placeholder="输入 ADMIN_TOKEN" autocomplete="current-password" required />
          <button id="loginBtn" class="btn primary" type="submit">登录</button>
        </form>
      </section>

      <section id="appPanel" class="hidden">
        <div class="toolbar">
          <div class="tabs" id="tabs">
            <button class="tab-btn active" data-tab="overview">总览</button>
            <button class="tab-btn" data-tab="users">用户</button>
            <button class="tab-btn" data-tab="audit">审计日志</button>
          </div>
          <button id="refreshBtn" class="btn" type="button">刷新数据</button>
        </div>

        <div id="tab-overview" class="tab-pane active">
          <div class="stats" id="statsGrid"></div>
          <div class="card" style="margin-top:12px;">
            <h2>系统信息</h2>
            <table>
              <tbody id="systemInfoBody"></tbody>
            </table>
          </div>
        </div>

        <div id="tab-users" class="tab-pane">
          <div class="card">
            <h2>用户管理</h2>
            <div style="overflow:auto; margin-top:8px;">
              <table>
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>状态</th>
                    <th>密库</th>
                    <th>设备</th>
                    <th>附件</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody id="usersBody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div id="tab-audit" class="tab-pane">
          <div class="card">
            <h2>审计日志</h2>
            <p class="muted">记录管理员登录和操作行为。</p>
            <div id="auditList" class="audit-list"></div>
          </div>
        </div>
      </section>
    </main>
  </div>

  <script>
    const STATE = ${stateJson};

    const noticeEl = document.getElementById('notice');
    const disabledPanel = document.getElementById('disabledPanel');
    const loginPanel = document.getElementById('loginPanel');
    const appPanel = document.getElementById('appPanel');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminStatus = document.getElementById('adminStatus');
    const refreshBtn = document.getElementById('refreshBtn');

    function setNotice(message, type) {
      if (!message) {
        noticeEl.className = 'notice';
        noticeEl.textContent = '';
        return;
      }
      noticeEl.textContent = message;
      noticeEl.className = 'notice show ' + (type || '');
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        credentials: 'same-origin',
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        let message = '请求失败';
        try {
          const data = await response.json();
          message = data.error_description || data.error || message;
        } catch {}
        throw new Error(message);
      }

      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    function formatTime(value) {
      if (!value) return '-';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return d.toLocaleString();
    }

    function formatBytes(bytes) {
      const b = Number(bytes || 0);
      if (b < 1024) return b + ' B';
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
      if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
      return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }

    function statCard(label, value, desc) {
      return '<div class="stat">'
        + '<div class="k">' + label + '</div>'
        + '<div class="v">' + value + '</div>'
        + '<div class="muted" style="font-size:12px; margin-top:4px;">' + (desc || '') + '</div>'
        + '</div>';
    }

    async function loadOverview() {
      const data = await api('/admin/api/overview');
      const stats = data.stats || {};

      const grid = document.getElementById('statsGrid');
      grid.innerHTML = [
        statCard('用户总数', stats.usersTotal || 0, '禁用: ' + (stats.usersDisabled || 0)),
        statCard('密库条目', stats.ciphersTotal || 0, '已软删除: ' + (stats.ciphersDeleted || 0)),
        statCard('设备总数', stats.devicesTotal || 0, '文件夹: ' + (stats.foldersTotal || 0)),
        statCard('附件总数', stats.attachmentsTotal || 0, '占用: ' + formatBytes(stats.attachmentsBytesTotal || 0)),
        statCard('后台会话', stats.adminSessionsTotal || 0, '当前有效会话'),
      ].join('');

      const info = data.system || {};
      document.getElementById('systemInfoBody').innerHTML = [
        ['注册状态', info.registered ? '<span class="chip">已完成</span>' : '<span class="chip warn">未完成</span>'],
        ['JWT_SECRET', info.jwtSecretSafe ? '<span class="chip">安全</span>' : '<span class="chip warn">不安全</span>'],
        ['TOTP 登录保护', info.totpEnabled ? '<span class="chip">已启用</span>' : '<span class="chip warn">未启用</span>'],
        ['后台登录', info.adminEnabled ? '<span class="chip">已启用</span>' : '<span class="chip warn">未启用</span>'],
        ['服务版本', '<span class="mono">' + (info.serverVersion || '-') + '</span>'],
      ].map(([k, v]) => '<tr><td style="width:180px; color:#94a3b8;">' + k + '</td><td>' + v + '</td></tr>').join('');
    }

    function actionBtn(label, className, action, userId, userEmail) {
      return '<button class="btn ' + (className || '') + '" data-action="' + action + '" data-user-id="' + userId + '" data-user-email="' + userEmail + '" type="button" style="height:32px; padding:0 10px; font-size:12px;">' + label + '</button>';
    }

    async function loadUsers() {
      const data = await api('/admin/api/users');
      const users = data.data || [];
      const body = document.getElementById('usersBody');

      if (!users.length) {
        body.innerHTML = '<tr><td colspan="7" class="muted">暂无用户数据</td></tr>';
        return;
      }

      body.innerHTML = users.map(user => {
        const status = user.disabled
          ? '<span class="chip warn">已禁用</span>'
          : '<span class="chip">正常</span>';
        const actions = [
          user.disabled
            ? actionBtn('启用', '', 'enable', user.id, user.email)
            : actionBtn('禁用', '', 'disable', user.id, user.email),
          actionBtn('注销会话', '', 'deauth', user.id, user.email),
          actionBtn('删除用户', 'danger', 'delete', user.id, user.email),
        ].join('');

        return '<tr>'
          + '<td><strong>' + (user.name || '(未命名)') + '</strong><div class="muted mono">' + user.email + '</div></td>'
          + '<td>' + status + '</td>'
          + '<td>' + user.cipherCount + '</td>'
          + '<td>' + user.deviceCount + '</td>'
          + '<td>' + user.attachmentCount + ' / ' + formatBytes(user.attachmentSize) + '</td>'
          + '<td>' + formatTime(user.createdAt) + '</td>'
          + '<td><div class="row-actions">' + actions + '</div></td>'
          + '</tr>';
      }).join('');
    }

    async function loadAudit() {
      const data = await api('/admin/api/audit-logs?limit=100');
      const logs = data.data || [];
      const list = document.getElementById('auditList');

      if (!logs.length) {
        list.innerHTML = '<div class="muted">暂无审计日志。</div>';
        return;
      }

      list.innerHTML = logs.map(log => {
        const detail = log.detail ? JSON.stringify(log.detail, null, 2) : '';
        return '<article class="audit-item">'
          + '<div class="audit-top"><strong>' + log.action + '</strong><span class="muted">' + formatTime(log.createdAt) + '</span></div>'
          + '<div class="muted" style="font-size:12px; margin-bottom:6px;">target: ' + (log.targetType || '-') + ' / ' + (log.targetId || '-') + ' · ip: ' + (log.ip || '-') + '</div>'
          + (detail ? '<pre class="audit-detail">' + detail + '</pre>' : '')
          + '</article>';
      }).join('');
    }

    async function refreshAll() {
      setNotice('正在刷新数据...', '');
      await Promise.all([loadOverview(), loadUsers(), loadAudit()]);
      setNotice('数据已更新', 'success');
      setTimeout(() => setNotice(''), 1200);
    }

    async function doUserAction(action, userId, userEmail) {
      if (!userId) return;

      if (action === 'delete') {
        const input = prompt('删除用户前请输入邮箱确认：' + userEmail);
        if (input !== userEmail) {
          setNotice('邮箱不匹配，已取消删除', 'error');
          return;
        }
      } else {
        const ok = confirm('确认执行操作：' + action + ' ?');
        if (!ok) return;
      }

      const method = action === 'delete' ? 'DELETE' : 'POST';
      await api('/admin/api/users/' + encodeURIComponent(userId) + '/' + action, { method });
      await Promise.all([loadOverview(), loadUsers(), loadAudit()]);
      setNotice('操作成功', 'success');
    }

    function bindTabs() {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-tab');
          document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
          document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
          const pane = document.getElementById('tab-' + tab);
          if (pane) pane.classList.add('active');
        });
      });
    }

    function setStatus() {
      const ok = STATE.adminEnabled;
      adminStatus.className = ok ? 'badge ok' : 'badge';
      adminStatus.innerHTML = '<span class="dot"></span><span>' + (ok ? '后台已启用' : '后台未启用') + '</span>';
    }

    async function initAuthenticatedView() {
      logoutBtn.classList.remove('hidden');
      appPanel.classList.remove('hidden');
      bindTabs();
      refreshBtn.addEventListener('click', () => {
        refreshAll().catch(err => setNotice(err.message || '刷新失败', 'error'));
      });

      document.getElementById('usersBody').addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute('data-action');
        if (!action) return;
        const userId = target.getAttribute('data-user-id') || '';
        const userEmail = target.getAttribute('data-user-email') || '';
        doUserAction(action, userId, userEmail).catch(err => setNotice(err.message || '操作失败', 'error'));
      });

      logoutBtn.addEventListener('click', async () => {
        try {
          await api('/admin/logout', { method: 'POST' });
          location.reload();
        } catch (err) {
          setNotice(err.message || '退出失败', 'error');
        }
      });

      await refreshAll();
    }

    function initLoginView() {
      loginPanel.classList.remove('hidden');
      const form = document.getElementById('loginForm');
      const input = document.getElementById('adminTokenInput');
      const btn = document.getElementById('loginBtn');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const token = input.value.trim();
        if (!token) {
          setNotice('请输入 ADMIN_TOKEN', 'error');
          return;
        }

        btn.disabled = true;
        btn.textContent = '登录中...';
        try {
          await api('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ token }),
          });
          location.reload();
        } catch (err) {
          setNotice(err.message || '登录失败', 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '登录';
        }
      });
    }

    (function init() {
      setStatus();
      if (!STATE.adminEnabled) {
        disabledPanel.classList.remove('hidden');
        return;
      }

      if (STATE.authenticated) {
        initAuthenticatedView().catch(err => setNotice(err.message || '加载失败', 'error'));
      } else {
        initLoginView();
      }
    })();
  </script>
</body>
</html>`;
}
