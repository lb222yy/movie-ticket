/** 选座锁座、下单、支付模拟、退票、改签、电子票二维码 */
const express = require('express');
const QRCode = require('qrcode');
const { all, get, run, transaction } = require('../db');
const {
  authRequired, fmtDateTime, addMinutes, parseLocal, genOrderNo, genTicketCode,
} = require('../auth');
const { ok, fail, camel } = require('../respond');
const { priceForSeat, cleanupExpired } = require('./showtimes');

const router = express.Router();
const LOCK_MINUTES = 15;
const REFUND_FEE_RATE = 0.05;
const PAY_METHODS = ['alipay', 'wechat', 'card'];

/* ---------------------------- 工具函数 ---------------------------- */

function loadShowtime(id) {
  return get(`
    SELECT s.*, m.title, m.duration, m.poster, c.name AS cinema_name, c.address,
      h.name AS hall_name, h.rows, h.cols, h.screen_type
    FROM showtimes s
    JOIN movies m ON m.id = s.movie_id
    JOIN cinemas c ON c.id = s.cinema_id
    JOIN halls h ON h.id = s.hall_id
    WHERE s.id = ?
  `, [id]);
}

function validateSeats(showtime, seatIds) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) return { error: '请至少选择一个座位' };
  if (seatIds.length > 6) return { error: '单笔订单最多选择 6 个座位' };
  const unique = [...new Set(seatIds.map(Number))];
  if (unique.length !== seatIds.length) return { error: '座位数据重复，请重新选择' };
  const placeholders = unique.map(() => '?').join(',');
  const seats = all(`SELECT * FROM seats WHERE id IN (${placeholders})`, unique);
  if (seats.length !== unique.length) return { error: '座位信息无效' };
  if (seats.some((s) => s.hall_id !== showtime.hall_id)) return { error: '所选座位不属于该影厅' };
  return { seats, unique };
}

function assertFuture(showtime) {
  return parseLocal(showtime.start_time).getTime() > Date.now();
}

function generateQrPayload(order, showtime, tickets) {
  return [
    'CINEMAX|CineMax在线电影购票系统',
    `订单号:${order.order_no}`,
    `取票码:${order.ticket_code}`,
    `影片:${showtime.title}`,
    `场次:${showtime.start_time}`,
    `影厅:${showtime.cinema_name} ${showtime.hall_name}`,
    `座位:${tickets.map((t) => t.seat_no).join('、')}`,
    `金额:¥${Number(order.total_amount).toFixed(2)}`,
  ].join('\n');
}

async function buildTicketQr(orderId) {
  const order = get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return null;
  const showtime = loadShowtime(order.showtime_id);
  const tickets = all(`
    SELECT t.*, seat.seat_no, seat.row_no, seat.col_no, seat.type
    FROM tickets t JOIN seats seat ON seat.id = t.seat_id
    WHERE t.order_id = ? AND t.status = 'valid'
    ORDER BY seat.row_no, seat.col_no
  `, [order.id]);
  const payload = generateQrPayload(order, showtime, tickets);
  const qrDataUrl = await QRCode.toDataURL(payload, {
    width: 420, margin: 1, color: { dark: '#0b0d12', light: '#ffffff' },
  });
  return { order, showtime, tickets: camel(tickets), qrDataUrl, payload };
}

/* 组装订单详情 */
function orderDetail(orderId, userId, isAdmin = false) {
  const order = get(`
    SELECT o.*, s.start_time, s.base_price, s.version, s.language AS version_language,
      m.id AS movie_id, m.title, m.poster, m.duration,
      c.id AS cinema_id, c.name AS cinema_name, c.address,
      h.name AS hall_name, h.screen_type
    FROM orders o
    JOIN showtimes s ON s.id = o.showtime_id
    JOIN movies m ON m.id = s.movie_id
    JOIN cinemas c ON c.id = s.cinema_id
    JOIN halls h ON h.id = s.hall_id
    WHERE o.id = ?
  `, [orderId]);
  if (!order) return null;
  if (!isAdmin && order.user_id !== userId) return null;
  const tickets = all(`
    SELECT t.id, t.price, t.status, seat.seat_no, seat.row_no, seat.col_no, seat.type
    FROM tickets t JOIN seats seat ON seat.id = t.seat_id
    WHERE t.order_id = ? ORDER BY seat.row_no, seat.col_no
  `, [orderId]);
  const logs = all('SELECT * FROM order_logs WHERE order_id = ? ORDER BY id', [orderId]);
  return { ...camel(order), tickets: camel(tickets), logs: camel(logs) };
}

