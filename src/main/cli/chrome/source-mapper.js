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
export const greaterThanOrEqN = (aline: number, acolumn: number, bline: number, bcolumn: number) =>
  aline > bline || (aline === bline && acolumn >= bcolumn);

/**
 * @returns {boolean} true if a > b
 */
export const greaterThanOrEq = (a: Loc, b: Loc) =>
  greaterThanOrEqN(a.line, a.column, b.line, b.column);

/**
 * @returns {boolean} true if a > b
 */
export const greaterThanOrEqP = (aline: number, acolumn: number, b: Loc) =>
  greaterThanOrEqN(aline, acolumn, b.line, b.column);

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

const isBetween = (target: Loc, start: Mapping, end: Mapping) =>
  greaterThanOrEqN(target.line, target.column, start.generatedLine, start.generatedColumn) &&
  greaterThanOrEqN(end.generatedLine, end.generatedColumn, target.line, target.column);

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

  originalPositionFor(generated: Loc) {
    const mapping = this.findMapping(generated);
    const {line, column} = generated;
    /* istanbul ignore next */ if (DEBUG) {
      console.log(`${line},${column} - using mapping`, mapping);
    }
    const eof = this.eof[mapping.source];
    const result = {
      generated,
      source: mapping.source,
      line: mapping.originalLine + (line - mapping.generatedLine),
      column:
        mapping.generatedLine < line
          ? column
          : mapping.originalColumn + (column - mapping.generatedColumn)
    };
    if (eof && greaterThanOrEq(result, eof)) {
      /* istanbul ignore next */ if (DEBUG) {
        console.log(
          `reverting to EOF for ${mapping.source} @ ${result.line},${result.column} -> ${
            eof.line
          }, ${eof.column}`
        );
      }
      result.line = eof.line;
      result.column = eof.column;
    }
    return result;
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
    let minIndex = 0;
    let maxIndex = this.mappings.length - 1;

    // Defensive programming - avoid infinite loop in case of bug :)
    for (let counter = 0; minIndex <= maxIndex && counter < 1000; counter++) {
      if (counter === 999) {
        throw new Error(`inf loop finding mapping for ${generatedLoc.line},${generatedLoc.column}`);
      }
      const currentIndex = ((minIndex + maxIndex) / 2) | 0;
      const currentElement = this.mappings[currentIndex];

      if (
        currentIndex + 1 < this.mappings.length &&
        isBetween(generatedLoc, this.mappings[currentIndex], this.mappings[currentIndex + 1])
      ) {
        return currentElement;
      }

      if (
        greaterThanOrEqP(currentElement.generatedLine, currentElement.generatedColumn, generatedLoc)
      ) {
        maxIndex = currentIndex - 1;
      } else {
        minIndex = currentIndex + 1;
      }
    }
    return this.mappings[this.mappings.length - 1];
  }
}
