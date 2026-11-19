import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.startsWith('/api/') || path.startsWith('/auth/')) { res.writeHead(404); res.end(); return; }
    if(path.startsWith('/legal/')){const slug=path.slice(7);if(!['termos-de-uso','politica-de-privacidade','politica-de-cookies','acessibilidade','seguranca'].includes(slug))throw new Error('Invalid document');const body=await readFile(fileURLToPath(new URL('../legal/'+slug+'.md',import.meta.url)));res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(body);return;}
    if(path==='/invite'){res.writeHead(409,{'Content-Type':'text/plain; charset=utf-8'});res.end('Convite não configurado na demonstração.');return;}
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(resolve(root) + sep)) throw new Error('Invalid path');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Não encontrado'); }
});
server.listen(Number(process.env.PORT || 3040), '127.0.0.1', () => console.log('Kage demo: http://127.0.0.1:' + server.address().port));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
