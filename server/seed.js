/**
 * 初始化数据库并写入演示数据
 * 用法：npm run init-db   （会重建所有数据）
 */
const fs = require('node:fs');
const path = require('node:path');
const { db, initSchema, all, get, run, transaction } = require('./db');
const { hashPassword, fmtDateTime, fmtDate, addMinutes } = require('./auth');

const pad = (n) => String(n).padStart(2, '0');

function dateStr(offsetDays = 0, hour = 0, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return `${fmtDate(d)} ${pad(hour)}:${pad(minute)}`;
}

/* ------------------------------ 电影 ------------------------------ */
const MOVIES = [
  {
    title: '星际迷航：回声',
    original_title: 'ECHOES OF THE VOID',
    poster: '/assets/posters/p1.svg',
    backdrop: '/assets/backdrops/bd1.svg',
    trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: 142,
    genre: '科幻,冒险',
    language: '英语',
    release_date: '2026-11-14',
    status: 'showing',
    is_hot: 1,
    director: '陆沉舟',
    synopsis:
      '公元 2197 年，深空监听站「回声」接收到一段来自宇宙边界的自白信号。信号里说话的人，竟然是三十年前失联的领航员——也是舰长顾行的父亲。为了揭开真相，顾行带着一支临时组建的小队，驾驶「长夜号」穿越从未有人返回的静默带。当飞船驶入黑暗深处，他们发现，回声并不是求救，而是一句迟到了三十年的告别。',
    cast: [
      ['顾行', '饰 舰长'],
      ['沈知夏', '饰 通讯官'],
      ['周野', '饰 领航员'],
      ['白鲸', '饰 舰载 AI'],
      ['许南星', '饰 医生'],
    ],
  },
  {
    title: '长安诗行',
    original_title: 'POEMS OF CHANGAN',
    poster: '/assets/posters/p2.svg',
    backdrop: '/assets/backdrops/bd2.svg',
    trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: 128,
    genre: '动画,历史',
    language: '国语',
    release_date: '2026-11-08',
    status: 'showing',
    is_hot: 1,
    director: '苏墨白',
    synopsis:
      '天宝年间，少年书童阿砚在长安城的旧书肆里遇见了一位落魄诗人。诗人说，他要把这座城的月光、酒香与离愁，都写进一首没有结尾的诗里。四十年后，战火焚城，阿砚带着那卷残稿一路向南。他渐渐明白，诗行里写的从来不是长安，而是每一个回不去故乡的人。',
    cast: [
      ['阿砚', '配音'],
      ['李十二', '配音'],
      ['裴七娘', '配音'],
      ['老书肆主人', '配音'],
    ],
  },
  {
    title: '暗夜追凶',
    original_title: 'NIGHT CHASE',
    poster: '/assets/posters/p3.svg',
    backdrop: '/assets/backdrops/bd3.svg',
    trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: 118,
    genre: '犯罪,悬疑',
    language: '国语',
    release_date: '2026-11-18',
    status: 'showing',
    is_hot: 1,
    director: '韩燧',
    synopsis:
      '连续七起案件，现场都只留下同一张被撕去一半的旧照片。刑警队长程岸在追查中意外发现，照片上模糊的少年，竟是十年前自己亲手送进少管所的搭档。法医报告、监控盲区、被篡改的时间线，真相像一条在雨夜里打滑的车辙。当最后一枚指纹指向警局内部，程岸必须在职业与旧情之间做出选择。',
    cast: [
      ['程岸', '饰 刑警队长'],
      ['江疑', '饰 法医'],
      ['许听寒', '饰 记者'],
      ['老 K', '饰 线人'],
    ],
  },
  {
    title: '夏日信箱',
    original_title: 'SUMMER MAILBOX',
    poster: '/assets/posters/p4.svg',
    backdrop: '/assets/backdrops/bd4.svg',
    trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: 112,
    genre: '爱情,剧情',
    language: '国语',
    release_date: '2026-11-01',
    status: 'showing',
    is_hot: 0,
    director: '林栀',
    synopsis:
      '海边小城的旧邮局要拆迁了，实习生钟晚在整理无人认领的信件时，发现了一个持续寄了十二年的收件人：已经搬走的少年陆屿。她开始按信封上的地址回信，没想到每一封都收到了回复。夏天快要结束的时候，钟晚终于意识到，回信的人一直住在隔壁，也一直在等一个人先开口。',
    cast: [
      ['钟晚', '饰 实习生'],
      ['陆屿', '饰 少年'],
      ['阿婆', '饰 邮局老员工'],
    ],
  },
  {
    title: '深蓝行动',
    original_title: 'OPERATION DEEP BLUE',
    poster: '/assets/posters/p5.svg',
    backdrop: '/assets/backdrops/bd5.svg',
    trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: 136,
    genre: '动作,战争',
    language: '国语',
    release_date: '2026-11-20',
    status: 'showing',
    is_hot: 1,
    director: '赵破军',
    synopsis:
      '一次跨国撤侨行动中，海军特勤小队「深蓝」被切断通讯，困在港口城市的地下管网中。队长江彻带着仅剩的五名队员，在 36 小时内必须护送两百余名同胞穿过战区。弹药、氧气、信任都在倒计时中耗尽，而最深的那片蓝，藏着一个不能公开的坐标。',
    cast: [
      ['江彻', '饰 队长'],
      ['雷小满', '饰 爆破手'],
      ['陈砚', '饰 军医'],
      ['乔治', '饰 翻译'],
    ],
  },
  {
    title: '猫猫特工队',
    original_title: 'PAW AGENTS',
    poster: '/assets/posters/p6.svg',
    backdrop: '/assets/backdrops/bd6.svg',
    trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: 95,
    genre: '动画,喜剧',
    language: '国语',
    release_date: '2026-11-15',
    status: 'showing',
    is_hot: 0,
    director: '米团',
    synopsis:
      '城市里最懒的三只猫，误打误撞加入了秘密特工组织「鱼骨局」。它们的任务是从一只会说话的鹦鹉手里夺回被偷走的城市钟声。可这三只猫有一个致命弱点：只要听见开罐头的声音，就会瞬间忘记任务。一场关于罐头、毛线球和友情的爆笑行动，就此开始。',
    cast: [
      ['大橘', '配音'],
      ['煤球', '配音'],
      ['布丁', '配音'],
      ['鹦鹉老板', '配音'],
    ],
  },
  {
    title: '时间褶皱',
    original_title: 'THE FOLD',
    poster: '/assets/posters/p7.svg',
    backdrop: '/assets/backdrops/bd7.svg',
    trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: 124,
    genre: '科幻,悬疑',
    language: '英语',
    release_date: '2026-12-05',
    status: 'upcoming',
    is_hot: 0,
    director: '纪野',
    synopsis:
      '物理学家温以宁在一次实验事故后，发现自己每天醒来都会回到同一个早晨。唯一不同的是，城市里多了一个没有人记得的人。为了找到时间的褶皱，她开始记录每一秒的偏差，也逐渐发现，造成这一切的人正是未来的自己。',
    cast: [
      ['温以宁', '饰 物理学家'],
      ['顾南', '饰 记者'],
      ['时间管理员', '饰 未知'],
    ],
  },
  {
    title: '雪国列车：重启',
    original_title: 'SNOWPIERCER: REBOOT',
    poster: '/assets/posters/p8.svg',
    backdrop: '/assets/backdrops/bd8.svg',
    trailer_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: 130,
    genre: '剧情,灾难',
    language: '英语',
    release_date: '2026-12-12',
    status: 'upcoming',
    is_hot: 0,
    director: '安德烈·柯',
    synopsis:
      '冰封纪元第 27 年，最后一列永动列车在雪原上孤独巡行。末节车厢的少年拾到一枚不属于任何车厢的钥匙，钥匙背面刻着「车头之外还有春天」。当秩序与生存再次对峙，一场从车尾到车头的逆行，重新启动。',
    cast: [
      ['伊万', '饰 少年'],
      ['梅森', '饰 列车长'],
      ['娜佳', '饰 机械师'],
    ],
  },
];

