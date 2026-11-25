/** 用户注册 / 登录 / 个人信息 */
const express = require('express');
const { all, get, run } = require('../db');
const {
  hashPassword, verifyPassword, signToken, authRequired,
} = require('../auth');
const { ok, fail, camel } = require('../respond');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, password, nickname, phone } = req.body || {};
  if (!username || !password) return fail(res, 400, '用户名和密码不能为空');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return fail(res, 400, '用户名需为 3-20 位字母、数字或下划线');
  if (String(password).length < 6) return fail(res, 400, '密码长度不能少于 6 位');
  if (get('SELECT id FROM users WHERE username = ?', [username])) return fail(res, 409, '该用户名已被注册');

  const info = run(
    'INSERT INTO users (username, password, nickname, phone) VALUES (?, ?, ?, ?)',
    [username, hashPassword(password), nickname || username, phone || '']
  );
  const user = get('SELECT id, username, nickname, role FROM users WHERE id = ?', [info.lastInsertRowid]);
  const token = signToken({ id: user.id, username: user.username, role: user.role });
  return ok(res, { token, user: camel(user) }, '注册成功，欢迎加入 CineMax');
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, 400, '请输入用户名和密码');
  const user = get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !verifyPassword(password, user.password)) return fail(res, 401, '用户名或密码错误');
  const token = signToken({ id: user.id, username: user.username, role: user.role });
  return ok(res, {
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname, phone: user.phone, role: user.role },
  }, '登录成功');
});

router.get('/me', authRequired, (req, res) => {
  const user = get('SELECT id, username, nickname, phone, role, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return fail(res, 404, '用户不存在');
  const favCount = get('SELECT COUNT(*) n FROM favorites WHERE user_id = ?', [user.id]).n;
  const orderCount = get('SELECT COUNT(*) n FROM orders WHERE user_id = ?', [user.id]).n;
  return ok(res, { ...camel(user), favCount, orderCount });
});

router.put('/profile', authRequired, (req, res) => {
  const { nickname, phone, password, oldPassword } = req.body || {};
  const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return fail(res, 404, '用户不存在');
  if (password) {
    if (!oldPassword || !verifyPassword(oldPassword, user.password)) return fail(res, 400, '原密码不正确');
    if (String(password).length < 6) return fail(res, 400, '新密码长度不能少于 6 位');
    run('UPDATE users SET password = ? WHERE id = ?', [hashPassword(password), user.id]);
  }
  run('UPDATE users SET nickname = ?, phone = ? WHERE id = ?', [
    nickname || user.nickname, phone ?? user.phone, user.id,
  ]);
  const fresh = get('SELECT id, username, nickname, phone, role FROM users WHERE id = ?', [user.id]);
  return ok(res, camel(fresh), '资料已更新');
});

module.exports = router;
