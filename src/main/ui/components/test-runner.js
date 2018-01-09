// @flow

import React from 'react';
import {nonnull} from '../../util';
import {currentTestSession} from '../../api/session';
import type {Test} from '../types';

const trimLeadingSlash = str => (str[0] === '/' ? str.substring(1) : str);

const addQueryParams = (path, params: {[string]: string | number | boolean}) => {
  const extraParams = Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k].toString())}`)
    .join('&');
  return path.includes('?') ? `${path}&${extraParams}` : `${path}?${extraParams}`;
};

export default function TestRunner({test}: {test: Test}) {
  const width = 1024;
  const height = 800;
  const factor = 0.2;
  return (
    <div
      key={test.name}
      style={{overflow: 'hidden', margin: 10, width: width * factor, height: height * factor}}
    >
      <iframe
        key={test.name}
        style={{width, height, transform: `scale(${factor})`, transformOrigin: '0 0'}}
        src={addQueryParams(`/${trimLeadingSlash(test.path)}`, {
          'ottr-session': nonnull(currentTestSession),
          'ottr-test': test.name
        })}
      />
    </div>
  );
}
