/* ============================================================
   选座购票：座位图渲染、锁座倒计时、支付模拟、电子票
   ============================================================ */
(() => {
  const { qs, qsa, escapeHtml, money, dateCN, relativeDay } = window.Utils;
  const { toast } = window.UI;

  const showtimeId = Number(window.Utils.queryParams().showtimeId);
  const MAX_SEATS = 6;

  const state = {
    showtime: null,
    seats: [],
    selected: new Set(),
    timerStop: null,
    expiresAt: null,
    pendingOrderId: null,
    refreshTimer: null,
    payModal: null,
    changedSeats: true,
  };

  async function init() {
    window.UI.mountHeader('now');
    window.UI.mountFooter();
    if (!showtimeId) {
      toast('缺少场次信息，正在返回首页', 'error');
      setTimeout(() => { location.href = '/index.html'; }, 900);
      return;
    }
    bindSummary();
    window.addEventListener('auth:changed', onAuthChanged);
    if (!window.Auth.isLoggedIn) {
      setTimeout(() => {
        window.UI.openAuthModal('login');
        toast('请先登录后选座，演示账号 demo / demo123', 'info', 3600);
      }, 500);
    }
    await loadSeats();
    state.refreshTimer = setInterval(refreshSeats, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshSeats();
    });
  }

  function onAuthChanged() {
    // 登录状态变化后刷新座位（mine 状态与锁定信息相关）
    refreshSeats();
  }

  /* ------------------------------ 数据加载 ------------------------------ */
  async function loadSeats() {
    try {
      const data = await window.API.seats(showtimeId);
      state.showtime = data.showtime;
      state.seats = data.seats;
      renderShowtimeBar();
      renderSeats();
      updateSummary();
      await checkPendingOrder();
    } catch (err) {
      qs('#seatGrid').innerHTML = `<div class="empty"><h3>座位加载失败</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function refreshSeats() {
    if (!state.showtime || state.payModal) return;
    try {
      const data = await window.API.seats(showtimeId);
      state.seats = data.seats;
      state.showtime = data.showtime;
      // 移除已被他人买走/锁定的选择
      const validIds = new Set(data.seats.filter((s) => s.status === 'available' || s.mine).map((s) => s.id));
      [...state.selected].forEach((id) => {
        if (!validIds.has(id)) {
          state.selected.delete(id);
          toast('你选择的座位已被他人购买，请重新选择', 'error');
        }
      });
      renderSeats();
      updateSummary();
    } catch { /* 静默失败，不打扰用户 */ }
  }

  async function checkPendingOrder() {
    if (!window.Auth.isLoggedIn) return;
    try {
      const orders = await window.API.orders({ status: 'unpaid' });
      const pending = orders.find((o) => o.showtimeId === showtimeId);
      if (pending) {
        state.pendingOrderId = pending.id;
        qs('#resumeBox').innerHTML = `<div class="resume-banner">
          <span>你有一笔待支付订单（${pending.tickets?.map((t) => t.seatNo).join('、') || ''}），座位将在 15 分钟后释放。</span>
          <span style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" id="resumePay">继续支付</button>
            <button class="btn btn-outline btn-sm" id="resumeCancel">取消订单</button>
          </span>
        </div>`;
        qs('#resumePay').addEventListener('click', () => openPayment(pending.id, pending.totalAmount));
        qs('#resumeCancel').addEventListener('click', async () => {
          try {
            await window.API.cancelOrder(pending.id);
            state.pendingOrderId = null;
            qs('#resumeBox').innerHTML = '';
            toast('订单已取消，可重新选座', 'info');
            await loadSeats();
          } catch (err) {
            toast(err.message, 'error');
          }
        });
      } else {
        state.pendingOrderId = null;
        qs('#resumeBox').innerHTML = '';
      }
    } catch { /* 忽略 */ }
  }

  /* ------------------------------ 场次信息 ------------------------------ */
  function renderShowtimeBar() {
    const s = state.showtime;
    const d = dateCN(s.startTime);
    qs('#backLink').href = `/movie.html?id=${s.movieId}`;
    qs('#showtimeBar').innerHTML = `
      <img src="${escapeHtml(s.poster || '')}" alt="${escapeHtml(s.title)}">
      <div class="st-info">
        <h1>${escapeHtml(s.title)}</h1>
        <p>${escapeHtml(s.cinemaName)} · ${escapeHtml(s.hallName)} · ${escapeHtml(s.screenType || '')} · ${escapeHtml(s.version)}</p>
        <p>${d.full} ${d.week} ${d.time} 开场 · 片长 ${s.duration} 分钟</p>
      </div>
      <div class="st-time">
        <b>${d.time}</b>
        <span>${relativeDay(s.startTime)} · ${escapeHtml(s.version)}</span>
        <div style="font-size:11.5px;color:#6b7386;margin-top:6px" id="startCountdown"></div>
      </div>`;
    const target = window.UI.parseLocal(s.startTime);
    const tick = () => {
      const diff = target.getTime() - Date.now();
      const el = qs('#startCountdown');
      if (!el) return;
      if (diff <= 0) { el.textContent = '已开场'; return; }
      const f = window.UI.formatDiff(diff);
      el.textContent = `距开场 ${f.text}`;
    };
    tick();
    setInterval(tick, 60000);
  }

  /* ------------------------------ 座位图渲染 ------------------------------ */
  function renderSeats() {
    const seats = state.seats;
    if (!seats.length) {
      qs('#seatGrid').innerHTML = '<div class="empty"><h3>暂无可售座位</h3></div>';
      return;
    }
    const rows = Math.max(...seats.map((s) => s.rowNo));
    const cols = Math.max(...seats.map((s) => s.colNo));
    const map = new Map(seats.map((s) => [`${s.rowNo}-${s.colNo}`, s]));

    let html = '';
    // 列号
    html += '<div class="seat-row" style="margin-bottom:2px">';
    html += '<span class="row-label"></span>';
    for (let c = 1; c <= cols; c++) {
      const aisleCls = cols >= 10 && c === 2 ? ' aisle-right' : '';
      html += `<span class="row-label ${aisleCls}" style="width:28px">${c}</span>`;
    }
    html += '<span class="row-label"></span></div>';

    for (let r = 1; r <= rows; r++) {
      html += '<div class="seat-row">';
      html += `<span class="row-label">${r}</span>`;
      for (let c = 1; c <= cols; c++) {
        const seat = map.get(`${r}-${c}`);
        if (!seat) {
          html += '<span class="seat" style="visibility:hidden"></span>';
          continue;
        }
        const selected = state.selected.has(seat.id);
        const cls = ['seat', seat.type !== 'normal' ? seat.type : ''];
        if (seat.status === 'sold') cls.push('sold');
        else if (seat.status === 'locked' && !seat.mine) cls.push('locked');
        else if (selected) cls.push('selected');
        if (seat.status === 'locked' && seat.mine && !selected) cls.push('mine');
        if (cols >= 10 && c === 2) cls.push('aisle-right');
        if (cols >= 10 && c === cols - 2) cls.push('aisle-left');
        const disabled = seat.status === 'sold' || (seat.status === 'locked' && !seat.mine);
        const title = `${seat.seatNo}${seat.type === 'vip' ? ' VIP' : seat.type === 'couple' ? ' 情侣座' : ''} · ${money(seat.price)}${disabled ? ' · 不可选' : ''}`;
        html += `<button class="${cls.join(' ')}" data-seat="${seat.id}" title="${title}" aria-label="${title}" ${disabled ? 'disabled' : ''}></button>`;
      }
      html += `<span class="row-label">${r}</span>`;
      html += '</div>';
    }
    qs('#seatGrid').innerHTML = html;
    qsa('[data-seat]', qs('#seatGrid')).forEach((btn) => {
      btn.addEventListener('click', () => toggleSeat(Number(btn.dataset.seat)));
    });
  }

  function toggleSeat(id) {
    if (!window.Auth.isLoggedIn) {
      window.UI.openAuthModal('login');
      toast('登录后才能选座，演示账号 demo / demo123', 'info', 3000);
      return;
    }
    const seat = state.seats.find((s) => s.id === id);
    if (!seat || seat.status === 'sold') return;
    if (seat.status === 'locked' && !seat.mine) {
      toast('该座位正被其他用户锁定，请稍后再试', 'error');
      return;
    }
    if (state.selected.has(id)) {
      state.selected.delete(id);
    } else {
      if (state.selected.size >= MAX_SEATS) {
        toast(`每单最多选择 ${MAX_SEATS} 个座位`, 'error');
        return;
      }
      state.selected.add(id);
    }
    state.changedSeats = true;
    renderSeats();
    updateSummary();
  }

  /* ------------------------------ 结算面板 ------------------------------ */
  function bindSummary() {
    qs('#confirmBtn').addEventListener('click', confirmOrder);
  }

  function selectedSeats() {
    return state.seats.filter((s) => state.selected.has(s.id));
  }

  function updateSummary() {
    const seats = selectedSeats();
    const box = qs('#selectedSeats');
    const countEl = qs('#summarySeatCount');
    const total = seats.reduce((sum, s) => sum + Number(s.price), 0);

    countEl.textContent = `已选 ${seats.length} 座`;
    if (!seats.length) {
      box.innerHTML = '<span class="sel-empty">点击座位图中可选的座位</span>';
    } else {
      box.innerHTML = seats.map((s) => `
        <span class="sel-chip">
          <b>${escapeHtml(s.seatNo)}</b>
          <span>${money(s.price)}</span>
          <button class="x" data-remove="${s.id}" aria-label="移除">×</button>
        </span>`).join('');
      qsa('[data-remove]', box).forEach((btn) => {
        btn.addEventListener('click', () => toggleSeat(Number(btn.dataset.remove)));
      });
    }
    qs('#priceBase').textContent = seats.length ? `${seats.length} 张 · ${money(total)}` : '—';
    qs('#priceTotal').textContent = money(total);

    const btn = qs('#confirmBtn');
    if (!window.Auth.isLoggedIn) {
      btn.disabled = true;
      btn.textContent = '登录后可选座购票';
    } else if (!seats.length) {
      btn.disabled = true;
      btn.textContent = '请选择座位';
    } else {
      btn.disabled = false;
      btn.textContent = `确认选座 · ${money(total)}`;
    }
  }

  /* ------------------------------ 锁座 + 下单 ------------------------------ */
  async function confirmOrder() {
    if (!window.UI.requireLogin()) return;
    const seatIds = [...state.selected];
    if (!seatIds.length) return;
    const btn = qs('#confirmBtn');
    btn.disabled = true;
    btn.textContent = '正在锁定座位…';
    try {
      // 存在待支付订单时先取消，避免占用座位
      if (state.pendingOrderId) {
        try { await window.API.cancelOrder(state.pendingOrderId); } catch { /* 忽略 */ }
        state.pendingOrderId = null;
        qs('#resumeBox').innerHTML = '';
      }
      const lock = await window.API.lockSeats({ showtimeId, seatIds });
      state.expiresAt = lock.expiresAt;
      startLockTimer(lock.expiresAt);
      const order = await window.API.createOrder({ showtimeId, seatIds, payMethod: 'alipay' });
      openPayment(order.orderId, order.totalAmount, lock.expiresAt);
    } catch (err) {
      toast(err.message, 'error');
      await refreshSeats();
    } finally {
      btn.disabled = false;
      updateSummary();
    }
  }

  function startLockTimer(expiresAt) {
    stopLockTimer();
    const end = window.UI.parseLocal(expiresAt).getTime();
    const el = qs('#lockTimer');
    const text = qs('#timerText');
    el.classList.remove('hidden');
    state.timerStop = window.UI.countdown(expiresAt, (f, diff) => {
      text.textContent = `${String(f.m).padStart(2, '0')}:${String(f.s).padStart(2, '0')}`;
      if (diff <= 0) {
        el.classList.add('hidden');
        state.selected.clear();
        state.pendingOrderId = null;
        renderSeats();
        updateSummary();
        qs('#resumeBox').innerHTML = '';
        toast('座位锁定已超时，请重新选座', 'error');
        refreshSeats();
      }
    });
    void end;
  }

  function stopLockTimer() {
    if (state.timerStop) state.timerStop();
    state.timerStop = null;
    qs('#lockTimer').classList.add('hidden');
  }

  /* ------------------------------ 支付弹窗 ------------------------------ */
  function openPayment(orderId, amount, expiresAt) {
    state.pendingOrderId = orderId;
    let method = 'alipay';
    const seats = selectedSeats();
    const s = state.showtime;

    const mask = window.UI.openModal(`
      <div class="modal-head">
        <div><h3>确认支付</h3><p>订单已创建，请在锁定时间内完成支付</p></div>
        <button class="modal-close" data-close>×</button>
      </div>
      <div id="payBody">
        <div class="pay-summary">
          <div class="row"><span>影片</span><b>${escapeHtml(s.title)}</b></div>
          <div class="row"><span>场次</span><b>${escapeHtml(s.startTime)} ${escapeHtml(s.version)}</b></div>
          <div class="row"><span>影城</span><b>${escapeHtml(s.cinemaName)} ${escapeHtml(s.hallName)}</b></div>
          <div class="row"><span>座位</span><b>${seats.map((x) => escapeHtml(x.seatNo)).join('、')}</b></div>
          <div class="row amount"><span>应付金额</span><b>${money(amount)}</b></div>
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
        <button class="btn btn-primary btn-block btn-lg" id="payNow" style="margin-top:14px">立即支付 ${money(amount)}</button>
      </div>
    `);

    state.payModal = mask;
    const methods = qs('#payMethods', mask);
    methods.addEventListener('click', (e) => {
      const item = e.target.closest('[data-method]');
      if (!item) return;
      method = item.dataset.method;
      qsa('[data-method]', methods).forEach((m) => m.classList.toggle('active', m === item));
    });

    qs('[data-close]', mask).addEventListener('click', () => {
      state.payModal = null;
      if (state.pendingOrderId) {
        toast('订单已保留 15 分钟，可在「我的票夹」继续支付', 'info', 3600);
      }
    });
    mask.addEventListener('click', (e) => {
      if (e.target === mask) state.payModal = null;
    });

    qs('#payNow', mask).addEventListener('click', async () => {
      await pay(orderId, method, mask);
    });
    void expiresAt;
  }

  async function pay(orderId, method, mask) {
    const body = qs('#payBody', mask);
    const amountText = qs('.amount b', mask)?.textContent || '';
    body.innerHTML = `
      <div class="pay-processing">
        <div class="loader-ring"></div>
        <p>正在安全支付，请稍候…</p>
        <b>${escapeHtml(amountText)}</b>
      </div>`;
    try {
      await window.Utils.sleep(1100);
      const data = await window.API.payOrder(orderId, method);
      state.pendingOrderId = null;
      state.selected.clear();
      stopLockTimer();
      renderPaymentSuccess(mask, data);
      await refreshSeats();
      state.payModal = null;
    } catch (err) {
      body.innerHTML = `
        <div class="empty" style="border:none">
          <div style="font-size:34px;margin-bottom:10px">⚠️</div>
          <h3>支付未完成</h3>
          <p>${escapeHtml(err.message)}</p>
          <div class="ticket-actions">
            <button class="btn btn-ghost" data-close>返回座位图</button>
          </div>
        </div>`;
      qsa('[data-close]', body).forEach((b) => b.addEventListener('click', () => window.UI.closeModal(mask)));
    }
  }

  function renderPaymentSuccess(mask, data) {
    const order = data.order;
    const st = data.showtime;
    const tickets = data.tickets;
    qs('.modal', mask).innerHTML = `
      <div class="ticket-success">
        <div class="success-icon">✓</div>
        <h3>购票成功</h3>
        <p>请凭下方二维码或取票码到影院自助机取票</p>
        <div class="e-ticket" id="ticketPrintArea">
          <div class="et-head">
            <div><b>${escapeHtml(st.title)}</b><span> CineMax 电子票</span></div>
            <span>${escapeHtml(order.order_no)}</span>
          </div>
          <div class="qr-box"><img src="${data.qrDataUrl}" alt="电子票二维码"></div>
          <div class="code-line">取票码 <b>${escapeHtml(order.ticket_code)}</b></div>
          <div class="et-rows">
            <div><span>影院</span><b>${escapeHtml(st.cinema_name)}</b></div>
            <div><span>影厅</span><b>${escapeHtml(st.hall_name)} · ${escapeHtml(st.version)}</b></div>
            <div><span>场次</span><b>${escapeHtml(st.start_time)}</b></div>
            <div><span>座位</span><b>${tickets.map((t) => escapeHtml(t.seatNo)).join('、')}</b></div>
            <div><span>金额</span><b>${money(order.total_amount)}</b></div>
          </div>
        </div>
        <div class="ticket-actions no-print">
          <button class="btn btn-primary" id="goOrders">查看我的订单</button>
          <button class="btn btn-ghost" id="printTicket">打印电子票</button>
          <a class="btn btn-outline" href="/movie.html?id=${st.movie_id}">继续购票</a>
        </div>
      </div>`;
    qs('#goOrders', mask).addEventListener('click', () => { location.href = '/orders.html'; });
    qs('#printTicket', mask).addEventListener('click', () => window.print());
  }

  init();
})();
