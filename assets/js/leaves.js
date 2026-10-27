// НЕ ПОДКЛЮЧЁН ни на одной странице (листопад отклонён заказчиком) — оставлен на случай, если захотят вернуть.
// Микро-листопад в блоке героя. Чисто декоративно: листья летят за текстом,
// не больше MAX штук, пауза вне экрана и на скрытой вкладке, выключен при «уменьшить движение».
(() => {
  const host = document.querySelector('.hero-card');
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const LEAVES = [1, 2, 3, 4, 5, 6, 7, 10, 8]; // 8 — красный, в конце списка: выпадает реже
  const MAX = 3;
  const layer = document.createElement('div');
  layer.className = 'leaf-fall';
  layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);

  const rnd = (a, b) => a + Math.random() * (b - a);
  let timer = null, alive = 0;

  function spawn(prewarm) {
    if (alive >= MAX) return;
    const h = host.offsetHeight;
    const n = Math.random() < 0.08 ? 8 : LEAVES[Math.floor(Math.random() * (LEAVES.length - 1))];
    const size = rnd(22, 42);
    const fall = rnd(11, 17);
    const el = document.createElement('div');
    el.className = 'leaf';
    el.style.cssText =
      `left:${rnd(-2, 98)}%;width:${size}px;` +
      `--fall:${h + 120}px;animation-duration:${fall}s;` +
      (prewarm ? `animation-delay:-${rnd(2, fall * 0.7)}s;` : '') +
      `opacity:${size < 30 ? 0.7 : 0.95}`;
    const img = document.createElement('img');
    img.src = `assets/img/leaves/leaf${n}.webp`;
    img.alt = '';
    img.style.cssText =
      `animation-duration:${rnd(2.6, 4.2)}s;animation-delay:-${rnd(0, 4)}s;` +
      `--sway:${rnd(18, 42)}px;--r0:${rnd(-40, 0)}deg;--r1:${rnd(20, 70)}deg`;
    el.appendChild(img);
    el.addEventListener('animationend', (e) => {
      if (e.target === el) { el.remove(); alive--; }
    });
    layer.appendChild(el);
    alive++;
  }

  function start() {
    if (timer) return;
    const tick = () => { spawn(false); timer = setTimeout(tick, rnd(3500, 6000)); };
    timer = setTimeout(tick, 600);
  }
  function stop() { clearTimeout(timer); timer = null; }

  // пара листьев уже в полёте при загрузке, чтобы не ждать
  spawn(true);

  let onScreen = true;
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    layer.classList.toggle('paused', !onScreen);
    onScreen && !document.hidden ? start() : stop();
  }).observe(host);
  document.addEventListener('visibilitychange', () => {
    layer.classList.toggle('paused', document.hidden || !onScreen);
    !document.hidden && onScreen ? start() : stop();
  });
})();
