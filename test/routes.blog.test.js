"use strict";

var async = require("async");
var sinon = require("sinon");
var nock  = require("nock");
var should = require("should");
var request = require("request");
var config = require("../config");
var jade = require("jade");



var testutil = require("../test/testutil.js");
var blogModule = require("../model/blog.js");
var userModule = require("../model/user.js");
var mockdate = require("mockdate");

require("jstransformer-verbatim");


var baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");




describe("routes/blog", function() {
  this.timeout(3000);
  var id = 2;

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
          {name: "secondblog", status: "edit",reviewCommentDE:[{text:"first review"}]}],
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
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.post({url: url,form:{}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.post({url: url,form:{}}, function (err, response, body) {
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
        request.post({url: url,form:{}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.post({url: url,form:{}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route POST /blog/:blog_id/editReviewComment/:index", function() {
    let url = baseLink + "/blog/WN333/editReviewComment/1";
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.post({url: url,form:{}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.post({url: url,form:{}}, function (err, response, body) {
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
            should(blog.reviewCommentDE).eql([{"text": "first review"}]);
            bddone();
          });
        });
      });
    });
    it("should close a language", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"},
        {name: "WN333", reviewCommentDE: [{user: "hallo", text: "test"}]},
        function (err) {
          should.not.exist(err);
          request({
            method: "POST",
            url: baseLink + "/blog/WN333/setLangStatus",
            json: true,
            body: {lang: "DE", action: "closelang"}
          }, function (err, res) {
            should.not.exist(err);
            console.log
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
      blogModule.createNewBlog({OSMUser: "test"},
        {name: "WN333", reviewCommentDE: [{user: "hallo", text: "test"}]},
        function (err) {
          should.not.exist(err);
          request({
            method: "POST",
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
        request.post({url: url,form:{}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.post({url: url,form:{}}, function (err, response, body) {
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
    it("should call next if blog id not exist", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {title: "WN333"}, function (err, blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = blog.id + 1;
        request.get(baseLink + "/blog/" + newId + "/preview?lang=DE", function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(404);
          bddone();
        });
      });
    });
    it("should call next if blog name not exist", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {title: "WN333"}, function (err, blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN332";
        request.get(baseLink + "/blog/" + newId + "/preview?lang=DE", function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(404);
          bddone();
        });
      });
    });
    it("should call next if blog exists twice", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err, blog) {
        should.not.exist(err);
        blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err, blog2) {
          should.not.exist(err);
          should.exist(blog2);
          should(blog.id).not.equal(0);
          request.get(baseLink + "/blog/WN333/preview?lang=DE", function (err, res) {
            should.not.exist(err);
            should(res.statusCode).eql(500);
            bddone();
          });
        });
      });
    });
    it("should throw an error for a blog preview with empty articles", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {
        name: "WN333",
        startDate: "2015-12-12T00:00:00",
        endDate: "2015-12-13T00:00:00"
      }, function (err, blog) {
        should.not.exist(err);
        should.exist(blog);
        should(blog.id).not.equal(0);
        request.get(baseLink + "/blog/WN333/preview?lang=DE", function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(200);

          should(res.body).containEql("<p> Warning: This export contains empty Articles </p>");
          bddone();
        });
      });
    });
    it("should call next if blog id not exist", function(bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {title: "WN333"}, function(err, blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = blog.id + 1;

        request.get(baseLink + "/blog/" + newId + "/preview?lang=DE", function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(404);
          bddone();
        });
      });
    });
    it("should call next if blog name not exist", function(bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {title: "WN333"}, function(err, blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN332";
        request.get(baseLink + "/blog/" + newId + "/preview?lang=DE", function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(404);
          bddone();
        });
      });
    });
    it("should call next if blog exists twice", function(bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function(err, blog) {
        should.not.exist(err);
        blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function(err, blog2) {
          should.not.exist(err);
          should.exist(blog2);
          should(blog.id).not.equal(0);
          var newId = "WN333";
          request.get(baseLink + "/blog/" + newId + "/preview?lang=DE", function (err, res) {
            should.not.exist(err);
            should(res.statusCode).eql(500);
            bddone();
          });
        });
      });
    });
  });
  describe("route GET /blog/:blog_id/:tab", function() {
    let url = baseLink + "/blog/WN333/overview";
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
  describe("route GET /blog/:blog_id/preview_:blogname_:downloadtime", function() {
    let url = baseLink + "/blog/WN333/preview_WN333_20172322";
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
