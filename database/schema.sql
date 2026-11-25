-- ============================================================
-- CineMax 在线电影购票系统 - SQLite 数据库结构
-- 共 12 张表，覆盖用户、影片、影院、影厅、座位、场次、订单、
-- 影票、座位锁定、评论、收藏、轮播、订单日志
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. 用户表（普通用户 / 影院管理员）
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  password    TEXT    NOT NULL,                         -- scrypt 加盐哈希
  nickname    TEXT    NOT NULL,
  phone       TEXT,
  avatar      TEXT,
  role        TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 2. 电影表
CREATE TABLE IF NOT EXISTS movies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT    NOT NULL,
  original_title TEXT,
  poster         TEXT,                                  -- 海报路径
  backdrop       TEXT,                                  -- 详情页背景图
  trailer_url    TEXT,                                  -- 预告片地址
  duration       INTEGER NOT NULL DEFAULT 120,          -- 片长（分钟）
  genre          TEXT,                                  -- 类型，逗号分隔
  language       TEXT    NOT NULL DEFAULT '国语',
  release_date   TEXT,
  status         TEXT    NOT NULL DEFAULT 'showing'
                 CHECK (status IN ('showing', 'upcoming', 'offline')),
  synopsis       TEXT,
  director       TEXT,
  is_hot         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 3. 演职人员表（电影 1:N 演职人员）
CREATE TABLE IF NOT EXISTS movie_cast (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  role_name  TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cast_movie ON movie_cast(movie_id);

-- 4. 影院表
CREATE TABLE IF NOT EXISTS cinemas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  district   TEXT    NOT NULL,
  address    TEXT    NOT NULL,
  phone      TEXT,
  facilities TEXT,                                      -- 特色：IMAX、杜比全景声…
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 5. 影厅表（影院 1:N 影厅）
CREATE TABLE IF NOT EXISTS halls (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cinema_id   INTEGER NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  rows        INTEGER NOT NULL DEFAULT 8,
  cols        INTEGER NOT NULL DEFAULT 12,
  screen_type TEXT    NOT NULL DEFAULT '普通厅',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_hall_cinema ON halls(cinema_id);

-- 6. 座位表（影厅 1:N 座位，座位布局）
CREATE TABLE IF NOT EXISTS seats (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  hall_id INTEGER NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
  row_no  INTEGER NOT NULL,
  col_no  INTEGER NOT NULL,
  seat_no TEXT    NOT NULL,
  type    TEXT    NOT NULL DEFAULT 'normal'
          CHECK (type IN ('normal', 'vip', 'couple')),
  UNIQUE (hall_id, row_no, col_no)
);
CREATE INDEX IF NOT EXISTS idx_seat_hall ON seats(hall_id);

-- 7. 场次表（电影 + 影院 + 影厅 + 时间）
CREATE TABLE IF NOT EXISTS showtimes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id    INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  cinema_id   INTEGER NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
  hall_id     INTEGER NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
  start_time  TEXT    NOT NULL,                          -- YYYY-MM-DD HH:MM
  base_price  REAL    NOT NULL DEFAULT 39.9,
  version     TEXT    NOT NULL DEFAULT '2D',             -- 2D / 3D / IMAX
  language    TEXT    NOT NULL DEFAULT '国语',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_st_movie ON showtimes(movie_id);
CREATE INDEX IF NOT EXISTS idx_st_time ON showtimes(start_time);

-- 8. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no     TEXT    NOT NULL UNIQUE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  showtime_id  INTEGER NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  total_amount REAL    NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'unpaid'
               CHECK (status IN ('unpaid', 'paid', 'refunded', 'cancelled', 'changed')),
  pay_method   TEXT,                                     -- alipay / wechat / card
  ticket_code  TEXT,                                     -- 电子票取票码
  created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  paid_at      TEXT,
  refund_at    TEXT,
  expire_at    TEXT                                      -- 未支付订单自动关闭时间
);
CREATE INDEX IF NOT EXISTS idx_order_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);

-- 9. 影票表（订单 1:N 票，票对应具体场次座位）
CREATE TABLE IF NOT EXISTS tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  showtime_id INTEGER NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  seat_id     INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  price       REAL    NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'held'
              CHECK (status IN ('held', 'valid', 'refunded', 'changed'))
);
CREATE INDEX IF NOT EXISTS idx_ticket_order ON tickets(order_id);
-- 同一场次的同一座位，只允许一张「已锁定/已售出」的票（防止重复售卖）
CREATE UNIQUE INDEX IF NOT EXISTS ux_ticket_seat_active
  ON tickets(showtime_id, seat_id) WHERE status IN ('held', 'valid');

-- 10. 座位锁定表（选座后 15 分钟内有效，超时释放）
CREATE TABLE IF NOT EXISTS seat_locks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  showtime_id INTEGER NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  seat_id     INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (showtime_id, seat_id)
);

-- 11. 评论评分表
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_comment_movie ON comments(movie_id);

-- 12. 收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (user_id, movie_id)
);

-- 13. 轮播广告位表
CREATE TABLE IF NOT EXISTS banners (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  title    TEXT    NOT NULL,
  subtitle TEXT,
  image    TEXT    NOT NULL,
  link     TEXT,
  sort_no  INTEGER NOT NULL DEFAULT 0,
  active   INTEGER NOT NULL DEFAULT 1
);

-- 14. 订单操作日志表（下单 / 支付 / 退票 / 改签）
CREATE TABLE IF NOT EXISTS order_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action     TEXT    NOT NULL,
  detail     TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_log_order ON order_logs(order_id);

-- 便于统计的视图：已支付订单票房
CREATE VIEW IF NOT EXISTS v_paid_orders AS
SELECT o.id, o.user_id, o.showtime_id, o.total_amount, o.paid_at, o.created_at,
       s.movie_id, s.cinema_id, s.start_time
FROM orders o
JOIN showtimes s ON s.id = o.showtime_id
WHERE o.status IN ('paid', 'changed');
