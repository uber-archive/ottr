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

import type {Test} from '../../types';

export const DEFAULT_ERROR = 'tests failed';

class Session {
  id: string;
  tests: {[string]: Test} = {};
  error: ?string;
  done: boolean = false;

  constructor(id: string) {
    this.id = id;
  }

  getTests = () => Object.keys(this.tests).map(name => this.tests[name]);

  update() {
    const tests = this.getTests();
    if (!this.error || !this.done) {
      if (!this.error) {
        const failedTests = tests.filter(t => t.error).length;
        if (failedTests) {
          this.error = DEFAULT_ERROR;
        }
      }
      if (!this.done && tests.length) {
        this.done = tests.every(t => t.done);
      }
    }
    return this;
  }
}

type SessionStore = {
  [string]: Session
};

export const sessions: SessionStore = {};

export const getSessions = (): Session[] => Object.keys(sessions).map(id => sessions[id].update());

export const createSession = () => {
  let id = Math.round(Math.random() * 1000);
  while (sessions[`${id}`]) {
    id++;
  }
  return `${id}`;
};
export const getOrCreateSession = (id: string) => {
  if (sessions[id]) {
    return sessions[id].update();
  }
  return (sessions[id] = new Session(id));
};
export const getOrCreateTest = (sessionId: string, name: string): Test => {
  const session = getOrCreateSession(sessionId);

  if (session.tests[name]) {
    return session.tests[name];
  }
  return (session.tests[name] = {
    session: sessionId,
    iteration: 0,
    name,
    path: '?',
    done: false
  });
};
