import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequest } from '../functions/_middleware.js';

const root = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const config = await fs.readFile(new URL('../.dev.vars', import.meta.url), 'utf8').catch(() => '');
const env = Object.fromEntries(config.split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
for (const key of ['ACCESS_PASSWORD', 'ACCESS_SESSION_SECRET']) if (process.env[key]) env[key] = process.env[key];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 4096) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
    const request = new Request(`http://127.0.0.1:${server.address().port}${req.url}`, { method: req.method, headers: req.headers, ...(['GET','HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
    const response = await onRequest({ request, env, next: async () => {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!target.startsWith(root + path.sep) || path.basename(target).startsWith('_')) return new Response('Not found', { status: 404 });
      const body = await fs.readFile(target).catch(() => null);
      return body ? new Response(req.method === 'HEAD' ? null : body, { headers: { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' } }) : new Response('Not found', { status: 404 });
    } });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Local preview error'); }
});
server.listen(Number(process.env.PORT || 8765), '127.0.0.1', () => console.log(`Authenticated preview: http://127.0.0.1:${server.address().port}`));
