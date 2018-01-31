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

// TODO: test across 3 files
// TODO: test start is before any file
// TODO: test end is after any file

type Loc = [number, number];

const toRange = ([line, column]) => ({line, column});

function expectCovered(t, istCoverage, relpath, ...ranges: Array<[Loc, Loc]>) {
  const abspath = path.resolve(relpath);
  const cov = istCoverage[abspath];
  t.ok(
    cov,
    `expected coverage info for ${abspath} (got ${Object.keys(istCoverage).join(', ')})`
  );
  t.equal(Object.keys(cov.statementMap).length, ranges.length, `number of covered ranges`);
  ranges.forEach((expectedRange, i) => {
    const prefix = `[${relpath}]`
    const id = `${i}`;
    const r = cov.statementMap[id];
    t.ok(r, `${prefix} range[${i}] found in source map`);
    t.equal(cov.s[id], 1, `${prefix} range covered=true`);
    t.deepEqual(r.start, toRange(expectedRange[0]), `${prefix} range start`);
    t.deepEqual(r.end, toRange(expectedRange[1]), `${prefix} range end`);
  });
}

test('inline source mapping conversion works (within single file)', async t => {
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
  expectCovered(t, istCoverage, 'fixtures/simple.js', [[9, 0], [11, 1]]);
  t.end();
});

test('inline source mapping conversion works (spans across 2 files)', async t => {
  const code = fs.readFileSync(path.resolve(__dirname, 'fixtures/simple-bundle.js'), 'utf8');
  const istCoverage = await chromeCoverageToIstanbulJson([
    {
      url: 'http://localhost:58947/javascript/simple-bundle.js',
      ranges: [
        {
          start: code.indexOf('function definitelyCalled'),
          end: code.indexOf('function depGo')
        }
      ],
      text: code
    }
  ]);
  // Second half of simple.js
  expectCovered(t, istCoverage, 'fixtures/simple.js', [[9, 0], [13, 19]]);
  // First half of dep.js
  expectCovered(t, istCoverage, 'fixtures/dep.js', [[1, 0], [5, 12]]);
  t.end();
});
