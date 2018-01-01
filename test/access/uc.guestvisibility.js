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
    let b = browser;
    async.series([
      b.visit.bind(b, "/osmbc"),
      b.assert.expectHtml.bind(b, "access" , "fullStartPage.html"),
      b.click.bind(b,"a#adminlink"),
      b.click.bind(b,"a#createblog"),
      b.click.bind(b,"button.btn.btn-primary[type='button']"),
      b.assert.expectHtml.bind(b, "access" , "fullBlogList.html"),
      b.click.bind(b,"ul.nav.navbar-nav.pull-left li a"),
      (cb)=>{b.fill("input#searchField","new Info");return cb();},
      b.click.bind(b,"button[name='SearchNow']"),
      b.assert.expectHtml.bind(b,"access","fullCollectPage.html"),
      (cb)=>{
        //b.fill("select#categoryEN","Mapping /");
        b.fill("#title","This is a title of a full collected article");
        b.fill("textarea[name='collection']","This is the collection text");
        return cb();
      },
      b.click.bind(b,"input#OK"),
      b.assert.expectHtml.bind(b,"access","fullArticlePage.html"),
      b.click.bind(b,"option[value='Mapping']"),
      (cb)=>{
        b.fill("#title","This is a title of a full collected article");
        b.fill("textarea[name='collection']");
        return cb();
      },
      b.assert.expectHtml.bind(b,"access","tempresult.html")
    ], bddone);
  });
});
