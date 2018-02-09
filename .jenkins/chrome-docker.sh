#!/bin/bash

set -ex

PORT=$(netstat -aln | awk '
         $6 == "LISTEN" {
           if ($4 ~ "[.:][0-9]+$") {
             split($4, a, /[:.]/);
             port = a[length(a)];
             p[port] = 1
           }
         }
         END {
           for (i = 3000; i < 65000 && p[i]; i++){};
           if (i == 65000) {exit 1};
           print i
         }
       ')
echo "found open port $PORT; launching docker"

# Note that using a named instance is not a problem because Jenkins machines only run one job at a
# time, and our Tape tests only run one test at as time. (If multiple builds need to be run for a
# single project, Jenkins uses different machines for each.)
docker rm -f ottr-chrome || true

# We pass --rm to tell Docker to kill after this run completes. Because Docker kills containers
# asynchronously, however, we still need that 'docker rm' line above.
docker run --rm --name ottr-chrome --publish $PORT:$PORT \
    docker-local.artifactory.uber.internal:5922/web/ottr/chrome-image:latest \
    /opt/google/chrome/chrome --no-sandbox \
    "$@" \
    --remote-debugging-port=$PORT --remote-debugging-address=0.0.0.0