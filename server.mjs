import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { handle } from './api.mjs';

const dist = resolve('dist');
const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml'};
const server = createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const reply = (status, payload) => {
    res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(payload));
  };
  try {
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'POST' && !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
        reply(415, {error:'Send application/json.'});
        return;
      }
      const data = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65_536) { reply(413,{error:'Request too large'}); return; }
        data.push(chunk);
      }
      let body = {};
      if (size) {
        try { body = JSON.parse(Buffer.concat(data)); }
        catch { reply(400,{error:'Invalid JSON'}); return; }
        if (!body || Array.isArray(body) || typeof body !== 'object') { reply(400,{error:'Expected a JSON object'}); return; }
      }
      const [status, payload] = await handle(req, url.pathname, body);
      reply(status, payload);
      return;
    }
    const file = resolve(dist, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(dist + sep)) { reply(404,{error:'Not found'}); return; }
    const bytes = await readFile(file);
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream'});
    res.end(bytes);
  } catch(error) {
    if (error.code === 'ENOENT') { reply(404,{error:'Page not found. Run npm run build first.'}); return; }
    console.error(error.name, error.code || '');
    reply(500,{error:'The local server could not complete this request.'});
  }
});
server.listen(Number(process.env.PORT || 8080),process.env.HOST || '127.0.0.1',() => console.log('Listening on',server.address()));
