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

import path from 'path';
import url from 'url';
import fs from 'fs';
import {resolveSourceMap} from 'source-map-resolve';
import promisify from 'util.promisify';
import {DEBUG, greaterThanOrEq, locsEqual, PreciseSourceMapper} from './source-mapper';
import type {Loc} from './source-mapper';

export type ChromeRegion = {|
  start: number,
  end: number
|};

type ChromeCoverageFileReport = {|
  url: string,
  ranges: ChromeRegion[],
  text: string
|};

type IntermediateRegion = {start: Loc, end: Loc, source: string, covered: boolean};

type IntermediateRegionsByPath = {[string]: IntermediateRegion[]};

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
      throw new Error(`cannot rewind line/column tracker to ${nextOffset} (was at ${this.offset})`);
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
  path.resolve(u.match(/^webpack:/) ? urlToPath(u).replace(/^\/+/, '') : urlToPath(u));

async function createSourceMap(f): Promise<?PreciseSourceMapper> {
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
    push(start.source, start, end, true);
  } else {
    push(start.source, start, sourceMap.eofForSource(start.source), true);
    push(end.source, {line: 1, column: 0}, end, true);
    sourceMap.getAllSourcesBetweenGeneratedLocations(start.generated, end.generated).map(source => {
      if (source !== start.source && source !== end.source) {
        push(source, {line: 1, column: 0}, sourceMap.eofForSource(source), true);
      }
    });
  }
}

function inferNonCoveredRegions(sourceMap, offsetsByPath: IntermediateRegionsByPath) {
  for (const p in offsetsByPath) {
    const offsets = offsetsByPath[p];
    if (!offsets.length) {
      continue;
    }
    offsets.sort(
      (a, b) => (locsEqual(a.start, b.start) ? 0 : greaterThanOrEq(a.start, b.start) ? 1 : -1)
    );
    let source = null;
    let line = 1;
    let column = 0;
    for (let i = 0; i < offsets.length; i++) {
      source = source || offsets[i].source;
      if (!source) {
        continue;
      }
      const offset = offsets[i];
      if (line !== offset.start.line || column !== offset.start.column) {
        offsets.splice(i, 0, {
          start: {line, column},
          end: {...offsets[i].start},
          source,
          covered: false
        });
        i++;
      }
      line = offset.end.line;
      column = offset.end.column;
    }
    const eof = sourceMap && source ? sourceMap.getEof(source) : null;
    if (
      source &&
      eof &&
      greaterThanOrEq(eof, {line, column}) &&
      !(line === eof.line && column === eof.column)
    ) {
      offsets.push({
        start: {line, column},
        end: {...eof},
        source,
        covered: false
      });
    }
  }
}

function interpolateLinesWithoutSourceMaps(offsetsByPath) {
  for (const p in offsetsByPath) {
    const offsets = offsetsByPath[p];
    if (!offsets.length) {
      continue;
    }
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      if (offset.start.line === offset.end.line) {
        continue;
      }
      const originalEndLine = offset.end.line;
      const originalEndColumn = offset.end.column;
      offset.end = {
        ...offset.end,
        line: offset.start.line,
        // TODO: actually calculate line length
        column: offset.start.column + 1
      };

      for (let line = offset.start.line + 1; line <= originalEndLine - 1; line++) {
        offsets.splice(i + 1, 0, {
          ...offset,
          start: {line, column: 0},
          // TODO: actually calculate line length
          end: {line, column: 1}
        });
        i++;
      }
      offsets.splice(i + 1, 0, {
        ...offset,
        start: {line: originalEndLine, column: 0},
        end: {line: originalEndLine, column: originalEndColumn}
      });
      i++;
    }
  }
}

function getSourceMappedOffsets(
  f: ChromeCoverageFileReport,
  sourceMap: ?PreciseSourceMapper,
  tracker
): IntermediateRegionsByPath {
  const pathFromUrl = urlToPath(f.url);
  const offsetsByPath: IntermediateRegionsByPath = {};

  const offsetToLineCol = offset => {
    const chromeLineCol = tracker.get(offset);
    if (!sourceMap) {
      return chromeLineCol;
    }
    const originalLineCol = sourceMap.originalPositionFor(chromeLineCol);
    /* istanbul ignore next */ if (DEBUG) {
      console.log(offset, '->', chromeLineCol, '=>', originalLineCol);
    }
    return originalLineCol;
  };

  function push(source, start, end, covered) {
    const p = fixWebpackPath(source);
    if (!offsetsByPath[p]) {
      offsetsByPath[p] = [];
    }
    offsetsByPath[p].push({start, end, source, covered});
  }

  let logged = false;
  for (const offset of f.ranges) {
    try {
      const start = offsetToLineCol(offset.start);
      const end = offsetToLineCol(offset.end);
      if (sourceMap) {
        if (start.source && end.source) {
          pushAll(sourceMap, start, end, push);
        }
      } else {
        push(pathFromUrl, start, end, true);
      }
    } catch (e) {
      if (!logged) {
        logged = true;
        console.error(`error source mapping ${f.url}`, e);
      }
    }
  }
  return offsetsByPath;
}

