"use strict";

var async = require("async");
var nock = require("nock");
var should  = require("should");
var path = require("path");
var mockdate = require("mockdate");
var testutil = require("../testutil.js");


var userModule = require("../../model/user.js");
var blogModule = require("../../model/blog.js");
var articleModule = require("../../model/article.js");




describe("us/guest visibility", function() {
  this.timeout(20000);
  var browser;
  let article = null;
  beforeEach(function(bddone) {
    async.series([
      testutil.clearDB,
      (cb) => { userModule.createNewUser({OSMUser: "TheFive", access: "full",language:"EN"}, cb); },
      (cb) => { userModule.createNewUser({OSMUser: "GuestUser", access: "guest",language:"EN"}, cb); },
      testutil.startServer.bind(null, "TheFive")
    ], function(err) {
      browser = testutil.getBrowser();
      bddone(err);
    });
  });
  before(function(bddone) {
    mockdate.set("2015-11-05");
    return bddone();
  });
  after(function(bddone) {
    mockdate.reset();
    return bddone();
  });
  afterEach(function(bddone) {
    testutil.stopServer(bddone);
  });


  it("should do a use case",function(bddone){
    async.series([
      browser.visit.bind(browser, "/osmbc"),
      browser.assert.expectHtml.bind(browser, "access" , "fullStartPage.html"),
      browser.click.bind(browser,"a#adminlink"),
      browser.click.bind(browser,"a#createblog"),
      browser.click.bind(browser,"button.btn.btn-primary[type='button']"),
      browser.assert.expectHtml.bind(browser, "access" , "fullBlogList.html"),
    ], bddone);
  });
});
