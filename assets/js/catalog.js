/* ============================================================================
   Каталог товаров (catalog.html). Всё работает в браузере — сервер только отдаёт
   готовые файлы data/catalog.json и data/stock.json (их пишет синхронизация
   из учётной системы, см. tools/sync.py и tools/stock_sync.py, README.md).

   Как устроено:
   1. ZooSearch.load() (search.js) загружает каталог + наличие и готовит поиск.
   2. state — всё, что выбрал покупатель. Питомец/раздел/подгруппа/поиск
      берутся из адреса страницы и пишутся обратно (ссылку можно переслать):
        ?animal=dogs&sub=Лакомства&g3=Деревенские лакомства&q=royal
   3. render() — фильтрует товары и перерисовывает: вкладки питомцев, ленту
      разделов (#secRow), ленту подгрупп/брендов (#g3Row), счётчик, сетку карточек.
   4. card() — HTML одной карточки-перевёртыша: лицевая сторона (фото, название,
      цена, наличие) и оборот (описание из учётной системы, «для кого», где купить).
   5. Каждые 5 минут, пока вкладка видна, подтягивается свежее наличие.

   Данные товара (поля из catalog.json): id, name, animals[], sub (раздел),
   g3 (подгруппа/бренд), grp (папка учётной системы), price (null = ветпрепарат,
   цена в магазине), rx, desc, img, stock {idМагазина: 1}.
   Магазины, питомцы, бонусная скидка — в window.ZOO (site.js).
   Всё, что пришло из учётной системы или из адреса, выводится только через esc().
   ============================================================================ */
