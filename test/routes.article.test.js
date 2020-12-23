"use strict";

/* jshint ignore:start */


const sinon   = require("sinon");
const should  = require("should");
const nock    = require("nock");
const config  = require("../config.js");
const mockdate = require("mockdate");
const HttpStatus = require('http-status-codes');
const deeplClient = require("deepl-client");
const initialise = require("../util/initialise.js");
const rp = require("request-promise-native");


const articleModule = require("../model/article.js");
const logModule = require("../model/logModule.js");

const articleRouterForTestOnly = require("../routes/article.js").fortestonly;
const bingTranslatorForTestOnly = require("../model/translator.js").fortestonly;

const testutil = require("./testutil.js");

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();


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
  this.timeout(this.timeout() * 10);
  var id = 2;
  let jar={};

  before( async function () {
    await initialise.initialiseModules();
    await testutil.clearDB();
    testutil.startServerSync();
    jar.testUser = await testutil.getUserJar("TestUser");
    jar.userWith3Lang  = await testutil.getUserJar("UserWith3Lang");
    jar.userWith4Lang = await testutil.getUserJar("UserWith4Lang");
    jar.testUserDenied = await testutil.getUserJar("TestUserDenied");
    jar.testUserNonExisting = await testutil.getUserJar("TestUserNonExisting");
    jar.hallo = await testutil.getUserJar("Hallo");
    jar.guestUser = await testutil.getUserJar("guestUser");
    jar.testUserNonExisting = await testutil.getUserJar("TestUserNonExisting");
  });

  after(function (bddone) {
    nock.cleanAll();
    testutil.stopServer();
    mockdate.reset();
    bddone();
  });

  beforeEach(function (bddone) {
    // Clear DB Contents for each test
    mockdate.set(new Date("2016-05-25T20:00:00Z"));
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(HttpStatus.OK, "ok");
    testutil.importData(
      {
        "blog": [{name: "BLOG", status: "edit"},
          {name: "secondblog", status: "edit"}],
        "user": [{"OSMUser": "TestUser", access: "full"},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"},
          { "OSMUser": "UserWith3Lang", access: "full", languageCount: "three"},
          { "OSMUser": "guestUser", access: "guest", languageCount: "three"},
          { "OSMUser": "UserWith4Lang", access: "full", languageCount: "four"}
        ],
        "article": [
          {"blog": "BLOG", "markdownDE": "* Dies ist ein kleiner Testartikel.", "category": "Mapping",firstCollector:"TestUserNonExisting"},
          {"blog": "BLOG", "title": "BLOG", "markdownDE": "* Dies ist ein grosser Testartikel.", "category": "Keine", commentList: [{user: "Hallo", text: "comment"}]},
          {"blog": "BLOG", "title": "BLOG", "markdownDE": "* Dies ist ein grosser Testartikel.", "category": "Keine", commentList: [{user: "Hallo", text: "comment for @TestUserNonExisting"}]}],
    clear: true}, bddone);
  });
  afterEach(function(bddone){
    return bddone();
  });
  describe("route GET /article/:id", function() {
    let url = baseLink + "/article/" + id;
    it("should run with full access user", async function () {
      let body = await rp.get({ url: url, jar: jar.testUser});
      should(body).containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
    });
    it("should run with full access user and 3 lang", async function() {
      let body = await rp.get({ url: url, jar: jar.userWith3Lang});
      body.should.containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
    });
    it("should run with full access user and 4 lang", async function () {
      let body = await rp.get({ url: url, jar: jar.userWith4Lang});
      body.should.containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
    });
    it("should run with full access user and missing article", async function () {

      let response = await rp.get({
        url: baseLink + "/article/999",
        jar: jar.testUser,
        simple: false,
        resolveWithFullResponse: true});
      should(response.statusCode).eql(HttpStatus.NOT_FOUND);
      response.body.should.containEql("Article ID 999 does not exist");
    });
    it("should run with full access user and not numbered article ID", async function () {
      let response = await rp.get({
        url: baseLink + "/article/walo",
        jar: jar.testUser,
        simple: false,
        resolveWithFullResponse: true});
      should(response.statusCode).eql(HttpStatus.NOT_FOUND);
      response.body.should.containEql("Article ID walo does not exist (conversion error)");
    });
    it("should deny denied access user", async function () {
      let response = await rp.get({
        url: url,
        jar: jar.testUserDenied,
        simple: false,
        resolveWithFullResponse: true});
      should(response.statusCode).eql(HttpStatus.FORBIDDEN);
      response.body.should.containEql("OSM User >TestUserDenied< has no access rights");
    });
    it("should deny non existing user", async function () {
      let response = await rp.get({
        url: url,
        jar: jar.testUserNonExisting,
        simple: false,
        resolveWithFullResponse: true});
      should(response.statusCode).eql(HttpStatus.FORBIDDEN);
      response.body.should.containEql("This article is not allowed for guests");

    });
    it("should allow non existing user for self collected", async function () {
      let response = await rp.get({
        url: baseLink + "/article/1",
        jar: jar.testUserNonExisting,
        simple: false,
        resolveWithFullResponse: true});
      should(response.statusCode).eql(HttpStatus.OK);
      response.body.should.containEql('<option value="BLOG" selected="selected">BLOG </option>');
    });
    it("should deny for guest user for non self collected", async function () {
      let response = await rp.get({
        url: baseLink + "/article/2",
        jar: jar.testUserNonExisting,
        simple: false,
        resolveWithFullResponse: true});
      should(response.statusCode).eql(HttpStatus.FORBIDDEN);
      response.body.should.containEql('This article is not allowed for guests');
    });
    it("should allow for guest user invited by comment", async function () {
      let body = await rp.get({url: baseLink + "/article/3", jar: jar.testUserNonExisting});
      body.should.containEql('<option value="BLOG" selected="selected">BLOG </option>');
    });
  });

  function checkUrlWithJar(options) {

    return async function()
    {
      should.exist(options.user);
      should.exist(jar[options.user]);
      should.exist(options.url);
      should.exist(options.expectedMessage);
      should.exist(options.expectedStatusCode);
      let response = await rp.get({url: options.url, jar: jar[options.user], simple: false, resolveWithFullResponse: true});
      response.body.should.containEql(options.expectedMessage);
      should(response.statusCode).eql(options.expectedStatusCode);
    }
  }
  function postUrlWithJar(options) {

    return async function()
    {
      should.exist(options.user);
      should.exist(jar[options.user]);
      should.exist(options.url);
      should.exist(options.form);
      should.exist(options.expectedMessage);
      should.exist(options.expectedStatusCode);
      let response = await rp.post({url: options.url, form: options.form, jar: jar[options.user], simple: false, resolveWithFullResponse: true});
      response.body.should.containEql(options.expectedMessage);
      should(response.statusCode).eql(options.expectedStatusCode);
    }
  }
  describe("route GET /article/:id/votes", function() {
    let url = baseLink + "/article/" + id + "/votes";
    it("should run with full access user", async function () {
      let body = await rp.get({ url: url, jar: jar.testUser});
      let json = JSON.parse(body);
      json["#voteButtons"].should.containEql("callAndRedraw(\'/article/2/setVote.unpublish\'");
      json["#voteButtonsList"].should.containEql('<i class="fa-lg fa fa-thumbs-up">');
    });
    it("should deny denied access user",
      checkUrlWithJar ({
        url:url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar ({
          url: url,
          user: "testUserNonExisting",
          expectedStatusCode: HttpStatus.FORBIDDEN,
          expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
        }));
  });
  describe("route GET /article/:id/commentArea", function() {
    let url = baseLink + "/article/" + id + "/commentArea";
    it("should run with full access user", async function () {
      let body = await rp.get({ url: url, jar: jar.testUser});
      let json = JSON.parse(body);
      json["#commentArea"].should.containEql("Your comment is shared between all weekly teams.");
    });
    it("should deny denied access user",
      checkUrlWithJar ({
          url: url,
          user: "testUserDenied",
          expectedStatusCode: HttpStatus.FORBIDDEN,
          expectedMessage: "OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user new",
      checkUrlWithJar ({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"}));
  });
  describe("route GET /article/:id/markCommentRead", function() {
    let url = baseLink + "/article/" + id + "/markCommentRead?index=0";
    it("should run with full access user", async function () {
      let body = await rp.get({ url: url, jar: jar.testUser});
      body.should.containEql("Your comment is shared between all weekly teams.");
      let article = await articleModule.findById(2);
      should(article.commentRead.TestUser).eql("0");
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"
      }));
  });
  describe("route GET /article/:id/:action.:tag",  function() {
    let url = baseLink + "/article/" + id + "/setTag.tag";
    it("should run with full access user", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      should(body).equal("OK");
      let article = await articleModule.findById(2);
      should(article.tags).eql([ "tag" ]);
    });

    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route GET /article/:id/:votename", function() {
    let url = baseLink + "/article/" + id + "/pro";
    it("should run with full access user", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      let json = JSON.parse(body);
      json["#vote_pro_2"].should.containEql('class="label osmbc-btn-not-voted"');
    });

    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route GET /list", function() {
    let url = baseLink + "/article/list";
    it("should run with full access user", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql('<td><a href="/article/2">BLOG</a></td>');
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route GET /create", function() {
    let url = baseLink + "/article/create";
    it("should run with full access user", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql('<p class="osmbc-help-text" align="center">Please check your link for duplicates before collect it.</p>');
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "<p class=\"osmbc-help-text\" align=\"center\">Please check your link for duplicates before submit it.</p>"
      }));
  });
  describe("route GET /searchandcreate", function() {
    let url = baseLink + "/article/searchandcreate?search=hallo"
    it("should run with full access user", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql('<p class="osmbc-help-text" align="center">Please check your link for duplicates before collect it.</p>');
      body.should.containEql('<input class="form-control" id="searchField" type="text" name="search" value="hallo">');
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "<p class=\"osmbc-help-text\" align=\"center\">Please check your link for duplicates before submit it.</p>"
      }));
  });
  describe("route GET /search", function() {
    let url = baseLink + "/article/search?search=hallo";
    it("should run with full access user", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql('<input class="form-control" id="searchField" type="text" name="search" value="hallo">');
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
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
    it("should run with full access user", async function () {
      let body = await rp.post({url: url, form: params, jar: jar.testUser, followAllRedirects: true});
      body.should.containEql("unpublishReason");
      let article = await articleModule.findById(4);
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
    });
    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing user", async function () {
      let body = await rp.post({url: url, form: params, jar: jar.testUserNonExisting, followAllRedirects: true});
      body.should.containEql("unpublishReason");
      let article = await articleModule.findById(4);
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
    });
  });
  describe("route POST /:article_id", function() {
    let url = baseLink + "/article/2";
    let params = {
      title: "new title",
      version: 1,
      collection: "new collection"};
    it("should run with full access user", async function () {
      let body = await rp.post({url: url, form: params, jar: jar.testUser,followAllRedirects:true});
      body.should.containEql("new collection");
      let article = await articleModule.findById(2);
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
    });
    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non Existing user",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /:article_id/witholdvalues", function() {
    let url = baseLink + "/article/2/witholdvalues";
    let params = {
      title: "new title2",
      old_title: "BLOG",
      collection: "new collection",
      old_collection: ""};
    it("should run with full access user", async function () {
      let body = await rp.post({url: url, jar: jar.testUser, followAllRedirects: true, form: params});
      body.should.containEql("BLOG");
      let article = await articleModule.findById(2);
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
    });
    it("should fail with wrong old Values", async function () {
      let response = await rp.post({
        url: url,
        form: {title: "new title", old_title: "old title"},
        simple: false,
        followAllRedirects: true,
        jar: jar.testUser,
        resolveWithFullResponse: true
      });
      should(response.statusCode).eql(HttpStatus.CONFLICT);
      response.body.should.containEql("Field title already changed in DB");

      // check, that object is not changed
      let article = await articleModule.findById(2);

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
    });
    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users 2",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"
      }));
  });
  describe("route POST /:article_id/setMarkdown/:lang", function() {
    let url = baseLink + "/article/2/setMarkdown/DE";
    let params = {
      markdown: "new Content",
      oldMarkdown: "* Dies ist ein grosser Testartikel."
    };
    it("should run with full access user", async function () {
      let body = await rp.post({ url: url, form: params, jar: jar.testUser,followAllRedirects:true});
      // ..setMarkdown/DE is redirecting to caller page, that is
      // /osmbc in this case
      body.should.containEql("OSMBC");
      let article = await articleModule.findById(2);

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
    });
    it("should fail with wrong old Values", async function () {
      let response = await rp.post({
        url: url,
        form: {markdown: "new", oldMarkdown: "old"},
        jar: jar.testUser,
        followAllRedirects:true,
        simple: false,
        resolveWithFullResponse: true
      });
      // there should be an error, as old title is not the correct one
      should(response.statusCode).eql(HttpStatus.CONFLICT);
      response.body.should.containEql("Field markdownDE already changed in DB");

      // check, that object is not changed
      let article = await articleModule.findById(2);

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
    });
    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /:article_id/reviewChange/:lang", function() {
    let url = baseLink + "/article/2/reviewChange/DE";
    let params = {
      markdown: "* Dies ist ein grosser Testartikel."
    };
    it("should run with full access user", async function () {
      let body = await rp.post({ url: url, form: params, jar: jar.testUser,followAllRedirects:true});
      // ..setMarkdown/DE is redirecting to caller page, that is
      // /osmbc in this case
      body.should.containEql("<!-- Full Access Index Page-->");
      let article = await articleModule.findById(2);

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

      logModule.find({table:"article"},function(err,result){
        should.not.exist(err);
        should(result[1]).eql({
                oid: '2',
          blog: 'BLOG',
          user: 'TestUser',
          table: 'article',
          property: 'action',
          to: 'Review Change of markdownDE',
          timestamp: '2016-05-25T20:00:00.000Z',
          id: '10'
        })
      })
    });
    it("should fail with wrong old Values", async function () {
      let response = await rp.post({
        url: url,
        form: {markdown: "simulate different earlier Value in Form"},
        jar: jar.testUser,
        followAllRedirects:true,
        simple: false,
        resolveWithFullResponse: true
      });
      // there should be an error, as old title is not the correct one
      should(response.statusCode).eql(HttpStatus.CONFLICT);
      response.body.should.containEql("Field markdownDE already changed in DB");

      // check, that object is not changed
      let article = await articleModule.findById(2);

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
    });
    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /:article_id/addComment/", function() {
    let url = baseLink + "/article/2/addComment";
    let params = {
      comment: "This comment will be added."
    };
    it("should run with full access user", async function () {
      let body = await rp.post({ url: url, form: params, jar: jar.testUser,followAllRedirects:true});
      body.should.containEql("This comment will be added.");
      let article = await articleModule.findById(2);

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
    });
    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"
      }));
  });
  describe("route POST /:article_id/editComment/", function() {
    let url = baseLink + "/article/2/editComment/0";
    let params = {
      comment: "This comment will be changed."
    };
    it("should run with full access user", async function () {
      let body = await rp.post({ url: url, form: params, jar: jar.hallo,followAllRedirects:true});
      body.should.containEql("This comment will be changed.");
      let article = await articleModule.findById(2);

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
    });
    it("should fail if other user comment is edited", async function () {
      let response = await rp.post({
        url: url,
        form: params,
        jar: jar.testUser,
        followAllRedirects:true,
        simple: false,
        resolveWithFullResponse: true
      });
      should(response.statusCode).eql(HttpStatus.CONFLICT);
      response.body.should.containEql("Only Writer is allowed to change a commment");
      let article = await articleModule.findById(2);

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
    });
    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      // Non existing users will become Guest. but guest has to be able to see the article
      postUrlWithJar({
        url: url,
        form: params,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"
      }));
  });
  describe("route POST /:article_id/copyto/:blog", function() {
    let url = baseLink + "/article/2/copyto/secondblog";
    let form = {};
    it("should run with full access user", async function () {
      let body = await rp.post({ url: url, jar: jar.testUser,followAllRedirects:true});
      body.should.containEql("secondblog");
      let article = await articleModule.findById(4);

      delete article._blog;
      should(article).eql({
        blog: "secondblog",
        id: "4",
        markdownDE: "Former Text:\n\n* Dies ist ein grosser Testartikel.",
        title: "BLOG",
        originArticleId: "2",
        version: 1
      });
    });
    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: form,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      postUrlWithJar({
        url: url,
        form: form,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /translate/deeplPro/:fromLang/:toLang", function() {
    let url = baseLink + "/article/translate/deeplPro/DE/EN";
    let form = {text: "Dies ist ein deutscher Text."};
    let stub;
    let stub2;
    beforeEach(function() {
      stub = sinon.stub(bingTranslatorForTestOnly.msTransClient, "translate").callsFake(function(params, callback) {
        should(params.from).eql("DE");
        should(params.to).eql("EN");
        should(params.text).eql("Dies ist ein deutscher Text.");
        return callback(null, "This is an english text.");
      });
      stub2 = sinon.stub(deeplClient, "translate").callsFake(function(option) {
        should(option.source_lang).eql("DE");
        should(option.target_lang).eql("EN");
        should(option.text).eql("<p>Dies ist ein deutscher Text.</p>\n");
        should(option.auth_key).eql("Test Key Fake");
        let result = {};
        result.translations = [];
        result.translations[0] = {text:"This is an english text.",source_lang: "DE", target_lang:"EN"};

        return new Promise((resolve) => { resolve(result); });
      });
    });
    afterEach(function() {
      stub.restore();
      stub2.restore();
    });

    it("should run with full access user", async function () {
      let body = await rp.post({ url: url, form: form, jar: jar.testUser,followAllRedirects:true});
      should(body).equal("This is an english text.");
    });
    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: form,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      postUrlWithJar({
        url: url,
        form: form,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });

  describe("route POST /article/urlexist", function() {
    let url = baseLink + "/article/urlexist";
    let form = {url: "https://www.site.ort/apage"};

    it("should run with full access user existing site", async function () {
      let sitecall = nock("https://www.site.ort")
        .get("/apage")
        .reply(200,"OK");

      let response = await rp.post({url: url, form: form, jar: jar.testUser, simple: false, resolveWithFullResponse: true});

      response.body.should.eql("OK");
      should(response.statusCode).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();
    });

    it("should run with full access user with error", async function () {
      let form = {url: "https://www.site.ort2/apage"};
      let sitecall = nock("https://www.site.ort2")
        .get("/apage")
        .replyWithError({message:"not found"});
      let response = await rp.post({url: url, form: form, jar: jar.testUser, simple: false, resolveWithFullResponse: true});

      response.body.should.eql("not found");
      should(response.statusCode).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();
    });
    it("should run with full access user with http error", async function () {
      let form = {url: "https://www.site.ort2/apage"};
      let sitecall = nock("https://www.site.ort2")
        .get("/apage")
        .reply(404,"something went wrong");
      let response = await rp.post({url: url, form: form, jar: jar.testUser, simple: false, resolveWithFullResponse: true});

      response.body.should.eql("404");
      should(response.statusCode).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();
    });

    it("should run with guest access user", async function () {
      let form = {url: "https://www.site.ort3/apage"};
      let sitecall = nock("https://www.site.ort3")
        .get("/apage")
        .reply(200,"OK");
      let response = await rp.post(
        {
          url: url,
          form: form,
          jar: jar.guestUser,
          simple: false,
          resolveWithFullResponse: true,
          followAllRedirects: true});

      response.body.should.eql("OK");
      should(response.statusCode).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();

      // Try a second time, url should be cached and not called
      sitecall = nock("https://www.site.ort3")
        .get("/apage")
        .reply(200,"OK");
      response = await rp.post(
        {
          url: url,
          form: form,
          jar: jar.guestUser,
          simple: false,
          resolveWithFullResponse: true,
          followAllRedirects: true});

      response.body.should.eql("OK");
      should(response.statusCode).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.false();
    });

    it("should deny denied access user",
      postUrlWithJar({
        url: url,
        form: form,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should use guest user for non existing users",async function () {
      let form = {url: "https://www.site.ort4/apage"};
      let sitecall = nock("https://www.site.ort4")
        .get("/apage")
        .reply(200,"OK");
      let response = await rp.post(
        {
          url: url,
          form: form,
          jar: jar.testUserNonExisting,
          simple: false,
          resolveWithFullResponse: true,
          followAllRedirects: true});

      response.body.should.eql("OK");
      should(response.statusCode).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();
    });
  });
});


/* jshint ignore:end */
