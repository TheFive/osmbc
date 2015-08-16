#!/bin/bash


if [ -n "TRAVIS" ]; then
istanbul cover ./node_modules/mocha/bin/_mocha --report lcovonly -- -R spec && cat ./coverage/lcov.info | ./node_modules/codecov.io/bin/codecov.io.js && rm -rf ./coverage 


elif true; then

istanbul cover ./node_modules/mocha/bin/_mocha --report lcovonly -- -R spec && cat ./coverage/lcov.info 

fi