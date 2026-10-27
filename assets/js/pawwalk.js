// По фону «проходит» невидимый зверёк: следы появляются по очереди и тают.
// Слой — часть страницы (следы прокручиваются вместе с блоками), позади контента; выключен при «уменьшить движение» и на скрытой вкладке.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layer = document.createElement('div');
  layer.className = 'paw-walk';
  layer.setAttribute('aria-hidden', 'true');
  document.body.prepend(layer);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const STRIDE = 64, SIDE = 13, STEP_MS = 520;
  let timer = null;

  function walk() {
    // слой на всю высоту страницы; прогулка начинается в той её части, что сейчас на экране
    const docH = document.documentElement.scrollHeight;
    layer.style.height = docH + 'px';
    const W = document.documentElement.clientWidth, H = innerHeight, top = scrollY;
    const fromLeft = Math.random() < 0.5;
    let x = fromLeft ? -30 : W + 30;
    let y = top + rnd(H * 0.15, H * 0.85);
    const minY = top - H * 0.5, maxY = Math.min(docH - 30, top + H * 1.5);
    let dir = (fromLeft ? 0 : Math.PI) + rnd(-0.45, 0.45);
    const turn = rnd(-0.012, 0.012);
    let step = 0;

    const next = () => {
      if (x < -60 || x > W + 60 || y < minY || y > maxY) {
        if (step > 2) { timer = setTimeout(walk, rnd(2500, 6000)); return; }
      }
      const side = step % 2 ? 1 : -1;
      const px = x + Math.cos(dir + Math.PI / 2) * SIDE * side;
      const py = y + Math.sin(dir + Math.PI / 2) * SIDE * side;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('class', 'paw-step');
      el.style.left = px + 'px';
      el.style.top = py + 'px';
      el.style.transform = `translate(-50%,-50%) rotate(${(dir * 180) / Math.PI + 90}deg)`;
      el.innerHTML = '<use href="assets/icons.svg?v=60#paw-fill"/>';
      el.addEventListener('animationend', () => el.remove());
      layer.appendChild(el);
      x += Math.cos(dir) * STRIDE;
      y += Math.sin(dir) * STRIDE;
      dir += turn + rnd(-0.04, 0.04);
      step++;
      timer = setTimeout(next, STEP_MS + rnd(-60, 60));
    };
    next();
  }

  const start = () => { if (!timer) timer = setTimeout(walk, 1200); };
  const stop = () => { clearTimeout(timer); timer = null; };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
})();
