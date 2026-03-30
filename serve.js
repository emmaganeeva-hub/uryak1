const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  let filePath = path.join(dir, reqPath === '/' ? 'index.html' : reqPath);

  // Resolve symlinks to get the real path
  let realPath;
  try {
    realPath = fs.realpathSync(filePath);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found: ' + reqPath);
    return;
  }

  const ext = path.extname(realPath).toLowerCase();
  const ct = mime[ext] || 'application/octet-stream';

  let stat;
  try {
    stat = fs.statSync(realPath);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  console.log(`Serving ${realPath} (${Math.round(stat.size/1024)}KB)`);

  res.writeHead(200, {
    'Content-Type': ct,
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
  });

  const stream = fs.createReadStream(realPath);
  stream.on('error', (err) => {
    console.error('Stream error:', err.message);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Internal error');
    }
  });
  stream.pipe(res);
}).listen(7891, () => console.log('Serving on http://localhost:7891'));
