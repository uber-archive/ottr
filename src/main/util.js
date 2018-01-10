// @flow

import {currentTestSession} from './api/session';
import type {Test} from './types';

const trimLeadingSlash = str => (str[0] === '/' ? str.substring(1) : str);

const paramString = params =>
  Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k].toString())}`)
    .join('&');

const addQueryParams = (path, params: {[string]: string | number | boolean}) =>
  `${path}${path.includes('?') ? '&' : '?'}${paramString(params)}`;

export const getTestUrl = (test: Test) =>
  addQueryParams(`/${trimLeadingSlash(test.path)}`, {
    'ottr-session': nonnull(currentTestSession),
    'ottr-test': test.name
  });

export function nonnull<T: Object | string | number | Array<any>>(value?: ?T): T {
  if (value === null || value === undefined) {
    throw new Error('value cannot be null');
  }
  return value;
}
