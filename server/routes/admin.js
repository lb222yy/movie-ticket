/** 管理后台：统计看板、订单管理、用户、评论审核、场次总览 */
const express = require('express');
const { all, get, run, transaction } = require('../db');
const { adminRequired, fmtDate, fmtDateTime } = require('../auth');
const { ok, fail, camel } = require('../respond');

const router = express.Router();
router.use(adminRequired);

/* 统计看板 */
router.get('/stats', (_req, res) => {
  const today = fmtDate();

  const sum = (sql, params = []) => get(sql, params).v || 0;

  const todayRevenue = sum(
    `SELECT SUM(total_amount) v FROM orders WHERE status IN ('paid','changed') AND date(paid_at) = ?`, [today]
  );
  const totalRevenue = sum("SELECT SUM(total_amount) v FROM orders WHERE status IN ('paid','changed')");
  const todayOrders = sum(
    `SELECT COUNT(*) v FROM orders WHERE status IN ('paid','changed') AND date(paid_at) = ?`, [today]
  );
  const totalOrders = sum("SELECT COUNT(*) v FROM orders WHERE status IN ('paid','changed')");
  const userCount = sum('SELECT COUNT(*) v FROM users');
  const movieCount = sum('SELECT COUNT(*) v FROM movies');
  const commentsCount = sum('SELECT COUNT(*) v FROM comments');
  const avgRating = get('SELECT ROUND(AVG(rating), 1) v FROM comments').v || 0;

  const soldToday = sum(
    `SELECT COUNT(*) v FROM tickets t JOIN showtimes s ON s.id = t.showtime_id
     WHERE t.status = 'valid' AND date(s.start_time) = ?`, [today]
  );
  const capacityToday = sum(
    `SELECT COUNT(*) v FROM showtimes s JOIN seats seat ON seat.hall_id = s.hall_id
     WHERE date(s.start_time) = ?`, [today]
  );
  const occupancy = capacityToday ? Math.round((soldToday / capacityToday) * 1000) / 10 : 0;

  /* 近 14 天票房趋势 */
  const trendRows = all(`
    SELECT date(paid_at) AS d, SUM(total_amount) AS revenue, COUNT(*) AS orders
    FROM orders WHERE status IN ('paid','changed') AND paid_at IS NOT NULL
    GROUP BY date(paid_at)
  `);
  const trendMap = new Map(trendRows.map((r) => [r.d, r]));
  const revenueTrend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = fmtDate(d);
    const hit = trendMap.get(key);
    revenueTrend.push({
      date: key.slice(5),
      revenue: hit ? Math.round(hit.revenue * 100) / 100 : 0,
      orders: hit ? hit.orders : 0,
    });
  }

  const topMovies = all(`
    SELECT m.id, m.title, m.poster,
      COALESCE(SUM(o.total_amount), 0) AS revenue,
      COUNT(o.id) AS orders,
      ROUND(COALESCE((SELECT AVG(rating) FROM comments c WHERE c.movie_id = m.id), 0), 1) AS rating
    FROM movies m
    LEFT JOIN showtimes s ON s.movie_id = m.id
    LEFT JOIN orders o ON o.showtime_id = s.id AND o.status IN ('paid','changed')
    GROUP BY m.id ORDER BY revenue DESC LIMIT 6
  `);

  const cinemaShare = all(`
    SELECT c.name, COALESCE(SUM(o.total_amount), 0) AS revenue
    FROM cinemas c
    LEFT JOIN showtimes s ON s.cinema_id = c.id
    LEFT JOIN orders o ON o.showtime_id = s.id AND o.status IN ('paid','changed')
    GROUP BY c.id ORDER BY revenue DESC
  `);

  const genreRows = all(`
    SELECT m.genre, COALESCE(SUM(o.total_amount), 0) AS revenue
    FROM movies m
    LEFT JOIN showtimes s ON s.movie_id = m.id
    LEFT JOIN orders o ON o.showtime_id = s.id AND o.status IN ('paid','changed')
    GROUP BY m.genre
  `);
  const genreMap = {};
  genreRows.forEach((g) => {
    (g.genre || '其他').split(',').filter(Boolean).forEach((name) => {
      genreMap[name] = (genreMap[name] || 0) + g.revenue / (g.genre.split(',').filter(Boolean).length || 1);
    });
  });
  const genreShare = Object.entries(genreMap)
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue);

  const recentOrders = all(`
    SELECT o.id, o.order_no, o.total_amount, o.status, o.created_at,
      u.nickname, m.title, s.start_time
    FROM orders o
    JOIN users u ON u.id = o.user_id
    JOIN showtimes s ON s.id = o.showtime_id
    JOIN movies m ON m.id = s.movie_id
    ORDER BY o.id DESC LIMIT 8
  `);

  return ok(res, {
    summary: {
      todayRevenue, totalRevenue, todayOrders, totalOrders,
      userCount, movieCount, commentsCount, avgRating, occupancy, soldToday, capacityToday,
    },
    revenueTrend, topMovies: camel(topMovies), cinemaShare: camel(cinemaShare),
    genreShare, recentOrders: camel(recentOrders),
  });
});

