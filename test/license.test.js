"use strict";
var checker = require('license-checker');
var should = require('should');
var path = require('path');

describe("license-check", function() {
  it("should not use GPL", function(bddone) {
    checker.init({
      start: path.join(__dirname,"..")
    }, function(err, json) {
      should.not.exist(err);
      for (let k in json) {
        let pl = k+" License("+json[k].licenses+")";
        should(pl).not.match(/.*GPL.*/);
      }
      bddone();
    });
  });
});