/* --------------------------- 选座锁定 --------------------------- */

/* 锁定座位（15 分钟） */
router.post('/seat-locks', authRequired, (req, res) => {
  cleanupExpired();
  const { showtimeId, seatIds } = req.body || {};
  const showtime = loadShowtime(showtimeId);
  if (!showtime) return fail(res, 404, '场次不存在');
  if (!assertFuture(showtime)) return fail(res, 400, '该场次已开场，无法购票');

  const { error, seats, unique } = validateSeats(showtime, seatIds);
  if (error) return fail(res, 400, error);

  const placeholders = unique.map(() => '?').join(',');
  const sold = all(
    `SELECT seat_id FROM tickets WHERE showtime_id = ? AND status = 'valid' AND seat_id IN (${placeholders})`,
    [showtime.id, ...unique]
  );
  if (sold.length) return fail(res, 409, '部分座位已被购买，请重新选择');

  const others = all(
    `SELECT seat_id FROM seat_locks
     WHERE showtime_id = ? AND seat_id IN (${placeholders}) AND user_id <> ? AND expires_at > ?`,
    [showtime.id, ...unique, req.user.id, fmtDateTime()]
  );
  if (others.length) return fail(res, 409, '部分座位正被其他用户锁定，请稍后重试');

  const expiresAt = fmtDateTime(addMinutes(new Date(), LOCK_MINUTES));
  transaction(() => {
    // 清掉本人此前未下单的旧锁定，避免占座
    run('DELETE FROM seat_locks WHERE showtime_id = ? AND user_id = ? AND order_id IS NULL', [showtime.id, req.user.id]);
    const placeholders2 = unique.map(() => '?').join(',');
    run(
      `DELETE FROM seat_locks WHERE showtime_id = ? AND seat_id IN (${placeholders2}) AND user_id = ?`,
      [showtime.id, ...unique, req.user.id]
    );
    for (const seat of seats) {
      run(
        'INSERT INTO seat_locks (showtime_id, seat_id, user_id, expires_at) VALUES (?, ?, ?, ?)',
        [showtime.id, seat.id, req.user.id, expiresAt]
      );
    }
  });
  return ok(res, {
    expiresAt, lockMinutes: LOCK_MINUTES,
    seats: seats.map((s) => ({ id: s.id, seatNo: s.seat_no, type: s.type, price: priceForSeat(showtime.base_price, s.type) })),
    totalAmount: Math.round(seats.reduce((sum, s) => sum + priceForSeat(showtime.base_price, s.type), 0) * 100) / 100,
  }, '座位已锁定，请在 15 分钟内完成支付');
});

/* 释放本人锁定的座位 */
router.delete('/seat-locks/:showtimeId', authRequired, (req, res) => {
  run(
    'DELETE FROM seat_locks WHERE showtime_id = ? AND user_id = ? AND order_id IS NULL',
    [req.params.showtimeId, req.user.id]
  );
  return ok(res, null, '已释放所选座位');
});

/* ---------------------------- 订单 ---------------------------- */

