"use strict";

const fs = require("fs");
const path = require("path");
const config = require("../config.js");
const should = require("should");
const nock   = require("nock");
const mockdate = require("mockdate");

const testutil = require("../test/testutil.js");

var osmcalLoader  = require("../model/osmcalLoader.js");


async function doTest(option) {

  const inputFile =  path.resolve(__dirname, "data", `osmcal_api_v2.${option.file}.json`);
  var input =  JSON.parse(fs.readFileSync(inputFile));

  const outputFile = path.resolve(__dirname, "data", `osmcal_result.${option.file}.txt`);
  let expectedResult = fs.readFileSync(outputFile , {encoding:'utf8'});

  nock("https://osmcal.org")
    .get("/api/v2/events/")
    .reply(200,input.osmcal);
  for (let nominatimCall in input) {
    if (nominatimCall === "osmcal") continue;
    nock("https://nominatim.openstreetmap.org")
      .get(nominatimCall)
      .thrice()
      .reply(200,input[nominatimCall]);
  }
  mockdate.set(new Date(option.date));

  let result = await osmcalLoader.getEventMd(option.lang);
  should(result).eql(expectedResult);
}

describe("model/osmcalLoader", function() {
  before(function(bddone) {
    config.initialise();
    testutil.clearDB(bddone);
  });
  after(function(){
    mockdate.reset();
  });
  describe("getEventMD",function() {
    describe("broken API's",function() {
      it("should handle error in OSMCAL API Call", async function() {
        nock("https://osmcal.org")
          .get("/api/v2/events/")
          .replyWithError("something unexpeced happened");
        let result = await osmcalLoader.getEventMd("EN");
        should(result).eql("|Where|What                        |Online|When|Country|\n|-----|----------------------------|------|----|-------|\n|     |something unexpeced happened|      |    |       |\n");
      });
      it("should handle String as result in OSMCAL API Call", async function() {
        nock("https://osmcal.org")
          .get("/api/v2/events/")
          .reply(200,"string result");
        let result = await osmcalLoader.getEventMd("EN");
        should(result).eql("|Where|What                               |Online|When|Country|\n|-----|-----------------------------------|------|----|-------|\n|     |osmcal did not reply with Eventlist|      |    |       |\n");
      });
      it("should handle non 200 results on osmcal API", async function() {
        nock("https://osmcal.org")
          .get("/api/v2/events/")
          .reply(300,"forbidden error");
        let result = await osmcalLoader.getEventMd("EN");
        should(result).eql("|Where|What                               |Online|When|Country|\n|-----|-----------------------------------|------|----|-------|\n|     |Request failed with status code 300|      |    |       |\n");
      });
      it("should handle non 200 results on nominatim API", async function() {
        nock("https://osmcal.org")
          .get("/api/v2/events/")
          .reply(200,[
              {
                "name": "Mapping Party #23",
                "url": "https://osmcal.org/event/23/",
                "date": {
                  "start": "2020-05-24T12:00:00+09:00",
                  "end": "2020-05-24T14:00:00+09:00",
                  "human": "24th May 12:00–14:00",
                  "human_short": "24th May",
                  "whole_day": false
                },
                "location": {
                  "short": "Osaka, Japan",
                  "detailed": "Tosabori-dori, Chuo, Osaka, Japan",
                  "coords": [
                    135.5023,
                    34.6931
                  ],
                  "venue": "Cool Pub"
                },
                "cancelled": true
              }
            ]);
        nock("https://nominatim.openstreetmap.org")
          .get("/reverse?format=jsonv2&zoom=10&lat=34.6931&lon=135.5023&accept-language=EN")
          .reply(301,"misusage info or something else");

        let result = await osmcalLoader.getEventMd("EN");
        should(result).eql("|Where|What                               |Online|When|Country|\n|-----|-----------------------------------|------|----|-------|\n|     |Request failed with status code 301|      |    |       |\n");
      });
    });
    describe("Successfull Calls",function(){
      it("should generate a standard calendar in EN",async function() {
        await doTest({file:"t1", date:"2020-05-20T19:00:00Z",lang:"EN"});
      });
      it("should generate a standard calendar in ES",async function(){
          await doTest({file:"t2", date:"2020-05-20T19:00:00Z",lang:"ES"});
      });
      it("should handle timezones ",function(){
        it("should generate handle timezones correct",async function(){
            await doTest({file:"t2", date:"2020-05-20T22:00:00Z",lang:"ES"});
            await doTest({file:"t2", date:"2020-05-20T02:00:00Z",lang:"ES"});
        });
      });
      it("should generate canceled Events",async function(){
          await doTest({file:"t3", date:"2020-05-20T19:00:00Z",lang:"ES"});
      });
    });
    describe("Successfull Calls Missing Values",function(){
      it("should generate canceled Events",async function(){
          await doTest({file:"t4", date:"2020-05-20T19:00:00Z",lang:"ES"});
      });
    });
    describe("Check Filter",function() {});

  });
  describe("filterEvent", function() {
    beforeEach(function(){
        mockdate.set(new Date("2015-12-06"));
    });
    afterEach(function(){
        mockdate.reset();
    }); 
    it("should filter a one day event, thats not big", function() {
      let filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21};

      should(filterTest({date:{start: "2015-12-05"}}, option)).be.True();
      should(filterTest({date:{start: "2015-12-06"}}, option)).be.False();
      should(filterTest({date:{start: "2015-12-08"}}, option)).be.False();
      should(filterTest({date:{start: "2015-12-20"}}, option)).be.False();
      should(filterTest({date:{start: "2015-12-31"}}, option)).be.True();
    });
    it("should filter a one day event, thats big", function() {
      let filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21};

      should(filterTest({date:{start: "2015-12-05"}, big: true}, option)).be.True();
      should(filterTest({date:{start: "2015-12-06"}, big: true}, option)).be.False();
      should(filterTest({date:{start: "2015-12-08"}, big: true}, option)).be.False();
      should(filterTest({date:{start: "2015-12-27"}, big: true}, option)).be.False();
      should(filterTest({date:{start: "2015-12-31"}, big: true}, option)).be.True();
    });
    it("should filter a three day event, thats not big", function() {
      let filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21};
      should(filterTest({date:{start: "2015-12-02", end: "2015-12-05"}}, option)).be.True();
      should(filterTest({date:{start: "2015-12-05", end: "2015-12-07"}}, option)).be.False();
      should(filterTest({date:{start: "2015-12-06", end: "2015-12-08"}}, option)).be.False();
      should(filterTest({date:{start: "2015-12-20", end: "2015-12-23"}}, option)).be.False();
      should(filterTest({date:{start: "2015-12-21", end: "2015-12-22"}}, option)).be.True();
    });
    it("should filter a three day event, thats big", function() {
      let filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21};
      should(filterTest({date:{start: "2015-12-02", end: "2015-12-05"}, big: true}, option)).be.True();
      should(filterTest({date:{start: "2015-12-05", end: "2015-12-07"}, big: true}, option)).be.False();
      should(filterTest({date:{start: "2015-12-06", end: "2015-12-08"}, big: true}, option)).be.False();
      should(filterTest({date:{start: "2015-12-20", end: "2015-12-23"}, big: true}, option)).be.False();
      should(filterTest({date:{start: "2015-12-27", end: "2015-12-29"}, big: true}, option)).be.False();
      should(filterTest({date:{start: "2015-12-28", end: "2015-12-31"}, big: true}, option)).be.True();
    });
    it("should filter with included countries", function() {
      let filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21, includeCountries: ["DE"]};

      should(filterTest({date:{start: "2015-12-05"}, country_code: "DE", big: true}, option)).be.True();
      should(filterTest({date:{start: "2015-12-06"}, country_code: "DE", big: true}, option)).be.False();
      should(filterTest({date:{start: "2015-12-08"}, big: true}, option)).be.False(); // no country given, filter does not work
      should(filterTest({date:{start: "2015-12-08"}, country_code: "DE", big: true}, option)).be.False();
      should(filterTest({date:{start: "2015-12-08"}, country_code: "UK", big: true}, option)).be.True();
    });
    it("should filter with excluded countries", function() {
      let filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      let option = {date: 0, duration: 14, big_duration: 21, excludeCountries: ["DE"]};

      should(filterTest({date: {start: "2015-12-05"}, country_code: "DE", big: true}, option)).be.True();
      should(filterTest({date: {start: "2015-12-06"}, country_code: "DE", big: true}, option)).be.True();
      should(filterTest({date: {start: "2015-12-08"}, big: true}, option)).be.False(); // no country given, filter does not work
      should(filterTest({date: {start: "2015-12-08"}, country_code: "DE", big: true}, option)).be.True();
      should(filterTest({date: {start: "2015-12-08"}, country_code: "UK", big: true}, option)).be.False();
    });
  });
});
