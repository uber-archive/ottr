#!/usr/bin/env node
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
/* eslint-disable no-process-exit,node/shebang,no-unreachable */

import 'source-map-support/register';
import 'babel-polyfill';

import fs from 'fs';
import {packageForBrowser} from './packager';
import path from 'path';
import url from 'url';
import {logEachLine, nonnull, sleep} from '../util';
import {Command} from 'commander';
import {ChromeRunner, runChrome} from './chrome';
import {spawn} from 'child_process';
import {createSession, DEFAULT_ERROR, getSessions} from './server/sessions';
import {startOttrServer} from './server';
import fetch from 'node-fetch';

const DEFAULT_SERVER_STARTUP_TIMEOUT_SECS = 30;

const run = (title: string, cmd: string, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, [], options);
    child.stdout.on('data', data => logEachLine(`[${title}]`, data));
    child.stderr.on('data', data => logEachLine(`!${title}!`, data));
    child.on('exit', code => (code === 0 ? resolve() : reject(code)));
  });

const serverOnline = async (u, timeoutMs) => {
  let alreadyLogged = false;
  const start = Date.now();
  let nextTimeoutMs = 250;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const response = await fetch(u, {method: 'HEAD'});
      if (!response.ok) {
        throw new Error(
          `HTTP HEAD ${u} - server returned ${response.status} ${response.statusText}`
        );
      }
      return;
    } catch (e) {
      if (!alreadyLogged) {
        alreadyLogged = true;
        console.log(`[ottr] waiting for server startup (${u})`);
      }
      if (Date.now() - start >= timeoutMs) {
        throw e;
      }
      await sleep(nextTimeoutMs);
      nextTimeoutMs = Math.min(5000, nextTimeoutMs * 2);
    }
  }
};

type OttrCommand = Command & {
  server?: string,
  concurrency?: number,
  waitTimeout?: number,
  waitPath?: string,
  inspect?: boolean,
  chrome?: boolean,
  debug?: boolean,
  screenshots?: boolean,
  chromium?: string,
  coverage?: string
};

class Ottr {
  command: OttrCommand;
  chrome: ChromeRunner;

  constructor(command: OttrCommand) {
    this.command = command;
  }

  run() {
    this.runReally().catch(this.exit);
  }

  validate() {
    const [, testFileOrig] = this.command.args;
    if (!testFileOrig || !fs.existsSync(testFileOrig)) {
      if (testFileOrig) {
        return this.exit(`${path.resolve(testFileOrig)} does not exist`, true);
      }
      return this.exit(1, true);
    }

    if (!runChrome) {
      for (const name of ['coverage', 'concurrency', 'inspect', 'screenshots']) {
        if (this.command[name]) {
          return this.exit(`you passed --${name} without also passing --chrome/chromium`, true);
        }
      }
    }

    if (runChrome && this.command.inspect && this.command.screenshots) {
      return this.exit(`sorry, can't use --screenshots with --inspect (it breaks Chrome)`, true);
    }

    if (this.command.coverage && this.command.coverage !== 'chrome') {
      return this.exit(`unknown value --coverage=${this.command.coverage}`, true);
    }
    return true;
  }

  async runReally() {
    if (!this.validate()) {
      return;
    }

    const [targetOrig, testFileOrig] = this.command.args;
    if (this.command.server) {
      console.log(`[ottr] starting server ${this.command.server}`);
      run('ottr:server', nonnull(this.command.server), {shell: true}).catch(this.exit);
    }

    await packageForBrowser(testFileOrig);

    const targetUrl = targetOrig.includes('://') ? targetOrig : `http://${targetOrig}`;
    const ottrUrl = await startOttrServer(targetUrl);

    await serverOnline(
      url.resolve(targetUrl, this.command.waitPath || ''),
      1000 * (this.command.waitTimeout || DEFAULT_SERVER_STARTUP_TIMEOUT_SECS)
    );

    const useChrome = this.command.chrome || this.command.chromium;
    let guiUrl = ottrUrl;
    if (useChrome) {
      const sessionId = createSession({concurrency: this.command.concurrency});
      guiUrl = `${ottrUrl}/session/${sessionId}`;
      console.log(`[ottr] starting Chrome => ${guiUrl}`);
      // TODO: only import puppeteer NPM package if user wants this feature
      this.chrome = new ChromeRunner(
        this.exit,
        guiUrl,
        sessionId,
        !this.command.inspect,
        this.command.coverage === 'chrome',
        this.command.chromium,
        this.command.screenshots ? 100 : null
      );
    } else {
      console.log(`[ottr] you did not specify '--chrome', so you must run tests manually`);
      console.log(`[ottr] please visit ${ottrUrl} in the browser(s) of your choice`);
    }

    await this.waitForCompletion(guiUrl);
  }

