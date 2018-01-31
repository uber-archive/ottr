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

import path from 'path';
import url from 'url';
import fs from 'fs';
import {resolveSourceMap} from 'source-map-resolve';
import {SourceMapConsumer} from 'source-map';
import promisify from 'util.promisify';

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
  sourceMap;

  constructor(text) {
    this.text = text;
  }

  setSourceMap(sm) {
    this.sourceMap = sm;
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
    // Random note: it seems that the source-map library has trouble with blank lines.
    // It appears to only work to refer to a "nonexistent" last column on the line which is reserved
    // for the \n character itself.
    const result = {
      line: this.line,
      column: nextOffset - this.offsetOfLineStart,
      source: null
    };
    return this.sourceMap ? this.sourceMap.originalPositionFor(result) : result;
  }
}

function urlToPath(u) {
  try {
    return url.parse(u).pathname || u;
  } catch (e) {
    return u;
  }
}

const fixWebpackPath = u =>
  u.match(/^webpack:/) ? path.resolve(urlToPath(u).replace(/^\/+/, '')) : urlToPath(u);

async function createTracker(f) {
  const tracker = new Tracker(f.text);
  try {
    const result = await promisify(resolveSourceMap)(f.text, f.url, (url2, cb) => cb('bad'));
    if (result && result.map) {
      const sm = new SourceMapConsumer(result.map);
      tracker.setSourceMap(sm);
    } else {
      console.warn(`could not load source map for ${f.url}`);
    }
  } catch (e) {
    console.warn(`could not load source map for ${f.url}`, e);
  }
  return tracker;
}

function getSourceMappedOffsets(f, tracker) {
  const pathFromUrl = urlToPath(f.url);
  const offsetsByPath = {};
  for (const offset of f.ranges) {
    const out = {start: tracker.get(offset.start), end: tracker.get(offset.end)};
    let filePath = pathFromUrl;
    const startSource = out.start.source;
    if (startSource && out.end.source && startSource === out.end.source) {
      filePath = fixWebpackPath(startSource);
    } else {
      //TODO: do not commit
      if (pathFromUrl.includes('frontend')) {
        console.warn(`source for start/end dont match :( START`, out.start.source, 'END', out.end.source);
      }
    }
    if (!offsetsByPath[filePath]) {
      offsetsByPath[filePath] = [];
    }
    offsetsByPath[filePath].push(out);
  }
  return offsetsByPath;
}

export async function chromeCoverageToIstanbulJson(chromeCov: ChromeCoverageFileReport[]) {
  const istanbulCov = {};
  for (const f of chromeCov) {
    const tracker = await createTracker(f);

    const offsetsByPath = getSourceMappedOffsets(f, tracker);

    for (const p in offsetsByPath) {
      const statementMap = {};
      const s = {};
      offsetsByPath[p].forEach((o, i) => {
        const id = `${i}`;
        statementMap[id] = {
          start: {line: o.start.line, column: o.start.column},
          end: {line: o.end.line, column: o.end.column}
        };
        s[id] = 1;
      });
      istanbulCov[p] = {path: p, statementMap, s, branchMap: {}, b: {}, fnMap: {}, f: {}};
    }
  }
  // fs.writeFileSync('istanbul.json', JSON.stringify(istanbulCov));
  // console.log('ISTANBUL', Object.keys(istanbulCov));
  return istanbulCov;
}
