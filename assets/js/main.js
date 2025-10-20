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

  // 联系表单
  const form = $('#contact-form');
  const statusEl = $('#contact-status');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        name: String(fd.get('name') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        message: String(fd.get('message') || '').trim(),
      };
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (statusEl) statusEl.textContent = '正在提交...';
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Request failed');
        if (statusEl) statusEl.textContent = '已收到，我们会尽快联系你。';
        (form).reset();
      } catch (err) {
        if (statusEl) statusEl.textContent = '提交失败，请稍后重试或使用邮件联系。';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
      }
    });
  }
})();
