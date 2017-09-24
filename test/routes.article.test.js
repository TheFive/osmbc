"use strict";

var sinon   = require("sinon");
var should  = require("should");
var nock    = require("nock");
var request = require("request");
var config  = require("../config.js");
var mockdate = require("mockdate");

var articleModule = require("../model/article.js");

var articleRouterForTestOnly = require("../routes/article.js").fortestonly;

var testutil = require("./testutil.js");

var baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");


describe("router/article", function() {
  this.timeout(3000);

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
    bddone();
  });
  describe("test routes", function() {
    var id = 2;
    beforeEach(function (bddone) {
      id = 2;
      testutil.importData(
        {
          "blog": [{name: "BLOG", status: "edit"},
            {name: "secondblog", status: "edit"}],
          "user": [{"OSMUser": "TestUser", access: "full"},
            {OSMUser: "TestUserDenied", access: "denied"},
            { "OSMUser": "Hallo", access: "full"}
          ],
          "article": [
            {"blog": "BLOG", "markdownDE": "* Dies ist ein kleiner Testartikel.", "category": "Mapping"},
            {"blog": "BLOG", "title": "BLOG", "markdownDE": "* Dies ist ein grosser Testartikel.", "category": "Keine", commentList: [{user: "Hallo", text: "comment"}]}],
          clear: true}, bddone);
    });
    describe("route GET /article/:id", function() {
      let url = baseLink + "/article/" + id;
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: url}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            should(body.indexOf('<option value=\"BLOG\" selected=\"selected\">BLOG (Edit)</option>')).not.equal(-1);
            bddone();
          });
        });
      });
      it("should run with full access user and missing article", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: baseLink + "/article/999"}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("Article ID 999 does not exist")).not.equal(-1);
            bddone();
          });
        });
      });
      it("should run with full access user and not numbered article ID", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: baseLink + "/article/walo"}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("Article ID walo does not exist (conversion error)")).not.equal(-1);
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
    describe("route GET /article/:id/votes", function() {
      let url = baseLink + "/article/" + id + "/votes";
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: url}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            let json = JSON.parse(body);

            should(json["#voteButtons"].indexOf("callAndRedraw(\'/article/2/setVote.unpublish\'")).not.equal(-1);
            should(json["#voteButtonsList"].indexOf('<i class="fa-lg fa fa-thumbs-up">')).not.equal(-1);

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
    describe("route GET /article/:id/commentArea", function() {
      let url = baseLink + "/article/" + id + "/commentArea";
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: url}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            let json = JSON.parse(body);

            should(json["#commentArea"].indexOf("Your comment is shared between all weekly teams.")).not.equal(-1);

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
    describe("route GET /article/:id/markCommentRead", function() {
      let url = baseLink + "/article/" + id + "/markCommentRead?index=0";
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: url}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            should(body.indexOf("Your comment is shared between all weekly teams.")).not.equal(-1);
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
    describe("route GET /article/:id/:action.:tag", function() {
      let url = baseLink + "/article/" + id + "/setTag.tag";
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: url}, function(err, response, body) {
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
    describe("route GET /article/:id/:votename", function() {
      let url = baseLink + "/article/" + id + "/pro";
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: url}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            let json = JSON.parse(body);
            should(json["#vote_pro_2"].indexOf('class="label osmbc-btn-not-voted"')).not.equal(-1);

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
    describe("route GET /list", function() {
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: baseLink + "/article/list"}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            should(body.indexOf('<td><a href="/article/2">BLOG</a></td>')).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny denied access user", function (bddone) {
        testutil.startServer("TestUserDenied", function () {
          request.get({url: baseLink + "/article/list"}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny non existing user", function (bddone) {
        testutil.startServer("TestUserNonExisting", function () {
          request.get({url: baseLink + "/article/list"}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
            bddone();
          });
        });
      });
    });
    describe("route GET /create", function() {
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: baseLink + "/article/create"}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            should(body.indexOf('<p align="center" class="osmbc-help-text">Please check your link for duplicates before   collecting.</p>')).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny denied access user", function (bddone) {
        testutil.startServer("TestUserDenied", function () {
          request.get({url: baseLink + "/article/create"}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny non existing user", function (bddone) {
        testutil.startServer("TestUserNonExisting", function () {
          request.get({url: baseLink + "/article/create"}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
            bddone();
          });
        });
      });
    });
    describe("route GET /searchandcreate", function() {
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: baseLink + "/article/searchandcreate?search=hallo"}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            should(body.indexOf('<p align="center" class="osmbc-help-text">Please check your link for duplicates before   collecting.</p>')).not.equal(-1);
            should(body.indexOf('<input type="text" name="search" value="hallo" class="form-control">')).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny denied access user", function (bddone) {
        testutil.startServer("TestUserDenied", function () {
          request.get({url: baseLink + "/article/searchandcreate?search=hallo"}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny non existing user", function (bddone) {
        testutil.startServer("TestUserNonExisting", function () {
          request.get({url: baseLink + "/article/searchandcreate?search=hallo"}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
            bddone();
          });
        });
      });
    });
    describe("route GET /search", function() {
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.get({ url: baseLink + "/article/search?search=hallo"}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            should(body.indexOf('<input type="text" name="search" value="hallo" class="form-control">')).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny denied access user", function (bddone) {
        testutil.startServer("TestUserDenied", function () {
          request.get({url: baseLink + "/article/search?search=hallo"}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny non existing user", function (bddone) {
        testutil.startServer("TestUserNonExisting", function () {
          request.get({url: baseLink + "/article/search?search=hallo"}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
            bddone();
          });
        });
      });
    });
    describe("route POST /create", function() {
      let url = baseLink + "/article/create";
      let params = {blog: "BLOG",
        collection: "COLLECTION",
        comment: "comment",
        categoryEN: "categoryEN",
        version: "1",
        title: "title",
        addComment: "addComment",
        commentStatus: "close",
        unpublishReason: "unpublisnReason",
        unpublishReference: "unpublishReference"};
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.post({ url: url, form: params}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(302);
            should(body).equal("Found. Redirecting to /article/3");
            articleModule.findById(3, function(err, article) {
              should.not.exist(err);
              delete article._blog;
              should(article).eql({
                id: "3",
                version: 3,
                commentList: [{user: "TestUser", timestamp: "2016-05-25T20:00:00.000Z", text: "addComment"}],
                commentStatus: "open",
                commentRead: { TestUser: 0 },
                blog: "BLOG",
                collection: "COLLECTION",
                comment: "comment",
                categoryEN: "categoryEN",
                title: "title",
                unpublishReason: "unpublisnReason",
                unpublishReference: "unpublishReference",
                firstCollector: "TestUser"
              });
              bddone();
            });
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
    describe("route POST /:article_id", function() {
      let url = baseLink + "/article/2";
      let params = {
        title: "new title",
        version: 1,
        collection: "new collection"};
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.post({ url: url, form: params}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(302);
            should(body).equal("Found. Redirecting to /article/2");
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
    describe("route POST /:article_id/witholdvalues", function() {
      let url = baseLink + "/article/2/witholdvalues";
      let params = {
        title: "new title2",
        old_title: "BLOG",
        collection: "new collection",
        old_collection: ""};
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.post({ url: url, form: params}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(302);
            should(body).equal("Found. Redirecting to /article/2");
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
        testutil.startServer("TestUser", function() {
          request.post({ url: url, form: {title: "new title", old_title: "old title"}}, function(err, response, body) {
            should.not.exist(err);
            // there should be an error, as old title is not the correct one
            should(response.statusCode).eql(500);
            should(body.indexOf("Field title already changed in DB")).not.equal(-1);

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
        testutil.startServer("TestUserDenied", function () {
          request.get({url: url, form: params}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny non existing user", function (bddone) {
        testutil.startServer("TestUserNonExisting", function () {
          request.get({url: url, form: params}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
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
        testutil.startServer("TestUser", function() {
          request.post({ url: url, form: params}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(302);
            should(body).equal("Found. Redirecting to /");
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
        testutil.startServer("TestUser", function() {
          request.post({ url: url, form: {markdown: "new", oldMarkdown: "old"}}, function(err, response, body) {
            should.not.exist(err);
            // there should be an error, as old title is not the correct one
            should(response.statusCode).eql(500);
            should(body.indexOf("Field markdownDE already changed in DB")).not.equal(-1);

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
        testutil.startServer("TestUserDenied", function () {
          request.get({url: url, form: params}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny non existing user", function (bddone) {
        testutil.startServer("TestUserNonExisting", function () {
          request.get({url: url, form: params}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
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
        testutil.startServer("TestUser", function() {
          request.post({ url: url, form: params}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(302);
            should(body).equal("Found. Redirecting to /article/2");
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
          request.get({url: url, form: params}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny non existing user", function (bddone) {
        testutil.startServer("TestUserNonExisting", function () {
          request.get({url: url, form: params}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
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
        testutil.startServer("Hallo", function() {
          request.post({ url: url, form: params}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(302);
            should(body).equal("Found. Redirecting to /article/2");
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
        testutil.startServer("TestUser", function() {
          request.post({ url: url, form: params}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("Only Writer is allowed to change a commment")).not.equal(-1);
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
          request.get({url: url, form: params}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
            bddone();
          });
        });
      });
      it("should deny non existing user", function (bddone) {
        testutil.startServer("TestUserNonExisting", function () {
          request.get({url: url, form: params}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
            bddone();
          });
        });
      });
    });
    describe("route POST /:article_id/copyto/:blog", function() {
      let url = baseLink + "/article/2/copyto/secondblog";
      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.post({ url: url}, function(err, response, body) {
            should.not.exist(err);

            should(response.statusCode).eql(302);
            should(body).equal("Found. Redirecting to /");
            articleModule.findById(3, function(err, article) {
              should.not.exist(err);
              delete article._blog;
              should(article).eql({
                blog: "secondblog",
                id: "3",
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
    describe("route POST /translate/:fromLang/:toLang", function() {
      let url = baseLink + "/article/translate/DE/EN";
      let form = {text: "Dies ist ein deutscher Text."};
      let stub;
      beforeEach(function() {
        stub = sinon.stub(articleRouterForTestOnly.msTransClient, "translate").callsFake(function(params, callback) {
          should(params.from).eql("DE");
          should(params.to).eql("EN");
          should(params.text).eql("Dies ist ein deutscher Text.");
          return callback(null, "This is an english text.");
        });
      });
      afterEach(function() {
        stub.restore();
      });

      it("should run with full access user", function (bddone) {
        testutil.startServer("TestUser", function() {
          request.post({ url: url, form: form}, function(err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(200);
            should(body).equal("This is an english text.");
            bddone();
          });
        });
      });
      it("should deny denied access user", function (bddone) {
        testutil.startServer("TestUserDenied", function () {
          request.get({url: url, form: form}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
            should(stub.called).be.False();
            bddone();
          });
        });
      });
      it("should deny non existing user", function (bddone) {
        testutil.startServer("TestUserNonExisting", function () {
          request.get({url: url, form: form}, function (err, response, body) {
            should.not.exist(err);
            should(response.statusCode).eql(500);
            should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
            should(stub.called).be.False();
            bddone();
          });
        });
      });
    });
  });
});
