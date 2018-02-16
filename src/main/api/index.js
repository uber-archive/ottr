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

/* eslint-env browser */

import 'whatwg-fetch';
import tapeTest from 'tape';
import {currentTestName, currentTestSession, isMainTestRunner} from './session';
import {done, emitEvent} from './socket';
import {once} from '../util';

export {sleep} from '../util';

const ottrTests = {};

const TEST_DEFINITIONS_TIMEOUT_MS = 5000;

let submittedTestsToServer = false;
const submitTestsToServer = (force = false) => {
  if (submittedTestsToServer) {
    return;
  }
  const numberOfTests = Object.keys(ottrTests).length;
  if (!force && numberOfTests === 0) {
    // Sometimes this gets called prematurely; let's wait for tests to actually fully load before
    // we submit to the server
    setTimeout(() => submitTestsToServer(true), TEST_DEFINITIONS_TIMEOUT_MS);
    return;
  }
  submittedTestsToServer = true;
  console.log(`[ottr] [${currentTestSession || '?'}] submitting ${numberOfTests} tests to server`);
  emitEvent('tests', ottrTests);
};
const maybeSubmitTestsToServer = (...args) => submitTestsToServer();

// Unfortunately ottr is often loaded multiple times, in different Webpack namespaces, so we need to
// make sure each loaded version has an opportunity to submit tests to the server. So we chain the
// callbacks here.
const prev = window.ottrTestInitFinished;
window.ottrTestInitFinished = function ottrTestInitFinished() {
  maybeSubmitTestsToServer();
  if (prev) {
    prev();
  }
};

if (currentTestSession) {
  if (isMainTestRunner) {
    console.log(`[ottr] [${currentTestSession}]: preparing to run tests`);
  } else if (currentTestName) {
    console.log(`[ottr] [${currentTestSession}]: preparing to run ${currentTestName}`);
  }
} else {
  console.log('ottr: this frame is not for running anything!');
}

type Options = {
  path: string,
  headers?: {[string]: string | number}
};

export function test(name: string, pathOrOptions: string | Options, fn: (t: any) => any) {
  if (!name) {
    throw new Error(`test name is ${name}`);
  }
  const options: Options =
    typeof pathOrOptions === 'string' ? {path: pathOrOptions} : pathOrOptions;
  if (!isMainTestRunner && !currentTestName) {
    return;
  }
  if (ottrTests[name]) {
    throw new Error(`ottr cannot handle duplicate test names: ${name}`);
  }
  ottrTests[name] = {name, path: options.path, headers: options.headers, fn};
  if (isMainTestRunner) {
    window.addEventListener('load', window.ottrTestInitFinished);
  } else if (name === currentTestName) {
    console.log('[ottr] waiting for window.onload event before running test...');
    window.addEventListener(
      'load',
      once(() => {
        tapeTest.onFinish(done);
        tapeTest(name, fn);
      })
    );
  }
}

export function setValue(input: HTMLInputElement, value: string) {
  const lastValue = input.value;
  input.value = value;
  const event = new Event('input', {bubbles: true});
  // $FlowFixMe hack for React15
  event.simulated = true;
  // $FlowFixMe hack for React16
  const tracker = input._valueTracker;
  if (tracker) {
    tracker.setValue(lastValue);
  }
  input.dispatchEvent(event);
}
