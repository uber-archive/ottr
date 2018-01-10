// @flow

import io from 'socket.io';
import type {Test} from '../types';

type Session = {
  tests: {[string]: Test}
};
type SessionStore = {
  [string]: Session
};

const sessions: SessionStore = {};

const getTest = (sessionId, name): Test => {
  let session = sessions[sessionId];
  if (!session) {
    session = sessions[sessionId] = {tests: {}};
  }
  if (session.tests[name]) {
    return session.tests[name];
  }
  return (session.tests[name] = {name, path: '?', done: false, error: false});
};

export const setupEndpointsBefore = (app: express$Application) => {
  const prefix = '/_ottr/api';
  app.get(`${prefix}/session/:id`, (req: express$Request, res: express$Response) => {
    const status = sessions[req.params.id];
    if (!status) {
      res.status(404).send('not found');
    } else {
      res.json(status);
    }
  });
};

const convertConsoleLogArgsToString = args =>
  args.map(a => (a !== null && typeof a !== undefined && a.toString ? a.toString() : JSON.stringify(a))).join('');

export const setupEndpointsAfter = (appServer: net$Server) => {
  const webSocketSession = io(appServer, {path: '/_ottr/socket.io'});

  webSocketSession.on('connection', client => {
    client.on('console', ([session, testName, logType, ...args]) => {
      if (testName) {
        const test = getTest(session, testName);
        const line = convertConsoleLogArgsToString(args);
        if (line.match(/^not ok/)) {
          test.error = true;
        }
        if (!test.output) {
          test.output = line;
        } else {
          test.output = `${test.output}\n${line}`;
        }
      }
      (console[logType] || console.log)(...args);
    });
    client.on('done', ([session, test]) => (getTest(session, test).done = true));
    client.on('fail', ([session, test]) => {
      const t = getTest(session, test);
      t.error = true;
      t.done = true;
    });
  });
};