/* ------------------------------ 影院与影厅 ------------------------------ */
const CINEMAS = [
  {
    name: '万达影城 · 国贸店',
    district: '朝阳区',
    address: '建国路 88 号 SOHO 现代城 B1',
    phone: '010-8572-6688',
    facilities: 'IMAX,杜比全景声,免费停车',
    halls: [
      { name: '1 号 IMAX 厅', rows: 10, cols: 16, screen_type: 'IMAX 厅' },
      { name: '2 号杜比厅', rows: 9, cols: 14, screen_type: '杜比全景声厅' },
      { name: '3 号激光厅', rows: 8, cols: 12, screen_type: '激光厅' },
    ],
  },
  {
    name: 'CGV 影城 · 万象城',
    district: '浦东新区',
    address: '张杨路 500 号万象城 5F',
    phone: '021-5899-1122',
    facilities: '4DX,亲子厅,地铁直达',
    halls: [
      { name: '1 号 4DX 厅', rows: 9, cols: 14, screen_type: '4DX 厅' },
      { name: '2 号星空厅', rows: 8, cols: 12, screen_type: '普通厅' },
    ],
  },
  {
    name: '星河影城 · 大学城',
    district: '海淀区',
    address: '中关村大街 27 号 3F',
    phone: '010-6255-7788',
    facilities: '学生优惠,巨幕,咖啡吧',
    halls: [
      { name: '1 号巨幕厅', rows: 10, cols: 16, screen_type: '巨幕厅' },
      { name: '2 号厅', rows: 8, cols: 12, screen_type: '普通厅' },
    ],
  },
  {
    name: '博纳国际影城 · 滨江店',
    district: '滨江区',
    address: '江南大道 1288 号星光大道 4F',
    phone: '0571-8666-3300',
    facilities: '情侣座,IMAX,会员日',
    halls: [
      { name: '1 号 IMAX 厅', rows: 10, cols: 16, screen_type: 'IMAX 厅' },
      { name: '2 号厅', rows: 6, cols: 10, screen_type: '普通厅' },
    ],
  },
];

