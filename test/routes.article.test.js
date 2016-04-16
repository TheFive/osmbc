"use strict";

var sinon = require('sinon');
var should = require('should');
var async  = require('async');
var path   = require('path');
var nock   = require('nock');
var fs     = require('fs');

var articleModule = require('../model/article.js');
var userModule = require('../model/user.js');

var articleRouter = require('../routes/article.js');

var testutil = require('./testutil.js');


describe('router/article',function() {
  var user = null;
 
  after(function (bddone){
    nock.cleanAll();
    bddone();
  });
  
  beforeEach(function (bddone) {
    // Clear DB Contents for each test
    nock('https://hooks.slack.com/')
            .post(/\/services\/.*/) 
            .times(999) 
            .reply(200,"ok");
    async.series([
      testutil.clearDB,
      function cu(cb) {
        userModule.createNewUser({OSMUser:"TestUser",displayName:"TestUser"},function (err,result){
          if (err) cb(err);
          user = result;
          cb();
        });
      }
    ],bddone);
  }); 
  describe('renderArticleId',function() {
    it('should call next if article not exist',function(bddone) {
      articleModule.createNewArticle({titel:"Hallo"},function(err,article) {
        should.not.exist(err);
        should(article.id).not.equal(0);
        var newId = article.id +1;
        var req = {};
        req.params = {};
        req.params.id = newId;
        var res = {};
        var next;

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            articleRouter.renderArticleId(req,res,next);
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
    describe('Do file base tests',function() {
      beforeEach(function (bddone) {
        articleModule.removeOpenBlogCache();
        testutil.clearDB(bddone);
      });
      function doATest(filename) {
       
        it('should test: '+filename,function (bddone) {
          var file =  path.resolve(__dirname,'data', filename);

          var data =  JSON.parse(fs.readFileSync(file));
         
          var article;
          var res = {};
          var req = {};
          req.params ={};
          req.query = {};
          req.user = user;
          req.session = {};
          var next;
          res.render = null;
          res.rendervar = {layout:"TEMP"};

          async.series([
            function(done) {
              testutil.importData(data,done);
            },
            function(done) {
              // search for the test Article
              articleModule.findOne({title:data.testArticleTitle},function(err,result) {
                should.not.exist(err);
                article = result;
                req.params.article_id = result.id;
                done();
              });    
            } ,
            function(done) {
              // do the test
              res.render = sinon.spy(function(){done();});
              next = sinon.spy(function(){done();});

              articleRouter.renderArticleId(req,res,next);
            }

            ],
            function (err) {
              should.not.exist(err);
              console.dir(next);
              should(next.called).be.false();

              var call = res.render.firstCall;
              should(call.calledWith("article")).be.true();
              var renderData = call.args[1];


              // clean up test data for comparison, Database IDs are random
              for (var i =0;i<renderData.changes.length; i++) delete renderData.changes[i].id;
              for (i=0;i<data.result.changes.length;i++) data.result.changes[i].oid = req.params.article_id;
              article.textHtmlDE = data.result.articleText;
              should(renderData.article).eql(article);
              if(typeof(renderData.params.edit)=='undefined') renderData.params.edit = null;
              should(renderData.params).eql(data.result.params);
              should(renderData.layout).eql("TEMP");
              //should(renderData.user).eql(req.user);
              should(renderData.changes).eql(data.result.changes);
              //should.exist(renderData.listOfOrphanBlog);
              //should(renderData.listOfOrphanBlog).eql(data.result.listOfOrphanBlog);
              //should.exist(renderData.listOfOpenBlog);
              //should(renderData.listOfOpenBlog).eql(data.result.listOfOpenBlog);
              // Reduce article Refererences for comparison
              for (var k in renderData.articleReferences) {
                if (k=="count") continue;
                var a= renderData.articleReferences[k];
                for (i=0;i<a.length;i++) {
                  delete a[i]._meta;
                  delete a[i].id;
                }
              }
              should(renderData.articleReferences).eql(data.result.articleReferences);
              should(renderData.usedLinks).eql(data.result.usedLinks);
              should(renderData.categories).eql(data.result.categories);

 
              bddone();
            }
          );   
        });
      }
      testutil.generateTests("data",/^router.article.renderArticleId.+json/,doATest);
    });
  });
  describe('list',function() {
    describe('Do file base tests',function() {
      beforeEach(function (bddone) {
        testutil.clearDB(bddone);
      });
      function doATest(filename) {
       
        it('should test: '+filename,function (bddone) {
          var file =  path.resolve(__dirname,'data', filename);

          var data =  JSON.parse(fs.readFileSync(file));
         
          var res = {};
          var req = {};
          req.params ={};
          req.query = {};
          req.session = {};
          req.user = user;
          var next;
          res.render = null;
          res.rendervar = {layout:"TEMP"};

          var query = {};
          if (data.listBlog) {
            query.blog = data.listBlog;
            req.query.blog=data.listBlog;
          }

          async.series([
            function(done) {
              testutil.importData(data,done);
            },

            function(done) {
              // do the test
              res.render = sinon.spy(function(){done();});
              next = sinon.spy(function(){done();});

              articleRouter.renderList(req,res,next);
            }

            ],
            function (err) {
              should.not.exist(err);
              should(next.called).be.false();



              var call = res.render.firstCall;
              should(call.calledWith("articlelist")).be.true();
              var renderData = call.args[1];


              should(renderData.articles.length).equal(data.result.articles.length);
              for (var i=0;i<renderData.articles.length;i++) {
                delete renderData.articles[i]._meta;
                delete renderData.articles[i].id;
              }
              should(renderData.articles).eql(data.result.articles);

              should(renderData.listofOrphanBlogs).eql(data.result.listOfOrphanBlogs);
              //should(renderData.util).equal(util);
              //should(renderData.user).eql(req.user);
              should(renderData.layout).eql("TEMP");

 
              bddone();
            }
          );
        });
      }
      testutil.generateTests("data",/^router.article.list.+json/,doATest);
    });
  });
  describe('postArticleID',function() {
    it('should call next if article not exist',function(bddone) {
      articleModule.createNewArticle({titel:"Hallo"},function(err,article) {
        should.not.exist(err);
        should(article.id).not.equal(0);
        var newId = article.id +1;
        var req = {};
        req.params = {};
        req.params.article_id = newId;
        req.user = user;
        req.body = {};
        req.query = {};
        var res = {};
        var next;

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            res.redirect = sinon.spy(callback);
            articleRouter.postArticle(req,res,next);
          }],
          function(err) {
            should.exist(err);
            should(res.render.called).be.false();
            should(res.redirect.called).be.false();
            should(next.called).be.true();
            bddone();            
          }
        );
      });
    });
    it('should post All Values',function(bddone) {
      articleModule.createNewArticle({title:"Hallo"},function(err,article) {
        should.not.exist(err);
        should(article.id).not.equal(0);
        var req = {};
        req.params = {};
        req.query = {};
        req.params.article_id = article.id;
        req.body = {markdownDE:"MARKDOWNDE",
                   markdownEN:"MARKDOWNEN",
                   blog:"BLOG",
                   blogEN:"BLOGEN",
                   collection:"COLLECTION",
                   comment:"COMMENT",
                   category:"CATEGORY",
                   categoryEN:"CATEGORYEN",
                   version:"1",
                   title:"TITLE"};
        req.user = user;
        req.session = {};
        var res = {};
        var next;


        async.series([
          function(callback) {
            res.redirect = sinon.spy(function () {callback();});
            next = sinon.spy(callback);
            articleRouter.postArticle(req,res,next);
          },
          function(callback) {
            articleModule.findById(article.id,function(err,result){
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
            should(res.redirect.firstCall.calledWith("/article/"+article.id)).be.true();
            delete article._meta;
            delete article.id;
            should(article).eql({markdownDE:"MARKDOWNDE",
                   markdownEN:"MARKDOWNEN",
                   blog:"BLOG",
                   commentStatus:"open",
                   collection:"COLLECTION",
                   comment:"COMMENT",
                   categoryEN:"CATEGORYEN",
                   title:"TITLE",version:2});
            bddone();            
          }
        );
      });
    });
  });
  describe('createArticle ',function() {
    it('should call create an article whith given blog and category',function(bddone) {
      var req = {};
      req.query = {blog:"WN234",category:"TEST"};

      var res = {};
      var next;
      res.rendervar = {layout:"TEMP"};




      async.series([
        function(callback) {
          res.redirect = sinon.spy(function () {callback();});
          res.render = sinon.spy(function () {callback();});
          next = sinon.spy(callback);
          articleRouter.createArticle(req,res,next);
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
  describe('searchAndCreate',function() {
    describe('Do file base tests',function() {
      beforeEach(function (bddone) {
        articleModule.removeOpenBlogCache();
        testutil.clearDB(bddone);
      });
      function doATest(filename) {
       
        it('should test: '+filename,function (bddone) {
          var file =  path.resolve(__dirname,'data', filename);

          var data =  JSON.parse(fs.readFileSync(file));
         
          var res = {};
          var req = {};
          req.params ={};
          req.query = {search:data.search};
          req.user = user;
          var next;
          res.render = null;
          res.rendervar = {layout:"TEMP"};

          async.series([
            function(done) {
              testutil.importData(data,done);
            },
            function(done) {
              // do the test
              res.render = sinon.spy(function(){done();});
              next = sinon.spy(function(){done();});

              articleRouter.searchAndCreate(req,res,next);
            }

            ],
            function (err) {
              should.not.exist(err);
              should(next.called).be.false();

              var call = res.render.firstCall;
              should(call.calledWith("collect")).be.true();
              var renderData = call.args[1];


              // clean up test data for comparison, Database IDs are random
              for (var i =0;i<renderData.foundArticles.length; i++) {
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
      testutil.generateTests("data",/^router.article.searchAndCreate.+json/,doATest);
    });
  });
});