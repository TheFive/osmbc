

import config from "../config.js";
import async from "async";
import should from "should";

// tools/run-tests.mjs assigns a free port per test run
const expectedPort = process.env.OSMBC_TEST_PORT ? Number(process.env.OSMBC_TEST_PORT) : 35043;

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
      should((config.getServerPort())).equal(expectedPort);
      bddone();
    });
  });
  describe("getValue", function() {
    it("should return Standard Values", function(bddone) {
      should((config.getValue("serverport"))).equal(expectedPort);
      bddone();
    });
  });
});