const COMMENTS = [
  ['星际迷航：回声', 'demo', 9, '视听效果炸裂，静默带那一段几乎屏住呼吸。父子线的收尾很克制，反而更戳人。'],
  ['星际迷航：回声', 'xiaoyu', 8, '科幻外壳下是很温柔的故事，舰载 AI 的冷笑话意外好笑。'],
  ['星际迷航：回声', 'chenmo', 10, '今年最好的一次大银幕体验，建议直接 IMAX。'],
  ['长安诗行', 'demo', 9, '水墨和光影结合得太漂亮了，最后一个镜头眼眶有点热。'],
  ['长安诗行', 'aqi', 8, '节奏略慢但很耐看，诗句念出来的那刻值回票价。'],
  ['暗夜追凶', 'chenmo', 9, '雨夜追车那段一镜到底，音效把紧张感拉满。'],
  ['暗夜追凶', 'xiaoyu', 7, '反转有惊喜，结尾稍仓促。'],
  ['夏日信箱', 'xiaoyu', 8, '很轻很干净的夏天，看完想去海边寄一封信。'],
  ['夏日信箱', 'demo', 7, '情节简单但氛围感很好，适合约会。'],
  ['深蓝行动', 'chenmo', 8, '动作场面扎实，群像塑造比预想的好。'],
  ['深蓝行动', 'aqi', 7, '中段稍显拖，但撤侨段落很燃。'],
  ['猫猫特工队', 'xiaoyu', 9, '全场小朋友笑成一片，大人也看得很开心。'],
  ['猫猫特工队', 'aqi', 8, '三只猫的性格太鲜明了，罐头梗笑死。'],
];

function createSeats(hallId, rows, cols) {
  const insert = db.prepare(
    'INSERT INTO seats (hall_id, row_no, col_no, seat_no, type) VALUES (?, ?, ?, ?, ?)'
  );
  const midStart = Math.max(2, Math.floor(rows / 2) - 1);
  const midEnd = Math.min(rows - 1, midStart + 2);
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      let type = 'normal';
      if (rows >= 8 && r === rows) type = 'couple';
      else if (r >= midStart && r <= midEnd && c > 2 && c < cols - 1) type = 'vip';
      insert.run(hallId, r, c, `${r}排${c}座`, type);
    }
  }
}

