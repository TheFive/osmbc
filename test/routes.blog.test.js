"use strict";

/* jshint ignore:start */


const nock       = require("nock");
const should     = require("should");
const fs         = require("fs");
const path       = require("path");
const HttpStatus = require("http-status-codes");
const mockdate   = require("mockdate");


const config     = require("../config");
const initialise = require("../util/initialise.js");
const blogModule = require("../model/blog.js");




const testutil   = require("../test/testutil.js");

require("jstransformer-verbatim");


const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();




describe("routes/blog", function() {
  this.timeout(30000);

  after(function (bddone) {
    nock.cleanAll();
    testutil.stopServer();
    mockdate.reset();
    bddone();
  });

  before(async function () {
    await initialise.initialiseModules();
    testutil.startServerSync();
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
        blog: [{ name: "WN333", status: "edit" },
          { name: "secondblog", status: "edit", reviewCommentDE: [{ text: "first review", user: "TestUser" }] }],
        user: [{ OSMUser: "TestUser", access: "full" },
          { OSMUser: "TestUserDenied", access: "denied" },
          { OSMUser: "Hallo", access: "full" }
        ],
        article: [
          { blog: "WN333", markdownDE: "* Dies ist ein kleiner Testartikel.", category: "Mapping" },
          {
            blog: "BLOG",
            title: "BLOG",
            markdownDE: "* Dies ist ein grosser Testartikel.",
            category: "Keine",
            commentList: [{ user: "Hallo", text: "comment" }]
          }],
        clear: true
      }, bddone);
  });
  afterEach(function (bddone) {
    return bddone();
  });





  describe("route GET /blog/edit/:blog_id", function () {
    const url = baseLink + "/blog/edit/WN333";
    it("should allow full user", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);
      body.data.should.containEql("<h2>WN333</h2>");
      body.data.should.containEql("<div class=\"col\">Categories</div>");
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
  describe("route POST /blog/edit/:blog_id", function () {
    const url = baseLink + "/blog/edit/WN333";
    const form = { name: "WNNew", status: "undefinedstate" };
    it("should post data on edit blog", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, form);

      body.data.should.containEql("<h2>WNNew</h2>");
      const blog = await blogModule.findById(1);
      should(blog.name).eql("WNNew");
      should(blog.status).eql("undefinedstate");
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
    it("should deny non existing user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /blog/:blog_id/setReviewComment", function () {
    const url = baseLink + "/blog/WN333/setReviewComment";
    const form = { lang: "EN", text: "Everything is fine" };

    it("should set a review comment", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, form);

      body.data.should.containEql("Everything is fine");
      const blog = await blogModule.findOne({ name: "WN333" });
      should(blog.reviewCommentEN).eql([{
        text: "Everything is fine",
        timestamp: "2016-05-25T20:00:00.000Z",
        user: "TestUser"
      }]);
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
    it("should deny non existing user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /blog/:blog_id/editReviewComment/:index", function () {
    const url = baseLink + "/blog/secondblog/editReviewComment/0";
    const form = { lang: "DE", text: "New Comment" };
    it("should edit an existing comment", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, form);

      should(body.data).eql("Found. Redirecting to /osmbc");
      should(body.status).eql(302);
      const blog = await blogModule.findById(2);

      should(blog.reviewCommentDE).eql([{
        text: "New Comment",
        user: "TestUser",
        editstamp: "2016-05-25T20:00:00.000Z"
      }]);
    });
    it("should not allow other users to edit comment", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "Hallo", password: "Hallo" });
      const body = await client.post(url, form);

      should(body.status).eql(HttpStatus.FORBIDDEN);
      body.data.should.containEql("is not allowed to change review");
      const blog = await blogModule.findById(2);
      should(blog.reviewCommentDE).eql([{
        text: "first review",
        user: "TestUser"
      }]);
    });
    it("should raise an index fail", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(baseLink + "/blog/secondblog/editReviewComment/1", form);


      body.data.should.containEql("Index out of Range");
      should(body.status).eql(500);
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
    it("should deny non existing user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /blog/:blog_id/setLangStatus", function () {
    const url = baseLink + "/blog/WN333/setLangStatus";
    const form =  { lang: "DE", action: "startreview" };
    it("should a start a review process", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, form, { headers: { referer: "https://coming_from.somewhere" } });


      should(body.data).eql("OK");
      should(body.status).eql(200);
      const blog = await blogModule.findOne({ name: "WN333" });
      should(blog.reviewCommentDE).eql([{
        text: "startreview",
        timestamp: "2016-05-25T20:00:00.000Z",
        user: "TestUser"
      }]);
    });
    it("should mark as exported", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, { lang: "EN", action: "markexported" }, { headers: { referer: "https://coming_from.somewhere" } });


      should(body.status).eql(200);
      should(body.data).eql("OK");
      const blog = await blogModule.findOne({ name: "WN333" });
      should(blog.exportedEN).eql(true);
    });
    it("should not clear review when starting a review process", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, { lang: "EN", action: "startreview" }, { headers: { referer: "https://coming_from.somewhere" } });

      should(body.status).eql(200);
      should(body.data).eql("OK");
      const blog = await blogModule.findOne({ name: "secondblog" });
      should(blog.reviewCommentDE).eql([{ text: "first review", user: "TestUser" }]);
    });
    it("should  clear review when deleting a review process", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(baseLink + "/blog/secondblog/setLangStatus", { lang: "DE", action: "deleteallreviews" }, { headers: { referer: "https://coming_from.somewhere" } });

      should(body.status).eql(200);
      should(body.data).eql("OK");
      const blog = await blogModule.findOne({ name: "secondblog" });
      should(blog.reviewCommentDE).is.undefined();
    });
    it("should close a language", async function () {
      console.dir("lololo")
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, { lang: "DE", action: "closelang" }, { headers: { referrer: baseLink + "/blog/WN333" } });


      should(body.status).eql(200);
      should(body.data).eql("OK");

      const blog = await blogModule.findOne({ name: "WN333" });
      should(blog.closeDE).eql(true);
    });
    it("should reopen a language", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, { lang: "DE", action: "editlang" }, { headers: { referrer: baseLink + "/blog/WN333" } });

      should(body.status).eql(200);
      should(body.data).eql("OK");

      const blog = await blogModule.findOne({ name: "WN333" });
      should(blog.closeDE).eql(false);
      should(blog.exportedDE).eql(false);
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
    it("should deny non existing user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route POST /blog/:blog_id/copy/:lang/:lang", function () {
    const url = baseLink + "/blog/WN333/copy/DE/EN";
    const form =  {};
    it("should call copy", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, form);

      should(body.status).eql(302);
      should(body.data).eql("Found. Redirecting to /osmbc");
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
    it("should deny non existing user",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("route GET /blog/create", function () {
    const url = baseLink + "/blog/create";
    it("should create a new blog", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);
      body.data.should.containEql("<td><a href=\"/blog/WN334\">WN334</a></td>");
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
  describe("route GET /blog/list", function () {
    const url = baseLink + "/blog/list";
    it("should get the list", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      body.data.should.containEql("<td><a href=\"/blog/WN333\">WN333</a></td>");
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
  describe("route GET /blog/:blog_id", function () {
    const url = baseLink + "/blog/WN333";
    it("should get the blog", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      body.data.should.containEql('<h2><span class="d-none d-md-block">Weekly </span>WN333<span class="d-none d-md-block"> (edit)</span></h2>');
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
  describe("route GET /blog/:blog_id/stat", function () {
    const url = baseLink + "/blog/WN333/stat";
    it("should get the blog", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);


      body.data.should.containEql("<h1>Blog Statistics for WN333</h1>");
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
  describe("route GET /blog/:blog_id/preview", function () {
    const url = baseLink + "/blog/WN333/preview";
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
    it("should throw an error, if blog is not existing", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(baseLink + "/blog/WN999");

      should(body.status).eql(404);
      body.data.should.containEql('<h1 id="errorTitle">Page Not Found /blog/WN999</h1>');
    });
    it("should call next if blog exists twice", async function () {
      await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN333" });
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(baseLink + "/blog/WN333/preview?lang=DE");

      should(body.status).eql(500);
      body.data.should.containEql("Blog &gt;WN333&lt; exists twice, internal id of first: 1");
    });
    it("should give an error for a blog preview with empty articles", async function () {
      await blogModule.createNewBlog({ OSMUser: "test" }, {
        name: "WN334",
        startDate: "2015-12-12T00:00:00",
        endDate: "2015-12-13T00:00:00"
      });

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(baseLink + "/blog/WN334/preview?lang=DE");

      should(body.data).containEql("<p>12.12.2015-13.12.2015</p>\n" +
              "<p> Warning: This export contains empty Articles </p>");
    });
    it("should give an error for a blog preview with empty articles  in markdown", async function () {
      await blogModule.createNewBlog({ OSMUser: "test" }, {
        name: "WN334",
        startDate: "2015-12-12T00:00:00",
        endDate: "2015-12-13T00:00:00"
      });

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(baseLink + "/blog/WN334/preview?lang=DE&markdown=true&download=true");

      should(body.data).containEql("12.12.2015-13.12.2015");
      should(body.data).containEql("Warning: This export contains empty Articles");
    });

    it("should call next if blog id not exist", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(baseLink + "/blog/WN999/preview?lang=DE");

      should(body.status).eql(404);
    });
    it("should get a preview in the html format", async function () {
      await testutil.importData("data/views.blog.export.1.json");

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "USER1", password: "USER1" });
      const body = await client.get(baseLink + "/blog/BLOG/preview?lang=DE&download=true");

      const file = path.resolve(__dirname, "data", "views.blog.export.1.html");
      const expectation = fs.readFileSync(file, "UTF8");

      should(testutil.equalHtml(body.data, expectation)).be.True();
    });
    it("should get a preview in the markdown format ", async function () {
      await testutil.importData(path.resolve(__dirname, "data", "views.blog.export.1.json"));

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "USER1", password: "USER1" });
      const body = await client.get(baseLink + "/blog/BLOG/preview?lang=DE&markdown=true&download=true");


      const file = path.resolve(__dirname, "data", "views.blog.export.1.md");
      const expectation = fs.readFileSync(file, "UTF8");

      should(testutil.equalHtml(body.data, expectation)).be.True();
    });
  });


  describe("route GET /blog/:blog_id/:tab", function () {
    const url = baseLink + "/blog/WN333/full";
    it("should get full tab", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 5 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      body.data.should.containEql('<h2><span class="d-none d-md-block">Weekly </span>WN333<span class="d-none d-md-block"> (edit)</span></h2>');
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
});


/* jshint ignore:end */
