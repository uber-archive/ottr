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