function seed() {
  console.log('▶ 重建数据库表结构…');
  db.exec('PRAGMA foreign_keys = OFF;');
  const tables = [
    'order_logs', 'tickets', 'seat_locks', 'orders', 'comments', 'favorites',
    'showtimes', 'seats', 'halls', 'cinemas', 'movie_cast', 'movies', 'banners', 'users',
  ];
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS ${t};`);
  db.exec('DROP VIEW IF EXISTS v_paid_orders;');
  db.exec('PRAGMA foreign_keys = ON;');
  initSchema();

  transaction(() => {
    /* 用户 */
    const insUser = db.prepare(
      'INSERT INTO users (username, password, nickname, phone, role) VALUES (?, ?, ?, ?, ?)'
    );
    insUser.run('admin', hashPassword('admin123'), '影院管理员', '13800000001', 'admin');
    insUser.run('demo', hashPassword('demo123'), '影迷小北', '13800000002', 'user');
    insUser.run('xiaoyu', hashPassword('123456'), '林小雨', '13800000003', 'user');
    insUser.run('chenmo', hashPassword('123456'), '陈默', '13800000004', 'user');
    insUser.run('aqi', hashPassword('123456'), '阿七', '13800000005', 'user');

    /* 电影 + 演职人员 */
    const insMovie = db.prepare(`
      INSERT INTO movies (title, original_title, poster, backdrop, trailer_url, duration, genre,
        language, release_date, status, synopsis, director, is_hot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insCast = db.prepare(
      'INSERT INTO movie_cast (movie_id, name, role_name, sort_order) VALUES (?, ?, ?, ?)'
    );
    for (const m of MOVIES) {
      const info = insMovie.run(
        m.title, m.original_title, m.poster, m.backdrop, m.trailer_url, m.duration,
        m.genre, m.language, m.release_date, m.status, m.synopsis, m.director, m.is_hot
      );
      m.cast.forEach((c, i) => insCast.run(info.lastInsertRowid, c[0], c[1], i));
    }

    /* 影院 + 影厅 + 座位 */
    const insCinema = db.prepare(
      'INSERT INTO cinemas (name, district, address, phone, facilities) VALUES (?, ?, ?, ?, ?)'
    );
    const insHall = db.prepare(
      'INSERT INTO halls (cinema_id, name, rows, cols, screen_type) VALUES (?, ?, ?, ?, ?)'
    );
    for (const c of CINEMAS) {
      const info = insCinema.run(c.name, c.district, c.address, c.phone, c.facilities);
      for (const h of c.halls) {
        const hinfo = insHall.run(info.lastInsertRowid, h.name, h.rows, h.cols, h.screen_type);
        createSeats(hinfo.lastInsertRowid, h.rows, h.cols);
      }
    }

    /* 轮播广告位 */
    const insBanner = db.prepare(
      'INSERT INTO banners (title, subtitle, image, link, sort_no, active) VALUES (?, ?, ?, ?, ?, 1)'
    );
    insBanner.run('星际迷航：回声', '静默带之外，是三十年的等待 · IMAX 同步上映', '/assets/banners/bn1.svg', '/movie.html?id=1', 1);
    insBanner.run('深蓝行动', '36 小时，带所有人回家 · 热映中', '/assets/banners/bn2.svg', '/movie.html?id=5', 2);
    insBanner.run('长安诗行', '把一座城的月光写进诗里 · 口碑佳作', '/assets/banners/bn3.svg', '/movie.html?id=2', 3);

    /* 场次：今天起 4 天，每天多场 */
    const insShowtime = db.prepare(
      'INSERT INTO showtimes (movie_id, cinema_id, hall_id, start_time, base_price, version, language) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const cinemas = all('SELECT * FROM cinemas ORDER BY id');
    const halls = all('SELECT * FROM halls ORDER BY id');
    const showingMovies = all("SELECT * FROM movies WHERE status = 'showing' ORDER BY id");
    const times = ['10:20', '12:50', '15:30', '18:10', '20:40', '22:50'];
    const versions = ['2D', '3D', 'IMAX'];

    let stIndex = 0;
    for (let day = 0; day <= 3; day++) {
      for (const cinema of cinemas) {
        const cinemaHalls = halls.filter((h) => h.cinema_id === cinema.id);
        cinemaHalls.forEach((hall, hi) => {
          showingMovies.forEach((movie, mi) => {
            // 每个影厅每天给该片排 2 场，错开时间
            for (let k = 0; k < 2; k++) {
              const t = times[(hi + mi * 2 + k * 3 + day) % times.length];
              const [hh, mm] = t.split(':').map(Number);
              const stamp = dateStr(day, hh, mm);
              const version = hall.screen_type.includes('IMAX') ? 'IMAX' : versions[(hi + mi) % 2];
              const base = 35 + (version === 'IMAX' ? 30 : version === '3D' ? 15 : 0) + ((mi + day) % 3) * 5;
              insShowtime.run(movie.id, cinema.id, hall.id, stamp, base, version, movie.language);
              stIndex++;
            }
          });
        });
      }
    }

    /* 近 14 天历史订单（用于票房趋势看板） */
    const insOrder = db.prepare(`
      INSERT INTO orders (order_no, user_id, showtime_id, total_amount, status, pay_method, ticket_code, created_at, paid_at, expire_at)
      VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)
    `);
    const insTicket = db.prepare(
      'INSERT INTO tickets (order_id, showtime_id, seat_id, price, status) VALUES (?, ?, ?, ?, ?)'
    );
    const users = all("SELECT id FROM users WHERE role = 'user' ORDER BY id");
    const allSeats = all('SELECT * FROM seats');

    let seq = 0;
    for (let day = -14; day <= -1; day++) {
      const ordersToday = 3 + ((day + 14) % 4);
      for (let i = 0; i < ordersToday; i++) {
        const movie = showingMovies[(i + day + 20) % showingMovies.length];
        const cinema = cinemas[(i + Math.abs(day)) % cinemas.length];
        const hall = halls.filter((h) => h.cinema_id === cinema.id)[0];
        const hour = [11, 14, 17, 19, 21][i % 5];
        const start = dateStr(day, hour, 30);
        const st = insShowtime.run(
          movie.id, cinema.id, hall.id, start,
          45 + (i % 3) * 6, hall.screen_type.includes('IMAX') ? 'IMAX' : '2D', movie.language
        );
        const showtimeId = Number(st.lastInsertRowid);
        const user = users[(i + Math.abs(day)) % users.length];
        const hallSeatList = allSeats.filter((s) => s.hall_id === hall.id);
        const seatA = hallSeatList[(i * 7 + 3) % hallSeatList.length];
        const seatB = hallSeatList[(i * 7 + 11) % hallSeatList.length];
        const price = 45 + (i % 3) * 6;
        const paidAt = dateStr(day, hour, 10);
        const o = insOrder.run(
          `CM${fmtDate(new Date(Date.now() + day * 86400000)).replace(/-/g, '')}${pad(i + 1)}${String(1000 + seq++)}`,
          user.id, showtimeId, price * 2, i % 2 ? 'wechat' : 'alipay',
          String(2026110000 + seq), paidAt, paidAt, paidAt
        );
        const orderId = Number(o.lastInsertRowid);
        insTicket.run(orderId, showtimeId, seatA.id, price, 'valid');
        insTicket.run(orderId, showtimeId, seatB.id, price, 'valid');
      }
    }

    /* 评论评分 */
    const insComment = db.prepare(
      'INSERT INTO comments (movie_id, user_id, rating, content) VALUES (?, ?, ?, ?)'
    );
    for (const [title, username, rating, content] of COMMENTS) {
      const movie = get('SELECT id FROM movies WHERE title = ?', [title]);
      const user = get('SELECT id FROM users WHERE username = ?', [username]);
      if (movie && user) insComment.run(movie.id, user.id, rating, content);
    }

    /* 收藏 */
    const insFav = db.prepare('INSERT INTO favorites (user_id, movie_id) VALUES (?, ?)');
    const demo = get("SELECT id FROM users WHERE username = 'demo'");
    insFav.run(demo.id, 1);
    insFav.run(demo.id, 3);
  });

  const counts = {
    users: get('SELECT COUNT(*) n FROM users').n,
    movies: get('SELECT COUNT(*) n FROM movies').n,
    cinemas: get('SELECT COUNT(*) n FROM cinemas').n,
    halls: get('SELECT COUNT(*) n FROM halls').n,
    seats: get('SELECT COUNT(*) n FROM seats').n,
    showtimes: get('SELECT COUNT(*) n FROM showtimes').n,
    orders: get('SELECT COUNT(*) n FROM orders').n,
    comments: get('SELECT COUNT(*) n FROM comments').n,
  };

  // 若已用爬虫抓取过真实影片数据，则自动导入，覆盖演示用的虚构影片信息
  const crawledFile = path.join(__dirname, '..', 'scripts', 'output', 'douban-movies.json');
  if (fs.existsSync(crawledFile)) {
    try {
      const movies = JSON.parse(fs.readFileSync(crawledFile, 'utf8'));
      const { applyDoubanMovies } = require('./douban-import');
      const n = applyDoubanMovies(movies);
      if (n) {
        counts.movies = get('SELECT COUNT(*) n FROM movies').n;
        counts.comments = get('SELECT COUNT(*) n FROM comments').n;
        console.log(`✔ 已导入爬虫抓取的真实影片数据（${n} 部）`);
      }
    } catch (err) {
      console.warn('⚠ 真实影片数据导入失败：', err.message);
    }
  }
  console.log('✔ 数据初始化完成：', counts);
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
