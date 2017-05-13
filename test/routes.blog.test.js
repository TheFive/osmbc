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





describe("routes/blog", function() {
  var baseLink;
  beforeEach(function(bddone) {
    async.series([
      testutil.clearDB,
      function cu(cb) {
        userModule.createNewUser({OSMUser: "TestUser", displayName: "TestUser", access: "full"}, function (err) {
          if (err) cb(err);
          cb();
        });
      }
    ], bddone);
  });
  before(function(bddone) {
    sinon.spy(jade, "__express");

    nock("https://hooks.slack.com/")
            .post(/\/services\/.*/)
            .times(999)
            .reply(200, "ok");
    baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");
    testutil.startServer("TestUser", bddone);
  });
  after(function(bddone) {
    jade.__express.restore();
    nock.cleanAll();
    testutil.stopServer();
    bddone();
  });

  describe("status functions", function() {
    before(function(bddone) {
      mockdate.set(new Date("2016-05-25T20:00"));
      return bddone();
    });
    after(function(bddone) {
      mockdate.reset();
      return bddone();
    });

    it("should a start a review process", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err) {
        should.not.exist(err);
        request({
          method: "POST",
          url: baseLink + "/blog/WN333/setLangStatus",
          json: true,
          body: {lang: "DE", action: "startreview"}
        }, function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(302);
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
      blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err) {
        should.not.exist(err);
        request({
          method: "POST",
          url: baseLink + "/blog/WN333/setLangStatus",
          json: true,
          body: {lang: "EN", action: "markexported"}
        }, function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(302);
          blogModule.findOne({name: "WN333"}, function (err, blog) {
            should.not.exist(err);
            should(blog.exportedEN).eql(true);
            bddone();
          });
        });
      });
    });
    it("should not clear review when starting a review process", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"},
        {name: "WN333", reviewCommentDE: [{user: "hallo", text: "test"}]},
        function (err) {
          should.not.exist(err);
          request({
            method: "POST",
            url: baseLink + "/blog/WN333/setLangStatus",
            json: true,
            body: {lang: "DE", action: "startreview"}
          }, function (err, res) {
            should.not.exist(err);
            should(res.statusCode).eql(302);
            blogModule.findOne({name: "WN333"}, function (err, blog) {
              should.not.exist(err);
              should(blog.reviewCommentDE).eql([{user: "hallo", text: "test"}]);
              bddone();
            }
            );
          }
        );
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
    it("should set a review comment", function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"},
        {name: "WN333", reviewCommentEN: [{user: "hallo", text: "test"}]},
        function (err) {
          should.not.exist(err);
          request({
            method: "POST",
            url: baseLink + "/blog/WN333/setReviewComment",
            json: true,
            body: {lang: "EN", text: "Everything is fine"}
          }, function (err, res) {
            should.not.exist(err);
            should(res.statusCode).eql(302);
            blogModule.findOne({name: "WN333"}, function (err, blog) {
              should.not.exist(err);
              should(blog.reviewCommentEN).eql([
                  {user: "hallo", text: "test"},
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
  });
  describe("renderBlogPreview", function() {
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

          should(res.body).containEql("<p>Warning: This export contains empty Articles</p>");
          bddone();
        });
      });
    });
  });
  describe("renderBlogTab", function() {
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
});
