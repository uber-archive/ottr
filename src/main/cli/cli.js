#!/usr/bin/env node
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

import 'source-map-support/register';

import 'babel-polyfill';

import getPort from 'get-port';
import express from 'express';
import proxy from 'http-proxy-middleware';
import fs from 'fs';
import modifyResponse from 'http-proxy-response-rewrite';
import {packageForBrowser} from './packager';
import path from 'path';
import {setupEndpointsAfter, setupEndpointsBefore} from './endpoints';

const shouldProxy = (pathname, req) => !pathname.match(/\/_ottr.*/);

const TESTS_PREFIX = '/_ottr/tests';

async function start() {
  const testFileOrig = process.argv[3];
  if (!testFileOrig || !fs.existsSync(testFileOrig)) {
    throw new Error('usage: ottr localhost:3000 src/test/index.js');
  }

  await packageForBrowser(testFileOrig);
  let target = process.argv[2];
  if (!target.includes('://')) target = `http://${target}`;

  const app = express();
  app.use('/_ottr', express.static(path.resolve(__dirname, '../static')));
  app.use(TESTS_PREFIX, express.static('.'));

  app.use(
    '/',
    proxy(shouldProxy, {
      target,
      changeOrigin: true,
      onProxyRes(proxyRes: express$Request, req: express$Request, res: express$Response) {
        const contentType = proxyRes.headers['content-type'];
        delete proxyRes.headers['content-security-policy'];
        if (contentType && contentType.match(/.*text\/html.*/i)) {
          const originalLength = proxyRes.headers['content-length'];
          const scriptTag = `<script src='${TESTS_PREFIX}/.ottr-webpack/tests-bundle.js'></script>`;
          if (originalLength)
            proxyRes.headers['content-length'] = +originalLength + scriptTag.length;

          modifyResponse(res, proxyRes.headers['content-encoding'], body =>
            body.toString().replace(/(<head[^>]*>)/, '$1' + scriptTag)
          );
        }
      }
    })
  );
  setupEndpointsBefore(app);
  const ottrPort = await getPort({port: 50505});
  let appServer = app.listen(ottrPort, () =>
    console.log(`ottr running on http://localhost:${ottrPort} → ${target}`)
  );
  setupEndpointsAfter(appServer);
}

start().catch(e => {
  console.error('ottr initialization failed', e);
  process.exit(1);
});
