'use strict';

// Update all the dependencies inside packages/node_modules/*/package.json
// to reflect the true dependencies (automatically determined by require())
// and update the version numbers to reflect the version from the top-level
// dependencies list. Also throw an error if a dep is not declared top-level.

var fs = require('fs');
var path = require('path');
var glob = require('glob');
var findRequires = require('find-requires');
var builtinModules = require('builtin-modules');
var uniq = require('lodash.uniq');
var flatten = require('lodash.flatten');

var topPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
var mainVersion = topPkg.version;
var modules = fs.readdirSync('./packages/node_modules');

modules.forEach(function (mod) {
  var pkgDir = path.join('./packages/node_modules', mod);
  var pkgPath = path.join(pkgDir, 'package.json');
  var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // All adapters should declare pouchdb-core as a peerDep, to warn
  // users if they install with the wrong version.
  // For other packages, they *may* be installed without pouchdb-core, so
  // there's no need to add a peerDep.
  if (/-adapter-/.test(pkg.name)) {
    pkg.peerDependencies = { 'pouchdb-core' : mainVersion };
  }

  // for the dependencies, find all require() calls
  var srcFiles = glob.sync(path.join(pkgDir, 'lib/**/*.js'));
  var uniqDeps = uniq(flatten(srcFiles.map(function (srcFile) {
    return findRequires(fs.readFileSync(srcFile, 'utf8'));
  }))).filter(function (dep) {
    // some modules require() themselves, e.g. for plugins
    return dep !== pkg.name &&
      // exclude built-ins like 'inherits', 'fs', etc.
      builtinModules.indexOf(dep) === -1;
  }).sort();

  var deps = pkg.dependencies = {};
  uniqDeps.forEach(function (dep) {
    if (topPkg.dependencies[dep]) {
      deps[dep] = topPkg.dependencies[dep];
    } else if (modules.indexOf(dep) !== -1) { // core pouchdb-* module
      deps[dep] = topPkg.version;
    } else {
      throw new Error('Unknown dependency ' + dep);
    }
  });

  var jsonString = JSON.stringify(pkg, null, '  ') + '\n';
  fs.writeFileSync(pkgPath, jsonString, 'utf8');
});
