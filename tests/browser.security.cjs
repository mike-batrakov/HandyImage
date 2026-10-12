'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { firefox } = require(process.env.HANDYIMAGE_PLAYWRIGHT_PATH || 'playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'HandyImage.user.js'), 'utf8');
const pixel = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="blue"/></svg>';

function initScript(settings) {
  // GM APIs are instrumented test doubles, not a Tampermonkey sandbox simulation.
  return `(() => {
    const values = ${JSON.stringify(settings)};
    const fixture = window.__handyFixture = { values, reads: [], writes: [], downloads: [], menus: {}, dialogs: [] };
    const createElement = Document.prototype.createElement.bind(document);
    const addEventListener = window.addEventListener.bind(window);
    const removeEventListener = window.removeEventListener.bind(window);
    // Firefox userscripts have their own window listener methods. Preserve that
    // interface so page-prototype cleanup does not intercept viewer callbacks.
    const scriptWindow = new Proxy(window, { get(target, key) {
      if (key === 'addEventListener') return addEventListener;
      if (key === 'removeEventListener') return removeEventListener;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const getValue = (key, fallback) => { fixture.reads.push(key); return key in values ? values[key] : fallback; };
    const setValue = (key, value) => { fixture.writes.push({ key, value }); values[key] = value; };
    window.alert = message => fixture.dialogs.push(message);
    const gm = { getValue: (key, fallback) => Promise.resolve(getValue(key, fallback)), setValue };
    (function(GM, GM_getValue, GM_setValue, GM_registerMenuCommand, GM_unregisterMenuCommand, GM_download, GM_addElement, unsafeWindow, window) {
      ${source}
    })(gm, getValue, setValue, (name, callback) => { fixture.menus[name] = callback; }, () => {},
      details => fixture.downloads.push({ url: details.url, name: details.name, saveAs: details.saveAs, headers: details.headers }),
      (parent, type, attributes) => { const element = createElement(type); Object.assign(element, attributes); parent.appendChild(element); }, window, scriptWindow);
  })();`;
}

async function fixturePage(browser, { url, html, settings = {}, lateInjection = false }) {
  const context = await browser.newContext({ viewport: null });
  await context.route('**/*', route => {
    const requestUrl = route.request().url();
    if (requestUrl === url) return route.fulfill({ contentType: 'text/html', body: html });
    if (requestUrl.startsWith('https://media.fixture.test/')) return route.fulfill({ contentType: 'image/svg+xml', body: pixel });
    return route.abort();
  });
  if (!lateInjection) await context.addInitScript({ content: initScript(settings) });
  const page = await context.newPage();
  const errors = [];
  const messages = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { messages.push(message.text()); if (process.env.HANDYIMAGE_TEST_DEBUG) console.log(message.text()); });
  await page.goto(url, { waitUntil: lateInjection ? 'load' : 'domcontentloaded' });
  if (lateInjection) await page.evaluate(initScript(settings));
  return { context, page, errors, messages };
}

