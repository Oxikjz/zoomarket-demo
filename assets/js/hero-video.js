// Видео в герое: сначала мгновенно показывается кадр-превью (poster), сам ролик (в демо-версии не подключён)
// подгружается только после загрузки страницы. Не грузится при «экономии трафика» и «уменьшить движение».
(() => {
  const v = document.querySelector('.hero-video');
  if (!v || !v.dataset.src) return;
  const saveData = navigator.connection && navigator.connection.saveData;
  if (saveData || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = () => {
    v.src = v.dataset.src;
    v.addEventListener('canplay', () => { v.classList.add('ready'); v.play().catch(() => {}); }, { once: true });
  };
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  // пауза, когда герой ушёл с экрана
  new IntersectionObserver(([e]) => { if (!v.src) return; e.isIntersecting ? v.play().catch(() => {}) : v.pause(); }).observe(v);
})();
