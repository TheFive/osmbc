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
    })
  });
});
