(() => {
  const KEY = 'turing-visitor-id';
  const ARRIVAL = 'turing-visitor-arrival';
  const read = key => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { sessionStorage.setItem(key, value); } catch {} };
  const remove = key => { try { sessionStorage.removeItem(key); } catch {} };
  const newIdentity = () => '访客 ' + (261001 + crypto.getRandomValues(new Uint32Array(1))[0] % 99);
  const validIdentity = value => /^访客 2610(?:0[1-9]|[1-9]\d)$/.test(value || '');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const arrivedAt = Number(read(ARRIVAL));
  const isArriving = arrivedAt && Date.now() - arrivedAt >= 0 && Date.now() - arrivedAt < 15000;
  // Run in the dashboard head so the welcome glass is present before its first paint.
  if (isArriving) document.documentElement.classList.add('visitor-entering');

  const init = () => {
  const form = document.getElementById('accessForm');
  if (form) {
    const button = document.getElementById('accessSubmit');
    const label = document.getElementById('accessSubmitLabel');
    const password = document.getElementById('password');
    const error = document.getElementById('accessError');
    password.addEventListener('input', () => { error.textContent = ''; password.removeAttribute('aria-invalid'); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (button.disabled) return;
      error.textContent = '';
      password.removeAttribute('aria-invalid');
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      document.body.classList.add('is-checking');
      label.textContent = '正在进入';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(form.action, {
          method: 'POST', credentials: 'same-origin', signal: controller.signal,
          headers: {Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'},
          body: new URLSearchParams(new FormData(form))
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.ok !== true) {
          if (response.status === 401) password.setAttribute('aria-invalid', 'true');
          throw new Error(result?.error || (response.status === 503 ? '访问服务尚未就绪，请稍后再试。' : '暂时无法进入，请重试。'));
        }
        clearTimeout(timeout);
        write(KEY, newIdentity());
        document.body.classList.remove('is-checking');
        document.body.classList.add('is-arriving');
        const arrival = document.getElementById('accessArrival');
        arrival.hidden = false;
        form.inert = true;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.body.classList.add('is-settling');
        // Only a brief glass fade here. The welcome plays once, on the loaded dashboard.
        await wait(reduced ? 0 : 260);
        write(ARRIVAL, String(Date.now()));
        // A same-URL hash navigation would keep the login document on screen.
        if (location.pathname === '/' || location.pathname === '/index.html') location.reload();
        else location.replace('/' + location.hash);
      } catch (failure) {
        error.textContent = failure.name === 'AbortError' ? '连接超时，请重新进入。' : failure instanceof TypeError ? '网络连接失败，请检查网络后重试。' : failure.message;
        password.focus();
        label.textContent = '确认进入';
        button.disabled = false;
        document.body.classList.remove('is-checking');
      } finally {
        clearTimeout(timeout);
        form.removeAttribute('aria-busy');
      }
    });
  }

  const badge = document.getElementById('visitorBadge');
  if (badge) {
    let identity = read(KEY);
    if (!validIdentity(identity)) { identity = newIdentity(); write(KEY, identity); }
    const tooltip = document.getElementById('visitorIdentity');
    tooltip.textContent = identity;
    const account = badge.closest('.visitor-account');
    const show = () => account.classList.add('is-open');
    const hide = () => account.classList.remove('is-open');
    account.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') show(); });
    account.addEventListener('pointerleave', () => { if (document.activeElement !== badge) hide(); });
    badge.addEventListener('focus', show);
    badge.addEventListener('blur', hide);
    badge.addEventListener('click', show);
    badge.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
    document.addEventListener('pointerdown', event => { if (!account.contains(event.target)) hide(); });
    remove(ARRIVAL);
    if (isArriving) {
      const glass = document.getElementById('visitorArrival');
      const dashboard = [...document.querySelectorAll('body > .topline, body > main')];
      if (glass) {
        glass.hidden = false;
        dashboard.forEach(element => { element.inert = true; });
        const reveal = async () => {
          const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
          await Promise.race([document.fonts.ready, wait(700)]);
          document.documentElement.classList.add('visitor-welcoming');
          await wait(reduced ? 250 : 900);
          document.documentElement.classList.add('visitor-revealing');
          await wait(reduced ? 0 : 950);
          glass.hidden = true;
          document.documentElement.classList.remove('visitor-entering', 'visitor-welcoming', 'visitor-revealing');
          dashboard.forEach(element => { element.inert = false; });
        };
        reveal();
      } else document.documentElement.classList.remove('visitor-entering');
    }
  }
  document.querySelector('form[action="/auth/logout"]')?.addEventListener('submit', () => { remove(KEY); remove(ARRIVAL); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
