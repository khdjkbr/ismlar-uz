(function () {
    'use strict';

    const TOP_BOYS_NAMES = ["Muhammad", "Mustafo", "Imron", "Ali", "Umar", "Zubayr", "Zayd", "Ayub", "Jahongir", "Yusuf"];
    const TOP_GIRLS_NAMES = ["Sadiya", "Safiya", "Maryam", "Oyisha", "Aziza", "Muslima", "Mubina", "Hadicha", "Sumayya", "Imona"];

    const CORE_NAMES = [
      {id:1, l:"Muhammad", g:"m", lang:"Arabcha", m:"Maqtovga, olqishlarga sazovor. Payg'ambarimiz (s.a.v.)ning muborak ismlari."},
      {id:2, l:"Muhammadali", g:"m", lang:"Arabcha", m:"Muhammad va Ali ismlarining qo'shilishidan tashkil topgan ulug'vor ism."},
      {id:3, l:"Mustafo", g:"m", lang:"Arabcha", m:"Tanlangan, tanho, saylangan."},
      {id:4, l:"Imron", g:"m", lang:"Arabcha", m:"Tiriklik, barhayotlik, uzoq umr ko'ruvchi."},
      {id:5, l:"Ali", g:"m", lang:"Arabcha", m:"Oliy, yuksak martabali."},
      {id:6, l:"Umar", g:"m", lang:"Arabcha", m:"Barhayot, uzoq umr ko'ruvchi, adolatli."},
      {id:7, l:"Zubayr", g:"m", lang:"Arabcha", m:"Kuchli, qudratli, jasur va mard yigit."},
      {id:8, l:"Zayd", g:"m", lang:"Arabcha", m:"O'suvchi, ziyoda bo'luvchi, barakali."},
      {id:9, l:"Ayub", g:"m", lang:"Arabcha", m:"Sabr-toqatli, sinovlarga dosh beruvchi."},
      {id:10, l:"Jahongir", g:"m", lang:"Forscha", m:"Jahonni egallovchi, dunyoni zabt etuvchi."},
      {id:11, l:"Yusuf", g:"m", lang:"Arabcha", m:"Husnda tengsiz, go'zallik va jamol ramzi."},
      {id:12, l:"Sadiya", g:"f", lang:"Arabcha", m:"Baxtli, saodatli, omadli va quvonchli qiz."},
      {id:13, l:"Safiya", g:"f", lang:"Arabcha", m:"Sof, pokiza, tanlangan, chin do'st."},
      {id:14, l:"Maryam", g:"f", lang:"Arabcha", m:"Ibodatgo'y, pokiza; Iso payg'ambarning onalari."},
      {id:15, l:"Oyisha", g:"f", lang:"Arabcha", m:"Yashovchi, barhayot, saodatli ayol."},
      {id:16, l:"Aziza", g:"f", lang:"Arabcha", m:"Qadrli, hurmatli, ulug' va aziz inson."},
      {id:17, l:"Muslima", g:"f", lang:"Arabcha", m:"Musulmon, xudojoy, iymonli qiz."},
      {id:18, l:"Mubina", g:"f", lang:"Arabcha", m:"Ochiq-oydin, ravshan, porloq."},
      {id:19, l:"Hadicha", g:"f", lang:"Arabcha", m:"Chaqaloqlarning eng azizi."},
      {id:20, l:"Sumayya", g:"f", lang:"Arabcha", m:"Yuksak, qadr-qimmati baland, e'zozli ayol."},
      {id:21, l:"Imona", g:"f", lang:"Arabcha", m:"Iymonli, e'tiqodli, Allohga inonuvchi qiz."}
    ];

    window.ALL_NAMES = CORE_NAMES;

    const LATIN_ALPHABET = [
      'A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
      'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U',
      'V', 'X', 'Y', 'Z', "O'", "G'", 'Sh', 'Ch'
    ];

    let currentRenderedList = [];
    let currentLimit = 50;

    const state = {
      gender: 'm',
      activeLetter: null,
      favorites: []
    };

    function getBaseNames() {
      return (window.ALL_NAMES && Array.isArray(window.ALL_NAMES) && window.ALL_NAMES.length > 0)
        ? window.ALL_NAMES
        : CORE_NAMES;
    }

    function roundDownCount(n) {
      if (n >= 10000) return Math.floor(n / 1000) * 1000;
      if (n >= 1000) return Math.floor(n / 100) * 100;
      if (n >= 100) return Math.floor(n / 50) * 50;
      return Math.floor(n / 10) * 10;
    }

    function updateFooterStats() {
      const all = getBaseNames();
      const total = all.length;
      const boys = all.filter(x => x.g === 'm').length;
      const girls = all.filter(x => x.g === 'f').length;

      const tEl = document.getElementById('statTotal');
      const bEl = document.getElementById('statBoys');
      const gEl = document.getElementById('statGirls');

      if (tEl) tEl.textContent = roundDownCount(total).toLocaleString() + '+';
      if (bEl) bEl.textContent = roundDownCount(boys).toLocaleString() + '+';
      if (gEl) gEl.textContent = roundDownCount(girls).toLocaleString() + '+';
    }

    let dataReady = false;
    let dataPromise;
    let initialUrlHandled = false;
    const FAVORITES_KEY = 'ismlar_favorites_v3';
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const similarCache = new Map();
    function nameKey(item) { return item.g + ':' + normalizeStr(item.l); }
    function saveFavorites() {
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites)); } catch (e) {}
    }
    function cleanFavorites() {
      const now = Date.now();
      state.favorites = state.favorites.filter(f => f && typeof f.key === 'string' &&
        Number.isFinite(f.addedAt) && f.addedAt <= now);
      saveFavorites();
      const badge = document.getElementById('favHeaderBadge');
      if (badge) badge.textContent = state.favorites.length;
    }
    function loadFavorites() {
      try {
        const saved = localStorage.getItem(FAVORITES_KEY);
        const raw = JSON.parse(saved || localStorage.getItem('ismlar_favorites_v2') || '[]');
        state.favorites = Array.isArray(raw) ? raw.flatMap(f => {
          if (!f || typeof f !== 'object') return [];
          if (saved) return [f];
          const item = getBaseNames().find(x => x.id === f.id);
          return item ? [{key: nameKey(item), addedAt: f.addedAt}] : [];
        }) : [];
      } catch (e) { state.favorites = []; }
      cleanFavorites();
    }
    function checkUrlParams() {
      if (!dataReady || initialUrlHandled) return;
      initialUrlHandled = true;
      const params = new URLSearchParams(window.location.search);
      const key = params.get('ism');
      const item = key && getBaseNames().find(x => nameKey(x) === key);
      if (item) { window.selectSpecificName(item.id); return; }
      const gender = params.get('jins');
      if (gender === 'm' || gender === 'f') {
        window.selectGender(gender);
        if (params.get('harf')) window.selectLetter(params.get('harf'));
      }
      if (params.get('q')) {
        window.openSearchModal();
        document.getElementById('modalSearchInput').value = params.get('q');
        window.handleLiveSearch(params.get('q'));
      }
    }
    function refreshDataOnScreen() {
      dataReady = true;
      similarCache.clear();
      loadFavorites();
      updateFooterStats();
      if (document.getElementById('catalogArea').style.display === 'block') {
        const letter = state.activeLetter;
        state.activeLetter = null;
        if (letter) window.selectLetter(letter);
        renderTop10();
      }
      if (document.getElementById('modalSearch').style.display === 'flex') {
        window.handleLiveSearch(document.getElementById('modalSearchInput').value);
      }
      if (document.getElementById('modalFavorites').style.display === 'flex') window.openFavoritesModal();
      checkUrlParams();
    }
    function ensureNames() {
      if (dataPromise) return dataPromise;
      dataPromise = fetch('/names.json')
      .then(res => { if (!res.ok) throw new Error('Missing names.json'); return res.json(); })
      .then(data => {
        if (!Array.isArray(data) || !data.length) throw new Error('Empty names data');
        window.ALL_NAMES = data;
        refreshDataOnScreen();
      })
      .catch(() => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/names_data.js';
        script.onload = () => { refreshDataOnScreen(); resolve(); };
        script.onerror = () => { dataPromise = null; reject(new Error('Ismlar yuklanmadi')); };
        document.body.appendChild(script);
      }));
      return dataPromise;
    }

    window.startChoosing = function () {
      showStep('gender');
    };

    window.selectGender = function (gender) {
      if (!dataReady) ensureNames().catch(showLoadError);
      state.gender = gender;
      state.activeLetter = null;

      const letterSec = document.getElementById('letterNamesSection');
      if (letterSec) letterSec.style.display = 'none';

      document.body.classList.toggle('gender-m', gender === 'm');
      document.body.classList.toggle('gender-f', gender === 'f');

      const badge = document.getElementById('top10GenderBadge');
      if (badge) {
        badge.textContent = gender === 'm' ? "O'g'il bolalar uchun" : "Qiz bolalar uchun";
      }

      showStep('catalog');
      renderAlphabetBar();
      renderTop10();
    };

    function normalizeStr(str) {
      return (str || '')
        .replace(/[‘'ʻ`’]/g, "'")
        .toLowerCase()
        .trim();
    }

    window.selectLetter = function (letter) {
      if (state.activeLetter === letter) {
        state.activeLetter = null;
        renderAlphabetBar();
        const letterSec = document.getElementById('letterNamesSection');
        if (letterSec) letterSec.style.display = 'none';
        return;
      }

      state.activeLetter = letter;
      renderAlphabetBar();

      const letterSec = document.getElementById('letterNamesSection');
      if (letterSec) letterSec.style.display = 'block';

      const normLetter = normalizeStr(letter);

      const names = getBaseNames().filter(item => {
        if (item.g !== state.gender) return false;
        const normName = normalizeStr(item.l);
        if (!normName) return false;

        if (normLetter === "o'") return normName.startsWith("o'");
        if (normLetter === "g'") return normName.startsWith("g'");
        if (normLetter === 'sh') return normName.startsWith('sh');
        if (normLetter === 'ch') return normName.startsWith('ch');
        if (normLetter === 'o') return normName.startsWith('o') && !normName.startsWith("o'");
        if (normLetter === 'g') return normName.startsWith('g') && !normName.startsWith("g'");
        if (normLetter === 's') return normName.startsWith('s') && !normName.startsWith("sh");
        if (normLetter === 'c') return normName.startsWith('c') && !normName.startsWith("ch");

        return normName.startsWith(normLetter);
      });

      currentRenderedList = names;
      currentLimit = 50;

      const bubble = document.getElementById('activeLetterBubble');
      const title = document.getElementById('letterResultsTitle');
      const count = document.getElementById('letterResultsCount');

      if (bubble) bubble.textContent = letter;
      if (title) title.textContent = `"${letter}" harfi bilan boshlanuvchi ismlar`;
      if (count) count.textContent = `${names.length} ta ism topildi`;

      renderCurrentList();
    };

    function renderCurrentList() {
      const list = document.getElementById('letterNamesList');
      const loadBtn = document.getElementById('loadMoreBtn');
      if (!list) return;

      list.innerHTML = '';
      const visible = currentRenderedList.slice(0, currentLimit);

      if (visible.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);">Bu harf bo'yicha ismlar topilmadi</div>`;
        if (loadBtn) loadBtn.style.display = 'none';
        return;
      }

      visible.forEach(item => list.appendChild(createNameAccordionElement(item)));

      if (loadBtn) {
        loadBtn.style.display = currentLimit < currentRenderedList.length ? 'block' : 'none';
      }
    }

    window.loadMoreNames = function () {
      currentLimit += 50;
      renderCurrentList();
    };

    window.openSearchModal = function () {
      if (window.NAME_ROUTES) { location.href = '/qidiruv/'; return; }
      ensureNames().catch(showLoadError);
      document.getElementById('modalSearch').style.display = 'flex';
      setTimeout(() => document.getElementById('modalSearchInput').focus(), 80);
    };

    window.closeSearchModal = function () {
      document.getElementById('modalSearch').style.display = 'none';
    };

    window.handleLiveSearch = function (query) {
      const q = normalizeStr(query);
      const badge = document.getElementById('liveSearchCountBadge');
      const list = document.getElementById('liveSearchResultsList');

      if (!list) return;

      if (!q) {
        if (badge) badge.style.display = 'none';
        list.innerHTML = '';
        return;
      }

      const matches = getBaseNames().filter(item => {
        const normName = normalizeStr(item.l);
        return normName.startsWith(q) || normName.includes(q);
      });

      matches.sort((a, b) => {
        const nameA = normalizeStr(a.l);
        const nameB = normalizeStr(b.l);
        const startsA = nameA.startsWith(q);
        const startsB = nameB.startsWith(q);
        if (startsA && !startsB) return -1;
        if (!startsA && startsB) return 1;
        return nameA.localeCompare(nameB);
      });

      if (badge) {
        badge.style.display = 'block';
        badge.textContent = `${matches.length} ta ism topildi:`;
      }

      list.innerHTML = '';
      if (matches.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">Bunday ism topilmadi</div>`;
      } else {
        matches.slice(0, 50).forEach(item => list.appendChild(createNameAccordionElement(item)));
      }
    };

    window.openFavoritesModal = function () {
      if (window.NAME_ROUTES) { location.href = '/tanlangan/'; return; }
      if (!dataReady) ensureNames().catch(showLoadError);
      cleanFavorites();
      const list = document.getElementById('favNamesList');
      const empty = document.getElementById('favEmptyState');
      if (list) {
        list.innerHTML = '';
        if (state.favorites.length === 0) {
          if (empty) empty.style.display = 'block';
        } else {
          if (empty) empty.style.display = 'none';
          state.favorites.forEach(fav => {
            const item = getBaseNames().find(x => nameKey(x) === fav.key);
            if (item) list.appendChild(createNameAccordionElement(item));
          });
        }
      }
      document.getElementById('modalFavorites').style.display = 'flex';
    };

    window.closeFavoritesModal = function () {
      document.getElementById('modalFavorites').style.display = 'none';
    };

    window.toggleFavorite = function (itemId) {
      if (!dataReady) return;
      cleanFavorites();
      const item = getBaseNames().find(x => x.id === itemId);
      if (!item) return;
      const key = nameKey(item);
      const idx = state.favorites.findIndex(f => f.key === key);
      if (idx !== -1) {
        state.favorites.splice(idx, 1);
      } else {
        state.favorites.push({ key, addedAt: Date.now() });
      }
      try {
        saveFavorites();
      } catch (e) {}

      const badge = document.getElementById('favHeaderBadge');
      if (badge) badge.textContent = state.favorites.length;

      document.querySelectorAll(`.fav-btn-${itemId}`).forEach(btn => {
        btn.innerHTML = state.favorites.some(f => f.key === key) ? '❤️' : '🤍';
      });
      if (document.getElementById('modalFavorites').style.display === 'flex') window.openFavoritesModal();
    };

    function getSimilarNames(currentItem, allNamesList, limit = 3) {
      if (!allNamesList || !Array.isArray(allNamesList)) return [];
      const cacheKey = currentItem.id + ':' + limit;
      if (similarCache.has(cacheKey)) return similarCache.get(cacheKey);

      const currentNameNorm = normalizeStr(currentItem.l);
      const currentLang = currentItem.lang || '';
      const currentGender = currentItem.g;

      let candidates = allNamesList.filter(x => x.g === currentGender && x.id !== currentItem.id);

      const scored = candidates.map(item => {
        let score = 0;
        const nameNorm = normalizeStr(item.l);

        if (nameNorm.includes(currentNameNorm) || currentNameNorm.includes(nameNorm)) {
          score += 10;
        }

        if (currentNameNorm.length >= 3 && nameNorm.length >= 3) {
          if (nameNorm.slice(0, 3) === currentNameNorm.slice(0, 3)) {
            score += 5;
          }
        }

        if (item.lang === currentLang) score += 3;
        if (nameNorm[0] === currentNameNorm[0]) score += 2;
        if (Math.abs(nameNorm.length - currentNameNorm.length) <= 2) score += 2;

        return { item, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const result = scored.slice(0, limit).map(x => x.item);
      similarCache.set(cacheKey, result);
      return result;
    }

    function firstLetter(name) {
      const value = normalizeStr(name);
      const special = ["o'", "g'", 'sh', 'ch'].find(x => value.startsWith(x));
      const letter = special || value[0];
      return letter ? letter[0].toUpperCase() + letter.slice(1) : '';
    }
    window.selectSpecificName = function(itemId) {
      const target = getBaseNames().find(x => x.id === itemId);
      if (!target) return;
      if (window.NAME_ROUTES && window.NAME_ROUTES[nameKey(target)]) {
        location.href = window.NAME_ROUTES[nameKey(target)];
        return;
      }
      window.closeSearchModal();
      window.closeFavoritesModal();
      window.selectGender(target.g);
      window.selectLetter(firstLetter(target.l));
      const index = currentRenderedList.findIndex(x => x.id === target.id);
      if (index < 0) return;
      currentLimit = Math.max(50, Math.ceil((index + 1) / 50) * 50);
      renderCurrentList();
      const card = document.getElementById('letterNamesList').querySelector('[data-name-id="' + target.id + '"]');
      if (card) {
        card.classList.add('open');
        card.scrollIntoView({behavior: 'smooth', block: 'center'});
      }
    };

    function nameUrl(item) {
      if (window.NAME_ROUTES && window.NAME_ROUTES[nameKey(item)]) return new URL(window.NAME_ROUTES[nameKey(item)], location.origin).href;
      const url = new URL(window.location.pathname, window.location.origin);
      url.searchParams.set('ism', nameKey(item));
      return url.href;
    }
    function createNameAccordionElement(item) {
      const primaryName = item.l || '';
      const isFav = state.favorites.some(f => f.key === nameKey(item));
      const wrap = document.createElement('div');
      wrap.className = 'name-accordion-item';
      wrap.dataset.nameId = item.id;

      const shareText = `👶 ${primaryName} — ${item.m || ''}\n\nManba: Bolagaism.uz`;
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(nameUrl(item))}&text=${encodeURIComponent(shareText)}`;

      const similarItems = getSimilarNames(item, getBaseNames(), 3);
      let similarHtml = '';
      if (similarItems.length > 0) {
        similarHtml = `
          <div class="similar-names-block">
            <div class="similar-title">O'xshash ismlar:</div>
            <div class="similar-chips">
              ${similarItems.map(sim => `<a class="similar-chip" href="${escapeHtml(nameUrl(sim))}">${escapeHtml(sim.l)}</a>`).join('')}
            </div>
          </div>
        `;
      }

      wrap.innerHTML = `
        <div class="accordion-header">
          <div class="accordion-left">
            <button type="button" class="btn-fav-toggle fav-btn-${item.id}">
              ${isFav ? '❤️' : '🤍'}
            </button>
            <strong class="name-primary">${primaryName}</strong>
          </div>
          <div class="accordion-right">
            <span>▼</span>
          </div>
        </div>
        <div class="accordion-body">
          <div class="card-meta-tags">
            <span class="meta-chip"><b>Kelib chiqishi:</b> ${item.lang || "O'zbekcha"}</span>
            <span class="meta-chip meta-gender">${item.g === 'm' ? "👦 O'g'il bola" : "👧 Qiz bola"}</span>
          </div>
          <div class="card-meaning-text">${item.m || "Ma'lumot kiritilmagan."}</div>
          ${similarHtml}
          <div class="card-share-block">
            <a href="${tgUrl}" target="_blank" class="share-action-btn tg">✈️ Telegramda ulashish</a>
          </div>
        </div>
      `;

      wrap.querySelector(`.fav-btn-${item.id}`).addEventListener('click', (e) => {
        e.stopPropagation();
        window.toggleFavorite(item.id);
      });

      const headerEl = wrap.querySelector('.accordion-header');
      headerEl.addEventListener('click', () => {
        wrap.classList.toggle('open');

      });

      return wrap;
    }

    function renderTop10() {
      const grid = document.getElementById('top10Grid');
      if (!grid) return;
      grid.innerHTML = '';

      const topNamesList = state.gender === 'm' ? TOP_BOYS_NAMES : TOP_GIRLS_NAMES;

      const topItems = [];
      topNamesList.forEach(nameStr => {
        const found = getBaseNames().find(x => x.g === state.gender && normalizeStr(x.l) === normalizeStr(nameStr));
        if (found) {
          topItems.push(found);
        }
      });

      topItems.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `top10-card rank-${index + 1}`;
        card.innerHTML = `
          <div class="top10-row-top">
            <span class="rank-badge">#${index + 1}</span>
          </div>
          <div class="top10-name-text">${item.l}</div>
          <div class="top10-meaning-preview">${item.m || ''}</div>
        `;

        card.addEventListener('click', () => {
          window.selectSpecificName(item.id);
        });

        grid.appendChild(card);
      });
    }

    function renderAlphabetBar() {
      const bar = document.getElementById('alphabetBar');
      if (!bar) return;
      bar.innerHTML = '';
      LATIN_ALPHABET.forEach(letter => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'letter-btn';
        if (state.activeLetter === letter) btn.classList.add('active');
        btn.textContent = letter;
        btn.addEventListener('click', () => window.selectLetter(letter));
        bar.appendChild(btn);
      });
    }

    function showStep(step) {
      const welcome = document.getElementById('stepWelcome');
      const gender = document.getElementById('stepGender');
      const catalog = document.getElementById('catalogArea');
      if (welcome) welcome.style.display = (step === 'welcome') ? 'block' : 'none';
      if (gender) gender.style.display = (step === 'gender') ? 'block' : 'none';
      if (catalog) catalog.style.display = (step === 'catalog') ? 'block' : 'none';
    }

    function init() {
      showStep(window.NAME_ROUTES ? 'gender' : 'welcome');
      const params = new URLSearchParams(location.search);
      const routes = window.NAME_ROUTES;
      if (routes && params.get('ism') && routes[params.get('ism')]) {
        location.replace(routes[params.get('ism')]); return;
      }
      if (routes && params.has('q')) {
        location.replace('/qidiruv/?q=' + encodeURIComponent(params.get('q'))); return;
      }
      if (routes && ['m', 'f'].includes(params.get('jins'))) {
        const group = params.get('jins') === 'm' ? 'ogil-bola-ismlari' : 'qiz-bola-ismlari';
        const letter = LATIN_ALPHABET.find(l => normalizeStr(l) === normalizeStr(params.get('harf')));
        if (!params.has('harf') || letter) {
          location.replace('/' + group + '/' + (letter ? normalizeStr(letter).replace("'", '-tutuq') + '/' : '')); return;
        }
      }
      if (params.has('ism') || params.has('q') || params.has('jins')) {
        // Legacy interactive views are useful to visitors, but are not separate SEO pages.
        let robots = document.querySelector('meta[name="robots"]');
        if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots); }
        robots.content = 'noindex, follow';
        ensureNames().catch(showLoadError);
      }
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function showLoadError() {
      const target = document.getElementById('top10Grid');
      if (target) target.textContent = 'Ismlar yuklanmadi. Sahifani yangilang yoki alifbo katalogidan foydalaning.';
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
