"use strict";

const async = require("async");
const should = require("should");


const testutil = require("../test/testutil.js");

const layout = require("../routes/layout.js");




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
    const req = { query: {}, session: {}, user: { getMainLang: getMainLang, getSecondLang: getSecondLang, getLang3: getSecondLang, getLang4: getSecondLang, getLang: getSecondLang, language: "DE" } };
    const res = {};
    layout.prepareRenderLayout(req, res, function done() {
      const l = res.rendervar.layout;
      should(typeof l.user).eql("object");
      should(Array.isArray(l.listOfOpenBlog)).be.True();
      should(Array.isArray(l.listOfEditBlog)).be.True();
      should(Array.isArray(l.listOfReviewBlog)).be.True();
      should(l.activeLanguages).eql(["DE"]);
      bddone();
    });
  });
});
