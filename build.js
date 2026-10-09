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

// Адрес, по которому страницы будут жить на bidi.by: из него собираются canonical, og:url и картинки превью
const BASE = 'https://bidi.by/';

// Разметка schema.org: студия, услуга с ценами, хлебные крошки и вопросы — вопросы берём из блока «Частые вопросы» на странице
const ORG = {
  '@type': 'ProfessionalService', '@id': BASE + '#studio', name: 'Веб-студия bidi.by', legalName: 'ООО «Бизнес в цифре»',
  url: BASE, logo: BASE + 'assets/img/logo.svg', image: BASE + 'assets/img/og-sozdanie-sajta.jpg',
  telephone: ['+375336566663', '+79605855060'], email: 'order@bidi.by', priceRange: 'от 890 BYN',
  address: { '@type': 'PostalAddress', streetAddress: 'ул. Зеньковой, 1', addressLocality: 'Витебск', addressCountry: 'BY' },
  openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:00' },
  areaServed: [{ '@type': 'Country', name: 'Беларусь' }, { '@type': 'Country', name: 'Россия' }],
  sameAs: ['https://www.instagram.com/bidi.by_']
};
const SERVICES = {
  'sozdanie-sajta': { name: 'Создание сайта для малого бизнеса', type: 'Разработка сайтов', crumb: 'Создание сайта',
    offers: [['Лендинг', 890], ['Сайт компании', 1690], ['Интернет-магазин', 3500]] },
  'redizajn-sajta': { name: 'Редизайн сайта', type: 'Редизайн сайтов', crumb: 'Редизайн сайта',
    offers: [['Редизайн лендинга', 890], ['Редизайн корпоративного сайта', 1690], ['Редизайн интернет-магазина', 3500]] }
};
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function schema(slug, html) {
  const url = BASE + slug, sv = SERVICES[slug];
  const graph = [ORG];
  if (sv) {
    graph.push({ '@type': 'Service', name: sv.name, serviceType: sv.type, url, provider: { '@id': ORG['@id'] }, areaServed: ORG.areaServed,
      offers: sv.offers.map(([name, price]) => ({ '@type': 'Offer', name, url, priceCurrency: 'BYN',
        priceSpecification: { '@type': 'PriceSpecification', minPrice: price, priceCurrency: 'BYN' } })) });
    graph.push({ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'bidi.by', item: BASE },
      { '@type': 'ListItem', position: 2, name: sv.crumb, item: url }] });
  }
  const qa = [...html.matchAll(/<details class="qa">\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)];
  if (qa.length) graph.push({ '@type': 'FAQPage', mainEntity: qa.map((m) => ({ '@type': 'Question', name: text(m[1]),
    acceptedAnswer: { '@type': 'Answer', text: text(m[2]) } })) });
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return '  <script type="application/ld+json">' + json + '</script>\n';
}

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
    const slug = page.replace(/\.html$/, '');
    let out = include(fs.readFileSync(path.join(SRC, page), 'utf8'))
      .replace(/%BASE%/g, BASE)
      .replace('assets/css/style.css"', `assets/css/style.css?v=${v.css}"`)
      .replace('assets/js/main.js"', `assets/js/main.js?v=${v.js}"`);
    out = out.replace('</head>', schema(slug, out) + '</head>');
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
