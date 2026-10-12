const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function accessPage(error = '') {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#f5f6f8">
  <title>图灵看板 · 访客登录</title>
  <link rel="stylesheet" href="/assets/access.css">
  <script src="/assets/access.js" defer></script>
</head>
<body class="access-page">
  <div class="access-atmosphere" aria-hidden="true"><div class="access-orbit orbit-one"></div><div class="access-orbit orbit-two"></div><div class="access-horizon"></div></div>
  <header class="access-header"><a class="access-wordmark" href="/" aria-label="图灵看板首页"><span class="access-brand-image"><img src="/assets/brand/turingtouch-logo.png" width="5942" height="1736" alt="TuringTouch" fetchpriority="high"></span></a><span class="access-header-note"><i></i>访客访问</span></header>
  <main class="access-main">
    <section class="access-card" aria-labelledby="access-title">
      <div class="access-card-heading"><span class="access-eyebrow">WELCOME TO TURING</span><h1 id="access-title">图灵看板</h1><p>每一次连接，从这里开始。</p></div>
      <form id="accessForm" action="/auth/login" method="post">
        <label class="access-label" for="account">账号</label>
        <div class="access-field access-account-field"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.25"/><path d="M5.5 20v-2a6.5 6.5 0 0 1 13 0v2"/></svg><input id="account" name="account" value="访客" readonly autocomplete="username"><span class="access-field-tag">GUEST</span></div>
        <label class="access-label" for="password">访问密码</label>
        <div class="access-field"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5.5" y="10" width="13" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></svg><input id="password" name="password" type="password" placeholder="1105" autocomplete="current-password" required maxlength="128" aria-describedby="accessHint accessError"></div>
        <p class="access-hint" id="accessHint">输入上方提示密码，即可以访客身份进入。</p>
        <p class="access-error" id="accessError" role="alert">${escape(error)}</p>
        <button class="access-submit" id="accessSubmit" type="submit"><span id="accessSubmitLabel">确认进入</span><span class="access-spinner" aria-hidden="true"></span></button>
      </form>
      <div class="access-card-foot"><span class="access-foot-line"></span><span>以访客之名，发现更多可能</span><span class="access-foot-line"></span></div>
    </section>
  </main>
  <footer class="access-footer"><span>CONNECT. DISCOVER. COLLABORATE.</span><span>图灵看板 · 访客空间</span></footer>
  <section class="access-arrival" id="accessArrival" aria-labelledby="arrivalTitle" hidden>
    <div class="arrival-light" aria-hidden="true"></div><div class="arrival-lens" aria-hidden="true"></div>
    <div class="arrival-message" role="status" tabindex="-1"><span class="access-eyebrow">WELCOME TO TURING</span><h2 id="arrivalTitle">欢迎进入图灵看板</h2><p>访客权限已开通</p><span class="arrival-rule" aria-hidden="true"></span></div>
  </section>
</body></html>`;
}
