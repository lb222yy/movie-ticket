#!/usr/bin/env node
/**
 * 豆瓣电影数据爬虫（仅用于课程演示，请遵守目标站点条款与 robots 规则）
 *
 * 抓取内容：真实片名 / 原始片名 / 评分 / 类型 / 片长 / 语言 / 上映日期 / 简介 /
 *           导演 / 主演 / 海报 / 剧照（作详情页背景）/ 预告片 / 热门短评
 * 导出内容：public/assets/{posters,backdrops,trailers}/ 下的本地资源 + scripts/output/douban-movies.json
 *
 * 用法：
 *   node scripts/crawl-douban.js                     # 只抓取并下载，不改数据库
 *   node scripts/crawl-douban.js --apply             # 抓取后原位替换数据库中的影片数据
 *   node scripts/crawl-douban.js --apply --no-download   # 只更新元数据，不下载资源
 *   node scripts/crawl-douban.js --ids 35267208,26752088 --apply
 *
 * 说明：
 *   - 请求间隔默认 1.2 秒，失败自动重试，避免给对方站点造成压力
 *   - 海报/剧照 CDN 必须携带 Referer，否则返回 418
 *   - 预告片为 CDN 直链（带时效），下载到本地后长期有效；超过体积上限会跳过
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_DIR = path.join(__dirname, 'output');
const POSTER_DIR = path.join(PUBLIC_DIR, 'assets', 'posters', 'douban');
const BACKDROP_DIR = path.join(PUBLIC_DIR, 'assets', 'backdrops', 'douban');
const TRAILER_DIR = path.join(PUBLIC_DIR, 'assets', 'trailers');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  Referer: 'https://m.douban.com/',
  Origin: 'https://m.douban.com',
};
const IMG_HEADERS = {
  'User-Agent': UA,
  Referer: 'https://movie.douban.com/',
};

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const getArg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OPTIONS = {
  apply: has('--apply'),
  download: !has('--no-download'),
  showing: Number(getArg('--showing', 6)),
  upcoming: Number(getArg('--upcoming', 2)),
  interval: Number(getArg('--interval', 1200)),
  maxTrailerMB: Number(getArg('--max-trailer-mb', 60)),
  ids: (getArg('--ids', '') || '').split(',').map((s) => s.trim()).filter(Boolean),
};

/* ------------------------------ HTTP ------------------------------ */
let lastRequestAt = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  const wait = OPTIONS.interval - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function request(url, { headers = HEADERS, as = 'json', retry = 2 } = {}) {
  for (let attempt = 0; attempt <= retry; attempt++) {
    await throttle();
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (as === 'json') {
        const text = await res.text();
        return JSON.parse(text);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === retry) throw err;
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

const getJson = (url) => request(url, { as: 'json' });
const getBuffer = (url) => request(url, { headers: IMG_HEADERS, as: 'buffer' });

function save(dir, filename, buffer) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, filename);
  fs.writeFileSync(file, buffer);
  return '/' + path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
}

/* --------------------------- 榜单 / 详情 --------------------------- */

/** 热映候选：豆瓣「热门」标签列表 */
async function listHot() {
  const url =
    'https://movie.douban.com/j/search_subjects?type=movie&tag=' +
    encodeURIComponent('热门') +
    '&sort=recommend&page_limit=40&page_start=0';
  const data = await getJson(url);
  return (data.subjects || []).map((s) => ({ id: String(s.id), title: s.title, isNew: !!s.is_new }));
}

/** 待映候选：移动端「即将上映」榜单（只保留今天之后上映的影片） */
async function listComingSoon() {
  const data = await getJson('https://m.douban.com/rexxar/api/v2/movie/coming_soon?start=0&count=40&ui=web');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (data.subjects || [])
    .filter((s) => {
      const t = Date.parse(String(s.release_date || '').slice(0, 10));
      return !Number.isNaN(t) && t >= today.getTime();
    })
    .map((s) => ({ id: String(s.id), title: s.title }));
}

function pickPhoto(photos) {
  // 优先取横版高清剧照作为详情页背景
  const list = photos || [];
  const wide = list.find((p) => p.image && p.image.large && p.image.large.width > p.image.large.height);
  return wide || list[0] || null;
}

