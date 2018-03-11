"use strict";

var sinon   = require("sinon");
var should  = require("should");
var nock    = require("nock");
var request = require("request");
var config  = require("../config.js");
var mockdate = require("mockdate");
var deeplTranslate = require("deepl-translator");
var initialise = require("../util/initialise.js");

var articleModule = require("../model/article.js");

var articleRouterForTestOnly = require("../routes/article.js").fortestonly;

var testutil = require("./testutil.js");

var baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();


describe("routes/articleInternal",function(){
  let fixMarkdownLinks = articleRouterForTestOnly.fixMarkdownLinks;
  describe("fixMarkdownLinks",function(){
    it("should do not change without error",function(bddone){
      should(fixMarkdownLinks("Simple Text")).eql("Simple Text");
      should(fixMarkdownLinks("Simple Text with a [link](links.links).")).eql("Simple Text with a [link](links.links).");
      bddone();
    });
    it("should fix missing leading space",function(bddone){
      should(fixMarkdownLinks("Simple Text with a[link](links.links)")).eql("Simple Text with a [link](links.links)");
      bddone();
    });
    it("should fix missing ending space",function(bddone){
      should(fixMarkdownLinks("Simple Text with a [link](links.links)written.")).eql("Simple Text with a [link](links.links) written.");
      bddone();
    });
    it("should fix a space in link",function(bddone){
      should(fixMarkdownLinks("Simple Text with a [link] (links.links).")).eql("Simple Text with a [link](links.links).");
      bddone();
    });
  });
});