async function main() {
  const browser = await firefox.launch({ headless: true, ...(process.env.HANDYIMAGE_FIREFOX_EXECUTABLE ? { executablePath: process.env.HANDYIMAGE_FIREFOX_EXECUTABLE } : {}) });
  try {
    const lateViewer = await fixturePage(browser, {
      url: 'https://imgbox.com/view/late-startup',
      html: '<!doctype html><title>Stable loaded page</title><img id="img" src="https://media.fixture.test/original.png"><p id="host-content">Host content</p>',
      lateInjection: true,
    });
    try {
      await lateViewer.page.waitForFunction(() => document.title.includes('(1x1)'), null, { timeout: 3000 });
      assert.equal(await lateViewer.page.locator('#host-content').count(), 0);
      assert.deepEqual(lateViewer.errors, []);
      console.log('PASS Firefox late startup: stable loaded page renders without another script or DOM mutation');
    } finally { await lateViewer.context.close(); }

    const viewer = await fixturePage(browser, {
      url: 'https://imgbox.com/view/fixture?private=secret',
      html: '<!doctype html><title>Fixture</title><img id="img" src="https://media.fixture.test/original.png"><p>Host content</p>',
      settings: { js: 'window.__legacyExecuted = true;', favoriteTags: 'solo, horse' },
    });
    try {
      await viewer.page.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0 && document.title.includes('(1x1)'));
      assert.equal(await viewer.page.locator('img').count(), 1, 'Image rendering remains functional');
      const fitWidth = await viewer.page.locator('img').evaluate(image => image.style.width);
      await viewer.page.keyboard.press('q');
      assert.equal(await viewer.page.locator('img').evaluate(image => image.style.width), '1px');
      await viewer.page.keyboard.press('q');
      assert.equal(await viewer.page.locator('img').evaluate(image => image.style.width), fitWidth, 'Fit/original resizing remains functional');
      assert.equal(await viewer.page.evaluate(() => window.__legacyExecuted), undefined);
      assert.equal(await viewer.page.evaluate(() => window.__handyFixture.reads.includes('js')), false);
      await viewer.page.evaluate(() => {
        document.querySelector('img').src = 'https://media.fixture.test/replaced.png';
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', keyCode: 83, which: 83, ctrlKey: true, bubbles: true }));
      });
      assert.equal(await viewer.page.evaluate(() => window.__handyFixture.downloads.length), 0);
      await viewer.page.keyboard.press('Control+s');
      const downloads = await viewer.page.evaluate(() => window.__handyFixture.downloads);
      assert.equal(downloads.length, 1, 'A real Firefox keyboard event still requests a download');
      assert.equal(downloads[0].url, 'https://media.fixture.test/original.png');
      assert.equal(downloads[0].headers, undefined);
      assert.equal(downloads[0].saveAs, true);
      await viewer.page.evaluate(() => window.__handyFixture.menus['Handy Image Download image']());
      assert.equal(await viewer.page.evaluate(() => window.__handyFixture.downloads.length), 2, 'Manager-menu callback remains functional');
      assert.deepEqual(viewer.errors, []);
      console.log('PASS Firefox viewer: rendering/resizing, legacy code ignored, synthetic Ctrl+S blocked, trusted Ctrl+S and menu work, original download URL retained, no explicit referrer');
    } catch (error) {
      console.error('Viewer fixture diagnostics:', { errors: viewer.errors, messages: viewer.messages.slice(-20) });
      throw error;
    } finally { await viewer.context.close(); }

    const gallery = await fixturePage(browser, {
      url: 'https://imgur.com/gallery/fixture',
      html: '<!doctype html><title>Gallery</title><div class="image-placeholder"></div><div class="image-placeholder"></div>',
      settings: { js: 'window.__legacyExecuted = true;', favoriteTags: '' },
    });
    try {
      await gallery.page.waitForFunction(() => document.querySelectorAll('.image-placeholder').length === 2 && window.__handyFixture.reads.includes('favoriteTags'));
      await gallery.page.evaluate(() => window.__handyFixture.menus['Handy Image Configuration']());
      await gallery.page.locator('#hji_cfg_fav_tags').waitFor();
      assert.equal(await gallery.page.locator('#hji_cfg_6_js').count(), 0);
      await gallery.page.locator('#hji_cfg_fav_tags').fill('window.__injected = true;');
      await gallery.page.evaluate(() => document.querySelector('#hji_cfg_save').click());
      assert.equal(await gallery.page.evaluate(() => window.__handyFixture.writes.length), 0, 'Synthetic Save rejected on a live gallery page');
      await gallery.page.locator('#hji_cfg_fav_tags').fill('solo, animal_ears');
      await gallery.page.locator('#hji_cfg_2_bgclr').fill('red; background: url(https://attacker.fixture.test/track)');
      await gallery.page.locator('#hji_cfg_save').click();
      assert.equal(await gallery.page.evaluate(() => window.__handyFixture.writes.length), 0, 'Invalid CSS rejected before any settings writes');
      await gallery.page.locator('#hji_cfg_2_bgclr').fill('navy');
      await gallery.page.locator('#hji_cfg_save').click();
      const state = await gallery.page.evaluate(() => ({ values: window.__handyFixture.values, writes: window.__handyFixture.writes, injected: window.__injected }));
      assert.equal(state.values.favoriteTags, 'solo, animal_ears');
      assert.equal(state.values.bgColor, 'navy');
      assert.equal(state.writes.some(write => write.key === 'js'), false);
      assert.equal(state.injected, undefined);
      assert.deepEqual(gallery.errors, []);
      console.log('PASS Firefox gallery: no executable editor, synthetic Save blocked, invalid CSS rejected, trusted display/tag settings save');
    } finally { await gallery.context.close(); }

    const tags = await fixturePage(browser, {
      url: 'https://safebooru.org/index.php?page=post&s=view&id=fixture',
      html: '<!doctype html><title>Tags</title><ul><li class="tag-type-artist"><a href="?tags=tester">tester</a></li><li class="tag-type-general"><a href="?tags=horse">horse</a></li><li class="tag-type-general"><a href="?tags=tree">tree</a></li></ul><a href="https://media.fixture.test/images/original.png" style="display:block">Original image</a>',
      settings: { favoriteTags: 'horse', js: 'window.__legacyExecuted = true;' },
    });
    try {
      await tags.page.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0 && document.title.includes('(1x1)'));
      await tags.page.keyboard.press('Control+s');
      const download = await tags.page.evaluate(() => window.__handyFixture.downloads[0]);
      assert.ok(download.name.includes('horse'));
      assert.ok(download.name.includes('tester'));
      assert.ok(!download.name.includes('tree'));
      assert.equal(await tags.page.evaluate(() => window.__legacyExecuted), undefined);
      assert.deepEqual(tags.errors, []);
      console.log('PASS Firefox tags: favorite and artist tags included, unselected tags excluded, legacy executable setting ignored');
    } finally { await tags.context.close(); }

    const invalidTags = await fixturePage(browser, {
      url: 'https://imgbox.com/view/invalid-tags',
      html: '<!doctype html><title>Invalid settings</title><img id="img" src="https://media.fixture.test/original.png">',
      settings: { favoriteTags: 42 },
    });
    try {
      await invalidTags.page.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0 && document.title.includes('(1x1)'));
      assert.deepEqual(invalidTags.errors, []);
      console.log('PASS Firefox malformed settings: non-text favoriteTags safely falls back without blocking rendering');
    } finally { await invalidTags.context.close(); }
    console.log(`Firefox ${browser.version()}: all integration fixtures passed (GM APIs mocked; no external page/media requests).`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
