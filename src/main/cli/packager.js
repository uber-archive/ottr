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

import webpack from 'webpack';
import path from 'path';

export const packageForBrowser = (jsEntryPointPath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const folder = path.resolve('.ottr-webpack');
    webpack(
      {
        devtool: 'inline-source-map',
        entry: {
          tests: path.resolve(jsEntryPointPath),
          run: path.resolve(__dirname, '../ui/run-helper.js'),
          ottr: path.resolve(__dirname, '../ui/index.js'),
          repl: path.resolve(__dirname, '../ui/repl-helper.js')
        },
        output: {path: folder, filename: '[name]-bundle.js'},
        resolve: {symlinks: false, alias: {fs: path.resolve(__dirname, 'noop.js')}}
      },
      (err, stats) => {
        const info = stats.toJson();

        if (stats.hasErrors()) {
          console.error(...info.errors);
        }

        if (stats.hasWarnings()) {
          console.warn(...info.warnings);
        }

        if (err || stats.hasErrors()) {
          reject(err);
          return;
        }
        console.log(`[ottr] packaged tests into ${folder}`);
        resolve(folder);
      }
    );
  });
