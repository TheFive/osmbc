#!/bin/bash


#
# This script starts the test module using Istanbul for codecoverage
# The coverage is NOT uploaded afterwards to codecov.io
# it is  used on NON TRAVIS machines
#
# it is started by npm test with the $TRAVIS variable set to nothing
# ("test": "NODE_ENV=test ./test$TRAVIS.sh") (from package.json)
#
#
echo "Start Travis Test Without Coverage Upload"
istanbul cover ./node_modules/mocha/bin/_mocha --report html

