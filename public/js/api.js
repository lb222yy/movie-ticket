/* ============================================================
   CineMax · API 请求封装与登录态管理
   ============================================================ */
(function () {
  const TOKEN_KEY = 'cineMax.token';
  const USER_KEY = 'cineMax.user';
  const API_BASE = '/api';

  const Auth = {
    get token() {
      return localStorage.getItem(TOKEN_KEY) || '';
    },
    get user() {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      } catch {
        return null;
      }
    },
    get isLoggedIn() {
      return !!this.token;
    },
    get isAdmin() {
      return this.user?.role === 'admin';
    },
    setSession(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent('auth:changed', { detail: user }));
    },
    updateUser(user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent('auth:changed', { detail: user }));
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new CustomEvent('auth:changed', { detail: null }));
    },
    logout() {
      this.clear();
    },
  };

  async function request(path, options = {}) {
    const {
      method = 'GET', body, withAuth = true, raw = false,
    } = options;
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (withAuth && Auth.token) headers.Authorization = `Bearer ${Auth.token}`;

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error('网络连接失败，请检查服务是否已启动');
    }

    if (raw) return res;
    const data = await res.json().catch(() => ({ success: false, message: '响应解析失败' }));
    if (!res.ok || data.success === false) {
      if (res.status === 401 && withAuth) {
        // 令牌失效，清理本地登录态
        Auth.clear();
      }
      throw new Error(data.message || `请求失败（${res.status}）`);
    }
    return data.data;
  }

  const API = {
    // 鉴权
    login: (payload) => request('/auth/login', { method: 'POST', body: payload, withAuth: false }),
    register: (payload) => request('/auth/register', { method: 'POST', body: payload, withAuth: false }),
    me: () => request('/auth/me'),
    updateProfile: (payload) => request('/auth/profile', { method: 'PUT', body: payload }),

    // 电影
    movies: (params = {}) => request('/movies?' + new URLSearchParams(params)),
    movie: (id) => request(`/movies/${id}`),
    ranking: () => request('/movies/ranking'),
    createMovie: (payload) => request('/movies', { method: 'POST', body: payload }),
    updateMovie: (id, payload) => request(`/movies/${id}`, { method: 'PUT', body: payload }),
    deleteMovie: (id) => request(`/movies/${id}`, { method: 'DELETE' }),

    // 影院 / 影厅
    cinemas: () => request('/cinemas'),
    cinema: (id) => request(`/cinemas/${id}`),
    createCinema: (payload) => request('/cinemas', { method: 'POST', body: payload }),
    updateCinema: (id, payload) => request(`/cinemas/${id}`, { method: 'PUT', body: payload }),
    deleteCinema: (id) => request(`/cinemas/${id}`, { method: 'DELETE' }),
    halls: (cinemaId) => request(`/cinemas/${cinemaId}/halls`),
    createHall: (payload) => request('/halls', { method: 'POST', body: payload }),
    updateHall: (id, payload) => request(`/halls/${id}`, { method: 'PUT', body: payload }),
    deleteHall: (id) => request(`/halls/${id}`, { method: 'DELETE' }),

    // 场次 / 座位
    showtimes: (params = {}) => request('/showtimes?' + new URLSearchParams(params)),
    showtime: (id) => request(`/showtimes/${id}`),
    seats: (showtimeId) => request(`/showtimes/${showtimeId}/seats`),
    createShowtime: (payload) => request('/showtimes', { method: 'POST', body: payload }),
    updateShowtime: (id, payload) => request(`/showtimes/${id}`, { method: 'PUT', body: payload }),
    deleteShowtime: (id) => request(`/showtimes/${id}`, { method: 'DELETE' }),

    // 锁座 / 订单
    lockSeats: (payload) => request('/seat-locks', { method: 'POST', body: payload }),
    unlockSeats: (showtimeId) => request(`/seat-locks/${showtimeId}`, { method: 'DELETE' }),
    createOrder: (payload) => request('/orders', { method: 'POST', body: payload }),
    orders: (params = {}) => request('/orders?' + new URLSearchParams(params)),
    order: (id) => request(`/orders/${id}`),
    payOrder: (id, payMethod) => request(`/orders/${id}/pay`, { method: 'POST', body: { payMethod } }),
    cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: 'POST' }),
    refundOrder: (id) => request(`/orders/${id}/refund`, { method: 'POST' }),
    rescheduleOrder: (id, payload) => request(`/orders/${id}/reschedule`, { method: 'POST', body: payload }),
    ticket: (id) => request(`/orders/${id}/ticket`),

    // 评论 / 收藏 / 轮播
    comments: (movieId, page = 1) => request(`/comments?movieId=${movieId}&page=${page}`),
    postComment: (payload) => request('/comments', { method: 'POST', body: payload }),
    deleteComment: (id) => request(`/comments/${id}`, { method: 'DELETE' }),
    favorites: () => request('/favorites'),
    addFavorite: (movieId) => request(`/favorites/${movieId}`, { method: 'POST' }),
    removeFavorite: (movieId) => request(`/favorites/${movieId}`, { method: 'DELETE' }),
    banners: () => request('/banners'),

    // 管理端
    adminStats: () => request('/admin/stats'),
    adminOrders: (params = {}) => request('/admin/orders?' + new URLSearchParams(params)),
    adminRefund: (id) => request(`/admin/orders/${id}/refund`, { method: 'POST' }),
    adminUsers: () => request('/admin/users'),
    adminComments: (params = {}) => request('/admin/comments?' + new URLSearchParams(params)),
    adminShowtimes: (params = {}) => request('/admin/showtimes?' + new URLSearchParams(params)),
    adminBanners: () => request('/admin/banners'),
    createBanner: (payload) => request('/admin/banners', { method: 'POST', body: payload }),
    updateBanner: (id, payload) => request(`/admin/banners/${id}`, { method: 'PUT', body: payload }),
    deleteBanner: (id) => request(`/admin/banners/${id}`, { method: 'DELETE' }),
  };

  /* ------------------------- 通用小工具 ------------------------- */
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const money = (n) => `¥${Number(n || 0).toFixed(2)}`;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function dateCN(dateStr) {
    const [datePart, timePart] = String(dateStr).split(' ');
    const [y, m, d] = datePart.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()];
    return { date: `${m}月${d}日`, full: `${y}-${pad(m)}-${pad(d)}`, week, time: timePart?.slice(0, 5) || '' };
  }

  function relativeDay(dateStr) {
    const d = new Date(String(dateStr).slice(0, 10).replace(/-/g, '/'));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    return dateCN(dateStr).week;
  }

  function queryParams() {
    return Object.fromEntries(new URLSearchParams(location.search));
  }

  function debounce(fn, wait = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  window.Auth = Auth;
  window.API = API;
  window.Utils = {
    qs, qsa, escapeHtml, money, pad, dateCN, relativeDay, queryParams, debounce,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
})();
