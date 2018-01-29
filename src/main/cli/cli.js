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

/* eslint-disable no-process-exit,node/shebang */
// @flow

import 'source-map-support/register';

import 'babel-polyfill';

import fs from 'fs';
import {packageForBrowser} from './packager';
import path from 'path';
import {logEachLine} from '../util';
import commander from 'commander';
import {runChrome} from './chrome';
import {spawn} from 'child_process';
import {createSession, DEFAULT_ERROR, getSessions} from './server/sessions';
import {startOttrServer} from './server';
import type {Session} from '../types';

const run = (title, cmd, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, [], options);
    child.stdout.on('data', data => logEachLine(`[${title}]`, data));
    child.stderr.on('data', data => logEachLine(`!${title}!`, data));
    child.on('exit', code => (code === 0 ? resolve() : reject(code)));
  });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function handleFatalError(e) {
  console.error('[ottr] initialization failed', e);
  process.exit(1);
}

function printSessionSummary(s) {
  const tests = s.getTests();
  if (s.error) {
    const failed = tests.filter(t => t.error);
    if (failed.length > 0) {
      console.error(`[ottr] failed: ${failed.length} of ${tests.length}`);
    }
    if (s.error !== DEFAULT_ERROR) {
      console.error(`[ottr] failed: ${s.error || 'unknown error'}`);
    }
  } else {
    console.log(`[ottr] success! ${tests.length} tests passed`);
  }
}

async function exitWhenAllSessionsComplete() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const sess = getSessions();
    if (sess.length > 0 && sess.every(s => s.done)) {
      // eslint-disable-next-line no-loop-func
      for (const s of sess) {
        printSessionSummary(s);
      }
      return process.exit(sess.some(s => s.error) ? 1 : 0);
    }
    await sleep(100);
  }
}

async function start(command) {
  const [targetOrig, testFileOrig] = command.args;
  if (!testFileOrig || !fs.existsSync(testFileOrig)) {
    if (testFileOrig) {
      console.error(`ERROR: ${path.resolve(testFileOrig)} does not exist`);
    }
    command.help();
    return;
  }

  if (command.server) {
    console.log(`[ottr] starting server ${command.server}`);
    run('ottr:server', command.server, {shell: true}).catch(handleFatalError);
    // TODO: wait for server to be up. maybe request /health?
  }

  await packageForBrowser(testFileOrig);

  const targetUrl = targetOrig.includes('://') ? targetOrig : `http://${targetOrig}`;
  const url = await startOttrServer(targetUrl);

  if (command.chrome) {
    const sessionUrl = `${url}/session/${createSession()}`;
    console.log(`[ottr] starting Chrome headless => ${sessionUrl}`);
    // TODO: only import puppeteer if user wants this feature
    runChrome(sessionUrl, !command.inspect).catch(handleFatalError);
  }

  if (!command.debug) {
    exitWhenAllSessionsComplete().catch(handleFatalError);
  }
}

const args = commander
  .description(
    `  url:  the website to run your tests against
    file: root end-to-end test file that runs all your tests`
  )
  .arguments('<url> <file>')
  .option('-c, --chrome', 'opens headless Chrome/Chromium to the ottr UI to run your tests')
  .option('-d, --debug', 'keep ottr running indefinitely after tests finish')
  .option('-i, --inspect', 'runs Chrome in GUI mode so you can watch tests run interactively')
  .option('-s, --server <cmd>', "command ottr uses to launch your server, e.g. 'npm run watch'")
  .on('--help', () => {
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ ottr --chrome --debug localhost:9999 src/test/e2e.js');
    console.log('    $ ottr https://google.com dist-test/e2e.js');
    console.log('');
  })
  .parse(process.argv);

start(args).catch(handleFatalError);
