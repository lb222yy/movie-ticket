/**
 * CineMax 在线电影购票系统 - 服务入口
 * 技术栈：Node.js + Express + SQLite（node:sqlite）+ 原生 HTML/CSS/JavaScript
 */
require('dotenv').config();

const path = require('node:path');
const express = require('express');
const cors = require('cors');

const { DB_PATH, get } = require('./db');
const { seed } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 简易访问日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    }
  });
  next();
});

// 静态资源
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

// 业务路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/movies', require('./routes/movies'));
app.use('/api', require('./routes/cinemas'));
app.use('/api/showtimes', require('./routes/showtimes').router);
app.use('/api', require('./routes/orders'));
app.use('/api', require('./routes/comments'));
app.use('/api', require('./routes/misc'));
app.use('/api/admin', require('./routes/admin'));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', db: DB_PATH, time: new Date().toISOString() } });
});

// API 404
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

// 页面 404 兜底
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

// 统一错误处理
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: '请求体 JSON 格式错误' });
  }
  res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
});

// 首次启动自动写入演示数据
const movieCount = get('SELECT COUNT(*) n FROM movies').n;
if (movieCount === 0) {
  console.log('▶ 检测到空数据库，正在初始化演示数据…');
  seed();
}

app.listen(PORT, () => {
  console.log('');
  console.log('  🎬  CineMax 在线电影购票系统');
  console.log(`  ➜  前台:  http://localhost:${PORT}`);
  console.log(`  ➜  后台:  http://localhost:${PORT}/admin.html`);
  console.log(`  ➜  数据库: ${DB_PATH}`);
  console.log('  演示账号: demo / demo123    管理员: admin / admin123');
  console.log('');
});
