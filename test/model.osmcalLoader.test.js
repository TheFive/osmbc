

import fs from "fs";
import path from "path";
import config from "../config.js";
import should from "should";
import nock from "nock";
import mockdate from "mockdate";

import testutil from "../test/testutil.js";

import configModule from "../model/config.js";
import osmcalLoader from "../model/osmcalLoader.js";


async function doTest(option) {
  const inputFile = path.resolve(config.getDirName(), "test", "data", `osmcal_api_v2.${option.file}.json`);
  const input = JSON.parse(fs.readFileSync(inputFile));


  nock("https://osmcal.org")
    .get("/api/v2/events/")
    .reply(200, input.osmcal);
  for (const nominatimCall in input) {
    if (nominatimCall === "osmcal") continue;
    nock("https://nominatim.openstreetmap.org")
      .get(nominatimCall)
      .thrice()
      .reply(200, input[nominatimCall]);
  }
  mockdate.set(new Date(option.date));

  const result = await osmcalLoader.getEventMd(option.lang);
  testutil.expectTextFile(result, "data", `osmcal_result.${option.file}`,".txt");
}

describe("model/osmcalLoader", function () {
  before(function (bddone) {
    config.initialise();
    testutil.clearDB(bddone);
  });
  after(async function () {
    mockdate.reset();
  });
  describe("getEventMD", function () {
    describe("broken API's", function () {
      it("should handle error in OSMCAL API Call", async function () {
        nock("https://osmcal.org")
          .get("/api/v2/events/")
          .replyWithError("something unexpeced happened");
        const result = await osmcalLoader.getEventMd("EN");
        should(result).eql("|Venue|Where|What                               |Online|When|Country|\n|-----|-----|-----------------------------------|------|----|-------|\n|     |     |osmcal did not reply with Eventlist|      |    |       |\n");
      });
      it("should handle String as result in OSMCAL API Call", async function () {
        nock("https://osmcal.org")
          .get("/api/v2/events/")
          .reply(200, "string result");
        const result = await osmcalLoader.getEventMd("EN");
        should(result).eql("|Venue|Where|What                               |Online|When|Country|\n|-----|-----|-----------------------------------|------|----|-------|\n|     |     |osmcal did not reply with Eventlist|      |    |       |\n");
      });
      it("should handle non 200 results on osmcal API", async function () {
        nock("https://osmcal.org")
          .get("/api/v2/events/")
          .reply(300, "forbidden error");
        const result = await osmcalLoader.getEventMd("EN");
        should(result).eql("|Venue|Where|What                               |Online|When|Country|\n|-----|-----|-----------------------------------|------|----|-------|\n|     |     |osmcal did not reply with Eventlist|      |    |       |\n");
      });
      it("should handle non 200 results on nominatim API", async function () {
        nock("https://osmcal.org")
          .get("/api/v2/events/")
          .reply(200, [
            {
              name: "Mapping Party #23",
              url: "https://osmcal.org/event/23/",
              date: {
                start: "2020-05-24T12:00:00+09:00",
                end: "2020-05-24T14:00:00+09:00",
                human: "24th May 12:00–14:00",
                human_short: "24th May",
                whole_day: false
              },
              location: {
                short: "Osaka, Japan",
                detailed: "Tosabori-dori, Chuo, Osaka, Japan",
                coords: [
                  135.5023,
                  34.6931
                ],
                venue: "Cool Pub"
              },
              cancelled: true
            }
          ]);
        nock("https://nominatim.openstreetmap.org")
          .get("/reverse?format=jsonv2&zoom=10&lat=34.6931&lon=135.5023&accept-language=EN")
          .reply(301, "misusage info or something else");

        const result = await osmcalLoader.getEventMd("EN");
        should(result).eql("|Venue|Where|What|Online|When|Country|\n|-----|-----|----|------|----|-------|\n");
      });
    });
    describe("Successfull Calls", function () {
      it("should generate a standard calendar in EN", async function () {
        await doTest({ file: "t1", date: "2020-05-20T19:00:00Z", lang: "EN" });
      });
      it("should generate a standard calendar in ES", async function () {
        await doTest({ file: "t2", date: "2020-05-20T19:00:00Z", lang: "ES" });
      });
      it("should generate handle timezones correct", async function () {
        await doTest({ file: "t2", date: "2020-05-20T22:00:00Z", lang: "ES" });
        await doTest({ file: "t2", date: "2020-05-20T02:00:00Z", lang: "ES" });
      });
      it("should generate canceled Events", async function () {
        await doTest({ file: "t3", date: "2020-05-20T19:00:00Z", lang: "ES" });
      });
    });
    describe("town column", function () {
      it("should show a place tagged as town (Fulda, #1181)", async function () {
        nock("https://osmcal.org")
          .get("/api/v2/events/")
          .reply(200, [{
            name: "1. OSM Stammtisch Fulda",
            url: "https://osmcal.org/event/5285/",
            date: {
              human: "22nd November 14:00 – 17:00",
              human_short: "22nd November",
              whole_day: false,
              start: "2026-11-22T14:00:00+01:00",
              end: "2026-11-22T17:00:00+01:00"
            },
            location: {
              short: "Fulda, Hesse, Germany",
              detailed: "Magrathea Laboratories e.V., 19, Rabanusstraße, Hesse, Germany",
              coords: [9.680761, 50.552258],
              venue: "Magrathea Laboratories e.V."
            }
          }]);
        nock("https://nominatim.openstreetmap.org")
          .get("/reverse?format=jsonv2&zoom=10&lat=50.552258&lon=9.680761&accept-language=EN")
          .reply(200, {
            addresstype: "town",
            name: "Fulda",
            address: { town: "Fulda", county: "Landkreis Fulda", state: "Hesse", country: "Germany", country_code: "de" }
          });
        mockdate.set(new Date("2026-11-16T19:00:00Z"));

        const result = await osmcalLoader.getEventMd("EN");
        should(result).match(/\|Magrathea Laboratories e\.V\.\s*\|Fulda\s*\|/);
      });
    });
    describe("Successfull Calls Missing Values", function () {
      it("should generate canceled Events", async function () {
        await doTest({ file: "t4", date: "2020-05-20T19:00:00Z", lang: "ES" });
      });
    });
  });
  describe("filterEvent", function () {
    beforeEach(async function () {
      mockdate.set(new Date("2015-12-06"));
    });
    afterEach(async function () {
      mockdate.reset();
    });
    it("should filter a one day event, thats not big", async function () {
      const filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      const option = { date: 0, duration: 14, big_duration: 21 };

      should(filterTest({ date: { start: "2015-12-05" } }, option)).be.True();
      should(filterTest({ date: { start: "2015-12-06" } }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-08" } }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-20" } }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-31" } }, option)).be.True();
    });
    it("should filter a one day event, thats big", async function () {
      const filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      const option = { date: 0, duration: 14, big_duration: 21 };

      should(filterTest({ date: { start: "2015-12-05" }, big: true }, option)).be.True();
      should(filterTest({ date: { start: "2015-12-06" }, big: true }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-08" }, big: true }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-27" }, big: true }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-31" }, big: true }, option)).be.True();
    });
    it("should filter a three day event, thats not big", async function () {
      const filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      const option = { date: 0, duration: 14, big_duration: 21 };
      should(filterTest({ date: { start: "2015-12-02", end: "2015-12-05" } }, option)).be.True();
      should(filterTest({ date: { start: "2015-12-05", end: "2015-12-07" } }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-06", end: "2015-12-08" } }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-20", end: "2015-12-23" } }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-21", end: "2015-12-22" } }, option)).be.True();
    });
    it("should filter a three day event, thats big", async function () {
      const filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      const option = { date: 0, duration: 14, big_duration: 21 };
      should(filterTest({ date: { start: "2015-12-02", end: "2015-12-05" }, big: true }, option)).be.True();
      should(filterTest({ date: { start: "2015-12-05", end: "2015-12-07" }, big: true }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-06", end: "2015-12-08" }, big: true }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-20", end: "2015-12-23" }, big: true }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-27", end: "2015-12-29" }, big: true }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-28", end: "2015-12-31" }, big: true }, option)).be.True();
    });
    it("should filter with included countries", async function () {
      const filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      const option = { date: 0, duration: 14, big_duration: 21, includeCountries: ["DE"] };

      should(filterTest({ date: { start: "2015-12-05" }, country_code: "DE", big: true }, option)).be.True();
      should(filterTest({ date: { start: "2015-12-06" }, country_code: "DE", big: true }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-08" }, big: true }, option)).be.False(); // no country given, filter does not work
      should(filterTest({ date: { start: "2015-12-08" }, country_code: "DE", big: true }, option)).be.False();
      should(filterTest({ date: { start: "2015-12-08" }, country_code: "UK", big: true }, option)).be.True();
    });
    it("should filter with excluded countries", async function () {
      const filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      const option = { date: 0, duration: 14, big_duration: 21, excludeCountries: ["DE"] };

      should(filterTest({ date: { start: "2015-12-05" }, country_code: "DE", big: true }, option)).be.True();
      should(filterTest({ date: { start: "2015-12-06" }, country_code: "DE", big: true }, option)).be.True();
      should(filterTest({ date: { start: "2015-12-08" }, big: true }, option)).be.False(); // no country given, filter does not work
      should(filterTest({ date: { start: "2015-12-08" }, country_code: "DE", big: true }, option)).be.True();
      should(filterTest({ date: { start: "2015-12-08" }, country_code: "UK", big: true }, option)).be.False();
    });
    it("should filter based on Start Date", async function () {
      const filterTest = osmcalLoader.forTestOnly.filterEvent;
      // clock is set to "2015-12-06" !!
      const option = { date: 0, duration: 14, big_duration: 21, daysAfterBlogStart: 5 };
      const blogStartDate = "2015-12-11 12:00";

      should(filterTest({ date: { start: "2015-12-05" }, big: false }, option, blogStartDate)).be.True();
      should(filterTest({ date: { start: "2015-12-06" }, big: true }, option, blogStartDate)).be.True();
      should(filterTest({ date: { start: "2015-12-17" }, big: true }, option, blogStartDate)).be.False();
      should(filterTest({ date: { start: "2015-12-20" }, big: true }, option, blogStartDate)).be.False();
      should(filterTest({ date: { start: "2016-01-01" }, big: false }, option, blogStartDate)).be.True();
      should(filterTest({ date: { start: "2016-12-31" }, big: true }, option, blogStartDate)).be.True();
    });
  });
  describe("townFromAddress", function () {
    const townFromAddress = osmcalLoader.forTestOnly.townFromAddress;
    it("should take city, town, village or municipality", function () {
      should(townFromAddress({ city: "Berlin" })).eql("Berlin");
      should(townFromAddress({ town: "Fulda" })).eql("Fulda");
      should(townFromAddress({ village: "Kleinsassen" })).eql("Kleinsassen");
      should(townFromAddress({ municipality: "Hilders" })).eql("Hilders");
    });
    it("should prefer city over the smaller place types", function () {
      should(townFromAddress({ village: "V", town: "T", city: "C" })).eql("C");
      should(townFromAddress({ village: "V", town: "T" })).eql("T");
    });
    it("should return an empty string without a place name", function () {
      should(townFromAddress({ county: "Landkreis Fulda", state: "Hesse" })).eql("");
      should(townFromAddress(undefined)).eql("");
    });
  });
  describe("enrichData (country_flag)", function () {
    before(async function () {
      const cf = await configModule.getConfigObject("calendarflags");
      await cf.setAndSave({ OSMUser: "test" }, {
        version: cf.version,
        yaml: cf.yaml + "\nxx_url: https://example.org/xx.svg\nxx_path: /wp-uploads/2020/01/xx.svg\nxx_emoji: 🇩🇪\n"
      });
    });
    it("should wrap a full https:// URL as a markdown image (unchanged behaviour)", function () {
      const events = [{ country_code: "xx_url" }];
      osmcalLoader.forTestOnly.enrichData(events, "EN");
      should(events[0].country_flag).eql("![](https://example.org/xx.svg)");
    });
    it("should wrap a relative path as a markdown image", function () {
      const events = [{ country_code: "xx_path" }];
      osmcalLoader.forTestOnly.enrichData(events, "EN");
      should(events[0].country_flag).eql("![](/wp-uploads/2020/01/xx.svg)");
    });
    it("should keep a raw value (e.g. an emoji flag) as-is, not as a markdown image", function () {
      const events = [{ country_code: "xx_emoji" }];
      osmcalLoader.forTestOnly.enrichData(events, "EN");
      should(events[0].country_flag).eql("🇩🇪");
    });
    it("should fall back to the plain country_code when nothing is configured", function () {
      const events = [{ country_code: "not_configured" }];
      osmcalLoader.forTestOnly.enrichData(events, "EN");
      should(events[0].country_flag).eql("not_configured");
    });
  });
});
