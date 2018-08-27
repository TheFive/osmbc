"use strict";

var async = require("async");
var should = require("should");


var testutil = require("../test/testutil.js");

var layout = require("../routes/layout.js");




describe("routes/layout", function() {
  before(function(bddone) {
    testutil.startServerSync();
    async.series([
      testutil.clearDB
    ], bddone);
  });
  after(function(bddone) {
    testutil.stopServer();
    bddone();
  });
  it("should initialise all layout variables", function(bddone) {
    function getMainLang() { return "DE"; }
    function getSecondLang() { return null; }
    var req = {query: {}, session: {}, user: {getMainLang: getMainLang, getSecondLang: getSecondLang,getLang3:getSecondLang,getLang4:getSecondLang, language: "DE"}};
    var res = {};
    layout.prepareRenderLayout(req, res, function done() {
      let l = res.rendervar.layout;
      should(typeof l.user).eql("object");
      should(Array.isArray(l.listOfOpenBlog)).be.True();
      should(Array.isArray(l.listOfEditBlog)).be.True();
      should(Array.isArray(l.listOfReviewBlog)).be.True();
      should(l.usedLanguages).eql({DE: true});
      bddone();
    });
  });
});
