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

import type {Test} from './types';

export const UI_BASE_URI = '/_ottr/ui';
export const DEFAULT_CONCURRENCY = 4;

const sanitizeFilename = f => f.replace(/[^a-z0-9'_,. ()[]-]/gi, '_');

export function getHarPathForTest(session: string, test: string) {
  const sanitizedFilename = sanitizeFilename(test);
  return `sessions/${session}/${sanitizedFilename}/ottr-${session}-${sanitizedFilename}.har`;
}

const trimLeadingSlash = str => (str[0] === '/' ? str.substring(1) : str);

const paramString = params =>
  Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k].toString())}`)
    .join('&');

export const addQueryParams = (path: string, params: {[string]: string | number | boolean}) =>
  `${path}${path.includes('?') ? '&' : '?'}${paramString(params)}`;

export const getTestUrl = (test: Test) =>
  addQueryParams(`/${trimLeadingSlash(test.path)}`, {
    'ottr-session': test.session,
    'ottr-test': test.name
  });

export const once = <T: Function>(fn: T): T => {
  let called = false;
  // $FlowFixMe
  return (...args) => {
    if (!called) {
      fn(...args);
      called = true;
    }
  };
};

export const logEachLine = (
  prefix: ?string,
  data: {toString: () => string},
  fn: (...any) => any = console.log
) =>
  data
    .toString()
    // remove blank lines
    .replace(/^\n+|\n+$/g, '')
    .split('\n')
    .forEach(line => fn(prefix ? `${prefix} ${line}` : line));

export function nonnull<T: Object | string | number | Array<any>>(value?: ?T): T {
  if (value === null || value === undefined) {
    throw new Error('value cannot be null');
  }
  return value;
}

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
export const failAfter = (ms: number): Promise<void> =>
  new Promise((resolve, reject) => setTimeout(() => reject(`timeout after ${ms}ms`), ms));
