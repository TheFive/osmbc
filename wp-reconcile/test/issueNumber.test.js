import should from "should";
import { issueNumberFromOldTitle, issueNumberFromNewTitle } from "../wp-extract/issueNumber.js";

describe("issueNumber", function () {
  describe("issueNumberFromOldTitle (wp_1_posts, plain German titles)", function () {
    it("extracts the number from a real wp_1_posts-style title", function () {
      should(issueNumberFromOldTitle("Wochennotiz Nr. 523")).eql(523);
    });

    it("returns null for a bracketed wp_posts-style title", function () {
      should(issueNumberFromOldTitle("[:en]weeklyOSM 825[:de]Wochennotiz 825[:]")).eql(null);
    });

    it("returns null for non-string input", function () {
      should(issueNumberFromOldTitle(undefined)).eql(null);
    });
  });

  describe("issueNumberFromNewTitle (wp_posts, bracketed multi-language titles)", function () {
    it("extracts the number via the en segment of a real WN825 title", function () {
      const title = "[:en]weeklyOSM 825[:de]Wochennotiz 825[:pt]semanárioOSM 825[:]";
      should(issueNumberFromNewTitle(title)).eql(825);
    });

    it("falls back to another language segment when en is missing", function () {
      const title = "[:de]Wochennotiz 824[:fr]hebdoOSM 824[:]";
      should(issueNumberFromNewTitle(title)).eql(824);
    });

    it("returns null when no segment matches the expected pattern", function () {
      const title = "[:de]Willkommen[:en]Welcome[:]";
      should(issueNumberFromNewTitle(title)).eql(null);
    });
  });

  describe("issueNumberFromNewTitle (older <!--:xx--> style, real issues #219-257)", function () {
    it("extracts the issue number, not the trailing year, from a real WN221 title", function () {
      const title = "<!--:en-->weekly 221 – 07.10.-13.10.2014<!--:--><!--:de-->Wochennotiz 221 – 07.10.-13.10.2014<!--:-->";
      should(issueNumberFromNewTitle(title)).eql(221);
    });

    it("handles a title with no space before the date range (real WN220 title)", function () {
      const title = "<!--:en-->weekly 220– 30.09.-06.10.2014<!--:-->";
      should(issueNumberFromNewTitle(title)).eql(220);
    });

    it("returns null for a one-off special post with no issue number", function () {
      const title = "<!--:en-->Disaster routing in Nepal available at OpenRouteService<!--:-->";
      should(issueNumberFromNewTitle(title)).eql(null);
    });
  });
});
