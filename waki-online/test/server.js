const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

async function run() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = new Promise(resolve => child.once('exit', resolve));
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      let output = '';
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', () => { clearTimeout(timeout); reject(new Error('Server exited')); });
      child.stdout.on('data', data => {
        output += data;
        const match = output.match(/127\.0\.0\.1:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
    });
    function request(url) {
      return new Promise((resolve, reject) => {
        http.get({ hostname: '127.0.0.1', port, path: url }, response => {
          let bytes = 0;
          response.on('data', chunk => { bytes += chunk.length; });
          response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes }));
          response.on('error', reject);
        }).on('error', reject);
      });
    }
    assert.equal((await request('/')).headers.location, '/app/');
    assert.equal((await request('/app/')).status, 200);
    for (const [url, relative, type] of [
      ['/app/yaya-bg.png', 'yaya-bg.png', 'image/png'],
      ['/app/models/yaya.glb', 'assets/pets/yaya.glb', 'model/gltf-binary'],
      ...['bored', 'headpat', 'tickle'].map(name => [
        `/assets/videos/yaya-${name}.mp4`, `yaya-${name}.mp4`, 'video/mp4',
      ]),
    ]) {
      const result = await request(url);
      assert.equal(result.status, 200, url);
      assert.equal(result.headers['content-type'], type, url);
      assert.equal(result.bytes, fs.statSync(path.join(__dirname, '..', '..', relative)).size, url);
    }
    assert.equal((await request('/%2e%2e%2f.git/config')).status, 403);
    assert.equal((await request('/%E0%A4%A')).status, 400);
    assert.equal((await request('/missing-file')).status, 404);
    assert.equal((await request('/app/')).status, 200);
    console.log('Waki server checks passed: routes, shared assets, traversal and malformed URLs');
  } finally {
    child.kill();
    await exited;
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
