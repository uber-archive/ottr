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

import io from 'socket.io-client';
import {currentTestSession, currentTestName} from './session';

let websocket = null;
const getWebSocket = () => {
  if (!websocket) {
    websocket = io({path: '/_ottr/socket.io'});
  }
  return websocket;
};

const assertInTestOrMainFrame = action => {
  if (!currentTestSession) {
    throw new Error(`cannot ${action} when we're not in the ottr main thread or a test`);
  }
};

export const emitEvent = (name: string, ...args: mixed[]) => {
  assertInTestOrMainFrame(`emit ${name}`);
  getWebSocket().emit(name, [currentTestSession, currentTestName, ...args]);
};

export const done = () => emitEvent('done');

export const fail = (reason: ?string) => emitEvent('fail', reason);

if (currentTestSession) {
  console.log('setting up console proxy');
  window.console = new Proxy(console, {
    methods: {},
    get(target: typeof console, property) {
      if (typeof property === 'string' && typeof target[property] === 'function') {
        if (!this.methods[property]) {
          this.methods[property] = (...args) => {
            emitEvent('console', property, ...args);
            target[property](...args);
          };
        }
        return this.methods[property];
      }

      return target[property];
    }
  });

  const handleError = e => {
    console.error(e);
    fail((e && e.message) || JSON.stringify(e));
  };
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleError);
}
