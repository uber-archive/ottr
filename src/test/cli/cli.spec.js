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

import test from 'tape-promise/tape';
import {FRONTEND_JS, runOttr, startDummyServer} from './util';
import fs from 'fs';
import path from 'path';
import tmp from 'tmp';
import fetch from 'node-fetch';
import {sleep} from '../../main/util';

// TODO: test kills Chrome process on exit and ctrl+C
// TODO: test timeout
// TODO: test Istanbul coverage
// TODO: test mix of Istanbul coverage and Chrome coverage
// TODO: test server coverage

const ALWAYS_PASSES = `require('ottr').test('always passes', '/home', function(t) { t.end(); });`;

const actualExpressServerCodeWhichWritesPortToFile = randomNumber => `
  const fs = require('fs')
  const express = require('express')
  const app = express()
  app.get('/', (req, res) => res.json({num: ${randomNumber}}))
  var server = app.listen(0, () => fs.writeFileSync('port.txt', server.address().port));`;

async function waitForPortFile(dir) {
  for (let i = 0; i < 200; i++) {
    try {
      return Number(fs.readFileSync(path.resolve(dir, 'port.txt'), 'utf8'));
    } catch (e) {
      await sleep(100);
    }
  }
  throw new Error('port file never written');
}

async function assertServerRunning(t, launchedPort, randomNumber: number | false) {
  if (randomNumber) {
    t.deepEqual(
      await (await fetch(`http://127.0.0.1:${launchedPort}`)).json(),
      {num: randomNumber},
      'launched server running'
    );
  } else {
    try {
      await fetch(`http://127.0.0.1:${launchedPort}`);
      t.fail('ottr kills our server');
    } catch (e) {
      t.pass('ottr kills our server');
    }
  }
}

test('success - Chrome + server + imports', async t => {
  let launched = false;
  const server = await startDummyServer('', () => (launched = true));
  const port = server.address().port;
  await runOttr(`--chrome --server ./server.sh localhost:${port} test.js`, {
    'dep.js': `module.exports = function() { console.log('Dep loaded') }`,
    'test.js': `
        var dep = require('./dep'); 
        var ottr = require('ottr');
        ottr.test('homepage works', '/home', function(t) {
          t.equal(window.location.pathname, '/home');
          t.true(window.ottrServerWorks);
          t.end();
        });`,
    'server.sh': `#!/bin/sh
        curl -s http://localhost:${port}/confirm-server-launched`
  });
  t.true(launched, 'ottr should launch the web server');
  server.close();
  t.end();
});

test('test can inject custom headers', async t => {
  let gotInjectedHeader = false;
  const server = await startDummyServer('', () => {}, {
    '/xyz': (req: express$Request, res: express$Response) => {
      if (req.get('x-injected') === 'yes') {
        console.log('good');
        gotInjectedHeader = true;
        return res.send('COOL!');
      }
      console.log('bad');
      return res.status(400).send('bad request');
    }
  });
  const port = server.address().port;
  await runOttr(`--chrome localhost:${port} test.js`, {
    'test.js': `
        var ottr = require('ottr');
        ottr.test('homepage works', {path: '/home', headers: {'x-injected': 'yes'}}, function(t) {
          t.equal(window.location.pathname, '/home');
          t.true(window.ottrServerWorks);
          fetch('/xyz')
            .then(r => {t.ok(r.ok, 'success'); t.end()})
            .catch(e => {t.error(e); t.end();});
        });`
  });
  server.close();
  t.true(gotInjectedHeader, 'saw injected header');
  t.end();
});

test('success - Chrome screenshots', async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  const {dir} = await runOttr(`--chrome --screenshots localhost:${port} test.js`, {
    'test.js': `
        var ottr = require('ottr');
        ottr.test('homepage works', '/home', function(t) {
          setTimeout(t.end, 5000);
          t.equal(window.location.pathname, '/home');
          t.true(window.ottrServerWorks);
        });`
  });
  const sessionsDir = path.resolve(dir, 'ottr/sessions');
  const sessionDir = path.resolve(sessionsDir, fs.readdirSync(sessionsDir)[0]);
  const ssDir = path.resolve(sessionDir, 'screenshots');
  const screenshots = fs.readdirSync(ssDir);
  const pngs = screenshots.filter(x => x.match(/.*\.png$/));
  if (pngs.length < 5) {
    t.fail(`expected at least 5 screenshots in ${ssDir} but got ${screenshots.length}`);
    console.error(screenshots);
  }
  const gifs = screenshots.filter(x => x.match(/.*\.gif$/));
  t.equal(gifs.length, 1, 'produced gif');
  server.close();
  t.end();
});

test('success - Chrome + coverage', async t => {
  const {name: dir} = tmp.dirSync();
  const server = await startDummyServer(dir);
  const port = server.address().port;
  const bin = 'node_modules/.bin';
  await runOttr(
    ['./bypass-istanbul.sh', ''],
    {
      'bypass-istanbul.sh': `#!/bin/bash
      set -e
      unset NYC_ROOT_ID NYC_CONFIG NYC_CWD NYC_INSTRUMENTER NYC_PARENT_PID
      export PATH=\${PATH//node-spawn-wrap/XXX}
      ${bin}/nyc --reporter=json-summary --reporter=html \\
          ${bin}/ottr --chrome --coverage=chrome localhost:${port} test.js`,
      'src/gui/frontend.js': FRONTEND_JS,
      'test.js': `
      var ottr = require('ottr');
      ottr.test('homepage works', '/home', function(t) {
        t.equal(window.location.pathname, '/home');
        t.true(window.ottrServerWorks);
        t.end();
      });`
    },
    dir
  );
  server.close();
  const coverageSummary = JSON.parse(
    fs.readFileSync(path.resolve(dir, 'coverage/coverage-summary.json'), 'utf8')
  );
  console.log(coverageSummary);
  t.equal(coverageSummary.total.lines.total, 8);
  t.equal(coverageSummary.total.lines.covered, 7);
  t.end();
});

