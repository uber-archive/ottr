console.log('blah');

huh = function anotherDependency() {
  console.log('we are in dep2');
};

module.exports = {
  anotherDependency: anotherDependency
};
