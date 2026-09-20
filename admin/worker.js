const ADMIN_EMAIL = 'khdjkbr@yandex.com';
const SESSION_DAYS = 7;

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
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
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', cover_image TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived')), seo_title TEXT NOT NULL DEFAULT '', seo_description TEXT NOT NULL DEFAULT '', author_email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS article_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id TEXT NOT NULL, snapshot_json TEXT NOT NULL, action TEXT NOT NULL, editor_email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
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
      return env.DB.prepare('INSERT OR IGNORE INTO names (id, slug, name, gender, meaning, origin, source, status, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(String(item.id), slug, item.l, item.g, item.m || '', item.lang || '', "«O'zbek ismlari ma'nosi» — Begmatov E.A. O'zbekiston Milliy Ensiklopediyasi. Davlat ilmiy nashriyoti, 2007.", 'published', `${item.l} ismining ma'nosi, kelib chiqishi va yozilish variantlari.`);
    });
    if (statements.length) await env.DB.batch(statements);
    const nextOffset = offset + batch.length;
    return json({ imported: batch.length, offset, nextOffset, total: names.length, done: nextOffset >= names.length });
  }
  if (request.method === 'GET' && url.pathname === '/api/oshxona/names') {
    const q = (url.searchParams.get('q') || '').trim(); const status = url.searchParams.get('status') || ''; const where = []; const args = [];
    if (q) { where.push('(name LIKE ? OR slug LIKE ?)'); args.push(`%${q}%`, `%${q}%`); } if (status) { where.push('status = ?'); args.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''; const rows = await env.DB.prepare(`SELECT id, slug, name, gender, origin, meaning, variants, status, seo_description, updated_at FROM names ${clause} ORDER BY updated_at DESC LIMIT 100`).bind(...args).all();
    const counts = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(status = 'published') AS published, SUM(status = 'review') AS review, SUM(status = 'draft') AS draft FROM names").first(); return json({ user: email, rows: rows.results || [], counts });
  }
  if (request.method === 'GET' && url.pathname === '/api/oshxona/articles') {
    const q = (url.searchParams.get('q') || '').trim(); const status = url.searchParams.get('status') || ''; const where = []; const args = [];
    if (q) { where.push('(title LIKE ? OR slug LIKE ?)'); args.push(`%${q}%`, `%${q}%`); } if (status) { where.push('status = ?'); args.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''; const rows = await env.DB.prepare(`SELECT id, slug, title, excerpt, category, status, seo_title, seo_description, updated_at, published_at FROM articles ${clause} ORDER BY updated_at DESC LIMIT 100`).bind(...args).all();
    const counts = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(status = 'published') AS published, SUM(status = 'review') AS review, SUM(status = 'draft') AS draft FROM articles").first(); return json({ user: email, rows: rows.results || [], counts });
  }
  if ((request.method === 'POST' || request.method === 'PATCH') && url.pathname.startsWith('/api/oshxona/articles')) {
    const body = await request.json(); if (!body.title) return json({ error: 'Title is required' }, 400); const id = url.pathname.split('/').pop(); const now = new Date().toISOString();
    if (request.method === 'POST') { const newId = crypto.randomUUID(); const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, ''); const payload = { id:newId, slug, ...body }; await env.DB.prepare('INSERT INTO articles (id, slug, title, excerpt, content, category, cover_image, status, seo_title, seo_description, author_email, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, slug, body.title, body.excerpt || '', body.content || '', body.category || '', body.cover_image || '', body.status || 'draft', body.seo_title || body.title, body.seo_description || body.excerpt || '', email, now, body.status === 'published' ? now : null).run(); await env.DB.prepare('INSERT INTO article_revisions (article_id, snapshot_json, action, editor_email) VALUES (?, ?, ?, ?)').bind(newId, JSON.stringify(payload), 'created', email).run(); return json({ id:newId }, 201); }
    const previous = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first(); if (!previous) return json({ error: 'Article not found' }, 404); await env.DB.prepare('INSERT INTO article_revisions (article_id, snapshot_json, action, editor_email) VALUES (?, ?, ?, ?)').bind(id, JSON.stringify(previous), body.status === 'published' && previous.status !== 'published' ? 'published' : 'updated', email).run(); await env.DB.prepare('UPDATE articles SET slug=?, title=?, excerpt=?, content=?, category=?, cover_image=?, status=?, seo_title=?, seo_description=?, updated_at=?, published_at=CASE WHEN ? = \'published\' THEN COALESCE(published_at, ?) ELSE published_at END WHERE id=?').bind(body.slug || previous.slug, body.title, body.excerpt || '', body.content || '', body.category || '', body.cover_image || '', body.status || 'draft', body.seo_title || body.title, body.seo_description || body.excerpt || '', now, body.status || 'draft', now, id).run(); return json({ id });
  }
  if (request.method === 'POST' || request.method === 'PATCH') {
    const body = await request.json(); if (!body.name || !['m', 'f'].includes(body.gender)) return json({ error: 'Name and gender are required' }, 400); const id = url.pathname.split('/').pop(); const now = new Date().toISOString();
    if (request.method === 'POST') { const newId = crypto.randomUUID(); const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, ''); await env.DB.prepare('INSERT INTO names (id, slug, name, gender, meaning, origin, variants, status, seo_description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, slug, body.name, body.gender, body.meaning || '', body.origin || '', body.variants || '', body.status || 'draft', body.seo_description || '', now).run(); const snapshot = JSON.stringify({ id: newId, slug, ...body }); await env.DB.prepare('INSERT INTO name_revisions (name_id, snapshot_json, action, editor_email) VALUES (?, ?, ?, ?)').bind(newId, snapshot, 'created', email).run(); await env.DB.prepare('INSERT INTO audit_log (action, entity_type, entity_id, editor_email, metadata_json) VALUES (?, ?, ?, ?, ?)').bind('created', 'name', newId, email, JSON.stringify({ name: body.name })).run(); return json({ id: newId }, 201); }
    const previous = await env.DB.prepare('SELECT * FROM names WHERE id = ?').bind(id).first();
    if (!previous) return json({ error: 'Name not found' }, 404);
    await env.DB.prepare('INSERT INTO name_revisions (name_id, snapshot_json, action, editor_email) VALUES (?, ?, ?, ?)').bind(id, JSON.stringify(previous), body.status === 'published' && previous.status !== 'published' ? 'published' : 'updated', email).run();
    await env.DB.prepare('UPDATE names SET name = ?, gender = ?, meaning = ?, origin = ?, variants = ?, status = ?, seo_description = ?, updated_at = ?, published_at = CASE WHEN ? = \'published\' THEN COALESCE(published_at, ?) ELSE published_at END WHERE id = ?').bind(body.name, body.gender, body.meaning || '', body.origin || '', body.variants || '', body.status || 'draft', body.seo_description || '', now, body.status || 'draft', now, id).run(); await env.DB.prepare('INSERT INTO audit_log (action, entity_type, entity_id, editor_email, metadata_json) VALUES (?, ?, ?, ?, ?)').bind('updated', 'name', id, email, JSON.stringify({ name: body.name, status: body.status })).run(); return json({ id });
  }
  return json({ error: 'Not found' }, 404);
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
async function publicNamePage(request, env, url) {
  const match = url.pathname.match(/^\/ism\/([^/]+)\/?$/); if (!match || !env.DB) return null;
  const slug = decodeURIComponent(match[1]); const row = await env.DB.prepare('SELECT * FROM names WHERE slug = ? AND status = \'published\'').bind(slug).first(); if (!row) return null;
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
  const slug = match[1]; const rows = slug ? [] : (await env.DB.prepare("SELECT slug,title,excerpt,category,published_at FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 12").all()).results || [];
  let body = slug ? await env.DB.prepare("SELECT * FROM articles WHERE slug=? AND status='published'").bind(decodeURIComponent(slug)).first() : null;
  const escText = (v) => escapeHtml(v).replace(/\n/g, '<br>');
  if (slug && !body) return new Response('Not found', { status: 404, headers: { 'content-type':'text/plain; charset=utf-8' } });
  const title = body ? (body.seo_title || body.title) : 'Foydali maqolalar | Bolagaism.uz'; const description = body ? (body.seo_description || body.excerpt) : 'Ism tanlash va o‘zbek ismlari haqida foydali maqolalar.';
  const content = body ? `<article class="paper readable"><nav class="breadcrumbs"><a href="/">Bosh sahifa</a> <span>›</span> <a href="/maqolalar/">Maqolalar</a> <span>›</span> <span>${escapeHtml(body.title)}</span></nav><span class="eyebrow">${escapeHtml(body.category || 'Maqola')}</span><h1>${escapeHtml(body.title)}</h1><p class="meaning-lead">${escapeHtml(body.excerpt)}</p><div class="article-content">${escText(body.content)}</div><small>Yangilangan: ${escapeHtml(body.updated_at || '')}</small></article>` : `<section class="paper readable"><span class="eyebrow">Foydali maqolalar</span><h1>Ism tanlash bo‘yicha maqolalar</h1><p>Farzandingiz uchun ism tanlashda yordam beradigan foydali tavsiyalar.</p><div class="related-grid">${rows.map((r) => `<a class="catalog-tile" href="/maqolalar/${encodeURIComponent(r.slug)}/"><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(r.excerpt)}</span></a>`).join('')}</div></section>`;
  const html = `<!doctype html><html lang="uz"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow"><link rel="canonical" href="https://bolagaism.uz${url.pathname}"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/seo.css"><link rel="stylesheet" href="/design.css"></head><body><header class="sticky-header"><div class="header-container"><div class="brand-row"><a class="brand-logo" href="/"><span class="logo-icon">🍼</span><span class="logo-text">BolagaIsm<span class="logo-tld">.uz</span></span></a></div></div></header><main id="main" class="page-shell">${content}</main><footer class="site-footer"><div class="container"><strong>Bolagaism.uz</strong><p>Farzandingiz uchun ma'noli ism tanlang.</p><nav class="footer-links"><a href="/ogil-bola-ismlari/">O'g'il bolalar</a><a href="/qiz-bola-ismlari/">Qiz bolalar</a><a href="/maqolalar/">Maqolalar</a></nav></div></footer></body></html>`;
  return new Response(html, { status: 200, headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' } });
}
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/oshxona/')) return api(request, env);
  if (url.pathname === '/oshxona' || url.pathname.startsWith('/oshxona/')) {
    const user = await sessionUser(request, env);
    if (!user && !url.pathname.startsWith('/oshxona/login')) return Response.redirect(`${url.origin}/oshxona/login`, 302);
  }
  if (url.pathname.startsWith('/ism/')) { const dynamic = await publicNamePage(request, env, url); if (dynamic) return dynamic; }
  if (url.pathname.startsWith('/maqolalar')) { const dynamic = await publicArticlePage(request, env, url); if (dynamic) return dynamic; }
  return env.ASSETS.fetch(request);
} };
