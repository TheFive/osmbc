"use strict";

var config = require("../util/config.js");
var async = require("async");
var should = require("should");

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
      should((config.getCallbackUrl())).equal("http://localhost:3000/auth/openstreetmap/callback");
      should((config.getServerPort())).equal(35043);
      bddone();
    });
  });
  describe("getValue", function() {
    it("should return Standard Values", function(bddone) {
      should((config.getValue("callbackUrl"))).equal("http://localhost:3000/auth/openstreetmap/callback");
      should((config.getValue("serverport"))).equal(35043);
      bddone();
    });
  });
  describe("getLanguages", function() {
    it("should return Standard Values", function(bddone) {
      should((config.getLanguages())).eql(["DE", "EN", "ES"]);
      bddone();
    });
  });
});
