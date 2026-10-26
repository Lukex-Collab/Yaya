const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
// Reuse only explicitly named repository assets; never expose the parent tree.
const repositoryRoot = path.resolve(root, '..');
const sharedAssets = new Map([
  ['/app/yaya-bg.png', 'yaya-bg.png'],
  ['/app/models/yaya.glb', 'assets/pets/yaya.glb'],
  ['/assets/videos/yaya-bored.mp4', 'yaya-bored.mp4'],
  ['/assets/videos/yaya-headpat.mp4', 'yaya-headpat.mp4'],
  ['/assets/videos/yaya-tickle.mp4', 'yaya-tickle.mp4'],
]);
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (pathname === '/') {
    res.writeHead(302, { Location: '/app/' }).end();
    return;
  }
  const relative = pathname.replace(/^\/+/, '');
  const sharedAsset = sharedAssets.get(pathname);
  const file = sharedAsset
    ? path.resolve(repositoryRoot, sharedAsset)
    : path.resolve(root, relative);

  if (!sharedAsset && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(file, (statError, stats) => {
    const target = !statError && stats.isDirectory() ? path.join(file, 'index.html') : file;
    fs.readFile(target, (error, body) => {
      if (error) {
        res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    });
  });
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Waki Online: http://127.0.0.1:${server.address().port}`);
});