function pickTrailer(detail) {
  const list = detail.trailers || [];
  return list.find((t) => t.video_url) || null;
}

async function crawlSubject(id, status) {
  const detail = await getJson(`https://m.douban.com/rexxar/api/v2/movie/${id}`);

  const [interests, photos] = await Promise.all([
    getJson(`https://m.douban.com/rexxar/api/v2/movie/${id}/interests?count=6&order_by=hot&start=0`).catch(
      () => ({ interests: [] })
    ),
    getJson(`https://m.douban.com/rexxar/api/v2/movie/${id}/photos?count=8&start=0&type=S&size=A`).catch(
      () => ({ photos: [] })
    ),
  ]);

  const posterUrl =
    (detail.cover && detail.cover.image && detail.cover.image.large && detail.cover.image.large.url) ||
    (detail.pic && detail.pic.large) ||
    '';
  const photo = pickPhoto(photos.photos);
  const backdropUrl = (photo && photo.image && photo.image.large && photo.image.large.url) || '';
  const trailer = pickTrailer(detail);

  const pubdate = (detail.pubdate || [])[0] || detail.release_date || '';
  const dateMatch = String(pubdate).match(/(\d{4}-\d{2}-\d{2})/);
  const duration = parseInt(String((detail.durations || [])[0] || ''), 10) || 120;

  const movie = {
    doubanId: String(detail.id),
    doubanUrl: `https://movie.douban.com/subject/${detail.id}/`,
    title: detail.title,
    originalTitle: detail.original_title || (detail.aka || [])[0] || '',
    year: detail.year,
    rating: (detail.rating && detail.rating.value) || 0,
    ratingCount: (detail.rating && detail.rating.count) || 0,
    genres: detail.genres || [],
    countries: detail.countries || [],
    languages: detail.languages || [],
    durations: detail.durations || [],
    duration,
    releaseDate: dateMatch ? dateMatch[1] : `${detail.year || ''}-01-01`.replace(/^-/, ''),
    intro: (detail.intro || '').trim(),
    directors: (detail.directors || []).map((d) => d.name).filter(Boolean),
    actors: (detail.actors || []).map((a) => a.name && a.name.trim()).filter(Boolean),
    trailerUrl: (trailer && trailer.video_url) || '',
    trailerTitle: (trailer && trailer.title) || '',
    status,
    posterSource: posterUrl,
    backdropSource: backdropUrl,
    comments: (interests.interests || [])
      .filter((c) => c.comment && c.comment.trim())
      .slice(0, 6)
      .map((c) => ({
        author: (c.user && c.user.name) || '',
        rating: (c.rating && c.rating.value) || 0,
        content: c.comment.replace(/\s+/g, ' ').trim().slice(0, 160),
      })),
    poster: '',
    backdrop: '',
    trailer: '',
  };

  if (OPTIONS.download) {
    if (posterUrl) {
      const buf = await getBuffer(posterUrl);
      movie.poster = save(POSTER_DIR, `${movie.doubanId}.jpg`, buf);
      console.log(`    海报 ✓ ${(buf.length / 1024).toFixed(0)} KB`);
    }
    if (backdropUrl) {
      const buf = await getBuffer(backdropUrl);
      movie.backdrop = save(BACKDROP_DIR, `${movie.doubanId}.jpg`, buf);
      console.log(`    剧照 ✓ ${(buf.length / 1024).toFixed(0)} KB`);
    }
    if (movie.trailerUrl) {
      try {
        const buf = await request(movie.trailerUrl, { headers: IMG_HEADERS, as: 'buffer', retry: 1 });
        const mb = buf.length / 1024 / 1024;
        if (mb > OPTIONS.maxTrailerMB) {
          console.log(`    预告片跳过（${mb.toFixed(1)} MB 超过上限 ${OPTIONS.maxTrailerMB} MB）`);
        } else {
          movie.trailer = save(TRAILER_DIR, `${movie.doubanId}.mp4`, buf);
          console.log(`    预告片 ✓ ${mb.toFixed(1)} MB`);
        }
      } catch (err) {
        console.log(`    预告片下载失败：${err.message}`);
      }
    } else {
      console.log('    预告片不存在，将沿用示例视频');
    }
  }

  // 未开启下载（--no-download）时复用已下载到本地的资源，避免把空路径写回数据库
  const localAssets = {
    poster: [POSTER_DIR, `${movie.doubanId}.jpg`, `/assets/posters/douban/${movie.doubanId}.jpg`],
    backdrop: [BACKDROP_DIR, `${movie.doubanId}.jpg`, `/assets/backdrops/douban/${movie.doubanId}.jpg`],
    trailer: [TRAILER_DIR, `${movie.doubanId}.mp4`, `/assets/trailers/${movie.doubanId}.mp4`],
  };
  Object.entries(localAssets).forEach(([key, [dir, file, url]]) => {
    if (!movie[key] && fs.existsSync(path.join(dir, file))) movie[key] = url;
  });

  return movie;
}

