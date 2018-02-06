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

import test from 'tape-promise/tape';
import {merge} from '../../../main/cli/chrome/coverage';
import type {ChromeRegion} from '../../../main/cli/chrome/coverage';

const toRange = (arr): ChromeRegion[] => arr.map(([start, end]) => ({start, end}));

type Pairs = [number, number][];
const mymerge = (a: Pairs, b: Pairs): Pairs => {
  const target = toRange(a);
  merge(target, toRange(b));
  return target.map(({start, end}) => [start, end]);
};

const junkPrefix = arr => [[-20, -18], [-10, -5], [-2, 0], ...arr];
const junkSuffix = arr => [...arr, [50, 55], [100, 101], [105, 200]];
const junkWrapped = arr => junkPrefix(junkSuffix(arr));

function tryBoth(t, a: Pairs, b: Pairs, c: Pairs, name: string) {
  t.deepEqual(mymerge(a, b), c, name);
  t.deepEqual(mymerge(b, a), c, `${name} (reverse)`);
}

function tryMerge(t, a: Pairs, b: Pairs, expected: Pairs, name: string) {
  tryBoth(t, a, b, expected, name);
  tryBoth(t, junkPrefix(a), b, junkPrefix(expected), `${name} (junk prefix a)`);
  tryBoth(t, a, junkPrefix(b), junkPrefix(expected), `${name} (junk prefix b)`);
  tryBoth(t, junkSuffix(a), b, junkSuffix(expected), `${name} (junk prefix a)`);
  tryBoth(t, a, junkSuffix(b), junkSuffix(expected), `${name} (junk prefix b)`);
  tryBoth(t, junkWrapped(a), b, junkWrapped(expected), `${name} (junk wrap a)`);
  tryBoth(t, a, junkWrapped(b), junkWrapped(expected), `${name} (junk wrap b)`);
}

test('merging intervals works', t => {
  tryMerge(t, [[1, 5]], [], [[1, 5]], 'just one target interval');
  tryMerge(t, [[1, 2]], [[3, 5]], [[1, 2], [3, 5]], 'non overlapping');
  tryMerge(t, [[1, 5]], [[1, 2]], [[1, 5]], 'fully contained');
  tryMerge(t, [[1, 5]], [[1, 5]], [[1, 5]], 'fully contained');
  tryMerge(t, [[1, 5]], [[2, 5]], [[1, 5]], 'fully contained');
  tryMerge(t, [[1, 3]], [[2, 5]], [[1, 5]], 'overlap');
  tryMerge(t, [[1, 2]], [[2, 5]], [[1, 5]], 'adjacent');
  tryMerge(t, [[1, 2], [3, 4]], [[1, 4]], [[1, 4]], 'one interval spans multiple intervals');
  tryMerge(t, [[2, 3], [4, 5]], [[1, 10]], [[1, 10]], 'one interval spans multiple intervals');
  tryMerge(
    t,
    [[2, 3], [4, 5], [5, 6]],
    [[1, 10]],
    [[1, 10]],
    'one interval spans multiple intervals'
  );
  tryMerge(t, [[1, 5], [6, 10]], [[4, 7]], [[1, 10]], 'causes multiple intervals to be merged');

  t.end();
});
