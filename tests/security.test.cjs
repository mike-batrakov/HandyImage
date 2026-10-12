'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'HandyImage.user.js'), 'utf8');

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `Cannot locate ${name}`);
  return source.slice(start, end);
}

test('executable settings are removed and updates cannot return to upstream', () => {
  assert.equal(/\beval\s*\(|\bcfg_js\b|hji_cfg_6_js/.test(source), false, 'No executable settings path may remain');
  assert.match(source, /^\/\/ @name\s+Handy Image \(Hardened\)$/m);
  assert.match(source, /^\/\/ @namespace\s+https:\/\/github\.com\/mike-batrakov\/HandyImage$/m);
  assert.match(source, /^\/\/ @updateURL\s+none$/m);
  assert.match(source, /^\/\/ @downloadURL\s+none$/m);
  assert.match(source, /^\/\/ @noframes\s*$/m);
});

test('synthetic keyboard commands cannot request downloads or open configuration', () => {
  const commands = [];
  const context = vm.createContext({
    window: {}, viewHeight: 900, KeyEvent: { DOM_VK_S: 83, DOM_VK_P: 80 },
    download_image: () => commands.push('download'), cfg: () => commands.push('cfg'),
    cancelEvent: () => {},
  });
  vm.runInContext(functionSource('onkeydown ', 'cfg'), context);
  for (const code of [83, 80]) {
    context.onkeydown({ ctrlKey: code === 83, keyCode: code, which: code, isTrusted: false });
  }
  assert.deepEqual(commands, []);
  context.onkeydown({ ctrlKey: true, keyCode: 83, which: 83, isTrusted: true });
  assert.deepEqual(commands, ['download']);
});

test('download uses the captured URL and does not disclose the viewing URL', () => {
  const downloads = [];
  const original = 'https://media.example.test/original.png';
  const context = vm.createContext({
    i: { src: 'https://attacker.example.test/replaced.png' }, download_url: original,
    filename: '../image.png', bUseCustomFilename: true,
    referrer_policy: 'strict-origin-when-cross-origin',
    window: { location: { href: 'https://host.example.test/private?token=secret' } },
    console: { log() {}, warn() {}, error() {} }, GM_download: details => downloads.push(details),
  });
  vm.runInContext(functionSource('download_image', 'onkeydown '), context);
  context.download_image();
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].url, original);
  assert.ok(!downloads[0].headers || !Object.keys(downloads[0].headers).some(key => key.toLowerCase() === 'referer'));
  assert.equal(downloads[0].saveAs, true);
  assert.ok(!downloads[0].name.includes('/'));
  context.download_url = '';
  context.download_image();
  assert.equal(downloads.length, 1, 'An unavailable safe URL must not fall back to mutable DOM');
});

test('download and direct-navigation URLs accept only credential-free HTTP(S)', () => {
  const context = vm.createContext({ URL, window: { location: { href: 'https://host.example.test/view/1' } } });
  vm.runInContext(functionSource('get_download_url', 'makeimage'), context);
  assert.equal(context.get_download_url('/original.png'), 'https://host.example.test/original.png');
  assert.equal(context.get_download_url('https://media.example.test/a.png'), 'https://media.example.test/a.png');
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,AA==', 'file:///C:/private', 'blob:https://host.example.test/id', 'https://user:password@media.example.test/a.png', 'http://[invalid']) {
    assert.equal(context.get_download_url(url), '', url);
  }
});
