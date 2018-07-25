"use strict";

const nock  = require("nock");
const should = require("should");
const request = require("request");
const config = require("../config");
const initialise = require("../util/initialise.js");
const path = require("path");
const fs = require("fs");


const testutil = require("../test/testutil.js");
const blogModule = require("../model/blog.js");
const mockdate = require("mockdate");

require("jstransformer-verbatim");


var baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();




describe("routes/blog", function() {
  this.timeout(30000);
  let jar = null;
  var nockLogin;

  after(function (bddone) {
    nock.cleanAll();
    testutil.stopServer();
    mockdate.reset();
    bddone();
  });
  before(initialise.initialiseModules);
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
    nock.removeInterceptor(nockLogin);
    return bddone();
  });
  describe("route GET /blog/edit/:blog_id", function () {
    let url = baseLink + "/blog/edit/WN333";
    it("should allow full user", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h2>WN333</h2>");
          body.should.containEql("<div class=\"col-md-2\">Categories</div>");

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
  describe("route POST /blog/edit/:blog_id", function () {
    let url = baseLink + "/blog/edit/WN333";
    it("should post data on edit blog", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({
          url: url,
          form: {name: "WNNew", status: "undefinedstate"},
          jar: jar,
          followAllRedirects: true
        }, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h2>WNNew</h2>");
          blogModule.findById(1, function (err, blog) {
            should.not.exist(err);
            should(blog.name).eql("WNNew");
            should(blog.status).eql("undefinedstate");
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServerWithLogin("TestUserDenied", jar, function () {
        request.post({url: url, form: {}, jar: jar, followAllRedirects: true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting", jar, function () {
        request.post({url: url, form: {}, jar: jar, followAllRedirects: true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /blog/:blog_id/setReviewComment", function () {
    let url = baseLink + "/blog/WN333/setReviewComment";
    it("should set a review comment", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({
          url: baseLink + "/blog/WN333/setReviewComment",
          form: {lang: "EN", text: "Everything is fine"},
          jar: jar,
          followAllRedirects: true
        }, function (err, res, body) {
          should.not.exist(err);
          should(res.statusCode).eql(200);
          body.should.containEql("Everything is fine");
          blogModule.findOne({name: "WN333"}, function (err, blog) {
            should.not.exist(err);
            should(blog.reviewCommentEN).eql([
              {
                text: "Everything is fine",
                timestamp: "2016-05-25T20:00:00.000Z",
                user: "TestUser"
              }
            ]);
            bddone();
          }
          );
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServerWithLogin("TestUserDenied", jar, function () {
        request.post({url: url, form: {}, jar: jar, followAllRedirects: true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting", jar, function () {
        request.post({url: url, form: {}, jar: jar, followAllRedirects: true}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /blog/:blog_id/editReviewComment/:index", function () {
    let url = baseLink + "/blog/secondblog/editReviewComment/0";
    it("should edit an existing comment", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({url: url, form: {lang: "DE", text: "New Comment"}, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(body).eql("Found. Redirecting to /");
          should(response.statusCode).eql(302);
          blogModule.findById(2, function (err, blog) {
            should.not.exist(err);
            should(blog.reviewCommentDE).eql([{
              text: "New Comment",
              user: "TestUser",
              editstamp: "2016-05-25T20:00:00.000Z"
            }]);
            bddone();
          });
        });
      });
    });
    it("should not allow other users to edit comment", function (bddone) {
      testutil.startServerWithLogin("Hallo", jar, function () {
        request.post({url: url, form: {lang: "DE", text: "New Comment"}, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("is not allowed to change review");
          blogModule.findById(2, function (err, blog) {
            should.not.exist(err);
            should(blog.reviewCommentDE).eql([{
              text: "first review",
              user: "TestUser"
            }]);
            bddone();
          });
        });
      });
    });
    it("should raise an index fail", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({
          url: baseLink + "/blog/secondblog/editReviewComment/1",
          form: {lang: "DE", text: "New Comment"},
          jar: jar
        }, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("Index out of Range");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServerWithLogin("TestUserDenied", jar, function () {
        request.post({url: url, form: {}, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting", jar, function () {
        request.post({url: url, form: {}, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /blog/:blog_id/setLangStatus", function () {
    let url = baseLink + "/blog/WN333/setLangStatus";
    it("should a start a review process", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({
          url: baseLink + "/blog/WN333/setLangStatus", form: {lang: "DE", action: "startreview"}, jar: jar
        }, function (err, res, body) {
          should.not.exist(err);
          should(res.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
          blogModule.findOne({name: "WN333"}, function (err, blog) {
            should.not.exist(err);
            should(blog.reviewCommentDE).eql([{
              text: "startreview",
              timestamp: "2016-05-25T20:00:00.000Z",
              user: "TestUser"
            }]);
            bddone();
          });
        });
      });
    });
    it("should mark as exported", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({
          url: baseLink + "/blog/WN333/setLangStatus", form: {lang: "EN", action: "markexported"}, jar: jar
        }, function (err, res, body) {
          should.not.exist(err);
          should(res.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
          blogModule.findOne({name: "WN333"}, function (err, blog) {
            should.not.exist(err);
            should(blog.exportedEN).eql(true);
            bddone();
          });
        });
      });
    });
    it("should not clear review when starting a review process", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({
          url: baseLink + "/blog/secondblog/setLangStatus",
          form: {lang: "DE", action: "startreview"},
          jar: jar
        }, function (err, res, body) {
          should.not.exist(err);
          should(res.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
          blogModule.findOne({name: "secondblog"}, function (err, blog) {
            should.not.exist(err);
            should(blog.reviewCommentDE).eql([{"text": "first review", user: "TestUser"}]);
            bddone();
          });
        });
      });
    });
    it("should  clear review when deleting a review process", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({
          url: baseLink + "/blog/secondblog/setLangStatus",
          form: {lang: "DE", action: "deletereview"},
          jar: jar
        }, function (err, res, body) {
          should.not.exist(err);
          console.log(body);
          should(res.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
          blogModule.findOne({name: "secondblog"}, function (err, blog) {
            should.not.exist(err);
            should(blog.reviewCommentDE).is.undefined();
            bddone();
          });
        });
      });
    });
    it("should close a language", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({
          url: baseLink + "/blog/WN333/setLangStatus",
          headers: {
            referrer: baseLink + "/blog/WN333"
          },
          form: {lang: "DE", action: "closelang"},
          jar: jar
        }, function (err, res, body) {
          should.not.exist(err);
          should(body).eql("Found. Redirecting to http://localhost:35043/blog/WN333");
          should(res.statusCode).eql(302);
          blogModule.findOne({name: "WN333"}, function (err, blog) {
            should.not.exist(err);
            should(blog.closeDE).eql(true);
            bddone();
          }
          );
        }
        );
      });
    });
    it("should reopen a language", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.post({

          url: baseLink + "/blog/WN333/setLangStatus",
          json: true,
          body: {lang: "DE", action: "editlang"},
          jar: jar
        }, function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(302);
          blogModule.findOne({name: "WN333"}, function (err, blog) {
            should.not.exist(err);
            should(blog.closeDE).eql(false);
            should(blog.exportedDE).eql(false);
            bddone();
          }
          );
        }
        );
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServerWithLogin("TestUserDenied", jar, function () {
        request.post({url: url, form: {}, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting", jar, function () {
        request.post({url: url, form: {}, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route GET /blog/create", function () {
    let url = baseLink + "/blog/create";
    it("should create a new blog", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<td><a href=\"/blog/WN334\">WN334</a></td>");
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
  describe("route GET /blog/list", function () {
    let url = baseLink + "/blog/list";
    it("should get the list", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<td><a href=\"/blog/WN333\">WN333</a></td>");
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
  describe("route GET /blog/:blog_id", function () {
    let url = baseLink + "/blog/WN333";
    it("should get the blog", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h2><span class=\"hidden-xs\">Weekly </span>WN333<span class=\"hidden-xs\"> (edit)</span></h2>");
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
  describe("route GET /blog/:blog_id/stat", function () {
    let url = baseLink + "/blog/WN333/stat";
    it("should get the blog", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h1>Blog Statistics for WN333</h1>");
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
  describe("route GET /blog/:blog_id/preview", function () {
    let url = baseLink + "/blog/WN333/preview";
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
    it("should throw an error, if blog is not existing", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/blog/WN999", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(404);
          body.should.containEql("<h1>Not Found</h1>");
          bddone();
        });
      });
    });
    it("should call next if blog exists twice", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err) {
        should.not.exist(err);
        testutil.startServer("TestUser", function () {
          request.get({url: baseLink + "/blog/WN333/preview?lang=DE", jar: jar}, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(500);
            body.should.containEql("Blog &gt;WN333&lt; exists twice, internal id of first: 1");
            bddone();
          });
        });
      });
    });
    it("should give an error for a blog preview with empty articles", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {
        name: "WN334",
        startDate: "2015-12-12T00:00:00",
        endDate: "2015-12-13T00:00:00"
      }, function (err) {
        should.not.exist(err);
        testutil.startServer("TestUser", function () {
          request.get({url: baseLink + "/blog/WN334/preview?lang=DE", jar: jar}, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            should(body).containEql("<p>12.12.2015-13.12.2015</p>\n" +
              "<p> Warning: This export contains empty Articles </p>");
            bddone();
          });
        });
      });
    });
    it("should give an error for a blog preview with empty articles  in markdown", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {
        name: "WN334",
        startDate: "2015-12-12T00:00:00",
        endDate: "2015-12-13T00:00:00"
      }, function (err) {
        should.not.exist(err);
        testutil.startServer("TestUser", function () {
          request.get({
            url: baseLink + "/blog/WN334/preview?lang=DE&markdown=true&download=true",
            jar: jar
          }, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            should(body).containEql("12.12.2015-13.12.2015");
            should(body).containEql("Warning: This export contains empty Articles");
            bddone();
          });
        });
      });
    });

    it("should call next if blog id not exist", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/blog/WN999/preview?lang=DE", jar: jar}, function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(404);
          bddone();
        });
      });
    });
    it("should get a preview in the html format", function (bddone) {
      testutil.importData("data/views.blog.export.1.json", function (err) {
        should.not.exist(err);
        testutil.startServer("USER1", function () {
          var opts = {
            jar: jar,
            url: baseLink + "/blog/BLOG/preview?lang=DE&download=true"
          };
          request.get(opts, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            let file = path.resolve(__dirname, "data", "views.blog.export.1.html");
            let expectation = fs.readFileSync(file, "UTF8");

            should(testutil.equalHtml(body, expectation)).be.True();

            bddone();
          });
        });
      });
    });
    it("should get a preview in the markdown format ", function (bddone) {
      testutil.importData(path.resolve(__dirname, "data", "views.blog.export.1.json"), function(err) {
        should.not.exist(err);
        testutil.startServer("USER1", function () {
          var opts = {
            jar: jar,
            url: baseLink + "/blog/BLOG/preview?lang=DE&markdown=true&download=true"
          };
          request.get(opts, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            let file = path.resolve(__dirname, "data", "views.blog.export.1.md");
            let expectation = fs.readFileSync(file, "UTF8");

            should(body).eql(expectation);
            should(testutil.equalHtml(body, expectation)).be.True();

            bddone();
          });
        });
      });
    });

    describe("route GET /blog/:blog_id/:tab", function () {
      let url = baseLink + "/blog/WN333/full";
      it("should get full tab", function (bddone) {
        testutil.startServer("TestUser", function () {
          request.get({url: url, jar: jar}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            body.should.containEql("<h2><span class=\"hidden-xs\">Weekly </span>WN333<span class=\"hidden-xs\"> (edit)</span></h2>");
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
  });
});


