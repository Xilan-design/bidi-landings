/* Сборка рекламных страниц из src/ в корень проекта.

   Общие части лежат в src/partials/ и вставляются комментарием:
     <!-- @include header -->
     <!-- @include works title="Сайты, которые мы запустили" -->   параметры подставляются вместо {{title}}

   Запуск:  node build.js           — собрать один раз
            node build.js --watch   — пересобирать при каждом сохранении в src/

   Готовые .html в корне — результат сборки: правьте src/, иначе изменения затрутся.
   Метка ?v=… у стилей и скрипта меняется вместе с их содержимым, чтобы браузер не держал старую версию. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const PARTS = path.join(SRC, 'partials');

const hash = (file) => crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 8);

function include(html, depth = 0) {
  if (depth > 5) throw new Error('Слишком глубокая вложенность @include');
  return html.replace(/<!--\s*@include\s+([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*-->/g, (_, name, rawArgs) => {
    const file = path.join(PARTS, name + '.html');
    if (!fs.existsSync(file)) throw new Error('Нет части ' + name);
    const args = {};
    rawArgs.replace(/([\w-]+)="([^"]*)"/g, (m, k, v) => { args[k] = v; });
    const body = fs.readFileSync(file, 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => (k in args ? args[k] : ''));
    return include(body, depth + 1);
  });
}

function build() {
  const v = { css: hash('assets/css/style.css'), js: hash('assets/js/main.js') };
  for (const page of fs.readdirSync(SRC).filter((f) => f.endsWith('.html'))) {
    const out = include(fs.readFileSync(path.join(SRC, page), 'utf8'))
      .replace('assets/css/style.css"', `assets/css/style.css?v=${v.css}"`)
      .replace('assets/js/main.js"', `assets/js/main.js?v=${v.js}"`);
    const note = '<!-- Собрано из src/' + page + ' командой node build.js — правьте исходник -->\n';
    fs.writeFileSync(path.join(ROOT, page), out.replace(/^(<!doctype html>\r?\n)/i, '$1' + note));
    console.log('собрано', page);
  }
}

build();
if (process.argv.includes('--watch')) {
  let timer;
  const again = () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 80); };
  fs.watch(SRC, { recursive: true }, again);
  fs.watch(path.join(ROOT, 'assets'), { recursive: true }, again);
  console.log('Слежу за изменениями…');
}
