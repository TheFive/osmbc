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

if  [ "$TRAVIS" = "TRUE" ]
then

  echo "Start Travis Test With Coverage Upload"

  echo "but do a mocha before"

  ./node_modules/mocha/bin/_mocha

  echo "mocha is done"
  istanbul cover ./node_modules/mocha/bin/_mocha --report lcovonly -- -R min && cat ./coverage/lcov.info | ./node_modules/codecov.io/bin/codecov.io.js && rm -rf ./coverage

else

  echo "Start Travis Test Without Coverage Upload"

  echo "but do a mocha before"

  ./node_modules/mocha/bin/_mocha

  echo "mocha is done"

  istanbul cover ./node_modules/mocha/bin/_mocha --report html

fi
