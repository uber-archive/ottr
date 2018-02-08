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

docker run -i --publish $PORT:$PORT docker-local.artifactory.uber.internal:5922/web/ottr/chrome-image:latest /opt/google/chrome/chrome --no-sandbox "$@" --remote-debugging-port=$PORT --remote-debugging-address=0.0.0.0