/*
 * @flow
 *
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

import getPort from 'get-port';
import {getSessionAndTestNameForReq, UI_BASE_URI} from '../../util';
import {setupEndpoints, setupWebSockets} from './endpoints';
import proxy from 'http-proxy-middleware';
import express from 'express';
import modifyResponse from 'http-proxy-response-rewrite';
import path from 'path';
import {asyncMkdirp} from '../util';
import {copy} from 'fs-extra';
import copyRecursive from 'recursive-copy';
import promisify from 'util.promisify';
import {NetworkLogger} from './logger';
import {sessions} from './sessions';

const shouldProxy = (pathname, req) => !pathname.match(/\/_ottr.*/);

const TESTS_PREFIX = '/_ottr/tests';

function injectHeaders(proxyReq, req) {
  const {session, test} = getSessionAndTestNameForReq(req);
  if (!(session && test)) {
    return;
  }
  const sess = sessions[session];
  if (!sess) {
    return;
  }
  const t = sess.tests[test];
  const headers = (t && t.headers) || {};
  Object.keys(headers).forEach(name => proxyReq.setHeader(name, headers[name]));
}

function setupProxy(logger, localhost, app, target, ottrPort) {
  let requestId = 0;
  app.use(
    '/',
    proxy(shouldProxy, {
      target,
      logLevel: 'warn',
      changeOrigin: true,
      onProxyReq(proxyReq, req, res) {
        req.ottrId = requestId++;
        req.ottrStart = Date.now();
        injectHeaders(proxyReq, req);
      },
      onProxyRes(proxyRes: express$Request, req: express$Request, res: express$Response) {
        logger
          .log(req, res)
          .catch(e => console.error('[ottr] error while logging network traffic', e));
        const contentType = proxyRes.headers['content-type'];
        const hostAndPort: string = req.get('host') || `${localhost}:${ottrPort}`;
        const csp = `default-src 'self' 'unsafe-inline' 'unsafe-eval' ws://${hostAndPort}`;
        proxyRes.headers['content-security-policy'] = csp;
        if (contentType && contentType.match(/.*text\/html.*/i)) {
          const originalLength = proxyRes.headers['content-length'];
          const scriptTag = `<script src='${TESTS_PREFIX}/ottr/webpack/tests-bundle.js'></script>`;
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

const copyAsync = promisify(copy);
const copyRecursiveAsync = promisify(copyRecursive);

async function installFontAwesomeIcons(dest) {
  await Promise.all([
    asyncMkdirp(path.resolve(dest, 'css')),
    asyncMkdirp(path.resolve(dest, 'fonts'))
  ]);
  await Promise.all(
    [
      'css/font-awesome.css',
      'fonts/FontAwesome.otf',
      'fonts/fontawesome-webfont.eot',
      'fonts/fontawesome-webfont.svg',
      'fonts/fontawesome-webfont.ttf',
      'fonts/fontawesome-webfont.woff',
      'fonts/fontawesome-webfont.woff2'
    ].map(p => copyAsync(require.resolve(`font-awesome/${p}`), path.resolve(dest, p)))
  );
}

async function installGoogleFonts(dest) {
  await Promise.all([asyncMkdirp(path.resolve(dest, 'css/files'))]);
  await Promise.all([
    installGoogleFont(dest, 'typeface-open-sans'),
    installGoogleFont(dest, 'typeface-ubuntu'),
    installGoogleFont(dest, 'typeface-ubuntu-mono')
  ]);
}

async function installGoogleFont(dest, pkgName) {
  const src = path.dirname(require.resolve(`${pkgName}/index.css`));
  await Promise.all([
    copyAsync(path.resolve(src, 'index.css'), path.resolve(dest, `css/${pkgName}.css`)),
    copyRecursiveAsync(path.resolve(src, 'files'), path.resolve(dest, 'css/files'), {
      overwrite: true
    })
  ]);
}

async function installHarViewer(dest) {
  await asyncMkdirp(dest);
  const src = path.dirname(require.resolve(`harviewer/webapp/index.php`));
  await copyRecursiveAsync(src, dest, {overwrite: true});
  await copyAsync(path.resolve(src, 'index.php'), path.resolve(dest, 'index.html'));
}

export async function startOttrServer(localhost: string, targetUrl: string) {
  const logger = new NetworkLogger(path.resolve('ottr'));
  const app = express();

  // Serve the static files (images, etc)
  const staticFolder = path.resolve(__dirname, '../../static');
  const faPromise = installFontAwesomeIcons(staticFolder);
  const fontsPromise = installGoogleFonts(path.resolve(staticFolder));
  const harPromise = installHarViewer(path.resolve(staticFolder, 'harviewer'));
  app.use(UI_BASE_URI, express.static(staticFolder));

  // We use React Router, so we need to route all 404's to index.html
  app.use(`${UI_BASE_URI}/*`, (req: express$Request, res: express$Response) =>
    res.sendFile(path.resolve(__dirname, '../../static/index.html'))
  );

  // Serve the repo root at /_ottr/tests so we can access test code. Might be better to just serve
  // the root of the user's test folder, but we'd have to guess at that and it would complicate the
  // ottr command-line interface
  app.use(TESTS_PREFIX, express.static('.'));

  // TODO: allow user to configure which network interfaces we listen on?
  const host = '0.0.0.0';
  const port = await getPort({host, port: 50505});
  setupProxy(logger, localhost, app, targetUrl, port);
  setupEndpoints(app);
  const url = `http://${localhost}:${port}/_ottr/ui`;
  const appServer = app.listen(port, host, () => console.log(`[ottr] running on ${url}`));
  setupWebSockets(appServer);
  await Promise.all([faPromise, fontsPromise, harPromise]);
  return url;
}
