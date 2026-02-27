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

    html, body { min-height: 100%; }

    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(1000px 520px at -5% -20%, rgba(37, 99, 235, 0.18), transparent 60%),
        radial-gradient(900px 500px at 110% -10%, rgba(59, 130, 246, 0.12), transparent 65%),
        linear-gradient(180deg, #04070f 0%, #070b14 55%, #03060d 100%);
    }

    .shell {
      width: min(1200px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 14px;
    }

    .topbar {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--card);
      box-shadow: var(--shadow);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      backdrop-filter: blur(3px);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .logo {
      width: 38px;
      height: 38px;
      border-radius: 11px;
      border: 1px solid rgba(96, 165, 250, 0.45);
      background: linear-gradient(135deg, #1d4ed8, #60a5fa);
      color: #eff6ff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      letter-spacing: 0.4px;
      line-height: 1;
      flex-shrink: 0;
    }

    .content {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--card);
      box-shadow: var(--shadow);
      padding: 18px;
    }

    .card {
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--card-2);
      padding: 14px;
    }

    h2 {
      margin: 0;
      font-size: 18px;
      letter-spacing: 0.2px;
    }

    .notice {
      display: none;
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 11px 12px;
      margin-bottom: 12px;
      font-size: 13px;
      line-height: 1.45;
      background: rgba(15, 23, 42, 0.75);
      color: #cbd5e1;
    }

    .notice.show { display: block; }
    .notice.success {
      border-color: rgba(34, 197, 94, 0.45);
      background: rgba(20, 83, 45, 0.4);
      color: #bbf7d0;
    }
    .notice.error {
      border-color: rgba(239, 68, 68, 0.5);
      background: rgba(127, 29, 29, 0.4);
      color: #fecaca;
    }
    .notice.warning {
      border-color: rgba(245, 158, 11, 0.5);
      background: rgba(120, 53, 15, 0.38);
      color: #fde68a;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 30px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(15, 23, 42, 0.8);
      color: #facc15;
      font-size: 12px;
      white-space: nowrap;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--warning);
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
      flex-shrink: 0;
    }

    .badge.ok {
      border-color: rgba(34, 197, 94, 0.45);
      color: #bbf7d0;
      background: rgba(20, 83, 45, 0.35);
    }

    .badge.ok .dot {
      background: var(--success);
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14);
    }

    .muted { color: var(--muted); }
    .mono { font-family: var(--mono); }

    .form-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      margin-top: 10px;
      align-items: center;
    }

    .form-row .btn { min-width: 120px; }

    .form-group {
      margin-bottom: 16px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      color: #cbd5e1;
    }

    input, select {
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

    input:focus, select:focus {
      border-color: rgba(96, 165, 250, .9);
      box-shadow: 0 0 0 4px rgba(59, 130, 246, .2);
    }
    
    input[type="checkbox"] {
      width: 20px;
      height: 20px;
      margin: 0;
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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
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
    .chip.danger { color: #fecaca; border-color: rgba(239, 68, 68, .5); }
    .chip.success { color: #bbf7d0; border-color: rgba(34, 197, 94, .5); }

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

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    @media (max-width: 1080px) {
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 640px) {
      body { padding: 10px; }
      .topbar, .content { padding: 14px; }
      .form-row { grid-template-columns: 1fr; }
      .stats { grid-template-columns: 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
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
            <button class="tab-btn" data-tab="backup">备份</button>
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

        <div id="tab-backup" class="tab-pane">
          <div class="grid-2">
            <div class="card">
              <h2>备份状态</h2>
              <div id="backupStatus" style="display:grid; gap:12px;"></div>
            </div>
            
            <div class="card">
              <h2>最近一次运行</h2>
              <div id="lastBackup" style="display:grid; gap:12px;"></div>
            </div>
          </div>

          <div class="card" style="margin-top:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h2>备份设置</h2>
              <button id="backupRunBtn" class="btn primary">立即运行备份</button>
            </div>
            <form id="backupForm" style="display:grid; gap:16px; max-width:600px;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <input type="checkbox" id="backupEnabled" />
                <label for="backupEnabled" style="margin:0; cursor:pointer;">启用自动备份</label>
              </div>

              <div class="form-group">
                <label>备份间隔 (分钟)</label>
                <input type="number" id="backupInterval" min="5" placeholder="默认 1440 (24小时)" />
                <div class="muted" style="font-size:12px; margin-top:4px;">最小 5 分钟。建议设置为 60 分钟以上，避免过于频繁。</div>
              </div>

              <div class="form-group">
                <label>存储服务商 (Provider)</label>
                <select id="backupProvider">
                  <option value="s3">AWS S3 / 兼容 S3 的存储 (R2)</option>
                  <option value="webdav">WebDAV</option>
                </select>
              </div>

              <div class="form-group">
                <label>存储路径前缀</label>
                <input type="text" id="backupPath" placeholder="例如: backups/ (留空默认为 backups/)" />
              </div>
              
              <div>
                <button type="submit" class="btn primary">保存设置</button>
              </div>
            </form>
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
        let errorData = null;
        try {
          const data = await response.json();
          errorData = data;
          if (data && typeof data === 'object') {
            message = data.error_description || data.error || data.message || message;
          }
        } catch (parseError) {
          void parseError;
        }

        const error = new Error(message);
        Object.assign(error, {
          status: response.status,
          data: errorData,
        });
        throw error;
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
    
    function timeAgo(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return '-';
      const sec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (sec < 60) return sec + '秒前';
      if (sec < 3600) return Math.floor(sec/60) + '分钟前';
      if (sec < 86400) return Math.floor(sec/3600) + '小时前';
      return Math.floor(sec/86400) + '天前';
    }

    function statCard(label, value, desc) {
      return '<div class="stat">'
        + '<div class="k">' + label + '</div>'
        + '<div class="v">' + value + '</div>'
        + '<div class="muted" style="font-size:12px; margin-top:4px;">' + (desc || '') + '</div>'
        + '</div>';
    }
    
    function detailItem(label, value) {
        return '<div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--line); padding:8px 0;">'
          + '<span class="muted">' + label + '</span>'
          + '<span style="font-weight:500;">' + value + '</span>'
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
    
    async function loadBackup() {
      const data = await api('/admin/api/backup');
      const status = data.status || {};
      const state = data.state || {};
      const config = data.settings || {};
      
      // Update form
      document.getElementById('backupEnabled').checked = !!config.enabled;
      document.getElementById('backupInterval').value = config.intervalMinutes || 1440;
      document.getElementById('backupProvider').value = config.provider || 's3';
      document.getElementById('backupPath').value = config.pathPrefix || '';
      
      // Update Status Panel
      const statusEl = document.getElementById('backupStatus');
      const statusChip = config.enabled 
        ? '<span class="chip success">已启用</span>' 
        : '<span class="chip warn">已停用</span>';
        
      let envChip = '<span class="chip success">配置正常</span>';
      if (!status.providerConfigured) {
        const missing = (status.providerMissingEnv || []).join(', ');
        envChip = '<span class="chip danger" title="缺少: ' + missing + '">配置缺失</span>';
      }
        
      statusEl.innerHTML = [
        detailItem('功能状态', statusChip),
        detailItem('当前运行', status.isRunning ? '<span class="chip warn">进行中</span>' : '<span class="chip">空闲</span>'),
        detailItem('到期状态', status.isDue ? '<span class="chip warn">已到期</span>' : '<span class="chip">未到期</span>'),
        detailItem('环境配置', envChip),
        detailItem('下次运行', status.nextDueAt ? formatTime(status.nextDueAt) + ' (' + timeAgo(status.nextDueAt).replace('前', '后') + ')' : '未计划'),
        detailItem('存储服务商', (config.provider || 's3').toUpperCase()),
      ].join('');
      
      // Update Last Run Panel
      const lastRunEl = document.getElementById('lastBackup');
      if (!state.lastRunAt) {
        lastRunEl.innerHTML = '<div class="muted">暂无备份记录</div>';
      } else {
        let runStatus = '<span class="chip">未知</span>';
        if (state.lastStatus === 'success') runStatus = '<span class="chip success">成功</span>';
        else if (state.lastStatus === 'failure') runStatus = '<span class="chip danger">失败</span>';
        else if (state.lastStatus === 'skipped') runStatus = '<span class="chip warn">跳过</span>';
          
        lastRunEl.innerHTML = [
          detailItem('运行状态', runStatus),
          detailItem('完成时间', formatTime(state.lastRunAt)),
          detailItem('耗时', (state.lastDurationMs || 0) + ' ms'),
          detailItem('附件数量', typeof state.lastAttachmentCount === 'number' ? state.lastAttachmentCount : '-'),
          detailItem('附件体积', typeof state.lastAttachmentBytes === 'number' ? formatBytes(state.lastAttachmentBytes) : '-'),
          detailItem('大小', formatBytes(state.lastSizeBytes)),
          detailItem('文件路径', '<span class="mono" style="font-size:12px; word-break:break-all;">' + (state.lastFileName || state.lastLocation || '-') + '</span>'),
          state.lastError ? '<div style="color:var(--danger); font-size:12px; margin-top:8px;">错误: ' + state.lastError + '</div>' : ''
        ].join('');
      }
    }
    
    async function saveBackupSettings(e) {
      e.preventDefault();
      const btn = e.submitter;
      if (btn) {
         btn.disabled = true;
         btn.textContent = '保存中...';
      }
      
      try {
        const payload = {
          enabled: document.getElementById('backupEnabled').checked,
          intervalMinutes: parseInt(document.getElementById('backupInterval').value) || 1440,
          provider: document.getElementById('backupProvider').value,
          pathPrefix: document.getElementById('backupPath').value,
        };
        
        await api('/admin/api/backup/settings', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        
        setNotice('设置已保存', 'success');
        await loadBackup();
      } catch (err) {
        setNotice(err.message || '保存失败', 'error');
      } finally {
        if (btn) {
           btn.disabled = false;
           btn.textContent = '保存设置';
        }
      }
    }
    
    async function runBackup() {
      const btn = document.getElementById('backupRunBtn');
      if (!confirm('确定要立即运行一次备份吗？这可能需要几分钟。')) return;
      
      btn.disabled = true;
      btn.textContent = '备份中...';
      
      try {
        const res = await api('/admin/api/backup/run', { method: 'POST' });
        if (res && res.status === 'skipped') {
             setNotice('备份跳过', 'warning');
        } else if (res && res.status === 'failure') {
             setNotice('备份失败', 'error');
        } else {
             setNotice('备份成功！', 'success');
        }
        await loadBackup();
      } catch (err) {
        const statusCode = (err && typeof err === 'object' && 'status' in err)
          ? Number(err.status)
          : 0;
        const errorData = (err && typeof err === 'object' && 'data' in err && err.data && typeof err.data === 'object')
          ? err.data
          : null;

        const skippedFromBody = errorData && errorData.status === 'skipped';
        if (statusCode === 409 || skippedFromBody) {
          setNotice('备份跳过: 正在运行或当前无需执行', 'warning');
        } else {
          setNotice((err && err.message) || '备份失败', 'error');
        }
        await loadBackup();
      } finally {
        btn.disabled = false;
        btn.textContent = '立即运行备份';
      }
    }

    async function refreshAll() {
      setNotice('正在刷新数据...', '');
      await Promise.all([loadOverview(), loadUsers(), loadAudit(), loadBackup()]);
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
      
      document.getElementById('backupForm').addEventListener('submit', saveBackupSettings);
      document.getElementById('backupRunBtn').addEventListener('click', runBackup);

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
