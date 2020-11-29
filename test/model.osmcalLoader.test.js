"use strict";

const config = require("../config.js");
const should = require("should");
const async  = require("async");
const nock   = require("nock");

const testutil = require("../test/testutil.js");

var osmcalLoader  = require("../model/osmcalLoader.js");

describe("model/osmcalLoader", function() {
  before(function(bddone) {
    config.initialise();
    testutil.clearDB(bddone);
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
    })
  });
});
