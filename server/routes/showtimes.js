/** 场次查询、座位图、场次管理 */
const express = require('express');
const { all, get, run, transaction } = require('../db');
const { adminRequired, optionalAuth, fmtDateTime } = require('../auth');
const { ok, fail, camel } = require('../respond');

const router = express.Router();

const SEAT_SURCHARGE = { normal: 0, vip: 15, couple: 28 };
function priceForSeat(basePrice, seatType) {
  return Math.round((Number(basePrice) + (SEAT_SURCHARGE[seatType] || 0)) * 100) / 100;
}

/** 清理过期未支付订单与过期座位锁 */
function cleanupExpired() {
  const now = fmtDateTime();
  const expiredOrders = all(
    "SELECT id, user_id, showtime_id FROM orders WHERE status = 'unpaid' AND expire_at IS NOT NULL AND expire_at < ?",
    [now]
  );
  if (expiredOrders.length) {
    transaction(() => {
      for (const o of expiredOrders) {
        run("UPDATE orders SET status = 'cancelled' WHERE id = ?", [o.id]);
        run('DELETE FROM seat_locks WHERE order_id = ?', [o.id]);
        run('INSERT INTO order_logs (order_id, action, detail) VALUES (?, ?, ?)', [o.id, 'cancel', '超时未支付，系统自动关闭订单']);
      }
      run('DELETE FROM seat_locks WHERE expires_at < ?', [now]);
    });
  } else {
    run('DELETE FROM seat_locks WHERE expires_at < ? AND order_id IS NULL', [now]);
  }
}

/* 场次列表：影片 / 影院 / 日期筛选 */
router.get('/', (req, res) => {
  cleanupExpired();
  const where = ["datetime(s.start_time) >= datetime('now', 'localtime')"];
  const params = [];
  if (req.query.movieId) { where.push('s.movie_id = ?'); params.push(req.query.movieId); }
  if (req.query.cinemaId) { where.push('s.cinema_id = ?'); params.push(req.query.cinemaId); }
  if (req.query.date) { where.push('date(s.start_time) = ?'); params.push(req.query.date); }

  const rows = all(`
    SELECT s.*, m.title, m.poster, m.duration, m.genre,
      c.name AS cinema_name, c.district, c.address,
      h.name AS hall_name, h.screen_type, h.rows, h.cols,
      (SELECT COUNT(*) FROM seats st WHERE st.hall_id = s.hall_id) AS seat_total,
      (SELECT COUNT(*) FROM seats st WHERE st.hall_id = s.hall_id) -
      (SELECT COUNT(*) FROM tickets t WHERE t.showtime_id = s.id AND t.status = 'valid') AS seat_left
    FROM showtimes s
    JOIN movies m ON m.id = s.movie_id
    JOIN cinemas c ON c.id = s.cinema_id
    JOIN halls h ON h.id = s.hall_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.start_time ASC
    LIMIT 400
  `, params);
  return ok(res, camel(rows));
});

/* 场次详情 */
router.get('/:id', (req, res) => {
  const row = get(`
    SELECT s.*, m.title, m.poster, m.duration, m.genre, m.language AS movie_language,
      c.name AS cinema_name, c.address, c.district,
      h.name AS hall_name, h.screen_type, h.rows, h.cols
    FROM showtimes s
    JOIN movies m ON m.id = s.movie_id
    JOIN cinemas c ON c.id = s.cinema_id
    JOIN halls h ON h.id = s.hall_id
    WHERE s.id = ?
  `, [req.params.id]);
  if (!row) return fail(res, 404, '场次不存在');
  return ok(res, camel(row));
});

/* 座位图：动态渲染数据源（含已售、锁定状态） */
router.get('/:id/seats', optionalAuth, (req, res) => {
  cleanupExpired();
  const st = get(`
    SELECT s.*, m.title, m.duration, c.name AS cinema_name, h.name AS hall_name,
      h.rows, h.cols, h.screen_type
    FROM showtimes s
    JOIN movies m ON m.id = s.movie_id
    JOIN cinemas c ON c.id = s.cinema_id
    JOIN halls h ON h.id = s.hall_id
    WHERE s.id = ?
  `, [req.params.id]);
  if (!st) return fail(res, 404, '场次不存在');

  const userId = req.user ? req.user.id : -1;
  const rows = all(`
    SELECT seat.id, seat.row_no, seat.col_no, seat.seat_no, seat.type,
      CASE
        WHEN tk.id IS NOT NULL THEN 'sold'
        WHEN lk.id IS NOT NULL THEN 'locked'
        ELSE 'available'
      END AS status,
      CASE WHEN lk.user_id = ? THEN 1 ELSE 0 END AS mine
    FROM seats seat
    LEFT JOIN tickets tk ON tk.seat_id = seat.id AND tk.showtime_id = ? AND tk.status = 'valid'
    LEFT JOIN seat_locks lk ON lk.seat_id = seat.id AND lk.showtime_id = ?
    WHERE seat.hall_id = ?
    ORDER BY seat.row_no, seat.col_no
  `, [userId, st.id, st.id, st.hall_id]);

  const seats = rows.map((r) => ({
    ...camel(r),
    mine: !!r.mine,
    price: priceForSeat(st.base_price, r.type),
  }));
  const available = seats.filter((s) => s.status === 'available').length;
  return ok(res, {
    showtime: {
      ...camel(st),
      soldCount: seats.filter((s) => s.status === 'sold').length,
      availableCount: available,
      lockMinutes: 15,
    },
    seats,
  });
});

