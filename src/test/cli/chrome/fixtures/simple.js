// Please see ./webpack.sh for details

var dep = require('./dep');
var dep2 = require('./dep2');

function neverCalled() {
  console.log('never');
}

function definitelyCalled() {
  dep.go();
}

definitelyCalled();