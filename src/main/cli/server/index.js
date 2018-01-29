/*
 * MIT License
 *
 * Copyright (c) 2017 Uber Node.js
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// @flow

import getPort from 'get-port';
import {UI_BASE_URI} from '../../util';
import {setupEndpoints, setupWebSockets} from './endpoints';
import proxy from 'http-proxy-middleware';
import express from 'express';
import modifyResponse from 'http-proxy-response-rewrite';
import path from 'path';

const shouldProxy = (pathname, req) => !pathname.match(/\/_ottr.*/);

const TESTS_PREFIX = '/_ottr/tests';

function setupProxy(app, target, ottrPort) {
  app.use(
    '/',
    proxy(shouldProxy, {
      target,
      logLevel: 'warn',
      changeOrigin: true,
      onProxyRes(proxyRes: express$Request, req: express$Request, res: express$Response) {
        const contentType = proxyRes.headers['content-type'];
        const hostAndPort: string = req.get('host') || `localhost:${ottrPort}`;
        const csp = `default-src 'self' 'unsafe-inline' 'unsafe-eval' ws://${hostAndPort}`;
        proxyRes.headers['content-security-policy'] = csp;
        if (contentType && contentType.match(/.*text\/html.*/i)) {
          const originalLength = proxyRes.headers['content-length'];
          const scriptTag = `<script src='${TESTS_PREFIX}/.ottr-webpack/tests-bundle.js'></script>`;
          if (originalLength) {
            proxyRes.headers['content-length'] = Number(originalLength) + scriptTag.length;
          }

          modifyResponse(res, proxyRes.headers['content-encoding'], body =>
            body.toString().replace(/(<head[^>]*>)|$/, `$1${scriptTag}`)
          );
        }
      }
    })
  );
}

export async function startOttrServer(targetUrl: string) {
  const app = express();

  // Serve the static files (images, etc)
  app.use(UI_BASE_URI, express.static(path.resolve(__dirname, '../../static')));

  // We use React Router, so we need to route all 404's to index.html
  app.use(`${UI_BASE_URI}/*`, (req: express$Request, res: express$Response) =>
    res.sendFile(path.resolve(__dirname, '../../static/index.html'))
  );

  // Serve the repo root at /_ottr/tests so we can access test code. Might be better to just serve
  // the root of the user's test folder, but we'd have to guess at that and it would complicate the
  // ottr command-line interface
  app.use(TESTS_PREFIX, express.static('.'));

  const port = await getPort({host: 'localhost', port: 50505});
  setupProxy(app, targetUrl, port);
  setupEndpoints(app);
  const url = `http://localhost:${port}/_ottr/ui`;
  const appServer = app.listen(port, 'localhost', () => console.log(`[ottr] running on ${url}`));
  setupWebSockets(appServer);
  return url;
}
