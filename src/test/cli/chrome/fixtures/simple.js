// Please see ./webpack.sh for details

var dep = require('./dep');

function neverCalled() {
  console.log('never');
}

function definitelyCalled() {
  dep.go();
}

definitelyCalled();