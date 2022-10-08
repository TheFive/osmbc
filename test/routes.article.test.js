"use strict";

/* jshint ignore:start */


const sinon   = require("sinon");
const should  = require("should");
const nock    = require("nock");
const config  = require("../config.js");
const mockdate = require("mockdate");
const HttpStatus = require("http-status-codes");
const initialise = require("../util/initialise.js");

const articleModule = require("../model/article.js");
const logModule = require("../model/logModule.js");

const articleRouterForTestOnly = require("../routes/article.js").fortestonly;
const bingTranslatorForTestOnly = require("../model/translator.js").fortestonly;

const testutil = require("./testutil.js");

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();




describe("routes/article", function() {
  this.timeout(this.timeout() * 10);
  const id = 2;

  before(async function () {
    await initialise.initialiseModules();
    await testutil.clearDB();
    testutil.startServerSync();
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
        blog: [{ name: "BLOG", status: "edit" },
          { name: "secondblog", status: "edit" }],
        user: [{ OSMUser: "TestUser", access: "full" },
          { OSMUser: "TestUserDenied", access: "denied" },
          { OSMUser: "Hallo", access: "full" },
          { OSMUser: "UserWith3Lang", access: "full", languageCount: "three" },
          { OSMUser: "guestUser", access: "guest", languageCount: "three" },
          { OSMUser: "UserWith4Lang", access: "full", languageCount: "four" }
        ],
        article: [
          { blog: "BLOG", markdownDE: "* Dies ist ein kleiner Testartikel.", category: "Mapping", firstCollector: "TestUserNonExisting" },
          { blog: "BLOG", title: "BLOG", markdownDE: "* Dies ist ein grosser Testartikel.", category: "Keine", commentList: [{ user: "Hallo", text: "comment" }] },
          { blog: "BLOG", title: "BLOG", markdownDE: "* Dies ist ein grosser Testartikel.", category: "Keine", commentList: [{ user: "Hallo", text: "comment for @TestUserNonExisting" }] }],
        clear: true
      }, bddone);
  });
  afterEach(function(bddone) {
    return bddone();
  });
  describe("routes/articleInternal", function() {
    const fixMarkdownLinks = articleRouterForTestOnly.fixMarkdownLinks;
    describe("fixMarkdownLinks", function() {
      it("should do not change without error", function(bddone) {
        should(fixMarkdownLinks("Simple Text")).eql("Simple Text");
        should(fixMarkdownLinks("Simple Text with a [link](links.links).")).eql("Simple Text with a [link](links.links).");
        bddone();
      });
      it("should fix missing leading space", function(bddone) {
        should(fixMarkdownLinks("Simple Text with a[link](links.links)")).eql("Simple Text with a [link](links.links)");
        bddone();
      });
      it("should fix missing ending space", function(bddone) {
        should(fixMarkdownLinks("Simple Text with a [link](links.links)written.")).eql("Simple Text with a [link](links.links) written.");
        bddone();
      });
      it("should fix a space in link", function(bddone) {
        should(fixMarkdownLinks("Simple Text with a [link] (links.links).")).eql("Simple Text with a [link](links.links).");
        bddone();
      });
    });
  });
  describe("route GET /article/:id", function() {
    const url = baseLink + "/article/" + id;
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      should(body.data).containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
    });
    it("should run with full access user and 3 lang", async function() {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "UserWith3Lang", password: "UserWith3Lang" });
      const body = await client.get(url);

      body.data.should.containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
    });
    it("should run with full access user and 4 lang", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "UserWith4Lang", password: "UserWith4Lang" });
      const body = await client.get(url);


      body.data.should.containEql('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>');
    });
    it("should run with full access user and missing article", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(baseLink + "/article/999");



      should(body.status).eql(HttpStatus.NOT_FOUND);
      body.data.should.containEql("Article ID 999 does not exist");
    });
    it("should run with full access user and not numbered article ID", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(baseLink + "/article/walo");

      should(body.status).eql(HttpStatus.NOT_FOUND);
      body.data.should.eql("Check Article ID in Url, it is not a number (conversion error)");
    });
    it("should deny denied access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUserDenied", password: "TestUserDenied" });
      const body = await client.get(url);


      should(body.status).eql(HttpStatus.FORBIDDEN);
      body.data.should.containEql("OSM User >TestUserDenied< has no access rights");
    });
    it("should deny non existing user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUserNonExisting", password: "TestUserNonExisting" });
      const body = await client.get(url);

      should(body.status).eql(HttpStatus.FORBIDDEN);
      body.data.should.containEql("This article is not allowed for guests");
    });
    it("should allow non existing user for self collected", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUserNonExisting", password: "TestUserNonExisting" });
      const body = await client.get(baseLink + "/article/1");


      should(body.status).eql(HttpStatus.OK);
      body.data.should.containEql('<option value="BLOG" selected="selected">BLOG </option>');
    });
    it("should deny for guest user for non self collected", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUserNonExisting", password: "TestUserNonExisting" });
      const body = await client.get(baseLink + "/article/2");

      should(body.status).eql(HttpStatus.FORBIDDEN);
      body.data.should.containEql("This article is not allowed for guests");
    });
    it("should allow for guest user invited by comment", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUserNonExisting", password: "TestUserNonExisting" });
      const body = await client.get(baseLink + "/article/3");


      body.data.should.containEql('<option value="BLOG" selected="selected">BLOG </option>');
    });
  });


  describe("route GET /article/:id/votes", function() {
    const url = baseLink + "/article/" + id + "/votes";
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      const json = body.data;
      json["#voteButtons"].should.containEql("callAndRedraw(\'/article/2/setVote.unpublish\'");
      json["#voteButtonsList"].should.containEql('<i class="fa-lg fa fa-thumbs-up">');
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route GET /article/:id/commentArea", function() {
    const url = baseLink + "/article/" + id + "/commentArea";
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      const json = body.data;
      json["#commentArea"].should.containEql("Your comment is shared between all weekly teams.");
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing user new",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"
      }));
  });
  describe("route GET /article/:id/markCommentRead", function() {
    const url = baseLink + "/article/" + id + "/markCommentRead?index=0";
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);


      body.data.should.containEql("Your comment is shared between all weekly teams.");
      const article = await articleModule.findById(2);
      should(article.commentRead.TestUser).eql("0");
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing user user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"
      }));
  });
  describe("route GET /article/:id/:action.:tag", function() {
    const url = baseLink + "/article/" + id + "/setTag.tag";
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);
      should(body.data).equal("OK");
      const article = await articleModule.findById(2);
      should(article.tags).eql(["tag"]);
    });

    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route GET /article/:id/:votename", function() {
    const url = baseLink + "/article/" + id + "/pro";
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      const json = body.data;
      json["#vote_pro_2"].should.containEql('class="badge osmbc-btn-not-voted"');
    });

    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route GET /list", function() {
    const url = baseLink + "/article/list";
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      body.data.should.containEql('<td><a href="/article/2">BLOG</a></td>');
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route GET /create", function() {
    const url = baseLink + "/article/create";
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      body.data.should.containEql('<p class="osmbc-help-text" align="center">Please check your link for duplicates before collect it.</p>');
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "<p class=\"osmbc-help-text\" align=\"center\">Please check your link for duplicates before submit it.</p>"
      }));
  });
  describe("route GET /searchandcreate", function() {
    const url = baseLink + "/article/searchandcreate?search=hallo";
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      body.data.should.containEql('<p class="osmbc-help-text" align="center">Please check your link for duplicates before collect it.</p>');
      body.data.should.containEql('<input class="form-control" id="searchField" type="text" name="search" value="hallo">');
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "<p class=\"osmbc-help-text\" align=\"center\">Please check your link for duplicates before submit it.</p>"
      }));
  });
  describe("route GET /search", function() {
    const url = baseLink + "/article/search?search=hallo";
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      body.data.should.containEql('<input class="form-control" id="searchField" type="text" name="search" value="hallo">');
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non existing ",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /create", function() {
    const url = baseLink + "/article/create";
    const params = {
      blog: "BLOG",
      collection: "COLLECTION",
      categoryEN: "categoryEN",
      version: "1",
      title: "title",
      commentStatus: "close",
      unpublishReason: "unpublishReason",
      unpublishReference: "unpublishReference"
    };
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, params);

      body.data.should.containEql("unpublishReason");
      const article = await articleModule.findById(4);
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
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUserNonExisting", password: "TestUserNonExisting" });
      const body = await client.post(url, params);


      body.data.should.containEql("unpublishReason");
      const article = await articleModule.findById(4);
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
    const url = baseLink + "/article/2";
    const params = {
      title: "new title",
      version: 1,
      collection: "new collection"
    };
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, params);

      body.data.should.containEql("new collection");
      const article = await articleModule.findById(2);
      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        collection: "new collection",
        commentList: [
          {
            text: "comment",
            user: "Hallo"
          }
        ],
        id: "2",
        markdownDE: "* Dies ist ein grosser Testartikel.",
        title: "new title",
        version: 2
      });
    });
    it("should deny denied access user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny denied non Existing user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /:article_id/witholdvalues", function() {
    const url = baseLink + "/article/2/witholdvalues";
    const params = {
      title: "new title2",
      old_title: "BLOG",
      collection: "new collection",
      old_collection: ""
    };
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, params);

      body.data.should.containEql("BLOG");
      const article = await articleModule.findById(2);
      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        collection: "new collection",
        commentList: [
          {
            text: "comment",
            user: "Hallo"
          }
        ],
        id: "2",
        markdownDE: "* Dies ist ein grosser Testartikel.",
        title: "new title2",
        version: 2
      });
    });
    it("should fail with wrong old Values", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, { title: "new title", old_title: "old title" });


      should(body.status).eql(HttpStatus.CONFLICT);
      body.data.should.containEql("Field title already changed in DB");

      // check, that object is not changed
      const article = await articleModule.findById(2);

      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        commentList: [
          {
            text: "comment",
            user: "Hallo"
          }
        ],
        id: "2",
        markdownDE: "* Dies ist ein grosser Testartikel.",
        title: "BLOG",
        version: 1
      });
    });
    it("should deny denied access user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users 2",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"
      }));
  });
  describe("route POST /:article_id/setMarkdown/:lang", function() {
    const url = baseLink + "/article/2/setMarkdown/DE";
    const params = {
      markdown: "new Content",
      oldMarkdown: "* Dies ist ein grosser Testartikel."
    };
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, params);


      // ..setMarkdown/DE is redirecting to caller page, that is
      // /osmbc in this case
      body.data.should.containEql("OSMBC");
      const article = await articleModule.findById(2);

      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        commentList: [
          {
            text: "comment",
            user: "Hallo"
          }
        ],
        id: "2",
        markdownDE: "new Content",
        title: "BLOG",
        version: 2
      });
    });
    it("should fail with wrong old Values", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, { markdown: "new", oldMarkdown: "old" });


      // there should be an error, as old title is not the correct one
      should(body.status).eql(HttpStatus.CONFLICT);
      body.data.should.containEql("Field markdownDE already changed in DB");

      // check, that object is not changed
      const article = await articleModule.findById(2);

      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        commentList: [
          {
            text: "comment",
            user: "Hallo"
          }
        ],
        id: "2",
        markdownDE: "* Dies ist ein grosser Testartikel.",
        title: "BLOG",
        version: 1
      });
    });
    it("should deny denied access user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /:article_id/reviewChange/:lang", function() {
    const url = baseLink + "/article/2/reviewChange/DE";
    const params = {
      markdown: "* Dies ist ein grosser Testartikel."
    };
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, params);


      // ..setMarkdown/DE is redirecting to caller page, that is
      // /osmbc in this case
      body.data.should.containEql("<!-- Full Access Index Page-->");
      const article = await articleModule.findById(2);

      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        commentList: [
          {
            text: "comment",
            user: "Hallo"
          }
        ],
        id: "2",
        markdownDE: "* Dies ist ein grosser Testartikel.",
        title: "BLOG",
        version: 1
      });

      logModule.find({ table: "article" }, function(err, result) {
        should.not.exist(err);
        should(result[1]).eql({
          oid: "2",
          blog: "BLOG",
          user: "TestUser",
          table: "article",
          property: "action",
          to: "Review Change of markdownDE",
          timestamp: "2016-05-25T20:00:00.000Z",
          id: "10"
        });
      });
    });
    it("should fail with wrong old Values", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, { markdown: "simulate different earlier Value in Form" });

      // there should be an error, as old title is not the correct one
      should(body.status).eql(HttpStatus.CONFLICT);
      body.data.should.containEql("Field markdownDE already changed in DB");

      // check, that object is not changed
      const article = await articleModule.findById(2);

      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        commentList: [
          {
            text: "comment",
            user: "Hallo"
          }
        ],
        id: "2",
        markdownDE: "* Dies ist ein grosser Testartikel.",
        title: "BLOG",
        version: 1
      });
    });
    it("should deny denied access user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /:article_id/addComment/", function() {
    const url = baseLink + "/article/2/addComment";
    const params = {
      comment: "This comment will be added."
    };
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, params);

      body.data.should.containEql("This comment will be added.");
      const article = await articleModule.findById(2);

      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        commentList: [
          {
            text: "comment",
            user: "Hallo"
          },
          {
            text: "This comment will be added.",
            timestamp: "2016-05-25T20:00:00.000Z",
            user: "TestUser"
          }
        ],
        commentRead: {
          TestUser: 1
        },
        commentStatus: "open",
        id: "2",
        markdownDE: "* Dies ist ein grosser Testartikel.",
        title: "BLOG",
        version: 2
      });
    });
    it("should deny denied access user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"
      }));
  });
  describe("route POST /:article_id/editComment/", function() {
    const url = baseLink + "/article/2/editComment/0";
    const params = {
      comment: "This comment will be changed."
    };
    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "Hallo", password: "Hallo" });
      const body = await client.post(url, params);

      body.data.should.containEql("This comment will be changed.");
      const article = await articleModule.findById(2);

      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        commentList: [
          {
            text: "This comment will be changed.",
            editstamp: "2016-05-25T20:00:00.000Z",
            user: "Hallo"
          }
        ],
        id: "2",
        markdownDE: "* Dies ist ein grosser Testartikel.",
        title: "BLOG",
        version: 2
      });
    });
    it("should fail if other user comment is edited", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, params);

      should(body.status).eql(HttpStatus.CONFLICT);
      body.data.should.containEql("Only Writer is allowed to change a commment");
      const article = await articleModule.findById(2);

      delete article._blog;
      should(article).eql({
        blog: "BLOG",
        category: "Keine",
        commentList: [
          {
            text: "comment",
            user: "Hallo"
          }
        ],
        id: "2",
        markdownDE: "* Dies ist ein grosser Testartikel.",
        title: "BLOG",
        version: 1
      });
    });
    it("should deny denied access user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      // Non existing users will become Guest. but guest has to be able to see the article
      testutil.checkPostUrlWithUser({
        url: url,
        form: params,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "This article is not allowed for guests"
      }));
  });

  describe("route POST /translate/deeplPro/:fromLang/:toLang", function() {
    const url = baseLink + "/article/translate/deeplPro/DE/EN";
    const form = { text: "Dies ist ein deutscher Text." };
    let stub;
    beforeEach(async function() {
      stub = sinon.stub(bingTranslatorForTestOnly.msTransClient, "translate").callsFake(function(params, callback) {
        should(params.from).eql("DE");
        should(params.to).eql("EN");
        should(params.text).eql("Dies ist ein deutscher Text.");
        return callback(null, "This is an english text.");
      });
      nock("https://api.deepl.com")
        .post("/v2/translate", "auth_key=Test%20Key%20Fake&source_lang=DE&tag_handling=xml&target_lang=EN&text=%3Cp%3EDies%20ist%20ein%20deutscher%20Text.%3C%2Fp%3E%0A")
        .reply(200, { translations: [{ text: "This is an english text.", source_lang: "DE", target_lang: "EN" }] });
    });
    afterEach(async function() {
      stub.restore();
    });

    it("should run with full access user", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, form);


      should(body.data).equal("This is an english text.");
    });
    it("should deny denied access user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing users",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });

  describe("route POST /article/urlexist", function() {
    const url = baseLink + "/article/urlexist";
    let form = { urls: ["https://www.site.ort/apage"] };

    it("should run with full access user existing site", async function () {
      form = { urls: ["https://www.site.ort/apage", "https://www.site.ort2/apage", "https://www.site.ort2/äpäge"] };
      const sitecall = nock("https://www.site.ort")
        .get("/apage")
        .reply(200, "OK");
      const sitecall1 = nock("https://www.site.ort2")
        .get("/apage")
        .reply(404, " Not OK");
      const sitecall2 = nock("https://www.site.ort2")
        .get("/äpäge")
        .reply(200, "OK");

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, form);


      body.data.should.deepEqual({
        "https://www.site.ort/apage": "OK",
        "https://www.site.ort2/apage": 404,
        "https://www.site.ort2/äpäge": "OK"
      });
      should(body.status).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();
      should(sitecall1.isDone()).be.true();
      should(sitecall2.isDone()).be.true();
    });

    it("should run with full access user with error and string param", async function () {
      const form = { urls: "https://www.site.ort2/apage" };
      const sitecall = nock("https://www.site.ort2")
        .get("/apage")
        .reply(404, "Page Not Found");

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, form);

      body.data.should.deepEqual({ "https://www.site.ort2/apage": 404 });
      should(body.status).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();
    });
    it("should run with full access user with http error", async function () {
      const form = { urls: ["https://www.site.ort2/apage"] };
      const sitecall = nock("https://www.site.ort2")
        .get("/apage")
        .reply(404, "something went wrong");

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, form);

      body.data.should.deepEqual({ "https://www.site.ort2/apage": 404 });
      should(body.status).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();
    });

    it("should run with guest access user", async function () {
      const form = { urls: ["https://www.site.ort3/apage"] };
      let sitecall = nock("https://www.site.ort3")
        .get("/apage")
        .reply(200, "OK");

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "GuestUser", password: "GuestUser" });
      let body = await client.post(url, form);

      body.data.should.deepEqual({ "https://www.site.ort3/apage": "OK" });
      should(body.status).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();

      // Try a second time, url should be cached and not called
      sitecall = nock("https://www.site.ort3")
        .get("/apage")
        .reply(200, "OK");
      body = await client.post(url, form);


      body.data.should.eql({ "https://www.site.ort3/apage": "OK" });
      should(body.status).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.false();
    });

    it("should deny denied access user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "TestUserDenied",
        password: "TestUserDenied",
        json: true,
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should use guest user for non existing users", async function () {
      const form = { urls: ["https://www.site.ort4/apage"] };
      const sitecall = nock("https://www.site.ort4")
        .get("/apage")
        .reply(200, "OK");

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUserNonExisting", password: "TestUserNonExisting" });
      const body = await client.post(url, form);



      body.data.should.deepEqual({ "https://www.site.ort4/apage": "OK" });
      should(body.status).eql(HttpStatus.OK);
      should(sitecall.isDone()).be.true();
    });
  });
});


/* jshint ignore:end */
