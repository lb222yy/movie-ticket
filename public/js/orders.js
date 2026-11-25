/* ============================================================
   我的票夹：订单列表 / 支付 / 电子票 / 退票 / 改签 / 开场提醒
   ============================================================ */
(() => {
  const { qs, qsa, escapeHtml, money, dateCN, relativeDay } = window.Utils;
  const { toast, icon, parseLocal, formatDiff } = window.UI;

  const TABS = [
    { key: 'all', label: '全部' },
    { key: 'unpaid', label: '待支付' },
    { key: 'paid', label: '已支付' },
    { key: 'refunded', label: '已退款' },
    { key: 'cancelled', label: '已取消' },
  ];
  const STATUS_TEXT = {
    unpaid: '待支付', paid: '已支付', changed: '已改签', refunded: '已退款', cancelled: '已取消',
  };

  let orders = [];
  let activeTab = 'all';
  let clockTimer = null;
  let reminderStop = null;

  const isPaidStatus = (s) => s === 'paid' || s === 'changed';

  /** 改签后旧票状态为 changed，只展示当前有效车票 */
  function validTickets(o) {
    const list = o.tickets || [];
    const valid = list.filter((t) => t.status === 'valid');
    return valid.length ? valid : list;
  }

  init();

  function init() {
    window.UI.mountHeader('orders');
    window.UI.mountFooter();
    qs('#notifyBtn').addEventListener('click', onNotify);
    window.addEventListener('auth:changed', load);
    qs('#orderTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      activeTab = btn.dataset.tab;
      renderTabs();
      renderList();
    });
    qs('#orderList').addEventListener('click', onListClick);
    updateNotifyBtn();
    load();
  }

  /* ------------------------------ 数据加载 ------------------------------ */
  async function load() {
    updateNotifyBtn();
    if (!window.Auth.isLoggedIn) {
      clearInterval(clockTimer);
      reminderStop?.();
      renderGuest();
      return;
    }
    qs('#orderList').innerHTML = '<div class="skeleton" style="height:150px;border-radius:20px"></div>';
    try {
      orders = await window.API.orders();
      renderStats();
      renderTabs();
      renderList();
      startReminders();
    } catch (err) {
      qs('#orderList').innerHTML = `<div class="empty"><h3>订单加载失败</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderGuest() {
    orders = [];
    qs('#orderStats').innerHTML = '';
    qs('#orderTabs').innerHTML = '';
    qs('#orderList').innerHTML = `<div class="empty">
      <h3>登录后查看你的票夹</h3>
      <p>选座、支付、电子票、退票改签都在这里管理</p>
      <button class="btn btn-primary" id="guestLogin" style="margin-top:16px">登录 / 注册</button>
      <p style="margin-top:14px">演示账号：demo / demo123</p>
    </div>`;
    qs('#guestLogin').addEventListener('click', () => window.UI.openAuthModal('login'));
  }

  /* ------------------------------ 统计 / 分类 ------------------------------ */
  function renderStats() {
    const unpaid = orders.filter((o) => o.status === 'unpaid').length;
    const paid = orders.filter((o) => isPaidStatus(o.status));
    const spent = paid.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    qs('#orderStats').innerHTML = `
      <div class="order-stat"><span>待支付订单</span><b>${unpaid}<small>笔</small></b></div>
      <div class="order-stat"><span>有效票券</span><b>${paid.reduce((n, o) => n + validTickets(o).length, 0)}<small>张</small></b></div>
      <div class="order-stat"><span>累计消费</span><b>${money(spent)}</b></div>`;
  }

  function countFor(key) {
    if (key === 'all') return orders.length;
    if (key === 'paid') return orders.filter((o) => isPaidStatus(o.status)).length;
    return orders.filter((o) => o.status === key).length;
  }

  function renderTabs() {
    qs('#orderTabs').innerHTML = TABS.map((t) => `
      <button class="${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">
        ${t.label}<span class="count">${countFor(t.key)}</span>
      </button>`).join('');
  }

  /* ------------------------------ 订单列表 ------------------------------ */
  function filteredOrders() {
    if (activeTab === 'all') return orders;
    if (activeTab === 'paid') return orders.filter((o) => isPaidStatus(o.status));
    return orders.filter((o) => o.status === activeTab);
  }

  function renderList() {
    const list = filteredOrders();
    const box = qs('#orderList');
    if (!list.length) {
      box.innerHTML = `<div class="empty">
        <h3>${orders.length ? '该分类下暂无订单' : '还没有购票记录'}</h3>
        <p>${orders.length ? '切换到其他分类看看吧' : '挑一部想看的电影，选好座位下单吧'}</p>
        <a class="btn btn-primary" style="margin-top:16px" href="/index.html#now">去选座购票</a>
      </div>`;
      return;
    }
    box.innerHTML = list.map(orderCard).join('');
    startClock();
  }

  function orderCard(o) {
    const d = dateCN(o.startTime);
    const tickets = validTickets(o);
    const showCountdown = isPaidStatus(o.status) && o.secondsToStart > 0;
    return `
      <article class="order-card" data-id="${o.id}">
        <a class="order-poster" href="/movie.html?id=${o.movieId}">
          <img src="${escapeHtml(o.poster)}" alt="${escapeHtml(o.title)} 海报" loading="lazy">
        </a>
        <div class="order-main">
          <div class="order-title">
            <h3><a href="/movie.html?id=${o.movieId}">${escapeHtml(o.title)}</a></h3>
            <span class="status-tag status-${o.status}">${STATUS_TEXT[o.status] || o.status}</span>
          </div>
          <div class="order-meta">
            <span class="mi">${icon('pin')}${escapeHtml(o.cinemaName)} · ${escapeHtml(o.hallName)}</span>
            <span class="mi">${icon('clock')}${d.full} ${d.week} ${d.time} · ${escapeHtml(o.version || '')}</span>
            <span class="mi">${icon('ticket')}订单号 ${escapeHtml(o.orderNo)}</span>
          </div>
          <div class="order-seats">
            ${tickets.map((t) => `<span>${escapeHtml(t.seatNo)}</span>`).join('')}
            <span>共 ${tickets.length} 张</span>
          </div>
          ${showCountdown ? `<div class="order-countdown" data-countdown="${escapeHtml(o.startTime)}">
            ${icon('clock')}<span class="cd-text">距开场 --:--:--</span>
          </div>` : ''}
        </div>
        <div class="order-side">
          <div class="order-amount">${money(o.totalAmount)}</div>
          <div class="order-actions">${actionsHtml(o)}</div>
        </div>
      </article>`;
  }

  function actionsHtml(o) {
    if (o.status === 'unpaid') {
      return `<button class="btn btn-primary btn-sm" data-action="pay">继续支付</button>
        <button class="btn btn-outline btn-sm" data-action="cancel">取消订单</button>`;
    }
    if (isPaidStatus(o.status)) {
      return `<button class="btn btn-primary btn-sm" data-action="ticket">电子票</button>
        ${o.canReschedule ? '<button class="btn btn-ghost btn-sm" data-action="reschedule">改签</button>' : ''}
        ${o.canRefund ? '<button class="btn btn-ghost btn-sm" data-action="refund">退票</button>' : ''}`;
    }
    return `<a class="btn btn-ghost btn-sm" href="/movie.html?id=${o.movieId}">再次购买</a>`;
  }

  /* ------------------------------ 开场倒计时 ------------------------------ */
  function startClock() {
    clearInterval(clockTimer);
    const tick = () => {
      qsa('[data-countdown]').forEach((el) => {
        const target = parseLocal(el.dataset.countdown).getTime();
        const diff = target - Date.now();
        const textEl = qs('.cd-text', el);
        if (!textEl) return;
        if (diff <= 0) {
          textEl.textContent = '已开场';
          el.classList.remove('soon');
          return;
        }
        textEl.textContent = `距开场 ${formatDiff(diff).text}`;
        el.classList.toggle('soon', diff <= 10 * 60000);
      });
    };
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  function startReminders() {
    reminderStop?.();
    reminderStop = window.UI.scheduleReminders(orders.filter((o) => isPaidStatus(o.status)));
  }

  function onNotify() {
    window.UI.requestNotifyPermission();
    setTimeout(updateNotifyBtn, 700);
  }

  function updateNotifyBtn() {
    const btn = qs('#notifyBtn');
    if (!btn) return;
    const granted = 'Notification' in window && Notification.permission === 'granted';
    btn.textContent = granted ? '开场提醒已开启' : '开启开场提醒';
    btn.classList.toggle('btn-primary', granted);
    btn.classList.toggle('btn-ghost', !granted);
  }

  /* ------------------------------ 操作分发 ------------------------------ */
  function onListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.order-card');
    const o = orders.find((x) => x.id === Number(card.dataset.id));
    if (!o) return;
    const action = btn.dataset.action;
    if (action === 'pay') openPayment(o);
    else if (action === 'cancel') cancelOrder(o);
    else if (action === 'ticket') showTicket(o.id);
    else if (action === 'refund') refundOrder(o);
    else if (action === 'reschedule') openReschedule(o);
  }

  async function cancelOrder(o) {
    const yes = await window.UI.confirm({
      title: '取消订单',
      message: '取消后座位将立即释放，确定要取消这笔订单吗？',
      okText: '取消订单',
      cancelText: '再想想',
    });
    if (!yes) return;
    try {
      await window.API.cancelOrder(o.id);
      toast('订单已取消，座位已释放', 'info');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function refundOrder(o) {
    const fee = Math.round(Number(o.totalAmount) * 0.05 * 100) / 100;
    const yes = await window.UI.confirm({
      title: '确认退票',
      message: `退票将收取 5% 手续费（${money(fee)}），实际退还 ${money(o.totalAmount - fee)}。`,
      okText: '确认退票',
    });
    if (!yes) return;
    try {
      const r = await window.API.refundOrder(o.id);
      toast(`退票成功，${money(r.refundAmount)} 已原路退回`);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* ------------------------------ 电子票 ------------------------------ */
  async function showTicket(id) {
    try {
      const data = await window.API.ticket(id);
      renderTicket(data, '请凭下方二维码或取票码到影院自助机取票');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function renderTicket(data, subtitle) {
    const o = data.order;
    const st = data.showtime;
    const tickets = data.tickets || [];
    const mask = window.UI.openModal(`
      <div class="ticket-success">
        <div class="success-icon">✓</div>
        <h3>电子票</h3>
        <p>${escapeHtml(subtitle)}</p>
        <div class="e-ticket" id="ticketPrintArea">
          <div class="et-head">
            <div><b>${escapeHtml(st.title)}</b><span> CineMax 电子票</span></div>
            <span>${escapeHtml(o.order_no)}</span>
          </div>
          <div class="qr-box"><img src="${data.qrDataUrl}" alt="电子票二维码"></div>
          <div class="code-line">取票码 <b>${escapeHtml(o.ticket_code)}</b></div>
          <div class="et-rows">
            <div><span>影院</span><b>${escapeHtml(st.cinema_name)} · ${escapeHtml(st.hall_name)}</b></div>
            <div><span>版本</span><b>${escapeHtml(st.version)}</b></div>
            <div><span>场次</span><b>${escapeHtml(st.start_time)}</b></div>
            <div><span>座位</span><b>${tickets.map((t) => escapeHtml(t.seatNo)).join('、')}</b></div>
            <div><span>金额</span><b>${money(o.total_amount)}</b></div>
          </div>
        </div>
        <div class="ticket-actions no-print">
          <button class="btn btn-primary" id="printTicket">打印电子票</button>
          <button class="btn btn-ghost" data-close>关闭</button>
        </div>
      </div>`, { size: 'ticket-modal' });
    qs('#printTicket', mask).addEventListener('click', () => window.print());
  }

  /* ------------------------------ 支付模拟 ------------------------------ */
  function openPayment(o) {
    let method = o.payMethod || 'alipay';
    const tickets = validTickets(o);
    const mask = window.UI.openModal(`
      <div class="modal-head">
        <div><h3>确认支付</h3><p>订单已创建，请在锁定时间内完成支付</p></div>
        <button class="modal-close" data-close>${icon('close')}</button>
      </div>
      <div id="payBody">
        <div class="pay-summary">
          <div class="row"><span>影片</span><b>${escapeHtml(o.title)}</b></div>
          <div class="row"><span>场次</span><b>${escapeHtml(o.startTime)} ${escapeHtml(o.version || '')}</b></div>
          <div class="row"><span>影城</span><b>${escapeHtml(o.cinemaName)} ${escapeHtml(o.hallName)}</b></div>
          <div class="row"><span>座位</span><b>${tickets.map((t) => escapeHtml(t.seatNo)).join('、')}</b></div>
          <div class="row amount"><span>应付金额</span><b>${money(o.totalAmount)}</b></div>
        </div>
        <div class="pay-methods" id="payMethods">
          <div class="pay-method active" data-method="alipay">
            <span class="pm-icon pm-alipay">支</span>
            <span><b>支付宝</b><span>推荐使用，支付安全便捷</span></span>
            <i class="pm-check"></i>
          </div>
          <div class="pay-method" data-method="wechat">
            <span class="pm-icon pm-wechat">微</span>
            <span><b>微信支付</b><span>使用微信扫码支付</span></span>
            <i class="pm-check"></i>
          </div>
          <div class="pay-method" data-method="card">
            <span class="pm-icon pm-card">卡</span>
            <span><b>银行卡</b><span>支持储蓄卡 / 信用卡</span></span>
            <i class="pm-check"></i>
          </div>
        </div>
        <p class="pay-tip">本页面为课程项目演示，支付为模拟流程，不会产生真实扣款</p>
        <button class="btn btn-primary btn-block btn-lg" id="payNow" style="margin-top:14px">立即支付 ${money(o.totalAmount)}</button>
      </div>`);

    const methods = qs('#payMethods', mask);
    methods.addEventListener('click', (e) => {
      const item = e.target.closest('[data-method]');
      if (!item) return;
      method = item.dataset.method;
      qsa('[data-method]', methods).forEach((m) => m.classList.toggle('active', m === item));
    });

    qs('#payNow', mask).addEventListener('click', async () => {
      const body = qs('#payBody', mask);
      body.innerHTML = `
        <div class="pay-processing">
          <div class="loader-ring"></div>
          <p>正在安全支付，请稍候…</p>
          <b>${money(o.totalAmount)}</b>
        </div>`;
      try {
        await window.Utils.sleep(1000);
        const data = await window.API.payOrder(o.id, method);
        window.UI.closeModal(mask);
        toast('支付成功，电子票已生成');
        renderTicket(data, '支付成功！请凭下方二维码或取票码到影院自助机取票');
        load();
      } catch (err) {
        body.innerHTML = `
          <div class="empty" style="border:none">
            <div style="font-size:34px;margin-bottom:10px">⚠️</div>
            <h3>支付未完成</h3>
            <p>${escapeHtml(err.message)}</p>
            <div class="ticket-actions"><button class="btn btn-ghost" data-close>关闭</button></div>
          </div>`;
        qsa('[data-close]', body).forEach((b) => b.addEventListener('click', () => window.UI.closeModal(mask)));
        load();
      }
    });
  }

  /* ------------------------------ 改签 ------------------------------ */
  async function openReschedule(o) {
    const need = validTickets(o).length;
    const mask = window.UI.openModal(`
      <div class="modal-head">
        <div><h3>改签《${escapeHtml(o.title)}》</h3><p>仅支持同影片的其他场次，需选择 ${need} 个座位</p></div>
        <button class="modal-close" data-close>${icon('close')}</button>
      </div>
      <div class="rs-body" id="rsBody"></div>`);

    const body = qs('#rsBody', mask);
    let showtimes = [];
    try {
      const list = await window.API.showtimes({ movieId: o.movieId });
      showtimes = list.filter((s) => s.id !== o.showtimeId && s.seatLeft >= need);
    } catch (err) {
      toast(err.message, 'error');
      window.UI.closeModal(mask);
      return;
    }
    if (!showtimes.length) {
      body.innerHTML = `<div class="empty"><h3>暂无可改签场次</h3><p>该影片近期没有余座充足的其他场次</p></div>`;
      return;
    }

    const dates = [...new Set(showtimes.map((s) => s.startTime.slice(0, 10)))];
    let activeDate = dates[0];

    function renderDates() {
      qs('#rsDates', mask).innerHTML = dates.map((d) => {
        const info = dateCN(`${d} 00:00`);
        return `<button class="rs-date ${d === activeDate ? 'active' : ''}" data-date="${d}">
          <b>${info.date}</b>${relativeDay(d)}
        </button>`;
      }).join('');
      qsa('[data-date]', mask).forEach((b) => b.addEventListener('click', () => {
        activeDate = b.dataset.date;
        renderDates();
        renderTimes();
      }));
    }

    function renderTimes() {
      const list = showtimes.filter((s) => s.startTime.slice(0, 10) === activeDate);
      qs('#rsTimes', mask).innerHTML = list.map((s) => {
        const info = dateCN(s.startTime);
        return `<button class="rs-time" data-sid="${s.id}">
          <span>
            <b>${info.time}</b>
            <span>${escapeHtml(s.cinemaName)} · ${escapeHtml(s.hallName)} · ${escapeHtml(s.version)}</span>
          </span>
          <span style="text-align:right">
            <em>余 ${s.seatLeft} 座</em>
            <span>${money(s.basePrice)} 起</span>
          </span>
        </button>`;
      }).join('');
      qsa('[data-sid]', mask).forEach((b) => b.addEventListener('click', () => {
        const st = showtimes.find((s) => s.id === Number(b.dataset.sid));
        openSeatStep(st);
      }));
    }

    function renderDateStep() {
      body.innerHTML = '<div class="rs-dates" id="rsDates"></div><div class="rs-times" id="rsTimes"></div>';
      renderDates();
      renderTimes();
    }

    async function openSeatStep(st) {
      const info = dateCN(st.startTime);
      body.innerHTML = `
        <div class="reschedule-step-title">${escapeHtml(st.cinemaName)} · ${escapeHtml(st.hallName)} · ${info.date} ${info.time}</div>
        <div class="rs-seat-wrap">
          <div class="rs-seat-scroll"><div class="rs-seat-grid" id="rsGrid">
            <div class="skeleton" style="height:190px;width:300px"></div>
          </div></div>
          <div class="rs-legend"><span><i class="sel"></i>已选</span><span><i></i>可选</span><span>灰色为不可选</span></div>
        </div>
        <div class="ticket-actions" style="margin-top:16px">
          <button class="btn btn-ghost" id="rsBack">重新选场次</button>
          <button class="btn btn-primary" id="rsConfirm" disabled>确认改签（0/${need}）</button>
        </div>`;

      qs('#rsBack', mask).addEventListener('click', renderDateStep);

      let seats = [];
      try {
        const data = await window.API.seats(st.id);
        seats = data.seats;
      } catch (err) {
        qs('#rsGrid', mask).innerHTML = `<p style="color:var(--muted-2);font-size:12.5px">${escapeHtml(err.message)}</p>`;
        return;
      }

      const selected = new Set();
      const rows = Math.max(...seats.map((s) => s.rowNo));
      const cols = Math.max(...seats.map((s) => s.colNo));
      const map = new Map(seats.map((s) => [`${s.rowNo}-${s.colNo}`, s]));
      let html = '';
      for (let r = 1; r <= rows; r++) {
        html += '<div class="rs-row">';
        for (let c = 1; c <= cols; c++) {
          const seat = map.get(`${r}-${c}`);
          if (!seat) {
            html += '<span class="rs-seat" style="visibility:hidden"></span>';
            continue;
          }
          const disabled = seat.status === 'sold' || (seat.status === 'locked' && !seat.mine);
          const cls = ['rs-seat', seat.type !== 'normal' ? seat.type : ''].filter(Boolean).join(' ');
          html += `<button class="${cls}" data-seat="${seat.id}" title="${escapeHtml(seat.seatNo)} ${money(seat.price)}" ${disabled ? 'disabled' : ''}></button>`;
        }
        html += '</div>';
      }
      qs('#rsGrid', mask).innerHTML = html;

      qsa('[data-seat]', mask).forEach((btn) => btn.addEventListener('click', () => {
        const id = Number(btn.dataset.seat);
        if (selected.has(id)) {
          selected.delete(id);
        } else {
          if (selected.size >= need) {
            toast(`本次改签只能选择 ${need} 个座位`, 'error');
            return;
          }
          selected.add(id);
        }
        btn.classList.toggle('selected', selected.has(id));
        const confirmBtn = qs('#rsConfirm', mask);
        confirmBtn.disabled = selected.size !== need;
        confirmBtn.textContent = `确认改签（${selected.size}/${need}）`;
      }));

      qs('#rsConfirm', mask).addEventListener('click', async () => {
        if (selected.size !== need) return;
        const btn = qs('#rsConfirm', mask);
        btn.disabled = true;
        btn.textContent = '正在改签…';
        try {
          const r = await window.API.rescheduleOrder(o.id, { showtimeId: st.id, seatIds: [...selected] });
          window.UI.closeModal(mask);
          if (r.diff > 0) toast(`改签成功，已补差价 ${money(r.diff)}`);
          else if (r.diff < 0) toast(`改签成功，退还差价 ${money(Math.abs(r.diff))}`);
          else toast('改签成功');
          load();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = `确认改签（${selected.size}/${need}）`;
        }
      });
    }

    renderDateStep();
  }
})();
