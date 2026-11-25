/**
 * 数据库连接与初始化
 * 使用 Node.js 24 内置的 node:sqlite（无需编译原生依赖），零配置即可运行
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(__dirname, '..', 'database', 'cinema.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/** 执行建表脚本（幂等） */
function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  db.exec(schema);
}

/** 查询多行 */
function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

/** 查询单行 */
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

/** 执行写操作 */
function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

/** 事务封装（node:sqlite 无内置事务包装） */
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

initSchema();

module.exports = { db, DB_PATH, initSchema, all, get, run, transaction };
