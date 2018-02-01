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
import {sync as mkdirp} from 'mkdirp';
import getPort from 'get-port';
import {transform} from 'babel-core';

const ottrRepoRoot = () => path.resolve(__dirname, '../../..');

const setupNodeModules = dir => {
  const nodeModules = `${dir}/node_modules`;
  fs.mkdirSync(nodeModules);
  const repoRoot = ottrRepoRoot();
  fs.symlinkSync(repoRoot, `${nodeModules}/ottr`, 'dir');
  const ottrNpmDependencyNames = fs.readdirSync(`${repoRoot}/node_modules`);
  ottrNpmDependencyNames.forEach(file => {
    try {
      fs.symlinkSync(`${repoRoot}/node_modules/${file}`, `${nodeModules}/${file}`, 'dir');
    } catch (e) {
      console.log(`could not symlink node_modules/${file} from ottr dependencies`, e);
    }
  });
  const ottrBin = `${nodeModules}/.bin/ottr`;
  try {
    fs.unlinkSync(ottrBin);
  } catch (e) {
    /* not a problem */
  }
  fs.symlinkSync(`${repoRoot}/lib/cli/cli.js`, ottrBin, 'dir');
};

const noop = () => {};

export const FRONTEND_JS = `
  const covered = () => {
    window.ottrServerWorks = true;
  }
  const uncovered = ()=>  {
    console.log('never called');
  }
  covered();`;

export const startDummyServer = async (dirOrig: string = '', launchedCallback: () => any = noop) => {
  const dir = dirOrig.length > 0 ? fs.realpathSync(dirOrig) : dirOrig;
  const port = await getPort();
  const app = express();
  app.get('/home', (req: express$Request, res: express$Response) => {
    console.log(`[dummy] server got request for ${req.url}`);
    res.send('<script src=frontend.js></script>');
  });
  const instrumentedFrontendCode = transform(FRONTEND_JS, {
    filename: `${dir}/src/gui/frontend.js`,
    sourceFileName: `${dir}/src/gui/frontend.js`,
    sourceMaps: 'inline',
    sourceRoot: dir
  }).code;
  app.get('/frontend.js', (req: express$Request, res: express$Response) => {
    console.log(`[dummy] server got request for ${req.url}`);
    res.set('Content-Type', 'text/javascript');
    res.send(instrumentedFrontendCode);
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

export const runOttr = async (
  cmdline: string | string[],
  files: {[string]: string},
  dirOrig?: string = tmp.dirSync().name
) => {
  let prefix = '';
  let args;
  if (typeof cmdline === 'string') {
    args = cmdline;
  } else {
    [prefix, args] = cmdline;
  }
  const dir = fs.realpathSync(dirOrig);
  setupNodeModules(dir);
  Object.keys(files).forEach(p => {
    const abs = path.resolve(dir, p);
    mkdirp(path.dirname(abs));
    fs.writeFileSync(abs, files[p], p.match(/\.sh$/) ? {mode: 0o700} : {});
  });
  const ottrBin = 'node_modules/.bin/ottr';
  const cmd = `${prefix} ${ottrBin} ${args}`.trim();
  console.log(`Running from ${dir} - ${cmd}`);
  return {
    dir,
    promise: await run(cmd, {shell: true, cwd: dir})
  };
};
