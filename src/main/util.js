// @flow

import type {Test} from './types';

export const UI_BASE_URI = '/_ottr/ui';

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
