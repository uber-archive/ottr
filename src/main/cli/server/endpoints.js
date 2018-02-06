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

import io from 'socket.io';
import {getOrCreateSession, getOrCreateTest, sessions} from './sessions';
// eslint-disable-next-line no-unused-vars
import type {Test} from '../../types';

export const setupEndpoints = (app: express$Application) =>
  app.get(`${'/_ottr/api'}/session/:id`, (req: express$Request, res: express$Response) => {
    const status = ((id: string) => sessions[id])(req.params.id);
    if (!status) {
      res.status(404).send('not found');
    } else {
      res.json(status);
    }
  });

const toString = a =>
  a !== null && typeof a !== undefined && a.toString ? a.toString() : JSON.stringify(a);

const convertConsoleLogArgsToString = args => args.map(toString).join('');

// https://github.com/facebook/flow/issues/1295
declare class OttrSocket {
  on(name: 'console', fn: (string[]) => any): void;
  on(name: 'tests', fn: ([string, string, {string: Test}]) => any): void;
  on(name: 'done', fn: ([string, string]) => any): void;
  on(name: 'fail', fn: ([string, string, string]) => any): void;
}

export function setupWebSockets(appServer: net$Server) {
  const webSocketSession = io(appServer, {path: '/_ottr/socket.io'});

  webSocketSession.on('connection', (client: OttrSocket & SocketIO$Socket) => {
    client.on('console', ([session, testName, logType, ...args]) => {
      if (testName) {
        const test = getOrCreateTest(session, testName);
        const line = convertConsoleLogArgsToString(args);
        if (line.match(/^not ok/)) {
          test.error = line;
        }
        if (!test.output) {
          test.output = line;
        } else {
          test.output = `${test.output}\n${line}`;
        }
      }
      (console[logType] || console.log)(...args);
    });
    client.on('tests', ([session, , tests]) => {
      Object.keys(tests).map(name => Object.assign(getOrCreateTest(session, name), tests[name]));
      const sess = getOrCreateSession(session);
      if (sess.getTests().length === 0) {
        sess.error = "no tests found in test file - your tests must `import {test} from 'ottr'`";
        sess.update();
      }
    });
    client.on('done', ([session, test]) => (getOrCreateTest(session, test).done = true));
    client.on('fail', ([session, test, reason]) => {
      if (test) {
        const t = getOrCreateTest(session, test);
        t.error = reason || 'unknown error';
        t.done = true;
      } else {
        const s = getOrCreateSession(session);
        s.error = reason || 'unknown error';
        s.done = true;
      }
    });
  });
}