  async waitForCompletion(guiUrl) {
    try {
      await this.allSessionsComplete();
      if (this.command.debug) {
        console.log(`[ottr] keeping ottr open because you passed '--debug'`);
        console.log(`[ottr] please open ${guiUrl}`);
      } else {
        await this.exit(0);
      }
    } catch (e) {
      if (this.command.debug) {
        console.log(`[ottr] keeping ottr open because you passed '--debug'`);
        console.log(`[ottr] please open ${guiUrl} to investigate and reproduce failures`);
      } else {
        await this.exit(1);
      }
    }
  }

  async allSessionsComplete() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const sess = getSessions();
      if (sess.length > 0 && sess.every(s => s.done)) {
        sess.forEach(this.printSessionSummary);
        if (sess.some(s => s.error)) {
          throw new Error('some tests failed');
        }
        return;
      }
      await sleep(100);
    }
  }

  exit = async (codeOrError, printHelp?) => {
    let code;
    if (typeof codeOrError === 'number') {
      code = codeOrError;
    } else {
      console.error('[ottr] initialization failed', codeOrError);
      code = 1;
    }
    if (this.chrome) {
      try {
        await this.chrome.finish();
      } catch (e) {
        console.error('[ottr] error shutting down Chrome', e);
      }
    }
    if (printHelp) {
      this.command.help();
    }
    process.exit(code);
  };

  printSessionSummary = s => {
    const tests = s.getTests();
    if (s.error) {
      const failed = tests.filter(t => t.error);
      if (failed.length > 0) {
        console.error(`[ottr] FAILURE: ${failed.length} tests failed out of ${tests.length}`);
      }
      if (s.error !== DEFAULT_ERROR) {
        console.error(`[ottr] FAILURE: ${s.error || 'unknown error'}`);
      }
    } else {
      console.log(`[ottr] SUCCESS! ${tests.length} tests passed`);
    }
  };
}

const args = new Command()
  .description(
    `  url:  the website to run your tests against
    file: root end-to-end test file that runs all your tests`
  )
  .arguments('<url> <file>')
  .option('-s, --server <cmd>', "command ottr uses to launch your server, e.g. 'npm run watch'")
  .option('-c, --chrome', 'opens headless Chrome/Chromium to the ottr UI to run your tests')
  .option('--chromium <path>', 'uses the specified Chrome/Chromium binary to run your tests')
  .option('--coverage <type>', "use 'chrome' for code coverage from Chrome DevTools (see below)")
  .option('--screenshots', 'take screenshots every 100ms')
  .option('--concurrency <n>', 'number of tests ottr should run in simultaneous iframes', parseInt)
  .option('--wait-timeout <secs>', 'max server startup wait time (see --wait-path)', parseInt)
  .option('--wait-path <path>', 'wait for your server to return 200 for this path (e.g., /health)')
  .option('-d, --debug', 'keep ottr running indefinitely after tests finish')
  .option('-i, --inspect', 'runs Chrome in GUI mode so you can watch tests run interactively')
  .on('--help', () =>
    console.log(`
  Examples:

    $ ottr --chrome --debug localhost:9999 src/test/e2e.js

        Runs your tests in e2e.js against your local development server using
        a headless Chrome browser. The --debug option leaves ottr running so
        you can debug interactively using the browser of your choice. (Your
        server must already be running on port 9999.)

    $ nyc --reporter=html ottr --coverage=chrome https://google.com dist-test/e2e.js

        Runs your tests against Google's home page, in a Chrome headless 
        browser, with Chrome's built-in code coverage recording. nyc (the 
        istanbul command-line tool) generates an HTML coverage report.
`)
  )
  .parse(process.argv);

// eslint-disable-next-line no-process-env,no-eval,prefer-const
let envArgs = eval(`(${process.env.OTTR_OPTS || '{}'})`);
console.log('envArgs=', envArgs);
for (const k in envArgs) {
  // $FlowFixMe
  if (!(k in args) || typeof args[k] === 'undefined' || args[k] === null) {
    // $FlowFixMe
    args[k] = envArgs[k];
  }
}
new Ottr(args).run();
