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
import {nonnull} from './util';
import {done} from './socket';

const trimLeadingSlash = str => (str[0] === '/' ? str.substring(1) : str);

function startTest(path: string) {
  return new Promise(resolve => {
    const width = 1024;
    const height = 800;
    const factor = 0.2;
    const iframe = document.createElement('iframe');
    iframe.width = `${width}`;
    iframe.height = `${height}`;
    iframe.onload = () => resolve(iframe);
    iframe.src = `/${trimLeadingSlash(path)}`;
    iframe.style.transform = `scale(${factor})`;
    iframe.style.transformOrigin = '0 0';
    const div = document.createElement('div');
    div.style.overflow = 'hidden';
    div.style.width = `${width * factor}`;
    div.style.height = `${height * factor}`;
    div.style.margin = '20';
    div.appendChild(iframe);
    // $FlowFixMe
    document.body.appendChild(div);
  });
}

if (currentTestSession) {
  if (isMainTestRunner) {
    console.log(`ottr[${currentTestSession}]: preparing to run tests`);
  } else if (currentTestName) {
    console.log(`ottr[${currentTestSession}]: preparing to run ${currentTestName}`);
  }
} else {
  console.log('ottr: this frame is not for running anything!');
}

const addQueryParams = (path, params: {[string]: string | number | boolean}) => {
  const extraParams = Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k].toString())}`)
    .join('&');
  return path.includes('?') ? `${path}&${extraParams}` : `${path}?${extraParams}`;
};

const testNames = {};

export function test(name: string, path: string, fn: (t: any) => any) {
  if (!name) {
    throw new Error(`test name is ${name}`);
  }
  if (!isMainTestRunner && !currentTestName) {
    return;
  }
  if (testNames[name]) {
    throw new Error(`ottr cannot handle duplicate test names: ${name}`);
  }

  if (isMainTestRunner) {
    startTest(
      addQueryParams(path, {'ottr-session': nonnull(currentTestSession), 'ottr-test': name})
    );
  } else if (name === currentTestName) {
    tapeTest.onFinish(done);
    tapeTest(name, fn);
  }
}
