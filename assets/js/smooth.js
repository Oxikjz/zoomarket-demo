// Плавность как на сайте «Жидкости»: инерционная прокрутка (Lenis на ПК; в Safari и на телефоне
// родная — она и так инерционная), плавный переход по якорям, появление героя при загрузке.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
  const touch = matchMedia('(pointer: coarse)').matches;
  let lenis = null;
  if (!reduced && window.Lenis && !touch) {
    // в Safari тачпад и так инерционный — там сглаживание чуть легче, чтобы не было «задержки»
    lenis = new window.Lenis({ lerp: isSafari ? 0.1 : 0.065, smoothWheel: true, wheelMultiplier: 0.9 });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const HEADER = 84;
  function smoothTo(y) {
    y = Math.max(0, y);
    if (lenis) lenis.scrollTo(y, { duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 5) });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }
  // якоря на этой же странице
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const el = document.querySelector(url.hash);
    if (!el) return;
    e.preventDefault();
    document.querySelector('.drawer')?.classList.remove('open');
    smoothTo(el.getBoundingClientRect().top + scrollY - HEADER);
    history.replaceState(null, '', url.hash);
  });
  // пришли по ссылке с якорем с другой страницы — доехать плавно
  if (location.hash && document.querySelector(location.hash)) {
    addEventListener('load', () => setTimeout(() => smoothTo(document.querySelector(location.hash).getBoundingClientRect().top + scrollY - HEADER), 150));
  }
  // появление при загрузке
  requestAnimationFrame(() => document.documentElement.classList.add('loaded'));
})();
