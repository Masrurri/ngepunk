// Minimal static server: node serve.js  →  http://localhost:5177
const http = require('http'), fs = require('fs'), path = require('path');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' };
http.createServer((req, res) => {
  const file = path.join(__dirname, path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([\\/]\.\.)+/, '') || '/');
  const f = file.endsWith(path.sep) ? path.join(file, 'index.html') : file;
  if (!f.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(5177, () => console.log('ngepunk on http://localhost:5177'));
