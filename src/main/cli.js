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

const shouldProxy = (pathname, req) => !pathname.match(/\/_ottr.*/);

const TESTS_PREFIX = '/_ottr/tests';
const MAIN_OTTR_JS = '_ottrmain.js';

async function start() {
  const testFile = process.argv[3];
  if (!testFile || !fs.existsSync(testFile)) {
    throw new Error(`usage: ottr localhost:3000 src/test/index.js`);
  }
  let target = process.argv[2];
  if (!target.includes('://')) target = `http://${target}`;

  const app = express();
  let appServer;

  const kill = () => appServer.destroy();
  const ottrPort = await getPort({port: 50505});

  app.post('/_ottr/done', () => {
    console.log('Got /_ottr/done; killing server');
    kill();
  });
  app.get(TESTS_PREFIX + '/' + MAIN_OTTR_JS, (req, res: express$Response) =>
    res.redirect('/_ottr/tests/' + testFile)
  );
  app.use(TESTS_PREFIX, express.static('.'));

  const scriptTag = `<script src='${TESTS_PREFIX}/${MAIN_OTTR_JS}'></script>`;
  app.use(
    '/',
    proxy(shouldProxy, {
      target,
      changeOrigin: true,
      onProxyRes(proxyRes: express$Request, req: express$Request, res: express$Response) {
        const contentType = proxyRes.headers['content-type'];
        if (contentType && contentType.match(/.*text\/html.*/i)) {
          const originalLength = proxyRes.headers['content-length'];
          if (originalLength)
            proxyRes.headers['content-length'] = +originalLength + scriptTag.length;

          modifyResponse(res, proxyRes.headers['content-encoding'], body =>
            body.toString().replace(/(<head[^>]*>)/, '$1' + scriptTag)
          );
        }
      }
    })
  );
  process.on('exit', kill);
  appServer = app.listen(ottrPort, () =>
    console.log(`ottr running on http://localhost:${ottrPort} → ${target}`)
  );
}

start().catch(e => console.error(e));