test('fails when webpack sees missing dependency', async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  try {
    await runOttr(`localhost:${port} test.js`, {
      'test.js': `
        var dep = require('./dep'); 
        ${ALWAYS_PASSES}
    `,
      'server.sh': `#!/bin/sh
        curl -s http://localhost:${port}/confirm-server-launched`
    });
    t.fail('ottr should not have succeeded');
  } catch (e) {
    t.equal(e, 1, 'ottr should fail');
  }
  server.close();
  t.end();
});

test('fails when test code init fails', async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  try {
    await runOttr(`--chrome localhost:${port} test.js`, {
      'test.js': `window.thisdefinitelywontwork()`
    });
    t.fail('ottr should not have succeeded');
  } catch (e) {
    t.equal(e, 1, 'ottr should fail');
  }
  server.close();
  t.end();
});

test('fails when no tests', async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  try {
    await runOttr(`--chrome localhost:${port} test.js`, {
      'test.js': `console.log('no tests here!')`
    });
    t.fail('ottr should not have succeeded');
  } catch (e) {
    t.equal(e, 1, 'ottr should fail');
  }
  server.close();
  t.end();
});

test('fails when puppeteer fails', async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  try {
    await runOttr(`--chromium fake-chrome localhost:${port} test.js`, {
      'test.js': `console.log('no tests here!')`
    });
    t.fail('ottr should not have succeeded');
  } catch (e) {
    t.equal(e, 1, 'ottr should fail');
  }
  server.close();
  t.end();
});

test("fails when webpack can't parse test code", async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  try {
    await runOttr(`localhost:${port} test.js`, {
      'test.js': `this is just not valid javascript code`
    });
    t.fail('ottr should not have succeeded');
  } catch (e) {
    t.equal(e, 1, 'ottr should fail');
  }
  server.close();
  t.end();
});

test('fails when server startup fails', async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  try {
    await runOttr(`--server server.sh localhost:${port} test.js`, {
      'test.js': ALWAYS_PASSES,
      'server.sh': `#!/bin/sh
        exit 1`
    });
    t.fail('ottr should not have succeeded');
  } catch (e) {
    t.equal(e, 1, 'ottr should fail');
  }
  server.close();
  t.end();
});

test('kills server when tests finish', async t => {
  let tellOttrWeLaunched = false;
  const {name: dir} = tmp.dirSync();
  const server = await startDummyServer(dir, () => {}, {
    '/actually-launched': async (req: express$Request, res: express$Response) =>
      tellOttrWeLaunched ? res.send('launched') : res.status(404).send('fail')
  });
  const dummyServerPort = server.address().port;
  const randomNumber = Math.round(Math.random() * 10000000);
  const ottrExecution = runOttr(
    `--server 'node server.js' --chrome --wait-path=/actually-launched localhost:${dummyServerPort} test.js`,
    {
      'test.js': ALWAYS_PASSES,
      'server.js': actualExpressServerCodeWhichWritesPortToFile(randomNumber)
    },
    dir
  );
  const launchedPort = await waitForPortFile(dir);
  await assertServerRunning(t, launchedPort, randomNumber);
  tellOttrWeLaunched = true;
  await ottrExecution;
  await assertServerRunning(t, launchedPort, false);
  server.close();
  t.end();
});

test('kills server when user presses Ctrl+C', async t => {
  const {name: dir} = tmp.dirSync();
  const server = await startDummyServer(dir);
  const dummyServerPort = server.address().port;
  const randomNumber = Math.round(Math.random() * 10000000);
  const ottrExecution = runOttr(
    `--server 'node server.js' localhost:${dummyServerPort} test.js`,
    {
      'test.js': ALWAYS_PASSES,
      'server.js': actualExpressServerCodeWhichWritesPortToFile(randomNumber)
    },
    dir
  );
  const launchedPort = await waitForPortFile(dir);
  await assertServerRunning(t, launchedPort, randomNumber);
  // $FlowFixMe
  ottrExecution.child.kill();
  try {
    await ottrExecution;
    t.fail('ottr exited with nonzero');
  } catch (e) {
    t.pass('ottr exited with nonzero');
  }
  await assertServerRunning(t, launchedPort, false);

  server.close();
  t.end();
});

test('fails when server not online', async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  server.close();
  try {
    await runOttr(`--wait-timeout 1 localhost:${port} test.js`, {
      'test.js': ALWAYS_PASSES
    });
    t.fail('ottr should not have succeeded');
  } catch (e) {
    t.equal(e, 1, 'ottr should fail');
  }
  t.end();
});

test('fails when wait path 404', async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  try {
    await runOttr(`--wait-timeout 1 --wait-path /xyz localhost:${port} test.js`, {
      'test.js': ALWAYS_PASSES
    });
    t.fail('ottr should not have succeeded');
  } catch (e) {
    t.equal(e, 1, 'ottr should fail');
  }
  server.close();
  t.end();
});
