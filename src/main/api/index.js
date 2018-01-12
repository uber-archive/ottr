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
/* eslint-env browser */

import 'whatwg-fetch';
import tapeTest from 'tape';
import {currentTestName, currentTestSession, isMainTestRunner} from './session';
import {done, emitEvent} from './socket';
import {once} from '../util';

if (currentTestSession) {
  if (isMainTestRunner) {
    console.log(`ottr[${currentTestSession}]: preparing to run tests`);
  } else if (currentTestName) {
    console.log(`ottr[${currentTestSession}]: preparing to run ${currentTestName}`);
  }
} else {
  console.log('ottr: this frame is not for running anything!');
}

const ottrTests = {};

export function test(name: string, path: string, fn: (t: any) => any) {
  if (!name) {
    throw new Error(`test name is ${name}`);
  }
  if (!isMainTestRunner && !currentTestName) {
    return;
  }
  if (ottrTests[name]) {
    throw new Error(`ottr cannot handle duplicate test names: ${name}`);
  }
  ottrTests[name] = {name, path, fn};
  if (isMainTestRunner) {
    window.addEventListener(
      'load',
      once(() => {
        console.log(`submitting ${Object.keys(ottrTests).length} tests to server`);
        emitEvent('tests', ottrTests);
      })
    );
  } else if (name === currentTestName) {
    console.log('ottr: waiting for window.onload event before running test...');
    window.addEventListener(
      'load',
      once(() => {
        console.log('ottr: document loaded! running test');
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

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));