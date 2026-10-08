const COOKIE = 'jev_access';
const MAX_AGE = 12 * 60 * 60;
const encoder = new TextEncoder();
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

function secure(response, login = false) {
  const result = new Response(response.body, response);
  result.headers.set('Cache-Control', 'private, no-store');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  result.headers.set('X-Robots-Tag', 'noindex, nofollow');
  result.headers.set('Content-Security-Policy', login ? "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" : CSP);
  return result;
}
function loginPage(error = '', status = 200) {
  return secure(new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JEV · 团队访问</title><style> *{box-sizing:border-box}body{margin:0;background:#f7f7f7;color:#222;font:14px/1.7 "Microsoft YaHei",sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.entry{width:min(400px,100%)}.brand{color:#cf1736;font-size:22px;font-weight:800}h1{font-size:28px;margin:24px 0 8px}p{color:#717171;font-size:13px}label{display:block;margin-top:32px}input,button{width:100%;min-height:48px;font:inherit;margin-top:8px;padding:12px;border:1px solid #ccc;border-radius:0}button{background:#222;color:#fff;border-color:#222;cursor:pointer;margin-top:16px}.error{color:#b31d35;min-height:24px}:focus-visible{outline:2px solid #cf1736;outline-offset:3px}.foot{border-top:1px solid #ddd;margin-top:32px;padding-top:16px;font-size:11px}</style><main class="entry"><span class="brand">JEV</span><h1>团队工作空间</h1><p>账号池与建联追踪 · 输入访问密码继续</p><form action="/auth/login" method="post"><label for="password">访问密码</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus maxlength="128"><button type="submit">进入工作空间 →</button><p class="error" role="alert">${error}</p></form><p class="foot">本次访问有效期为 12 小时，可随时退出。</p></main></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }), true);
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function fromBase64url(value) {
  const text = value.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(text + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0));
}
async function hmacKey(env) {
  // Changing the password also invalidates previously issued sessions.
  return crypto.subtle.importKey('raw', encoder.encode(env.ACCESS_SESSION_SECRET + ':' + env.ACCESS_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function validSession(request, env) {
  try {
    const token = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!token || token.length > 256) return false;
    const [expires, signature, extra] = token.split('.');
    const now = Math.floor(Date.now() / 1000);
    if (extra || !/^\d+$/.test(expires) || Number(expires) <= now || Number(expires) > now + MAX_AGE) return false;
    return await crypto.subtle.verify('HMAC', await hmacKey(env), fromBase64url(signature), encoder.encode(expires));
  } catch { return false; }
}
function cookie(value, request, age = MAX_AGE) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
async function passwordMatches(value, expected) {
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(expected)));
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.ACCESS_PASSWORD || !env.ACCESS_SESSION_SECRET || env.ACCESS_SESSION_SECRET.length < 32) {
    return secure(new Response('访问验证尚未配置。请配置 ACCESS_PASSWORD 与 ACCESS_SESSION_SECRET。', { status: 503 }));
  }
  if (url.pathname === '/auth/login' || url.pathname === '/auth/logout') {
    if (request.method !== 'POST') return secure(new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } }));
    if (request.headers.get('Origin') !== url.origin) return secure(new Response('Forbidden', { status: 403 }));
    if (url.pathname === '/auth/logout') return secure(new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': cookie('', request, 0) } }));
    const body = await request.text();
    if (body.length > 1024) return loginPage('密码格式不正确。', 400);
    const password = new URLSearchParams(body).get('password') || '';
    if (!await passwordMatches(password, env.ACCESS_PASSWORD)) return loginPage('密码不正确，请重试。', 401);
    const expires = String(Math.floor(Date.now() / 1000) + MAX_AGE);
    const signature = base64url(await crypto.subtle.sign('HMAC', await hmacKey(env), encoder.encode(expires)));
    return secure(new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': cookie(expires + '.' + signature, request) } }));
  }
  if (!await validSession(request, env)) {
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return loginPage();
    return secure(new Response('请先登录。', { status: 401 }));
  }
  if (!['GET', 'HEAD'].includes(request.method)) return secure(new Response('Method not allowed', { status: 405 }));
  return secure(await context.next());
}
