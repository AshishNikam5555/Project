#!/usr/bin/env node
// Tiny static file server for local development. No dependencies; works on Windows, macOS and Linux.
// Usage: npm run dev   (or: node tools/serve.js [port])
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};
const BLOCKED = /^\/(node_modules|supabase|tools|tests|\.git)(\/|$)/;

http
  .createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT + path.sep) || BLOCKED.test(urlPath.replace(/\\/g, '/'))) {
      res.writeHead(404).end('Not found');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        fs.readFile(path.join(ROOT, '404.html'), (e2, page) => {
          res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(e2 ? 'Not found' : page);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  })
  .on('error', e => {
    if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is busy. Close the other server or run: npm run dev -- 8081`);
    else console.error(e.message);
    process.exit(1);
  })
  .listen(PORT, () => {
    console.log(`\n  Kadam booking demo running:\n`);
    console.log(`  Patient site   http://localhost:${PORT}/`);
    console.log(`  Staff login    http://localhost:${PORT}/admin/login.html`);
    console.log(`  QR poster      http://localhost:${PORT}/poster.html\n`);
    console.log('  Press Ctrl+C to stop.\n');
  });
