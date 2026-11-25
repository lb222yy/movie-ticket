/**
 * 鉴权与工具函数
 * - 密码：scrypt 加盐哈希存储
 * - 令牌：HMAC-SHA256 签名的轻量 JWT（header.payload.signature）
 */
const crypto = require('node:crypto');

const SECRET = process.env.JWT_SECRET || 'cinemax_dev_secret_change_me';
const TOKEN_TTL = 60 * 60 * 24 * 7; // 7 天

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const calc = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

function optionalAuth(req, _res, next) {
  const payload = verifyToken(readToken(req));
  if (payload) req.user = { id: payload.id, username: payload.username, role: payload.role };
  next();
}

function authRequired(req, res, next) {
  const payload = verifyToken(readToken(req));
  if (!payload) return res.status(401).json({ success: false, message: '请先登录后再操作' });
  req.user = { id: payload.id, username: payload.username, role: payload.role };
  next();
}

function adminRequired(req, res, next) {
  const payload = verifyToken(readToken(req));
  if (!payload) return res.status(401).json({ success: false, message: '请先登录后再操作' });
  if (payload.role !== 'admin') return res.status(403).json({ success: false, message: '仅影院管理员可执行此操作' });
  req.user = { id: payload.id, username: payload.username, role: payload.role };
  next();
}

/* ---------------- 时间工具（统一使用本地时间字符串） ---------------- */

function pad(n) {
  return String(n).padStart(2, '0');
}

function fmtDateTime(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addMinutes(d, minutes) {
  return new Date(d.getTime() + minutes * 60000);
}

function parseLocal(str) {
  // 'YYYY-MM-DD HH:MM(:SS)' -> Date（本地时区）
  return new Date(String(str).replace(' ', 'T'));
}

/** 生成订单号：CM + yyyyMMddHHmmss + 3 位随机 */
function genOrderNo() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `CM${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

/** 生成 10 位取票码 */
function genTicketCode() {
  return String(crypto.randomInt(1000000000, 9999999999));
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  optionalAuth,
  authRequired,
  adminRequired,
  fmtDateTime,
  fmtDate,
  addMinutes,
  parseLocal,
  genOrderNo,
  genTicketCode,
};
