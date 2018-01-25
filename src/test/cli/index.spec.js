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
import {spawn} from 'child_process';
import getPort from 'get-port';
import tmp from 'tmp';
import fs from 'fs';
import path from 'path';
import express from 'express';
import {logEachLine} from '../../main/util';

const ottrRepoRoot = () => path.resolve(__dirname, '../../..');

const setupNodeModules = dir => {
  const nodeModules = `${dir}/node_modules`;
  fs.mkdirSync(nodeModules);
  const bin = `${nodeModules}/.bin`;
  fs.mkdirSync(bin);
  const repoRoot = ottrRepoRoot();
  fs.symlinkSync(repoRoot, `${nodeModules}/ottr`);
  fs.symlinkSync(`${repoRoot}/lib/cli/cli.js`, `${bin}/ottr`);
  const ottrNpmDependencyNames = fs.readdirSync(`${repoRoot}/node_modules`);
  ottrNpmDependencyNames.forEach(file => {
    try {
      fs.symlinkSync(`${repoRoot}/node_modules/${file}`, `${nodeModules}/${file}`);
    } catch (e) {
      console.log(`error symlinking node_modules/${file} from ottr dependencies`);
    }
  });
};

const startDummyServer = (port, launchedCallback) => {
  const app = express();
  app.get('/home', (req, res) => {
    console.log(`[dummy] server got request for ${req.url}`);
    res.send('<script>window.ottrServerWorks = true</script>');
  });
  app.get('/confirm-server-launched', (req, res) => {
    launchedCallback();
    res.send('fake server launched!');
  });
  console.log(`[dummy] server running on port ${port}`);
  return app.listen(port);
};

const run = (cmd, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, options);
    child.stdout.on('data', data => logEachLine('[ottr-cli]', data));
    child.stderr.on('data', data => logEachLine('!ottr-cli!', data));
    child.on('exit', code => (code === 0 ? resolve() : reject(code)));
  });

test('ottr tests pass - Chrome + server + imports', async t => {
  const port = await getPort({host: 'localhost'});

  let launched = false;
  const server = startDummyServer(port, () => launched = true);

  const {name: dir} = tmp.dirSync();
  setupNodeModules(dir);
  const testJs = `${dir}/index.js`;
  fs.writeFileSync(`${dir}/dep.js`, `module.exports = function() { console.log('Dep loaded') }`);
  fs.writeFileSync(
    testJs,
    `
    var dep = require('./dep'); 
    var ottr = require('ottr');
    ottr.test('homepage works', '/home', function(t) {
      t.equal(window.location.pathname, '/home');
      t.true(window.ottrServerWorks);
      t.end();
    });
    `
  );
  const serverSh = `${dir}/server.sh`;
  fs.writeFileSync(
    serverSh,
    `
    #!/bin/sh
    
    curl -s http://localhost:${port}/confirm-server-launched
  `,
    {mode: 0o700}
  );
  console.log(`Set up Node project in ${dir}`);
  const ottrBin = 'node_modules/.bin/ottr';
  const cmd = `${ottrBin} --chrome --server ${serverSh} localhost:${port} ${testJs}`;
  console.log(`Running ${cmd}`);
  await run(cmd, {shell: true, cwd: dir});
  t.true(launched);
  server.close();
});