/* 创建订单（未支付，锁定座位保留 15 分钟） */
router.post('/orders', authRequired, (req, res) => {
  cleanupExpired();
  const { showtimeId, seatIds, payMethod } = req.body || {};
  const showtime = loadShowtime(showtimeId);
  if (!showtime) return fail(res, 404, '场次不存在');
  if (!assertFuture(showtime)) return fail(res, 400, '该场次已开场，无法购票');
  const { error, seats, unique } = validateSeats(showtime, seatIds);
  if (error) return fail(res, 400, error);
  if (payMethod && !PAY_METHODS.includes(payMethod)) return fail(res, 400, '不支持的支付方式');

  const now = fmtDateTime();
  const placeholders = unique.map(() => '?').join(',');
  const sold = all(
    `SELECT seat_id FROM tickets WHERE showtime_id = ? AND status = 'valid' AND seat_id IN (${placeholders})`,
    [showtime.id, ...unique]
  );
  if (sold.length) return fail(res, 409, '所选座位已售出，请重新选择');

  const locks = all(
    `SELECT * FROM seat_locks WHERE showtime_id = ? AND seat_id IN (${placeholders}) AND user_id = ? AND expires_at > ?`,
    [showtime.id, ...unique, req.user.id, now]
  );
  if (locks.length !== unique.length) return fail(res, 409, '座位锁定已过期，请重新选座');

  const total = Math.round(seats.reduce((sum, s) => sum + priceForSeat(showtime.base_price, s.type), 0) * 100) / 100;
  const expireAt = fmtDateTime(addMinutes(new Date(), LOCK_MINUTES));

  const orderId = transaction(() => {
    const orderNo = genOrderNo();
    const info = run(
      `INSERT INTO orders (order_no, user_id, showtime_id, total_amount, status, pay_method, expire_at)
       VALUES (?, ?, ?, ?, 'unpaid', ?, ?)`,
      [orderNo, req.user.id, showtime.id, total, payMethod || 'alipay', expireAt]
    );
    const id = Number(info.lastInsertRowid);
    run('UPDATE seat_locks SET order_id = ?, expires_at = ? WHERE showtime_id = ? AND seat_id IN (' + placeholders + ') AND user_id = ?',
      [id, expireAt, showtime.id, ...unique, req.user.id]);
    run('INSERT INTO order_logs (order_id, action, detail) VALUES (?, ?, ?)',
      [id, 'create', `创建订单，座位：${seats.map((s) => s.seat_no).join('、')}`]);
    return id;
  });

  return ok(res, { orderId, expireAt, totalAmount: total }, '订单已创建，请完成支付');
});

/* 订单列表（我的订单） */
router.get('/orders', authRequired, (req, res) => {
  cleanupExpired();
  const status = req.query.status;
  const where = ['o.user_id = ?'];
  const params = [req.user.id];
  if (status && ['unpaid', 'paid', 'refunded', 'cancelled', 'changed'].includes(status)) {
    where.push('o.status = ?');
    params.push(status);
  }
  const rows = all(`
    SELECT o.*, s.start_time, s.version,
      m.id AS movie_id, m.title, m.poster, m.duration,
      c.name AS cinema_name, h.name AS hall_name
    FROM orders o
    JOIN showtimes s ON s.id = o.showtime_id
    JOIN movies m ON m.id = s.movie_id
    JOIN cinemas c ON c.id = s.cinema_id
    JOIN halls h ON h.id = s.hall_id
    WHERE ${where.join(' AND ')}
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT 100
  `, params);

  const list = rows.map((o) => {
    const tickets = all(`
      SELECT t.status, seat.seat_no, seat.row_no, seat.col_no, seat.type, t.price
      FROM tickets t JOIN seats seat ON seat.id = t.seat_id
      WHERE t.order_id = ? ORDER BY seat.row_no, seat.col_no
    `, [o.id]);
    return {
      ...camel(o),
      tickets: camel(tickets),
      canRefund: (o.status === 'paid' || o.status === 'changed') && (parseLocal(o.start_time).getTime() - Date.now()) > 2 * 3600 * 1000,
      canReschedule: (o.status === 'paid' || o.status === 'changed') && (parseLocal(o.start_time).getTime() - Date.now()) > 2 * 3600 * 1000,
      secondsToStart: Math.round((parseLocal(o.start_time).getTime() - Date.now()) / 1000),
    };
  });
  return ok(res, list);
});

/* 订单详情 */
router.get('/orders/:id', authRequired, (req, res) => {
  cleanupExpired();
  const detail = orderDetail(req.params.id, req.user.id, req.user.role === 'admin');
  if (!detail) return fail(res, 404, '订单不存在');
  return ok(res, detail);
});

