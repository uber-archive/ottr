/* eslint-disable node/no-missing-require */
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

import fs from 'fs';
import url from 'url';
import path from 'path';
import {asyncMkdirp} from '../util';
import BufferHelper from 'bufferhelper';
import {getHarPathForTest} from '../../util';

function getSessionAndTestName(reqUrl) {
  try {
    const params = url.parse(reqUrl, true).query || {};
    return {
      session: params['ottr-session'],
      test: params['ottr-test']
    };
  } catch (e) {
    return {};
  }
}

function getHarFilePathFromUrl(reqUrl, referer) {
  try {
    const testFromUrl = getSessionAndTestName(reqUrl);
    const testFromReferer = getSessionAndTestName(referer || '');
    let {session, test} = testFromUrl;
    if ((!session && testFromReferer.session) || (!test && testFromReferer.test)) {
      session = testFromReferer.session;
      test = testFromReferer.test;
    }
    if (session && test) {
      return getHarPathForTest(session, test);
    }
    if (session) {
      return `sessions/${session}/ottr-${session}-unknown.har`;
    }
  } catch (e) {
    console.warn(`[ottr] error parsing URL for network logging`, e);
  }
  return 'sessions/ottr-unknown.har';
}

const genRequest = (req, reqUrl) => ({
  method: req.method,
  url: reqUrl,
  httpVersion: `HTTP/${req.httpVersion}`,
  headers: (req.rawHeaders || [])
    .filter((_, i) => i % 2 === 0)
    .reduce((h, name, i) => h.concat({name, value: req.rawHeaders[i * 2 + 1]}), []),
  queryString: Object.keys(req.params || {}).map(name => ({name, value: req.params[name]})),
  cookies: req.cookies ? Object.keys(req.cookies).map(name => req.cookies[name]) : [],
  headersSize: -1,
  bodySize: req.body ? req.body.length : 0
  // TODO: include post data?
});

const genResHeaders = res =>
  // $FlowFixMe
  Object.keys(res._headers || {}).map(name => ({
    // $FlowFixMe
    name: res._headerNames[name],
    // $FlowFixMe
    value: `${res._headers[name]}`
  }));

const genResponse = (res, body) => ({
  status: res.statusCode,
  statusText: 'OK',
  // $FlowFixMe
  httpVersion: (res._header || '').substring(0, 8),
  headers: genResHeaders(res),
  cookies: [],
  content: {
    size: body.length,
    // $FlowFixMe
    mimeType: (res._headers && res._headers['content-type']) || '',
    compression: -1,
    // TODO: interpret charset from content-type
    text: body.toString()
  },
  redirectURL: '',
  headersSize: -1,
  bodySize: body.length,
  _transferSize: -1
});

const getRequestStartDate = (req: express$Request) => Number(req.ottrStart || 0);

const generateHarEntry = (reqUrl, req, res, body, timelineStartMs) => ({
  startedDateTime: new Date(getRequestStartDate(req)).toISOString(),
  time: getRequestStartDate(req) - timelineStartMs,
  request: genRequest(req, reqUrl),
  response: genResponse(res, body),
  timings: {
    blocked: -1,
    dns: -1,
    ssl: -1,
    connect: -1,
    send: -1,
    wait: Date.now() - getRequestStartDate(req),
    receive: 0
  },
  cache: {}
});

let ottrVersion = 'UNKNOWN';
try {
  // $FlowFixMe
  ottrVersion = require('../../../package.json').version;
} catch (e) {
  /* it's ok; we're in a test */
}
if (!ottrVersion) {
  ottrVersion = require('../../../../package.json').version;
}

const generatePage = u => ({
  // TODO: use real request date
  startedDateTime: new Date().toISOString(),
  title: u,
  id: '0',
  pageTimings: {
    onContentLoad: -1,
    onLoad: -1
  }
});

const CLOSE_BRACES = `    ]
  }
}
`;

const closeAsync = stream =>
  new Promise((resolve, reject) =>
    stream.end((err, result) => (err ? reject(err) : resolve(result)))
  );

export class NetworkLogger {
  root: string;
  timelineStartDates: {[string]: number} = {};

  constructor(rootPath: string) {
    this.root = rootPath;
  }

  log = (req: express$Request, res: express$Response): Promise<*> =>
    new Promise((resolve, reject) => {
      const {write, end} = res;
      const buffer = new BufferHelper();
      const self = this;
      // $FlowFixMe
      res.write = function ottrInterceptWrite(chunk: Buffer | string) {
        try {
          // for some reason http-proxy-response-rewrite gets away with assuming Buffer and not
          // string, so we do that too
          buffer.concat(chunk);
        } catch (e) {
          self.logError(e);
        }
        return write.apply(res, arguments);
      };
      // $FlowFixMe
      res.end = function ottrInterceptEnd(chunkOrCallback?: Buffer | string | Function) {
        try {
          if (chunkOrCallback instanceof Buffer) {
            buffer.concat(chunkOrCallback);
          }
          self
            .logAsync(req, res, buffer.toBuffer())
            .then(resolve)
            .catch(reject);
        } catch (e) {
          self.logError(e);
        }
        return end.apply(res, arguments);
      };
    });

  logError = (...args: any[]) =>
    console.error('[ottr] error attempting to log network traffic', ...args);

  getTimelineStartDateMs(harFilePath: string, req: express$Request) {
    if (this.timelineStartDates[harFilePath]) {
      return this.timelineStartDates[harFilePath];
    }
    return (this.timelineStartDates[harFilePath] = getRequestStartDate(req));
  }

  logAsync = async (req: express$Request, res: express$Response, body: Buffer) => {
    const reqUrl = `${req.protocol}://${req.get('host') || ''}${req.originalUrl}`;
    const harFile = path.resolve(this.root, getHarFilePathFromUrl(reqUrl, req.get('referer')));
    await asyncMkdirp(path.dirname(harFile));
    const fd = fs.openSync(harFile, 'a+');
    const size = fs.fstatSync(fd).size;
    let start = 0;
    const append = size > 0;
    if (append) {
      start = size - CLOSE_BRACES.length;
    }
    const stream = fs.createWriteStream('(ignored cuz we pass fd)', {fd, start, encoding: 'utf8'});
    if (append) {
      stream.write(',\n      ');
    } else {
      stream.write(`{
  "log": {
    "version": "1.2",
    "creator": {
      "name": "ottr",
      "version": "${ottrVersion}"
    },
    "pages": ${JSON.stringify([generatePage(reqUrl)], null, 2)},
    "entries": [
      `);
    }
    stream.write(
      JSON.stringify(
        generateHarEntry(reqUrl, req, res, body, this.getTimelineStartDateMs(harFile, req)),
        null,
        2
      )
    );
    stream.write(CLOSE_BRACES);
    await closeAsync(stream);
  };
}
