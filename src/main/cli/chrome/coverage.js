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
import promisify from 'util.promisify';
import {DEBUG, PreciseSourceMapper} from './source-mapper';

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
    for (; this.offset < nextOffset && this.offset < this.text.length; this.offset++) {
      if (this.text[this.offset] === '\n') {
        this.line++;
        this.offsetOfLineStart = this.offset + 1;
      }
    }
    return {
      line: this.line,
      column: this.offset - this.offsetOfLineStart
    };
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

async function createSourceMap(f) {
  try {
    const result = await promisify(resolveSourceMap)(f.text, f.url, (url2, cb) => cb('not found'));
    if (result && result.map) {
      return new PreciseSourceMapper(f.text, result.map);
    }
    console.warn(`could not load source map for ${f.url}`);
  } catch (e) {
    console.warn(`could not load source map for ${f.url}`, e);
  }
  return null;
}

function pushAll(sourceMap, start, end, push) {
  if (start.source === end.source) {
    push(fixWebpackPath(start.source), start, end);
  } else {
    push(fixWebpackPath(start.source), start, sourceMap.eofForSource(start.source));
    push(fixWebpackPath(end.source), {line: 1, column: 0}, end);
    sourceMap.getAllSourcesBetweenGeneratedLocations(start.generated, end.generated).map(source => {
      if (source !== start.source && source !== end.source) {
        push(fixWebpackPath(source), {line: 1, column: 0}, sourceMap.eofForSource(source));
      }
    });
  }
}

function getSourceMappedOffsets(f, sourceMap, tracker) {
  const pathFromUrl = urlToPath(f.url);
  const offsetsByPath = {};

  const offsetToLineCol = offset => {
    const chromeLineCol = tracker.get(offset);
    if (!sourceMap) {
      return chromeLineCol;
    }
    const originalLineCol = sourceMap.originalPositionFor(chromeLineCol);
    if (DEBUG) {
      console.log(offset, '->', chromeLineCol, '=>', originalLineCol);
    }
    return originalLineCol;
  };

  function push(filePath, start, end) {
    if (!offsetsByPath[filePath]) {
      offsetsByPath[filePath] = [];
    }
    offsetsByPath[filePath].push({start, end});
  }
  for (const offset of f.ranges) {
    const start = offsetToLineCol(offset.start);
    const end = offsetToLineCol(offset.end);
    if (sourceMap) {
      if (start.source && end.source) {
        pushAll(sourceMap, start, end, push);
      }
    } else {
      push(pathFromUrl, start, end);
    }
  }
  return offsetsByPath;
}

export async function chromeCoverageToIstanbulJson(chromeCov: ChromeCoverageFileReport[]) {
  const istanbulCov = {};
  for (const f of chromeCov) {
    const tracker = new Tracker(f.text);
    const sourceMap = await createSourceMap(f);

    const offsetsByPath = getSourceMappedOffsets(f, sourceMap, tracker);

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
  if (DEBUG) {
    fs.writeFileSync('chrome.json', JSON.stringify(chromeCov));
    fs.writeFileSync('istanbul.json', JSON.stringify(istanbulCov));
    console.log('ISTANBUL', Object.keys(istanbulCov));
  }
  return istanbulCov;
}
