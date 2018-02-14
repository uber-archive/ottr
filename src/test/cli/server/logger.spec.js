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

import test from 'tape-promise/tape';
import {NetworkLogger} from '../../../main/cli/server/logger';
import tmp from 'tmp';
import path from 'path';
import fs from 'fs';

const mockReq = (u, headers): any => ({
  protocol: 'https',
  get: k => headers[k],
  originalUrl: u
});

const mockResp = (): any => ({write() {}, end() {}});

async function simulateLog(l, req, res) {
  const promise = l.log(req, res);
  res.end();
  await promise;
}

test('logger writes initial JSON properly', async t => {
  const {name: dir} = tmp.dirSync();
  const logger = new NetworkLogger(dir);
  await simulateLog(logger, mockReq('/my/path?x=y', {host: 'my-host:3000'}), mockResp());
  const contents = fs.readFileSync(path.resolve(dir, 'sessions/ottr-unknown.har'), 'utf8');
  const {log: {version, creator, pages, entries}} = JSON.parse(contents);
  t.equal(version, '1.2');
  t.equal(creator.name, 'ottr');
  t.equal(pages.length, 1);
  t.equal(pages[0].title, 'https://my-host:3000/my/path?x=y');
  t.equal(entries.length, 1);
  t.equal(entries[0].request.url, 'https://my-host:3000/my/path?x=y');
});

test('logger writes multiple JSON properly', async t => {
  const {name: dir} = tmp.dirSync();
  const logger = new NetworkLogger(dir);
  await simulateLog(logger, mockReq('/my/path?x=y', {host: 'my-host:3000'}), mockResp());
  await simulateLog(logger, mockReq('/other?x=y', {host: 'my-host:3000'}), mockResp());
  await simulateLog(logger, mockReq('/yo?x=y', {host: 'my-host:3000'}), mockResp());
  const contents = fs.readFileSync(path.resolve(dir, 'sessions/ottr-unknown.har'), 'utf8');
  const {log: {version, creator, pages, entries}} = JSON.parse(contents);
  t.equal(version, '1.2');
  t.equal(creator.name, 'ottr');
  t.equal(pages.length, 1);
  t.equal(pages[0].title, 'https://my-host:3000/my/path?x=y');
  t.equal(entries.length, 3);
  t.equal(entries[0].request.url, 'https://my-host:3000/my/path?x=y');
  t.equal(entries[1].request.url, 'https://my-host:3000/other?x=y');
  t.equal(entries[2].request.url, 'https://my-host:3000/yo?x=y');
});

test('logger parses query string from ottr referer', async t => {
  const {name: dir} = tmp.dirSync();
  const logger = new NetworkLogger(dir);
  await simulateLog(
    logger,
    mockReq('/zero?ottr-session=xyz&ottr-test=xy', {
      host: 'my-host:3000',
      referer: 'http://my-host:3000/my/path?x=y'
    }),
    mockResp()
  );
  await simulateLog(
    logger,
    mockReq('/first?x=y', {host: 'my-host:3000', referer: 'http://my-host:3000/my/path?x=y'}),
    mockResp()
  );
  await simulateLog(
    logger,
    mockReq('/second?x=y', {
      host: 'my-host:3000',
      referer: 'http://my-host:3000/my/path?ottr-session=xyz'
    }),
    mockResp()
  );
  await simulateLog(
    logger,
    mockReq('/third?x=y', {
      host: 'my-host:3000',
      referer: 'http://my-host:3000/my/path?ottr-session=xyz&ottr-test=a+b'
    }),
    mockResp()
  );
  const u = p =>
    JSON.parse(fs.readFileSync(path.resolve(dir, 'sessions', p), 'utf8')).log.entries[0].request
      .url;
  t.equal(u('ottr-unknown.har'), 'https://my-host:3000/first?x=y');
  t.equal(u('xyz/ottr-xyz-unknown.har'), 'https://my-host:3000/second?x=y');
  t.equal(u('xyz/a b/ottr-xyz-a b.har'), 'https://my-host:3000/third?x=y');
  t.equal(u('xyz/xy/ottr-xyz-xy.har'), 'https://my-host:3000/zero?ottr-session=xyz&ottr-test=xy');
});

test('logger can handle lots of async traffic', async t => {
  const {name: dir} = tmp.dirSync();
  const logger = new NetworkLogger(dir);
  await Promise.all(
    [...new Array(1000)].map(() =>
      simulateLog(
        logger,
        mockReq('/zero?ottr-session=xyz&ottr-test=xy', {host: 'my-host:3000'}),
        mockResp()
      )
    )
  );
  t.equal(
    JSON.parse(fs.readFileSync(path.resolve(dir, 'sessions/xyz/xy/ottr-xyz-xy.har'), 'utf8')).log
      .entries.length,
    1000
  );
});
