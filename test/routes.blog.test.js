"use strict";

/* jshint ignore:start */


const nock       = require("nock");
const should     = require("should");
const fs         = require("fs");
const path       = require("path");
const rp         = require("request-promise-native");
const HttpStatus = require('http-status-codes');
const mockdate   = require("mockdate");


const config     = require("../config");
const initialise = require("../util/initialise.js");
const blogModule = require("../model/blog.js");




const testutil   = require("../test/testutil.js");

require("jstransformer-verbatim");


const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();




describe("routes/blog", function() {
  this.timeout(30000);
  let jar = {};

  after(function (bddone) {
    nock.cleanAll();
    testutil.stopServer();
    mockdate.reset();
    bddone();
  });

  before( async function () {
    await initialise.initialiseModules();
    testutil.startServerSync();
    jar.testUser = await testutil.getUserJar("TestUser");
    jar.testUserDenied = await testutil.getUserJar("TestUserDenied");
    jar.hallo = await testutil.getUserJar("Hallo");
    jar.testUserNonExisting = await testutil.getUserJar("TestUserNonExisting");
    jar.user1 = await testutil.getUserJar("USER1");
  });

  beforeEach(function (bddone) {
    // Clear DB Contents for each test
    mockdate.set(new Date("2016-05-25T20:00:00Z"));

    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.importData(
      {
        "blog": [{name: "WN333", status: "edit"},
          {name: "secondblog", status: "edit", reviewCommentDE: [{text: "first review", user: "TestUser"}]}],
        "user": [{"OSMUser": "TestUser", access: "full"},
          {OSMUser: "TestUserDenied", access: "denied"},
          {"OSMUser": "Hallo", access: "full"}
        ],
        "article": [
          {"blog": "WN333", "markdownDE": "* Dies ist ein kleiner Testartikel.", "category": "Mapping"},
          {
            "blog": "BLOG",
            "title": "BLOG",
            "markdownDE": "* Dies ist ein grosser Testartikel.",
            "category": "Keine",
            commentList: [{user: "Hallo", text: "comment"}]
          }],
        clear: true
      }, bddone);
  });
  afterEach(function (bddone) {
    return bddone();
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
      let response = await rp.post({
        url: options.url,
        form: options.form,
        jar: jar[options.user],
        simple: false,
        resolveWithFullResponse: true //,
        //followAllRedirects: true
      });
      response.body.should.containEql(options.expectedMessage);
      should(response.statusCode).eql(options.expectedStatusCode);
    }
  }


  describe("route GET /blog/edit/:blog_id", function () {
    let url = baseLink + "/blog/edit/WN333";
    it("should allow full user", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<h2>WN333</h2>");
      body.should.containEql("<div class=\"col-md-2\">Categories</div>");
    });
    it("should deny denied access user",
      checkUrlWithJar ({
        url:url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar ({
        url:url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));
  });
  describe("route POST /blog/edit/:blog_id", function () {
    let url = baseLink + "/blog/edit/WN333";
    let form = {name: "WNNew", status: "undefinedstate"};
    it("should post data on edit blog", async function () {
      let body = await rp.post({url: url, form: form, jar: jar.testUser, followAllRedirects: true });
      body.should.containEql("<h2>WNNew</h2>");
      let blog = await blogModule.findById(1);
      should(blog.name).eql("WNNew");
      should(blog.status).eql("undefinedstate");
    });
    it("should deny denied access user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));
  });
  describe("route POST /blog/:blog_id/setReviewComment", function () {
    let url = baseLink + "/blog/WN333/setReviewComment";
    let form = {lang: "EN", text: "Everything is fine"};

    it("should set a review comment", async function () {
      let body = await rp.post({url: url, form: form, jar: jar.testUser, followAllRedirects: true});
      body.should.containEql("Everything is fine");
      let blog = await blogModule.findOne({name: "WN333"});
      should(blog.reviewCommentEN).eql([{
        text: "Everything is fine",
        timestamp: "2016-05-25T20:00:00.000Z",
        user: "TestUser"
      }]);
    });
    it("should deny denied access user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));
  });
  describe("route POST /blog/:blog_id/editReviewComment/:index", function () {
    let url = baseLink + "/blog/secondblog/editReviewComment/0";
    let form = {lang: "DE", text: "New Comment"};
    it("should edit an existing comment", async function () {
      let response = await rp.post({
        url: url,
        form: form,
        jar: jar.testUser,
        simple: false,
        resolveWithFullResponse: true
      });
      should(response.body).eql("Found. Redirecting to /osmbc");
      should(response.statusCode).eql(302);
      let blog = await blogModule.findById(2);

      should(blog.reviewCommentDE).eql([{
        text: "New Comment",
        user: "TestUser",
        editstamp: "2016-05-25T20:00:00.000Z"
      }]);
    });
    it("should not allow other users to edit comment", async function () {
      let response = await rp.post({
        url: url,
        form: form,
        jar: jar.hallo,
        simple: false,
        resolveWithFullResponse: true
      });
      should(response.statusCode).eql(HttpStatus.FORBIDDEN);
      response.body.should.containEql("is not allowed to change review");
      let blog = await blogModule.findById(2);
      should(blog.reviewCommentDE).eql([{
        text: "first review",
        user: "TestUser"
      }]);
    });
    it("should raise an index fail", async function () {
      let response = await rp.post({
        url: baseLink + "/blog/secondblog/editReviewComment/1",
        form: form,
        jar: jar.testUser,
        simple: false,
        resolveWithFullResponse: true
      });
      response.body.should.containEql("Index out of Range");
      should(response.statusCode).eql(500);
    });
    it("should deny denied access user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));

  });
  describe("route POST /blog/:blog_id/setLangStatus", function () {
    let url = baseLink + "/blog/WN333/setLangStatus";
    let form =  {lang: "DE", action: "startreview"};
    it("should a start a review process", async function () {
      let response = await rp.post({url: url, form: form, jar: jar.testUser,simple: false, resolveWithFullResponse: true });
      should(response.statusCode).eql(200);
      should(response.body).eql("OK");
      let blog = await blogModule.findOne({name: "WN333"});
      should(blog.reviewCommentDE).eql([{
        text: "startreview",
        timestamp: "2016-05-25T20:00:00.000Z",
        user: "TestUser"
      }]);
    });
    it("should mark as exported", async function () {
      let response = await rp.post({
        url: url,
        form: {lang: "EN", action: "markexported"},
        jar: jar.testUser,simple: false, resolveWithFullResponse: true });
      should(response.statusCode).eql(200);
      should(response.body).eql("OK");
      let blog = await blogModule.findOne({name: "WN333"});
      should(blog.exportedEN).eql(true);
    });
    it("should not clear review when starting a review process", async function () {
      let response = await rp.post({
        url: url,
        form: {lang: "EN", action: "startreview"},
        jar: jar.testUser,simple: false, resolveWithFullResponse: true });
      should(response.statusCode).eql(200);
      should(response.body).eql("OK");
      let blog = await blogModule.findOne({name: "secondblog"});
      should(blog.reviewCommentDE).eql([{"text": "first review", user: "TestUser"}]);
    });
    it("should  clear review when deleting a review process", async function () {
      let response = await rp.post({
        url:  baseLink + "/blog/secondblog/setLangStatus",
        form: {lang: "DE", action: "deleteallreviews"},
        jar: jar.testUser,simple: false, resolveWithFullResponse: true });
      should(response.statusCode).eql(200);
      should(response.body).eql("OK");
      let blog = await blogModule.findOne({name: "secondblog"});
      should(blog.reviewCommentDE).is.undefined();
    });
    it("should close a language", async function () {
      let response = await rp.post({
        url:  url,
        headers: {
          referrer: baseLink + "/blog/WN333"
        },
        form: {lang: "DE", action: "closelang"},
        jar: jar.testUser,simple: false, resolveWithFullResponse: true });
      should(response.statusCode).eql(200);
      should(response.body).eql("OK");

      let blog = await blogModule.findOne({name: "WN333"});
      should(blog.closeDE).eql(true);
    });
    it("should reopen a language", async  function () {
      let response = await rp.post({
        url:  url,
        json: true,
        headers: {
          referrer: baseLink + "/blog/WN333"
        },
        body: {lang: "DE", action: "editlang"},
        jar: jar.testUser,simple: false, resolveWithFullResponse: true });
      should(response.statusCode).eql(200);

      let blog = await blogModule.findOne({name: "WN333"});
      should(blog.closeDE).eql(false);
      should(blog.exportedDE).eql(false);
    });
    it("should deny denied access user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));
  });
  describe("route POST /blog/:blog_id/copy/:lang/:lang", function () {
    let url = baseLink + "/blog/WN333/copy/DE/EN";
    let form =  {};
    it("should call copy", async function () {
      let response = await rp.post({url: url, form: form, jar: jar.testUser,simple: false, resolveWithFullResponse: true });
      should(response.statusCode).eql(302);
      should(response.body).eql("Found. Redirecting to /osmbc");
    });





    it("should deny denied access user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      postUrlWithJar ({
        url: url,
        form: form,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));
  });
  describe("route GET /blog/create", function () {
    let url = baseLink + "/blog/create";
    it("should create a new blog", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<td><a href=\"/blog/WN334\">WN334</a></td>");
    });

    it("should deny denied access user",
      checkUrlWithJar ({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar ({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));

  });
  describe("route GET /blog/list", function () {
    let url = baseLink + "/blog/list";
    it("should get the list", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<td><a href=\"/blog/WN333\">WN333</a></td>");
    });
    it("should deny denied access user",
      checkUrlWithJar ({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar ({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));
  });
  describe("route GET /blog/:blog_id", function () {
    let url = baseLink + "/blog/WN333";
    it("should get the blog", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<h2><span class=\"hidden-xs\">Weekly </span>WN333<span class=\"hidden-xs\"> (edit)</span></h2>");
    });
    it("should deny denied access user",
      checkUrlWithJar ({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar ({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));
  });
  describe("route GET /blog/:blog_id/stat", function () {
    let url = baseLink + "/blog/WN333/stat";
    it("should get the blog", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<h1>Blog Statistics for WN333</h1>");
    });
    it("should deny denied access user",
      checkUrlWithJar ({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar ({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));
  });
  describe("route GET /blog/:blog_id/preview", function () {
    let url = baseLink + "/blog/WN333/preview";
    it("should deny denied access user",
      checkUrlWithJar ({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar ({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));
    it("should throw an error, if blog is not existing", async function () {
      let response = await rp.get({
        url: baseLink + "/blog/WN999",
        jar: jar.testUser, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(404);
      response.body.should.containEql("<h1>Page Not Found /blog/WN999</h1>");
    });
    it("should call next if blog exists twice", async function () {
      await blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"});
      let response = await rp.get({
        url: baseLink + "/blog/WN333/preview?lang=DE",
        jar: jar.testUser, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(500);
      response.body.should.containEql("Blog &gt;WN333&lt; exists twice, internal id of first: 1");
    });
    it("should give an error for a blog preview with empty articles", async function () {
      await blogModule.createNewBlog({OSMUser: "test"}, {
        name: "WN334",
        startDate: "2015-12-12T00:00:00",
        endDate: "2015-12-13T00:00:00"});
      let body = await rp.get({url: baseLink + "/blog/WN334/preview?lang=DE", jar: jar.testUser});
      should(body).containEql("<p>12.12.2015-13.12.2015</p>\n" +
              "<p> Warning: This export contains empty Articles </p>");

    });
    it("should give an error for a blog preview with empty articles  in markdown", async function () {
      await blogModule.createNewBlog({OSMUser: "test"}, {
        name: "WN334",
        startDate: "2015-12-12T00:00:00",
        endDate: "2015-12-13T00:00:00"
      });
      let body = await rp.get({
        url: baseLink + "/blog/WN334/preview?lang=DE&markdown=true&download=true",
        jar: jar.testUser
      });
      should(body).containEql("12.12.2015-13.12.2015");
      should(body).containEql("Warning: This export contains empty Articles");
    });

    it("should call next if blog id not exist", async function () {
      let response = await rp.get({
        url: baseLink + "/blog/WN999/preview?lang=DE",
        jar: jar.testUser, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(404);
    });
    it("should get a preview in the html format", async function () {
      await testutil.importData("data/views.blog.export.1.json");
      let opts = {
        jar: jar.user1,
        url: baseLink + "/blog/BLOG/preview?lang=DE&download=true"
      };
      let body = await rp.get(opts);

      let file = path.resolve(__dirname, "data", "views.blog.export.1.html");
      let expectation = fs.readFileSync(file, "UTF8");

      should(testutil.equalHtml(body, expectation)).be.True();

    });
    it("should get a preview in the markdown format ", async function () {
      await testutil.importData(path.resolve(__dirname, "data", "views.blog.export.1.json"));
      let opts = {
        jar: jar.user1,
        url: baseLink + "/blog/BLOG/preview?lang=DE&markdown=true&download=true"
      };
      let body = await rp.get(opts);

      let file = path.resolve(__dirname, "data", "views.blog.export.1.md");
      let expectation = fs.readFileSync(file, "UTF8");

      should(testutil.equalHtml(body, expectation)).be.True();
    });
  });


  describe("route GET /blog/:blog_id/:tab", function () {
    let url = baseLink + "/blog/WN333/full";
    it("should get full tab", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<h2><span class=\"hidden-xs\">Weekly </span>WN333<span class=\"hidden-xs\"> (edit)</span></h2>");
    });

    it("should deny denied access user",
      checkUrlWithJar ({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar ({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage:"OSM User >TestUserNonExisting< has not enough access rights"}));


  });
});


/* jshint ignore:end */
