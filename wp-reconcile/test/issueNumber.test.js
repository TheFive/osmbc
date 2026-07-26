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
});
