"use strict";

var sinon   = require("sinon");
var should  = require("should");
var async   = require("async");
var path    = require("path");
var nock    = require("nock");
var request = require("request");
var fs      = require("fs");
var config  = require("../config.js");
var cheerio = require("cheerio");

var articleModule = require("../model/article.js");
var userModule = require("../model/user.js");

var articleRouterForTestOnly = require("../routes/article.js").fortestonly;

var testutil = require("./testutil.js");


describe("router/article", function() {
  var user = null;
  var baseLink;

  after(function (bddone) {
    nock.cleanAll();
    bddone();
  });

  beforeEach(function (bddone) {
    baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");
    // Clear DB Contents for each test
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    async.series([
      testutil.clearDB,
      function cu(cb) {
        userModule.createNewUser({OSMUser: "TestUser", displayName: "TestUser"}, function (err, result) {
          if (err) cb(err);
          user = result;
          cb();
        });
      }
    ], bddone);
  });
  describe("internal functions",function(){
    it("should call next if article not exist", function(bddone) {
      articleModule.createNewArticle({titel: "Hallo"}, function(err, article) {
        should.not.exist(err);
        should(article.id).not.equal(0);

        var newId = article.id + 1;
        var req = {};
        req.params = {};
        req.params.id = newId;
        var res = {};
        res.set = function() {};
        var next;

        async.series([
            function(callback) {
              res.render = sinon.spy(callback);
              next = sinon.spy(callback);
              articleRouterForTestOnly.getArticleFromID(req, res, next, newId);
            }],
          function(err) {
            should.exist(err);
            should(next.called).be.true();
            should(res.render.called).be.false();
            bddone();
          }
        );
      });
    });
  });
  describe("renderArticleId", function() {
    beforeEach(function (bddone) {
      testutil.startServer("TestUser", bddone);
    });

    it("should run route /article/:id", function (bddone) {
      var article;
      var id;
      async.series([
        function(done) {
          testutil.importData(
            {
              "blog":[{"name":"BLOG","status":"open"}],
              "user":[{"OSMUser":"TestUser",access:"full"}],
              "article":[
                {"blog":"BLOG","markdownDE":"* Dies ist ein kleiner Testartikel.","category":"Mapping"},
                {"blog":"BLOG","title":"BLOG","markdownDE":"* Dies ist ein grosser Testartikel.","category":"Keine"}],clear:true}, done);
        },
        function(done) {
          // search for the test Article
          articleModule.findOne({title: "BLOG"}, function(err, result) {
            should.not.exist(err);
            article = result;
            id = result.id;
            done();
          });
        }
      ],
      function (err) {
        should.not.exist(err);
        request({
          method: "GET",
          url: baseLink + "/article/"+id,
          json: true,
          body: {lang: "DE", action: "startreview"}
        },function(err,response,body){
          should.not.exist(err);
          should(response.statusCode).eql(200);
          let c = cheerio.load(body);
          c("div.child:contains('Title')").value().eql("hallo");
          bddone();
        });

      }
      );
    });
  });
  describe("list", function() {
    describe("Do file base tests", function() {
      beforeEach(function (bddone) {
        testutil.clearDB(bddone);
      });
      function doATest(filename) {
        it("should test: " + filename, function (bddone) {
          var file =  path.resolve(__dirname, "data", filename);

          var data =  JSON.parse(fs.readFileSync(file));

          var res = {};
          res.set = function() {};
          var req = {};
          req.params = {};
          req.query = {};
          req.session = {};
          req.user = user;
          var next;
          res.render = null;
          res.rendervar = {layout: "TEMP"};

          var query = {};
          if (data.listBlog) {
            query.blog = data.listBlog;
            req.query.blog = data.listBlog;
          }

          async.series([
            function(done) {
              testutil.importData(data, done);
            },

            function(done) {
              // do the test
              res.render = sinon.spy(function() { done(); });
              next = sinon.spy(function() { done(); });

              articleRouter.renderList(req, res, next);
            }

          ],
          function (err) {
            should.not.exist(err);
            should(next.called).be.false();



            var call = res.render.firstCall;
            should(call.calledWith("articlelist")).be.true();
            var renderData = call.args[1];


            should(renderData.articles.length).equal(data.result.articles.length);
            for (var i = 0; i < renderData.articles.length; i++) {
              delete renderData.articles[i]._meta;
              delete renderData.articles[i].id;
            }
            should(renderData.articles).eql(data.result.articles);

            should(renderData.listofOrphanBlogs).eql(data.result.listOfOrphanBlogs);
            // should(renderData.util).equal(util);
            // should(renderData.user).eql(req.user);
            should(renderData.layout).eql("TEMP");


            bddone();
          }
          );
        });
      }
      testutil.generateTests("data", /^router.article.list.+json/, doATest);
    });
  });
  describe("postArticleID", function() {
    it("should post All Values", function(bddone) {
      articleModule.createNewArticle({title: "Hallo"}, function(err, article) {
        should.not.exist(err);
        should(article.id).not.equal(0);
        var req = {};
        req.params = {};
        req.query = {};
        req.params.article_id = article.id;
        req.body = {markdownDE: "MARKDOWNDE",
          markdownEN: "MARKDOWNEN",
          blog: "BLOG",
          blogEN: "BLOGEN",
          collection: "COLLECTION",
          comment: "COMMENT",
          category: "CATEGORY",
          categoryEN: "CATEGORYEN",
          version: "1",
          title: "TITLE"};
        req.user = user;
        req.session = {};
        req.article = article;
        var res = {};
        res.set = function() {};
        var next;


        async.series([
          function(callback) {
            res.redirect = sinon.spy(function () { callback(); });
            next = sinon.spy(callback);
            articleRouter.postArticle(req, res, next);
          },
          function(callback) {
            articleModule.findById(article.id, function(err, result) {
              should.not.exist(err);
              article = result;
              callback();
            });
          }
        ],
        function(err) {
          should.not.exist(err);
          should(res.redirect.calledOnce).be.true();
          should(next.called).be.false();
          should(res.redirect.firstCall.calledWith("/article/" + article.id)).be.true();
          delete article._meta;
          delete article.id;
          should(article).eql({markdownDE: "MARKDOWNDE",
            markdownEN: "MARKDOWNEN",
            blog: "BLOG",
            commentStatus: "open",
            collection: "COLLECTION",
            comment: "COMMENT",
            categoryEN: "CATEGORYEN",
            title: "TITLE",
            version: 2,
            _blog: null});
          bddone();
        }
        );
      });
    });
  });
  describe("createArticle ", function() {
    it("should call create an article whith given blog and category", function(bddone) {
      var req = {};
      req.query = {blog: "WN234", category: "TEST"};

      var res = {};
      res.set = function() {};
      var next;
      res.rendervar = {layout: "TEMP"};




      async.series([
        function(callback) {
          res.redirect = sinon.spy(function () { callback(); });
          res.render = sinon.spy(function () { callback(); });
          next = sinon.spy(callback);
          articleRouter.createArticle(req, res, next);
        }
      ],
      function(err) {
        should.not.exist(err);
        should(res.render.calledOnce).be.true();
        should(res.render.firstCall.calledWith("collect"));
        should(next.called).be.false();
        should(res.redirect.called).be.false();
        bddone();
      }
      );
    });
  });
  describe("searchAndCreate", function() {
    describe("Do file base tests", function() {
      beforeEach(function (bddone) {
        articleModule.removeOpenBlogCache();
        testutil.clearDB(bddone);
      });
      function doATest(filename) {
        it("should test: " + filename, function (bddone) {
          var file =  path.resolve(__dirname, "data", filename);

          var data =  JSON.parse(fs.readFileSync(file));

          var res = {};
          res.set = function() {};
          var req = {};
          req.params = {};
          req.query = {search: data.search};
          req.user = user;
          var next;
          res.render = null;
          res.rendervar = {layout: "TEMP"};

          async.series([
            function(done) {
              testutil.importData(data, done);
            },
            function(done) {
              // do the test
              res.render = sinon.spy(function() { done(); });
              next = sinon.spy(function() { done(); });

              articleRouter.searchAndCreate(req, res, next);
            }

          ],
          function (err) {
            should.not.exist(err);
            should(next.called).be.false();

            var call = res.render.firstCall;
            should(call.calledWith("collect")).be.true();
            var renderData = call.args[1];


            // clean up test data for comparison, Database IDs are random
            for (var i = 0; i < renderData.foundArticles.length; i++) {
              delete renderData.foundArticles[i].id;
              delete renderData.foundArticles[i]._meta;
            }
            should(renderData.foundArticles).eql(data.result.foundArticles);
            should(renderData.layout).eql("TEMP");
            should(renderData.search).eql(data.search);


            bddone();
          }
          );
        });
      }
      testutil.generateTests("data", /^router.article.searchAndCreate.+json/, doATest);
    });
  });
});
