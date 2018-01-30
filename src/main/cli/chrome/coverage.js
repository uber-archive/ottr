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

import url from 'url';

type Range = {|
  start: number,
  end: number
|};

type ChromeCoverageFileReport = {|
  url: string,
  ranges: Range[],
  text: string
|};

class Tracker {
  text: string;
  offset: number = 0;
  line: number = 1;
  offsetOfLineStart: number = 0;

  constructor(text) {
    this.text = text;
  }

  get(nextOffset: number) {
    if (nextOffset < this.offset) {
      throw new Error('cannot rewind line/column tracker');
    }
    for (; this.offset < nextOffset; this.offset++) {
      if (this.text[this.offset] === '\n') {
        this.line++;
        this.offsetOfLineStart = this.offset + 1;
      }
    }
    return {
      line: this.line,
      column: nextOffset - this.offsetOfLineStart
    };
  }
}

function splitFileIntoStatements(f) {
  const offsets = [];
  let lastRangeEnd = 0;
  for (const r of f.ranges) {
    if (r.start !== lastRangeEnd) {
      offsets.push({start: lastRangeEnd, end: r.start});
    }
    offsets.push({start: r.start, end: r.end, covered: true});
    lastRangeEnd = r.end;
  }
  if (lastRangeEnd < f.text.length) {
    offsets.push({start: lastRangeEnd, end: f.text.length});
  }
  return offsets;
}

function urlToPath(f) {
  try {
    return url.parse(f.url).pathname || f.url;
  } catch (e) {
    return f.url;
  }
}

export function chromeCoverageToIstanbulJson(chromeCov : ChromeCoverageFileReport[]) {
  const istanbulCov = {};
  for (const f of chromeCov) {
    const path = urlToPath(f);
    const offsets = splitFileIntoStatements(f);
    const statementMap = {};
    const s = {};
    const tracker = new Tracker(f.text);
    offsets.forEach((o, i) => {
      const id = `${i}`;
      statementMap[id] = {start: tracker.get(o.start), end: tracker.get(o.end), o};
      s[id] = o.covered ? 1 : 0;
    });
    istanbulCov[path] = {path, statementMap, s, branchMap: {}, b: {}, fnMap: {}, f: {}};
  }
  return istanbulCov;
}