#!/bin/bash


echo "Start Travis Test Without Coverage Upload"
istanbul cover ./node_modules/mocha/bin/_mocha --report lcovonly -- -R spec 