const containsEntirely = (big, small) => big.start <= small.start && big.end >= small.end;

const intersectsOrAdjacent = (a, b) => b.start <= a.end && a.start <= b.end;

export function merge(target: ChromeRegion[], source: ChromeRegion[]) {
  let ti = 0;
  for (const toInsert of source) {
    while (ti < target.length && target[ti].end < toInsert.start) {
      ti++;
    }
    while (ti < target.length && containsEntirely(toInsert, target[ti])) {
      target.splice(ti, 1);
    }
    const tcurrent = target[ti];
    if (!tcurrent) {
      target.push(toInsert);
    } else if (!containsEntirely(tcurrent, toInsert)) {
      if (intersectsOrAdjacent(tcurrent, toInsert)) {
        tcurrent.start = Math.min(tcurrent.start, toInsert.start);
        tcurrent.end = Math.max(tcurrent.end, toInsert.end);
        while (ti < target.length - 1 && intersectsOrAdjacent(tcurrent, target[ti + 1])) {
          tcurrent.start = Math.min(tcurrent.start, target[ti + 1].start);
          tcurrent.end = Math.max(tcurrent.end, target[ti + 1].end);
          target.splice(ti + 1, 1);
        }
      } else if (toInsert.start < tcurrent.start) {
        target.splice(ti, 0, toInsert);
      }
      // else condition is not possible
    }
  }
}

function sortAndMergeOverlaps(ranges: ChromeRegion[]) {
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1];
    const cur = ranges[i];
    if (prev.end >= cur.start) {
      console.warn('[ottr] Chrome coverage includes overlapping source regions... merging!');
      prev.start = Math.min(prev.start, cur.start);
      prev.end = Math.max(prev.end, cur.end);
      ranges.splice(i, 1);
      i--;
    }
  }
}

function mergeCoverageRecordsForIframes(chromeCov): ChromeCoverageFileReport[] {
  const byUrl = {};
  const extras = [];
  for (const f of chromeCov) {
    sortAndMergeOverlaps(f.ranges);
    const merged = byUrl[f.url];
    if (!merged) {
      byUrl[f.url] = f;
    } else if (f.text === merged.text) {
      console.warn(`[ottr] merging multiple iframe source maps for ${f.url}`);
      merge(merged.ranges, f.ranges);
    } else {
      console.warn(
        `[ottr] yuck, Chrome gave us multiple source maps that don't match for ${f.url}`
      );
      extras.push(f);
    }
  }
  return [...Object.keys(byUrl).map(k => byUrl[k]), ...extras];
}

export async function chromeCoverageToIstanbulJson(
  chromeCov: ChromeCoverageFileReport[],
  inferNonCovered: boolean = true,
  ensureAllLinesMapped: boolean = true
) {
  const istanbulCov = {};
  for (const f of mergeCoverageRecordsForIframes(chromeCov)) {
    console.log(`[ottr] ${f.url} - parsing`);
    const tracker = new Tracker(f.text);
    const sourceMap = await createSourceMap(f);

    console.log(`[ottr] ${f.url} - source mapping`);
    const offsetsByPath: IntermediateRegionsByPath = getSourceMappedOffsets(f, sourceMap, tracker);

    if (inferNonCovered) {
      console.log(`[ottr] ${f.url} - marking non-covered regions`);
      inferNonCoveredRegions(sourceMap, offsetsByPath);
    }
    if (ensureAllLinesMapped) {
      console.log(`[ottr] ${f.url} - splitting multi-line regions`);
      interpolateLinesWithoutSourceMaps(offsetsByPath);
    }

    console.log(`[ottr] ${f.url} - converting to Istanbul format`);
    for (const p in offsetsByPath) {
      const statementMap = {};
      const s = {};
      offsetsByPath[p].forEach((o, i) => {
        const id = `${i}`;
        statementMap[id] = {
          start: {line: o.start.line, column: o.start.column},
          end: {line: o.end.line, column: o.end.column}
        };
        s[id] = o.covered ? 1 : 0;
      });
      istanbulCov[p] = {path: p, statementMap, s, branchMap: {}, b: {}, fnMap: {}, f: {}};
    }
  }
  /* istanbul ignore next */ if (DEBUG) {
    fs.writeFileSync('chrome.json', JSON.stringify(chromeCov));
    fs.writeFileSync('istanbul.json', JSON.stringify(istanbulCov));
    console.log('ISTANBUL', Object.keys(istanbulCov));
  }
  return istanbulCov;
}
