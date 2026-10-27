/* ============================================================================
   Общее для всех страниц. ЗДЕСЬ МЕНЯЮТ ДАННЫЕ МАГАЗИНОВ:
   • ZOO.stores — адреса, подписи, часы, телефоны. id магазина (parkovaya…)
     должен совпадать с STORES в tools/sync.py и tools/stock_sync.py — по нему
     связывается наличие из учётной системы. gis — прямая ссылка на точку в карте
     (пусто — маршрут строится поиском «Зоомаркет Демо + адрес»).
   • ZOO.animals — разделы-питомцы (вкладки, картинки карточек на главной).
   • ZOO.bonus — % постоянной скидки по бонусной карте для второй цены (0 — выключено).
   Ниже: лоадер «лапки по кругу», ссылка на карте, мобильное меню, карточки
   магазинов на главной, плавный подъём блоков при прокрутке (zooDrift).
   ============================================================================ */
window.ZOO = {
  city: 'Новоград',
  // Вторая цена «с бонусной картой» выключена (0): по условиям программы скидки нет — бонусами можно оплатить до 5% покупки (10.10.2026).
  // Если появится постоянная скидка по карте — указать её % здесь, и на сайте снова будет вторая цена.
  bonus: 0,
  stores: [
    { id: 'parkovaya', title: 'ул. Парковая, 1', note: 'ТЦ «Пример», 1 этаж', hours: 'Ежедневно с 11:00 до 23:00', phone: '+7 000 000-00-01', gis: '', q: 'Парковая 1' },
    { id: 'sadovaya',   title: 'ул. Садовая, 25',    note: 'ТЦ «Образец»', hours: 'Ежедневно с 11:00 до 23:00', phone: '+7 000 000-00-02', gis: '', q: 'Садовая 25' },
    { id: 'rechnaya',    title: 'ул. Речная, 28',   note: '2 этаж', hours: 'Ежедневно с 10:00 до 21:00', phone: '+7 000 000-00-03', gis: '', q: 'Речная 28' },
    { id: 'tsentralnaya',   title: 'ул. Центральная, 122',    note: 'у входа в аптеку', hours: 'Ежедневно с 11:00 до 21:00', phone: '+7 000 000-00-04', gis: '', q: 'Центральная 122' },
    { id: 'lugovoy',    title: 'Луговой пр., 34/2',  note: '', hours: 'Ежедневно с 11:00 до 21:00', phone: '+7 000 000-00-05', gis: '', q: 'Луговой проспект 34/2' },
  ],
  animals: [
    { id: 'cats',    title: 'Кошки',   img: 'assets/img/cat-cats.webp?v=64' },
    { id: 'dogs',    title: 'Собаки',  img: 'assets/img/cat-dogs.webp?v=64' },
    { id: 'rodents', title: 'Грызуны', img: 'assets/img/cat-rodents.webp?v=64' },
    { id: 'birds',   title: 'Птицы',   img: 'assets/img/cat-birds.webp?v=64' },
    { id: 'fish',    title: 'Рыбки',   img: 'assets/img/cat-fish.webp?v=64' },
    { id: 'reptiles', title: 'Рептилии', img: 'assets/img/cat-reptiles.webp?v=64' },
    { id: 'farm',    title: 'Для фермы', img: 'assets/img/cat-farm.webp?v=64' },
  ],
};

// Бонусная программа: условия берутся из учётной системы (data/bonus.json пишет tools/sync.py 4 раза в день).
// ZooBonus.points(цена) — сколько баллов начислят за товар; тексты с data-bonus="…" на главной заполняются сами.
window.ZooBonus = (() => {
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  let cfg = null;
  const ready = fetch(location.origin + '/data/bonus.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((b) => { cfg = b && b.active && b.earnRub > 0 ? b : null; fill(); return cfg; });
  const points = (price) => (cfg && price ? Math.floor(price / cfg.earnRub) : 0);
  const word = (n) => plural(n, 'балл', 'балла', 'баллов');
  function fill() {
    if (!cfg) return;
    const pct = Math.round((100 / cfg.earnRub) * (cfg.pointRub || 1));
    const set = (key, text) => document.querySelectorAll(`[data-bonus="${key}"]`).forEach((el) => { el.innerHTML = text; });
    set('earn', `${pct}% от покупки возвращается баллами`);
    set('max', cfg.maxPct >= 100 ? 'Баллами можно оплатить покупку целиком' : `Баллами можно оплатить до&nbsp;${cfg.maxPct}% покупки`);
    if (cfg.welcome) set('welcome', `+${cfg.welcome} ${word(cfg.welcome)} за&nbsp;первую покупку`);
    document.querySelectorAll('[data-bonus="welcome"]').forEach((el) => { el.closest('li')?.toggleAttribute('hidden', !cfg.welcome); });
  }
  return { ready, points, word, get cfg() { return cfg; } };
})();

// Маршрут на карте: прямая ссылка на карточку точки (gis), если она известна,
// иначе поиск «Зоомаркет Демо + адрес» — при одном результате карте сразу открывает карточку.
// Индикатор загрузки: следы лапок по кругу
window.pawLoader = (text = 'Загружаем…', small = false) => {
  const N = 8;
  const paws = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * 360;
    return `<svg class="pl-paw" style="--a:${a}deg;--i:${i}"><use href="assets/icons.svg?v=60#paw-fill"/></svg>`;
  }).join('');
  return `<div class="paw-loader${small ? ' small' : ''}" role="status"><div class="pl-ring">${paws}</div>${text ? `<span>${text}</span>` : ''}</div>`;
};

