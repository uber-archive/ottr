#!/usr/bin/env node

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

// a fairly complex CLI defined using the yargs 3.0 API:
const argv = require('yargs')
  .usage('Usage: $0 <cmd> [options]') // usage string of application.
  .command('install', 'install a package (name@version)') // describe commands available.
  .command('publish', 'publish the package inside the current working directory')
  .option('f', {
    // document options.
    array: true, // even single values will be wrapped in [].
    description: 'an array of files',
    default: 'test.js',
    alias: 'file'
  })
  .alias('f', 'fil')
  .option('h', {
    alias: 'help',
    description: 'display help message'
  })
  .string(['user', 'pass'])
  .implies('user', 'pass') // if 'user' is set 'pass' must be set.
  .help('help')
  .demand('q') // fail if 'q' not provided.
  .version('1.0.1', 'version', 'display version information') // the version string.
  .alias('version', 'v')
  // show examples of application in action.
  .example('npm install npm@latest -g', 'install the latest version of npm')
  // final message to display when successful.
  .epilog('for more information visit https://github.com/chevex/yargs')
  // disable showing help on failures, provide a final message
  // to display for errors.
  .showHelpOnFail(false, 'whoops, something went wrong! run with --help').argv;

// the parsed data is stored in argv.
console.log(argv);
