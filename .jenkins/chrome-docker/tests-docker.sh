#!/usr/bin/env bash

chromium --headless --disable-gpu --screenshot https://time.is/
# TODO: don't hardcode node 6.6
n use 6.6.0 $(which npm) run jenkins
