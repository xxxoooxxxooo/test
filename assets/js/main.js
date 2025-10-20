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

  // 登录（简单会话）
  const loginForm = $('#login-form');
  const loginStatus = $('#login-status');
  const loginEmail = $('#login-email');
  const loginPassword = $('#login-password');
  const loginCta = $('#login-cta');
  const logoutBtn = $('#logout-btn');
  let authUser = null;

  async function refreshAuthUI() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('auth check failed');
      const data = await res.json().catch(() => ({}));
      authUser = data && data.authenticated ? (data.user || null) : null;
    } catch (_) {
      authUser = null;
    }
    if (loginCta) {
      if (authUser) {
        loginCta.textContent = '退出';
        loginCta.setAttribute('href', '#');
        loginCta.dataset.loggedIn = '1';
      } else {
        loginCta.textContent = '登录';
        loginCta.setAttribute('href', '#login');
        delete loginCta.dataset.loggedIn;
      }
    }
    if (logoutBtn) logoutBtn.style.display = authUser ? '' : 'none';
    if (loginForm && authUser) {
      // 填充邮箱并清空密码
      if (loginEmail) loginEmail.value = authUser.email || '';
      if (loginPassword) loginPassword.value = '';
    }
  }

  if (loginForm) {
    // 初始化
    refreshAuthUI();

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginEmail ? loginEmail.value.trim() : '';
      const password = loginPassword ? loginPassword.value : '';
      if (!email || !password) {
        if (loginStatus) loginStatus.textContent = '请输入邮箱和密码';
        return;
      }
      const btn = loginForm.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      if (loginStatus) loginStatus.textContent = '正在登录...';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'same-origin',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error((data && data.error) || '登录失败');
        authUser = data.user || { email };
        if (loginStatus) loginStatus.textContent = '登录成功';
        refreshAuthUI();
        // 跳转到视频区块
        location.hash = '#video';
      } catch (err) {
        if (loginStatus) loginStatus.textContent = '登录失败：' + (err && err.message ? err.message : '');
      } finally {
        if (btn) btn.disabled = false;
        setTimeout(() => { if (loginStatus) loginStatus.textContent = ''; }, 4000);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } catch (_) { /* ignore */ }
      authUser = null;
      refreshAuthUI();
    });
  }

  if (loginCta) {
    loginCta.addEventListener('click', async (e) => {
      if (loginCta.dataset.loggedIn === '1') {
        e.preventDefault();
        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
        authUser = null;
        refreshAuthUI();
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
  const vRepToken = $('#replicate-token');
  let hasBackend = false;

  async function loadProviders() {
    if (!vProvider) return;
    try {
      const res = await fetch('/api/video/providers');
      const data = await res.json();
      hasBackend = true;
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
      hasBackend = false;
      vProvider.innerHTML = '';
      const optR = document.createElement('option');
      optR.value = 'replicate';
      optR.textContent = 'Replicate（直连开发模式）';
      vProvider.appendChild(optR);
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
        let usedDirect = false;
        let jobId = '';
        if (provider === 'replicate' && vRepToken && vRepToken.value.trim() && !hasBackend) {
          usedDirect = true;
          if (vStatus) vStatus.textContent = '使用浏览器直连 Replicate 创建任务...';
          const token = vRepToken.value.trim();
          const createUrl = (payload.deployment && payload.deployment.trim())
            ? `https://api.replicate.com/v1/deployments/${encodeURIComponent(payload.deployment.trim())}/predictions`
            : 'https://api.replicate.com/v1/predictions';
          const body = payload.deployment ? { input } : { version: payload.version, input };
          const r = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Authorization': 'Token ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const rj = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error((rj && (rj.detail || rj.error)) || 'Replicate 请求失败');
          jobId = rj.id;
          if (vStatus) vStatus.textContent = '任务已创建，正在生成...';
          // 轮询 Replicate 预测状态
          let result = null;
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 1200));
            const pr = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(jobId)}`, {
              headers: { 'Authorization': 'Token ' + token }
            });
            const pj = await pr.json().catch(() => null);
            if (!pj) break;
            const st = pj.status;
            if (vStatus) vStatus.textContent = `状态：${st}`;
            if (st === 'succeeded' || st === 'failed' || st === 'canceled') {
              result = { status: st === 'succeeded' ? 'succeeded' : 'failed', output: pj.output || null, raw: pj };
              break;
            }
          }
          renderOutput(result);
          if (vStatus && result && result.status === 'succeeded') vStatus.textContent = '生成完成';
          else if (vStatus && result && result.status === 'failed') vStatus.textContent = '生成失败';
        } else {
          const res = await fetch('/api/video/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          let data = null;
          try { data = await res.json(); } catch (_) { data = null; }
          if (res.status === 401 || (data && (data.error === 'Unauthorized' || data.detail === 'Please login first'))) {
            if (vStatus) vStatus.textContent = '后端暂时不可用，请稍后重试或使用 Replicate 直连（开发演示）';
            // 无登录流程
            return;
          }
          if (!res.ok || !data || !data.ok) {
            const msg = (data && (data.error || (data.detail && (data.detail.error || data.detail.detail)))) || '请求失败';
            if (provider === 'replicate' && vRepToken && vRepToken.value.trim()) {
              if (vStatus) vStatus.textContent = '后端不可用或未配置，切换为浏览器直连...';
              const token = vRepToken.value.trim();
              const createUrl = (payload.deployment && payload.deployment.trim())
                ? `https://api.replicate.com/v1/deployments/${encodeURIComponent(payload.deployment.trim())}/predictions`
                : 'https://api.replicate.com/v1/predictions';
              const body = payload.deployment ? { input } : { version: payload.version, input };
              const r = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Authorization': 'Token ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              const rj = await r.json().catch(() => ({}));
              if (!r.ok) throw new Error((rj && (rj.detail || rj.error)) || 'Replicate 请求失败');
              jobId = rj.id;
              if (vStatus) vStatus.textContent = '任务已创建，正在生成...';
              let result = null;
              for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 1200));
                const pr = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(jobId)}`, {
                  headers: { 'Authorization': 'Token ' + token }
                });
                const pj = await pr.json().catch(() => null);
                if (!pj) break;
                const st = pj.status;
                if (vStatus) vStatus.textContent = `状态：${st}`;
                if (st === 'succeeded' || st === 'failed' || st === 'canceled') {
                  result = { status: st === 'succeeded' ? 'succeeded' : 'failed', output: pj.output || null, raw: pj };
                  break;
                }
              }
              renderOutput(result);
              if (vStatus && result && result.status === 'succeeded') vStatus.textContent = '生成完成';
              else if (vStatus && result && result.status === 'failed') vStatus.textContent = '生成失败';
            } else {
              throw new Error(msg);
            }
          } else {
            if (vStatus) vStatus.textContent = '任务已创建，正在生成...';
            const result = await pollJob(provider, data.id, (d) => {
              if (!d) return;
              if (vStatus) vStatus.textContent = `状态：${d.status}`;
            });
            renderOutput(result);
            if (vStatus && result && result.status === 'succeeded') vStatus.textContent = '生成完成';
            else if (vStatus && result && result.status === 'failed') vStatus.textContent = '生成失败';
          }
        }
      } catch (err) {
        if (vStatus) vStatus.textContent = '创建任务失败：' + (err && err.message ? err.message : '');
      } finally {
        if (btn) btn.disabled = false;
        setTimeout(() => { if (vStatus) vStatus.textContent = ''; }, 5000);
      }
    });
  }
})();
