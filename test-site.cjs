const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (url.hostname !== 'site.test') return route.abort();
      if (!['index.html','app.js','style.css','names_data.js'].includes(name)) return route.fulfill({status:404,body:''});
      return route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
    });
    await page.goto('http://site.test/?q=Abbos');
    await page.waitForFunction(() => window.ALL_NAMES.length > 12000 && document.querySelector('#liveSearchResultsList .name-accordion-item'));
    assert.equal(await page.locator('#modalSearchInput').inputValue(),'Abbos');
    const ids = await page.evaluate(() => [window.ALL_NAMES[150].id, ...["O'","G'",'Sh','Ch'].map(p => window.ALL_NAMES.find(x=>x.l.startsWith(p)).id)]);
    for (const id of ids) {
      await page.evaluate(id=>window.selectSpecificName(id),id);
      assert.equal(await page.locator('#letterNamesList .open').getAttribute('data-name-id'),String(id));
    }
    const id = ids[0];
    await page.evaluate(id=>{window.toggleFavorite(id);window.openFavoritesModal();},id);
    assert.equal(await page.locator('#favNamesList .name-accordion-item').count(),1);
    await page.locator('#favNamesList .btn-fav-toggle').click();
    assert.equal(await page.locator('#favNamesList .name-accordion-item').count(),0);
    await page.evaluate(id=>window.selectSpecificName(id),id);
    const share = await page.locator('#letterNamesList .open .tg').getAttribute('href');
    const target = new URL(share).searchParams.get('url');
    await page.goto(target);
    await page.waitForSelector('#letterNamesList .open');
    assert.equal(await page.locator('#letterNamesList .open').getAttribute('data-name-id'),String(id));
    await page.evaluate(id => {
      localStorage.removeItem('ismlar_favorites_v3');
      localStorage.setItem('ismlar_favorites_v2',JSON.stringify([{id,addedAt:Date.now()},{id:2,addedAt:Date.now()-8*86400000}]));
    },id);
    await page.reload();
    await page.waitForFunction(()=>window.ALL_NAMES.length>12000 && localStorage.getItem('ismlar_favorites_v3'));
    const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem('ismlar_favorites_v3')));
    assert.equal(saved.length,1);
    assert.equal(typeof saved[0].key,'string');
    await page.evaluate(()=>{
      const saved=JSON.parse(localStorage.getItem('ismlar_favorites_v3'));
      saved[0].addedAt=Date.now()-8*86400000;
      localStorage.setItem('ismlar_favorites_v3',JSON.stringify(saved));
    });
    await page.reload();
    await page.waitForFunction(()=>window.ALL_NAMES.length>12000 && JSON.parse(localStorage.getItem('ismlar_favorites_v3')).length===0);
    assert.equal(await page.locator('.view-badge').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: search URL, distant card, O/G/Sh/Ch, favorite removal, share URL, legacy migration, expiry, no fake counters, no browser errors.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
