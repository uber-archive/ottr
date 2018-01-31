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

type Loc = {line: number, column: number};

type Mapping = {|
  source: string,
  generatedLine: number,
  generatedColumn: number,
  originalLine: number,
  originalColumn: number,
  last?: boolean
|};

export class PreciseSourceMapper {
  mappings: Mapping[] = [];
  generatedCodeLines: (?string)[];
  eof: {[string]: Loc} = {};

  constructor(generatedCode: string, mapJson: Object) {
    this.generatedCodeLines = [null, ...generatedCode.split('\n')];
    const sourceMap = new SourceMapConsumer(mapJson);
    sourceMap.eachMapping(m => this.mappings.push(m), null);
    this.mappings.forEach(m => console.log(m));
    for (let i = 0; i < this.mappings.length; i++) {
      const m = this.mappings[i];
      const source = m.source;
      if (!source) {
        continue;
      }
      let eof = this.eof[source];
      if (!eof || (m.originalLine >= eof.line && m.originalColumn >= eof.column)) {
        eof = this.eof[source] = {line: m.originalLine, column: m.originalColumn};
      }
      const next = this.mappings[i + 1];
      if (next && next.source !== source) {
        const estimate = {
          line: m.originalLine + (next.generatedLine - m.generatedLine),
          column: m.originalColumn + (next.generatedColumn - m.generatedColumn)
        };
        console.log(`estimate ${source} = ${estimate.line},${estimate.column}`);
        if (estimate.line >= eof.line && estimate.column > eof.column) {
          eof = this.eof[source] = estimate;
        }
      }
    }
  }

  originalPositionFor({line, column}: Loc) {
    const mapping = this.findMapping({line, column});
    let l = mapping.originalLine + (line - mapping.generatedLine);
    let c = mapping.originalColumn + (column - mapping.generatedColumn);
    console.log(this.eof);
    const eof = this.eof[mapping.source];
    if (eof && (l >= eof.line || (eof.line === l && c >= eof.column))) {
      console.log(
        `reverting to EOF for ${mapping.source} @ ${l},${c} -> ${eof.line}, ${eof.column}`
      );
      l = eof.line;
      c = eof.column;
    }
    return {
      source: mapping.source,
      line: l,
      column: c
    };
  }

  eofForSource(source: string) {
    return this.eof[source];
  }

  findMapping({line, column}: Loc): Mapping {
    if (line < 1 || column < 0) {
      throw new Error(`invalid position ${line},${column}`);
    }
    for (let i = 0; i < this.mappings.length - 1; i++) {
      const next = this.mappings[i + 1];
      if (next.generatedLine > line && next.generatedColumn > column) {
        return this.mappings[i];
      }
    }
    return this.mappings[this.mappings.length - 1];
  }
}
