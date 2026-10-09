/* Рекламные страницы bidi.by: шапка, нижняя панель на телефоне, «до / после», самопроверка, портфолио, формы. */
(function () {
  'use strict';

  var METRIKA_ID = 94718040; // счётчик bidi.by
  var ENDPOINT = '/send.php'; // обработчик форм bidi.by — тот же, что у форм на основном сайте (action="send.php")

  function goal(name) {
    try { if (window.ym) window.ym(METRIKA_ID, 'reachGoal', name); } catch (e) {}
    try { if (window.gtag) window.gtag('event', name); } catch (e) {}
  }

  /* «Создание сайта»: сборка сайта на первом экране начинается, когда иллюстрация появилась в экране */
  // Наблюдаем после загрузки шрифтов: до неё текст короче и иллюстрация на миг «попадает» в экран телефона
  var build = document.querySelector('.build--wait');
  if (build) {
    var buildIo = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      build.classList.add('is-on');
      buildIo.disconnect();
    }, { threshold: 0.5 });
    var watchBuild = function () { buildIo.observe(build); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(watchBuild); else watchBuild();
  }

  /* Шапка получает границу после прокрутки; панель на телефоне появляется после первого экрана */
  var header = document.querySelector('.header');
  var dock = document.querySelector('.dock');
  var hero = document.querySelector('.hero');
  var order = document.getElementById('order');
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (dock && hero) {
      var pastHero = y > hero.offsetHeight * .7;
      var atForm = order && order.getBoundingClientRect().top < window.innerHeight * .6 && order.getBoundingClientRect().bottom > 0;
      dock.classList.toggle('is-shown', pastHero && !atForm);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Метки рекламы: utm_* и yclid/gclid сохраняем на визит и отправляем вместе с заявкой */
  var utm = '';
  try {
    var q = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'gclid'];
    var got = keys.filter(function (k) { return q.get(k); }).map(function (k) { return k + '=' + q.get(k); });
    if (got.length) sessionStorage.setItem('bidi-utm', got.join('; '));
    utm = sessionStorage.getItem('bidi-utm') || '';
  } catch (e) {}

  /* Кнопки с data-pick выбирают нужный вариант в форме заявки */
  document.querySelectorAll('[data-pick]').forEach(function (link) {
    link.addEventListener('click', function () {
      var input = document.querySelector('.form input[value="' + link.getAttribute('data-pick') + '"]');
      if (input) input.checked = true;
      goal('ctaClick');
    });
  });

  /* «До / после»: перетаскивание, клик по картинке и стрелки на клавиатуре */
  document.querySelectorAll('[data-ba]').forEach(function (ba) {
    var screen = ba.querySelector('.browser__screen');
    var knob = ba.querySelector('.ba__knob');
    var pos = 50, dragging = false, touched = false;
    function set(p) {
      pos = Math.max(0, Math.min(100, p));
      ba.style.setProperty('--pos', pos + '%');
      knob.setAttribute('aria-valuenow', Math.round(pos));
    }
    function fromEvent(e) {
      var r = screen.getBoundingClientRect();
      set((e.clientX - r.left) / r.width * 100);
    }
    screen.addEventListener('pointerdown', function (e) {
      dragging = true; touched = true; screen.setPointerCapture(e.pointerId); fromEvent(e);
    });
    screen.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
    screen.addEventListener('pointerup', function () { dragging = false; });
    screen.addEventListener('pointercancel', function () { dragging = false; });
    knob.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { set(pos - 5); e.preventDefault(); }
      if (e.key === 'ArrowRight') { set(pos + 5); e.preventDefault(); }
      touched = true;
    });
    set(50);

    /* Подсказка движением: шторка один раз проходит туда-обратно, если человек её ещё не трогал */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var played = false;
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting || played) return;
        played = true; io.disconnect();
        var frames = [[0, 50], [700, 22], [1500, 78], [2300, 50]], start = null;
        function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
        function at(t) {
          for (var i = 1; i < frames.length; i++) {
            if (t <= frames[i][0]) {
              var a = frames[i - 1], b = frames[i], k = ease((t - a[0]) / (b[0] - a[0]));
              return a[1] + (b[1] - a[1]) * k;
            }
          }
          return 50;
        }
        function tick(ts) {
          if (touched) return;
          if (start === null) start = ts;
          var t = ts - start;
          set(at(t));
          if (t < frames[frames.length - 1][0]) requestAnimationFrame(tick);
        }
        setTimeout(function () { requestAnimationFrame(tick); }, 600);
      }, { threshold: .6 });
      io.observe(ba);
    }
  });

  /* Самопроверка сайта: считаем отмеченные признаки и меняем вывод */
  var check = document.querySelector('[data-check]');
  if (check) {
    var boxes = check.querySelectorAll('input[type="checkbox"]');
    var count = check.querySelector('[data-count]');
    var verdict = check.querySelector('.verdict');
    var title = check.querySelector('[data-verdict-title]');
    var text = check.querySelector('[data-verdict-text]');
    var texts = [
      ['Отметьте, что узнаёте в своём сайте', 'Каждый пункт — причина, по которой посетитель уходит, так и не оставив заявку.'],
      ['Сайт работает, но есть что подтянуть', 'Одну-две проблемы часто решаем без полного редизайна. Пришлите ссылку — подскажем, с чего начать.'],
      ['Сайт теряет заметную часть заявок', 'Несколько проблем сразу — это уже вопрос структуры и дизайна. Редизайн окупится быстрее, чем кажется.'],
      ['Сайт мешает продажам', 'Посетители уходят раньше, чем понимают, что вы предлагаете. Пора пересобрать сайт — начнём с бесплатного разбора.']
    ];
    function update() {
      var n = 0;
      boxes.forEach(function (b) { if (b.checked) n++; });
      count.textContent = n;
      verdict.style.setProperty('--fill', (n / boxes.length * 100) + '%');
      var level = n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3;
      title.textContent = texts[level][0];
      text.textContent = texts[level][1];
    }
    boxes.forEach(function (b) { b.addEventListener('change', update); });
    update();

    // На телефоне вывод стоит под всеми пунктами — пока их отмечают, внизу виден счётчик со ссылкой на вывод
    var list = check.querySelector('.check__list');
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'check__pill';
    pill.innerHTML = '<em>Отмечено <b data-pill>0</b> из ' + boxes.length + '</em><span>Вывод ↓</span>';
    document.body.appendChild(pill);
    var listOn = false, verdictOn = false;
    function showPill() {
      var n = +count.textContent;
      pill.querySelector('[data-pill]').textContent = n;
      pill.classList.toggle('is-shown', n > 0 && listOn && !verdictOn);
    }
    var pillIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.target === list) listOn = en.isIntersecting; else verdictOn = en.isIntersecting; });
      showPill();
    }, { rootMargin: '0px 0px -30% 0px' });
    pillIo.observe(list); pillIo.observe(verdict);
    boxes.forEach(function (b) { b.addEventListener('change', showPill); });
    pill.addEventListener('click', function () { verdict.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  }

  /* Портфолио: на телефоне сначала короткий список, остальное по кнопке */
  var works = document.querySelector('.works');
  var more = document.querySelector('[data-more]');
  if (works && more) {
    more.addEventListener('click', function () {
      works.classList.remove('is-short');
      more.parentNode.remove();
    });
  }

  /* Телефон: подставляем +375 и группируем цифры */
  function formatPhone(v) {
    var d = v.replace(/\D/g, '');
    if (d.indexOf('375') !== 0) d = '375' + d.replace(/^80?/, '');
    d = d.slice(0, 12);
    var out = '+375';
    if (d.length > 3) out += ' (' + d.slice(3, 5);
    if (d.length >= 5) out += ')';
    if (d.length > 5) out += ' ' + d.slice(5, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    if (d.length > 10) out += '-' + d.slice(10, 12);
    return out;
  }
  document.querySelectorAll('input[type="tel"]').forEach(function (input) {
    input.addEventListener('focus', function () { if (!input.value) input.value = '+375 ('; });
    input.addEventListener('blur', function () { if (input.value.replace(/\D/g, '').length <= 3) input.value = ''; });
    input.addEventListener('input', function () { input.value = formatPhone(input.value); });
  });

  /* Формы: проверяем имя и телефон, отправляем на обработчик bidi.by */
  function fail(field, message) {
    field.classList.add('is-error');
    var err = field.querySelector('.field__error');
    if (err) err.textContent = message;
  }
  document.querySelectorAll('form[data-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.classList.remove('is-failed');
      var bad = false;
      form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('is-error'); });

      var name = form.querySelector('[name="Имя"]');
      if (name && name.value.trim().length < 2) { fail(name.closest('.field'), 'Напишите, как к вам обращаться'); bad = true; }
      var phone = form.querySelector('[name="phone"]');
      if (phone && phone.value.replace(/\D/g, '').length < 12) {
        if (phone.closest('.field')) fail(phone.closest('.field'), 'Номер нужен полностью: +375 (XX) XXX‑XX‑XX');
        else phone.setCustomValidity('Номер нужен полностью: +375 (XX) XXX‑XX‑XX');
        bad = true;
      } else if (phone) phone.setCustomValidity('');
      var site = form.querySelector('[name="Сайт"]');
      if (site && site.required && site.value.trim().length < 4) { site.setCustomValidity('Вставьте адрес сайта, например mysite.by'); bad = true; }
      else if (site) site.setCustomValidity('');
      if (bad) {
        // Свои подсказки под полями показываем без системного «Заполните это поле» поверх них
        var first = form.querySelector('.is-error input');
        if (first) first.focus(); else form.reportValidity();
        return;
      }

      var data = new FormData(form);
      data.set('Страница', document.title);
      if (utm) data.set('Метки рекламы', utm);
      form.classList.add('is-busy');

      var xhr = new XMLHttpRequest();
      xhr.open('POST', ENDPOINT);
      xhr.onloadend = function () {
        form.classList.remove('is-busy');
        if (xhr.status === 200 && xhr.responseText !== 'error') {
          form.classList.add('is-sent');
          goal('sendForm');
          goal(form.getAttribute('data-form'));
        } else {
          form.classList.add('is-failed');
        }
      };
      xhr.send(data);
    });
    form.addEventListener('input', function (e) {
      var f = e.target.closest('.field');
      if (f) f.classList.remove('is-error');
    });
  });
})();
