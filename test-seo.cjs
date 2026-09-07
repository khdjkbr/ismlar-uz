const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve('_site');
const artifacts = path.resolve('artifacts');
fs.mkdirSync(artifacts, {recursive:true});

async function routes(context, requests) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (url.hostname !== 'site.test') return route.abort();
    let filename = path.resolve(out, '.' + decodeURIComponent(url.pathname));
    if (!filename.startsWith(out + path.sep) && filename !== out) return route.fulfill({status:403,body:''});
    if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');
    const exists = fs.existsSync(filename);
    if (!exists) filename = path.join(out, '404.html');
    const type = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml'}[path.extname(filename)] || 'text/plain';
    return route.fulfill({status:exists?200:404,body:fs.readFileSync(filename),contentType:type});
  });
}

(async () => {
  const browser = await chromium.launch({headless:true, ...(process.platform === 'win32' ? {channel:'msedge'} : {})});
  try {
    const requests = [], errors = [];
    const context = await browser.newContext({viewport:{width:390,height:844}});
    await routes(context, requests);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://site.test/ism/muhammad/');
    await page.waitForFunction(() => localStorage.getItem('ismlar_favorites_v3') !== null);
    assert.equal(requests.some(u=>/names\.json|names_data\.js|search-index\.json/.test(u)),false,'Name page must not load the full database');
    assert.equal(await page.locator('h1').textContent(),'Muhammad ismining ma’nosi');
    assert.equal(await page.locator('.ad-placement').count(),1);
    const textBottom = await page.locator('.source-box').evaluate(el=>el.getBoundingClientRect().bottom);
    const adTop = await page.locator('.ad-placement').evaluate(el=>el.getBoundingClientRect().top);
    assert.ok(adTop > textBottom,'Ad must follow the answer and sources');
    const button = page.locator('[data-save-name]');
    await button.click();
    await page.waitForFunction(()=>document.querySelector('[data-save-name]').getAttribute('aria-pressed')==='true');
    await page.screenshot({path:path.join(artifacts,'name-mobile.png'),fullPage:true});
    await page.goto('http://site.test/tanlangan/');
    await page.waitForSelector('#favorite-results a');
    assert.equal(await page.locator('#favorite-results h2').textContent(),'Muhammad');
    await page.getByRole('button',{name:'Muhammad ismini olib tashlash'}).click();
    await page.waitForFunction(()=>document.querySelector('#favorite-status').textContent.includes('yo‘q'));
    await page.goto('http://site.test/?ism=m%3Amuhammad');
    await page.waitForURL('**/ism/muhammad/');
    await page.goto('http://site.test/?jins=m&harf=Sh');
    await page.waitForURL('**/ogil-bola-ismlari/sh/');
    await page.goto('http://site.test/?q=Abbos');
    await page.waitForURL('**/qidiruv/?q=Abbos');
    await page.waitForSelector('#search-results a');
    assert.ok((await page.locator('#search-results h2').first().textContent()).startsWith('Abbos'));
    await page.locator('#name-search').fill('a');
    await page.waitForFunction(()=>!document.querySelector('#search-more').hidden);
    const before = await page.locator('#search-results a').count();
    await page.locator('#search-more').click();
    assert.ok(await page.locator('#search-results a').count()>before);
    await page.locator('#name-search').fill('nothingmatches123');
    await page.waitForFunction(()=>document.querySelector('#search-status').textContent.startsWith('Ism topilmadi'));
    await page.goto('http://site.test/');
    await page.getByRole('button',{name:'Ism tanlashni boshlash'}).click();
    await page.locator('.gender-card-btn.boy').click();
    await page.waitForFunction(()=>window.ALL_NAMES.length>12000);
    await page.evaluate(()=>window.selectLetter('A'));
    await page.waitForSelector('#letterNamesList .name-accordion-item');
    assert.equal(await page.locator('#letterNamesList .name-accordion-item').count(),50);
    await page.locator('#loadMoreBtn').click();
    assert.equal(await page.locator('#letterNamesList .name-accordion-item').count(),100);
    // Persisted v2 data migrates using the original ID, and expiry is enforced.
    const legacyId = await page.evaluate(()=>window.ALL_NAMES.find(n=>n.l==='Muhammad'&&n.g==='m').id);
    await page.evaluate(id=>{
      localStorage.removeItem('ismlar_favorites_v3');
      localStorage.setItem('ismlar_favorites_v2',JSON.stringify([{id,addedAt:Date.now()},{id:1,addedAt:Date.now()-8*86400000}]));
    },legacyId);
    await page.goto('http://site.test/tanlangan/');
    await page.waitForSelector('#favorite-results a');
    assert.equal(await page.locator('#favorite-results a').count(),1);
    assert.equal(await page.locator('#favorite-results h2').textContent(),'Muhammad');
    await page.evaluate(()=>{
      const list=JSON.parse(localStorage.getItem('ismlar_favorites_v3'));
      list[0].addedAt=Date.now()-8*86400000;
      localStorage.setItem('ismlar_favorites_v3',JSON.stringify(list));
    });
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#favorite-status').textContent.includes('yo‘q'));
    const response = await page.goto('http://site.test/ism/does-not-exist/');
    assert.equal(response.status(),404);
    assert.match(await page.locator('h1').textContent(),/topilmadi/);
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:900});
      for (const route of ['/', '/ism/muhammad/', '/ogil-bola-ismlari/a/']) {
        await page.goto('http://site.test'+route);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal overflow ${route} at ${width}`);
      }
    }
    await page.goto('http://site.test/ism/muhammad/');
    await page.screenshot({path:path.join(artifacts,'name-desktop.png'),fullPage:true});
    await page.goto('http://site.test/');
    await page.screenshot({path:path.join(artifacts,'home-desktop.png'),fullPage:true});
    await page.goto('http://site.test/ogil-bola-ismlari/a/');
    await page.screenshot({path:path.join(artifacts,'catalog-desktop.png'),fullPage:true});
    assert.equal(requests.some(u=>/googlesyndication|doubleclick/.test(u)),false,'Preview must never request live ads');
    assert.deepEqual(errors,[]);
    await context.close();
    const nojs = await browser.newContext({javaScriptEnabled:false});
    await routes(nojs, []);
    const staticPage = await nojs.newPage();
    await staticPage.goto('http://site.test/');
    await staticPage.locator('.catalog-tile').first().click();
    await staticPage.locator('.alphabet-links a').first().click();
    assert.equal(await staticPage.locator('.name-list .catalog-name').count(),48);
    await staticPage.locator('.pagination a').first().click();
    assert.match(staticPage.url(),/sahifa\/2/);
    await staticPage.goto('http://site.test/ism/muhammad/');
    assert.match(await staticPage.locator('.meaning-lead').textContent(),/Maqtovga/);
    await nojs.close();
    console.log('PASS: static navigation, pagination, metadata, mobile layouts, lazy data, search, legacy links, favorites migration/expiry, 404, ad preview without network.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
