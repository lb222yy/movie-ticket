/* ============================================================
   CineMax · 公共 UI（头尾、登录弹窗、Toast、弹窗、卡片、倒计时）
   ============================================================ */
(function () {
  const { qs, qsa, escapeHtml, dateCN } = window.Utils;

  const ICONS = {
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5V6.8A1.8 1.8 0 0 1 4.8 5h14.4A1.8 1.8 0 0 1 21 6.8v2.7a2.5 2.5 0 0 0 0 5v2.7a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17.2v-2.7a2.5 2.5 0 0 0 0-5Z"/><path d="M14 5v14" stroke-dasharray="2 2.4"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5S3.5 15.2 3.5 9.3A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.5 3.1c0 5.9-8.5 11.2-8.5 11.2Z"/></svg>',
    heartFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5S3.5 15.2 3.5 9.3A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.5 3.1c0 5.9-8.5 11.2-8.5 11.2Z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.8l5.9-.9Z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 8l-4 4 4 4M6 12h9"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 19V5M4 19h16"/><path d="M8 16v-5M12.5 16V8M17 16v-8"/></svg>',
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7 4.5v15M17 4.5v15M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/></svg>',
  };

  const icon = (name) => ICONS[name] || '';

  /* ------------------------------ Toast ------------------------------ */
  function toast(message, type = 'success', duration = 2600) {
    let wrap = qs('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, duration);
  }

  /* ------------------------------ 弹窗 ------------------------------ */
  function openModal(html, { size = '' } = {}) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask open';
    mask.innerHTML = `<div class="modal ${size}">${html}</div>`;
    document.body.appendChild(mask);
    document.body.classList.add('no-scroll');
    mask.addEventListener('click', (e) => {
      if (e.target === mask) closeModal(mask);
      if (e.target.closest('[data-close]')) closeModal(mask);
    });
    return mask;
  }

  function closeModal(mask) {
    if (!mask) return;
    mask.classList.remove('open');
    setTimeout(() => {
      mask.remove();
      if (!qs('.modal-mask')) document.body.classList.remove('no-scroll');
    }, 280);
  }

  function confirmDialog({ title = '确认操作', message = '', okText = '确认', cancelText = '取消', danger = false } = {}) {
    return new Promise((resolve) => {
      const mask = openModal(`
        <div class="modal-head">
          <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>
          <button class="modal-close" data-close>${icon('close')}</button>
        </div>
        <div class="modal-foot">
          <button class="btn btn-outline" data-cancel>${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-primary' : 'btn-primary'}" data-ok>${escapeHtml(okText)}</button>
        </div>
      `);
      mask.querySelector('[data-ok]').addEventListener('click', () => { closeModal(mask); resolve(true); });
      mask.querySelector('[data-cancel]').addEventListener('click', () => { closeModal(mask); resolve(false); });
      mask.addEventListener('click', (e) => { if (e.target === mask) resolve(false); });
    });
  }

  /* ------------------------------ 头部 ------------------------------ */
  const NAV = [
    { href: '/index.html', label: '首页', key: 'home' },
    { href: '/index.html#now', label: '正在热映', key: 'now' },
    { href: '/index.html#upcoming', label: '即将上映', key: 'upcoming' },
    { href: '/orders.html', label: '我的票夹', key: 'orders' },
  ];

  function headerHTML(active) {
    const user = window.Auth.user;
    const navHtml = NAV.map((n) => `<a href="${n.href}" class="${active === n.key ? 'active' : ''}">${n.label}</a>`).join('')
      + (window.Auth.isAdmin ? `<a href="/admin.html" class="${active === 'admin' ? 'active' : ''}">管理后台</a>` : '');
    const authHtml = user
      ? `<div class="user-menu">
          <button class="avatar-btn" id="userMenuBtn" aria-label="用户菜单">
            <span class="avatar">${escapeHtml(user.nickname?.slice(0, 1) || 'U')}</span>
          </button>
          <div class="dropdown" id="userDropdown">
            <div class="dd-head"><strong>${escapeHtml(user.nickname || user.username)}</strong><span>${user.role === 'admin' ? '影院管理员' : 'CineMax 会员'}</span></div>
            <a href="/orders.html">${icon('ticket')} 我的订单</a>
            <a href="/index.html#favorites">${icon('heart')} 我的收藏</a>
            ${user.role === 'admin' ? `<a href="/admin.html">${icon('chart')} 管理后台</a>` : ''}
            <button class="danger" id="logoutBtn">${icon('logout')} 退出登录</button>
          </div>
        </div>`
      : `<button class="btn btn-primary btn-sm" id="loginBtn">${icon('user')} <span>登录 / 注册</span></button>`;

    return `
      <header class="site-header" id="siteHeader">
        <div class="header-inner">
          <a class="logo" href="/index.html" aria-label="CineMax 首页">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3d5e"/><stop offset="1" stop-color="#ffb347"/></linearGradient></defs>
              <rect width="64" height="64" rx="16" fill="rgba(255,255,255,.06)"/>
              <path d="M16 20h32a4 4 0 0 1 4 4v6a6 6 0 0 0 0 12v6a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4v-6a6 6 0 0 0 0-12v-6a4 4 0 0 1 4-4z" fill="url(#lg)"/>
              <path d="M27 25v14l11-7z" fill="#0b0d12"/>
            </svg>
            <span>CINE<em>MAX</em><small>MOVIE TICKETS</small></span>
          </a>
          <nav class="main-nav" id="mainNav">${navHtml}</nav>
          <div class="header-actions">
            <form class="search-mini" id="miniSearch">
              ${icon('search')}
              <input type="search" name="keyword" placeholder="搜索影片、导演…" aria-label="搜索影片">
            </form>
            <a class="icon-btn" href="/orders.html" title="我的票夹" aria-label="我的票夹">${icon('ticket')}</a>
            <div id="authSlot">${authHtml}</div>
            <button class="menu-toggle" id="menuToggle" aria-label="菜单"><span></span><span></span><span></span></button>
          </div>
        </div>
      </header>`;
  }

  let activeNavKey = '';

  function mountHeader(active = '') {
    activeNavKey = active;
    const slot = qs('#headerRoot');
    if (!slot) return;
    slot.innerHTML = headerHTML(active);

    const header = qs('#siteHeader');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const nav = qs('#mainNav');
    qs('#menuToggle')?.addEventListener('click', () => nav.classList.toggle('open'));

    qs('#miniSearch')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const kw = e.target.keyword.value.trim();
      location.href = `/index.html?keyword=${encodeURIComponent(kw)}#now`;
    });

    bindAuthEvents();
  }

  function refreshHeader(active = activeNavKey) {
    activeNavKey = active;
    const slot = qs('#headerRoot');
    if (!slot) return;
    const wasSolid = qs('#siteHeader')?.classList.contains('scrolled');
    slot.innerHTML = headerHTML(active);
    if (wasSolid) qs('#siteHeader').classList.add('scrolled');
    bindAuthEvents(active);
    // 重新绑定滚动监听（旧节点已被替换）
    const header = qs('#siteHeader');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    qs('#menuToggle')?.addEventListener('click', () => qs('#mainNav').classList.toggle('open'));
    qs('#miniSearch')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const kw = e.target.keyword.value.trim();
      location.href = `/index.html?keyword=${encodeURIComponent(kw)}#now`;
    });
  }

  function bindAuthEvents(active = '') {
    const loginBtn = qs('#loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', () => openAuthModal());

    const menuBtn = qs('#userMenuBtn');
    const dropdown = qs('#userDropdown');
    if (menuBtn && dropdown) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      document.addEventListener('click', () => dropdown.classList.remove('open'));
    }
    qs('#logoutBtn')?.addEventListener('click', () => {
      window.Auth.logout();
      refreshHeader();
      toast('已退出登录', 'info');
      setTimeout(() => {
        if (location.pathname.includes('orders') || location.pathname.includes('admin')) {
          location.href = '/index.html';
        }
      }, 500);
    });
  }

  /* ------------------------------ 登录 / 注册弹窗 ------------------------------ */
  function openAuthModal(mode = 'login') {
    const mask = openModal(`
      <div class="modal-head">
        <div>
          <h3>${mode === 'login' ? '欢迎回来' : '加入 CineMax'}</h3>
          <p>${mode === 'login' ? '登录后可选座购票、管理订单' : '注册即可享受在线选座与会员权益'}</p>
        </div>
        <button class="modal-close" data-close>${icon('close')}</button>
      </div>
      <div class="auth-tabs">
        <button class="${mode === 'login' ? 'active' : ''}" data-mode="login">登录</button>
        <button class="${mode === 'register' ? 'active' : ''}" data-mode="register">注册</button>
      </div>
      <form id="authForm" novalidate>
        <div class="field">
          <label for="authUsername">用户名</label>
          <input class="input" id="authUsername" name="username" autocomplete="username" placeholder="3-20 位字母、数字或下划线">
        </div>
        <div class="field" id="nicknameField" style="display:none">
          <label for="authNickname">昵称</label>
          <input class="input" id="authNickname" name="nickname" placeholder="给自己起个名字">
        </div>
        <div class="field">
          <label for="authPassword">密码</label>
          <input class="input" id="authPassword" name="password" type="password" autocomplete="current-password" placeholder="至少 6 位">
        </div>
        <div class="form-error" id="authError"></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit" id="authSubmit">${mode === 'login' ? '登 录' : '注册并登录'}</button>
      </form>
      <div class="demo-tip">
        <b>演示账号</b><br>
        普通用户：<b>demo</b> / demo123　　管理员：<b>admin</b> / admin123
      </div>
    `);

    let currentMode = mode;
    const form = qs('#authForm', mask);
    const errEl = qs('#authError', mask);
    const nickField = qs('#nicknameField', mask);
    const submitBtn = qs('#authSubmit', mask);
    const switchMode = (m) => {
      currentMode = m;
      qsa('[data-mode]', mask).forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
      qs('.modal-head h3', mask).textContent = m === 'login' ? '欢迎回来' : '加入 CineMax';
      qs('.modal-head p', mask).textContent = m === 'login' ? '登录后可选座购票、管理订单' : '注册即可享受在线选座与会员权益';
      nickField.style.display = m === 'register' ? '' : 'none';
      submitBtn.textContent = m === 'login' ? '登 录' : '注册并登录';
      errEl.textContent = '';
      form.password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    };
    qsa('[data-mode]', mask).forEach((b) => b.addEventListener('click', () => switchMode(b.dataset.mode)));
    switchMode(mode);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.textContent = '';
      const username = form.username.value.trim();
      const password = form.password.value;
      const nickname = form.nickname?.value.trim();
      if (!username || !password) { errEl.textContent = '请填写用户名和密码'; return; }
      if (currentMode === 'register' && password.length < 6) { errEl.textContent = '密码长度不能少于 6 位'; return; }
      submitBtn.disabled = true;
      submitBtn.textContent = '请稍候…';
      try {
        const data = currentMode === 'login'
          ? await window.API.login({ username, password })
          : await window.API.register({ username, password, nickname });
        window.Auth.setSession(data.token, data.user);
        closeModal(mask);
        refreshHeader();
        toast(currentMode === 'login' ? `欢迎回来，${data.user.nickname}` : '注册成功，欢迎加入 CineMax');
        if (data.user.role === 'admin' && currentMode === 'login') {
          toast('管理员身份已生效，可进入管理后台', 'info');
        }
      } catch (err) {
        errEl.textContent = err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = currentMode === 'login' ? '登 录' : '注册并登录';
      }
    });

    setTimeout(() => qs('#authUsername', mask)?.focus(), 240);
  }

  /* 登录 / 退出后自动刷新页头用户区 */
  window.addEventListener('auth:changed', () => {
    if (qs('#headerRoot')) refreshHeader(activeNavKey);
  });

  function requireLogin(message = '该操作需要登录，先登录一下吧') {
    if (window.Auth.isLoggedIn) return true;
    toast(message, 'info');
    openAuthModal('login');
    return false;
  }

  /* ------------------------------ 影片卡片 ------------------------------ */
  function stars(score10, { showValue = false } = {}) {
    const score = Number(score10) || 0;
    const percent = Math.max(0, Math.min(100, (score / 10) * 100));
    const row = '★★★★★';
    return `<span class="stars-wrap" title="${score} 分">
      <span class="stars"><span class="stars-bg">${row}</span><span class="stars-fill" style="width:${percent}%">${row}</span></span>
      ${showValue ? `<b class="stars-value">${score ? score.toFixed(1) : '暂无'}</b>` : ''}
    </span>`;
  }

  function movieCard(m, { compact = false } = {}) {
    const statusBadge = m.status === 'upcoming'
      ? '<span class="card-flag card-flag-upcoming">即将上映</span>'
      : (m.isHot ? '<span class="card-flag">热映</span>' : '');
    const rating = Number(m.rating) > 0
      ? `<span class="card-rating">${icon('star')}${Number(m.rating).toFixed(1)}</span>` : '';
    return `
      <article class="movie-card ${compact ? 'compact' : ''}" data-id="${m.id}">
        <a class="poster-wrap" href="/movie.html?id=${m.id}" aria-label="${escapeHtml(m.title)}">
          <img src="${escapeHtml(m.poster)}" alt="${escapeHtml(m.title)} 海报" loading="lazy">
          <div class="poster-shade"></div>
          ${statusBadge}
          ${rating}
          <div class="card-hover">
            <span class="btn btn-primary btn-sm">${m.status === 'upcoming' ? '查看详情' : '立即购票'}</span>
          </div>
        </a>
        <button class="fav-btn ${m.isFavorite ? 'active' : ''}" data-fav="${m.id}" title="${m.isFavorite ? '取消收藏' : '加入想看'}" aria-label="收藏">
          ${m.isFavorite ? icon('heartFill') : icon('heart')}
        </button>
        <div class="card-info">
          <h3><a href="/movie.html?id=${m.id}">${escapeHtml(m.title)}</a></h3>
          <p>${escapeHtml((m.genre || '').split(',').join(' / '))}${m.duration ? ` · ${m.duration}分钟` : ''}</p>
        </div>
      </article>`;
  }

  function bindFavButtons(root = document, onChanged) {
    qsa('[data-fav]', root).forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!requireLogin('登录后即可收藏想看的影片')) return;
        const id = btn.dataset.fav;
        const active = btn.classList.contains('active');
        btn.disabled = true;
        try {
          if (active) {
            await window.API.removeFavorite(id);
            btn.classList.remove('active');
            btn.innerHTML = icon('heart');
            toast('已从想看片单移除', 'info');
          } else {
            await window.API.addFavorite(id);
            btn.classList.add('active');
            btn.innerHTML = icon('heartFill');
            toast('已加入想看片单');
          }
          onChanged?.();
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  /* ------------------------------ 页脚 ------------------------------ */
  function mountFooter() {
    const slot = qs('#footerRoot');
    if (!slot) return;
    slot.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <a class="logo" href="/index.html" style="font-size:18px">
                <svg viewBox="0 0 64 64" style="width:30px;height:30px">
                  <rect width="64" height="64" rx="16" fill="rgba(255,255,255,.06)"/>
                  <path d="M16 20h32a4 4 0 0 1 4 4v6a6 6 0 0 0 0 12v6a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4v-6a6 6 0 0 0 0-12v-6a4 4 0 0 1 4-4z" fill="url(#lg)"/>
                  <path d="M27 25v14l11-7z" fill="#0b0d12"/>
                </svg>
                <span>CINE<em>MAX</em><small>MOVIE TICKETS</small></span>
              </a>
              <p>选好片，选好座，把两个小时交给银幕。<br>CineMax 在线电影购票系统 · Web 程序设计课程项目</p>
            </div>
            <div class="footer-col">
              <h4>观影服务</h4>
              <a href="/index.html#now">正在热映</a>
              <a href="/index.html#upcoming">即将上映</a>
              <a href="/orders.html">我的票夹</a>
              <a href="/index.html#favorites">我的收藏</a>
            </div>
            <div class="footer-col">
              <h4>关于我们</h4>
              <a href="/index.html">影城介绍</a>
              <a href="/index.html">会员权益</a>
              <a href="/index.html">企业包场</a>
              <a href="/admin.html">影院管理</a>
            </div>
            <div class="footer-col">
              <h4>联系客服</h4>
              <span>客服热线：400-888-6688</span>
              <span>服务时间：09:00 - 23:00</span>
              <span>support@cinemax.demo</span>
              <span>北京 · 上海 · 杭州</span>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© 2026 CineMax 在线电影购票系统 · 仅用于课程教学演示</span>
            <span>HTML5 · CSS3 · 原生 JavaScript · Node.js · Express · SQLite</span>
          </div>
        </div>
      </footer>`;
  }

  /* ------------------------------ 倒计时与提醒 ------------------------------ */
  function parseLocal(str) {
    return new Date(String(str).replace(' ', 'T'));
  }

  function formatDiff(ms) {
    if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, text: '已开场' };
    const t = Math.floor(ms / 1000);
    const d = Math.floor(t / 86400);
    const h = Math.floor((t % 86400) / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return { d, h, m, s, text: `${d > 0 ? `${d}天 ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` };
  }

  /** 启动一个倒计时，返回停止函数 */
  function countdown(targetStr, onTick, interval = 1000) {
    const target = parseLocal(targetStr).getTime();
    const tick = () => {
      const diff = target - Date.now();
      onTick(formatDiff(diff), diff);
      if (diff <= 0) clearInterval(timer);
    };
    tick();
    const timer = setInterval(tick, interval);
    return () => clearInterval(timer);
  }

  /** 开场提醒（Notification API，10 分钟内触发一次） */
  function scheduleReminders(orders) {
    if (!('Notification' in window)) return;
    const check = () => {
      if (Notification.permission !== 'granted') return;
      orders.forEach((o) => {
        if (!['paid', 'changed'].includes(o.status)) return;
        const diff = parseLocal(o.startTime).getTime() - Date.now();
        const key = `cm.reminded.${o.id}`;
        if (diff > 0 && diff <= 10 * 60000 && !localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          new Notification('CineMax 开场提醒', {
            body: `《${o.title}》将在 ${Math.max(1, Math.round(diff / 60000))} 分钟后开场\n${o.cinemaName} ${o.hallName}`,
            icon: '/assets/favicon.svg',
          });
        }
      });
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }

  function requestNotifyPermission() {
    if (!('Notification' in window)) {
      toast('当前浏览器不支持桌面通知', 'error');
      return;
    }
    if (Notification.permission === 'granted') {
      toast('开场提醒已开启，将在开场前 10 分钟通知你', 'info');
      return;
    }
    Notification.requestPermission().then((p) => {
      if (p === 'granted') toast('开场提醒已开启');
      else toast('未获得通知权限，可在浏览器设置中开启', 'error');
    });
  }

  window.UI = {
    icon, toast, openModal, closeModal, confirm: confirmDialog,
    mountHeader, refreshHeader, mountFooter, openAuthModal, requireLogin,
    stars, movieCard, bindFavButtons, countdown, scheduleReminders, requestNotifyPermission,
    parseLocal, formatDiff,
  };
})();
