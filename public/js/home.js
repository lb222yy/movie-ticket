/* ============================================================
   首页逻辑：轮播、搜索与历史、影片筛选、票房榜、收藏
   ============================================================ */
(() => {
  const { qs, qsa, escapeHtml, money, relativeDay } = window.Utils;
  const { toast } = window.UI;

  const state = {
    showing: [],
    upcoming: [],
    banners: [],
    keyword: '',
    genre: '全部',
    slide: 0,
    timer: null,
    favorites: [],
  };

  const HISTORY_KEY = 'cm.searchHistory';

  /* ------------------------------ 初始化 ------------------------------ */
  async function init() {
    window.UI.mountHeader('home');
    window.UI.mountFooter();

    const params = window.Utils.queryParams();
    if (params.keyword) {
      state.keyword = params.keyword;
      qs('#homeSearch').value = params.keyword;
    }

    bindSearch();
    bindHeroControls();

    await loadAll();

    window.addEventListener('auth:changed', () => {
      renderFavorites();
      refreshGrid();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopCarousel();
      else startCarousel();
    });
  }

  async function loadAll() {
    const grid = qs('#nowGrid');
    grid.innerHTML = Array.from({ length: 8 }, () => `
      <div class="movie-card">
        <div class="poster-wrap skeleton" style="border-radius:14px"></div>
        <div class="card-info"><div class="skeleton" style="height:14px;width:70%"></div><div class="skeleton" style="height:11px;width:48%;margin-top:8px"></div></div>
      </div>`).join('');

    try {
      const [banners, showing, upcoming, ranking, showtimes] = await Promise.all([
        window.API.banners(),
        window.API.movies({ status: 'showing', pageSize: 40 }),
        window.API.movies({ status: 'upcoming', pageSize: 20 }),
        window.API.ranking(),
        window.API.showtimes({}),
      ]);
      state.banners = banners;
      state.showing = showing.list;
      state.upcoming = upcoming.list;

      renderHero();
      buildGenreFilter();
      renderGrid();
      renderRanking(ranking);
      renderUpcoming();
      renderStats(showtimes, showing.list.length);
      await loadFavorites();
    } catch (err) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
        <h3>数据加载失败</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  /* ------------------------------ 轮播 ------------------------------ */
  function renderHero() {
    const slides = qs('#heroSlides');
    const dots = qs('#heroDots');
    const list = state.banners.length ? state.banners : [];
    if (!list.length) return;

    slides.innerHTML = list.map((b, i) => `
      <div class="hero-slide ${i === 0 ? 'active' : ''}" data-index="${i}">
        <img src="${escapeHtml(b.image)}" alt="${escapeHtml(b.title)}" ${i === 0 ? '' : 'loading="lazy"'}>
      </div>`).join('');
    dots.innerHTML = list.map((_, i) => `<button data-slide="${i}" class="${i === 0 ? 'active' : ''}" aria-label="第 ${i + 1} 张"></button>`).join('');
    dots.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-slide]');
      if (btn) goSlide(Number(btn.dataset.slide));
    });
    updateHeroContent(0);
    startCarousel();
  }

  function movieFromBanner(banner) {
    const id = Number((banner.link || '').split('id=')[1]);
    return state.showing.concat(state.upcoming).find((m) => m.id === id) || null;
  }

  function updateHeroContent(index) {
    const banner = state.banners[index];
    if (!banner) return;
    const movie = movieFromBanner(banner);
    qs('#heroTitle').textContent = banner.title;
    qs('#heroSub').textContent = movie?.synopsis ? movie.synopsis.slice(0, 78) + '…' : (banner.subtitle || '');
    qs('#heroKicker').textContent = index === 0 ? 'CINEMAX · 本周精选' : 'CINEMAX · 正在热映';
    const meta = [];
    if (movie) {
      meta.push(`<span class="score">${Number(movie.rating || 0).toFixed(1)}<small> / 10</small></span>`);
      meta.push(`<span>${escapeHtml(movie.genre?.split(',').join(' / ') || '')}</span>`);
      meta.push(`<span>${movie.duration} 分钟</span>`);
      meta.push(`<span class="badge badge-brand">${movie.status === 'upcoming' ? '即将上映' : '热映中'}</span>`);
    }
    qs('#heroMeta').innerHTML = meta.join('');
    const cta = qs('#heroCta');
    cta.href = movie ? `/movie.html?id=${movie.id}` : (banner.link || '#now');
    cta.textContent = movie?.status === 'upcoming' ? '查看详情' : '立即购票';
    qs('#heroTrailer').dataset.movie = movie?.id || '';
  }

  function goSlide(index) {
    if (!state.banners.length) return;
    state.slide = (index + state.banners.length) % state.banners.length;
    qsa('.hero-slide').forEach((s, i) => s.classList.toggle('active', i === state.slide));
    qsa('#heroDots button').forEach((b, i) => b.classList.toggle('active', i === state.slide));
    updateHeroContent(state.slide);
    restartCarousel();
  }

  function startCarousel() {
    stopCarousel();
    state.timer = setInterval(() => goSlide(state.slide + 1), 6000);
  }
  function stopCarousel() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }
  function restartCarousel() { startCarousel(); }

  function bindHeroControls() {
    qs('#heroPrev').addEventListener('click', () => goSlide(state.slide - 1));
    qs('#heroNext').addEventListener('click', () => goSlide(state.slide + 1));
    const hero = qs('#hero');
    hero.addEventListener('mouseenter', stopCarousel);
    hero.addEventListener('mouseleave', startCarousel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && window.scrollY < 400) goSlide(state.slide - 1);
      if (e.key === 'ArrowRight' && window.scrollY < 400) goSlide(state.slide + 1);
    });
    qs('#heroTrailer').addEventListener('click', () => {
      const id = qs('#heroTrailer').dataset.movie;
      if (!id) return;
      const movie = state.showing.concat(state.upcoming).find((m) => String(m.id) === String(id));
      if (movie) openTrailer(movie);
    });
  }

  function openTrailer(movie) {
    const url = movie.trailerUrl || '';
    const mask = window.UI.openModal(`
      <div class="modal-head">
        <div><h3>${escapeHtml(movie.title)} · 预告片</h3><p>${escapeHtml(movie.originalTitle || '')}</p></div>
        <button class="modal-close" data-close>×</button>
      </div>
      <div style="border-radius:14px;overflow:hidden;background:#000;aspect-ratio:16/9">
        ${url ? `<video src="${escapeHtml(url)}" controls autoplay playsinline style="width:100%;height:100%;object-fit:contain;background:#000"></video>` : '<div style="display:grid;place-items:center;height:100%;color:#98a0b3">预告片暂未上线</div>'}
      </div>
    `, { size: 'modal-lg' });
    mask.addEventListener('click', (e) => {
      if (e.target === mask || e.target.closest('[data-close]')) {
        qs('video', mask)?.pause();
      }
    });
  }

  /* ------------------------------ 搜索 ------------------------------ */
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }
  function saveHistory(keyword) {
    const kw = keyword.trim();
    if (!kw) return;
    const list = [kw, ...getHistory().filter((k) => k !== kw)].slice(0, 8);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    renderHistory();
  }
  function renderHistory() {
    const list = getHistory();
    const box = qs('#historyChips');
    const clearBtn = qs('#clearHistory');
    qs('#historyLabel').textContent = list.length ? '搜索历史' : '暂无搜索历史';
    clearBtn.classList.toggle('hidden', !list.length);
    box.innerHTML = list.map((k) => `<span class="chip"><button data-history="${escapeHtml(k)}">${escapeHtml(k)}</button></span>`).join('');
  }

  function bindSearch() {
    renderHistory();
    const form = qs('#homeSearchForm');
    const input = qs('#homeSearch');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      doSearch(input.value.trim());
    });

    qs('#historyChips').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-history]');
      if (btn) { input.value = btn.dataset.history; doSearch(btn.dataset.history); }
    });

    qs('#hotChips').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-hot]');
      if (btn) { input.value = btn.dataset.hot; doSearch(btn.dataset.hot); }
    });

    qs('#clearHistory').addEventListener('click', () => {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
      toast('搜索历史已清空', 'info');
    });

    input.addEventListener('focus', () => {
      const panel = qs('#searchHistory');
      const list = getHistory();
      if (list.length) {
        panel.innerHTML = list.map((k) => `<button data-h="${escapeHtml(k)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
          ${escapeHtml(k)}</button>`).join('');
        panel.classList.add('open');
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-main')) qs('#searchHistory').classList.remove('open');
    });
    qs('#searchHistory').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-h]');
      if (btn) {
        input.value = btn.dataset.h;
        qs('#searchHistory').classList.remove('open');
        doSearch(btn.dataset.h);
      }
    });
  }

  async function doSearch(keyword) {
    state.keyword = keyword;
    saveHistory(keyword);
    qs('#searchHistory').classList.remove('open');
    if (!keyword) {
      state.showing = (await window.API.movies({ status: 'showing', pageSize: 40 })).list;
      renderGrid();
      return;
    }
    const grid = qs('#nowGrid');
    grid.innerHTML = `<div class="skeleton" style="grid-column:1/-1;height:120px"></div>`;
    try {
      const data = await window.API.movies({ keyword, pageSize: 40 });
      state.showing = data.list;
      renderGrid();
      document.querySelector('#now').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* ------------------------------ 影片网格 ------------------------------ */
  function buildGenreFilter() {
    const genres = new Set();
    state.showing.forEach((m) => (m.genre || '').split(',').filter(Boolean).forEach((g) => genres.add(g)));
    const row = qs('#genreFilter');
    if (row.dataset.built === '1' || !genres.size) return;
    row.dataset.built = '1';
    row.innerHTML = `<div class="seg">
      ${['全部', ...genres].map((g) => `<button data-genre="${g}" class="${g === state.genre ? 'active' : ''}">${g}</button>`).join('')}
    </div>`;
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-genre]');
      if (!btn) return;
      state.genre = btn.dataset.genre;
      qsa('[data-genre]', row).forEach((b) => b.classList.toggle('active', b === btn));
      renderGrid();
    });
  }

  function currentList() {
    let list = state.showing;
    if (state.genre !== '全部') {
      list = list.filter((m) => (m.genre || '').includes(state.genre));
    }
    return list;
  }

  function renderGrid() {
    const grid = qs('#nowGrid');
    const list = currentList();
    const sub = qs('#nowSub');
    if (state.keyword) {
      sub.innerHTML = `关键词「${escapeHtml(state.keyword)}」的搜索结果 · 共 ${list.length} 部
        <button class="link-more" id="clearSearch" style="border:0;background:none;color:#ff8fa3;margin-left:10px">清除搜索</button>`;
      qs('#clearSearch')?.addEventListener('click', () => {
        state.keyword = '';
        qs('#homeSearch').value = '';
        loadShowing();
      });
    } else {
      sub.textContent = '选一部好片，挑一个好座';
    }
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
        <h3>没有找到相关影片</h3><p>换个关键词试试，比如「星际」「猫猫」</p></div>`;
      return;
    }
    grid.innerHTML = list.map((m) => window.UI.movieCard(m)).join('');
    window.UI.bindFavButtons(grid, () => { loadFavorites(); });
  }

  async function loadShowing() {
    const data = await window.API.movies({ status: 'showing', pageSize: 40 });
    state.showing = data.list;
    renderGrid();
  }

  function refreshGrid() {
    if (!state.showing.length) return;
    renderGrid();
  }

  /* ------------------------------ 票房榜 ------------------------------ */
  function renderRanking(list) {
    qs('#rankList').innerHTML = list.map((m, i) => `
      <a class="rank-item" href="/movie.html?id=${m.id}">
        <span class="rank-no">${i + 1}</span>
        <span class="rank-poster"><img src="${escapeHtml(m.poster)}" alt="${escapeHtml(m.title)}" loading="lazy"></span>
        <span class="rank-info">
          <h4>${escapeHtml(m.title)}</h4>
          <p>${m.rating ? `${Number(m.rating).toFixed(1)} 分` : '暂无评分'} · ${m.commentCount || 0} 条评论</p>
        </span>
        <span class="rank-box"><b>${money(m.boxOffice).replace('.00', '')}</b><span>累计票房</span></span>
      </a>`).join('');
  }

  /* ------------------------------ 即将上映 ------------------------------ */
  function renderUpcoming() {
    const rail = qs('#upcomingRail');
    if (!state.upcoming.length) {
      rail.innerHTML = '<div class="empty" style="grid-column:1/-1"><h3>暂无待映影片</h3></div>';
      return;
    }
    rail.innerHTML = state.upcoming.map((m) => {
      const days = Math.max(0, Math.ceil((window.UI.parseLocal(m.releaseDate + ' 00:00').getTime() - Date.now()) / 86400000));
      return `<a class="upcoming-card" href="/movie.html?id=${m.id}">
        <img src="${escapeHtml(m.backdrop || m.poster)}" alt="${escapeHtml(m.title)}" loading="lazy">
        <span class="upcoming-days">${days > 0 ? `距上映 ${days} 天` : '即将上映'}</span>
        <div class="upcoming-info">
          <h3>${escapeHtml(m.title)}</h3>
          <p>${escapeHtml(m.genre?.split(',').join(' / ') || '')} · ${m.duration} 分钟 · ${escapeHtml(m.releaseDate || '')}</p>
          <span class="upcoming-want">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.8l5.9-.9Z"/></svg>
            ${m.favoriteCount || 0} 人想看
          </span>
        </div>
      </a>`;
    }).join('');
  }

  /* ------------------------------ 统计条 ------------------------------ */
  function renderStats(showtimes, movieCount) {
    const today = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
    const todays = showtimes.filter((s) => s.startTime.startsWith(todayStr));
    qs('#statShowtimes').textContent = todays.length;
    qs('#statSeats').textContent = todays.reduce((sum, s) => sum + (s.seatLeft || 0), 0);
    qs('#statMovies').textContent = movieCount;
    qs('#statCinemas').textContent = new Set(showtimes.map((s) => s.cinemaId)).size || 4;
  }

  /* ------------------------------ 我的收藏 ------------------------------ */
  async function loadFavorites() {
    if (!window.Auth.isLoggedIn) {
      state.favorites = [];
      renderFavorites();
      return;
    }
    try {
      state.favorites = await window.API.favorites();
    } catch {
      state.favorites = [];
    }
    renderFavorites();
  }

  function renderFavorites() {
    const box = qs('#favoritesBox');
    if (!window.Auth.isLoggedIn) {
      box.innerHTML = `<div class="fav-login">
        <p>登录后即可把想看的影片加入片单，开票时第一时间提醒你。</p>
        <button class="btn btn-primary" id="favLogin">登录 / 注册</button>
      </div>`;
      qs('#favLogin').addEventListener('click', () => window.UI.openAuthModal());
      return;
    }
    if (!state.favorites.length) {
      box.innerHTML = `<div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 20.5S3.5 15.2 3.5 9.3A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.5 3.1c0 5.9-8.5 11.2-8.5 11.2Z"/></svg>
        <h3>还没有想看的影片</h3><p>在影片海报上点击爱心，即可加入想看片单</p>
      </div>`;
      return;
    }
    box.innerHTML = `<div class="movie-grid">${state.favorites.map((m) => window.UI.movieCard(m)).join('')}</div>`;
    window.UI.bindFavButtons(box, () => { loadFavorites(); });
  }

  init();
})();
