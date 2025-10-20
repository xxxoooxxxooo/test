/* Crevas AI — 交互脚本 */
(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  // 移动端菜单
  const toggle = $('.nav-toggle');
  const menu = $('#primary-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // FAQ 手风琴键盘可用性增强
  $$('.accordion .item summary').forEach((sum) => {
    sum.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sum.click();
      }
    });
  });

  // 年份
  const year = new Date().getFullYear();
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(year);
})();
