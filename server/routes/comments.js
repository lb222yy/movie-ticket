/** 评论与评分 */
const express = require('express');
const { all, get, run } = require('../db');
const { authRequired, optionalAuth, fmtDateTime } = require('../auth');
const { ok, fail, camel } = require('../respond');

const router = express.Router();

/* 某影片的评论列表 + 评分分布 */
router.get('/comments', optionalAuth, (req, res) => {
  const movieId = Number(req.query.movieId);
  if (!movieId) return fail(res, 400, '缺少影片 ID');
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));

  const total = get('SELECT COUNT(*) n FROM comments WHERE movie_id = ?', [movieId]).n;
  const rows = all(`
    SELECT c.*, u.nickname, u.username, u.avatar
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.movie_id = ?
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT ? OFFSET ?
  `, [movieId, pageSize, (page - 1) * pageSize]);

  const distRows = all('SELECT rating, COUNT(*) n FROM comments WHERE movie_id = ? GROUP BY rating', [movieId]);
  const distribution = {};
  for (let i = 1; i <= 10; i++) distribution[i] = 0;
  distRows.forEach((r) => { distribution[r.rating] = r.n; });
  const avg = get('SELECT ROUND(AVG(rating), 1) v, COUNT(*) n FROM comments WHERE movie_id = ?', [movieId]);

  let myRating = null;
  if (req.user) {
    const mine = get('SELECT rating FROM comments WHERE movie_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
      [movieId, req.user.id]);
    myRating = mine ? mine.rating : null;
  }

  return ok(res, {
    list: camel(rows), total, page, totalPages: Math.ceil(total / pageSize) || 1,
    average: avg.v || 0, count: avg.n, distribution, myRating,
  });
});

/* 发表评论 / 评分 */
router.post('/comments', authRequired, (req, res) => {
  const { movieId, rating, content } = req.body || {};
  const movie = get('SELECT id FROM movies WHERE id = ?', [movieId]);
  if (!movie) return fail(res, 404, '影片不存在');
  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 10) return fail(res, 400, '评分需为 1-10 的整数');
  const text = String(content || '').trim();
  if (text.length < 3) return fail(res, 400, '评论内容至少 3 个字');
  if (text.length > 500) return fail(res, 400, '评论内容不能超过 500 字');

  const existing = get('SELECT id FROM comments WHERE movie_id = ? AND user_id = ?', [movieId, req.user.id]);
  if (existing) {
    run('UPDATE comments SET rating = ?, content = ?, created_at = ? WHERE id = ?',
      [score, text, fmtDateTime(), existing.id]);
    return ok(res, { id: existing.id }, '已更新你的评分与评论');
  }
  const info = run('INSERT INTO comments (movie_id, user_id, rating, content) VALUES (?, ?, ?, ?)',
    [movieId, req.user.id, score, text]);
  return ok(res, { id: Number(info.lastInsertRowid) }, '评论发布成功');
});

/* 删除评论（作者本人或管理员） */
router.delete('/comments/:id', authRequired, (req, res) => {
  const c = get('SELECT * FROM comments WHERE id = ?', [req.params.id]);
  if (!c) return fail(res, 404, '评论不存在');
  if (c.user_id !== req.user.id && req.user.role !== 'admin') return fail(res, 403, '无权删除该评论');
  run('DELETE FROM comments WHERE id = ?', [c.id]);
  return ok(res, null, '评论已删除');
});

module.exports = router;
