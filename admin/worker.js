const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function editor(request) {
  return request.headers.get('Cf-Access-Authenticated-User-Email') || request.headers.get('cf-access-authenticated-user-email') || '';
}

function requireEditor(request) {
  const email = editor(request);
  return email ? email : null;
}

async function api(request, env) {
  const email = requireEditor(request);
  if (!email) return json({ error: 'Authentication required' }, 401);
  if (!env.DB) return json({ error: 'Admin database is not configured yet' }, 503);
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/oshxona/names') {
    const q = (url.searchParams.get('q') || '').trim();
    const status = url.searchParams.get('status') || '';
    const where = []; const args = [];
    if (q) { where.push('(name LIKE ? OR slug LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
    if (status) { where.push('status = ?'); args.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await env.DB.prepare(`SELECT id, slug, name, gender, origin, meaning, variants, status, seo_description, updated_at FROM names ${clause} ORDER BY updated_at DESC LIMIT 100`).bind(...args).all();
    const counts = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(status = 'published') AS published, SUM(status = 'review') AS review, SUM(status = 'draft') AS draft FROM names").first();
    return json({ user: email, rows: rows.results || [], counts });
  }
  if (request.method === 'POST' || request.method === 'PATCH') {
    const body = await request.json();
    if (!body.name || !['m', 'f'].includes(body.gender)) return json({ error: 'Name and gender are required' }, 400);
    const id = url.pathname.split('/').pop();
    const now = new Date().toISOString();
    if (request.method === 'POST') {
      const newId = crypto.randomUUID(); const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');
      await env.DB.prepare('INSERT INTO names (id, slug, name, gender, meaning, origin, variants, status, seo_description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, slug, body.name, body.gender, body.meaning || '', body.origin || '', body.variants || '', body.status || 'draft', body.seo_description || '', now).run();
      await env.DB.prepare('INSERT INTO audit_log (action, entity_type, entity_id, editor_email, metadata_json) VALUES (?, ?, ?, ?, ?)').bind('created', 'name', newId, email, JSON.stringify({ name: body.name })).run();
      return json({ id: newId }, 201);
    }
    await env.DB.prepare('UPDATE names SET name = ?, gender = ?, meaning = ?, origin = ?, variants = ?, status = ?, seo_description = ?, updated_at = ? WHERE id = ?').bind(body.name, body.gender, body.meaning || '', body.origin || '', body.variants || '', body.status || 'draft', body.seo_description || '', now, id).run();
    await env.DB.prepare('INSERT INTO audit_log (action, entity_type, entity_id, editor_email, metadata_json) VALUES (?, ?, ?, ?, ?)').bind('updated', 'name', id, email, JSON.stringify({ name: body.name, status: body.status })).run();
    return json({ id });
  }
  return json({ error: 'Not found' }, 404);
}

export default { async fetch(request, env) { const url = new URL(request.url); if (url.pathname.startsWith('/api/oshxona/')) return api(request, env); return env.ASSETS.fetch(request); } };
