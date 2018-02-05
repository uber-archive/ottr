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

type Loc = [number, number];

const toRange = ([line, column]) => ({line, column});

// TODO: test interpolation

const convertWithoutInterpolation = chromeCov =>
  chromeCoverageToIstanbulJson(chromeCov, false, false);

const fixture = p => fs.readFileSync(path.resolve(__dirname, 'fixtures', p), 'utf8');

function expectCovered(t, istCoverage, relpath, ...ranges: Array<[Loc, Loc]>) {
  const abspath = path.resolve(relpath);
  const cov = istCoverage[abspath];
  t.ok(cov, `expected coverage info for ${abspath} (got ${Object.keys(istCoverage).join(', ')})`);
  t.equal(Object.keys(cov.statementMap).length, ranges.length, `number of covered ranges`);
  ranges.forEach((expectedRange, i) => {
    const prefix = `[${path.basename(relpath)}]`;
    const id = `${i}`;
    const r = cov.statementMap[id];
    t.ok(r, `${prefix} range[${i}] found in source map`);
    t.equal(cov.s[id], 1, `${prefix} range covered=true`);
    t.deepEqual(r.start, toRange(expectedRange[0]), `${prefix} range start`);
    t.deepEqual(r.end, toRange(expectedRange[1]), `${prefix} range end`);
  });
}

test('inline source mapping conversion works (within single file)', async t => {
  const code = fixture('simple-bundle.js');
  const istCoverage = await convertWithoutInterpolation([
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
  expectCovered(t, istCoverage, 'fixtures/simple.js', [[10, 0], [12, 1]]);
  t.end();
});

test('inline source mapping conversion works (spans across 2 files)', async t => {
  const code = fixture('simple-bundle.js');
  const istCoverage = await convertWithoutInterpolation([
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
  // Second half of simple.js (Webpack generates bad source maps so this includes Webpack footer)
  expectCovered(t, istCoverage, 'fixtures/simple.js', [[10, 0], [21, 20]]);
  // First half of dep.js
  expectCovered(t, istCoverage, 'fixtures/dep.js', [[1, 0], [5, 12]]);
  t.end();
});

test('inline source mapping conversion works (spans across 3 files)', async t => {
  const code = fixture('simple-bundle.js');
  const istCoverage = await convertWithoutInterpolation([
    {
      url: 'http://localhost:58947/javascript/simple-bundle.js',
      ranges: [
        {
          start: code.indexOf('function definitelyCalled'),
          end: code.indexOf('function anotherDependency')
        }
      ],
      text: code
    }
  ]);
  // Second half of simple.js
  expectCovered(t, istCoverage, 'fixtures/simple.js', [[10, 0], [21, 20]]);
  // all of dep.js
  expectCovered(t, istCoverage, 'fixtures/dep.js', [[1, 0], [19, 20]]);
  // First half of dep2.js
  expectCovered(t, istCoverage, 'fixtures/dep2.js', [[1, 0], [3, 6]]);
  t.end();
});

test('inline source mapping conversion works (spans before files)', async t => {
  const code = fixture('simple-bundle.js');
  const istCoverage = await convertWithoutInterpolation([
    {
      url: 'http://localhost:58947/javascript/simple-bundle.js',
      ranges: [
        {
          start: 0,
          end: 1 + code.indexOf('}', code.indexOf('function definitelyCalled'))
        }
      ],
      text: code
    }
  ]);
  expectCovered(t, istCoverage, 'fixtures/simple.js', [[1, 0], [12, 1]]);
  t.end();
});

test('inline source mapping conversion works (spans after files)', async t => {
  const code = fixture('simple-bundle.js');
  const istCoverage = await convertWithoutInterpolation([
    {
      url: 'http://localhost:58947/javascript/simple-bundle.js',
      ranges: [
        {
          start: code.indexOf('function definitelyCalled'),
          end: code.length - 1
        }
      ],
      text: code
    }
  ]);
  expectCovered(t, istCoverage, 'fixtures/simple.js', [[10, 0], [21, 20]]);
  t.end();
});

test('inline source mapping conversion works (real life example)', async t => {
  const chromeCov = JSON.parse(fixture('real-chrome-coverage.json'));
  const istCoverage = await convertWithoutInterpolation(chromeCov);
  const FILENAME =
    '/private/var/folders/y0/jkbr7bys0v91r7xgsv_rdddm0000gn/T/tmp-55738LNEC2LQ8ESe9/src/gui/frontend.js';
  expectCovered(t, istCoverage, FILENAME, [[1, 2], [5, 20]], [[7, 4], [8, 12]]);
  t.end();
});
