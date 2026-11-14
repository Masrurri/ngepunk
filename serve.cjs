// Minimal static server: node serve.cjs  →  http://localhost:5177
const http = require('http'), fs = require('fs'), path = require('path'), root = path.join(__dirname, 'public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' };
http.createServer((req, res) => {
  const file = path.join(root, path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([\\/]\.\.)+/, '') || '/');
  const f = file.endsWith(path.sep) ? path.join(file, 'index.html') : file;
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(5177, () => console.log('ngepunk on http://localhost:5177'));
