/* ============================================================
   CineMax 管理后台：看板 / 电影 / 影院影厅 / 场次 / 订单 / 评论 / 轮播
   ============================================================ */
(() => {
  const { qs, qsa, escapeHtml, money, dateCN, debounce } = window.Utils;
  const { toast, icon, openModal, closeModal, confirm } = window.UI;

  const NAV = [
    { key: 'dashboard', label: '数据看板', icon: 'chart' },
    { key: 'movies', label: '电影管理', icon: 'film' },
    { key: 'cinemas', label: '影院影厅', icon: 'pin' },
    { key: 'showtimes', label: '场次管理', icon: 'clock' },
    { key: 'orders', label: '订单管理', icon: 'ticket' },
    { key: 'comments', label: '评论管理', icon: 'star' },
    { key: 'banners', label: '轮播广告', icon: 'play' },
  ];
  const TITLE = {
    dashboard: { title: '数据看板', sub: '票房趋势、上座率与最新订单实时概览' },
    movies: { title: '电影管理', sub: '影片信息、海报、演职人员与上映状态维护' },
    cinemas: { title: '影院与影厅', sub: '影院门店、影厅规模与座位布局管理' },
    showtimes: { title: '场次管理', sub: '排片计划、票价与影厅时段维护' },
    orders: { title: '订单管理', sub: '全站订单查询、状态跟踪与人工退款' },
    comments: { title: '评论管理', sub: '用户评分与影评内容审核' },
    banners: { title: '轮播广告', sub: '首页轮播位图片、文案与排序配置' },
  };
  const MOVIE_STATUS = { showing: ['green', '热映中'], upcoming: ['amber', '即将上映'], offline: ['gray', '已下线'] };
  const ORDER_STATUS = {
    unpaid: ['amber', '待支付'], paid: ['green', '已支付'], changed: ['cyan', '已改签'],
    refunded: ['gray', '已退款'], cancelled: ['gray', '已取消'],
  };
  const POSTERS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `/assets/posters/p${i}.svg`);
  const BACKDROPS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `/assets/backdrops/bd${i}.svg`);
  const BANNERS = [1, 2, 3].map((i) => `/assets/banners/bn${i}.svg`);

  const state = {
    view: 'dashboard',
    movies: [],
    cinemas: [],
    hallsByCinema: {},
    showtimes: [],
    orders: [],
    comments: [],
    banners: [],
    orderFilter: { page: 1, status: '', keyword: '' },
    commentFilter: { page: 1, keyword: '' },
    showtimeFilter: { date: '', movieId: '', cinemaId: '' },
    refMovies: null,
    refCinemas: null,
    redraw: null,
  };

  /* ------------------------------ 启动 ------------------------------ */
  boot();
  window.addEventListener('auth:changed', boot);
  window.addEventListener('resize', debounce(() => state.redraw?.(), 220));

  function boot() {
    if (!window.Auth.isLoggedIn) {
      renderGate('请先登录管理员账号，才能进入影院管理后台。');
      return;
    }
    if (!window.Auth.isAdmin) {
      renderGate('当前账号不是影院管理员，请使用管理员账号登录。');
      return;
    }
    renderShell();
    setView(currentKey());
  }

  function currentKey() {
    const key = (location.hash || '').replace('#', '');
    return TITLE[key] ? key : 'dashboard';
  }

  function renderGate(message) {
    qs('#adminRoot').innerHTML = `
      <div class="admin-gate">
        <div class="gate-card">
          ${icon('chart')}
          <h1>CineMax 影院管理后台</h1>
          <p>${escapeHtml(message)}</p>
          <button class="btn btn-primary btn-lg" id="gateLogin">管理员登录</button>
          <p class="tip">演示管理员账号：<b>admin</b> / admin123</p>
          <p class="tip"><a href="/index.html" style="color:var(--muted)">← 返回前台首页</a></p>
        </div>
      </div>`;
    qs('#gateLogin').addEventListener('click', () => window.UI.openAuthModal('login'));
  }

  function renderShell() {
    const user = window.Auth.user;
    qs('#adminRoot').innerHTML = `
      <div class="admin-shell">
        <aside class="admin-side">
          <a class="admin-logo" href="/index.html">
            <svg viewBox="0 0 64 64">
              <defs><linearGradient id="alg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3d5e"/><stop offset="1" stop-color="#ffb347"/></linearGradient></defs>
              <rect width="64" height="64" rx="16" fill="rgba(255,255,255,.06)"/>
              <path d="M16 20h32a4 4 0 0 1 4 4v6a6 6 0 0 0 0 12v6a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4v-6a6 6 0 0 0 0-12v-6a4 4 0 0 1 4-4z" fill="url(#alg)"/>
              <path d="M27 25v14l11-7z" fill="#0b0d12"/>
            </svg>
            <span><b>CINE<em>MAX</em></b><small>ADMIN CONSOLE</small></span>
          </a>
          <nav class="admin-nav" id="adminNav">
            ${NAV.map((n) => `<a href="#${n.key}" data-view="${n.key}">${icon(n.icon)}${n.label}</a>`).join('')}
          </nav>
          <div class="admin-side-foot">
            <a href="/index.html">${icon('chevron')}返回前台</a>
            <button id="adminLogout">${icon('logout')}退出登录</button>
          </div>
        </aside>
        <main class="admin-main">
          <header class="admin-topbar">
            <div><h1 id="viewTitle">数据看板</h1><p id="viewSub"></p></div>
            <div class="admin-user">
              <span class="avatar">${escapeHtml(user.nickname?.slice(0, 1) || 'A')}</span>
              <div><b>${escapeHtml(user.nickname || user.username)}</b><span>影院管理员</span></div>
            </div>
          </header>
          <section id="viewRoot"></section>
        </main>
      </div>`;

    qs('#adminNav').addEventListener('click', (e) => {
      const link = e.target.closest('[data-view]');
      if (!link) return;
      e.preventDefault();
      setView(link.dataset.view);
    });
    qs('#adminLogout').addEventListener('click', () => {
      window.Auth.logout();
      toast('已退出登录', 'info');
    });
  }

  function setView(key) {
    state.view = key;
    qsa('#adminNav [data-view]').forEach((a) => a.classList.toggle('active', a.dataset.view === key));
    qs('#viewTitle').textContent = TITLE[key].title;
    qs('#viewSub').textContent = TITLE[key].sub;
    if (location.hash !== `#${key}`) history.replaceState(null, '', `#${key}`);
    state.redraw = null;
    loadView(key);
  }

  function loadView(key) {
    const fn = {
      dashboard: loadDashboard,
      movies: loadMovies,
      cinemas: loadCinemas,
      showtimes: loadShowtimes,
      orders: loadOrders,
      comments: loadComments,
      banners: loadBanners,
    }[key];
    Promise.resolve(fn && fn()).catch((err) => {
      qs('#viewRoot').innerHTML = `<div class="panel"><div class="empty"><h3>加载失败</h3><p>${escapeHtml(err.message)}</p></div></div>`;
    });
  }

  const skeleton = (h = 160) => `<div class="panel"><div class="skeleton" style="height:${h}px"></div></div>`;
  const emptyBox = (title, text) => `<div class="empty"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text || '')}</p></div>`;

  /* ============================================================
     数据看板
     ============================================================ */
  async function loadDashboard() {
    const root = qs('#viewRoot');
    root.innerHTML = `<div class="kpi-grid">${'<div class="kpi"><div class="skeleton" style="height:56px"></div></div>'.repeat(4)}</div>`;
    const s = await window.API.adminStats();

    root.innerHTML = `
      <div class="kpi-grid">
        ${kpi('今日票房', money(s.summary.todayRevenue), `今日成交 ${s.summary.todayOrders} 笔`)}
        ${kpi('累计票房', money(s.summary.totalRevenue), `累计 ${s.summary.totalOrders} 笔已支付订单`)}
        ${kpi('注册用户', s.summary.userCount, `在映影片 ${s.summary.movieCount} 部 · 影评 ${s.summary.commentsCount} 条`)}
        ${kpi('今日上座率', `${s.summary.occupancy}%`, `售出 ${s.summary.soldToday} / ${s.summary.capacityToday} 座`)}
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-head"><div><h3>近 14 天票房趋势</h3><p>按支付时间统计 · 单位：元</p></div></div>
          <div class="chart-box"><canvas id="trendChart"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>影院票房占比</h3><p>累计已支付订单</p></div></div>
          <div class="chart-box"><canvas id="cinemaChart"></canvas></div>
          <div class="donut-legend" id="cinemaLegend"></div>
        </div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-head"><div><h3>影片票房 TOP 6</h3><p>点击影片管理维护信息</p></div><a class="btn btn-ghost btn-sm" href="#movies">影片管理</a></div>
          <div class="chart-box sm"><canvas id="topChart"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h3>最新订单</h3><p>全站实时成交记录</p></div><a class="btn btn-ghost btn-sm" href="#orders">订单管理</a></div>
          <div class="tbl-wrap">
            <table class="tbl" style="min-width:0">
              <tbody>
                ${s.recentOrders.map((o) => `
                  <tr>
                    <td>
                      <div style="font-weight:600">${escapeHtml(o.title)}</div>
                      <div class="sub">${escapeHtml(o.nickname)} · ${escapeHtml(o.orderNo)}</div>
                    </td>
                    <td class="num" style="text-align:right">${money(o.totalAmount)}</td>
                    <td style="text-align:right"><span class="badge ${ORDER_STATUS[o.status][0]}">${ORDER_STATUS[o.status][1]}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    const trend = s.revenueTrend;
    const cinema = s.cinemaShare;
    const top = s.topMovies;
    const totalCinema = cinema.reduce((sum, c) => sum + Number(c.revenue), 0) || 1;
    const colors = ['#ff3d5e', '#ffb347', '#5ad7ff', '#38d39f', '#a78bfa', '#ff7a9c'];

    qs('#cinemaLegend').innerHTML = cinema.map((c, i) => `
      <span><i style="background:${colors[i % colors.length]}"></i>${escapeHtml(c.name)}
        <b>${(Number(c.revenue) / totalCinema * 100).toFixed(1)}%</b></span>`).join('');

    const render = () => {
      drawTrend(qs('#trendChart'), trend, 1);
      drawDonut(qs('#cinemaChart'), cinema, colors, 1);
      drawBars(qs('#topChart'), top, 1);
    };
    render();
    state.redraw = render;
    animate(900, (p) => {
      drawTrend(qs('#trendChart'), trend, p);
      drawDonut(qs('#cinemaChart'), cinema, colors, p);
      drawBars(qs('#topChart'), top, p);
    });
  }

  function kpi(label, value, note) {
    return `<div class="kpi"><span>${escapeHtml(label)}</span><b>${value}</b><i>${escapeHtml(note)}</i></div>`;
  }

  /* ------------------------------ Canvas 图表 ------------------------------ */
  function ctx2d(canvas) {
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  function animate(duration, draw) {
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      draw(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function niceCeil(v) {
    if (v <= 10) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * p;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, h / 2, Math.max(0, w / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawTrend(canvas, data, progress) {
    const c = ctx2d(canvas);
    if (!c) return;
    const { ctx, w, h } = c;
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 52, r: 12, t: 16, b: 24 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const max = Math.max(...data.map((d) => Number(d.revenue)), 1);
    const niceMax = niceCeil(max);
    const x = (i) => pad.l + (iw / Math.max(1, data.length - 1)) * i;
    const y = (v) => pad.t + ih - (Number(v) / niceMax) * ih;

    ctx.lineWidth = 1;
    ctx.font = '10px Inter, "PingFang SC", sans-serif';
    for (let i = 0; i <= 4; i++) {
      const gy = pad.t + (ih / 4) * i;
      ctx.strokeStyle = i === 4 ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.06)';
      ctx.beginPath();
      ctx.moveTo(pad.l, gy);
      ctx.lineTo(w - pad.r, gy);
      ctx.stroke();
      ctx.fillStyle = '#6b7386';
      ctx.textAlign = 'right';
      const val = niceMax * (1 - i / 4);
      ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(Math.round(val)), pad.l - 8, gy + 3.5);
    }

    if (!data.length) return;
    const count = Math.max(2, Math.min(data.length, Math.ceil((data.length - 1) * progress) + 1));

    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ih);
    grad.addColorStop(0, 'rgba(255,61,94,.38)');
    grad.addColorStop(1, 'rgba(255,61,94,0)');
    ctx.beginPath();
    ctx.moveTo(x(0), y(data[0].revenue));
    for (let i = 1; i < count; i++) ctx.lineTo(x(i), y(data[i].revenue));
    ctx.lineTo(x(count - 1), pad.t + ih);
    ctx.lineTo(x(0), pad.t + ih);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      if (i === 0) ctx.moveTo(x(i), y(data[i].revenue));
      else ctx.lineTo(x(i), y(data[i].revenue));
    }
    ctx.strokeStyle = '#ff3d5e';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.arc(x(i), y(data[i].revenue), i === count - 1 ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fillStyle = i === count - 1 ? '#ffb347' : '#ff5c78';
      ctx.fill();
      if (i === count - 1) {
        ctx.strokeStyle = 'rgba(255,179,71,.35)';
        ctx.lineWidth = 6;
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#6b7386';
    ctx.font = '10px Inter, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      if (i % 2 === 0 || i === data.length - 1) ctx.fillText(d.date, x(i), h - 7);
    });
  }

  function drawDonut(canvas, data, colors, progress) {
    const c = ctx2d(canvas);
    if (!c) return;
    const { ctx, w, h } = c;
    ctx.clearRect(0, 0, w, h);
    const total = data.reduce((s, d) => s + Number(d.revenue), 0) || 1;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(40, Math.min(w, h) / 2 - 12);
    const inner = r * 0.63;
    let start = -Math.PI / 2;

    data.forEach((d, i) => {
      const angle = (Number(d.revenue) / total) * Math.PI * 2 * progress;
      if (angle <= 0.0001) return;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.arc(cx, cy, inner, start + angle, start, true);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      start += angle;
    });

    ctx.fillStyle = '#f3f5f9';
    ctx.textAlign = 'center';
    ctx.font = '800 17px Inter, "PingFang SC", sans-serif';
    ctx.fillText(money(total), cx, cy + 2);
    ctx.fillStyle = '#6b7386';
    ctx.font = '10.5px Inter, "PingFang SC", sans-serif';
    ctx.fillText('累计票房', cx, cy + 19);
  }

  function drawBars(canvas, data, progress) {
    const c = ctx2d(canvas);
    if (!c) return;
    const { ctx, w, h } = c;
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(...data.map((d) => Number(d.revenue)), 1);
    const rowH = h / data.length;
    const labelW = Math.min(96, w * 0.28);
    const barH = Math.max(10, rowH * 0.4);

    data.forEach((d, i) => {
      const cy = i * rowH + rowH / 2;
      const top = cy - barH / 2;
      const title = d.title.length > 8 ? `${d.title.slice(0, 8)}…` : d.title;

      ctx.fillStyle = '#98a0b3';
      ctx.font = '11.5px Inter, "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(title, 0, cy + 4);

      const trackX = labelW + 6;
      const trackW = w - trackX - 58;
      ctx.fillStyle = 'rgba(255,255,255,.055)';
      roundRect(ctx, trackX, top, trackW, barH, barH / 2);
      ctx.fill();

      const bw = Math.max(3, (Number(d.revenue) / max) * trackW * progress);
      const grad = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
      grad.addColorStop(0, '#ff3d5e');
      grad.addColorStop(1, '#ffb347');
      ctx.fillStyle = grad;
      roundRect(ctx, trackX, top, bw, barH, barH / 2);
      ctx.fill();

      ctx.fillStyle = '#f3f5f9';
      ctx.font = '600 11px Inter, "PingFang SC", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(money(d.revenue), w, cy + 4);
    });
  }

  /* ============================================================
     电影管理
     ============================================================ */
  async function loadMovies() {
    const root = qs('#viewRoot');
    root.innerHTML = skeleton(220);
    const data = await window.API.movies({ pageSize: 50, sort: 'hot' });
    state.movies = data.list;

    root.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <div class="search-inline">${icon('search')}<input id="movieSearch" placeholder="搜索片名 / 导演 / 类型"></div>
          <span class="text-muted" style="font-size:12px">共 ${data.total} 部影片</span>
          <div class="spacer"></div>
          <button class="btn btn-primary btn-sm" id="addMovie">+ 新增影片</button>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>影片</th><th>类型</th><th>时长</th><th>上映日期</th><th>状态</th><th>评分</th><th>票房</th><th>操作</th></tr></thead>
          <tbody id="movieRows"></tbody>
        </table></div>
      </div>`;

    renderMovieRows(state.movies);
    qs('#addMovie').addEventListener('click', () => movieForm(null));
    qs('#movieSearch').addEventListener('input', debounce((e) => {
      const kw = e.target.value.trim().toLowerCase();
      renderMovieRows(state.movies.filter((m) => [m.title, m.director, m.genre, m.originalTitle]
        .some((v) => String(v || '').toLowerCase().includes(kw))));
    }, 180));

    qs('#movieRows').addEventListener('click', onMovieAction);
  }

  function renderMovieRows(list) {
    const body = qs('#movieRows');
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="8">${emptyBox('没有匹配的影片', '换个关键词试试')}</td></tr>`;
      return;
    }
    body.innerHTML = list.map((m) => {
      const st = MOVIE_STATUS[m.status] || ['gray', m.status];
      return `<tr>
        <td>
          <div class="cell-main">
            <img class="thumb" src="${escapeHtml(m.poster)}" alt="">
            <div>
              <div style="font-weight:600">${escapeHtml(m.title)}</div>
              <div class="sub">${escapeHtml(m.originalTitle || '')}${m.originalTitle ? ' · ' : ''}导演 ${escapeHtml(m.director || '—')}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml((m.genre || '').split(',').filter(Boolean).join(' / '))}</td>
        <td class="num">${m.duration} 分钟</td>
        <td>${escapeHtml(m.releaseDate || '—')}</td>
        <td><span class="badge ${st[0]}">${st[1]}</span></td>
        <td class="num">${Number(m.rating) > 0 ? Number(m.rating).toFixed(1) : '—'}</td>
        <td class="num">${money(m.boxOffice)}</td>
        <td><div class="ops">
          <button class="btn btn-ghost btn-sm" data-edit="${m.id}">编辑</button>
          <button class="btn btn-outline btn-sm" data-del="${m.id}">删除</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  async function onMovieAction(e) {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-del]');
    if (editBtn) {
      movieForm(state.movies.find((m) => m.id === Number(editBtn.dataset.edit)));
    } else if (delBtn) {
      const m = state.movies.find((x) => x.id === Number(delBtn.dataset.del));
      if (!m) return;
      const yes = await confirm({
        title: '删除影片',
        message: `确定删除《${m.title}》吗？已产生订单的影片只能改为「已下线」。`,
        okText: '删除',
      });
      if (!yes) return;
      try {
        await window.API.deleteMovie(m.id);
        toast('影片已删除');
        loadMovies();
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  }

  function movieForm(movie) {
    const m = movie || {};
    const mask = openModal(`
      <div class="modal-head">
        <div><h3>${movie ? '编辑影片' : '新增影片'}</h3><p>海报与背景图支持演示素材快速选择</p></div>
        <button class="modal-close" data-close>${icon('close')}</button>
      </div>
      <form id="movieForm">
        <div class="form-grid">
          <div class="field"><label>影片名称 *</label><input class="input" name="title" value="${escapeHtml(m.title || '')}" placeholder="如：星际回声"></div>
          <div class="field"><label>外文片名</label><input class="input" name="originalTitle" value="${escapeHtml(m.originalTitle || '')}"></div>
          <div class="field"><label>导演</label><input class="input" name="director" value="${escapeHtml(m.director || '')}"></div>
          <div class="field"><label>类型（逗号分隔）</label><input class="input" name="genre" value="${escapeHtml(m.genre || '')}" placeholder="剧情,科幻"></div>
          <div class="field"><label>语言</label><input class="input" name="language" value="${escapeHtml(m.language || '国语')}"></div>
          <div class="field"><label>片长（分钟）*</label><input class="input" type="number" min="1" name="duration" value="${m.duration || 120}"></div>
          <div class="field"><label>上映日期</label><input class="input" type="date" name="releaseDate" value="${escapeHtml(m.releaseDate || '')}"></div>
          <div class="field"><label>上映状态</label><select class="select" name="status">
            ${['showing', 'upcoming', 'offline'].map((s) => `<option value="${s}" ${m.status === s ? 'selected' : ''}>${MOVIE_STATUS[s][1]}</option>`).join('')}
          </select></div>
          <div class="field full"><label>海报地址</label>
            <input class="input" name="poster" value="${escapeHtml(m.poster || POSTERS[0])}">
            <div class="poster-picks">${POSTERS.map((p, i) => `<button type="button" class="poster-pick ${((m.poster || POSTERS[0]) === p) ? 'active' : ''}" data-poster="${p}"><img src="${p}" alt="海报${i + 1}"></button>`).join('')}</div>
          </div>
          <div class="field full"><label>背景剧照</label>
            <input class="input" name="backdrop" value="${escapeHtml(m.backdrop || BACKDROPS[0])}">
            <div class="poster-picks">${BACKDROPS.map((p, i) => `<button type="button" class="poster-pick ${((m.backdrop || BACKDROPS[0]) === p) ? 'active' : ''}" data-backdrop="${p}"><img src="${p}" alt="背景${i + 1}"></button>`).join('')}</div>
          </div>
          <div class="field full"><label>预告片地址</label><input class="input" name="trailerUrl" value="${escapeHtml(m.trailerUrl || '')}" placeholder="留空则使用内置演示预告"></div>
          <div class="field full"><label>剧情简介</label><textarea class="input" name="synopsis">${escapeHtml(m.synopsis || '')}</textarea></div>
          <div class="field full"><label>演职人员</label><div id="castRows"></div>
            <button type="button" class="btn btn-ghost btn-sm" id="addCast">+ 添加演职人员</button>
            <p style="font-size:11px;color:var(--muted-2);margin-top:8px">编辑影片时会整体覆盖演职人员列表</p>
          </div>
          <div class="field full">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0">
              <input type="checkbox" name="isHot" ${m.isHot ? 'checked' : ''}> 标记为首页热映推荐
            </label>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-outline" data-close>取消</button>
          <button type="submit" class="btn btn-primary">${movie ? '保存修改' : '创建影片'}</button>
        </div>
      </form>`, { size: 'modal-lg' });

    const castBox = qs('#castRows', mask);
    (m.cast || []).forEach((c) => addCastRow(castBox, c));
    if (!(m.cast || []).length) addCastRow(castBox);
    qs('#addCast', mask).addEventListener('click', () => addCastRow(castBox));
    qsa('[data-poster]', mask).forEach((b) => b.addEventListener('click', () => {
      qs('[name="poster"]', mask).value = b.dataset.poster;
      qsa('[data-poster]', mask).forEach((x) => x.classList.toggle('active', x === b));
    }));
    qsa('[data-backdrop]', mask).forEach((b) => b.addEventListener('click', () => {
      qs('[name="backdrop"]', mask).value = b.dataset.backdrop;
      qsa('[data-backdrop]', mask).forEach((x) => x.classList.toggle('active', x === b));
    }));

    const form = qs('#movieForm', mask);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: form.title.value.trim(),
        originalTitle: form.originalTitle.value.trim(),
        director: form.director.value.trim(),
        genre: form.genre.value.trim(),
        language: form.language.value.trim(),
        duration: Number(form.duration.value),
        releaseDate: form.releaseDate.value,
        status: form.status.value,
        poster: form.poster.value.trim(),
        backdrop: form.backdrop.value.trim(),
        trailerUrl: form.trailerUrl.value.trim(),
        synopsis: form.synopsis.value.trim(),
        isHot: form.isHot.checked,
        cast: qsa('.cast-row', castBox).map((row) => ({
          name: qs('[data-cast-name]', row).value.trim(),
          roleName: qs('[data-cast-role]', row).value.trim(),
        })).filter((c) => c.name),
      };
      if (!payload.title) { toast('请填写影片名称', 'error'); return; }
      if (!(payload.duration > 0)) { toast('片长必须大于 0', 'error'); return; }
      const btn = qs('[type="submit"]', form);
      btn.disabled = true;
      try {
        if (movie) await window.API.updateMovie(movie.id, payload);
        else await window.API.createMovie(payload);
        closeModal(mask);
        toast(movie ? '影片信息已更新' : '影片已创建');
        state.refMovies = null;
        loadMovies();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
      }
    });
  }

  function addCastRow(container, cast = {}) {
    const row = document.createElement('div');
    row.className = 'cast-row';
    row.innerHTML = `
      <input class="input" data-cast-name placeholder="演员姓名" value="${escapeHtml(cast.name || '')}">
      <input class="input" data-cast-role placeholder="饰演角色" value="${escapeHtml(cast.roleName || '')}">
      <button type="button" class="icon-del" aria-label="删除">×</button>`;
    row.querySelector('.icon-del').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  /* ============================================================
     影院 / 影厅
     ============================================================ */
  async function loadCinemas() {
    const root = qs('#viewRoot');
    root.innerHTML = skeleton(200);
    const cinemas = await window.API.cinemas();
    state.cinemas = cinemas;
    state.refCinemas = cinemas;
    const hallsList = await Promise.all(cinemas.map((c) => window.API.halls(c.id)));
    cinemas.forEach((c, i) => { state.hallsByCinema[c.id] = hallsList[i]; });

    root.innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="toolbar" style="margin:0">
          <div><h3 style="font-size:15px">影院门店</h3><p style="font-size:11.5px;color:var(--muted-2)">共 ${cinemas.length} 家影院 · ${Object.values(state.hallsByCinema).flat().length} 个影厅</p></div>
          <div class="spacer"></div>
          <button class="btn btn-primary btn-sm" id="addCinema">+ 新增影院</button>
        </div>
      </div>
      <div class="cinema-grid" id="cinemaGrid">
        ${cinemas.map(cinemaCard).join('')}
      </div>`;

    qs('#addCinema').addEventListener('click', () => cinemaForm(null));
    qs('#cinemaGrid').addEventListener('click', onCinemaAction);
  }

  function cinemaCard(c) {
    const halls = state.hallsByCinema[c.id] || [];
    return `<div class="panel cinema-card" data-cinema="${c.id}">
      <div class="cinema-card-head">
        <div>
          <h3>${escapeHtml(c.name)}</h3>
          <p>${escapeHtml(c.district || '')} · ${escapeHtml(c.address)}　${c.phone ? `电话 ${escapeHtml(c.phone)}` : ''}</p>
          <p style="margin-top:6px">${(c.facilities || '').split(',').filter(Boolean).map((f) => `<span class="badge gray" style="margin-right:6px">${escapeHtml(f)}</span>`).join('')}</p>
        </div>
        <div class="ops" style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" data-add-hall="${c.id}">+ 新增影厅</button>
          <button class="btn btn-ghost btn-sm" data-edit-cinema="${c.id}">编辑</button>
          <button class="btn btn-outline btn-sm" data-del-cinema="${c.id}">删除</button>
        </div>
      </div>
      <div class="hall-list">
        ${halls.length ? halls.map((h) => `
          <div class="hall-item">
            <div class="hi-top"><b>${escapeHtml(h.name)}</b><span class="badge cyan">${escapeHtml(h.screenType || '普通厅')}</span></div>
            <p>${h.rows} 排 × ${h.cols} 列 · ${h.rows * h.cols} 座位</p>
            <div class="ops">
              <button class="btn btn-ghost btn-sm" data-edit-hall="${h.id}" data-cinema-id="${c.id}">编辑</button>
              <button class="btn btn-outline btn-sm" data-del-hall="${h.id}">删除</button>
            </div>
          </div>`).join('') : '<p class="hall-empty">暂无影厅，点击右上角「新增影厅」自动生成座位布局</p>'}
      </div>
    </div>`;
  }

  async function onCinemaAction(e) {
    const addHall = e.target.closest('[data-add-hall]');
    const editCinema = e.target.closest('[data-edit-cinema]');
    const delCinema = e.target.closest('[data-del-cinema]');
    const editHall = e.target.closest('[data-edit-hall]');
    const delHall = e.target.closest('[data-del-hall]');

    if (addHall) {
      cinemaHallForm(Number(addHall.dataset.addHall), null);
    } else if (editCinema) {
      cinemaForm(state.cinemas.find((c) => c.id === Number(editCinema.dataset.editCinema)));
    } else if (delCinema) {
      const c = state.cinemas.find((x) => x.id === Number(delCinema.dataset.delCinema));
      const yes = await confirm({ title: '删除影院', message: `确定删除「${c.name}」吗？已有订单的影院无法删除。`, okText: '删除' });
      if (!yes) return;
      try {
        await window.API.deleteCinema(c.id);
        toast('影院已删除');
        state.refCinemas = null;
        loadCinemas();
      } catch (err) { toast(err.message, 'error'); }
    } else if (editHall) {
      const cinemaId = Number(editHall.dataset.cinemaId);
      const hall = (state.hallsByCinema[cinemaId] || []).find((h) => h.id === Number(editHall.dataset.editHall));
      cinemaHallForm(cinemaId, hall);
    } else if (delHall) {
      const yes = await confirm({ title: '删除影厅', message: '确定删除该影厅吗？已有订单的影厅无法删除。', okText: '删除' });
      if (!yes) return;
      try {
        await window.API.deleteHall(delHall.dataset.delHall);
        toast('影厅已删除');
        state.refCinemas = null;
        loadCinemas();
      } catch (err) { toast(err.message, 'error'); }
    }
  }

  function cinemaForm(cinema) {
    const c = cinema || {};
    const mask = openModal(`
      <div class="modal-head">
        <div><h3>${cinema ? '编辑影院' : '新增影院'}</h3><p>填写门店基础信息与配套设施</p></div>
        <button class="modal-close" data-close>${icon('close')}</button>
      </div>
      <form id="cinemaForm">
        <div class="field"><label>影院名称 *</label><input class="input" name="name" value="${escapeHtml(c.name || '')}" placeholder="如：CineMax 星光影城"></div>
        <div class="form-grid">
          <div class="field"><label>所在商圈 / 区域</label><input class="input" name="district" value="${escapeHtml(c.district || '')}"></div>
          <div class="field"><label>联系电话</label><input class="input" name="phone" value="${escapeHtml(c.phone || '')}"></div>
        </div>
        <div class="field"><label>详细地址 *</label><input class="input" name="address" value="${escapeHtml(c.address || '')}"></div>
        <div class="field"><label>配套设施（逗号分隔）</label><input class="input" name="facilities" value="${escapeHtml(c.facilities || '')}" placeholder="IMAX,杜比全景声,免费停车"></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-outline" data-close>取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>`);

    qs('#cinemaForm', mask).addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const payload = {
        name: form.name.value.trim(),
        district: form.district.value.trim(),
        address: form.address.value.trim(),
        phone: form.phone.value.trim(),
        facilities: form.facilities.value.trim(),
      };
      if (!payload.name || !payload.address) { toast('影院名称与地址不能为空', 'error'); return; }
      try {
        if (cinema) await window.API.updateCinema(cinema.id, payload);
        else await window.API.createCinema(payload);
        closeModal(mask);
        toast(cinema ? '影院信息已更新' : '影院已创建');
        state.refCinemas = null;
        loadCinemas();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function cinemaHallForm(cinemaId, hall) {
    const h = hall || {};
    const mask = openModal(`
      <div class="modal-head">
        <div><h3>${hall ? '编辑影厅' : '新增影厅'}</h3><p>新建影厅会按排数 × 列数自动生成座位（含 VIP / 情侣座）</p></div>
        <button class="modal-close" data-close>${icon('close')}</button>
      </div>
      <form id="hallForm">
        <div class="field"><label>影厅名称 *</label><input class="input" name="name" value="${escapeHtml(h.name || '')}" placeholder="如：1 号 IMAX 厅"></div>
        <div class="form-grid">
          <div class="field"><label>排数（4-20）</label><input class="input" type="number" min="4" max="20" name="rows" value="${h.rows || 8}"></div>
          <div class="field"><label>每排座位数（6-24）</label><input class="input" type="number" min="6" max="24" name="cols" value="${h.cols || 12}"></div>
        </div>
        <div class="field"><label>影厅类型</label><select class="select" name="screenType">
          ${['普通厅', 'IMAX厅', '激光厅', '4DX厅', '情侣厅'].map((t) => `<option ${h.screenType === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select></div>
        ${hall ? '<p style="font-size:11.5px;color:var(--muted-2)">已售票的影厅无法调整座位规模，仅可修改名称与类型</p>' : ''}
        <div class="modal-foot">
          <button type="button" class="btn btn-outline" data-close>取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>`, { size: 'modal-lg' });

    qs('#hallForm', mask).addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const payload = {
        cinemaId,
        name: form.name.value.trim(),
        rows: Number(form.rows.value),
        cols: Number(form.cols.value),
        screenType: form.screenType.value,
      };
      if (!payload.name) { toast('影厅名称不能为空', 'error'); return; }
      try {
        if (hall) await window.API.updateHall(hall.id, payload);
        else await window.API.createHall(payload);
        closeModal(mask);
        toast(hall ? '影厅信息已更新' : '影厅已创建，座位布局已生成');
        loadCinemas();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ============================================================
     场次管理
     ============================================================ */
  async function loadShowtimes() {
    const root = qs('#viewRoot');
    root.innerHTML = skeleton(240);
    await Promise.all([ensureRefs(), refreshShowtimes()]);

    root.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <input class="input" type="date" id="stDate" style="width:auto;height:38px" value="${state.showtimeFilter.date}">
          <select class="select" id="stMovie" style="width:auto;height:38px">
            <option value="">全部影片</option>
            ${state.refMovies.map((m) => `<option value="${m.id}" ${Number(state.showtimeFilter.movieId) === m.id ? 'selected' : ''}>${escapeHtml(m.title)}</option>`).join('')}
          </select>
          <select class="select" id="stCinema" style="width:auto;height:38px">
            <option value="">全部影院</option>
            ${state.refCinemas.map((c) => `<option value="${c.id}" ${Number(state.showtimeFilter.cinemaId) === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
          <div class="spacer"></div>
          <button class="btn btn-primary btn-sm" id="addShowtime">+ 新增场次</button>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>开场时间</th><th>影片</th><th>影院 / 影厅</th><th>版本</th><th>票价</th><th>售出</th><th>操作</th></tr></thead>
          <tbody id="stRows"></tbody>
        </table></div>
      </div>`;

    renderShowtimeRows();
    qs('#addShowtime').addEventListener('click', () => showtimeForm(null));
    qs('#stDate').addEventListener('change', (e) => { state.showtimeFilter.date = e.target.value; refreshShowtimes().then(renderShowtimeRows); });
    qs('#stMovie').addEventListener('change', (e) => { state.showtimeFilter.movieId = e.target.value; refreshShowtimes().then(renderShowtimeRows); });
    qs('#stCinema').addEventListener('change', (e) => { state.showtimeFilter.cinemaId = e.target.value; refreshShowtimes().then(renderShowtimeRows); });

    qs('#stRows').addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-st]');
      const delBtn = e.target.closest('[data-del-st]');
      if (editBtn) {
        showtimeForm(state.showtimes.find((s) => s.id === Number(editBtn.dataset.editSt)));
      } else if (delBtn) {
        const st = state.showtimes.find((s) => s.id === Number(delBtn.dataset.delSt));
        const yes = await confirm({ title: '删除场次', message: `确定删除 ${st.startTime} 的《${st.title}》场次吗？已有支付订单的场次无法删除。`, okText: '删除' });
        if (!yes) return;
        try {
          await window.API.deleteShowtime(st.id);
          toast('场次已删除');
          await refreshShowtimes();
          renderShowtimeRows();
        } catch (err) { toast(err.message, 'error'); }
      }
    });
  }

  async function ensureRefs() {
    if (state.refMovies && state.refCinemas) return;
    const [mv, cs] = await Promise.all([
      window.API.movies({ pageSize: 50, sort: 'release' }),
      window.API.cinemas(),
    ]);
    state.refMovies = mv.list;
    state.refCinemas = cs;
  }

  async function refreshShowtimes() {
    const f = state.showtimeFilter;
    const params = {};
    if (f.date) params.date = f.date;
    if (f.movieId) params.movieId = f.movieId;
    if (f.cinemaId) params.cinemaId = f.cinemaId;
    state.showtimes = await window.API.adminShowtimes(params);
  }

  function renderShowtimeRows() {
    const body = qs('#stRows');
    if (!state.showtimes.length) {
      body.innerHTML = `<tr><td colspan="7">${emptyBox('没有符合条件的场次', '调整筛选条件或新增场次')}</td></tr>`;
      return;
    }
    body.innerHTML = state.showtimes.map((s) => {
      const d = dateCN(s.startTime);
      return `<tr>
        <td><div style="font-weight:600">${d.date} <span class="num">${d.time}</span></div><div class="sub">${d.week} · ${escapeHtml(s.startTime.slice(0, 10))}</div></td>
        <td>${escapeHtml(s.title)}</td>
        <td><div>${escapeHtml(s.cinemaName)}</div><div class="sub">${escapeHtml(s.hallName)} · ${escapeHtml(s.screenType || '')}</div></td>
        <td><span class="badge gray">${escapeHtml(s.version)}</span></td>
        <td class="num">${money(s.basePrice)}</td>
        <td class="num">${s.soldCount} / ${s.seatTotal}</td>
        <td><div class="ops">
          <button class="btn btn-ghost btn-sm" data-edit-st="${s.id}">编辑</button>
          <button class="btn btn-outline btn-sm" data-del-st="${s.id}">删除</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  async function showtimeForm(st) {
    await ensureRefs();
    const s = st || {};
    const mask = openModal(`
      <div class="modal-head">
        <div><h3>${st ? '编辑场次' : '新增场次'}</h3><p>同一影厅同一时间不能重复排片</p></div>
        <button class="modal-close" data-close>${icon('close')}</button>
      </div>
      <form id="stForm">
        <div class="form-grid">
          <div class="field"><label>影片 *</label><select class="select" name="movieId">
            ${state.refMovies.map((m) => `<option value="${m.id}" ${s.movieId === m.id ? 'selected' : ''}>${escapeHtml(m.title)}</option>`).join('')}
          </select></div>
          <div class="field"><label>影院 *</label><select class="select" name="cinemaId" id="stCinemaSel">
            ${state.refCinemas.map((c) => `<option value="${c.id}" ${s.cinemaId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select></div>
          <div class="field"><label>影厅 *</label><select class="select" name="hallId" id="stHallSel"></select></div>
          <div class="field"><label>开场时间 *</label><input class="input" type="datetime-local" name="startTime" value="${s.startTime ? s.startTime.replace(' ', 'T').slice(0, 16) : ''}"></div>
          <div class="field"><label>基础票价（元）*</label><input class="input" type="number" step="0.01" min="1" name="basePrice" value="${s.basePrice ?? 45}"></div>
          <div class="field"><label>版本</label><select class="select" name="version">
            ${['2D', '3D', 'IMAX', '4DX'].map((v) => `<option ${s.version === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select></div>
          <div class="field"><label>语言</label><select class="select" name="language">
            ${['国语', '英语', '日语', '粤语'].map((v) => `<option ${s.language === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select></div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-outline" data-close>取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>`, { size: 'modal-lg' });

    const cinemaSel = qs('#stCinemaSel', mask);
    const hallSel = qs('#stHallSel', mask);
    const fillHalls = async () => {
      const halls = await window.API.halls(cinemaSel.value);
      hallSel.innerHTML = halls.map((h) => `<option value="${h.id}" ${s.hallId === h.id ? 'selected' : ''}>${escapeHtml(h.name)}（${h.rows}×${h.cols}）</option>`).join('');
    };
    cinemaSel.addEventListener('change', fillHalls);
    await fillHalls();

    qs('#stForm', mask).addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const payload = {
        movieId: Number(form.movieId.value),
        cinemaId: Number(form.cinemaId.value),
        hallId: Number(form.hallId.value),
        startTime: form.startTime.value,
        basePrice: Number(form.basePrice.value),
        version: form.version.value,
        language: form.language.value,
      };
      if (!payload.startTime) { toast('请选择开场时间', 'error'); return; }
      try {
        if (st) await window.API.updateShowtime(st.id, payload);
        else await window.API.createShowtime(payload);
        closeModal(mask);
        toast(st ? '场次已更新' : '场次已创建');
        state.refCinemas = null;
        state.refMovies = null;
        await ensureRefs();
        await refreshShowtimes();
        renderShowtimeRows();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ============================================================
     订单管理
     ============================================================ */
  async function loadOrders() {
    const root = qs('#viewRoot');
    root.innerHTML = skeleton(260);
    const f = state.orderFilter;
    const data = await window.API.adminOrders({ page: f.page, pageSize: 10, status: f.status, keyword: f.keyword });
    state.orders = data.list;

    root.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <div class="search-inline">${icon('search')}<input id="orderSearch" placeholder="订单号 / 用户 / 影片" value="${escapeHtml(f.keyword)}"></div>
          <div class="seg" id="orderSeg">
            ${[['', '全部'], ['unpaid', '待支付'], ['paid', '已支付'], ['changed', '已改签'], ['refunded', '已退款'], ['cancelled', '已取消']]
    .map(([v, l]) => `<button class="${f.status === v ? 'active' : ''}" data-status="${v}">${l}</button>`).join('')}
          </div>
          <div class="spacer"></div>
          <span class="text-muted" style="font-size:12px">共 ${data.total} 笔订单</span>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>订单 / 用户</th><th>影片 / 场次</th><th>座位</th><th>金额</th><th>状态</th><th>下单时间</th><th>操作</th></tr></thead>
          <tbody id="orderRows"></tbody>
        </table></div>
        <div class="pager" id="orderPager"></div>
      </div>`;

    renderOrderRows();
    qs('#orderPager').innerHTML = pagerHtml(data.page, data.totalPages);
    bindOrderEvents(data);
  }

  function renderOrderRows() {
    const body = qs('#orderRows');
    if (!state.orders.length) {
      body.innerHTML = `<tr><td colspan="7">${emptyBox('没有符合条件的订单', '换个筛选条件试试')}</td></tr>`;
      return;
    }
    body.innerHTML = state.orders.map((o) => {
      const st = ORDER_STATUS[o.status] || ['gray', o.status];
      return `<tr>
        <td><div style="font-weight:600">${escapeHtml(o.orderNo)}</div><div class="sub">${escapeHtml(o.nickname || o.username)}</div></td>
        <td><div>${escapeHtml(o.title)}</div><div class="sub">${escapeHtml(o.cinemaName)} ${escapeHtml(o.hallName)} · ${escapeHtml(o.startTime.slice(5, 16))}</div></td>
        <td style="max-width:150px">${escapeHtml(o.seats || '—')}</td>
        <td class="num">${money(o.totalAmount)}</td>
        <td><span class="badge ${st[0]}">${st[1]}</span></td>
        <td class="sub">${escapeHtml((o.createdAt || '').slice(5, 16))}</td>
        <td><div class="ops">
          ${['paid', 'changed'].includes(o.status) ? `<button class="btn btn-outline btn-sm" data-refund="${o.id}">全额退款</button>` : '<span class="sub">—</span>'}
        </div></td>
      </tr>`;
    }).join('');
  }

  function bindOrderEvents(data) {
    const f = state.orderFilter;
    qs('#orderSearch').addEventListener('input', debounce((e) => {
      f.keyword = e.target.value.trim();
      f.page = 1;
      loadOrders();
    }, 320));
    qs('#orderSeg').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-status]');
      if (!btn) return;
      f.status = btn.dataset.status;
      f.page = 1;
      loadOrders();
    });
    qs('#orderPager').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn) return;
      f.page = Number(btn.dataset.page);
      loadOrders();
    });
    qs('#orderRows').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-refund]');
      if (!btn) return;
      const o = state.orders.find((x) => x.id === Number(btn.dataset.refund));
      const yes = await confirm({
        title: '管理员全额退款',
        message: `为订单 ${o.orderNo}（${money(o.totalAmount)}）办理全额退款？座位将立即释放。`,
        okText: '确认退款',
      });
      if (!yes) return;
      try {
        await window.API.adminRefund(o.id);
        toast('已办理全额退款');
        loadOrders();
      } catch (err) { toast(err.message, 'error'); }
    });
    void data;
  }

  function pagerHtml(page, totalPages) {
    if (totalPages <= 1) return '';
    const pages = [];
    const from = Math.max(1, page - 2);
    const to = Math.min(totalPages, from + 4);
    for (let i = from; i <= to; i++) pages.push(i);
    return `<span>第 ${page} / ${totalPages} 页</span>
      <button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">上一页</button>
      ${pages.map((p) => `<button class="${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
      <button ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">下一页</button>`;
  }

  /* ============================================================
     评论管理
     ============================================================ */
  async function loadComments() {
    const root = qs('#viewRoot');
    root.innerHTML = skeleton(260);
    const f = state.commentFilter;
    const data = await window.API.adminComments({ page: f.page, pageSize: 10, keyword: f.keyword });
    state.comments = data.list;

    root.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <div class="search-inline">${icon('search')}<input id="commentSearch" placeholder="搜索影评 / 影片 / 用户" value="${escapeHtml(f.keyword)}"></div>
          <div class="spacer"></div>
          <span class="text-muted" style="font-size:12px">共 ${data.total} 条影评</span>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>用户</th><th>影片</th><th>评分</th><th>影评内容</th><th>时间</th><th>操作</th></tr></thead>
          <tbody id="commentRows"></tbody>
        </table></div>
        <div class="pager" id="commentPager">${pagerHtml(data.page, data.totalPages)}</div>
      </div>`;

    const body = qs('#commentRows');
    body.innerHTML = state.comments.length ? state.comments.map((c) => `
      <tr>
        <td>${escapeHtml(c.nickname || '匿名用户')}</td>
        <td>${escapeHtml(c.title)}</td>
        <td class="num">${Number(c.rating).toFixed(1)}</td>
        <td style="max-width:360px">${escapeHtml(c.content)}</td>
        <td class="sub">${escapeHtml((c.createdAt || '').slice(0, 16))}</td>
        <td><button class="btn btn-outline btn-sm" data-del-comment="${c.id}">删除</button></td>
      </tr>`).join('') : `<tr><td colspan="6">${emptyBox('暂无影评', '')}</td></tr>`;

    qs('#commentSearch').addEventListener('input', debounce((e) => {
      f.keyword = e.target.value.trim();
      f.page = 1;
      loadComments();
    }, 320));
    qs('#commentPager').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn) return;
      f.page = Number(btn.dataset.page);
      loadComments();
    });
    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-del-comment]');
      if (!btn) return;
      const yes = await confirm({ title: '删除影评', message: '确定删除这条影评吗？操作不可撤销。', okText: '删除' });
      if (!yes) return;
      try {
        await window.API.deleteComment(btn.dataset.delComment);
        toast('影评已删除');
        loadComments();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ============================================================
     轮播广告
     ============================================================ */
  async function loadBanners() {
    const root = qs('#viewRoot');
    root.innerHTML = skeleton(220);
    const banners = await window.API.adminBanners();
    state.banners = banners;

    root.innerHTML = `
      <div class="panel">
        <div class="toolbar" style="margin-bottom:14px">
          <div><h3 style="font-size:15px">首页轮播位</h3><p style="font-size:11.5px;color:var(--muted-2)">最多展示 3 张，按排序值升序</p></div>
          <div class="spacer"></div>
          <button class="btn btn-primary btn-sm" id="addBanner">+ 新增轮播</button>
        </div>
        <div class="cinema-grid" id="bannerGrid">
          ${banners.map((b) => `
            <div class="panel" style="display:grid;grid-template-columns:180px 1fr auto;gap:16px;align-items:center;background:rgba(255,255,255,.02)">
              <img src="${escapeHtml(b.image)}" alt="" style="width:180px;height:80px;object-fit:cover;border-radius:10px;background:#12151d">
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <b style="font-size:14px">${escapeHtml(b.title)}</b>
                  <span class="badge ${b.active ? 'green' : 'gray'}">${b.active ? '展示中' : '已隐藏'}</span>
                </div>
                <p style="font-size:12px;color:var(--muted-2);margin-top:4px">${escapeHtml(b.subtitle || '—')}</p>
                <p class="sub">跳转：${escapeHtml(b.link || '未设置')} · 排序 ${b.sortNo}</p>
              </div>
              <div class="ops" style="display:flex;gap:8px">
                <button class="btn btn-ghost btn-sm" data-edit-banner="${b.id}">编辑</button>
                <button class="btn btn-outline btn-sm" data-del-banner="${b.id}">删除</button>
              </div>
            </div>`).join('') || emptyBox('暂无轮播', '点击右上角新增')}
        </div>
      </div>`;

    qs('#addBanner').addEventListener('click', () => bannerForm(null));
    qs('#bannerGrid').addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-banner]');
      const delBtn = e.target.closest('[data-del-banner]');
      if (editBtn) {
        bannerForm(state.banners.find((b) => b.id === Number(editBtn.dataset.editBanner)));
      } else if (delBtn) {
        const yes = await confirm({ title: '删除轮播', message: '确定删除该轮播广告吗？', okText: '删除' });
        if (!yes) return;
        try {
          await window.API.deleteBanner(delBtn.dataset.delBanner);
          toast('轮播已删除');
          loadBanners();
        } catch (err) { toast(err.message, 'error'); }
      }
    });
  }

  function bannerForm(banner) {
    const b = banner || {};
    const mask = openModal(`
      <div class="modal-head">
        <div><h3>${banner ? '编辑轮播' : '新增轮播'}</h3><p>图片支持演示素材快速选择</p></div>
        <button class="modal-close" data-close>${icon('close')}</button>
      </div>
      <form id="bannerForm">
        <div class="field"><label>标题 *</label><input class="input" name="title" value="${escapeHtml(b.title || '')}"></div>
        <div class="field"><label>副标题</label><input class="input" name="subtitle" value="${escapeHtml(b.subtitle || '')}"></div>
        <div class="field full"><label>图片地址 *</label>
          <input class="input" name="image" value="${escapeHtml(b.image || BANNERS[0])}">
          <div class="poster-picks">${BANNERS.map((p, i) => `<button type="button" class="poster-pick ${((b.image || BANNERS[0]) === p) ? 'active' : ''}" data-banner-img="${p}" style="width:88px;height:40px"><img src="${p}" alt="轮播${i + 1}"></button>`).join('')}</div>
        </div>
        <div class="form-grid">
          <div class="field"><label>跳转链接</label><input class="input" name="link" value="${escapeHtml(b.link || '')}" placeholder="/movie.html?id=1"></div>
          <div class="field"><label>排序值</label><input class="input" type="number" name="sortNo" value="${b.sortNo || 0}"></div>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0">
            <input type="checkbox" name="active" ${b.active === 0 ? '' : 'checked'}> 在首页展示
          </label>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-outline" data-close>取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>`, { size: 'modal-lg' });

    qsa('[data-banner-img]', mask).forEach((btn) => btn.addEventListener('click', () => {
      qs('[name="image"]', mask).value = btn.dataset.bannerImg;
      qsa('[data-banner-img]', mask).forEach((x) => x.classList.toggle('active', x === btn));
    }));

    qs('#bannerForm', mask).addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const payload = {
        title: form.title.value.trim(),
        subtitle: form.subtitle.value.trim(),
        image: form.image.value.trim(),
        link: form.link.value.trim(),
        sortNo: Number(form.sortNo.value) || 0,
        active: form.active.checked ? 1 : 0,
      };
      if (!payload.title || !payload.image) { toast('标题与图片地址不能为空', 'error'); return; }
      try {
        if (banner) await window.API.updateBanner(banner.id, payload);
        else await window.API.createBanner(payload);
        closeModal(mask);
        toast(banner ? '轮播已更新' : '轮播已创建');
        loadBanners();
      } catch (err) { toast(err.message, 'error'); }
    });
  }
})();