function mapsUrl(s) {
  if (s.gis) return s.gis;
  return 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(s.q);
}

// мобильное меню
document.addEventListener('click', (e) => {
  const b = e.target.closest('.burger');
  if (b) document.querySelector('.drawer').classList.toggle('open');
});

// карточки магазинов (если на странице есть контейнер)
const storesEl = document.getElementById('stores');
if (storesEl) {
  storesEl.innerHTML = ZOO.stores.map((s) => `
    <div class="store">
      <div class="store-ico"><svg><use href="assets/icons.svg?v=60#pin"/></svg></div>
      <b>${s.title}</b>
      <div class="muted store-note">${s.note || '&nbsp;'}</div>
      <div class="store-foot">
      <div class="hours">${s.hours || 'Часы работы уточняются'}</div>
      ${s.phone ? `<a class="store-phone" href="tel:${s.phone.replace(/[^+\d]/g, '')}"><svg><use href="assets/icons.svg?v=60#phone"/></svg>${s.phone}</a>` : ''}
      <a class="route" href="${mapsUrl(s)}" target="_blank" rel="noopener">Маршрут на карте <svg><use href="assets/icons.svg?v=60#arrow"/></svg></a>
      </div>
    </div>`).join('');
}

// блоки уже на странице и плавно поднимаются вслед за прокруткой (без исчезания):
// внизу экрана блок чуть ниже своего места, к середине экрана мягко встаёт на место
window.zooDrift = (() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return () => {};
  // если браузер умеет анимацию по прокрутке (новые Safari/Chrome) — её считает сам браузер на полной частоте экрана
  // (на iPhone 120 Гц), без скриптов; иначе на телефонах эффект выключен, на ПК — запасной вариант на JS
  const scrollTimeline = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
  if (scrollTimeline) {
    const addCss = (els) => els.forEach((el, i) => { el.classList.add('drift-sd'); el.style.setProperty('--k', (1 + (i % 4) * 0.22).toFixed(2)); });
    ['.section-head', '.cats > .cat', '.promo > *', '.facts > div', '.stores > .store', '.about-text', '.footer-grid > div']
      .forEach((sel) => addCss([...document.querySelectorAll(sel)]));
    return addCss;
  }
  if (matchMedia('(pointer: coarse)').matches) return () => {};
  const MAX = 46;                         // насколько ниже своего места блок у нижнего края экрана, px
  const active = new Set();
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    e.isIntersecting ? active.add(e.target) : active.delete(e.target);
  }), { rootMargin: '25% 0px 25% 0px' });
  let raf = 0;
  const tick = () => {
    raf = 0;
    const vh = innerHeight;
    let moving = false;
    active.forEach((el) => {
      if (!el.isConnected) { active.delete(el); io.unobserve(el); return; }
      const first = el._dy === undefined;
      const cur = el._dy || 0;
      const top = el.getBoundingClientRect().top - cur;       // место блока без сдвига
      const p = Math.min(1, Math.max(0, (top - vh * 0.55) / (vh * 0.45)));
      const target = p * p * MAX * (1 + (el._i || 0) * 0.22); // соседние блоки — чуть с разной скоростью
      const next = first ? target : cur + (target - cur) * 0.16; // мягкое догоняние
      const v = Math.abs(target - next) < 0.15 ? target : next;
      if (v !== cur) { el._dy = v; el.style.setProperty('--dy', v.toFixed(2) + 'px'); }
      if (v !== target) moving = true;
    });
    if (moving) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  const add = (els) => {
    els.forEach((el, i) => { el.classList.add('drift'); el._i = i % 4; io.observe(el); });
    setTimeout(kick, 50);
  };
  ['.section-head', '.cats > .cat', '.promo > *', '.facts > div', '.stores > .store', '.about-text', '.footer-grid > div']
    .forEach((sel) => add([...document.querySelectorAll(sel)]));
  return add;
})();
