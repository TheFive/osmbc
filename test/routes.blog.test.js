"use strict";

var nock  = require("nock");
var should = require("should");
var request = require("request");
var config = require("../config");



var testutil = require("../test/testutil.js");
var blogModule = require("../model/blog.js");
var mockdate = require("mockdate");

require("jstransformer-verbatim");


var baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");




describe("routes/blog", function() {
  this.timeout(30000);

  after(function (bddone) {
    nock.cleanAll();
    bddone();
    mockdate.reset();
  });

  beforeEach(function (bddone) {
    // Clear DB Contents for each test
    mockdate.set(new Date("2016-05-25T20:00"));
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
          { "OSMUser": "Hallo", access: "full"}
        ],
        "article": [
          {"blog": "WN333", "markdownDE": "* Dies ist ein kleiner Testartikel.", "category": "Mapping"},
          {"blog": "BLOG", "title": "BLOG", "markdownDE": "* Dies ist ein grosser Testartikel.", "category": "Keine", commentList: [{user: "Hallo", text: "comment"}]}],
        clear: true}, bddone);
  });
  describe("route GET /blog/edit/:blog_id", function() {
    let url = baseLink + "/blog/edit/WN333";
    it("should allow full user", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<h2>WN333</h2>")).not.equal(-1);
          should(body.indexOf("<div class=\"col-md-2\">Categories</div>")).not.equal(-1);

          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route POST /blog/edit/:blog_id", function() {
    let url = baseLink + "/blog/edit/WN333";
    it("should post data on edit blog", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.post({url: url, form: {name: "WNNew", status: "undefinedstate"}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /blog/edit/WNNew");
          blogModule.findById(1, function(err, blog) {
            should.not.exist(err);
            should(blog.name).eql("WNNew");
            should(blog.status).eql("undefinedstate");
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.post({url: url, form: {}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.post({url: url, form: {}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route POST /blog/:blog_id/setReviewComment", function() {
    let url = baseLink + "/blog/WN333/setReviewComment";
    it("should set a review comment", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.post({url: baseLink + "/blog/WN333/setReviewComment",
          form: {lang: "EN", text: "Everything is fine"}
        }, function (err, res, body) {
          should.not.exist(err);
          should(res.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
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
      testutil.startServer("TestUserDenied", function () {
        request.post({url: url, form: {}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.post({url: url, form: {}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route POST /blog/:blog_id/editReviewComment/:index", function() {
    let url = baseLink + "/blog/secondblog/editReviewComment/0";
    it("should edit an existing comment", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.post({url: url, form: {lang: "DE", text: "New Comment"}}, function (err, response, body) {
          should.not.exist(err);
          should(body).eql("Found. Redirecting to /");
          should(response.statusCode).eql(302);
          blogModule.findById(2, function(err, blog) {
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
      testutil.startServer("Hallo", function () {
        request.post({url: url, form: {lang: "DE", text: "New Comment"}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("is not allowed to change review")).not.equal(-1);
          blogModule.findById(2, function(err, blog) {
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
      testutil.startServer("TestUser", function () {
        request.post({url: baseLink + "/blog/secondblog/editReviewComment/1", form: {lang: "DE", text: "New Comment"}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("Index out of Range")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.post({url: url, form: {}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.post({url: url, form: {}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route POST /blog/:blog_id/setLangStatus", function() {
    let url = baseLink + "/blog/WN333/setLangStatus";
    it("should a start a review process", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.post({url: baseLink + "/blog/WN333/setLangStatus", form: {lang: "DE", action: "startreview"}
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
      testutil.startServer("TestUser", function() {
        request.post({url: baseLink + "/blog/WN333/setLangStatus", form: {lang: "EN", action: "markexported"}
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
      testutil.startServer("TestUser", function() {
        request.post({
          url: baseLink + "/blog/secondblog/setLangStatus",
          form: {lang: "DE", action: "startreview"}
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
    it("should close a language", function (bddone) {
      testutil.startServer("TestUser", function() {
        request.post({
          url: baseLink + "/blog/WN333/setLangStatus",
          headers:{
            referrer: baseLink + "/blog/WN333"
          },
          form: {lang: "DE", action: "closelang"}
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
      testutil.startServer("TestUser", function() {
        request.post({

          url: baseLink + "/blog/WN333/setLangStatus",
          json: true,
          body: {lang: "DE", action: "editlang"}
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
      testutil.startServer("TestUserDenied", function () {
        request.post({url: url, form: {}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.post({url: url, form: {}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /blog/create", function() {
    let url = baseLink + "/blog/create";
    it("should create a new blog",function(bddone){
      testutil.startServer("TestUser", function () {
        request.get(url, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<td><a href=\"/blog/WN334\">WN334</a></td>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /blog/list", function() {
    let url = baseLink + "/blog/list";
    it("should get the list",function(bddone){
      testutil.startServer("TestUser", function () {
        request.get(url, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<td><a href=\"/blog/WN333\">WN333</a></td>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /blog/:blog_id", function() {
    let url = baseLink + "/blog/WN333";
    it("should get the blog",function(bddone){
      testutil.startServer("TestUser", function () {
        request.get(url, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<title>WN333/overview</title>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /blog/:blog_id/stat", function() {
    let url = baseLink + "/blog/WN333/stat";
    it("should get the blog",function(bddone){
      testutil.startServer("TestUser", function () {
        request.get(url, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<title>WN333/statistic</title>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /blog/:blog_id/preview", function() {
    let url = baseLink + "/blog/WN333/preview";
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should throw an error, if blog is not existing", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink +"/blog/WN999"}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(404);
          should(body.indexOf("<h1>Not Found</h1>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should call next if blog exists twice", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err) {
        should.not.exist(err);
        testutil.startServer("TestUser", function () {
          request.get(baseLink + "/blog/WN333/preview?lang=DE", function (err, res,body) {
            should.not.exist(err);
            should(res.statusCode).eql(500);
            should(body.indexOf("Blog &gt;WN333&lt; exists twice, internal id of first: 1")).not.equal(-1);
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
        testutil.startServer("TestUser",function(){
          request.get(baseLink + "/blog/WN334/preview?lang=DE", function (err, res,body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            should(body).containEql("<p>12.12.2015-13.12.2015</p>\n" +
              "<p> Warning: This export contains empty Articles </p>");
            bddone();
          });
        });
      });
    });
    it("should call next if blog id not exist", function(bddone) {
      testutil.startServer("TestUser",function(){
        request.get(baseLink + "/blog/WN999/preview?lang=DE", function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(404);
          bddone();
        });
      });
    });
  });
  describe("route GET /blog/:blog_id/:tab", function() {
    let url = baseLink + "/blog/WN333/full";
    it("should get full tab", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<title>WN333/full</title>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
});
