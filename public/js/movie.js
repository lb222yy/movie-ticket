/* ============================================================
   影片详情：信息、演职人员、场次选择、评论评分
   ============================================================ */
(() => {
  const { qs, escapeHtml, money, dateCN, relativeDay, pad } = window.Utils;
  const { toast } = window.UI;

  const movieId = Number(window.Utils.queryParams().id);
  const state = {
    movie: null,
    showtimes: [],
    date: '',
    days: [],
    myRating: 0,
    commentsPage: 1,
  };

  async function init() {
    window.UI.mountHeader('');
    window.UI.mountFooter();
    if (!movieId) {
      location.href = '/index.html';
      return;
    }
    buildDateTabs();
    window.addEventListener('auth:changed', () => {
      renderCommentForm();
      loadComments();
    });
    try {
      const [movie, showtimes] = await Promise.all([
        window.API.movie(movieId),
        window.API.showtimes({ movieId }),
      ]);
      state.movie = movie;
      state.showtimes = showtimes;
      renderMovie();
      renderShowtimes();
      await loadComments();
    } catch (err) {
      qs('#movieInfo').innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>影片加载失败</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  /* ------------------------------ 影片信息 ------------------------------ */
  function renderMovie() {
    const m = state.movie;
    qs('#movieBg').innerHTML = `<img src="${escapeHtml(m.backdrop || m.poster)}" alt="">`;

    const statusText = m.status === 'upcoming' ? '即将上映' : m.status === 'offline' ? '已下线' : '热映中';
    const score = Number(m.rating) || 0;
    const favActive = !!m.isFavorite;

    qs('#movieInfo').innerHTML = `
      <div class="movie-poster">
        <img src="${escapeHtml(m.poster)}" alt="${escapeHtml(m.title)} 海报">
      </div>
      <div class="movie-main">
        <div class="movie-tags">
          <span class="badge ${m.status === 'upcoming' ? 'badge-cyan' : 'badge-brand'}">${statusText}</span>
          ${m.isHot ? '<span class="badge badge-amber">口碑推荐</span>' : ''}
          <span class="badge">${escapeHtml(m.language || '国语')}</span>
        </div>
        <h1 style="margin-top:14px">${escapeHtml(m.title)}</h1>
        <div class="movie-en">${escapeHtml(m.originalTitle || '')}</div>
        <div class="movie-meta">
          <span>${escapeHtml((m.genre || '').split(',').join(' / '))}</span>
          <span class="dot"></span>
          <span>${m.duration} 分钟</span>
          <span class="dot"></span>
          <span>${escapeHtml(m.releaseDate || '')} 上映</span>
          <span class="dot"></span>
          <span>导演：${escapeHtml(m.director || '—')}</span>
        </div>
        <div class="movie-score">
          <span class="num">${score ? score.toFixed(1) : '—'}<small> / 10</small></span>
          ${window.UI.stars(score)}
          <span class="cnt">${m.commentCount || 0} 人评分 · ${m.favoriteCount || 0} 人想看</span>
        </div>
        <p class="movie-synopsis">${escapeHtml(m.synopsis || '暂无剧情简介')}</p>
        <div class="movie-actions">
          <button class="btn btn-primary btn-lg" id="bookBtn">${m.status === 'upcoming' ? '查看场次' : '选座购票'}</button>
          <button class="btn btn-ghost btn-lg" id="trailerBtn">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>
            预告片
          </button>
          <button class="btn btn-ghost btn-lg ${favActive ? 'active' : ''}" id="favBtn">
            ${favActive ? '已加入想看' : '想看'}
          </button>
        </div>
      </div>`;

    qs('#bookBtn').addEventListener('click', () => {
      qs('#booking').scrollIntoView({ behavior: 'smooth' });
    });
    qs('#trailerBtn').addEventListener('click', openTrailer);
    qs('#favBtn').addEventListener('click', toggleFavorite);

    if (m.cast?.length) {
      qs('#castSection').innerHTML = `
        <div class="cast-section">
          <div class="section-head" style="margin-bottom:18px">
            <div><h2 class="section-title" style="font-size:20px">演职人员</h2></div>
          </div>
          <div class="cast-rail">
            ${m.cast.map((c) => `<div class="cast-card">
              <div class="cast-avatar">${escapeHtml(c.name.slice(0, 1))}</div>
              <b>${escapeHtml(c.name)}</b>
              <span>${escapeHtml(c.roleName)}</span>
            </div>`).join('')}
          </div>
        </div>`;
    }

    qs('#bookingSub').textContent = m.status === 'upcoming'
      ? '影片尚未上映，以下为预售场次' : '选择日期与影城，进入选座';
  }

  function openTrailer() {
    const url = state.movie?.trailerUrl || '';
    const mask = window.UI.openModal(`
      <div class="modal-head">
        <div><h3>${escapeHtml(state.movie.title)} · 预告片</h3><p>${escapeHtml(state.movie.originalTitle || '')}</p></div>
        <button class="modal-close" data-close>×</button>
      </div>
      <div style="border-radius:14px;overflow:hidden;background:#000;aspect-ratio:16/9">
        ${url ? `<video src="${escapeHtml(url)}" controls autoplay playsinline style="width:100%;height:100%;object-fit:contain"></video>` : '<div style="display:grid;place-items:center;height:100%;color:#98a0b3">预告片暂未上线</div>'}
      </div>`, { size: 'modal-lg' });
    mask.addEventListener('click', (e) => {
      if (e.target === mask || e.target.closest('[data-close]')) qs('video', mask)?.pause();
    });
  }

  async function toggleFavorite() {
    if (!window.UI.requireLogin('登录后即可收藏想看的影片')) return;
    const btn = qs('#favBtn');
    const active = btn.classList.contains('active');
    btn.disabled = true;
    try {
      if (active) {
        await window.API.removeFavorite(movieId);
        btn.classList.remove('active');
        btn.textContent = '想看';
        state.movie.favoriteCount = Math.max(0, (state.movie.favoriteCount || 1) - 1);
        toast('已从想看片单移除', 'info');
      } else {
        await window.API.addFavorite(movieId);
        btn.classList.add('active');
        btn.textContent = '已加入想看';
        state.movie.favoriteCount = (state.movie.favoriteCount || 0) + 1;
        toast('已加入想看片单');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ------------------------------ 日期与场次 ------------------------------ */
  function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function buildDateTabs() {
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({ key: dayKey(d), date: d });
    }
    state.days = days;
    state.date = days[0].key;

    qs('#dateTabs').innerHTML = days.map((d) => {
      const label = relativeDay(d.key);
      return `<button class="date-tab ${d.key === state.date ? 'active' : ''}" data-date="${d.key}">
        <b>${d.key.slice(5).replace('-', '/')}</b>
        <span>${label === '周' ? d.key : label}</span>
      </button>`;
    }).join('');

    qs('#dateTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn) return;
      state.date = btn.dataset.date;
      qs('.date-tab.active')?.classList.remove('active');
      btn.classList.add('active');
      renderShowtimes();
    });
  }

  function renderShowtimes() {
    const list = qs('#showtimeList');
    const dayShowtimes = state.showtimes
      .filter((s) => s.startTime.startsWith(state.date))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 更新日期标签上的场次数量
    window.Utils.qsa('.date-tab').forEach((tab) => {
      const count = state.showtimes.filter((s) => s.startTime.startsWith(tab.dataset.date)).length;
      const span = tab.querySelector('span');
      if (count) {
        const label = relativeDay(tab.dataset.date);
        span.textContent = `${label === '周' ? tab.dataset.date : label} · ${count}场`;
      }
    });

    if (!dayShowtimes.length) {
      list.innerHTML = `<div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
        <h3>当天暂无排片</h3><p>换一个日期看看，或选择其他影城</p></div>`;
      return;
    }

    const groups = new Map();
    dayShowtimes.forEach((s) => {
      if (!groups.has(s.cinemaId)) groups.set(s.cinemaId, { ...s, times: [] });
      groups.get(s.cinemaId).times.push(s);
    });

    list.innerHTML = [...groups.values()].map((g) => `
      <div class="cinema-block">
        <div class="cinema-top">
          <div>
            <div class="cinema-name">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>
              ${escapeHtml(g.cinemaName)}
            </div>
            <div class="cinema-addr">${escapeHtml(g.district || '')} · ${escapeHtml(g.address || '')}</div>
          </div>
          <div class="cinema-tags">
            ${(g.screenType || '').split(',').filter(Boolean).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}
            <span class="chip">¥${Number(g.basePrice).toFixed(0)} 起</span>
          </div>
        </div>
        <div class="times-row">
          ${g.times.map((s) => {
            const left = s.seatLeft ?? (s.seatTotal || 0);
            const sold = left <= 0;
            return `<button class="time-btn ${sold ? 'soldout' : ''}" ${sold ? 'disabled' : ''} data-showtime="${s.id}">
              <div class="t">${s.startTime.slice(11, 16)}<span class="version-tag">${escapeHtml(s.version)}</span></div>
              <div class="p"><span>${escapeHtml(s.hallName)}</span><b>${sold ? '已售罄' : `¥${Number(s.basePrice).toFixed(0)}`}</b></div>
              <div class="p"><span>${sold ? '换个场次吧' : `余 ${left} 座`}</span><span>${escapeHtml(s.language || '')}</span></div>
            </button>`;
          }).join('')}
        </div>
      </div>`).join('');

    window.Utils.qsa('[data-showtime]', list).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        if (!window.Auth.isLoggedIn) {
          window.UI.openAuthModal('login');
          toast('登录后才能选座购票，可使用演示账号 demo / demo123', 'info', 3600);
          return;
        }
        location.href = `/seat.html?showtimeId=${btn.dataset.showtime}`;
      });
    });
  }

  /* ------------------------------ 评论 ------------------------------ */
  async function loadComments() {
    try {
      const data = await window.API.comments(movieId, 1);
      state.myRating = data.myRating || 0;
      renderSummary(data);
      renderComments(data);
      renderCommentForm();
    } catch (err) {
      qs('#commentList').innerHTML = `<div class="empty"><h3>评论加载失败</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderSummary(data) {
    const dist = data.distribution || {};
    const buckets = [
      { label: '9-10', from: 9, to: 10 },
      { label: '7-8', from: 7, to: 8 },
      { label: '5-6', from: 5, to: 6 },
      { label: '3-4', from: 3, to: 4 },
      { label: '1-2', from: 1, to: 2 },
    ];
    const max = Math.max(1, ...buckets.map((b) => Object.entries(dist)
      .filter(([k]) => Number(k) >= b.from && Number(k) <= b.to)
      .reduce((s, [, v]) => s + v, 0)));

    qs('#ratingSummary').innerHTML = `
      <div class="rating-big">
        <b>${data.average ? Number(data.average).toFixed(1) : '—'}</b>
        <span>${data.count || 0} 人评分</span>
      </div>
      <div style="margin-top:10px">${window.UI.stars(data.average || 0)}</div>
      <div class="dist">
        ${buckets.map((b) => {
          const n = Object.entries(dist)
            .filter(([k]) => Number(k) >= b.from && Number(k) <= b.to)
            .reduce((s, [, v]) => s + v, 0);
          const pct = Math.round((n / max) * 100);
          return `<div class="dist-row"><span>${b.label}</span><div class="dist-bar"><i style="width:${pct}%"></i></div><span>${n}</span></div>`;
        }).join('')}
      </div>
      <div class="rating-hint">评分来自 CineMax 购票观众，每张影票可评价一次。你的每一条真实感受，都会帮助其他人选片。</div>`;
  }

  function renderCommentForm() {
    const box = qs('#commentFormBox');
    if (!window.Auth.isLoggedIn) {
      box.innerHTML = `<div class="login-tip">登录后即可评分与评论<button id="cLogin">去登录 →</button></div>`;
      qs('#cLogin')?.addEventListener('click', () => window.UI.openAuthModal());
      return;
    }
    const rate = state.myRating || 0;
    box.innerHTML = `
      <div class="comment-form">
        <h4>${rate ? '更新你的评价' : '看完说两句'}</h4>
        <div class="rate-picker" id="ratePicker">
          ${[1, 2, 3, 4, 5].map((i) => `<button data-score="${i}" class="${i <= Math.round(rate / 2) ? 'on' : ''}" aria-label="${i} 星">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.8l5.9-.9Z"/></svg>
          </button>`).join('')}
          <span class="rate-value" id="rateValue">${rate ? `${rate} 分` : '点击星星评分'}</span>
        </div>
        <textarea class="textarea" id="commentInput" maxlength="500" placeholder="这部电影最打动你的是什么？（至少 3 个字）">${''}</textarea>
        <div class="form-error" id="commentError"></div>
        <button class="btn btn-primary" id="submitComment">${rate ? '更新评价' : '发布评价'}</button>
      </div>`;

    let score = rate;
    const picker = qs('#ratePicker');
    picker.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-score]');
      if (!btn) return;
      score = Number(btn.dataset.score) * 2;
      window.Utils.qsa('[data-score]', picker).forEach((b) => {
        b.classList.toggle('on', Number(b.dataset.score) <= Number(btn.dataset.score));
      });
      qs('#rateValue').textContent = `${score} 分`;
    });

    qs('#submitComment').addEventListener('click', async () => {
      const content = qs('#commentInput').value.trim();
      const errEl = qs('#commentError');
      errEl.textContent = '';
      if (!score) { errEl.textContent = '请先点击星星打分'; return; }
      if (content.length < 3) { errEl.textContent = '评论内容至少 3 个字'; return; }
      const btn = qs('#submitComment');
      btn.disabled = true;
      btn.textContent = '发布中…';
      try {
        await window.API.postComment({ movieId, rating: score, content });
        toast(rate ? '评价已更新' : '感谢你的评价');
        state.myRating = score;
        await loadComments();
        await refreshMovieScore();
      } catch (err) {
        errEl.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = rate ? '更新评价' : '发布评价';
      }
    });
  }

  async function refreshMovieScore() {
    try {
      const m = await window.API.movie(movieId);
      state.movie = m;
      const scoreEl = qs('.movie-score .num');
      if (scoreEl) scoreEl.innerHTML = `${Number(m.rating).toFixed(1)}<small> / 10</small>`;
      const starsEl = qs('.movie-score .stars-wrap');
      if (starsEl) starsEl.outerHTML = window.UI.stars(m.rating);
      const cnt = qs('.movie-score .cnt');
      if (cnt) cnt.textContent = `${m.commentCount} 人评分 · ${m.favoriteCount} 人想看`;
    } catch { /* 忽略 */ }
  }

  function renderComments(data) {
    const myId = window.Auth.user?.id;
    const list = qs('#commentList');
    if (!data.list?.length) {
      list.innerHTML = `<div class="empty" style="margin-top:22px"><h3>还没有评论</h3><p>成为第一个分享观影感受的人</p></div>`;
      return;
    }
    list.innerHTML = data.list.map((c) => `
      <div class="comment-item">
        <div class="comment-avatar">${escapeHtml((c.nickname || 'U').slice(0, 1))}</div>
        <div class="comment-body">
          <div class="comment-head">
            <b>${escapeHtml(c.nickname)}</b>
            <span class="comment-stars">${'★'.repeat(Math.round(c.rating / 2))}${'☆'.repeat(5 - Math.round(c.rating / 2))}</span>
            <span class="badge" style="height:20px">${c.rating} 分</span>
            <time>${escapeHtml(c.createdAt)}</time>
            ${(myId === c.userId || window.Auth.isAdmin) ? `<button class="comment-del" data-del="${c.id}">删除</button>` : ''}
          </div>
          <p class="comment-text">${escapeHtml(c.content)}</p>
        </div>
      </div>`).join('');

    window.Utils.qsa('[data-del]', list).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await window.UI.confirm({ title: '删除评论', message: '删除后不可恢复，确定继续吗？', okText: '删除', danger: true });
        if (!ok) return;
        try {
          await window.API.deleteComment(btn.dataset.del);
          toast('评论已删除', 'info');
          await loadComments();
          await refreshMovieScore();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  init();
})();