(async () => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const state = {
    animal: params.get('animal') || '',  // питомец: cats, dogs, rodents, birds, fish, reptiles, farm ('' — все)
    sub: params.get('sub') || '',        // раздел: «Сухие корма», «Лакомства»…
    g3: params.get('g3') || '',          // подгруппа/бренд внутри раздела ('-' — «Другое», без подгруппы)
    q: params.get('q') || '',            // поисковый запрос
    store: '',                           // фильтр «Магазин» (id из ZOO.stores)
    instock: true,                       // «Только в наличии»
    sort: 'pop',                         // pop — по названию, cheap, exp
    limit: 24,                           // сколько карточек показано («Показать ещё» +24)
    animFrom: 0,                         // с какой карточки анимировать появление
  };
  const storeName = Object.fromEntries(ZOO.stores.map((s) => [s.id, s.title]));
  const animalById = Object.fromEntries(ZOO.animals.map((a) => [a.id, a]));
  // вторая цена «с бонусной картой» — только если в site.js задан ZOO.bonus (сейчас 0 = выключено)
  const bonusPrice = (v) => Math.floor(v * (1 - (ZOO.bonus || 0) / 100));
  // строка «+N баллов на карту» под ценой (по условиям бонусной программы из учётной системы, см. site.js ZooBonus)
  const bonusLine = (v) => { const n = window.ZooBonus ? ZooBonus.points(v) : 0; return n > 0 ? `<div class="pr-bonus">+${n.toLocaleString('ru-RU')} ${ZooBonus.word(n)} на&nbsp;карту</div>` : ''; };
  const priceHtml = (v, cls) => ZOO.bonus
    ? `<div class="${cls}"><span class="pr-old">${rub(v)}</span><span class="pr-card">${rub(bonusPrice(v))}<small>с бонусной картой</small></span></div>`
    : `<div class="${cls}">${rub(v)}${bonusLine(v)}</div>`;
  const rub = (v) => v.toLocaleString('ru-RU') + ' ₽';
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };

  // загрузка каталога (с лоадером «лапки по кругу»)
  let data;
  $('grid').innerHTML = `<div class="empty">${pawLoader('Загружаем каталог…')}</div>`;
  try {
    [data] = await Promise.all([ZooSearch.load(), window.ZooBonus ? ZooBonus.ready : null]);
  } catch (e) {
    $('grid').innerHTML = '<div class="empty">Не удалось загрузить каталог. Обновите страницу.</div>';
    return;
  }
  const all = data.products;

  $('demo').hidden = !data.demo;

  // вкладки животных
  const tabs = [{ id: '', title: 'Все товары' }, ...ZOO.animals.filter((a) => all.some((p) => p.animals.includes(a.id)))];
  $('tabs').innerHTML = tabs.map((a) => `
    <button class="atab" data-animal="${a.id}" aria-pressed="false">
      ${a.img ? `<img src="${a.img}" alt="">` : '<span class="all"><svg><use href="assets/icons.svg?v=60#grid"/></svg></span>'}${a.title}
    </button>`).join('');
  $('store').insertAdjacentHTML('beforeend', ZOO.stores.map((s) => `<option value="${s.id}">${s.title}</option>`).join(''));
  document.querySelectorAll('.search[data-live] input').forEach((i) => (i.value = state.q));

  // есть ли товар: в выбранном магазине или хотя бы в одном
  const inStock = (p) => (state.store ? (p.stock[state.store] || 0) > 0 : Object.keys(p.stock).length > 0);

  const animalWord = { cats: 'кошек', dogs: 'собак', rodents: 'грызунов', birds: 'птиц', fish: 'рыбок', reptiles: 'рептилий', farm: 'сельских животных' };
  const storeById = Object.fromEntries(ZOO.stores.map((s) => [s.id, s]));

  // HTML одной карточки товара (лицевая сторона + оборот)
  function card(p, idx = 0) {
    const stores = Object.keys(p.stock);
    const n = stores.length;
    const a = p.animals.length === 1 ? animalById[p.animals[0]] : null;
    const photo = p.img;  // фото товара из учётной системы (демо-фото убраны 10.10.2026)
    const img = photo
      ? `<img class="photo" src="${esc(photo)}" alt="" loading="lazy">`
      : `<img class="ph" src="assets/img/emblem.png" alt=""><span class="ph-label">Фото скоро появится</span>`;
    const badge = n ? '' : '<span class="badge out">Нет в наличии</span>';
    const stockTxt = state.store
      ? (p.stock[state.store] ? 'Есть в этом магазине' : 'Нет в этом магазине')
      : n ? `В наличии в ${n} ${plural(n, 'магазине', 'магазинах', 'магазинах')}` : 'Нет в наличии';
    const price = p.price == null ? '<div class="back-price">Цену уточняйте в магазине</div>' : priceHtml(p.price, 'back-price');
    // оборот: описание из учётной системы (поле «Описание»), иначе короткая справка
    const about = (p.desc
      ? `<p class="back-desc">${esc(p.desc).replace(/\n+/g, '<br>')}</p>`
      : '<p class="back-desc">Подробности о&nbsp;товаре, составе и&nbsp;применении подскажут продавцы в&nbsp;любом нашем магазине.</p>') +
      `<div class="back-for">Для ${esc(p.animals.map((x) => animalWord[x]).filter(Boolean).join(', ') || 'всех питомцев')}${p.rx ? ' · ветпрепарат' : ''}</div>`;
    const where = ZOO.stores.filter((st) => p.stock[st.id]).map((st) =>
      `<li><span class="st-name">${esc(st.title)}</span>${st.phone ? `<a class="st-call" href="tel:${st.phone.replace(/[^+\d]/g, '')}" aria-label="Позвонить: ${esc(st.title)}, ${esc(st.phone)}" title="${esc(st.phone)}"><svg><use href="assets/icons.svg?v=60#phone"/></svg></a>` : ''}</li>`).join('');
    const anim = idx >= state.animFrom;
    const sw = 'sw-' + p.id;
    return `<article class="prod${anim ? '' : ' still'}" style="--d:${anim ? ((idx - state.animFrom) % 24) * 45 : 0}ms">
      <input type="checkbox" switch class="flip-sw" id="${sw}" aria-label="${esc(p.name)}: подробнее">
      <div class="prod-inner">
        <label class="face front" for="${sw}">
          <div class="prod-img">${img}${badge}<span class="flip-hint" aria-hidden="true"><svg><use href="assets/icons.svg?v=60#arrow"/></svg></span></div>
          <div class="prod-body">
            <div class="prod-sub">${a && !state.animal ? a.title + ' · ' : ''}${esc(p.sub)}</div>
            <div class="prod-name">${esc(p.name)}</div>
            ${p.price == null ? '<div class="prod-price rx">Цену уточняйте в магазине</div><div class="rx-note">Ветеринарный препарат</div>' : priceHtml(p.price, 'prod-price')}
            <div class="prod-stock${n ? '' : ' none'}"><span class="dot"></span>${stockTxt}</div>
          </div>
        </label>
        <label class="face back" for="${sw}" aria-hidden="true">
          <div class="back-name">${esc(p.name)}</div>
          ${price}
          ${about}
          <div class="back-title">${n ? 'Где купить' : 'Сейчас нет в наличии'}</div>
          ${n ? `<ul class="back-where">${where}</ul>` : '<p class="back-desc">Уточните у продавцов, когда товар появится.</p>'}
          <span class="back-close">Нажмите, чтобы перевернуть</span>
        </label>
      </div>
    </article>`;
  }

  // главный цикл: отфильтровать товары по state и перерисовать страницу
  function render() {
    document.querySelectorAll('.atab').forEach((b) => b.setAttribute('aria-pressed', b.dataset.animal === state.animal));
    $('title').textContent = state.animal ? 'Товары: ' + animalById[state.animal].title.toLowerCase() : state.q ? `Поиск: «${state.q}»` : 'Каталог товаров';

    // подразделы считаем без фильтра подраздела
    const scored = new Map(ZooSearch.match(all, state.q));
    const base = all.filter((p) => scored.has(p) && (!state.animal || p.animals.includes(state.animal)) && (!state.instock || inStock(p)));
    const subs = {};
    base.forEach((p) => (subs[p.sub] = (subs[p.sub] || 0) + 1));
    if (state.sub && !subs[state.sub]) state.sub = '';
    $('subs').parentElement.hidden = true; // разделы теперь лентой над товарами (#secRow)
    $('subs').innerHTML = [['', base.length, 'Все разделы'], ...Object.entries(subs).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, k])]
      .map(([k, v, t]) => `<button data-sub="${esc(k)}" aria-pressed="${state.sub === k}"><span>${esc(t)}</span><span class="n">${v}</span></button>`).join('');

    // лента разделов (видна сразу, без «Фильтров») и лента подгрупп/брендов выбранного раздела
    const chip = (attr, k, label, n, on) => `<button class="nchip" ${attr}="${esc(k)}" aria-pressed="${on}">${esc(label)}${n != null ? `<span>${n}</span>` : ''}</button>`;
    $('secRow').hidden = !state.animal;
    if (state.animal) {
      $('secRow').innerHTML = chip('data-sub', '', 'Все разделы', null, !state.sub) +
        Object.entries(subs).sort((a, b) => b[1] - a[1]).map(([k, v]) => chip('data-sub', k, k, v, state.sub === k)).join('');
    }
    const inSub = base.filter((p) => !state.sub || p.sub === state.sub);
    const g3s = {};
    let noG3 = 0;
    if (state.sub) inSub.forEach((p) => (p.g3 ? (g3s[p.g3] = (g3s[p.g3] || 0) + 1) : noG3++));
    if (state.g3 && !g3s[state.g3] && !(state.g3 === '-' && noG3)) state.g3 = '';
    const showG3 = state.sub && Object.keys(g3s).length + (noG3 ? 1 : 0) > 1;
    $('g3Row').hidden = !showG3;
    if (showG3) {
      $('g3Row').innerHTML = chip('data-g3', '', 'Все: ' + state.sub.toLowerCase(), null, !state.g3) +
        Object.entries(g3s).sort((a, b) => b[1] - a[1]).map(([k, v]) => chip('data-g3', k, k, v, state.g3 === k)).join('') +
        (noG3 ? chip('data-g3', '-', 'Другое', noG3, state.g3 === '-') : '');
    }
    requestAnimationFrame(() => document.querySelectorAll('.nav-chips:not([hidden]) [aria-pressed="true"]').forEach((b) => {
      const row = b.parentElement; row.scrollLeft = b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2;
    }));

    let list = inSub.filter((p) => !showG3 || !state.g3 || (state.g3 === '-' ? !p.g3 : p.g3 === state.g3));
    const pr = (p, d) => (p.price == null ? d : p.price);
    if (state.sort === 'cheap') list.sort((a, b) => pr(a, 1e9) - pr(b, 1e9));
    else if (state.sort === 'exp') list.sort((a, b) => pr(b, -1) - pr(a, -1));
    else if (state.q) list.sort((a, b) => scored.get(b) - scored.get(a) || a.name.localeCompare(b.name, 'ru'));
    else list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    const upd = data.stockUpdated ? new Date(data.stockUpdated) : null;
    $('count').innerHTML = `${list.length} ${plural(list.length, 'товар', 'товара', 'товаров')}` +
      (upd ? ` <span class="upd">· наличие на ${upd.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>` : '');
    $('grid').innerHTML = list.length
      ? list.slice(0, state.limit).map((p, i) => card(p, i)).join('')
      : '<div class="empty"><img src="assets/img/emblem.png" alt="">Ничего не нашлось. Попробуйте изменить запрос или снять фильтр «Только в наличии».</div>';
    $('more').hidden = list.length <= state.limit;
    // карточки ниже экрана не проявляются, а уже лежат на месте и поднимаются при прокрутке
    window.zooDrift?.([...$('grid').querySelectorAll('.prod')].filter((el) => el.getBoundingClientRect().top > innerHeight * 0.92));

    const u = new URLSearchParams();
    if (state.animal) u.set('animal', state.animal);
    if (state.q) u.set('q', state.q);
    if (state.sub) u.set('sub', state.sub);
    if (state.g3) u.set('g3', state.g3);
    history.replaceState(null, '', u.toString() ? '?' + u : location.pathname);
  }

  // тактильный отклик: на iPhone (iOS 18+) его даёт сам скрытый переключатель <input switch>,
  // по которому пользователь нажимает через <label> (сторона карточки); на Android — вибрация
  function flip(card, on) {
    if (navigator.vibrate) navigator.vibrate(12); // Android; на iPhone «щелчок» даёт сам переключатель
    card.classList.toggle('flipped', on);
    card.querySelector('.back').setAttribute('aria-hidden', !on);
    card.querySelector('.front').setAttribute('aria-hidden', on);
  }
  document.addEventListener('change', (e) => {
    if (!e.target.classList || !e.target.classList.contains('flip-sw')) return;
    flip(e.target.closest('.prod'), e.target.checked);
  });

  // шторка «Фильтры» на телефоне
  const closeFilters = () => { $('filters').classList.remove('open'); $('scrim').classList.remove('open'); };

  // клики по вкладкам питомцев, разделам и подгруппам (кнопки рисует render)
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-animal]');
    if (t) { state.animal = t.dataset.animal; state.sub = ''; state.g3 = ''; state.limit = 24; render(); return; }
    const s = e.target.closest('[data-sub]');
    if (s) { state.sub = s.dataset.sub; state.g3 = ''; state.limit = 24; render(); return; }
    const g = e.target.closest('[data-g3]');
    if (g) { state.g3 = g.dataset.g3; state.limit = 24; render(); return; }

  });
  $('more').onclick = () => { state.animFrom = state.limit; state.limit += 24; render(); state.animFrom = 0; };
  $('sort').onchange = (e) => { state.sort = e.target.value; render(); };
  $('store').onchange = (e) => { state.store = e.target.value; render(); };
  $('instock').onchange = (e) => { state.instock = e.target.checked; render(); };
  $('openFilters').onclick = () => { $('filters').classList.add('open'); $('scrim').classList.add('open'); };
  $('scrim').onclick = closeFilters;
  $('apply').onclick = closeFilters;

  // поле поиска на странице каталога фильтрует сразу при вводе
  let tmr;
  document.querySelectorAll('.search[data-live]').forEach((f) => {
    const inp = f.querySelector('input');
    f.onsubmit = (e) => { e.preventDefault(); inp.blur(); };
    inp.oninput = () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        state.q = inp.value.trim(); state.limit = 24;
        document.querySelectorAll('.search[data-live] input').forEach((o) => o !== inp && (o.value = inp.value));
        render();
      }, 200);
    };
  });

  render();
  // активная вкладка животного — сразу на виду (на телефоне ряд вкладок прокручивается)
  const activeTab = document.querySelector('.atab[aria-pressed="true"]');
  if (activeTab && state.animal) activeTab.parentElement.scrollLeft = activeTab.offsetLeft - 16;

  // пока страница открыта — подтягиваем свежее наличие раз в 5 минут (только если вкладка видна)
  setInterval(async () => {
    if (document.hidden || document.querySelector('.prod.flipped')) return;
    if (await ZooSearch.refreshStock()) render();
  }, 5 * 60 * 1000);
})();
