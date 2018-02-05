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

import {SourceMapConsumer} from 'source-map';

export const DEBUG = false;

type Loc = {line: number, column: number};

type Mapping = {|
  source: string,
  generatedLine: number,
  generatedColumn: number,
  originalLine: number,
  originalColumn: number
|};

/**
 * @returns {boolean} true if a > b
 */
export const greaterThanOrEq = (a: Loc, b: Loc) =>
  a.line > b.line || (a.line === b.line && a.column >= b.column);

function getEndPosition(code): Loc {
  let line = 1;
  let column = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') {
      line++;
      column = 0;
    } else {
      column++;
    }
  }
  return {line, column};
}

export class PreciseSourceMapper {
  mappings: Mapping[] = [];
  generatedCodeLines: (?string)[];
  eof: {[string]: Loc} = {};

  constructor(generatedCode: string, mapJson: Object) {
    this.generatedCodeLines = [null, ...generatedCode.split('\n')];
    const sourceMap = new SourceMapConsumer(mapJson);
    sourceMap.eachMapping(m => this.mappings.push(m), null);
    /* istanbul ignore next */ if (DEBUG) {
      this.mappings.forEach(m => console.log(m));
    }
    this.calculateEofs();
    this.checkSourcesForEofs(sourceMap);
    /* istanbul ignore next */ if (DEBUG) {
      console.log('EOFs', this.eof);
    }
  }

  getEof(source: string) {
    return this.eof[source];
  }

  calculateEofs() {
    for (let i = 0; i < this.mappings.length; i++) {
      const m = this.mappings[i];
      const source = m.source;
      if (!source) {
        continue;
      }
      let eof = this.eof[source];
      if (!eof || greaterThanOrEq({line: m.originalLine, column: m.originalColumn}, eof)) {
        eof = this.eof[source] = {line: m.originalLine, column: m.originalColumn};
      }
      const next = this.mappings[i + 1];
      if (next && next.source !== source) {
        const estimate = {
          line: m.originalLine + (next.generatedLine - m.generatedLine),
          column: m.originalColumn + (next.generatedColumn - m.generatedColumn)
        };
        if (greaterThanOrEq(estimate, eof)) {
          eof = this.eof[source] = estimate;
        }
      }
    }
  }

  checkSourcesForEofs(sourceMap: SourceMapConsumer) {
    for (const source in this.eof) {
      const originalCode = sourceMap.sourceContentFor(source, true);
      if (!originalCode || !originalCode.length) {
        continue;
      }
      const end = getEndPosition(originalCode);
      if (greaterThanOrEq(end, this.eof[source])) {
        /* istanbul ignore next */ if (DEBUG) {
          console.log(
            `source map did not include end position for ${source} - increased eof from `,
            this.eof[source],
            '->',
            end
          );
          console.log(originalCode);
        }
        this.eof[source] = end;
      }
    }
  }

  originalPositionFor({line, column}: Loc) {
    const mapping = this.findMapping({line, column});
    /* istanbul ignore next */ if (DEBUG) {
      console.log(`${line},${column} - using mapping`, mapping);
    }
    let l = mapping.originalLine + (line - mapping.generatedLine);
    let c =
      mapping.generatedLine < line
        ? column
        : mapping.originalColumn + (column - mapping.generatedColumn);
    const eof = this.eof[mapping.source];
    if (eof && greaterThanOrEq({line: l, column: c}, eof)) {
      /* istanbul ignore next */ if (DEBUG) {
        console.log(
          `reverting to EOF for ${mapping.source} @ ${l},${c} -> ${eof.line}, ${eof.column}`
        );
      }
      l = eof.line;
      c = eof.column;
    }
    return {
      source: mapping.source,
      line: l,
      column: c,
      generated: {line, column}
    };
  }

  getAllSourcesBetweenGeneratedLocations(startGen: Loc, endGen: Loc) {
    const sources = {};
    for (const m of this.mappings) {
      const gen = {line: m.generatedLine, column: m.generatedColumn};
      if (m.source && greaterThanOrEq(gen, startGen) && greaterThanOrEq(endGen, gen)) {
        sources[m.source] = true;
      }
    }
    /* istanbul ignore next */ if (DEBUG) {
      console.log(startGen, endGen, Object.keys(sources));
    }
    return Object.keys(sources);
  }

  eofForSource(source: string) {
    return this.eof[source];
  }

  findMapping(generatedLoc: Loc): Mapping {
    if (generatedLoc.line < 1 || generatedLoc.column < 0) {
      throw new Error(`invalid position ${generatedLoc.line},${generatedLoc.column}`);
    }
    for (let i = 0; i < this.mappings.length - 1; i++) {
      const next = this.mappings[i + 1];
      const test = {line: next.generatedLine, column: next.generatedColumn};
      if (greaterThanOrEq(test, generatedLoc)) {
        return this.mappings[i];
      }
    }
    return this.mappings[this.mappings.length - 1];
  }
}
