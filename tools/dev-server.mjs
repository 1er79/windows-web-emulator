import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || process.argv[2] || 4173);
const host = process.env.HOST || '127.0.0.1';
const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.zip', 'application/zip'], ['.png', 'image/png'], ['.svg', 'image/svg+xml']
]);

function resolvePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const candidate = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  return candidate;
}

const server = createServer(async (req, res) => {
  const file = resolvePath(req.url || '/');
  if (!file) { res.writeHead(403); res.end('Forbidden'); return; }
  let info;
  try { info = await stat(file); } catch { res.writeHead(404); res.end('Not found'); return; }
  if (!info.isFile()) { res.writeHead(404); res.end('Not found'); return; }

  const headers = {
    'Content-Type': types.get(extname(file)) || 'application/octet-stream',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cache-Control': 'no-cache',
    'Accept-Ranges': 'bytes'
  };
  const range = req.headers.range;
  const match = range && /^bytes=(\d+)-(\d*)$/.exec(range);
  if (match) {
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
    if (!Number.isSafeInteger(start) || start < 0 || start > end || start >= info.size) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }); res.end(); return;
    }
    res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${info.size}` });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': info.size });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Wine Web em http://${host}:${port}/`);
  console.log('Cabeçalhos COOP/COEP ativos; use Chrome ou Edge recentes para os testes iniciais.');
});
