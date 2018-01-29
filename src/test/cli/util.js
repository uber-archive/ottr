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

import express from 'express';
import path from 'path';
import {logEachLine} from '../../main/util';
import fs from 'fs';
import {spawn} from 'child_process';
import tmp from 'tmp';
import mkdirp from 'mkdirp';
import getPort from 'get-port';

const ottrRepoRoot = () => path.resolve(__dirname, '../../..');

const setupNodeModules = dir => {
  const nodeModules = `${dir}/node_modules`;
  fs.mkdirSync(nodeModules);
  const bin = `${nodeModules}/.bin`;
  fs.mkdirSync(bin);
  const repoRoot = ottrRepoRoot();
  fs.symlinkSync(repoRoot, `${nodeModules}/ottr`, 'dir');
  fs.symlinkSync(`${repoRoot}/lib/cli/cli.js`, `${bin}/ottr`, 'dir');
  const ottrNpmDependencyNames = fs.readdirSync(`${repoRoot}/node_modules`);
  ottrNpmDependencyNames.forEach(file => {
    try {
      if (file !== '.bin') {
        fs.symlinkSync(`${repoRoot}/node_modules/${file}`, `${nodeModules}/${file}`, 'dir');
      }
    } catch (e) {
      console.log(`could not symlink node_modules/${file} from ottr dependencies`, e);
    }
  });
};

export const startDummyServer = async (launchedCallback: () => any = () => {}) => {
  const port = await getPort();
  const app = express();
  app.get('/home', (req: express$Request, res: express$Response) => {
    console.log(`[dummy] server got request for ${req.url}`);
    res.send('<script>window.ottrServerWorks = true</script>');
  });
  app.get('/confirm-server-launched', (req: express$Request, res: express$Response) => {
    launchedCallback();
    res.send('fake server launched!');
  });
  console.log(`[dummy] server running on port ${port}`);
  return app.listen(port);
};

const run = (cmd, options) =>
  (new Promise((resolve, reject) => {
    const child = spawn(cmd, options);
    child.stdout.on('data', data => logEachLine('[ottr-cli]', data));
    child.stderr.on('data', data => logEachLine('!ottr-cli!', data));
    child.on('exit', code => (code === 0 ? resolve() : reject(code)));
  }): Promise<void>);

export const runOttr = (args: string, files: {[string]: string}) => {
  const {name: dir} = tmp.dirSync();
  setupNodeModules(dir);
  Object.keys(files).forEach(p => {
    const abs = path.resolve(dir, p);
    mkdirp(path.dirname(abs));
    fs.writeFileSync(abs, files[p], p.match(/\.sh$/) ? {mode: 0o700} : {});
  });
  const ottrBin = 'node_modules/.bin/ottr';
  const cmd = `${ottrBin} ${args}`;
  console.log(`Running from ${dir} - ${cmd}`);
  return run(cmd, {shell: true, cwd: dir});
};
