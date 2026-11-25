/** 统一响应工具 */
function ok(res, data, message = '操作成功') {
  return res.json({ success: true, message, data });
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

/** 将数据库 snake_case 行转为 camelCase 对象 */
function camel(row) {
  if (Array.isArray(row)) return row.map(camel);
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

module.exports = { ok, fail, camel };