/* 支付模拟 */
router.post('/orders/:id/pay', authRequired, async (req, res) => {
  cleanupExpired();
  const order = get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!order) return fail(res, 404, '订单不存在');
  if (order.status === 'paid' || order.status === 'changed') return fail(res, 400, '该订单已支付');
  if (order.status !== 'unpaid') return fail(res, 400, '当前订单状态不可支付');
  if (order.expire_at && order.expire_at < fmtDateTime()) {
    run("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
    run('DELETE FROM seat_locks WHERE order_id = ?', [order.id]);
    return fail(res, 400, '订单已超时关闭，请重新选座');
  }
  const payMethod = PAY_METHODS.includes(req.body?.payMethod) ? req.body.payMethod : (order.pay_method || 'alipay');

  const tickets = all(`
    SELECT t.seat_id, seat.type, seat.seat_no FROM seat_locks t JOIN seats seat ON seat.id = t.seat_id
    WHERE t.order_id = ? AND t.user_id = ?
  `, [order.id, req.user.id]);
  if (!tickets.length) return fail(res, 409, '座位锁定已失效，请重新选座');
  const showtime = loadShowtime(order.showtime_id);

  const code = genTicketCode();
  try {
    transaction(() => {
      const now = fmtDateTime();
      for (const t of tickets) {
        const exists = get(
          "SELECT id FROM tickets WHERE showtime_id = ? AND seat_id = ? AND status = 'valid'",
          [order.showtime_id, t.seat_id]
        );
        if (exists) throw new Error('SEAT_SOLD');
        run(
          "INSERT INTO tickets (order_id, showtime_id, seat_id, price, status) VALUES (?, ?, ?, ?, 'valid')",
          [order.id, order.showtime_id, t.seat_id, priceForSeat(showtime.base_price, t.type)]
        );
      }
      run('UPDATE orders SET status = ?, pay_method = ?, paid_at = ?, ticket_code = ? WHERE id = ?',
        ['paid', payMethod, now, code, order.id]);
      run('DELETE FROM seat_locks WHERE order_id = ?', [order.id]);
      run('INSERT INTO order_logs (order_id, action, detail) VALUES (?, ?, ?)',
        [order.id, 'pay', `支付成功（${payMethod}），取票码 ${code}`]);
    });
  } catch (e) {
    if (e.message === 'SEAT_SOLD') return fail(res, 409, '座位已被他人购买，请重新选座');
    throw e;
  }

  const qr = await buildTicketQr(order.id);
  return ok(res, qr, '支付成功，电子票已生成');
});

/* 取消未支付订单 */
router.post('/orders/:id/cancel', authRequired, (req, res) => {
  const order = get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!order) return fail(res, 404, '订单不存在');
  if (order.status !== 'unpaid') return fail(res, 400, '仅未支付订单可取消');
  transaction(() => {
    run("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
    run('DELETE FROM seat_locks WHERE order_id = ?', [order.id]);
    run('INSERT INTO order_logs (order_id, action, detail) VALUES (?, ?, ?)', [order.id, 'cancel', '用户取消订单']);
  });
  return ok(res, null, '订单已取消，座位已释放');
});

/* 退票：开场前 2 小时可退，收取 5% 手续费 */
router.post('/orders/:id/refund', authRequired, (req, res) => {
  const order = get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!order) return fail(res, 404, '订单不存在');
  if (order.status !== 'paid' && order.status !== 'changed') return fail(res, 400, '当前订单状态不支持退票');
  const showtime = loadShowtime(order.showtime_id);
  const hours = (parseLocal(showtime.start_time).getTime() - Date.now()) / 3600000;
  if (hours <= 2) return fail(res, 400, '距开场不足 2 小时，无法退票');

  const fee = Math.round(order.total_amount * REFUND_FEE_RATE * 100) / 100;
  const refund = Math.round((order.total_amount - fee) * 100) / 100;
  transaction(() => {
    run("UPDATE tickets SET status = 'refunded' WHERE order_id = ? AND status = 'valid'", [order.id]);
    run("UPDATE orders SET status = 'refunded', refund_at = ? WHERE id = ?", [fmtDateTime(), order.id]);
    run('INSERT INTO order_logs (order_id, action, detail) VALUES (?, ?, ?)',
      [order.id, 'refund', `退票成功，退还 ¥${refund.toFixed(2)}（手续费 ¥${fee.toFixed(2)}）`]);
  });
  return ok(res, { refundAmount: refund, fee }, `退票成功，¥${refund.toFixed(2)} 已原路退回`);
});

