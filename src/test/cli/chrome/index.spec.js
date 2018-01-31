/*
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

// @flow

import fs from 'fs';
import path from 'path';
import test from 'tape-promise/tape';
import {chromeCoverageToIstanbulJson} from '../../../main/cli/chrome/coverage';

test('inline source mapping conversion works (simple)', async t => {
  const code = fs.readFileSync(path.resolve(__dirname, 'fixtures/simple-bundle.js'), 'utf8');
  const istCoverage = await chromeCoverageToIstanbulJson([
    {
      url: 'http://localhost:58947/javascript/simple-bundle.js',
      ranges: [
        {
          start: code.indexOf('function definitelyCalled'),
          end: 1 + code.indexOf('}', code.indexOf('function definitelyCalled'))
        }
      ],
      text: code
    }
  ]);
  const expectedPathName = path.resolve('fixtures/simple.js');
  const cov = istCoverage[expectedPathName];
  t.ok(cov, `expected coverage info for ${expectedPathName}`);
  t.equal(Object.keys(cov.statementMap).length, 1, 'expected one covered range');
  t.equal(cov.s['0'], 1, 'expected range to be marked as covered');
  const range = cov.statementMap['0'];
  t.ok(range, 'expected one covered range');
  t.deepEqual(range.start, {line: 9, column: 0}, 'covered range starts at definitelyCalled def');
  t.deepEqual(range.end, {line: 11, column: 0}, 'covered range ends at close brace');
  t.end();
});
