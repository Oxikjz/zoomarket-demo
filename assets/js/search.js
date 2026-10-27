// Умный поиск по каталогу: формы слов, синонимы, бренды по-русски, опечатки, подсказки при вводе.
window.ZooSearch = (() => {
  const STOP = new Set(['для', 'и', 'с', 'со', 'в', 'во', 'на', 'по', 'от', 'из', 'без', 'к', 'о', 'у', 'мой', 'моей', 'моего']);

  // грубый стеммер: отрезаем частые русские окончания
  const END = /(иями|ями|ами|ого|его|ому|ему|ыми|ими|ией|ий|ый|ой|ая|яя|ое|ее|ые|ие|ую|юю|ом|ем|ам|ям|ах|ях|ов|ев|ей|ок|ек|а|я|о|е|ы|и|у|ю|ь)$/;
  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
  const stem = (w) => (w.length > 4 ? w.replace(END, '') : w);

  // синонимы: основа запроса -> какие основы искать в товарах
  const SYN = {
    'жидк': ['влажн'], 'мокр': ['влажн'], 'пауч': ['влажн', 'пауч'], 'консерв': ['влажн', 'конс'], 'паштет': ['паштет', 'влажн'],
    'сух': ['сух'], 'гранул': ['сух'],
    'вкусняш': ['лакомств'], 'лакомк': ['лакомств'], 'угощен': ['лакомств'], 'косточк': ['косточк', 'лакомств'],
    'когтедралк': ['когтеточ'], 'царапк': ['когтеточ'],
    'лоток': ['туалет', 'лоток'], 'горшок': ['туалет'], 'туалет': ['туалет', 'лоток'],
    'песок': ['наполнит', 'песок'], 'наполнител': ['наполнит'],
    'блох': ['блох', 'репелл'], 'клещ': ['клещ', 'блох'], 'паразит': ['блох', 'клещ', 'глист'], 'глист': ['глист'],
    'переноск': ['переноск'], 'сумк': ['переноск'],
    'поилк': ['поилк', 'автопоилк'], 'кормушк': ['кормушк', 'автокормушк', 'миск'],
    'поводок': ['поводк', 'рулетк'], 'поводк': ['поводк', 'рулетк'], 'рулетк': ['рулетк', 'поводк'],
    'лежанк': ['лежанк', 'домик'], 'домик': ['домик', 'лежанк'], 'кроват': ['лежанк'],
    'игрушк': ['игрушк', 'дразнилк', 'мяч'], 'мячик': ['мяч'],
    'расческ': ['расческ', 'пуходерк', 'щетк', 'дешеддер'], 'шампун': ['шамп', 'шампун'],
    'витамин': ['витамин'], 'одежд': ['одежд', 'комбинезон', 'дождевик', 'попон'],
    'котен': ['котят', 'котен'], 'котят': ['котят', 'котен'], 'щен': ['щен'],
    // бренды по-русски
    'роял': ['royal', 'роял'], 'канин': ['canin', 'канин'], 'проплан': ['проплан', 'pro plan'], 'монж': ['monge'], 'фармин': ['фармин', 'farmin'],
    'грандорф': ['grandorf'], 'брит': ['brit', 'брит'], 'аджо': ['ajo'], 'эджо': ['ajo'], 'перфект': ['perfect'], 'вискас': ['whiskas'],
    'педигри': ['pedigree'], 'феликс': ['felix'], 'шеб': ['sheba'], 'триол': ['triol'], 'ванпи': ['wanpy'], 'инаб': ['inaba'],
  };
  // слова-животные: совпадают и с разделом сайта, и с текстом товара
  const ANIMAL = [
    [/^(кош|кот|котя|котен|котик)/, 'cats'], [/^(соб|щен|пес|псин)/, 'dogs'],
    [/^(грыз|хомя|хомк|крол|свин|крыс|мыш|шиншил|дегу)/, 'rodents'], [/^(попуг|птиц|канар|амадин)/, 'birds'],
    [/^(рыб|аквар)/, 'fish'], [/^(череп|репт|ящер)/, 'reptiles'], [/^(кур|ферм|сельск|несушк|бройлер)/, 'farm'],
  ];

  let dataP = null, vocab = null;
  // наличие: маленький stock.json обновляется на сервере раз в 5 минут и всегда грузится свежим
  async function applyStock(d) {
    try {
      const st = await (await fetch(location.origin + location.pathname.replace(/[^/]*$/, '') + 'data/stock.json', { cache: 'no-store' })).json();
      d.products.forEach((p) => {
        const m = st.s[p.id] || 0;
        p.stock = {};
        st.stores.forEach((id, i) => { if (m & (1 << i)) p.stock[id] = 1; });
      });
      d.stockUpdated = st.updated;
    } catch (e) { /* нет stock.json — остаётся наличие из catalog.json */ }
    return d;
  }
  function load() {
    if (!dataP) {
      // каталог меняется редко: браузер перепроверяет его (no-cache = быстрый ответ 304, если не изменился)
      dataP = fetch(location.origin + location.pathname.replace(/[^/]*$/, '') + 'data/catalog.json', { cache: 'no-cache' }).then((r) => r.json()).then(applyStock).then((d) => {
        const words = new Set();
        d.products.forEach((p) => {
          p.animals = p.animals || [p.animal];
          const t = norm(p.name + ' ' + p.sub + ' ' + (p.grp || ''));
          p._t = ' ' + t.split(' ').map(stem).join(' ') + ' ';
          p._raw = ' ' + t + ' ';
          t.split(' ').forEach((w) => w.length > 2 && words.add(stem(w)));
        });
        vocab = [...words];
        return d;
      });
    }
    return dataP;
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        best = Math.min(best, cur[j]);
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  // разбор запроса: на каждое слово — набор вариантов основы + возможный раздел-животное
  function parse(q) {
    return norm(q).split(' ').filter((w) => w && !STOP.has(w)).map((w) => {
      const s = stem(w);
      let alts = new Set([s]);
      for (const k in SYN) if (w.startsWith(k) || s.startsWith(k) || (k.startsWith(s) && s.length >= 4)) SYN[k].forEach((x) => alts.add(x));
      const animal = (ANIMAL.find(([re]) => re.test(s)) || [])[1] || null;
      // опечатка: если ни один вариант не встречается в словаре — берём ближайшее слово
      if (vocab && ![...alts].some((a) => vocab.some((v) => v.startsWith(a)))) {
        const max = s.length >= 7 ? 2 : s.length >= 4 ? 1 : 0;
        let best = null, bd = max + 1;
        if (max) for (const v of vocab) { const d = lev(s, v.slice(0, s.length + 1), max); if (d < bd) { bd = d; best = v; if (!d) break; } }
        if (best) alts.add(best);
      }
      return { alts: [...alts], animal };
    });
  }

  function score(p, terms) {
    let sc = 0;
    for (const t of terms) {
      let hit = 0;
      for (const a of t.alts) {
        if (p._t.includes(' ' + a) || p._raw.includes(' ' + a)) { const i = Math.max(p._t.indexOf(' ' + a), p._raw.indexOf(' ' + a)); hit = i >= 0 && i < p.name.length ? 3 : 2; break; }
      }
      if (!hit && t.animal && p.animals.includes(t.animal)) hit = 1;
      if (!hit) return 0;
      sc += hit;
    }
    return sc + (Object.keys(p.stock).length ? 0.5 : 0);
  }

  // фильтр + оценка релевантности для каталога
  function match(products, q) {
    const terms = parse(q);
    if (!terms.length) return products.map((p) => [p, 1]);
    const out = [];
    for (const p of products) { const s = score(p, terms); if (s) out.push([p, s]); }
    return out;
  }

  async function refreshStock() { const d = await load(); const before = d.stockUpdated; await applyStock(d); return d.stockUpdated !== before; }

  return { load, match, norm, refreshStock };
})();

// Выпадающие подсказки под полями поиска (главная и каталог)
(() => {
  const forms = document.querySelectorAll('form.search');
  if (!forms.length) return;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rub = (v) => (v == null ? 'цена в магазине' : v.toLocaleString('ru-RU') + ' ₽');
  const animalTitle = (id) => ((window.ZOO && ZOO.animals.find((a) => a.id === id)) || {}).title || '';

  forms.forEach((form) => {
    const input = form.querySelector('input');
    form.style.position = 'relative';
    const box = document.createElement('div');
    box.className = 'suggest';
    box.hidden = true;
    form.appendChild(box);
    let items = [], active = -1, tmr;

    const close = () => { box.hidden = true; active = -1; };
    const go = (href) => { location.href = href; };

    async function render() {
      const q = input.value.trim();
      if (q.length < 2) return close();
      let ready = false;
      const t = setTimeout(() => { if (!ready) { box.innerHTML = pawLoader('Ищем…', true); box.hidden = false; } }, 150);
      const d = await ZooSearch.load();
      ready = true; clearTimeout(t);
      const res = ZooSearch.match(d.products, q).sort((a, b) => b[1] - a[1]);
      // разделы: животное + раздел с количеством
      const secs = {};
      res.forEach(([p]) => p.animals.forEach((a) => { const k = a + '|' + p.sub; secs[k] = (secs[k] || 0) + 1; }));
      const top = Object.entries(secs).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const prods = res.slice(0, 6);
      const all = 'catalog.html?q=' + encodeURIComponent(q);
      items = [];
      let html = '';
      if (!res.length) {
        html = `<div class="sg-empty">Ничего не нашлось. Попробуйте другое слово, например «корм для кошек».</div>`;
      } else {
        html += '<div class="sg-title">Разделы</div>';
        top.forEach(([k, n]) => {
          const [a, sub] = k.split('|');
          const href = `catalog.html?animal=${a}&sub=${encodeURIComponent(sub)}`;
          items.push(href);
          html += `<a class="sg-item sg-sec" href="${href}"><span>${esc(sub)} <em>${esc(animalTitle(a).toLowerCase())}</em></span><span class="sg-n">${n}</span></a>`;
        });
        html += '<div class="sg-title">Товары</div>';
        prods.forEach(([p]) => {
          const href = `catalog.html?q=${encodeURIComponent(p.name)}`;
          items.push(href);
          html += `<a class="sg-item" href="${href}"><span class="sg-name">${esc(p.name)}</span><span class="sg-price">${rub(p.price)}</span></a>`;
        });
        items.push(all);
        html += `<a class="sg-item sg-all" href="${all}">Все результаты: ${res.length}</a>`;
      }
      box.innerHTML = html;
      box.hidden = false;
      active = -1;
    }

    input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', () => ZooSearch.load());
    input.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(render, 120); });
    input.addEventListener('keydown', (e) => {
      const links = [...box.querySelectorAll('.sg-item')];
      if (box.hidden || !links.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach((l, i) => l.classList.toggle('on', i === active));
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault(); go(links[active].href);
      } else if (e.key === 'Escape') close();
    });
    document.addEventListener('click', (e) => { if (!form.contains(e.target)) close(); });
  });
})();
