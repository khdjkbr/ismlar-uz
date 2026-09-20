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
  if (request.method === 'POST' || request.method === 'PATCH') {
    const body = await request.json(); if (!body.name || !['m', 'f'].includes(body.gender)) return json({ error: 'Name and gender are required' }, 400); const id = url.pathname.split('/').pop(); const now = new Date().toISOString();
    if (request.method === 'POST') { const newId = crypto.randomUUID(); const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, ''); await env.DB.prepare('INSERT INTO names (id, slug, name, gender, meaning, origin, variants, status, seo_description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, slug, body.name, body.gender, body.meaning || '', body.origin || '', body.variants || '', body.status || 'draft', body.seo_description || '', now).run(); await env.DB.prepare('INSERT INTO audit_log (action, entity_type, entity_id, editor_email, metadata_json) VALUES (?, ?, ?, ?, ?)').bind('created', 'name', newId, email, JSON.stringify({ name: body.name })).run(); return json({ id: newId }, 201); }
    await env.DB.prepare('UPDATE names SET name = ?, gender = ?, meaning = ?, origin = ?, variants = ?, status = ?, seo_description = ?, updated_at = ? WHERE id = ?').bind(body.name, body.gender, body.meaning || '', body.origin || '', body.variants || '', body.status || 'draft', body.seo_description || '', now, id).run(); await env.DB.prepare('INSERT INTO audit_log (action, entity_type, entity_id, editor_email, metadata_json) VALUES (?, ?, ?, ?, ?)').bind('updated', 'name', id, email, JSON.stringify({ name: body.name, status: body.status })).run(); return json({ id });
  }
  return json({ error: 'Not found' }, 404);
}
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/oshxona/')) return api(request, env);
  if (url.pathname === '/oshxona' || url.pathname.startsWith('/oshxona/')) {
    const user = await sessionUser(request, env);
    if (!user && !url.pathname.startsWith('/oshxona/login')) return Response.redirect(`${url.origin}/oshxona/login`, 302);
  }
  return env.ASSETS.fetch(request);
} };
