"use strict";

const config = require("../config.js");
const async = require("async");
const should = require("should");

describe("config", function() {
  describe("initialise", function() {
    it("should initialise twice", function(bddone) {
      async.series([
        config.initialise,
        config.initialise
      ], function(err) { bddone(err); });
    });
  });
  describe("get*", function() {
    it("should return standard values", function(bddone) {
      should((config.getServerPort())).equal(35043);
      bddone();
    });
  });
  describe("getValue", function() {
    it("should return Standard Values", function(bddone) {
      should((config.getValue("serverport"))).equal(35043);
      bddone();
    });
  });
});
