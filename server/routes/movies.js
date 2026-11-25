/** 电影信息：列表 / 详情 / 增删改查（管理员） */
const express = require('express');
const { all, get, run, transaction } = require('../db');
const { adminRequired, optionalAuth } = require('../auth');
const { ok, fail, camel } = require('../respond');

const router = express.Router();

const BASE_SELECT = `
  SELECT m.*,
    ROUND(COALESCE(AVG(c.rating), 0), 1) AS rating,
    COUNT(DISTINCT c.id) AS comment_count,
    COALESCE((
      SELECT SUM(o.total_amount)
      FROM orders o JOIN showtimes s ON s.id = o.showtime_id
      WHERE s.movie_id = m.id AND o.status IN ('paid', 'changed')
    ), 0) AS box_office,
    (SELECT COUNT(*) FROM favorites f WHERE f.movie_id = m.id) AS favorite_count
  FROM movies m
  LEFT JOIN comments c ON c.movie_id = m.id
`;

/* 电影列表：支持分类、关键词搜索、排序、分页 */
router.get('/', optionalAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 12));
  const where = [];
  const params = [];

  if (req.query.status && ['showing', 'upcoming', 'offline'].includes(req.query.status)) {
    where.push('m.status = ?');
    params.push(req.query.status);
  }
  if (req.query.keyword) {
    where.push('(m.title LIKE ? OR m.original_title LIKE ? OR m.director LIKE ? OR m.genre LIKE ?)');
    const kw = `%${req.query.keyword.trim()}%`;
    params.push(kw, kw, kw, kw);
  }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const sortMap = {
    hot: 'm.is_hot DESC, box_office DESC, rating DESC',
    score: 'rating DESC, box_office DESC',
    release: 'm.release_date DESC',
    boxoffice: 'box_office DESC',
  };
  const orderBy = sortMap[req.query.sort] || sortMap.hot;

  const rows = all(
    `${BASE_SELECT}${whereSql} GROUP BY m.id ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  const total = get(`SELECT COUNT(*) n FROM movies m${whereSql}`, params).n;

  let favIds = [];
  if (req.user) {
    favIds = all('SELECT movie_id FROM favorites WHERE user_id = ?', [req.user.id]).map((r) => r.movie_id);
  }

  return ok(res, {
    list: rows.map((r) => ({ ...camel(r), isFavorite: favIds.includes(r.id) })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

/* 票房榜 */
router.get('/ranking', (_req, res) => {
  const rows = all(`${BASE_SELECT} WHERE m.status = 'showing' GROUP BY m.id ORDER BY box_office DESC, rating DESC LIMIT 6`);
  return ok(res, camel(rows));
});

/* 电影详情（含演职人员） */
router.get('/:id', optionalAuth, (req, res) => {
  const movie = get(`${BASE_SELECT} WHERE m.id = ? GROUP BY m.id`, [req.params.id]);
  if (!movie) return fail(res, 404, '影片不存在');
  const cast = all('SELECT * FROM movie_cast WHERE movie_id = ? ORDER BY sort_order, id', [movie.id]);
  let isFavorite = false;
  if (req.user) {
    isFavorite = !!get('SELECT id FROM favorites WHERE user_id = ? AND movie_id = ?', [req.user.id, movie.id]);
  }
  const showtimeCount = get(
    'SELECT COUNT(*) n FROM showtimes WHERE movie_id = ? AND start_time >= datetime(\'now\', \'localtime\')',
    [movie.id]
  ).n;
  return ok(res, { ...camel(movie), cast: camel(cast), isFavorite, showtimeCount });
});

/* 新增电影（管理员） */
router.post('/', adminRequired, (req, res) => {
  const b = req.body || {};
  if (!b.title) return fail(res, 400, '影片名称不能为空');
  if (!b.duration || Number(b.duration) <= 0) return fail(res, 400, '片长必须大于 0');
  const status = ['showing', 'upcoming', 'offline'].includes(b.status) ? b.status : 'showing';

  const id = transaction(() => {
    const info = run(
      `INSERT INTO movies (title, original_title, poster, backdrop, trailer_url, duration, genre, language,
        release_date, status, synopsis, director, is_hot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.title.trim(), b.originalTitle || '', b.poster || '/assets/posters/p1.svg',
        b.backdrop || '/assets/backdrops/bd1.svg', b.trailerUrl || '', Number(b.duration),
        b.genre || '', b.language || '国语', b.releaseDate || '', status,
        b.synopsis || '', b.director || '', b.isHot ? 1 : 0,
      ]
    );
    const movieId = Number(info.lastInsertRowid);
    if (Array.isArray(b.cast)) {
      b.cast.filter((c) => c && c.name).forEach((c, i) => {
        run('INSERT INTO movie_cast (movie_id, name, role_name, sort_order) VALUES (?, ?, ?, ?)',
          [movieId, c.name, c.roleName || '演员', i]);
      });
    }
    return movieId;
  });
  return ok(res, { id }, '影片已创建');
});

/* 编辑电影（管理员） */
router.put('/:id', adminRequired, (req, res) => {
  const movie = get('SELECT * FROM movies WHERE id = ?', [req.params.id]);
  if (!movie) return fail(res, 404, '影片不存在');
  const b = req.body || {};
  if (!b.title) return fail(res, 400, '影片名称不能为空');

  transaction(() => {
    run(
      `UPDATE movies SET title = ?, original_title = ?, poster = ?, backdrop = ?, trailer_url = ?,
        duration = ?, genre = ?, language = ?, release_date = ?, status = ?, synopsis = ?,
        director = ?, is_hot = ? WHERE id = ?`,
      [
        b.title.trim(), b.originalTitle ?? movie.original_title, b.poster ?? movie.poster,
        b.backdrop ?? movie.backdrop, b.trailerUrl ?? movie.trailer_url,
        Number(b.duration) || movie.duration, b.genre ?? movie.genre,
        b.language ?? movie.language, b.releaseDate ?? movie.release_date,
        ['showing', 'upcoming', 'offline'].includes(b.status) ? b.status : movie.status,
        b.synopsis ?? movie.synopsis, b.director ?? movie.director,
        b.isHot ? 1 : 0, movie.id,
      ]
    );
    if (Array.isArray(b.cast)) {
      run('DELETE FROM movie_cast WHERE movie_id = ?', [movie.id]);
      b.cast.filter((c) => c && c.name).forEach((c, i) => {
        run('INSERT INTO movie_cast (movie_id, name, role_name, sort_order) VALUES (?, ?, ?, ?)',
          [movie.id, c.name, c.roleName || '演员', i]);
      });
    }
  });
  return ok(res, { id: movie.id }, '影片信息已更新');
});

/* 删除电影（管理员）：存在订单时禁止物理删除 */
router.delete('/:id', adminRequired, (req, res) => {
  const movie = get('SELECT * FROM movies WHERE id = ?', [req.params.id]);
  if (!movie) return fail(res, 404, '影片不存在');
  const orderCount = get(
    `SELECT COUNT(*) n FROM orders o
     JOIN showtimes s ON s.id = o.showtime_id WHERE s.movie_id = ?`,
    [movie.id]
  ).n;
  if (orderCount > 0) {
    return fail(res, 400, `该影片已产生 ${orderCount} 笔订单，无法删除，请将其状态改为「已下线」`);
  }
  run('DELETE FROM movies WHERE id = ?', [movie.id]);
  return ok(res, null, '影片已删除');
});

module.exports = router;