/* ------------------------------ 入库 ------------------------------ */

const { applyDoubanMovies } = require('../server/douban-import');

function applyToDatabase(movies) {
  const updated = applyDoubanMovies(movies);
  console.log(`✔ 已更新 ${updated} 部影片（含演职人员、短评、轮播图）`);
}

/* ------------------------------ 主流程 ------------------------------ */

(async () => {
  console.log('▶ 豆瓣电影数据抓取');
  console.log(
    `  模式：${OPTIONS.apply ? '抓取并写入数据库' : '仅抓取导出'}｜资源下载：${OPTIONS.download ? '开启' : '关闭'}\n`
  );

  let candidates;
  if (OPTIONS.ids.length) {
    candidates = OPTIONS.ids.map((id, i) => ({ id, title: '', status: i < OPTIONS.showing ? 'showing' : 'upcoming' }));
  } else {
    const [hot, soon] = await Promise.all([listHot(), listComingSoon()]);
    candidates = [
      ...hot.slice(0, Math.max(OPTIONS.showing * 3, 12)).map((x) => ({ ...x, status: 'showing' })),
      ...soon.slice(0, Math.max(OPTIONS.upcoming * 3, 6)).map((x) => ({ ...x, status: 'upcoming' })),
    ];
    console.log(`  候选：热映 ${hot.length} 条 / 待映 ${soon.length} 条`);
  }

  const picked = [];
  const need = { showing: OPTIONS.showing, upcoming: OPTIONS.upcoming };

  for (const item of candidates) {
    if (need.showing <= 0 && need.upcoming <= 0) break;
    if (!need[item.status]) continue;
    try {
      console.log(`  → [${item.status}] ${item.title || item.id} (${item.id})`);
      const movie = await crawlSubject(item.id, item.status);
      if (!movie.poster && !movie.posterSource) {
        console.log('    ✗ 无海报，跳过');
        continue;
      }
      if (!movie.intro || movie.intro.length < 10) {
        console.log('    ✗ 无简介，跳过');
        continue;
      }
      picked.push(movie);
      need[item.status]--;
      console.log(
        `    ✓ ${movie.title}（${movie.year}）片长 ${movie.duration} 分钟 · 豆瓣 ${movie.rating || '-'} · 评论 ${movie.comments.length} 条`
      );
    } catch (err) {
      console.log(`    ✗ 抓取失败：${err.message}`);
    }
  }

  if (!picked.length) {
    console.error('✗ 没有抓取到有效数据，请稍后重试或检查网络');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const output = path.join(OUTPUT_DIR, 'douban-movies.json');
  fs.writeFileSync(output, JSON.stringify(picked, null, 2), 'utf8');
  console.log(`\n✔ 已导出 ${picked.length} 部影片：${path.relative(ROOT, output)}`);

  if (OPTIONS.apply) {
    applyToDatabase(picked);
    fs.writeFileSync(output, JSON.stringify(picked, null, 2), 'utf8');
  } else {
    console.log('ℹ 未写入数据库，确认无误后追加 --apply 重新执行或执行 npm run crawl:apply');
  }

  console.log('\n数据来源：豆瓣电影（https://movie.douban.com），仅用于课程演示，请勿用于商业用途。');
})().catch((err) => {
  console.error('✗ 执行失败：', err);
  process.exit(1);
});
