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

import test from 'tape-promise/tape';
import {FRONTEND_JS, runOttr, startDummyServer} from './util';
import fs from 'fs';
import path from 'path';
import tmp from 'tmp';

// TODO: test timeout

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
    'server.sh': `
        #!/bin/sh
        curl -s http://localhost:${port}/confirm-server-launched`
  });
  t.true(launched, 'ottr should launch the web server');
  server.close();
  t.end();
});

test('success - Chrome + coverage', async t => {
  const {name: dir} = tmp.dirSync();
  const server = await startDummyServer(dir);
  const port = server.address().port;
  const bin = 'node_modules/.bin';
  await runOttr(['./bypass-istanbul.sh', ''], {
    'bypass-istanbul.sh': `
      #!/bin/bash
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
  }, dir);
  server.close();
  const coverageSummary = JSON.parse(
    fs.readFileSync(path.resolve(dir, 'coverage/coverage-summary.json'), 'utf8')
  );
  console.log(coverageSummary);
  t.ok(coverageSummary);
  // TODO: actually check coverage numbers. should be 5 lines covered i think
  t.end();
});

test('fails when webpack sees missing dependency', async t => {
  const server = await startDummyServer();
  const port = server.address().port;
  try {
    await runOttr(`localhost:${port} test.js`, {
      'test.js': `
        var dep = require('./dep'); 
        var ottr = require('ottr');
        ottr.test('this is gonna fail', '/home', function(t) {
          t.end();
        });
    `,
      'server.sh': `
        #!/bin/sh
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
      'test.js': `
        require('ottr').test('homepage works', '/home', function(t) { t.end(); });`,
      'server.sh': `
        #!/bin/sh
        exit 1`
    });
    t.fail('ottr should not have succeeded');
  } catch (e) {
    t.equal(e, 127, 'ottr should fail');
  }
  server.close();
  t.end();
});
