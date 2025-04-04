

import should from "should";
import language from "../model/language.js";




describe("model/language", function() {
  it("should get momen locale for EN", function (bddone) {
    should(language.momentLocale("EN")).eql("en-gb");
    bddone();
  });
  it("should return lids", function (bddone) {
    should(language.getLid()).deepEqual(["DE", "EN", "FR", "ES", "PT-PT"]);
    bddone();
  });
  it("should return alternative language strings for translators", function (bddone) {
    // see config.test.json for relating data
    should(language.deeplProSourceLang("en")).eql("EN");
    should(language.deeplProSourceLang("PT-PT")).eql("PT");
    should(language.deeplProTargetLang("PT-PT")).eql("PT-PT");
    should(language.deeplProFormality("DE")).eql("less");
    bddone();
  });
});