/* 订单管理 */
router.get('/orders', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
  const where = [];
  const params = [];
  if (req.query.status && ['unpaid', 'paid', 'refunded', 'cancelled', 'changed'].includes(req.query.status)) {
    where.push('o.status = ?');
    params.push(req.query.status);
  }
  if (req.query.keyword) {
    where.push('(o.order_no LIKE ? OR u.nickname LIKE ? OR m.title LIKE ?)');
    const kw = `%${req.query.keyword.trim()}%`;
    params.push(kw, kw, kw);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = get(`
    SELECT COUNT(*) n FROM orders o
    JOIN users u ON u.id = o.user_id
    JOIN showtimes s ON s.id = o.showtime_id
    JOIN movies m ON m.id = s.movie_id ${whereSql}
  `, params).n;

  const rows = all(`
    SELECT o.*, u.nickname, u.username, m.title, s.start_time,
      c.name AS cinema_name, h.name AS hall_name,
      (SELECT GROUP_CONCAT(seat.seat_no, '、') FROM tickets t JOIN seats seat ON seat.id = t.seat_id
        WHERE t.order_id = o.id AND t.status = 'valid') AS seats
    FROM orders o
    JOIN users u ON u.id = o.user_id
    JOIN showtimes s ON s.id = o.showtime_id
    JOIN movies m ON m.id = s.movie_id
    JOIN cinemas c ON c.id = s.cinema_id
    JOIN halls h ON h.id = s.hall_id
    ${whereSql}
    ORDER BY o.id DESC LIMIT ? OFFSET ?
  `, [...params, pageSize, (page - 1) * pageSize]);

  return ok(res, { list: camel(rows), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 });
});

/* 管理员强制退票（全额） */
router.post('/orders/:id/refund', (req, res) => {
  const order = get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return fail(res, 404, '订单不存在');
  if (!['paid', 'changed'].includes(order.status)) return fail(res, 400, '该订单当前不可退款');
  transaction(() => {
    run("UPDATE tickets SET status = 'refunded' WHERE order_id = ? AND status = 'valid'", [order.id]);
    run("UPDATE orders SET status = 'refunded', refund_at = ? WHERE id = ?", [fmtDateTime(), order.id]);
    run('INSERT INTO order_logs (order_id, action, detail) VALUES (?, ?, ?)',
      [order.id, 'refund', `管理员操作全额退款 ¥${order.total_amount.toFixed(2)}`]);
  });
  return ok(res, null, '已为顾客办理全额退款');
});

/* 用户列表 */
router.get('/users', (_req, res) => {
  const rows = all(`
    SELECT u.id, u.username, u.nickname, u.phone, u.role, u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
      COALESCE((SELECT SUM(total_amount) FROM orders o WHERE o.user_id = u.id AND o.status IN ('paid','changed')), 0) AS spend
    FROM users u ORDER BY u.id
  `);
  return ok(res, camel(rows));
});

/* 评论审核 */
router.get('/comments', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
  const keyword = req.query.keyword ? `%${req.query.keyword.trim()}%` : null;
  const whereSql = keyword ? 'WHERE c.content LIKE ? OR m.title LIKE ? OR u.nickname LIKE ?' : '';
  const params = keyword ? [keyword, keyword, keyword] : [];
  const total = get(`
    SELECT COUNT(*) n FROM comments c JOIN movies m ON m.id = c.movie_id JOIN users u ON u.id = c.user_id ${whereSql}
  `, params).n;
  const rows = all(`
    SELECT c.*, m.title, u.nickname
    FROM comments c JOIN movies m ON m.id = c.movie_id JOIN users u ON u.id = c.user_id
    ${whereSql} ORDER BY c.id DESC LIMIT ? OFFSET ?
  `, [...params, pageSize, (page - 1) * pageSize]);
  return ok(res, { list: camel(rows), total, page, totalPages: Math.ceil(total / pageSize) || 1 });
});

/* 场次总览（含历史） */
router.get('/showtimes', (req, res) => {
  const where = [];
  const params = [];
  if (req.query.movieId) { where.push('s.movie_id = ?'); params.push(req.query.movieId); }
  if (req.query.cinemaId) { where.push('s.cinema_id = ?'); params.push(req.query.cinemaId); }
  if (req.query.date) { where.push('date(s.start_time) = ?'); params.push(req.query.date); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = all(`
    SELECT s.*, m.title, c.name AS cinema_name, h.name AS hall_name, h.screen_type,
      (SELECT COUNT(*) FROM seats seat WHERE seat.hall_id = s.hall_id) AS seat_total,
      (SELECT COUNT(*) FROM tickets t WHERE t.showtime_id = s.id AND t.status = 'valid') AS sold_count
    FROM showtimes s
    JOIN movies m ON m.id = s.movie_id
    JOIN cinemas c ON c.id = s.cinema_id
    JOIN halls h ON h.id = s.hall_id
    ${whereSql}
    ORDER BY s.start_time DESC LIMIT 300
  `, params);
  return ok(res, camel(rows));
});

module.exports = router;
