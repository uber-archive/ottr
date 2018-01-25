// @flow

import io from 'socket.io';
import {getOrCreateTest, sessions} from './sessions';

export const setupEndpointsBefore = (app: express$Application) => {
  const prefix = '/_ottr/api';
  app.get(`${prefix}/session/:id`, (req: express$Request, res: express$Response) => {
    const status = ((id: string) => sessions[id])(req.params.id);
    if (!status) {
      res.status(404).send('not found');
    } else {
      res.json(status);
    }
  });
};

const toString = a =>
  a !== null && typeof a !== undefined && a.toString ? a.toString() : JSON.stringify(a);

const convertConsoleLogArgsToString = args => args.map(toString).join('');

export const setupEndpointsAfter = (appServer: net$Server) => {
  const webSocketSession = io(appServer, {path: '/_ottr/socket.io'});

  webSocketSession.on('connection', client => {
    client.on('console', ([session, testName, logType, ...args]) => {
      if (testName) {
        const test = getOrCreateTest(session, testName);
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
    client.on('tests', ([session, , tests]) =>
      Object.keys(tests).map(name => Object.assign(getOrCreateTest(session, name), tests[name]))
    );
    client.on('done', ([session, test]) => (getOrCreateTest(session, test).done = true));
    client.on('fail', ([session, test]) => {
      const t = getOrCreateTest(session, test);
      t.error = true;
      t.done = true;
    });
  });
};
