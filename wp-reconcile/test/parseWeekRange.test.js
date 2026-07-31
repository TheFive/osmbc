import should from "should";
import { parseWeekRange } from "../old-era/parseWeekRange.js";

describe("parseWeekRange", function () {
  it("parses a range with the year only on the end date (real excerpt, issue 5)", function () {
    const r = parseWeekRange("15.8-21.8.2010", "2010-08-20T22:56:39.000Z");
    r.method.should.equal("parsed");
    r.startDate.should.equal("2010-08-15T00:00:00.000Z");
    r.endDate.should.equal("2010-08-21T00:00:00.000Z");
  });

  it("parses an en-dash-separated range with spaces (real excerpt, issue 30)", function () {
    const r = parseWeekRange("6.2. – 12.2.2011", "2011-02-13T11:39:18.000Z");
    r.method.should.equal("parsed");
    r.startDate.should.equal("2011-02-06T00:00:00.000Z");
    r.endDate.should.equal("2011-02-12T00:00:00.000Z");
  });

  it("parses a range with no year at all, inferring it from postDate (real excerpt, issue 100)", function () {
    const r = parseWeekRange("10.6.–16.6.", "2012-06-17T20:10:00.000Z");
    r.method.should.equal("parsed");
    r.startDate.should.equal("2012-06-10T00:00:00.000Z");
    r.endDate.should.equal("2012-06-16T00:00:00.000Z");
  });

  it("parses a range with the year on both dates (real excerpt, issue 271)", function () {
    const r = parseWeekRange("22.09.2015 - 28.09.2015", "2015-10-01T19:51:38.000Z");
    r.method.should.equal("parsed");
    r.startDate.should.equal("2015-09-22T00:00:00.000Z");
    r.endDate.should.equal("2015-09-28T00:00:00.000Z");
  });

  it("falls back to postDate when the stated range is malformed (real typo, issue 250: month 14)", function () {
    const r = parseWeekRange("28.14.-04.05.2015", "2015-05-06T10:42:54.000Z");
    r.method.should.equal("fallback");
    r.endDate.should.equal("2015-05-06T00:00:00.000Z");
    const spanDays = (new Date(r.endDate) - new Date(r.startDate)) / (24 * 3600 * 1000);
    spanDays.should.equal(6);
  });

  it("falls back when there is no parseable date range at all", function () {
    const r = parseWeekRange("Liebe Leser,", "2015-05-06T10:42:54.000Z");
    r.method.should.equal("fallback");
  });
});