/* 改签：更换场次/座位（同影片、开场前 2 小时） */
router.post('/orders/:id/reschedule', authRequired, (req, res) => {
  const order = get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!order) return fail(res, 404, '订单不存在');
  if (order.status !== 'paid' && order.status !== 'changed') return fail(res, 400, '当前订单状态不支持改签');
  const oldShowtime = loadShowtime(order.showtime_id);
  if ((parseLocal(oldShowtime.start_time).getTime() - Date.now()) / 3600000 <= 2) {
    return fail(res, 400, '距原场次开场不足 2 小时，无法改签');
  }
  const { showtimeId, seatIds } = req.body || {};
  const newShowtime = loadShowtime(showtimeId);
  if (!newShowtime) return fail(res, 404, '目标场次不存在');
  if (newShowtime.movie_id !== oldShowtime.movie_id) return fail(res, 400, '改签仅支持同一部影片的其他场次');
  if (!assertFuture(newShowtime)) return fail(res, 400, '目标场次已开场');
  if (Number(newShowtime.id) === Number(oldShowtime.id)) return fail(res, 400, '目标场次与原场次相同');

  const oldTickets = all('SELECT * FROM tickets WHERE order_id = ? AND status = ?', [order.id, 'valid']);
  const { error, seats, unique } = validateSeats(newShowtime, seatIds);
  if (error) return fail(res, 400, error);
  if (seats.length !== oldTickets.length) return fail(res, 400, `改签需选择 ${oldTickets.length} 个座位`);

  const placeholders = unique.map(() => '?').join(',');
  const sold = all(
    `SELECT seat_id FROM tickets WHERE showtime_id = ? AND status = 'valid' AND seat_id IN (${placeholders})`,
    [newShowtime.id, ...unique]
  );
  if (sold.length) return fail(res, 409, '目标座位已被购买，请重新选择');

  const newTotal = Math.round(seats.reduce((sum, s) => sum + priceForSeat(newShowtime.base_price, s.type), 0) * 100) / 100;
  const diff = Math.round((newTotal - order.total_amount) * 100) / 100;

  transaction(() => {
    run("UPDATE tickets SET status = 'changed' WHERE order_id = ? AND status = 'valid'", [order.id]);
    for (const seat of seats) {
      run(
        "INSERT INTO tickets (order_id, showtime_id, seat_id, price, status) VALUES (?, ?, ?, ?, 'valid')",
        [order.id, newShowtime.id, seat.id, priceForSeat(newShowtime.base_price, seat.type)]
      );
    }
    run("UPDATE orders SET showtime_id = ?, total_amount = ?, status = 'changed' WHERE id = ?",
      [newShowtime.id, newTotal, order.id]);
    run('INSERT INTO order_logs (order_id, action, detail) VALUES (?, ?, ?)', [
      order.id, 'reschedule',
      `改签至 ${newShowtime.start_time} ${newShowtime.cinema_name} ${newShowtime.hall_name}，座位 ${seats.map((s) => s.seat_no).join('、')}，差价 ¥${diff.toFixed(2)}`,
    ]);
  });
  return ok(res, { newTotal, diff, orderId: order.id },
    diff > 0 ? `改签成功，需补差价 ¥${diff.toFixed(2)}（已模拟支付）` : `改签成功${diff < 0 ? `，退还差价 ¥${Math.abs(diff).toFixed(2)}` : ''}`);
});

/* 电子票二维码 */
router.get('/orders/:id/ticket', authRequired, async (req, res) => {
  const order = get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return fail(res, 404, '订单不存在');
  if (order.user_id !== req.user.id && req.user.role !== 'admin') return fail(res, 403, '无权查看该订单');
  if (!['paid', 'changed'].includes(order.status)) return fail(res, 400, '仅已支付订单可查看电子票');
  const data = await buildTicketQr(order.id);
  return ok(res, data);
});

module.exports = router;
