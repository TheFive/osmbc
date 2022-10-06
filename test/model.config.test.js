"use strict";

const async  = require("async");
const should = require("should");

const testutil = require("./testutil.js");

const configModule = require("../model/config.js");
const logModule = require("../model/logModule.js");
const messageCenter = require("../notification/messageCenter.js");






describe("model/config", function() {
  before(function (bddone) {
    messageCenter.initialise();
    async.series([
      testutil.clearDB,
      configModule.initialise
    ], bddone);
  });
  it("should read initialised values", function (bddone) {
    const c = configModule.getConfig("calendarflags");
    should.exist(c);
    should(c.brasil).eql("http://blog.openstreetmap.de/wp-uploads/2016/03/br.svg");
    bddone();
  });
  it("should have stored initialised value", function (bddone) {
    testutil.findJSON("config", { name: "calendarflags" }, function(err, result) {
      should.not.exist(err);
      should.exist(result);
      should(result.type).eql("yaml");
      bddone();
    });
  });



  describe("setAndSave", function() {
    beforeEach(function(bddone) {
      async.series([
        testutil.clearDB
      ], bddone);
    });
    it("should set only the one Value in the database", function (bddone) {
      let changeConfig;
      configModule.getConfigObject("calendarflags", function(err, result) {
        should.not.exist(err);
        should.exist(result);
        changeConfig = result;
        const id = changeConfig.id;
        changeConfig.yaml = "not logged";
        changeConfig.setAndSave({ OSMUser: "user" }, { version: 1, yaml: "not logged" }, function(err) {
          should.not.exist(err);
          testutil.findJSON("config", { name: "calendarflags" }, function(err, result) {
            should.not.exist(err);
            should(result).eql({ id: id, yaml: "not logged", version: 2, name: "calendarflags", type: "yaml" });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(0);
              bddone();
            });
          });
        });
      });
    });
  });
});

