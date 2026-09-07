(() => {
  'use strict';
  const track = (name, params = {}) => {
    try { if (typeof window.gtag === 'function') window.gtag('event', name, params); } catch (e) {}
    try { if (typeof window.ym === 'function') window.ym(112365590, 'reachGoal', name, params); } catch (e) {}
  };
  const STORE = 'ismlar_favorites_v3';
  const WEEK = 7 * 86400000;
  const normalize = s => (s || '').replace(/[‘ʻ`’ʼ]/g, "'").trim().toLowerCase();
  let indexPromise, memory = [], writable = true;
  const read = name => { try { return localStorage.getItem(name); } catch (e) { writable = false; return null; } };
  const write = () => { try { localStorage.setItem(STORE, JSON.stringify(memory)); } catch (e) { writable = false; } };
  function index() {
    if (!indexPromise) indexPromise = fetch('/search-index.json').then(r => {
      if (!r.ok) throw new Error('Qidiruv yuklanmadi. Qayta urinib ko‘ring.');
      return r.json();
    }).catch(e => { indexPromise = null; throw e; });
    return indexPromise;
  }
  function valid(rows) {
    const now = Date.now(), seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter(f => {
      if (!f || typeof f.key !== 'string' || !Number.isFinite(f.addedAt) || f.addedAt > now || seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    });
  }
  async function loadFavorites() {
    const current = read(STORE);
    try {
      if (current !== null) memory = valid(JSON.parse(current));
      else {
        const legacy = JSON.parse(read('ismlar_favorites_v2') || '[]');
        if (Array.isArray(legacy) && legacy.length) {
          const names = await index();
          memory = valid(legacy.flatMap(f => {
            const item = f && names.find(x => x.id === f.id);
            return item ? [{key: item.key, addedAt: f.addedAt}] : [];
          }));
        }
      }
    } catch (e) {
      // Do not persist an empty v3 store after a failed legacy migration request.
      if (current === null && read('ismlar_favorites_v2')) throw e;
      memory = [];
    }
    memory = valid(memory);
    write();
    return memory;
  }
  function updateButtons() {
    document.querySelectorAll('[data-fav-count]').forEach(el => { el.textContent = memory.length; });
    document.querySelectorAll('[data-save-name]').forEach(el => {
      const active = memory.some(f => f.key === el.dataset.saveName);
      el.setAttribute('aria-pressed', String(active));
      el.textContent = active ? '♥ Tanlanganlardan olib tashlash' : "♡ Tanlanganlarga qo'shish";
    });
  }
  function tile(item) {
    const link = document.createElement('a');
    link.className = 'catalog-name';
    link.href = item.url;
    const heading = document.createElement('h2');
    heading.textContent = item.l;
    const subtitle = document.createElement('small');
    subtitle.textContent = (item.g === 'm' ? "O'g'il bola" : 'Qiz bola') + (item.origin ? ' · ' + item.origin : '');
    const meaning = document.createElement('p');
    meaning.textContent = item.m || 'Ma’no hali kiritilmagan.';
    link.append(heading, meaning, subtitle);
    return link;
  }
  const favoritesList = document.getElementById('favorite-results');
  async function renderFavorites() {
    if (!favoritesList) return;
    const status = document.getElementById('favorite-status');
    await loadFavorites();
    updateButtons();
    favoritesList.replaceChildren();
    if (!memory.length) { status.textContent = 'Hozircha tanlangan ismlar yo‘q.'; return; }
    const names = await index();
    let missing = 0;
    for (const favorite of memory) {
      const item = names.find(n => n.key === favorite.key);
      if (!item) { missing++; continue; }
      const row = document.createElement('div');
      const button = document.createElement('button');
      button.className = 'nav-pill';
      button.type = 'button';
      button.textContent = 'Olib tashlash';
      button.setAttribute('aria-label', item.l + ' ismini olib tashlash');
      button.addEventListener('click', async () => {
        await loadFavorites();
        memory = memory.filter(f => f.key !== item.key);
        write();
        await renderFavorites();
      });
      const left = document.createElement('p');
      left.className = 'note';
      left.textContent = 'Shu brauzerda saqlangan';
      row.append(tile(item), left, button);
      favoritesList.append(row);
    }
    status.textContent = missing ? 'Ayrim saqlangan ismlar katalogda topilmadi.' : '';
  }
  const status = document.querySelector('[data-save-status]');
  document.querySelectorAll('[data-save-name]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await loadFavorites();
      const k = button.dataset.saveName;
      const active = memory.some(f => f.key === k);
      memory = active ? memory.filter(f => f.key !== k) : [...memory, {key: k, addedAt: Date.now()}];
      write(); updateButtons();
      if (status) status.textContent = writable ? (active ? 'Ro‘yxatdan olib tashlandi.' : 'Shu brauzerda saqlandi.') : 'Brauzer saqlashga ruxsat bermadi. Tanlov faqat shu sahifa ochiq paytda saqlanadi.';
    } catch (e) { if (status) status.textContent = 'Saqlangan ismlar yuklanmadi. Qayta urinib ko‘ring.'; }
    finally { button.disabled = false; }
  }));
  loadFavorites().then(async () => { updateButtons(); await renderFavorites(); }).catch(() => {
    const el = status || document.getElementById('favorite-status');
    if (el) el.textContent = 'Saqlangan ismlar yuklanmadi. Sahifani yangilang.';
  });
  window.addEventListener('storage', () => loadFavorites().then(() => { updateButtons(); return renderFavorites(); }).catch(() => {}));
  window.addEventListener('focus', () => loadFavorites().then(() => { updateButtons(); return renderFavorites(); }).catch(() => {}));

  const input = document.getElementById('name-search');
  if (input) {
    const results = document.getElementById('search-results');
    const status = document.getElementById('search-status');
    const more = document.getElementById('search-more');
    const gender = document.getElementById('filter-gender');
    let requestId = 0, limit = 50, matches = [], debounce;
    const render = () => {
      results.replaceChildren(...matches.slice(0, limit).map(tile));
      more.hidden = matches.length <= limit;
    };
    async function search() {
      const id = ++requestId;
      const q = normalize(input.value);
      results.replaceChildren(); more.hidden = true;
      const params = new URLSearchParams();
      if (q) params.set('q', input.value);
      if (gender.value) params.set('gender', gender.value);
      history.replaceState(null, '', location.pathname + (params.size ? '?' + params : ''));
      if (!q && !gender.value) { status.textContent = 'Ism yozing yoki jinsni tanlang.'; return; }
      status.textContent = 'Qidirilmoqda…';
      try {
        const names = await index();
        if (id !== requestId) return;
        matches = names.filter(n => normalize(n.l).includes(q) || normalize(n.k).includes(q));
        matches = matches.filter(n => !gender.value || n.g === gender.value);
        matches.sort((a, b) => Number(normalize(b.l).startsWith(q)) - Number(normalize(a.l).startsWith(q)) || a.l.localeCompare(b.l));
        limit = 50;
        status.textContent = matches.length ? matches.length + ' ta ism topildi' : 'Ism topilmadi. Boshqa yozilish variantini sinab ko‘ring.';
        render();
      } catch (e) { if (id === requestId) status.textContent = 'Qidiruv yuklanmadi. Qayta urinib ko‘ring.'; }
    }
    input.value = new URLSearchParams(location.search).get('q') || '';
    gender.value = new URLSearchParams(location.search).get('gender') || '';
    gender.addEventListener('change', search);
    input.form.addEventListener('reset', () => setTimeout(search, 0));
    input.addEventListener('input', () => { ++requestId; clearTimeout(debounce); debounce = setTimeout(search, 120); });
    input.form.addEventListener('submit', e => { e.preventDefault(); track('search_submit', {query: input.value.trim()}); search(); });
    more.addEventListener('click', () => { limit += 50; render(); });
    search();
  }
  document.addEventListener('click', e => {
    const save = e.target.closest('[data-save-name]');
    if (save) track('favorite_toggle', {name: save.getAttribute('data-name-label') || ''});
    const share = e.target.closest('a[href*="t.me/share"]');
    if (share) track('telegram_share');
    const gender = e.target.closest('.gender-option, .gender-card-btn');
    if (gender) track('gender_select', {label: gender.textContent.trim().slice(0, 40)});
  });
})();
