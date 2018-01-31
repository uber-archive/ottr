function somethingElse() {
  console.log('hi');
}

something = function depGo() {
  console.log('dep.go called!')
};

module.exports = {
  somethingElse: somethingElse,
  go: depGo
};
