/** 收藏与轮播广告位 */
const express = require('express');
const { all, get, run } = require('../db');
const { authRequired, adminRequired } = require('../auth');
const { ok, fail, camel } = require('../respond');

const router = express.Router();

/* 我的收藏 */
router.get('/favorites', authRequired, (req, res) => {
  const rows = all(`
    SELECT m.*, f.created_at AS favorited_at,
      ROUND(COALESCE((SELECT AVG(rating) FROM comments c WHERE c.movie_id = m.id), 0), 1) AS rating
    FROM favorites f JOIN movies m ON m.id = f.movie_id
    WHERE f.user_id = ? ORDER BY f.created_at DESC
  `, [req.user.id]);
  return ok(res, camel(rows).map((m) => ({ ...m, isFavorite: true })));
});

/* 收藏 */
router.post('/favorites/:movieId', authRequired, (req, res) => {
  const movie = get('SELECT id FROM movies WHERE id = ?', [req.params.movieId]);
  if (!movie) return fail(res, 404, '影片不存在');
  const exists = get('SELECT id FROM favorites WHERE user_id = ? AND movie_id = ?', [req.user.id, movie.id]);
  if (!exists) run('INSERT INTO favorites (user_id, movie_id) VALUES (?, ?)', [req.user.id, movie.id]);
  return ok(res, { favorite: true }, '已加入想看片单');
});

/* 取消收藏 */
router.delete('/favorites/:movieId', authRequired, (req, res) => {
  run('DELETE FROM favorites WHERE user_id = ? AND movie_id = ?', [req.user.id, req.params.movieId]);
  return ok(res, { favorite: false }, '已从想看片单移除');
});

/* 轮播广告位 */
router.get('/banners', (_req, res) => {
  const rows = all('SELECT * FROM banners WHERE active = 1 ORDER BY sort_no, id');
  return ok(res, camel(rows));
});

/* 管理端：轮播 CRUD */
router.get('/admin/banners', adminRequired, (_req, res) => {
  return ok(res, camel(all('SELECT * FROM banners ORDER BY sort_no, id')));
});

router.post('/admin/banners', adminRequired, (req, res) => {
  const { title, subtitle, image, link, sortNo, active } = req.body || {};
  if (!title || !image) return fail(res, 400, '标题与图片地址不能为空');
  const info = run('INSERT INTO banners (title, subtitle, image, link, sort_no, active) VALUES (?, ?, ?, ?, ?, ?)',
    [title, subtitle || '', image, link || '', Number(sortNo) || 0, active === 0 ? 0 : 1]);
  return ok(res, { id: Number(info.lastInsertRowid) }, '轮播已创建');
});

router.put('/admin/banners/:id', adminRequired, (req, res) => {
  const b = get('SELECT * FROM banners WHERE id = ?', [req.params.id]);
  if (!b) return fail(res, 404, '轮播不存在');
  const p = req.body || {};
  run('UPDATE banners SET title = ?, subtitle = ?, image = ?, link = ?, sort_no = ?, active = ? WHERE id = ?', [
    p.title || b.title, p.subtitle ?? b.subtitle, p.image || b.image, p.link ?? b.link,
    p.sortNo ?? b.sort_no, p.active === 0 ? 0 : 1, b.id,
  ]);
  return ok(res, { id: b.id }, '轮播已更新');
});

router.delete('/admin/banners/:id', adminRequired, (req, res) => {
  run('DELETE FROM banners WHERE id = ?', [req.params.id]);
  return ok(res, null, '轮播已删除');
});

module.exports = router;