describe("routes/article", function() {
  this.timeout(this.timeout() * 3);
  var id = 2;
  let jar;
  var nockLogin;

  before(initialise.initialiseModules);

  after(function (bddone) {
    nock.cleanAll();
    testutil.stopServer();
    mockdate.reset();
    bddone();
  });

  beforeEach(function (bddone) {
    // Clear DB Contents for each test
    mockdate.set(new Date("2016-05-25T20:00:00Z"));
    nockLogin = testutil.nockLoginPage();
    jar = request.jar();
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.importData(
      {
        "blog": [{name: "BLOG", status: "edit"},
          {name: "secondblog", status: "edit"}],
        "user": [{"OSMUser": "TestUser", access: "full"},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"},
          { "OSMUser": "UserWith3Lang", access: "full", languageCount: "three"},
          { "OSMUser": "UserWith4Lang", access: "full", languageCount: "four"}
        ],
        "article": [
          {"blog": "BLOG", "markdownDE": "* Dies ist ein kleiner Testartikel.", "category": "Mapping",firstCollector:"TestUserNonExisting"},
          {"blog": "BLOG", "title": "BLOG", "markdownDE": "* Dies ist ein grosser Testartikel.", "category": "Keine", commentList: [{user: "Hallo", text: "comment"}]},
          {"blog": "BLOG", "title": "BLOG", "markdownDE": "* Dies ist ein grosser Testartikel.", "category": "Keine", commentList: [{user: "Hallo", text: "comment for @TestUserNonExisting"}]}],
    clear: true}, bddone);
  });
  afterEach(function(bddone){
    nock.removeInterceptor(nockLogin);
    return bddone();
  });
  describe("route GET /article/:id", function() {
    let url = baseLink + "/article/" + id;
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: url, jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
          bddone();
        });
      });
    });
    it("should run with full access user and 3 lang", function (bddone) {
      testutil.startServer("UserWith3Lang", function() {
        request.get({ url: url, jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
          bddone();
        });
      });
    });
    it("should run with full access user and 4 lang", function (bddone) {
      testutil.startServer("UserWith4Lang", function() {
        request.get({ url: url, jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
          bddone();
        });
      });
    });
    it("should run with full access user and missing article", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: baseLink + "/article/999", jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("Article ID 999 does not exist");
          bddone();
        });
      });
    });
    it("should run with full access user and not numbered article ID", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: baseLink + "/article/walo", jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("Article ID walo does not exist (conversion error)");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, jar: jar}, function (err, response) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          bddone();
        });
      });
    });
    it("should allow non existing user for self collected", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: baseLink + "/article/1", jar: jar}, function (err, response,body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
          bddone();
        });
      });
    });
    it("should deny for guest user for non self collected", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: baseLink + "/article/2", jar: jar}, function (err, response,body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql('This article is not allowed for guests');
          bddone();
        });
      });
    });
    it("should allow for guest user invited by comment", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: baseLink + "/article/3", jar: jar}, function (err, response,body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<option value="BLOG" selected="selected">BLOG (Edit)</option>');
          bddone();
        });
      });
    });
  });
  describe("route GET /article/:id/votes", function() {
    let url = baseLink + "/article/" + id + "/votes";
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: url, jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          let json = JSON.parse(body);

          json["#voteButtons"].should.containEql("callAndRedraw(\'/article/2/setVote.unpublish\'");
          json["#voteButtonsList"].should.containEql('<i class="fa-lg fa fa-thumbs-up">');

          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route GET /article/:id/commentArea", function() {
    let url = baseLink + "/article/" + id + "/commentArea";
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: url, jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          let json = JSON.parse(body);

          json["#commentArea"].should.containEql("Your comment is shared between all weekly teams.");

          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("This article is not allowed for guests");
          bddone();
        });
      });
    });
  });
  describe("route GET /article/:id/markCommentRead", function() {
    let url = baseLink + "/article/" + id + "/markCommentRead?index=0";
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: url, jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("Your comment is shared between all weekly teams.");
          articleModule.findById(2, function(err, article) {
            should.not.exist(err);
            should(article.commentRead.TestUser).eql("0");
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("This article is not allowed for guests");
          bddone();
        });
      });
    });
  });
  describe("route GET /article/:id/:action.:tag", function() {
    let url = baseLink + "/article/" + id + "/setTag.tag";
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: url, jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body).equal("OK");
          articleModule.findById(2, function(err, article) {
            should.not.exist(err);
            should(article.tags).eql([ "tag" ]);
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route GET /article/:id/:votename", function() {
    let url = baseLink + "/article/" + id + "/pro";
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: url, jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          let json = JSON.parse(body);
          json["#vote_pro_2"].should.containEql('class="label osmbc-btn-not-voted"');

          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route GET /list", function() {
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: baseLink + "/article/list", jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<td><a href="/article/2">BLOG</a></td>');
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: baseLink + "/article/list", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: baseLink + "/article/list", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route GET /create", function() {
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: baseLink + "/article/create", jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<p class="osmbc-help-text" align="center">Please check your link for duplicates before   collecting.</p>');
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: baseLink + "/article/create", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: baseLink + "/article/create", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<p class="osmbc-help-text" align="center">Please check your link for duplicates before   collecting.</p>');
          bddone();
        });
      });
    });
  });
  describe("route GET /searchandcreate", function() {
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: baseLink + "/article/searchandcreate?search=hallo", jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<p class="osmbc-help-text" align="center">Please check your link for duplicates before   collecting.</p>');
          body.should.containEql('<input class="form-control" id="searchField" type="text" name="search" value="hallo">');
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: baseLink + "/article/searchandcreate?search=hallo", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: baseLink + "/article/searchandcreate?search=hallo", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<p class="osmbc-help-text" align="center">Please check your link for duplicates before   collecting.</p>');
          body.should.containEql('<input class="form-control" id="searchField" type="text" name="search" value="hallo">');
          bddone();
        });
      });
    });
  });
  describe("route GET /search", function() {
    it("should run with full access user", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.get({ url: baseLink + "/article/search?search=hallo", jar: jar}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<input class="form-control" id="searchField" type="text" name="search" value="hallo">');
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: baseLink + "/article/search?search=hallo", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: baseLink + "/article/search?search=hallo", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /create", function() {
    let url = baseLink + "/article/create";
    let params = {blog: "BLOG",
      collection: "COLLECTION",
      categoryEN: "categoryEN",
      version: "1",
      title: "title",
      commentStatus: "close",
      unpublishReason: "unpublishReason",
      unpublishReference: "unpublishReference"};
    it("should run with full access user", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function() {
        request.post({ url: url, form: params, jar: jar, followAllRedirects: true}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("unpublishReason");
          articleModule.findById(4, function(err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              id: "4",
              version: 2,
              commentStatus: "close",
              blog: "BLOG",
              collection: "COLLECTION",
              categoryEN: "categoryEN",
              title: "title",
              unpublishReason: "unpublishReason",
              unpublishReference: "unpublishReference",
              firstCollector: "TestUser"
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServerWithLogin("TestUserDenied",jar, function() {
        request.post({ url: url, form: params, jar: jar, followAllRedirects: true}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting",jar, function () {
        request.post({ url: url, form: params, jar: jar, followAllRedirects: true}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("unpublishReason");
          articleModule.findById(4, function (err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              id: "4",
              version: 2,
              commentStatus: "close",
              blog: "BLOG",
              collection: "COLLECTION",
              categoryEN: "categoryEN",
              title: "title",
              unpublishReason: "unpublishReason",
              unpublishReference: "unpublishReference",
              firstCollector: "TestUserNonExisting"
            });
            bddone();
          });
        });
      });
    });
  });
  describe("route POST /:article_id", function() {
    let url = baseLink + "/article/2";
    let params = {
      title: "new title",
      version: 1,
      collection: "new collection"};
    it("should run with full access user", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function() {
        request.post({ url: url, form: params, jar: jar,followAllRedirects:true}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("new collection");
          articleModule.findById(2, function(err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              "blog": "BLOG",
              "category": "Keine",
              "collection": "new collection",
              "commentList": [
                {
                  "text": "comment",
                  "user": "Hallo"
                }
              ],
              "id": "2",
              "markdownDE": "* Dies ist ein grosser Testartikel.",
              "title": "new title",
              "version": 2
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting",jar, function () {
        request.post({url: url, jar: jar,followAllRedirects:true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /:article_id/witholdvalues", function() {
    let url = baseLink + "/article/2/witholdvalues";
    let params = {
      title: "new title2",
      old_title: "BLOG",
      collection: "new collection",
      old_collection: ""};
    it("should run with full access user", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function() {
        request.post({ url: url, form: params, jar: jar, followAllRedirects: true}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("BLOG");
          articleModule.findById(2, function(err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              "blog": "BLOG",
              "category": "Keine",
              "collection": "new collection",
              "commentList": [
                {
                  "text": "comment",
                  "user": "Hallo"
                }
              ],
              "id": "2",
              "markdownDE": "* Dies ist ein grosser Testartikel.",
              "title": "new title2",
              "version": 2
            });
            bddone();
          });
        });
      });
    });
    it("should fail with wrong old Values", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar,function(err){
        should.not.exist(err);
        request.post({ url: url, form: {title: "new title", old_title: "old title"}, followAllRedirects: true, jar: jar}, function(err, response, body) {
          should.not.exist(err);
          // there should be an error, as old title is not the correct one
          should(response.statusCode).eql(500);
          body.should.containEql("Field title already changed in DB");

          // check, that object is not changed
          articleModule.findById(2, function (err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              "blog": "BLOG",
              "category": "Keine",
              "commentList": [
                {
                  "text": "comment",
                  "user": "Hallo"
                }
              ],
              "id": "2",
              "markdownDE": "* Dies ist ein grosser Testartikel.",
              "title": "BLOG",
              "version": 1
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, form: params, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, form: params, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /:article_id/setMarkdown/:lang", function() {
    let url = baseLink + "/article/2/setMarkdown/DE";
    let params = {
      markdown: "new Content",
      oldMarkdown: "* Dies ist ein grosser Testartikel."
    };
    it("should run with full access user", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar,function() {
        request.post({ url: url, form: params, jar: jar,followAllRedirects:true}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          // ..setMarkdown/DE is redirecting to caller page, that is
          // /osmbc in this case
          body.should.containEql("OSMBC");
          articleModule.findById(2, function(err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              "blog": "BLOG",
              "category": "Keine",
              "commentList": [
                {
                  "text": "comment",
                  "user": "Hallo"
                }
              ],
              "id": "2",
              "markdownDE": "new Content",
              "title": "BLOG",
              "version": 2
            });
            bddone();
          });
        });
      });
    });
    it("should fail with wrong old Values", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar,function() {
        request.post({ url: url, form: {markdown: "new", oldMarkdown: "old"}, jar: jar,followAllRedirects:true}, function(err, response, body) {
          should.not.exist(err);
          // there should be an error, as old title is not the correct one
          should(response.statusCode).eql(500);
          body.should.containEql("Field markdownDE already changed in DB");

          // check, that object is not changed
          articleModule.findById(2, function(err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              "blog": "BLOG",
              "category": "Keine",
              "commentList": [
                {
                  "text": "comment",
                  "user": "Hallo"
                }
              ],
              "id": "2",
              "markdownDE": "* Dies ist ein grosser Testartikel.",
              "title": "BLOG",
              "version": 1
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServerWithLogin("TestUserDenied",jar, function () {
        request.post({url: url, form: params, jar: jar,followAllRedirects:true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting",jar, function () {
        request.post({url: url, form: params, jar: jar,followAllRedirects:true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /:article_id/addComment/", function() {
    let url = baseLink + "/article/2/addComment";
    let params = {
      comment: "This comment will be added."
    };
    it("should run with full access user", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function() {
        request.post({ url: url, form: params, jar: jar,followAllRedirects:true}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("This comment will be added.");
          articleModule.findById(2, function(err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              "blog": "BLOG",
              "category": "Keine",
              "commentList": [
                {
                  "text": "comment",
                  "user": "Hallo"
                },
                {
                  "text": "This comment will be added.",
                  "timestamp": "2016-05-25T20:00:00.000Z",
                  "user": "TestUser"
                }
              ],
              "commentRead": {
                "TestUser": 1
              },
              commentStatus: "open",
              "id": "2",
              "markdownDE": "* Dies ist ein grosser Testartikel.",
              "title": "BLOG",
              "version": 2
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, form: params, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, form: params, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /:article_id/editComment/", function() {
    let url = baseLink + "/article/2/editComment/0";
    let params = {
      comment: "This comment will be changed."
    };
    it("should run with full access user", function (bddone) {
      testutil.startServerWithLogin("Hallo",jar, function() {
        request.post({ url: url, form: params, jar: jar,followAllRedirects:true}, function(err, response, body) {
          should.not.exist(err);
          body.should.containEql("This comment will be changed.");
          articleModule.findById(2, function(err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              "blog": "BLOG",
              "category": "Keine",
              "commentList": [
                {
                  "text": "This comment will be changed.",
                  "editstamp": "2016-05-25T20:00:00.000Z",
                  "user": "Hallo"
                }
              ],
              "id": "2",
              "markdownDE": "* Dies ist ein grosser Testartikel.",
              "title": "BLOG",
              "version": 2
            });
            bddone();
          });
        });
      });
    });
    it("should fail if other user comment is edited", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function() {
        request.post({ url: url, form: params, jar: jar,followAllRedirects:true}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("Only Writer is allowed to change a commment");
          articleModule.findById(2, function(err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              "blog": "BLOG",
              "category": "Keine",
              "commentList": [
                {
                  "text": "comment",
                  "user": "Hallo"
                }
              ],
              "id": "2",
              "markdownDE": "* Dies ist ein grosser Testartikel.",
              "title": "BLOG",
              "version": 1
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, form: params, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting",jar, function () {
        request.post({url: url, form: params, jar: jar,followAllRedirects:true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /:article_id/copyto/:blog", function() {
    let url = baseLink + "/article/2/copyto/secondblog";
    it("should run with full access user", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function() {
        request.post({ url: url, jar: jar,followAllRedirects:true}, function(err, response, body) {
          should.not.exist(err);
          body.should.containEql("secondblog");

          should(response.statusCode).eql(200);
          articleModule.findById(4, function(err, article) {
            should.not.exist(err);
            delete article._blog;
            should(article).eql({
              blog: "secondblog",
              id: "4",
              markdownDE: "Former Text:\n\n* Dies ist ein grosser Testartikel.",
              title: "BLOG",
              originArticleId: "2",
              version: 1
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting",jar, function () {
        request.post({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /translate/deepl/:fromLang/:toLang", function() {
    let url = baseLink + "/article/translate/deepl/DE/EN";
    let form = {text: "Dies ist ein deutscher Text."};
    let stub;
    let stub2;
    beforeEach(function() {
      stub = sinon.stub(articleRouterForTestOnly.msTransClient, "translate").callsFake(function(params, callback) {
        should(params.from).eql("DE");
        should(params.to).eql("EN");
        should(params.text).eql("Dies ist ein deutscher Text.");
        return callback(null, "This is an english text.");
      });
      stub2 = sinon.stub(deeplTranslate, "translate").callsFake(function(text, to, from) {
        should(from).eql("DE");
        should(to).eql("EN");
        should(text).eql("Dies ist ein deutscher Text.");
        return new Promise((resolve) => { resolve({translation: "This is an english text."}); });
      });
    });
    afterEach(function() {
      stub.restore();
      stub2.restore();
    });

    it("should run with full access user", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function() {
        request.post({ url: url, form: form, jar: jar,followAllRedirects:true}, function(err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body).equal("This is an english text.");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServerWithLogin("TestUserDenied",jar, function () {
        request.post({url: url, form: form, jar: jar,followAllRedirects:true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          should(stub.called).be.False();
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting", jar,function () {
        request.post({url: url, form: form, jar: jar,followAllRedirects:true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          should(stub.called).be.False();
          bddone();
        });
      });
    });
  });
});