/* 校验场次时间格式与影厅归属 */
function validateShowtimePayload(b) {
  if (!b.movieId || !get('SELECT id FROM movies WHERE id = ?', [b.movieId])) return '请选择有效影片';
  const hall = get('SELECT * FROM halls WHERE id = ?', [b.hallId]);
  if (!hall) return '请选择有效影厅';
  if (Number(b.cinemaId) !== hall.cinema_id) return '影厅与影院不匹配';
  if (!b.startTime || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(b.startTime)) return '开场时间格式应为 YYYY-MM-DD HH:MM';
  if (!(Number(b.basePrice) > 0)) return '票价必须大于 0';
  return null;
}

/* 新增场次（管理员） */
router.post('/', adminRequired, (req, res) => {
  const b = req.body || {};
  const err = validateShowtimePayload(b);
  if (err) return fail(res, 400, err);
  const startTime = String(b.startTime).replace('T', ' ').slice(0, 16);
  const conflict = get(
    'SELECT id FROM showtimes WHERE hall_id = ? AND start_time = ?',
    [b.hallId, startTime]
  );
  if (conflict) return fail(res, 409, '该影厅在此时间已有排片');
  const info = run(
    'INSERT INTO showtimes (movie_id, cinema_id, hall_id, start_time, base_price, version, language) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [b.movieId, b.cinemaId, b.hallId, startTime, Number(b.basePrice), b.version || '2D', b.language || '国语']
  );
  return ok(res, { id: Number(info.lastInsertRowid) }, '场次已创建');
});

/* 修改场次（管理员） */
router.put('/:id', adminRequired, (req, res) => {
  const st = get('SELECT * FROM showtimes WHERE id = ?', [req.params.id]);
  if (!st) return fail(res, 404, '场次不存在');
  const b = req.body || {};
  const merged = {
    movieId: b.movieId ?? st.movie_id,
    hallId: b.hallId ?? st.hall_id,
    cinemaId: b.cinemaId ?? st.cinema_id,
    startTime: b.startTime ?? st.start_time,
    basePrice: b.basePrice ?? st.base_price,
  };
  const err = validateShowtimePayload(merged);
  if (err) return fail(res, 400, err);
  const startTime = String(merged.startTime).replace('T', ' ').slice(0, 16);
  const conflict = get('SELECT id FROM showtimes WHERE hall_id = ? AND start_time = ? AND id <> ?',
    [merged.hallId, startTime, st.id]);
  if (conflict) return fail(res, 409, '该影厅在此时间已有排片');
  run(
    'UPDATE showtimes SET movie_id = ?, cinema_id = ?, hall_id = ?, start_time = ?, base_price = ?, version = ?, language = ? WHERE id = ?',
    [merged.movieId, merged.cinemaId, merged.hallId, startTime, Number(merged.basePrice),
      b.version ?? st.version, b.language ?? st.language, st.id]
  );
  return ok(res, { id: st.id }, '场次已更新');
});

/* 删除场次（管理员） */
router.delete('/:id', adminRequired, (req, res) => {
  const st = get('SELECT * FROM showtimes WHERE id = ?', [req.params.id]);
  if (!st) return fail(res, 404, '场次不存在');
  const n = get('SELECT COUNT(*) n FROM orders WHERE showtime_id = ? AND status IN (\'paid\',\'changed\')', [st.id]).n;
  if (n > 0) return fail(res, 400, '该场次已有已支付订单，无法删除');
  run('DELETE FROM showtimes WHERE id = ?', [st.id]);
  return ok(res, null, '场次已删除');
});

module.exports = { router, priceForSeat, cleanupExpired, SEAT_SURCHARGE };
