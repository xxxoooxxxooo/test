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

  // 注册
  const registerForm = $('#register-form');
  const registerStatus = $('#register-status');
  const registerEmail = $('#register-email');
  const registerPassword = $('#register-password');

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = registerEmail ? registerEmail.value.trim() : '';
      const password = registerPassword ? registerPassword.value : '';
      if (!email || !password) {
        if (registerStatus) registerStatus.textContent = '请输入邮箱和密码';
        return;
      }
      if (password.length < 6) {
        if (registerStatus) registerStatus.textContent = '密码至少 6 位';
        return;
      }
      const btn = registerForm.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      if (registerStatus) registerStatus.textContent = '正在注册...';
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'same-origin',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error((data && data.error) || '注册失败');
        authUser = data.user || { email };
        if (registerStatus) registerStatus.textContent = '注册成功，已登录';
        refreshAuthUI();
        location.hash = '#video';
      } catch (err) {
        if (registerStatus) registerStatus.textContent = '注册失败：' + (err && err.message ? err.message : '');
      } finally {
        if (btn) btn.disabled = false;
        setTimeout(() => { if (registerStatus) registerStatus.textContent = ''; }, 4000);
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

  // 通用：加载供应商到指定下拉框
  async function loadProvidersInto(selectEl) {
    if (!selectEl) return;
    try {
      const res = await fetch('/api/video/providers');
      const data = await res.json();
      hasBackend = true;
      const list = (data && data.providers) || [];
      selectEl.innerHTML = '';
      if (!list.length) {
        const opt = document.createElement('option');
        opt.value = 'mock';
        opt.textContent = 'Mock Provider (演示)';
        selectEl.appendChild(opt);
        return;
      }
      for (const p of list) {
        const opt = document.createElement('option');
        opt.value = p.key;
        opt.textContent = `${p.name}${p.auth === 'missing' ? '（未配置）' : ''}`;
        selectEl.appendChild(opt);
      }
    } catch (e) {
      hasBackend = false;
      selectEl.innerHTML = '';
      const optR = document.createElement('option');
      optR.value = 'replicate';
      optR.textContent = 'Replicate（直连开发模式）';
      selectEl.appendChild(optR);
      const opt = document.createElement('option');
      opt.value = 'mock';
      opt.textContent = 'Mock Provider (演示)';
      selectEl.appendChild(opt);
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
            if (vStatus) vStatus.textContent = '请先登录后再使用在线生成接口';
            location.hash = '#login';
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

  // Studio（工作室）：本地项目 + 分镜 + 批量渲染（演示）
  const sForm = $('#studio-form');
  const sProvider = $('#studio-provider');
  const sName = $('#studio-name');
  const sAspect = $('#studio-aspect');
  const sStyle = $('#studio-style');
  const sScript = $('#studio-script');
  const sSplit = $('#studio-split');
  const sAddScene = $('#studio-add-scene');
  const sScenes = $('#studio-scenes');
  const sStatus = $('#studio-status');
  const sRenderBtn = $('#studio-render');
  const sRenderStatus = $('#studio-render-status');
  const sOutput = $('#studio-output');
  const projectsList = $('#projects-list');

  let currentProjectId = null;
  let scenesData = [];

  function saveProjects(arr) {
    try { localStorage.setItem('of_video_projects', JSON.stringify(arr || [])); } catch (_) {}
  }
  function loadProjects() {
    try {
      const raw = localStorage.getItem('of_video_projects') || '[]';
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function renderScenesList() {
    if (!sScenes) return;
    sScenes.innerHTML = '';
    if (!scenesData.length) {
      const d = document.createElement('div');
      d.className = 'muted';
      d.textContent = '分镜将在此列出。';
      sScenes.appendChild(d);
      return;
    }
    const ul = document.createElement('div');
    ul.style.display = 'grid';
    ul.style.gap = '10px';
    scenesData.forEach((sc, idx) => {
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto';
      row.style.gap = '8px';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = sc.text || '';
      inp.placeholder = `分镜 ${idx + 1} 文案...`;
      inp.oninput = () => { sc.text = inp.value; };
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost';
      del.textContent = '删除';
      del.onclick = () => {
        scenesData = scenesData.filter(s => s !== sc);
        renderScenesList();
      };
      row.appendChild(inp);
      row.appendChild(del);
      ul.appendChild(row);
    });
    sScenes.appendChild(ul);
  }

  function renderProjectsList() {
    if (!projectsList) return;
    const items = loadProjects();
    projectsList.innerHTML = '';
    if (!items.length) { projectsList.textContent = '暂无'; return; }
    const ul = document.createElement('ul');
    ul.style.margin = '8px 0 0';
    ul.style.paddingLeft = '18px';
    items.forEach((p) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = p.name || '(未命名)';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'btn btn-outline';
      open.style.marginLeft = '8px';
      open.textContent = '打开';
      open.onclick = () => {
        currentProjectId = p.id;
        if (sName) sName.value = p.name || '';
        if (sAspect) sAspect.value = p.aspect || '16:9';
        if (sStyle) sStyle.value = p.style || '';
        scenesData = Array.isArray(p.scenes) ? p.scenes.map(s => ({ id: s.id || Math.random().toString(36).slice(2), text: s.text || '' })) : [];
        renderScenesList();
        location.hash = '#studio';
      };
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost';
      del.style.marginLeft = '6px';
      del.textContent = '删除';
      del.onclick = () => {
        const arr = loadProjects().filter(x => x.id !== p.id);
        saveProjects(arr);
        renderProjectsList();
      };
      li.appendChild(name);
      li.appendChild(open);
      li.appendChild(del);
      ul.appendChild(li);
    });
    projectsList.appendChild(ul);
  }

  if (sForm) {
    loadProvidersInto(sProvider);
    renderProjectsList();

    sSplit && sSplit.addEventListener('click', () => {
      const lines = (sScript && sScript.value ? sScript.value.split(/\r?\n/) : []).map(s => s.trim()).filter(Boolean);
      const newScenes = lines.map(t => ({ id: Math.random().toString(36).slice(2), text: t }));
      scenesData = scenesData.concat(newScenes);
      renderScenesList();
    });

    sAddScene && sAddScene.addEventListener('click', () => {
      scenesData.push({ id: Math.random().toString(36).slice(2), text: '' });
      renderScenesList();
    });

    sForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = sName ? sName.value.trim() : '';
      if (!name) {
        if (sStatus) sStatus.textContent = '请填写项目名称';
        return;
      }
      const project = {
        id: currentProjectId || ('p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
        name,
        aspect: sAspect ? sAspect.value : '16:9',
        style: sStyle ? sStyle.value.trim() : '',
        scenes: scenesData.map(s => ({ id: s.id, text: s.text || '' })),
        updated_at: new Date().toISOString(),
      };
      const all = loadProjects();
      const idx = all.findIndex(x => x.id === project.id);
      if (idx >= 0) all[idx] = project; else all.push(project);
      saveProjects(all);
      currentProjectId = project.id;
      if (sStatus) sStatus.textContent = '已保存';
      renderProjectsList();
      setTimeout(() => { if (sStatus) sStatus.textContent = ''; }, 2000);
    });

    sRenderBtn && sRenderBtn.addEventListener('click', async () => {
      if (!sProvider || !sOutput) return;
      const provider = sProvider.value || 'mock';
      if (!scenesData.length) { if (sRenderStatus) sRenderStatus.textContent = '请先添加分镜'; return; }
      sOutput.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.display = 'grid';
      wrap.style.gap = '12px';
      sOutput.appendChild(wrap);
      if (sRenderStatus) sRenderStatus.textContent = '开始渲染...';
      for (let i = 0; i < scenesData.length; i++) {
        const sc = scenesData[i];
        const card = document.createElement('div');
        card.className = 'card';
        const title = document.createElement('div');
        title.textContent = `分镜 ${i + 1}`;
        title.style.fontWeight = '600';
        title.style.marginBottom = '6px';
        const status = document.createElement('div');
        status.className = 'muted';
        status.textContent = '创建任务...';
        const resultBox = document.createElement('div');
        card.appendChild(title);
        card.appendChild(status);
        card.appendChild(resultBox);
        wrap.appendChild(card);
        try {
          const prompt = `${(sStyle && sStyle.value ? sStyle.value + '风格，' : '')}${sc.text || ''}`.trim();
          const payload = provider === 'replicate'
            ? { provider, input: { prompt, aspect_ratio: sAspect ? sAspect.value : '16:9' } }
            : { provider, prompt, options: { aspect_ratio: sAspect ? sAspect.value : '16:9' } };
          const res = await fetch('/api/video/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (res.status === 401) {
            status.textContent = '未登录：请先登录后再渲染';
            location.hash = '#login';
            break;
          }
          if (!res.ok || !data || !data.ok) {
            status.textContent = '创建任务失败';
            const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.textContent = JSON.stringify(data, null, 2);
            resultBox.appendChild(pre);
            continue;
          }
          status.textContent = '生成中...';
          const result = await pollJob(provider, data.id, (d) => { status.textContent = `状态：${d.status}`; });
          if (!result) { status.textContent = '超时或失败'; continue; }
          if (result.status === 'failed') { status.textContent = '失败'; const pre = document.createElement('pre'); pre.textContent = JSON.stringify(result, null, 2); resultBox.appendChild(pre); continue; }
          status.textContent = '完成';
          const out = result.output || (result.raw && result.raw.output) || null;
          if (out && typeof out === 'string' && /https?:\/\//.test(out) && /(mp4|webm)(\?|$)/.test(out)) {
            const video = document.createElement('video'); video.controls = true; video.src = out; video.style.maxWidth = '100%'; resultBox.appendChild(video);
          } else if (Array.isArray(out)) {
            const firstUrl = out.find(u => typeof u === 'string' && /(mp4|webm)(\?|$)/.test(u));
            if (firstUrl) { const video = document.createElement('video'); video.controls = true; video.src = firstUrl; video.style.maxWidth = '100%'; resultBox.appendChild(video); }
            else { const pre = document.createElement('pre'); pre.textContent = JSON.stringify(result, null, 2); resultBox.appendChild(pre); }
          } else {
            const pre = document.createElement('pre'); pre.textContent = JSON.stringify(result, null, 2); resultBox.appendChild(pre);
          }
        } catch (err) {
          status.textContent = '错误：' + (err && err.message ? err.message : '');
        }
      }
      if (sRenderStatus) sRenderStatus.textContent = '渲染完成';
      setTimeout(() => { if (sRenderStatus) sRenderStatus.textContent = ''; }, 4000);
    });
  }

  // 管理后台数据加载
  const adminContacts = document.querySelector('#admin-contacts');
  const adminJobs = document.querySelector('#admin-jobs');
  const adminProviders = document.querySelector('#admin-providers');
  const adminUsers = document.querySelector('#admin-users');

  function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

  async function loadAdminData() {
    // Providers (public)
    if (adminProviders) {
      try {
        const r = await fetch('/api/video/providers');
        const j = await r.json().catch(() => ({}));
        const list = (j && j.providers) || [];
        if (!list.length) adminProviders.textContent = '无可用供应商';
        else {
          const ul = document.createElement('ul');
          ul.style.margin = '8px 0 0';
          ul.style.paddingLeft = '18px';
          for (const p of list) {
            const li = document.createElement('li');
            li.innerHTML = esc(p.name || p.key) + ' — ' + (p.auth === 'missing' ? '未配置' : '可用');
            ul.appendChild(li);
          }
          adminProviders.innerHTML = '';
          adminProviders.appendChild(ul);
        }
      } catch (_) { adminProviders.textContent = '加载失败'; }
    }

    // Contacts (auth required)
    if (adminContacts) {
      adminContacts.textContent = '加载中...';
      try {
        const r = await fetch('/api/contact');
        const j = await r.json().catch(() => ({}));
        if (r.status === 401) { adminContacts.textContent = '请先登录'; }
        else if (!r.ok || !j || !j.ok) { adminContacts.textContent = '加载失败'; }
        else {
          const items = Array.isArray(j.items) ? j.items.slice(-10).reverse() : [];
          if (!items.length) adminContacts.textContent = '暂无数据';
          else {
            const ul = document.createElement('ul');
            ul.style.margin = '8px 0 0';
            ul.style.paddingLeft = '18px';
            for (const it of items) {
              const li = document.createElement('li');
              li.innerHTML = esc(it.name) + ' <span class="muted">(' + esc(it.email) + ')</span> — ' + esc(it.message);
              ul.appendChild(li);
            }
            adminContacts.innerHTML = '';
            adminContacts.appendChild(ul);
          }
        }
      } catch (_) { adminContacts.textContent = '加载失败'; }
    }

    // Jobs (auth required)
    if (adminJobs) {
      adminJobs.textContent = '加载中...';
      try {
        const r = await fetch('/api/video/jobs');
        const j = await r.json().catch(() => ({}));
        if (r.status === 401) { adminJobs.textContent = '请先登录'; }
        else if (!r.ok || !j || !j.ok) { adminJobs.textContent = '加载失败'; }
        else {
          const items = Array.isArray(j.jobs) ? j.jobs.slice(-10).reverse() : [];
          if (!items.length) adminJobs.textContent = '暂无数据';
          else {
            const ul = document.createElement('ul');
            ul.style.margin = '8px 0 0';
            ul.style.paddingLeft = '18px';
            for (const it of items) {
              const li = document.createElement('li');
              li.textContent = (it.id || '') + ' — ' + (it.status || '');
              ul.appendChild(li);
            }
            adminJobs.innerHTML = '';
            adminJobs.appendChild(ul);
          }
        }
      } catch (_) { adminJobs.textContent = '加载失败'; }
    }

    // Users (auth required)
    if (adminUsers) {
      adminUsers.textContent = '加载中...';
      try {
        const r = await fetch('/api/users');
        const j = await r.json().catch(() => ({}));
        if (r.status === 401) { adminUsers.textContent = '请先登录'; }
        else if (!r.ok || !j || !j.ok) { adminUsers.textContent = '加载失败'; }
        else {
          const items = Array.isArray(j.items) ? j.items : [];
          if (!items.length) adminUsers.textContent = '暂无用户';
          else {
            const ul = document.createElement('ul');
            ul.style.margin = '8px 0 0';
            ul.style.paddingLeft = '18px';
            for (const it of items) {
              const li = document.createElement('li');
              li.innerHTML = esc(it.email) + (it.default ? ' <span class="muted">(默认账号)</span>' : '') + (it.created_at ? ' — <span class="muted">' + esc(it.created_at) + '</span>' : '');
              ul.appendChild(li);
            }
            adminUsers.innerHTML = '';
            adminUsers.appendChild(ul);
          }
        }
      } catch (_) { adminUsers.textContent = '加载失败'; }
    }
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === '#admin') loadAdminData();
  });
  if (location.hash === '#admin') loadAdminData();

})();
