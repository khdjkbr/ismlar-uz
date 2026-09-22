const ADMIN_EMAIL = 'khdjkbr@yandex.com';
const SESSION_DAYS = 7;
const INDEXNOW_KEY = '2c155b3f192c4d3e9e3a0ceb8733f171';
const INDEXNOW_KEY_LOCATION = 'https://bolagaism.uz/2c155b3f192c4d3e9e3a0ceb8733f171.txt';

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
function normalizeOriginValue(value) {
  const seen = new Set();
  return String(value || '').split('/').map((part) => part.trim()).filter(Boolean).filter((part) => {
    const key = part.toLocaleLowerCase(); if (seen.has(key)) return false; seen.add(key); return true;
  }).join(' / ');
}
function originCandidates(value) {
  return [...new Set(String(value || '').split('/').map((part) => part.trim()).filter(Boolean))];
}
const SINGLE_NAME_EXCEPTIONS = new Set(['gulbahor']);
const SINGLE_NAME_SUFFIXES = ['bek', 'jon', 'xon'];
const COMPOUND_PARTS = ['muhammad', 'abdulloh', 'abdulla', 'abduali', 'ali', 'umar', 'nazar', 'murod', 'vali', 'shoh', 'mirzo', 'polvon', 'qul', 'berdi', 'botir', 'gul', 'bahor'];
function isSingleName(value) {
  const name = String(value || '').trim().toLocaleLowerCase().replace(/[‘’ʻ]/g, "'");
  if (!name || SINGLE_NAME_EXCEPTIONS.has(name) || name.startsWith('mir')) return true;
  if (SINGLE_NAME_SUFFIXES.some((suffix) => name.endsWith(suffix) && name.length > suffix.length)) return true;
  return !COMPOUND_PARTS.some((part) => name.startsWith(part) && name.length > part.length + 1 && COMPOUND_PARTS.some((other) => other !== part && name.endsWith(other)));
}
async function submitIndexNow(paths) {
  const urlList = [...new Set(paths)].filter(Boolean).map((path) => `https://bolagaism.uz${path.startsWith('/') ? path : `/${path}`}`);
  if (!urlList.length) return;
  try {
    await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host: 'bolagaism.uz', key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList }) });
  } catch (_) { /* IndexNow is best-effort and must not block publishing. */ }
}
function accessEmail(request) { return request.headers.get('Cf-Access-Authenticated-User-Email') || request.headers.get('cf-access-authenticated-user-email') || ''; }
function cookie(request, name) { const value = request.headers.get('Cookie') || ''; const match = value.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return match ? decodeURIComponent(match[1]) : ''; }
async function digest(value) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function sessionUser(request, env) {
  const trusted = accessEmail(request).toLowerCase();
  if (trusted === ADMIN_EMAIL) return ADMIN_EMAIL;
  const token = cookie(request, 'oshxona_session');
  if (!token || !env.DB) return '';
  const row = await env.DB.prepare('SELECT email, expires_at FROM admin_sessions WHERE token_hash = ?').bind(await digest(token)).first();
  if (!row || row.email.toLowerCase() !== ADMIN_EMAIL || new Date(row.expires_at).getTime() <= Date.now()) return '';
  return row.email;
}
async function sessionCookie(email, env) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  await env.DB.prepare('INSERT INTO admin_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)').bind(await digest(token), email, new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()).run();
  return `oshxona_session=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}
function b64url(bytes) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function textB64url(value) { return b64url(new TextEncoder().encode(value)); }
function pemToBuffer(pem) { const normalized = String(pem).replace(/\\n/g, '\n').replace(/\\r/g, ''); const clean = normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ''); const binary = atob(clean); return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer; }
async function googleAccessToken(env) {
  if (!env.GA_CLIENT_EMAIL || !env.GA_PRIVATE_KEY) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = textB64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = textB64url(JSON.stringify({ iss: env.GA_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey('pkcs8', pemToBuffer(env.GA_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signingInput = header + '.' + payload;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const assertion = signingInput + '.' + b64url(new Uint8Array(signature));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + encodeURIComponent(assertion) });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google authorization failed (${response.status}): ${details.slice(0, 240)}`);
  }
  const data = await response.json(); return data.access_token;
}
async function googleAnalyticsReport(env) {
  const missing = ['GA_PROPERTY_ID', 'GA_CLIENT_EMAIL', 'GA_PRIVATE_KEY'].filter((key) => !env[key]);
  if (missing.length) return { configured: false, missing };
  const token = await googleAccessToken(env);
  const response = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + encodeURIComponent(env.GA_PROPERTY_ID) + ':runReport', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }], dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }] }) });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Analytics report failed (${response.status}): ${details.slice(0, 240)}`);
  }
  const data = await response.json(); const daily = (data.rows || []).map((row) => { const values = (row.metricValues || []).map((item) => Number(item.value || 0)); return { date: row.dimensionValues?.[0]?.value || '', activeUsers: values[0] || 0, sessions: values[1] || 0, pageViews: values[2] || 0 }; });
  const totals = daily.reduce((sum, row) => ({ activeUsers: sum.activeUsers + row.activeUsers, sessions: sum.sessions + row.sessions, pageViews: sum.pageViews + row.pageViews }), { activeUsers: 0, sessions: 0, pageViews: 0 });
  return { configured: true, period: '7days', ...totals, daily };
}
async function yandexMetrikaReport(env) {
  const counterId = String(env.YANDEX_METRIKA_COUNTER_ID || '112365590').trim();
  if (!env.YANDEX_METRIKA_TOKEN) return { configured: false, counterId, missing: ['YANDEX_METRIKA_TOKEN'] };
  const params = new URLSearchParams({ ids: counterId, date1: '6daysAgo', date2: 'today', group: 'day', metrics: 'ym:s:users,ym:s:visits,ym:s:pageviews', accuracy: 'high', lang: 'ru' });
  const response = await fetch('https://api-metrika.yandex.net/stat/v1/data/bytime?' + params.toString(), { headers: { Authorization: 'OAuth ' + env.YANDEX_METRIKA_TOKEN, Accept: 'application/json' } });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Yandex Metrica report failed (${response.status}): ${details.slice(0, 240)}`);
  }
  const data = await response.json();
  const totals = (data.totals?.[0] || []).map((value) => Number(value || 0));
  const series = data.data?.[0]?.metrics || [];
  const dates = data.data?.[0]?.dimensions || [];
  const daily = (dates.length ? dates : Array.from({ length: Math.max(...series.map((items) => items.length), 0) }, () => ({}))).map((dimension, index) => ({ date: dimension?.[0]?.name || '', users: Number(series[0]?.[index] || 0), visits: Number(series[1]?.[index] || 0), pageViews: Number(series[2]?.[index] || 0) }));
  return { configured: true, counterId, period: '7days', users: totals[0] || 0, visits: totals[1] || 0, pageViews: totals[2] || 0, daily, sampled: Boolean(data.sampled), dataLag: data.data_lag || 0 };
}
async function seedBuiltInArticles(env) {
  const now = new Date().toISOString();
  const content = `Ism tanlashda oilangiz uchun muhim bo‘lgan ma’no, qulay talaffuz va yozilishni birgalikda ko‘rib chiqing. Quyidagi oddiy tartib variantlarni solishtirishga yordam beradi.

Avval kichik ro‘yxat tuzing
Bir necha yoqqan ismni tanlanganlarga qo‘shing. Har birining ma’nosini o‘qing va sizga aynan nimasi yoqqanini yozib qo‘ying. Ma’nosi muhim bo‘lsa, uning manbasi borligini ham tekshiring.

Familiya bilan birga ayting
Ismni familiya bilan ovoz chiqarib aytib ko‘ring. Kundalik murojaatda talaffuzi sizga qulaymi? Oila a’zolari uni qanday qisqartirishini ham muhokama qilishingiz mumkin.

Yozilish variantlarini solishtiring
Lotin va kirill yozuvida ishlatadigan shaklingizni oldindan kelishib oling. Bir ism turli tillarda turlicha yozilishi mumkin; o‘xshash yozilgan barcha ismlar bir xil ma’noni anglatmaydi.

Tanlovni birgalikda muhokama qiling
Yoqtirgan ismingiz sahifasini Telegram orqali yaqinlaringizga yuborishingiz mumkin. Tanlanganlar shu brauzerda saqlanadi, shuning uchun yakuniy ro‘yxatingizni alohida yozib qo‘yish foydali.`;
  await env.DB.prepare('INSERT OR IGNORE INTO articles (id, slug, title, excerpt, content, category, cover_image, status, seo_title, seo_description, author_email, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('builtin-ism-tanlash', 'ism-tanlash', 'Farzandga ism tanlash', 'Ism ma’nosi, talaffuzi va yozilishini solishtirish bo‘yicha amaliy yo‘riqnoma.', content, 'Ota-onalar uchun', '', 'published', 'Farzandga ism tanlash: amaliy yo‘riqnoma | Bolagaism.uz', 'Ismlarni ma’nosi, talaffuzi va yozilishi bo‘yicha solishtirish uchun amaliy yo‘riqnoma.', 'system', now, now).run();
}
async function authApi(request, env, url) {
  if (!env.DB) return json({ error: 'Admin database is not configured yet' }, 503);
  if (request.method === 'GET' && url.pathname === '/api/oshxona/auth/status') {
    const user = await sessionUser(request, env);
    const admin = await env.DB.prepare('SELECT email FROM admin_users WHERE email = ?').bind(ADMIN_EMAIL).first();
    return json({ authenticated: Boolean(user), user: user || null, setupRequired: !admin });
  }
  if (request.method === 'POST' && url.pathname === '/api/oshxona/auth/setup') {
    const body = await request.json(); const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '');
    if (email !== ADMIN_EMAIL) return json({ error: 'Этот email не разрешён' }, 403);
    if (password.length < 10) return json({ error: 'Пароль должен содержать не менее 10 символов' }, 400);
    const existing = await env.DB.prepare('SELECT email FROM admin_users WHERE email = ?').bind(ADMIN_EMAIL).first();
    if (existing) return json({ error: 'Первичная настройка уже выполнена' }, 409);
    await env.DB.prepare('INSERT INTO admin_users (email, password_hash) VALUES (?, ?)').bind(ADMIN_EMAIL, await digest(password)).run();
    await env.DB.prepare('INSERT INTO audit_log (action, entity_type, entity_id, editor_email, metadata_json) VALUES (?, ?, ?, ?, ?)').bind('created', 'admin_user', ADMIN_EMAIL, ADMIN_EMAIL, '{}').run();
    return json({ ok: true }, 201, { 'Set-Cookie': await sessionCookie(ADMIN_EMAIL, env) });
  }
  if (request.method === 'POST' && url.pathname === '/api/oshxona/auth/login') {
    const body = await request.json(); const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '');
    const row = await env.DB.prepare('SELECT email, password_hash FROM admin_users WHERE email = ?').bind(email).first();
    if (!row || email !== ADMIN_EMAIL || (await digest(password)) !== row.password_hash) return json({ error: 'Неверный email или пароль' }, 401);
    return json({ ok: true, user: email }, 200, { 'Set-Cookie': await sessionCookie(email, env) });
  }
  if (request.method === 'POST' && url.pathname === '/api/oshxona/auth/logout') {
    const token = cookie(request, 'oshxona_session'); if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await digest(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': 'oshxona_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' });
  }
  return null;
}
async function api(request, env) {
  const url = new URL(request.url); const authResponse = await authApi(request, env, url); if (authResponse) return authResponse;
  const email = await sessionUser(request, env); if (!email) return json({ error: 'Authentication required' }, 401);
  const articlesApi = url.pathname.startsWith('/api/oshxona/articles');
  const videosApi = url.pathname.startsWith('/api/oshxona/videos');
  const collectionsApi = url.pathname.startsWith('/api/oshxona/collections');
  if (request.method === 'GET' && url.pathname === '/api/oshxona/analytics/google') {
    try { return json(await googleAnalyticsReport(env)); } catch (error) { return json({ configured: true, error: `Google Analytics API: ${error.message}` }, 502); }
  }
  if (request.method === 'GET' && url.pathname === '/api/oshxona/analytics/yandex') {
    try { return json(await yandexMetrikaReport(env)); } catch (error) { return json({ configured: true, error: `Yandex Metrica API: ${error.message}` }, 502); }
  }
  if (articlesApi) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', cover_image TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived')), seo_title TEXT NOT NULL DEFAULT '', seo_description TEXT NOT NULL DEFAULT '', author_email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS article_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id TEXT NOT NULL, snapshot_json TEXT NOT NULL, action TEXT NOT NULL, editor_email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
    await seedBuiltInArticles(env);
  }
  if (videosApi) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY, video_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')), sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_videos_status_order ON videos(status, sort_order, published_at)`).run();
  }
  if (collectionsApi) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS name_collections (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', origin TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')), sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_name_collections_status_order ON name_collections(status, sort_order)`).run();
  }
  if (request.method === 'POST' && url.pathname === '/api/oshxona/import') {
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 200)));
    const source = await env.ASSETS.fetch(new Request(new URL('/names_data.js', request.url)));
    const sourceText = await source.text();
    const match = sourceText.match(/window\.ALL_NAMES\s*=\s*(\[.*\])\s*;?\s*$/s);
    if (!match) return json({ error: 'Names data is unavailable' }, 503);
    const names = JSON.parse(match[1]);
    const routeResponse = await env.ASSETS.fetch(new Request(new URL('/routes.json', request.url)));
    const routes = await routeResponse.json();
    const batch = names.slice(offset, offset + limit);
    const statements = batch.map((item) => {
      const key = `${item.g}:${String(item.l).toLowerCase()}`;
      const route = routes[key] || `/ism/${String(item.l).toLowerCase().replace(/[^a-z0-9а-яё']+/gi, '-').replace(/^-|-$/g, '')}/`;
      const slug = route.replace(/^\/ism\//, '').replace(/\/$/, '');
      return env.DB.prepare('INSERT OR IGNORE INTO names (id, slug, name, gender, meaning, origin, source, status, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(String(item.id), slug, item.l, item.g, item.m || '', normalizeOriginValue(item.lang), "«O'zbek ismlari ma'nosi» — Begmatov E.A. O'zbekiston Milliy Ensiklopediyasi. Davlat ilmiy nashriyoti, 2007.", 'published', `${item.l} ismining ma'nosi, kelib chiqishi va yozilish variantlari.`);
    });
    if (statements.length) await env.DB.batch(statements);
    const nextOffset = offset + batch.length;
    return json({ imported: batch.length, offset, nextOffset, total: names.length, done: nextOffset >= names.length });
  }
  if (request.method === 'GET' && url.pathname === '/api/oshxona/names-lite') {
    const source = await env.ASSETS.fetch(new Request(new URL('/names_data.js', request.url))); const text = await source.text(); const match = text.match(/window\.ALL_NAMES\s*=\s*(\[.*\])\s*;?\s*$/s); if (!match) return json({ error: 'Names data is unavailable' }, 503);
    const all = JSON.parse(match[1]); const normalizeLetter = (value) => String(value || '').trim().toLowerCase().replace(/[‘’ʻ]/g, "'"); const q = (url.searchParams.get('q') || '').trim().toLowerCase(); const genders = (url.searchParams.get('gender') || '').split(',').map((value) => value.trim()).filter(Boolean); const originsFilter = (url.searchParams.get('origin') || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean); const lettersFilter = normalizeLetter(url.searchParams.get('letter') || ''); const statuses = (url.searchParams.get('status') || '').split(',').map((value) => value.trim()).filter(Boolean); const offset = Math.max(0, Number(url.searchParams.get('offset') || 0)); const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 50))); const filtered = all.filter((item) => { const name = String(item.l || ''); const variants = String(item.k || ''); const itemOrigin = normalizeOriginValue(item.lang); return (!q || name.toLowerCase().includes(q) || variants.toLowerCase().includes(q)) && (!genders.length || genders.includes(item.g)) && (!originsFilter.length || originsFilter.some((origin) => itemOrigin.toLowerCase().includes(origin))) && (!lettersFilter || normalizeLetter(name).startsWith(lettersFilter)) && (!statuses.length || statuses.includes('published')); }); const page = filtered.slice(offset, offset + limit); const rows = page.map((item) => ({ id: String(item.id), slug: String(item.l || '').toLowerCase().replace(/[^a-z0-9а-яё']+/gi, '-').replace(/^-|-$/g, ''), name: item.l, gender: item.g, origin: normalizeOriginValue(item.lang), meaning: item.m || '', variants: item.k || '', status: 'published', seo_description: `${item.l} ismining ma'nosi, kelib chiqishi va yozilish variantlari.`, updated_at: '' })); const origins = [...new Set(all.flatMap((item) => originCandidates(item.lang)))].sort((a, b) => a.localeCompare(b)); const letters = [...new Set(all.map((item) => String(item.l || '').trim().charAt(0).toUpperCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b)); return json({ user: email, rows, total: filtered.length, offset, limit, hasMore: offset + rows.length < filtered.length, origins, letters, counts: { total: all.length, published: all.length, review: 0, draft: 0 }, fallback: true });
  }
  if (request.method === 'GET' && url.pathname === '/api/oshxona/names') {
    const q = (url.searchParams.get('q') || '').trim(); const status = url.searchParams.get('status') || ''; const where = []; const args = [];
    if (q) { where.push('(name LIKE ? OR slug LIKE ?)'); args.push(`%${q}%`, `%${q}%`); } if (status) { where.push('status = ?'); args.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
      const rows = await Promise.race([env.DB.prepare(`SELECT id, slug, name, gender, origin, meaning, variants, status, seo_description, updated_at FROM names ${clause} ORDER BY updated_at DESC LIMIT 100`).bind(...args).all(), new Promise((_, reject) => setTimeout(() => reject(new Error('Names query timeout')), 5000))]);
      const counts = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(status = 'published') AS published, SUM(status = 'review') AS review, SUM(status = 'draft') AS draft FROM names").first(); return json({ user: email, rows: rows.results || [], counts });
    } catch (error) {
      const source = await env.ASSETS.fetch(new Request(new URL('/names_data.js', request.url))); const text = await source.text(); const match = text.match(/window\.ALL_NAMES\s*=\s*(\[.*\])\s*;?\s*$/s); if (!match) return json({ error: 'Names data is unavailable' }, 503);
      const all = JSON.parse(match[1]); const normalized = q.toLowerCase(); const filtered = all.filter((item) => (!normalized || String(item.l || '').toLowerCase().includes(normalized) || String(item.k || '').toLowerCase().includes(normalized)) && (!status || status === 'published')).slice(0, 100); const rows = filtered.map((item) => ({ id: String(item.id), slug: String(item.l || '').toLowerCase().replace(/[^a-z0-9а-яё']+/gi, '-').replace(/^-|-$/g, ''), name: item.l, gender: item.g, origin: normalizeOriginValue(item.lang), meaning: item.m || '', variants: item.k || '', status: 'published', seo_description: `${item.l} ismining ma'nosi, kelib chiqishi va yozilish variantlari.`, updated_at: '' })); return json({ user: email, rows, counts: { total: all.length, published: all.length, review: 0, draft: 0 }, fallback: true });
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/oshxona/articles') {
    const q = (url.searchParams.get('q') || '').trim(); const status = url.searchParams.get('status') || ''; const where = []; const args = [];
    if (q) { where.push('(title LIKE ? OR slug LIKE ?)'); args.push(`%${q}%`, `%${q}%`); } if (status) { where.push('status = ?'); args.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''; const rows = await env.DB.prepare(`SELECT id, slug, title, excerpt, category, cover_image, status, seo_title, seo_description, updated_at, published_at FROM articles ${clause} ORDER BY updated_at DESC LIMIT 100`).bind(...args).all();
    const counts = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(status = 'published') AS published, SUM(status = 'review') AS review, SUM(status = 'draft') AS draft FROM articles").first(); return json({ user: email, rows: rows.results || [], counts });
  }
  if (request.method === 'GET' && url.pathname === '/api/oshxona/videos') {
    const q = (url.searchParams.get('q') || '').trim(); const status = url.searchParams.get('status') || ''; const where = []; const args = [];
    if (q) { where.push('(title LIKE ? OR description LIKE ? OR video_id LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); } if (status) { where.push('status = ?'); args.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''; const rows = await env.DB.prepare(`SELECT id, video_id, title, description, status, sort_order, updated_at, published_at FROM videos ${clause} ORDER BY sort_order ASC, updated_at DESC LIMIT 100`).bind(...args).all();
    const counts = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(status = 'published') AS published, SUM(status = 'draft') AS draft FROM videos").first(); return json({ user: email, rows: rows.results || [], counts });
  }
  if (request.method === 'GET' && url.pathname === '/api/oshxona/collections') {
    const status = url.searchParams.get('status') || '';
    const clause = status ? 'WHERE status = ?' : '';
    const rows = await env.DB.prepare(`SELECT id, slug, title, description, origin, status, sort_order, updated_at FROM name_collections ${clause} ORDER BY sort_order ASC, title ASC`).bind(...(status ? [status] : [])).all();
    return json({ user: email, rows: rows.results || [] });
  }
  if ((request.method === 'POST' || request.method === 'PATCH') && url.pathname.startsWith('/api/oshxona/collections')) {
    const body = await request.json(); const title = String(body.title || '').trim(); const origin = String(body.origin || '').trim();
    if (!title || !origin) return json({ error: 'Название и происхождение обязательны' }, 400);
    const slug = String(body.slug || title.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '')).trim();
    const status = ['draft','published','archived'].includes(body.status) ? body.status : 'draft'; const order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0; const now = new Date().toISOString(); const id = url.pathname.split('/').pop();
    if (request.method === 'POST') { const newId = crypto.randomUUID(); await env.DB.prepare('INSERT INTO name_collections (id, slug, title, description, origin, status, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, slug, title, String(body.description || '').trim(), origin, status, order, now).run(); if (status === 'published') await submitIndexNow(['/ismlar-toplamlari/' + slug + '/']); return json({ id: newId }, 201); }
    const previous = await env.DB.prepare('SELECT id FROM name_collections WHERE id = ?').bind(id).first(); if (!previous) return json({ error: 'Collection not found' }, 404);
    await env.DB.prepare('UPDATE name_collections SET slug=?, title=?, description=?, origin=?, status=?, sort_order=?, updated_at=? WHERE id=?').bind(slug, title, String(body.description || '').trim(), origin, status, order, now, id).run(); if (status === 'published') await submitIndexNow(['/ismlar-toplamlari/' + slug + '/']); return json({ id });
  }
  if ((request.method === 'POST' || request.method === 'PATCH') && url.pathname.startsWith('/api/oshxona/videos')) {
    const body = await request.json(); const title = String(body.title || '').trim(); const rawVideo = String(body.video_id || '').trim(); const videoId = (rawVideo.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,20})/) || [null, rawVideo])[1];
    if (!title || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return json({ error: 'Укажите название и корректный YouTube ID' }, 400);
    const id = url.pathname.split('/').pop(); const now = new Date().toISOString(); const status = body.status || 'draft'; const order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
    if (!['draft', 'published', 'archived'].includes(status)) return json({ error: 'Некорректный статус' }, 400);
    if (request.method === 'POST') { const newId = crypto.randomUUID(); await env.DB.prepare('INSERT INTO videos (id, video_id, title, description, status, sort_order, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, videoId, title, String(body.description || '').trim(), status, order, now, status === 'published' ? now : null).run(); if (status === 'published') await submitIndexNow(['/video/' + videoSlug(title) + '/']); return json({ id: newId }, 201); }
    const previous = await env.DB.prepare('SELECT id FROM videos WHERE id = ?').bind(id).first(); if (!previous) return json({ error: 'Video not found' }, 404);
    await env.DB.prepare('UPDATE videos SET video_id=?, title=?, description=?, status=?, sort_order=?, updated_at=?, published_at=CASE WHEN ? = \'published\' THEN COALESCE(published_at, ?) ELSE published_at END WHERE id=?').bind(videoId, title, String(body.description || '').trim(), status, order, now, status, now, id).run(); if (status === 'published') await submitIndexNow(['/video/' + videoSlug(title) + '/']); return json({ id });
  }
  if ((request.method === 'POST' || request.method === 'PATCH') && url.pathname.startsWith('/api/oshxona/articles')) {
    const body = await request.json(); if (!body.title) return json({ error: 'Title is required' }, 400); const id = url.pathname.split('/').pop(); const now = new Date().toISOString();
    if (request.method === 'POST') { const newId = crypto.randomUUID(); const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, ''); const payload = { id:newId, slug, ...body }; await env.DB.prepare('INSERT INTO articles (id, slug, title, excerpt, content, category, cover_image, status, seo_title, seo_description, author_email, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, slug, body.title, body.excerpt || '', body.content || '', body.category || '', body.cover_image || '', body.status || 'draft', body.seo_title || body.title, body.seo_description || body.excerpt || '', email, now, body.status === 'published' ? now : null).run(); await env.DB.prepare('INSERT INTO article_revisions (article_id, snapshot_json, action, editor_email) VALUES (?, ?, ?, ?)').bind(newId, JSON.stringify(payload), 'created', email).run(); if (body.status === 'published') await submitIndexNow(['/maqolalar/' + slug + '/', '/maqolalar/']); return json({ id:newId }, 201); }
    const previous = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first(); if (!previous) return json({ error: 'Article not found' }, 404); await env.DB.prepare('INSERT INTO article_revisions (article_id, snapshot_json, action, editor_email) VALUES (?, ?, ?, ?)').bind(id, JSON.stringify(previous), body.status === 'published' && previous.status !== 'published' ? 'published' : 'updated', email).run(); await env.DB.prepare('UPDATE articles SET slug=?, title=?, excerpt=?, content=?, category=?, cover_image=?, status=?, seo_title=?, seo_description=?, updated_at=?, published_at=CASE WHEN ? = \'published\' THEN COALESCE(published_at, ?) ELSE published_at END WHERE id=?').bind(body.slug || previous.slug, body.title, body.excerpt || '', body.content || '', body.category || '', body.cover_image || '', body.status || 'draft', body.seo_title || body.title, body.seo_description || body.excerpt || '', now, body.status || 'draft', now, id).run(); if (body.status === 'published' || previous.status === 'published') await submitIndexNow(['/maqolalar/' + (body.slug || previous.slug) + '/', '/maqolalar/']); return json({ id });
  }
  if (request.method === 'POST' || request.method === 'PATCH') {
    const body = await request.json(); if (!body.name || !['m', 'f'].includes(body.gender)) return json({ error: 'Name and gender are required' }, 400); const id = url.pathname.split('/').pop(); const now = new Date().toISOString();
    if (request.method === 'POST') { const newId = crypto.randomUUID(); const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, ''); await env.DB.prepare('INSERT INTO names (id, slug, name, gender, meaning, origin, variants, status, seo_description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, slug, body.name, body.gender, body.meaning || '', body.origin || '', body.variants || '', body.status || 'draft', body.seo_description || '', now).run(); const snapshot = JSON.stringify({ id: newId, slug, ...body }); await env.DB.prepare('INSERT INTO name_revisions (name_id, snapshot_json, action, editor_email) VALUES (?, ?, ?, ?)').bind(newId, snapshot, 'created', email).run(); await env.DB.prepare('INSERT INTO audit_log (action, entity_type, entity_id, editor_email, metadata_json) VALUES (?, ?, ?, ?, ?)').bind('created', 'name', newId, email, JSON.stringify({ name: body.name })).run(); if (body.status === 'published') await submitIndexNow(['/ism/' + slug + '/']); return json({ id: newId }, 201); }
    const previous = await env.DB.prepare('SELECT * FROM names WHERE id = ?').bind(id).first();
    if (!previous) return json({ error: 'Name not found' }, 404);
    await env.DB.prepare('INSERT INTO name_revisions (name_id, snapshot_json, action, editor_email) VALUES (?, ?, ?, ?)').bind(id, JSON.stringify(previous), body.status === 'published' && previous.status !== 'published' ? 'published' : 'updated', email).run();
    await env.DB.prepare('UPDATE names SET name = ?, gender = ?, meaning = ?, origin = ?, variants = ?, status = ?, seo_description = ?, updated_at = ?, published_at = CASE WHEN ? = \'published\' THEN COALESCE(published_at, ?) ELSE published_at END WHERE id = ?').bind(body.name, body.gender, body.meaning || '', body.origin || '', body.variants || '', body.status || 'draft', body.seo_description || '', now, body.status || 'draft', now, id).run(); await env.DB.prepare('INSERT INTO audit_log (action, entity_type, entity_id, editor_email, metadata_json) VALUES (?, ?, ?, ?, ?)').bind('updated', 'name', id, email, JSON.stringify({ name: body.name, status: body.status })).run(); if (body.status === 'published' || previous.status === 'published') await submitIndexNow(['/ism/' + (body.slug || previous.slug) + '/']); return json({ id });
  }
  return json({ error: 'Not found' }, 404);
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function videoSlug(value) { return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0400-\u04ff]+/gi, '-').replace(/^-|-$/g, '') || 'video'; }
const DEFAULT_COLLECTIONS = [
  ['arabcha-ismlar', 'Arabcha ismlar', 'Arabcha kelib chiqishidagi ma’noli ismlar.', 'Arabcha', 1],
  ['fors-tojikcha-ismlar', 'Fors-tojikcha ismlar', 'Fors-tojikcha kelib chiqishidagi chiroyli ismlar.', 'Fors-tojikcha', 2],
  ['ozbekcha-ismlar', 'O‘zbekcha ismlar', 'O‘zbekcha va turkiy ildizga ega ismlar.', "O'zbekcha", 3],
  ['ibroniycha-ismlar', 'Ibroniycha ismlar', 'Ibroniycha kelib chiqishidagi ismlar.', 'Ibroniycha', 4],
  ['yunoncha-ismlar', 'Yunoncha ismlar', 'Yunoncha kelib chiqishidagi ismlar.', 'Yunoncha', 5],
  ['hindcha-ismlar', 'Hindcha ismlar', 'Hindcha kelib chiqishidagi ismlar.', 'Hindcha', 6]
];
function collectionOriginSql(origin) { return origin === "O'zbekcha" ? "origin LIKE '%O''zbekcha%'" : `origin LIKE '%${String(origin).replace(/'/g, "''")}%'`; }
async function ensureDefaultCollections(env) {
  if (!env.DB) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS name_collections (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', origin TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  for (const [slug, title, description, origin, order] of DEFAULT_COLLECTIONS) await env.DB.prepare('INSERT OR IGNORE INTO name_collections (id, slug, title, description, origin, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(`builtin-${slug}`, slug, title, description, origin, 'published', order).run();
}
async function collectionRows(env, collection) {
  const where = collectionOriginSql(collection.origin);
  const rows = (await env.DB.prepare(`SELECT slug, name, gender, meaning, origin FROM names WHERE status='published' AND ${where} ORDER BY name COLLATE NOCASE ASC LIMIT 300`).all()).results || [];
  return rows.filter((row) => isSingleName(row.name)).slice(0, 50);
}
function nameCollectionCard(row) { return `<a class="collection-name-card" href="/ism/${encodeURIComponent(row.slug)}/"><strong>${escapeHtml(row.name)}</strong><span>${escapeHtml(row.meaning || row.origin || '')}</span></a>`; }
async function nameCollectionsMarkup(env, request) {
  const render = (collections, rowsBySlug) => {
    if (!collections.length) return '';
    const cards = collections.map((collection) => {
      const rows = (rowsBySlug.get(collection.slug) || []).slice(0, 10);
      return `<article class="collection-panel"><div class="collection-panel-head"><span class="eyebrow">${escapeHtml(collection.origin)}</span><a href="/ismlar-toplamlari/${encodeURIComponent(collection.slug)}/">Barchasi</a></div><div class="collection-name-list">${rows.map(nameCollectionCard).join('')}</div></article>`;
    });
    return `<section class="name-collections" aria-label="Ismlar to‘plamlari"><div class="section-heading-concept"><span class="eyebrow">Ismlar to‘plamlari</span><a href="/ismlar-toplamlari/">Barcha to‘plamlar →</a></div><div class="collections-grid">${cards.join('')}</div></section>`;
  };
  try {
    if (!env.DB) throw new Error('D1 unavailable');
    await ensureDefaultCollections(env);
    const collections = (await env.DB.prepare("SELECT slug,title,description,origin FROM name_collections WHERE status='published' ORDER BY sort_order ASC, title ASC LIMIT 6").all()).results || [];
    const rowsBySlug = new Map(await Promise.all(collections.map(async (collection) => [collection.slug, await collectionRows(env, collection)])));
    const markup = render(collections, rowsBySlug);
    if (markup) return markup;
  } catch (_) {}
  // Keep the homepage useful even while D1 is unavailable or a legacy schema is being migrated.
  try {
    const assetUrl = request ? new URL('/names_data.js', request.url) : new URL('/names_data.js', 'https://bolagaism.uz');
    const source = await env.ASSETS.fetch(new Request(assetUrl));
    const text = await source.text(); const match = text.match(/window\.ALL_NAMES\s*=\s*(\[.*\])\s*;?\s*$/s);
    if (!match) return '';
    const all = JSON.parse(match[1]); const rowsBySlug = new Map();
    for (const [slug, , , origin] of DEFAULT_COLLECTIONS) {
      const rows = all.filter((item) => isSingleName(item.l) && String(item.lang || '').toLowerCase().includes(origin.toLowerCase().replace('o\'zbekcha', 'o\'zbekcha'))).slice(0, 10).map((item) => ({ slug: String(item.l || '').toLowerCase().replace(/[^a-z0-9а-яё']+/gi, '-').replace(/^-|-$/g, ''), name: item.l, meaning: item.m || '', origin: item.lang || '' }));
      rowsBySlug.set(slug, rows);
    }
    return render(DEFAULT_COLLECTIONS.map(([slug, title, description, origin]) => ({ slug, title, description, origin })), rowsBySlug);
  } catch (_) { return ''; }
}
async function videoMarkup(env) {
  if (!env.DB) return '';
  try {
    const rows = (await env.DB.prepare("SELECT video_id, title, description FROM videos WHERE status='published' ORDER BY sort_order ASC, published_at DESC LIMIT 12").all()).results || [];
    if (!rows.length) return '';
    return `<section class="video-carousel" aria-label="Foydali videolar"><div class="video-carousel-head"><div><span class="eyebrow">Video tavsiyalar</span></div><div class="video-carousel-controls"><a class="carousel-index-link" href="/video/">Barcha videolar</a><button type="button" class="video-scroll" data-video-scroll="prev" aria-label="Oldingi videolar">←</button><button type="button" class="video-scroll" data-video-scroll="next" aria-label="Keyingi videolar">→</button></div></div><div class="video-track" data-video-track>${rows.map((row) => { const slug = videoSlug(row.title); return `<article class="video-card"><a class="video-thumb" href="/video/${encodeURIComponent(slug)}/" data-video-id="${escapeHtml(row.video_id)}" aria-label="${escapeHtml(row.title)}"><img src="https://i.ytimg.com/vi/${encodeURIComponent(row.video_id)}/hqdefault.jpg" alt="${escapeHtml(row.title)}" loading="lazy"><span class="video-play" aria-hidden="true">▶</span></a><h3><a href="/video/${encodeURIComponent(slug)}/">${escapeHtml(row.title)}</a></h3>${row.description ? `<p>${escapeHtml(row.description)}</p>` : ''}</article>`; }).join('')}</div></section>`;
  } catch (error) { return ''; }
}
async function articleMarkup(env) {
  if (!env.DB) return '';
  try {
    const rows = (await env.DB.prepare("SELECT slug, title, excerpt, cover_image FROM articles WHERE status='published' ORDER BY published_at DESC, updated_at DESC LIMIT 12").all()).results || [];
    if (!rows.length) return '';
    return `<section class="video-carousel article-carousel" aria-label="Foydali maqolalar"><div class="video-carousel-head"><div><span class="eyebrow">Foydali maqolalar</span></div><div class="video-carousel-controls"><a class="carousel-index-link" href="/maqolalar/">Barcha maqolalar</a><button type="button" class="video-scroll" data-article-scroll="prev" aria-label="Oldingi maqolalar">←</button><button type="button" class="video-scroll" data-article-scroll="next" aria-label="Keyingi maqolalar">→</button></div></div><div class="video-track article-track" data-article-track>${rows.map((row) => { const image = row.cover_image ? `<img src="${escapeHtml(row.cover_image)}" alt="${escapeHtml(row.title)}" loading="lazy">` : `<span class="article-placeholder" aria-hidden="true">📖</span>`; return `<article class="video-card article-card"><a class="video-thumb article-thumb" href="/maqolalar/${encodeURIComponent(row.slug)}/" aria-label="${escapeHtml(row.title)}">${image}</a><h3><a href="/maqolalar/${encodeURIComponent(row.slug)}/">${escapeHtml(row.title)}</a></h3>${row.excerpt ? `<p>${escapeHtml(row.excerpt)}</p>` : ''}</article>`; }).join('')}</div></section>`;
  } catch (error) { return ''; }
}
async function withVideos(response, env, request) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const [markup, articles, collections] = await Promise.all([videoMarkup(env), articleMarkup(env), nameCollectionsMarkup(env, request)]);
  const html = await response.text();
  let updated = html;
  if (articles && updated.includes('article-teasers')) updated = updated.replace(/<section class="[^"]*article-teasers[^"]*">[\s\S]*?<\/section>/, articles);
  if (markup && !updated.includes('data-video-track')) updated = updated.replace('</main>', `${markup}</main>`);
  if (collections && (updated.includes('class="concept-hero"') || updated.includes('id="stepWelcome"')) && !updated.includes('name-collections')) updated = updated.replace('</main>', `${collections}</main>`);
  if (updated === html) return response;
  return new Response(updated, response);
}
async function publicVideoIndex(env) {
  const rows = (await env.DB.prepare("SELECT video_id,title,description,published_at FROM videos WHERE status='published' ORDER BY sort_order ASC,published_at DESC").all()).results || [];
  const cards = rows.map((row) => { const slug = videoSlug(row.title); return `<article class="video-card"><a class="video-thumb" href="/video/${encodeURIComponent(slug)}/"><img src="https://i.ytimg.com/vi/${encodeURIComponent(row.video_id)}/hqdefault.jpg" alt="${escapeHtml(row.title)}" loading="lazy"><span class="video-play" aria-hidden="true">▶</span></a><h2><a href="/video/${encodeURIComponent(slug)}/">${escapeHtml(row.title)}</a></h2>${row.description ? `<p>${escapeHtml(row.description)}</p>` : ''}</article>`; }).join('');
  const title = 'Video tavsiyalar | Bolagaism.uz'; const description = 'Farzandga ism tanlash va o‘zbek ismlari haqida foydali videolar.'; const canonical = 'https://bolagaism.uz/video/';
  const schema = { '@context':'https://schema.org', '@type':'CollectionPage', name:title, description, url:canonical, inLanguage:'uz', mainEntity:{ '@type':'ItemList', itemListElement:rows.map((row,index)=>({ '@type':'ListItem', position:index+1, name:row.title, url:`https://bolagaism.uz/video/${encodeURIComponent(videoSlug(row.title))}/` })) } };
  return new Response(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}"><meta name="robots" content="index,follow"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/seo.css"><link rel="stylesheet" href="/design.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/<\/script/gi,'<\\/script>')}</script></head><body><header class="sticky-header"><div class="header-container"><div class="brand-row"><a class="brand-logo" href="/"><span class="logo-icon">🍼</span><span class="logo-text">BolagaIsm<span class="logo-tld">.uz</span></span></a></div></div></header><main id="main" class="page-shell"><section class="paper collection-index"><nav class="breadcrumbs"><a href="/">Bosh sahifa</a><span>›</span><span>Video tavsiyalar</span></nav><span class="eyebrow">Video tavsiyalar</span><h1>Foydali videolar</h1><p class="meaning-lead">Ism tanlash va farzand tarbiyasi bo‘yicha tanlangan videolar.</p><div class="media-card-grid">${cards || '<p>Hozircha videolar yo‘q.</p>'}</div></section></main><footer class="site-footer"><div class="container"><strong>Bolagaism.uz</strong><p>Farzandingiz uchun ma'noli ism tanlang.</p><nav class="footer-links"><a href="/maqolalar/">Maqolalar</a><a href="/ismlar-toplamlari/">Ismlar to‘plamlari</a></nav></div></footer></body></html>`, { status:200, headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'} });
}
async function publicVideoPage(request, env, url) {
  if (!env.DB) return null;
  const match = url.pathname.match(/^\/video\/([^/]+)\/?$/); if (!match) return null;
  const requestedSlug = decodeURIComponent(match[1]);
  let rows = []; try { rows = (await env.DB.prepare("SELECT video_id, title, description, published_at FROM videos WHERE status='published' ORDER BY published_at DESC").all()).results || []; } catch (_) { return null; }
  const row = rows.find((item) => videoSlug(item.title) === requestedSlug || item.video_id === requestedSlug);
  if (!row) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const canonicalPath = `/video/${encodeURIComponent(videoSlug(row.title))}/`;
  if (requestedSlug === row.video_id && requestedSlug !== videoSlug(row.title)) return Response.redirect(`${url.origin}${canonicalPath}`, 301);
  const title = `${row.title} | Bolagaism.uz`;
  const description = row.description || `Видео о выборе имени для ребёнка — ${row.title}.`;
  const canonical = `https://bolagaism.uz${canonicalPath}`;
  const videoSchema = { '@context': 'https://schema.org', '@type': 'VideoObject', name: row.title, description, thumbnailUrl: [`https://i.ytimg.com/vi/${encodeURIComponent(row.video_id)}/hqdefault.jpg`], embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(row.video_id)}`, contentUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(row.video_id)}`, uploadDate: row.published_at || undefined, inLanguage: 'uz', publisher: { '@type': 'Organization', name: 'Bolagaism.uz', url: 'https://bolagaism.uz/' } };
  const content = `<article class="paper readable video-page"><nav class="breadcrumbs"><a href="/">Bosh sahifa</a> <span>›</span> <a href="/">Video tavsiyalar</a> <span>›</span> <span>${escapeHtml(row.title)}</span></nav><span class="eyebrow">Video tavsiyalar</span><div class="video-embed"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(row.video_id)}?rel=0" title="${escapeHtml(row.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><h1>${escapeHtml(row.title)}</h1><p class="meaning-lead">${escapeHtml(description)}</p></article>`;
  const html = `<!doctype html><html lang="uz"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:type" content="video.other"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://i.ytimg.com/vi/${encodeURIComponent(row.video_id)}/hqdefault.jpg"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/seo.css"><link rel="stylesheet" href="/design.css"><script type="application/ld+json">${JSON.stringify(videoSchema).replace(/<\/script/gi, '<\\/script>')}</script></head><body><header class="sticky-header"><div class="header-container"><div class="brand-row"><a class="brand-logo" href="/"><span class="logo-icon">🍼</span><span class="logo-text">BolagaIsm<span class="logo-tld">.uz</span></span></a></div></div></header><main id="main" class="page-shell">${content}</main><footer class="site-footer"><div class="container"><strong>Bolagaism.uz</strong><p>Farzandingiz uchun ma'noli ism tanlang.</p><nav class="footer-links"><a href="/ogil-bola-ismlari/">O'g'il bolalar</a><a href="/qiz-bola-ismlari/">Qiz bolalar</a><a href="/maqolalar/">Maqolalar</a></nav></div></footer></body></html>`;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
async function publicNamePage(request, env, url) {
  const match = url.pathname.match(/^\/ism\/([^/]+)\/?$/); if (!match || !env.DB) return null;
  const slug = decodeURIComponent(match[1]); let row; try { row = await env.DB.prepare('SELECT * FROM names WHERE slug = ? AND status = \'published\'').bind(slug).first(); } catch (_) { return null; } if (!row) return null;
  const asset = await env.ASSETS.fetch(request); if (!asset.ok) return null; let html = await asset.text();
  const description = row.seo_description || `${row.name} ismining ma'nosi, kelib chiqishi va yozilish variantlari.`;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(row.name)} ismining ma’nosi | Bolagaism.uz</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*("\s*\/>)/i, `$1${escapeHtml(description)}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*("\s*\/?>)/i, `$1${escapeHtml(row.name)} ismining ma’nosi | Bolagaism.uz$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*("\s*\/?>)/i, `$1${escapeHtml(description)}$2`);
  html = html.replace(/<h1><strong>[^<]*<\/strong> ismining ma’nosi<\/h1>/i, `<h1><strong>${escapeHtml(row.name)}</strong> ismining ma’nosi</h1>`);
  html = html.replace(/(<p class="meaning-lead">)[\s\S]*?(<\/p>)/i, `$1${escapeHtml(row.meaning)}$2`);
  html = html.replace(/(<div class="detail-fact fact-origin">[\s\S]*?<dd>)[\s\S]*?(<\/dd>)/i, `$1${escapeHtml(row.origin)}$2`);
  return new Response(html, { status: asset.status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
async function publicArticlePage(request, env, url) {
  if (!env.DB) return null;
  const match = url.pathname.match(/^\/maqolalar(?:\/([^/]+))?\/?$/); if (!match) return null;
  const slug = match[1]; let rows = []; let body = null; try { rows = slug ? [] : ((await env.DB.prepare("SELECT slug,title,excerpt,category,cover_image,published_at FROM articles WHERE status='published' ORDER BY published_at DESC").all()).results || []); body = slug ? await env.DB.prepare("SELECT * FROM articles WHERE slug=? AND status='published'").bind(decodeURIComponent(slug)).first() : null; } catch (_) { return env.ASSETS.fetch(request); }
  const escText = (v) => escapeHtml(v).replace(/\n/g, '<br>');
  if (slug && !body) return new Response('Not found', { status: 404, headers: { 'content-type':'text/plain; charset=utf-8' } });
  const title = body ? (body.seo_title || body.title) : 'Foydali maqolalar | Bolagaism.uz'; const description = body ? (body.seo_description || body.excerpt) : 'Ism tanlash va o‘zbek ismlari haqida foydali maqolalar.';
  const content = body ? `<article class="paper readable"><nav class="breadcrumbs"><a href="/">Bosh sahifa</a> <span>›</span> <a href="/maqolalar/">Maqolalar</a> <span>›</span> <span>${escapeHtml(body.title)}</span></nav><span class="eyebrow">${escapeHtml(body.category || 'Maqola')}</span><h1>${escapeHtml(body.title)}</h1><p class="meaning-lead">${escapeHtml(body.excerpt)}</p><div class="article-content">${escText(body.content)}</div><small>Yangilangan: ${escapeHtml(body.updated_at || '')}</small></article>` : `<section class="paper readable collection-index"><nav class="breadcrumbs"><a href="/">Bosh sahifa</a> <span>›</span> <span>Maqolalar</span></nav><span class="eyebrow">Foydali maqolalar</span><h1>Ism tanlash bo‘yicha maqolalar</h1><p class="meaning-lead">Farzandingiz uchun ism tanlashda yordam beradigan foydali tavsiyalar.</p><div class="media-card-grid">${rows.map((r) => { const image = r.cover_image ? `<img src="${escapeHtml(r.cover_image)}" alt="${escapeHtml(r.title)}" loading="lazy">` : '<span class="article-placeholder" aria-hidden="true">📖</span>'; return `<article class="video-card article-card"><a class="video-thumb article-thumb" href="/maqolalar/${encodeURIComponent(r.slug)}/" aria-label="${escapeHtml(r.title)}">${image}</a><h2><a href="/maqolalar/${encodeURIComponent(r.slug)}/">${escapeHtml(r.title)}</a></h2>${r.excerpt ? `<p>${escapeHtml(r.excerpt)}</p>` : ''}</article>`; }).join('')}</div></section>`;
  const canonical = `https://bolagaism.uz${url.pathname}`;
  const articleSchema = body ? { '@context': 'https://schema.org', '@type': 'Article', headline: body.title, description, datePublished: body.published_at || body.updated_at || undefined, dateModified: body.updated_at || undefined, inLanguage: 'uz', mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }, author: { '@type': 'Organization', name: 'Bolagaism.uz', url: 'https://bolagaism.uz/' }, publisher: { '@type': 'Organization', name: 'Bolagaism.uz', url: 'https://bolagaism.uz/' } } : { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: canonical, inLanguage: 'uz', mainEntity: { '@type': 'ItemList', itemListElement: rows.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.title, url: `https://bolagaism.uz/maqolalar/${encodeURIComponent(item.slug)}/` })) } };
  const html = `<!doctype html><html lang="uz"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/seo.css"><link rel="stylesheet" href="/design.css"><script type="application/ld+json">${JSON.stringify(articleSchema).replace(/<\/script/gi, '<\\/script>')}</script></head><body><header class="sticky-header"><div class="header-container"><div class="brand-row"><a class="brand-logo" href="/"><span class="logo-icon">🍼</span><span class="logo-text">BolagaIsm<span class="logo-tld">.uz</span></span></a></div></div></header><main id="main" class="page-shell">${content}</main><footer class="site-footer"><div class="container"><strong>Bolagaism.uz</strong><p>Farzandingiz uchun ma'noli ism tanlang.</p><nav class="footer-links"><a href="/ogil-bola-ismlari/">O'g'il bolalar</a><a href="/qiz-bola-ismlari/">Qiz bolalar</a><a href="/maqolalar/">Maqolalar</a></nav></div></footer></body></html>`;
  return new Response(html, { status: 200, headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' } });
}
async function publicCollectionPage(env, url) {
  await ensureDefaultCollections(env);
  const match = url.pathname.match(/^\/ismlar-toplamlari(?:\/([^/]+))?\/?$/); if (!match) return null;
  const slug = match[1]; const collections = (await env.DB.prepare("SELECT slug,title,description,origin FROM name_collections WHERE status='published' ORDER BY sort_order ASC,title ASC").all()).results || [];
  if (!slug) {
    const cards = collections.map((item) => `<a class="collection-index-card" href="/ismlar-toplamlari/${encodeURIComponent(item.slug)}/"><span class="eyebrow">${escapeHtml(item.origin)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><strong>50 ta ismni ko‘rish →</strong></a>`).join('');
    return collectionResponse('Ismlar to‘plamlari | Bolagaism.uz','Kelib chiqishi bo‘yicha o‘zbek ismlari to‘plamlari.',url.pathname,`<section class="paper collection-index"><nav class="breadcrumbs"><a href="/">Bosh sahifa</a><span>›</span><span>Ismlar to‘plamlari</span></nav><span class="eyebrow">Ismlar to‘plamlari</span><h1>Kelib chiqishi bo‘yicha ismlar</h1><p class="meaning-lead">Turli kelib chiqishdagi ismlarni solishtiring va farzandingizga mos ismni toping.</p><div class="collection-directory">${cards}</div></section>`);
  }
  const collection = collections.find((item) => item.slug === decodeURIComponent(slug)); if (!collection) return new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});
  const rows = await collectionRows(env, collection); const cards = rows.map(nameCollectionCard).join(''); const title = `${collection.title} | Bolagaism.uz`; const description = collection.description || `${collection.title} ma’nosi va kelib chiqishi.`;
  const listSchema = { '@context':'https://schema.org', '@type':'CollectionPage', name:title, description, url:`https://bolagaism.uz${url.pathname}`, inLanguage:'uz', mainEntity:{ '@type':'ItemList', itemListElement:rows.map((row,index)=>({ '@type':'ListItem', position:index+1, name:row.name, url:`https://bolagaism.uz/ism/${encodeURIComponent(row.slug)}/` })) } };
  return collectionResponse(title, description, url.pathname, `<section class="paper collection-index"><nav class="breadcrumbs"><a href="/">Bosh sahifa</a><span>›</span><a href="/ismlar-toplamlari/">Ismlar to‘plamlari</a><span>›</span><span>${escapeHtml(collection.title)}</span></nav><span class="eyebrow">${escapeHtml(collection.origin)}</span><h1>${escapeHtml(collection.title)}</h1><p class="meaning-lead">${escapeHtml(description)}</p><div class="collection-toolbar"><span>Top ${rows.length} ism</span><select aria-label="Filtr"><option>Alifbo bo‘yicha</option></select></div><div class="collection-name-grid">${cards || '<p>Bu kelib chiqish bo‘yicha hozircha ism topilmadi.</p>'}</div></section>`, listSchema);
}
function collectionResponse(title, description, path, content, schema) { const canonical = `https://bolagaism.uz${path}`; const data = schema || { '@context':'https://schema.org','@type':'CollectionPage',name:title,description,url:canonical,inLanguage:'uz' }; return new Response(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/seo.css"><link rel="stylesheet" href="/design.css"><script type="application/ld+json">${JSON.stringify(data).replace(/<\/script/gi,'<\\/script>')}</script></head><body><header class="sticky-header"><div class="header-container"><div class="brand-row"><a class="brand-logo" href="/"><span class="logo-icon">🍼</span><span class="logo-text">BolagaIsm<span class="logo-tld">.uz</span></span></a></div></div></header><main id="main" class="page-shell">${content}</main><footer class="site-footer"><div class="container"><strong>Bolagaism.uz</strong><p>Farzandingiz uchun ma'noli ism tanlang.</p><nav class="footer-links"><a href="/video/">Videolar</a><a href="/maqolalar/">Maqolalar</a></nav></div></footer></body></html>`,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}}); }
async function publicSitemap(request, env) {
  if (!env.DB) return null;
  const asset = await env.ASSETS.fetch(request); if (!asset.ok) return null;
  try {
    let xml = await asset.text();
    await ensureDefaultCollections(env);
    const [videos, articles, collections] = await Promise.all([
      env.DB.prepare("SELECT video_id, title, updated_at, published_at FROM videos WHERE status='published'").all(),
      env.DB.prepare("SELECT slug, updated_at, published_at FROM articles WHERE status='published'").all(),
      env.DB.prepare("SELECT slug, updated_at FROM name_collections WHERE status='published'").all()
    ]);
    const existing = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
    const entries = [];
    const add = (path, updated) => { const loc = `https://bolagaism.uz${path}`; if (existing.has(loc)) return; existing.add(loc); const date = (updated || '').slice(0, 10); entries.push(`<url><loc>${loc}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`); };
    for (const row of (articles.results || [])) add(`/maqolalar/${encodeURIComponent(row.slug)}/`, row.updated_at || row.published_at);
    for (const row of (videos.results || [])) add(`/video/${encodeURIComponent(videoSlug(row.title))}/`, row.updated_at || row.published_at);
    add('/video/'); add('/ismlar-toplamlari/');
    for (const row of (collections.results || [])) add(`/ismlar-toplamlari/${encodeURIComponent(row.slug)}/`, row.updated_at);
    if (entries.length) xml = xml.replace('</urlset>', `${entries.join('')}</urlset>`);
    return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  } catch (_) { return asset; }
}
export default { async fetch(request, env) {
 try {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/oshxona/') || url.pathname === '/api/public/name-event') {
    try { return await api(request, env); }
    catch (error) { return json({ error: `Worker API: ${error?.message || 'Unknown error'}` }, 500); }
  }
  if (request.method === 'GET' && url.pathname === '/api/oshxona/origin-reviews') {
    const source = await env.ASSETS.fetch(new Request(new URL('/names_data.js', request.url))); const text = await source.text(); const match = text.match(/window\.ALL_NAMES\s*=\s*(\[.*\])\s*;?\s*$/s); if (!match) return json({ error: 'Names data is unavailable' }, 503);
    const all = JSON.parse(match[1]); const flagged = all.filter((item) => originCandidates(item.lang).length > 1 || normalizeOriginValue(item.lang) !== String(item.lang || '').trim()); const rows = flagged.slice(0, 200).map((item) => {
      const candidates = originCandidates(item.lang); const share = Math.round(100 / Math.max(candidates.length, 1));
      return { id: String(item.id), name: item.l, gender: item.g, raw_origin: item.lang || '', normalized_origin: normalizeOriginValue(item.lang), candidates: candidates.map((origin, index) => ({ origin, confidence: index === candidates.length - 1 ? 100 - share * (candidates.length - 1) : share })), reason: candidates.length > 1 ? 'Bir nechta kelib chiqish ko‘rsatilgan' : 'Takroriy qiymat', source: 'Avtomatik katalog tekshiruvi' };
    });
    return json({ user: email, rows, total: flagged.length, shown: rows.length, note: 'Foizlar boshlang‘ich taxmin bo‘lib, qo‘lda tasdiqlanishi kerak.' });
  }
  if (url.pathname === '/oshxona' || url.pathname.startsWith('/oshxona/')) {
    const user = await sessionUser(request, env);
    if (!user && !url.pathname.startsWith('/oshxona/login')) return Response.redirect(`${url.origin}/oshxona/login`, 302);
    return env.ASSETS.fetch(request);
  }
  if (url.pathname === '/sitemap.xml') { const dynamic = await publicSitemap(request, env); if (dynamic) return dynamic; }
  if (url.pathname.startsWith('/ism/')) return env.ASSETS.fetch(request);
  if (url.pathname === '/video/' || url.pathname === '/video') { if (env.DB) return publicVideoIndex(env); }
  if (url.pathname.startsWith('/video/')) { const dynamic = await publicVideoPage(request, env, url); if (dynamic) return withVideos(dynamic, env, request); }
  if (url.pathname.startsWith('/ism/')) { const dynamic = await publicNamePage(request, env, url); if (dynamic) return withVideos(dynamic, env, request); }
  if (url.pathname.startsWith('/maqolalar')) { const dynamic = await publicArticlePage(request, env, url); if (dynamic) return withVideos(dynamic, env, request); }
  if (url.pathname.startsWith('/ismlar-toplamlari')) { const dynamic = await publicCollectionPage(env, url); if (dynamic) return dynamic; }
  return withVideos(await env.ASSETS.fetch(request), env, request);
 } catch (_) {
  return env.ASSETS.fetch(request);
 }
} };
