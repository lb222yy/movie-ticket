/**
 * 把爬取到的豆瓣影片数据写入数据库
 * 供 scripts/crawl-douban.js --apply 与 server/seed.js 复用
 *
 * 替换策略：按影片 id 顺序原位替换，保持场次 / 订单 / 收藏等外键关系不变
 */
const { all, run, transaction } = require('./db');

const FALLBACK_TRAILER = 'https://www.w3schools.com/html/mov_bbb.mp4';

function cleanOriginalTitle(movie) {
  const t = (movie.originalTitle || '').trim();
  if (!t || t === movie.title) return '';
  return t.slice(0, 90);
}

function applyDoubanMovies(movies) {
  if (!Array.isArray(movies) || !movies.length) return 0;

  const seeded = all('SELECT * FROM movies ORDER BY id');
  if (!seeded.length) return 0;

  const users = all("SELECT id FROM users WHERE role = 'user' ORDER BY id");
  const banners = all('SELECT id FROM banners ORDER BY sort_no');
  let updated = 0;

  transaction(() => {
    seeded.forEach((old, index) => {
      const m = movies[index];
      if (!m) return;
      const isShowing = m.status === 'showing';

      run(
        `UPDATE movies SET title = ?, original_title = ?, poster = ?, backdrop = ?, trailer_url = ?,
           duration = ?, genre = ?, language = ?, release_date = ?, status = ?, synopsis = ?,
           director = ?, is_hot = ? WHERE id = ?`,
        [
          m.title,
          cleanOriginalTitle(m),
          m.poster || old.poster,
          m.backdrop || m.poster || old.backdrop,
          m.trailer || old.trailer_url || FALLBACK_TRAILER,
          m.duration,
          (m.genres || []).join(','),
          (m.languages || [])[0] || '国语',
          m.releaseDate,
          m.status,
          m.intro,
          (m.directors || [])[0] || '',
          isShowing && index < 4 ? 1 : 0,
          old.id,
        ]
      );

      // 演职人员
      run('DELETE FROM movie_cast WHERE movie_id = ?', [old.id]);
      const cast = [];
      if (m.directors && m.directors[0]) cast.push([m.directors[0], '导演']);
      if (m.directors && m.directors[1]) cast.push([m.directors[1], '导演']);
      (m.actors || []).slice(0, 6).forEach((name) => cast.push([name, '主演']));
      cast.forEach(([name, role], i) => {
        run('INSERT INTO movie_cast (movie_id, name, role_name, sort_order) VALUES (?, ?, ?, ?)', [
          old.id,
          name,
          role,
          i,
        ]);
      });

      // 真实短评（评分由评论均值计算）
      if ((m.comments || []).length && users.length) {
        run('DELETE FROM comments WHERE movie_id = ?', [old.id]);
        m.comments.forEach((c, i) => {
          const uid = users[(index + i) % users.length].id;
          run('INSERT INTO comments (movie_id, user_id, rating, content) VALUES (?, ?, ?, ?)', [
            old.id,
            uid,
            Math.min(5, Math.max(1, c.rating || 4)),
            c.content,
          ]);
        });
      }

      m.movieId = old.id;
      updated++;
    });

    // 首页轮播改为真实影片（使用剧照作横幅）
    banners.slice(0, 3).forEach((b, i) => {
      const m = movies[i];
      if (!m) return;
      const image = m.backdrop || m.poster;
      const subtitle = [(m.genres || []).slice(0, 2).join(' / '), `${m.year || ''} 年`, (m.countries || [])[0] || '']
        .filter(Boolean)
        .join(' · ');
      run('UPDATE banners SET title = ?, subtitle = ?, image = ? WHERE id = ?', [m.title, subtitle, image || '', b.id]);
    });
  });

  return updated;
}

module.exports = { applyDoubanMovies };
