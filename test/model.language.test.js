"use strict";

const should = require("should");
const language = require("../model/language.js");




describe("model/language", function() {
  it("should get momen locale for EN", function (bddone) {
    should(language.momentLocale("EN")).eql("en-gb");
    bddone();
  });
  it("should return lids", function (bddone){
    should(language.getLid()).deepEqual(['DE', 'EN', 'ES', 'PT-PT']);
    bddone();
  });
});

