/* Of video — 交互脚本 */
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

  // AI 视频 API 演示
  const vForm = $('#video-form');
  const vStatus = $('#video-status');
  const vProvider = $('#video-provider');
  const vPrompt = $('#video-prompt');
  const vOutput = $('#video-output');
  const vDeployment = $('#video-deployment');
  const vVersion = $('#video-version');
  const vInputJson = $('#video-input-json');

  async function loadProviders() {
    if (!vProvider) return;
    try {
      const res = await fetch('/api/video/providers');
      const data = await res.json();
      const list = (data && data.providers) || [];
      vProvider.innerHTML = '';
      if (!list.length) {
        const opt = document.createElement('option');
        opt.value = 'mock';
        opt.textContent = 'Mock Provider (演示)';
        vProvider.appendChild(opt);
        return;
      }
      for (const p of list) {
        const opt = document.createElement('option');
        opt.value = p.key;
        opt.textContent = `${p.name}${p.auth === 'missing' ? '（未配置）' : ''}`;
        vProvider.appendChild(opt);
      }
    } catch (e) {
      vProvider.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = 'mock';
      opt.textContent = 'Mock Provider (演示)';
      vProvider.appendChild(opt);
    }
  }

  async function pollJob(provider, id, onUpdate) {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1200));
      try {
        const res = await fetch(`/api/video/jobs/${provider}/${encodeURIComponent(id)}`);
        if (!res.ok) break;
        const data = await res.json();
        if (onUpdate) onUpdate(data);
        if (data.status === 'succeeded' || data.status === 'failed') return data;
      } catch (_) { /* ignore */ }
    }
    return null;
  }

  function renderOutput(data) {
    if (!vOutput) return;
    vOutput.innerHTML = '';
    if (!data) {
      const span = document.createElement('span');
      span.className = 'muted';
      span.textContent = '超时或失败，请稍后重试。';
      vOutput.appendChild(span);
      return;
    }
    if (data.status === 'failed') {
      const span = document.createElement('span');
      span.textContent = '生成失败：' + (data.error || data.detail || '未知错误');
      vOutput.appendChild(span);
      return;
    }
    const out = data.output || (data.raw && data.raw.output) || null;
    if (out && typeof out === 'string' && /https?:\/\//.test(out) && /(mp4|webm)(\?|$)/.test(out)) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = out;
      video.style.maxWidth = '100%';
      vOutput.appendChild(video);
      return;
    }
    if (out && Array.isArray(out)) {
      // Some providers return array of URLs
      const firstUrl = out.find(u => typeof u === 'string' && /(mp4|webm)(\?|$)/.test(u));
      if (firstUrl) {
        const video = document.createElement('video');
        video.controls = true;
        video.src = firstUrl;
        video.style.maxWidth = '100%';
        vOutput.appendChild(video);
        return;
      }
    }
    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.textContent = JSON.stringify(data, null, 2);
    vOutput.appendChild(pre);
  }

  if (vForm) {
    loadProviders();
    vForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!vProvider || !vPrompt) return;
      const provider = vProvider.value;
      if (!provider) return;
      const prompt = vPrompt.value.trim();
      let input = {};
      if (vInputJson && vInputJson.value.trim()) {
        try { input = JSON.parse(vInputJson.value.trim()); }
        catch (_) { input = {}; }
      }
      if (prompt) input.prompt = prompt;
      const payload = { provider };
      if (provider === 'replicate') {
        const deployment = vDeployment && vDeployment.value.trim() ? vDeployment.value.trim() : undefined;
        const version = vVersion && vVersion.value.trim() ? vVersion.value.trim() : undefined;
        Object.assign(payload, { deployment, version, input });
      } else {
        Object.assign(payload, { prompt, options: input });
      }

      const btn = vForm.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      if (vStatus) vStatus.textContent = '正在创建任务...';
      if (vOutput) vOutput.innerHTML = '<span class="muted">等待结果...</span>';
      try {
        const res = await fetch('/api/video/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || '请求失败');
        if (vStatus) vStatus.textContent = '任务已创建，正在生成...';
        const result = await pollJob(provider, data.id, (d) => {
          if (!d) return;
          if (vStatus) vStatus.textContent = `状态：${d.status}`;
        });
        renderOutput(result);
        if (vStatus && result && result.status === 'succeeded') vStatus.textContent = '生成完成';
        else if (vStatus && result && result.status === 'failed') vStatus.textContent = '生成失败';
      } catch (err) {
        if (vStatus) vStatus.textContent = '创建任务失败：' + (err && err.message ? err.message : '');
      } finally {
        if (btn) btn.disabled = false;
        setTimeout(() => { if (vStatus) vStatus.textContent = ''; }, 5000);
      }
    });
  }
})();
