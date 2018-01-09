// @flow
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

const emitEvent = (name, args = []) => {
  assertInTestOrMainFrame(`emit ${name}`);
  getWebSocket().emit(name, [currentTestSession, currentTestName, ...args]);
};

export const done = () => emitEvent('done');

export const fail = () => emitEvent('fail');

if (currentTestSession) {
  console.log('setting up console proxy');
  window.console = new Proxy(console, {
    methods: {},
    get(target, property) {
      if (typeof property === 'string' && typeof target[property] === 'function') {
        if (!this.methods[property]) {
          this.methods[property] = (...args) => {
            emitEvent('console', [property, ...args]);
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
    fail();
  };
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', event => handleError);
}
