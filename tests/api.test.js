/**
 * API 全链路冒烟测试
 * 运行：npm run test:api   （需先启动服务，默认 http://localhost:3000）
 * 覆盖：登录 → 选座锁座 → 下单 → 支付 → 电子票 → 改签 → 退票 → 管理端统计
 */
const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    failures.push(name + (extra ? `：${extra}` : ''));
    console.log(`  ✘ ${name}${extra ? `：${extra}` : ''}`);
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

(async () => {
  console.log(`\n▶ CineMax API 测试开始：${BASE}\n`);

  console.log('[1] 基础接口');
  const health = await api('/api/health');
  check('健康检查返回 ok', health.success && health.data.status === 'ok');

  const movies = await api('/api/movies?status=showing&pageSize=30');
  check('正在热映列表非空', movies.success && movies.data.list.length > 0);
  const movieId = movies.data.list[0].id;

  const keyword = movies.data.list[0].title.slice(0, 2);
  const search = await api(`/api/movies?keyword=${encodeURIComponent(keyword)}`);
  check('关键词搜索可用', search.success && search.data.list.length >= 1);

  const detail = await api(`/api/movies/${movieId}`);
  check('电影详情包含演职人员', detail.success && Array.isArray(detail.data.cast));

  const cinemas = await api('/api/cinemas');
  check('影院列表非空', cinemas.success && cinemas.data.length === 4);

  console.log('\n[2] 登录鉴权');
  const login = await api('/api/auth/login', { method: 'POST', body: { username: 'demo', password: 'demo123' } });
  check('用户登录成功', login.success && !!login.data.token, login.message);
  const token = login.data?.token;

  const badLogin = await api('/api/auth/login', { method: 'POST', body: { username: 'demo', password: 'wrong' } });
  check('错误密码被拒绝', badLogin.status === 401);

  const me = await api('/api/auth/me', { token });
  check('获取当前用户信息', me.success && me.data.username === 'demo');

  console.log('\n[3] 选座 → 锁座 → 下单 → 支付');
  const showtimes = await api(`/api/showtimes?movieId=${movieId}&date=${dateOffset(3)}`);
  check('查询未来场次成功', showtimes.success && showtimes.data.length > 0);
  const st = showtimes.data[0];

  const seatMap = await api(`/api/showtimes/${st.id}/seats`, { token });
  check('座位图返回座位数据', seatMap.success && seatMap.data.seats.length === st.seatTotal);
  const freeSeats = seatMap.data.seats.filter((s) => s.status !== 'sold').slice(0, 2).map((s) => s.id);
  check('存在可选座位', freeSeats.length === 2);

  const lock = await api('/api/seat-locks', { method: 'POST', token, body: { showtimeId: st.id, seatIds: freeSeats } });
  check('座位锁定成功', lock.success && lock.data.lockMinutes === 15, lock.message);

  const order = await api('/api/orders', { method: 'POST', token, body: { showtimeId: st.id, seatIds: freeSeats, payMethod: 'alipay' } });
  check('创建订单成功', order.success && order.data.orderId > 0, order.message);
  const orderId = order.data?.orderId;

  const pay = await api(`/api/orders/${orderId}/pay`, { method: 'POST', token, body: { payMethod: 'alipay' } });
  check('支付成功并返回二维码', pay.success && String(pay.data.qrDataUrl).startsWith('data:image/png'), pay.message);
  check('支付后生成取票码', pay.success && /^\d{10}$/.test(pay.data.order.ticket_code || ''));
  check('影票状态为有效', pay.success && pay.data.tickets.every((t) => t.status === 'valid'));

  const orderDetail = await api(`/api/orders/${orderId}`, { token });
  check('订单详情含场次与座位', orderDetail.success && orderDetail.data.tickets.length === 2);

  const orderList = await api('/api/orders?status=paid', { token });
  check('我的订单列表包含新订单', orderList.success && orderList.data.some((o) => o.id === orderId));

  console.log('\n[4] 改签与退票');
  const showtimes2 = await api(`/api/showtimes?movieId=${movieId}&date=${dateOffset(3)}`);
  const target = showtimes2.data.find((s) => s.id !== st.id);
  if (target) {
    const targetSeats = await api(`/api/showtimes/${target.id}/seats`, { token });
    const newSeatIds = targetSeats.data.seats.filter((s) => s.status === 'available').slice(0, 2).map((s) => s.id);
    const reschedule = await api(`/api/orders/${orderId}/reschedule`, {
      method: 'POST', token, body: { showtimeId: target.id, seatIds: newSeatIds },
    });
    check('改签成功', reschedule.success, reschedule.message);
  } else {
    check('改签成功', false, '没有可改签的目标场次');
  }

  const refund = await api(`/api/orders/${orderId}/refund`, { method: 'POST', token });
  check('退票成功并计算退款金额', refund.success && refund.data.refundAmount > 0, refund.message);

  const seatsAfter = await api(`/api/showtimes/${st.id}/seats`, { token });
  check('退票后原座位已释放', seatsAfter.data.seats.filter((s) => freeSeats.includes(s.id) && s.status === 'sold').length === 0);

  console.log('\n[5] 评论与收藏');
  const comment = await api('/api/comments', {
    method: 'POST', token, body: { movieId, rating: 9, content: '自动化测试评论：画面与音效都很出色。' },
  });
  check('发布评分评论成功', comment.success, comment.message);
  const comments = await api(`/api/comments?movieId=${movieId}`);
  check('评论列表含评分分布', comments.success && comments.data.count > 0);

  const fav = await api(`/api/favorites/${movieId}`, { method: 'POST', token });
  check('收藏影片成功', fav.success);
  const favList = await api('/api/favorites', { token });
  check('收藏列表包含该影片', favList.success && favList.data.some((m) => m.id === movieId));

  console.log('\n[6] 管理端');
  const adminLogin = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin123' } });
  check('管理员登录成功', adminLogin.success && adminLogin.data.user.role === 'admin');
  const adminToken = adminLogin.data?.token;

  const denied = await api('/api/admin/stats', { token });
  check('普通用户访问管理接口被拒绝', denied.status === 403);

  const stats = await api('/api/admin/stats', { token: adminToken });
  check('统计看板返回票房趋势', stats.success && stats.data.revenueTrend.length === 14);
  check('统计看板返回 TOP 影片', stats.success && stats.data.topMovies.length > 0);

  const adminOrders = await api('/api/admin/orders?pageSize=5', { token: adminToken });
  check('管理端订单分页', adminOrders.success && adminOrders.data.list.length > 0);

  const newMovie = await api('/api/movies', {
    method: 'POST', token: adminToken,
    body: { title: '测试影片_' + Date.now(), duration: 100, status: 'upcoming', synopsis: '测试用影片', cast: [{ name: '测试演员', roleName: '主演' }] },
  });
  check('管理员新增影片', newMovie.success && newMovie.data.id > 0);
  const updMovie = await api(`/api/movies/${newMovie.data.id}`, {
    method: 'PUT', token: adminToken, body: { title: '测试影片_已编辑', duration: 101 },
  });
  check('管理员编辑影片', updMovie.success);
  const delMovie = await api(`/api/movies/${newMovie.data.id}`, { method: 'DELETE', token: adminToken });
  check('管理员删除影片', delMovie.success);

  console.log(`\n──────────── 测试结果 ────────────`);
  console.log(`通过 ${passed} / ${passed + failed}`);
  if (failed) {
    console.log('失败项：');
    failures.forEach((f) => console.log(' - ' + f));
    process.exit(1);
  }
  console.log('全部用例通过 ✅\n');
})();
