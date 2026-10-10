const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const files = new Set(['index.html', 'styles.css', 'core.js', 'app.js', 'favicon.svg']);
const port = Number(process.env.PORT) || 4173;
http.createServer((req,res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html'; }
  catch {res.writeHead(400);res.end('Bad request');return;}
  if (!files.has(requested)) {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(root, requested), (err,data) => {
    if (err) {res.writeHead(500);res.end('Could not read file');return;}
    res.writeHead(200, {'Content-Type':types[path.extname(requested)],'Cache-Control':'no-store'});res.end(data);
  });
}).listen(port,'127.0.0.1', () => console.log(`Tracklist is running at http://127.0.0.1:${port}`));
