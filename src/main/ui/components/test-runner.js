// @flow

import React from 'react';
import {nonnull} from '../../util';
import {currentTestSession} from '../../api/session';
import type {Test} from '../types';

const trimLeadingSlash = str => (str[0] === '/' ? str.substring(1) : str);

const paramString = params =>
  Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k].toString())}`)
    .join('&');

const addQueryParams = (path, params: {[string]: string | number | boolean}) =>
  `${path}${path.includes('?') ? '&' : '?'}${paramString(params)}`;

export default function TestRunner({test}: {test: Test}) {
  const width = 1024;
  const height = 800;
  const factor = 0.2;
  const outer = {overflow: 'hidden', margin: 10, width: width * factor, height: height * factor};
  const inner = {width, height, transform: `scale(${factor})`, transformOrigin: '0 0'};
  return (
    <div key={test.name} style={outer}>
      <div style={{background: 'lightgray', fontSize: '16px', padding: '0.5em'}}>{test.name}</div>
      <iframe
        key={test.name}
        style={inner}
        src={addQueryParams(`/${trimLeadingSlash(test.path)}`, {
          'ottr-session': nonnull(currentTestSession),
          'ottr-test': test.name
        })}
      />
    </div>
  );
}
