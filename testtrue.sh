#!/bin/bash


#
# This script starts the test module using Istanbul for codecoverage
# The coverage is uploaded afterwards to codecov.io
# so it is used for CI Hoster travis-CI
#
# it is started by npm test with the $TRAVIS variable set to true
# ("test": "NODE_ENV=test ./test$TRAVIS.sh") (from package.json)
#
#
echo "Start Travis Test With Coverage Upload"
istanbul cover ./node_modules/mocha/bin/_mocha --report lcovonly -- -R spec && cat ./coverage/lcov.info | ./node_modules/codecov.io/bin/codecov.io.js && rm -rf ./coverage
