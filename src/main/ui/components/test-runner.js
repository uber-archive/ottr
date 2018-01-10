// @flow

import React from 'react';
import type {Test} from '../../types';
import {getTestUrl} from '../../util';

export default function TestRunner({test, fullscreen}: {test: Test, fullscreen?: boolean}) {
  const width = 1024;
  const height = 800;
  const factor = fullscreen ? 1 : 0.2;
  const outer = {overflow: 'hidden', width: width * factor, height: height * factor};
  const inner = {
    width,
    height,
    transform: fullscreen ? undefined : `scale(${factor})`,
    transformOrigin: '0 0'
  };
  return (
    <div key={test.name} style={outer}>
      <iframe key={`${test.name}-${test.iteration}`} style={inner} src={getTestUrl(test)} />
    </div>
  );
}
