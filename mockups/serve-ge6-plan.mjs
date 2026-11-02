import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const routes = new Map([
  ['/', ['ge6-plan-demo.html', 'text/html; charset=utf-8']],
  ['/ge6-plan-demo.html', ['ge6-plan-demo.html', 'text/html; charset=utf-8']],
  ['/ge6-plan-model.mjs', ['ge6-plan-model.mjs', 'text/javascript; charset=utf-8']],
]);

createServer(async (request, response) => {
  const route = routes.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!route) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    const bytes = await readFile(new URL(`./${route[0]}`, import.meta.url));
    response.writeHead(200, {
      'Content-Type': route[1],
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(bytes);
  } catch {
    response.writeHead(500);
    response.end('Could not load demo');
  }
}).listen(4173, '127.0.0.1', () => {
  console.log('GE6 plan demo: http://127.0.0.1:4173/');
});
