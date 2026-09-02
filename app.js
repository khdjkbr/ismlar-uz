(function () {
  'use strict';

  // 7 дней в миллисекундах
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const ADMIN_PASSWORD_DEFAULT = "admin2026";

  const ALPHABETS = {
    lotin: [
      'A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 
      'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 
      'V', 'X', 'Y', 'Z', 'Oʻ', 'Gʻ', 'Sh', 'Ch'
    ],
    kirill: [
      'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 
      'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 
      'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Ъ', 'Ь', 'Э', 'Ю', 
      'Я', 'Ў', 'Қ', 'Ғ', 'Ҳ'
    ]
  };

  const TRANSLATIONS = {
    lotin: {
      siteTitle: "Ismlar.uz — O'zbek ismlari ma'nosi to'liq katalogi",
      welcomeTitle: "Farzandingiz uchun eng chiroyli va ma'noli ismni tanlang",
      welcomeSub: "12 000+ dan ortiq o'zbek xalq ismlarining to'liq ma'nosi, kelib chiqishi va izohi.",
      chooseAlifbo: "Dastlab o'zingizga qulay alifboni tanlang:",
      stage2Badge: "2-bosqich",
      genderTitle: "Farzandingiz jinsini tanlang",
      genderDesc: "Tanlovingizga ko'ra mos ismlar saralab beriladi",
      lblBoy: "O'g'il bola",
      lblBoySub: "Jasur, mard, baxtli",
      lblGirl: "Qiz bola",
      lblGirlSub: "Go'zal, latofatli, oqila",
      alphabetHeading: "Harf bo'yicha ismlar",
      alphabetHint: "Bosh harfni tanlang:",
      searchPlaceholder: "Ism bo'yicha tezkor qidiruv...",
      searchResHeading: "Qidiruv natijalari",
      top10Title: "Eng ko'p ko'rilgan 10 ta ism",
      top10BoyBadge: "O'g'il bolalar uchun",
      top10GirlBadge: "Qiz bolalar uchun",
      liveViewsNote: "Haqiqiy foydalanuvchilar ko'rishlari asosida",
      altScriptLabel: "Kirillcha yozilishi:",
      originLabel: "Kelib chiqishi:",
      genderBoyTag: "O'g'il bola",
      genderGirlTag: "Qiz bola",
      copiedText: "Ism ma'lumoti nusxalandi!",
      noNamesFound: "Bu bo'limda ismlar topilmadi",
      letterTitleSuffix: "harfi bilan boshlanuvchi ismlar",
      itemsFound: "ta ism topildi",
      footerRef: "Manba: E. A. Begmatovning «O'zbek ismlari ma'nosi» fundamental kitobi asosida.",
      favTitle: "Sevimlilar ro'yxati",
      favHeaderBtn: "Sevimlilar",
      favBannerText: "⏳ Ismlar ushbu qurilmada ro'yxatdan o'tmasdan <b>7 kun</b> saqlanadi.",
      favEmpty: "Hozircha sevimli ismlar yo'q. Istalgan ism yonidagi yurakcha (🤍) tugmasini bosing.",
      daysLeft: "kun qoldi",
      hoursLeft: "soat qoldi"
    },
    kirill: {
      siteTitle: "Ismlar.uz — Ўзбек исмлари маъноси тўлиқ каталоги",
      welcomeTitle: "Фарзандингиз учун энг чиройли ва маъноли исмни танланг",
      welcomeSub: "12 000+ дан ортиқ ўзбек халқ исмларининг тўлиқ маъноси, келиб чиқиши ва изоҳи.",
      chooseAlifbo: "Дастлаб ўзингизга қулай алифбони танланг:",
      stage2Badge: "2-босқич",
      genderTitle: "Фарзандингиз жинсини танланг",
      genderDesc: "Танловингизга кўра мос исмлар саралаб берилади",
      lblBoy: "Ўғил бола",
      lblBoySub: "Жасур, мард, бахтли",
      lblGirl: "Қиз бола",
      lblGirlSub: "Гўзал, латофатли, оқила",
      alphabetHeading: "Ҳарф бўйича исмлар",
      alphabetHint: "Бош ҳарфни танланг:",
      searchPlaceholder: "Исм бўйича тезкор қидирув...",
      searchResHeading: "Қидирув натижалари",
      top10Title: "Энг кўп кўрилган 10 та исм",
      top10BoyBadge: "Ўғил болалар учун",
      top10GirlBadge: "Қиз болалар учун",
      liveViewsNote: "Ҳақиқий фойдаланувчилар кўришлари асосида",
      altScriptLabel: "Лотинча ёзилиши:",
      originLabel: "Келиб чиқиши:",
      genderBoyTag: "Ўғил бола",
      genderGirlTag: "Қиз бола",
      copiedText: "Исм маълумоти нусхаланди!",
      noNamesFound: "Бу бўлимда исмлар топилмади",
      letterTitleSuffix: "ҳарфи билан бошланувчи исмлар",
      itemsFound: "та исм топилди",
      footerRef: "Манба: Э. А. Бегматовнинг «Ўзбек исмлари маъноси» фундаментал китоби асосида.",
      favTitle: "Севимлилар рўйхати",
      favHeaderBtn: "Севимлилар",
      favBannerText: "⏳ Исмлар ушбу қурилмада рўйхатдан ўтмасдан <b>7 кун</b> сақланади.",
      favEmpty: "Ҳозирча севимли исмлар йўқ. Исталган исм ёнидаги юракча (🤍) тугмасини босинг.",
      daysLeft: "кун қолди",
      hoursLeft: "соат қолди"
    }
  };

  const state = {
    script: 'lotin',
    gender: 'm',
    activeLetter: null,
    searchQuery: '',
    openedIds: new Set(),
    userViews: {},
    favorites: [],
    isAdmin: false
  };

  // --- Избранное с проверкой 7 дней ---
  function loadFavorites() {
    try {
      const stored = localStorage.getItem('ismlar_favorites_v2');
      if (stored) {
        const raw = JSON.parse(stored);
        const now = Date.now();
        // Удаляем устаревшие (> 7 дней)
        state.favorites = raw.filter(item => (now - item.addedAt) <= SEVEN_DAYS_MS);
      } else {
        state.favorites = [];
      }
    } catch (e) {
      state.favorites = [];
    }
    updateFavoritesBadge();
  }

  function saveFavorites() {
    try {
      localStorage.setItem('ismlar_favorites_v2', JSON.stringify(state.favorites));
    } catch (e) {}
    updateFavoritesBadge();
  }

  function isFavorite(itemId) {
    return state.favorites.some(f => f.id === itemId);
  }

  function toggleFavorite(itemId) {
    const idx = state.favorites.findIndex(f => f.id === itemId);
    if (idx !== -1) {
      state.favorites.splice(idx, 1);
    } else {
      state.favorites.push({ id: itemId, addedAt: Date.now() });
    }
    saveFavorites();

    document.querySelectorAll(`.fav-btn-${itemId}`).forEach(btn => {
      const isFav = isFavorite(itemId);
      btn.innerHTML = isFav ? '❤️' : '🤍';
    });

    const modalFav = document.getElementById('modalFavorites');
    if (modalFav && modalFav.style.display !== 'none') {
      renderFavoritesModal();
    }
  }

  function updateFavoritesBadge() {
    const badge = document.getElementById('favHeaderBadge');
    if (badge) badge.textContent = state.favorites.length;
  }

  function getRemainingDays(addedAt) {
    const elapsed = Date.now() - addedAt;
    const remaining = SEVEN_DAYS_MS - elapsed;
    const t = TRANSLATIONS[state.script];
    if (remaining <= 0) return `0 ${t.daysLeft}`;
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    if (days >= 1) return `${days} ${t.daysLeft}`;
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    return `${hours} ${t.hoursLeft}`;
  }

  function renderFavoritesModal() {
    const list = document.getElementById('favNamesList');
    const empty = document.getElementById('favEmptyState');
    const t = TRANSLATIONS[state.script];

    document.getElementById('favModalTitle').textContent = t.favTitle;
    document.getElementById('favInfoBanner').innerHTML = t.favBannerText;
    document.getElementById('favEmptyText').textContent = t.favEmpty;

    list.innerHTML = '';
    if (state.favorites.length === 0) {
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    state.favorites.forEach(fav => {
      const item = (window.ALL_NAMES || []).find(x => x.id === fav.id);
      if (item) {
        list.appendChild(createNameAccordionElement(item, fav.addedAt));
      }
    });
  }

  // --- Учёт просмотров ---
  function loadLocalViews() {
    try {
      const stored = localStorage.getItem('ismlar_views');
      if (stored) state.userViews = JSON.parse(stored);
    } catch (e) {}
  }

  function recordView(itemId) {
    state.userViews[itemId] = (state.userViews[itemId] || 0) + 1;
    try {
      localStorage.setItem('ismlar_views', JSON.stringify(state.userViews));
    } catch (e) {}

    const item = (window.ALL_NAMES || []).find(x => x.id === itemId);
    if (item) {
      const badge = document.getElementById(`viewBadge_${itemId}`);
      if (badge) badge.innerHTML = `👁️ ${(item.v + state.userViews[itemId]).toLocaleString()}`;
    }
    renderTop10();
  }

  function getTotalViews(item) {
    return (item.v || 50) + (state.userViews[item.id] || 0);
  }

  // --- Админ панель ---
  function loadCustomEdits() {
    try {
      const stored = localStorage.getItem('ismlar_custom_edits');
      if (stored && window.ALL_NAMES) {
        const edits = JSON.parse(stored);
        Object.keys(edits).forEach(id => {
          const numId = parseInt(id, 10);
          const idx = window.ALL_NAMES.findIndex(x => x.id === numId);
          if (idx !== -1) {
            window.ALL_NAMES[idx] = { ...window.ALL_NAMES[idx], ...edits[id] };
          }
        });
      }
    } catch (e) {}
  }

  function handleAdminLogin() {
    const pass = document.getElementById('adminPasswordInput').value.trim();
    if (pass === ADMIN_PASSWORD_DEFAULT) {
      state.isAdmin = true;
      document.getElementById('modalAdminLogin').style.display = 'none';
      document.getElementById('modalAdminPanel').style.display = 'flex';
      document.getElementById('adminLoginError').style.display = 'none';
    } else {
      document.getElementById('adminLoginError').style.display = 'block';
    }
  }

  function handleAdminSearch(val) {
    const q = val.trim().toLowerCase();
    const resBox = document.getElementById('adminQuickResults');
    if (!q) { resBox.style.display = 'none'; return; }

    const matches = (window.ALL_NAMES || []).filter(item => 
      (item.l || '').toLowerCase().includes(q) || 
      (item.k || '').toLowerCase().includes(q)
    ).slice(0, 10);

    resBox.innerHTML = '';
    matches.forEach(item => {
      const row = document.createElement('div');
      row.style.padding = '8px 12px';
      row.style.cursor = 'pointer';
      row.style.borderBottom = '1px solid #eee';
      row.textContent = `${item.l} (${item.k})`;
      row.addEventListener('click', () => {
        document.getElementById('adminEditForm').style.display = 'block';
        document.getElementById('editItemId').value = item.id;
        document.getElementById('editingNameDisplay').textContent = `${item.l} (${item.k})`;
        document.getElementById('editNameLotin').value = item.l;
        document.getElementById('editNameKirill').value = item.k;
        document.getElementById('editGender').value = item.g;
        document.getElementById('editLang').value = item.lang;
        document.getElementById('editMeaning').value = item.m;
        document.getElementById('editViews').value = getTotalViews(item);
        resBox.style.display = 'none';
      });
      resBox.appendChild(row);
    });
    resBox.style.display = 'block';
  }

  function handleSaveNameEdit() {
    const id = parseInt(document.getElementById('editItemId').value, 10);
    const item = (window.ALL_NAMES || []).find(x => x.id === id);
    if (!item) return;

    item.l = document.getElementById('editNameLotin').value.trim();
    item.k = document.getElementById('editNameKirill').value.trim();
    item.g = document.getElementById('editGender').value;
    item.lang = document.getElementById('editLang').value.trim();
    item.m = document.getElementById('editMeaning').value.trim();
    item.v = parseInt(document.getElementById('editViews').value, 10) || item.v;

    try {
      let edits = JSON.parse(localStorage.getItem('ismlar_custom_edits') || '{}');
      edits[item.id] = item;
      localStorage.setItem('ismlar_custom_edits', JSON.stringify(edits));
    } catch (e) {}

    const badge = document.getElementById('adminSaveStatus');
    badge.style.display = 'inline-block';
    setTimeout(() => { badge.style.display = 'none'; }, 2000);

    if (state.activeLetter) selectLetter(state.activeLetter);
    renderTop10();
  }

  function handleExportDb() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.ALL_NAMES || []));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "ismlar_yangilangan_baza.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }

  // --- Карточка-аккордеон имени ---
  function createNameAccordionElement(item, addedAtTime = null) {
    const t = TRANSLATIONS[state.script];
    const isLotin = state.script === 'lotin';
    const primaryName = isLotin ? item.l : item.k;
    const altName = isLotin ? item.k : item.l;
    const totalViews = getTotalViews(item);
    const isFav = isFavorite(item.id);

    const shareUrl = window.location.href.split('#')[0];
    const shareText = `👶 ${primaryName} — ${item.m || ''}\n\nManba: Ismlar.uz`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`;

    const wrap = document.createElement('div');
    wrap.className = 'name-accordion-item';
    wrap.id = `accordion_${item.id}`;

    const expireTag = addedAtTime ? `<span class="fav-expire-tag">⏳ ${getRemainingDays(addedAtTime)}</span>` : '';

    wrap.innerHTML = `
      <div class="accordion-header">
        <div class="accordion-left">
          <button type="button" class="btn-fav-toggle fav-btn-${item.id}">
            ${isFav ? '❤️' : '🤍'}
          </button>
          <strong class="name-primary">${primaryName}</strong>
          ${expireTag}
        </div>
        <div class="accordion-right">
          <span class="view-badge" id="viewBadge_${item.id}">👁️ ${totalViews.toLocaleString()}</span>
          <span>▼</span>
        </div>
      </div>
      <div class="accordion-body">
        <div class="card-meta-tags">
          <span class="meta-chip"><b>${t.altScriptLabel}</b> ${altName}</span>
          <span class="meta-chip"><b>${t.originLabel}</b> ${item.lang || "O'zbekcha"}</span>
          <span class="meta-chip">${item.g === 'm' ? '👦 O\'g\'il' : '👧 Qiz'}</span>
        </div>
        <div class="card-meaning-text">${item.m || "Ma'lumot kiritilmagan."}</div>
        <div class="card-share-block">
          <div class="share-buttons-group">
            <a href="${tgUrl}" target="_blank" class="share-action-btn tg">✈️ Telegram</a>
            <a href="${waUrl}" target="_blank" class="share-action-btn wa">💬 WhatsApp</a>
            <button type="button" class="share-action-btn copy btn-copy" data-text="${shareText}">📋 Nusxa olish</button>
          </div>
        </div>
      </div>
    `;

    // Клик по сердечку (Избранное)
    wrap.querySelector(`.fav-btn-${item.id}`).addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(item.id);
    });

    // Клик по кнопке копирования
    wrap.querySelector('.btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      const txt = e.currentTarget.getAttribute('data-text');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(() => alert(t.copiedText));
      } else {
        prompt("Nusxalang:", txt);
      }
    });

    // Раскрытие аккордеона и учёт просмотров
    wrap.querySelector('.accordion-header').addEventListener('click', () => {
      const isOpen = wrap.classList.toggle('open');
      if (isOpen) {
        recordView(item.id);
      }
    });

    return wrap;
  }

  // --- Топ 10 имён ---
  function renderTop10() {
    const grid = document.getElementById('top10Grid');
    if (!grid) return;
    grid.innerHTML = '';

    const isLotin = state.script === 'lotin';
    const filtered = (window.ALL_NAMES || []).filter(item => item.g === state.gender);
    filtered.sort((a, b) => getTotalViews(b) - getTotalViews(a));

    filtered.slice(0, 10).forEach((item, index) => {
      const primaryName = isLotin ? item.l : item.k;
      const isFav = isFavorite(item.id);
      const card = document.createElement('div');
      card.className = `top10-card rank-${index + 1}`;
      card.innerHTML = `
        <div class="top10-row-top">
          <span class="rank-badge">#${index + 1}</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" class="btn-fav-toggle fav-btn-${item.id}">${isFav ? '❤️' : '🤍'}</button>
            <span class="view-badge">👁️ ${getTotalViews(item).toLocaleString()}</span>
          </div>
        </div>
        <div class="top10-name-text">${primaryName}</div>
        <div class="top10-meaning-preview">${item.m || ''}</div>
      `;

      card.querySelector(`.fav-btn-${item.id}`).addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(item.id);
      });

      card.addEventListener('click', () => {
        state.activeLetter = primaryName.charAt(0).toUpperCase();
        selectLetter(state.activeLetter);
        setTimeout(() => {
          const el = document.getElementById(`accordion_${item.id}`);
          if (el) {
            if (!el.classList.contains('open')) el.querySelector('.accordion-header').click();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      });

      grid.appendChild(card);
    });
  }

  // --- Панель алфавита ---
  function renderAlphabetBar() {
    const bar = document.getElementById('alphabetBar');
    bar.innerHTML = '';
    ALPHABETS[state.script].forEach(letter => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'letter-btn';
      if (state.activeLetter === letter) btn.classList.add('active');
      btn.textContent = letter;
      btn.addEventListener('click', () => selectLetter(letter));
      bar.appendChild(btn);
    });
  }

  function selectLetter(letter) {
    if (state.activeLetter === letter) {
      state.activeLetter = null;
      document.getElementById('sectionLetterNames').style.display = 'none';
      renderAlphabetBar();
      return;
    }

    state.activeLetter = letter;
    renderAlphabetBar();

    const isLotin = state.script === 'lotin';
    const names = (window.ALL_NAMES || []).filter(item => {
      if (item.g !== state.gender) return false;
      const name = isLotin ? item.l : item.k;
      if (!name) return false;

      if (letter === 'Oʻ' || letter === "O'") return name.startsWith("Oʻ") || name.startsWith("O'") || name.startsWith("O‘");
      if (letter === 'Gʻ' || letter === "G'") return name.startsWith("Gʻ") || name.startsWith("G'") || name.startsWith("G‘");
      if (letter === 'Sh') return name.startsWith("Sh") || name.startsWith("sh");
      if (letter === 'Ch') return name.startsWith("Ch") || name.startsWith("ch");
      if (letter === 'O') return name.startsWith('O') && !name.startsWith("Oʻ") && !name.startsWith("O'");
      if (letter === 'G') return name.startsWith('G') && !name.startsWith("Gʻ") && !name.startsWith("G'");
      if (letter === 'S') return name.startsWith('S') && !name.startsWith("Sh");
      if (letter === 'C') return name.startsWith('C') && !name.startsWith("Ch");

      return name.toUpperCase().startsWith(letter.toUpperCase());
    });

    const sec = document.getElementById('sectionLetterNames');
    const t = TRANSLATIONS[state.script];
    document.getElementById('activeLetterBubble').textContent = letter;
    document.getElementById('letterResultsTitle').textContent = `"${letter}" ${t.letterTitleSuffix}`;
    document.getElementById('letterResultsCount').textContent = `${names.length} ${t.itemsFound}`;

    const list = document.getElementById('letterNamesList');
    list.innerHTML = '';
    if (names.length === 0) {
      list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">${t.noNamesFound}</div>`;
    } else {
      names.forEach(item => list.appendChild(createNameAccordionElement(item)));
    }

    sec.style.display = 'block';
    sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // --- Поиск ---
  function handleSearchInput(query) {
    state.searchQuery = query.trim().toLowerCase();
    const clearBtn = document.getElementById('clearSearchBtn');
    const searchSec = document.getElementById('sectionSearchResults');
    const letterSec = document.getElementById('sectionLetterNames');
    const top10Sec = document.getElementById('sectionTop10');
    const alphaSec = document.getElementById('sectionAlphabet');

    if (!state.searchQuery) {
      clearBtn.style.display = 'none';
      searchSec.style.display = 'none';
      top10Sec.style.display = 'block';
      alphaSec.style.display = 'block';
      if (state.activeLetter) letterSec.style.display = 'block';
      return;
    }

    clearBtn.style.display = 'flex';
    searchSec.style.display = 'block';
    letterSec.style.display = 'none';

    const matches = (window.ALL_NAMES || []).filter(item => {
      if (item.g !== state.gender) return false;
      return (item.l || '').toLowerCase().includes(state.searchQuery) ||
             (item.k || '').toLowerCase().includes(state.searchQuery) ||
             (item.m || '').toLowerCase().includes(state.searchQuery);
    });

    document.getElementById('searchCountBadge').textContent = `${matches.length} ta ism`;
    const list = document.getElementById('searchResultsList');
    list.innerHTML = '';
    matches.slice(0, 50).forEach(item => list.appendChild(createNameAccordionElement(item)));
  }

  // --- Переключение шагов ---
  function showStep(step) {
    document.getElementById('stepWelcome').style.display = (step === 'welcome') ? 'block' : 'none';
    document.getElementById('stepGender').style.display = (step === 'gender') ? 'block' : 'none';
    document.getElementById('catalogArea').style.display = (step === 'catalog') ? 'block' : 'none';

    if (step === 'catalog') {
      renderAlphabetBar();
      renderTop10();
    }
  }

  function updateLocalization() {
    const t = TRANSLATIONS[state.script];
    document.title = t.siteTitle;
    document.getElementById('welcomeTitle').textContent = t.welcomeTitle;
    document.getElementById('welcomeSubtitle').textContent = t.welcomeSub;
    document.getElementById('chooseAlphabetPrompt').textContent = t.chooseAlifbo;
    document.getElementById('genderTitle').textContent = t.genderTitle;
    document.getElementById('lblBoy').textContent = t.lblBoy;
    document.getElementById('lblGirl').textContent = t.lblGirl;
    document.getElementById('favLabelText').textContent = t.favHeaderBtn;
    document.getElementById('top10HeadingText').textContent = t.top10Title;
    document.getElementById('top10GenderBadge').textContent = state.gender === 'm' ? t.top10BoyBadge : t.top10GirlBadge;
    document.getElementById('searchInput').placeholder = t.searchPlaceholder;

    document.querySelectorAll('.script-switch .pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.script === state.script);
    });
    document.querySelectorAll('.gender-switch .pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.gender === state.gender);
    });

    document.body.classList.toggle('gender-m', state.gender === 'm');
    document.body.classList.toggle('gender-f', state.gender === 'f');
  }

  function bindEvents() {
    document.getElementById('btnChooseLotin').addEventListener('click', () => {
      state.script = 'lotin'; updateLocalization(); showStep('gender');
    });
    document.getElementById('btnChooseKirill').addEventListener('click', () => {
      state.script = 'kirill'; updateLocalization(); showStep('gender');
    });

    document.getElementById('btnSelectBoy').addEventListener('click', () => {
      state.gender = 'm'; updateLocalization(); showStep('catalog');
    });
    document.getElementById('btnSelectGirl').addEventListener('click', () => {
      state.gender = 'f'; updateLocalization(); showStep('catalog');
    });

    document.querySelectorAll('.script-switch .pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.script = e.currentTarget.dataset.script;
        state.activeLetter = null;
        document.getElementById('sectionLetterNames').style.display = 'none';
        updateLocalization(); renderAlphabetBar(); renderTop10();
      });
    });

    document.querySelectorAll('.gender-switch .pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.gender = e.currentTarget.dataset.gender;
        state.activeLetter = null;
        document.getElementById('sectionLetterNames').style.display = 'none';
        updateLocalization(); renderTop10();
      });
    });

    document.getElementById('closeLetterResultsBtn').addEventListener('click', () => {
      state.activeLetter = null;
      document.getElementById('sectionLetterNames').style.display = 'none';
      renderAlphabetBar();
    });

    const sIn = document.getElementById('searchInput');
    sIn.addEventListener('input', (e) => handleSearchInput(e.target.value));
    document.getElementById('clearSearchBtn').addEventListener('click', () => {
      sIn.value = ''; handleSearchInput('');
    });

    // Избранное
    document.getElementById('btnOpenFavorites').addEventListener('click', () => {
      renderFavoritesModal();
      document.getElementById('modalFavorites').style.display = 'flex';
    });
    document.getElementById('btnCloseFavModal').addEventListener('click', () => {
      document.getElementById('modalFavorites').style.display = 'none';
    });

    // Админка
    document.getElementById('btnOpenAdminLogin').addEventListener('click', () => {
      if (state.isAdmin) {
        document.getElementById('modalAdminPanel').style.display = 'flex';
      } else {
        document.getElementById('modalAdminLogin').style.display = 'flex';
      }
    });
    document.getElementById('btnCloseAdminLogin').addEventListener('click', () => {
      document.getElementById('modalAdminLogin').style.display = 'none';
    });
    document.getElementById('btnSubmitAdminLogin').addEventListener('click', handleAdminLogin);
    document.getElementById('btnCloseAdminPanel').addEventListener('click', () => {
      document.getElementById('modalAdminPanel').style.display = 'none';
    });
    document.getElementById('adminNameSearch').addEventListener('input', (e) => handleAdminSearch(e.target.value));
    document.getElementById('btnSaveNameEdit').addEventListener('click', handleSaveNameEdit);
    document.getElementById('btnExportDb').addEventListener('click', handleExportDb);

    if (window.location.hash === '#admin') {
      setTimeout(() => { document.getElementById('modalAdminLogin').style.display = 'flex'; }, 300);
    }
  }

  function init() {
    loadLocalViews();
    loadCustomEdits();
    loadFavorites();
    updateLocalization();
    bindEvents();
    showStep('welcome');
  }

  document
