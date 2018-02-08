#!/usr/bin/env bash

set -ex

export DEBIAN_FRONTEND=noninteractive

# Specify Node.JS version here
export NODE_VERSION=6.6.0

# Specify node environment
export NODE_ENV=test

# Used by n itself
export N_PREFIX=`pwd`/.n

# Make sure that installed `node` and `n` are exposed in the $PATH
export PATH=`pwd`/.n/node_modules/.bin:$PATH
export PATH=`pwd`/.n/n/versions/node/$NODE_VERSION/bin:$PATH

# Install `n` in the jenkins test workspace inside the `.n` directory
# https://github.com/tj/n
if [ ! -e .n/n/versions/node/$NODE_VERSION/bin ]; then
  mkdir .n
  rm -rf node_modules
  PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 npm install n
  mv node_modules .n/
fi

# Install specified Node.JS version via `n`
n -q $NODE_VERSION

# Unpm-cli will use the specified node version
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 unpm install --development

# Ensure that `npm` is executed with the specified node version
n use $NODE_VERSION $(which npm) run jenkins
