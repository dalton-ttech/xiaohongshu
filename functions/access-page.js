const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function accessPage(error = '') {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#f8f7f4">
  <title>图灵看板 · 访客登录</title>
  <link rel="stylesheet" href="/assets/access.css">
  <link rel="stylesheet" href="/assets/access-b1.css">
  <script src="/assets/access.js" defer></script>
  <script src="/assets/access-ascii.js" defer></script>
</head>
<body class="access-page access-b1">
  <div class="page">
    <header class="header">
      <a class="brand" href="/" aria-label="图灵看板首页"><span class="brand-frame"><img src="/assets/brand/turingtouch-logo.png" fetchpriority="high" width="5942" height="1736" alt="TuringTouch"></span></a>
      <div class="edition"><span class="edition-label">VISITOR SPACE</span><span class="edition-code">[ UI-B1 ]</span></div>
    </header>

    <main class="entry" id="entry">
      <section class="intro" aria-labelledby="title">
        <div class="eyebrow"><span class="cross">+</span> IDEAS BECOME CONNECTIONS</div>
        <h1 id="title">图灵看板<span>连接，从此刻开始。</span></h1>
        <figure class="character-scene">
          <div class="scene-top"><span>FIG. 01 / THE CONNECTION</span><button id="motionToggle" type="button" aria-pressed="false" aria-label="暂停字符动画">[ 暂停 ]</button></div>
          <div class="ascii-viewport"><pre id="asciiArt" aria-hidden="true"></pre></div>
          <figcaption><span>让好的想法，被更多人看见。</span><span class="scene-coordinate" aria-hidden="true">x / y / z</span></figcaption>
        </figure>
      </section>

      <section class="access-panel" aria-labelledby="loginTitle">
        <span class="corner top-left" aria-hidden="true">+</span><span class="corner top-right" aria-hidden="true">+</span><span class="corner bottom-left" aria-hidden="true">+</span><span class="corner bottom-right" aria-hidden="true">+</span>
        <div class="panel-kicker">[ VISITOR ACCESS ]</div>
        <h2 id="loginTitle">访客登录</h2>
        <p class="panel-description">以访客身份，发现更多可能。</p>
        <form id="accessForm" action="/auth/login" method="post">
          <label class="field-label" for="account"><span>账号</span><span>01 / ACCOUNT</span></label>
          <div class="field account-field"><input id="account" name="account" value="访客" readonly autocomplete="username"><span>GUEST</span></div>
          <label class="field-label" for="password"><span>访问密码</span><span>02 / PASSWORD</span></label>
          <div class="field"><input id="password" name="password" type="password" placeholder="1105" required autocomplete="current-password" maxlength="128" aria-describedby="accessHint accessError"></div>
          <p class="hint" id="accessHint">输入提示密码，即可以访客身份进入。</p>
          <p class="error" id="accessError" role="alert">${escape(error)}</p>
          <button class="enter-button" id="accessSubmit" type="submit"><span id="accessSubmitLabel">确认进入</span><span class="access-spinner" aria-hidden="true"></span></button>
        </form>
        <div class="panel-foot"><span>[+] 访客通道</span><span>READY</span></div>
      </section>
    </main>

    <footer class="footer"><span>TURINGTOUCH / PEOPLE. IDEAS. CONNECTIONS.</span><span>ASCII EDITION <span class="footer-divider">/</span> 图灵看板 · 访客空间</span></footer>
  </div>

  <section class="access-arrival" id="accessArrival" aria-hidden="true" hidden>
    <div class="arrival-light" aria-hidden="true"></div><div class="arrival-lens" aria-hidden="true"></div>
  </section>
</body>
</html>`;
}
