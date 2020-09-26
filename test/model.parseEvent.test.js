"use strict";

const should = require("should");
const parseEvent = require("../model/parseEvent.js");
const mockdate = require("mockdate");

const testutil = require("./testutil.js");

const initialize = require("../util/initialise.js");


/* eslint-disable mocha/no-synchronous-tests */

describe("model/parseEvent", function() {

  before(async function() {
    mockdate.set(new Date("2015-12-06"));

    await initialize.initialiseModules();
    await testutil.clearDB();
  });
  after(function(bddone) {
    mockdate.reset();
    bddone();
  });
  describe("filterEvent", function() {
    it("should filter a one day event, thats not big", function() {
      let filterTest = parseEvent.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21};

      should(filterTest({startDate: "2015-12-05"}, option)).be.True();
      should(filterTest({startDate: "2015-12-06"}, option)).be.False();
      should(filterTest({startDate: "2015-12-08"}, option)).be.False();
      should(filterTest({startDate: "2015-12-20"}, option)).be.False();
      should(filterTest({startDate: "2015-12-31"}, option)).be.True();
    });
    it("should filter a one day event, thats big", function() {
      let filterTest = parseEvent.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21};

      should(filterTest({startDate: "2015-12-05", big: true}, option)).be.True();
      should(filterTest({startDate: "2015-12-06", big: true}, option)).be.False();
      should(filterTest({startDate: "2015-12-08", big: true}, option)).be.False();
      should(filterTest({startDate: "2015-12-27", big: true}, option)).be.False();
      should(filterTest({startDate: "2015-12-31", big: true}, option)).be.True();
    });
    it("should filter a three day event, thats not big", function() {
      let filterTest = parseEvent.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21};
      should(filterTest({startDate: "2015-12-02", endDate: "2015-12-05"}, option)).be.True();
      should(filterTest({startDate: "2015-12-05", endDate: "2015-12-07"}, option)).be.False();
      should(filterTest({startDate: "2015-12-06", endDate: "2015-12-08"}, option)).be.False();
      should(filterTest({startDate: "2015-12-20", endDate: "2015-12-23"}, option)).be.False();
      should(filterTest({startDate: "2015-12-21", endDate: "2015-12-22"}, option)).be.True();
    });
    it("should filter a three day event, thats big", function() {
      let filterTest = parseEvent.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21};
      should(filterTest({startDate: "2015-12-02", endDate: "2015-12-05", big: true}, option)).be.True();
      should(filterTest({startDate: "2015-12-05", endDate: "2015-12-07", big: true}, option)).be.False();
      should(filterTest({startDate: "2015-12-06", endDate: "2015-12-08", big: true}, option)).be.False();
      should(filterTest({startDate: "2015-12-20", endDate: "2015-12-23", big: true}, option)).be.False();
      should(filterTest({startDate: "2015-12-27", endDate: "2015-12-29", big: true}, option)).be.False();
      should(filterTest({startDate: "2015-12-28", endDate: "2015-12-31", big: true}, option)).be.True();
    });
    it("should filter with included countries", function() {
      let filterTest = parseEvent.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21, includeCountries: "germany"};

      should(filterTest({startDate: "2015-12-05", country: "germany", big: true}, option)).be.True();
      should(filterTest({startDate: "2015-12-06", country: "germany", big: true}, option)).be.False();
      should(filterTest({startDate: "2015-12-08", big: true}, option)).be.False(); // no country given, filter does not work
      should(filterTest({startDate: "2015-12-08", country: "germany", big: true}, option)).be.False();
      should(filterTest({startDate: "2015-12-08", country: "UK", big: true}, option)).be.True();
    });
    it("should filter with excluded countries", function() {
      let filterTest = parseEvent.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21, excludeCountries: "germany"};

      should(filterTest({startDate: "2015-12-05", country: "germany", big: true}, option)).be.True();
      should(filterTest({startDate: "2015-12-06", country: "germany", big: true}, option)).be.True();
      should(filterTest({startDate: "2015-12-08", big: true}, option)).be.False(); // no country given, filter does not work
      should(filterTest({startDate: "2015-12-08", country: "germany", big: true}, option)).be.True();
      should(filterTest({startDate: "2015-12-08", country: "UK", big: true}, option)).be.False();
    });
  });
  describe("convertGeoName", function() {
    it("should not translate an online event", function(bddone){
      parseEvent.convertGeoName("online","EN",function(err,result){
        should.not.exist(err);
        should(result).eql("online");
        return bddone();
      });
    });
  });
});
