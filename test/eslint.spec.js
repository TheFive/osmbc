"use strict";


var lint = require('mocha-eslint');

describe("eslint",function() {
  it.skip("should eslint",function(){
    lint(["../"],{});
  });

});