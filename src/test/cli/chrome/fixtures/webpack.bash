#!/bin/bash
#
# This command-line script compiles 'simple.js' into a webpack source-mapped file. The output file
# is loaded by chrome/index.spec.js.
#
# Must be run from repo root, like
#
# % src/test/cli/chrome/webpack/webpack.bash
#

cd "${0%/*}/.."

../../../../node_modules/.bin/webpack --devtool=inline-source-map fixtures/simple.js fixtures/simple-bundle.js