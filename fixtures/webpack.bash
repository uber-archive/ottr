#!/bin/bash
#
# This command-line script compiles 'simple.js' into a webpack source-mapped file. The output file
# is loaded by chrome/index.spec.js.
#

cd "${0%/*}/.."

node_modules/.bin/webpack --devtool=inline-source-map fixtures/simple.js fixtures/simple-bundle.js