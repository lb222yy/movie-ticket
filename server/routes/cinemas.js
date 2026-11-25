/** 影院 / 影厅管理 */
const express = require('express');
const { all, get, run, transaction } = require('../db');
const { adminRequired } = require('../auth');
const { ok, fail, camel } = require('../respond');

const router = express.Router();

/* 影院列表（含影厅数） */
router.get('/cinemas', (_req, res) => {
  const rows = all(`
    SELECT c.*, (SELECT COUNT(*) FROM halls h WHERE h.cinema_id = c.id) AS hall_count
    FROM cinemas c ORDER BY c.id
  `);
  return ok(res, camel(rows));
});

/* 影院详情 + 影厅 */
router.get('/cinemas/:id', (req, res) => {
  const cinema = get('SELECT * FROM cinemas WHERE id = ?', [req.params.id]);
  if (!cinema) return fail(res, 404, '影院不存在');
  const halls = all('SELECT * FROM halls WHERE cinema_id = ? ORDER BY id', [cinema.id]);
  return ok(res, { ...camel(cinema), halls: camel(halls) });
});

/* 新增影院（管理员） */
router.post('/cinemas', adminRequired, (req, res) => {
  const { name, district, address, phone, facilities } = req.body || {};
  if (!name || !address) return fail(res, 400, '影院名称与地址不能为空');
  const info = run(
    'INSERT INTO cinemas (name, district, address, phone, facilities) VALUES (?, ?, ?, ?, ?)',
    [name, district || '', address, phone || '', facilities || '']
  );
  return ok(res, { id: Number(info.lastInsertRowid) }, '影院已创建');
});

/* 编辑影院（管理员） */
router.put('/cinemas/:id', adminRequired, (req, res) => {
  const c = get('SELECT * FROM cinemas WHERE id = ?', [req.params.id]);
  if (!c) return fail(res, 404, '影院不存在');
  const b = req.body || {};
  run('UPDATE cinemas SET name = ?, district = ?, address = ?, phone = ?, facilities = ? WHERE id = ?', [
    b.name || c.name, b.district ?? c.district, b.address || c.address, b.phone ?? c.phone, b.facilities ?? c.facilities, c.id,
  ]);
  return ok(res, { id: c.id }, '影院信息已更新');
});

/* 删除影院（管理员）：有订单时禁止 */
router.delete('/cinemas/:id', adminRequired, (req, res) => {
  const c = get('SELECT * FROM cinemas WHERE id = ?', [req.params.id]);
  if (!c) return fail(res, 404, '影院不存在');
  const n = get(
    `SELECT COUNT(*) n FROM orders o JOIN showtimes s ON s.id = o.showtime_id WHERE s.cinema_id = ?`,
    [c.id]
  ).n;
  if (n > 0) return fail(res, 400, '该影院已有订单记录，无法删除');
  run('DELETE FROM cinemas WHERE id = ?', [c.id]);
  return ok(res, null, '影院已删除');
});

/* 某影院的影厅列表 */
router.get('/cinemas/:id/halls', (req, res) => {
  const halls = all('SELECT * FROM halls WHERE cinema_id = ? ORDER BY id', [req.params.id]);
  return ok(res, camel(halls));
});

/* 影厅座位布局 */
router.get('/halls/:id/seats', (req, res) => {
  const hall = get('SELECT * FROM halls WHERE id = ?', [req.params.id]);
  if (!hall) return fail(res, 404, '影厅不存在');
  const seats = all('SELECT * FROM seats WHERE hall_id = ? ORDER BY row_no, col_no', [hall.id]);
  return ok(res, { hall: camel(hall), seats: camel(seats) });
});

function generateSeats(hallId, rows, cols) {
  const insert = `INSERT INTO seats (hall_id, row_no, col_no, seat_no, type) VALUES (?, ?, ?, ?, ?)`;
  const midStart = Math.max(2, Math.floor(rows / 2) - 1);
  const midEnd = Math.min(rows - 1, midStart + 2);
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      let type = 'normal';
      if (rows >= 8 && r === rows) type = 'couple';
      else if (r >= midStart && r <= midEnd && c > 2 && c < cols - 1) type = 'vip';
      run(insert, [hallId, r, c, `${r}排${c}座`, type]);
    }
  }
}

/* 新增影厅（管理员）：自动生成座位布局 */
router.post('/halls', adminRequired, (req, res) => {
  const { cinemaId, name, rows, cols, screenType } = req.body || {};
  if (!cinemaId || !get('SELECT id FROM cinemas WHERE id = ?', [cinemaId])) return fail(res, 400, '请选择有效影院');
  if (!name) return fail(res, 400, '影厅名称不能为空');
  const r = Math.min(20, Math.max(4, Number(rows) || 8));
  const c = Math.min(24, Math.max(6, Number(cols) || 12));
  const id = transaction(() => {
    const info = run('INSERT INTO halls (cinema_id, name, rows, cols, screen_type) VALUES (?, ?, ?, ?, ?)',
      [cinemaId, name, r, c, screenType || '普通厅']);
    generateSeats(Number(info.lastInsertRowid), r, c);
    return Number(info.lastInsertRowid);
  });
  return ok(res, { id }, '影厅已创建，座位布局已生成');
});

/* 编辑影厅（管理员）：尺寸变化时重建座位（需无售票） */
router.put('/halls/:id', adminRequired, (req, res) => {
  const hall = get('SELECT * FROM halls WHERE id = ?', [req.params.id]);
  if (!hall) return fail(res, 404, '影厅不存在');
  const b = req.body || {};
  const rows = Math.min(20, Math.max(4, Number(b.rows) || hall.rows));
  const cols = Math.min(24, Math.max(6, Number(b.cols) || hall.cols));
  const sizeChanged = rows !== hall.rows || cols !== hall.cols;
  if (sizeChanged) {
    const sold = get(
      `SELECT COUNT(*) n FROM tickets t JOIN seats s ON s.id = t.seat_id
       WHERE s.hall_id = ? AND t.status IN ('valid', 'held')`,
      [hall.id]
    ).n;
    if (sold > 0) return fail(res, 400, '该影厅已售出影票，无法调整座位规模');
  }
  transaction(() => {
    run('UPDATE halls SET name = ?, rows = ?, cols = ?, screen_type = ? WHERE id = ?', [
      b.name || hall.name, rows, cols, b.screenType || hall.screen_type, hall.id,
    ]);
    if (sizeChanged) {
      run('DELETE FROM seats WHERE hall_id = ?', [hall.id]);
      generateSeats(hall.id, rows, cols);
    }
  });
  return ok(res, { id: hall.id }, '影厅信息已更新');
});

/* 删除影厅（管理员） */
router.delete('/halls/:id', adminRequired, (req, res) => {
  const hall = get('SELECT * FROM halls WHERE id = ?', [req.params.id]);
  if (!hall) return fail(res, 404, '影厅不存在');
  const n = get(
    `SELECT COUNT(*) n FROM orders o JOIN showtimes s ON s.id = o.showtime_id WHERE s.hall_id = ?`,
    [hall.id]
  ).n;
  if (n > 0) return fail(res, 400, '该影厅已有订单记录，无法删除');
  run('DELETE FROM halls WHERE id = ?', [hall.id]);
  return ok(res, null, '影厅已删除');
});

module.exports = router;
